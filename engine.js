(function () {
  "use strict";

  const ZT = window.ZT;
  const BOARD = ZT.BOARD;
  const N = BOARD.length;
  const CARDS = ZT.CARDS;
  const BUILD_NAMES = ZT.BUILD_NAMES;
  const START_REWARD = ZT.START_REWARD;
  const TOKENS = ["🐶", "🐱", "🐰", "🦊", "🐼", "🐯"];

  function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-3); }
  function roomCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let s = "";
    for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }
  function die() { return 1 + Math.floor(Math.random() * 6); }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function log(room, text) { room.log.unshift({ t: Date.now(), text: text }); if (room.log.length > 200) room.log.length = 200; }

  function newRoom(hostName, settings) {
    settings = settings || {};
    const host = {
      id: uid(),
      name: String(hostName || "房主").slice(0, 12),
      token: TOKENS[0],
      money: 0,
      pos: 0,
      start: "A",
      cards: [],
      reverse: 0,
      stop: 0,
      jailSkip: 0,
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
        sound: settings.sound !== false,
        anim: settings.anim || "fast"
      },
      players: [host],
      props: initProps(),
      turn: 0,
      phase: "waiting",
      pending: null,
      boss: {},
      pendingCheat: null,
      dice: null,
      log: [],
      winner: null,
      seq: 0
    };
    log(room, "房间创建成功，等待玩家加入…");
    return room;
  }

  function initProps() {
    const props = {};
    BOARD.forEach(function (c) {
      if (c.t === "prop") props[c.index] = { regionsOwned: 0, owner: null, buildingLevel: 0 };
      else if (c.t === "special") props[c.index] = { regionsOwned: 0, owner: null, buildingLevel: 0 };
    });
    return props;
  }

  function playerById(room, id) { return room.players.find(function (p) { return p.id === id; }); }
  function currentPlayer(room) { return room.players[room.turn]; }

  function join(room, name) {
    if (room.status !== "waiting") return { error: "游戏已开始" };
    if (room.players.length >= room.settings.maxPlayers) return { error: "房间已满" };
    name = String(name || "").trim().slice(0, 12) || ("玩家" + (room.players.length + 1));
    if (room.players.some(function (p) { return p.name === name; })) return { error: "该名字已被占用" };
    const p = {
      id: uid(),
      name: name,
      token: TOKENS[room.players.length % TOKENS.length],
      money: 0,
      pos: 0,
      start: "A",
      cards: [],
      reverse: 0,
      stop: 0,
      jailSkip: 0,
      bankrupt: false,
      secret: uid()
    };
    room.players.push(p);
    log(room, name + " 加入房间");
    room.seq++;
    return { player: p };
  }

  function start(room) {
    if (room.status !== "waiting" || room.players.length < 2) return false;
    // 随机分配起点 + 打乱回合顺序
    room.players.forEach(function (p) {
      const st = Math.random() < 0.5 ? "A" : "B";
      p.start = st;
      p.pos = st === "A" ? 0 : BOARD.findIndex(function (c) { return c.t === "start" && c.id === "B"; });
      p.money = room.settings.initialMoney;
      p.cards = [];
      for (let k = 0; k < (room.settings.startCards || 0); k++) {
        p.cards.push(CARDS[Math.floor(Math.random() * CARDS.length)].id);
      }
      p.bankrupt = false;
    });
    // shuffle
    for (let i = room.players.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = room.players[i]; room.players[i] = room.players[j]; room.players[j] = t;
    }
    room.status = "playing";
    room.phase = "action";
    room.turn = 0;
    room.seq++;
    log(room, "游戏开始！每人初始资金 ¥" + room.settings.initialMoney);
    log(room, "轮到 " + currentPlayer(room).name);
    return true;
  }

  // ---- 价格 / 加成计算 ----
  function landPaid(cell, regions) { return regions > 0 ? cell.land[regions - 1] : 0; }
  function buildPaid(cell, level) { return level > 0 ? cell.build[level - 1] : 0; }
  function landCost(cell, from, to) { return cell.land[to - 1] - landPaid(cell, from); }
  function buildCost(cell, from, to) { return cell.build[to - 1] - buildPaid(cell, from); }
  function mortgageValue(cell, pr) {
    return Math.round((landPaid(cell, pr.regionsOwned) + buildPaid(cell, pr.buildingLevel)) * 0.5);
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
  function specialOwnedCount(room, ownerId) {
    let n = 0;
    BOARD.forEach(function (c) {
      if (c.t === "special") {
        const pr = room.props[c.index];
        if (pr && pr.owner === ownerId) n++;
      }
    });
    return n;
  }
  function propToll(room, cell) {
    const pr = room.props[cell.index];
    if (!pr || !pr.owner) return 0;
    const base = cell.toll[pr.buildingLevel];
    const cnt = cityOwnedCount(room, pr.owner, cell.city);
    const mult = ZT.CITY_BONUS[clamp(cnt, 1, 5) - 1];
    return Math.round(base * mult);
  }
  function specialToll(room, cell) {
    const pr = room.props[cell.index];
    if (!pr || !pr.owner) return 0;
    const n = specialOwnedCount(room, pr.owner);
    return Math.round(cell.baseToll * ZT.specialMult(n));
  }
  function tollOf(room, cell) {
    return cell.t === "special" ? specialToll(room, cell) : propToll(room, cell);
  }

  // ---- 移动 ----
  function moveBy(room, p, steps, reverse) {
    const dir = reverse ? -1 : 1;
    const path = [];
    let reward = 0;
    for (let k = 0; k < steps; k++) {
      p.pos = (p.pos + dir + N) % N;
      path.push(p.pos);
      const c = BOARD[p.pos];
      if (c.t === "start") { p.money += START_REWARD; reward += START_REWARD; }
    }
    return { path: path, reward: reward };
  }

  // ---- 回合 ----
  function roll(room) {
    const p = currentPlayer(room);
    let d;
    if (room.pendingCheat != null) { d = room.pendingCheat; room.pendingCheat = null; }
    else d = die();
    const reverse = p.reverse > 0;
    const mv = moveBy(room, p, d, reverse);
    if (p.reverse > 0) p.reverse--;
    room.dice = d;
    const cell = BOARD[p.pos];
    const pending = buildLanding(room, p, cell);
    room.pending = pending;
    room.phase = "landing";
    room.seq++;
    return { dice: d, reverse: reverse, path: mv.path, reward: mv.reward, cell: cell.index, pending: pending };
  }

  function buildLanding(room, p, cell) {
    const idx = cell.index;
    if (cell.t === "start" || cell.t === "empty") return { type: "none", name: cell.name };
    if (cell.t === "jail") {
      const d = die();
      const odd = d % 2 === 1;
      if (!odd) p.jailSkip = 1;
      log(room, p.name + " 进入乔司监狱，掷出 " + d + (odd ? "（单数，离开）" : "（双数，停留 1 回合）"));
      return { type: "jail", die: d, odd: odd };
    }
    if (cell.t === "card") {
      const cid = CARDS[Math.floor(Math.random() * CARDS.length)].id;
      p.cards.push(cid);
      log(room, p.name + " 在" + cell.name + "获得一张" + cardName(cid));
      return { type: "card", card: cid, cell: cell.name };
    }
    if (cell.t === "fate") {
      const card = ZT.FATE[Math.floor(Math.random() * ZT.FATE.length)];
      const r = applyFate(room, p, card);
      log(room, p.name + " 抽到命运「" + card.name + "」：" + r);
      return { type: "fate", card: card, result: r };
    }
    if (cell.t === "opportunity") {
      const card = ZT.OPPORTUNITY[Math.floor(Math.random() * ZT.OPPORTUNITY.length)];
      log(room, p.name + " 抽到机会「" + card.name + "」");
      return { type: "opportunity", card: card };
    }
    if (cell.t === "special") {
      const pr = room.props[idx];
      if (!pr.owner) {
        return { type: "buy-special", cell: idx, price: ZT.SPECIAL_PRICE };
      } else if (pr.owner === p.id) {
        return { type: "none", name: cell.name };
      } else {
        const toll = specialToll(room, cell);
        return { type: "pay", toll: toll, owner: pr.owner, cell: idx };
      }
    }
    // 普通地产
    const pr = room.props[idx];
    if (!pr.owner || pr.owner === p.id) {
      if (pr.regionsOwned < cell.regionCount) {
        const avail = Math.min(2, cell.regionCount - pr.regionsOwned);
        const cost1 = landCost(cell, pr.regionsOwned, pr.regionsOwned + 1);
        const cost2 = avail >= 2 ? landCost(cell, pr.regionsOwned, pr.regionsOwned + 2) : null;
        return { type: "buy", cell: idx, avail: avail, cost1: cost1, cost2: cost2 };
      } else {
        // 已完全购买，且是自己的 → 可建建筑
        if (pr.owner === p.id) {
          const lvls = Math.min(2, 5 - pr.buildingLevel);
          const cost1 = lvls >= 1 ? buildCost(cell, pr.buildingLevel, pr.buildingLevel + 1) : null;
          const cost2 = lvls >= 2 ? buildCost(cell, pr.buildingLevel, pr.buildingLevel + 2) : null;
          if (lvls <= 0) return { type: "none", name: cell.name };
          return { type: "build", cell: idx, lvls: lvls, cost1: cost1, cost2: cost2 };
        }
        return { type: "none", name: cell.name };
      }
    } else {
      const toll = propToll(room, cell);
      return { type: "pay", toll: toll, owner: pr.owner, cell: idx };
    }
  }

  function cardName(id) { const c = CARDS.find(function (x) { return x.id === id; }); return c ? c.name : id; }

  function applyFate(room, p, card) {
    let desc = card.desc || card.name;
    if (card.type === "stop") { p.stop += 1; }
    else if (card.type === "lose") { p.money = Math.max(0, p.money - card.amount); }
    else if (card.type === "gain") { p.money += card.amount; }
    else if (card.type === "back3") {
      const mv = moveBy(room, p, 3, true);
      if (mv.reward) desc += "（经过起点 +¥" + mv.reward + "）";
    }
    return desc;
  }

  // ---- 结算 ----
  function resolve(room, action) {
    const p = currentPlayer(room);
    const pend = room.pending;
    if (!pend) { endTurn(room); return; }
    switch (pend.type) {
      case "none":
      case "jail":
      case "card":
      case "fate":
        endTurn(room); break;
      case "buy-special": {
        if (action && action.buy) {
          const cellB = BOARD[pend.cell];
          const prB = room.props[pend.cell];
          if (p.money >= pend.price) {
            p.money -= pend.price;
            prB.owner = p.id;
            log(room, p.name + " 购买特色地块「" + cellB.name + "」花费 ¥" + pend.price);
          }
        }
        endTurn(room); break;
      }
      case "buy": {
        let n = clamp(parseInt(action && action.count, 10) || 0, 0, pend.avail);
        const cellB = BOARD[pend.cell];
        const prB = room.props[pend.cell];
        while (n > 0 && landCost(cellB, prB.regionsOwned, prB.regionsOwned + n) > p.money) n--;
        if (n > 0) {
          const cost = landCost(cellB, prB.regionsOwned, prB.regionsOwned + n);
          p.money -= cost;
          prB.regionsOwned += n;
          prB.owner = p.id;
          log(room, p.name + " 购买「" + cellB.name + "」" + n + " 个区域，花费 ¥" + cost);
        }
        endTurn(room); break;
      }
      case "build": {
        let n = clamp(parseInt(action && action.levels, 10) || 0, 0, pend.lvls);
        const cellB = BOARD[pend.cell];
        const prB = room.props[pend.cell];
        while (n > 0 && buildCost(cellB, prB.buildingLevel, prB.buildingLevel + n) > p.money) n--;
        if (n > 0) {
          const cost = buildCost(cellB, prB.buildingLevel, prB.buildingLevel + n);
          p.money -= cost;
          prB.buildingLevel += n;
          log(room, p.name + " 将「" + cellB.name + "」升级到 " + BUILD_NAMES[prB.buildingLevel] + "，花费 ¥" + cost);
        }
        endTurn(room); break;
      }
      case "pay":
        resolvePay(room); break;
      case "emergency":
        resolveEmergency(room, action); break;
      case "opportunity": {
        if (action && action.grasp) {
          const card = pend.card;
          if (p.money < card.lose) {
            log(room, p.name + " 资金不足，无法把握「" + card.name + "」");
            room.seq++;
          } else {
            const d = die();
            const success = d % 2 === 0;
            let delta = 0;
            if (success) { delta = card.win - card.invest; p.money += delta; }
            else { delta = -card.lose; p.money -= card.lose; }
            log(room, p.name + " 把握机会「" + card.name + "」，掷出 " + d + (success ? "（成功）" : "（失败）") + (delta >= 0 ? "，获得 ¥" + delta : "，损失 ¥" + (-delta)));
            pend.type = "opportunity_result";
            pend.die = d; pend.success = success; pend.delta = delta;
            room.seq++;
          }
        } else {
          log(room, p.name + " 放弃了机会「" + pend.card.name + "」");
          endTurn(room);
        }
        break;
      }
      case "opportunity_result":
        endTurn(room); break;
      default:
        endTurn(room); break;
    }
  }

  function resolvePay(room) {
    const p = currentPlayer(room);
    const pend = room.pending;
    const owner = playerById(room, pend.owner);
    if (room.boss[p.id]) {
      delete room.boss[p.id];
      log(room, p.name + " 使用霸王卡免除了 ¥" + pend.toll + " 过路费");
      endTurn(room); return;
    }
    if (p.money >= pend.toll) {
      p.money -= pend.toll;
      if (owner) owner.money += pend.toll;
      log(room, p.name + " 支付 ¥" + pend.toll + " 给 " + (owner ? owner.name : "银行"));
      endTurn(room);
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
    if (action && action.mortgage != null) {
      const cell = BOARD[action.mortgage];
      const pr = room.props[action.mortgage];
      if (pr && pr.owner === p.id && cell.t === "prop") {
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
        endTurn(room);
      } else {
        room.seq++;
      }
      return;
    }
    if (action && action.bankrupt) {
      bankrupt(room); return;
    }
  }

  function bankrupt(room) {
    const p = currentPlayer(room);
    p.bankrupt = true;
    BOARD.forEach(function (c) {
      if (c.t === "prop" || c.t === "special") {
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
    const cp = currentPlayer(room);
    if (room.boss[cp.id]) {
      room.boss[cp.id]--;
      if (room.boss[cp.id] <= 0) delete room.boss[cp.id];
    }
    room.pending = null;
    room.dice = null;
    room.phase = "action";
    nextTurn(room);
  }

  function nextTurn(room) {
    for (let i = 0; i < room.players.length; i++) {
      room.turn = (room.turn + 1) % room.players.length;
      const p = currentPlayer(room);
      if (p.bankrupt) continue;
      if (p.jailSkip > 0) { p.skipReason = "jail"; p.jailSkip--; log(room, p.name + " 在乔司监狱停留一回合"); room.seq++; return; }
      if (p.stop > 0) { p.skipReason = "stop"; p.stop--; log(room, p.name + " 被停留卡跳过一回合"); room.seq++; return; }
      p.skipReason = null;
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

  // ---- 卡牌（回合开始、掷骰子前使用）----
  function useCard(room, playerId, cardId, opts) {
    const p = playerById(room, playerId);
    if (!p) return { error: "玩家不存在" };
    if (room.phase !== "action" || currentPlayer(room).id !== playerId) return { error: "现在不能使用卡牌" };
    const idx = p.cards.indexOf(cardId);
    if (idx < 0) return { error: "没有这张卡" };
    opts = opts || {};
    switch (cardId) {
      case "reverse": {
        const t = randomTarget(room, p.id);
        t.reverse += 3;
        log(room, p.name + " 使用逆向卡，" + t.name + " 将逆向移动 3 回合");
        break;
      }
      case "boss": {
        room.boss[p.id] = 3;
        log(room, p.name + " 使用霸王卡（3 回合内免一次过路费）");
        break;
      }
      case "stop": {
        const t = randomTarget(room, p.id);
        t.stop += 1;
        log(room, p.name + " 使用停留卡，" + t.name + " 将停留 1 回合");
        break;
      }
      case "cheat": {
        const v = clamp(parseInt(opts.value, 10) || 1, 1, 6);
        room.pendingCheat = v;
        log(room, p.name + " 使用作弊卡，本回合点数设为 " + v);
        break;
      }
      case "blast": {
        const cell = BOARD[p.pos];
        if (cell.t !== "prop") return { error: "脚下不是普通地块" };
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

  function randomTarget(room, selfId) {
    const pool = room.players.filter(function (p) { return !p.bankrupt; });
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // ---- 抵押（主动，回合开始阶段）----
  function mortgage(room, playerId, cellIndex) {
    const p = playerById(room, playerId);
    if (!p || room.phase !== "action" || currentPlayer(room).id !== playerId) return { error: "现在不能抵押" };
    const cell = BOARD[cellIndex];
    if (!cell || cell.t !== "prop") return { error: "只能抵押普通地块" };
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
    skipTurn: skipTurn,
    forceEndTurn: forceEndTurn,
    useCard: useCard,
    mortgage: mortgage,
    tollOf: tollOf,
    propToll: propToll,
    specialToll: specialToll,
    cityOwnedCount: cityOwnedCount,
    specialOwnedCount: specialOwnedCount,
    mortgageValue: mortgageValue,
    BUILD_NAMES: BUILD_NAMES,
    CARDS: CARDS,
    TOKENS: TOKENS
  };
})();
