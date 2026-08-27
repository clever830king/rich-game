(function () {
  "use strict";

  const ZT = window.ZT;
  const EN = window.ZTEngine;
  const BOARD = ZT.BOARD;
  const CARDS = ZT.CARDS;
  const TOKEN_COLORS = ["#f43f5e", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf0", "#ec4899"];
  const CITY_HUE = { "杭州": 210, "宁波": 0, "绍兴": 180, "湖州": 120, "嘉兴": 45, "严州": 280, "衢州": 20, "金华": 55, "丽水": 155, "温州": 330, "台州": 245, "舟山": 200 };
  const CITY_LANDMARK = { "杭州": "🗼", "宁波": "📚", "绍兴": "🍶", "湖州": "🖌️", "嘉兴": "🚤", "严州": "🏞️", "衢州": "🏔️", "金华": "🍖", "丽水": "🌲", "温州": "⛵", "台州": "🏝️", "舟山": "⚓" };
  const SCENES = [
    ["杭州", "西湖", "🏞️"], ["杭州", "雷峰塔", "🗼"], ["杭州", "灵隐寺", "⛩️"], ["杭州", "钱塘江", "🌊"],
    ["宁波", "天一阁", "📚"], ["宁波", "老外滩", "🌉"], ["宁波", "东钱湖", "🌅"], ["宁波", "北仑港", "🚢"],
    ["绍兴", "鲁迅故里", "📖"], ["绍兴", "东湖乌篷船", "🛶"], ["绍兴", "兰亭", "🖌️"], ["绍兴", "黄酒小镇", "🍶"],
    ["湖州", "南浔古镇", "🏘️"], ["湖州", "莫干山", "⛰️"], ["湖州", "太湖", "🌊"], ["湖州", "丝绸之府", "🧵"],
    ["嘉兴", "南湖红船", "🚤"], ["嘉兴", "乌镇", "🏮"], ["嘉兴", "西塘", "🌉"], ["嘉兴", "钱塘潮", "🌊"],
    ["严州", "千岛湖", "🏝️"], ["严州", "新安江", "🏞️"], ["严州", "梅城古镇", "🏯"], ["严州", "大慈岩", "⛰️"],
    ["衢州", "江郎山", "🏔️"], ["衢州", "烂柯山", "♟️"], ["衢州", "龙游石窟", "🕳️"], ["衢州", "南孔庙", "⛩️"],
    ["金华", "金华火腿", "🍖"], ["金华", "双龙洞", "🕳️"], ["金华", "义乌小商品", "🏪"], ["金华", "横店影视城", "🎬"],
    ["丽水", "畲乡风情", "🏮"], ["丽水", "仙都", "⛰️"], ["丽水", "云和梯田", "🌾"], ["丽水", "龙泉青瓷", "🏺"],
    ["温州", "雁荡山", "⛰️"], ["温州", "楠溪江", "🏞️"], ["温州", "江心屿", "🏝️"], ["温州", "五马街", "🏙️"],
    ["台州", "天台山", "⛰️"], ["台州", "神仙居", "🌫️"], ["台州", "温岭石塘", "🌊"], ["台州", "临海古城", "🏯"],
    ["舟山", "普陀山", "⛩️"], ["舟山", "朱家尖", "🏖️"], ["舟山", "东极岛", "🌅"], ["舟山", "沈家门渔港", "⚓"]
  ];
  const BUILD_ICONS = ["", "🏪", "🏬", "🏨", "🏩", "🏢", "🏙️"];
  const RULES = [
    "一、目标：游历浙江 12 城，买地、建房、收过路费，把对手耗到破产，最后剩下的玩家获胜。",
    "二、地图：62 格环形地图，含右下起点、左上起点、乔司监狱、卡牌补给站、命运×3、机会×1、空地×4 和 50 个城市地块。开局随机分到右下或左上起点，按顺时针移动。",
    "三、起点奖励：每次经过自己的出生起点获得房主设定的金额（默认 ¥3000，房主可改）。",
    "四、城市地块：一个地块最多 2 个区域；一次只能买 1 个区域，不能一次买两个；两个区域都买齐后，需要再次到达该地块才能建楼；购买区域和建楼不能在同一次到达同时进行。地块按 GDP 分 6 档（400/800/1200/1600/2000/2400），两区域地块区域1=原价、区域2=半价。",
    "五、建筑：6 级——店铺→商铺→旅馆→酒店→大厦→新城，必须按顺序升级，一次最多升 2 级，不能跳级。",
    "六、新城效果：任意玩家建成 1 座【新城】，全场城市地租永久 ×1.5；每多 1 座新城再 +0.5 倍（公式：1 + 新城数×0.5）。",
    "七、过路费 = 基础地租 × 同城地块加成 × 全场新城倍率。同城每多拥有 1 个地块，加成按房主设定（默认 +0.2，可改 0.2/0.3/0.4/0.5）。地图格子上直接显示当前实际过路费。",
    "八、卡牌补给站：到达后随机获得一张特殊卡。六种特殊卡——逆向卡（随机一人逆向 3 回合）、霸王卡（下次踩到他人地块可免一次过路费）、停留卡（对自己脚下地块额外买 1 区域或升 1~2 级建筑）、作弊卡（自选本次点数 1–6）、爆破卡（自己脚下地块：有建筑降 3 级，无建筑区域-1）、拆除卡（他人一个有建筑的地块降 1 级）。",
    "九、命运（不可控，抽到立即执行，共 14 张）：可能暂停、损失/获得金钱、后退 3 格、随机获得或失去卡牌。",
    "十、机会（主动把握，共 12 张）：抽到后可选「把握机会」或「放弃机会」；把握需按卡牌投资，然后掷机会骰子——1/3/5 失败、2/4/6 成功，机会骰子不影响移动；部分机会成功后还会额外获得卡牌。",
    "十一、乔司监狱：进入掷骰，单数直接离开、双数下回合停留一回合。",
    "十二、抵押：只能在掷骰子前主动抵押；整块地块（含已购区域和建筑）一起抵押，返还实际投资的 50%，地块回归银行。付不起过路费时可紧急抵押，仍不够则破产退出。",
    "十三、时间限制：掷骰子后不能主动用卡牌、抵押、建设；只有落地后付不起过路费时才能紧急抵押。",
    "十四、掉线接管：有玩家掉线或离线时，AI 会自动接管他的回合，避免游戏卡住；房主也可在创建时直接加入 AI 玩家。",
    "十五、结算：空地、起点、命运、机会、监狱等结算会自动完成并进入下一位玩家，不需要手动跳过。"
  ];

  const BGM_TRACKS = [
    { name: "杭州·西湖恋歌", base: 220, tempo: 470, seq: [0,4,7,9,7,4,0,2,5,9,7,5] },
    { name: "杭州·钱塘月光", base: 233, tempo: 500, seq: [0,2,7,11,7,2,0,4,9,12,9,4] },
    { name: "杭州·灵隐晨钟", base: 196, tempo: 540, seq: [0,5,9,12,9,5,0,2,7,11,7,2] },
    { name: "宁波·天一阁书香", base: 208, tempo: 480, seq: [0,4,7,11,7,4,0,2,7,9,7,2] },
    { name: "宁波·老外滩夜色", base: 185, tempo: 450, seq: [0,2,7,9,7,2,0,5,9,12,9,5] },
    { name: "宁波·北仑港风", base: 247, tempo: 460, seq: [0,5,7,12,7,5,0,3,9,12,9,3] },
    { name: "绍兴·黄酒谣", base: 220, tempo: 490, seq: [0,4,7,10,7,4,0,2,5,9,5,2] },
    { name: "绍兴·乌篷船", base: 262, tempo: 520, seq: [0,2,7,9,7,2,0,4,7,11,7,4] },
    { name: "绍兴·兰亭序", base: 208, tempo: 510, seq: [0,3,7,9,7,3,0,5,9,10,9,5] },
    { name: "湖州·南浔烟雨", base: 233, tempo: 500, seq: [0,4,9,12,9,4,0,2,7,9,7,2] },
    { name: "湖州·莫干清风", base: 262, tempo: 540, seq: [0,2,7,9,7,2,0,4,7,11,7,4] },
    { name: "湖州·太湖波光", base: 196, tempo: 470, seq: [0,5,9,12,9,5,0,2,7,11,7,2] },
    { name: "嘉兴·南湖红船", base: 220, tempo: 460, seq: [0,4,7,9,7,4,0,2,5,9,7,5] },
    { name: "嘉兴·乌镇水乡", base: 247, tempo: 520, seq: [0,2,7,11,7,2,0,4,9,12,9,4] },
    { name: "嘉兴·钱塘潮涌", base: 208, tempo: 440, seq: [0,5,7,12,7,5,0,3,9,12,9,3] },
    { name: "严州·千岛湖光", base: 233, tempo: 490, seq: [0,4,9,12,9,4,0,2,7,9,7,2] },
    { name: "严州·新安江畔", base: 262, tempo: 530, seq: [0,2,7,9,7,2,0,4,7,11,7,4] },
    { name: "严州·梅城旧梦", base: 196, tempo: 560, seq: [0,3,7,10,7,3,0,5,9,12,9,5] },
    { name: "衢州·江郎山歌", base: 208, tempo: 480, seq: [0,4,7,11,7,4,0,2,7,9,7,2] },
    { name: "衢州·烂柯棋韵", base: 220, tempo: 520, seq: [0,2,5,9,5,2,0,3,7,10,7,3] },
    { name: "衢州·南孔雅乐", base: 247, tempo: 510, seq: [0,5,9,12,9,5,0,2,7,11,7,2] },
    { name: "金华·火腿飘香", base: 196, tempo: 460, seq: [0,4,7,10,7,4,0,2,5,9,5,2] },
    { name: "金华·义乌商歌", base: 262, tempo: 490, seq: [0,2,7,9,7,2,0,4,7,11,7,4] },
    { name: "金华·横店光影", base: 233, tempo: 470, seq: [0,4,9,11,9,4,0,2,7,10,7,2] },
    { name: "丽水·畲乡风情", base: 220, tempo: 520, seq: [0,2,5,9,5,2,0,3,7,10,7,3] },
    { name: "丽水·仙都云海", base: 247, tempo: 540, seq: [0,3,7,9,7,3,0,5,9,10,9,5] },
    { name: "丽水·梯田绿浪", base: 262, tempo: 500, seq: [0,4,7,9,7,4,0,2,5,9,7,5] },
    { name: "温州·雁荡山韵", base: 208, tempo: 480, seq: [0,3,7,10,7,3,0,5,9,12,9,5] },
    { name: "温州·楠溪江", base: 233, tempo: 510, seq: [0,2,7,9,7,2,0,4,7,11,7,4] },
    { name: "温州·瓯江夜曲", base: 196, tempo: 460, seq: [0,4,7,11,7,4,0,2,7,9,7,2] },
    { name: "台州·天台禅音", base: 175, tempo: 580, seq: [0,2,5,9,5,2,0,3,7,10,7,3] },
    { name: "台州·神仙居", base: 220, tempo: 500, seq: [0,4,9,12,9,4,0,2,7,9,7,2] },
    { name: "台州·石塘渔歌", base: 247, tempo: 470, seq: [0,5,7,12,7,5,0,3,9,12,9,3] },
    { name: "舟山·普陀梵音", base: 185, tempo: 590, seq: [0,2,5,9,5,2,0,3,7,10,7,3] },
    { name: "舟山·东极岛", base: 208, tempo: 500, seq: [0,4,9,12,9,4,0,2,7,9,7,2] },
    { name: "舟山·渔港灯火", base: 262, tempo: 480, seq: [0,2,7,9,7,2,0,5,9,12,9,5] }
  ];

  const LS_SESSION = "zt_my_session";
  const CLOUD_ENV = "dafuwen-d5gehh0dge8fe447f";
  const CLOUD_ACCESS_KEY = "";

  let S = { code: null, playerId: null, name: null, room: null, seen: {}, watcher: null };
  let SEL_TOKEN = "🎩";
  let hbTimer = null;
  let landingMsg = null;
  let CLOUD_DB = null;
  let CLOUD_READY = false;
  let writeChain = Promise.resolve();
  let LOCAL_CHANNEL = null;
  function localKey(code) { return "zt_room_" + code; }
  function localSave(room) {
    try { localStorage.setItem(localKey(room.code), JSON.stringify(cleanRoom(room))); } catch (e) {}
    if (LOCAL_CHANNEL) { try { LOCAL_CHANNEL.postMessage({ code: room.code, seq: room.seq }); } catch (e) {} }
  }
  function localGet(code) {
    try { const s = localStorage.getItem(localKey(code)); return s ? JSON.parse(s) : null; } catch (e) { return null; }
  }
  function isLocal() { return !CLOUD_READY; }

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

  /* ---------- transport（腾讯云 CloudBase） ---------- */
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
    if (!code) return Promise.resolve(null);
    if (isLocal()) return Promise.resolve(localGet(code));
    return roomRef(code).get().then(function (res) {
      if (res && res.code) { console.warn("读房间失败", res.code, res.message); return null; }
      return extractDoc(res);
    }).catch(() => null);
  }
  function saveRoomToCloud(room) {
    if (!room || !room.code) return;
    if (isLocal()) { localSave(room); return; }
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
    if (!code) return;
    if (isLocal()) {
      try {
        LOCAL_CHANNEL = new BroadcastChannel("zt_rooms");
        LOCAL_CHANNEL.onmessage = function (e) {
          if (e && e.data && e.data.code === code) {
            const r = localGet(code);
            if (r && S.room && r.seq > S.room.seq) { S.room = r; render(); }
          }
        };
      } catch (e) {}
      window.addEventListener("storage", onStorageEvent);
      return;
    }
    try {
      S.watcher = roomRef(code).watch({
        onChange: function () { pullRoom(); },
        onError: function (e) { console.warn("实时监听断开", e); }
      });
    } catch (e) { console.warn("开启监听失败", e); }
  }
  function onStorageEvent(e) {
    if (e.key === localKey(S.code)) {
      const r = localGet(S.code);
      if (r && S.room && r.seq > S.room.seq) { S.room = r; render(); }
    }
  }
  function unwatchRoom() {
    if (S.watcher) { try { S.watcher.close(); } catch (e) {} S.watcher = null; }
    if (LOCAL_CHANNEL) { try { LOCAL_CHANNEL.close(); } catch (e) {} LOCAL_CHANNEL = null; }
    window.removeEventListener("storage", onStorageEvent);
  }
  function pullRoom() {
    const code = S.code;
    if (!code) return;
    if (isLocal()) {
      const r = localGet(code);
      if (r && S.room && r.seq > S.room.seq) { S.room = r; render(); }
      return;
    }
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
  function startHeartbeat() { stopHeartbeat(); if (!S.playerId || !S.code) return; heartbeat(); hbTimer = setInterval(heartbeat, 5000); }
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
    if (CLOUD_ACCESS_KEY) { verifyDb(); return Promise.resolve(); }
    const a = (typeof app.auth === "function") ? app.auth({ persistence: "local" }) : app.auth;
    const doLogin = (a && typeof a.signInAnonymously === "function")
      ? a.signInAnonymously()
      : ((a && typeof a.anonymousAuthProvider === "function") ? a.anonymousAuthProvider().signIn() : Promise.resolve());
    return doLogin.then(function (r) {
      if (r && r.error) { console.warn("匿名登录失败", r.error.code || r.error); toast("联机登录失败：请确认已开启“匿名登录”"); return r; }
      verifyDb();
      return r;
    }).catch(function (e) { console.warn("匿名登录异常", e); toast("联机登录失败，请检查网络"); });
  }
  function verifyDb() {
    if (!CLOUD_DB) return;
    CLOUD_DB.collection("rooms").limit(1).get().then(function (res) {
      if (res && res.code) {
        console.warn("读权限失败", res.code, res.message);
        CLOUD_DB = null;
        toast("云端暂不可用，已切换本地联机（同浏览器多标签页可玩）");
        return;
      }
      const testRef = CLOUD_DB.collection("rooms").doc("__perm_test__");
      testRef.set({ t: Date.now() }).then(function (res2) {
        if (res2 && res2.code) {
          console.warn("写权限失败", res2.code, res2.message);
          CLOUD_DB = null;
          toast("云端暂不可用，已切换本地联机（同浏览器多标签页可玩）");
        } else {
          CLOUD_READY = true;
          testRef.remove().catch(function () {});
        }
      }).catch(function (e) {
        console.warn("写权限异常", e);
        CLOUD_DB = null;
        toast("云端暂不可用，已切换本地联机（同浏览器多标签页可玩）");
      });
    }).catch(function (e) {
      console.warn("数据库访问失败", e);
      CLOUD_DB = null;
      toast("云端暂不可用，已切换本地联机（同浏览器多标签页可玩）");
    });
  }

  /* ---------- helpers ---------- */
  function cardName(id) { const c = CARDS.find(x => x.id === id); return c ? c.name : id; }
  function playerById(room, id) { return room.players.find(p => p.id === id); }
  function cur() { return S.room.players[S.room.turn]; }
  function me() { return playerById(S.room, S.playerId); }
  function isMe() { return S.room && S.room.status === "playing" && cur() && cur().id === S.playerId; }
  function isMyTurn() { return isMe() && S.room.phase === "action"; }
  function colorOf(p) { const i = S.room.players.indexOf(p); return TOKEN_COLORS[i % TOKEN_COLORS.length]; }
  function isOnline(p) { if (isLocal()) return true; if (p.id === S.playerId) return true; return (S.seen[p.id] || 0) > Date.now() - 12000; }
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

  /* ---------- BGM ---------- */
  let BGM = { on: false, idx: 0, timer: null, note: 0 };
  function bgmNote(freq, dur) {
    if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
    const o = AC.createOscillator(), g = AC.createGain(), f = AC.createBiquadFilter();
    o.type = "sine"; o.frequency.value = freq;
    f.type = "lowpass"; f.frequency.value = 1400; f.Q.value = 0.4;
    o.connect(f); f.connect(g); g.connect(AC.destination);
    const t = AC.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur / 1000);
    o.start(t); o.stop(t + dur / 1000 + 0.1);
  }
  function bgmTick() {
    const tr = BGM_TRACKS[BGM.idx];
    const n = tr.seq[BGM.note % tr.seq.length];
    BGM.note++;
    const root = tr.base * Math.pow(2, n / 12);
    // 铺底和弦（根音 + 五度 + 八度），柔和电子氛围
    bgmNote(root, tr.tempo * 2.2);
    bgmNote(root * Math.pow(2, 7 / 12), tr.tempo * 2.2);
    bgmNote(root * 2, tr.tempo * 2.2);
    // 旋律音（高八度，轻一点）
    const mel = root * Math.pow(2, 4 / 12);
    bgmNote(mel, tr.tempo);
  }
  function bgmStart() {
    BGM.on = true;
    if (BGM.timer) clearInterval(BGM.timer);
    BGM.note = 0;
    BGM.timer = setInterval(bgmTick, BGM_TRACKS[BGM.idx].tempo);
    bgmTick();
    updateBgmUi();
  }
  function bgmStop() { BGM.on = false; if (BGM.timer) { clearInterval(BGM.timer); BGM.timer = null; } updateBgmUi(); }
  function bgmNext() { BGM.idx = (BGM.idx + 1) % BGM_TRACKS.length; if (BGM.on) bgmStart(); else updateBgmUi(); }
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
    if (location.protocol === "file:") toast("⚠️ file:// 打开时联机可能受限，请用 http://localhost:8000 或 GitHub 网址");
    if (S.name) $("#inName").value = S.name;
    renderAvatarRow();
    checkReconnect();
  }
  function renderAvatarRow() {
    const row = $("#avatarRow");
    if (!row) return;
    row.innerHTML = "";
    (EN.TOKENS || ["🎩"]).forEach(function (t) {
      row.appendChild(h("button", { class: "avatar-btn" + (t === SEL_TOKEN ? " sel" : ""), onclick: function () { SEL_TOKEN = t; renderAvatarRow(); } }, t));
    });
  }
  function readSession() { try { return JSON.parse(localStorage.getItem(LS_SESSION)); } catch (e) { return null; } }
  function checkReconnect() {
    const sess = readSession();
    const rec = $("#reconnect");
    if (!sess || !sess.code) { rec.classList.add("hidden"); rec._sess = null; return; }
    fetchRoom(sess.code).then(function (room) {
      if (room && room.status !== "ended" && playerById(room, sess.playerId)) { rec.classList.remove("hidden"); rec._sess = sess; }
      else { rec.classList.add("hidden"); rec._sess = null; }
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
    $("#setCityBonus").value = String(room.settings.cityBonusStep);
    $("#setStartReward").value = String(room.settings.startReward);
    $("#setAI").value = String(room.settings.aiCount);
    $("#setSound").value = room.settings.sound ? "1" : "0";
    $("#setAnim").value = room.settings.anim;
    $("#btnStart").disabled = !(isHost && (room.players.length + (room.settings.aiCount || 0)) >= 2);
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
    const nt = EN.newTownMultiplier(room);
    $("#hudNewtown").textContent = "新城倍率 ×" + nt.toFixed(1);
    renderBoard();
    renderPieces();
    renderPlayers();
    renderChat();
    if (isMe() && room.phase === "landing" && room.pending) landingModal();
    renderActionBar();
    renderDice();
    renderBigEvent();
  }

  // 棋盘：23 列 × 10 行。右下=起点A，左下=乔司监狱，左上=起点B，右上=卡牌补给站
  function cellPosition(index) {
    const W = 23, H = 10;
    const i = index;
    if (i === 0) return { r: H - 1, c: W - 1 };
    if (i < W - 1) return { r: H - 1, c: W - 1 - i };
    if (i === W - 1) return { r: H - 1, c: 0 };
    if (i < W + H - 2) return { r: H - 2 - (i - W), c: 0 };
    if (i === W + H - 2) return { r: 0, c: 0 };
    if (i < 2 * W + H - 3) return { r: 0, c: 1 + (i - (W + H - 1)) };
    if (i === 2 * W + H - 3) return { r: 0, c: W - 1 };
    return { r: 1 + (i - (2 * W + H - 2)), c: W - 1 };
  }

  function renderBoard() {
    const room = S.room;
    const box = $("#board");
    let pieceLayer = $("#pieceLayer");
    Array.from(box.children).forEach(function (ch) { if (ch !== pieceLayer) box.removeChild(ch); });
    if (!pieceLayer) {
      pieceLayer = h("div", { class: "piece-layer", id: "pieceLayer" });
      box.appendChild(pieceLayer);
    }
    box.appendChild(h("div", { class: "board-center" },
      h("div", { class: "board-center-title" }, "大富翁之"),
      h("div", { class: "board-center-title" }, "金聪明游浙江"),
      h("div", { class: "board-center-sub" }, "游历浙江 12 城"),
      h("div", { class: "scenery", id: "scenery" }),
      h("div", { class: "center-log", id: "centerLog" })
    ));
    const curCell = cur() ? cur().pos : -1;
    BOARD.forEach(c => {
      const pr = room.props[c.index];
      const pos = cellPosition(c.index);
      const owner = c.t === "prop" && pr && pr.owner ? playerById(room, pr.owner) : null;
      const cell = h("div", {
        class: "cell " + cellClass(c) + (c.index === curCell ? " current" : ""),
        style: { gridRowStart: pos.r + 1, gridColumnStart: pos.c + 1 }
      });
      if (c.t === "prop") {
        const hue = CITY_HUE[c.city] || 210;
        const light = 92 - (c.tier + 1) * 6;
        cell.style.background = "hsl(" + hue + ", 42%, " + light + "%)";
        cell.appendChild(h("div", { class: "c-landmark" }, CITY_LANDMARK[c.city] || ""));
      }
      if (owner) {
        cell.style.border = "2px solid " + colorOf(owner);
        cell.style.boxShadow = "inset 0 0 0 1px " + colorOf(owner);
      }
      if (c.t === "prop") cell.appendChild(h("div", { class: "c-city" }, c.city || ""));
      cell.appendChild(h("div", { class: "c-name" }, c.name));
      if (c.t === "prop") {
        if (pr.buildingLevel > 0) {
          cell.appendChild(h("div", { class: "c-building" }, BUILD_ICONS[pr.buildingLevel] + " " + ZT.BUILD_NAMES[pr.buildingLevel]));
        }
        let meta = (pr.regionsOwned || 0) + "/" + c.regionCount + "区";
        if (pr.owner) {
          meta += "·" + (owner ? owner.name : "?");
          cell.appendChild(h("div", { class: "c-meta" }, meta));
          cell.appendChild(h("div", { class: "c-toll" }, "过路 ¥" + EN.propToll(room, c)));
          cell.appendChild(h("div", { class: "c-price" }, "买价 ¥" + c.regionPrices[0] + (c.regionCount > 1 ? "+" + c.regionPrices[1] : "")));
        } else {
          cell.appendChild(h("div", { class: "c-meta" }, meta));
          cell.appendChild(h("div", { class: "c-price" }, "买 ¥" + c.regionPrices[0] + (c.regionCount > 1 ? "/" + c.regionPrices[1] : "")));
        }
      }
      cell.addEventListener("click", () => cellInfoModal(c));
      box.appendChild(cell);
    });
    renderCenterLog();
    renderScenery();
  }

  // 棋子层：用百分比定位 + CSS 过渡，实现平滑移动（不是瞬移）
  function renderPieces() {
    const room = S.room;
    const layer = $("#pieceLayer");
    if (!layer) return;
    const groups = {};
    room.players.forEach(function (p) {
      if (p.bankrupt) return;
      (groups[p.pos] = groups[p.pos] || []).push(p);
    });
    const seen = {};
    Object.keys(groups).forEach(function (pos) {
      const idx = parseInt(pos, 10);
      groups[pos].forEach(function (p, i) {
        seen[p.id] = true;
        let el = layer.querySelector('[data-pid="' + p.id + '"]');
        if (!el) {
          el = h("span", { class: "piece" });
          el.dataset.pid = p.id;
          layer.appendChild(el);
        }
        const cp = cellPosition(idx);
        const off = (i - (groups[pos].length - 1) / 2) * 3;
        el.textContent = p.token;
        el.style.background = colorOf(p);
        el.style.left = ((cp.c + 0.5) / 23 * 100 + off) + "%";
        el.style.top = ((cp.r + 0.5) / 10 * 100) + "%";
      });
    });
    $$(".piece", layer).forEach(function (el) {
      if (!seen[el.dataset.pid]) el.remove();
    });
  }

  function cellClass(c) {
    if (c.t === "prop") return "tier" + (c.tier + 1);
    if (c.t === "start") return "start";
    if (c.t === "jail") return "jail";
    if (c.t === "card") return "card";
    if (c.t === "fate") return "fate";
    if (c.t === "opportunity") return "opportunity";
    return "empty";
  }

  function renderCenterLog() {
    const room = S.room;
    const el = $("#centerLog");
    if (!el) return;
    el.innerHTML = "";
    room.log.slice(0, 5).forEach(function (l) {
      el.appendChild(h("div", { class: "center-log-item" }, l.text));
    });
  }
  function renderScenery() {
    const el = $("#scenery");
    if (!el) return;
    const sc = SCENES[sceneIdx % SCENES.length];
    const hue = CITY_HUE[sc[0]] || 210;
    el.innerHTML = "";
    el.style.background = "linear-gradient(135deg, hsl(" + hue + ",60%,88%), hsl(" + hue + ",55%,74%))";
    el.appendChild(h("div", { class: "scenery-emoji" }, sc[2]));
    el.appendChild(h("div", { class: "scenery-name" }, sc[0] + " · " + sc[1]));
  }

  let lastDice = null, diceTimer = null, autoTimer = null, sceneIdx = 0;
  function scheduleAutoResolve(delay) {
    if (autoTimer) clearTimeout(autoTimer);
    autoTimer = setTimeout(function () {
      autoTimer = null;
      if (S.room && isMe() && S.room.phase === "landing" && S.room.pending) {
        landingMsg = null;
        doneLanding({});
      }
    }, delay || 1500);
  }
  function renderDice() {
    const room = S.room;
    const el = $("#bigDice");
    if (!el) return;
    if (room.status === "playing" && room.dice) {
      el.classList.remove("hidden");
      if (room.dice !== lastDice) {
        lastDice = room.dice;
        clearInterval(diceTimer);
        el.classList.add("rolling");
        let n = 0;
        diceTimer = setInterval(function () {
          el.textContent = 1 + Math.floor(Math.random() * 6);
          n++;
          if (n >= 8) {
            clearInterval(diceTimer);
            el.textContent = room.dice;
            el.classList.remove("rolling");
            el.classList.remove("pop");
            void el.offsetWidth;
            el.classList.add("pop");
          }
        }, 90);
      }
    } else {
      el.classList.add("hidden");
      lastDice = null;
      clearInterval(diceTimer);
    }
  }

  function renderBigEvent() {
    const room = S.room;
    const el = $("#bigEvent");
    if (!el) return;
    const pend = room.pending;
    if (room.status === "playing" && room.phase === "landing" && pend) {
      let icon = "", title = "", sub = "";
      if (pend.type === "fate") { icon = "🎴"; title = "命运 · " + pend.card.name; sub = pend.result || ""; }
      else if (pend.type === "card") { icon = "🃏"; title = "卡牌补给站"; sub = "获得【" + cardName(pend.card) + "】"; }
      else if (pend.type === "opportunity") { icon = "💼"; title = "机会 · " + pend.card.name; sub = "等待玩家选择把握或放弃…"; }
      else if (pend.type === "opportunity_result") { icon = pend.success ? "✅" : "❌"; title = "机会" + (pend.success ? "成功" : "失败"); sub = "掷出 " + pend.die + (pend.delta >= 0 ? "，获得 ¥" + pend.delta : "，损失 ¥" + (-pend.delta)) + (pend.extra || ""); }
      else if (pend.type === "jail") { icon = "⛓️"; title = "乔司监狱"; sub = "掷出 " + pend.die + (pend.odd ? "（单数，直接离开）" : "（双数，下回合停留）"); }
      if (icon) {
        el.innerHTML = "";
        el.appendChild(h("div", { class: "big-event-icon" }, icon));
        el.appendChild(h("div", { class: "big-event-title" }, title));
        if (sub) el.appendChild(h("div", { class: "big-event-sub" }, sub));
        el.classList.remove("hidden");
        return;
      }
    }
    el.classList.add("hidden");
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
      if (p.reverse > 0 || p.jailSkip > 0 || p.boss > 0) card.appendChild(h("div", { class: "pc-status" }, statusText(p)));
      card.addEventListener("click", () => playerInfoModal(p));
      box.appendChild(card);
    });
  }
  function statusText(p) {
    const a = [];
    if (p.reverse > 0) a.push("逆向" + p.reverse + "回合");
    if (p.jailSkip > 0) a.push("监狱");
    if (p.boss > 0) a.push("霸王");
    return a.join(" ");
  }
  function updatePresence() { if (S.room) renderPlayers(); }

  function renderChat() {
    const room = S.room;
    const el = $("#chatList");
    if (!el) return;
    el.innerHTML = "";
    (room.chat || []).slice(-50).forEach(function (m) {
      el.appendChild(h("div", { class: "chat-msg" + (m.pid === S.playerId ? " mine" : "") },
        h("span", { class: "chat-name" }, m.name + "："),
        h("span", { class: "chat-text" }, m.text)
      ));
    });
    el.scrollTop = el.scrollHeight;
  }
  function doSendChat() {
    const input = $("#chatInput");
    const text = (input.value || "").trim();
    if (!text) return;
    const res = EN.sendChat(S.room, S.playerId, text);
    if (res.error) { toast(res.error); return; }
    input.value = "";
    saveAndBroadcast();
    renderChat();
  }

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
      const msg = cur().skipReason === "jail" ? "你在乔司监狱，本回合无法行动" : "你被暂停，本回合无法行动";
      box.appendChild(h("div", { class: "ab-hint" }, msg));
      box.appendChild(btn("结束回合", () => endSkip()));
      return;
    }
    const p = cur();
    const row = h("div", { class: "ab-row" });
    row.appendChild(btn("🎲 掷骰子", onRoll));
    row.appendChild(btn("🃏 卡牌(" + p.cards.length + ")", cardsModal, "btn-ghost"));
    row.appendChild(btn("🏦 抵押", mortgageModal, "btn-ghost"));
    box.appendChild(row);
  }

  function endSkip() { EN.skipTurn(S.room); saveAndBroadcast(); render(); }
  function forceEndTurn() {
    if (!isMe()) { toast("还没轮到你"); return; }
    EN.forceEndTurn(S.room);
    landingMsg = null;
    closeModal();
    saveAndBroadcast();
    render();
  }
  function showRules() {
    openModal("游戏规则", h("div", { class: "rules" }, RULES.map(function (t) { return h("p", {}, t); })), [h("button", { class: "btn btn-ghost", onclick: closeModal }, "关闭")]);
  }

  /* ---------- AI 接管（掉线 / AI 玩家自动代打） ---------- */
  let aiTimer = null;
  function isAiDriver() { return S.room && S.room.host === S.playerId; }
  function currentNeedsAI() {
    if (!S.room || S.room.status !== "playing") return false;
    const cp = cur();
    return cp && !cp.bankrupt && (cp.isAI || !isOnline(cp));
  }
  function startAiDriver() {
    if (aiTimer) clearInterval(aiTimer);
    aiTimer = setInterval(aiTick, 900);
  }
  function aiTick() {
    if (!isAiDriver() || !S.room || S.room.status !== "playing") return;
    const cp = cur();
    if (!cp || cp.bankrupt) return;
    if (!(cp.isAI || !isOnline(cp))) return;
    if (S.room.phase === "action") aiAct();
    else if (S.room.phase === "landing" && S.room.pending) aiResolve();
  }
  function aiAct() {
    if (cur().skipReason) { EN.skipTurn(S.room); saveAndBroadcast(); render(); return; }
    EN.roll(S.room);
    saveAndBroadcast();
    render();
  }
  function aiResolve() {
    const pend = S.room.pending;
    const p = cur();
    let action = {};
    switch (pend.type) {
      case "buy": action = { buy: p.money >= pend.price }; break;
      case "build":
        if (pend.cost2 != null && p.money >= pend.cost2) action = { levels: 2 };
        else if (pend.cost1 != null && p.money >= pend.cost1) action = { levels: 1 };
        else action = { levels: 0 };
        break;
      case "pay": action = (pend.canBoss && p.boss > 0) ? { boss: true } : {}; break;
      case "opportunity": action = { grasp: p.money >= pend.card.lose && Math.random() < 0.5 }; break;
      case "emergency": {
        const list = BOARD.filter(c => c.t === "prop" && S.room.props[c.index].owner === p.id && (S.room.props[c.index].regionsOwned > 0 || S.room.props[c.index].buildingLevel > 0));
        action = list.length ? { mortgage: list[0].index } : { bankrupt: true };
        break;
      }
      default: action = {}; break;
    }
    EN.resolve(S.room, action);
    saveAndBroadcast();
    render();
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
    if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
    EN.resolve(room, action || {});
    saveAndBroadcast();
    closeModal();
    render();
  }

  function landingModal() {
    const room = S.room, pend = room.pending;
    if (!pend) return;
    const cell = BOARD[pend.cell !== undefined ? pend.cell : -1];
    if (pend.type === "none" || pend.type === "jail" || pend.type === "card" || pend.type === "fate" || pend.type === "opportunity_result") {
      let msg = "";
      if (pend.type === "none") msg = (pend.name || "这里") + "，没有特殊事件。";
      else if (pend.type === "jail") msg = "乔司监狱掷出 " + pend.die + "（" + (pend.odd ? "单数 → 直接离开" : "双数 → 下回合停留") + "）";
      else if (pend.type === "card") msg = "在卡牌补给站获得一张【" + cardName(pend.card) + "】";
      else if (pend.type === "fate") msg = "命运「" + pend.card.name + "」：" + pend.result;
      else if (pend.type === "opportunity_result") msg = "机会" + (pend.success ? "成功" : "失败") + "，掷出 " + pend.die + (pend.delta >= 0 ? "，获得 ¥" + pend.delta : "，损失 ¥" + (-pend.delta)) + (pend.extra ? "，" + pend.extra : "");
      landingMsg = msg;
      scheduleAutoResolve();
      return;
    }
    if (pend.type === "buy") {
      const money = cur().money;
      const pr = room.props[pend.cell];
      const body = h("div", {},
        h("div", { class: "big" }, cell.name),
        h("div", { class: "dim" }, "购买第 " + (pr.regionsOwned + 1) + " 个区域（共 " + cell.regionCount + " 个），当前 " + pr.regionsOwned + "/" + cell.regionCount),
        h("div", { class: "dim" }, "你的资金 ¥" + money)
      );
      const b = btn("购买 ¥" + pend.price, () => { sfxBuy(); doneLanding({ buy: true }); });
      if (pend.price > money) b.disabled = true;
      openModal("购买区域", body, [b, btn("跳过", () => doneLanding({}), "btn-ghost")]);
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
      foot.push(btn("不升级", () => doneLanding({}), "btn-ghost"));
      openModal("建设建筑", body, foot);
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
    if (pend.type === "pay") {
      const owner = playerById(room, pend.owner);
      const foot = [btn("支付 ¥" + pend.toll, () => { sfxPay(); doneLanding({}); })];
      if (pend.canBoss && cur().boss > 0) {
        foot.unshift(btn("霸王卡免除", () => { sfxCard(); doneLanding({ boss: true }); }, "btn-ghost"));
      }
      openModal("支付过路费",
        h("div", {},
          h("div", { class: "big" }, "¥" + pend.toll),
          h("div", { class: "dim" }, "支付给 " + (owner ? owner.name : "银行") + "，你的资金 ¥" + cur().money)
        ),
        foot);
      return;
    }
    if (pend.type === "emergency") { emergencyModal(pend); return; }
    landingMsg = "本回合结算完成";
  }

  function emergencyModal(pend) {
    const room = S.room, p = cur();
    const list = BOARD.filter(c => c.t === "prop" && room.props[c.index].owner === p.id && (room.props[c.index].regionsOwned > 0 || room.props[c.index].buildingLevel > 0));
    const body = h("div", {},
      h("div", { class: "big" }, "还差 ¥" + Math.max(0, pend.shortfall)),
      list.length ? h("div", {},
        h("div", { class: "dim" }, "请选择要抵押的地块凑钱："),
        h("div", { class: "opt-list" }, list.map(c => h("button", { class: "opt-btn", onclick: () => { sfxPay(); doneLanding({ mortgage: c.index }); } }, c.name + " → 抵押得 ¥" + EN.mortgageValue(c, room.props[c.index]))))
      ) : h("div", { class: "dim" }, "你已经没有可抵押的地块了。")
    );
    const foot = list.length ? [] : [h("button", { class: "btn btn-danger", onclick: () => doneLanding({ bankrupt: true }) }, "破产退出")];
    openModal("资金不足", body, foot);
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
    if (cardId === "stop") {
      const info = EN.stopActionInfo(S.room, S.playerId);
      if (!info) { toast("停留卡需要在自己脚下地块使用（再买区域或再升建筑）"); return; }
      if (info.kind === "buy") {
        openModal("停留卡 · 额外买地", h("div", {},
          h("div", { class: "big" }, BOARD[info.cell].name),
          h("div", { class: "dim" }, "再买 1 个区域 ¥" + info.price)
        ), [btn("购买", () => doCard("stop", { buy: true })), h("button", { class: "btn btn-ghost", onclick: cardsModal }, "返回")]);
      } else {
        openModal("停留卡 · 额外建设", h("div", {},
          h("div", { class: "big" }, BOARD[info.cell].name),
          h("div", { class: "dim" }, "再升建筑")
        ), [
          btn("升 1 级 ¥" + info.cost1, () => doCard("stop", { levels: 1 })),
          info.cost2 != null ? btn("升 2 级 ¥" + info.cost2, () => doCard("stop", { levels: 2 }), "btn-ghost") : null,
          h("button", { class: "btn btn-ghost", onclick: cardsModal }, "返回")
        ]);
      }
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
      h("div", { class: "opt-list" }, list.map(c => h("button", { class: "opt-btn", onclick: () => doMortgage(c.index) }, c.name + " → 抵押得 ¥" + EN.mortgageValue(c, room.props[c.index])))),
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
      html += "<div class='dim'>区域 " + (pr.regionsOwned || 0) + "/" + c.regionCount + " · GDP " + c.gdp + " 亿元 · 第" + (c.tier + 1) + "档</div>";
      if (c.composition) html += "<div class='dim'>" + c.composition + "</div>";
      if (pr.owner) {
        const owner = playerById(room, pr.owner);
        html += "<div class='dim'>所有者：" + (owner ? owner.name : "?") + "，建筑：" + (ZT.BUILD_NAMES[pr.buildingLevel] || "无") + "</div>";
        html += "<div class='big'>当前过路费 ¥" + EN.propToll(room, c) + "</div>";
        if (owner && owner.id === S.playerId) html += "<div class='dim'>可抵押价值 ¥" + EN.mortgageValue(c, pr) + "</div>";
      } else {
        html += "<div class='dim'>无主 · 区域1 ¥" + c.regionPrices[0] + (c.regionCount > 1 ? "，区域2 ¥" + c.regionPrices[1] : "") + "</div>";
      }
    } else if (c.t === "start") {
      html += "<div class='dim'>经过自己的出生起点得 ¥" + ZT.START_REWARD + "</div>";
    } else if (c.t === "jail") {
      html += "<div class='dim'>进入掷骰：单数离开，双数停留一回合</div>";
    } else if (c.t === "card") {
      html += "<div class='dim'>到达可获得一张随机特殊卡</div>";
    } else if (c.t === "fate" || c.t === "opportunity") {
      html += "<div class='dim'>" + (c.t === "fate" ? "抽命运卡，立即执行" : "抽机会卡，把握或放弃") + "</div>";
    }
    openModal("地块信息", h("div", { html: html }), [h("button", { class: "btn btn-ghost", onclick: closeModal }, "关闭")]);
  }
  function playerInfoModal(p) {
    const room = S.room;
    const props = BOARD.filter(c => c.t === "prop" && room.props[c.index].owner === p.id);
    const body = h("div", {},
      h("div", { class: "big" }, p.token + " " + p.name),
      h("div", { class: "dim" }, "资金 ¥" + p.money + " · 卡牌 ×" + p.cards.length),
      h("div", { class: "opt-list", style: { marginTop: "10px" } }, props.length ? props.map(c => h("div", { class: "dim" }, c.name + " " + (room.props[c.index].regionsOwned) + "/" + c.regionCount + (room.props[c.index].buildingLevel ? " " + ZT.BUILD_NAMES[room.props[c.index].buildingLevel] : ""))) : h("div", { class: "dim" }, "暂无地产"))
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
    const room = EN.newRoom(name, { initialMoney: ZT.DEFAULT_MONEY, maxPlayers: 6, sound: true, anim: "fast", token: SEL_TOKEN });
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
    const res = EN.join(room, name, SEL_TOKEN);
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
    if (CLOUD_DB && S.code && S.playerId) presenceRef(S.code, S.playerId).remove().catch(function () {});
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
    room.settings.cityBonusStep = parseFloat($("#setCityBonus").value) || 0.2;
    room.settings.startReward = parseInt($("#setStartReward").value, 10) || ZT.START_REWARD;
    room.settings.aiCount = parseInt($("#setAI").value, 10) || 0;
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
    $("#btnChatSend").onclick = doSendChat;
    $("#chatInput").addEventListener("keydown", function (e) { if (e.key === "Enter") doSendChat(); });
    $("#btnSound").onclick = () => { S.room.settings.sound = !S.room.settings.sound; saveAndBroadcast(); render(); };
    $("#btnBgm").onclick = () => { BGM.on ? bgmStop() : bgmStart(); };
    $("#btnNext").onclick = bgmNext;
    $("#btnLog").onclick = () => {
      const room = S.room;
      openModal("游戏记录", h("div", { class: "log-list" }, room.log.map(l => h("div", {}, l.text))), [h("button", { class: "btn btn-ghost", onclick: closeModal }, "关闭")]);
    };
    $("#modalClose").onclick = closeModal;
    $("#modal").addEventListener("click", e => { if (e.target === $("#modal")) closeModal(); });
    $("#setMoney").onchange = () => { if (S.room && S.room.host === S.playerId) { S.room.settings.initialMoney = parseInt($("#setMoney").value, 10) || ZT.DEFAULT_MONEY; saveAndBroadcast(); } };
    $("#setMax").onchange = () => { if (S.room && S.room.host === S.playerId) { S.room.settings.maxPlayers = parseInt($("#setMax").value, 10) || 6; saveAndBroadcast(); } };
    $("#setCityBonus").onchange = () => { if (S.room && S.room.host === S.playerId) { S.room.settings.cityBonusStep = parseFloat($("#setCityBonus").value) || 0.2; saveAndBroadcast(); } };
    $("#setStartReward").onchange = () => { if (S.room && S.room.host === S.playerId) { S.room.settings.startReward = parseInt($("#setStartReward").value, 10) || ZT.START_REWARD; saveAndBroadcast(); } };
    $("#setAI").onchange = () => { if (S.room && S.room.host === S.playerId) { S.room.settings.aiCount = parseInt($("#setAI").value, 10) || 0; saveAndBroadcast(); } };
    $("#setSound").onchange = () => { if (S.room && S.room.host === S.playerId) { S.room.settings.sound = $("#setSound").value === "1"; saveAndBroadcast(); } };
    $("#setAnim").onchange = () => { if (S.room && S.room.host === S.playerId) { S.room.settings.anim = $("#setAnim").value; saveAndBroadcast(); } };
  }

  bind();
  renderHome();
  startAiDriver();
  setInterval(refreshPresence, 6000);
  setInterval(function () { sceneIdx++; if (S.room && S.room.status === "playing") renderScenery(); }, 60000);
  setInterval(function () { if (S.code && CLOUD_DB && S.room) pullRoom(); }, 3000);

  initCloud().then(function () { console.log("CloudBase 已连接"); checkReconnect(); }).catch(function (e) { console.warn("CloudBase 初始化失败", e); toast("联机服务连接失败，请检查网络或稍后重试"); });
})();
