import * as T from 'three';
import foliageUrl from '../assets/coastal-foliage.webp';
import portUrl from '../assets/port-materials.webp';
import panelUrl from '../assets/rear-panels.webp';
import roadUrl from '../assets/road-surfaces.webp';
import roadsideUrl from '../assets/roadside-materials.webp';

// Unpack original atlases once. Data URLs keep the packaged build compatible
// with file://, including WebGL texture uploads in a fresh browser profile.
const atlases=new Map(),tileCache=new Map();
function tile(url,columns,rows,x,y){
  const key=[url.length,columns,rows,x,y].join('/');
  if(tileCache.has(key))return tileCache.get(key);
  if(!atlases.has(url)){const img=new Image();const loaded=new Promise((ok,fail)=>{img.onload=()=>ok(img);img.onerror=fail;});img.src=url;atlases.set(url,loaded);}
  const c=document.createElement('canvas');c.width=c.height=url===foliageUrl?724:(url===roadUrl||url===roadsideUrl)?627:512;
  const ctx=c.getContext('2d');ctx.fillStyle='#9c998a';if(url!==foliageUrl)ctx.fillRect(0,0,c.width,c.height);
  const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=4;
  atlases.get(url).then(im=>{
    const w=im.width/columns,h=im.height/rows;
    const bounds=url===foliageUrl?[[0,.308],[.309,.663],[.668,1]][x]:[x/columns,(x+1)/columns];
    ctx.drawImage(im,bounds[0]*im.width,y*h,(bounds[1]-bounds[0])*im.width,h,0,0,c.width,c.height);
    if(url===foliageUrl){
      const img=ctx.getImageData(0,0,c.width,c.height),a=img.data;
      for(let i=0;i<a.length;i+=4){
        const min=Math.min(a[i],a[i+1],a[i+2]),max=Math.max(a[i],a[i+1],a[i+2]);
        if(a[i+3]<207||(min>161&&max-min<33&&a[i+3]<251))a[i+3]=0;
      }
      ctx.putImageData(img,0,0);
    }
    tex.needsUpdate=true;
  }).catch(()=>{});tileCache.set(key,tex);return tex;
}
export const portTile=(x,y)=>tile(portUrl,3,2,x,y);
export const rearTile=i=>tile(panelUrl,3,1,i,0);
function groundTile(url,x,y){
  const t=tile(url,2,2,x,y);
  t.wrapS=t.wrapT=T.MirroredRepeatWrapping;t.anisotropy=8;
  return t;
}
export const roadTile=(x,y)=>groundTile(roadUrl,x,y);
export const roadsideTile=(x,y)=>groundTile(roadsideUrl,x,y);
export function leavesMaterial(id){
  return new T.MeshBasicMaterial({map:tile(foliageUrl,3,1,id,0),color:0xc3c8af,alphaTest:.53,side:T.DoubleSide});
}
export function foliageGeometry(width,height){
  // Two intersecting leaf cards preserve silhouette from both sides of a fork.
  const pos=[],uv=[];
  for(const angle of [0,Math.PI*.5]){
    const x=Math.cos(angle)*width/2,z=Math.sin(angle)*width/2;
    pos.push(-x,0,-z,x,0,z,-x,height,-z,-x,height,-z,x,0,z,x,height,z);
    uv.push(0,0,1,0,0,1,0,1,1,0,1,1);
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.computeVertexNormals();return g;
}
export function wallGeometry(){
  const pos=[],uv=[];
  const face=(a,b,c,d)=>{pos.push(...a,...b,...c,...b,...d,...c);uv.push(0,0,1,0,0,1,1,0,1,1,0,1);};
  for(const side of [-1,1]){
    face([-3.26*side,.51,2.67*side],[3.26*side,.51,2.67*side],[-3.26*side,3.6,2.67*side],[3.26*side,3.6,2.67*side]);
    face([3.27*side,.51,2.66*side],[3.27*side,.51,-2.66*side],[3.27*side,3.6,2.66*side],[3.27*side,3.6,-2.66*side]);
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.computeVertexNormals();return g;
}
export function shadowTexture(){
  const c=document.createElement('canvas');c.width=c.height=96;const ctx=c.getContext('2d');
  const g=ctx.createRadialGradient(48,48,10,48,48,47);g.addColorStop(0,'rgba(12,16,14,.91)');g.addColorStop(.57,'rgba(12,16,14,.76)');g.addColorStop(1,'rgba(12,16,14,0)');ctx.fillStyle=g;ctx.fillRect(0,0,96,96);return new T.CanvasTexture(c);
}
