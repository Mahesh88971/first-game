import * as T from 'three';
import {Parts,hutGeometry,propGeometry} from './models.js';
import {leavesMaterial,foliageGeometry,wallGeometry,portTile,roadTile,roadsideTile} from './materials.js';
import {RoadSheet} from './road-rendering.js';
import {LENGTH,SECTORS,random,clamp,mix} from './config.js';
import {curbHeight} from './track.js';

const STEPS=10, CHUNK=100,TAU=Math.PI*2;
const staticMat=new T.MeshStandardMaterial({vertexColors:true,roughness:.88,side:T.DoubleSide});
function surfaceTexture(){
  const c=document.createElement('canvas');c.width=c.height=256;
  const ctx=c.getContext('2d'),im=ctx.createImageData(256,256),rng=random(934);
  for(let i=0;i<im.data.length;i+=4){
    const x=(i/4)%256,y=Math.floor(i/1024);
    const n=clamp(184+rng()*62+7*Math.sin(x*.19+Math.sin(y*.04)) + 3*Math.sin(y*.3),0,255);
    im.data.set([n,n,n,255],i);
  }
  ctx.putImageData(im,0,0);
  for(let i=0;i<530;i++){const x=rng()*256,y=rng()*256;ctx.fillStyle=rng()>.5?'#fff3':'#1112';ctx.fillRect(x,y,.4+rng()*2,.5+rng()*1.6);}
  const tx=new T.CanvasTexture(c);tx.wrapS=tx.wrapT=T.RepeatWrapping;tx.colorSpace=T.SRGBColorSpace;tx.anisotropy=4;return tx;
}
class Ribbon {
  constructor(){this.pos=[];this.col=[];this.uv=[];}
  quad(a,b,c,d,color,uvScale=1){
    const col=new T.Color(),gradient=Array.isArray(color);
    for(const q of [a,b,c,c,b,d]){col.set(gradient?color[(q===b||q===d)?1:0]:color);this.pos.push(q.x,q.y,q.z);this.col.push(col.r,col.g,col.b);this.uv.push(q.u/uvScale,q.v/uvScale);}
  }
  mesh(mat){
    if(!this.pos.length)return null;
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(this.pos,3));g.setAttribute('color',new T.Float32BufferAttribute(this.col,3));g.setAttribute('uv',new T.Float32BufferAttribute(this.uv,2));g.computeVertexNormals();g.computeBoundingSphere();
    const m=new T.Mesh(g,mat);m.receiveShadow=true;return m;
  }
}
function addMesh(group,ribbon,material){const m=ribbon.mesh(material);if(m)group.add(m);}
function bandPoint(frame,lane,height,along){return {x:frame.x+frame.rx*lane,y:frame.y+height,z:frame.z+frame.rz*lane,u:lane,v:along};}
function span(rib,f,g,lo,hi,y0,y1,d,e,color,tex=4){
  if(rib.conform){
    const track=rib.conform,cols=Math.max(1,Math.ceil(Math.abs(hi-lo)/.65)),rows=Math.max(1,Math.ceil(Math.abs(e-d)/1.5));
    const point=(s,l,h)=>{const fr=track.frame(s);return bandPoint(fr,l,h+track.relief(s,l),s);};
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
      const l=mix(lo,hi,c/cols),u=mix(lo,hi,(c+1)/cols),a=mix(d,e,r/rows),b=mix(d,e,(r+1)/rows);
      const yl=mix(y0,y1,c/cols),yu=mix(y0,y1,(c+1)/cols);
      rib.quad(point(a,l,yl),point(a,u,yu),point(b,l,yl),point(b,u,yu),color,tex);
    }
    return;
  }
  rib.quad(bandPoint(f,lo,y0,d),bandPoint(f,hi,y1,d),bandPoint(g,lo,y0,e),bandPoint(g,hi,y1,e),color,tex);
}
function makeLibrary(){
  const lib={};for(let i=0;i<3;i++){lib['palm'+i]=foliageGeometry(8+i,9.3+i);lib['hut'+i]=hutGeometry(i);}
  for(const key of ['crate','barrier','driftwood']) lib[key]=propGeometry(key);
  const rock=new T.IcosahedronGeometry(1,2),vertices=rock.attributes.position;
  for(let i=0;i<vertices.count;i++){
    const x=vertices.getX(i),y=vertices.getY(i),z=vertices.getZ(i);
    const relief=.92+.12*Math.sin(4*x+2*z)*Math.cos(3*y-2*z)+.06*Math.sin(7*y+z);
    vertices.setXYZ(i,(x*relief+.18*y)*1.49,Math.max(-.28,Math.min(.92,y*relief+.12*x))+.33,z*relief*1.23);
  }
  rock.computeVertexNormals();lib.rock=rock;
  lib.scrub=foliageGeometry(4.7,3.2);lib.tree=foliageGeometry(10.5,9.9);
  let p=new Parts();
  p.box(0,.12,0,1.55,.26,5.4,0xddd0a7);
  for(const side of [-1,1]){p.box(side*.74,.46,0,.12,.58,5.28,0x3a7974);p.pipe([side*.75,.72,2.59],[0,.76,3.14],.10,0xd5c795);}
  for(const z of [-1.6,0,1.3])p.box(0,.48,z,1.47,.12,.36,0xa27b4e);
  lib.boat=p.finish();p=new Parts();
  p.pipe([0,0,0],[.08,7.1,0],.155,0x77664e,.092);p.box(0,6.54,0,2.44,.17,.20,0x77654d);
  for(const x of [-.94,.94])p.pipe([x,6.6,0],[x,6.99,0],.092,0xc4c0a4);
  lib.pole=p.finish();p=new Parts();
  p.box(0,.45,0,.13,.9,.13,0xd7cfb4);p.box(0,.73,-.076,.14,.13,.03,0xd16e2b);lib.post=p.finish();
  p=new Parts();p.pipe([0,0,0],[0,.013,0],.35,0x373b38,.35,24);
  p.pipe([0,.012,0],[0,.019,0],.306,0x5a5b52,.306,24);
  for(let row=-3;row<=3;row++)for(let col=-3;col<=3;col++)if(row*row+col*col<11){
    p.box(col*.08,.023,row*.08,.054,.007,.014,0x393e3a,0,.65);
  }
  lib.cover=p.finish();
  return lib;
}
function signTexture(text,accent='#ec8243',background='#26352e'){
  const c=document.createElement('canvas');c.width=512;c.height=128;
  const ctx=c.getContext('2d');ctx.fillStyle=background;ctx.fillRect(0,0,512,128);ctx.fillStyle=accent;ctx.fillRect(0,0,13,128);
  ctx.strokeStyle='#b1b7a377';ctx.lineWidth=3;ctx.strokeRect(5,5,502,118);
  ctx.fillStyle='#f4f0d9';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.font='bold 53px Arial';ctx.fillText(text,258,67,461);
  const tx=new T.CanvasTexture(c);tx.colorSpace=T.SRGBColorSpace;return new T.MeshBasicMaterial({map:tx,side:T.DoubleSide});
}
function sign(group,track,d,lane,label,w=5,h=1.25,height=2.45,kind){
  const f=track.pose(d,lane),root=new T.Group();root.position.set(f.x,f.y,f.z);root.rotation.y=f.yaw+Math.PI;
  const board=new T.Mesh(new T.PlaneGeometry(w,h),signTexture(label,kind));board.position.y=height;root.add(board);
  for(const s of [-1,1]){
    const post=new T.Mesh(new T.BoxGeometry(.13,height,.13),new T.MeshStandardMaterial({color:0x737969}));post.position.set(w*.39*s,height/2,-.12);root.add(post);
  }
  group.add(root);
}
function onTrack(p,track,d,lane,y,width,height,length,color,route=null){
  const f=track.pose(d,lane,route);p.box(f.x,f.y+y,f.z,width,height,length,color,0,f.yaw);
}
function pavementEdge(ribbon,parts,track,d,e,width,side){
  const height=s=>curbHeight(s,side);
  const pt=(s,l,h)=>bandPoint(track.frame(s),side*l,h,s);
  // Joints and dropped crossings follow the street alignment block by block.
  for(let s=d;s<e-.01;s+=2){
    const end=Math.min(s+1.982,e),a=height(s),b=height(end);
    const quad=(lo,hi,h0,h1,k0,k1,color)=>ribbon.quad(pt(s,lo,h0),pt(s,hi,h1),pt(end,lo,k0),pt(end,hi,k1),color,1.85);
    quad(width,width,0,a-.029,0,b-.029,0x8b8a81);
    quad(width,width+.045,a-.029,a,b-.029,b,0xc0bcb0);
    quad(width+.045,width+.27,a,a+.004,b,b+.004,0xb8b4a9);
    quad(width+.285,width+1.85,a-.01,a-.045,b-.01,b-.045,0x9d9b90);
    quad(width+1.85,width+1.85,a-.045,-.10,b-.045,-.10,0x858477);
  }
  if((d+(side>0?0:20))%40===0){
    const s=d+2,lane=side*(width-.33);
    onTrack(parts,track,s,lane,.066,.43,.020,1.08,0x444b46);
    for(let i=0;i<10;i++)onTrack(parts,track,s-.45+i*.10,lane,.081,.36,.015,.036,0x1f2826);
  }
}
export class Scenery {
  constructor(scene,track,surfaces){
    this.track=track;this.chunks=[];this.obstacles=[];this.dynamic=[];this.lib=makeLibrary();
    const tex=surfaceTexture();
    this.roadMat=new T.MeshStandardMaterial({map:tex,vertexColors:true,roughness:.76,side:T.DoubleSide});
    const palm=leavesMaterial(0),tree=leavesMaterial(1),scrub=leavesMaterial(2);
    this.leaves=[palm,tree,scrub];this.wind={value:0};
    for(const mat of this.leaves){
      mat.onBeforeCompile=shader=>{shader.uniforms.coastWind=this.wind;shader.vertexShader='uniform float coastWind;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n transformed.x += sin(coastWind * 1.4 + instanceMatrix[3].x * .14 + position.y * .26) * position.y * position.y * .0026;');};
    }
    const walls=wallGeometry(),wallMats=[0,1,2].map(i=>new T.MeshStandardMaterial({map:portTile(i,0),side:T.DoubleSide,roughness:.89}));
    const roofMat=new T.MeshStandardMaterial({map:portTile(0,1),side:T.DoubleSide,roughness:.67}),roofGeo=new T.BufferGeometry();
    roofGeo.setAttribute('position',new T.Float32BufferAttribute([-3.69,3.65,-3.18,-3.69,3.65,3.18,0,4.85,-3.18,0,4.85,-3.18,-3.69,3.65,3.18,0,4.85,3.18,0,4.85,-3.18,0,4.85,3.18,3.69,3.65,-3.18,3.69,3.65,-3.18,0,4.85,3.18,3.69,3.65,3.18],3));
    roofGeo.setAttribute('uv',new T.Float32BufferAttribute([0,0,1,0,0,1,0,1,1,0,1,1,0,1,1,1,0,0,0,0,1,1,1,0],2));roofGeo.computeVertexNormals();
    const paintMat=new T.MeshStandardMaterial({vertexColors:true,roughness:.58,side:T.DoubleSide});
    const terrainMat=new T.MeshLambertMaterial({map:tex,vertexColors:true,side:T.DoubleSide});
    const stoneMap=roadTile(1,1),sandMap=roadTile(1,0),grassMap=roadsideTile(1,1),basaltMap=roadsideTile(0,0),slabMap=roadsideTile(0,1);
    const basalt=new T.MeshStandardMaterial({map:basaltMap,roughness:.80,side:T.DoubleSide});
    basalt.onBeforeCompile=s=>{
      s.vertexShader='varying vec3 rockWorld,rockFacing;\n'+s.vertexShader.replace('#include <project_vertex>',`
        #include <project_vertex>
        vec4 rockPosition=vec4(transformed,1.);
        #ifdef USE_INSTANCING
          rockPosition=instanceMatrix*rockPosition;
        #endif
        rockWorld=(modelMatrix*rockPosition).xyz;
        rockFacing=inverseTransformDirection(transformedNormal,viewMatrix);
      `);
      s.fragmentShader='varying vec3 rockWorld,rockFacing;\n'+s.fragmentShader.replace('#include <map_fragment>',`
        vec3 blend=pow(abs(normalize(rockFacing)),vec3(4.));blend/=max(.001,blend.x+blend.y+blend.z);
        vec3 rockColor=texture2D(map,rockWorld.zy*.41).rgb*blend.x+texture2D(map,rockWorld.xz*.41).rgb*blend.y+texture2D(map,rockWorld.xy*.41).rgb*blend.z;
        diffuseColor.rgb*=rockColor*.87;
      `);
    };
    terrainMat.onBeforeCompile=s=>{
      Object.assign(s.uniforms,{scatterStone:{value:stoneMap},scatterSand:{value:sandMap},grassBed:{value:grassMap}});
      s.fragmentShader='uniform sampler2D scatterStone,scatterSand,grassBed;\n'+s.fragmentShader.replace('#include <color_fragment>',`
        vec2 uv=vMapUv;vec3 grit=texture2D(scatterStone,uv*1.27).rgb;
        vec3 sand=texture2D(scatterSand,uv*1.11+vec2(.29,.73)).rgb;
        vec3 grass=texture2D(grassBed,uv*2.71).rgb;
        float pasture=smoothstep(-.008,.028,vColor.g-vColor.r+(grit.r-.16)*.043);
        vec3 earth=mix(grit*.80,sand*.83,smoothstep(.29,.61,vColor.r)*.89);
        diffuseColor.rgb*=mix(earth,grass*.90,pasture);
      `);
    };
    const curbMat=new T.MeshStandardMaterial({map:slabMap,bumpMap:slabMap,bumpScale:.012,vertexColors:true,roughness:.64,side:T.DoubleSide});
    const lampMat=new T.MeshBasicMaterial({color:0xffd29a,side:T.DoubleSide});
    const rng=random(57912),trackPoint=(d,lane,h=0)=>{const f=track.pose(d,lane);return [f.x,f.y+h,f.z];};
    for(let begin=0;begin<LENGTH;begin+=CHUNK){
      const group=new T.Group(),road=new Ribbon(),curb=new Ribbon(),cutRock=new Ribbon(),lamps=new Ribbon(),ground=new Ribbon(),mark=new Ribbon(),parts=new Parts(),instances=new Map(),sheets=new Map();
      mark.conform=track;
      const sheet=type=>{if(!sheets.has(type))sheets.set(type,new RoadSheet());return sheets.get(type);};
      const place=(type,d,lane,scale=1,extraY=0,yaw=null)=>{
        const f=track.pose(d,lane);let list=instances.get(type);if(!list){list=[];instances.set(type,list);}
        list.push(new T.Matrix4().compose(new T.Vector3(f.x,f.y+extraY,f.z),new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),yaw??rng()*TAU),new T.Vector3(scale,scale,scale)));
      };
      for(let d=begin;d<begin+CHUNK;d+=STEPS){
        const e=d+STEPS,f=track.frame(d),g=track.frame(e),sec=track.sector(d+5),width=sec.width,id=sec.id;
        sheet(sec.surface).strip(track,d,e,width);
        if(sec.surface==='asphalt'){
          if(d%20===0){onTrack(parts,track,d+6,.13,.062,.095,.028,.14,0xc2af79);onTrack(parts,track,d+6,.13,.077,.055,.008,.094,0xf3d18a);}
          if(d%30===0)place('post',d,(width+.62)*(d%60===0?1:-1),1,0,f.yaw);
        }
        if(sec.surface==='timber'){
          for(const side of [-1,1]){
            onTrack(parts,track,d,side*(width-.23),.79,.18,1.58,.20,0x6f604d);
            for(const h of [.65,1.31])parts.pipe(trackPoint(d,side*(width-.23),h),trackPoint(e,side*(width-.23),h),.075,0x907d5b);
            onTrack(parts,track,d,side*width,-2.5,.38,5,.40,0x756752);
          }
        }
        const village=id===0||id===11,beach=id===2||id===3,bridge=id===5,tunnel=id===6;
        if(village&&d%90===10)place('cover',d+4,2.7,1,.047,f.yaw+.4);
        for(const side of [-1,1]){
          const edge=side*width,coast=side<0&&(id<=3||id===11),dry=beach?0xc7b587:village?0x9d9677:0x6b764e;
          if(village)pavementEdge(curb,parts,track,d,e,width,side);
          if(!bridge){
            for(let s=d;s<e;s+=2){
              const a=track.frame(s),b=track.frame(s+2);
              span(ground,a,b,edge-side*.43,side*(width+3),-.034,-.10,s,s+2,[beach?0xcab68a:0x9d9278,dry],3);
            }
            span(ground,f,g,side*(width+2.7),side*(width+18),-.112,coast?-.55:.02,d,e,[dry,coast?0xc1af85:0x6b764e],3);
            span(ground,f,g,side*(width+18),side*(width+(coast?42:75)),coast?-.55:.02,coast?-f.y-1:2.1,d,e,coast?0xbfad82:0x69794c,8);
            if(!coast)span(ground,f,g,side*(width+75),side*(width+260),2.1,side>0?-.8:-f.y-2,d,e,0x5a6c48,12);
            if(!coast&&side>0)span(ground,f,g,width+260,width+281,-.8,-f.y-2.5,d,e,[0x5a6c48,0x999477],5);
          }
          if(tunnel){
            const lo=side*(width+1.4);
            cutRock.quad(bandPoint(f,lo,-.10,d),bandPoint(f,lo,1.4,d),bandPoint(g,lo,-.10,e),bandPoint(g,lo,1.4,e),0xffffff);
            if(d%30===0){
              onTrack(parts,track,d,side*(width+.13),.38,.18,.76,.22,0x8a8980);
              span(lamps,f,track.frame(d+.48),side*(width+.5),side*(width+.85),2.85,2.85,d,d+.48,0xffffff);
            }
          }else if(!bridge){
            const blocked=track.forks.some(fork=>d>fork.start-20&&d<fork.end+20&&fork.side===side);
            if(!blocked){
              if(village&&d%30===0)place('hut'+Math.floor(rng()*3),d+3,side*(width+7+rng()*3),.88+rng()*.25,-.12,f.yaw+side*Math.PI*.50);
              if((rng()<(beach?.23:.47))&&(!village||d%30!==0))place('palm'+Math.floor(rng()*3),d+rng()*7,side*(width+4+rng()*14),.75+rng()*.62,-.12);
              if(!beach&&!village&&rng()<.57)place('tree',d,side*(width+11+rng()*27),.82+rng()*.72,-.08);
              if(rng()<.78)place('scrub',d,side*(width+2.3+rng()*7),.65+rng()*.98,-.15);
              if(rng()<.18)place('rock',d,side*(width+2.7+rng()*7),.8+rng()*1.3,-.22);
              if(!coast&&d%30===0)place('tree',d,side*(width+25+rng()*25),1.4+rng()*1.25);
            }
          }
        }
        if(tunnel){
          for(let j=0;j<10;j++){
            const a=j*Math.PI/10,b=(j+1)*Math.PI/10;
            const point=(fr,angle,along)=>bandPoint(fr,Math.cos(angle)*(width+1.4),1.4+Math.sin(angle)*(5.7+.16*Math.sin(along*.39+angle)),along);
            cutRock.quad(point(f,a,d),point(f,b,d),point(g,a,e),point(g,b,e),0xffffff,3);
          }
          if(d%30===0){
            onTrack(parts,track,d,0,6.81,1.65,.09,.70,0x71716a);
            span(lamps,track.frame(d-.26),track.frame(d+.26),-.74,.74,6.74,6.74,d-.26,d+.26,0xffffff);
          }
        }
        if(village&&d%40===0){
          place('pole',d,width+2.4,1,0,f.yaw);const next=track.frame(d+40);
          for(const shift of [-.75,.75]){
            const a=trackPoint(d,width+2.4+shift,6.94),b=trackPoint(d+40,width+2.4+shift,6.94);
            const mid=a.map((n,i)=>(n+b[i])*.5-(i===1?.72:0));parts.pipe(a,mid,.021,0x353b32,.021,4);parts.pipe(mid,b,.021,0x353b32,.021,4);
          }
          if(d%80===0)place('boat',d,-(width+36+rng()*7),.92,-f.y+.15,next.yaw+.2);
        }
        if(id===1&&d%20===0){
          const a=trackPoint(d,-width-.7,.74),b=trackPoint(d+20,-width-.7,.74);
          parts.pipe(a,b,.124,0xabab99,.124,5);onTrack(parts,track,d,-width-.7,.40,.15,.8,.14,0x8c8c7d);
        }
      }
      for(const sec of SECTORS.filter(s=>s.start>=begin&&s.start<begin+CHUNK&&s.id>0))sign(group,track,sec.start+5,sec.width+1.4,sec.name.toUpperCase(),4.2,1.05,2.45);
      for(const fork of track.forks){
        if(fork.start>=begin&&fork.start<begin+CHUNK)sign(group,track,fork.start-36,fork.side*8.8,(fork.side<0?'‹ ':'')+fork.name.toUpperCase()+(fork.side>0?' ›':''),5.1,1.28,2.5,'#87dace');
        for(let d=Math.max(fork.start,begin);d<Math.min(fork.end,begin+CHUNK);d+=5){
          const e=Math.min(d+5,fork.end,begin+CHUNK),f=track.frame(d,fork),g=track.frame(e,fork);
          sheet(fork.surface).strip(track,d,e,4.9,fork);
          for(const s of [-1,1])span(ground,f,g,4.9*s,8.8*s,.025,-.03,d,e,0x998971);
          if(d%20<5)onTrack(parts,track,d,5.0,.63,.16,1.25,.15,0x6baa98,fork);
        }
      }
      for(const d of track.pickups.filter(s=>s>=begin&&s<begin+CHUNK)){
        for(const s of [-1,1]){
          onTrack(parts,track,d,s*5.95,.5,.37,1,.69,0x285759);onTrack(parts,track,d,s*5.95,1.03,.4,.13,.72,0x85f7dd);
        }
        span(mark,track.frame(d),track.frame(d+1),-5.8,5.8,.09,.09,d,d+1,0x5bc8ae);
      }
      if(track.ramp.start>=begin&&track.ramp.start<begin+CHUNK){
        const a=track.ramp.start,b=track.ramp.end;
        for(let d=a;d<b;d+=1){
          const e=Math.min(b,d+1),f=track.frame(d),g=track.frame(e);const h=s=>.12+4*(s-a)/(b-a);
          road.quad(bandPoint(f,-3.2,h(d),d),bandPoint(f,3.2,h(d),d),bandPoint(g,-3.2,h(e),e),bandPoint(g,3.2,h(e),e),Math.floor(d-a)%5===0?0xd3ac6c:0x8a775b,3);
          if(Math.floor(d-a)%3===0)for(const s of [-1,1])onTrack(parts,track,d,3*s,h(d)/2,.17,h(d),.19,0x675440);
        }
        sign(group,track,a-22,8.5,'CREST  ↑',3.5,1,2.3);
      }
      if(begin===0){
        const d=37;sign(group,track,d,0,'W I L D L I N E',16,1.65,6.25);
        for(let j=0;j<2;j++)for(let k=0;k<20;k++)span(mark,track.frame(j*.6+.5),track.frame(j*.6+1.1),-7+k*.7,-7+(k+1)*.7,.10,.10,j*.6,j*.6+.6,(k+j)%2?0xe8e6cf:0x313a34);
      }
      const repair=LENGTH*.965;
      if(repair>=begin&&repair<begin+CHUNK){span(mark,track.frame(repair),track.frame(repair+2),-6,6,.10,.10,repair,repair+2,0x97ad65);sign(group,track,repair-10,8.2,'SERVICE  +',3.8,1,2.4);}
      addMesh(group,ground,terrainMat);addMesh(group,road,this.roadMat);addMesh(group,curb,curbMat);addMesh(group,mark,paintMat);
      addMesh(group,cutRock,basalt);addMesh(group,lamps,lampMat);
      for(const [type,surface] of sheets)group.add(surface.mesh(surfaces.materials[type]));
      if(parts.pieces.length){const m=new T.Mesh(parts.finish(),staticMat);m.castShadow=true;m.receiveShadow=true;group.add(m);}
      for(const [key,list] of instances){
        const inst=(geo,material)=>{
          const m=new T.InstancedMesh(geo,material,list.length);list.forEach((mat,i)=>m.setMatrixAt(i,mat));
          m.castShadow=true;m.receiveShadow=true;m.computeBoundingSphere();group.add(m);
        };
        inst(this.lib[key],key.startsWith('palm')?palm:key==='tree'?tree:key==='scrub'?scrub:key==='rock'?basalt:staticMat);
        if(key.startsWith('hut')){inst(walls,wallMats[Number(key.at(-1))]);inst(roofGeo,roofMat);}
      }
      scene.add(group);this.chunks.push({group,d:begin+CHUNK/2,center:track.frame(begin+CHUNK/2)});
    }
    for(const ob of track.obstacles){const m=new T.Mesh(this.lib[ob.type],ob.type==='rock'?basalt:staticMat),f=track.pose(ob.d,ob.lane);m.position.set(f.x,f.y+.06,f.z);m.rotation.y=f.yaw+.25;m.castShadow=true;scene.add(m);this.obstacles.push(m);}
    // The falls are visible from the bypass as well as the main road.
    const falls=track.forks[1],p=track.pose(mix(falls.start,falls.end,.55),-10,falls);
    const cliff=new T.Mesh(new T.IcosahedronGeometry(1,2),basalt);cliff.position.set(p.x,p.y+8,p.z);cliff.scale.set(7,13,8);scene.add(cliff);
    const fallMat=new T.MeshBasicMaterial({color:0xa1d8d4,transparent:true,opacity:.69,side:T.DoubleSide});
    for(let i=0;i<8;i++){
      const m=new T.Mesh(new T.PlaneGeometry(.62+rng(),19+rng()*2),fallMat);m.rotation.y=p.yaw+Math.PI*.5;m.position.set(p.x+p.fx*(i-3.5)*.66+p.rx*5.7,p.y+9,p.z+p.fz*(i-3.5)*.66+p.rz*5.7);scene.add(m);this.dynamic.push(m);
    }
  }
  update(race,range){
    const d=race.player.d%LENGTH;
    const f=this.track.frame(d,race.player.route);
    for(const c of this.chunks){const dist=Math.abs(c.d-d);c.group.visible=Math.min(dist,LENGTH-dist)<range+80||Math.hypot(c.center.x-f.x,c.center.z-f.z)<range+65;}
    this.obstacles.forEach((m,i)=>{m.visible=!race.broken.has(i)&&Math.abs(this.track.obstacles[i].d-d)<range;});
    this.dynamic.forEach((m,i)=>{m.scale.y=1+.036*Math.sin(race.time*6+i);});
    this.roadMat.roughness=.78-race.wet*.49;
    this.wind.value=race.time*(.8+race.wet*.5);
  }
}
