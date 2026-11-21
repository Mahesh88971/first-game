import {clamp,PRESETS} from './config.js';
const KEY='wildline.coast.profile.v1';
const base=()=>({version:1,vehicle:0,credits:0,xp:0,races:0,bestLap:null,bestRace:null,upgrades:[false,false,false],history:[],lastAward:null,
  settings:{volume:.65,quality:'High',difficulty:'Sport',shake:true,camera:0}});
const validTime=v=>Number.isFinite(v)&&v>0?v:null;
export function loadProfile(storage) {
  const p=base();
  try{
    const raw=JSON.parse(storage.getItem(KEY));if(!raw||raw.version!==1)return p;
    for(const k of ['credits','xp','races'])p[k]=Number.isFinite(raw[k])?Math.max(0,Math.floor(raw[k])):0;
    p.vehicle=clamp(Math.floor(Number(raw.vehicle)||0),0,2);p.bestLap=validTime(raw.bestLap);p.bestRace=validTime(raw.bestRace);
    p.upgrades=p.upgrades.map((_,i)=>raw.upgrades?.[i]===true);
    p.history=Array.isArray(raw.history)?raw.history.filter(r=>r&&validTime(r.time)&&Number.isInteger(r.place)&&r.place>=1&&r.place<=9).slice(0,8):[];
    p.lastAward=typeof raw.lastAward==='string'?raw.lastAward:null;
    const s=raw.settings||{};
    if(Object.hasOwn(PRESETS,s.quality))p.settings.quality=s.quality;
    if(['Sport','Expert','Touring'].includes(s.difficulty))p.settings.difficulty=s.difficulty;
    if(Number.isFinite(s.volume))p.settings.volume=clamp(s.volume,0,1);
    p.settings.shake=s.shake!==false;p.settings.camera=clamp(Math.floor(Number(s.camera)||0),0,4);
  }catch{ /* Storage can be disabled for a local file. Keep the session playable. */ }
  return p;
}
export function saveProfile(profile,storage){try{storage.setItem(KEY,JSON.stringify(profile));return true;}catch{return false;}}
export function buyTune(p,index){
  if(!Number.isInteger(index)||index<0||index>2||p.credits<400||p.upgrades[index])return false;
  p.credits-=400;p.upgrades[index]=true;return true;
}
export function finishAward(p,race,id){
  if(!race.finished||race.player.splits.length!==3||p.lastAward===id)return null;
  const place=race.order.indexOf(race.player)+1,time=race.player.finish,best=Math.min(...race.player.splits);
  const credits=180+(9-place)*40,xp=100+(9-place)*18;
  p.lastAward=id;p.credits+=credits;p.xp+=xp;p.races++;
  p.bestLap=Math.min(p.bestLap??Infinity,best);p.bestRace=Math.min(p.bestRace??Infinity,time);
  p.history.unshift({place,time,lap:best,vehicle:p.vehicle});p.history.length=Math.min(8,p.history.length);
  return {credits,xp,place};
}
