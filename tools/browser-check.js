// Run against a fresh, temporary Chrome profile. The bundled game is opened
// through its normal file entry point, including its real WebGL renderer.
import {spawn} from 'node:child_process';
import {mkdir,writeFile,mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const exe=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe';
const directory=await mkdtemp(join(tmpdir(),'wildline-check-')),output=resolve('.qa');
await mkdir(output,{recursive:true});
const chrome=spawn(exe,['--headless=new','--remote-debugging-pipe','--no-first-run','--disable-extensions','--disable-background-networking',
  '--window-size=1440,920','--force-device-scale-factor=1','--enable-unsafe-swiftshader',...(process.env.WILDLINE_NATIVE_GPU==='1'?[]:['--use-angle=swiftshader']),'--user-data-dir='+directory,'about:blank'],
  {windowsHide:true,stdio:['ignore','ignore','pipe','pipe','pipe']});
const pending=new Map(),errors=[];let seq=0,buffer='',sessionId;
chrome.stdio[4].on('data',chunk=>{
  buffer+=chunk.toString();let end;
  while((end=buffer.indexOf('\0'))>=0){
    const msg=JSON.parse(buffer.slice(0,end));buffer=buffer.slice(end+1);
    if(msg.id&&pending.has(msg.id)){const {ok,fail,timer}=pending.get(msg.id);clearTimeout(timer);pending.delete(msg.id);if(msg.error)fail(Error(msg.error.message));else ok(msg.result);}
    if(msg.method==='Runtime.exceptionThrown')errors.push(msg.params.exceptionDetails.exception?.description||msg.params.exceptionDetails.text);
    if(msg.method==='Runtime.consoleAPICalled'&&msg.params.type==='error')errors.push(msg.params.args.map(a=>a.value||a.description).join(' '));
  }
});
function call(method,params={},session=sessionId){
  const id=++seq;return new Promise((ok,fail)=>{
    const timer=setTimeout(()=>{pending.delete(id);fail(Error('Timed out: '+method));},55000);
    pending.set(id,{ok,fail,timer});chrome.stdio[3].write(JSON.stringify({id,method,params,...(session?{sessionId:session}:{})})+'\0');
  });
}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const ev=async(expression)=>{const result=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description);return result.result.value;};
async function until(expr,timeout=40000){const start=Date.now();while(Date.now()-start<timeout){if(errors.length)throw Error(errors.join('\n'));if(await ev(expr))return;await wait(100);}throw Error('UI condition failed: '+expr+'; '+errors.join('\n'));}
const click=selector=>ev('document.querySelector('+JSON.stringify(selector)+').click()');
async function key(type,code,keyName){await call('Input.dispatchKeyEvent',{type,code,key:keyName,windowsVirtualKeyCode:keyName==='Escape'?27:keyName==='F3'?114:keyName.toUpperCase().charCodeAt(0)});}
async function image(name){const {data}=await call('Page.captureScreenshot',{format:'jpeg',quality:86});await writeFile(join(output,name+'.jpg'),Buffer.from(data,'base64'));}
try{
  const target=(await call('Target.createTarget',{url:'about:blank'})).targetId;
  sessionId=(await call('Target.attachToTarget',{targetId:target,flatten:true})).sessionId;
  await call('Runtime.enable');await call('Page.enable');
  await call('Emulation.setDeviceMetricsOverride',{width:1440,height:920,deviceScaleFactor:1,mobile:false});
  await call('Page.navigate',{url:pathToFileURL(resolve('index.html')).href});await until('!!document.querySelector(".icon-button svg")');
  await image('hub');await click('[data-action=garage]');await until('document.querySelector("dialog").open');await image('garage');
  await click('[data-car="1"]');await click('[data-action=equip]');assert.equal(await ev('document.querySelector("#equipped-name").textContent'),'Strada RS');
  await click('[data-action=brief]');await until('!!document.querySelector("#brief-map")');await image('briefing');await click('#panel [data-action=close]');
  const quality=process.env.WILDLINE_QUALITY||'Medium';
  await click('[data-action=settings]');await ev('let q=document.querySelector("#quality");q.value='+JSON.stringify(quality)+';q.dispatchEvent(new Event("input",{bubbles:true}))');await click('#panel [data-action=close]');
  await click('[data-action=race]');await until('!document.querySelector("#racing").hidden');await until('document.querySelector("#countdown").hidden',85000);
  await key('keyDown','KeyW','w');await until('Number(document.querySelector("#speed").textContent)>32',45000);await image('race');
  await key('keyDown','F3','F3');await key('keyUp','F3','F3');await until('!document.querySelector("#debug").hidden');await wait(500);
  console.log(await ev('document.querySelector("#debug").textContent'));
  console.log('Renderer:',await ev('(()=>{const gl=document.querySelector("#world").getContext("webgl2"),ext=gl.getExtension("WEBGL_debug_renderer_info");return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)})()'));
  await key('keyDown','KeyC','c');await key('keyUp','KeyC','c');await key('keyUp','KeyW','w');
  await click('[data-action=pause]');await until('document.querySelector("#dialog-title").textContent==="Race paused"');
  const time=await ev('document.querySelector("#race-time").textContent');await wait(350);assert.equal(await ev('document.querySelector("#race-time").textContent'),time);
  await click('#panel [data-action=resume]');await until('document.querySelector("#race-time").textContent!== '+JSON.stringify(time));
  const checkRoad=process.argv.includes('--road-check');
  if(process.argv.includes('--full-race')||checkRoad){
    // Speed up only frame timestamps. The game still runs every physics step,
    // passes every gate, and receives throttle through the usual input handler.
    await ev('(()=>{const original=window.requestAnimationFrame.bind(window),base=performance.now();window.requestAnimationFrame=cb=>original(t=>cb(base+(t-base)*22));})()');
    await key('keyDown','KeyW','w');
    if(checkRoad){
      await key('keyDown','F3','F3');await key('keyUp','F3','F3');
      for(const [name,file] of [['Coastal highway','highway'],['Crescent beach','sand'],['Tidal crossing','crossing'],['Timber bridge','bridge'],['Basalt tunnel','tunnel'],['Storm ridge','storm'],['Redbank trail','mud']]){
        await until('document.querySelector("#sector").textContent==='+JSON.stringify(name),65000);
        await key('keyDown','KeyR','r');await key('keyUp','KeyR','r');await wait(260);await image('road-'+file);
      }
    }
    await until('document.getElementById("dialog-title").textContent==="Race complete"',200000);
    await key('keyUp','KeyW','w');await image('results');
    console.log('Three-lap UI finish:',await ev('document.querySelector(".reward-line").innerText'));
    assert.equal(await ev('document.querySelectorAll(".result-cols>div:first-child .log-row").length'),9);
    assert.equal(await ev('document.querySelectorAll(".result-cols>div:last-child .log-row").length'),4);
  }else{await click('[data-action=pause]');}
  await click('#panel [data-action=hub]');await until('!document.querySelector("#hub").hidden');
  await call('Page.reload');await until('document.querySelector("#equipped-name")?.textContent==="Strada RS"');
  await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});await wait(200);await image('mobile-hub');
  assert.equal(await ev('document.documentElement.scrollWidth<=innerWidth'),true);
  assert.deepEqual(errors,[]);console.log('Browser check passed. Hub, garage, briefing, settings, WebGL race, acceleration, telemetry, camera, pause, resume, persistence and narrow layout.');
}finally{
  try{await call('Browser.close',{},null);}catch{}
  chrome.kill();
}
