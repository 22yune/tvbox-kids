#!/usr/bin/env node
// 采集站扩容：按儿童向 IP 白名单在各站搜索，同名/同季合并，每条接最多 3 个播放源。
// 用法：node scripts/expand.mjs [--batch 100] [--target 2000] [--pages 4]
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const arg = (name, fallback) => {
  const at = process.argv.indexOf("--" + name);
  return at > 0 ? Number(process.argv[at + 1]) || fallback : fallback;
};

const BATCH = arg("batch", 100);
const TARGET = arg("target", 2000);
const PAGES = arg("pages", 8);

// 只在动画/儿童/纪录片分类里取，避免混入成人向动漫。
const TYPE_OK = /动画片|动漫|动画电影|动漫电影|儿童|少儿|亲子|教育|科教|科普|记录片|纪录片|国学|儿歌/;
const TYPE_BAD = /解说|预告|伦理|恐怖|惊悚|综艺|真人秀|短剧|新闻|体育|游戏|资讯|擦边/;
const CRAWL_TYPES = /动画片|动漫电影|动画电影|儿童儿歌|记录片|纪录片/;

const KID_WORD = /动画|儿童|少儿|亲子|益智|儿歌|童谣|童话|寓言|成语|国学|唐诗|古诗|拼音|识字|绘本|睡前|恐龙|海洋|动物|自然|宇宙|太空|科学|科普|数学|英语|字母|单词|公主|王子|冒险|精灵|小猪|小熊|小兔|小羊|小马|猫咪|狗狗|萌|幼|宝宝|启蒙|玩具|积木|手工|绘画|音乐|舞蹈|安全|消防|交通|习惯|情绪|友谊|成长|英雄|机甲|奥特曼|宝可梦|哆啦A梦|小丸子|托马斯|佩奇|汪汪队|超级飞侠|朵拉|巧虎|巴布/;

// 成人向、惊悚、偶像剧、玄幻爽文：一律不进儿童库。
const BLACK = /超电磁炮|致命玩笑|战争世界|歌之王子|精灵使|怪物娘化|我的世界：诸神|辛普森|瑞克和莫蒂|恶搞之家|南方公园|马男波杰克|脆莓公园|天堂镇警局|美国老爹|克利夫兰|飞出个未来|怪奇物语|JOJO|进击的巨人|死亡笔记|食尸|喰种|剑风传奇|恶魔人|爱死亡|爱，死亡|幼女战记|谭雅|银魂|名侦探柯南|金田一|赌博默示录|斗牌|狂赌|回复术士|无职转生|转生史莱姆|关于我转生|不死者之王|overlord|盾之勇者|哥布林杀手|刀剑神域|约会大作战|出包王女|天降之物|恶魔高校|新妹魔王|噬血狂袭|精灵使的剑舞|落第骑士|学战都市|绝对双刃|空战魔导士|最弱无败|魔装学园|魔物娘|异种族|监狱学园|黑兽|对魔忍|鬼父|缘之空|日在校园|白色相簿|人渣的本愿|家有女友|辉夜大小姐|五等分的新娘|租借女友|女友成双|超超超超|我的青春恋爱|春物|凉宫春日|孤独摇滚|更衣人偶|莉可丽丝|电锯人|咒术回战|鬼灭之刃|地狱乐|赛博朋克|边缘行者|来自深渊|致不灭的你|国王排名|无职|史莱姆|异世界|后宫|恋爱|总裁|豪门|重生|穿越|修仙|修真|仙侠|武侠|玄幻|斗罗|斗破|吞噬星空|完美世界|遮天|凡人修仙|武动乾坤|神印王座|星辰变|武庚纪|西行纪|少年歌行|画江湖|秦时明月|天行九歌|灵笼|时光代理人|天官赐福|魔道祖师|全职高手|一人之下|刺客伍六七|狐妖小红娘|镇魂街|大理寺日志|非人哉|雾山五行|大鱼海棠|大护法|妙先生|姜子牙|新神榜|白蛇|青蛇|俑之城|雄狮少年|深海|长安三万里|老子是魔法少女|魔法少女网站|聊斋|三嫁|寻爱|交配|霸总|娇妻|闪婚|离婚|复仇|宫斗|宅斗|权谋/;

