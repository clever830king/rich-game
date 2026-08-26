(function () {
  "use strict";

  const ZT = window.ZT;
  const EN = window.ZTEngine;
  const BOARD = ZT.BOARD;
  const CARDS = ZT.CARDS;
  const TOKEN_COLORS = ["#f43f5e", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf0", "#ec4899"];
  const RULES = [
    "目标：游历浙江 12 城，买地、建房、收过路费，把对手耗到破产，最后剩下的玩家获胜。",
    "每回合：先掷骰子（只能掷骰子前用卡牌/抵押），按顺时针移动，落到地块后进行购买/支付/收钱等结算。",
    "买地：普通地块首次最多买 2 个区域，买满后需下次到达才能建建筑；建筑 5 级、每次最多升 2 级。",
    "特色地块：踩到无主特色地块可选购买（¥1200），收入按持有特色地块数量加成。",
    "过路费：落到别人的地块要付钱；同城普通地产越多加成越高。",
    "卡牌补给站：随机获得一张卡（逆向/霸王/停留/作弊/爆破/拆除），只能掷骰子前使用。",
    "命运（立即执行）与机会（把握/放弃，把握后掷机会骰子：偶数成功、奇数失败）。",
    "乔司监狱：进入立即掷骰，单数离开、双数停留 1 回合。",
    "抵押：整块抵押得 50% 现金；付不起过路费可紧急抵押，仍不够则破产退出。",
    "经过任意一个起点得 ¥3000（逆向也有效）。"
  ];

  const BGM_TRACKS = [
    { name: "西湖烟雨", base: 220, tempo: 300, wave: "sine", seq: [0,2,4,7,9,7,4,2,0,2,4,7,9,12] },
    { name: "钱塘潮涌", base: 196, tempo: 240, wave: "triangle", seq: [0,2,4,2,0,-1,7,9,12,9,7,4,2,0] },
    { name: "雁荡山韵", base: 247, tempo: 320, wave: "sine", seq: [0,4,7,9,12,9,7,4,0,-1,4,7,9,12] },
    { name: "乌镇水乡", base: 262, tempo: 360, wave: "triangle", seq: [0,2,4,7,9,7,4,2,-1,0,2,4,7,9] },
    { name: "普陀梵音", base: 175, tempo: 400, wave: "sine", seq: [0,2,7,9,12,9,7,2,0,-1,2,7,9,12] },
    { name: "千岛湖光", base: 233, tempo: 280, wave: "triangle", seq: [0,4,7,4,0,2,4,7,9,7,4,2,0,-1] },
    { name: "会稽古风", base: 208, tempo: 340, wave: "sine", seq: [0,2,4,7,4,2,0,-1,9,7,4,2,0,-1] },
    { name: "宁波港风", base: 185, tempo: 260, wave: "triangle", seq: [0,2,4,9,7,4,2,0,2,4,9,12,9,7] },
    { name: "绍兴酒香", base: 220, tempo: 310, wave: "sine", seq: [0,4,2,4,7,9,7,4,0,4,7,9,12,9] },
    { name: "台州山海", base: 196, tempo: 250, wave: "triangle", seq: [0,2,4,7,9,12,9,7,4,2,0,-1,7,9] },
    { name: "丽水竹韵", base: 262, tempo: 330, wave: "sine", seq: [0,2,4,7,9,7,4,2,0,2,4,7,-1,0] },
    { name: "金华茶歌", base: 208, tempo: 290, wave: "triangle", seq: [0,4,7,9,7,4,0,4,7,9,12,9,7,4] }
  ];

  const LS_SESSION = "zt_my_session";
  const CLOUD_ENV = "dafuwen-d5gehh0dge8fe447f";
  const CLOUD_ACCESS_KEY = ""; // 留空走匿名登录；若改用 Publishable Key 则填在这里

  let S = { code: null, playerId: null, name: null, room: null, seen: {}, watcher: null };
  let hbTimer = null;
  let landingMsg = null;
  let CLOUD_DB = null;
  let writeChain = Promise.resolve();

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  function h(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(k => {
      const v = attrs[k];
      if (k === "class") e.className = v;
      else if (k === "text") e.textContent = v;
      else if (k === "html") e.innerHTML = v;
      else if (k === "style") Object.assign(e.style, v || {});
      else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v);
    });
    kids.forEach(k => {
      if (k == null) return;
      if (Array.isArray(k)) {
        k.forEach(x => { if (x != null) e.appendChild(typeof x === "string" || typeof x === "number" ? document.createTextNode(x) : x); });
        return;
      }
      e.appendChild(typeof k === "string" || typeof k === "number" ? document.createTextNode(k) : k);
    });
    return e;
  }

  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove("show"), 2200);
  }

  /* ---------- transport（腾讯云 CloudBase 实时数据库） ---------- */
  function saveSession() { localStorage.setItem(LS_SESSION, JSON.stringify({ code: S.code, playerId: S.playerId, name: S.name })); }
  function clearSession() { localStorage.removeItem(LS_SESSION); }

  function roomRef(code) { return CLOUD_DB.collection("rooms").doc(code); }
  function presenceRef(code, pid) { return CLOUD_DB.collection("presence").doc(code + "_" + pid); }

  function cleanRoom(room) {
    const o = JSON.parse(JSON.stringify(room));
    delete o._id;
    delete o._openid;
    return o;
  }

  function extractDoc(res) {
    const d = res && res.data;
    if (Array.isArray(d)) return d[0] || null;
    return d || null;
  }

  function fetchRoom(code) {
    if (!CLOUD_DB || !code) return Promise.resolve(null);
    return roomRef(code).get().then(function (res) {
      if (res && res.code) { console.warn("读房间失败", res.code, res.message); return null; }
      return extractDoc(res);
    }).catch(() => null);
  }

  function saveRoomToCloud(room) {
    if (!CLOUD_DB || !room || !room.code) return;
    const code = room.code;
    const data = cleanRoom(room);
    writeChain = writeChain
      .then(() => roomRef(code).set(data))
      .then(res => {
        if (res && res.code) {
          console.warn("写入房间失败", res.code, res.message);
          toast("保存失败 " + (res.code || "") + " " + (res.message || ""));
        }
      })
      .catch(e => {
        console.warn("写入房间失败", e);
        toast("保存失败 " + (e && (e.code || e.message) || ""));
      });
  }

  function saveAndBroadcast() { saveRoomToCloud(S.room); }

  function watchRoom(code) {
    unwatchRoom();
    if (!CLOUD_DB || !code) return;
    try {
      S.watcher = roomRef(code).watch({
        onChange: function () { pullRoom(); },
        onError: function (e) { console.warn("实时监听断开", e); }
      });
    } catch (e) {
      console.warn("开启监听失败", e);
    }
  }
  function unwatchRoom() {
    if (S.watcher) { try { S.watcher.close(); } catch (e) {} S.watcher = null; }
  }

  function pullRoom() {
    const code = S.code;
    if (!CLOUD_DB || !code) return;
    roomRef(code).get().then(function (res) {
      const remote = extractDoc(res);
      if (!remote) return;
      if (!S.room) { S.room = remote; render(); return; }
      if (remote.seq > S.room.seq) { S.room = remote; render(); }
    }).catch(function (e) { console.warn("拉取房间失败", e); });
  }

  function heartbeat() {
    if (!CLOUD_DB || !S.code || !S.playerId) return;
    presenceRef(S.code, S.playerId)
      .set({ code: S.code, playerId: S.playerId, name: S.name || "", lastSeen: Date.now() })
      .catch(function (e) { console.warn("心跳失败", e); });
  }
  function startHeartbeat() {
    stopHeartbeat();
    if (!S.playerId || !S.code) return;
    heartbeat();
    hbTimer = setInterval(heartbeat, 5000);
  }
  function stopHeartbeat() { if (hbTimer) { clearInterval(hbTimer); hbTimer = null; } }

  function refreshPresence() {
    if (!CLOUD_DB || !S.code) return;
    CLOUD_DB.collection("presence").where({ code: S.code }).get().then(function (res) {
      const arr = Array.isArray(res.data) ? res.data : [];
      arr.forEach(function (d) { if (d && d.playerId) S.seen[d.playerId] = d.lastSeen || 0; });
      if (S.room) updatePresence();
    }).catch(function () {});
  }

  function initCloud() {
    if (typeof window.cloudbase === "undefined") {
      toast("联机组件加载失败，请检查网络");
      return Promise.resolve();
    }
    const opts = { env: CLOUD_ENV, region: "ap-shanghai" };
    if (CLOUD_ACCESS_KEY) opts.accessKey = CLOUD_ACCESS_KEY;
    let app, db;
    try {
      app = window.cloudbase.init(opts);
      db = app.database();
      CLOUD_DB = db;
    } catch (e) {
      console.warn("CloudBase 初始化失败", e);
      toast("联机服务初始化失败");
      return Promise.resolve();
    }

    if (CLOUD_ACCESS_KEY) {
      verifyDb();
      return Promise.resolve();
    }

    const a = (typeof app.auth === "function") ? app.auth({ persistence: "local" }) : app.auth;
    const doLogin = (a && typeof a.signInAnonymously === "function")
      ? a.signInAnonymously()
      : ((a && typeof a.anonymousAuthProvider === "function") ? a.anonymousAuthProvider().signIn() : Promise.resolve());

    return doLogin.then(function (r) {
      if (r && r.error) {
        console.warn("匿名登录失败", r.error.code || r.error);
        toast("联机登录失败：请确认已开启“匿名登录”");
        return r;
      }
      verifyDb();
      return r;
    }).catch(function (e) {
      console.warn("匿名登录异常", e);
      toast("联机登录失败，请检查网络");
    });
  }

  function verifyDb() {
    if (!CLOUD_DB) return;
    CLOUD_DB.collection("rooms").limit(1).get().then(function (res) {
      if (res && res.code) {
        console.warn("读权限失败", res.code, res.message);
        toast("读失败 " + (res.code || "") + " " + (res.message || ""));
        return;
      }
      const testRef = CLOUD_DB.collection("rooms").doc("__perm_test__");
      testRef.set({ t: Date.now() }).then(function (res2) {
        if (res2 && res2.code) {
          console.warn("写权限失败", res2.code, res2.message);
          toast("写失败 " + (res2.code || "") + " " + (res2.message || ""));
        } else {
          testRef.remove().catch(function () {});
        }
      }).catch(function (e) {
        console.warn("写权限异常", e);
        toast("写失败 " + (e && (e.code || e.message) || ""));
      });
    }).catch(function (e) {
      console.warn("数据库访问失败", e);
      toast("读失败 " + (e && (e.code || e.message) || ""));
    });
  }

  /* ---------- helpers ---------- */
  function cardName(id) { const c = CARDS.find(x => x.id === id); return c ? c.name : id; }
  function playerById(room, id) { return room.players.find(p => p.id === id); }
  function cur() { return S.room.players[S.room.turn]; }
  function me() { return playerById(S.room, S.playerId); }
  function isMe() {
    return S.room && S.room.status === "playing" && cur() && cur().id === S.playerId;
  }
  function isMyTurn() {
    return isMe() && S.room.phase === "action";
  }
  function colorOf(p) { const i = S.room.players.indexOf(p); return TOKEN_COLORS[i % TOKEN_COLORS.length]; }
  function isOnline(p) {
    if (p.id === S.playerId) return true;
    return (S.seen[p.id] || 0) > Date.now() - 12000;
  }
  function openModal(title, body, foot) {
    $("#modalTitle").textContent = title;
    const b = $("#modalBody"); b.innerHTML = ""; b.appendChild(body);
    const f = $("#modalFoot"); f.innerHTML = ""; (foot || []).forEach(x => f.appendChild(x));
    $("#modal").classList.remove("hidden");
  }
  function closeModal() { $("#modal").classList.add("hidden"); }
  function btn(label, onclick, cls) { return h("button", { class: "btn " + (cls || "btn-primary"), onclick: onclick }, label); }

  /* ---------- sound ---------- */
  let AC = null;
  function beep(freq, dur, type) {
    if (!S.room || !S.room.settings.sound) return;
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)();
      const o = AC.createOscillator(), g = AC.createGain();
      o.type = type || "square"; o.frequency.value = freq;
      o.connect(g); g.connect(AC.destination);
      g.gain.setValueAtTime(0.07, AC.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + dur);
      o.start(); o.stop(AC.currentTime + dur);
    } catch (e) {}
  }
  function sfxRoll() { beep(170, .08); setTimeout(() => beep(220, .08), 90); }
  function sfxBuy() { beep(660, .09, "sine"); setTimeout(() => beep(880, .1, "sine"), 90); }
  function sfxPay() { beep(200, .16, "sawtooth"); }
  function sfxCard() { beep(520, .06, "triangle"); setTimeout(() => beep(720, .07, "triangle"), 70); }
  function sfxLand() { beep(420, .05, "triangle"); }

  /* ---------- BGM ---------- */
  let BGM = { on: false, idx: 0, timer: null, note: 0 };
  function bgmNote(freq, dur, wave) {
    if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = wave; o.frequency.value = freq;
    o.connect(g); g.connect(AC.destination);
    const t = AC.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.055, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur / 1000 * 0.92);
    o.start(t); o.stop(t + dur / 1000);
  }
  function bgmTick() {
    const tr = BGM_TRACKS[BGM.idx];
    const n = tr.seq[BGM.note % tr.seq.length];
    BGM.note++;
    if (n >= 0) bgmNote(tr.base * Math.pow(2, n / 12), tr.tempo, tr.wave);
  }
  function bgmStart() {
    BGM.on = true;
    if (BGM.timer) clearInterval(BGM.timer);
    BGM.note = 0;
    BGM.timer = setInterval(bgmTick, BGM_TRACKS[BGM.idx].tempo);
    bgmTick();
    updateBgmUi();
  }
  function bgmStop() {
    BGM.on = false;
    if (BGM.timer) { clearInterval(BGM.timer); BGM.timer = null; }
    updateBgmUi();
  }
  function bgmNext() {
    BGM.idx = (BGM.idx + 1) % BGM_TRACKS.length;
    if (BGM.on) bgmStart();
    else updateBgmUi();
  }
  function updateBgmUi() {
    $("#btnBgm").textContent = BGM.on ? "🎶" : "🎵";
    $("#bgmName").textContent = BGM.on ? BGM_TRACKS[BGM.idx].name : "";
  }

  /* ---------- render ---------- */
  function render() {
    if (!S.room) { renderHome(); return; }
    if (S.room.status === "waiting") { renderRoom(); return; }
    renderGame();
  }

  function renderHome() {
    showScreen("#home");
    if (location.protocol === "file:") {
      toast("⚠️ file:// 打开时联机可能受限，请用 http://localhost:8000 或 GitHub 网址");
    }
    if (S.name) $("#inName").value = S.name;
    checkReconnect();
  }
  function readSession() { try { return JSON.parse(localStorage.getItem(LS_SESSION)); } catch (e) { return null; } }
  function checkReconnect() {
    const sess = readSession();
    const rec = $("#reconnect");
    if (!sess || !sess.code) {
      rec.classList.add("hidden");
      rec._sess = null;
      return;
    }
    fetchRoom(sess.code).then(function (room) {
      if (room && room.status !== "ended" && playerById(room, sess.playerId)) {
        rec.classList.remove("hidden");
        rec._sess = sess;
      } else {
        rec.classList.add("hidden");
        rec._sess = null;
      }
    });
  }

  function renderRoom() {
    showScreen("#room");
    const room = S.room;
    $("#roomCode").textContent = room.code;
    $("#playerCount").textContent = room.players.length;
    $("#maxPlayers").textContent = room.settings.maxPlayers;
    const box = $("#roomPlayers");
    box.innerHTML = "";
    room.players.forEach(p => {
      box.appendChild(h("div", { class: "room-player" },
        h("span", { class: "rp-token" }, p.token),
        h("span", { class: "rp-name" }, p.name),
        p.id === room.host ? h("span", { class: "rp-host" }, "房主") : null,
        !isOnline(p) ? h("span", { class: "dim" }, "离线") : null
      ));
    });
    const isHost = room.host === S.playerId;
    $("#hostSettingsCard").style.display = isHost ? "" : "none";
    $("#setMoney").value = room.settings.initialMoney;
    $("#setMax").value = room.settings.maxPlayers;
    $("#setCards").value = room.settings.startCards;
    $("#setSound").value = room.settings.sound ? "1" : "0";
    $("#setAnim").value = room.settings.anim;
    const startBtn = $("#btnStart");
    startBtn.disabled = !(isHost && room.players.length >= 2);
  }

  function renderGame() {
    showScreen("#game");
    const room = S.room;
    $("#hudCode").textContent = room.code;
    $("#btnSound").textContent = room.settings.sound ? "🔊" : "🔇";
    $("#btnEndTurn").disabled = !isMe();
    const turnEl = $("#hudTurn");
    if (room.status === "ended") {
      turnEl.textContent = "🏆 " + (playerById(room, room.winner) || {}).name + " 获胜";
    } else {
      const p = cur();
      turnEl.textContent = "轮到 " + p.name + (room.phase === "landing" ? "（结算中）" : "") + (room.dice ? "  🎲" + room.dice : "");
    }
    renderBoard();
    renderPlayers();
    renderActionBar();
    if (isMe() && room.phase === "landing" && room.pending) landingModal();
  }

  // 62 格 → 长方形环：右下角 = 起点A(index 0)，左上角 = 起点B(index 31)
  function cellPosition(index) {
    const W = 22, H = 11;
    let i = index;
    if (i === 0) return { r: H - 1, c: W - 1 }; // 起点A（右下）
    i--;
    if (i < W - 2) return { r: H - 1, c: W - 2 - i }; // 底边向左
    i -= (W - 2);
    if (i === 0) return { r: H - 1, c: 0 }; // 乔司监狱（左下）
    i--;
    if (i < H - 2) return { r: H - 2 - i, c: 0 }; // 左边向上
    i -= (H - 2);
    if (i === 0) return { r: 0, c: 0 }; // 起点B（左上）
    i--;
    if (i < W - 2) return { r: 0, c: 1 + i }; // 顶边向右
    i -= (W - 2);
    if (i === 0) return { r: 0, c: W - 1 }; // 卡牌补给站（右上）
    i--;
    return { r: 1 + i, c: W - 1 }; // 右边向下
  }
  function renderBoard() {
    const room = S.room;
    const box = $("#board");
    box.innerHTML = "";
    box.appendChild(h("div", { class: "board-center" },
      h("div", { class: "board-center-title" }, "大富翁之"),
      h("div", { class: "board-center-title" }, "金聪明游浙江")
    ));
    const curCell = cur() ? cur().pos : -1;
    BOARD.forEach(c => {
      const pr = room.props[c.index];
      const pos = cellPosition(c.index);
      const owner = (c.t === "prop" || c.t === "special") && pr && pr.owner ? playerById(room, pr.owner) : null;
      const cell = h("div", {
        class: "cell " + cellClass(c) + (c.index === curCell ? " current" : ""),
        style: { gridRowStart: pos.r + 1, gridColumnStart: pos.c + 1 }
      });
      if (owner) cell.style.borderLeft = "3px solid " + colorOf(owner);
      if (c.t === "prop" || c.t === "special") cell.appendChild(h("div", { class: "c-city" }, c.city || ""));
      cell.appendChild(h("div", { class: "c-name" }, c.name));
      let meta = "";
      let priceText = "", priceClass = "";
      if (c.t === "prop") {
        meta = (pr.regionsOwned || 0) + "/" + c.regionCount;
        if (pr.owner) {
          if (pr.buildingLevel) meta += " " + ZT.BUILD_NAMES[pr.buildingLevel];
          meta += " " + (owner ? owner.name : "?");
          priceText = "¥" + EN.propToll(room, c); priceClass = "c-toll";
        } else {
          priceText = "¥" + c.land[c.regionCount - 1]; priceClass = "c-price";
        }
      } else if (c.t === "special") {
        if (pr.owner) { meta = (owner ? owner.name : "?") + "·特色"; priceText = "¥" + EN.specialToll(room, c); priceClass = "c-toll"; }
        else { meta = "特色"; priceText = "¥" + ZT.SPECIAL_PRICE; priceClass = "c-price"; }
      }
      cell.appendChild(h("div", { class: "c-meta" }, meta));
      if (priceText) cell.appendChild(h("div", { class: priceClass }, priceText));
      const here = room.players.filter(p => !p.bankrupt && p.pos === c.index);
      if (here.length) {
        const t = h("div", { class: "tokens" });
        here.forEach(p => t.appendChild(h("span", { class: "token-dot", style: { background: colorOf(p) } }, p.token)));
        cell.appendChild(t);
      }
      cell.addEventListener("click", () => cellInfoModal(c));
      box.appendChild(cell);
    });
  }
  function cellClass(c) {
    if (c.t === "prop") return "tier" + c.tier;
    if (c.t === "special") return "special";
    if (c.t === "start") return "start";
    if (c.t === "jail") return "jail";
    if (c.t === "card" || c.t === "fate" || c.t === "opportunity") return "chance";
    return "empty";
  }

  function renderPlayers() {
    const room = S.room;
    const box = $("#players");
    box.innerHTML = "";
    room.players.forEach(p => {
      const isCur = room.turn === room.players.indexOf(p) && !p.bankrupt;
      const card = h("div", { class: "player-card" + (isCur ? " active" : "") + (isOnline(p) ? "" : " offline") });
      card.appendChild(h("div", { class: "pc-top" },
        h("span", { class: "pc-token" }, p.token),
        h("span", { class: "pc-name" }, p.name)
      ));
      card.appendChild(h("div", { class: "pc-money" }, p.bankrupt ? "破产" : "¥" + p.money));
      if (p.cards.length) card.appendChild(h("div", { class: "pc-cards" }, "卡牌 ×" + p.cards.length));
      if (p.reverse > 0 || p.stop > 0 || p.jailSkip > 0) card.appendChild(h("div", { class: "pc-status" }, statusText(p)));
      card.addEventListener("click", () => playerInfoModal(p));
      box.appendChild(card);
    });
  }
  function statusText(p) {
    const a = [];
    if (p.reverse > 0) a.push("逆向" + p.reverse + "回合");
    if (p.stop > 0) a.push("停留" + p.stop);
    if (p.jailSkip > 0) a.push("监狱");
    return a.join(" ");
  }
  function updatePresence() { if (S.room) renderPlayers(); }

  function renderActionBar() {
    const room = S.room;
    const box = $("#actionbar");
    box.innerHTML = "";
    if (room.status === "ended") {
      box.appendChild(h("div", { class: "ab-hint" }, "游戏结束，" + (playerById(room, room.winner) || {}).name + " 获胜"));
      return;
    }
    if (!isMe()) {
      box.appendChild(h("div", { class: "ab-hint" }, "等待 " + cur().name + " 操作…"));
      return;
    }
    if (room.phase === "landing") {
      if (landingMsg) {
        box.appendChild(h("div", { class: "ab-hint" }, landingMsg));
        box.appendChild(btn("结算完成", () => { landingMsg = null; doneLanding({}); }));
      } else {
        box.appendChild(h("div", { class: "ab-hint" }, "结算中…"));
      }
      return;
    }
    landingMsg = null;
    if (cur().skipReason) {
      const msg = cur().skipReason === "jail" ? "你在乔司监狱，本回合无法行动" : "你被停留卡定住，本回合无法行动";
      box.appendChild(h("div", { class: "ab-hint" }, msg));
      box.appendChild(btn("结束回合", () => endSkip()));
      return;
    }
    // my turn, action phase
    const p = cur();
    const row = h("div", { class: "ab-row" });
    row.appendChild(btn("🎲 掷骰子", onRoll));
    row.appendChild(btn("🃏 卡牌(" + p.cards.length + ")", cardsModal, "btn-ghost"));
    row.appendChild(btn("🏦 抵押", mortgageModal, "btn-ghost"));
    box.appendChild(row);
  }

  function endSkip() {
    EN.skipTurn(S.room);
    saveAndBroadcast();
    render();
  }

  function forceEndTurn() {
    if (!isMe()) { toast("还没轮到你"); return; }
    EN.forceEndTurn(S.room);
    landingMsg = null;
    closeModal();
    saveAndBroadcast();
    render();
  }

  function showRules() {
    openModal("游戏规则", h("div", { class: "rules" }, RULES.map(function (t) {
      return h("p", {}, t);
    })), [h("button", { class: "btn btn-ghost", onclick: closeModal }, "关闭")]);
  }

  /* ---------- actions ---------- */
  function onRoll() {
    const room = S.room;
    if (!isMyTurn()) return;
    sfxRoll();
    EN.roll(room);
    saveAndBroadcast();
    render();
  }

  function doneLanding(action) {
    const room = S.room;
    EN.resolve(room, action || {});
    saveAndBroadcast();
    closeModal();
    render();
  }

  function landingModal() {
    const room = S.room, pend = room.pending;
    if (!pend) return;
    const cell = BOARD[pend.cell !== undefined ? pend.cell : -1];
    if (pend.type === "none" || pend.type === "jail" || pend.type === "card" || pend.type === "fate") {
      let msg = "";
      if (pend.type === "none") msg = (pend.name || "这里") + "，没有特殊事件。";
      else if (pend.type === "jail") msg = "乔司监狱掷出 " + pend.die + "（" + (pend.odd ? "单数 → 离开" : "双数 → 停留 1 回合") + "）";
      else if (pend.type === "card") msg = "在" + pend.cell + "获得一张【" + cardName(pend.card) + "】";
      else if (pend.type === "fate") msg = "命运「" + pend.card.name + "」：" + pend.result;
      landingMsg = msg;
      return;
    }
    if (pend.type === "buy") {
      const money = cur().money;
      const body = h("div", {},
        h("div", { class: "big" }, cell.name),
        h("div", { class: "dim" }, "可购买 " + pend.avail + " 个区域（顺序购买），当前 " + (room.props[pend.cell].regionsOwned || 0) + "/" + cell.regionCount),
        h("div", { class: "dim" }, "你的资金 ¥" + cur().money)
      );
      const foot = [];
      const b1 = btn("买 1 个 ¥" + pend.cost1, () => { sfxBuy(); doneLanding({ count: 1 }); });
      if (pend.cost1 > money) b1.disabled = true;
      foot.push(b1);
      if (pend.cost2 != null) {
        const b2 = btn("买 2 个 ¥" + pend.cost2, () => { sfxBuy(); doneLanding({ count: 2 }); }, "btn-ghost");
        if (pend.cost2 > money) b2.disabled = true;
        foot.push(b2);
      }
      foot.push(btn("跳过", () => doneLanding({ count: 0 }), "btn-ghost"));
      openModal("购买区域", body, foot);
      return;
    }
    if (pend.type === "build") {
      const pr = room.props[pend.cell];
      const money = cur().money;
      const body = h("div", {},
        h("div", { class: "big" }, cell.name),
        h("div", { class: "dim" }, "当前建筑：" + (ZT.BUILD_NAMES[pr.buildingLevel] || "无") + "，最多升 " + pend.lvls + " 级"),
        h("div", { class: "dim" }, "你的资金 ¥" + cur().money)
      );
      const foot = [];
      if (pend.cost1 != null) {
        const u1 = btn("升 1 级 ¥" + pend.cost1, () => { sfxBuy(); doneLanding({ levels: 1 }); });
        if (pend.cost1 > money) u1.disabled = true;
        foot.push(u1);
      }
      if (pend.cost2 != null) {
        const u2 = btn("升 2 级 ¥" + pend.cost2, () => { sfxBuy(); doneLanding({ levels: 2 }); }, "btn-ghost");
        if (pend.cost2 > money) u2.disabled = true;
        foot.push(u2);
      }
      foot.push(btn("不升级", () => doneLanding({ levels: 0 }), "btn-ghost"));
      openModal("建设建筑", body, foot);
      return;
    }
    if (pend.type === "buy-special") {
      const money = cur().money;
      const b = btn("购买 ¥" + pend.price, () => { sfxBuy(); doneLanding({ buy: true }); });
      if (pend.price > money) b.disabled = true;
      openModal("购买特色地块",
        h("div", {},
          h("div", { class: "big" }, cell.name),
          h("div", { class: "dim" }, "购买价格 ¥" + pend.price + "，你的资金 ¥" + money)
        ),
        [b, btn("不买", () => doneLanding({ buy: false }), "btn-ghost")]);
      return;
    }
    if (pend.type === "opportunity") {
      const card = pend.card;
      const money = cur().money;
      const g = btn("把握机会", () => { sfxCard(); doneLanding({ grasp: true }); });
      if (money < card.lose) g.disabled = true;
      openModal("机会 · " + card.name,
        h("div", {},
          h("div", { class: "big" }, card.name),
          h("div", { class: "dim" }, card.invest > 0 ? "投资 ¥" + card.invest + "，成功得 ¥" + card.win + "，失败失 ¥" + card.lose : "无需投资，成功得 ¥" + card.win + "，失败失 ¥" + card.lose),
          h("div", { class: "dim" }, "机会骰子：奇数失败 / 偶数成功（不影响移动）")
        ),
        [g, btn("放弃机会", () => doneLanding({}), "btn-ghost")]);
      return;
    }
    if (pend.type === "opportunity_result") {
      openModal("机会结算",
        h("div", {},
          h("div", { class: "big" }, pend.success ? "✅ 成功" : "❌ 失败"),
          h("div", { class: "dim" }, "机会骰子：" + pend.die),
          h("div", { class: "big" }, pend.delta >= 0 ? "获得 ¥" + pend.delta : "损失 ¥" + (-pend.delta))
        ),
        [btn("完成", () => doneLanding({}))]);
      return;
    }
    if (pend.type === "pay") {
      const owner = playerById(room, pend.owner);
      openModal("支付过路费",
        h("div", {},
          h("div", { class: "big" }, "¥" + pend.toll),
          h("div", { class: "dim" }, "支付给 " + (owner ? owner.name : "银行") + "，你的资金 ¥" + cur().money)
        ),
        [btn("支付", () => { sfxPay(); doneLanding({}); })]);
      return;
    }
    if (pend.type === "emergency") {
      emergencyModal(pend);
      return;
    }
    // 兜底：任何未处理的结算类型都给一个“结算完成”按钮，避免卡住
    landingMsg = "本回合结算完成";
  }

  function emergencyModal(pend) {
    const room = S.room, p = cur();
    const list = BOARD.filter(c => c.t === "prop" && room.props[c.index].owner === p.id && (room.props[c.index].regionsOwned > 0 || room.props[c.index].buildingLevel > 0));
    const body = h("div", {},
      h("div", { class: "big" }, "还差 ¥" + Math.max(0, pend.shortfall)),
      h("div", { class: "dim" }, "可抵押地产凑钱，或破产退出"),
      h("div", { class: "opt-list" },
        list.length ? list.map(c => {
          const val = EN.mortgageValue(c, room.props[c.index]);
          return h("button", { class: "opt-btn", onclick: () => { sfxPay(); doneLanding({ mortgage: c.index }); } }, c.name + " → 抵押得 ¥" + val);
        }) : h("div", { class: "dim" }, "没有可抵押的地产")
      )
    );
    openModal("资金不足", body, [h("button", { class: "btn btn-danger", onclick: () => doneLanding({ bankrupt: true }) }, "破产退出")]);
  }

  /* ---------- cards ---------- */
  function cardsModal() {
    const p = cur();
    if (!p.cards.length) { toast("没有卡牌"); return; }
    const counts = {};
    p.cards.forEach(id => counts[id] = (counts[id] || 0) + 1);
    const list = Object.keys(counts).map(id => ({ id: id, n: counts[id] }));
    openModal("使用卡牌",
      h("div", { class: "opt-list" }, list.map(c => h("button", { class: "opt-btn", onclick: () => cardFlow(c.id) }, cardName(c.id) + " ×" + c.n))),
      [h("button", { class: "btn btn-ghost", onclick: closeModal }, "关闭")]
    );
  }
  function cardFlow(cardId) {
    if (cardId === "cheat") {
      const body = h("div", {}, h("div", { class: "dim", style: { marginBottom: "10px" } }, "选择本回合骰子点数"), h("div", { class: "grid-6" }));
      for (let v = 1; v <= 6; v++) body.lastChild.appendChild(h("button", { class: "die-btn", onclick: () => doCard(cardId, { value: v }) }, "" + v));
      openModal("作弊卡", body, [h("button", { class: "btn btn-ghost", onclick: cardsModal }, "返回")]);
      return;
    }
    if (cardId === "remove") {
      const room = S.room;
      const targets = BOARD.filter(c => c.t === "prop" && room.props[c.index].owner && room.props[c.index].owner !== S.playerId && room.props[c.index].buildingLevel > 0);
      if (!targets.length) { toast("没有可拆除的目标（需要他人有建筑的地块）"); return; }
      openModal("拆除卡 · 选择目标",
        h("div", { class: "opt-list" }, targets.map(c => h("button", { class: "opt-btn", onclick: () => doCard(cardId, { cell: c.index }) }, c.name + "（" + ZT.BUILD_NAMES[room.props[c.index].buildingLevel] + "）"))),
        [h("button", { class: "btn btn-ghost", onclick: cardsModal }, "返回")]
      );
      return;
    }
    doCard(cardId, {});
  }
  function doCard(cardId, opts) {
    const res = EN.useCard(S.room, S.playerId, cardId, opts || {});
    if (res.error) { toast(res.error); return; }
    sfxCard();
    saveAndBroadcast();
    closeModal();
    render();
  }

  /* ---------- mortgage ---------- */
  function mortgageModal() {
    const room = S.room, p = cur();
    const list = BOARD.filter(c => c.t === "prop" && room.props[c.index].owner === p.id && (room.props[c.index].regionsOwned > 0 || room.props[c.index].buildingLevel > 0));
    if (!list.length) { toast("没有可抵押的地产"); return; }
    openModal("抵押地产",
      h("div", { class: "opt-list" }, list.map(c => {
        const val = EN.mortgageValue(c, room.props[c.index]);
        return h("button", { class: "opt-btn", onclick: () => doMortgage(c.index) }, c.name + " → 抵押得 ¥" + val);
      })),
      [h("button", { class: "btn btn-ghost", onclick: closeModal }, "关闭")]
    );
  }
  function doMortgage(idx) {
    const res = EN.mortgage(S.room, S.playerId, idx);
    if (res.error) { toast(res.error); return; }
    sfxPay();
    saveAndBroadcast();
    closeModal();
    render();
  }

  /* ---------- info modals ---------- */
  function cellInfoModal(c) {
    const room = S.room, pr = room.props[c.index];
    let html = "<div class='big'>" + c.name + "</div>";
    if (c.city) html += "<div class='dim'>所属地区：" + c.city + "</div>";
    if (c.t === "prop") {
      html += "<div class='dim'>区域数：" + c.regionCount + "，当前 " + (pr.regionsOwned || 0) + "/" + c.regionCount + "</div>";
      if (pr.owner) {
        const owner = playerById(room, pr.owner);
        html += "<div class='dim'>所有者：" + (owner ? owner.name : "?") + "，建筑：" + (ZT.BUILD_NAMES[pr.buildingLevel] || "无") + "</div>";
        html += "<div class='big'>过路费 ¥" + EN.propToll(room, c) + "</div>";
        if (owner && owner.id === S.playerId) html += "<div class='dim'>可抵押价值 ¥" + EN.mortgageValue(c, pr) + "</div>";
      } else {
        html += "<div class='dim'>无主，可购买</div>";
      }
    } else if (c.t === "special") {
      if (pr.owner) {
        const owner = playerById(room, pr.owner);
        html += "<div class='dim'>已购买 · " + (owner ? owner.name : "?") + "</div>";
        html += "<div class='big'>过路费 ¥" + EN.specialToll(room, c) + "</div>";
      } else html += "<div class='dim'>无主特色地块，可购买 ¥" + ZT.SPECIAL_PRICE + "</div>";
    }
    openModal("地块信息", h("div", { html: html }), [h("button", { class: "btn btn-ghost", onclick: closeModal }, "关闭")]);
  }
  function playerInfoModal(p) {
    const room = S.room;
    const props = BOARD.filter(c => (c.t === "prop" || c.t === "special") && room.props[c.index].owner === p.id);
    const body = h("div", {},
      h("div", { class: "big" }, p.token + " " + p.name),
      h("div", { class: "dim" }, "资金 ¥" + p.money + " · 卡牌 ×" + p.cards.length),
      h("div", { class: "opt-list", style: { marginTop: "10px" } }, props.length ? props.map(c => h("div", { class: "dim" }, c.name + (c.t === "prop" ? " " + (room.props[c.index].regionsOwned) + "/" + c.regionCount + (room.props[c.index].buildingLevel ? " " + ZT.BUILD_NAMES[room.props[c.index].buildingLevel] : "") : "（特色）"))) : h("div", { class: "dim" }, "暂无地产"))
    );
    openModal("玩家信息", body, [h("button", { class: "btn btn-ghost", onclick: closeModal }, "关闭")]);
  }

  /* ---------- home actions ---------- */
  function showScreen(sel) {
    $$(".screen").forEach(s => s.classList.add("hidden"));
    $(sel).classList.remove("hidden");
  }

  function createRoom() {
    const name = ($("#inName").value || "").trim() || "房主";
    const room = EN.newRoom(name, { initialMoney: ZT.DEFAULT_MONEY, maxPlayers: 6, sound: true, anim: "fast" });
    S.room = room; S.code = room.code; S.playerId = room.players[0].id; S.name = name;
    saveSession(); saveRoomToCloud(room); watchRoom(room.code); startHeartbeat();
    render();
  }
  async function joinRoom() {
    const code = ($("#inCode").value || "").trim().toUpperCase();
    if (code.length < 3) { toast("请输入房间号"); return; }
    const room = await fetchRoom(code);
    if (!room) { toast("房间不存在（请确认房间号是否正确）"); return; }
    if (room.status !== "waiting") { toast("该房间已开始游戏，无法加入"); return; }
    const name = ($("#inName").value || "").trim() || ("玩家" + (room.players.length + 1));
    const res = EN.join(room, name);
    if (res.error) { toast(res.error); return; }
    S.room = room; S.code = code; S.playerId = res.player.id; S.name = name;
    saveSession(); saveRoomToCloud(room); watchRoom(code); startHeartbeat();
    render();
  }
  async function reconnect() {
    const sess = $("#reconnect")._sess;
    if (!sess) return;
    const room = await fetchRoom(sess.code);
    if (!room) { clearSession(); renderHome(); return; }
    if (!playerById(room, sess.playerId)) { clearSession(); toast("你已不在该房间"); renderHome(); return; }
    S.room = room; S.code = sess.code; S.playerId = sess.playerId; S.name = sess.name;
    saveSession(); watchRoom(sess.code); startHeartbeat();
    render();
  }
  function leaveRoom() {
    bgmStop();
    stopHeartbeat();
    unwatchRoom();
    if (CLOUD_DB && S.code && S.playerId) {
      presenceRef(S.code, S.playerId).remove().catch(function () {});
    }
    clearSession();
    S.room = null; S.code = null; S.playerId = null;
    renderHome();
  }

  function startGame() {
    if (S.room.host !== S.playerId) return;
    const room = S.room;
    room.settings.initialMoney = parseInt($("#setMoney").value, 10) || ZT.DEFAULT_MONEY;
    room.settings.maxPlayers = parseInt($("#setMax").value, 10) || 6;
    room.settings.startCards = parseInt($("#setCards").value, 10) || 0;
    room.settings.sound = $("#setSound").value === "1";
    room.settings.anim = $("#setAnim").value;
    EN.start(room);
    saveAndBroadcast();
    render();
  }

  /* ---------- wiring ---------- */
  function bind() {
    $("#btnCreate").onclick = createRoom;
    $("#btnRules").onclick = showRules;
    $("#btnJoin").onclick = joinRoom;
    $("#btnReconnect").onclick = reconnect;
    $("#btnLeave").onclick = leaveRoom;
    $("#btnExitGame").onclick = leaveRoom;
    $("#btnEndTurn").onclick = forceEndTurn;
    $("#btnCopyCode").onclick = () => {
      const code = S.room && S.room.code;
      if (!code) return;
      try { navigator.clipboard.writeText(code).then(() => toast("已复制房间号")); } catch (e) { toast("房间号：" + code); }
    };
    $("#btnStart").onclick = startGame;
    $("#btnSound").onclick = () => {
      S.room.settings.sound = !S.room.settings.sound;
      saveAndBroadcast();
      render();
    };
    $("#btnBgm").onclick = () => { BGM.on ? bgmStop() : bgmStart(); };
    $("#btnNext").onclick = bgmNext;
    $("#btnLog").onclick = () => {
      const room = S.room;
      openModal("游戏记录", h("div", { class: "log-list" }, room.log.map(l => h("div", {}, l.text))), [h("button", { class: "btn btn-ghost", onclick: closeModal }, "关闭")]);
    };
    $("#modalClose").onclick = closeModal;
    $("#modal").addEventListener("click", e => { if (e.target === $("#modal")) closeModal(); });
    // settings live-edit (host)
    $("#setMoney").onchange = () => { if (S.room && S.room.host === S.playerId) { S.room.settings.initialMoney = parseInt($("#setMoney").value, 10) || ZT.DEFAULT_MONEY; saveAndBroadcast(); } };
    $("#setMax").onchange = () => { if (S.room && S.room.host === S.playerId) { S.room.settings.maxPlayers = parseInt($("#setMax").value, 10) || 6; saveAndBroadcast(); } };
    $("#setSound").onchange = () => { if (S.room && S.room.host === S.playerId) { S.room.settings.sound = $("#setSound").value === "1"; saveAndBroadcast(); } };
    $("#setAnim").onchange = () => { if (S.room && S.room.host === S.playerId) { S.room.settings.anim = $("#setAnim").value; saveAndBroadcast(); } };
  }

  bind();
  renderHome();
  setInterval(refreshPresence, 6000);
  setInterval(function () {
    if (S.code && CLOUD_DB && S.room) pullRoom();
  }, 3000);

  initCloud().then(function () {
    console.log("CloudBase 已连接");
    checkReconnect();
  }).catch(function (e) {
    console.warn("CloudBase 初始化失败", e);
    toast("联机服务连接失败，请检查网络或稍后重试");
  });
})();
