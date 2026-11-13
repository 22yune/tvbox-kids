#!/usr/bin/env node
// 备用线路：在第三方 MacCMS 站按标题搜索同名内容，只保留分类匹配、名称匹配、
// 且能取到直连 m3u8 的条目，每个系列最多 3 个站。
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
// 采集站的分类名不统一（记录片 / 电视剧 / 电影 混用），用黑名单排除明显不对的题材。
const TYPE_BAD = /恐怖|惊悚|伦理|情色|综艺|真人秀|解说|预告|短剧|新闻|体育|游戏/;
const BAD = /解说|混剪|预告|花絮|片段|reaction|盘点|速看|名场面/i;
// 前缀匹配只认「第一季 / 全52集 / 中文版」这类后缀，避免「九色鹿」匹配到「九色鹿王·前尘」。
const SUFFIX = /^(第?[一二三四五六七八九十百\d]+[季集部期话]|全集|合集|全\d*集?|共\d*集?|中文版?|国语版?|普通话版?|高清版?|完整版?|正片|\d+)$/;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

function norm(value) {
  return String(value || "")
    .replace(/[（(【\[].*?[）)】\]]/g, "")
    .replace(/[\s·•:：\-—_!！?？,，.。'"“”+&]/g, "")
    .toLowerCase();
}

function keywordOf(item) {
  let text = String(item.name || "").replace(/[（(【\[].*?[）)】\]]/g, " ");
  text = text.replace(/\s*(中文版|英语版|英文版|国语版|国语|全集|纪录片|动画版|动画片|动画|第一季|第二季|第三季|高清|中字|双语|儿童版|少儿版|英语启蒙|英文|中文)\s*/g, " ");
  text = text.replace(/[·•].*$/, " ");
  text = text.replace(/[A-Za-z][A-Za-z0-9+&'.\- ]*$/, " ");
  text = text.replace(/[!！?？,，。:：]/g, " ").trim();
  return text.length >= 2 ? text : String(item.name || "").trim();
}

function titleScore(keyword, title) {
  const k = norm(keyword);
  const v = norm(title);
  if (!k || !v || BAD.test(title)) return 0;
  if (v === k) return 100;
  if (v.length >= 3 && k.includes(v)) return 90;
  if (k.length >= 3 && v.startsWith(k) && SUFFIX.test(v.slice(k.length).replace(/^的/, ""))) return 70;
  return 0;
}

function pickGroup(detail) {
  const froms = String(detail.vod_play_from || "").split("$$$");
  const groups = String(detail.vod_play_url || "").split("$$$");
  let best = null;
  for (let i = 0; i < groups.length; i += 1) {
    const list = [];
    for (const part of String(groups[i] || "").split("#")) {
      const text = part.trim();
      if (!text) continue;
      const at = text.indexOf("$");
      const name = at < 0 ? "" : text.slice(0, at).trim();
      const url = (at < 0 ? text : text.slice(at + 1)).trim();
      if (!/^https?:/i.test(url) || !/\.m3u8(\?|$)/i.test(url)) continue;
      list.push({ name, url });
    }
    if (list.length && (!best || list.length > best.list.length)) {
      best = { from: froms[i] || "", list };
    }
  }
  return best;
}

async function searchSite(site, keyword) {
  const api = site.api;
  const url = api + (api.includes("?") ? "&" : "?") + "ac=detail&wd=" + encodeURIComponent(keyword);
  const response = await fetch(url, {
    headers: {
      "User-Agent": UA,
      "Referer": site.referer || new URL(api).origin + "/",
      "Accept": "application/json, text/plain, */*",
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("HTTP " + response.status);
  const data = await response.json();
  return Array.isArray(data.list) ? data.list : [];
}

function englishOf(item) {
  const match = String(item.name || "").match(/[A-Za-z][A-Za-z0-9+&'.\- ]{2,}/g);
  if (!match) return "";
  const text = match[match.length - 1].trim();
  return text.length >= 3 ? text : "";
}

async function backupsFor(item, sites) {
  const keyword = keywordOf(item);
  const english = englishOf(item);
  const total = Number(item.episodes) || Number(item.minPages) || 1;
  const need = total >= 10 ? 5 : total >= 3 ? 3 : 1;
  const found = [];
  for (const site of sites) {
    if (found.length >= 3) break;
    let list = [];
    try {
      list = await searchSite(site, keyword);
      if (!list.length && english) list = await searchSite(site, english);
    } catch (error) {
      continue;
    }
    let best = null;
    for (const detail of list) {
      const score = titleScore(keyword, detail.vod_name || "") || titleScore(english, detail.vod_name || "");
      if (!score) continue;
      const type = String(detail.type_name || "");
      if (TYPE_BAD.test(type)) continue;
      const group = pickGroup(detail);
      if (!group || group.list.length < need) continue;
      const rank = score + Math.min(group.list.length, 50) / 100;
      if (!best || rank > best.rank) best = { detail, group, rank };
    }
    if (best) {
      found.push({
        key: site.key,
        site: site.name,
        api: site.api,
        referer: site.referer || "",
        vodId: String(best.detail.vod_id),
        title: String(best.detail.vod_name || ""),
        from: best.group.from,
        episodes: best.group.list.slice(0, 100).map((entry, index) => entry.name || "第" + (index + 1) + "集"),
      });
    }
    await sleep(120);
  }
  return found;
}

export async function resolveBackups(series, previous, sites) {
  const previousById = new Map((previous || []).map((item) => [item.id, item]));
  return mapLimit(series, 4, async (item) => {
    let found = [];
    try {
      found = await backupsFor(item, sites);
    } catch (error) {
      found = [];
    }
    if (!found.length) {
      const old = previousById.get(item.id);
      if (old && Array.isArray(old.backups) && old.backups.length) found = old.backups;
    }
    return found.length ? { ...item, backups: found } : item;
  });
}

async function main() {
  const curation = JSON.parse(await fs.readFile(path.join(ROOT, "data/curation.json"), "utf8"));
  const sites = JSON.parse(await fs.readFile(path.join(ROOT, "data/backup_sites.json"), "utf8")).sites || [];
  const curated = JSON.parse(await fs.readFile(path.join(ROOT, "data/curated_catalog.json"), "utf8"));
  const known = new Set((curation.series || []).map((item) => item.id));
  const series = (curated.series || []).filter((item) => known.has(item.id));

  process.stdout.write("备用线路解析（" + sites.length + " 个站）：");
  const resolved = await resolveBackups(series, curated.series || [], sites);
  process.stdout.write("\n");

  const byId = new Map(resolved.map((item) => [item.id, item]));
  curated.series = (curated.series || []).map((item) => byId.get(item.id) || item);
  await fs.writeFile(path.join(ROOT, "data/curated_catalog.json"), JSON.stringify(curated, null, 2) + "\n", "utf8");

  const counts = [0, 0, 0, 0];
  for (const item of curated.series) {
    counts[Math.min(3, (item.backups || []).length)] += 1;
  }
  console.log(
    "备用源：0 条 " + counts[0] + " / 1 条 " + counts[1] + " / 2 条 " + counts[2] + " / 3 条 " + counts[3]
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
