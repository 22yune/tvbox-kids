# 儿童 TVBox 源（0-12 岁）

面向 [FongMi/Release](https://github.com/FongMi/Release)（影视）的儿童点播源。同一份 5000+ 条内容提供 **六种查找方式**（按年龄、按学习路线、按内容类型、按专题、按名称、按来源），多季 IP 合并成一张卡片，附精选少儿直播。

- 央视内容只收录央视少儿/科教/纪录片，无广告、无第三方聚合影视
- **名单驱动**：先在 `data/curation.json` 定「该有什么」（国际获奖、高分、教育部、家长口碑、绘本 IP、央视科普），再由脚本逐条找源，找不到就进 missing 列表，不硬凑
- 名单条目当前主要解析到哔哩哔哩（儿歌、动画、识字、小学课堂、纪录片），和央视内容混排在同一套年龄/路线/专题里
- 第三方采集站内容并入「按来源」，默认显示，可按需关闭，见「家长设置」
- 关闭搜索，避免孩子搜到站外内容
- 每日自动同步栏目更新，播放时实时解析央视 HLS / B 站直链，不托管任何影视文件
- 单配置、6 个点播入口 + 直播，不需要切换多仓

## 站点

| 入口 | 组织方式 | 内容 |
|---|---|---|
| 按年龄 | 0-3 / 3-6 / 6-9 / 9-12 岁 | 全部内容，按适龄区间筛选，可再按内容类型/来源收窄 |
| 按学习路线 | 8 条路线 | 按路线阶段排序，可筛年龄段和内容类型 |
| 按内容类型 | 13 类：国产/欧美/日韩/综合动画、动画电影、儿歌低幼、英语启蒙、语文国学、科学探索、纪录片、艺术美育、安全情绪、科技动手 | 可筛年龄段和来源 |
| 按专题 | 6 组 / 50 个专题 | 先选专题组，再进入专题文件夹，内容按标签 + 标题关键词聚合 |
| 按名称 | A-Z + # | 按拼音首字母排列，可筛内容类型 |
| 按来源 | 央视 / 哔哩哔哩 / 采集站 | 可筛年龄段和内容类型 |
| 少儿直播 | 6 个频道 | CCTV-14、卡酷、浙江少儿、CCTV-9/10/15 |

六个入口只是**查找方式**，同一部内容会出现在多个入口里，分组逻辑各不相同。列表里的多季 IP（如《赛尔号》《海绵宝宝》）合并成一张卡，卡上标「N 季 · M 集」；详情页按「季 × 来源」堆叠播放线路，备用采集站是线路而不是列表项。

## 分级规则

| 年龄段 | 内容特征 |
|---|---|
| 0-3 岁 | 儿歌、律动、认知游戏、生活习惯，建议家长陪伴 |
| 3-6 岁 | 手工、故事、情绪认知、简单科普 |
| 6-9 岁 | 动画、科学观察、表达与合作、新闻启蒙 |
| 9-12 岁 | 科学求证、人文历史、纪录片、逻辑思辨 |

每条资源还标注领域、学习路线和阶段。阶段用于在同一路线内排序，例如「科学探究」是：动物好伙伴 → 科学动物园/芝麻开门 → 异想天开/是真的吗。

## 名单驱动的选片池

`data/curation.json` 是内容清单，不是搜索结果。每条先写清楚「要什么」：名称、搜索别名、年龄段、学习路线、专题标签、入选理由和名单来源（`国际获奖` / `高分` / `教育部` / `家长社区` / `绘本IP` / `央视` / `平台自制`）。

`scripts/curate.mjs` 按固定优先级逐条找源：

1. `pin`：已验证的 `bvid`，直接用
2. 上一次 `data/curated_catalog.json` 里的 `bvid`，仍然有效就沿用
3. 按 `aliases` 依次搜索 B 站，用 `pick` / `exclude` 过滤标题，按集数和播放量排序，再探活播放地址
4. 都不行就写进 `curated_catalog.json` 的 `missing`，下次同步自动重试

找源的细节：

- 搜索接口需要 `buvid3` / `b_nut` Cookie，脚本本地生成，不需要账号
- 详情页的分 P 就是集数；播放时按 `bvid + cid` 换临时直链（匿名最高 720p），并带 `Referer: https://www.bilibili.com/`
- 站上很多整季会被压成一个长视频，单 P 但时长 ≥ 20 分钟也算合格
- `minPages` 是集数下限；`skip` 用来标记「确认平台没有可播正片」的条目，避免每次同步重复搜索
- 视频被 UP 主删除或设为付费时，同步会尝试重新搜索；失败则保留上一次数据并标记 `stale`

### 备用线路

B 站之外，`data/backup_sites.json` 配了 23 个第三方 MacCMS 采集站（极速、暴风、光速、量子、魔都、非凡、淘片、电影天堂、优酷、豪华、百度、新浪、速播、金鹰、猫眼、无尽、DD、2100、三六等）。站点主要从 [25175/tvyuan](https://github.com/25175/tvyuan) 与 [noimank/tvbox](https://github.com/noimank/tvbox) 列出的源里挑选，同步时按标题在每个站搜一次，只保留同时满足以下条件的条目，名单条目最多接 3 个站：

- 分类不是恐怖/惊悚/综艺/解说/预告这类明显不对的题材
- 标题与名单名称匹配（完全一致、名单名包含站内标题，或以名单名开头），并排除解说、混剪、预告、片段
- 详情里至少有一个分组的播放地址是直连 m3u8

找到的备用线路直接以站点名（「极速」「暴风」等）作为播放线路显示在详情页。多季合并的详情页里，线路名形如「第 3 季 · 极速」：同一季的多条备用源、B 站/央视线路并列堆叠，默认播第一条，异常时切换即可。播放时再取一次站点详情，拿当次有效的 m3u8 地址，避免存下来的临时链接过期。

注意：这些站是第三方盗版采集站，画质、广告（尤其片头贴片）和内容都不可控，**不建议让孩子单独使用备用线路**；找不到同名内容时不会硬凑，宁可不显示。

当前 209 条名单里 184 条找到源，25 条确认平台上只有片段/音频或正片未开放，标记缺源不会硬凑；184 条里有 74 条至少接上 1 个备用站（1 个 31 条、2 个 24 条、3 个 19 条）。

### 采集站条目

除了 B 站名单，`data/open_catalog.json` 还会收录纯采集站条目：按儿童向 IP 白名单（900+ 个系列名）在各站搜索，同名/同季合并，每条最多挂 6 个播放源。选条目时优先挑有 3 个源的，3 个之后不再特意补源；候选池不足时才接受 1-2 个源，避免为了凑数硬塞。

- `npm run expand -- --batch 100 --target 2000`：抓一批，默认每批 100 条；`--target` 指整个目录（央视 + 名单 + 采集站）的总条数
- 当前原始目录 5071 条：19 条央视系列 + 184 条名单 + 2846 条采集站 + 2022 条专题；采集站里 1774 条至少 3 个源
- 多季合并后实际展示 4484 张卡片：227 个 IP 分组把 814 条同名前缀条目并成了一张卡
- 采集站条目按儿童向筛选：日本动画只保留宝可梦、奥特曼、假面骑士、光之美少女等儿童 IP；玄幻爽文、恋爱后宫、恐怖暴力、动态漫画一律排除
- 条目的分类、黑名单、年龄段/学习路线映射都在 `scripts/expand.mjs` 顶部
- 这些条目 `source` 为 `mac`，详情页集名在打开时实时从采集站取，jar 里只存集数
- `KIDS_SKIP_BACKUPS=1` 时同步不会重新扫采集站，CI 沿用已提交的结果

### 英语学习 / 语文素养专题

`data/topic_catalog.json` 存放两个按难度分级的专题：`english`（997 条）和 `chinese`（1025 条），全部是 B 站 UP 主上传的合集，播放时实时取流。每条带 `英语L1`～`英语L4` / `语文L1`～`语文L4` 标签，专题页按 `order` 从低到高排列，形成循序渐进的书单。

- `npm run topics -- --target 1000 --pages 2`：按关键词搜索并逐条校验可播放后写入专题；`--topic english` 可只跑一个专题；`--start-page` 可跳过已抓过的搜索页
- 分级规则：L1（0-4 岁）儿歌磨耳朵 → L2（3-6 岁）自然拼读/分级阅读/识字拼音 → L3（6-9 岁）动画、科普、古诗文启蒙 → L4（9-12 岁）科普纪录片、章节书、文言文与名著
- 过滤掉直播回放、解说、速看、考研/高考、音标语法课、电影配音、民间怪谈、书法讲座等噪音；单 P 且时长过短却标「全集/第 N 季」的按片段丢弃
- 结果只保留 `bvid`、封面、集数和分级标签，jar 不存集名；详情页打开时再请求 B 站分 P 列表

## 快速开始

### 1. 建仓库

把这个目录推到 GitHub **公开仓库**（只托管配置和元数据，不托管视频，公开是安全的）。Actions 默认开启。

首次推送后：

1. 打开 Actions → `sync-catalog` → Run workflow
2. 等待 `data/catalog.json`、`spider/kids.jar`、`kids.json` 生成并自动提交

也可以本地先跑（需要 JDK 和 Android SDK build-tools，脚本用 `javac` + `d8` 把 Java 爬虫打成 dex jar）：

```bash
node scripts/sync.mjs --verify
node scripts/check.mjs
```

### 2. 在 FongMi 中导入

设置 → 配置 → 添加配置地址，填：

```
https://raw.githubusercontent.com/<你的用户名>/<仓库名>/main/kids.json
```

国内网络可用代理前缀：

```
https://gh-proxy.com/https://raw.githubusercontent.com/<你的用户名>/<仓库名>/main/kids.json
```

或 jsDelivr：

```
https://cdn.jsdelivr.net/gh/<你的用户名>/<仓库名>@main/kids.json
```

导入后首页会出现「按年龄 / 按学习路线 / 按内容类型 / 按专题 / 按名称 / 按来源」六个站点，直播在「直播」页。

> 点播站点是 type 3 的 **JAR 爬虫**：配置里的 `spider` 指向 `spider/kids.jar;md5;<32 位 md5>`，站点 `api` 为 `csp_Kids`。JAR 由 App 自己用 `DexClassLoader` 加载，**不需要安装 QuickJS/Python/Node 运行时模块**，兼容 FongMi 和各路 catvod 系 TVBox。
>
> `scripts/sync.mjs` 默认生成 `https://gh-proxy.com/https://raw.githubusercontent.com/.../spider/kids.jar`，和上面的代理导入地址保持一致。如果要换成别的镜像或直连 raw：
>
> ```bash
> # 直连 raw（海外网络）
> KIDS_USE_RAW=1 node scripts/sync.mjs
> # 换镜像前缀
> KIDS_BASE_URL=https://gh-proxy.com/https://raw.githubusercontent.com/<你的用户名>/<仓库名>/main node scripts/sync.mjs
> # 直接指定 jar 完整地址
> KIDS_JAR_URL=https://cdn.jsdelivr.net/gh/<你的用户名>/<仓库名>@main/spider/kids.jar node scripts/sync.mjs
> ```
>
> 用 Actions 更新时，把上面的变量加到仓库 Settings → Secrets and variables → Actions → Variables（名字相同），工作流会把它传给脚本，否则每次同步都会回到默认的 gh-proxy 地址。
>
> 注意：`spider` 里的 md5 必须和仓库里的 `spider/kids.jar` 完全对应，所以**别手动改 jar**，改完源码或数据后重新跑一次 `node scripts/sync.mjs` 或让 Actions 生成。

### 本地预览（可选）

不想先推 GitHub，可以在电脑上起一个静态服务：

```bash
python3 -m http.server 8000
```

FongMi 配置地址填 `http://<电脑局域网 IP>:8000/kids.json`。本地没有 git 远端时，脚本会把 `spider` 写成 `http://127.0.0.1:8000/spider/kids.jar;md5;...`，需要改成你电脑的局域网 IP，或者用 `KIDS_JAR_URL` 指定。

目录内容更新后，重启 FongMi 或重新加载配置即可生效（爬虫有内存缓存，md5 变化后会重新下载 jar）。

## 家长设置

- 六个点播站点都是 JAR 爬虫，已统一设置 `searchable: 0`、`quickSearch: 0`、`changeable: 0`，不要在配置里改回 1
- 内容来自央视、哔哩哔哩和第三方采集站，同一个入口里混排；采集站的画质和广告（尤其片头贴片）不可控，**不建议让孩子单独看**。不需要采集站内容时，在「按来源」里筛到央视/哔哩哔哩，或在 App 站点管理里只保留需要的入口
- 采集站线路多为直连 m3u8；需要网页解析的源（如量子、非凡）没有收录，避免依赖解析器
- FongMi 没有站点密码锁，最稳妥的做法是专用设备/专用账号，或把可用站点限制在本配置内
- 幼儿内容建议亲子共看，尤其是动画和综艺类

## 维护

### 爬虫代码结构

| 路径 | 说明 |
|---|---|
| `spider-src/com/github/catvod/spider/Kids.java` | 爬虫逻辑：六种查找方式、IP 卡片、季 × 线路详情、专题文件夹、筛选条 |
| `spider-src/com/github/catvod/spider/Catalog.java` | 由 `data/catalog.json` + `data/curated_catalog.json` + `data/open_catalog.json` + `data/topic_catalog.json` + `data/taxonomy.json` 自动生成（`SERIES` / `IP` / `TAXONOMY` 三个常量），勿手改 |
| `scripts/group.mjs` | IP 归并、拼音首字母、内容分类和专题匹配，同步与校验共用 |
| `spider-stub/com/github/catvod/crawler/Spider.java` | 编译用桩类，签名对齐 FongMi 的 `Spider`，不打进 jar |
| `scripts/build-jar.mjs` | `javac` 编译 → `d8 --min-api 21` 转 dex → 打包 `spider/kids.jar` |
| `spider/kids.jar` | 产物，dex jar，App 用 `DexClassLoader` 直接加载 |

### 加一个央视栏目

编辑 `data/series.json`：

```json
{
  "id": "cctv-xxx",
  "name": "栏目名",
  "column": "TOPCxxxxxxxx",
  "ageMin": 6,
  "ageMax": 12,
  "episodes": 60,
  "order": 200,
  "paths": ["path-science"],
  "stages": { "path-science": 2 },
  "tags": ["科学"],
  "desc": "一句话说明。"
}
```

栏目 ID 可以从栏目页源码里的 `TOPC...` 提取，例如 `https://tv.cctv.com/lm/dwhhb/`。

### 加一条名单

编辑 `data/curation.json`：

```json
{
  "id": "bili-xxx",
  "name": "显示名",
  "aliases": ["B站搜索关键词1", "备选关键词"],
  "pick": ["标题里必须出现的词"],
  "exclude": ["盘点", "混剪"],
  "minPages": 5,
  "pin": "BV1xxxxxxxxx",
  "ageMin": 3,
  "ageMax": 6,
  "paths": ["path-language"],
  "stages": { "path-language": 1 },
  "tags": ["低幼"],
  "order": 330,
  "why": "为什么值得让孩子看。",
  "list": ["国际获奖", "高分"],
  "desc": "一句话说明。",
  "skip": "可选：确认平台没有正片时写原因"
}
```

- 先写 `why` 和 `list`，再去找源；找不到就让它进 `missing`，不要为了凑数放宽 `pick`
- `pin` 填了就直接固定；没有则按 `aliases` 搜，`pick` 过滤标题、`exclude` 剔掉盘点/混剪/歌曲合集这类视频
- `minPages` 是集数下限；单 P 但时长 ≥ 20 分钟的整季视频不受这个限制
- 搜索接口需要 `buvid3`/`b_nut` Cookie，脚本会本地生成，不需要账号
- 改完跑 `npm run sync`，确认 `data/curated_catalog.json` 里的标题和集数对得上；缺源清单在同文件的 `missing` 里

### 加直播频道

编辑 `data/live.json`，在 `groups[].channel[]` 里加频道和多个备用地址。FongMi 支持同一频道多线路切换。

### 调整分类、专题与字序

这些都在 `data/taxonomy.json`，改完跑一次 `npm run sync && npm run check`：

- `ages` / `paths`：年龄段与学习路线，条目通过 `ageMin`/`ageMax` 和 `paths` 归属
- `contents`：按内容类型站点的 13 个分类，由条目的标签和题材自动映射（`scripts/group.mjs` 的 `contentTypes`）
- `sources`：央视 / 哔哩哔哩 / 采集站，基本不用改
- `alphabet`：按名称站点的字序表，`A`-`Z` 加 `#`，拼音首字母在同步时预计算
- `topicGroups`：专题分组与专题。每个专题有 `names`（标题关键词，ASCII 词按词边界匹配）和可选的 `tags`（标签命中）；同步时用 `scripts/group.mjs` 的 `topicMatches` 预演，`npm run check` 会确保每个专题至少命中一条内容

多季 IP 的识别同样在 `scripts/group.mjs`：从名称里剥掉「第 X 季/部」「Season N」「S0N」、语言版本、年份和括号后缀，剩余部分相同的条目合并成一组，至少 2 条才成组。调整后看 `npm run sync` 输出的「IP N 组 / M 张卡片」。

### 命令

```bash
npm run sync          # 同步央视目录 + 按名单找源 + 合并采集站/专题，生成 Catalog.java 并重新打 jar
npm run sync:verify   # 同步后校验每个央视系列最新一集能否取到 HLS
npm run check         # 校验名单字段、缺源列表、专题条目、六站点配置、IP 分组、年龄/路线/专题覆盖、jar md5
npm run jar           # 只重建 spider/kids.jar（数据已生成时用）
```

每日 03:17（北京时间）自动执行一次。接口失败时保留上一次的数据并标记 `stale`，不会清空目录。

## 已知限制

- 央视 HLS 是公开流，但可能有地域/CDN 限制；个别网络下需要代理或换备用线路
- 直播源时效性强，卡酷和央视备用线路可能在某些地区 403，配置里保留了多线路
- 目前覆盖 0-12 岁。13-18 岁的学科课程需要接入国家中小学智慧教育平台，接口和授权更复杂，暂未包含
- 封面取最新一集的剧照，不是栏目海报
- 央视栏目列表最多取 60 集，老栏目可能看不到更早的集数
- B 站匿名播放最高 720p；部分视频被 UP 主删除、设为付费或仅限登录后播放，需要等下一次同步自动换源或手动改 `pin`
- 名单里找不到正片的条目会一直留在 `missing`（当前 25 条），可以手动补 `pin` 或换成平台有的同名系列
- 第三方采集站随时可能换域名、失效或插入贴片广告，不保证可用；采集条目里也混有青少年向作品，需要家长把关
- 多季 IP 按名称前缀合并，命名差异大的同系列可能分成两张卡；专题靠标签 + 标题关键词命中，冷门 IP 的内容可能偏少

## 版权

本仓库只包含配置、栏目元数据和爬虫代码，不存储、不转码、不分发任何视频文件。央视内容在播放时从央视网公开接口实时取流；B 站条目只保存 `bvid` 和元数据，播放时经官方 `playurl` 接口取直链。第三方补充站指向公开采集接口。全部仅供家庭自用，请勿公开传播或用于商业用途。
