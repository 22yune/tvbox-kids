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
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.zip.GZIPInputStream;

public class Kids extends Spider {

    private static final String LIST_API = "https://api.cntv.cn/NewVideo/getVideoListByColumn";
    private static final String PLAY_API = "https://vdn.apps.cntv.cn/api/getHttpVideoInfo.do";
    private static final String BILI_VIEW_API = "https://api.bilibili.com/x/web-interface/view";
    private static final String BILI_PLAY_API = "https://api.bilibili.com/x/player/playurl";
    private static final String BILI_SEARCH_API = "https://api.bilibili.com/x/web-interface/search/all/v2";
    private static final String UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    private static final String REFERER = "https://tv.cctv.com/";
    private static final String BILI_REFERER = "https://www.bilibili.com/";
    private static final String SEARCH_REFERER = "https://search.bilibili.com/";
    private static final int PAGE_SIZE = 24;
    private static final int SEARCH_LIMIT = 200;
    private static final int MIN_SECONDS = 60;
    // 搜索命中的直播回放、切片、解说这类视频对儿童没有价值，直接在结果里剔掉。
    private static final Pattern BILI_BLOCK = Pattern.compile(
            "直播回放|直播预告|预告片|花絮|解说|切片|盘点|混剪|鬼畜|广告|手游|开箱|测评|吐槽|reaction",
            Pattern.CASE_INSENSITIVE);

    private final JSONArray catalog;
    private final JSONArray ips;
    private final JSONObject taxonomy;
    private final Set<String> knownBvids = new HashSet<>();
    private final List<String> knownNames = new ArrayList<>();
    private String mode = "age";

    public Kids() {
        JSONArray items = new JSONArray();
        JSONArray groups = new JSONArray();
        JSONObject groups2 = new JSONObject();
        try {
            items = new JSONArray(Catalog.SERIES);
            groups = new JSONArray(Catalog.IP);
            groups2 = new JSONObject(Catalog.TAXONOMY);
        } catch (Exception ignored) {
        }
        catalog = items;
        ips = groups;
        taxonomy = groups2;
        for (JSONObject item : toList(items)) {
            String bvid = item.optString("bvid");
            if (!bvid.isEmpty()) knownBvids.add(bvid);
        }
        for (JSONObject unit : units()) {
            addKnown(unit.optString("name"));
            if (!isGroup(unit)) continue;
            for (JSONObject season : toList(unit.optJSONArray("seasons"))) {
                JSONObject item = find(toList(items), season.optString("id"));
                if (item != null) addKnown(item.optString("name"));
            }
        }
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
            result.put("filters", filters());
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
            if ("topic".equals(mode) && isTopicGroup(tid)) return topicFolders(tid, extend);
            List<JSONObject> items = select(tid, extend);
            sort(items, tid);
            List<JSONObject> cards = new ArrayList<>();
            for (JSONObject item : items) cards.add(card(item, tid));
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
        if (id.startsWith("bv/")) return biliVideoDetail(id.substring(3));
        if (id.startsWith("ip/")) return groupDetail(id.substring(3));
        if (id.startsWith("series/")) return seriesDetail(id.substring(7));
        if (find(toList(catalog), id) != null) return seriesDetail(id);
        return groupDetail(id);
    }

    // 搜索范围：本地目录（含央视、B 站、采集站）+ 哔哩哔哩实时搜索。
    // 实时结果里已经在本地目录的按 bvid 和标题排掉，避免同一部片子出现两遍。
    @Override
    public String searchContent(String key, boolean quick, String pg) {
        List<JSONObject> cards = new ArrayList<>();
        String query = clean(key);
        String lowerQuery = lower(query);
        if (query.isEmpty()) return page(cards, pg);
        for (JSONObject unit : units()) {
            if (matches(unit, lowerQuery)) cards.add(card(unit, ""));
        }
        if (!quick) {
            for (JSONObject video : biliSearch(query)) {
                if (cards.size() >= SEARCH_LIMIT) break;
                String bvid = video.optString("bvid");
                String title = strip(video.optString("title"));
                if (bvid.isEmpty() || title.isEmpty() || covered(bvid, title)) continue;
                cards.add(biliCard(video, bvid, title));
            }
        }
        return page(cards, pg);
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
        return "age".equals(value) || "path".equals(value) || "content".equals(value)
                || "topic".equals(value) || "alpha".equals(value) || "source".equals(value)
                || "search".equals(value);
    }

    private String bucket() {
        if ("path".equals(mode)) return "paths";
        if ("content".equals(mode) || "search".equals(mode)) return "contents";
        if ("topic".equals(mode)) return "topicGroups";
        if ("alpha".equals(mode)) return "alphabet";
        if ("source".equals(mode)) return "sources";
        return "ages";
    }

