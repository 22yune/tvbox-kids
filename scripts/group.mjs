#!/usr/bin/env node
// 内容组织：把同一 IP 的多季、多语言版本合并成一张卡片，
// 供 Catalog.java 的 IP 常量和 Kids.java 的列表/详情共用。
import { createHash } from "node:crypto";

const COLLATOR = new Intl.Collator("zh-u-co-pinyin");
const INITIALS = [
  ["A", "奥"], ["B", "不"], ["C", "错"], ["D", "多"], ["E", "二"], ["F", "服"],
  ["G", "国"], ["H", "火"], ["J", "军"], ["K", "阔"], ["L", "落"], ["M", "木"],
  ["N", "诺"], ["O", "哦"], ["P", "普"], ["Q", "群"], ["R", "润"], ["S", "所"],
  ["T", "托"], ["W", "舞"], ["X", "寻"], ["Y", "云"], ["Z", "做"],
];
const CN_NUM = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
const VARIANT_SUFFIX = /(英文版|英语版|国语版|中文版|双语版|中英双语|粤语版|普通话版|中英文|英文配音|中文配音|国语配音|普通话配音|英文|英语|国语|中文|普通话|粤语|English)\s*$/i;
const VARIANT_HINT = [
  [/粤语/, "粤语"],
  [/双语|中英|中英文/, "中英双语"],
  [/英文|英语|English/i, "英文版"],
  [/中文|国语|普通话/, "中文版"],
];
const BRACKETS = /[（(【[][^）)】\]]*[）)】\]]/g;
const SEASON_CN = /第\s*([0-9]{1,3}|[一二三四五六七八九十百零〇两]{1,4})\s*[季部]/;
const SEASON_EN = /(?:\bSeason\b|\bseason\b|\bSEASON\b)\s*([0-9]{1,2})/;
const SEASON_S = /(?:^|[^A-Za-z0-9])S\s?([0-9]{1,2})(?![0-9])/;

// 学习路线的主类下面再挂子类，路径站点会多出「主类-子类」这样的入口。
// 子类由标题、标签和内容分类自动判定，命不中就落到 fallback，保证每条内容都有归属。
const PATH_CHILDREN = {
  "path-language": {
    fallback: "path-language-zh",
    rules: [
      { id: "path-language-en", test: (c) => c.tags.some((tag) => /^英语L[1-4]$/.test(tag)) || /英语|英文|English|Phonics|phonics|自然拼读|音标|口语|字母表?/.test(c.text) },
      { id: "path-language-song", test: (c) => /儿歌|童谣|磨耳朵|歌曲|律动/.test(c.text) },
    ],
  },
  "path-math": {
    fallback: "path-math-number",
    rules: [
      { id: "path-math-shape", test: (c) => /图形|几何|空间|形状|拼图|方位/.test(c.text) },
      { id: "path-math-logic", test: (c) => /逻辑|推理|规律|迷宫|思维|分类|比较/.test(c.text) },
    ],
  },
  "path-science": {
    fallback: "path-science-nature",
    rules: [
      { id: "path-science-earth", test: (c) => /宇宙|太空|星球|行星|地球|火山|天气|地理|海洋|自然现象/.test(c.text) },
      { id: "path-science-lab", test: (c) => /实验|动手|STEAM|steam|科学小|制作|为什么/.test(c.text) },
    ],
  },
  "path-humanities": {
    fallback: "path-humanities-culture",
    rules: [
      { id: "path-humanities-guoxue", test: (c) => /古诗|唐诗|宋词|诗经|论语|弟子规|三字经|成语|国学|汉字|识字|神话|传说|节日|节气/.test(c.text) },
      { id: "path-humanities-history", test: (c) => /历史|朝代|三国|故宫|博物馆|文明|上下五千年|中国史|世界史/.test(c.text) },
    ],
  },
  "path-arts": {
    fallback: "path-arts-music",
    rules: [
      { id: "path-arts-craft", test: (c) => /绘画|手工|美术|画画|折纸|黏土|涂色|艺术/.test(c.text) },
      { id: "path-arts-drama", test: (c) => /戏剧|表演|舞台|木偶|话剧/.test(c.text) },
    ],
  },
  "path-health": {
    fallback: "path-health-sport",
    rules: [
      { id: "path-health-safety", test: (c) => /安全|消防|交通|防拐|溺水|用电/.test(c.text) },
      { id: "path-health-emotion", test: (c) => /情绪|生气|害怕|心理|分享|友谊/.test(c.text) },
    ],
  },
  "path-social": {
    fallback: "path-social-emotion",
    rules: [
      { id: "path-social-rules", test: (c) => /规则|品格|合作|礼貌|习惯|责任|交往/.test(c.text) },
    ],
  },
  "path-tech": {
    fallback: "path-tech-ai",
    rules: [
      { id: "path-tech-code", test: (c) => /编程|机器人|代码|程序|Scratch|scratch|机械|积木/.test(c.text) },
    ],
  },
};

