import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {rearTile} from './materials.js';

const unitBox=new T.BoxGeometry(1,1,1),unitBall=new T.IcosahedronGeometry(1,1);
const vertexMat=new T.MeshStandardMaterial({vertexColors:true,roughness:.44,metalness:.28,side:T.DoubleSide});
const v=(x,y,z)=>new T.Vector3(x,y,z);
const identity=new T.Quaternion();
export class Parts {
  constructor(){this.pieces=[];}
  add(source,x,y,z,sx,sy,sz,color,rotation=identity){
    const g=source.index?source.toNonIndexed():source.clone();
    g.deleteAttribute('uv');const c=new T.Color(color),n=g.attributes.position.count,colors=new Float32Array(n*3);
    for(let i=0;i<n;i++)c.toArray(colors,i*3);
    g.setAttribute('color',new T.BufferAttribute(colors,3));
    g.applyMatrix4(new T.Matrix4().compose(v(x,y,z),rotation,v(sx,sy,sz)));this.pieces.push(g);
  }
  box(x,y,z,w,h,d,color,ax=0,ay=0,az=0){this.add(unitBox,x,y,z,w,h,d,color,new T.Quaternion().setFromEuler(new T.Euler(ax,ay,az)));}
  ball(x,y,z,w,h,d,color){this.add(unitBall,x,y,z,w,h,d,color);}
  pipe(a,b,r,color,r2=r,n=7){
    const dir=v(...b).sub(v(...a)),l=dir.length(),mid=v(...a).lerp(v(...b),.5);
    const g=new T.CylinderGeometry(r2,r,l,n,1);
    this.add(g,mid.x,mid.y,mid.z,1,1,1,color,new T.Quaternion().setFromUnitVectors(v(0,1,0),dir.normalize()));g.dispose();
  }
  face(a,b,c,color){
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([...a,...b,...c],3));g.computeVertexNormals();
    this.add(g,0,0,0,1,1,1,color);g.dispose();
  }
  finish(){
    const out=mergeGeometries(this.pieces,false);this.pieces.forEach(g=>g.dispose());this.pieces=[];out.computeBoundingSphere();return out;
  }
}
const mesh=p=>{const m=new T.Mesh(p.finish(),vertexMat);m.castShadow=true;m.receiveShadow=true;return m;};
function wheelGeometry(radius,width){
  const p=new Parts(),dark=0x202321;
  const cylinder=(x,r,w,color)=>p.pipe([x-w/2,0,0],[x+w/2,0,0],r,color,r,20);
  cylinder(0,radius,width,dark);
  for(const side of [-1,1]){
    const x=side*width*.5;
    cylinder(x,radius*.81,.025,0x303331);cylinder(x+side*.023,radius*.63,.030,0x92978f);
    cylinder(x+side*.042,radius*.49,.025,0x242a29);cylinder(x+side*.068,radius*.17,.064,0x9da09a);
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4;
      p.pipe([x+side*.051,Math.sin(a)*radius*.11,Math.cos(a)*radius*.11],[x+side*.054,Math.sin(a+.18)*radius*.54,Math.cos(a+.18)*radius*.54],.026,0xc1c1ab);
    }
  }
  for(let i=0;i<22;i++){const a=i*Math.PI/11;p.box(0,Math.cos(a)*radius,Math.sin(a)*radius,width*.91,.028,.074,0x363934,a,0,.10*Math.sin(i));}
  return p.finish();
}
function bodyShell(p,sections,color){
  const points=([z,half,low,high,roof])=>[[-half,low,z],[-half,high,z],[-roof,high+.055,z],[roof,high+.055,z],[half,high,z],[half,low,z]];
  for(let i=1;i<sections.length;i++){
    const a=points(sections[i-1]),b=points(sections[i]);
    for(let j=0;j<a.length;j++){const k=(j+1)%a.length;p.face(a[j],a[k],b[j],color);p.face(a[k],b[k],b[j],color);}
  }
  for(const s of [sections[0],sections.at(-1)]){
    const a=points(s);for(let j=1;j<a.length-1;j++)p.face(a[0],a[j],a[j+1],color);
  }
}
export function buildCar(spec,paint,number){
  const buggy=spec.id==='buggy',suv=spec.id==='suv',p=new Parts(),black=0x242a29,steel=0x72796e,glass=0x263d42;
  const width=buggy?.95:.90,r=buggy?.44:suv?.43:.365,axle=buggy?1.27:suv?1.42:1.30;
  p.box(0,.47,0,1.57,.17,3.38,black);
  if(buggy){
    bodyShell(p,[[-1.55,.66,.53,.70,.48],[-.79,.77,.56,.94,.57],[.63,.75,.56,.91,.59],[1.54,.63,.58,.76,.52],[1.78,.49,.59,.69,.41]],paint);
    p.box(0,.92,-1.13,.99,.45,.59,0x333c39);
    for(let k=0;k<8;k++)p.box(-.44+k*.124,1.16,-1.13,.055,.045,.54,steel);
    for(const s of [-1,1]){
      p.pipe([s*.73,.66,1.62],[s*.71,1.01,.60],.055,black);
      p.pipe([s*.71,1.01,.60],[s*.58,1.67,.15],.057,black);
      p.pipe([s*.58,1.67,.15],[s*.61,1.65,-.65],.061,black);
      p.pipe([s*.61,1.65,-.65],[s*.76,.69,-1.63],.07,black);
      p.pipe([s*.75,.68,-.69],[s*.61,1.65,-.65],.056,black);
      p.pipe([s*.77,.63,.61],[s*.77,.99,-.61],.045,steel);
      p.pipe([s*.63,1.01,-.66],[-s*.6,1.62,-.68],.04,steel);
      p.box(s*.37,.90,-.29,.50,.54,.27,0x262a28,-.16);
      p.ball(s*.35,1.27,-.16,.195,.235,.20,s>0?0xddd5aa:0x354446);
      p.box(s*.35,1.29,.012,.31,.076,.05,0x1b2626);
      for(const z of [-axle,axle]){
        p.pipe([s*.45,.49,z-.29],[s*.95,.42,z],.05,steel);
        p.pipe([s*.58,.90,z],[s*.93,.40,z],.059,paint);
        p.box(s*.94,.92,z,.43,.095,.85,paint,.08);
      }
      p.pipe([s*.47,.71,-1.55],[s*.47,.91,-1.87],.084,steel);
      p.pipe([s*.54,.83,1.55],[s*.54,.83,1.66],.15,black,.15,14);
      p.pipe([s*.54,.83,1.66],[s*.54,.83,1.67],.111,0xffda87,.111,14);
    }
    p.box(0,1.69,-.26,1.35,.085,1.07,0x38413e);
    p.pipe([-.64,.58,-1.77],[.64,.58,-1.77],.068,black);
  }else{
    const rear=suv?-2.12:-1.97,front=suv?2.22:2.03,h=suv?1.88:1.53;
    bodyShell(p,[[rear,.75,.47,.95,.65],[rear+.19,.92,.43,1.04,.77],[-.80,.95,.44,1.10,.78],[.70,.94,.43,1.03,.78],[front-.22,.90,.42,.89,.72],[front,.72,.45,.78,.67]],paint);
    bodyShell(p,[[rear+.20,.83,1.0,1.04,.78],[suv?-1.63:-1.13,.77,1.01,h-.08,.67],[.20,.73,1.00,h,.63],[1.05,.81,.98,1.03,.75]],glass);
    p.box(0,h+.018,suv?-.69:-.45,1.39,.071,suv?1.85:1.31,paint);
    for(const s of [-1,1]){
      p.pipe([s*.8,1.02,1.0],[s*.71,h,.20],.058,paint);
      p.pipe([s*.85,1.06,-.49],[s*.74,h,-.44],.042,black);
      p.pipe([s*.84,1.04,rear+.21],[s*.74,h-.03,suv?-1.60:-1.11],.071,paint);
      p.box(s*.95,.95,-.57,.025,.045,.18,black);
      p.box(s*.98,1.11,.57,.20,.13,.23,black);
      p.box(s*.69,.8,front-.015,.31,.12,.045,0xffe3a1);
      p.box(s*.95,.54,0,.085,.12,2.24,black);
      for(const z of [-axle,axle])p.box(s*.94,.46,z-.39,.32,.41,.05,black);
      if(suv)p.pipe([s*.61,h+.14,-1.54],[s*.61,h+.14,.09],.045,black);
    }
    if(!suv){p.box(0,1.37,-1.7,1.89,.085,.38,black);for(const s of [-1,1])p.box(s*.52,1.19,-1.66,.062,.30,.20,black);}
    else for(let k=0;k<4;k++)p.box(0,h+.13,-1.45+.43*k,1.38,.065,.065,black);
    p.box(0,.58,front+.014,1.09,.17,.05,black);
    p.box(0,.55,rear-.02,1.69,.13,.07,black);
    p.box(-.32,.98,1.20,.22,.02,.76,0x285858,.13);
    p.box(-.32,h+.058,-.43,.22,.014,1.21,0x285858);
  }
  const tail=buggy?-1.57:suv?-2.14:-1.99;
  for(const side of [-1,1])p.box(side*(buggy?.59:.67),buggy?.77:.88,tail,buggy?.19:.33,.105,.05,0xf04327);
  p.box(0,buggy?.66:.73,tail-.025,.44,.13,.035,0xcabc94);
  const root=new T.Group(),body=mesh(p);root.add(body);
  const style=buggy?0:suv?2:1,plateBase=buggy?.52:.42,plateTop=buggy?1.05:.995;
  const panelWidth=buggy?1.33:1.53,panelHeight=plateTop-plateBase;
  const fascia=new T.Mesh(new T.PlaneGeometry(panelWidth,panelHeight,8,3),new T.MeshStandardMaterial({map:rearTile(style),roughness:.50,metalness:.23,side:T.DoubleSide}));
  const panelPos=fascia.geometry.attributes.position;
  for(let i=0;i<panelPos.count;i++){
    const x=panelPos.getX(i),y=panelPos.getY(i);panelPos.setZ(i,-.12*(x/(panelWidth*.5))**4-.04*(y/(panelHeight*.5))**2);
  }
  fascia.geometry.computeVertexNormals();fascia.rotation.y=Math.PI;fascia.position.set(0,(plateBase+plateTop)/2,tail-.082);body.add(fascia);
  if(!buggy){
    const trim=new Parts(),base=suv?-1.92:-1.77,top=suv?-1.64:-1.13,h=suv?1.86:1.51;
    for(let j=1;j<6;j++){const u=j/7,z=base+(top-base)*u-.024,y=1.055+(h-1.055)*u;
      trim.pipe([-.67,y,z],[.67,y,z],.006,0x555b50,.006,4);}
    trim.pipe([-.18,1.11,base-.004],[.44,1.16,base+.036],.022,0x222820);
    for(const side of [-1,1]){
      for(const az of [-axle,axle])for(let j=0;j<7;j++){const a=j*Math.PI/7,b=(j+1)*Math.PI/7;
        trim.pipe([side*.965,.46+Math.sin(a)*(r+.06),az+Math.cos(a)*(r+.06)],[side*.965,.46+Math.sin(b)*(r+.06),az+Math.cos(b)*(r+.06)],.047,suv?black:paint,.047,5);}
      trim.pipe([side*.946,.93,.38],[side*.946,.54,.40],.009,0x62675b,.009,4);
      trim.pipe([side*.94,.55,-.86],[side*.94,.55,.41],.010,0x62675b,.010,4);
    }
    body.add(mesh(trim));
  }
  const wheelGeo=wheelGeometry(r,buggy?.34:.29),wheels=[];
  for(const z of [axle,-axle])for(const s of [-1,1]){
    const hub=new T.Group(),wheel=new T.Mesh(wheelGeo,vertexMat);wheel.castShadow=true;
    hub.position.set(s*width,r,z);hub.add(wheel);root.add(hub);wheels.push({hub,wheel,r});
  }
  const damage=new Parts();
  for(let i=0;i<9;i++){const s=i%2?1:-1;damage.pipe([s*.91,.68+i%3*.08,-.81+i*.13],[s*.925,.72+i%3*.08,-.51+i*.13],.012,0x998e79,.006,3);}
  damage.box(.5,.78,tail-.034,.28,.10,.04,0x342d28);const scratches=mesh(damage);scratches.visible=false;root.add(scratches);
  const glow=new T.Mesh(new T.ConeGeometry(.12,.72,8),new T.MeshBasicMaterial({color:0x72e5ff,transparent:true,opacity:.81}));
  glow.position.set(.43,.58,tail-.32);glow.rotation.x=-Math.PI/2;glow.visible=false;root.add(glow);
  const shield=new T.Mesh(new T.SphereGeometry(1,16,12),new T.MeshBasicMaterial({color:0x71e5d3,transparent:true,opacity:.12,depthWrite:false}));
  shield.scale.set(1.53,1.25,2.6);shield.position.y=.72;shield.visible=false;root.add(shield);
  const dirt=new Parts();for(let i=0;i<20;i++){
    let s=i%2?1:-1;dirt.ball(s*(buggy?.75:.915),.54+.13*Math.sin(i*9),-.78+(i%10)*.14,.022,.06+.04*Math.cos(i),.108,0x725735);
  }
  const mud=mesh(dirt);mud.visible=false;root.add(mud);
  return {root,body,wheels,scratches,glow,shield,mud};
}

