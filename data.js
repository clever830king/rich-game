// 《浙江之旅》地图与规则常量
(function () {
  "use strict";

  // 城市 → 档位（0=第一档 … 3=第四档）
  const CITY_TIER = {
    "杭州": 0, "宁波": 0, "绍兴": 0,
    "舟山": 1, "嘉兴": 1, "温州": 1,
    "金华": 2, "湖州": 2, "台州": 2,
    "严州": 3, "丽水": 3, "衢州": 3
  };

  // 四档：土地累计价、建筑累计价、基础过路费（无建筑/店铺/商铺/旅馆/酒店/大厦）
  const TIERS = [
    { land: [1200, 1800, 2400], build: [1000, 1600, 2500, 3700, 5500], toll: [300, 600, 1000, 1600, 2500, 4000] },
    { land: [1000, 1500, 2000], build: [800, 1300, 2000, 3000, 4500], toll: [250, 500, 850, 1400, 2200, 3500] },
    { land: [800, 1200, 1600], build: [650, 1050, 1600, 2400, 3600], toll: [200, 400, 700, 1100, 1800, 3000] },
    { land: [600, 900, 1200], build: [500, 800, 1200, 1800, 2700], toll: [150, 300, 550, 900, 1500, 2500] }
  ];

  // 同城普通地产数量加成（1..5 个）
  const CITY_BONUS = [1, 1.2, 1.6, 2.0, 2.4];
  // 特色地块收集加成（拥有 n 个，倍率 = 1 + (n-1)*0.2，n 限制在 1..12）
  function specialMult(n) { return 1 + (Math.min(12, Math.max(1, n)) - 1) * 0.2; }

  const BUILD_NAMES = ["", "店铺", "商铺", "旅馆", "酒店", "大厦"];

  const CARDS = [
    { id: "reverse", name: "逆向卡", desc: "随机一名玩家（含自己）逆向移动 3 回合" },
    { id: "boss", name: "霸王卡", desc: "使用后 3 回合内免一次地产过路费，用过即消" },
    { id: "stop", name: "停留卡", desc: "随机一名玩家（含自己）停留 1 回合" },
    { id: "cheat", name: "作弊卡", desc: "本回合自选骰子点数 1–6" },
    { id: "blast", name: "爆破卡", desc: "仅对自己脚下地块：有建筑降 3 级，无建筑区域 -1" },
    { id: "remove", name: "拆除卡", desc: "远程：其他玩家一个有建筑的大地块，建筑降 1 级" }
  ];

  // 命运卡（无选择，立即执行） type: stop / lose / gain / back3
  const FATE = [
    { name: "梅雨季来了", type: "stop", desc: "连续阴雨打乱行程，暂停 1 回合" },
    { name: "杭州炒房失败", type: "lose", amount: 2500, desc: "高价投资房产失败，损失 ¥2500" },
    { name: "舟山台风", type: "lose", amount: 1500, desc: "港口关闭，损失 ¥1500" },
    { name: "雁荡山封路", type: "back3", desc: "景区封路，向后移动 3 格" },
    { name: "绍兴黄酒破损", type: "lose", amount: 1200, desc: "运输破损，损失 ¥1200" },
    { name: "千岛湖涨价", type: "lose", amount: 1000, desc: "旺季涨价，损失 ¥1000" },
    { name: "南浔古镇爆红", type: "gain", amount: 1800, desc: "生意爆红，获得 ¥1800" },
    { name: "宁波港顺风", type: "gain", amount: 2000, desc: "货物提前抵达，获得 ¥2000" },
    { name: "义乌订单暴涨", type: "gain", amount: 1500, desc: "订单暴涨，获得 ¥1500" },
    { name: "天台山祈福", type: "gain", amount: 1000, desc: "祈福好运，获得 ¥1000" }
  ];

  // 机会卡（可选择把握/放弃；把握后掷机会骰子，偶数成功、奇数失败）
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
    { name: "浙江创业大奖", invest: 2000, win: 5000, lose: 2000 }
  ];

  // 特色地块：购买价 = 最贵一档（第一档）的空地价格（土地价 ¥1200）
  const SPECIAL_PRICE = TIERS[0].land[0];

  // 地图：62 格，按顺时针顺序
  // 格类型：start / prop / special / jail / card / chance / empty
  const BOARD_RAW = [
    { t: "start", id: "A", name: "起点·右下" },
    { t: "prop", city: "湖州", name: "长兴", regions: ["长兴"] },
    { t: "prop", city: "湖州", name: "湖州", regions: ["湖州"] },
    { t: "special", city: "湖州", name: "南浔古镇" },
    { t: "prop", city: "湖州", name: "德清 / 安吉", regions: ["德清", "安吉"] },
    { t: "fate", name: "命运" },
    { t: "prop", city: "嘉兴", name: "海宁 / 桐乡", regions: ["海宁", "桐乡"] },
    { t: "special", city: "嘉兴", name: "皮革城" },
    { t: "prop", city: "嘉兴", name: "嘉兴市区 / 海盐", regions: ["嘉兴市区", "海盐"] },
    { t: "prop", city: "嘉兴", name: "平湖 / 嘉善", regions: ["平湖", "嘉善"] },
    { t: "empty", name: "空地" },
    { t: "prop", city: "绍兴", name: "绍兴市区 / 上虞 / 柯桥", regions: ["绍兴市区", "上虞", "柯桥"] },
    { t: "special", city: "绍兴", name: "会稽山" },
    { t: "prop", city: "绍兴", name: "嵊州 / 新昌", regions: ["嵊州", "新昌"] },
    { t: "prop", city: "绍兴", name: "诸暨", regions: ["诸暨"] },
    { t: "opportunity", name: "机会" },
    { t: "prop", city: "杭州", name: "萧山 / 滨江", regions: ["萧山", "滨江"] },
    { t: "prop", city: "杭州", name: "杭州市区 / 西湖 / 拱墅", regions: ["杭州市区", "西湖", "拱墅"] },
    { t: "special", city: "杭州", name: "西溪湿地" },
    { t: "prop", city: "杭州", name: "余杭 / 临平 / 临安", regions: ["余杭", "临平", "临安"] },
    { t: "prop", city: "杭州", name: "富阳 / 新登", regions: ["富阳", "新登"] },
    { t: "jail", name: "乔司监狱" },
    { t: "prop", city: "严州", name: "桐庐 / 分水", regions: ["桐庐", "分水"] },
    { t: "prop", city: "严州", name: "建德 / 寿昌", regions: ["建德", "寿昌"] },
    { t: "special", city: "严州", name: "千岛湖" },
    { t: "prop", city: "严州", name: "淳安 / 遂安", regions: ["淳安", "遂安"] },
    { t: "empty", name: "空地" },
    { t: "prop", city: "衢州", name: "龙游", regions: ["龙游"] },
    { t: "prop", city: "衢州", name: "衢州市区 / 衢江", regions: ["衢州市区", "衢江"] },
    { t: "special", city: "衢州", name: "江郎山" },
    { t: "prop", city: "衢州", name: "江山 / 常山 / 开化", regions: ["江山", "常山", "开化"] },
    { t: "start", id: "B", name: "起点·左上" },
    { t: "prop", city: "金华", name: "金华市区 / 兰溪", regions: ["金华市区", "兰溪"] },
    { t: "prop", city: "金华", name: "义乌 / 浦江", regions: ["义乌", "浦江"] },
    { t: "special", city: "金华", name: "小商品城" },
    { t: "prop", city: "金华", name: "东阳 / 磐安", regions: ["东阳", "磐安"] },
    { t: "prop", city: "金华", name: "永康", regions: ["永康"] },
    { t: "fate", name: "命运" },
    { t: "prop", city: "丽水", name: "遂昌 / 松阳", regions: ["遂昌", "松阳"] },
    { t: "prop", city: "丽水", name: "云和 / 龙泉 / 庆元", regions: ["云和", "龙泉", "庆元"] },
    { t: "special", city: "丽水", name: "畲乡景宁" },
    { t: "prop", city: "丽水", name: "丽水市区 / 缙云 / 青田", regions: ["丽水市区", "缙云", "青田"] },
    { t: "empty", name: "空地" },
    { t: "prop", city: "温州", name: "文成 / 泰顺", regions: ["文成", "泰顺"] },
    { t: "prop", city: "温州", name: "苍南 / 龙港 / 平阳", regions: ["苍南", "龙港", "平阳"] },
    { t: "special", city: "温州", name: "雁荡山" },
    { t: "prop", city: "温州", name: "温州市区 / 瑞安 / 乐清", regions: ["温州市区", "瑞安", "乐清"] },
    { t: "opportunity", name: "机会" },
    { t: "prop", city: "台州", name: "温岭 / 玉环", regions: ["温岭", "玉环"] },
    { t: "prop", city: "台州", name: "台州市区 / 临海", regions: ["台州市区", "临海"] },
    { t: "special", city: "台州", name: "天台山" },
    { t: "prop", city: "台州", name: "天台 / 三门 / 仙居", regions: ["天台", "三门", "仙居"] },
    { t: "card", name: "卡牌补给站" },
    { t: "prop", city: "宁波", name: "宁海 / 象山", regions: ["宁海", "象山"] },
    { t: "prop", city: "宁波", name: "余姚 / 慈溪", regions: ["余姚", "慈溪"] },
    { t: "special", city: "宁波", name: "北仑港" },
    { t: "prop", city: "宁波", name: "宁波市区 / 镇海 / 奉化", regions: ["宁波市区", "镇海", "奉化"] },
    { t: "empty", name: "空地" },
    { t: "prop", city: "舟山", name: "舟山市区 / 普陀", regions: ["舟山市区", "普陀"] },
    { t: "special", city: "舟山", name: "普陀山" },
    { t: "prop", city: "舟山", name: "岱山", regions: ["岱山"] },
    { t: "prop", city: "舟山", name: "嵊泗", regions: ["嵊泗"] }
  ];

  // 加工：补全 tier、regionCount、价格、过路费
  const BOARD = BOARD_RAW.map(function (c, i) {
    c.index = i;
    if (c.t === "prop") {
      c.tier = CITY_TIER[c.city];
      c.regionCount = c.regions.length;
      c.land = TIERS[c.tier].land;
      c.build = TIERS[c.tier].build;
      c.toll = TIERS[c.tier].toll;
    } else if (c.t === "special") {
      c.tier = CITY_TIER[c.city];
      c.baseToll = TIERS[0].toll[0]; // 特色地块收入基础 = 最贵一档的无建筑地租（¥300）
    }
    return c;
  });

  window.ZT = {
    CITY_TIER: CITY_TIER,
    TIERS: TIERS,
    CITY_BONUS: CITY_BONUS,
    specialMult: specialMult,
    BUILD_NAMES: BUILD_NAMES,
    CARDS: CARDS,
    FATE: FATE,
    OPPORTUNITY: OPPORTUNITY,
    SPECIAL_PRICE: SPECIAL_PRICE,
    BOARD: BOARD,
    START_REWARD: 3000,
    DEFAULT_MONEY: 15000,
    MAX_PLAYERS: 6
  };
})();
