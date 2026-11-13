import { Spider } from "catvod";

const CATALOG = [{"id":"cctv-xxzhs","name":"小小智慧树","column":"TOPC1451559205464876","ageMin":0,"ageMax":4,"episodes":60,"order":10,"paths":["path-language","path-arts","path-health","path-social"],"stages":{"path-language":1,"path-arts":1,"path-health":1,"path-social":1},"tags":["低幼","艺术","安全","情绪"],"desc":"面向低幼宝宝的启蒙栏目，包含儿歌、律动、认知游戏和生活习惯。建议家长陪伴观看。","pic":"https://p3.img.cctvpic.com/fmspic/2026/11/13/8b1886cee5e04766b6159dd8b29c5945-1.jpg","latest":"《小小智慧树》 20261113","latestTime":1794535807265,"latestGuid":"8b1886cee5e04766b6159dd8b29c5945","count":1000,"stale":false,"playable":true,"verifyReason":"OK"},{"id":"cctv-zhs","name":"智慧树","column":"TOPC1451447359806385","ageMin":2,"ageMax":6,"episodes":60,"order":20,"paths":["path-language","path-arts","path-health","path-social"],"stages":{"path-language":1,"path-arts":1,"path-health":1,"path-social":2},"tags":["低幼","艺术","安全","情绪"],"desc":"央视少儿经典幼儿栏目，涵盖手工、儿歌、生活习惯和情绪认知。","pic":"https://p2.img.cctvpic.com/fmspic/2026/11/13/a72f61e721e441f19968d2ddb09e239f-1.jpg","latest":"《智慧树》 20261112","latestTime":1794503768254,"latestGuid":"a72f61e721e441f19968d2ddb09e239f","count":1000,"stale":false,"playable":true,"verifyReason":"OK"},{"id":"cctv-qqb","name":"七巧板","column":"TOPC1451559569040502","ageMin":3,"ageMax":6,"episodes":60,"order":30,"paths":["path-language","path-math","path-arts"],"stages":{"path-language":2,"path-math":1,"path-arts":1},"tags":["低幼","艺术"],"desc":"以游戏、歌唱和动手活动为主的幼儿节目，适合培养节奏感、形状认知和表达。","pic":"https://p2.img.cctvpic.com/fmspic/2026/11/07/88ded9391f3943ed8b308f286942c272-1.jpg","latest":"《七巧板》 20261107 快乐宝贝爱唱歌 汇聚童心 欢唱童年","latestTime":1794018841511,"latestGuid":"88ded9391f3943ed8b308f286942c272","count":942,"stale":false,"playable":true,"verifyReason":"OK"},{"id":"cctv-dfc","name":"大风车","column":"TOPC1451558929123462","ageMin":3,"ageMax":9,"episodes":60,"order":40,"paths":["path-language","path-humanities","path-social"],"stages":{"path-language":2,"path-humanities":1,"path-social":2},"tags":["动画","艺术"],"desc":"央视少儿综合栏目，包含动画、游戏、儿童剧和成长话题。","pic":"https://p4.img.cctvpic.com/fmspic/2026/11/10/42db5de4951a4537b199cfa6e53213f0-1.jpg","latest":"《大风车》 20261110","latestTime":1794275406742,"latestGuid":"42db5de4951a4537b199cfa6e53213f0","count":1000,"stale":false,"playable":true,"verifyReason":"OK"},{"id":"cctv-dhc","name":"动画城","column":"TOPC1451542209144770","ageMin":3,"ageMax":9,"episodes":60,"order":50,"paths":["path-language","path-social"],"stages":{"path-language":3,"path-social":2},"tags":["动画"],"desc":"央视少儿动画栏目，收录多部国产动画，适合亲子共看并讨论剧情。","pic":"https://p4.img.cctvpic.com/image/2009/donghuachengsitao/2010/08/22/donghuachengsitao_h264418000nero_aac32_20100822_1282476767104_2.jpg","latest":"动画城（四套） 2010年 第234期","latestTime":1295433659068,"latestGuid":"22b435a67e2a4ded3a34c9a1ab8fd925","count":987,"stale":false,"playable":true,"verifyReason":"OK"},{"id":"cctv-dhdfy","name":"动画大放映","column":"TOPC1451559025546574","ageMin":3,"ageMax":12,"episodes":60,"order":60,"paths":["path-language","path-social"],"stages":{"path-language":3,"path-social":3},"tags":["动画"],"desc":"央视少儿动画连播栏目，按日期更新，适合作为日常动画入口。","pic":"https://p5.img.cctvpic.com/fmspic/2026/11/13/7b19f5f375ba4d11a0a70dd3bdeaa3a4-1.jpg","latest":"《动画大放映》 20261113 14:05","latestTime":1794555729606,"latestGuid":"7b19f5f375ba4d11a0a70dd3bdeaa3a4","count":1000,"stale":false,"playable":true,"verifyReason":"OK"},{"id":"cctv-kldb","name":"快乐大巴","column":"TOPC1451559161446811","ageMin":6,"ageMax":12,"episodes":60,"order":70,"paths":["path-math","path-social","path-arts"],"stages":{"path-math":2,"path-social":3,"path-arts":2},"tags":["艺术"],"desc":"少儿互动综艺，通过游戏和任务锻炼表达、合作与规则意识。","pic":"https://p2.img.cctvpic.com/fmspic/2026/10/30/553bbcc9b18541a6a54378859fb5efc8-1.jpg","latest":"《快乐大巴》 20261030 我想长大个儿","latestTime":1793356432413,"latestGuid":"553bbcc9b18541a6a54378859fb5efc8","count":1000,"stale":false,"playable":true,"verifyReason":"OK"},{"id":"cctv-yykd","name":"音乐快递","column":"TOPC1451559666055645","ageMin":3,"ageMax":12,"episodes":60,"order":80,"paths":["path-arts","path-language"],"stages":{"path-arts":2,"path-language":3},"tags":["艺术"],"desc":"少儿音乐节目，适合音乐启蒙、节奏训练和舞台表达。","pic":"https://p3.img.cctvpic.com/fmspic/2026/11/12/14ca77cf1d954e19868e167bc1ba277d-1.jpg","latest":"《音乐快递》 20261112 点亮梦想","latestTime":1794448809094,"latestGuid":"14ca77cf1d954e19868e167bc1ba277d","count":865,"stale":false,"playable":true,"verifyReason":"OK"},{"id":"cctv-dwhhb","name":"动物好伙伴","column":"TOPC1452230499243399","ageMin":3,"ageMax":9,"episodes":60,"order":90,"paths":["path-science"],"stages":{"path-science":1},"tags":["科学"],"desc":"以动物为主角的科普节目，适合启蒙阶段的自然观察和生命教育。","pic":"https://p5.img.cctvpic.com/fmspic/2018/08/19/73cd0db2a8e445cab939a349d1ea1efc-1450.jpg","latest":"《动物好伙伴》 20180819","latestTime":1534679116630,"latestGuid":"73cd0db2a8e445cab939a349d1ea1efc","count":110,"stale":false,"playable":true,"verifyReason":"OK"},{"id":"cctv-kxdwy","name":"科学动物园","column":"TOPC1571021385508957","ageMin":6,"ageMax":12,"episodes":60,"order":100,"paths":["path-science"],"stages":{"path-science":2},"tags":["科学"],"desc":"用实验和观察解释动物行为与自然现象，适合小学阶段的科学启蒙。","pic":"https://p4.img.cctvpic.com/fmspic/2026/11/10/015270c1919a41fd806a3172f124e286-1.jpg","latest":"《科学动物园》 20261110 蜥界秘闻（四）","latestTime":1794272646821,"latestGuid":"015270c1919a41fd806a3172f124e286","count":364,"stale":false,"playable":true,"verifyReason":"OK"},{"id":"cctv-zmkm","name":"芝麻开门","column":"TOPC1451559725520729","ageMin":6,"ageMax":12,"episodes":60,"order":110,"paths":["path-science","path-tech"],"stages":{"path-science":2,"path-tech":1},"tags":["科学","科技"],"desc":"少儿科普与动手实验栏目，鼓励提问、观察和验证。","pic":"https://p4.img.cctvpic.com/fmspic/2022/04/06/044bd87d02804f6c9380eee5ee52ddad-36931383-0.jpg","latest":"芝麻开门 2010年 第58期","latestTime":1649220480720,"latestGuid":"044bd87d02804f6c9380eee5ee52ddad","count":1000,"stale":false,"playable":true,"verifyReason":"OK"},{"id":"cctv-yxtk","name":"异想天开","column":"TOPC1451559633994614","ageMin":6,"ageMax":12,"episodes":60,"order":120,"paths":["path-science","path-tech","path-arts"],"stages":{"path-science":3,"path-tech":2,"path-arts":3},"tags":["科学","科技"],"desc":"少儿创意与发明类节目，适合培养工程思维和动手能力。","pic":"https://p2.img.cctvpic.com/fmspic/2026/11/09/3efb68f90dbd4505af1d910e03ec771a-1.jpg","latest":"《异想天开》 20261109 小小非遗传承人","latestTime":1794186844433,"latestGuid":"3efb68f90dbd4505af1d910e03ec771a","count":851,"stale":false,"playable":true,"verifyReason":"OK"},{"id":"cctv-kw72b","name":"看我72变","column":"TOPC1451559131256781","ageMin":6,"ageMax":12,"episodes":60,"order":130,"paths":["path-arts","path-tech"],"stages":{"path-arts":3,"path-tech":1},"tags":["艺术","科技"],"desc":"少儿创意改造与手工节目，适合亲子一起动手实践。","pic":"https://p3.img.cctvpic.com/fmspic/2026/11/11/570b599c1ac34962b9b6eb4bb4acc55a-1.jpg","latest":"《看我72变》 20261111 创意少年","latestTime":1794393007650,"latestGuid":"570b599c1ac34962b9b6eb4bb4acc55a","count":592,"stale":false,"playable":true,"verifyReason":"OK"},{"id":"cctv-dsqxs","name":"大手牵小手","column":"TOPC1451558967135492","ageMin":3,"ageMax":9,"episodes":60,"order":140,"paths":["path-social","path-health"],"stages":{"path-social":2,"path-health":2},"tags":["安全","情绪"],"desc":"亲子互动节目，围绕家庭陪伴、安全自护和情感表达。","pic":"https://p3.img.cctvpic.com/fmspic/2026/11/09/64a0e1f67c2348fab1bec971f5abe320-1.jpg","latest":"《大手牵小手》 20261109 “上海·青浦杯”第二十一届全国少年儿童故事大王选拔展示活动 幼儿组","latestTime":1794224040929,"latestGuid":"64a0e1f67c2348fab1bec971f5abe320","count":1000,"stale":false,"playable":true,"verifyReason":"OK"},{"id":"cctv-szdm","name":"是真的吗","column":"TOPC1451534366388377","ageMin":9,"ageMax":12,"episodes":60,"order":150,"paths":["path-science","path-math"],"stages":{"path-science":3,"path-math":3},"tags":["科学"],"desc":"生活科学辟谣节目，适合高年级孩子练习质疑、求证和逻辑判断。","pic":"https://p1.img.cctvpic.com/fmspic/2020/07/11/8e9c099e3baa433aaea90519ee51a57e-1750.jpg","latest":"《是真的吗》 20200711","latestTime":1594478997681,"latestGuid":"8e9c099e3baa433aaea90519ee51a57e","count":18,"stale":false,"playable":true,"verifyReason":"OK"},{"id":"cctv-xwddk","name":"新闻袋袋裤","column":"TOPC1451559603261584","ageMin":6,"ageMax":12,"episodes":60,"order":160,"paths":["path-humanities","path-social"],"stages":{"path-humanities":1,"path-social":3},"tags":["人文"],"desc":"用孩子的视角讲新闻，适合培养信息理解和公共表达。","pic":"https://p5.img.cctvpic.com/fmspic/2026/11/13/91311c8749624550841897a5d6ad2fa0-1.jpg","latest":"《新闻袋袋裤》 20261113","latestTime":1794531608784,"latestGuid":"91311c8749624550841897a5d6ad2fa0","count":1000,"stale":false,"playable":true,"verifyReason":"OK"},{"id":"cctv-gsldzg","name":"故事里的中国","column":"TOPC1569729252342702","ageMin":10,"ageMax":12,"episodes":30,"order":165,"paths":["path-humanities"],"stages":{"path-humanities":2},"tags":["人文","纪录片"],"desc":"用戏剧和访谈重现中国故事，适合高年级人文启蒙，建议亲子讨论。","pic":"https://p2.img.cctvpic.com/fmspic/2020/01/25/4e63d21d0a8648b29cfd41a290dc6ded-2590.jpg","latest":"《故事里的中国》 20200125 十八洞村","latestTime":1579965473550,"latestGuid":"4e63d21d0a8648b29cfd41a290dc6ded","count":11,"stale":false,"playable":true,"verifyReason":"OK"},{"id":"cctv-djldzg","name":"典籍里的中国","column":"TOPC1611740341987572","ageMin":10,"ageMax":12,"episodes":40,"order":170,"paths":["path-humanities"],"stages":{"path-humanities":2},"tags":["人文","纪录片"],"desc":"以戏剧方式讲述典籍故事，适合高年级人文启蒙，建议亲子讨论。","pic":"https://p1.img.cctvpic.com/fmspic/2026/10/04/49d5b80d6f2e4e7da8c804728b056900-1.jpg","latest":"《典籍里的中国》焕新季 20261004 《资治通鉴》","latestTime":1791124151708,"latestGuid":"49d5b80d6f2e4e7da8c804728b056900","count":23,"stale":false,"playable":true,"verifyReason":"OK"},{"id":"cctv-ldz","name":"朗读者","column":"TOPC1487120479377477","ageMin":10,"ageMax":12,"episodes":40,"order":180,"paths":["path-language","path-humanities"],"stages":{"path-language":4,"path-humanities":3},"tags":["人文"],"desc":"以朗读和访谈为主的人文节目，适合高年级练习语感与表达。","pic":"https://p5.img.cctvpic.com/photoworkspace/2021/09/28/2021092814463362347.jpg","latest":"《朗读者》 20171008 特别节目：朗读亭里的故事","latestTime":1507458472470,"latestGuid":"4d6bf8f676aa44f0af8b3b915c6f6178","count":10,"stale":false,"playable":true,"verifyReason":"OK"}];
const TAXONOMY = {"ages":[{"id":"age-0-3","name":"0-3岁 · 婴幼儿","min":0,"max":3},{"id":"age-3-6","name":"3-6岁 · 幼儿","min":3,"max":6},{"id":"age-6-9","name":"6-9岁 · 小学低年级","min":6,"max":9},{"id":"age-9-12","name":"9-12岁 · 小学高年级","min":9,"max":12}],"paths":[{"id":"path-language","name":"语言启蒙","hint":"儿歌磨耳朵 → 识字拼音 → 阅读表达","order":10},{"id":"path-math","name":"数学思维","hint":"数感 → 图形空间 → 逻辑规律","order":20},{"id":"path-science","name":"科学探究","hint":"动植物 → 自然现象 → 动手实验 → 宇宙地球","order":30},{"id":"path-humanities","name":"人文历史","hint":"国学启蒙 → 中国历史 → 世界文明 → 博物馆","order":40},{"id":"path-arts","name":"艺术美育","hint":"音乐律动 → 绘画手工 → 戏剧表演","order":50},{"id":"path-health","name":"身心健康","hint":"安全自护 → 情绪管理 → 运动饮食","order":60},{"id":"path-social","name":"社会情感","hint":"情绪认知 → 同伴交往 → 规则意识 → 品格","order":70},{"id":"path-tech","name":"信息科技","hint":"数字素养 → 编程思维 → AI 启蒙","order":80}],"topics":[{"id":"topic-toddler","name":"低幼启蒙","tags":["低幼"]},{"id":"topic-animation","name":"动画故事","tags":["动画"]},{"id":"topic-science","name":"科学探索","tags":["科学"]},{"id":"topic-humanities","name":"人文国学","tags":["人文"]},{"id":"topic-arts","name":"艺术创想","tags":["艺术"]},{"id":"topic-safety","name":"安全与情绪","tags":["安全","情绪"]},{"id":"topic-tech","name":"动手与科技","tags":["科技"]},{"id":"topic-doc","name":"纪录片","tags":["纪录片"]}]};

