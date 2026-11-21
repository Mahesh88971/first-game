import * as T from 'three';
import {buildCar} from './models.js';
import {Scenery} from './scenery.js';
import {RoadMaterials} from './road-rendering.js';
import {PRESETS,LENGTH,clamp,ease,mix,random} from './config.js';
import horizon from '../assets/horizon.webp';
import {shadowTexture} from './materials.js';

function makeSky(scene){
  const skyMap=new T.TextureLoader().load(horizon);skyMap.colorSpace=T.SRGBColorSpace;
  skyMap.mapping=T.EquirectangularReflectionMapping;scene.environment=skyMap;scene.environmentIntensity=.48;
  const material=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{panorama:{value:skyMap},storm:{value:0}},vertexShader:
    'varying vec3 dir;void main(){dir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`uniform sampler2D panorama;uniform float storm;varying vec3 dir;
    void main(){vec3 n=normalize(dir);float lon=atan(n.z,n.x)/6.28318+.5;
    float u=1.-abs(mod(lon*4.,2.)-1.);float v=clamp(.168+asin(n.y)*.94,.006,.996);
    vec3 c=texture2D(panorama,vec2(u,v)).rgb;
    c=mix(c,vec3(.39,.47,.45),.12*(1.-smoothstep(.025,.36,abs(n.y))));
    gl_FragColor=vec4(mix(c,c*vec3(.51,.62,.67),storm*.63),1.);
    #include <colorspace_fragment>
    }`});
  const sky=new T.Mesh(new T.SphereGeometry(1200,32,16),material);sky.renderOrder=-100;scene.add(sky);return sky;
}
function ocean(scene){
  const mat=new T.ShaderMaterial({uniforms:{time:{value:0},wet:{value:0}},vertexShader:`
    varying vec3 pos;void main(){pos=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(pos,1.);}`,
    fragmentShader:`varying vec3 pos;uniform float time;uniform float wet;
    void main(){vec2 p=pos.xz;float a=sin(p.x*.32+p.y*.12+time*1.8)+sin(p.y*.81+time*2.0+sin(p.x*.11));
    float b=sin(p.x*1.67+p.y*.71+time*2.35+sin(p.y*.27));float farFade=1.-smoothstep(48.,260.,distance(pos,cameraPosition));
    vec3 c=mix(vec3(.039,.219,.219),vec3(.128,.391,.362),.5+.23*a);
    c+=vec3(.29,.31,.25)*smoothstep(1.32,2.10,a*.67+b*.42)*farFade;
    c=mix(c,vec3(.24,.46,.47),smoothstep(90.,670.,distance(pos,cameraPosition))*.78);
    gl_FragColor=vec4(c*(1.-wet*.23),1.);
    #include <colorspace_fragment>
    }`});
  const m=new T.Mesh(new T.PlaneGeometry(14000,14000),mat);m.rotation.x=-Math.PI/2;m.position.y=-.06;scene.add(m);return m;
}
class Spray {
  constructor(scene){
    this.count=700;this.head=0;this.life=new Float32Array(this.count);this.velocity=new Float32Array(this.count*3);
    this.pos=new Float32Array(this.count*3).fill(-10000);this.colors=new Float32Array(this.count*3);this.sizes=new Float32Array(this.count);
    this.g=new T.BufferGeometry();
    for(const [name,array,size] of [['position',this.pos,3],['color',this.colors,3],['radius',this.sizes,1]])this.g.setAttribute(name,new T.BufferAttribute(array,size).setUsage(T.DynamicDrawUsage));
    this.material=new T.ShaderMaterial({transparent:true,depthWrite:false,vertexColors:true,uniforms:{scale:{value:500}},vertexShader:`attribute float radius;varying vec3 tint;uniform float scale;void main(){tint=color;vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(radius*scale/max(1.,-mv.z),1.,55.);}`,
      fragmentShader:'varying vec3 tint;void main(){float d=length(gl_PointCoord-.5)*2.;if(d>1.)discard;gl_FragColor=vec4(tint,(1.-smoothstep(.0,1.,d))*.76);}'});
    this.points=new T.Points(this.g,this.material);this.points.frustumCulled=false;scene.add(this.points);
  }
  add(x,y,z,dx,dy,dz,color,size,life){
    const n=this.head;this.head=(n+1)%this.count;this.life[n]=life;this.sizes[n]=size;
    this.pos.set([x,y,z],n*3);this.velocity.set([dx,dy,dz],n*3);new T.Color(color).toArray(this.colors,n*3);
  }
  update(dt){
    for(let i=0;i<this.count;i++)if(this.life[i]>0){const j=i*3;this.life[i]-=dt;this.velocity[j+1]-=2.4*dt;
      for(let a=0;a<3;a++)this.pos[j+a]+=this.velocity[j+a]*dt;
      this.sizes[i]+=.42*dt;if(this.life[i]<=0)this.pos[j+1]=-10000;}
    for(const a of Object.values(this.g.attributes))a.needsUpdate=true;
  }
}
export class World {
  constructor(canvas,track,quality){
    this.canvas=canvas;this.track=track;this.scene=new T.Scene();this.scene.background=new T.Color(0x849d9e);
    this.scene.fog=new T.FogExp2(0x99aca6,.00215);
    this.renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance',alpha:false});
    this.renderer.info.autoReset=false;
    this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.shadowMap.type=T.PCFSoftShadowMap;
    this.camera=new T.PerspectiveCamera(60,1,.1,1500);this.camera.layers.enable(1);
    this.sky=makeSky(this.scene);this.sea=ocean(this.scene);
    this.hemi=new T.HemisphereLight(0xffefd5,0x8c9881,1.92);this.scene.add(this.hemi);
    this.sun=new T.DirectionalLight(0xffdea8,2.0);this.sun.castShadow=true;this.sun.shadow.mapSize.set(1024,1024);
    Object.assign(this.sun.shadow.camera,{left:-29,right:29,top:29,bottom:-29,near:.5,far:125});this.sun.shadow.normalBias=.054;this.sun.shadow.bias=-.00035;
    this.scene.add(this.sun,this.sun.target);
    this.roadSurfaces=new RoadMaterials(this.sky.material.uniforms.panorama.value);
    this.scenery=new Scenery(this.scene,track,this.roadSurfaces);this.spray=new Spray(this.scene);this.rng=random(202);
    this.headlamps=[-1,1].map(()=>{
      const light=new T.SpotLight(0xffe2ac,30,43,.31,.74,2);this.scene.add(light,light.target);return light;
    });
    this.tunnelLamps=[0,1,2].map(()=>{const light=new T.PointLight(0xffca86,0,28,2);this.scene.add(light);return light;});
    this.rainPos=new Float32Array(380*6);this.rainSeed=Array.from({length:380},()=>[this.rng()*56-28,this.rng()*24,this.rng()*60-30]);
    this.rainGeom=new T.BufferGeometry();this.rainGeom.setAttribute('position',new T.BufferAttribute(this.rainPos,3).setUsage(T.DynamicDrawUsage));
    this.rain=new T.LineSegments(this.rainGeom,new T.LineBasicMaterial({color:0xd8ebea,transparent:true,opacity:.34,depthWrite:false}));this.rain.frustumCulled=false;this.scene.add(this.rain);
    this.markSize=360;this.markAt=0;this.markPos=new Float32Array(this.markSize*18).fill(-10000);this.markGeom=new T.BufferGeometry();
    this.markGeom.setAttribute('position',new T.BufferAttribute(this.markPos,3).setUsage(T.DynamicDrawUsage));
    const marks=new T.Mesh(this.markGeom,new T.MeshBasicMaterial({color:0x433c2b,transparent:true,opacity:.43,depthWrite:false,side:T.DoubleSide}));marks.frustumCulled=false;this.scene.add(marks);
    this.debugLine=new T.Line(new T.BufferGeometry(),new T.LineBasicMaterial({color:0xe9d469}));this.debugLine.frustumCulled=false;this.scene.add(this.debugLine);
    this.debugPoints=new Float32Array(31*3);this.debugLine.geometry.setAttribute('position',new T.BufferAttribute(this.debugPoints,3));
    this.shadowMap=shadowTexture();this.contactShadows=[];this.models=[];this.camLook=new T.Vector3();this.target=new T.Vector3();this.aim=new T.Vector3();this.cameraMode=-1;this.stepTime=0;this.setQuality(quality);
  }
  setQuality(name){this.preset=PRESETS[name]||PRESETS.High;this.roadSurfaces.setQuality(name);this.renderer.shadowMap.enabled=this.preset.shadow;this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,this.preset.ratio));this.resize();}
  resize(){const w=Math.max(1,innerWidth),h=Math.max(1,innerHeight);this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.spray.material.uniforms.scale.value=h*.7;}
  grid(race){
    for(const model of this.models){
      this.scene.remove(model.root);const geometries=new Set();model.root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material?.map)o.material.dispose();});geometries.forEach(g=>g.dispose());
      model.glow.material.dispose();model.shield.material.dispose();
    }
    this.models=race.cars.map(c=>{const model=buildCar(c.tune,c.color??c.tune.color,c.id+1);this.scene.add(model.root);return model;});
    if(!this.contactShadows.length)for(const car of race.cars){
      const shade=new T.Mesh(new T.PlaneGeometry(3.6,5.7),new T.MeshBasicMaterial({map:this.shadowMap,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}));
      shade.rotation.order='YXZ';shade.rotation.x=-Math.PI/2;shade.renderOrder=1;this.scene.add(shade);this.contactShadows.push(shade);
    }
    this.markPos.fill(-10000);this.markGeom.attributes.position.needsUpdate=true;this.spray.life.fill(0);this.spray.pos.fill(-10000);
    this.cameraMode=-1;this.markClock=0;this.stepTime=0;this.lastFlash=-1;this.roadSurfaces.elapsed=Infinity;
  }
  wheelMark(car,f){
    for(const side of [-1,1]){
      const p=(k,l)=>{const at=this.track.pose(car.d+l,car.lane+side*.91+k,car.route);return [at.x,at.y+.071,at.z];};
      const length=Math.min(2.6,car.v*.066);
      this.markPos.set([...p(-.12,-1.45),...p(.12,-1.45),...p(-.12,-1.45-length),...p(.12,-1.45),...p(.12,-1.45-length),...p(-.12,-1.45-length)],this.markAt*18);
      this.markAt=(this.markAt+1)%this.markSize;
    }
    this.markGeom.attributes.position.needsUpdate=true;
  }
  burst(race,kind,value){
    const c=race.player,f=this.track.pose(c.d,c.lane,c.route),color=kind==='break'?0x9c7548:kind==='hit'?0xffb160:0xd4c6a9;
    for(let i=0;i<(kind==='break'?24:12);i++)this.spray.add(f.x+f.fx*2,f.y+.65,f.z+f.fz*2,(this.rng()-.5)*6,1+this.rng()*4,(this.rng()-.5)*6,color,.08+this.rng()*.2,.4+this.rng()*.6);
  }
  draw(race,dt,mode,shake,debug=false){
    this.stepTime+=dt;this.markClock-=dt;const markFrame=this.markClock<=0;
    const c=race.player,p=this.track.pose(c.d,c.lane,c.route),wet=race.wet;
    this.scenery.update(race,this.preset.range);this.sky.material.uniforms.storm.value=wet;
    this.sea.material.uniforms.time.value=race.time;this.sea.material.uniforms.wet.value=wet;
    this.scene.fog.density=.0014+wet*.0033;this.hemi.intensity=1.9-wet*.38;
    const lightning=wet>.66 && (race.time%19.7<.09||Math.abs(race.time%19.7-.26)<.044);
    const lapDistance=c.d%LENGTH,insideTunnel=c.route?0:clamp(Math.min(lapDistance-LENGTH*.54,LENGTH*.63-lapDistance)/17,0,1);
    this.hemi.intensity*=1-insideTunnel*.79;
    this.sun.intensity=(lightning?4.7:2.05-wet*1.06)*(1-insideTunnel*.94);
    this.headlamps.forEach((light,i)=>{
      const side=i?1:-1,angle=p.yaw+c.yawSlip,fx=Math.sin(angle),fz=Math.cos(angle);
      light.position.set(p.x+p.rx*side*.61+fx*1.65,p.y+.82+c.air,p.z+p.rz*side*.61+fz*1.65);
      light.target.position.set(p.x+fx*24+p.rx*side*1.3,p.y-.58+c.air,p.z+fz*24+p.rz*side*1.3);
      light.intensity=16+wet*19+insideTunnel*125;
    });
    this.tunnelLamps.forEach((light,i)=>{
      const d=Math.floor(lapDistance/30)*30+(i-1)*30;
      light.intensity=insideTunnel*94;
      if(insideTunnel){const f=this.track.frame(d);light.position.set(f.x,f.y+6.1,f.z);}
    });
    this.sun.position.set(p.x-32,p.y+49,p.z-28);this.sun.target.position.set(p.x,p.y,p.z);
    for(const car of race.cars){
      const m=this.models[car.id],f=this.track.pose(car.d,car.lane,car.route);
      const wakeSpeed=car.surface==='water'&&car.finish===null?car.v:0;
      this.roadSurfaces.wakes.value[car.id].set(f.x,f.z,f.fx*wakeSpeed,f.fz*wakeSpeed);
      const shade=this.contactShadows[car.id],groundY=this.track.rampHeight(car.d,car.lane,car.route),grade=(this.track.frame(car.d+1,car.route).y-this.track.frame(car.d-1,car.route).y)*.5;
      shade.position.set(f.x,f.y+.08+groundY,f.z);shade.rotation.y=f.yaw+car.yawSlip;shade.rotation.x=-Math.PI/2-Math.atan(grade)-(groundY>0?.17:0);shade.material.opacity=.88/(1+car.air*.27);
      m.root.visible=(car.id===0||Math.hypot(f.x-p.x,f.z-p.z)<this.preset.range*.91)&&!(car.id===0&&(mode===2||mode===3));
      if(!m.root.visible)continue;
      const onRamp=this.track.rampHeight(car.d,car.lane,car.route);
      m.root.position.set(f.x,f.y+.057+onRamp+car.air-(car.surface==='water'?.078:0),f.z);m.root.rotation.y=f.yaw+car.yawSlip;
      const slope=this.track.frame(car.d+1,car.route).y-this.track.frame(car.d-1,car.route).y;
      const left=this.track.relief(car.d,car.lane-.88,car.route),right=this.track.relief(car.d,car.lane+.88,car.route);
      m.root.rotation.order='YXZ';m.root.rotation.x=-Math.atan(slope/2);m.root.rotation.z=Math.atan((left-right)/1.76);
      m.body.rotation.set(car.pitch-(onRamp>0?.163:0),0,car.roll);
      m.body.position.y=(car.wheels[0]+car.wheels[1]+car.wheels[2]+car.wheels[3])*.22;
      for(let i=0;i<4;i++){const w=m.wheels[i];w.hub.position.y=w.r-car.wheels[i]*.48;w.hub.rotation.y=i<2?-car.steer*.33:0;w.wheel.rotation.x+=car.v*dt/w.r;}
      m.glow.visible=car.boosting;m.glow.scale.y=.8+.39*Math.sin(race.time*46);m.shield.visible=car.shield>0;m.scratches.visible=car.damage>14;m.mud.visible=car.dirt>.16||car.damage>39;
      if(car.finish!==null)continue;
      const wetRoad=car.surface==='asphalt'&&wet>.49&&car.v>12;
      if((car.sliding||wetRoad||['mud','sand','water','gravel'].includes(car.surface)||car.damage>56)&&car.v>4&&car.air<.2&&this.rng()<Math.min(1,dt*40)){
        const water=car.surface==='water'||wetRoad,smoke=car.damage>56;
        for(const side of [-1,1])this.spray.add(f.x+f.rx*side*.93-f.fx*1.45,f.y+.21,f.z+f.rz*side*.93-f.fz*1.45,
          f.rx*side*(water?2.9:1.1)-f.fx,water?3.6:1.25,-f.fz+side*f.rz*1.4,
          smoke?0x656b65:water?0xccf1ee:car.surface==='mud'?0x88704e:car.surface==='asphalt'?0xc5c5b9:0xcebd94,water?.31:.43,water?.63:.86);
      }
      if(markFrame&&car.air<.2&&car.v>6&&(car.sliding||['mud','sand'].includes(car.surface)))this.wheelMark(car,f);
    }
    if(markFrame)this.markClock=.062;
    this.spray.update(dt);
    const y=p.y+c.air+this.track.rampHeight(c.d,c.lane,c.route);
    let distance=(mode===1?5.4:8.0)+c.v*.037,height=(mode===1?2.3:3.0)+c.v*.006;
    const look=this.track.pose(c.d+12+c.v*.17,c.lane*.79,c.route);
    this.target.set(p.x-p.fx*distance+p.rx*c.yawSlip*2.4,y+height+c.pitch*.1,p.z-p.fz*distance+p.rz*c.yawSlip*2.4);
    this.aim.set(look.x,look.y+1.14+c.air*.55,look.z);
    if(mode===2||mode===3){this.target.set(p.x+p.fx*.6,y+(mode===2?1.16:1.36),p.z+p.fz*.6);this.aim.y=look.y+1.12+c.air;}
    if(mode===4){const shot=this.track.pose(Math.floor(c.d/70)*70+44,13,c.route);this.target.set(shot.x,shot.y+4.1,shot.z);this.aim.set(p.x,y+.9,p.z);}
    if(shake){const intensity=c.impact*.12+(c.boosting?.022:0);this.target.y+=Math.sin(this.stepTime*50)*intensity;}
    const snap=this.cameraMode!==mode,k=snap?1:1-Math.exp(-dt*(mode===4?5:mode>=2?18:9));
    this.camera.position.lerp(this.target,k);this.camLook.lerp(this.aim,snap?1:1-Math.exp(-dt*10));this.camera.lookAt(this.camLook);
    this.camera.fov=ease(this.camera.fov,(mode===4?47:59)+c.v*.127+(c.boosting?8:0),4,dt);this.camera.updateProjectionMatrix();this.cameraMode=mode;
    this.sky.position.copy(this.camera.position);
    this.rain.visible=wet>.31;if(this.rain.visible){
      const count=Math.floor((wet-.30)*380/.70);this.rainGeom.setDrawRange(0,count*2);this.rain.material.opacity=.13+wet*.22;
      this.rainSeed.forEach(([x,y,z],i)=>{const h=(y+24000-race.time*19)%24;this.rainPos.set([p.x+x+h*.16,p.y+h-1,p.z+z,p.x+x+h*.16+.10,p.y+h-.24,p.z+z+.12],i*6);});this.rainGeom.attributes.position.needsUpdate=true;
    }
    this.debugLine.visible=debug;if(debug){const ai=race.cars[1];for(let i=0;i<31;i++){const f=this.track.pose(ai.d+i*2,ai.lane,ai.route);this.debugPoints.set([f.x,f.y+.24,f.z],i*3);}this.debugLine.geometry.attributes.position.needsUpdate=true;}
    const grade=(this.track.frame(c.d+2,c.route).y-this.track.frame(c.d-2,c.route).y)*.25;
    this.renderer.info.reset();
    this.roadSurfaces.capture(this.renderer,this.scene,this.camera,p,grade,dt,wet,race.time);
    this.renderer.render(this.scene,this.camera);
    return this.renderer.info.render;
  }
}
