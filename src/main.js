import {VEHICLES,ABILITIES,CAMERAS,PRESETS,LENGTH,STEP,clock,clamp,mod} from './config.js';
import {Track} from './track.js';
import {Race} from './race.js';
import {World} from './world.js';
import {MotorAudio} from './audio.js';
import {loadProfile,saveProfile,finishAward,buyTune} from './profile.js';
import {icons,drawMap,controlsHTML,briefingHTML} from './interface.js';

const $=id=>document.getElementById(id),panel=$('panel');
const track=new Track(),audio=new MotorAudio(),held=new Set();
let storage;try{storage=window.localStorage;}catch{}
const profile=loadProfile(storage),prefs=profile.settings;
let phase='hub',panelName='',garageChoice=profile.vehicle,world=null,race=null,countdown=0,resumePhase='race',debug=false,cam=prefs.camera;
let lastTime=0,acc=0,hudClock=0,frames=60,noticeUntil=0,award=null,runId='',lastCount=0,wasPadUse=false,queuedUse=false,savedWarning=false;
let toastTimer=0,transition=0,lastThunder=-1,latestInfo={calls:0,triangles:0};
const buttons=(action,title,style='secondary')=>'<button class="'+style+'" data-action="'+action+'">'+title+'</button>';
const option=(v,label,s)=>'<option value="'+v+'"'+(v===s?' selected':'')+'>'+label+'</option>';
const write=(id,txt)=>{const n=$(id),t=String(txt);if(n.textContent!==t)n.textContent=t;};
function toast(text){write('toast',text);$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{$('toast').hidden=true;},2600);}
function save(){if(!saveProfile(profile,storage)&&!savedWarning){savedWarning=true;toast('Storage is unavailable. Progress is kept for this session.');}}
function hubData(){
  const spec=VEHICLES[profile.vehicle];write('equipped-name',spec.name);write('equipped-type',spec.type);write('credits',profile.credits.toLocaleString());write('difficulty-label',prefs.difficulty);
  write('best-lap',clock(profile.bestLap));$('vehicle-art').style.backgroundPositionX=(profile.vehicle*50)+'%';drawMap($('hub-map'),track,'hub');
}
function closeDialog(){if(panel.open)panel.close();panelName='';}
function dialog(name,kicker,title,body,canClose=true){
  panelName=name;write('dialog-kicker',kicker);write('dialog-title',title);$('dialog-body').innerHTML=body;
  panel.querySelector('[data-action=close]').hidden=!canClose;panel.setAttribute('aria-labelledby','dialog-title');
  if(!panel.open)panel.showModal();icons(panel);panel.scrollTop=0;
  if(name==='brief')drawMap($('brief-map'),track);
}
function garage(){
  const v=VEHICLES[garageChoice],owned=profile.upgrades[garageChoice];
  const cars=VEHICLES.map((s,i)=>'<button class="garage-option '+(garageChoice===i?'chosen':'')+'" aria-pressed="'+(garageChoice===i)+'" data-car="'+i+'"><span class="garage-photo" style="background-position-x:'+i*50+'%"></span><strong>'+s.name+'</strong><small>'+s.type+'</small></button>').join('');
  const stats=[['Top speed',Math.round(v.top*(owned?1.035:1))+' km/h'],['Engine power',Math.round(v.power*(owned?1.08:1))+' kW'],['Mass',v.mass.toLocaleString()+' kg']];
  dialog('garage','Vehicle selection','Garage','<div class="garage-grid">'+cars+'</div><p class="garage-desc">'+v.desc+'</p><div class="stat-grid">'+stats.map(([k,n],i)=>'<div><span>'+k+'</span><b>'+n+'</b><div class="stat-line"><i style="width:'+v.stats[i]+'%"></i></div></div>').join('')+'</div><div class="dialog-actions">'+buttons('equip',garageChoice===profile.vehicle?'Return to race hub':'Equip '+v.name,'primary')+'<button class="secondary" data-action="tune" '+(owned||profile.credits<400?'disabled':'')+'>'+ (owned?'Engine tune fitted':'Engine tune · 400 CR')+'</button></div><p class="dialog-copy">The engine tune adds 8% drive force and 3.5% top speed. Available balance <b>'+profile.credits+' CR</b>.</p>');
}
function settings(){
  dialog('settings','Driver preferences','Settings','<div class="setting"><label for="quality">Graphics preset</label><select id="quality">'+Object.keys(PRESETS).map(k=>option(k,k,prefs.quality)).join('')+'</select></div><div class="setting"><label for="difficulty">Opponent difficulty</label><select id="difficulty">'+['Touring','Sport','Expert'].map(k=>option(k,k,prefs.difficulty)).join('')+'</select></div><div class="setting"><label for="camera">Starting camera</label><select id="camera">'+CAMERAS.map((k,i)=>option(i,k,prefs.camera)).join('')+'</select></div><div class="setting"><label for="volume">Master volume</label><div><input id="volume" type="range" min="0" max="100" value="'+Math.round(prefs.volume*100)+'"><output id="volume-value">'+Math.round(prefs.volume*100)+'%</output></div></div><div class="setting"><label for="shake">Camera vibration</label><input id="shake" type="checkbox" '+(prefs.shake?'checked':'')+'></div><div class="dialog-actions">'+buttons('close','Done','primary')+'</div>');
}
function log(){
  const metrics=[['Races finished',profile.races],['Driver XP',profile.xp],['Best race',clock(profile.bestRace)]];
  dialog('log','Driver profile','Race log','<div class="stat-grid">'+metrics.map(([n,v])=>'<div><span>'+n+'</span><b>'+v+'</b></div>').join('')+'</div><h3 class="section-h">Recent results</h3>'+(profile.history.length?profile.history.map(r=>'<div class="log-row"><strong>P'+r.place+' · '+VEHICLES[clamp(Number(r.vehicle)||0,0,2)].name+'</strong><span>'+clock(r.time)+'</span></div>').join(''):'<p class="dialog-copy">Finish Tropical Storm Coast to record your first result.</p>')+'<div class="dialog-actions">'+buttons('close','Return to race hub','primary')+'</div>');
}
function goHub(){
  transition++;closeDialog();phase='hub';race=null;held.clear();queuedUse=false;audio.active(false);$('hub').hidden=false;$('racing').hidden=true;$('loading').hidden=true;
  document.title='Wildline Racing · Race hub';hubData();window.scrollTo(0,0);
}
function note(text,secs=1.75){if(!race)return;write('notice',text);noticeUntil=race.time+secs;}
async function startRace(){
  if(phase==='loading')return;
  const ticket=++transition;phase='loading';closeDialog();held.clear();queuedUse=false;$('loading').hidden=false;
  audio.volume=prefs.volume;audio.unlock().catch(()=>{});
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  try{
    if(ticket!==transition)return;
    if(!world)world=new World($('world'),track,prefs.quality);
    world.setQuality(prefs.quality);race=new Race(track,profile.vehicle,profile.upgrades[profile.vehicle],prefs.difficulty,Math.floor(Math.random()*0xffffffff));
    world.grid(race);runId=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);award=null;cam=prefs.camera;
    $('hub').hidden=true;$('racing').hidden=false;$('loading').hidden=true;$('countdown').hidden=false;
    $('toast').hidden=true;countdown=3.35;lastCount=4;acc=0;lastTime=performance.now();phase='countdown';noticeUntil=0;lastThunder=-1;write('notice','');
    document.title='Tropical Storm Coast · Wildline Racing';audio.active(true);world.resize();updateHUD();
  }catch(err){
    console.error(err);goHub();dialog('error','Race unavailable','Graphics initialization','<p class="dialog-copy">The 3D renderer could not start. Open this build in a WebGL 2 capable browser with graphics acceleration enabled.</p><div class="dialog-actions">'+buttons('close','Back to hub','primary')+'</div>');
  }
}
function pause(){
  if(!['race','countdown'].includes(phase))return;
  resumePhase=phase;phase='paused';held.clear();queuedUse=false;acc=0;audio.active(false);
  pausePanel();
}
function pausePanel(){
  dialog('pause','Tropical Storm Coast','Race paused','<div class="brief-row"><strong>Lap '+race.player.lap+' of 3</strong><span>'+clock(race.time)+'</span></div><div class="dialog-actions">'+buttons('resume','Resume race','primary')+buttons('controls','Controls')+buttons('race','Restart race')+buttons('hub','Leave race')+'</div>');
}
function resume(){if(phase!=='paused')return;closeDialog();phase=resumePhase;held.clear();queuedUse=false;lastTime=performance.now();audio.active(true);}
function results(){
  phase='results';held.clear();audio.active(false);award=finishAward(profile,race,runId);save();
  const c=race.player;
  dialog('results','Tropical Storm Coast','Race complete','<div class="reward-line"><strong>P'+award.place+' / 9</strong><span>+'+award.credits+' CR</span><span>+'+award.xp+' XP</span></div><div class="result-cols"><div><h3 class="section-h">Classification</h3>'+race.order.map((r,i)=>'<div class="log-row '+(r.id===0?'mine':'')+'"><b>'+String(i+1).padStart(2,'0')+' &nbsp; '+r.name+'</b><span>'+(r.finish===null?'Racing':clock(r.finish))+'</span></div>').join('')+'</div><div><h3 class="section-h">Your lap times</h3>'+c.splits.map((s,i)=>'<div class="log-row"><b>Lap '+(i+1)+'</b><span>'+clock(s)+'</span></div>').join('')+'<div class="log-row"><b>Total</b><span>'+clock(c.finish)+'</span></div></div></div><div class="dialog-actions">'+buttons('race','Race again','primary')+buttons('hub','Return to race hub')+'</div>',false);
}
function closeAction(){
  if(panelName==='results'){goHub();return;}
  if(phase==='paused'){if(panelName==='pause')resume();else pausePanel();return;}
  closeDialog();
}
function action(key){
  if(key==='race'){startRace();return;}
  if(key==='hub'){goHub();return;}
  if(key==='close'){closeAction();return;}
  if(key==='pause'){pause();return;}
  if(key==='resume'){resume();return;}
  if(key==='garage'){garageChoice=profile.vehicle;garage();return;}
  if(key==='equip'){profile.vehicle=garageChoice;save();goHub();return;}
  if(key==='tune'){if(buyTune(profile,garageChoice)){save();garage();hubData();}return;}
  if(key==='brief'){dialog('brief','Circuit dossier','Track briefing',briefingHTML()+'<div class="dialog-actions">'+buttons('race','Start race','primary')+buttons('close','Back')+'</div>');return;}
  if(key==='settings'){settings();return;}
  if(key==='log'){log();return;}
  if(key==='controls'){dialog('controls','Driving inputs','Controls',controlsHTML()+'<p class="dialog-copy">Steer while braking or holding the handbrake to drift. Draft behind a rival or land straight to refill boost. On a standard gamepad use the left stick, triggers, A for drift, B for boost and X for an ability.</p><div class="dialog-actions">'+buttons('close',phase==='paused'?'Back to pause menu':'Done','primary')+'</div>');}
}
document.addEventListener('click',e=>{const button=e.target.closest('button');if(!button)return;if(button.dataset.car!==undefined){garageChoice=Number(button.dataset.car);garage();}else if(button.dataset.action)action(button.dataset.action);});
panel.addEventListener('cancel',e=>{e.preventDefault();closeAction();});
panel.addEventListener('click',e=>{if(e.target===panel&&panelName!=='results'){const r=panel.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeAction();}});
panel.addEventListener('input',e=>{
  const a=e.target;
  if(a.id==='quality'){prefs.quality=a.value;if(world)world.setQuality(a.value);}
  else if(a.id==='volume'){prefs.volume=a.value/100;audio.volume=prefs.volume;write('volume-value',a.value+'%');}
  else if(a.id==='shake')prefs.shake=a.checked;
  else if(a.id==='camera')prefs.camera=Number(a.value);
  else if(a.id==='difficulty')prefs.difficulty=a.value;
  else return;
  save();hubData();
});
const gameKeys=new Set(['KeyW','KeyS','KeyA','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight','Space','KeyE','KeyC','KeyR','F3','Escape']);
function keyAction(code){
  if(code==='KeyE')queuedUse=true;
  if(code==='KeyC'){cam=(cam+1)%CAMERAS.length;note(CAMERAS[cam]+' camera');}
  if(code==='KeyR'){const c=race.player;c.lane=0;c.sideV=0;c.yawSlip=0;c.v*=.45;c.air=0;c.airV=0;note('Recovered to road');}
  if(code==='F3'){debug=!debug;$('debug').hidden=!debug;}
}
window.addEventListener('keydown',e=>{
  if(!['race','countdown'].includes(phase)||!gameKeys.has(e.code))return;
  e.preventDefault();if(e.code==='Escape'){pause();return;}held.add(e.code);if(!e.repeat)keyAction(e.code);
});
window.addEventListener('keyup',e=>held.delete(e.code));
for(const b of document.querySelectorAll('[data-input]')){
  b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);held.add(b.dataset.input);keyAction(b.dataset.input);});
  const release=()=>held.delete(b.dataset.input);b.addEventListener('pointerup',release);b.addEventListener('lostpointercapture',release);
}
function blur(){held.clear();queuedUse=false;if(['race','countdown'].includes(phase))pause();}
window.addEventListener('blur',blur);document.addEventListener('visibilitychange',()=>{if(document.hidden)blur();});
window.addEventListener('resize',()=>{if(world)world.resize();if(phase==='hub')hubData();if(panelName==='brief')drawMap($('brief-map'),track);});
function input(){
  let pad;try{pad=navigator.getGamepads?.()[0];}catch{}
  const left=held.has('KeyA')||held.has('ArrowLeft'),right=held.has('KeyD')||held.has('ArrowRight');
  const axis=pad?.axes?.[0]||0,padUse=!!pad?.buttons[2]?.pressed;
  const act={throttle:Math.max(Number(held.has('KeyW')||held.has('ArrowUp')),pad?.buttons[7]?.value||0),brake:Math.max(Number(held.has('KeyS')||held.has('ArrowDown')),pad?.buttons[6]?.value||0),
    steer:clamp(Number(right)-Number(left)+(Math.abs(axis)>.13?axis:0),-1,1),drift:held.has('Space')||pad?.buttons[0]?.pressed,
    boost:held.has('ShiftLeft')||held.has('ShiftRight')||pad?.buttons[1]?.pressed,use:queuedUse||(padUse&&!wasPadUse)};
  queuedUse=false;wasPadUse=padUse;return act;
}
function handleEvent(e){
  if(e.id!==0)return;audio.event(e.type);
  if(['break','hit','land'].includes(e.type))world.burst(race,e.type,e.value);
  if(e.type==='pickup')note(ABILITIES[e.value]+' ready');
  if(e.type==='ability')note(ABILITIES[e.value]+' active');
  if(e.type==='shortcut')note(e.value);
  if(e.type==='repair')note('Service strip · body repaired');
  if(e.type==='land')note(e.value?'Clean landing  +17 boost':'Landing  +5 boost');
  if(e.type==='near')note('Near miss  +4 boost',1.15);
  if(e.type==='lap')note('Lap '+e.value+' / 3');
}
function updateHUD(){
  const c=race.player,sec=track.sector(c.d),rank=race.order.indexOf(c)+1;
  write('pos',rank);write('lap',c.lap+' / 3');write('race-time',clock(race.time));write('speed',Math.round(c.v*3.6));write('gear',c.gear);
  write('rpm-num',Math.round(c.rpm/10)*10);$('rpm').style.width=clamp(c.rpm/67,0,100)+'%';$('boost-bar').style.width=c.energy+'%';write('energy',Math.round(c.energy)+'%');
  write('health',Math.round(100-c.damage)+'%');write('sector',c.route?.name??sec.name);write('sector-num','Sector '+String(sec.id+1).padStart(2,'0')+' / 12');write('item',ABILITIES[c.item]||'Empty slot');
  $('cockpit').hidden=cam!==3;$('lens').className=(c.boosting?'boost ':'')+((c.surface==='water'&&c.v>4)||race.wet>.5?'splash':'');
  if(race.time>noticeUntil){write('notice',c.sliding?'Drift charging':c.drafting?'Slipstream':c.shield>0?'Shield active':'');}
  if(debug)write('debug','FPS '+frames.toFixed(0)+'  |  Draws '+latestInfo.calls+'  |  '+latestInfo.triangles+' tris\n'+c.surface+'  ·  grip '+c.grip.toFixed(2)+'  ·  '+race.weather+'\nWheel travel (cm) '+c.wheels.map(v=>(v*100).toFixed(1)).join(' / ')+'\nGate '+(c.gate-1)+' / 36   Lap '+c.lap+'   '+Math.floor(mod(c.d,LENGTH))+' m\nDamage '+c.damage.toFixed(1)+'   Boost '+c.energy.toFixed(1)+'   '+(c.air>0?'Airborne':'Ground contact')+'\nSpeed '+(c.v*3.6).toFixed(1)+' km/h   Fixed step 60 Hz\nGold line · I. Costa lookahead');
  drawMap($('mini-map'),track,'mini',race);
}
function loop(now){
  requestAnimationFrame(loop);
  const elapsed=Math.max(0,(now-lastTime)/1000);lastTime=now;
  if(!world||!race||!['race','countdown'].includes(phase))return;
  const dt=Math.min(.15,elapsed);frames+=(1/Math.max(.001,elapsed)-frames)*.05;
  if(phase==='countdown'){
    countdown-=dt;const n=Math.min(3,Math.ceil(countdown));
    if(n!==lastCount){lastCount=n;audio.pulse(n>0?425:820,n>0?.11:.27);}
    write('countdown',n>0?n:'GO');
    if(countdown<=0){phase='race';note('GO',1.1);$('countdown').hidden=true;acc=0;}
  }else{
    acc+=dt;
    while(acc>=STEP&&!race.finished){
      const a=input();race.step(a,STEP);for(const e of race.events)handleEvent(e);acc-=STEP;
    }
    const thunder=Math.floor(race.time/19.7);
    if(race.wet>.66&&race.time%19.7<.45&&lastThunder!==thunder){lastThunder=thunder;audio.event('thunder');}
    audio.update(race,Number(held.has('KeyW')||held.has('ArrowUp')||race.player.acceleration>1));
  }
  latestInfo=world.draw(race,dt,cam,prefs.shake,debug);hudClock-=dt;
  if(hudClock<=0||race.finished){hudClock=.070;updateHUD();}
  if(race.finished)results();
}
icons();hubData();requestAnimationFrame(loop);
