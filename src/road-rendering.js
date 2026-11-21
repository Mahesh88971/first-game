import * as T from 'three';
import {Reflector} from 'three/addons/objects/Reflector.js';
import {roadTile,roadsideTile} from './materials.js';

const styleNames=['asphalt','sand','mud','gravel','rock','water','timber'];
const surfaceCells=[[0,0],[1,0],[0,1],[1,1],[1,1],[1,0]];
const colors=[0xcbd4de,0xffe8bf,0xe4cbb2,0xe4ddc9,0xb5bdc0,0x809e92,0xd2c3af];
const noiseGLSL=`
float hashRoad(vec2 p) {
  vec3 q=fract(vec3(p.xyx)*vec3(.1031,.11369,.13787));
  q+=dot(q,q.yzx+19.19);
  return fract((q.x+q.y)*q.z);
}
float roadNoise(vec2 p) {
  vec2 cell=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hashRoad(cell),hashRoad(cell+vec2(1,0)),f.x),
             mix(hashRoad(cell+vec2(0,1)),hashRoad(cell+1.),f.x),f.y);
}
`;
const mapGLSL=`
  vec2 coord=vRoadCoord;
  float broad=roadNoise(coord*vec2(.20,.074));
  float fleck=roadNoise(coord*vec2(.96,.55));
  float dampBasin=.54*broad+.29*fleck+.17*roadNoise(coord*.043+10.);
  float nearDetail=1.-smoothstep(20.,95.,length(vViewPosition));
  vec2 detail=coord*.34+vec2(.11*broad,.08*fleck);
  vec3 stone=texture2D(map,detail).rgb;
  vec3 second=texture2D(map,mat2(.79,.61,-.61,.79)*detail*1.38+vec2(3.3,7.7)).rgb;
  vec3 albedo=mix(stone,second,.28+.44*roadNoise(coord*.16+8.));
  float grain=dot(stone,vec3(.28,.53,.19));
  float edge=abs(coord.x)/vRoadWidth;
  float wheelOffset=(abs(abs(coord.x)-vRoadWidth*.47)-.87)/.40;
  float tracks=exp(-wheelOffset*wheelOffset);
  float poolLevel=.685-.21*roadWetness;
  float shore=dampBasin+.050*edge+.030*(roadNoise(coord*2.9)-.5);
  float pool=smoothstep(poolLevel-.020,poolLevel+.032,shore);
  float wake=0.;
  float film=clamp(.13+roadWetness*.62+pool*.62,0.,1.);
  if(roadStyle==1||roadStyle==3||roadStyle==4)film*=.29;
  if(roadStyle==2)film=min(1.,film*.96+pool*.19);
  if(roadStyle==5){
    pool=1.;film=1.;albedo=mix(vec3(.075,.17,.14),stone,.12+.17*fleck);
    for(int i=0;i<9;i++){
      vec4 entry=roadWakes[i];float speed=length(entry.zw);
      if(speed>2.){
        vec2 dir=entry.zw/speed,delta=vRoadWorld.xz-entry.xy;
        float behind=-dot(delta,dir),side=abs(dot(delta,vec2(-dir.y,dir.x)));
        float span=clamp(speed*.44,3.,15.);
        float crest=abs(side-(.73+.21*behind));
        float fan=smoothstep(-1.,.4,behind)*(1.-smoothstep(1.1,span,behind));
        wake=max(wake,fan*(1.-smoothstep(.02,.35+.035*max(behind,0.),crest)));
      }
    }
    wake*=.49+.51*roadNoise(coord*3.9+roadTime*.64);
  }
  if(roadStyle==0){
    albedo*=mix(.66,1.16,broad)*(1.-.21*tracks);
    float fracture=abs(roadNoise(coord*vec2(.79,.91))+.21*fleck-.60);
    albedo*=1.-.40*(1.-smoothstep(.002,.008+fwidth(fracture),fracture))*smoothstep(.44,.77,broad)*nearDetail;
    float run=floor((coord.y+17.)/41.);
    vec2 patchCoord=vec2(coord.x-(hashRoad(vec2(run,3.))-.5)*8.,mod(coord.y+17.,41.)-17.);
    float cut=max(abs(patchCoord.x)-1.26,abs(patchCoord.y)-3.7)+.095*(fleck-.5);
    float repairMask=1.-smoothstep(-.025,.025+fwidth(cut),cut);
    albedo=mix(albedo,albedo*.66+vec3(.002,.003,.004),repairMask*.78);
    float aa=max(fwidth(coord.x),.012);
    float edgeStripe=1.-smoothstep(.050-aa,.066+aa,abs(abs(coord.x)-(vRoadWidth-.26)));
    float centerStripe=(1.-smoothstep(.064-aa,.083+aa,abs(coord.x)))*
        smoothstep(.02,.12,mod(coord.y,18.))*(1.-smoothstep(4.18,4.28,mod(coord.y,18.)));
    float wear=mix(.57,.91,smoothstep(.021,.11,grain))*mix(.78,1.,fleck);
    albedo=mix(albedo,vec3(.57,.57,.47),edgeStripe*wear);
    albedo=mix(albedo,vec3(.69,.46,.14),centerStripe*wear);
  }
  if(roadStyle==1||roadStyle==2||roadStyle==3||roadStyle==4){
    float channel=abs(abs(coord.x-.28*sin(coord.y*.027))-1.02);
    float depression=exp(-channel*channel*5.4);
    albedo*=1.-depression*(roadStyle==2?.30:.17);
    if(roadStyle==2)film=clamp(film*.8+depression*.22,0.,1.);
  }
  if(roadStyle==6){
    float plank=floor(coord.y/.28);
    float fibre=roadNoise(vec2(coord.x*.75,coord.y*26.))+.45*roadNoise(vec2(coord.x*1.9,coord.y*94.));
    albedo=texture2D(map,vec2(coord.x*.43+hashRoad(vec2(plank,9.)),coord.y*.58)).rgb*(.80+.17*fibre+.23*hashRoad(vec2(plank,3.)));
    float joint=smoothstep(0.,max(.018,fwidth(coord.y)*1.2),min(fract(coord.y/.28),1.-fract(coord.y/.28))*.28);
    albedo*=mix(.29,1.,joint);
    film*=.63;
  }
  diffuseColor.rgb*=albedo*mix(1.,.42,film);
`;
const lightGLSL=`
  vec3 worldN=normalize(inverseTransformDirection(normal,viewMatrix));
  vec3 eye=normalize(cameraPosition-vRoadWorld);
  float fresnel=.035+.85*pow(1.-clamp(dot(worldN,eye),0.,1.),3.0);
  vec3 reflected=reflect(-eye,worldN);
  float skyX=1.-abs(mod((atan(reflected.z,reflected.x)/6.283185+.5)*4.,2.)-1.);
  vec3 skyColor=texture2D(roadSky,vec2(skyX,clamp(.168+asin(clamp(reflected.y,-1.,1.))*.94,.006,.996))).rgb;
  vec3 reflectedColor=skyColor*(1.-roadWetness*.38);
  if(roadMirrorReady>.5 && vRoadProjection.w>.01){
    vec2 screen=vRoadProjection.xy/vRoadProjection.w;
    vec2 ripple=vec2(fleck-.5,broad-.5)*(.0055+.008*(1.-pool));
    if(roadStyle==5)ripple+=(.003+.013*wake)*vec2(sin(coord.y*2.2+roadTime*2.6),sin(coord.x*3.1-roadTime*1.6));
    vec2 boundary=min(screen,1.-screen);
    float valid=smoothstep(0.,.045,min(boundary.x,boundary.y))*(1.-smoothstep(48.,95.,length(vViewPosition)));
    reflectedColor=mix(reflectedColor,texture2D(roadMirror,clamp(screen+ripple,.002,.998)).rgb,valid);
  }
  float gloss=film*(.24+.76*pool);
  outgoingLight=mix(outgoingLight,reflectedColor,min(.91,gloss*(fresnel+.07*pool)));
  if(roadStyle==5)outgoingLight=mix(outgoingLight,vec3(.48,.64,.57),wake*.69);
  #include <opaque_fragment>
`;

