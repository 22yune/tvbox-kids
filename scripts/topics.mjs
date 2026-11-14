#!/usr/bin/env node
// 专题采集：按分级关键词在 B 站搜索，逐条校验可播放后写入 data/topic_catalog.json。
// 每个专题分 L1-L4 四级，条目带「英语L1」/「语文L1」这类标签，Kids 专题页按 order 顺序展示。
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { searchVideos, viewOf, playable, cookies, strip, sleep } from "./bili.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILE = path.join(ROOT, "data/topic_catalog.json");

function arg(name, fallback) {
  const index = process.argv.indexOf("--" + name);
  return index > -1 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const TARGET = Number(arg("target", 620));
const ONLY = arg("topic", "");
const DELAY = Number(arg("delay", 400));
const CONCURRENCY = Number(arg("concurrency", 3));
const SEARCH_PAGES = Number(arg("pages", 2));
const START_PAGE = Number(arg("start-page", 1));

const BLOCK = /直播|回放|预告|花絮|解说|reaction|切片|盘点|混剪|剪辑|群像|高燃|燃向|踩点|鬼畜|沙雕|搞笑|挑战|憋笑|整活|吐槽|段子|广告|带货|游戏|成人|恐怖|鬼片|恋爱|相亲|考研|雅思|托福|四六级|四级|六级|专升本|公务员|教资|教师资格|招聘|招生|培训机构|网课|课程表|课件|教案|试卷|真题|答案|搬运|侵权|家长必看|老师必看|测评|开箱|试看|抢先|抖音|神曲|情歌|伤感情歌|失恋|单曲循环|高音质|无损|BGM|高考|中考|高中|必修|选修|人教版|押题|考点|提分|捞分|上分|满分|冲刺|一轮复习|二轮复习|应试|期末考试|期末上分|歌单|PLAYLIST|playlist|化妆|霉霉|万能模板|万能公式|童年阴影|模拟恐惧|黑暗的真相|脑腐|克苏鲁|历史书太小|背上下五千年|落笔即封神|惊魂未定|下饭|meme|猫meme|世界各地的神话|Ted-ED|TED-Ed|学霸|高分作文|答题方法|答题技巧|选择题|论述类|实用类|信息类|推歌|单曲收集|欧美顶流|经典英文歌|百听不厌|一生必听|纯享版|前奏秒杀|氛围混响|耳机|𝗣𝗹𝗮𝘆𝗹𝗶𝘀𝘁|Taylor Swift|Justin Bieber|贾斯汀比伯|英文歌女王|适合跟唱|英文歌教唱|动画MV|动漫MV|声乐MV|MV合集|小少焱|驱魔|鬼车|民间怪谈|怪谈|灵异|禁忌|淘汰赛|单挑作业|文化糟粕|糟粕|小苹果|初中英语总复习|一周速通|音标|语法|背单词|记单词|词汇量|口语课|英语口语|新概念|KET|四六级|考研|雅思|托福|纪录片|电影|美剧|剧集|配音|演讲|辩论|播客|TED|书法|毛笔|硬笔|道教|黑神话|助眠|棺材|妖王|阴谋|批判|人民日报|微短剧|相声|苗阜|口才|普通话|废除汉字|排行榜|八仙过海|狗吐人言|越来越没存在感|拼音教学|老师怎么教|重难点/i;

const TOPICS = {
  english: {
    name: "英语学习",
    prefix: "en",
    tag: "英语",
    list: "专题·英语学习",
    paths: ["path-language"],
    why: "按启蒙儿歌 → 自然拼读 → 分级阅读 → 听力进阶的顺序整理，适合每天磨耳朵。",
    block: /语文|识字|拼音|汉字|文言文|唐诗|宋词|成语|三字经|弟子规|国学|高考|中考|高中|必修|四级|六级/,
    match: (title) =>
      /英语|英文|双语|中英|English|english|phonics|Phonics|Peppa|peppa|RAZ|raz|ABC|abc|SSS|super simple|cocomelon|单词|拼读|sight words|牛津树|海尼曼|字母歌/i.test(title) &&
      /儿歌|童谣|儿童|宝宝|幼儿|低幼|亲子|早教|启蒙|绘本|童话|动画|分级|拼读|字母|ABC|abc|磨耳朵|佩奇|Peppa|peppa|JOJO|super simple|SSS|cocomelon|巴塔木|碰碰狐|贝瓦|朵拉|托马斯|考拉|猜猜我有多爱你|单词|双语|中英|科普/i.test(title),
    levels: [
      {
        id: "L1",
        ageMin: 0,
        ageMax: 4,
        base: 110000,
        target: 265,
        keywords: [
          "英文儿歌", "英语儿歌", "英文儿歌 磨耳朵", "英语磨耳朵", "磨耳朵 英文", "英文童谣",
          "英语童谣", "字母歌", "ABC song", "英文启蒙儿歌", "宝宝英语启蒙", "英文颜色歌",
          "英文数字歌", "英文动物歌", "super simple songs", "cocomelon 英文", "碰碰狐 英文", "巴塔木 英文",
          "贝乐虎 英文儿歌", "宝宝巴士 英文儿歌", "小猪佩奇 双语", "小猪佩奇 英文版", "小猪佩奇 英文 磨耳朵", "粉红猪小妹 英文",
          "英文绘本 朗读", "好饿的毛毛虫 英文", "棕熊 英文绘本", "大卫不可以 英文", "猜猜我有多爱你 英文", "三只小猪 英文",
          "小红帽 英文", "英文童话 幼儿", "英文摇篮曲", "英文韵律儿歌", "鹅妈妈童谣", "英文身体歌",
          "英文水果歌", "英文形状歌", "英文天气歌", "英文礼貌用语", "英文手指谣", "宝宝学英语",
          "幼儿英语", "英文单词 儿歌", "英文睡前故事", "睡前英文儿歌", "幼儿英文动画", "小老鼠波波 英文",
          "小鼠波波 英文", "卡由 英文", "蓝色小考拉 英文", "汪汪队 英文", "爱探险的朵拉 英文", "花园宝宝 英文",
          "托马斯 英文", "英文歌 合集 儿童", "英文儿歌 100首", "英语启蒙 100首", "英文慢速儿歌", "英文数数歌",
          "Super Simple Songs 合集", "鹅妈妈童谣 动画", "英文儿歌 动画 合集", "英文手指谣 动画", "小猪佩奇 英文 儿歌", "宝宝巴士 英文 动画",
          "碰碰狐 英文 儿歌", "巴塔木 儿歌 动画", "英文数字歌 动画", "英文颜色歌 动画", "英文形状 儿歌", "ABC字母歌 动画",
          "英语启蒙 儿歌 合集", "英文童谣 合集", "低幼 英语 动画", "英文水果歌 动画", "英文动物歌 动画", "英文身体歌 动画",
        ],
      },
      {
        id: "L2",
        ageMin: 3,
        ageMax: 6,
        base: 120000,
        target: 265,
        keywords: [
          "自然拼读", "自然拼读 全套", "phonics 儿童", "拼读儿歌", "sight words", "高频词 英语",
          "分级阅读 英语", "英语分级阅读", "RAZ 分级", "海尼曼", "海尼曼GK", "牛津树",
          "牛津树 1-3", "培生英语", "兰登分级", "廖彩杏", "吴敏兰", "英语启蒙动画",
          "英语动画片 儿童", "小猪佩奇 英文 全集", "小猪佩奇 英文版 第一季", "蓝色小考拉 全集", "卡由 全集", "小鼠波波 全集",
          "爱探险的朵拉 英文 全集", "数字积木", "字母积木", "单词世界", "英语单词动画", "日常英语 幼儿",
          "英文食物 单词", "英文动物 单词", "英语律动儿歌", "英语课堂 儿歌", "英文绘本 动画", "英文绘本 讲解",
          "英文故事 动画", "英语启蒙 合集", "英语启蒙 全套", "幼儿英语 动画", "英文分级 绘本", "英文儿歌 舞蹈",
          "Jolly Phonics", "牛津自然拼读", "Alphablocks", "Numberblocks", "字母积木 英文", "数字积木 英文",
          "自然拼读 动画 合集", "phonics song", "sight words 动画", "英文绘本 动画 合集", "海尼曼 动画", "牛津树 动画",
          "RAZ 动画", "英文分级 动画", "英文单词 动画 儿童", "英文对话 动画 幼儿",
        ],
      },
      {
        id: "L3",
        ageMin: 6,
        ageMax: 9,
        base: 130000,
        target: 265,
        keywords: [
          "英语动画 中英字幕", "英文动画片 全集", "英文动画 电影 儿童", "神奇校车 英文", "神奇校车 中英", "神奇树屋",
          "疯狂学校", "老鼠记者", "内裤队长", "小屁孩日记 英文", "英文绘本 朗读 合集", "英文童话故事",
          "伊索寓言 英文", "安徒生童话 英语", "小学英语 对话", "小学英语 启蒙", "牛津树 4-6", "牛津树 7-9",
          "海尼曼 G1", "自然拼读 全套 动画", "英语拼读 动画", "BBC 儿童 英语", "BBC 英语动画", "英文科普 儿童",
          "英文百科 儿童", "英文故事 听力", "英语听力 儿童", "英语听说 儿童", "英语单词 动画", "英文阅读理解 入门",
          "儿童英语 动画 全集", "英文绘本 100本", "英语故事 睡前", "英文儿歌 小学", "英语动画 启蒙 合集", "卡由 英文 动画",
          "小鼠波波 英文 动画", "蓝色小考拉 英文 全集", "小猪佩奇 英文版 全集", "托马斯 英文版 全集", "朵拉 英文版 全集", "小公主苏菲亚 英文",
          "神奇校车 英文 动画", "英文科普 动画 儿童", "英文童话 动画 合集", "伊索寓言 英文 动画",
        ],
      },
      {
        id: "L4",
        ageMin: 9,
        ageMax: 12,
        base: 140000,
        target: 265,
        keywords: [
          "哈利波特 英文", "夏洛的网 英文", "神奇树屋 英文 朗读", "牛津树 10-12", "英语朗读 儿童", "英文科普 纪录片 儿童",
          "BBC 儿童 科普 英文", "英文名著 动画", "英文章节书 朗读", "英文故事 朗读 合集", "英文诗歌 儿童", "英文数学 动画 儿童",
          "英文科学 动画 儿童", "英文历史 故事 儿童", "英文自然 纪录片 儿童", "英文动物 科普 儿童", "英文宇宙 科普 儿童",          "英文科普 动画 合集", "英文地理 儿童", "英文天文 儿童", "英文人体 科普 儿童", "英文植物 科普 儿童", "英文工程 动画 儿童", "英文数学 启蒙 动画", "英文科学实验 儿童", "英文历史 人物 儿童", "英文名人 故事 儿童", "英文名著 故事 动画", "英文童话 长篇 朗读", "英文睡前 故事 合集", "英文分级 章节书", "英文绘本 高阶 朗读", "英文绕口令 儿童", "英文谜语 儿童", "英文动画 短片 合集", "英文寓言 动画 合集", "英文儿歌 小学",
        ],
      },
    ],
  },
  chinese: {
    name: "语文素养",
    prefix: "cn",
    tag: "语文",
    list: "专题·语文素养",
    paths: ["path-language", "path-humanities"],
    why: "从识字拼音、国学启蒙到古诗文与名著阅读，按年龄循序渐进。",
    block: /英语|英文|English|日语|韩语|埃及|希腊神话|北欧神话|罗马神话|印度神话|高考|中考|高中|必修|选修|人教版/,
    match: (title) =>
      /语文|识字|认字|汉字|拼音|古诗|唐诗|宋词|诗词|文言文|古文|成语|国学|三字经|弟子规|百家姓|千字文|声律启蒙|笠翁对韵|论语|孟子|诗经|史记|世说新语|资治通鉴|古文观止|名著|西游记|三国|水浒|红楼|朝花夕拾|骆驼祥子|城南旧事|草房子|作文|写话|阅读理解|课文|神话|山海经|上下五千年|中国史|中国历史|文学|书法|标点|近义词|反义词|病句|修辞|幼学琼林|增广贤文|二十四节气|十二生肖|传统节日|民间故事|寓言|童谣|儿歌|绘本|朗诵|吟诵|听写|名句|百家讲坛|中国通史|春秋战国|历史故事|国学启蒙|识字启蒙/i.test(title),
    levels: [
      {
        id: "L1",
        ageMin: 0,
        ageMax: 4,
        base: 110000,
        target: 265,
        keywords: [
          "三字经", "三字经 儿歌", "三字经 全文", "弟子规", "弟子规 儿歌", "百家姓",
          "千字文", "声律启蒙", "声律启蒙 儿歌", "笠翁对韵", "唐诗 儿歌", "古诗 儿歌",
          "唐诗三百首 儿童", "唐诗 启蒙", "国学启蒙", "国学 儿歌", "识字儿歌", "汉字 启蒙",
          "拼音 儿歌", "拼音 启蒙", "汉语拼音", "中文儿歌", "童谣 中文", "传统童谣",
          "绘本故事 中文", "睡前故事 中文", "睡前故事 儿童", "成语故事 幼儿", "中华传统故事", "二十四节气 儿童",
          "十二生肖 故事", "中国节日 故事", "神话故事 幼儿", "寓言故事 幼儿", "民间故事 幼儿", "中文绘本 朗读",
          "宝宝识字", "幼儿识字", "幼儿拼音", "学拼音", "认字 动画", "汉字 动画 幼儿",
          "古诗 动画 幼儿", "国学 动画", "三字经 动画", "弟子规 动画", "幼儿古诗", "儿童诗",
          "国学 儿歌 合集", "古诗 儿歌 动画", "声律启蒙 动画", "笠翁对韵 儿歌", "千字文 儿歌", "百家姓 儿歌",
          "成语 儿歌", "二十四节气 动画", "十二生肖 儿歌 动画", "弟子规 动画 全集",
        ],
      },
      {
        id: "L2",
        ageMin: 3,
        ageMax: 6,
        base: 120000,
        target: 265,
        keywords: [
          "识字", "识字 动画", "识字 启蒙", "看图识字", "四五快读", "学前识字",
          "幼小衔接 识字", "拼音 拼读", "拼音 全套", "汉语拼音 全套", "拼音 书写", "拼音 动画",
          "汉字 故事", "汉字 演变", "汉字 动画 全集", "三字经 讲解", "弟子规 讲解", "声律启蒙 讲解",
          "古诗 启蒙 动画", "唐诗 动画", "唐诗 讲解 儿童", "宋词 儿童", "成语故事", "成语故事 动画",
          "成语 大全 儿童", "寓言故事", "神话故事", "中国神话 儿童", "民间故事", "十二生肖 动画",
          "中国节日 动画", "绘本 朗读", "中文分级阅读", "分级阅读 中文", "中文绘本 动画", "小学语文 预习",
          "课文 朗读 一年级", "课文 朗读 二年级", "看图说话", "语言表达 儿童", "故事 睡前 合集", "国学 动画 全集",
          "汉字 认读", "儿歌 古诗", "幼儿国学", "识字 动画 合集", "拼音 动画 合集", "汉字 动画 合集",
          "绘本 动画 合集", "成语 动画 合集", "寓言 动画 合集", "神话 动画 儿童", "传统节日 动画", "中文分级 动画",
          "看图说话 动画",
        ],
      },
      {
        id: "L3",
        ageMin: 6,
        ageMax: 9,
        base: 130000,
        target: 265,
        keywords: [
          "小学语文", "小学语文 课文", "课文 朗读", "课文 讲解", "唐诗 讲解", "唐诗 鉴赏 儿童",
          "古诗 75首", "小学生必背古诗", "古诗 背诵", "宋词 讲解", "成语 故事 大全", "成语 典故",
          "西游记 儿童", "西游记 动画", "三国演义 儿童", "水浒传 儿童", "红楼梦 儿童", "中国神话 故事",
          "山海经 儿童", "上下五千年", "中国历史 儿童", "中国历史 动画", "汉字 故事 大全", "说文解字 儿童",
          "阅读理解 小学", "阅读理解 技巧 小学", "看图写话", "作文 入门", "作文 小学", "标点符号",
          "近义词 反义词", "文言文 启蒙", "小古文", "小学文言文", "唐诗 动画 全集", "古诗 动画 合集",
          "诗词 大会 儿童", "中国诗词", "论语 儿童", "论语 动画", "三字经 全集", "千字文 讲解",
          "幼学琼林", "增广贤文", "名句 赏析", "汉字 听写", "小学 古诗 动画", "小古文 动画",
          "西游记 动画 合集", "中国历史 动画 合集", "山海经 动画 儿童", "成语 典故 动画", "看图写话 教学", "作文 启蒙 动画",
          "千字文 动画",
        ],
      },
      {
        id: "L4",
        ageMin: 9,
        ageMax: 12,
        base: 140000,
        target: 265,
        keywords: [
          "初中语文", "初中语文 课文", "文言文", "文言文 讲解", "古文观止", "论语 讲解",
          "孟子 讲解", "诗经 讲解", "唐诗宋词 鉴赏", "名著 导读", "西游记 原著", "三国演义 原著",
          "红楼梦 解读", "水浒传 解读", "朝花夕拾", "骆驼祥子", "城南旧事", "草房子",
          "中国通史", "成语 典故 大全", "唐诗 鉴赏", "宋词 鉴赏", "古文 鉴赏", "世说新语",
          "史记 故事", "资治通鉴 故事", "春秋战国 故事", "三国 历史", "红楼梦 讲解", "西游记 讲解",
          "水浒 讲解", "三国 讲解", "古代文化常识", "诗词 吟诵", "朗诵 古诗文", "初中 文言文 动画",
          "古文 动画 讲解", "名著 动画 导读", "史记 动画 故事", "世说新语 动画", "唐诗 动画 鉴赏", "宋词 动画",
          "中国通史 动画", "论语 动画 讲解",
        ],
      },
    ],
  },
};

function parseDuration(value) {
  const parts = String(value || "").split(":").map(Number);
  if (parts.some((part) => !Number.isFinite(part))) return 0;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

function titleKey(title) {
  return title.replace(/[\s\u200b-\u200f\ufeff]/g, "").replace(/[!-/:-@[-`{-~，。！？、；：""''《》【】（）·—…]/g, "").toLowerCase();
}

// 关键词只代表采集入口，标题里的进阶信号会把明显超龄的内容挪到更高级别。
function refineLevel(topic, levelId, title) {
  const order = topic.levels.map((level) => level.id);
  let index = order.indexOf(levelId);
  const bump = (pattern, minLevel) => {
    if (pattern.test(title)) index = Math.max(index, order.indexOf(minLevel));
  };
  if (topic.prefix === "en") {
    bump(/音标|语法|时态|新概念|章节书|哈利波特|初中|小学|阅读理解|写作|作文/, "L3");
    bump(/中英对照|中英双语|童话|睡前故事|全集|合集|单词课|词汇课|剧场版|大电影/, "L2");
  } else {
    bump(/文言文|古文|名著|原著|史记|资治通鉴|论语|孟子|初中|初一|初二|初三/, "L4");
    bump(/小学|课文|一年级|二年级|三年级|四年级|五年级|六年级|阅读理解|作文|写话|诗词大会/, "L3");
    bump(/古诗|唐诗|宋词|成语|神话|上下五千年|中国历史/, "L2");
  }
  return order[Math.max(0, index)];
}

function cleanName(value) {
  return strip(value)
    .replace(/\s+/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/[\u200b-\u200f\ufeff]/g, "")
    .trim()
    .slice(0, 48)
    .replace(/[\s+｜|/,，、·-]+$/, "");
}

async function collect(topic, jar, skipBvids) {
  const seen = new Map();
  const keys = new Set();
  let searched = 0;
  for (const level of topic.levels) {
    for (const keyword of level.keywords) {
      searched += 1;
      for (let page = START_PAGE; page <= SEARCH_PAGES; page += 1) {
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
          if (!bvid || seen.has(bvid) || skipBvids.has(bvid)) continue;
          const title = cleanName(raw.title);
          if (!title || BLOCK.test(title)) continue;
          if (topic.block.test(title) || !topic.match(title)) continue;
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
            duration,
            author: strip(raw.author),
            level: refineLevel(topic, level.id, title),
            keyword,
          });
        }
        process.stdout.write(".");
        await sleep(DELAY);
        if (results.length < 15) break;
      }
    }
  }
  console.log("\n" + topic.name + "：搜索 " + searched + " 个关键词，候选 " + seen.size + " 条");
  return [...seen.values()];
}

function interleave(candidates, levels) {
  const groups = new Map(levels.map((level) => [level.id, []]));
  for (const item of candidates) {
    const list = groups.get(item.level);
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

async function build(topicKey, topic, previous) {
  const jar = cookies();
  const skipBvids = new Set();
  try {
    const curated = JSON.parse(await fs.readFile(path.join(ROOT, "data/curated_catalog.json"), "utf8"));
    for (const item of curated.series || []) if (item.bvid) skipBvids.add(item.bvid);
  } catch (error) {
    // 没有名单结果时照常跑。
  }

  const candidates = await collect(topic, jar, skipBvids);
  const queue = interleave(candidates, topic.levels);
  const levelById = new Map(topic.levels.map((level) => [level.id, level]));
  const counts = new Map(topic.levels.map((level) => [level.id, 0]));
  const accepted = [];
  const overflow = [];
  const state = { tried: 0, total: 0 };
  const acceptedNames = new Set();

  // 沿用已通过校验的条目，只补足到分级目标。
  for (const item of (previous && previous[topicKey]) || []) {
    const level = topic.levels.find((entry) => item.tags && item.tags[0] === topic.tag + entry.id);
    if (!level || counts.get(level.id) >= level.target) continue;
    accepted.push(item);
    acceptedNames.add(titleKey(item.name));
    counts.set(level.id, counts.get(level.id) + 1);
    state.total += 1;
    if (item.bvid) skipBvids.add(item.bvid);
  }
  const seeded = state.total;

  const maxTries = TARGET * 3;

  const filled = () => topic.levels.every((level) => counts.get(level.id) >= level.target);
  const full = () => state.total >= TARGET || filled();

  async function take(item, relaxed) {
    if (state.total >= TARGET) return;
    const level = levelById.get(item.level);
    if (!relaxed && counts.get(level.id) >= level.target) return;
    state.tried += 1;
    if (state.tried > maxTries) return;
    const view = await viewOf(item.bvid);
    if (!view || !view.pages.length) return;
    const pages = Math.min(100, view.pages.length);
    const duration = view.pages.reduce((sum, page) => sum + (Number(page.duration) || 0), 0);
    if (pages === 1 && duration < 120) return;
    // 「第N季/全集」却只有一个几分钟的 P，多半是片段而不是整季。
    if (pages === 1 && duration < 600 && /全集|全\d+集|第[一二三四五六七八九十\d]+季/.test(view.title)) return;
    if (!(await playable(view.bvid, view.pages[0].cid))) return;
    const name = cleanName(view.title) || item.title;
    if (BLOCK.test(name) || topic.block.test(name) || !topic.match(name)) return;
    const nameKey = titleKey(name);
    if (!nameKey || acceptedNames.has(nameKey)) return;
    acceptedNames.add(nameKey);
    counts.set(level.id, counts.get(level.id) + 1);
    state.total += 1;
    const latest = pages > 1
      ? pages + "集"
      : duration >= 3600 ? Math.round(duration / 3600) + "小时" : Math.max(1, Math.round(duration / 60)) + "分钟";
    accepted.push({
      id: topic.prefix + "-" + item.bvid.toLowerCase(),
      name,
      source: "bili",
      bvid: item.bvid,
      biliTitle: view.title,
      pic: view.pic || item.pic,
      episodes: pages,
      latest,
      latestTime: 0,
      count: pages,
      stale: false,
      ageMin: level.ageMin,
      ageMax: level.ageMax,
      paths: topic.paths,
      tags: [topic.tag + level.id],
      order: level.base + counts.get(level.id),
      why: topic.why,
      list: [topic.list],
      desc: "UP 主：" + cleanName(item.author || "") + "；播放 " + item.play + "；关键词「" + item.keyword + "」。分级：" + level.id + "。",
    });
    process.stdout.write("+");
  }

  const worker = async () => {
    while (!full()) {
      const item = queue.shift();
      if (!item) return;
      if (counts.get(item.level) >= levelById.get(item.level).target) {
        overflow.push(item);
        continue;
      }
      if (state.tried >= maxTries) return;
      await take(item, false).catch((error) => console.warn("\n[verify] " + item.title + "：" + ((error && error.message) || error)));
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  // 某一级资源不足时，用其他级别多出来的候选补齐总量。
  if (state.total < TARGET) {
    const worker2 = async () => {
      while (state.total < TARGET && state.tried < maxTries) {
        const item = overflow.shift();
        if (!item) return;
        await take(item, true).catch((error) => console.warn("\n[verify] " + item.title + "：" + ((error && error.message) || error)));
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker2));
  }

  accepted.sort((a, b) => a.order - b.order);
  console.log("\n" + topic.name + "：通过校验 " + accepted.length + " 条（沿用 " + seeded + " 条，尝试 " + state.tried + " 条）");
  for (const level of topic.levels) {
    const count = accepted.filter((item) => item.tags[0] === topic.tag + level.id).length;
    console.log("  " + level.id + " " + level.ageMin + "-" + level.ageMax + " 岁：" + count + " 条");
  }
  return accepted;
}

async function main() {
  let previous = {};
  try {
    previous = JSON.parse(await fs.readFile(FILE, "utf8"));
  } catch (error) {
    previous = {};
  }

  const output = { updatedAt: new Date().toISOString(), source: "topics", english: [], chinese: [], ...previous };
  output.updatedAt = new Date().toISOString();
  output.source = "topics";

  for (const key of Object.keys(TOPICS)) {
    if (ONLY && ONLY !== key) continue;
    console.log("开始采集专题：" + TOPICS[key].name);
    output[key] = await build(key, TOPICS[key], previous);
  }

  await fs.writeFile(FILE, JSON.stringify(output, null, 2) + "\n");
  console.log("写入 data/topic_catalog.json：" + Object.keys(TOPICS).map((key) => TOPICS[key].name + " " + (output[key] || []).length).join(" / "));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
