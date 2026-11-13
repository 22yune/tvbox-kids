import { Spider } from "catvod";

const CATALOG = /*__CATALOG__*/ [];
const TAXONOMY = /*__TAXONOMY__*/ {};

const CCTV_LIST = "https://api.cntv.cn/NewVideo/getVideoListByColumn";
const CCTV_PLAY = "https://vdn.apps.cntv.cn/api/getHttpVideoInfo.do";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const HEADERS = { "User-Agent": UA, "Referer": "https://tv.cctv.com/" };
const PAGE_SIZE = 12;

function clean(value) {
  return String(value == null ? "" : value).replace(/[$#]/g, " ").replace(/\s+/g, " ").trim();
}

function ageLabel(series) {
  return series.ageMin + "-" + series.ageMax + "岁";
}

function pathName(id) {
  const item = (TAXONOMY.paths || []).find(function (x) { return x.id === id; });
  return item ? item.name : "";
}

function stageOf(series, pathId) {
  return (series.stages && series.stages[pathId]) || 99;
}

function card(series) {
  return {
    vod_id: "series/" + series.id,
    vod_name: series.name,
    vod_pic: series.pic || "",
    vod_remarks: ageLabel(series),
    style: { type: "rect", ratio: 1.78 }
  };
}

function select(mode, tid) {
  if (mode === "path") {
    return CATALOG.filter(function (s) { return (s.paths || []).indexOf(tid) >= 0; });
  }
  if (mode === "topic") {
    const topic = (TAXONOMY.topics || []).find(function (x) { return x.id === tid; });
    if (!topic) return [];
    return CATALOG.filter(function (s) {
      return (s.tags || []).some(function (tag) { return (topic.tags || []).indexOf(tag) >= 0; });
    });
  }
  const band = (TAXONOMY.ages || []).find(function (x) { return x.id === tid; });
  if (!band) return [];
  return CATALOG.filter(function (s) { return s.ageMin < band.max && s.ageMax > band.min; });
}

function sortSeries(list, mode, tid) {
  return list.slice().sort(function (a, b) {
    if (mode === "path") {
      return stageOf(a, tid) - stageOf(b, tid) || a.ageMin - b.ageMin || a.order - b.order;
    }
    return a.order - b.order || a.ageMin - b.ageMin;
  });
}

function paginate(items, pg) {
  const page = Math.max(1, parseInt(pg, 10) || 1);
  const total = items.length;
  const pagecount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  return {
    list: items.slice(start, start + PAGE_SIZE),
    page: page,
    pagecount: pagecount,
    limit: PAGE_SIZE,
    total: total
  };
}

export default class Kids extends Spider {
  init(ext = "") {
    this.mode = "age";
    if (ext && typeof ext === "object") {
      this.mode = ext.mode || "age";
      return;
    }
    try {
      const parsed = JSON.parse(ext);
      if (parsed && parsed.mode) this.mode = parsed.mode;
    } catch (error) {
      this.mode = "age";
    }
  }

  homeContent() {
    const classes = this.mode === "path"
      ? TAXONOMY.paths
      : this.mode === "topic"
        ? TAXONOMY.topics
        : TAXONOMY.ages;
    const list = CATALOG.slice()
      .sort(function (a, b) { return (b.latestTime || 0) - (a.latestTime || 0); })
      .slice(0, 6)
      .map(function (s) {
        const item = card(s);
        item.vod_remarks = "更新 · " + ageLabel(s);
        return item;
      });
    return {
      class: classes.map(function (x) { return { type_id: x.id, type_name: x.name }; }),
      list: list
    };
  }

  categoryContent(tid, pg, filter, extend) {
    const mode = this.mode;
    const items = sortSeries(select(mode, tid), mode, tid).map(function (s) {
      const item = card(s);
      if (mode === "path") {
        const stage = stageOf(s, tid);
        item.vod_remarks = (stage < 99 ? "第" + stage + "阶段 · " : "") + ageLabel(s);
      } else if (mode === "topic") {
        item.vod_remarks = s.latest ? clean(s.latest).slice(0, 12) : ageLabel(s);
      }
      return item;
    });
    return paginate(items, pg);
  }

  async detailContent(ids) {
    const id = String((ids && ids[0]) || "").replace(/^series\//, "");
    const series = CATALOG.find(function (x) { return x.id === id; });
    if (!series) return { list: [], msg: "未找到该系列" };

    let episodes = [];
    try {
      episodes = await this.episodes(series);
    } catch (error) {
      return { list: [], msg: "央视接口请求失败：" + String((error && error.message) || error) };
    }
    if (!episodes.length) return { list: [], msg: "该栏目暂时没有可播放的节目" };

    const paths = (series.paths || []).map(pathName).filter(Boolean).join("、");
    const vod = card(series);
    vod.vod_remarks = "共 " + episodes.length + " 集";
    vod.vod_content = [
      series.desc || "",
      "适龄：" + ageLabel(series),
      paths ? "学习路线：" + paths : "",
      "内容来源：央视网，播放时实时解析。"
    ].filter(Boolean).join("\n");
    vod.vod_play_from = "央视";
    vod.vod_play_url = episodes.map(function (episode, index) {
      return (clean(episode.title) || "第" + (index + 1) + "集") + "$" + episode.guid;
    }).join("#");
    return { list: [vod] };
  }

  async episodes(series) {
    const count = Math.max(1, Math.min(60, series.episodes || 60));
    const url = CCTV_LIST + "?id=" + encodeURIComponent(series.column) +
      "&n=" + count + "&sort=desc&p=1&mode=0&serviceId=tvcctv";
    const data = await this.net.json(url, { headers: HEADERS, timeout: 15000 });
    const list = (data && data.data && data.data.list) || [];
    return list
      .filter(function (x) { return x && x.guid; })
      .map(function (x) { return { guid: String(x.guid), title: clean(x.title) }; });
  }

  searchContent(key, quick, pg = "1") {
    const query = clean(key).toLowerCase();
    if (!query) return paginate([], pg);
    const items = CATALOG.filter(function (s) {
      return [s.name, s.desc].concat(s.tags || []).some(function (value) {
        return clean(value).toLowerCase().indexOf(query) >= 0;
      });
    }).map(card);
    return paginate(items, pg);
  }

  async playerContent(flag, id) {
    const pid = String(id || "").trim();
    if (!pid) return { parse: 0, msg: "缺少节目 ID" };
    try {
      const data = await this.net.json(CCTV_PLAY + "?pid=" + encodeURIComponent(pid), {
        headers: HEADERS,
        timeout: 15000
      });
      const url = data && (data.hls_url || (data.video && data.video.hls_url));
      if (!url) return { parse: 0, msg: (data && data.tip_msg) || "央视未返回播放地址" };
      return { parse: 0, url: url, header: HEADERS };
    } catch (error) {
      return { parse: 0, msg: "播放地址解析失败：" + String((error && error.message) || error) };
    }
  }
}