export class RoadMaterials{
  constructor(skyTexture){
    this.wet={value:.18};this.time={value:0};this.mirrorReady={value:0};
    this.wakes={value:Array.from({length:9},()=>new T.Vector4(0,0,0,0))};
    this.mirror=new Reflector(new T.PlaneGeometry(1,1),{textureWidth:480,textureHeight:270,multisample:0,clipBias:.001});
    this.project={value:new T.Matrix4()};this.inverse=new T.Matrix4();this.up=new T.Vector3(0,0,1);this.normal=new T.Vector3();
    this.elapsed=Infinity;this.interval=1/26;
    this.materials=Object.fromEntries(styleNames.map((name,id)=>{
      const map=id===6?roadsideTile(1,0):roadTile(...surfaceCells[id]);
      const mat=new T.MeshStandardMaterial({map,color:colors[id],roughness:.83,metalness:.015,side:T.DoubleSide});
      mat.onBeforeCompile=s=>{
        Object.assign(s.uniforms,{roadStyle:{value:id},roadTime:this.time,roadWetness:this.wet,roadWakes:this.wakes,roadSky:{value:skyTexture},
          roadMirror:{value:this.mirror.getRenderTarget().texture},roadMirrorReady:this.mirrorReady,roadProject:this.project});
        s.vertexShader='attribute float halfWidth; varying float vRoadWidth; varying vec2 vRoadCoord; varying vec3 vRoadWorld; varying vec4 vRoadProjection; uniform mat4 roadProject;\n'+s.vertexShader.replace('#include <project_vertex>',
          '#include <project_vertex>\n vRoadWidth=halfWidth; vRoadCoord=uv; vRoadWorld=(modelMatrix*vec4(transformed,1.)).xyz; vRoadProjection=roadProject*vec4(vRoadWorld,1.);');
        s.fragmentShader='uniform int roadStyle; uniform vec4 roadWakes[9]; uniform float roadTime,roadWetness,roadMirrorReady; uniform sampler2D roadSky,roadMirror; varying float vRoadWidth; varying vec2 vRoadCoord; varying vec3 vRoadWorld; varying vec4 vRoadProjection;\n'+noiseGLSL+s.fragmentShader
          .replace('#include <map_fragment>',mapGLSL)
          .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\n roughnessFactor=mix(.89,.095,film*(.36+.64*pool));')
          .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
            vec3 dx=dFdx(-vViewPosition),dy=dFdy(-vViewPosition);
            vec3 ex=cross(dy,normal),ey=cross(normal,dx);
            float determinant=dot(dx,ex);
            float heightSample=grain*(roadStyle==2||roadStyle==3||roadStyle==4?.036:.013);
            vec3 grad=sign(determinant)*(dFdx(heightSample)*ex+dFdy(heightSample)*ey);
            normal=normalize(normal*max(abs(determinant),.000001)-grad*nearDetail*(1.-pool*.94));
          `).replace('#include <opaque_fragment>',lightGLSL);
      };
      return [name,mat];
    }));
  }
  setQuality(name){
    const width={Low:0,Medium:384,High:640,Ultra:832}[name]??640;
    this.interval=width===0?Infinity:1/(name==='Medium'?22:35);this.mirrorReady.value=0;this.elapsed=Infinity;
    if(width)this.mirror.getRenderTarget().setSize(width,Math.round(width*.60));
  }
  capture(renderer,scene,camera,f,grade,dt,wet,time){
    this.wet.value=wet;this.time.value=time;
    if(!Number.isFinite(this.interval))return;
    this.elapsed+=dt;if(this.elapsed<this.interval)return;
    this.elapsed=0;this.normal.set(-grade*f.fx,1,-grade*f.fz).normalize();
    this.mirror.position.set(f.x,f.y+.045,f.z);this.mirror.quaternion.setFromUnitVectors(this.up,this.normal);
    this.mirror.updateMatrixWorld();camera.updateMatrixWorld();
    this.mirror.onBeforeRender(renderer,scene,camera);
    this.inverse.copy(this.mirror.matrixWorld).invert();
    this.project.value.copy(this.mirror.material.uniforms.textureMatrix.value).multiply(this.inverse);
    this.mirrorReady.value=1;
  }
}

// A grid of shared vertices gives crowns and ruts continuous, lit normals.
// UV units are metres for stable stone size at every road width and on forks.
export class RoadSheet{
  constructor(){this.pos=[];this.uv=[];this.width=[];this.indices=[];}
  strip(track,start,end,width,route=null){
    const rows=Math.max(1,Math.ceil((end-start)/2)),cols=Math.ceil(width*2/.8),base=this.width.length;
    for(let row=0;row<=rows;row++){
      const d=start+(end-start)*row/rows,frame=track.frame(d,route);
      for(let col=0;col<=cols;col++){
        const lane=(col/cols*2-1)*width;
        const y=frame.y+.042+track.relief(d,lane,route);
        this.pos.push(frame.x+frame.rx*lane,y,frame.z+frame.rz*lane);this.uv.push(lane,d);this.width.push(width);
        if(row<rows&&col<cols){
          const a=base+row*(cols+1)+col,b=a+cols+1;
          this.indices.push(a,a+1,b,b,a+1,b+1);
        }
      }
    }
  }
  mesh(material){
    if(!this.indices.length)return null;
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(this.pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(this.uv,2));
    g.setAttribute('halfWidth',new T.Float32BufferAttribute(this.width,1));g.setIndex(this.indices);g.computeVertexNormals();g.computeBoundingSphere();
    const mesh=new T.Mesh(g,material);mesh.receiveShadow=true;mesh.layers.set(1);return mesh;
  }
}
