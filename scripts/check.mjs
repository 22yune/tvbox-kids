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

  requireField(catalogSource.includes("final class Catalog"), "Catalog.java 结构异常");
  requireField(catalogSource.includes("class Catalog") && !catalogSource.includes("__CATALOG__"), "Catalog.java 仍是模板");
  requireField(kidsSource.includes("extends Spider"), "Kids.java 必须继承 com.github.catvod.crawler.Spider");
  requireField(kidsSource.includes("vod_play_url"), "Kids.java 缺少播放列表");

  requireField(typeof config.spider === "string" && /^https?:\/\/.+\.jar;md5;[0-9a-f]{32}$/.test(config.spider), "kids.json 的 spider 必须是 <jar 地址>;md5;<32 位 md5>");
  requireField(Array.isArray(config.sites) && config.sites.length >= 3, "kids.json 站点数量不足");
  for (const site of config.sites || []) {
    requireField(site.key && site.name && site.api, "站点缺少 key/name/api");
    if (site.type === 3) {
      requireField(site.api === "csp_Kids", site.key + " 的 api 必须是 csp_Kids");
      requireField(typeof site.ext === "string", site.key + " 的 ext 必须是字符串，FongMi 用 Gson 反序列化为 String");
    }
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

  const ageCounts = taxonomy.ages.map((age) => {
    const count = catalog.series.filter((item) => item.ageMin < age.max && item.ageMax > age.min).length;
    return age.name + " " + count;
  });
  const pathCounts = taxonomy.paths.map((item) => item.name + " " + catalog.series.filter((s) => (s.paths || []).includes(item.id)).length);

  console.log("系列：" + catalog.series.length);
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