const CCTV_LIST = "https://api.cntv.cn/NewVideo/getVideoListByColumn";
const CCTV_PLAY = "https://vdn.apps.cntv.cn/api/getHttpVideoInfo.do";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const HEADERS = { "User-Agent": UA, "Referer": "https://tv.cctv.com/" };
const PAGE_SIZE = 12;

function clean(value) {
  return String(value == null ? "" : value).replace(/[$#]/g, " ").replace(/\s+/g, " ").trim();
}

function ageLabel(series) {
  return series.ageMin + "-" + series.ageMax + "岁";
}

function pathName(id) {
  const item = (TAXONOMY.paths || []).find(function (x) { return x.id === id; });
  return item ? item.name : "";
}

function stageOf(series, pathId) {
  return (series.stages && series.stages[pathId]) || 99;
}

function card(series) {
  return {
    vod_id: "series/" + series.id,
    vod_name: series.name,
    vod_pic: series.pic || "",
    vod_remarks: ageLabel(series),
    style: { type: "rect", ratio: 1.78 }
  };
}

function select(mode, tid) {
  if (mode === "path") {
    return CATALOG.filter(function (s) { return (s.paths || []).indexOf(tid) >= 0; });
  }
  if (mode === "topic") {
    const topic = (TAXONOMY.topics || []).find(function (x) { return x.id === tid; });
    if (!topic) return [];
    return CATALOG.filter(function (s) {
      return (s.tags || []).some(function (tag) { return (topic.tags || []).indexOf(tag) >= 0; });
    });
  }
  const band = (TAXONOMY.ages || []).find(function (x) { return x.id === tid; });
  if (!band) return [];
  return CATALOG.filter(function (s) { return s.ageMin < band.max && s.ageMax > band.min; });
}

function sortSeries(list, mode, tid) {
  return list.slice().sort(function (a, b) {
    if (mode === "path") {
      return stageOf(a, tid) - stageOf(b, tid) || a.ageMin - b.ageMin || a.order - b.order;
    }
    return a.order - b.order || a.ageMin - b.ageMin;
  });
}

function paginate(items, pg) {
  const page = Math.max(1, parseInt(pg, 10) || 1);
  const total = items.length;
  const pagecount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  return {
    list: items.slice(start, start + PAGE_SIZE),
    page: page,
    pagecount: pagecount,
    limit: PAGE_SIZE,
    total: total
  };
}

export default class Kids extends Spider {
  init(ext = "") {
    this.mode = "age";
    if (ext && typeof ext === "object") {
      this.mode = ext.mode || "age";
      return;
    }
    try {
      const parsed = JSON.parse(ext);
      if (parsed && parsed.mode) this.mode = parsed.mode;
    } catch (error) {
      this.mode = "age";
    }
  }

  homeContent() {
    const classes = this.mode === "path"
      ? TAXONOMY.paths
      : this.mode === "topic"
        ? TAXONOMY.topics
        : TAXONOMY.ages;
    const list = CATALOG.slice()
      .sort(function (a, b) { return (b.latestTime || 0) - (a.latestTime || 0); })
      .slice(0, 6)
      .map(function (s) {
        const item = card(s);
        item.vod_remarks = "更新 · " + ageLabel(s);
        return item;
      });
    return {
      class: classes.map(function (x) { return { type_id: x.id, type_name: x.name }; }),
      list: list
    };
  }

  categoryContent(tid, pg, filter, extend) {
    const mode = this.mode;
    const items = sortSeries(select(mode, tid), mode, tid).map(function (s) {
      const item = card(s);
      if (mode === "path") {
        const stage = stageOf(s, tid);
        item.vod_remarks = (stage < 99 ? "第" + stage + "阶段 · " : "") + ageLabel(s);
      } else if (mode === "topic") {
        item.vod_remarks = s.latest ? clean(s.latest).slice(0, 12) : ageLabel(s);
      }
      return item;
    });
    return paginate(items, pg);
  }

  async detailContent(ids) {
    const id = String((ids && ids[0]) || "").replace(/^series\//, "");
    const series = CATALOG.find(function (x) { return x.id === id; });
    if (!series) return { list: [], msg: "未找到该系列" };

    let episodes = [];
    try {
      episodes = await this.episodes(series);
    } catch (error) {
      return { list: [], msg: "央视接口请求失败：" + String((error && error.message) || error) };
    }
    if (!episodes.length) return { list: [], msg: "该栏目暂时没有可播放的节目" };

    const paths = (series.paths || []).map(pathName).filter(Boolean).join("、");
    const vod = card(series);
    vod.vod_remarks = "共 " + episodes.length + " 集";
    vod.vod_content = [
      series.desc || "",
      "适龄：" + ageLabel(series),
      paths ? "学习路线：" + paths : "",
      "内容来源：央视网，播放时实时解析。"
    ].filter(Boolean).join("\n");
    vod.vod_play_from = "央视";
    vod.vod_play_url = episodes.map(function (episode, index) {
      return (clean(episode.title) || "第" + (index + 1) + "集") + "$" + episode.guid;
    }).join("#");
    return { list: [vod] };
  }

  async episodes(series) {
    const count = Math.max(1, Math.min(60, series.episodes || 60));
    const url = CCTV_LIST + "?id=" + encodeURIComponent(series.column) +
      "&n=" + count + "&sort=desc&p=1&mode=0&serviceId=tvcctv";
    const data = await this.net.json(url, { headers: HEADERS, timeout: 15000 });
    const list = (data && data.data && data.data.list) || [];
    return list
      .filter(function (x) { return x && x.guid; })
      .map(function (x) { return { guid: String(x.guid), title: clean(x.title) }; });
  }

  searchContent(key, quick, pg = "1") {
    const query = clean(key).toLowerCase();
    if (!query) return paginate([], pg);
    const items = CATALOG.filter(function (s) {
      return [s.name, s.desc].concat(s.tags || []).some(function (value) {
        return clean(value).toLowerCase().indexOf(query) >= 0;
      });
    }).map(card);
    return paginate(items, pg);
  }

  async playerContent(flag, id) {
    const pid = String(id || "").trim();
    if (!pid) return { parse: 0, msg: "缺少节目 ID" };
    try {
      const data = await this.net.json(CCTV_PLAY + "?pid=" + encodeURIComponent(pid), {
        headers: HEADERS,
        timeout: 15000
      });
      const url = data && (data.hls_url || (data.video && data.video.hls_url));
      if (!url) return { parse: 0, msg: (data && data.tip_msg) || "央视未返回播放地址" };
      return { parse: 0, url: url, header: HEADERS };
    } catch (error) {
      return { parse: 0, msg: "播放地址解析失败：" + String((error && error.message) || error) };
    }
  }
}
