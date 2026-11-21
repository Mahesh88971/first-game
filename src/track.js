import {LENGTH,SECTORS,FORKS,clamp,mix,mod} from './config.js';

// Survey points follow the shoreline clockwise. The same arc-length table drives
// road geometry, race gates, AI lookahead and the course map.
const SURVEY = [[-34,-106],[-10,-114],[18,-114],[48,-111],[79,-99],[104,-86],
  [121,-57],[111,-32],[89,-25],[99,8],[115,34],[105,56],[78,66],[55,95],
  [31,111],[3,103],[-17,77],[-43,75],[-71,93],[-101,78],[-108,51],[-91,23],
  [-105,-5],[-129,-21],[-137,-52],[-121,-65],[-99,-61],[-87,-80],[-84,-112],[-63,-123]];
function cubic(a,b,c,d,t) {
  return .5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t);
}
function surveyAt(t) {
  const n=SURVEY.length, i=Math.floor(t*n), u=t*n-i;
  const p=[-1,0,1,2].map(k=>SURVEY[mod(i+k,n)]);
  return [0,1].map(k=>cubic(p[0][k],p[1][k],p[2][k],p[3][k],u));
}
function arcTable(points) {
  let length=0;
  const samples=points.map(([x,z],i)=>{
    if(i) length+=Math.hypot(x-points[i-1][0],z-points[i-1][1]);
    return {x,z,d:length};
  });
  return {samples,length};
}
function lookup(table,d) {
  const samples=table.samples;
  let lo=0, hi=samples.length-1;
  while(hi-lo>1){const m=(lo+hi)>>1;if(samples[m].d<=d)lo=m;else hi=m;}
  const a=samples[lo],b=samples[hi],l=b.d-a.d,t=clamp((d-a.d)/l,0,1);
  return {x:mix(a.x,b.x,t),z:mix(a.z,b.z,t),fx:(b.x-a.x)/l,fz:(b.z-a.z)/l};
}
const elevations=[3,5,9,6,3,1.8,1.3,.22,.22,2,6,10,13,15,22,35,29,27,42,22,12,7,4,3,3];
export function elevation(d) {
  const t=mod(d,LENGTH)/LENGTH*(elevations.length-1),i=Math.floor(t),u=t-i;
  return mix(elevations[i],elevations[i+1],u*u*(3-2*u));
}
// Elevations are in metres relative to the survey line. Both outer edges meet
// the terrain. The mesh, vehicle contact samples and painted gates use this bed.
export const curbHeight=(s,side)=>.19-.135*Math.max(0,1-Math.abs(mod(s+side*7,35)-17.5)/3.4);
function crossSection(surface,s,lane,width){
  const across=lane/width;
  if(Math.abs(across)>=1)return 0;
  const envelope=1-across*across;
  if(surface==='water')return 0;
  if(surface==='timber')return .008*Math.cos(s*1.7)*envelope;
  if(surface==='asphalt')return (.14+.035*across*Math.sin(s*32*Math.PI/LENGTH))*envelope;
  const wandering=Math.sin(s*.027)*.28;
  const wheelDistance=Math.abs(Math.abs(lane-wandering)-1.02);
  const rut=Math.exp(-wheelDistance*wheelDistance*5.4);
  const low=Math.sin(s*.22+lane*.71)*.030+Math.sin(s*.61-lane*1.12)*.015;
  const depth=surface==='mud'?.13:surface==='sand'?.085:.045;
  return envelope*(.06+low-rut*depth);
}
export class Track {
  constructor() {
    const points=Array.from({length:2401},(_,i)=>surveyAt(i/2400));
    const scale=LENGTH/arcTable(points).length;
    this.main=arcTable(points.map(([x,z])=>[x*scale,z*scale]));
    this.forks=FORKS.map(spec=>{
      const a=lookup(this.main,spec.start),b=lookup(this.main,spec.end);
      const handle=Math.hypot(b.x-a.x,b.z-a.z)*.25;
      const pts=Array.from({length:101},(_,i)=>{
        const t=i/100,v=1-t;
        const bend=spec.side*14*Math.sin(Math.PI*Math.min(1,t/.58))**2;
        return ['x','z'].map(k=>v*v*v*a[k]+3*v*v*t*(a[k]+a['f'+k]*handle)+3*v*t*t*(b[k]-b['f'+k]*handle)+t*t*t*b[k]+bend*(k==='x'?-a.fz:a.fx));
      });
      return {...spec,table:arcTable(pts)};
    });
    this.pickups=[.033,.135,.263,.399,.512,.653,.769,.927].map(p=>p*LENGTH);
    this.obstacles=[
      [.046,3.3,'crate'],[.075,-4.1,'crate'],[.143,-4.5,'barrier'],[.245,4.2,'rock'],
      [.337,-3.1,'driftwood'],[.423,2.8,'driftwood'],[.489,-4.7,'crate'],[.589,4.7,'barrier'],
      [.687,-3.8,'rock'],[.755,3.6,'crate'],[.799,-4.2,'driftwood'],[.931,3.9,'rock'],[.982,-4,'crate']
    ].map(([p,lane,type],id)=>({id,d:p*LENGTH,lane,type}));
    this.ramp={start:LENGTH*.853,end:LENGTH*.8565};
  }
  sector(d) {
    const s=mod(d,LENGTH);
    for(let i=SECTORS.length-1;i>0;i--) if(s>=SECTORS[i].start) return SECTORS[i];
    return SECTORS[0];
  }
  frame(d,route=null) {
    const s=mod(d,LENGTH), t=route && (s-route.start)/(route.end-route.start);
    const f=route && t>=0 && t<=1 ? lookup(route.table,t*route.table.length) : lookup(this.main,s);
    const y=route && t>=0 && t<=1 ? Math.max(elevation(s),mix(elevation(route.start),elevation(route.end),t))+.85*Math.sin(Math.PI*t)**2 : elevation(s);
    return {...f,y,rx:-f.fz,rz:f.fx,yaw:Math.atan2(f.fx,f.fz)};
  }
  pose(d,lane=0,route=null) {
    const f=this.frame(d,route);
    return {...f,x:f.x+f.rx*lane,y:f.y+this.relief(d,lane,route),z:f.z+f.rz*lane};
  }
  relief(d,lane,route=null){
    const s=mod(d,LENGTH),sec=this.sector(s);
    const verge=Math.abs(lane)-sec.width;
    if(!route&&(sec.id===0||sec.id===11)&&verge>0&&verge<1.98){
      return (curbHeight(s,Math.sign(lane))-.04-.028*verge)*Math.min(1,verge/.12,(1.98-verge)/.14);
    }
    const main=crossSection(sec.surface,s,lane,sec.width);
    const previous=SECTORS[mod(sec.id-1,SECTORS.length)];
    const h=s-sec.start<8?mix(crossSection(previous.surface,s,lane,previous.width),main,clamp((s-sec.start)/8,0,1)):main;
    if(!route||s<route.start||s>route.end)return h;
    const join=clamp(Math.min(s-route.start,route.end-s)/8,0,1);
    return mix(h,crossSection(route.surface,s,lane,4.9),join);
  }
  curvature(d,route) {
    const a=this.frame(d-5,route),b=this.frame(d+5,route);
    return (b.fx*a.rx+b.fz*a.rz)/10;
  }
  rampHeight(d,lane,route) {
    const s=mod(d,LENGTH);
    return !route && Math.abs(lane)<3.2 && s>=this.ramp.start && s<=this.ramp.end ? 4*(s-this.ramp.start)/(this.ramp.end-this.ramp.start) : 0;
  }
  surface(d,lane,route) {
    if(route) return Math.abs(lane)>5.1?'grass':route.surface;
    const sec=this.sector(d);
    return Math.abs(lane)>sec.width ? (sec.surface==='sand'?'sand':'grass') : sec.surface;
  }
}
