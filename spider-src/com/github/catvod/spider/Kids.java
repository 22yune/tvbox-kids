package com.github.catvod.spider;

import android.content.Context;

import com.github.catvod.crawler.Spider;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.zip.GZIPInputStream;

public class Kids extends Spider {

    private static final String LIST_API = "https://api.cntv.cn/NewVideo/getVideoListByColumn";
    private static final String PLAY_API = "https://vdn.apps.cntv.cn/api/getHttpVideoInfo.do";
    private static final String BILI_VIEW_API = "https://api.bilibili.com/x/web-interface/view";
    private static final String BILI_PLAY_API = "https://api.bilibili.com/x/player/playurl";
    private static final String UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    private static final String REFERER = "https://tv.cctv.com/";
    private static final String BILI_REFERER = "https://www.bilibili.com/";
    private static final int PAGE_SIZE = 12;

    private final JSONArray catalog;
    private final JSONObject taxonomy;
    private String mode = "age";

    public Kids() {
        JSONArray items = new JSONArray();
        JSONObject groups = new JSONObject();
        try {
            items = new JSONArray(Catalog.SERIES);
            groups = new JSONObject(Catalog.TAXONOMY);
        } catch (Exception ignored) {
        }
        catalog = items;
        taxonomy = groups;
    }

    @Override
    public void init(Context context, String extend) {
        mode = "age";
        if (extend == null) return;
        String text = extend.trim();
        if (text.isEmpty()) return;
        if (!text.startsWith("{")) {
            if (isMode(text)) mode = text;
            return;
        }
        try {
            String value = new JSONObject(text).optString("mode", "");
            if (isMode(value)) mode = value;
        } catch (Exception ignored) {
        }
    }

    @Override
    public String homeContent(boolean filter) {
        try {
            JSONObject result = new JSONObject();
            result.put("class", classes());
            result.put("list", latest());
            return result.toString();
        } catch (Exception e) {
            JSONObject result = new JSONObject();
            try {
                result.put("class", new JSONArray());
                result.put("list", new JSONArray().put(errorCard(text(e))));
            } catch (Exception ignored) {
            }
            return result.toString();
        }
    }

    @Override
    public String categoryContent(String tid, String pg, boolean filter, HashMap<String, String> extend) {
        try {
            List<JSONObject> items = select(tid);
            sort(items, tid);
            List<JSONObject> cards = new ArrayList<>();
            for (JSONObject item : items) {
                JSONObject card = card(item);
                if ("path".equals(mode)) {
                    int stage = stage(item, tid);
                    card.put("vod_remarks", (stage < 99 ? "第" + stage + "阶段 · " : "") + ageLabel(item));
                } else if ("topic".equals(mode)) {
                    String latest = clean(item.optString("latest"));
                    card.put("vod_remarks", latest.isEmpty() ? ageLabel(item) : cut(latest, 12));
                }
                cards.add(card);
            }
            return page(cards, pg);
        } catch (Exception e) {
            JSONObject result = new JSONObject();
            try {
                result.put("list", new JSONArray().put(errorCard(text(e))));
                result.put("page", 1);
                result.put("pagecount", 1);
                result.put("limit", PAGE_SIZE);
                result.put("total", 1);
            } catch (Exception ignored) {
            }
            return result.toString();
        }
    }

