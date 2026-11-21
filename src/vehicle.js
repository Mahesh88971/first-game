import {SURFACES,LENGTH,clamp,mix,mod,ease} from './config.js';

export function makeCar(id,tune,name,d,lane,upgrade=false) {
  return {id,tune,name,d,lane,upgrade,v:0,sideV:0,steer:0,yawSlip:0,air:0,airV:0,airPitch:0,
    roll:0,pitch:0,wheels:[0,0,0,0],springV:[0,0,0,0],surface:'asphalt',grip:1,
    energy:45,damage:0,impact:0,item:null,shield:0,traction:0,surge:0,stun:0,boosting:false,
    sliding:false,drafting:false,route:null,lastFork:null,gate:1,lap:1,splits:[],lapStart:0,finish:null,
    lastPickup:-1,lastRepair:-1,lastObstacle:-1,nearMiss:-1,lapTime:0,rpm:1100,gear:1,dirt:0};
}
export function impact(car,amount,retention) {
  if(car.impact>.12)return false;
  car.impact=.8;
  if(car.shield>0){car.shield=0;return false;}
  car.damage=clamp(car.damage+amount/car.tune.durability,0,100);
  car.v*=retention;
  return true;
}
export function drive(car,input,dt,track,wet,emit) {
  const spec=car.tune, previous=car.d, wasAir=car.air>0,oldSpeed=car.v;
  for(const key of ['impact','shield','surge','traction','stun'])car[key]=Math.max(0,car[key]-dt);
  const sector=track.sector(car.d), local=mod(car.d,LENGTH);
  car.surface=track.surface(car.d,car.lane,car.route);
  const surface=SURFACES[car.surface], rough=car.surface!=='asphalt';
  car.steer=ease(car.steer,input.steer,7*spec.steer,dt);
  car.grip=surface.grip*spec.grip*(1-wet*.24)*(car.traction>0?1.32:1);
  car.sliding=!wasAir && car.v>9 && Math.abs(car.steer)>.19 && (input.drift||input.brake>.4);
  const curvature=track.curvature(car.d,car.route);
  const surfaceFactor=rough?mix(.24,.37+.63*surface.grip,spec.offroad):1;
  const cornerLimit=Math.sqrt((10.8*car.grip)/(Math.abs(curvature)+.0001));
  const speedLimit=Math.min((spec.top/3.6)*(car.upgrade?1.035:1)*surfaceFactor,cornerLimit)*(1-.065*car.damage/100);
  car.boosting=(input.boost&&input.throttle>.2&&car.energy>.01)||car.surge>0;
  if(input.boost&&car.surge<=0&&car.boosting)car.energy=Math.max(0,car.energy-19*dt);
  if(car.sliding||car.drafting)car.energy=Math.min(100,car.energy+(car.sliding?10:4)*dt);
  const goal=speedLimit*(car.boosting?1.28:1),power=(spec.power*1000)/(spec.mass*Math.max(car.v,9));
  const torqueLimit=spec.torque*24/spec.mass;
  let accel=input.throttle*Math.min(torqueLimit,power)*(car.upgrade?1.08:1)*(car.stun>0?.24:1);
  accel*=clamp((goal-car.v)/6,0,1)*(1-.075*car.damage/100);
  if(car.boosting)accel+=4.7*spec.nitro*clamp((goal-car.v)/5,0,1);
  const wave=car.surface==='water'?.5+.5*Math.sin(local*.065):0;
  const drag=.18+surface.drag*car.v*(rough?1.25-.38*spec.offroad:1)+spec.drag*.00065*car.v*car.v+wave*.65;
  accel-=drag+input.brake*spec.brake*Math.min(1,car.grip+.27)*(car.sliding?.49:1);
  if(car.sliding)accel-=.6;
  accel-=Math.max(0,car.v-goal)*.8;
  car.v=clamp(car.v+accel*dt,0,spec.top/3.6*1.33);
  const authority=Math.min(car.v*.50,11)*spec.steer*(car.stun>0?.5:1)*(wasAir?.28:1);
  const outforce=-curvature*car.v*car.v*.30;
  const lateralGoal=car.steer*authority*(car.sliding?1.24:1)+outforce+wave*Math.sin(local*.035)*1.9;
  car.sideV=ease(car.sideV,lateralGoal,(car.sliding?spec.slide*2.5:5.2)*car.grip,dt);
  car.lane+=car.sideV*dt;
  const border=car.route?6.9:(sector.id===5||sector.id===6?sector.width-.9:sector.width+3.6);
  if(Math.abs(car.lane)>border){
    car.lane=Math.sign(car.lane)*border;
    if(Math.abs(car.sideV)>3&&car.v>7&&impact(car,Math.abs(car.sideV)*.8,.91))emit('hit',car);
    car.sideV*=.22;
  }
  car.yawSlip=ease(car.yawSlip,-car.steer*(car.sliding?.31:.075)*Math.min(car.v/12,1),wasAir?1.2:4,dt);
  const ratio=car.route?(car.route.end-car.route.start)/car.route.table.length:1;
  const forward=Math.max(.84,Math.cos(car.yawSlip));
  car.d+=car.v*forward*ratio*dt;
  for(const fork of track.forks){
    if(!car.route&&local<fork.start&&local+(car.d-previous)>=fork.start&&car.lane*fork.side>1.25){
      car.route=fork; car.lastFork=fork.id;emit('shortcut',car,fork.name);
    }
  }
  if(car.route&&mod(car.d,LENGTH)>=car.route.end)car.route=null;
  if(!wasAir&&!car.route&&local<track.ramp.end&&mod(car.d,LENGTH)>=track.ramp.end&&Math.abs(car.lane)<3.2){
    car.air=4;car.airV=car.v*.185+1;car.airPitch=-.10;emit('jump',car);
  }
  if(car.air>0){
    car.airPitch=clamp(car.airPitch+((input.brake-input.throttle*.25)*.24+.085)*dt,-.35,.35);
    car.airV-=9.81*dt;car.air+=car.airV*dt;
    if(car.air<=0){
      const clean=Math.abs(car.airPitch)<.19&&Math.abs(car.sideV)<5;
      car.air=0;car.airV=0;car.energy=Math.min(100,car.energy+(clean?17:5));
      car.v*=clean?.99:.91;car.impact=.28;emit('land',car,clean);
    }
  }
  const lateralLoad=car.steer*car.v/37+curvature*car.v*car.v*.043;
  const bed=track.relief(car.d,car.lane,car.route);
  for(let i=0;i<4;i++){
    const axle=i<2?1:-1,side=i%2?1:-1;
    const phase=(car.d+axle*1.23)*.92+car.lane*.35+side*.9;
    const contact=track.relief(car.d+axle*1.23,car.lane-side*.88,car.route);
    const bump=surface.rough*(Math.sin(phase)+.43*Math.sin(phase*2.7))*Math.min(car.v/4,1)+contact-bed;
    const target=car.air>0?-spec.travel*.33:clamp(bump+side*lateralLoad*.045-axle*accel*.004,-spec.travel*.48,spec.travel*.48);
    car.springV[i]+=(spec.spring*(target-car.wheels[i])-spec.damping*car.springV[i])*dt;
    car.wheels[i]+=car.springV[i]*dt;
  }
  car.roll=(car.wheels[1]+car.wheels[3]-car.wheels[0]-car.wheels[2])*.42;
  car.pitch=car.air>0?car.airPitch:(car.wheels[0]+car.wheels[1]-car.wheels[2]-car.wheels[3])*.25;
  car.dirt=clamp(car.dirt+(car.surface==='mud'?.036:car.surface==='sand'?.012:car.surface==='water'?-.12:-.001)*dt,0,1);
  car.gear=clamp(Math.floor(car.v/(spec.top/3.6/6))+1,1,6);
  const fraction=car.v/(spec.top/3.6/6)-(car.gear-1);
  car.rpm=ease(car.rpm,car.v<1?1000+input.throttle*1500:2700+clamp(fraction,0,1.2)*3350,8,dt);
  car.acceleration=(car.v-oldSpeed)/dt;
}
