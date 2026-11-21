import test from 'node:test';
import assert from 'node:assert/strict';
import {Track} from '../src/track.js';
import {Race} from '../src/race.js';
import {drive,makeCar,impact} from '../src/vehicle.js';
import {VEHICLES,LENGTH,STEP} from '../src/config.js';
import {loadProfile,saveProfile,finishAward,buyTune} from '../src/profile.js';
const track=new Track(), full={throttle:1,brake:0,steer:0,boost:false,drift:false,use:false};
const noop=()=>{};
test('road contacts follow the asphalt crown, mud ruts and shared shortcut endpoints',()=>{
  const crown=track.pose(130,0).y,edge=track.pose(130,7).y;
  assert.ok(crown-edge>.10 && crown-edge<.19);
  assert.ok(track.pose(130,7.22).y>edge+.06);
  assert.ok(Math.abs(track.relief(0,1.4)-track.relief(LENGTH,1.4))<1e-8);
  const d=LENGTH*.78,groove=1.02+.28*Math.sin(d*.027);
  assert.ok(track.relief(d,groove)<track.relief(d,groove+.9)-.045);
  for(const fork of track.forks)for(const at of [fork.start,fork.end]){
    assert.ok(Math.abs(track.relief(at,2,fork)-track.relief(at,2))<1e-9);
  }
});
test('survey and alternate paths meet at shared endpoints and shorten physical distance',()=>{
  assert.ok(Math.abs(track.main.length-LENGTH)<.001);
  for(const f of track.forks){
    assert.ok(f.table.length<f.end-f.start);
    for(const d of [f.start,f.end]){
      const a=track.frame(d),b=track.frame(d,f);assert.ok(Math.hypot(a.x-b.x,a.z-b.z)<.01);
    }
    const c=makeCar(0,VEHICLES[0],'Test',f.start-.1,3*f.side);c.v=25;
    drive(c,full,STEP,track,0,noop);assert.equal(c.route?.id,f.id);
    while(c.d<f.end+1)drive(c,full,STEP,track,0,noop);
    assert.equal(c.route,null);
  }
});
test('powertrains, surfaces, suspension and assisted slides respond to inputs',()=>{
  const cars=VEHICLES.map(t=>makeCar(0,t,'Test',500,0));
  for(const c of cars){
    for(let i=0;i<600;i++)drive(c,full,STEP,track,.05,noop);
    assert.ok(c.v>20&&Number.isFinite(c.roll));const speed=c.v;
    for(let i=0;i<22;i++)drive(c,{...full,steer:.6,drift:true},STEP,track,.1,noop);
    assert.ok(c.sliding&&c.energy>45);
    for(let i=0;i<120;i++)drive(c,{...full,throttle:0,brake:1},STEP,track,.1,noop);
    assert.ok(c.v<speed-10);
  }
  assert.equal(new Set(cars.map(c=>Math.round(c.d))).size,3);
});
test('jump yields airtime and landing, shield intercepts damage, repair restores body',()=>{
  const r=new Race(track),c=r.player;c.d=track.ramp.end-.1;c.v=36;c.lane=0;
  let landed=false;for(let i=0;i<300;i++)drive(c,full,STEP,track,.1,t=>{if(t==='land')landed=true;});
  assert.ok(landed&&c.air===0&&c.energy>45);const before=c.damage;c.impact=0;c.item='shield';r.use(c);impact(c,30,.6);
  assert.equal(c.damage,before);c.impact=0;impact(c,30,.7);assert.ok(c.damage>before+20);c.item='repair';r.use(c);assert.equal(c.damage,0);
});
test('nine-car race completes through 36 gates with ordered finish and idempotent rewards',()=>{
  const r=new Race(track,0,false,'Sport',197);let frames=0;
  while(!r.finished&&frames++<100000){
    const c=r.player;
    r.step({...full,steer:Math.max(-1,Math.min(1,-c.lane*.30-c.sideV*.08)),use:!!c.item,boost:c.energy>80},STEP);
  }
  assert.ok(r.finished);assert.equal(r.cars.length,9);assert.equal(r.player.gate,37);
  assert.ok(r.player.splits.every(s=>s>120&&s<360));assert.ok(r.cars.every(c=>Number.isFinite(c.d)&&c.d>LENGTH*1.5));
  const storage={value:null,getItem(){return this.value;},setItem(k,v){this.value=v;}},p=loadProfile(storage);
  const reward=finishAward(p,r,'event-1');assert.ok(reward.credits>=180);assert.equal(finishAward(p,r,'event-1'),null);
  saveProfile(p,storage);assert.deepEqual(loadProfile(storage),p);p.credits=400;assert.ok(buyTune(p,0));assert.equal(buyTune(p,0),false);
  console.log('Simulated finish',r.player.splits.map(v=>v.toFixed(1)), 'position',reward.place);
});