    @Override
    public String detailContent(List<String> ids) {
        String raw = ids == null || ids.isEmpty() ? "" : ids.get(0);
        String id = raw == null ? "" : raw.trim();
        if (id.startsWith("series/")) id = id.substring(7);
        JSONObject item = find(toList(catalog), id);
        if (item == null) return message("未找到该系列");

        boolean bili = "bili".equals(item.optString("source"));
        JSONArray episodes;
        try {
            episodes = bili ? biliEpisodes(item) : episodes(item);
        } catch (Exception e) {
            return message((bili ? "哔哩哔哩" : "央视") + "接口请求失败：" + text(e));
        }
        if (episodes.length() == 0) return message("该系列暂时没有可播放的内容");

        try {
            JSONObject vod = card(item);
            vod.put("vod_remarks", "共 " + episodes.length() + " 集");
            vod.put("vod_content", content(item));
            List<String> froms = new ArrayList<>();
            List<String> urls = new ArrayList<>();
            froms.add(bili ? "哔哩哔哩" : "央视");
            urls.add(playUrl(episodes));
            JSONArray backups = item.optJSONArray("backups");
            for (int i = 0; backups != null && i < backups.length(); i++) {
                JSONObject backup = backups.optJSONObject(i);
                if (backup == null) continue;
                JSONArray names = backup.optJSONArray("episodes");
                if (names == null || names.length() == 0) continue;
                List<String> parts = new ArrayList<>();
                for (int j = 0; j < names.length(); j++) {
                    String name = clean(names.optString(j));
                    if (name.isEmpty()) name = "第" + (j + 1) + "集";
                    parts.add(name + "$mac:" + item.optString("id") + ":" + i + ":" + j);
                }
                froms.add("备用·" + clean(backup.optString("site", "线路")));
                urls.add(join(parts, "#"));
            }
            vod.put("vod_play_from", join(froms, "$$$"));
            vod.put("vod_play_url", join(urls, "$$$"));
            JSONObject result = new JSONObject();
            result.put("list", new JSONArray().put(vod));
            return result.toString();
        } catch (Exception e) {
            return message(text(e));
        }
    }

    @Override
    public String searchContent(String key, boolean quick, String pg) {
        try {
            String query = clean(key).toLowerCase(Locale.ROOT);
            List<JSONObject> cards = new ArrayList<>();
            if (!query.isEmpty()) {
                for (JSONObject item : toList(catalog)) {
                    if (matches(item, query)) cards.add(card(item));
                }
            }
            return page(cards, pg);
        } catch (Exception e) {
            return page(new ArrayList<JSONObject>(), "1");
        }
    }

    @Override
    public String playerContent(String flag, String id, List<String> vipFlags) {
        String pid = id == null ? "" : id.trim();
        if (pid.isEmpty()) return playerMessage("缺少节目 ID");
        if (pid.startsWith("bili:")) return biliPlayer(pid);
        if (pid.startsWith("mac:")) return macPlayer(pid);
        try {
            JSONObject data = new JSONObject(get(PLAY_API + "?pid=" + encode(pid)));
            String url = data.optString("hls_url", "");
            if (url.isEmpty()) {
                JSONObject video = data.optJSONObject("video");
                if (video != null) url = video.optString("hls_url", "");
            }
            if (url.isEmpty()) return playerMessage(data.optString("tip_msg", "央视未返回播放地址"));
            JSONObject header = new JSONObject();
            header.put("User-Agent", UA);
            header.put("Referer", REFERER);
            JSONObject result = new JSONObject();
            result.put("parse", 0);
            result.put("url", url);
            result.put("header", header);
            return result.toString();
        } catch (Exception e) {
            return playerMessage("播放地址解析失败：" + text(e));
        }
    }

    private boolean isMode(String value) {
        return "age".equals(value) || "path".equals(value) || "topic".equals(value);
    }

    private String bucket() {
        if ("path".equals(mode)) return "paths";
        if ("topic".equals(mode)) return "topics";
        return "ages";
    }

    private JSONArray classes() {
        JSONArray result = new JSONArray();
        JSONArray source = taxonomy.optJSONArray(bucket());
        if (source == null) return result;
        for (int i = 0; i < source.length(); i++) {
            JSONObject item = source.optJSONObject(i);
            if (item == null) continue;
            try {
                JSONObject entry = new JSONObject();
                entry.put("type_id", item.optString("id"));
                entry.put("type_name", item.optString("name"));
                result.put(entry);
            } catch (Exception ignored) {
            }
        }
        return result;
    }

    private JSONArray latest() {
        List<JSONObject> items = toList(catalog);
        Collections.sort(items, new Comparator<JSONObject>() {
            @Override
            public int compare(JSONObject a, JSONObject b) {
                return Long.compare(b.optLong("latestTime", 0), a.optLong("latestTime", 0));
            }
        });
        JSONArray result = new JSONArray();
        for (int i = 0; i < items.size() && i < 6; i++) {
            JSONObject item = items.get(i);
            JSONObject card = card(item);
            try {
                card.put("vod_remarks", "更新 · " + ageLabel(item));
            } catch (Exception ignored) {
            }
            result.put(card);
        }
        return result;
    }