const BAD_NAME = /解说|预告|花絮|片段|reaction|盘点|速看|混剪|名场面|幕后|特辑|制作|彩蛋|探班|首映|发布会|直播回放/i;

// 儿童向 IP 白名单。同名多季会在各站搜索结果里自然展开。
const WHITELIST = `
小猪佩奇 布鲁伊 汪汪队立大功 超级飞侠 海底小纵队 爱探险的朵拉 出发吧迪亚哥 花园宝宝 天线宝宝 巴布工程师
托马斯和他的朋友们 托马斯小火车 巧虎 米奇妙妙屋 米老鼠和唐老鸭 小熊维尼 小马宝莉 小羊肖恩 小羊提米
小公主苏菲亚 小医师大玩偶 小爱因斯坦 超级为什么 单词女孩 小蓝狗布鲁 小乌龟富兰克林 天才宝贝熊 阿瑟
大红狗克利福德 贝贝熊 玛德琳 彼得兔 姆明 莎拉和乖乖鸭 花格子大象艾玛 咕噜牛 女巫扫帚排排坐
小海螺和大鲸鱼 长袜子皮皮 小猪威比 小毛怪 佩特森和芬达猫 旋风战车队 小恐龙大冒险 皮普和波西
蓝精灵 丁丁历险记 瑞奇宝宝 超级宝贝JOJO 嗨道奇 本和霍利的小王国 查理和罗拉 小鼠波波 蓝色小考拉 卡由
猜猜我有多爱你 巴巴爸爸 不一样的卡梅拉 小兔兵兵 数字积木 字母积木 数字小精灵 佩格和小猫 数学小先锋
数学城小兄妹 科学小子席德 螺丝钉 平博士密码 动物兄弟 恐龙列车 安迪的恐龙冒险 消防员山姆 变形警车珀利
邮递员派特叔叔 小企鹅啵乐乐 超级小熊布迷 帮帮龙出动 无敌鹿战队 咖宝车神 心奇爆龙战车 炫卡斗士 神兵小将
快乐星猫 饼干警长 大角牛 小宋当家 火星娃 小鲤鱼历险记 精灵世纪 瑶玲啊瑶玲 小虎还乡 蓝皮鼠和大脸猫
阿笨猫 月亮街 人参王国 中华传统美德故事 中华勤学故事 中国成语故事 千千问 学问猫 米卡成长天地 布奇乐乐园
咕力咕力 贝瓦儿歌 贝乐虎 宝宝巴士 碰碰狐 巴塔木 蓝迪 洪恩幼儿英语 洪恩识字 小伴龙 悟空识字 悟空数学
斑马AI课 瓜瓜龙 火花思维 豌豆思维 叫叫阅读 常青藤爸爸 凯叔讲故事 米小圈上学记 姜小牙上学记 淘气包马小跳
笑猫日记 皮皮鲁和鲁西西 神奇校车 神奇树屋 巧虎岛 贝贝生活日记 迪士尼神奇英语 迪士尼英语 清华幼儿英语
跟小小孩说英文 鹅妈妈童谣 SuperSimpleSongs 宝宝手语 亲宝儿歌 兔小贝儿歌 猫小帅儿歌 小伶玩具 可可小爱
猪猪侠 熊出没 熊熊乐园 喜羊羊与灰太狼 喜羊羊 开心超人 开心宝贝 果宝特攻 神兽金刚 摩尔庄园 赛尔号
洛克王国 奥拉星 巴啦啦小魔仙 铠甲勇士 舞法天女 精灵梦叶罗丽 叶罗丽 小花仙 京剧猫 中华小子 围棋少年
罗小黑战记 舒克和贝塔 邋遢大王奇遇记 阿凡提的故事 雪孩子 九色鹿 三个和尚 大闹天宫 小蝌蚪找妈妈
没头脑和不高兴 神笔马良 三十六个字 蓝猫淘气三千问 海尔兄弟 聪明的一休 哆啦A梦 樱桃小丸子 忍者乱太郎
面包超人 数码宝贝 宠物小精灵 宝可梦 奥特曼 泰罗奥特曼 迪迦奥特曼 赛罗奥特曼 特利迦奥特曼 泽塔奥特曼
布莱泽奥特曼 提欧奥特曼 假面骑士 超级战队 光之美少女 魔卡少女樱 美少女战士 四驱兄弟 足球小将 灌篮高手
棒球英豪 龙猫 千与千寻 天空之城 哈尔的移动城堡 悬崖上的金鱼姬 魔女宅急便 风之谷 幽灵公主 红猪
借东西的小人阿莉埃蒂 侧耳倾听 熊猫家族 岁月的童话 百变狸猫 猫的报恩 地海战记 来自虞美人之坡 起风了
辉夜姬物语 记忆中的玛妮 玛丽与魔女之花 企鹅公路 未来的未来 怪物之子 狼的孩子雨和雪 夏日大作战
穿越时空的少女 你看起来好像很好吃 我是霸王龙 永远永远爱你 遇到你真好 宫西达也 恐龙宝贝 斗龙战士
晶码战士 弹珠传说 火力少年王 雷速登闪电冲线 战龙四驱 劲爆战士 小牛向前冲 蓝猫龙骑团 虹猫蓝兔七侠传
虹猫蓝兔 神厨小福贵 象棋王 数码宝贝驯兽师 铠甲勇士刑天 铠甲勇士拿瓦 巨神战击队 舞法天女朵法拉
叶罗丽精灵梦 猪猪侠之竞球小英雄 猪猪侠之超星五灵侠 猪猪侠之深海小英雄 猪猪侠之恐龙日记 猪猪侠大电影
熊出没之探险日记 熊出没之怪兽计划 熊出没之熊熊乐园 熊出没之奇幻空间 熊出没之原始时代 熊出没之狂野大陆
熊出没之伴我熊芯 喜羊羊与灰太狼之筐出未来 喜羊羊与灰太狼之羊村守护者 喜羊羊与灰太狼之跨时空救兵
喜羊羊与灰太狼之异国大营救 喜羊羊与灰太狼之奇妙大营救 超级飞侠大百科 超级飞侠之乐迪加速
汪汪队立大功之超能救援 汪汪队立大功大电影 汪汪队立大功之勇敢大营救 海底小纵队大电影 海底小纵队探险记
海底小纵队火焰之环 小猪佩奇过大年 小猪佩奇完美假期 小猪佩奇迷你剧 小马宝莉友谊的魔力 小马宝莉大电影
变形金刚救援汽车人 变形金刚地球火种 变形金刚赛博志 忍者神龟 少年泰坦出击 少年泰坦 正义联盟 蝙蝠侠
超人动画 蜘蛛侠 复仇者联盟 钢铁侠 乐高幻影忍者 乐高城市 乐高好朋友 乐高悟空小侠 乐高星球大战 乐高蝙蝠侠
乐高侏罗纪 乐高夺宝 乐高迪士尼 乐高漫威 乐高复仇者 乐高忍者 小马王 精灵马 小马精灵 恐龙战队 超凡战队
恐龙时代 与恐龙同行 史前星球 恐龙星球 恐龙革命 侏罗纪世界动画 侏罗纪营地 白垩纪营地 冰河世纪 冰川时代
里约大冒险 马达加斯加 马达加斯加的企鹅 快乐的大脚 小美人鱼 美女与野兽 阿拉丁 魔发奇缘 冰雪奇缘 花木兰
玩具总动员 赛车总动员 海底总动员 超人总动员 怪兽电力公司 怪兽大学 飞屋环游记 头脑特工队 疯狂动物城
寻梦环游记 机器人总动员 超能陆战队 无敌破坏王 疯狂原始人 神偷奶爸 小黄人 功夫熊猫 驯龙高手 穿靴子的猫
怪物史莱克 魔发精灵 精灵旅社 爱宠大机密 愤怒的小鸟 小王子 帕丁顿熊 比得兔 好奇猴乔治 亚瑟小子
大红狗克里弗 加菲猫 史努比 海绵宝宝 探险活宝 阿甘妙世界 少年骇客 飞天小女警 德克斯特的实验室
摩登原始人 杰森一家 高卢英雄 小猪佩奇学英语 爱宠大机密2 神偷奶爸2 神偷奶爸3 功夫熊猫2 功夫熊猫3
驯龙高手2 驯龙高手3 马达加斯加2 马达加斯加3 冰河世纪2 冰河世纪3 冰河世纪4 冰河世纪5 玩具总动员2
玩具总动员3 玩具总动员4 赛车总动员2 赛车总动员3 海底总动员2 超人总动员2 头脑特工队2 疯狂动物城2
冰雪奇缘2 海洋奇缘2 魔发奇缘2 小美人鱼2 美女与野兽2 阿拉丁2 花木兰2 精灵旅社2 精灵旅社3 精灵旅社4
魔发精灵2 愤怒的小鸟2 比得兔2 帕丁顿熊2
地球脉动 蓝色星球 我们的星球 王朝 荒野间谍 人类星球 冰冻星球 美丽中国 航拍中国 宇宙时空之旅
地球的力量 人类宇宙 微观世界 微观小世界 昆虫记 植物王国 萌宠成长记 企鹅群里有特务 帝企鹅日记
迁徙的鸟 北极熊 野性非洲 猫科动物 猴子王国 热带雨林探秘
海底世界探秘 太空探索 北斗 天眼 高铁 港珠澳大桥 超级工程 大国重器 我在故宫修文物 国家宝藏
如果国宝会说话 河西走廊 中国通史 世界历史 百家讲坛 跟着书本去旅行 门捷列夫很忙
我的牛顿教练 如果历史是一群喵 中国唱诗班 工作细胞 像乌鸦一样思考 造物小百科 人体奥秘 人体内旅行
锻炼的真相 睡眠的科学 小小世界 七个世界一个星球 绿色星球 完美星球 生命脉动 隐秘王国 自然的力量
第三极 蔚蓝之境 世界遗产之中国 典籍里的中国 西南联大 舌尖上的中国 创新中国 你好AI 艺术的力量
音乐的故事 儿童古典音乐启蒙 中国象棋 国际象棋 乐高搭建
科学实验 趣味科学 化学实验 物理实验 数学思维 奥数 口算 珠心算 英语启蒙 自然拼读 英文儿歌 英文绘本
分级阅读 牛津阅读树 海尼曼 培生 廖彩杏 吴敏兰 甜心英语 果酱英语 洪恩英语 斑马英语 叽里呱啦 励步英语
迪士尼美语世界 单词世界 奥趣多 雨果带你看世界 小小优趣 火火兔 牛听听 凯叔西游记 凯叔三国 凯叔讲历史
凯叔诗词 钱儿爸 米小圈三国 米小圈成语 我的世界 迷你世界 罗布乐思 编程猫 核桃编程 童程童美 小码王
乐高机器人 机器人编程 少儿编程 人工智能启蒙 围棋入门 象棋入门 五子棋 数独 魔方教学 速算 记忆法
思维导图 专注力 感统训练 儿童瑜伽 儿童舞蹈 儿童街舞 儿童芭蕾 儿童声乐 儿童钢琴 儿童小提琴 儿童古筝
儿童吉他 儿童架子鼓 儿童美术 儿童手工 儿童折纸 儿童剪纸 儿童陶艺 儿童书法 儿童国画 儿童素描 儿童水彩
儿童油画 儿童漫画 儿童插画 绘本故事 睡前故事 晚安故事 童话故事 寓言故事 历史故事 神话故事 民间故事
希腊神话 中国神话 山海经 西游记 三国演义 水浒传 红楼梦 封神演义 聊斋 史记 资治通鉴 论语 孟子 庄子 老子
道德经 弟子规 三字经 千字文 百家姓 声律启蒙 笠翁对韵 唐诗三百首 宋词 诗经 楚辞 古文观止 世说新语 三十六计
孙子兵法 本草纲目 天工开物 齐民要术 九章算术 几何原本 物种起源 时间简史 万物简史 人类简史 昆虫记
海底两万里 八十天环游地球 地心游记 神秘岛 鲁滨逊漂流记 格列佛游记 绿野仙踪 爱丽丝梦游仙境 木偶奇遇记
彼得潘 小飞侠 柳林风声 绿山墙的安妮 海蒂 小妇人 秘密花园 小公主 王子与贫儿 汤姆索亚历险记 雾都孤儿

大耳朵图图 新大头儿子和小头爸爸 棉花糖和云朵妈妈 熊小米 小猪班纳 梦想总动员 三毛流浪记 三毛从军记
草原英雄小姐妹 小熊猫学木匠 熊猫百货商店 咕咚来了 小马过河 猴子捞月 曹冲称象 老虎学艺 骄傲的将军
渔童 崂山道士 济公斗蟋蟀 张飞审瓜 南郭先生 鹬蚌相争 螳螂捕蝉 除夕的故事 老鼠嫁女 火童 水鹿 鹿铃
牧笛 山水情 不射之射 超级肥皂 抢枕头 宝莲灯 金猴降妖 天书奇谭 哪吒闹海 小鲤鱼跳龙门 过猴山
猪八戒吃西瓜 人参果 善良的夏吾冬 蝴蝶泉 雕龙记 长发妹 一幅僮锦 孔雀公主 金色的海螺 等明天
大盗贼 魔方大厦 十二生肖 镜花缘 熊猫京京 太阳之子 中华五千年 自古英雄出少年 天上掉下个猪八戒
奇奇颗颗历险记 大英雄狄青 小神仙和小仙女 快乐家家车 电脑娃娃 玩具之家 隋唐英雄传 奇奇和悦悦
星悦童话 小伶魔法世界 奥莉薇 玛蒂娜 奇先生妙小姐 大力水手 兔八哥 乐一通 史酷比 芭比梦想豪宅
芭比之 神奇女侠 闪电侠 美国队长 雷神 绿巨人 圣诞怪杰 极地特快 精灵鼠小弟 豚鼠特工队
大侦探皮卡丘 刺猬索尼克 小马国女孩 泰拉瑞亚 植物大战僵尸 汤姆猫 汪汪队立大功之海陆空大行动
`.split(/\s+/).filter(Boolean);