    private JSONArray classes() {
        JSONArray result = new JSONArray();
        JSONArray source = taxonomy.optJSONArray(bucket());
        if (source == null) return result;
        for (int i = 0; i < source.length(); i++) {
            Object raw = source.opt(i);
            String id = "";
            String name = "";
            if (raw instanceof JSONObject) {
                id = ((JSONObject) raw).optString("id");
                name = ((JSONObject) raw).optString("name");
            } else if (raw != null) {
                id = String.valueOf(raw);
                name = id;
            }
            if (id.isEmpty()) continue;
            try {
                JSONObject entry = new JSONObject();
                entry.put("type_id", id);
                entry.put("type_name", name);
                if ("topic".equals(mode)) entry.put("type_flag", "1");
                result.put(entry);
            } catch (Exception ignored) {
            }
        }
        return result;
    }

    private JSONObject filters() {
        JSONObject result = new JSONObject();
        JSONArray classes = classes();
        for (int i = 0; i < classes.length(); i++) {
            JSONObject entry = classes.optJSONObject(i);
            if (entry == null) continue;
            try {
                result.put(entry.optString("type_id"), filtersFor());
            } catch (Exception ignored) {
            }
        }
        return result;
    }

    // 每种查找方式暴露的筛选条不同：年龄站点不再重复年龄，专题站点靠内容类型和年龄分流。
    private JSONArray filtersFor() {
        JSONArray result = new JSONArray();
        if ("path".equals(mode)) {
            result.put(filter("age", "年龄段", ageValues()));
            result.put(filter("ct", "内容类型", contentValues()));
        } else if ("content".equals(mode) || "search".equals(mode)) {
            result.put(filter("age", "年龄段", ageValues()));
            result.put(filter("src", "来源", sourceValues()));
        } else if ("alpha".equals(mode)) {
            result.put(filter("ct", "内容类型", contentValues()));
        } else if ("source".equals(mode)) {
            result.put(filter("age", "年龄段", ageValues()));
            result.put(filter("ct", "内容类型", contentValues()));
        } else if ("topic".equals(mode)) {
            result.put(filter("age", "年龄段", ageValues()));
            result.put(filter("ct", "内容类型", contentValues()));
        } else {
            result.put(filter("ct", "内容类型", contentValues()));
            result.put(filter("src", "来源", sourceValues()));
        }
        return result;
    }

    private JSONObject filter(String key, String name, JSONArray values) {
        JSONObject filter = new JSONObject();
        try {
            filter.put("key", key);
            filter.put("name", name);
            filter.put("init", "");
            filter.put("value", values);
        } catch (Exception ignored) {
        }
        return filter;
    }

    private JSONArray ageValues() {
        JSONArray result = new JSONArray();
        result.put(value("全部", ""));
        JSONArray ages = taxonomy.optJSONArray("ages");
        for (int i = 0; ages != null && i < ages.length(); i++) {
            JSONObject age = ages.optJSONObject(i);
            if (age == null) continue;
            result.put(value(age.optString("name"), age.optString("id")));
        }
        return result;
    }

    private JSONArray contentValues() {
        return values(taxonomy.optJSONArray("contents"));
    }

    private JSONArray sourceValues() {
        return values(taxonomy.optJSONArray("sources"));
    }

    private JSONArray values(JSONArray source) {
        JSONArray result = new JSONArray();
        result.put(value("全部", ""));
        for (int i = 0; source != null && i < source.length(); i++) {
            JSONObject item = source.optJSONObject(i);
            if (item == null) continue;
            result.put(value(item.optString("name"), item.optString("id")));
        }
        return result;
    }

    private JSONObject value(String name, String id) {
        JSONObject value = new JSONObject();
        try {
            value.put("n", name);
            value.put("v", id);
        } catch (Exception ignored) {
        }
        return value;
    }

    private List<JSONObject> units() {
        List<JSONObject> result = new ArrayList<>(toList(ips));
        for (JSONObject item : toList(catalog)) {
            if (item.optInt("hid", 0) == 0) result.add(item);
        }
        return result;
    }

    private JSONArray latest() {
        List<JSONObject> items = units();
        Collections.sort(items, new Comparator<JSONObject>() {
            @Override
            public int compare(JSONObject a, JSONObject b) {
                return Long.compare(unitLatest(b), unitLatest(a));
            }
        });
        JSONArray result = new JSONArray();
        for (int i = 0; i < items.size() && i < 8; i++) {
            JSONObject unit = items.get(i);
            JSONObject card = card(unit, "");
            if (!isGroup(unit)) {
                try {
                    card.put("vod_remarks", "更新 · " + ageLabel(unit));
                } catch (Exception ignored) {
                }
            }
            result.put(card);
        }
        return result;
    }