    private List<JSONObject> select(String tid) {
        List<JSONObject> result = new ArrayList<>();
        if ("path".equals(mode)) {
            for (JSONObject item : toList(catalog)) {
                if (contains(item.optJSONArray("paths"), tid)) result.add(item);
            }
            return result;
        }
        if ("topic".equals(mode)) {
            JSONObject topic = find(taxonomy.optJSONArray("topics"), tid);
            if (topic == null) return result;
            JSONArray tags = topic.optJSONArray("tags");
            for (JSONObject item : toList(catalog)) {
                if (overlaps(item.optJSONArray("tags"), tags)) result.add(item);
            }
            return result;
        }
        JSONObject band = find(taxonomy.optJSONArray("ages"), tid);
        if (band == null) return result;
        int min = band.optInt("min", 0);
        int max = band.optInt("max", 18);
        for (JSONObject item : toList(catalog)) {
            if (item.optInt("ageMin", 0) < max && item.optInt("ageMax", 18) > min) result.add(item);
        }
        return result;
    }

    private void sort(List<JSONObject> items, final String tid) {
        final boolean byPath = "path".equals(mode);
        Collections.sort(items, new Comparator<JSONObject>() {
            @Override
            public int compare(JSONObject a, JSONObject b) {
                int result = byPath
                        ? Integer.compare(stage(a, tid), stage(b, tid))
                        : Integer.compare(a.optInt("order", 0), b.optInt("order", 0));
                if (result != 0) return result;
                result = Integer.compare(a.optInt("ageMin", 0), b.optInt("ageMin", 0));
                if (result != 0) return result;
                return Integer.compare(a.optInt("order", 0), b.optInt("order", 0));
            }
        });
    }

    private int stage(JSONObject item, String tid) {
        JSONObject stages = item.optJSONObject("stages");
        int value = stages == null ? 0 : stages.optInt(tid, 0);
        return value > 0 ? value : 99;
    }

    private JSONObject card(JSONObject item) {
        JSONObject card = new JSONObject();
        try {
            card.put("vod_id", "series/" + item.optString("id"));
            card.put("vod_name", item.optString("name"));
            card.put("vod_pic", item.optString("pic"));
            card.put("vod_remarks", ageLabel(item));
            card.put("style", style());
        } catch (Exception ignored) {
        }
        return card;
    }

    private JSONObject style() {
        JSONObject style = new JSONObject();
        try {
            style.put("type", "rect");
            style.put("ratio", 1.78);
        } catch (Exception ignored) {
        }
        return style;
    }

    private JSONObject errorCard(String message) {
        JSONObject card = new JSONObject();
        try {
            String summary = cut(clean(message), 80);
            card.put("vod_id", "err");
            card.put("vod_name", "【爬虫出错】" + (summary.isEmpty() ? "未知错误" : summary));
            card.put("vod_pic", "");
            card.put("vod_remarks", "把这条截图发我");
            card.put("style", style());
        } catch (Exception ignored) {
        }
        return card;
    }

    private String page(List<JSONObject> cards, String pg) {
        int page = pageNumber(pg);
        int total = cards.size();
        int pagecount = Math.max(1, (total + PAGE_SIZE - 1) / PAGE_SIZE);
        JSONArray list = new JSONArray();
        int start = (page - 1) * PAGE_SIZE;
        for (int i = start; i < start + PAGE_SIZE && i < total; i++) list.put(cards.get(i));
        JSONObject result = new JSONObject();
        try {
            result.put("list", list);
            result.put("page", page);
            result.put("pagecount", pagecount);
            result.put("limit", PAGE_SIZE);
            result.put("total", total);
        } catch (Exception ignored) {
        }
        return result.toString();
    }

    private int pageNumber(String pg) {
        try {
            return Math.max(1, Integer.parseInt(String.valueOf(pg).trim()));
        } catch (Exception e) {
            return 1;
        }
    }

