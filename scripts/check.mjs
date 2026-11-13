#!/usr/bin/env node
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];

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
  const extra = await readJson("data/extra_sites.json");
  const curation = await readJson("data/curation.json");
  const curated = await readJson("data/curated_catalog.json");
  const backupSites = await readJson("data/backup_sites.json");

  const ages = new Set(taxonomy.ages.map((item) => item.id));
  const paths = new Set(taxonomy.paths.map((item) => item.id));
  const topics = new Set(taxonomy.topics.map((item) => item.id));
  const topicTags = new Set(taxonomy.topics.flatMap((item) => item.tags));

  requireField(series.length >= 10, "series.json 条目过少");
  requireField(catalog.series.length === series.length, "catalog 与 series 数量不一致");

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
      requireField(topicTags.has(tag), item.id + " 的标签未被任何专题使用：" + tag);
    }
  }

  for (const age of ages) {
    const covered = catalog.series.some((item) => item.ageMin < taxonomy.ages.find((x) => x.id === age).max && item.ageMax > taxonomy.ages.find((x) => x.id === age).min);
    requireField(covered, "年龄段没有内容：" + age);
  }
  for (const pathId of paths) {
    requireField(catalog.series.some((item) => (item.paths || []).includes(pathId)), "学习路线没有内容：" + pathId);
  }
  for (const topicId of topics) {
    requireField(catalog.series.some((item) => (item.tags || []).some((tag) => taxonomy.topics.find((x) => x.id === topicId).tags.includes(tag))), "专题没有内容：" + topicId);
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
      requireField(topicTags.has(tag), item.id + " 的标签未被任何专题使用：" + tag);
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
      requireField(topicTags.has(tag), item.id + " 的标签未被任何专题使用：" + tag);
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

  requireField(catalogSource.includes("final class Catalog"), "Catalog.java 结构异常");
  requireField(catalogSource.includes("class Catalog") && !catalogSource.includes("__CATALOG__"), "Catalog.java 仍是模板");
  requireField(kidsSource.includes("extends Spider"), "Kids.java 必须继承 com.github.catvod.crawler.Spider");
  requireField(kidsSource.includes("vod_play_url"), "Kids.java 缺少播放列表");

  requireField(typeof config.spider === "string" && /^https?:\/\/.+\.jar;md5;[0-9a-f]{32}$/.test(config.spider), "kids.json 的 spider 必须是 <jar 地址>;md5;<32 位 md5>");
  requireField(Array.isArray(config.sites) && config.sites.length >= 3, "kids.json 站点数量不足");
  const seenKeys = new Set();
  for (const site of config.sites || []) {
    requireField(site.key && site.name && site.api, "站点缺少 key/name/api");
    requireField(!seenKeys.has(site.key), "站点 key 重复：" + site.key);
    seenKeys.add(site.key);
    if (site.type === 3) {
      requireField(site.api === "csp_Kids", site.key + " 的 api 必须是 csp_Kids");
      requireField(typeof site.ext === "string", site.key + " 的 ext 必须是字符串，FongMi 用 Gson 反序列化为 String");
    }
    if (site.type === 1) {
      requireField(/^https?:\/\//.test(site.api), site.key + " 的 api 必须是绝对地址");
      requireField(Array.isArray(site.categories) && site.categories.length > 0, site.key + " 缺少分类白名单");
      requireField(site.searchable === 0 && site.quickSearch === 0, site.key + " 必须关闭搜索");
    }
  }
  requireField(
    (config.sites || []).filter((site) => site.type === 1).length === (extra.sites || []).length,
    "data/extra_sites.json 与 kids.json 的补充站点数量不一致"
  );
  for (const item of extra.sites || []) {
    requireField(item.key && item.name && item.api, "extra_sites.json 条目缺少 key/name/api");
    requireField(Array.isArray(item.categories) && item.categories.length > 0, (item.key || item.name) + " 缺少分类白名单");
  }

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

  const allSeries = catalog.series.concat(curated.series || []);
  const ageCounts = taxonomy.ages.map((age) => {
    const count = allSeries.filter((item) => item.ageMin < age.max && item.ageMax > age.min).length;
    return age.name + " " + count;
  });
  const pathCounts = taxonomy.paths.map((item) => item.name + " " + allSeries.filter((s) => (s.paths || []).includes(item.id)).length);
  const listCounts = (curation.lists || []).map((name) => name + " " + (curation.series || []).filter((s) => (s.list || []).includes(name)).length);

  console.log("名单：" + (curation.series || []).length + "，已找到源：" + (curated.series || []).length +
    (curated.missing && curated.missing.length ? "，缺源：" + curated.missing.length : ""));
  if (curated.missing && curated.missing.length) {
    console.warn("缺源条目：" + curated.missing.map((item) => item.name).join("、"));
  }
  console.log("名单来源：" + listCounts.join(" / "));
  console.log("系列：" + catalog.series.length + "（央视）+ " + (curated.series || []).length + "（名单）");
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
