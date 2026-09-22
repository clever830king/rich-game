(function (root) {
  "use strict";
  const KEYS = ["initialMoney", "startReward", "startCards", "cityBonusStep"];
  const PRESETS = [
    { id: "balanced", name: "均衡朋友局", label: "均衡朋友局（推荐）", description: "适合 3～4 人。留出买地和建设资金，降低起点补贴；每人 1 张卡，让开局多一个策略选择。", settings: { initialMoney: 12000, startReward: 2000, startCards: 1, cityBonusStep: 0.3 } },
    { id: "competitive", name: "紧凑竞争局", label: "紧凑竞争局", description: "适合熟悉规则的玩家。起步资金更紧，同城经营收益更高；不发开局卡，减少额外变现资金。仍可能进行较长时间。", settings: { initialMoney: 10000, startReward: 2000, startCards: 0, cityBonusStep: 0.4 } },
    { id: "classic", name: "原版经典局", label: "原版经典局", description: "恢复 v1.7 的四项默认经济设置。资金和起点补贴较充足，适合愿意慢慢经营的玩家。", settings: { initialMoney: 15000, startReward: 3000, startCards: 0, cityBonusStep: 0.2 } }
  ];
  function find(id) { return PRESETS.find(p => p.id === id) || null; }
  function match(settings) { return PRESETS.find(p => KEYS.every(k => Number(settings[k]) === p.settings[k])) || null; }
  function apply(room, playerId, id) {
    if (!room || room.status !== "waiting" || room.host !== playerId) return { error: "只有房主能在开局前修改规则" };
    const preset = find(id);
    if (!preset) return { error: "请选择有效方案" };
    KEYS.forEach(k => { room.settings[k] = preset.settings[k]; });
    room.seq++;
    return { ok: true, name: preset.name };
  }
  function summary(settings) {
    return "初始 ¥" + Number(settings.initialMoney).toLocaleString("zh-CN") + " · 起点 ¥" + Number(settings.startReward).toLocaleString("zh-CN") +
      " · 开局 " + settings.startCards + " 张卡 · 同城每多一块 +" + Math.round(Number(settings.cityBonusStep) * 100) + "%";
  }
  function capacityError(room) {
    const ai = Number(room.settings.aiCount || 0), max = Number(room.settings.maxPlayers), count = room.players.length + ai;
    if (!Number.isInteger(ai) || ai < 0 || ai > 5 || !Number.isInteger(max) || max < 2 || max > 6) return "请设置 2～6 人上限和 0～5 名电脑玩家。";
    if (count > max || count > 6) return "当前 " + room.players.length + " 名真人 + " + ai + " 名电脑，共 " + count + " 人，超过 " + Math.min(max, 6) + " 人上限。请减少电脑或调整上限。";
    return count < 2 ? "至少需要 2 名玩家；可等待朋友加入，或添加 1 名电脑。" : "";
  }
  function advice(room) {
    const s = room.settings, count = room.players.length + Number(s.aiCount || 0), tips = [];
    if (count >= 5) tips.push("5～6 人等待更久；均衡朋友局建议总人数控制在 3～4 人。");
    if (s.startCards >= 2) tips.push("每人开局卡可抵押约 ¥" + (s.startCards * 5000).toLocaleString("zh-CN") + "，可能明显延长对局。");
    if (s.startReward >= 5000) tips.push("起点奖励较高，现金补充更快，破产出局通常更难。");
    if (s.cityBonusStep >= 0.4) tips.push("同城连片收益更高，领先玩家的收费压力也更大。");
    return tips;
  }
  const api = { PRESETS, KEYS, find, match, apply, summary, capacityError, advice };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ZTPresets = api;
})(typeof window === "undefined" ? globalThis : window);
