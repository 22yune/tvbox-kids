# 儿童 TVBox 源（0-12 岁）

面向 [FongMi/Release](https://github.com/FongMi/Release)（影视）的儿童点播源。按 **年龄、学习路线、主题** 三种逻辑组织央视少儿与科教内容，附带精选少儿直播。

- 只收录央视少儿/科教/纪录片，无广告、无第三方聚合影视
- 关闭搜索，避免孩子搜到站外内容
- 每日自动同步栏目更新，播放时实时解析央视 HLS，不托管任何影视文件
- 单配置、4 个入口，不需要切换多仓

## 四个入口

| 入口 | 组织方式 | 内容 |
|---|---|---|
| 按年龄 | 0-3 / 3-6 / 6-9 / 9-12 岁 | 按适龄区间筛选 |
| 按学习路线 | 8 条路线 | 语言、数学、科学、人文、艺术、健康、社会情感、信息科技 |
| 精选专题 | 8 个专题 | 低幼、动画、科学、人文、艺术、安全与情绪、科技、纪录片 |
| 少儿直播 | 6 个频道 | CCTV-14、卡酷、浙江少儿、CCTV-9/10/15 |

## 分级规则

| 年龄段 | 内容特征 |
|---|---|
| 0-3 岁 | 儿歌、律动、认知游戏、生活习惯，建议家长陪伴 |
| 3-6 岁 | 手工、故事、情绪认知、简单科普 |
| 6-9 岁 | 动画、科学观察、表达与合作、新闻启蒙 |
| 9-12 岁 | 科学求证、人文历史、纪录片、逻辑思辨 |

每条资源还标注领域、学习路线和阶段。阶段用于在同一路线内排序，例如「科学探究」是：动物好伙伴 → 科学动物园/芝麻开门 → 异想天开/是真的吗。

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

导入后首页会出现「按年龄 / 按学习路线 / 精选专题」三个站点，直播在「直播」页。

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

- 三个点播站点都已设置 `searchable: 0`、`quickSearch: 0`，不要在配置里改回 1
- 配置里有一个默认隐藏的「补充点播（家长可选）」聚合源。它来自第三方盗版采集站，广告和内容不可控，**不建议给孩子开**；确需启用时把该站点的 `"hide": 1` 改为 `0`，并自行确认内容
- FongMi 没有站点密码锁，最稳妥的做法是专用设备/专用账号，或把可用站点限制在本配置内
- 幼儿内容建议亲子共看，尤其是动画和综艺类

## 维护

### 爬虫代码结构

| 路径 | 说明 |
|---|---|
| `spider-src/com/github/catvod/spider/Kids.java` | 爬虫逻辑（首页/分类/详情/播放） |
| `spider-src/com/github/catvod/spider/Catalog.java` | 由 `data/catalog.json` + `data/taxonomy.json` 自动生成，勿手改 |
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

### 加直播频道

编辑 `data/live.json`，在 `groups[].channel[]` 里加频道和多个备用地址。FongMi 支持同一频道多线路切换。

### 命令

```bash
npm run sync          # 同步目录、生成 Catalog.java 并重新打 jar
npm run sync:verify   # 同步后校验每个系列最新一集能否取到 HLS
npm run check         # 校验年龄/路线/专题覆盖、jar md5 与配置一致性
npm run jar           # 只重建 spider/kids.jar（数据已生成时用）
```

每日 03:17（北京时间）自动执行一次。接口失败时保留上一次的数据并标记 `stale`，不会清空目录。

## 已知限制

- 央视 HLS 是公开流，但可能有地域/CDN 限制；个别网络下需要代理或换备用线路
- 直播源时效性强，卡酷和央视备用线路可能在某些地区 403，配置里保留了多线路
- 目前覆盖 0-12 岁。13-18 岁的学科课程需要接入国家中小学智慧教育平台，接口和授权更复杂，暂未包含
- 封面取最新一集的剧照，不是栏目海报
- 央视栏目列表最多取 60 集，老栏目可能看不到更早的集数

## 版权

本仓库只包含配置、栏目元数据和爬虫代码，不存储、不转码、不分发任何视频文件。播放地址在播放时从央视网公开接口实时获取，仅供家庭自用。请勿公开传播或用于商业用途。
