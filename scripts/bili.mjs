#!/usr/bin/env node
// 哔哩哔哩目录同步：按关键词搜一次，固定 bvid / 封面 / 集数。
// 搜索接口需要 buvid3 + b_nut Cookie（本地生成即可），view/playurl 匿名可用。
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const SEARCH_API = "https://api.bilibili.com/x/web-interface/search/type";
const SEARCH_ALL_API = "https://api.bilibili.com/x/web-interface/search/all/v2";
const VIEW_API = "https://api.bilibili.com/x/web-interface/view";
const PLAY_API = "https://api.bilibili.com/x/player/playurl";
const REFERER = "https://www.bilibili.com/";
const SEARCH_REFERER = "https://search.bilibili.com/";
const MAX_PAGES = 100;

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function hex() {
  return Math.floor(Math.random() * 16).toString(16).toUpperCase();
}

function segment(length) {
  return Array.from({ length }, hex).join("");
}

export function cookies() {
  const buvid = [segment(8), segment(4), segment(4), segment(4), segment(12)].join("-") + "infoc";
  return "buvid3=" + buvid + "; b_nut=" + Math.floor(Date.now() / 1000);
}

async function request(url, referer, jar, tries = 3) {
  let last;
  for (let attempt = 1; attempt <= tries; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": UA,
          "Referer": referer,
          "Accept": "application/json, text/plain, */*",
          "Cookie": jar,
        },
        signal: AbortSignal.timeout(15000),
      });
      const data = await response.json();
      if (data.code === 0) return data;
      last = new Error("B站接口 " + data.code + "：" + (data.message || "未知错误"));
      if (data.code === -412 || data.code === -352) {
        jar = cookies();
        await sleep(1200 * attempt);
        continue;
      }
      break;
    } catch (error) {
      last = error;
      await sleep(800 * attempt);
    }
  }
  throw last;
}

export function strip(value) {
  return String(value || "").replace(/<[^>]+>/g, "").replace(/&quot;/g, "\"");
}

export async function search(keyword, jar, page = 1) {
  const url = SEARCH_API + "?search_type=video&keyword=" + encodeURIComponent(keyword) + "&page=" + page + "&page_size=20";
  const data = await request(url, SEARCH_REFERER, jar);
  return (data.data && data.data.result) || [];
}

// search/type 被限流时改用聚合搜索接口，返回结构里的 video 分组同样带 bvid/时长/播放量。
export async function searchVideos(keyword, jar, page = 1) {
  const url = SEARCH_ALL_API + "?keyword=" + encodeURIComponent(keyword) + "&page=" + page;
  const data = await request(url, SEARCH_REFERER, jar);
  const groups = (data.data && data.data.result) || [];
  const group = groups.find((item) => item.result_type === "video");
  return (group && group.data) || [];
}

export async function viewOf(bvid) {
  try {
    const data = await request(VIEW_API + "?bvid=" + encodeURIComponent(bvid), REFERER, cookies());
    const view = data.data;
    if (!view || !Array.isArray(view.pages) || view.pages.length === 0) return null;
    return {
      bvid,
      title: strip(view.title),
      pic: String(view.pic || "").replace(/^http:/, "https:"),
      pubdate: Number(view.pubdate) || 0,
      pages: view.pages,
    };
  } catch (error) {
    return null;
  }
}

export async function playable(bvid, cid) {
  const url = PLAY_API + "?bvid=" + encodeURIComponent(bvid) + "&cid=" + encodeURIComponent(cid) +
    "&qn=64&fnval=1&fnver=0&fourk=0";
  try {
    const data = await request(url, REFERER, cookies());
    const durl = (data.data && data.data.durl) || [];
    return durl.length > 0 && Boolean(durl[0].url);
  } catch (error) {
    return false;
  }
}

function matches(entry, title) {
  if (!Array.isArray(entry.pick) || entry.pick.length === 0) return true;
  return entry.pick.every((word) => title.includes(word));
}

function blocked(entry, title) {
  if (/直播回放|预告|花絮|解说|reaction|切片|盘点|混剪|歌曲合集|广告|游戏|剧情|OST|原声/i.test(title)) return true;
  return (entry.exclude || []).some((word) => title.includes(word));
}

// 按别名依次搜索，命中一个合格合集就停。
export async function choose(entry, jar) {
  for (const alias of entry.aliases || []) {
    const view = await chooseOne(entry, alias, jar);
    if (view) return view;
  }
  return null;
}

async function chooseOne(entry, alias, jar) {
  const minPages = Number.isFinite(entry.minPages) ? entry.minPages : 5;
  const results = (await search(alias, jar)).filter((video) => video && video.bvid);
  const candidates = results
    .map((video) => ({ ...video, cleanTitle: strip(video.title) }))
    .filter((video) => matches(entry, video.cleanTitle) && !blocked(entry, video.cleanTitle))
    .sort((a, b) => (Number(b.play) || 0) - (Number(a.play) || 0))
    .slice(0, 6);

  const views = [];
  for (const candidate of candidates) {
    const view = await viewOf(candidate.bvid);
    if (!view) continue;
    if (!matches(entry, view.title)) continue;
    // 站上很多整季被压成一个长视频，单 P 但时长够也算合格。
    const longSingle = view.pages.length === 1 && (Number(view.pages[0].duration) || 0) >= 1200;
    if (view.pages.length < minPages && !longSingle) continue;
    views.push({ view, play: Number(candidate.play) || 0 });
  }
  views.sort((a, b) => Math.min(b.view.pages.length, 60) - Math.min(a.view.pages.length, 60) || b.play - a.play);

  for (const item of views.slice(0, 2)) {
    if (await playable(item.view.bvid, item.view.pages[0].cid)) return item.view;
  }
  return null;
}

// 只保留播放需要的字段：名单里的 pin/aliases/pick/exclude 是同步期用的，不进 jar。
export function resolved(entry, view) {
  const episodes = Math.min(MAX_PAGES, view.pages.length);
  return {
    id: entry.id,
    name: entry.name,
    source: "bili",
    bvid: view.bvid,
    biliTitle: view.title,
    pic: view.pic,
    episodes,
    latest: episodes + "集",
    latestTime: view.pubdate,
    count: episodes,
    stale: false,
    ageMin: entry.ageMin,
    ageMax: entry.ageMax,
    paths: entry.paths,
    stages: entry.stages,
    tags: entry.tags,
    order: entry.order,
    why: entry.why,
    list: entry.list,
    desc: entry.desc,
  };
}
