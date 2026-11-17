#!/usr/bin/env node
// 科普/自然与社会情感专题采集：按关键词在 B 站搜索，逐条校验可播放后写入 data/browse_catalog.json。
// 与 topics.mjs 的区别是这里不打分级标签，条目直接给内容分类打标（科学 / 情绪 / 安全），
// 供「B站学习-按内容」的科学探索、安全情绪两个分类使用；UP 主与播放量写进 desc 供作者页聚合。
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { searchVideos, viewOf, playable, cookies, strip, sleep } from "./bili.mjs";
import { BLOCK, cleanName, parseDuration, titleKey } from "./topics.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILE = path.join(ROOT, "data/browse_catalog.json");

function arg(name, fallback) {
  const index = process.argv.indexOf("--" + name);
  return index > -1 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const TARGET = Number(arg("target", 110));
const ONLY = arg("section", "");
const DELAY = Number(arg("delay", 400));
const CONCURRENCY = Number(arg("concurrency", 3));
const SEARCH_PAGES = Number(arg("pages", 2));

const SECTIONS = {
  science: {
    name: "科学科普",
    list: "B站精选",
    tagBase: "科学",
    why: "从动植物、自然现象到宇宙与动手实验，挑孩子看得懂、能长知识的科普动画和纪录片。",
    block: /考研|高考|中考|成人|恐怖|鬼片|游戏|带货|广告|排行榜|盘点|混剪|切片|解说|推荐|片单|榜单|影单|教授|专家|讲座|公开课|优质课|示范课|观摩|教学|老师|课堂|课程|访谈|育儿|家长|父母|心法|大学|评课|一等奖|学术|研究|犯罪|战争|求生|尸|肥胖|儿歌|童谣|音乐剧|歌曲|哄娃|早教动画|工程车|工程机械|挖掘机|翻斗车|搅拌车|起重机|推土机|装载机|收割机|消防车|儿童画|简笔画|画画|福尔摩斯|探案|穿越|绑定|系统|重生|修仙|赘婿|龙王|养龙|幼师|玩具|家庭秀|野孩子|狼人|养大|卡牌|抽到|盲盒|小小世界|Tiny World|微观小世界|Minuscule|假如我是一只动物|如果我是一只动物|平博士|Do You Know|DK儿童百科|小小人类星球|Little Human Planet|像乌鸦一样思考|富人|穷学生|混日子|异度空间|收养|小宇宙|字母操|自然拼读|音标|轮滑|很棒的实验/i,
    match: (title) =>
      /科普|科学|百科|知识|实验|为什么|自然|动物|植物|昆虫|海洋|海底|宇宙|太空|星球|行星|地球|恐龙|天气|火山|极地|雨林|沙漠|森林|人体|细菌|物理|化学|机械|工程|探险|发现|地理|天文|DK|BBC/i.test(title) &&
      /儿童|幼儿|宝宝|孩子|少儿|小朋友|亲子|启蒙|小学|低幼|动画片|童趣/i.test(title),
    levels: [
      {
        id: "L1",
        ageMin: 3,
        ageMax: 7,
        base: 210000,
        keywords: [
          "动物科普 儿童", "动物世界 儿童", "动物百科 儿童", "恐龙 儿童 科普", "恐龙世界 儿童",
          "海洋动物 儿童 科普", "海底世界 儿童", "野生动物 儿童", "昆虫 儿童 科普", "昆虫记 儿童",
          "植物 儿童 科普", "自然启蒙 儿童", "森林 儿童 科普", "鸟类 儿童 科普", "极地动物 儿童",
          "动物宝宝 儿童", "奇妙的动物 儿童", "动物纪录片 儿童", "自然纪录片 儿童", "大自然 儿童 科普",
          "动物 动画 科普", "恐龙百科 儿童", "海洋生物 儿童", "动物园 儿童 科普", "动物成长 儿童 科普",
        ],
      },
      {
        id: "L2",
        ageMin: 4,
        ageMax: 8,
        base: 211000,
        keywords: [
          "太阳系 儿童 科普", "宇宙 儿童 动画", "太空 儿童 科普", "地球 儿童 科普", "行星 儿童 动画",
          "月亮 儿童 科普", "火山 儿童 科普", "天气 儿童 科普", "四季 儿童 科普", "海洋 科普 儿童",
          "雨林 儿童 科普", "沙漠 儿童 科普", "地球 纪录片 儿童", "海洋 纪录片 儿童", "宇宙 纪录片 儿童",
          "星球 儿童 动画", "地震 儿童 科普", "河流 儿童 科普", "山脉 儿童 科普", "气候 儿童 动画",
          "太空 儿童 动画", "宇宙探索 儿童", "地球形成 儿童 科普", "海底 纪录片 儿童", "自然现象 儿童 科普",
        ],
      },
      {
        id: "L3",
        ageMin: 5,
        ageMax: 10,
        base: 212000,
        keywords: [
          "科学实验 儿童", "科学小实验 亲子", "亲子实验 儿童", "为什么 儿童 科普", "十万个为什么 动画",
          "生活中的科学 儿童", "物理 启蒙 儿童", "化学 启蒙 儿童", "机械 原理 动画", "DK儿童百科",
          "儿童百科 动画", "人体 儿童 科普", "细菌 儿童 科普", "光 儿童 科普", "声音 儿童 科普",
          "电 儿童 科普", "力和运动 儿童 科普", "浮力 实验 儿童", "水 科学实验 儿童", "空气 科学实验 儿童",
          "磁铁 科学实验 儿童", "科学小子 动画", "儿童科学 动画 合集", "发明 儿童 科普", "工程 儿童 动画",
        ],
      },
      {
        id: "L4",
        ageMin: 7,
        ageMax: 12,
        base: 213000,
        keywords: [
          "儿童科普纪录片", "儿童自然纪录片", "儿童动物纪录片", "儿童宇宙纪录片", "儿童海洋纪录片",
          "儿童地球纪录片", "儿童人体纪录片", "儿童植物纪录片", "儿童昆虫纪录片", "儿童鸟类纪录片",
          "儿童恐龙纪录片", "儿童科学纪录片", "少儿科普 纪录片", "给孩子的纪录片", "适合儿童 纪录片",
          "儿童纪录片 自然", "儿童纪录片 动物", "儿童纪录片 宇宙", "儿童纪录片 科学", "儿童纪录片 海洋",
          "儿童纪录片 地球", "儿童纪录片 人体", "儿童纪录片 植物", "小学生 纪录片", "孩子 纪录片",
        ],
      },
    ],
  },
  social: {
    name: "社会情感",
    list: "B站精选",
    tagBase: "情绪",
    why: "围绕认识自己、管理情绪、交朋友、守规则和认识社会整理，适合陪看后聊一聊。",
    block: /家长课|父母课堂|家庭教育|育儿知识|讲座|推荐|书单|绘本分享|书单推荐|开箱|测评|带货|广告|恋爱|婚姻|婆媳|分数|成绩|内向|自卑|标签|测试|星座|算命|恐怖|鬼片|教授|专家|公开课|优质课|示范课|观摩|教学|老师|课堂|课程|访谈|育儿|家长|父母|心法|大学|评课|一等奖|辅导|咨询|治疗|李玫瑾|正面管教|蒙氏|监护人|警示|引以为戒|宝妈宝爸|蹲点|医院|饭摊|摊主|数学|明日方舟|罗德岛|方舟|儿歌合集|儿歌串烧|儿歌连放|歌曲|本书|成年人|必读|病态|变态|心理病|吸血鬼|尖牙|Vampirina|社会活动|大班|中班|抽到|VMAX|卡牌|盲盒|皮亚杰|理论|精要解析|轮滑|速成/i,
    match: (title) =>
      /情绪|情商|心理|社交|交友|朋友|友谊|分享|合作|礼貌|礼仪|规则|习惯|品格|性格|勇敢|自信|诚实|责任|安全|自我保护|防拐|陌生人|交通|消防|职业|认知|成长|幼儿园|沟通|相处|挫折|勇气|爱心|感恩|尊重|包容|同理心/i.test(title) &&
      /儿童|幼儿|宝宝|孩子|少儿|亲子|小朋友|启蒙|动画|绘本|故事|小学|低幼|性格培养|情商/i.test(title),
    levels: [
      {
        id: "L1",
        ageMin: 2,
        ageMax: 7,
        base: 220000,
        paths: ["path-social", "path-health-emotion"],
        tags: ["情绪"],
        keywords: [
          "儿童情绪管理 动画", "幼儿情绪 动画", "宝宝情绪管理", "认识情绪 儿童动画", "情绪小怪兽 绘本",
          "儿童情绪认知", "儿童情商 动画", "情商启蒙 动画", "幼儿心理 动画", "情绪表达 儿童",
          "我不生气 儿童 动画", "害怕 儿童 动画", "幼儿情绪绘本 动画", "儿童心理 绘本 动画", "接纳自己 绘本 动画",
          "我喜欢我自己 绘本", "勇敢做自己 绘本 动画", "幼儿情绪管理 绘本", "宝宝情绪 绘本", "儿童情绪管理 绘本",
          "情绪管理 儿童 故事", "儿童性格培养 动画", "我不哭 儿童 动画", "儿童情绪 动画 合集", "宝宝心理 动画",
        ],
      },
      {
        id: "L2",
        ageMin: 3,
        ageMax: 8,
        base: 221000,
        paths: ["path-social"],
        tags: ["情绪"],
        keywords: [
          "儿童社交 动画", "幼儿社交 动画", "交朋友 儿童 动画", "分享 儿童 动画", "友谊 动画 儿童",
          "合作 儿童 动画", "礼貌 儿童 动画", "儿童礼仪 动画", "幼儿园 社交 动画", "同伴交往 绘本 动画",
          "学会分享 儿童", "儿童社交启蒙", "好朋友 动画 儿童", "社交能力 儿童 动画", "儿童沟通 动画",
          "轮流 排队 儿童 动画", "谢谢 对不起 儿童 动画", "儿童友好相处", "小朋友 交朋友 动画", "儿童共情 动画",
          "儿童社交 故事", "幼儿友谊 绘本 动画", "儿童合作 绘本 动画", "儿童分享 绘本 动画", "儿童社交 合集",
        ],
      },
      {
        id: "L3",
        ageMin: 4,
        ageMax: 9,
        base: 222000,
        paths: ["path-social"],
        tags: ["安全"],
        keywords: [
          "规则意识 儿童", "儿童规则 动画", "好习惯 儿童 动画", "品格 儿童 动画", "安全教育 动画 儿童",
          "自我保护 儿童 动画", "防拐 儿童 动画", "交通安全 儿童 动画", "消防安全 儿童 动画", "陌生人 儿童 安全",
          "儿童安全 动画 合集", "幼儿安全教育", "儿童安全教育 动画", "居家安全 儿童 动画", "用电安全 儿童 动画",
          "溺水 安全 儿童 动画", "地震 安全 儿童 动画", "走丢了 儿童 动画", "诚实 儿童 绘本 动画", "勇敢 儿童 绘本 动画",
          "责任 儿童 动画", "儿童好习惯 动画", "儿童规则 绘本", "儿童品格 动画 合集", "幼儿自我保护 动画",
        ],
      },
      {
        id: "L4",
        ageMin: 6,
        ageMax: 12,
        base: 223000,
        paths: ["path-social"],
        tags: ["情绪"],
        keywords: [
          "职业启蒙 儿童", "认识职业 儿童 动画", "儿童职业体验 动画", "各行各业 儿童", "社会认知 儿童",
          "社区 儿童 认知", "儿童社会 动画", "小小职业 儿童 动画", "职业 科普 儿童", "儿童情商 合集",
          "儿童情绪管理 小学", "小学生 情绪管理", "儿童社交 情商", "儿童成长 动画 合集", "儿童心理 动画 合集",
          "挫折 教育 儿童 动画", "儿童勇气 绘本 动画", "感恩 儿童 动画", "尊重 儿童 动画", "包容 儿童 动画",
          "儿童同理心 动画", "认识社会 儿童 动画", "儿童财商 动画", "儿童时间管理 动画", "儿童自理 动画",
        ],
      },
    ],
  },
};

// topics 的 BLOCK 为了让英语/语文专题避开纪录片，把「纪录片/电影」也拦掉了；
// 科普的纪录片子类要放回来，这里先把这两个词去掉再判。
function blocked(title, section) {
  const text = /^science$/.test(section.id) ? title.replace(/纪录片|记录片|电影/g, "") : title;
  return BLOCK.test(text);
}

async function loadExisting(extra = []) {
  const bvids = new Set();
  const names = new Set();
  for (const item of extra) {
    if (!item || typeof item !== "object") continue;
    if (item.bvid) bvids.add(item.bvid);
    const key = titleKey(item.name || "");
    if (key) names.add(key);
  }
  for (const relative of ["data/catalog.json", "data/curated_catalog.json", "data/open_catalog.json", "data/topic_catalog.json"]) {
    try {
      const data = JSON.parse(await fs.readFile(path.join(ROOT, relative), "utf8"));
      const items = Array.isArray(data.series) ? data.series : (data.english || []).concat(data.chinese || []);
      for (const item of items) {
        if (item.bvid) bvids.add(item.bvid);
        const key = titleKey(item.name || "");
        if (key) names.add(key);
      }
    } catch (error) {
      // 缺文件时照常跑。
    }
  }
  return { bvids, names };
}

async function collect(section, jar, skip) {
  const cache = path.join(ROOT, "data/.browse-candidates." + section.id + ".json");
  try {
    const saved = JSON.parse(await fs.readFile(cache, "utf8"));
    if (Array.isArray(saved) && saved.length) {
      console.log("\n" + section.name + "：沿用搜索缓存 " + saved.length + " 条");
      return saved.map((item) => ({ ...item, level: section.levels.find((level) => level.id === item.levelId) || section.levels[0] }));
    }
  } catch (error) {
    // 没有缓存时重新搜索。
  }
  const seen = new Map();
  const keys = new Set(skip.names);
  let searched = 0;
  for (const level of section.levels) {
    for (const keyword of level.keywords) {
      searched += 1;
      for (let page = 1; page <= SEARCH_PAGES; page += 1) {
        let results = [];
        try {
          results = await searchVideos(keyword, jar, page);
        } catch (error) {
          console.warn("\n[search] " + keyword + " 第 " + page + " 页失败：" + ((error && error.message) || error));
          await sleep(1500);
          break;
        }
        for (const raw of results) {
          const bvid = String((raw && raw.bvid) || "");
          if (!bvid || seen.has(bvid) || skip.bvids.has(bvid)) continue;
          const title = cleanName(raw.title);
          if (!title || blocked(title, section) || section.block.test(title) || !section.match(title)) continue;
          const duration = parseDuration(raw.duration);
          if (duration < 45 || duration > 6 * 3600) continue;
          const play = Number(raw.play) || 0;
          if (play < 2000) continue;
          const key = titleKey(title);
          if (!key || keys.has(key)) continue;
          keys.add(key);
          seen.set(bvid, {
            bvid,
            title,
            pic: String(raw.pic || "").replace(/^http:/, "https:"),
            play,
            author: strip(raw.author),
            level,
            keyword,
          });
        }
        process.stdout.write(".");
        await sleep(DELAY);
        if (results.length < 15) break;
      }
    }
  }
  console.log("\n" + section.name + "：搜索 " + searched + " 个关键词，候选 " + seen.size + " 条");
  const candidates = [...seen.values()];
  await fs.writeFile(cache, JSON.stringify(candidates.map((item) => ({ ...item, levelId: item.level.id })), null, 2) + "\n");
  return candidates;
}

function interleave(candidates, levels) {
  const groups = new Map(levels.map((level) => [level.id, []]));
  for (const item of candidates) {
    const list = groups.get(item.level.id);
    if (list) list.push(item);
  }
  for (const list of groups.values()) list.sort((a, b) => b.play - a.play);
  const queue = [];
  let index = 0;
  while (true) {
    let pushed = false;
    for (const level of levels) {
      const list = groups.get(level.id);
      if (index < list.length) {
        queue.push(list[index]);
        pushed = true;
      }
    }
    if (!pushed) break;
    index += 1;
  }
  return queue;
}

async function build(key, section, previous, save) {
  const jar = cookies();
  // 同一视频只能落在一个分类里：把另一个分类已经收下的条目也当作已存在。
  const taken = Object.entries(previous)
    .filter(([name, value]) => name !== key && Array.isArray(value))
    .flatMap(([, value]) => value);
  const skip = await loadExisting(taken);
  const takenBvids = new Set(taken.map((item) => item.bvid).filter(Boolean));
  const accepted = ((previous && previous[key]) || []).filter((item) => !takenBvids.has(item.bvid));
  const acceptedNames = new Set(accepted.map((item) => titleKey(item.name)));
  for (const item of accepted) if (item.bvid) skip.bvids.add(item.bvid);

  if (accepted.length >= TARGET) {
    console.log(section.name + "：已有 " + accepted.length + " 条，达到目标不再采集");
    return accepted;
  }

  const candidates = await collect(section, jar, skip);
  const queue = interleave(candidates, section.levels);
  const state = { tried: 0, added: 0 };
  const maxTries = (TARGET - accepted.length) * 4;

  async function take(item) {
    if (accepted.length >= TARGET || state.tried >= maxTries) return;
    state.tried += 1;
    const level = item.level;
    const view = await viewOf(item.bvid);
    if (!view || !view.pages.length) return;
    const pages = Math.min(100, view.pages.length);
    const duration = view.pages.reduce((sum, page) => sum + (Number(page.duration) || 0), 0);
    // 单集太短、或者只有一两个 P 又不到 10 分钟，多半是片段而不是成体系的合集。
    if (pages === 1 && duration < 300) return;
    if (pages < 3 && duration < 600) return;
    if (pages === 1 && duration > 6 * 3600) return;
    if (!(await playable(view.bvid, view.pages[0].cid))) return;
    const name = cleanName(view.title) || item.title;
    if (blocked(name, section) || section.block.test(name) || !section.match(name)) return;
    const nameKey = titleKey(name);
    if (!nameKey || acceptedNames.has(nameKey)) return;
    acceptedNames.add(nameKey);
    state.added += 1;
    const latest = pages > 1
      ? pages + "集"
      : duration >= 3600 ? Math.round(duration / 3600) + "小时" : Math.max(1, Math.round(duration / 60)) + "分钟";
    // 如厕、穿衣这类生活自理内容即使被高层级关键词命中，年龄也按低幼算。
    let ageMin = level.ageMin;
    let ageMax = level.ageMax;
    if (/上厕所|穿衣服|自理|自己穿|刷牙|洗手|自主进食/.test(name)) {
      ageMin = 2;
      ageMax = 5;
    }
    accepted.push({
      id: "bs-" + item.bvid.toLowerCase(),
      name,
      source: "bili",
      bvid: item.bvid,
      biliTitle: view.title,
      pic: view.pic || item.pic,
      episodes: pages,
      latest,
      latestTime: view.pubdate || 0,
      count: pages,
      stale: false,
      ageMin,
      ageMax,
      paths: level.paths || ["path-science"],
      tags: level.tags || [section.tagBase],
      order: level.base + state.added,
      why: section.why,
      list: [section.list],
      desc: "UP 主：" + cleanName(item.author || "") + "；播放 " + item.play + "；关键词「" + item.keyword + "」。",
    });
    await save();
    process.stdout.write("+");
  }

  const worker = async () => {
    while (accepted.length < TARGET && state.tried < maxTries) {
      const item = queue.shift();
      if (!item) return;
      await take(item).catch((error) => console.warn("\n[verify] " + item.title + "：" + ((error && error.message) || error)));
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  accepted.sort((a, b) => a.order - b.order);
  console.log("\n" + section.name + "：校验通过 " + accepted.length + " 条（本次新增 " + state.added + "，尝试 " + state.tried + " 条）");
  return accepted;
}

async function main() {
  let previous = {};
  try {
    previous = JSON.parse(await fs.readFile(FILE, "utf8"));
  } catch (error) {
    previous = {};
  }

  const output = { updatedAt: new Date().toISOString(), source: "browse", science: [], social: [], ...previous };
  output.updatedAt = new Date().toISOString();
  output.source = "browse";

  // 串行落盘：并发校验时多次保存不会互相覆盖。
  let saving = Promise.resolve();
  const save = () => {
    saving = saving.then(() => fs.writeFile(FILE, JSON.stringify(output, null, 2) + "\n")).catch(() => {});
    return saving;
  };

  for (const key of Object.keys(SECTIONS)) {
    if (ONLY && ONLY !== key) continue;
    const section = { ...SECTIONS[key], id: key };
    console.log("开始采集：" + section.name);
    output[key] = await build(key, section, output, save);
    await save();
  }

  await save();
  console.log("写入 data/browse_catalog.json：" + Object.keys(SECTIONS).map((key) => SECTIONS[key].name + " " + (output[key] || []).length).join(" / "));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
