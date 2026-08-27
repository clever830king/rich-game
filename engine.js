(function () {
  "use strict";

  const ZT = window.ZT;
  const BOARD = ZT.BOARD;
  const N = BOARD.length;
  const CARDS = ZT.CARDS;
  const BUILD_NAMES = ZT.BUILD_NAMES;
  const START_REWARD = ZT.START_REWARD;
  const TOKENS = [
    "🎩", "👑", "💎", "💰", "🎲", "⭐", "🔥", "🌊", "🏯", "🏰", "🗼", "🌸", "🍀", "🎵", "🎁", "🚀",
    "🛸", "⚡", "❄️", "🌙", "☀️", "🌈", "🎈", "🏆", "🎯", "🎮", "🎨", "📷", "🎬", "📚", "💡", "🔔",
    "⚙️", "🧭", "⏰", "⌚", "📱", "💻", "🚗", "✈️", "⛵", "🎡", "🍵", "☕", "🛰️", "🕹️", "🎤", "🥁"
  ];

  function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-3); }
  function roomCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let s = "";
    for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }
  function die() { return 1 + Math.floor(Math.random() * 6); }
  function moveDie() { return 1 + Math.floor(Math.random() * 12); }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function log(room, text) { room.log.unshift({ t: Date.now(), text: text }); if (room.log.length > 300) room.log.length = 300; }
  function cardName(id) { const c = CARDS.find(function (x) { return x.id === id; }); return c ? c.name : id; }
  function randomCardId() { return rand(CARDS).id; }

  function newRoom(hostName, settings) {
    settings = settings || {};
    const host = {
      id: uid(),
      name: String(hostName || "房主").slice(0, 12),
      token: (settings.token || TOKENS[0]),
      money: 0,
      pos: 0,
      start: "A",
      cards: [],
      reverse: 0,
      jailSkip: 0,
      paused: 0,
      boss: 0,
      bankrupt: false,
      secret: uid()
    };
    const room = {
      code: roomCode(),
      host: host.id,
      status: "waiting",
      settings: {
        initialMoney: clamp(parseInt(settings.initialMoney, 10) || ZT.DEFAULT_MONEY, 1000, 100000),
        maxPlayers: clamp(parseInt(settings.maxPlayers, 10) || 6, 2, 6),
        startCards: clamp(parseInt(settings.startCards, 10) || 0, 0, 5),
        cityBonusStep: [0.2, 0.3, 0.4, 0.5].indexOf(parseFloat(settings.cityBonusStep)) >= 0 ? parseFloat(settings.cityBonusStep) : 0.2,
        startReward: clamp(parseInt(settings.startReward, 10) || START_REWARD, 0, 100000),
        aiCount: clamp(parseInt(settings.aiCount, 10) || 0, 0, 5),
        sound: settings.sound !== false,
        anim: settings.anim || "fast"
      },
      players: [host],
      props: initProps(),
      turn: 0,
      rolled: false,
      turnStartedAt: 0,
      landingStartedAt: 0,
      phase: "waiting",
      pending: null,
      pendingCheat: null,
      dice: null,
      jailRoll: null,
      log: [],
      chat: [],
      winner: null,
      seq: 0
    };
    log(room, "房间创建成功，等待玩家加入…");
    return room;
  }

  function initProps() {
    const props = {};
    BOARD.forEach(function (c) {
      if (c.t === "prop") props[c.index] = { owner: null, regionsOwned: 0, buildingLevel: 0 };
    });
    return props;
  }

  function playerById(room, id) { return room.players.find(function (p) { return p.id === id; }); }
  function currentPlayer(room) { return room.players[room.turn]; }

  function join(room, name, token) {
    if (room.status !== "waiting") return { error: "游戏已开始" };
    if (room.players.length >= room.settings.maxPlayers) return { error: "房间已满" };
    name = String(name || "").trim().slice(0, 12) || ("玩家" + (room.players.length + 1));
    if (room.players.some(function (p) { return p.name === name; })) return { error: "该名字已被占用" };
    const p = {
      id: uid(),
      name: name,
      token: token || TOKENS[room.players.length % TOKENS.length],
      money: 0,
      pos: 0,
      start: "A",
      cards: [],
      reverse: 0,
      jailSkip: 0,
      paused: 0,
      boss: 0,
      bankrupt: false,
      secret: uid()
    };
    room.players.push(p);
    log(room, name + " 加入房间");
    room.seq++;
    return { player: p };
  }

  function setupPlayer(room, p, idxB) {
    const st = Math.random() < 0.5 ? "A" : "B";
    p.start = st;
    p.pos = st === "A" ? 0 : idxB;
    p.money = room.settings.initialMoney;
    p.cards = [];
    for (let k = 0; k < (room.settings.startCards || 0); k++) p.cards.push(randomCardId());
    p.reverse = 0; p.jailSkip = 0; p.paused = 0; p.boss = 0; p.bankrupt = false;
  }

  function start(room) {
    const aiCount = room.settings.aiCount || 0;
    if (room.status !== "waiting" || (room.players.length + aiCount) < 2) return false;
    const idxB = BOARD.findIndex(function (c) { return c.t === "start" && c.id === "B"; });
    room.players.forEach(function (p) { setupPlayer(room, p, idxB); });
    const aiNames = ["小智", "小灵", "小慧", "小强", "小美"];
    for (let i = 0; i < aiCount; i++) {
      const ai = {
        id: uid(),
        name: "AI·" + (aiNames[i] || ("机器人" + (i + 1))),
        token: TOKENS[(room.players.length + i) % TOKENS.length],
        isAI: true,
        money: 0, pos: 0, start: "A", cards: [], reverse: 0, jailSkip: 0, paused: 0, boss: 0, bankrupt: false, secret: uid()
      };
      setupPlayer(room, ai, idxB);
      room.players.push(ai);
    }
    for (let i = room.players.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = room.players[i]; room.players[i] = room.players[j]; room.players[j] = t;
    }
    room.status = "playing";
    room.phase = "action";
    room.turn = 0;
    room.rolled = false;
    room.turnStartedAt = Date.now();
    room.landingStartedAt = 0;
    room.seq++;
    log(room, "游戏开始！每人初始资金 ¥" + room.settings.initialMoney);
    if (aiCount > 0) log(room, "已加入 " + aiCount + " 名 AI 玩家");
    log(room, "轮到 " + currentPlayer(room).name);
    return true;
  }

  // ===== 价格 / 加成计算 =====
  function landPaid(cell, pr) {
    let s = 0;
    for (let k = 0; k < pr.regionsOwned; k++) s += cell.regionPrices[k];
    return s;
  }
  function buildPaid(cell, pr) {
    return pr.buildingLevel > 0 ? cell.build[pr.buildingLevel - 1] : 0;
  }
  function nextRegionCost(cell, pr) {
    return pr.regionsOwned < cell.regionCount ? cell.regionPrices[pr.regionsOwned] : null;
  }
  function buildCost(cell, from, to) {
    return (to > 0 ? cell.build[to - 1] : 0) - (from > 0 ? cell.build[from - 1] : 0);
  }
  function mortgageValue(cell, pr) {
    return Math.round((landPaid(cell, pr) + buildPaid(cell, pr)) * 0.5);
  }

  function cityOwnedCount(room, ownerId, city) {
    let n = 0;
    BOARD.forEach(function (c) {
      if (c.t === "prop" && c.city === city) {
        const pr = room.props[c.index];
        if (pr && pr.owner === ownerId) n++;
      }
    });
    return n;
  }

  function newTownCount(room) {
    let n = 0;
    BOARD.forEach(function (c) {
      if (c.t === "prop") {
        const pr = room.props[c.index];
        if (pr && pr.buildingLevel >= 6) n++;
      }
    });
    return n;
  }
  function newTownMultiplier(room) { return 1 + newTownCount(room) * 0.5; }

  function propToll(room, cell) {
    const pr = room.props[cell.index];
    if (!pr || !pr.owner) return 0;
    const base = cell.toll[pr.buildingLevel];
    const cnt = cityOwnedCount(room, pr.owner, cell.city);
    const step = room.settings.cityBonusStep != null ? room.settings.cityBonusStep : 0.2;
    const cityMult = 1 + Math.max(0, cnt - 1) * step;
    const ntMult = newTownMultiplier(room);
    return Math.round(base * cityMult * ntMult);
  }
  function tollOf(room, cell) { return propToll(room, cell); }

  // ===== 移动 =====
  function moveBy(room, p, steps, reverse) {
    const dir = reverse ? -1 : 1;
    const path = [];
    let reward = 0;
    const sr = room.settings.startReward != null ? room.settings.startReward : START_REWARD;
    for (let k = 0; k < steps; k++) {
      p.pos = (p.pos + dir + N) % N;
      path.push(p.pos);
      const c = BOARD[p.pos];
      if (c.t === "start") { p.money += sr; reward += sr; }
    }
    return { path: path, reward: reward };
  }

  // ===== 回合 =====
  function roll(room) {
    const p = currentPlayer(room);
    let d;
    if (room.pendingCheat != null) { d = room.pendingCheat; room.pendingCheat = null; }
    else d = moveDie();
    const reverse = p.reverse > 0;
    const mv = moveBy(room, p, d, reverse);
    if (p.reverse > 0) p.reverse--;
    room.dice = d;
    room.jailRoll = null;
    const cell = BOARD[p.pos];
    const pending = buildLanding(room, p, cell, mv.reward);
    room.pending = pending;
    room.phase = "landing";
    room.landingStartedAt = Date.now();
    room.seq++;
    return { dice: d, reverse: reverse, path: mv.path, reward: mv.reward, cell: cell.index, pending: pending };
  }

  function buildLanding(room, p, cell, passReward) {
    const idx = cell.index;
    if (cell.t === "start" || cell.t === "empty") {
      return { type: "none", name: cell.name, passReward: passReward || 0 };
    }
    if (cell.t === "jail") {
      const d = die();
      const odd = d % 2 === 1;
      if (!odd) p.jailSkip = 1;
      room.jailRoll = { playerId: p.id, die: d, leave: odd };
      log(room, p.name + " 进入乔司监狱，掷出 " + d + (odd ? "（单数，直接离开）" : "（双数，下回合停留）"));
      return { type: "jail", die: d, odd: odd };
    }
    if (cell.t === "card") {
      const cid = randomCardId();
      p.cards.push(cid);
      log(room, p.name + " 在卡牌补给站获得一张【" + cardName(cid) + "】");
      return { type: "card", card: cid, cell: cell.name };
    }
    if (cell.t === "fate") {
      const card = rand(ZT.FATE);
      const r = applyFate(room, p, card);
      log(room, p.name + " 抽到命运「" + card.name + "」：" + r);
      return { type: "fate", card: card, result: r };
    }
    if (cell.t === "opportunity") {
      const card = rand(ZT.OPPORTUNITY);
      log(room, p.name + " 抽到机会「" + card.name + "」");
      return { type: "opportunity", card: card };
    }
    // 普通城市地块
    const pr = room.props[idx];
    if (!pr.owner) {
      return { type: "buy", cell: idx, price: nextRegionCost(cell, pr) };
    } else if (pr.owner === p.id) {
      if (pr.regionsOwned < cell.regionCount) {
        return { type: "buy", cell: idx, price: nextRegionCost(cell, pr) };
      } else if (pr.buildingLevel < 6) {
        const lvls = Math.min(2, 6 - pr.buildingLevel);
        const cost1 = buildCost(cell, pr.buildingLevel, pr.buildingLevel + 1);
        const cost2 = lvls >= 2 ? buildCost(cell, pr.buildingLevel, pr.buildingLevel + 2) : null;
        return { type: "build", cell: idx, lvls: lvls, cost1: cost1, cost2: cost2 };
      } else {
        return { type: "none", name: cell.name, passReward: passReward || 0 };
      }
    } else {
      const toll = propToll(room, cell);
      return { type: "pay", toll: toll, owner: pr.owner, cell: idx, canBoss: p.boss > 0 };
    }
  }

  function applyFate(room, p, card) {
    let desc = card.desc || card.name;
    if (card.type === "stop") {
      p.paused += 1; // 命运“暂停一回合”
      desc = "暂停 1 回合";
    } else if (card.type === "money") {
      p.money = Math.max(0, p.money + card.amount);
      desc = (card.amount >= 0 ? "获得 ¥" + card.amount : "损失 ¥" + (-card.amount));
    } else if (card.type === "back3") {
      const mv = moveBy(room, p, 3, true);
      desc = "向后移动 3 格";
      if (mv.reward) desc += "（经过起点 +¥" + mv.reward + "）";
    } else if (card.type === "gainCard") {
      const cid = randomCardId();
      p.cards.push(cid);
      desc = "获得一张【" + cardName(cid) + "】";
    } else if (card.type === "loseCard") {
      if (p.cards.length) {
        const idx = Math.floor(Math.random() * p.cards.length);
        const lost = p.cards.splice(idx, 1)[0];
        desc = "失去一张【" + cardName(lost) + "】";
      } else {
        const fb = card.fallback || -800;
        p.money = Math.max(0, p.money + fb);
        desc = "没有卡牌可失去，改为损失 ¥" + (-fb);
      }
    }
    return desc;
  }

  // ===== 结算 =====
  function resolve(room, action) {
    const p = currentPlayer(room);
    const pend = room.pending;
    if (!pend) { endTurn(room); return; }
    action = action || {};
    switch (pend.type) {
      case "none":
      case "jail":
      case "card":
      case "fate":
        finishTurn(room); break;
      case "buy":
        resolveBuy(room, action); break;
      case "build":
        resolveBuild(room, action); break;
      case "pay":
        resolvePay(room, action); break;
      case "emergency":
        resolveEmergency(room, action); break;
      case "opportunity":
        resolveOpportunity(room, action); break;
      case "opportunity_result":
        finishTurn(room); break;
      default:
        finishTurn(room); break;
    }
  }

  function resolveBuy(room, action) {
    const p = currentPlayer(room);
    const pend = room.pending;
    const cell = BOARD[pend.cell];
    const pr = room.props[pend.cell];
    if (action.buy) {
      const cost = nextRegionCost(cell, pr);
      if (cost != null && p.money >= cost) {
        p.money -= cost;
        pr.regionsOwned += 1;
        pr.owner = p.id;
        log(room, p.name + " 购买「" + cell.name + "」区域" + pr.regionsOwned + "/" + cell.regionCount + "，花费 ¥" + cost);
      }
    }
    finishTurn(room);
  }

  function resolveBuild(room, action) {
    const p = currentPlayer(room);
    const pend = room.pending;
    const cell = BOARD[pend.cell];
    const pr = room.props[pend.cell];
    let n = clamp(parseInt(action.levels, 10) || 0, 0, pend.lvls);
    while (n > 0 && buildCost(cell, pr.buildingLevel, pr.buildingLevel + n) > p.money) n--;
    if (n > 0) {
      const cost = buildCost(cell, pr.buildingLevel, pr.buildingLevel + n);
      p.money -= cost;
      pr.buildingLevel += n;
      log(room, p.name + " 将「" + cell.name + "」升级到 " + BUILD_NAMES[pr.buildingLevel] + "，花费 ¥" + cost);
      if (pr.buildingLevel >= 6) log(room, "🎉 " + p.name + " 建成【新城】，全场城市地租 ×" + newTownMultiplier(room).toFixed(1) + "！");
    }
    finishTurn(room);
  }

  function resolvePay(room, action) {
    const p = currentPlayer(room);
    const pend = room.pending;
    const owner = playerById(room, pend.owner);
    if (action.boss && pend.canBoss && p.boss > 0) {
      p.boss--;
      log(room, p.name + " 使用霸王卡免除 ¥" + pend.toll + " 过路费");
      finishTurn(room); return;
    }
    if (p.money >= pend.toll) {
      p.money -= pend.toll;
      if (owner) owner.money += pend.toll;
      log(room, p.name + " 支付 ¥" + pend.toll + " 给 " + (owner ? owner.name : "银行"));
      finishTurn(room);
    } else {
      pend.type = "emergency";
      pend.shortfall = pend.toll - p.money;
      pend.creditor = pend.owner;
      room.seq++;
    }
  }

  function resolveEmergency(room, action) {
    const p = currentPlayer(room);
    const pend = room.pending;
    if (action.mortgage != null) {
      const cell = BOARD[action.mortgage];
      const pr = room.props[action.mortgage];
      if (cell && cell.t === "prop" && pr && pr.owner === p.id) {
        const val = mortgageValue(cell, pr);
        p.money += val;
        pr.owner = null; pr.regionsOwned = 0; pr.buildingLevel = 0;
        pend.shortfall -= val;
        log(room, p.name + " 紧急抵押「" + cell.name + "」获得 ¥" + val);
      }
      if (pend.shortfall <= 0) {
        p.money -= pend.toll;
        const owner = playerById(room, pend.creditor);
        if (owner) owner.money += pend.toll;
        log(room, p.name + " 支付 ¥" + pend.toll + " 给 " + (owner ? owner.name : "银行"));
        room.pending = null;
        finishTurn(room);
      } else {
        room.seq++;
      }
      return;
    }
    if (action.bankrupt) { bankrupt(room); return; }
  }

  function resolveOpportunity(room, action) {
    const p = currentPlayer(room);
    const pend = room.pending;
    if (action.grasp) {
      const card = pend.card;
      if (p.money < card.lose) {
        log(room, p.name + " 资金不足，无法把握「" + card.name + "」");
        finishTurn(room); return;
      }
      const d = die();
      const success = d % 2 === 0;
      let delta = 0, extra = "";
      if (success) {
        delta = card.win - card.invest;
        p.money += delta;
        if (card.winCard) {
          const ids = [];
          for (let i = 0; i < card.winCard; i++) { const cid = randomCardId(); p.cards.push(cid); ids.push(cardName(cid)); }
          extra = "，并得到 " + ids.join("、");
        }
      } else {
        delta = -card.lose;
        p.money -= card.lose;
        if (card.loseCard) {
          let lost = [];
          for (let i = 0; i < card.loseCard; i++) {
            if (!p.cards.length) break;
            const idx = Math.floor(Math.random() * p.cards.length);
            lost.push(cardName(p.cards.splice(idx, 1)[0]));
          }
          if (lost.length) extra = "，并失去 " + lost.join("、");
        }
      }
      log(room, p.name + " 把握机会「" + card.name + "」，掷出 " + d + (success ? "（成功）" : "（失败）") + (delta >= 0 ? "，获得 ¥" + delta : "，损失 ¥" + (-delta)) + extra);
      pend.type = "opportunity_result";
      pend.die = d; pend.success = success; pend.delta = delta; pend.extra = extra;
      room.seq++;
    } else {
      log(room, p.name + " 放弃了机会「" + pend.card.name + "」");
      finishTurn(room);
    }
  }

  function bankrupt(room) {
    const p = currentPlayer(room);
    p.bankrupt = true;
    BOARD.forEach(function (c) {
      if (c.t === "prop") {
        const pr = room.props[c.index];
        if (pr && pr.owner === p.id) { pr.owner = null; pr.regionsOwned = 0; pr.buildingLevel = 0; }
      }
    });
    log(room, p.name + " 破产，退出游戏");
    room.pending = null;
    checkWin(room);
    if (!room.winner) endTurn(room);
  }

  function endTurn(room) {
    room.pending = null;
    room.dice = null;
    room.jailRoll = null;
    room.rolled = false;
    room.phase = "action";
    nextTurn(room);
  }

  // 回合内结算完成（买地/支付/机会等处理完），但还没点“结束回合”，不进入下一位
  function finishTurn(room) {
    room.pending = null;
    room.dice = null;
    room.jailRoll = null;
    room.rolled = true;
    room.phase = "action";
    room.seq++;
  }

  function nextTurn(room) {
    for (let i = 0; i < room.players.length; i++) {
      room.turn = (room.turn + 1) % room.players.length;
      const p = currentPlayer(room);
      if (p.bankrupt) continue;
      if (p.jailSkip > 0) { p.skipReason = "jail"; p.jailSkip--; log(room, p.name + " 在乔司监狱停留一回合"); room.seq++; return; }
      if (p.paused > 0) { p.skipReason = "pause"; p.paused--; log(room, p.name + " 被命运暂停一回合"); room.seq++; return; }
      p.skipReason = null;
      room.rolled = false;
      room.turnStartedAt = Date.now();
      log(room, "轮到 " + p.name);
      room.seq++;
      return;
    }
    checkWin(room);
  }

  function skipTurn(room) {
    const p = currentPlayer(room);
    p.skipReason = null;
    room.phase = "action";
    nextTurn(room);
  }

  function forceEndTurn(room) {
    const p = currentPlayer(room);
    p.skipReason = null;
    room.pending = null;
    room.dice = null;
    room.jailRoll = null;
    room.phase = "action";
    nextTurn(room);
  }

  function checkWin(room) {
    const alive = room.players.filter(function (p) { return !p.bankrupt; });
    if (alive.length === 1) {
      room.winner = alive[0].id;
      room.phase = "over";
      room.status = "ended";
      log(room, alive[0].name + " 获胜！");
    }
    room.seq++;
  }

  // ===== 卡牌（回合开始、掷骰子前使用）=====
  function useCard(room, playerId, cardId, opts) {
    const p = playerById(room, playerId);
    if (!p) return { error: "玩家不存在" };
    if (room.phase !== "action" || currentPlayer(room).id !== playerId) return { error: "现在不能使用卡牌" };
    const idx = p.cards.indexOf(cardId);
    if (idx < 0) return { error: "没有这张卡" };
    opts = opts || {};
    switch (cardId) {
      case "reverse": {
        const t = randomTarget(room);
        t.reverse += 3;
        log(room, p.name + " 使用逆向卡，" + t.name + " 将逆向移动 3 回合");
        break;
      }
      case "boss": {
        p.boss += 1;
        log(room, p.name + " 使用霸王卡（下次踩到他人地块可免除一次过路费）");
        break;
      }
      case "stop": {
        return useStop(room, p, idx, opts);
      }
      case "cheat": {
        const v = clamp(parseInt(opts.value, 10) || 1, 1, 12);
        room.pendingCheat = v;
        log(room, p.name + " 使用作弊卡，本回合点数设为 " + v);
        break;
      }
      case "blast": {
        const cell = BOARD[p.pos];
        if (cell.t !== "prop") return { error: "脚下不是城市地块" };
        const pr = room.props[p.pos];
        if (pr.owner !== p.id) return { error: "脚下不是自己的地块" };
        if (pr.buildingLevel > 0) {
          pr.buildingLevel = Math.max(0, pr.buildingLevel - 3);
          log(room, p.name + " 使用爆破卡，「" + cell.name + "」建筑降到 " + (pr.buildingLevel ? BUILD_NAMES[pr.buildingLevel] : "无建筑"));
        } else if (pr.regionsOwned > 1) {
          pr.regionsOwned -= 1;
          log(room, p.name + " 使用爆破卡，「" + cell.name + "」区域降为 " + pr.regionsOwned + "/" + cell.regionCount);
        } else {
          return { error: "该地块无法被爆破" };
        }
        break;
      }
      case "remove": {
        const ci = parseInt(opts.cell, 10);
        const cell = BOARD[ci];
        if (!cell || cell.t !== "prop") return { error: "目标无效" };
        const pr = room.props[ci];
        if (!pr || pr.owner === p.id || pr.owner == null || pr.buildingLevel <= 0) return { error: "目标地块没有建筑或不是他人的" };
        pr.buildingLevel -= 1;
        log(room, p.name + " 使用拆除卡，「" + cell.name + "」建筑降到 " + (pr.buildingLevel ? BUILD_NAMES[pr.buildingLevel] : "无建筑"));
        break;
      }
      default:
        return { error: "未知卡牌" };
    }
    p.cards.splice(idx, 1);
    room.seq++;
    return { ok: true };
  }

  // 停留卡 = 额外行动：对自己脚下地块再买一个区域 / 再升 1~2 级建筑
  function useStop(room, p, idx, opts) {
    const cell = BOARD[p.pos];
    if (cell.t !== "prop") return { error: "你现在不在城市地块上，无法使用停留卡" };
    const pr = room.props[p.pos];
    if (pr.owner !== p.id) return { error: "当前地块不是你的，无法额外建设" };
    if (pr.regionsOwned < cell.regionCount) {
      const cost = nextRegionCost(cell, pr);
      if (p.money < cost) return { error: "资金不足，无法购买区域" };
      p.money -= cost;
      pr.regionsOwned += 1;
      log(room, p.name + " 使用停留卡，额外购买「" + cell.name + "」区域" + pr.regionsOwned + "/" + cell.regionCount);
    } else if (pr.buildingLevel < 6) {
      const lvls = clamp(parseInt(opts.levels, 10) || 1, 1, Math.min(2, 6 - pr.buildingLevel));
      const cost = buildCost(cell, pr.buildingLevel, pr.buildingLevel + lvls);
      if (p.money < cost) return { error: "资金不足，无法升级" };
      p.money -= cost;
      pr.buildingLevel += lvls;
      log(room, p.name + " 使用停留卡，额外将「" + cell.name + "」升级到 " + BUILD_NAMES[pr.buildingLevel]);
      if (pr.buildingLevel >= 6) log(room, "🎉 " + p.name + " 建成【新城】，全场城市地租 ×" + newTownMultiplier(room).toFixed(1) + "！");
    } else {
      return { error: "该地块已满级" };
    }
    p.cards.splice(idx, 1);
    room.seq++;
    return { ok: true };
  }

  function randomTarget(room) {
    const pool = room.players.filter(function (p) { return !p.bankrupt; });
    return rand(pool);
  }

  // ===== 抵押（主动，回合开始阶段）=====
  function mortgage(room, playerId, cellIndex) {
    const p = playerById(room, playerId);
    if (!p || room.phase !== "action" || currentPlayer(room).id !== playerId) return { error: "现在不能抵押" };
    const cell = BOARD[cellIndex];
    if (!cell || cell.t !== "prop") return { error: "只能抵押城市地块" };
    const pr = room.props[cellIndex];
    if (!pr || pr.owner !== p.id) return { error: "不是你的地块" };
    if (pr.regionsOwned <= 0 && pr.buildingLevel <= 0) return { error: "该地块没有可抵押价值" };
    const val = mortgageValue(cell, pr);
    p.money += val;
    pr.owner = null; pr.regionsOwned = 0; pr.buildingLevel = 0;
    log(room, p.name + " 抵押「" + cell.name + "」获得 ¥" + val);
    room.seq++;
    return { ok: true, value: val };
  }

  // ===== 聊天室 =====
  function sendChat(room, playerId, text) {
    const p = playerById(room, playerId);
    if (!p) return { error: "玩家不存在" };
    text = String(text || "").trim().slice(0, 120);
    if (!text) return { error: "消息不能为空" };
    room.chat.push({ pid: playerId, name: p.name, text: text, t: Date.now() });
    if (room.chat.length > 200) room.chat.shift();
    room.seq++;
    return { ok: true };
  }

  // 停留卡可执行的动作信息（供 UI 决定弹窗）
  function stopActionInfo(room, playerId) {
    const p = playerById(room, playerId);
    if (!p) return null;
    const cell = BOARD[p.pos];
    if (cell.t !== "prop") return null;
    const pr = room.props[p.pos];
    if (pr.owner !== p.id) return null;
    if (pr.regionsOwned < cell.regionCount) {
      return { kind: "buy", price: nextRegionCost(cell, pr), cell: cell.index };
    }
    if (pr.buildingLevel < 6) {
      const lvls = Math.min(2, 6 - pr.buildingLevel);
      return {
        kind: "build", cell: cell.index,
        cost1: buildCost(cell, pr.buildingLevel, pr.buildingLevel + 1),
        cost2: lvls >= 2 ? buildCost(cell, pr.buildingLevel, pr.buildingLevel + 2) : null
      };
    }
    return null;
  }

  window.ZTEngine = {
    N: N,
    uid: uid,
    roomCode: roomCode,
    die: die,
    newRoom: newRoom,
    join: join,
    start: start,
    playerById: playerById,
    currentPlayer: currentPlayer,
    roll: roll,
    resolve: resolve,
    endTurn: endTurn,
    skipTurn: skipTurn,
    forceEndTurn: forceEndTurn,
    useCard: useCard,
    stopActionInfo: stopActionInfo,
    mortgage: mortgage,
    sendChat: sendChat,
    tollOf: tollOf,
    propToll: propToll,
    cityOwnedCount: cityOwnedCount,
    newTownMultiplier: newTownMultiplier,
    mortgageValue: mortgageValue,
    nextRegionCost: nextRegionCost,
    BUILD_NAMES: BUILD_NAMES,
    CARDS: CARDS,
    TOKENS: TOKENS
  };
})();
