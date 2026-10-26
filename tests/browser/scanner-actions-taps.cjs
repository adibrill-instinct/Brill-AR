const {chromium}=require('playwright-core'),assert=require('assert/strict'),server=require('../../server/server');
// Player-runtime parity, step 2: parallel tracks and states (sequences) in the scanner mount (kicked a-scene, headless, no engine/camera/recognition). Track autostarts but stays paused until found; motion freezes on lost and resumes; state visibility follows the current state; autoNext advances the state; switching the scene away stops every driver and timer.
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,b=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
try{const p=await (await b.newContext({viewport:{width:390,height:844}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.goto(base+'/index.html');await p.waitForSelector('#element-list li');
 for(const f of ['scanner-core.js','scanner-mount.js'])await p.addScriptTag({url:base+'/'+f});
 const r=await p.evaluate(async()=>{
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const png=()=>new Promise(res=>{const c=document.createElement('canvas');c.width=32;c.height=32;const g=c.getContext('2d');g.fillStyle='#f00';g.fillRect(0,0,32,32);c.toBlob(res,'image/png');});
  const aud=await (await fetch('/assets/demo/art-audio.mp3')).blob();
  const mk=async(id)=>{const rec=Studio.blankExperience(id);rec.id=id;rec.target={artRect:{x:0,y:0,w:768,h:1024},natural:{w:768,h:1024}};rec.assets={i1:await png(),s1:aud};
   rec.sequences=[{id:'s1',name:'A'},{id:'s2',name:'B'}];
   rec.actionSequences=[{id:'act',name:'act',duration:10,autoStart:true,loop:true,reset:true,actions:[{id:'mv',layerId:'ac',type:'move',start:0,duration:10,ease:'linear',to:{x:.5,y:0,z:0}}]},{id:'byTap',name:'byTap',duration:10,autoStart:false,loop:false,reset:true,actions:[{id:'mv2',layerId:'bt',type:'move',start:0,duration:10,ease:'linear',to:{x:.4,y:0,z:0}}]}];
   const im=(eid,extra)=>({id:eid,type:'image',assetId:'i1',x:0,y:0,w:.2,aspect:1,scale:1,...extra});
   rec.elements=[im('nx',{onTap:'sequence',x:-.4,y:-.3}),im('mu',{onTap:'mute',x:.4,y:-.3}),im('ac',{x:-.3,y:.3}),im('bt',{x:-.3,y:.1,onTap:'action:byTap'}),{id:'snd',type:'sound',assetId:'s1',seq:'s2',x:0,y:0,w:.1,scale:1}];return rec;};
  window.__fr=0;const raf=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>{if(cb&&cb.name==='frame')window.__fr++;return raf(cb)};
  window.__as=0;const oas=Studio.applySequence;Studio.applySequence=function(){window.__as++;return oas.apply(Studio,arguments)};
  const scn=document.createElement('a-scene');scn.setAttribute('embedded','');scn.setAttribute('vr-mode-ui','enabled: false');scn.style.cssText='position:fixed;inset:0;z-index:99999';
  const cam=document.createElement('a-entity');cam.setAttribute('camera','fov: 50');cam.setAttribute('position','0 0 1.6');scn.appendChild(cam);const box=document.createElement('a-entity');scn.appendChild(box);document.body.appendChild(scn);
  const kick=()=>{try{scn.play()}catch(e){}};kick();setTimeout(kick,600);await new Promise(r=>scn.hasLoaded?r():scn.addEventListener('loaded',r,{once:true}));await sleep(500);
  window.__h={};const sc=ScannerCore.create({catalog:[{name:'a',scene:'scene-aaaa000'},{name:'d',scene:'scene-dddd000'}],loadScene:async id=>id==='scene-dddd000'?(()=>{const r=Studio.blankExperience(id);r.id=id;r.target={artRect:{x:0,y:0,w:768,h:1024},natural:{w:768,h:1024}};r.elements=[{id:'t1',type:'text',text:'D',x:0,y:0,w:.3,h:.1,scale:1}];return r;})():mk(id),mount:async rec=>{const h=await ScannerMount.mountScene(rec,box);window.__h[rec.id]=h;return h;}});
  const o={};await sc.found('a');await sleep(800);
  const q=id=>document.querySelector('[data-el-id="'+id+'"]');const px=id=>+q(id).object3D.position.x.toFixed(4);const h=window.__h['scene-aaaa000'];
  const click=id=>q(id).dispatchEvent(new Event('click'));
  const snd=()=>document.querySelector('audio[id$="-snd"]');
  // action driver
  const a0=px('ac');await sleep(900);o.actionFound=+(px('ac')-a0).toFixed(4);
  sc.lost('a');await sleep(300);const a1=px('ac');await sleep(700);o.actionLost=+(px('ac')-a1).toFixed(4);
  sc.found('a');await sleep(300);const a2=px('ac');await sleep(700);o.actionResumed=+(px('ac')-a2).toFixed(4);
  // tap-started action sequence
  const b0=px('bt');await sleep(500);o.tapActionBefore=+(px('bt')-b0).toFixed(4);click('bt');await sleep(300);const b1=px('bt');await sleep(700);o.tapActionAfter=+(px('bt')-b1).toFixed(4);
  // state-driven media: audio belongs to s2 only
  o.sndBlockedS1=!!(snd()&&snd()._studioBlocked);o.sndPausedS1=snd()?snd().paused:null;
  click('nx');await sleep(500);o.seqAfterTap=h.state().seq;
  window.dispatchEvent(new Event('pointerdown'));await sleep(600);
  o.sndBlockedS2=!!(snd()&&snd()._studioBlocked);o.sndPlayingS2=snd()?!snd().paused:null;
  click('nx');await sleep(600);o.seqWrap=h.state().seq;o.sndPausedBack=snd()?snd().paused:null;
  // mute
  o.muted0=h.state().muted;click('mu');o.muted1=h.state().muted;click('mu');o.muted2=h.state().muted;
  // teardown
  await sc.found('d');await sleep(500);const f0=window.__fr;await sleep(600);o.loopsAfterSwitch=window.__fr-f0;
  o.audioNodesLeft=document.querySelectorAll('audio').length;o.listenerHandlers=0;
  return o;});
 console.log(JSON.stringify({r,errs}));
 assert(r.actionFound>0.01,'action advances while found: '+r.actionFound);assert.equal(r.actionLost,0,'action frozen while lost');assert(r.actionResumed>0.01,'action resumes');
 assert.equal(r.tapActionBefore,0,'tap-only action idle before the tap');assert(r.tapActionAfter>0.01,'tap on element starts the action sequence: '+r.tapActionAfter);
 assert.equal(r.sndBlockedS1,true,'sound of state s2 is blocked while s1 is current');assert.equal(r.sndPausedS1,true);
 assert.equal(r.seqAfterTap,'s2','tap on a next-state element advances the state');assert.equal(r.sndBlockedS2,false);assert.equal(r.sndPlayingS2,true,'state s2 audio plays after the first tap (audio unlock)');
 assert.equal(r.seqWrap,'s1');assert.equal(r.sndPausedBack,true,'leaving s2 pauses its sound');
 assert.deepEqual([r.muted0,r.muted1,r.muted2],[false,true,false],'mute tap toggles');
 assert.equal(r.loopsAfterSwitch,0,'no action/monitor driver frame loop after switching to a scene without them: '+r.loopsAfterSwitch);assert.equal(r.audioNodesLeft,0,'audio elements released');
 console.log('PASS scanner-actions-taps: action driver freeze/resume, tap actions, next-state tap, state media blocking + audio unlock, mute, teardown (headless; no engine/camera/recognition)');
}finally{await b.close();server.close();}})().catch(e=>{console.error(e&&e.stack||e);process.exit(1)});