    private JSONArray episodes(JSONObject item) throws Exception {
        int count = Math.max(1, Math.min(60, item.optInt("episodes", 60)));
        String url = LIST_API + "?id=" + encode(item.optString("column"))
                + "&n=" + count + "&sort=desc&p=1&mode=0&serviceId=tvcctv";
        JSONObject data = new JSONObject(get(url));
        JSONObject payload = data.optJSONObject("data");
        JSONArray list = payload == null ? null : payload.optJSONArray("list");
        JSONArray result = new JSONArray();
        for (JSONObject entry : toList(list)) {
            String guid = entry.optString("guid");
            if (guid.isEmpty()) continue;
            JSONObject episode = new JSONObject();
            episode.put("name", clean(entry.optString("title")));
            episode.put("id", guid);
            result.put(episode);
        }
        return result;
    }

    // B 站视频的分 P 就是集数；播放时用 bvid+cid 再换临时直链。
    private JSONArray biliEpisodes(JSONObject item) throws Exception {
        String bvid = item.optString("bvid");
        if (bvid.isEmpty()) throw new IllegalStateException("缺少 bvid");
        JSONObject data = new JSONObject(get(BILI_VIEW_API + "?bvid=" + encode(bvid), BILI_REFERER));
        JSONObject view = data.optJSONObject("data");
        JSONArray pages = view == null ? null : view.optJSONArray("pages");
        JSONArray result = new JSONArray();
        for (JSONObject page : toList(pages)) {
            if (result.length() >= 100) break;
            String cid = page.optString("cid");
            if (cid.isEmpty()) continue;
            String name = clean(page.optString("part"));
            if (name.isEmpty()) name = "第" + (result.length() + 1) + "集";
            JSONObject episode = new JSONObject();
            episode.put("name", name);
            episode.put("id", "bili:" + bvid + ":" + cid);
            result.put(episode);
        }
        return result;
    }

    private String biliPlayer(String pid) {
        String[] parts = pid.split(":");
        if (parts.length < 3) return playerMessage("播放参数异常");
        try {
            String url = BILI_PLAY_API + "?bvid=" + encode(parts[1]) + "&cid=" + encode(parts[2])
                    + "&qn=64&fnval=1&fnver=0&fourk=0";
            JSONObject data = new JSONObject(get(url, BILI_REFERER));
            JSONObject payload = data.optJSONObject("data");
            JSONArray durl = payload == null ? null : payload.optJSONArray("durl");
            if (durl == null || durl.length() == 0) return playerMessage("哔哩哔哩未返回播放地址");
            JSONObject first = durl.optJSONObject(0);
            String play = first == null ? "" : first.optString("url");
            if (play.isEmpty()) return playerMessage("哔哩哔哩未返回播放地址");
            JSONObject header = new JSONObject();
            header.put("User-Agent", UA);
            header.put("Referer", BILI_REFERER);
            JSONObject result = new JSONObject();
            result.put("parse", 0);
            result.put("url", play);
            result.put("header", header);
            return result.toString();
        } catch (Exception e) {
            return playerMessage("哔哩哔哩播放地址解析失败：" + text(e));
        }
    }