function facetText(item) {
  return [item.name, item.biliTitle, item.desc, item.type].filter(Boolean).join(" ");
}

function languagesOf(item) {
  const text = facetText(item);
  const tags = item.tags || [];
  const out = [];
  const bilingual = /中英|双语|中英文|中英对照|英文对照/.test(text);
  if (bilingual) out.push("lang-bi");
  if (tags.some((tag) => /^英语L[1-4]$/.test(tag)) || /英语|英文|English|Phonics|phonics/.test(text)) out.push("lang-en");
  if (tags.some((tag) => /^语文L[1-4]$/.test(tag)) || /语文|国学|识字|拼音|古诗|成语|中文|汉语/.test(text)) out.push("lang-zh");
  if (out.length === 0) out.push("lang-zh");
  return out;
}

function formsOf(item) {
  const text = facetText(item);
  const tags = item.tags || [];
  const ct = item.ct || [];
  const out = [];
  const add = (id) => {
    if (!out.includes(id)) out.push(id);
  };
  if (tags.includes("动画") || ct.some((id) => ["ct-animation", "ct-domestic", "ct-overseas", "ct-japan", "ct-movie"].includes(id))) add("fm-animation");
  if (tags.includes("低幼") || ct.includes("ct-toddler") || /儿歌|童谣|磨耳朵|歌曲|律动/.test(text)) add("fm-song");
  if (tags.includes("纪录片") || ct.includes("ct-doc") || /纪录片|记录片|纪实/.test(text)) add("fm-doc");
  if (tags.some((tag) => /^英语L[1-4]$|^语文L[1-4]$/.test(tag)) || /课程|课堂|教学|公开课|网课|精讲|讲解|老师/.test(text)) add("fm-course");
  return out;
}

function withPathChildren(item) {
  const paths = item.paths || [];
  const text = facetText(item);
  const tags = item.tags || [];
  const out = paths.slice();
  for (const [parent, config] of Object.entries(PATH_CHILDREN)) {
    if (!paths.includes(parent)) continue;
    const hit = config.rules.find((rule) => rule.test({ text, tags, ct: item.ct })) || { id: config.fallback };
    if (!out.includes(hit.id)) out.push(hit.id);
  }
  return out;
}

function cnNumber(text) {
  if (/^[0-9]+$/.test(text)) return Number(text);
  let total = 0;
  let current = 0;
  for (const ch of text) {
    if (ch === "十") {
      total += (current || 1) * 10;
      current = 0;
    } else if (ch === "百") {
      total += (current || 1) * 100;
      current = 0;
    } else if (Object.prototype.hasOwnProperty.call(CN_NUM, ch)) {
      current = CN_NUM[ch];
    }
  }
  return total + current;
}

export function keyOf(text) {
  return String(text || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^0-9a-z\u3400-\u9fff\u3040-\u30ff]+/g, "");
}

function initialOf(name) {
  const first = String(name || "").trim().charAt(0);
  if (!first) return "#";
  if (/[0-9]/.test(first)) return "#";
  if (/[a-zA-Z]/.test(first)) return first.toUpperCase();
  if (!/[\u3400-\u9fff\u3040-\u30ff]/.test(first)) return "#";
  for (const [letter, bound] of INITIALS) {
    if (COLLATOR.compare(first, bound) <= 0) return letter;
  }
  return "#";
}

