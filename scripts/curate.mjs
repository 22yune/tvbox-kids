#!/usr/bin/env node
// 名单驱动解析：curation.json 定义「要什么」，这里逐条找源。
// 顺序：pin（已验证 bvid）→ 上次结果 → 别名搜索 → 标记 missing。
import { choose, cookies, playable, resolved, sleep, viewOf } from "./bili.mjs";

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
      if (entry.pin) {
        const view = await viewOf(entry.pin);
        if (view && (await playable(view.bvid, view.pages[0].cid))) {
          series.push(resolved(entry, view));
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
        const item = { ...old, stale: true };
        for (const key of ["name", "ageMin", "ageMax", "paths", "stages", "tags", "order", "why", "list", "desc"]) {
          if (entry[key] !== undefined) item[key] = entry[key];
        }
        series.push(item);
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
