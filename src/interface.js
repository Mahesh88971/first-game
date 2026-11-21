import {LENGTH,SECTORS} from './config.js';
const paths={
  coin:'<path d="m12 2 8.5 5v10L12 22l-8.5-5V7z"/><path d="M15 8.8a4.1 4.1 0 1 0 0 6.4"/>',
  settings:'<path d="m10 2-.7 2.5-2 .9-2.4-.8-2 3.4 1.8 1.9-.2 2.1L2.8 14l2 3.5 2.6-.6 1.8 1.2.6 2.4h4l.7-2.4 1.9-1.2 2.4.6 2-3.4-1.7-2 .1-2.1 1.6-1.9-2-3.4-2.5.7-1.8-1L13.8 2z"/><circle cx="12" cy="11.5" r="3.1"/>',
  gamepad:'<path d="M8 6h8c3.4 0 5.5 5.6 5.5 9.3 0 3.4-2.1 4.2-4.3 2.3L15 15H9l-2.2 2.6c-2.2 1.9-4.3 1.1-4.3-2.3C2.5 11.6 4.6 6 8 6Z"/><path d="M6 10.5h5m-2.5-2.4v4.8m6.5-2.9h.1m3 2h.1"/>',
  pin:'<path d="M19.5 9.5C19.5 15.1 12 21 12 21S4.5 15.1 4.5 9.5a7.5 7.5 0 0 1 15 0Z"/><circle cx="12" cy="9" r="2.5"/>',
  flag:'<path d="M4 21V3m0 1c5-3 9 4 16 0l-1 10c-5 3-10-3-15-1"/><path d="M8 4v4m4-3v4m4-3v4M5 8c5-2 9 4 14 1"/>',
  map:'<path d="m2 5 6-2 8 3 6-2v15l-6 2-8-3-6 2zM8 3v15m8-12v15"/>',
  arrow:'<path d="M4 12h15m-6-6 6 6-6 6"/>',storm:'<path d="M5 14a4.5 4.5 0 1 1 1-8 6 6 0 0 1 11.5 1A3.7 3.7 0 0 1 19 14h-2M11 12l-3 5h4l-2 5m7-5-1 2"/>',
  car:'<path d="m3 11 2-1 2-5h10l3 5 1 1v7h-3m-12 0H3v-7Zm3 0h12"/><circle cx="7" cy="16" r="2"/><circle cx="17" cy="16" r="2"/><path d="M9 17h6"/>',
  route:'<circle cx="5" cy="18" r="2.5"/><circle cx="19" cy="5" r="2.5"/><path d="M7.5 18h7a3.5 3.5 0 0 0 0-7h-5a3 3 0 0 1 0-6h7"/>',
  sliders:'<path d="M3 6h7m4 0h7M3 12h2m4 0h12M3 18h11m4 0h3"/><circle cx="12" cy="6" r="2"/><circle cx="7" cy="12" r="2"/><circle cx="16" cy="18" r="2"/>',
  wrench:'<path d="M14 5a6 6 0 0 0-7 7L2.7 17a2.3 2.3 0 0 0 3.3 3l4.5-4.8a6 6 0 0 0 7.2-8l-3.6 3.5-2.2-2.4z"/>',
  pause:'<path d="M8 4v16m8-16v16" stroke-width="4"/>',x:'<path d="m5 5 14 14M19 5 5 19"/>',check:'<path d="m3 12 6 6 12-13"/>'
};
export function icons(root=document){
  for(const node of root.querySelectorAll('[data-icon]'))node.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.65" aria-hidden="true">'+(paths[node.dataset.icon]||'')+'</svg>';
}
const sampled=new WeakMap();
export function drawMap(canvas,track,variant='brief',race=null){
  const box=canvas.getBoundingClientRect();if(!box.width||!box.height)return;
  const ratio=Math.min(window.devicePixelRatio||1,2),w=box.width,h=box.height;
  if(canvas.width!==Math.round(w*ratio)||canvas.height!==Math.round(h*ratio)){canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);}
  const ctx=canvas.getContext('2d');ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,w,h);
  const hub=variant==='hub',mini=variant==='mini';
  if(!mini){
    ctx.strokeStyle='#b6c6a813';ctx.lineWidth=.8;
    for(let j=-6;j<26;j++){ctx.beginPath();for(let i=-2;i<=w+2;i+=4){const y=j*10+9*Math.sin(i*.019+j*.19)+5*Math.sin(i*.035-j*.38)+7*Math.sin(j*.33+i*.009);if(i===-2)ctx.moveTo(i,y);else ctx.lineTo(i,y);}ctx.stroke();}
  }
  let shape=sampled.get(track);
  if(!shape){
    const points=Array.from({length:261},(_,i)=>track.frame(i/260*LENGTH));
    const rotate=f=>[f.x*.94+f.z*.34,-f.z*.94+f.x*.34];
    const pts=points.map(rotate),xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);
    shape={pts,rotate,x1:Math.min(...xs),x2:Math.max(...xs),y1:Math.min(...ys),y2:Math.max(...ys)};sampled.set(track,shape);
  }
  const width=hub?w*.55:w*.85,height=h*(hub?.75:.83),scale=Math.min(width/(shape.x2-shape.x1),height/(shape.y2-shape.y1));
  const pos=([x,y])=>[(x-(shape.x1+shape.x2)/2)*scale+w*(hub?.73:.5),(y-(shape.y1+shape.y2)/2)*scale+h*.5];
  const line=(pts,color,size)=>{ctx.beginPath();pts.forEach((p,i)=>{const [x,y]=pos(p);if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);});ctx.strokeStyle=color;ctx.lineWidth=size;ctx.lineJoin='round';ctx.lineCap='round';ctx.stroke();};
  line(shape.pts,'#142018',mini?4:7);line(shape.pts,mini?'#bac8b1':'#e4e5c9',mini?1.8:2.7);
  for(const f of track.forks){const pts=Array.from({length:18},(_,i)=>shape.rotate(track.frame(f.start+(f.end-f.start)*i/17,f)));ctx.setLineDash([2,2]);line(pts,'#ee995d',1.9);ctx.setLineDash([]);}
  const dot=(f,color,r)=>{const [x,y]=pos(shape.rotate(f));ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();ctx.strokeStyle='#263129';ctx.lineWidth=1.2;ctx.stroke();};
  if(race){for(const c of race.cars.slice(1))dot(track.pose(c.d,c.lane,c.route),'#e3d6c0',2.1);dot(track.pose(race.player.d,race.player.lane,race.player.route),'#ff8949',3.6);}
  else{dot(track.frame(0),'#ff8a49',4.6);if(!hub){const [x,y]=pos(shape.pts[0]);ctx.font='10px Consolas,monospace';ctx.fillStyle='#e7e7cd';ctx.fillText('GRID',x+7,y+3);}}
}
export const controlsHTML=()=>'<div class="controls-grid">'+[
  ['Accelerate','W / ↑'],['Brake','S / ↓'],['Steer','A D / ← →'],['Handbrake drift','Space + steer'],['Spend boost','Shift'],['Use ability','E'],['Cycle camera','C'],['Pause / resume','Esc'],['Recover to road','R'],['Telemetry','F3']
].map(([a,b])=>'<div><span>'+a+'</span><kbd>'+b+'</kbd></div>').join('')+'</div>';
export function briefingHTML(){return '<canvas id="brief-map" class="brief-map" aria-label="Main circuit and shortcuts"></canvas><div class="brief-row"><strong>Breakwater Circuit</strong><span>6.4 km · 3 laps · 9 drivers</span></div><div class="brief-sectors">'+SECTORS.map((s,i)=>'<span><b>'+String(i+1).padStart(2,'0')+'</b>'+s.name+'</span>').join('')+'</div><p class="dialog-copy">Take the left side at the Tidal Cut board to cross the flats. At Waterfall Pass, enter on the right for the shorter mud channel. Both routes rejoin the circuit.</p><p class="dialog-copy">Mint strips supply abilities and boost. The green harbour service strip repairs body damage each lap.</p>';}
