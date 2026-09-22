const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),http=require('http'),path=require('path');
const root=path.resolve(__dirname, '..');
const context={window:{},console,Date,Math}; vm.createContext(context);
for(const f of ['data.js','engine.js']) vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),context);
const E=context.window.ZTEngine,Z=context.window.ZT;
let tests=0;
function test(name,fn){fn();tests++;console.log('PASS',name);}
function room(){const r=E.newRoom('Host',{});E.join(r,'Guest');E.start(r);return r;}
test('paused turn gets a fresh inactivity clock',()=>{let r=room();let next=r.players[(r.turn+1)%r.players.length];next.paused=1;r.lastActionAt=1;E.endTurn(r);assert.equal(E.currentPlayer(r).skipReason,'pause');assert(Date.now()-r.lastActionAt<1000);assert(E.roll(r).error);});
test('all turn exits preserve unpaid debt',()=>{for(const exit of ['endTurn','forceEndTurn','skipTurn']){let r=room();r.pending={type:'emergency',toll:500};const turn=r.turn;assert(E[exit](r).error);assert.equal(r.turn,turn);assert.equal(r.pending.toll,500);}});
test('rolled players cannot use cards or mortgage assets',()=>{let r=room(),p=E.currentPlayer(r);p.cards=['reverse'];r.rolled=true;assert(E.useCard(r,p.id,'reverse',{}).error);assert(E.mortgageCard(r,p.id,'reverse').error);assert(E.mortgage(r,p.id,1).error);assert(E.roll(r).error);});
test('emergency card mortgage settles exact debt once',()=>{let r=room(),p=E.currentPlayer(r),owner=r.players.find(x=>x.id!==p.id);p.money=10;p.cards=['reverse'];const before=owner.money;r.phase='landing';r.pending={type:'pay',toll:1000,owner:owner.id,cell:1};E.resolve(r,{});assert.equal(r.pending.type,'emergency');E.resolve(r,{mortgageCard:'reverse'});assert.equal(p.money,4010);assert.equal(owner.money,before+1000);assert.equal(r.pending,null);assert.equal(r.ledger.length,1);});


