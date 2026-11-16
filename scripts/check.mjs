#!/usr/bin/env node
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { organize, topicMatches } from "./group.mjs";
import { authorsOf, readFaces } from "./authors.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const MODES = ["search", "age", "path", "content", "topic", "alpha", "source", "bili", "author"];

async function read(relative) {
  return fs.readFile(path.join(ROOT, relative), "utf8");
}

async function readJson(relative) {
  return JSON.parse(await read(relative));
}

function requireField(condition, message) {
  if (!condition) errors.push(message);
}

async function main() {
  const taxonomy = await readJson("data/taxonomy.json");
  const series = await readJson("data/series.json");
  const catalog = await readJson("data/catalog.json");
  const config = await readJson("kids.json");
  const catalogSource = await read("spider-src/com/github/catvod/spider/Catalog.java");
  const kidsSource = await read("spider-src/com/github/catvod/spider/Kids.java");
  const live = await readJson("data/live.json");
  const curation = await readJson("data/curation.json");
  const curated = await readJson("data/curated_catalog.json");
  const backupSites = await readJson("data/backup_sites.json");
  let open = { series: [] };
  try {
    open = await readJson("data/open_catalog.json");
  } catch (error) {
    open = { series: [] };
  }
  let topicCatalog = { english: [], chinese: [] };
  try {
    topicCatalog = await readJson("data/topic_catalog.json");
  } catch (error) {
    topicCatalog = { english: [], chinese: [] };
  }

  const ages = new Set(taxonomy.ages.map((item) => item.id));
  const paths = new Set(taxonomy.paths.map((item) => item.id));
  const contents = new Set(taxonomy.contents.map((item) => item.id));
  const sources = new Set(taxonomy.sources.map((item) => item.id));
  const languages = new Set((taxonomy.languages || []).map((item) => item.id));
  const forms = new Set((taxonomy.forms || []).map((item) => item.id));
  const subjects = new Set((taxonomy.subjects || []).map((item) => item.id));
  const tagSet = new Set(taxonomy.tags || []);

  const coverage = catalog.series.concat(curated.series || []).concat(open.series || []).concat(topicCatalog.english || []).concat(topicCatalog.chinese || []);

  requireField(series.length >= 10, "series.json 条目过少");
  requireField(catalog.series.length === series.length, "catalog 与 series 数量不一致");

  requireField(taxonomy.ages.length >= 2, "taxonomy 缺少年龄段");
  requireField(taxonomy.paths.length >= 4, "taxonomy 缺少学习路线");
  requireField(contents.size >= 6, "taxonomy 缺少内容分类");
  requireField(sources.size >= 3, "taxonomy 缺少来源分类");
  requireField(languages.size >= 2, "taxonomy 缺少语言分类");
  requireField(forms.size >= 2, "taxonomy 缺少观看形式");
  requireField(subjects.size >= 4, "taxonomy 缺少学科筛选");
  requireField(Array.isArray(taxonomy.alphabet) && taxonomy.alphabet.length >= 27, "taxonomy 的字序表不完整");
  requireField(tagSet.size >= 5, "taxonomy 缺少标签白名单");
  requireField(Array.isArray(taxonomy.topicGroups) && taxonomy.topicGroups.length >= 3, "taxonomy 缺少专题分组");

  const pathNames = new Map(taxonomy.paths.map((item) => [item.id, item.name]));
  for (const path of taxonomy.paths) {
    if (!path.parent) continue;
    requireField(paths.has(path.parent), path.id + " 的主路线不存在：" + path.parent);
    requireField(String(path.name || "").includes(pathNames.get(path.parent) + "-"), path.id + " 的名称应为「主类-子类」");
  }
  for (const subject of taxonomy.subjects || []) {
    requireField(paths.has(subject.id), "学科引用了未知路线：" + subject.id);
  }

  const topicIds = new Set();
  const topicGroups = new Set();
  const topicsById = new Map();
  let topicCount = 0;
  for (const group of taxonomy.topicGroups || []) {
    requireField(Boolean(group.id) && /^tg-[a-z]+$/.test(group.id || ""), "专题分组 id 格式不正确：" + (group.id || "?"));
    requireField(!topicGroups.has(group.id), "专题分组 id 重复：" + group.id);
    topicGroups.add(group.id);
    requireField(Boolean(group.name), group.id + " 缺少名称");
    requireField(Array.isArray(group.topics) && group.topics.length > 0, group.id + " 没有专题");
    for (const topic of group.topics || []) {
      requireField(Boolean(topic.id) && /^tp-[a-z0-9-]+$/.test(topic.id || ""), group.id + " 下的专题 id 格式不正确：" + (topic.id || "?"));
      requireField(!topicIds.has(topic.id), "专题 id 重复：" + topic.id);
      topicIds.add(topic.id);
      topicsById.set(topic.id, topic);
      topicCount += 1;
      requireField(Boolean(topic.name), topic.id + " 缺少名称");
      requireField(Array.isArray(topic.names) && topic.names.length > 0, topic.id + " 缺少关键词");
      for (const tag of topic.tags || []) {
        requireField(tagSet.has(tag), topic.id + " 使用了未登记的标签 " + tag);
      }
    }
  }

  for (const item of catalog.series) {
    requireField(item.id && item.name && item.column, item.id + " 缺少基础字段");
    requireField(/^TOPC[0-9A-Za-z]+$/.test(item.column || ""), item.id + " 的 column 格式不正确");
    requireField(Number.isFinite(item.ageMin) && Number.isFinite(item.ageMax), item.id + " 缺少年龄段");
    requireField(item.ageMin < item.ageMax, item.id + " 的年龄段不合法");
    requireField(item.ageMin >= 0 && item.ageMax <= 18, item.id + " 的年龄段越界");
    requireField(Array.isArray(item.paths) && item.paths.length > 0, item.id + " 未绑定学习路线");
    for (const pathId of item.paths || []) {
      requireField(paths.has(pathId), item.id + " 引用了未知路线 " + pathId);
    }
    for (const tag of item.tags || []) {
      requireField(tagSet.has(tag), item.id + " 的标签未登记：" + tag);
    }
  }

  for (const age of ages) {
    const band = taxonomy.ages.find((x) => x.id === age);
    const covered = coverage.some((item) => item.ageMin < band.max && item.ageMax > band.min);
    requireField(covered, "年龄段没有内容：" + age);
  }
  for (const path of taxonomy.paths) {
    if (path.parent) continue;
    requireField(coverage.some((item) => (item.paths || []).includes(path.id)), "学习路线没有内容：" + path.id);
  }

  const knownLists = new Set(curation.lists || []);
  const cctvIds = new Set(catalog.series.map((item) => item.id));
  const curationIds = new Set();
  for (const item of curation.series || []) {
    requireField(item.id && item.name, (item.id || "?") + " 缺少 id/name");
    requireField(!curationIds.has(item.id), "名单 id 重复：" + item.id);
    requireField(!cctvIds.has(item.id), "名单 id 与央视栏目重复：" + item.id);
    curationIds.add(item.id);
    requireField(Array.isArray(item.aliases) && item.aliases.length > 0, item.id + " 缺少搜索别名");
    requireField(Number.isFinite(item.ageMin) && Number.isFinite(item.ageMax) && item.ageMin < item.ageMax, item.id + " 的年龄段不合法");
    requireField(Array.isArray(item.paths) && item.paths.length > 0, item.id + " 未绑定学习路线");
    for (const pathId of item.paths || []) {
      requireField(paths.has(pathId), item.id + " 引用了未知路线 " + pathId);
    }
    for (const tag of item.tags || []) {
      requireField(tagSet.has(tag), item.id + " 的标签未登记：" + tag);
    }
    requireField(Array.isArray(item.list) && item.list.length > 0, item.id + " 缺少名单来源");
    for (const name of item.list || []) {
      requireField(knownLists.has(name), item.id + " 使用了未知名单来源 " + name);
    }
    requireField(Boolean(item.why), item.id + " 缺少入选理由");
  }

  const backupKeys = new Set((backupSites.sites || []).map((site) => site.key));
  requireField(backupKeys.size >= 2, "backup_sites.json 至少需要 2 个备用站");

  const curatedIds = new Set();
  for (const item of curated.series || []) {
    requireField(curationIds.has(item.id), "解析结果不在名单里：" + (item.id || "?"));
    requireField(!curatedIds.has(item.id), "解析结果 id 重复：" + item.id);
    curatedIds.add(item.id);
    requireField(/^BV[0-9A-Za-z]+$/.test(item.bvid || ""), item.id + " 的 bvid 格式不正确");
    requireField(item.source === "bili", item.id + " 的 source 必须是 bili");
    requireField(Number.isFinite(item.ageMin) && Number.isFinite(item.ageMax) && item.ageMin < item.ageMax, item.id + " 的年龄段不合法");
    requireField(Array.isArray(item.paths) && item.paths.length > 0, item.id + " 未绑定学习路线");
    for (const pathId of item.paths || []) {
      requireField(paths.has(pathId), item.id + " 引用了未知路线 " + pathId);
    }
    for (const tag of item.tags || []) {
      requireField(tagSet.has(tag), item.id + " 的标签未登记：" + tag);
    }
    for (const backup of item.backups || []) {
      requireField(backup && /^https?:\/\//.test(backup.api || ""), item.id + " 的备用线路缺少 api");
      requireField(backupKeys.has(backup && backup.key), item.id + " 引用了未登记的备用站 " + (backup && backup.key));
      requireField(Boolean(backup && backup.site), item.id + " 的备用线路缺少站点名");
      requireField(Boolean(backup && String(backup.vodId || "").length), item.id + " 的备用线路缺少 vodId");
      requireField(Boolean(backup && String(backup.from || "").length), item.id + " 的备用线路缺少 from");
      requireField(Array.isArray(backup && backup.episodes) && backup.episodes.length > 0, item.id + " 的备用线路没有集数");
    }
  }
  for (const item of curated.missing || []) {
    requireField(curationIds.has(item.id), "缺失记录不在名单里：" + (item.id || "?"));
  }

  const openIds = new Set();
  for (const item of open.series || []) {
    requireField(Boolean(item.id) && /^mac-[0-9a-z]+$/.test(item.id), (item.id || "?") + " 的采集站 id 格式不正确");
    requireField(!openIds.has(item.id), "采集站 id 重复：" + item.id);
    requireField(!curationIds.has(item.id) && !cctvIds.has(item.id), "采集站 id 与已有条目重复：" + item.id);
    openIds.add(item.id);
    requireField(item.source === "mac", item.id + " 的 source 必须是 mac");
    requireField(Boolean(item.name), item.id + " 缺少名称");
    requireField(Number.isFinite(item.ageMin) && Number.isFinite(item.ageMax) && item.ageMin < item.ageMax, item.id + " 的年龄段不合法");
    requireField(item.ageMin >= 0 && item.ageMax <= 12, item.id + " 的年龄段越界");
    requireField(Array.isArray(item.paths) && item.paths.length > 0, item.id + " 未绑定学习路线");
    for (const pathId of item.paths || []) {
      requireField(paths.has(pathId), item.id + " 引用了未知路线 " + pathId);
    }
    for (const tag of item.tags || []) {
      requireField(tagSet.has(tag), item.id + " 的标签未登记：" + tag);
    }
    requireField(Array.isArray(item.list) && item.list.length > 0, item.id + " 缺少来源标签");
    for (const name of item.list || []) {
      requireField(knownLists.has(name), item.id + " 使用了未知名单来源 " + name);
    }
    requireField(Number.isFinite(item.episodes) && item.episodes > 0, item.id + " 缺少集数");
    requireField(Array.isArray(item.backups) && item.backups.length > 0 && item.backups.length <= 6, item.id + " 的播放源必须是 1-6 个");
    for (const backup of item.backups || []) {
      requireField(/^https?:\/\//.test(backup.api || ""), item.id + " 的播放源缺少 api");
      requireField(backupKeys.has(backup.key), item.id + " 引用了未登记的采集站 " + backup.key);
      requireField(Boolean(backup.site), item.id + " 的播放源缺少站点名");
      requireField(Boolean(String(backup.vodId || "").length), item.id + " 的播放源缺少 vodId");
      requireField(Boolean(String(backup.from || "").length), item.id + " 的播放源缺少 from");
      requireField(Number.isFinite(backup.episodes) && backup.episodes > 0, item.id + " 的播放源缺少集数");
    }
  }

  const TOPIC_KEYS = { english: { prefix: "en", tag: "英语", list: "专题·英语学习" }, chinese: { prefix: "cn", tag: "语文", list: "专题·语文素养" } };
  const topicItemIds = new Set();
  for (const [key, meta] of Object.entries(TOPIC_KEYS)) {
    const list = topicCatalog[key] || [];
    requireField(list.length >= 100, "专题「" + meta.tag + "」条目过少：" + list.length);
    for (const item of list) {
      requireField(Boolean(item.id) && new RegExp("^" + meta.prefix + "-[0-9a-z]+$").test(item.id), (item.id || "?") + " 的专题 id 格式不正确");
      requireField(!topicItemIds.has(item.id), "专题 id 重复：" + item.id);
      requireField(!openIds.has(item.id) && !curationIds.has(item.id) && !cctvIds.has(item.id), "专题 id 与已有条目重复：" + item.id);
      topicItemIds.add(item.id);
      requireField(item.source === "bili", item.id + " 的 source 必须是 bili");
      requireField(/^BV[0-9A-Za-z]+$/.test(item.bvid || ""), item.id + " 的 bvid 格式不正确");
      requireField(Boolean(item.name), item.id + " 缺少名称");
      requireField(Number.isFinite(item.ageMin) && Number.isFinite(item.ageMax) && item.ageMin < item.ageMax, item.id + " 的年龄段不合法");
      requireField(item.ageMin >= 0 && item.ageMax <= 12, item.id + " 的年龄段越界");
      requireField(Array.isArray(item.paths) && item.paths.length > 0, item.id + " 未绑定学习路线");
      for (const pathId of item.paths || []) {
        requireField(paths.has(pathId), item.id + " 引用了未知路线 " + pathId);
      }
      const tag = (item.tags || [])[0] || "";
      requireField(new RegExp("^" + meta.tag + "L[1-4]$").test(tag), item.id + " 的分级标签不正确：" + (tag || "空"));
      for (const name of item.tags || []) {
        requireField(tagSet.has(name), item.id + " 的标签未登记：" + name);
      }
      requireField(Array.isArray(item.list) && item.list.length === 1 && item.list[0] === meta.list, item.id + " 的专题来源应固定为 " + meta.list);
      requireField(Number.isFinite(item.episodes) && item.episodes > 0, item.id + " 缺少集数");
      requireField(Boolean(item.latest), item.id + " 缺少更新标记");
      requireField(Number.isFinite(item.order), item.id + " 缺少排序值");
    }
  }

  // 列表卡片的聚合结果：同一 IP 的多季只出现一张卡，专题和筛选都基于它做匹配。
  const organized = organize(coverage, taxonomy);
  const units = organized.groups.concat(coverage.filter((item) => !item.hid));
  const seriesIds = new Set(coverage.map((item) => item.id));
  const groupKeys = new Set();
  let groupedItems = 0;
  for (const group of organized.groups) {
    requireField(/^ip-[0-9a-f]{10}$/.test(group.key || ""), "IP key 格式不正确：" + (group.key || "?"));
    requireField(!groupKeys.has(group.key), "IP key 重复：" + group.key);
    groupKeys.add(group.key);
    requireField(Boolean(group.name), group.key + " 缺少名称");
    requireField(Array.isArray(group.ages) && group.ages.length === 2 && group.ages[0] < group.ages[1], group.name + " 的年龄段不合法");
    requireField(Array.isArray(group.seasons) && group.seasons.length >= 2, group.name + " 的季数少于 2");
    requireField(Array.isArray(group.paths) && group.paths.length > 0, group.name + " 未绑定学习路线");
    requireField(Array.isArray(group.ct) && group.ct.length > 0, group.name + " 缺少内容分类");
    requireField(Number.isFinite(group.episodes) && group.episodes > 0, group.name + " 缺少集数");
    requireField(Number.isFinite(group.py), group.name + " 缺少字序");
    for (const type of group.ct || []) {
      requireField(contents.has(type), group.name + " 引用了未知内容分类 " + type);
    }
    for (const source of group.srcs || []) {
      requireField(sources.has(source), group.name + " 引用了未知来源 " + source);
    }
    const seen = new Set();
    for (const season of group.seasons || []) {
      requireField(seriesIds.has(season.id), group.name + " 的季引用了不存在的条目：" + season.id);
      requireField(!seen.has(season.id), group.name + " 的季重复：" + season.id);
      seen.add(season.id);
    }
    groupedItems += group.seasons.length;
  }
  requireField(organized.groups.length > 0, "没有生成任何 IP 分组");
  requireField(units.length === organized.units, "IP 合并后的卡片数不一致");
  requireField(units.every((unit) => Number.isFinite(unit.py)), "存在没有字序的卡片");

  for (const pathId of paths) {
    requireField(units.some((unit) => (unit.paths || []).includes(pathId)), "学习路线没有内容：" + pathId);
  }
  for (const unit of units) {
    requireField(Array.isArray(unit.lng) && unit.lng.length > 0, (unit.name || "?") + " 缺少语言标记");
    requireField(Array.isArray(unit.fms), (unit.name || "?") + " 缺少观看形式");
    for (const id of unit.lng || []) requireField(languages.has(id), (unit.name || "?") + " 引用了未知语言 " + id);
    for (const id of unit.fms || []) requireField(forms.has(id), (unit.name || "?") + " 引用了未知观看形式 " + id);
  }

  // B 站内容/作者两个站点都从本地目录索引，作者只收有多个作品或播放量够高的账号。
  const authors = authorsOf(coverage, readFaces());
  requireField(authors.length >= 100, "B站作者过少：" + authors.length);
  const coverageById = new Map(coverage.map((item) => [item.id, item]));
  const authorKeys = new Set();
  let authorItems = 0;
  for (const author of authors) {
    requireField(/^au-[0-9a-f]{10}$/.test(author.k || ""), "作者 key 格式不正确：" + (author.k || "?"));
    requireField(!authorKeys.has(author.k), "作者 key 重复：" + author.k);
    authorKeys.add(author.k);
    requireField(Boolean(author.n), author.k + " 缺少作者名");
    requireField(Array.isArray(author.t) && author.t.length > 0, author.n + " 没有作品");
    // 名单条目可能只有 UP 主名、没有播放量，此时按 0 处理。
    requireField(Number.isFinite(author.v) && author.v >= 0, author.n + " 的总播放量不合法");
    requireField(Array.isArray(author.a) && author.a.length === 2 && author.a[0] < author.a[1], author.n + " 的年龄段不合法");
    requireField(Array.isArray(author.c) && author.c.length > 0, author.n + " 缺少内容分类");
    requireField(Array.isArray(author.l) && author.l.length > 0, author.n + " 缺少语言");
    for (const id of author.t) requireField(coverageById.has(id), author.n + " 的作品不存在：" + id);
    for (const id of author.c) requireField(contents.has(id), author.n + " 引用了未知内容分类 " + id);
    for (const id of author.l) requireField(languages.has(id), author.n + " 引用了未知语言 " + id);
    for (const id of author.p) requireField(paths.has(id), author.n + " 引用了未知路线 " + id);
    for (const id of author.f) requireField(forms.has(id), author.n + " 引用了未知观看形式 " + id);
    authorItems += author.t.length;
  }
  requireField(authorItems >= 500, "作者名下的作品过少：" + authorItems);
  const authorLanguages = new Set();
  for (const author of authors) for (const id of author.l || []) authorLanguages.add(id);
  requireField(authorLanguages.size >= 2, "作者站点缺少语言分栏");

  const srcsOf = (unit) => unit.g
    ? unit.srcs || []
    : [unit.source === "bili" ? "src-bili" : unit.source === "mac" ? "src-mac" : "src-cctv"];
  const biliUnits = units.filter((unit) => {
    const list = srcsOf(unit);
    return list.length > 0 && list.every((id) => id === "src-bili");
  });
  requireField(biliUnits.length >= 500, "B站内容过少：" + biliUnits.length);
  for (const unit of biliUnits) {
    requireField(Array.isArray(unit.ct) && unit.ct.length > 0, (unit.name || "?") + " 缺少内容分类，B站内容站点无法收录");
  }

  for (const id of ["tp-en-all", "tp-cn-all"]) {
    const topic = topicsById.get(id);
    requireField(Boolean(topic), "缺少专题：" + id);
    if (!topic) continue;
    const count = units.filter((unit) => topicMatches(unit, topic)).length;
    requireField(count >= 100, topic.name + " 的内容过少：" + count);
  }

  for (const group of taxonomy.topicGroups || []) {
    for (const topic of group.topics || []) {
      const count = units.filter((unit) => topicMatches(unit, topic)).length;
      requireField(count > 0, "专题没有内容：" + topic.name);
    }
  }

  requireField(catalogSource.includes("final class Catalog"), "Catalog.java 结构异常");
  requireField(catalogSource.includes("class Catalog") && !catalogSource.includes("__CATALOG__"), "Catalog.java 仍是模板");
  requireField(catalogSource.includes("static final String IP"), "Catalog.java 缺少 IP 常量");
  requireField(catalogSource.includes("static final String AUTHORS"), "Catalog.java 缺少作者常量");
  requireField(kidsSource.includes("extends Spider"), "Kids.java 必须继承 com.github.catvod.crawler.Spider");
  requireField(kidsSource.includes("vod_play_url"), "Kids.java 缺少播放列表");
  requireField(kidsSource.includes("groupDetail") && kidsSource.includes("topicFolders"), "Kids.java 缺少 IP 详情或专题文件夹");
  requireField(kidsSource.includes("authorFolders") && kidsSource.includes("findAuthor"), "Kids.java 缺少作者站点实现");
  requireField(kidsSource.includes("biliUnit") && kidsSource.includes("isMode"), "Kids.java 缺少 B站内容站点实现");
  requireField(kidsSource.includes("BILI_SEARCH_API") && kidsSource.includes("searchContent"), "Kids.java 缺少搜索实现");
  requireField(kidsSource.includes("languageValues") && kidsSource.includes("subjectValues") && kidsSource.includes("formValues"), "Kids.java 缺少多维筛选");

  requireField(typeof config.spider === "string" && /^https?:\/\/.+\.jar;md5;[0-9a-f]{32}$/.test(config.spider), "kids.json 的 spider 必须是 <jar 地址>;md5;<32 位 md5>");
  requireField(Array.isArray(config.sites) && config.sites.length === MODES.length, "kids.json 应只保留 " + MODES.length + " 个查找站点");
  const seenKeys = new Set();
  const seenModes = new Set();
  for (const site of config.sites || []) {
    requireField(site.key && site.name && site.api, "站点缺少 key/name/api");
    requireField(!seenKeys.has(site.key), "站点 key 重复：" + site.key);
    seenKeys.add(site.key);
    requireField(site.type === 3, site.key + " 必须是 jar 爬虫站点（type 3）");
    requireField(site.api === "csp_Kids", site.key + " 的 api 必须是 csp_Kids");
    requireField(typeof site.ext === "string", site.key + " 的 ext 必须是字符串，FongMi 用 Gson 反序列化为 String");
    let ext = null;
    try {
      ext = JSON.parse(site.ext);
    } catch (error) {
      ext = null;
    }
    requireField(ext && MODES.includes(ext.mode), site.key + " 的 ext.mode 不正确");
    // 只有「搜索」入口开搜索，其余入口打开会让同一条内容在搜索结果里重复出现。
    const searchable = ext && ext.mode === "search" ? 1 : 0;
    requireField(site.searchable === searchable && site.quickSearch === searchable, site.key + " 的搜索开关不正确");
    if (ext && MODES.includes(ext.mode)) {
      requireField(!seenModes.has(ext.mode), "查找方式重复：" + ext.mode);
      seenModes.add(ext.mode);
    }
  }
  requireField(seenModes.size === MODES.length, "查找方式没有全部配置");

  try {
    const jar = await fs.readFile(path.join(ROOT, "spider/kids.jar"));
    const md5 = createHash("md5").update(jar).digest("hex");
    requireField(config.spider.endsWith(";md5;" + md5), "spider/kids.jar 的 md5 与 kids.json 不一致，请重新构建");
  } catch (error) {
    errors.push("缺少 spider/kids.jar，请先执行 node scripts/sync.mjs");
  }

  requireField(Array.isArray(config.lives) && config.lives.length > 0, "kids.json 缺少直播配置");
  requireField((live.groups || []).length > 0, "live.json 缺少分组");
  for (const group of live.groups || []) {
    requireField(Array.isArray(group.channel) && group.channel.length > 0, group.name + " 分组为空");
    for (const channel of group.channel || []) {
      requireField(Array.isArray(channel.urls) && channel.urls.length > 0, channel.name + " 缺少播放地址");
    }
  }

  const ageCounts = taxonomy.ages.map((age) => {
    const count = units.filter((item) => item.ageMin < age.max && item.ageMax > age.min).length;
    return age.name + " " + count;
  });
  const pathCounts = taxonomy.paths.map((item) => item.name + " " + units.filter((s) => (s.paths || []).includes(item.id)).length);
  const listCounts = (curation.lists || []).map((name) => name + " " + (curation.series || []).filter((s) => (s.list || []).includes(name)).length);

  console.log("名单：" + (curation.series || []).length + "，已找到源：" + (curated.series || []).length +
    (curated.missing && curated.missing.length ? "，缺源：" + curated.missing.length : ""));
  if (curated.missing && curated.missing.length) {
    console.warn("缺源条目：" + curated.missing.map((item) => item.name).join("、"));
  }
  console.log("名单来源：" + listCounts.join(" / "));
  console.log("系列：" + catalog.series.length + "（央视）+ " + (curated.series || []).length + "（名单）+ " + (open.series || []).length + "（采集站）+ " +
    ((topicCatalog.english || []).length + (topicCatalog.chinese || []).length) + "（专题）");
  console.log("卡片：" + units.length + " 张，IP " + organized.groups.length + " 组（合并 " + groupedItems + " 条）");
  console.log("B站：内容 " + biliUnits.length + " 张，作者 " + authors.length + " 位 / " + authorItems + " 部");
  console.log("专题：" + taxonomy.topicGroups.length + " 组 / " + topicCount + " 个");
  console.log("年龄：" + ageCounts.join(" / "));
  console.log("路线：" + pathCounts.join(" / "));
  console.log("站点：" + config.sites.length + "，直播频道：" + live.groups.reduce((sum, g) => sum + g.channel.length, 0));

  if (errors.length) {
    console.error("\n校验失败：");
    for (const error of errors) console.error("- " + error);
    process.exit(1);
  }
  console.log("校验通过。");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
