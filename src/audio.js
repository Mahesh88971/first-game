import {clamp} from './config.js';

export class MotorAudio {
  constructor(){this.ctx=null;this.volume=.65;this.lastGear=1;}
  async unlock(){
    if(!this.ctx){
      const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;
      this.ctx=new Audio();const c=this.ctx;
      this.master=c.createGain();this.master.gain.value=0;this.master.connect(c.destination);
      const filter=c.createBiquadFilter();filter.type='lowpass';filter.frequency.value=510;
      this.engineGain=c.createGain();this.engineGain.gain.value=.1;filter.connect(this.engineGain).connect(this.master);
      this.engine=c.createOscillator();this.engine.type='sawtooth';this.engine.frequency.value=41;this.engine.connect(filter);this.engine.start();
      this.harmonic=c.createOscillator();this.harmonic.type='triangle';this.harmonic.frequency.value=83;this.harmonic.connect(filter);this.harmonic.start();
      const buf=c.createBuffer(1,c.sampleRate*2,c.sampleRate),data=buf.getChannelData(0);
      for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
      this.noiseBuffer=buf;const noise=c.createBufferSource();noise.buffer=buf;noise.loop=true;
      this.surface=c.createBiquadFilter();this.surface.type='bandpass';this.surface.Q.value=.6;this.surface.frequency.value=1200;
      this.surfaceGain=c.createGain();this.surfaceGain.gain.value=0;noise.connect(this.surface).connect(this.surfaceGain).connect(this.master);noise.start();
      this.aiGain=c.createGain();this.aiGain.gain.value=0;
      this.aiPan=c.createStereoPanner();this.aiGain.connect(this.aiPan).connect(this.master);
      this.ai=c.createOscillator();this.ai.type='triangle';this.ai.connect(this.aiGain);this.ai.start();
      this.squeal=c.createOscillator();this.squeal.type='sine';this.squealGain=c.createGain();this.squealGain.gain.value=0;this.squeal.connect(this.squealGain).connect(this.master);this.squeal.start();
      this.filter=filter;
    }
    if(this.ctx.state==='suspended')await this.ctx.resume();
  }
  active(on){if(this.ctx)this.master.gain.setTargetAtTime(on?this.volume*.57:0,this.ctx.currentTime,.045);}
  pulse(freq,length=.12,type='sine',gain=.18){
    if(!this.ctx)return;const c=this.ctx,t=c.currentTime,osc=c.createOscillator(),amp=c.createGain();
    osc.type=type;osc.frequency.setValueAtTime(freq,t);osc.frequency.exponentialRampToValueAtTime(Math.max(25,freq*.62),t+length);
    amp.gain.setValueAtTime(gain,t);amp.gain.exponentialRampToValueAtTime(.0001,t+length);osc.connect(amp).connect(this.master);osc.start(t);osc.stop(t+length+.01);
    osc.onended=()=>{osc.disconnect();amp.disconnect();};
  }
  event(kind){
    if(['hit','break','land','thunder'].includes(kind)){
      this.pulse(kind==='thunder'?58:114,kind==='thunder'?.93:.20,'triangle',.42);
      if(!this.ctx)return;const c=this.ctx,buf=c.createBufferSource(),gain=c.createGain(),filter=c.createBiquadFilter(),length=kind==='thunder'?1.2:.21;
      buf.buffer=this.noiseBuffer;filter.type='lowpass';filter.frequency.value=kind==='break'?2700:690;
      gain.gain.value=.29;gain.gain.exponentialRampToValueAtTime(.001,c.currentTime+length);buf.connect(filter).connect(gain).connect(this.master);buf.start();buf.stop(c.currentTime+length);
      buf.onended=()=>{buf.disconnect();filter.disconnect();gain.disconnect();};
    }else if(kind==='pickup'||kind==='ability'||kind==='lap')this.pulse(kind==='lap'?760:573,.18,'sine',.21);
  }
  update(race,throttle){
    if(!this.ctx)return;const c=race.player,t=this.ctx.currentTime,target=(param,v,s=.06)=>param.setTargetAtTime(v,t,s);
    const freq=c.tune.pitch*.39+c.rpm*c.tune.pitch/7300;
    target(this.engine.frequency,freq);target(this.harmonic.frequency,freq*(c.tune.id==='suv'?1.51:2.01));
    target(this.filter.frequency,330+throttle*660+c.rpm*.12+(c.boosting?510:0));
    target(this.engineGain.gain,.05+throttle*.068);target(this.surface.frequency,c.surface==='water'?2050:c.surface==='asphalt'?1640:830);
    target(this.surfaceGain.gain,race.wet*.059+c.v*.00065+(c.surface==='asphalt'?0:.065)*Math.min(1,c.v/12)+(c.boosting?.1:0));
    target(this.squeal.frequency,550+145*Math.abs(c.steer)+c.v*1.2);target(this.squealGain.gain,c.sliding&&c.surface==='asphalt'?.040:0);
    if(this.lastGear!==c.gear&&c.v>4)this.pulse(85,.079,'triangle',.16);this.lastGear=c.gear;
    let nearest=null,gap=45;for(const rival of race.cars.slice(1)){
      const d=Math.abs(rival.d-c.d);if(d<gap&&rival.route===c.route){nearest=rival;gap=d;}
    }
    target(this.aiGain.gain,nearest?.055*(1-gap/45):0);
    if(nearest){target(this.ai.frequency,42+nearest.rpm*.019);target(this.aiPan.pan,clamp((nearest.lane-c.lane)/7,-1,1));}
  }
}