const RULES = [
  { re: /儿歌|童谣|律动|手指谣|nursery|chant/i, age: [0, 3], paths: ["path-language", "path-arts"], tags: ["低幼", "艺术"] },
  { re: /奥特曼|假面骑士|超级战队|灌篮高手|棒球英豪|美少女战士|四驱兄弟|足球小将/, age: [6, 12], paths: ["path-social"], tags: ["动画"] },
  { re: /三国演义|西游记|水浒传|红楼梦|封神|史记|资治通鉴|三十六计|孙子兵法/, age: [6, 12], paths: ["path-humanities"], tags: ["人文"] },
  { re: /识字|拼音|汉字|成语|古诗|唐诗|三字经|弟子规|千字文|论语|国学|诗词/, age: [3, 9], paths: ["path-language", "path-humanities"], tags: ["人文"] },
  { re: /数学|算术|数字|几何|口算|思维/, age: [3, 9], paths: ["path-math", "path-science"], tags: ["科学"] },
  { re: /英语|英文|双语|字母|单词|ABC|phonics/i, age: [3, 9], paths: ["path-language"], tags: ["低幼"] },
  { re: /安全|消防|交通|防拐|防骗|自护/, age: [3, 9], paths: ["path-health", "path-social"], tags: ["安全"] },
  { re: /情绪|社交|习惯|品格|分享|友谊|成长/, age: [3, 9], paths: ["path-social"], tags: ["情绪"] },
  { re: /艺术|绘画|手工|折纸|粘土|音乐|舞蹈|钢琴|美术/, age: [3, 12], paths: ["path-arts"], tags: ["艺术"] },
  { re: /编程|机器人|人工智能|科技|发明|scratch/i, age: [9, 12], paths: ["path-tech"], tags: ["科技"] },
  { re: /历史|人文|文明|国宝|故宫|博物馆|名著/, age: [9, 12], paths: ["path-humanities"], tags: ["人文"] },
  { re: /恐龙|海洋|动物|自然|宇宙|太空|地球|科学|科普|实验|植物|昆虫/, age: [6, 12], paths: ["path-science"], tags: ["科学"] },
  { re: /纪录|记录/, age: [6, 12], paths: ["path-science"], tags: ["纪录片"] },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

async function getJson(url, referer, tries = 2) {
  let last;
  for (let attempt = 1; attempt <= tries; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": UA,
          Referer: referer,
          Accept: "application/json, text/plain, */*",
        },
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) throw new Error("HTTP " + response.status);
      const text = await response.text();
      return JSON.parse(text.replace(/^\uFEFF/, ""));
    } catch (error) {
      last = error;
      if (attempt < tries) await sleep(250);
    }
  }
  throw last;
}

