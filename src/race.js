import {DRIVERS,VEHICLES,SECTORS,LENGTH,LAPS,clamp,ease,mod,random} from './config.js';
import {makeCar,drive,impact} from './vehicle.js';

const difference=(a,b)=>mod(a-b+LENGTH/2,LENGTH)-LENGTH/2;
const GATES=12;
export class Race {
  constructor(track,vehicle=0,upgrade=false,level='Sport',seed=4139) {
    this.track=track;this.rng=random(seed);this.level=level;
    this.cars=[makeCar(0,VEHICLES[vehicle],'You',0,1.9,upgrade),...DRIVERS.map(([name,pace,risk,color],i)=>{
      const c=makeCar(i+1,VEHICLES[(i+1)%3],name,5+Math.floor(i/2)*7,i%2?2.1:-2.1);
      Object.assign(c,{pace,risk,color,decision:0,plan:null,homeLane:(i%3-1)*2.7});return c;
    })];
    this.player=this.cars[0];this.order=this.cars.slice().sort((a,b)=>b.d-a.d);
    this.time=0;this.wet=.14;this.weather='Coastal haze';this.events=[];this.broken=new Set();this.finished=false;
    this.emit=(type,car,value)=>{this.events.push({type,id:car.id,value});};
  }
  weatherAt(d){
    const t=mod(d,LENGTH)/LENGTH;
    const storm=Math.max(0,1-Math.abs(t-.697)/.13);
    return clamp(.12+.16*(.5+.5*Math.sin(this.time*.037))+storm*.82,0,1);
  }
  aiInput(c,dt){
    c.decision-=dt;
    if(c.decision>0&&c.plan)return c.plan;
    c.decision=.11+this.rng()*.08;
    let lane=c.homeLane,curve=this.track.curvature(c.d+Math.max(14,c.v*.85),c.route);
    lane+=clamp(curve*180,-2.4,2.4);
    let passing=false;
    for(const rival of this.cars){
      const gap=difference(rival.d,c.d);
      if(rival!==c&&rival.route===c.route&&gap>0&&gap<19&&Math.abs(rival.lane-c.lane)<2.6){
        lane=rival.lane>0?rival.lane-3.2:rival.lane+3.2;passing=true;break;
      }
    }
    const local=mod(c.d,LENGTH);
    if(!c.route){
      for(const f of this.track.forks)if(f.start-local>0&&f.start-local<69&&c.risk>.68)lane=f.side*3.6;
      for(const ob of this.track.obstacles)if(!this.broken.has(ob.id)&&ob.d-local>0&&ob.d-local<45&&Math.abs(ob.lane-lane)<2.4)lane=ob.lane>0?ob.lane-3.4:ob.lane+3.4;
    }
    const diff={Touring:.87,Sport:1.065,Expert:1.17}[this.level]||1.065;
    const target=Math.min(c.tune.top/3.6,Math.sqrt(10/(Math.abs(curve)+.003)))*diff*c.pace*(c.surface==='mud'?.87:1);
    c.plan={throttle:c.v<target?1:.06,brake:c.v>target+3?.46:0,steer:clamp((lane-c.lane)*.39-c.sideV*.13+curve*c.v*.10,-1,1),
      boost:c.energy>48&&Math.abs(curve)<.009&&(passing||target>c.v+3),drift:Math.abs(curve)>.021&&c.risk>.75,use:!!c.item&&(passing||c.item==='repair'||c.id%3===0||c.energy<65)};
    return c.plan;
  }
  award(c){
    const position=this.order.indexOf(c)+1,r=this.rng();
    if(c.damage>23&&r<.69)return 'repair';
    if(position<=3)return r<.50?'shield':r<.81?'traction':'nitro';
    if(position>=7)return r<.44?'nitro':r<.76?'pulse':'traction';
    return ['shield','nitro','traction','pulse'][Math.floor(r*4)];
  }
  use(c){
    const item=c.item;if(!item)return;
    c.item=null;
    if(item==='repair'){c.damage=Math.max(0,c.damage-58);c.dirt=0;}
    if(item==='nitro'){c.surge=3.4;c.energy=Math.min(100,c.energy+18);}
    if(item==='shield')c.shield=7;
    if(item==='traction')c.traction=8;
    if(item==='pulse')for(const rival of this.cars){
      if(rival!==c&&rival.route===c.route&&Math.hypot(difference(rival.d,c.d),rival.lane-c.lane)<30){
        if(rival.shield>0)rival.shield=0;else{rival.stun=1.5;rival.v*=.83;}
      }
    }
    this.emit('ability',c,item);
  }
  interact(c,before){
    const local=mod(c.d,LENGTH), lapBase=Math.floor(c.d/LENGTH);
    if(!c.route){
      this.track.pickups.forEach((s,i)=>{
        const uid=lapBase*20+i;
        if(Math.abs(local-s)<2.5&&Math.abs(c.lane)<5.8&&c.lastPickup!==uid){
          c.lastPickup=uid;if(!c.item){c.item=this.award(c);this.emit('pickup',c,c.item);}
          c.energy=Math.min(100,c.energy+10);
        }
      });
      if(Math.abs(local-LENGTH*.965)<2&&c.lastRepair!==lapBase){
        c.damage=Math.max(0,c.damage-35);c.lastRepair=lapBase;this.emit('repair',c);
      }
      for(const ob of this.track.obstacles){
        if(this.broken.has(ob.id)||Math.abs(local-ob.d)>3.1)continue;
        const side=Math.abs(c.lane-ob.lane),uid=lapBase*100+ob.id;
        if(side<1.62&&c.lastObstacle!==uid&&c.air<.8){
          c.lastObstacle=uid;
          const fragile=ob.type==='crate'||ob.type==='driftwood';
          if(fragile){this.broken.add(ob.id);this.emit('break',c,ob.id);}
          if(impact(c,c.v*(fragile?.19:.48),fragile?.87:.45))this.emit('hit',c);
        }else if(side>1.8&&side<3.2&&c.v>18&&uid!==c.nearMiss){
          c.nearMiss=uid;c.energy=Math.min(100,c.energy+4);this.emit('near',c);
        }
      }
    }
    if(c.d>=c.gate*LENGTH/GATES){
      const crossed=c.gate++;
      if(crossed%GATES===0){
        const gateTime=this.time-(c.d-crossed*LENGTH/GATES)/Math.max(.1,(c.d-before)/this.dt);
        c.splits.push(gateTime-c.lapStart);c.lapStart=gateTime;c.lap=Math.min(LAPS,c.splits.length+1);
        this.emit('lap',c,c.lap);
        if(c.splits.length===LAPS){c.finish=gateTime;this.emit('finish',c);}
      }
    }
  }
  step(input,dt){
    if(this.finished)return;
    this.dt=dt;this.time+=dt;this.events.length=0;
    this.wet=ease(this.wet,this.weatherAt(this.player.d),.45,dt);
    this.weather=this.wet>.65?'Heavy rain':this.wet>.36?'Rain':'Coastal haze';
    for(const c of this.cars){
      if(c.finish!==null)continue;
      const action=c.id?this.aiInput(c,dt):input;
      if(action.use)this.use(c);
      c.drafting=this.cars.some(r=>r!==c&&r.finish===null&&r.route===c.route&&difference(r.d,c.d)>4.4&&difference(r.d,c.d)<19&&Math.abs(r.lane-c.lane)<1.7&&c.v>15);
      const before=c.d;
      drive(c,action,dt,this.track,this.weatherAt(c.d),this.emit);
      this.interact(c,before);
    }
    for(let i=0;i<this.cars.length;i++)for(let j=i+1;j<this.cars.length;j++){
      const a=this.cars[i],b=this.cars[j];
      if(a.route!==b.route||a.finish!==null||b.finish!==null||Math.abs(a.air-b.air)>1.4)continue;
      const gap=difference(a.d,b.d),offset=a.lane-b.lane;
      if(Math.abs(gap)>4||Math.abs(offset)>1.85)continue;
      const nudge=(1.85-Math.abs(offset))*(offset===0?(i%2?1:-1):Math.sign(offset)),fraction=a.tune.mass/(a.tune.mass+b.tune.mass);
      a.lane+=nudge*(1-fraction);b.lane-=nudge*fraction;
      const rear=gap>0?b:a,front=gap>0?a:b,closing=rear.v-front.v;
      if(closing>1&&rear.impact<.1){
        const loss=closing*(front.tune.mass/(rear.tune.mass+front.tune.mass));
        rear.v-=loss;front.v+=closing-loss;
        if(impact(rear,closing*.43,.985))this.emit('hit',rear);
      }
    }
    this.order.sort((a,b)=>a.finish!==null?(b.finish!==null?a.finish-b.finish:-1):b.finish!==null?1:b.d-a.d);
    this.finished=this.player.finish!==null;
  }
}
export const sectorGate=d=>SECTORS.reduce((n,s)=>mod(d,LENGTH)>=s.start?s.id:n,0)+1;
