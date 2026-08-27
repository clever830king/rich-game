(function () {
  "use strict";

  // ===== 六档价格体系 =====
  // price：区域1购买价；区域2 = price*0.5
  // build：累计建造成本（第1..6级：店铺/商铺/旅馆/酒店/大厦/新城）
  // toll：基础地租（下标0=无建筑，1..6=对应建筑等级）
  const TIERS = [
    { price: 400,  build: [300, 560, 1040, 1760, 2720, 4000],    toll: [80, 160, 260, 400, 580, 820, 1140] },
    { price: 800,  build: [600, 1120, 2080, 3520, 5440, 8000],   toll: [160, 320, 520, 800, 1160, 1640, 2280] },
    { price: 1200, build: [900, 1680, 3120, 5280, 8160, 12000],  toll: [240, 480, 780, 1200, 1740, 2460, 3420] },
    { price: 1600, build: [1200, 2240, 4160, 7040, 10880, 16000], toll: [320, 640, 1040, 1600, 2320, 3280, 4560] },
    { price: 2000, build: [1500, 2800, 5200, 8800, 13600, 20000], toll: [400, 800, 1300, 2000, 2900, 4100, 5700] },
    { price: 2400, build: [1800, 3360, 6240, 10560, 16320, 24000],toll: [480, 960, 1560, 2400, 3480, 4920, 6840] }
  ];

  // 按 GDP（亿元）定档：1 区域与 2 区域阈值不同
  function tierOf(gdp, regionCount) {
    if (regionCount >= 2) {
      if (gdp < 800) return 0;
      if (gdp < 1600) return 1;
      if (gdp < 2400) return 2;
      if (gdp < 3200) return 3;
      if (gdp < 4000) return 4;
      return 5;
    }
    if (gdp < 400) return 0;
    if (gdp < 800) return 1;
    if (gdp < 1200) return 2;
    if (gdp < 1600) return 3;
    if (gdp < 2000) return 4;
    return 5;
  }

  const BUILD_NAMES = ["", "店铺", "商铺", "旅馆", "酒店", "大厦", "新城"];
  // 同城拥有地块数量加成：1个=1.0，2个=1.2，3个=1.6，4个=2.0，5个及以上=2.4
  const CITY_BONUS = [1, 1.2, 1.6, 2.0, 2.4];
  const CITY_LIST = ["湖州", "嘉兴", "绍兴", "杭州", "严州", "衢州", "金华", "丽水", "温州", "台州", "宁波", "舟山"];

  // ===== 6 张特殊卡（卡牌补给站随机获得）=====
  const CARDS = [
    { id: "reverse", name: "逆向卡", desc: "随机一名玩家（含自己）逆向移动 3 回合" },
    { id: "boss", name: "霸王卡", desc: "下一次踩到他人地块时，可免除一次过路费" },
    { id: "stop", name: "停留卡", desc: "自己额外停留/行动一次（非暂停，不重复收费）" },
    { id: "cheat", name: "作弊卡", desc: "本回合自选骰子点数 1–6" },
    { id: "blast", name: "爆破卡", desc: "对自己脚下地块：有建筑降 3 级，无建筑区域 -1" },
    { id: "remove", name: "拆除卡", desc: "远程：其他玩家一个有建筑的地块，建筑降 1 级" }
  ];

  // ===== 命运（不可控，抽到立即执行）=====
  // type: stop / money（amount 正=获得，负=损失）/ back3 / gainCard / loseCard
  const FATE = [
    { name: "梅雨季来了", type: "stop", desc: "连续阴雨打乱行程，暂停 1 回合" },
    { name: "杭州炒房失败", type: "money", amount: -2500, desc: "高价投资房产失败，损失 ¥2500" },
    { name: "舟山台风", type: "money", amount: -1500, desc: "港口关闭，损失 ¥1500" },
    { name: "雁荡山封路", type: "back3", desc: "景区封路，向后移动 3 格" },
    { name: "绍兴黄酒破损", type: "money", amount: -1200, desc: "运输破损，损失 ¥1200" },
    { name: "千岛湖涨价", type: "money", amount: -1000, desc: "旺季涨价，损失 ¥1000" },
    { name: "南浔古镇爆红", type: "money", amount: 1800, desc: "生意爆红，获得 ¥1800" },
    { name: "宁波港顺风", type: "money", amount: 2000, desc: "货物提前抵达，获得 ¥2000" },
    { name: "义乌订单暴涨", type: "money", amount: 1500, desc: "订单暴涨，获得 ¥1500" },
    { name: "天台山祈福", type: "money", amount: 1000, desc: "祈福好运，获得 ¥1000" },
    { name: "乌镇拾得卡包", type: "gainCard", desc: "在乌镇偶得一张特殊卡牌" },
    { name: "绍兴行李丢失", type: "loseCard", fallback: -800, desc: "行李丢失，随机失去一张卡牌" },
    { name: "义乌赠品卡", type: "gainCard", desc: "收到义乌商户赠卡一张" },
    { name: "台风卷走卡牌", type: "loseCard", fallback: -1000, desc: "台风卷走一张卡牌" }
  ];

  // ===== 机会（把握/放弃 + 机会骰子：奇数失败、偶数成功）=====
  // invest：把握所需投资；win/lose：成功/失败的金钱变化
  // winCard / loseCard：成功/失败时随机获得/失去的特殊卡数量（失去时若无卡则改为 lose 金钱）
  const OPPORTUNITY = [
    { name: "义乌小商品进货", invest: 1000, win: 3000, lose: 1000 },
    { name: "宁波港临时订单", invest: 0, win: 2500, lose: 500 },
    { name: "温州商人合作", invest: 1500, win: 3500, lose: 1500 },
    { name: "杭州旅游项目", invest: 2000, win: 4500, lose: 2000 },
    { name: "嘉兴特产批发", invest: 800, win: 2000, lose: 800 },
    { name: "绍兴黄酒代理", invest: 600, win: 1800, lose: 600 },
    { name: "千岛湖民宿投资", invest: 1200, win: 2800, lose: 1200 },
    { name: "舟山海鲜市场", invest: 500, win: 1500, lose: 500 },
    { name: "丽水旅游开发", invest: 1000, win: 2500, lose: 1000 },
    { name: "浙江创业大奖", invest: 2000, win: 5000, lose: 2000 },
    { name: "卡牌商人进货", invest: 500, win: 1200, lose: 500, winCard: 1 },
    { name: "神秘卡包", invest: 800, win: 1000, lose: 800, winCard: 2, loseCard: 1 }
  ];

  // ===== 地图：62 格（50 城市地块 + 12 功能格）=====
  // t: start / prop / fate / opportunity / empty / jail / card
  // prop 字段：city、name、regions（区域显示名）、gdp（亿元，用于定档）、composition（市区组成说明，可选）
  const BOARD_RAW = [
    { t: "start", id: "A", name: "起点·右下", desc: "经过或到达可获得奖金" },
    { t: "prop", city: "湖州", name: "长兴", regions: ["长兴"], gdp: 1000.90 },
    { t: "prop", city: "湖州", name: "湖州市区", regions: ["湖州市区"], gdp: 1374.00, composition: "吴兴区" },
    { t: "prop", city: "湖州", name: "南浔", regions: ["南浔"], gdp: 622.40 },
    { t: "prop", city: "湖州", name: "德清·安吉", regions: ["德清", "安吉"], gdp: 1458.00 },
    { t: "fate", name: "命运" },
    { t: "prop", city: "嘉兴", name: "桐乡", regions: ["桐乡"], gdp: 1401.60 },
    { t: "prop", city: "嘉兴", name: "海宁", regions: ["海宁"], gdp: 1438.37 },
    { t: "prop", city: "嘉兴", name: "海盐", regions: ["海盐"], gdp: 751.50 },
    { t: "prop", city: "嘉兴", name: "秀洲·南湖", regions: ["秀洲", "南湖"], gdp: 2131.78 },
    { t: "prop", city: "嘉兴", name: "平湖·嘉善", regions: ["平湖", "嘉善"], gdp: 2128.10 },
    { t: "empty", name: "空地" },
    { t: "prop", city: "绍兴", name: "越城·柯桥", regions: ["越城", "柯桥"], gdp: 3901.01 },
    { t: "prop", city: "绍兴", name: "上虞", regions: ["上虞"], gdp: 1463.61 },
    { t: "prop", city: "绍兴", name: "嵊州·新昌", regions: ["嵊州", "新昌"], gdp: 1564.91 },
    { t: "prop", city: "绍兴", name: "诸暨", regions: ["诸暨"], gdp: 2002.60 },
    { t: "fate", name: "命运" },
    { t: "prop", city: "杭州", name: "萧山·滨江", regions: ["萧山", "滨江"], gdp: 5543.94 },
    { t: "prop", city: "杭州", name: "杭州市区", regions: ["杭州市区"], gdp: 9114.18, composition: "上城+拱墅+西湖+钱塘" },
    { t: "prop", city: "杭州", name: "余杭·临平", regions: ["余杭", "临平"], gdp: 4784.34 },
    { t: "prop", city: "杭州", name: "富阳", regions: ["富阳"], gdp: 1034.13 },
    { t: "prop", city: "杭州", name: "临安", regions: ["临安"], gdp: 730.45 },
    { t: "jail", name: "乔司监狱" },
    { t: "prop", city: "严州", name: "桐庐", regions: ["桐庐"], gdp: 517.78 },
    { t: "prop", city: "严州", name: "建德", regions: ["建德"], gdp: 460.56 },
    { t: "prop", city: "严州", name: "淳安·千岛湖", regions: ["淳安·千岛湖"], gdp: 306.10 },
    { t: "empty", name: "空地" },
    { t: "prop", city: "衢州", name: "龙游", regions: ["龙游"], gdp: 358.60 },
    { t: "prop", city: "衢州", name: "柯城·衢江", regions: ["柯城", "衢江"], gdp: 1139.69 },
    { t: "prop", city: "衢州", name: "常山·开化", regions: ["常山", "开化"], gdp: 451.80 },
    { t: "prop", city: "衢州", name: "江山", regions: ["江山"], gdp: 451.56 },
    { t: "start", id: "B", name: "起点·左上", desc: "经过或到达可获得奖金" },
    { t: "prop", city: "金华", name: "金华市区·兰溪", regions: ["金华市区", "兰溪"], gdp: 1919.33, composition: "婺城+金东 / 兰溪" },
    { t: "prop", city: "金华", name: "义乌·浦江", regions: ["义乌", "浦江"], gdp: 3034.74 },
    { t: "prop", city: "金华", name: "东阳·磐安", regions: ["东阳", "磐安"], gdp: 1059.40 },
    { t: "prop", city: "金华", name: "永康·武义", regions: ["永康", "武义"], gdp: 1300.02 },
    { t: "fate", name: "命运" },
    { t: "prop", city: "丽水", name: "丽水市区·缙云", regions: ["丽水市区", "缙云"], gdp: 980.64, composition: "莲都 / 缙云" },
    { t: "prop", city: "丽水", name: "青田", regions: ["青田"], gdp: 340.98 },
    { t: "prop", city: "丽水", name: "云和·景宁", regions: ["云和", "景宁"], gdp: 253.53 },
    { t: "prop", city: "丽水", name: "龙泉·庆元", regions: ["龙泉", "庆元"], gdp: 337.01 },
    { t: "prop", city: "丽水", name: "遂昌·松阳", regions: ["遂昌", "松阳"], gdp: 389.30 },
    { t: "empty", name: "空地" },
    { t: "prop", city: "温州", name: "文成·泰顺", regions: ["文成", "泰顺"], gdp: 379.06 },
    { t: "prop", city: "温州", name: "苍南·龙港", regions: ["苍南", "龙港"], gdp: 1050.72 },
    { t: "prop", city: "温州", name: "瑞安·平阳", regions: ["瑞安", "平阳"], gdp: 2346.45 },
    { t: "prop", city: "温州", name: "温州市区·洞头", regions: ["温州市区", "洞头"], gdp: 3871.10, composition: "鹿城+龙湾+瓯海 / 洞头" },
    { t: "prop", city: "温州", name: "乐清·永嘉", regions: ["乐清", "永嘉"], gdp: 2575.70 },
    { t: "opportunity", name: "机会" },
    { t: "prop", city: "台州", name: "温岭·玉环", regions: ["温岭", "玉环"], gdp: 2315.84 },
    { t: "prop", city: "台州", name: "台州市区", regions: ["台州市区"], gdp: 2487.95, composition: "椒江+黄岩+路桥" },
    { t: "prop", city: "台州", name: "临海·仙居", regions: ["临海", "仙居"], gdp: 1389.21 },
    { t: "prop", city: "台州", name: "天台·三门", regions: ["天台", "三门"], gdp: 813.16 },
    { t: "card", name: "卡牌补给站" },
    { t: "prop", city: "宁波", name: "宁海·象山", regions: ["宁海", "象山"], gdp: 2104.53 },
    { t: "prop", city: "宁波", name: "余姚·慈溪", regions: ["余姚", "慈溪"], gdp: 4746.90 },
    { t: "prop", city: "宁波", name: "宁波市区·奉化", regions: ["宁波市区", "奉化"], gdp: 7111.50, composition: "海曙+江北+鄞州 / 奉化" },
    { t: "prop", city: "宁波", name: "北仑·镇海", regions: ["北仑", "镇海"], gdp: 4752.48 },
    { t: "empty", name: "空地" },
    { t: "prop", city: "舟山", name: "定海", regions: ["定海"], gdp: 839.20 },
    { t: "prop", city: "舟山", name: "岱山", regions: ["岱山"], gdp: 809.40 },
    { t: "prop", city: "舟山", name: "嵊泗", regions: ["嵊泗"], gdp: 180.20 }
  ];

  // 加工：补全 index、tier、regionCount、regionPrices、price
  const BOARD = BOARD_RAW.map(function (c, i) {
    c.index = i;
    if (c.t === "prop") {
      c.regionCount = c.regions.length;
      c.tier = tierOf(c.gdp, c.regionCount);
      const t = TIERS[c.tier];
      c.price = t.price;
      c.build = t.build;
      c.toll = t.toll;
      c.regionPrices = c.regions.map(function (_, k) { return k === 0 ? t.price : Math.round(t.price * 0.5); });
    }
    return c;
  });

  window.ZT = {
    TIERS: TIERS,
    BUILD_NAMES: BUILD_NAMES,
    CITY_BONUS: CITY_BONUS,
    CITY_LIST: CITY_LIST,
    CARDS: CARDS,
    FATE: FATE,
    OPPORTUNITY: OPPORTUNITY,
    BOARD: BOARD,
    START_REWARD: 3000,
    DEFAULT_MONEY: 15000,
    MAX_PLAYERS: 6
  };
})();