    // 备用线路：播放时再取一次详情，拿到当次有效的 m3u8 地址。
    private String macPlayer(String pid) {
        String[] parts = pid.split(":");
        if (parts.length < 4) return playerMessage("播放参数异常");
        int backupIndex;
        int episodeIndex;
        try {
            backupIndex = Integer.parseInt(parts[2]);
            episodeIndex = Integer.parseInt(parts[3]);
        } catch (Exception e) {
            return playerMessage("播放参数异常");
        }
        JSONObject item = find(toList(catalog), parts[1]);
        if (item == null) return playerMessage("未找到该系列");
        JSONArray backups = item.optJSONArray("backups");
        JSONObject backup = backups == null ? null : backups.optJSONObject(backupIndex);
        if (backup == null) return playerMessage("缺少备用线路");
        String api = backup.optString("api");
        String referer = backup.optString("referer", REFERER);
        String vodId = backup.optString("vodId");
        if (api.isEmpty() || vodId.isEmpty()) return playerMessage("备用线路参数异常");
        try {
            String url = api + (api.contains("?") ? "&" : "?") + "ac=detail&ids=" + encode(vodId);
            JSONObject data = new JSONObject(get(url, referer));
            JSONArray list = data.optJSONArray("list");
            JSONObject detail = list == null ? null : list.optJSONObject(0);
            if (detail == null) return playerMessage("备用线路没有返回详情");
            String[] froms = detail.optString("vod_play_from").split("\\$\\$\\$");
            String[] groups = detail.optString("vod_play_url").split("\\$\\$\\$");
            String from = backup.optString("from");
            int group = -1;
            for (int i = 0; i < froms.length; i++) {
                if (from.equals(froms[i])) {
                    group = i;
                    break;
                }
            }
            if (group < 0 || group >= groups.length) {
                for (int i = 0; i < groups.length; i++) {
                    if (groups[i].contains(".m3u8")) {
                        group = i;
                        break;
                    }
                }
            }
            if (group < 0 || group >= groups.length) return playerMessage("备用线路没有播放地址");
            String[] episodes = groups[group].split("#");
            if (episodes.length == 0) return playerMessage("备用线路没有播放地址");
            if (episodeIndex < 0) episodeIndex = 0;
            if (episodeIndex >= episodes.length) episodeIndex = episodes.length - 1;
            String episode = episodes[episodeIndex];
            int at = episode.indexOf('$');
            String play = (at < 0 ? episode : episode.substring(at + 1)).trim();
            if (!play.startsWith("http")) return playerMessage("备用线路地址异常");
            JSONObject header = new JSONObject();
            header.put("User-Agent", UA);
            header.put("Referer", referer);
            JSONObject result = new JSONObject();
            result.put("parse", 0);
            result.put("url", play);
            result.put("header", header);
            return result.toString();
        } catch (Exception e) {
            return playerMessage("备用线路解析失败：" + text(e));
        }
    }

    private String content(JSONObject item) {
        List<String> lines = new ArrayList<>();
        String desc = clean(item.optString("desc"));
        if (!desc.isEmpty()) lines.add(desc);
        String why = clean(item.optString("why"));
        if (!why.isEmpty()) lines.add("入选理由：" + why);
        lines.add("适龄：" + ageLabel(item));

        List<String> paths = new ArrayList<>();
        JSONArray ids = item.optJSONArray("paths");
        if (ids != null) {
            for (int i = 0; i < ids.length(); i++) {
                JSONObject path = find(taxonomy.optJSONArray("paths"), ids.optString(i));
                if (path != null) paths.add(path.optString("name"));
            }
        }
        if (!paths.isEmpty()) lines.add("学习路线：" + join(paths, "、"));
        boolean bili = "bili".equals(item.optString("source"));
        lines.add(bili ? "内容来源：哔哩哔哩（B站）UP 主上传，播放时实时取流。" : "内容来源：央视网，播放时实时解析。");
        JSONArray backups = item.optJSONArray("backups");
        List<String> backupNames = new ArrayList<>();
        for (int i = 0; backups != null && i < backups.length(); i++) {
            String site = clean(backups.optJSONObject(i) == null ? "" : backups.optJSONObject(i).optString("site"));
            if (!site.isEmpty() && !backupNames.contains(site)) backupNames.add(site);
        }
        if (!backupNames.isEmpty()) {
            lines.add("备用线路：" + join(backupNames, "、") + "（第三方采集站，画质和广告不可控）");
        }
        return join(lines, "\n");
    }

    private String playUrl(JSONArray episodes) {
        List<String> parts = new ArrayList<>();
        for (int i = 0; i < episodes.length(); i++) {
            JSONObject episode = episodes.optJSONObject(i);
            if (episode == null) continue;
            String name = clean(episode.optString("name"));
            if (name.isEmpty()) name = "第" + (i + 1) + "集";
            parts.add(name + "$" + episode.optString("id"));
        }
        return join(parts, "#");
    }