    private String topicFolders(String tid, HashMap<String, String> extend) {
        List<JSONObject> all = filtered(units(), extend);
        JSONArray topics = topicsOf(tid);
        JSONArray list = new JSONArray();
        for (JSONObject topic : toList(topics)) {
            int count = 0;
            for (JSONObject unit : all) {
                if (topicMatches(unit, topic)) count++;
            }
            if (count == 0) continue;
            try {
                JSONObject card = new JSONObject();
                card.put("vod_id", topic.optString("id"));
                card.put("vod_name", topic.optString("name"));
                card.put("vod_pic", "");
                card.put("vod_remarks", count + " 部");
                card.put("vod_tag", "folder");
                list.put(card);
            } catch (Exception ignored) {
            }
        }
        JSONObject result = new JSONObject();
        try {
            result.put("list", list);
            result.put("page", 1);
            result.put("pagecount", 1);
            result.put("limit", list.length());
            result.put("total", list.length());
        } catch (Exception ignored) {
        }
        return result.toString();
    }

    private List<JSONObject> select(String tid, HashMap<String, String> extend) {
        List<JSONObject> result = new ArrayList<>();
        List<JSONObject> all = filtered(units(), extend);
        if (tid == null) return result;
        if ("topic".equals(mode) && tid.startsWith("tp-")) {
            JSONObject topic = findTopic(tid);
            if (topic == null) return result;
            for (JSONObject unit : all) {
                if (topicMatches(unit, topic)) result.add(unit);
            }
            return result;
        }
        if ("alpha".equals(mode)) {
            String letter = tid.trim();
            for (JSONObject unit : all) {
                if (letter.equalsIgnoreCase(unit.optString("init", "#"))) result.add(unit);
            }
            return result;
        }
        if ("path".equals(mode)) {
            for (JSONObject unit : all) {
                if (contains(unit.optJSONArray("paths"), tid)) result.add(unit);
            }
            return result;
        }
        if ("content".equals(mode) || "search".equals(mode)) {
            for (JSONObject unit : all) {
                if (contains(unit.optJSONArray("ct"), tid)) result.add(unit);
            }
            return result;
        }
        if ("source".equals(mode)) {
            for (JSONObject unit : all) {
                if (contains(srcs(unit), tid)) result.add(unit);
            }
            return result;
        }
        JSONObject band = find(taxonomy.optJSONArray("ages"), tid);
        if (band == null) return result;
        int min = band.optInt("min", 0);
        int max = band.optInt("max", 18);
        for (JSONObject unit : all) {
            if (unitAgeMin(unit) < max && unitAgeMax(unit) > min) result.add(unit);
        }
        return result;
    }

    private List<JSONObject> filtered(List<JSONObject> units, HashMap<String, String> extend) {
        List<JSONObject> result = new ArrayList<>();
        String age = value(extend, "age");
        String ct = value(extend, "ct");
        String src = value(extend, "src");
        JSONObject band = age.isEmpty() ? null : find(taxonomy.optJSONArray("ages"), age);
        int min = band == null ? 0 : band.optInt("min", 0);
        int max = band == null ? 18 : band.optInt("max", 18);
        for (JSONObject unit : units) {
            if (band != null && !(unitAgeMin(unit) < max && unitAgeMax(unit) > min)) continue;
            if (!ct.isEmpty() && !contains(unit.optJSONArray("ct"), ct)) continue;
            if (!src.isEmpty() && !contains(srcs(unit), src)) continue;
            result.add(unit);
        }
        return result;
    }

    private String value(HashMap<String, String> extend, String key) {
        if (extend == null) return "";
        String value = extend.get(key);
        return value == null ? "" : value.trim();
    }

    private void sort(List<JSONObject> items, final String tid) {
        final boolean byPath = "path".equals(mode);
        final boolean byAlpha = "alpha".equals(mode);
        Collections.sort(items, new Comparator<JSONObject>() {
            @Override
            public int compare(JSONObject a, JSONObject b) {
                if (byAlpha) return Integer.compare(unitPy(a), unitPy(b));
                int result = byPath
                        ? Integer.compare(stage(a, tid), stage(b, tid))
                        : Integer.compare(unitOrder(a), unitOrder(b));
                if (result != 0) return result;
                result = Integer.compare(unitAgeMin(a), unitAgeMin(b));
                if (result != 0) return result;
                return Integer.compare(unitPy(a), unitPy(b));
            }
        });
    }

    private int stage(JSONObject unit, String tid) {
        JSONObject stages = unit.optJSONObject("stages");
        int value = stages == null ? 0 : stages.optInt(tid == null ? "" : tid, 0);
        return value > 0 ? value : 99;
    }

