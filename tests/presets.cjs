const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const P=require('../presets.js');
const context={window:{},Date,Math};vm.createContext(context);
for(const file of ['data.js','engine.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context);
const E=context.window.ZTEngine;
function make(){return E.newRoom('Host',{initialMoney:15000,maxPlayers:6,aiCount:2,sound:false,anim:'normal'});}
let checks=0;function test(label,fn){fn();checks++;console.log('PASS',label);}
test('applying a preset changes only its four economic settings',()=>{const r=make(),before={...r.settings},props=JSON.stringify(r.props),seq=r.seq;assert(P.apply(r,r.host,'balanced').ok);assert.equal(r.seq,seq+1);for(const k of P.KEYS)assert.equal(r.settings[k],P.find('balanced').settings[k]);for(const k of Object.keys(before).filter(k=>!P.KEYS.includes(k)))assert.equal(r.settings[k],before[k]);assert.equal(JSON.stringify(r.props),props);assert.equal(P.match(r.settings).id,'balanced');});
test('non-host, started room and unknown preset are rejected without changes',()=>{for(const [status,who,id]of [['waiting','guest','balanced'],['playing','host','balanced'],['waiting','host','unknown']]){const r=make();r.status=status;const before=JSON.stringify(r);assert(P.apply(r,who==='host'?r.host:who,id).error);assert.equal(JSON.stringify(r),before);}});
test('manual economic changes become custom and classic restores default values',()=>{const r=make();P.apply(r,r.host,'balanced');r.settings.startCards=2;assert.equal(P.match(r.settings),null);P.apply(r,r.host,'classic');assert.equal(r.settings.initialMoney,15000);assert.equal(r.settings.startCards,0);assert.equal(r.settings.startReward,3000);assert.equal(r.settings.cityBonusStep,.2);});
test('starting beyond the room limit does not mutate state',()=>{const r=make();r.settings.maxPlayers=2;const before=JSON.stringify(r);assert(P.capacityError(r));assert.equal(E.start(r),false);assert.equal(JSON.stringify(r),before);});
test('six players is allowed and seven players is rejected',()=>{let r=make();r.settings.aiCount=5;assert.equal(P.capacityError(r),'');assert.equal(E.start(r),true);assert.equal(r.players.length,6);r=make();E.join(r,'Guest');r.settings.aiCount=5;assert(P.capacityError(r));assert.equal(E.start(r),false);assert.equal(r.status,'waiting');});
test('preset does not change bankruptcy victory condition',()=>{const r=make();P.apply(r,r.host,'balanced');assert(!('roundLimit'in r.settings));assert(E.start(r));assert.equal(r.status,'playing');assert.equal(r.winner,null);});
console.log('TOTAL',checks);