export function palmGeometry(seed){
  const p=new Parts(),h=7.4+seed*1.2,bend=1+seed*.24,leafColors=[0x374e26,0x496331,0x688044,0x809154];
  for(let j=0;j<6;j++){const a=j/6,b=(j+1)/6;
    p.pipe([bend*a*a,h*a,.23*a],[bend*b*b,h*b,.23*b],.31-.16*a,j%2?0x726954:0x88775a,.31-.16*b,8);}
  for(let k=0;k<10;k++){
    const a=k*2.399+seed,dx=Math.cos(a),dz=Math.sin(a),len=3.1+.67*Math.sin(k*5+seed);
    const pos=t=>[bend+dx*len*t,h+Math.sin(t*Math.PI)*1.12-t*t*1.46,.23+dz*len*t];
    for(let j=0;j<9;j++){
      const t=j/9,q=(j+1)/9,A=pos(t),B=pos(q),spread=(.13+.59*Math.sin(Math.PI*q))*(1-.25*t);
      for(const sign of [-1,1]){
        const tip=[B[0]-dz*spread*sign+dx*.24,B[1]-.27-spread*.3,B[2]+dx*spread*sign+dz*.24];
        p.face(A,B,tip,leafColors[(j+k+seed)%4]);p.face(A,tip,[A[0]-dz*.10*sign,A[1]-.025,A[2]+dx*.10*sign],leafColors[(k+seed)%4]);
      }
    }
  }
  return p.finish();
}
export function hutGeometry(style){
  const p=new Parts(),wall=[0xc9b797,0x82a69a,0xbb9272][style%3],roof=[0x96533d,0x597573,0x8c7969][style%3];
  p.box(0,.4,0,6.8,.57,5.7,0x867e69);p.box(0,2.05,0,6.5,3.10,5.3,wall);
  for(const s of [-1,1]){
    p.box(s*1.8,4.13,0,3.88,.18,6.36,roof,0,0,-s*.32);
    for(let i=0;i<11;i++)p.box(s*1.8,4.24,-2.93+i*.575,3.86,.065,.055,roof,0,0,-s*.32);
  }
  p.box(0,3.20,3.34,6.9,.14,1.65,roof,-.10);
  for(const x of [-3.12,3.12])p.box(x,1.57,3.92,.105,3.05,.105,0x786c53);
  p.box(0,4.69,0,.18,.11,6.46,roof);
  return p.finish();
}
export function propGeometry(type){
  const p=new Parts();
  if(type==='rock'){p.ball(0,.7,0,1.29,.91,1.20,0x686b5b);p.ball(.76,.34,.39,.65,.46,.61,0x757663);}
  if(type==='crate'){
    p.box(0,.57,0,1.2,1.14,1.05,0x987346);
    for(const s of [-1,1]){p.box(s*.53,.58,0,.11,1.19,1.12,0x665339);p.box(0,.60,s*.54,1.32,.13,.08,0xb3925e,0,0,.64*s);}
  }
  if(type==='barrier'){p.box(0,.48,0,2.0,.96,.68,0x9e9c8c);for(let i=0;i<3;i++)p.box(-.64+i*.62,.68,-.354,.31,.39,.028,0xe69146,0,0,-.25);}
  if(type==='driftwood'){p.pipe([-1.2,.30,-.37],[1.22,.39,.34],.32,0x68543a,.24,10);p.pipe([.2,.36,.13],[.88,.90,.55],.13,0x776346,.06);}
  return p.finish();
}
