const {chromium}=require('playwright-core'),assert=require('assert/strict'),server=require('../../server/server');
// Player-runtime parity, timeline driver in the scanner mount (kicked a-scene, headless, no engine/camera/recognition): keyframe motion advances while found, freezes while lost, resumes on found, and the driver stops when the scene is switched away (detached entity no longer moves).
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,b=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
try{const p=await (await b.newContext({viewport:{width:390,height:844}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.goto(base+'/index.html');await p.waitForSelector('#element-list li');
 for(const f of ['scanner-core.js','scanner-mount.js'])await p.addScriptTag({url:base+'/'+f});
 const r=await p.evaluate(async()=>{
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const png=()=>new Promise(res=>{const c=document.createElement('canvas');c.width=32;c.height=32;const g=c.getContext('2d');g.fillStyle='#f00';g.fillRect(0,0,32,32);c.toBlob(res,'image/png');});
  const mk=async(id,els)=>{const rec=Studio.blankExperience(id);rec.id=id;rec.target={artRect:{x:0,y:0,w:768,h:1024},natural:{w:768,h:1024}};rec.assets={i1:await png()};rec.elements=els;return rec;};
  window.__fr=0;const raf=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>{if(cb&&cb.name==='frame')window.__fr++;return raf(cb)};
  const scn=document.createElement('a-scene');scn.setAttribute('embedded','');scn.setAttribute('vr-mode-ui','enabled: false');scn.style.cssText='position:fixed;inset:0;z-index:99999';
  const cam=document.createElement('a-entity');cam.setAttribute('camera','fov: 50');cam.setAttribute('position','0 0 1.6');scn.appendChild(cam);const box=document.createElement('a-entity');scn.appendChild(box);document.body.appendChild(scn);
  const kick=()=>{try{scn.play()}catch(e){}};kick();setTimeout(kick,600);await new Promise(r=>scn.hasLoaded?r():scn.addEventListener('loaded',r,{once:true}));await sleep(500);
  const sc=ScannerCore.create({catalog:[{name:'a',scene:'scene-aaaa000'},{name:'b',scene:'scene-bbbb000'}],loadScene:async id=>id==='scene-aaaa000'?mk(id,[{id:'im',type:'image',assetId:'i1',x:0,y:0,w:.3,aspect:1,scale:1,timeline:{keys:[{t:0,x:-.3},{t:20,x:.3}]}}]):mk(id,[{id:'t1',type:'text',text:'B',x:0,y:.3,w:.4,h:.1,scale:1}]),mount:async rec=>ScannerMount.mountScene(rec,box)});
  await sc.found('a');await sleep(800);
  const ent=document.querySelector('[data-el-id="im"]');const x=()=>+ent.object3D.position.x.toFixed(4);
  const adv=async()=>{const a=x();await sleep(900);return +(x()-a).toFixed(4);};
  const o={};o.found=await adv();sc.lost('a');await sleep(300);o.lost=await adv();sc.found('a');await sleep(300);o.resumed=await adv();
  await sc.found('b');await sleep(1500);o.detached=!ent.isConnected;o.afterSwitch=await adv();const f0=window.__fr;await sleep(600);o.frameLoopsAfterSwitch=window.__fr-f0;
  return o;});
 console.log(JSON.stringify({r,errs}));
 assert(r.found>0.01,'timeline motion advances while found: '+r.found);assert.equal(r.lost,0,'frozen while lost');assert(r.resumed>0.01,'advances after resume: '+r.resumed);
 assert(r.detached&&r.afterSwitch===0,'driver stopped after switch: '+JSON.stringify(r));assert.equal(r.frameLoopsAfterSwitch,0,'no driver frame loop keeps running after the switch: '+r.frameLoopsAfterSwitch);assert.deepEqual(errs,[]);
 console.log('PASS scanner-timeline: keyframe motion plays on found, freezes on lost, resumes, stops on switch (headless; no engine/camera/recognition)');
}finally{await b.close();server.close();}})().catch(e=>{console.error(e&&e.stack||e);process.exit(1)});
