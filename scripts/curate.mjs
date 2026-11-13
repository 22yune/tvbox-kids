#!/usr/bin/env node
// 名单驱动解析：curation.json 定义「要什么」，这里逐条找源。
// 顺序：pin（已验证 bvid）→ 上次结果 → 别名搜索 → 标记 missing。
import { choose, cookies, resolved, sleep, viewOf } from "./bili.mjs";

const META = ["name", "ageMin", "ageMax", "paths", "stages", "tags", "order", "why", "list", "desc"];

function reuse(entry, old) {
  const item = { ...old };
  for (const key of META) {
    if (entry[key] !== undefined) item[key] = entry[key];
  }
  return item;
}

export async function resolveCuration(entries, previous) {
  const previousById = new Map((previous || []).map((item) => [item.id, item]));
  const jar = cookies();
  const series = [];
  const missing = [];

  for (const entry of entries) {
    if (!Array.isArray(entry.aliases) || entry.aliases.length === 0) {
      missing.push({ id: entry.id, name: entry.name, reason: "名单缺少搜索别名" });
      process.stdout.write("x");
      continue;
    }
    if (entry.skip) {
      missing.push({ id: entry.id, name: entry.name, reason: entry.skip });
      process.stdout.write("-");
      continue;
    }
    const old = previousById.get(entry.id);
    try {
      // pin 是人工核对过的源，只看视频是否还在，不再探播放地址：
      // CI 在海外节点常常拿不到 playurl，按播放探测会误判成失效并换成错的视频。
      if (entry.pin) {
        const view = await viewOf(entry.pin);
        if (view) {
          series.push(resolved(entry, view));
          process.stdout.write("=");
          continue;
        }
        // 部分正版内容对海外 IP 返回 404，看不到详情不等于视频没了
        if (old && old.bvid === entry.pin) {
          series.push(reuse(entry, old));
          process.stdout.write("=");
          continue;
        }
      }
      if (old && old.bvid) {
        const view = await viewOf(old.bvid);
        if (view) {
          series.push({ ...resolved(entry, view), stale: Boolean(old.stale) });
          process.stdout.write(".");
          continue;
        }
      }
      const view = await choose(entry, jar);
      if (!view) throw new Error("搜索不到合适的视频");
      series.push(resolved(entry, view));
      process.stdout.write("+");
      await sleep(250);
    } catch (error) {
      if (old && old.bvid) {
        // 复用上一次的 bvid 和集数，但元数据以名单为准。
        series.push({ ...reuse(entry, old), stale: true });
        process.stdout.write("x");
        console.warn("\n[stale] " + entry.name + "：" + String((error && error.message) || error));
      } else {
        missing.push({ id: entry.id, name: entry.name, reason: String((error && error.message) || error) });
        process.stdout.write("x");
        console.warn("\n[missing] " + entry.name + "：" + String((error && error.message) || error));
      }
    }
  }

  process.stdout.write("\n");
  return { series, missing };
}