// 从名称里拆出季号、上下部、语言版本和年份；返回用于聚类的 key 和展示名。
export function parseName(raw) {
  const text = String(raw || "").trim();
  let no = 0;
  let markerStart = -1;
  let markerEnd = -1;

  const cn = text.match(SEASON_CN);
  const en = cn ? null : text.match(SEASON_EN);
  const sn = cn || en ? null : text.match(SEASON_S);
  if (cn) {
    no = cnNumber(cn[1]);
    markerStart = cn.index;
    markerEnd = cn.index + cn[0].length;
  } else if (en) {
    no = Number(en[1]);
    markerStart = en.index;
    markerEnd = en.index + en[0].length;
  } else if (sn) {
    no = Number(sn[1]);
    markerStart = sn.index + sn[0].length - sn[1].length - 1;
    markerEnd = sn.index + sn[0].length;
  }

  const full = text.replace(BRACKETS, " ");
  let head = markerStart >= 0 ? full.slice(0, markerStart) : full;
  const partMatch = markerEnd >= 0 ? text.slice(markerEnd).match(/[(（]\s*([上中下])\s*[)）]/) : null;
  let variant = "";
  for (const [pattern, label] of VARIANT_HINT) {
    const match = text.match(pattern);
    if (match && match.index > 0) {
      variant = label;
      break;
    }
  }
  head = head.replace(VARIANT_SUFFIX, "").replace(/[(（【\[][^)）】\]]*[)）】\]]/g, " ");
  head = head.replace(/\b(19|20)\d{2}\b/g, " ");
  head = head.replace(/[\s\-_·:：,，.。!！?？、]+$/g, "").trim();

  const yearMatch = text.match(/\b(19|20)\d{2}\b/);
  const display = head || text.replace(BRACKETS, " ").trim();
  const base = keyOf(display);
  return {
    no,
    part: partMatch ? partMatch[1] : "",
    variant,
    year: yearMatch ? yearMatch[0] : "",
    display,
    base: base.length >= 2 ? base : "",
  };
}

export function contentTypes(item) {
  const tags = item.tags || [];
  const type = String(item.type || "");
  const has = (tag) => tags.includes(tag);
  const out = [];
  const add = (id) => {
    if (!out.includes(id)) out.push(id);
  };
  if (["英语L1", "英语L2", "英语L3", "英语L4"].some(has)) add("ct-english");
  if (["语文L1", "语文L2", "语文L3", "语文L4"].some(has) || has("人文")) add("ct-chinese");
  if (has("低幼") || /儿童儿歌/.test(type)) add("ct-toddler");
  if (has("科学")) add("ct-science");
  if (has("纪录片") || /记录?片/.test(type)) add("ct-doc");
  if (has("艺术")) add("ct-art");
  if (has("安全") || has("情绪")) add("ct-safety");
  if (has("科技")) add("ct-tech");
  if (has("动画")) {
    if (/电影/.test(type)) add("ct-movie");
    else if (/日韩|日本/.test(type)) add("ct-japan");
    else if (/欧美|海外/.test(type)) add("ct-overseas");
    else if (/国产|中国/.test(type)) add("ct-domestic");
    else add("ct-animation");
  }
  return out;
}

function sourceOf(item) {
  if (item.source === "bili") return "src-bili";
  if (item.source === "mac") return "src-mac";
  return "src-cctv";
}

function episodeCount(item) {
  let count = Number(item.episodes) || 0;
  for (const backup of item.backups || []) {
    const value = Array.isArray(backup.episodes) ? backup.episodes.length : Number(backup.episodes) || 0;
    if (value > count) count = value;
  }
  return count;
}

function seasonLabel(season) {
  const parts = [];
  if (season.no > 0) parts.push("第" + season.no + "季" + (season.part ? "(" + season.part + ")" : ""));
  else if (season.part) parts.push(season.part + "部");
  if (season.variant) parts.push(season.variant);
  if (season.year) parts.push(season.year);
  return parts.join(" · ");
}