    private String message(String msg) {
        JSONObject result = new JSONObject();
        try {
            result.put("list", new JSONArray());
            result.put("msg", msg);
        } catch (Exception ignored) {
        }
        return result.toString();
    }

    private String playerMessage(String msg) {
        JSONObject result = new JSONObject();
        try {
            result.put("parse", 0);
            result.put("msg", msg);
        } catch (Exception ignored) {
        }
        return result.toString();
    }

    private boolean matches(JSONObject item, String query) {
        if (lower(clean(item.optString("name"))).contains(query)) return true;
        if (lower(clean(item.optString("desc"))).contains(query)) return true;
        JSONArray tags = item.optJSONArray("tags");
        if (tags == null) return false;
        for (int i = 0; i < tags.length(); i++) {
            if (lower(clean(tags.optString(i))).contains(query)) return true;
        }
        return false;
    }

    private boolean contains(JSONArray array, String value) {
        if (array == null || value == null) return false;
        for (int i = 0; i < array.length(); i++) {
            if (value.equals(array.optString(i))) return true;
        }
        return false;
    }

    private boolean overlaps(JSONArray left, JSONArray right) {
        if (left == null || right == null) return false;
        for (int i = 0; i < left.length(); i++) {
            if (contains(right, left.optString(i))) return true;
        }
        return false;
    }

    private JSONObject find(JSONArray array, String id) {
        if (array == null || id == null) return null;
        for (int i = 0; i < array.length(); i++) {
            JSONObject item = array.optJSONObject(i);
            if (item != null && id.equals(item.optString("id"))) return item;
        }
        return null;
    }

    private JSONObject find(List<JSONObject> items, String id) {
        if (id == null) return null;
        for (JSONObject item : items) {
            if (id.equals(item.optString("id"))) return item;
        }
        return null;
    }

    private List<JSONObject> toList(JSONArray array) {
        List<JSONObject> list = new ArrayList<>();
        if (array == null) return list;
        for (int i = 0; i < array.length(); i++) {
            JSONObject item = array.optJSONObject(i);
            if (item != null) list.add(item);
        }
        return list;
    }

    private String ageLabel(JSONObject item) {
        return item.optInt("ageMin", 0) + "-" + item.optInt("ageMax", 0) + "岁";
    }

    private String clean(String value) {
        if (value == null) return "";
        return value.replace("$", " ").replace("#", " ").replaceAll("\\s+", " ").trim();
    }

    private String lower(String value) {
        return value.toLowerCase(Locale.ROOT);
    }

    private String cut(String value, int length) {
        return value.length() <= length ? value : value.substring(0, length);
    }

    private String join(List<String> parts, String separator) {
        StringBuilder builder = new StringBuilder();
        for (String part : parts) {
            if (builder.length() > 0) builder.append(separator);
            builder.append(part);
        }
        return builder.toString();
    }

    private String text(Throwable error) {
        if (error == null) return "";
        String message = error.getMessage();
        return message == null || message.isEmpty() ? error.getClass().getSimpleName() : message;
    }

    private String encode(String value) {
        try {
            return URLEncoder.encode(value == null ? "" : value, "UTF-8");
        } catch (Exception e) {
            return "";
        }
    }

    private String get(String url) throws Exception {
        return get(url, REFERER);
    }

    private String get(String url, String referer) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
        try {
            connection.setConnectTimeout(15000);
            connection.setReadTimeout(20000);
            connection.setRequestProperty("User-Agent", UA);
            connection.setRequestProperty("Referer", referer);
            connection.setRequestProperty("Accept", "application/json, text/plain, */*");
            connection.setRequestProperty("Accept-Encoding", "gzip");
            int code = connection.getResponseCode();
            if (code < 200 || code >= 300) throw new IllegalStateException("HTTP " + code);
            InputStream input = connection.getInputStream();
            if ("gzip".equalsIgnoreCase(connection.getContentEncoding())) input = new GZIPInputStream(input);
            try {
                return read(input);
            } finally {
                input.close();
            }
        } finally {
            connection.disconnect();
        }
    }

    private String read(InputStream input) throws Exception {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int count;
        while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
        return new String(output.toByteArray(), StandardCharsets.UTF_8);
    }
}
