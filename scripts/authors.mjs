#!/usr/bin/env node
// 按 UP 主聚合 B 站条目。B 站的 space 接口对匿名请求返回 -799/412，
// 因此作者名单与作品只从本地目录推导：专题采集时写进 desc 的「UP 主：xxx；播放 N」。
// 头像单独抓取一次并缓存在 data/author_faces.json，同步时只读缓存，不依赖网络。
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

import { sleep, viewOf } from "./bili.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FACES_FILE = path.join(ROOT, "data/author_faces.json");
const MIN_PLAYS = 5000000;
const MAX_AUTHORS = 400;
const MAX_ITEMS = 80;

const UP = /UP\s*主\s*[:：]\s*([^；;\n]+)/;
const PLAYS = /播放\s*(\d+)/;
const DEAD = /已注销|注销账号|账号已迁移/i;

export function authorOf(item) {
  if (item.source !== "bili") return "";
  if (item.author) return String(item.author).trim();
  const match = UP.exec(item.desc || "");
  return match ? match[1].trim() : "";
}

export function authorKey(name) {
  return "au-" + createHash("md5").update(String(name)).digest("hex").slice(0, 10);
}

function playsOf(item) {
  const match = PLAYS.exec(item.desc || "");
  return match ? Number(match[1]) : 0;
}

function merge(target, values) {
  for (const value of values || []) if (!target.includes(value)) target.push(value);
}

// author 的字段刻意压短：AUTHORS 常量要进 jar。
// k=key n=名字 i=头像/封面 a=年龄段 c=内容分类 p=学习路线 l=语言 f=形式 v=总播放 t=作品 id
export function authorsOf(series, faces = {}) {
  const buckets = new Map();
  for (const item of series) {
    const name = authorOf(item);
    if (!name || DEAD.test(name)) continue;
    const key = authorKey(name);
    if (!buckets.has(key)) buckets.set(key, { name, entries: [] });
    buckets.get(key).entries.push({ id: item.id, plays: playsOf(item), item });
  }

  const authors = [];
  for (const bucket of buckets.values()) {
    const entries = bucket.entries.slice().sort((a, b) => b.plays - a.plays);
    const plays = entries.reduce((sum, entry) => sum + entry.plays, 0);
    // 单条视频的账号大多是搬运号，只有播放量足够高才收进来。
    if (entries.length < 2 && plays < MIN_PLAYS) continue;
    const author = {
      k: authorKey(bucket.name),
      n: bucket.name.slice(0, 40),
      i: "",
      a: [99, 0],
      c: [],
      p: [],
      l: [],
      f: [],
      v: plays,
      t: [],
    };
    for (const entry of entries) {
      const item = entry.item;
      merge(author.c, item.ct);
      merge(author.p, item.paths);
      merge(author.l, item.lng);
      merge(author.f, item.fms);
      author.a[0] = Math.min(author.a[0], Number(item.ageMin) || 0);
      author.a[1] = Math.max(author.a[1], Number(item.ageMax) || 0);
      if (!author.i && item.pic) author.i = item.pic;
      if (author.t.length < MAX_ITEMS && !author.t.includes(item.id)) author.t.push(item.id);
    }
    if (author.a[0] === 99) author.a[0] = 0;
    if (!author.a[1]) author.a[1] = 12;
    const face = faces[author.n];
    if (face && face.face) author.i = face.face;
    if (author.t.length) authors.push(author);
  }

  authors.sort((a, b) => b.v - a.v || b.t.length - a.t.length || a.n.localeCompare(b.n));
  return authors.slice(0, MAX_AUTHORS);
}

export function readFaces() {
  try {
    return JSON.parse(fs.readFileSync(FACES_FILE, "utf8")).faces || {};
  } catch (error) {
    return {};
  }
}

function readCatalog(relative) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, relative), "utf8"));
  } catch (error) {
    return { series: [] };
  }
}

function coverage() {
  const catalog = readCatalog("data/catalog.json").series || [];
  const curated = readCatalog("data/curated_catalog.json").series || [];
  const open = readCatalog("data/open_catalog.json").series || [];
  const topic = readCatalog("data/topic_catalog.json");
  return catalog.concat(curated, open, topic.english || [], topic.chinese || []);
}

// 用作者播放量最高那条视频的详情换取头像，结果写回缓存；失败保留上一次的值。
async function refreshFaces() {
  const series = coverage();
  const byId = new Map(series.map((item) => [item.id, item]));
  const authors = authorsOf(series);
  const faces = readFaces();
  let added = 0;
  let index = 0;

  async function worker() {
    while (index < authors.length) {
      const author = authors[index];
      index += 1;
      if (faces[author.n] && faces[author.n].face) continue;
      const item = byId.get(author.t[0]);
      if (!item || !item.bvid) continue;
      const view = await viewOf(item.bvid);
      if (view && view.owner && view.owner.face) {
        faces[author.n] = {
          mid: view.owner.mid || "",
          face: view.owner.face,
        };
        added += 1;
      }
      await sleep(250);
    }
  }

  console.log("作者 " + authors.length + " 位，开始补齐头像…");
  await Promise.all([worker(), worker(), worker()]);
  const payload = { updatedAt: new Date().toISOString(), faces };
  fs.writeFileSync(FACES_FILE, JSON.stringify(payload, null, 2) + "\n", "utf8");
  console.log("头像缓存：" + Object.keys(faces).length + " 位（本次新增 " + added + "），输出 " + path.relative(ROOT, FACES_FILE));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  refreshFaces().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
