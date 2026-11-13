#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LIST_API = "https://api.cntv.cn/NewVideo/getVideoListByColumn";
const PLAY_API = "https://vdn.apps.cntv.cn/api/getHttpVideoInfo.do";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const HEADERS = { "User-Agent": UA, "Referer": "https://tv.cctv.com/" };
const VERIFY = process.argv.includes("--verify");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function readJson(relative) {
  return JSON.parse(await fs.readFile(path.join(ROOT, relative), "utf8"));
}

async function writeFile(relative, content) {
  const target = path.join(ROOT, relative);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content.endsWith("\n") ? content : content + "\n", "utf8");
}

async function fetchJson(url, tries = 3) {
  let lastError;
  for (let attempt = 1; attempt <= tries; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: HEADERS,
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) throw new Error("HTTP " + response.status);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < tries) await sleep(attempt * 800);
    }
  }
  throw lastError;
}

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

function listUrl(column, count) {
  return LIST_API + "?id=" + encodeURIComponent(column) +
    "&n=" + count + "&sort=desc&p=1&mode=0&serviceId=tvcctv";
}

async function enrich(series) {
  const data = await fetchJson(listUrl(series.column, 5));
  const payload = (data && data.data) || {};
  const list = payload.list || [];
  const first = list[0] || {};
  return {
    ...series,
    pic: first.image || series.pic || "",
    latest: first.title || series.latest || "",
    latestTime: Number(first.focus_date) || Date.parse(first.time) || series.latestTime || 0,
    latestGuid: first.guid || series.latestGuid || "",
    count: Number(payload.total) || series.count || 0,
    stale: false,
  };
}

async function verifyEpisode(series) {
  if (!series.latestGuid) return { playable: false, reason: "没有最新节目 ID" };
  try {
    const data = await fetchJson(PLAY_API + "?pid=" + encodeURIComponent(series.latestGuid));
    const hls = data && (data.hls_url || (data.video && data.video.hls_url));
    if (!hls) return { playable: false, reason: (data && data.tip_msg) || "未返回 HLS" };
    const response = await fetch(hls, {
      headers: HEADERS,
      signal: AbortSignal.timeout(15000),
    });
    const text = await response.text();
    const ok = response.ok && text.includes("#EXTM3U");
    return { playable: ok, reason: ok ? "OK" : "HLS 内容异常" };
  } catch (error) {
    return { playable: false, reason: String((error && error.message) || error) };
  }
}

function buildSpider(template, taxonomy, catalog) {
  if (!template.includes("/*__CATALOG__*/ []")) throw new Error("模板缺少 CATALOG 占位符");
  if (!template.includes("/*__TAXONOMY__*/ {}")) throw new Error("模板缺少 TAXONOMY 占位符");
  return template
    .replace("/*__CATALOG__*/ []", JSON.stringify(catalog.series))
    .replace("/*__TAXONOMY__*/ {}", JSON.stringify(taxonomy));
}

function site(key, name, mode) {
  return {
    key,
    name,
    type: 3,
    api: "./spider/kids.js",
    ext: { mode },
    searchable: 0,
    quickSearch: 0,
    changeable: 0,
    style: { type: "rect", ratio: 1.78 },
  };
}

function buildConfig(live) {
  return {
    notice: "儿童模式：已关闭搜索，仅保留央视少儿与精选直播。补充点播源默认隐藏，启用前请家长确认内容安全。",
    sites: [
      site("kids_age", "按年龄", "age"),
      site("kids_path", "按学习路线", "path"),
      site("kids_topic", "精选专题", "topic"),
      {
        key: "kids_extra",
        name: "补充点播（家长可选）",
        type: 1,
        api: "https://jszyapi.com/api.php/provide/vod/at/json",
        categories: ["动漫", "动画片", "中国动漫"],
        searchable: 0,
        quickSearch: 0,
        changeable: 0,
        hide: 1,
        header: { "User-Agent": UA, "Referer": "https://jszyapi.com/" },
      },
    ],
    lives: [
      {
        name: "少儿直播",
        ua: UA,
        groups: live.groups,
      },
    ],
  };
}

async function main() {
  const taxonomy = await readJson("data/taxonomy.json");
  const seriesInput = await readJson("data/series.json");
  const live = await readJson("data/live.json");

  let previous = { series: [] };
  try {
    previous = await readJson("data/catalog.json");
  } catch (error) {
    previous = { series: [] };
  }
  const previousById = new Map((previous.series || []).map((item) => [item.id, item]));

  const enriched = await mapLimit(seriesInput, 4, async (series) => {
    try {
      const item = await enrich(series);
      process.stdout.write(".");
      return item;
    } catch (error) {
      const old = previousById.get(series.id) || {};
      process.stdout.write("x");
      console.warn("\n[stale] " + series.name + "：" + String((error && error.message) || error));
      return { ...series, ...old, stale: true };
    }
  });
  process.stdout.write("\n");

  if (VERIFY) {
    const verified = await mapLimit(enriched, 3, async (series) => {
      const result = await verifyEpisode(series);
      if (!result.playable) console.warn("[verify] " + series.name + "：" + result.reason);
      return { ...series, playable: result.playable, verifyReason: result.reason };
    });
    enriched.splice(0, enriched.length, ...verified);
  }

  const catalog = {
    updatedAt: new Date().toISOString(),
    source: "cctv",
    series: enriched,
  };

  const template = await fs.readFile(path.join(ROOT, "src/kids.template.js"), "utf8");
  const spider = buildSpider(template, taxonomy, catalog);
  const config = buildConfig(live);

  await writeFile("data/catalog.json", JSON.stringify(catalog, null, 2));
  await writeFile("spider/kids.js", spider);
  await writeFile("kids.json", JSON.stringify(config, null, 2));

  const stale = enriched.filter((item) => item.stale).length;
  const unplayable = enriched.filter((item) => item.playable === false).length;
  console.log(
    "Synced " + enriched.length + " series" +
    (stale ? "，stale " + stale : "") +
    (VERIFY ? "，unplayable " + unplayable : "") +
    "。输出：data/catalog.json、spider/kids.js、kids.json"
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