function norm(value) {
  return String(value || "")
    .replace(/[（(【\[].*?[）)】\]]/g, "")
    .replace(/[\s·•:：\-—_!！?？,，.。'"“”+&×]/g, "")
    .toLowerCase();
}

const CN_DIGIT = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };

function cnNumber(text) {
  if (/^\d+$/.test(text)) return String(Number(text));
  let total = 0;
  let current = 0;
  for (const char of text) {
    if (char === "十") {
      total += (current || 1) * 10;
      current = 0;
    } else if (char === "百") {
      total += (current || 1) * 100;
      current = 0;
    } else if (CN_DIGIT[char] !== undefined) {
      current = CN_DIGIT[char];
    }
  }
  return String(total + current);
}

// 用于合并同名条目：去掉年份、版本、季/部写法差异。
function canon(name) {
  let text = norm(baseName(name));
  text = text.replace(/(国语|粤语|台配|中文|普通话)版?$/, "");
  text = text.replace(/(19|20)\d{2}年?$/, "");
  text = text.replace(/动画版?$/, "");
  text = text.replace(/第?([零一二三四五六七八九十百两\d]+)(季|部|集|期|话)$/, (match, num) => cnNumber(num));
  return text;
}

function baseName(value) {
  return String(value || "")
    .replace(/\s*[-_]\s*(国语|粤语|台配|中字|HD|BD|4K|1080P|720P|完整版|全集|中文版|普通话版).*$/i, "")
    .replace(/\s+(国语|粤语|台配|中字|HD|BD|4K|1080P|720P|完整版|全集|中文|普通话)(版)?$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function pickGroup(detail) {
  const froms = String(detail.vod_play_from || "").split("$$$");
  const groups = String(detail.vod_play_url || "").split("$$$");
  let best = null;
  for (let i = 0; i < groups.length; i += 1) {
    const list = [];
    for (const part of String(groups[i] || "").split("#")) {
      const text = part.trim();
      if (!text) continue;
      const at = text.indexOf("$");
      const url = (at < 0 ? text : text.slice(at + 1)).trim();
      if (!/^https?:/i.test(url) || !/\.(m3u8|mp4)(\?|$)/i.test(url)) continue;
      list.push(url);
    }
    if (list.length && (!best || list.length > best.list.length)) {
      best = { from: froms[i] || "", list };
    }
  }
  return best;
}

function metaFor(name, type) {
  for (const rule of RULES) {
    if (rule.re.test(name)) return rule;
  }
  if (/纪录|记录/.test(type)) return { age: [6, 12], paths: ["path-science"], tags: ["纪录片"] };
  return { age: [3, 9], paths: ["path-language", "path-social"], tags: ["动画"] };
}

function stagesFor(paths, ageMin) {
  const stages = {};
  for (const id of paths) stages[id] = ageMin >= 9 ? 3 : ageMin >= 6 ? 2 : 1;
  return stages;
}

// 标题必须以白名单词开头，且只允许季/集/版本/衍生后缀。
function matchesTarget(target, name) {
  const t = norm(target);
  const n = norm(baseName(name));
  if (!t || !n) return false;
  if (n === t) return true;
  if (!n.startsWith(t)) return false;
  return n.length - t.length <= 12;
}

// 搜索阶段跳过响应过慢/超时的站点，播放时仍可用它们。
const SLOW = /^(apibd|guangsu|wujin|jyzy|huya|p2100)$/;

async function run() {
  const sites = (JSON.parse(await fs.readFile(path.join(ROOT, "data/backup_sites.json"), "utf8")).sites || [])
    .filter((site) => !SLOW.test(site.key));
  const curation = JSON.parse(await fs.readFile(path.join(ROOT, "data/curation.json"), "utf8"));
  let open = { series: [] };
  try {
    open = JSON.parse(await fs.readFile(path.join(ROOT, "data/open_catalog.json"), "utf8"));
  } catch (error) {
    open = { series: [], updatedAt: new Date().toISOString() };
  }

  const curatedBases = new Set();
  for (const item of curation.series || []) {
    const base = canon(item.name);
    if (base) curatedBases.add(base);
    for (const alias of item.aliases || []) {
      const aliasBase = canon(alias);
      if (aliasBase) curatedBases.add(aliasBase);
    }
  }
  const openNames = new Set((open.series || []).map((item) => canon(item.name)));

  const hitCache = new Map();
  const whitelistHits = (name) => {
    if (!hitCache.has(name)) hitCache.set(name, WHITELIST.some((target) => matchesTarget(target, name)));
    return hitCache.get(name);
  };

  const index = new Map();

  function addDetail(detail, site, groupName, origin) {
    const raw = String(detail.vod_name || "").trim();
    if (!raw) return;
    const name = baseName(raw);
    if (!name || BAD_NAME.test(name) || BLACK.test(name)) return;
    const type = String(detail.type_name || groupName || "");
    if (TYPE_BAD.test(type) || BLACK.test(type)) return;
    if (!TYPE_OK.test(type)) return;
    if (origin === "crawl" && /动画|动漫/.test(type) && !whitelistHits(name) && !KID_WORD.test(name)) return;
    if (origin === "crawl" && /纪录|记录/.test(type) && !whitelistHits(name)) return;
    const picked = pickGroup(detail);
    if (!picked) return;
    const key = canon(name);
    if (!key) return;
    if (!index.has(key)) {
      index.set(key, { name, type, year: "", pic: detail.vod_pic || "", sources: [], hit: whitelistHits(name) ? 1 : 0 });
    }
    const entry = index.get(key);
    if (!entry.pic && detail.vod_pic) entry.pic = detail.vod_pic;
    if (!entry.year && /^\d{4}/.test(String(detail.vod_year || ""))) entry.year = String(detail.vod_year).slice(0, 4);
    if (entry.sources.some((s) => s.key === site.key)) return;
    entry.sources.push({
      key: site.key,
      site: site.name,
      api: site.api,
      referer: site.referer,
      vodId: String(detail.vod_id),
      from: picked.from,
      episodes: picked.list.length,
    });
  }

  // 1) 白名单搜索
  const tasks = [];
  for (const name of WHITELIST) for (const site of sites) tasks.push({ name, site });
  console.log("白名单 " + WHITELIST.length + " 个 × " + sites.length + " 站 = " + tasks.length + " 次搜索");
  let searched = 0;
  await mapLimit(tasks, 30, async (task) => {
    try {
      const data = await getJson(
        task.site.api + (task.site.api.includes("?") ? "&" : "?") + "ac=detail&wd=" + encodeURIComponent(task.name),
        task.site.referer,
        1
      );
      for (const detail of Array.isArray(data.list) ? data.list : []) {
        if (matchesTarget(task.name, detail.vod_name)) addDetail(detail, task.site, "", "search");
      }
    } catch (error) { /* 搜索失败跳过 */ }
    searched += 1;
    if (searched % 500 === 0) process.stdout.write(".");
    return null;
  });
  process.stdout.write("\n");

  // 2) 分类页补充（只取动画/儿童/纪录片类）
  const classes = [];
  await mapLimit(sites, 4, async (site) => {
    try {
      const data = await getJson(site.api + (site.api.includes("?") ? "&" : "?") + "ac=list", site.referer, 1);
      for (const item of data.class || []) {
        const typeName = String(item.type_name || "");
        if (CRAWL_TYPES.test(typeName)) classes.push({ site, id: String(item.type_id), name: typeName });
      }
    } catch (error) { /* 站点不可用 */ }
    return null;
  });
  console.log("分类抓取 " + classes.length + " 个 × " + PAGES + " 页");
  await mapLimit(classes, 6, async (group) => {
    for (let page = 1; page <= PAGES; page += 1) {
      let data;
      try {
        data = await getJson(
          group.site.api + (group.site.api.includes("?") ? "&" : "?") + "ac=detail&t=" + encodeURIComponent(group.id) + "&pg=" + page,
          group.site.referer,
          1
        );
      } catch (error) {
        break;
      }
      const list = Array.isArray(data.list) ? data.list : [];
      if (!list.length) break;
      for (const detail of list) addDetail(detail, group.site, group.name, "crawl");
      if (data.page && data.pagecount && page >= Number(data.pagecount)) break;
      await sleep(60);
    }
    return null;
  });

  const takenBase = (name) => {
    const key = canon(name);
    if (!key) return true;
    if (openNames.has(key)) return true;
    for (const base of curatedBases) {
      if (key === base || key.startsWith(base)) return true;
    }
    return false;
  };

  const candidates = [...index.values()]
    .filter((item) => item.sources.length > 0 && !takenBase(item.name))
    .map((item) => {
      const sources = item.sources.sort((a, b) => b.episodes - a.episodes).slice(0, 6);
      return { ...item, sources, episodes: Math.max(...sources.map((s) => s.episodes)) };
    })
    .sort((a, b) => b.sources.length - a.sources.length || b.hit - a.hit || b.episodes - a.episodes);

  console.log("候选 " + candidates.length + " 条（3 源 " + candidates.filter((x) => x.sources.length >= 3).length + " 条）");

  const existing = open.series || [];
  // TARGET 指整个目录（名单 + 央视 + 采集站）的总条数。
  const openTarget = Math.max(0, TARGET - (curation.series || []).length);
  const room = Math.max(0, Math.min(BATCH, openTarget - existing.length));
  const picked = [];
  let order = existing.reduce((max, item) => Math.max(max, Number(item.order) || 0), 900000);

  for (const item of candidates) {
    if (picked.length >= room) break;
    const meta = metaFor(item.name, item.type);
    const paths = meta.paths.slice();
    order += 1;
    const sitesText = [...new Set(item.sources.map((s) => s.site))].join("、");
    picked.push({
      id: "mac-" + createHash("sha1").update(canon(item.name)).digest("hex").slice(0, 10),
      name: item.name,
      source: "mac",
      pic: item.pic,
      type: item.type,
      year: item.year,
      episodes: item.episodes,
      ageMin: meta.age[0],
      ageMax: meta.age[1],
      paths,
      stages: stagesFor(paths, meta.age[0]),
      tags: meta.tags.slice(),
      order,
      why: "采集站收录 " + item.episodes + " 集" + (item.sources.length > 1 ? "，共 " + item.sources.length + " 个播放源" : "") + "，可作补充资源。",
      list: ["采集站"],
      desc: (item.year ? item.year + " 年，" : "") + (item.type || "动画") + "，来自 " + sitesText + "。",
      backups: item.sources,
    });
  }

  open.series = existing.concat(picked);
  open.updatedAt = new Date().toISOString();
  await fs.writeFile(path.join(ROOT, "data/open_catalog.json"), JSON.stringify(open, null, 2) + "\n", "utf8");

  const with3 = open.series.filter((item) => (item.backups || []).length >= 3).length;
  console.log(
    "本次新增 " + picked.length + " 条，采集站总计 " + open.series.length + " 条（3 源 " + with3 + " 条），目标 " + openTarget + "（目录 " + TARGET + "）"
  );
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