function escapeRe(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function keywordHit(text, keyword) {
  if (!keyword) return false;
  if (/^[A-Za-z0-9 ]+$/.test(keyword)) {
    return new RegExp("(^|[^A-Za-z0-9])" + escapeRe(keyword) + "([^A-Za-z0-9]|$)", "i").test(text);
  }
  return text.toLowerCase().includes(keyword.toLowerCase());
}

// group 和单条内容在专题里的匹配规则保持一致：标签命中或标题关键词命中。
export function topicMatches(unit, topic) {
  const tags = Array.isArray(unit.tags) ? unit.tags : [];
  if (Array.isArray(topic.tags) && topic.tags.length && tags.some((tag) => topic.tags.includes(tag))) return true;
  const names = topic.names || [];
  if (!names.length) return false;
  const text = unit.g ? String(unit.alias || unit.name || "") : String(unit.name || "");
  return names.some((keyword) => keywordHit(text, keyword));
}

export function organize(series, taxonomy) {
  const buckets = new Map();
  for (const item of series) {
    const info = parseName(item.name);
    item.init = initialOf(info.display || item.name);
    item.ct = contentTypes(item);
    item.lng = languagesOf(item);
    item.fms = formsOf(item);
    item.paths = withPathChildren(item);
    item.hid = 0;
    if (!info.base) continue;
    if (!buckets.has(info.base)) buckets.set(info.base, []);
    buckets.get(info.base).push({ item, info });
  }

  const groups = [];
  const seasonIds = new Set();
  for (const [base, members] of buckets) {
    if (members.length < 2) continue;
    members.sort((a, b) => {
      const left = a.info.no || 999;
      const right = b.info.no || 999;
      if (left !== right) return left - right;
      if (a.info.year !== b.info.year) return String(a.info.year).localeCompare(String(b.info.year));
      return String(a.item.name).localeCompare(String(b.item.name));
    });

    const names = new Map();
    for (const member of members) {
      const display = member.info.display;
      if (display) names.set(display, (names.get(display) || 0) + 1);
    }
    let groupName = base;
    let best = 0;
    for (const [name, count] of names) {
      if (count > best || (count === best && name.length < groupName.length)) {
        groupName = name;
        best = count;
      }
    }

    const seasons = [];
    const tags = [];
    const paths = [];
    const ct = [];
    const lng = [];
    const fms = [];
    const srcs = [];
    const stages = {};
    const aliases = [];
    let ageMin = 99;
    let ageMax = 0;
    let order = Number.MAX_SAFE_INTEGER;
    let latestTime = 0;
    let pic = "";
    let desc = "";
    const episodesByLabel = new Map();

    for (const member of members) {
      const item = member.item;
      seasonIds.add(item.id);
      item.hid = 1;
      const label = seasonLabel(member.info);
      const episodes = episodeCount(item);
      seasons.push({ id: item.id, no: member.info.no, label, year: member.info.year, episodes });
      episodesByLabel.set(label || item.id, Math.max(episodesByLabel.get(label || item.id) || 0, episodes));
      for (const tag of item.tags || []) if (!tags.includes(tag)) tags.push(tag);
      for (const path of item.paths || []) if (!paths.includes(path)) paths.push(path);
      for (const type of item.ct || []) if (!ct.includes(type)) ct.push(type);
      for (const id of item.lng || []) if (!lng.includes(id)) lng.push(id);
      for (const id of item.fms || []) if (!fms.includes(id)) fms.push(id);
      const source = sourceOf(item);
      if (!srcs.includes(source)) srcs.push(source);
      for (const [path, stage] of Object.entries(item.stages || {})) {
        if (stages[path] === undefined || stage < stages[path]) stages[path] = stage;
      }
      if (!aliases.includes(item.name)) aliases.push(item.name);
      ageMin = Math.min(ageMin, Number(item.ageMin) || 0);
      ageMax = Math.max(ageMax, Number(item.ageMax) || 0);
      order = Math.min(order, Number(item.order) || Number.MAX_SAFE_INTEGER);
      latestTime = Math.max(latestTime, Number(item.latestTime) || 0);
      if (!pic && item.pic) pic = item.pic;
      if (!desc && item.desc) desc = String(item.desc).trim();
    }

    let episodes = 0;
    for (const value of episodesByLabel.values()) episodes += value;

    groups.push({
      g: 1,
      key: "ip-" + createHash("md5").update(base).digest("hex").slice(0, 10),
      name: groupName,
      pic,
      alias: [groupName].concat(aliases).join(" ").slice(0, 400),
      init: initialOf(groupName),
      ages: [ageMin === 99 ? 0 : ageMin, ageMax || 12],
      paths,
      tags,
      ct,
      lng,
      fms,
      srcs,
      stages,
      order: order === Number.MAX_SAFE_INTEGER ? 1000000 : order,
      latestTime,
      episodes,
      desc: desc.slice(0, 200),
      seasons,
    });
  }

  const units = groups.concat(series.filter((item) => !item.hid));
  units.sort((a, b) => COLLATOR.compare(String(a.name || ""), String(b.name || "")));
  units.forEach((unit, index) => {
    unit.py = index + 1;
  });

  return {
    groups,
    units: units.length,
    seasons: seasonIds.size,
    groupsWithSeasons: groups.filter((group) => group.episodes > 0).length,
  };
}