    private JSONObject card(JSONObject unit, String tid) {
        JSONObject card = new JSONObject();
        try {
            boolean group = isGroup(unit);
            card.put("vod_id", group ? "ip/" + unit.optString("key") : "series/" + unit.optString("id"));
            card.put("vod_name", unit.optString("name"));
            card.put("vod_pic", unit.optString("pic"));
            if (group) {
                card.put("vod_remarks", groupRemark(unit));
            } else if ("path".equals(mode) && tid != null) {
                int stage = stage(unit, tid);
                card.put("vod_remarks", (stage < 99 ? "第" + stage + "阶段 · " : "") + ageLabel(unit));
            } else if ("topic".equals(mode)) {
                String latest = clean(unit.optString("latest"));
                card.put("vod_remarks", latest.isEmpty() ? ageLabel(unit) : cut(latest, 12));
            } else {
                card.put("vod_remarks", ageLabel(unit));
            }
            card.put("style", style());
        } catch (Exception ignored) {
        }
        return card;
    }

    private String groupRemark(JSONObject group) {
        JSONArray seasons = group.optJSONArray("seasons");
        int count = seasons == null ? 0 : seasons.length();
        int episodes = group.optInt("episodes", 0);
        return count + " 季" + (episodes > 0 ? " · " + episodes + " 集" : "");
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

    private String seriesDetail(String id) {
        JSONObject item = find(toList(catalog), id);
        if (item == null) return message("未找到该系列");

        boolean bili = "bili".equals(item.optString("source"));
        boolean mac = "mac".equals(item.optString("source"));
        JSONArray episodes = null;
        if (!mac) {
            try {
                episodes = bili ? biliEpisodes(item) : episodes(item);
            } catch (Exception e) {
                return message((bili ? "哔哩哔哩" : "央视") + "接口请求失败：" + text(e));
            }
            if (episodes.length() == 0) return message("该系列暂时没有可播放的内容");
        }

        try {
            JSONObject vod = card(item, "");
            vod.put("vod_content", content(item));
            List<String> froms = new ArrayList<>();
            List<String> urls = new ArrayList<>();
            int total = episodes == null ? 0 : episodes.length();
            if (!mac) {
                addLine(froms, urls, bili ? "哔哩哔哩" : "央视", playUrl(episodes));
            }
            JSONArray backups = item.optJSONArray("backups");
            for (int i = 0; backups != null && i < backups.length(); i++) {
                JSONObject backup = backups.optJSONObject(i);
                if (backup == null) continue;
                // 采集站条目不预存集名，详情时现取，避免几千条目的集名把 jar 撑大。
                List<String> names = backupNames(backup);
                if (names.isEmpty()) {
                    int count = backup.optInt("episodes", 0);
                    for (int j = 0; j < count; j++) names.add("第" + (j + 1) + "集");
                }
                if (names.isEmpty()) continue;
                List<String> parts = new ArrayList<>();
                for (int j = 0; j < names.size(); j++) {
                    String name = clean(names.get(j));
                    if (name.isEmpty()) name = "第" + (j + 1) + "集";
                    parts.add(name + "$mac:" + item.optString("id") + ":" + i + ":" + j);
                }
                total = Math.max(total, names.size());
                addLine(froms, urls, clean(backup.optString("site", "采集站")), join(parts, "#"));
            }
            if (froms.isEmpty()) return message("该系列暂时没有可播放的内容");
            vod.put("vod_remarks", "共 " + total + " 集");
            vod.put("vod_play_from", join(froms, "$$$"));
            vod.put("vod_play_url", join(urls, "$$$"));
            JSONObject result = new JSONObject();
            result.put("list", new JSONArray().put(vod));
            return result.toString();
        } catch (Exception e) {
            return message(text(e));
        }
    }

    // 一季一个播放分组，分组名带上季标识和来源；多条备用源就是多条线路，不写进简介。
    private String groupDetail(String key) {
        JSONObject group = findKey(ips, key);
        if (group == null) return message("未找到该系列");
        JSONArray seasons = group.optJSONArray("seasons");
        if (seasons == null || seasons.length() == 0) return message("该系列暂时没有可播放的内容");
        try {
            JSONObject vod = card(group, "");
            List<String> froms = new ArrayList<>();
            List<String> urls = new ArrayList<>();
            int total = 0;
            int failed = 0;
            for (int i = 0; i < seasons.length(); i++) {
                JSONObject season = seasons.optJSONObject(i);
                if (season == null) continue;
                JSONObject item = find(toList(catalog), season.optString("id"));
                if (item == null) {
                    failed++;
                    continue;
                }
                String label = clean(season.optString("label"));
                if (label.isEmpty()) label = clean(item.optString("name"));
                int count = 0;
                if ("mac".equals(item.optString("source"))) {
                    JSONArray backups = item.optJSONArray("backups");
                    for (int b = 0; backups != null && b < backups.length(); b++) {
                        JSONObject backup = backups.optJSONObject(b);
                        if (backup == null) continue;
                        List<String> names = cachedNames(backup);
                        if (names.isEmpty()) continue;
                        List<String> parts = new ArrayList<>();
                        for (int j = 0; j < names.size(); j++) {
                            String name = clean(names.get(j));
                            if (name.isEmpty()) name = "第" + (j + 1) + "集";
                            parts.add(name + "$mac:" + item.optString("id") + ":" + b + ":" + j);
                        }
                        count = Math.max(count, names.size());
                        addLine(froms, urls, label + " · " + clean(backup.optString("site", "采集站")), join(parts, "#"));
                    }
                } else {
                    boolean bili = "bili".equals(item.optString("source"));
                    try {
                        JSONArray episodes = bili ? biliEpisodes(item) : episodes(item);
                        if (episodes.length() > 0) {
                            count = episodes.length();
                            addLine(froms, urls, label + " · " + (bili ? "哔哩哔哩" : "央视"), playUrl(episodes));
                        } else {
                            failed++;
                        }
                    } catch (Exception ignored) {
                        failed++;
                    }
                }
                total += count;
            }
            if (froms.isEmpty()) return message("该系列暂时没有可播放的内容");
            vod.put("vod_content", groupContent(group, failed));
            vod.put("vod_remarks", "共 " + seasons.length() + " 季 · " + total + " 集");
            vod.put("vod_play_from", join(froms, "$$$"));
            vod.put("vod_play_url", join(urls, "$$$"));
            JSONObject result = new JSONObject();
            result.put("list", new JSONArray().put(vod));
            return result.toString();
        } catch (Exception e) {
            return message(text(e));
        }
    }

    private void addLine(List<String> froms, List<String> urls, String flag, String url) {
        String name = flag == null || flag.trim().isEmpty() ? "线路" : flag.trim();
        String unique = name;
        int index = 2;
        while (froms.contains(unique)) {
            unique = name + " " + index;
            index++;
        }
        froms.add(unique);
        urls.add(url);
    }

    private List<String> cachedNames(JSONObject backup) {
        List<String> names = new ArrayList<>();
        JSONArray cached = backup.optJSONArray("episodes");
        if (cached != null && cached.length() > 0) {
            for (int i = 0; i < cached.length(); i++) names.add(cached.optString(i));
            return names;
        }
        int count = Math.min(300, backup.optInt("episodes", 0));
        for (int i = 0; i < count; i++) names.add("第" + (i + 1) + "集");
        return names;
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
        return biliPages(biliView(bvid), bvid);
    }

    private JSONObject biliView(String bvid) throws Exception {
        JSONObject data = new JSONObject(get(BILI_VIEW_API + "?bvid=" + encode(bvid), BILI_REFERER));
        int code = data.optInt("code", 0);
        if (code != 0) throw new IllegalStateException("接口返回 " + code + "：" + data.optString("message", "未知错误"));
        JSONObject view = data.optJSONObject("data");
        if (view == null) throw new IllegalStateException("没有返回视频信息");
        return view;
    }

    private JSONArray biliPages(JSONObject view, String bvid) {
        JSONArray result = new JSONArray();
        for (JSONObject page : toList(view.optJSONArray("pages"))) {
            if (result.length() >= 100) break;
            String cid = page.optString("cid");
            if (cid.isEmpty()) continue;
            String name = clean(page.optString("part"));
            if (name.isEmpty()) name = "第" + (result.length() + 1) + "集";
            JSONObject episode = new JSONObject();
            try {
                episode.put("name", name);
                episode.put("id", "bili:" + bvid + ":" + cid);
            } catch (Exception ignored) {
            }
            result.put(episode);
        }
        return result;
    }

    // 搜索结果里的视频没有进目录，详情页现取一次分 P，播放仍走 bili: 前缀。
    private String biliVideoDetail(String bvid) {
        if (bvid.isEmpty()) return message("缺少视频 ID");
        JSONObject view;
        try {
            view = biliView(bvid);
        } catch (Exception e) {
            return message("哔哩哔哩接口请求失败：" + text(e));
        }
        JSONArray episodes = biliPages(view, bvid);
        if (episodes.length() == 0) return message("该视频暂时没有可播放的内容");
        try {
            JSONObject vod = new JSONObject();
            vod.put("vod_id", "bv/" + bvid);
            vod.put("vod_name", clean(strip(view.optString("title"))));
            vod.put("vod_pic", https(view.optString("pic")));
            vod.put("vod_remarks", "共 " + episodes.length() + " 集");
            vod.put("vod_content", biliContent(view));
            vod.put("vod_play_from", "哔哩哔哩");
            vod.put("vod_play_url", playUrl(episodes));
            JSONObject result = new JSONObject();
            result.put("list", new JSONArray().put(vod));
            return result.toString();
        } catch (Exception e) {
            return message(text(e));
        }
    }

    private String biliContent(JSONObject view) {
        List<String> lines = new ArrayList<>();
        JSONObject owner = view.optJSONObject("owner");
        if (owner != null) {
            String name = clean(owner.optString("name"));
            if (!name.isEmpty()) lines.add("UP 主：" + name);
        }
        String desc = clean(strip(view.optString("desc")));
        if (!desc.isEmpty()) lines.add(cut(desc, 300));
        lines.add("内容来源：哔哩哔哩（B站）UP 主上传，播放时实时取流，匿名最高 720p。");
        return join(lines, "\n");
    }

    // 聚合搜索接口一次返回全部分组，取其中的 video 分组；搜索接口另有 -412 限流，这里不走。
    private List<JSONObject> biliSearch(String keyword) {
        List<JSONObject> result = new ArrayList<>();
        try {
            String url = BILI_SEARCH_API + "?keyword=" + encode(keyword) + "&page=1";
            JSONObject data = new JSONObject(get(url, SEARCH_REFERER, cookies()));
            JSONObject payload = data.optJSONObject("data");
            JSONArray groups = payload == null ? null : payload.optJSONArray("result");
            JSONArray videos = null;
            for (JSONObject group : toList(groups)) {
                if ("video".equals(group.optString("result_type"))) {
                    videos = group.optJSONArray("data");
                    break;
                }
            }
            for (JSONObject video : toList(videos)) {
                if (result.size() >= SEARCH_LIMIT) break;
                String title = strip(video.optString("title"));
                if (title.isEmpty() || blocked(title)) continue;
                if (seconds(video.optString("duration")) < MIN_SECONDS) continue;
                result.add(video);
            }
        } catch (Exception ignored) {
            // 搜索失败不影响本地目录的结果。
        }
        return result;
    }

    private boolean blocked(String title) {
        return BILI_BLOCK.matcher(title).find();
    }

    private boolean covered(String bvid, String title) {
        if (knownBvids.contains(bvid)) return true;
        String lowerTitle = lower(title);
        for (String name : knownNames) {
            if (lowerTitle.contains(name)) return true;
        }
        return false;
    }

    private void addKnown(String name) {
        String value = lower(clean(name));
        if (value.isEmpty()) return;
        int cjk = 0;
        int ascii = 0;
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            if (c >= 128) cjk++;
            else if (isAlnum(c)) ascii++;
        }
        if (cjk >= 2 || ascii >= 4) knownNames.add(value);
    }

