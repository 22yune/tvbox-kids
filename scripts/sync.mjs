#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { buildJar } from "./build-jar.mjs";

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

// 单个字符串常量在 class 文件里上限 65535 字节（中文按 3 字节计），
// 因此按字符切块后由 join 拼接。
function chunks(text, size = 4000) {
  const parts = [];
  for (let i = 0; i < text.length; i += size) parts.push(text.slice(i, i + size));
  return parts;
}

function buildCatalogSource(taxonomy, catalog) {
  const series = chunks(JSON.stringify(catalog.series));
  const groups = chunks(JSON.stringify(taxonomy));
  const lines = [
    "package com.github.catvod.spider;",
    "",
    "// 由 scripts/sync.mjs 生成，请勿手改。",
    "final class Catalog {",
    "",
    "    static final String SERIES = join(",
    series.map((part) => "            " + JSON.stringify(part)).join(",\n"),
    "    );",
    "",
    "    static final String TAXONOMY = join(",
    groups.map((part) => "            " + JSON.stringify(part)).join(",\n"),
    "    );",
    "",
    "    private Catalog() {",
    "    }",
    "",
    "    private static String join(String... parts) {",
    "        StringBuilder builder = new StringBuilder();",
    "        for (String part : parts) builder.append(part);",
    "        return builder.toString();",
    "    }",
    "}",
    "",
  ];
  return lines.join("\n");
}

function gitRemote() {
  try {
    return execFileSync("git", ["remote", "get-url", "origin"], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch (error) {
    return "";
  }
}

// jar 爬虫（api: csp_Kids）不需要任何运行时模块，兼容所有 catvod 系 App。
// raw.githubusercontent.com 在国内多数网络不可达，默认套一层 gh-proxy；
// 想直连 raw 就用 KIDS_USE_RAW=1 或 KIDS_JAR_URL 指定完整地址。
function spiderRepo() {
  if (process.env.GITHUB_REPOSITORY) {
    return { repo: process.env.GITHUB_REPOSITORY, ref: process.env.GITHUB_REF_NAME || "main" };
  }
  const match = gitRemote().match(/github\.com[/:]([^/]+)\/([^/.]+?)(?:\.git)?$/);
  if (match) return { repo: match[1] + "/" + match[2], ref: "main" };
  return null;
}

function jarUrl() {
  if (process.env.KIDS_JAR_URL) return process.env.KIDS_JAR_URL;
  if (process.env.KIDS_BASE_URL) {
    return process.env.KIDS_BASE_URL.replace(/\/+$/, "") + "/spider/kids.jar";
  }
  const target = spiderRepo();
  if (!target) {
    console.warn("[warn] 无法确定仓库地址，spider 使用本地预览地址 http://127.0.0.1:8000/spider/kids.jar");
    return "http://127.0.0.1:8000/spider/kids.jar";
  }
  const raw = "https://raw.githubusercontent.com/" + target.repo +
    "/refs/heads/" + target.ref + "/spider/kids.jar";
  return process.env.KIDS_USE_RAW === "1" ? raw : "https://gh-proxy.com/" + raw;
}

// ext 在 FongMi 里是 String 字段（Gson 直接反序列化），写成对象会导致
// Site.objectFrom 抛异常并返回空站点，表现为点播栏目全空，因此必须是字符串。
function site(key, name, mode) {
  return {
    key,
    name,
    type: 3,
    api: "csp_Kids",
    ext: JSON.stringify({ mode }),
    searchable: 0,
    quickSearch: 0,
    changeable: 0,
    style: { type: "rect", ratio: 1.78 },
  };
}

function buildConfig(live, jar) {
  return {
    spider: jarUrl() + ";md5;" + jar.md5,
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
  const live = await readJson("data/live.json");
  let catalog;

  if (process.env.KIDS_SKIP_FETCH === "1") {
    console.log("[skip] KIDS_SKIP_FETCH=1，直接使用 data/catalog.json");
    catalog = await readJson("data/catalog.json");
  } else {
    const seriesInput = await readJson("data/series.json");
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

    catalog = {
      updatedAt: new Date().toISOString(),
      source: "cctv",
      series: enriched,
    };
    await writeFile("data/catalog.json", JSON.stringify(catalog, null, 2));
  }

  await writeFile("spider-src/com/github/catvod/spider/Catalog.java", buildCatalogSource(taxonomy, catalog));
  const jar = buildJar();
  const config = buildConfig(live, jar);
  await writeFile("kids.json", JSON.stringify(config, null, 2));

  const series = catalog.series || [];
  const stale = series.filter((item) => item.stale).length;
  const unplayable = series.filter((item) => item.playable === false).length;
  console.log(
    "Synced " + series.length + " series" +
    (stale ? "，stale " + stale : "") +
    (VERIFY ? "，unplayable " + unplayable : "") +
    "。输出：data/catalog.json、spider-src/.../Catalog.java、spider/kids.jar（md5 " + jar.md5 + "）、kids.json"
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
