export const LENGTH = 6400;
export const LAPS = 3;
export const STEP = 1 / 60;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const mix = (a, b, t) => a + (b - a) * t;
export const mod = (v, n) => ((v % n) + n) % n;
export const ease = (a, b, rate, dt) => mix(a, b, 1 - Math.exp(-rate * dt));
export const clock = s => {
  if (!Number.isFinite(s)) return '—';
  const ms = Math.floor(Math.max(0, s) * 1000);
  return Math.floor(ms / 60000) + ':' + String(Math.floor(ms / 1000) % 60).padStart(2,'0') + '.' + String(ms % 1000).padStart(3,'0');
};
export function random(seed) {
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
export const VEHICLES = [
  {id:'buggy',name:'Dunefox XR',type:'Off-road buggy',color:0xee702b,mass:940,power:176,torque:310,top:161,brake:13.2,steer:1.2,grip:1.02,slide:.68,travel:.38,spring:58,damping:12,offroad:.96,nitro:1.09,durability:.84,drag:.38,pitch:85,stats:[72,89,97],desc:'Long-travel suspension and a light tube chassis carry speed across rough ground.'},
  {id:'rally',name:'Strada RS',type:'Rally car',color:0xe8e8d5,mass:1250,power:246,torque:420,top:188,brake:15.5,steer:1.08,grip:1.22,slide:.59,travel:.23,spring:79,damping:15,offroad:.77,nitro:1.04,durability:.94,drag:.29,pitch:105,stats:[97,95,73],desc:'A short wheelbase and a close-ratio transmission reward clean exits on the highway.'},
  {id:'suv',name:'Atlas ST',type:'Sports SUV',color:0x78815c,mass:1880,power:290,torque:610,top:171,brake:12.2,steer:.84,grip:1.09,slide:.74,travel:.32,spring:53,damping:10,offroad:.89,nitro:1.12,durability:1.43,drag:.42,pitch:68,stats:[83,76,90],desc:'High torque, a wide track and a reinforced body keep the Atlas planted in traffic.'}
];
export const SURFACES = {
  asphalt:{grip:1,drag:.018,rough:.012,color:0x494c47}, sand:{grip:.72,drag:.071,rough:.053,color:0xc0a273},
  mud:{grip:.58,drag:.085,rough:.080,color:0x68503c}, water:{grip:.62,drag:.12,rough:.043,color:0x4d9495},
  gravel:{grip:.83,drag:.045,rough:.06,color:0x8d806a}, timber:{grip:.86,drag:.030,rough:.025,color:0x8d7051},
  grass:{grip:.63,drag:.13,rough:.084,color:0x566539}, rock:{grip:.85,drag:.046,rough:.076,color:0x7c8073}
};
export const SECTORS = [
  [0,'Port Kauri','asphalt',7.0],[.08,'Coastal highway','asphalt',8.3],[.22,'Crescent beach','sand',8.8],
  [.31,'Tidal crossing','water',8.5],[.37,'Palm forest','gravel',6.7],[.47,'Timber bridge','timber',6.3],
  [.54,'Basalt tunnel','asphalt',6.9],[.63,'Storm ridge','asphalt',7.1],[.72,'Redbank trail','mud',7.5],
  [.83,'Cliff jump','rock',7.4],[.90,'Waterfall pass','gravel',7.7],[.96,'Harbour approach','asphalt',7.0]
].map(([start,name,surface,width],i)=>({start:start*LENGTH,name,surface,width,id:i}));
export const FORKS = [
  {id:'tidal',name:'Tidal cut',start:.205*LENGTH,end:.298*LENGTH,side:-1,surface:'water'},
  {id:'falls',name:'Falls cut',start:.891*LENGTH,end:.957*LENGTH,side:1,surface:'mud'}
];
export const DRIVERS = [
  ['I. Costa',.94,.80,0x288f91],['J. Vale',.97,.33,0xb85542],['M. Sato',.99,.78,0xe7cc6a],['A. Diallo',.90,.55,0x7785a9],
  ['R. Marin',.92,.68,0x438b70],['K. Park',.96,.85,0xc5bec3],['S. Rao',.91,.49,0xc07c43],['L. Moss',.93,.72,0x6a9094]
];
export const ABILITIES = {nitro:'Nitro charge',shield:'Impact shield',repair:'Field repair',pulse:'Pulse wave',traction:'Traction boost'};
export const CAMERAS = ['Chase','Close chase','Hood','Cockpit','Trackside'];
export const PRESETS = {Low:{ratio:.8,range:250,shadow:false},Medium:{ratio:1,range:360,shadow:false},High:{ratio:1.35,range:450,shadow:true},Ultra:{ratio:1.8,range:560,shadow:true}};