    private JSONObject biliCard(JSONObject video, String bvid, String title) {
        JSONObject card = new JSONObject();
        try {
            card.put("vod_id", "bv/" + bvid);
            card.put("vod_name", clean(title));
            card.put("vod_pic", https(video.optString("pic")));
            String duration = clean(video.optString("duration"));
            card.put("vod_remarks", duration.isEmpty() ? "哔哩哔哩" : "哔哩哔哩 · " + duration);
            card.put("style", style());
        } catch (Exception ignored) {
        }
        return card;
    }

    private int seconds(String duration) {
        if (duration == null) return 0;
        int total = 0;
        for (String part : duration.trim().split(":")) {
            try {
                total = total * 60 + Integer.parseInt(part.trim());
            } catch (Exception e) {
                return 0;
            }
        }
        return total;
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
            JSONObject detail = macDetail(backup);
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

    private JSONObject macDetail(JSONObject backup) throws Exception {
        String api = backup.optString("api");
        String vodId = backup.optString("vodId");
        String referer = backup.optString("referer", REFERER);
        String url = api + (api.contains("?") ? "&" : "?") + "ac=detail&ids=" + encode(vodId);
        JSONArray list = new JSONObject(get(url, referer)).optJSONArray("list");
        JSONObject detail = list == null ? null : list.optJSONObject(0);
        if (detail == null) throw new IllegalStateException("没有返回详情");
        return detail;
    }

    // 采集站条目只存 vodId，详情时按需取集名；失败就用集数占位，播放时还会再取一次。
    private List<String> backupNames(JSONObject backup) {
        List<String> names = new ArrayList<>();
        JSONArray cached = backup.optJSONArray("episodes");
        if (cached != null && cached.length() > 0) {
            for (int i = 0; i < cached.length(); i++) names.add(cached.optString(i));
            return names;
        }
        JSONObject detail;
        try {
            detail = macDetail(backup);
        } catch (Exception e) {
            return names;
        }
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
        if (group < 0 || group >= groups.length) return names;
        for (String part : groups[group].split("#")) {
            String text = part.trim();
            if (text.isEmpty()) continue;
            int at = text.indexOf('$');
            String name = at < 0 ? "" : text.substring(0, at).trim();
            names.add(name.isEmpty() ? "第" + (names.size() + 1) + "集" : name);
        }
        return names;
    }

    private String content(JSONObject item) {
        List<String> lines = new ArrayList<>();
        String desc = clean(item.optString("desc"));
        if (!desc.isEmpty()) lines.add(desc);
        String why = clean(item.optString("why"));
        if (!why.isEmpty()) lines.add("入选理由：" + why);
        lines.add("适龄：" + ageLabel(item));

        List<String> paths = namesOf(taxonomy.optJSONArray("paths"), item.optJSONArray("paths"));
        if (!paths.isEmpty()) lines.add("学习路线：" + join(paths, "、"));
        List<String> ct = namesOf(taxonomy.optJSONArray("contents"), item.optJSONArray("ct"));
        if (!ct.isEmpty()) lines.add("内容类型：" + join(ct, "、"));
        boolean bili = "bili".equals(item.optString("source"));
        boolean mac = "mac".equals(item.optString("source"));
        if (mac) {
            lines.add("内容来源：第三方采集站，播放时实时取流。");
        } else {
            lines.add(bili ? "内容来源：哔哩哔哩（B站）UP 主上传，播放时实时取流。" : "内容来源：央视网，播放时实时解析。");
        }
        return join(lines, "\n");
    }

    private String groupContent(JSONObject group, int failed) {
        List<String> lines = new ArrayList<>();
        String desc = clean(group.optString("desc"));
        if (!desc.isEmpty()) lines.add(desc);
        JSONArray seasons = group.optJSONArray("seasons");
        int count = seasons == null ? 0 : seasons.length();
        lines.add("共 " + count + " 季 · " + group.optInt("episodes", 0) + " 集");
        lines.add("适龄：" + groupAgeLabel(group));
        List<String> paths = namesOf(taxonomy.optJSONArray("paths"), group.optJSONArray("paths"));
        if (!paths.isEmpty()) lines.add("学习路线：" + join(paths, "、"));
        List<String> ct = namesOf(taxonomy.optJSONArray("contents"), group.optJSONArray("ct"));
        if (!ct.isEmpty()) lines.add("内容类型：" + join(ct, "、"));
        List<String> srcs = namesOf(taxonomy.optJSONArray("sources"), group.optJSONArray("srcs"));
        if (!srcs.isEmpty()) lines.add("内容来源：" + join(srcs, "、"));
        List<String> labels = new ArrayList<>();
        for (int i = 0; seasons != null && i < seasons.length() && i < 10; i++) {
            JSONObject season = seasons.optJSONObject(i);
            if (season == null) continue;
            String label = clean(season.optString("label"));
            if (!label.isEmpty()) labels.add(label);
        }
        if (!labels.isEmpty()) lines.add("季目录：" + join(labels, "、") + (count > 10 ? " 等" : ""));
        if (failed > 0) lines.add("有 " + failed + " 季的播放源暂时不可用，可切换其他线路。");
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

    private boolean matches(JSONObject unit, String query) {
        if (lower(clean(unit.optString("name"))).contains(query)) return true;
        if (lower(clean(unit.optString("desc"))).contains(query)) return true;
        if (isGroup(unit) && lower(clean(unit.optString("alias"))).contains(query)) return true;
        JSONArray tags = unit.optJSONArray("tags");
        if (tags == null) return false;
        for (int i = 0; i < tags.length(); i++) {
            if (lower(clean(tags.optString(i))).contains(query)) return true;
        }
        return false;
    }

    private boolean isGroup(JSONObject unit) {
        return unit.optInt("g", 0) == 1;
    }

    private int unitAgeMin(JSONObject unit) {
        if (isGroup(unit)) {
            JSONArray ages = unit.optJSONArray("ages");
            return ages == null || ages.length() < 2 ? 0 : ages.optInt(0, 0);
        }
        return unit.optInt("ageMin", 0);
    }

    private int unitAgeMax(JSONObject unit) {
        if (isGroup(unit)) {
            JSONArray ages = unit.optJSONArray("ages");
            return ages == null || ages.length() < 2 ? 12 : ages.optInt(1, 12);
        }
        return unit.optInt("ageMax", 12);
    }

    private int unitOrder(JSONObject unit) {
        return unit.optInt("order", 1000000);
    }

    private int unitPy(JSONObject unit) {
        return unit.optInt("py", 1000000);
    }

    private long unitLatest(JSONObject unit) {
        return unit.optLong("latestTime", 0);
    }

    private JSONArray srcs(JSONObject unit) {
        if (isGroup(unit)) {
            JSONArray value = unit.optJSONArray("srcs");
            return value == null ? new JSONArray() : value;
        }
        JSONArray result = new JSONArray();
        String source = unit.optString("source");
        result.put("bili".equals(source) ? "src-bili" : ("mac".equals(source) ? "src-mac" : "src-cctv"));
        return result;
    }

    private boolean isTopicGroup(String tid) {
        return tid != null && find(taxonomy.optJSONArray("topicGroups"), tid) != null;
    }

    private JSONArray topicsOf(String tid) {
        JSONObject group = find(taxonomy.optJSONArray("topicGroups"), tid);
        return group == null ? new JSONArray() : group.optJSONArray("topics");
    }

    private JSONObject findTopic(String id) {
        JSONArray groups = taxonomy.optJSONArray("topicGroups");
        for (JSONObject group : toList(groups)) {
            JSONObject topic = find(group.optJSONArray("topics"), id);
            if (topic != null) return topic;
        }
        return null;
    }

    private boolean topicMatches(JSONObject unit, JSONObject topic) {
        JSONArray tags = topic.optJSONArray("tags");
        if (tags != null && tags.length() > 0 && overlaps(unit.optJSONArray("tags"), tags)) return true;
        JSONArray names = topic.optJSONArray("names");
        if (names == null) return false;
        String text = isGroup(unit) ? unit.optString("alias", unit.optString("name")) : unit.optString("name");
        for (int i = 0; i < names.length(); i++) {
            if (keywordHit(text, names.optString(i))) return true;
        }
        return false;
    }

    private boolean keywordHit(String text, String keyword) {
        if (text == null || keyword == null || keyword.isEmpty()) return false;
        String lowerText = text.toLowerCase(Locale.ROOT);
        String lowerKey = keyword.toLowerCase(Locale.ROOT);
        if (!isAscii(keyword)) return lowerText.contains(lowerKey);
        int from = 0;
        while (true) {
            int at = lowerText.indexOf(lowerKey, from);
            if (at < 0) return false;
            boolean left = at == 0 || !isAlnum(lowerText.charAt(at - 1));
            int end = at + lowerKey.length();
            boolean right = end >= lowerText.length() || !isAlnum(lowerText.charAt(end));
            if (left && right) return true;
            from = at + 1;
        }
    }

    private boolean isAscii(String text) {
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            if (c < 32 || c > 126) return false;
        }
        return true;
    }

    private boolean isAlnum(char c) {
        return (c >= '0' && c <= '9') || (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z');
    }

    private List<String> namesOf(JSONArray source, JSONArray ids) {
        List<String> result = new ArrayList<>();
        if (source == null || ids == null) return result;
        for (int i = 0; i < ids.length(); i++) {
            JSONObject item = find(source, ids.optString(i));
            if (item != null) result.add(item.optString("name"));
        }
        return result;
    }

    private String groupAgeLabel(JSONObject group) {
        return unitAgeMin(group) + "-" + unitAgeMax(group) + "岁";
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

    private JSONObject findKey(JSONArray array, String key) {
        if (array == null || key == null) return null;
        for (int i = 0; i < array.length(); i++) {
            JSONObject item = array.optJSONObject(i);
            if (item != null && key.equals(item.optString("key"))) return item;
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
        return get(url, REFERER, null);
    }

    private String get(String url, String referer) throws Exception {
        return get(url, referer, null);
    }

    private String get(String url, String referer, String cookie) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
        try {
            connection.setConnectTimeout(15000);
            connection.setReadTimeout(20000);
            connection.setRequestProperty("User-Agent", UA);
            connection.setRequestProperty("Referer", referer);
            connection.setRequestProperty("Accept", "application/json, text/plain, */*");
            connection.setRequestProperty("Accept-Encoding", "gzip");
            if (cookie != null && !cookie.isEmpty()) connection.setRequestProperty("Cookie", cookie);
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

    // 搜索接口只认 buvid3 + b_nut，本地生成即可，不需要登录态。
    private String cookies() {
        return "buvid3=" + UUID.randomUUID().toString().toUpperCase(Locale.ROOT)
                + "infoc; b_nut=" + (System.currentTimeMillis() / 1000L);
    }

    private String strip(String value) {
        if (value == null) return "";
        return value.replaceAll("<[^>]+>", "")
                .replace("&quot;", "\"")
                .replace("&#39;", "'")
                .replace("&lt;", "<")
                .replace("&gt;", ">")
                .replace("&amp;", "&");
    }

    private String https(String url) {
        if (url == null) return "";
        String value = url.trim();
        if (value.startsWith("//")) return "https:" + value;
        if (value.startsWith("http://")) return "https://" + value.substring(7);
        return value;
    }

    private String read(InputStream input) throws Exception {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int count;
        while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
        return new String(output.toByteArray(), StandardCharsets.UTF_8);
    }
}
