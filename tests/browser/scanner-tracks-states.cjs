const {chromium}=require('playwright-core'),assert=require('assert/strict'),server=require('../../server/server');
// Player-runtime parity, step 2: parallel tracks and states (sequences) in the scanner mount (kicked a-scene, headless, no engine/camera/recognition). Track autostarts but stays paused until found; motion freezes on lost and resumes; state visibility follows the current state; autoNext advances the state; switching the scene away stops every driver and timer.
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,b=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
try{const p=await (await b.newContext({viewport:{width:390,height:844}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.goto(base+'/index.html');await p.waitForSelector('#element-list li');
 for(const f of ['scanner-core.js','scanner-mount.js'])await p.addScriptTag({url:base+'/'+f});
 const r=await p.evaluate(async()=>{
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const png=()=>new Promise(res=>{const c=document.createElement('canvas');c.width=32;c.height=32;const g=c.getContext('2d');g.fillStyle='#f00';g.fillRect(0,0,32,32);c.toBlob(res,'image/png');});
  const mk=async(id,autoAt)=>{const rec=Studio.blankExperience(id);rec.id=id;rec.target={artRect:{x:0,y:0,w:768,h:1024},natural:{w:768,h:1024}};rec.assets={i1:await png()};
   rec.sequences=[{id:'s1',name:'A',...(autoAt?{autoNext:{at:autoAt,to:'s2'}}:{})},{id:'s2',name:'B'}];rec.tracks=[{id:'t1',name:'T',autoStart:true}];
   const im=(eid,extra)=>({id:eid,type:'image',assetId:'i1',x:0,y:0,w:.2,aspect:1,scale:1,...extra});
   rec.elements=[im('e1',{seq:'s1',x:-.3}),im('e2',{seq:'s2',x:.3}),im('tk',{track:'t1',y:.3,timeline:{keys:[{t:0,x:-.3},{t:20,x:.3}]}})];return rec;};
  window.__fr=0;const raf=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>{if(cb&&cb.name==='frame')window.__fr++;return raf(cb)};
  window.__as=0;const oas=Studio.applySequence;Studio.applySequence=function(){window.__as++;return oas.apply(Studio,arguments)};
  const scn=document.createElement('a-scene');scn.setAttribute('embedded','');scn.setAttribute('vr-mode-ui','enabled: false');scn.style.cssText='position:fixed;inset:0;z-index:99999';
  const cam=document.createElement('a-entity');cam.setAttribute('camera','fov: 50');cam.setAttribute('position','0 0 1.6');scn.appendChild(cam);const box=document.createElement('a-entity');scn.appendChild(box);document.body.appendChild(scn);
  const kick=()=>{try{scn.play()}catch(e){}};kick();setTimeout(kick,600);await new Promise(r=>scn.hasLoaded?r():scn.addEventListener('loaded',r,{once:true}));await sleep(500);
  window.__h={};const sc=ScannerCore.create({catalog:[{name:'a',scene:'scene-aaaa000'},{name:'b',scene:'scene-bbbb000'},{name:'c',scene:'scene-cccc000'},{name:'d',scene:'scene-dddd000'}],loadScene:async id=>id==='scene-dddd000'?(()=>{const r=Studio.blankExperience(id);r.id=id;r.target={artRect:{x:0,y:0,w:768,h:1024},natural:{w:768,h:1024}};r.elements=[{id:'t1',type:'text',text:'D',x:0,y:0,w:.3,h:.1,scale:1}];return r;})():mk(id,id==='scene-cccc000'?1:(id==='scene-aaaa000'?2.2:0)),mount:async rec=>{const h=await ScannerMount.mountScene(rec,box);window.__h[rec.id]=h;return h;}});
  const o={};await sc.found('a');await sleep(700);
  const q=id=>document.querySelector('[data-el-id="'+id+'"]');const x=()=>+q('tk').object3D.position.x.toFixed(4);const vis=id=>q(id).object3D.visible;
  const h=window.__h['scene-aaaa000'];
  o.state0=h.state();o.vis0={e1:vis('e1'),e2:vis('e2'),tk:vis('tk')};
  const adv=async()=>{const a=x();await sleep(900);return +(x()-a).toFixed(4);};
  o.trackFound=await adv();sc.lost('a');await sleep(300);o.trackLost=await adv();sc.found('a');await sleep(300);o.trackResumed=await adv();
  await sleep(1500);o.stateAfterAuto=h.state().seq;o.visAuto={e1:vis('e1'),e2:vis('e2')};
  h.setSequence('s1');o.manual={seq:h.state().seq,e1:vis('e1'),e2:vis('e2')};
  // teardown: scene c has autoNext at 1s; switch away before it fires
  await sc.found('c');await sleep(300);const as0=()=>window.__as;await sc.found('b');await sleep(300);const a1=window.__as;await sleep(1800);o.applyAfterSwitch=window.__as-a1;
  await sc.found('d');await sleep(500);const f0=window.__fr;await sleep(600);o.frameLoopsAfterSwitch=window.__fr-f0;
  return o;});
 console.log(JSON.stringify({r,errs}));
 assert.equal(r.state0.seq,'s1');assert.deepEqual(r.vis0,{e1:true,e2:false,tk:true},'state s1 shows e1 only; autostart track element visible');assert.deepEqual(r.state0.tracks,[['t1',true]]);
 assert(r.trackFound>0.01,'track motion advances while found: '+r.trackFound);assert.equal(r.trackLost,0,'track frozen while lost');assert(r.trackResumed>0.01,'track resumes: '+r.trackResumed);
 assert.equal(r.stateAfterAuto,'s2','autoNext advanced to s2');assert.deepEqual(r.visAuto,{e1:false,e2:true});assert.deepEqual(r.manual,{seq:'s1',e1:true,e2:false});
 assert.equal(r.applyAfterSwitch,0,'no state timer fires after the scene is switched away: '+r.applyAfterSwitch);assert.equal(r.frameLoopsAfterSwitch,0,'no track/timeline driver frame loop once a scene without motion is current (all earlier scenes torn down): '+r.frameLoopsAfterSwitch);assert.deepEqual(errs,[]);
 console.log('PASS scanner-tracks-states: track autostart/freeze/resume, state visibility, autoNext, full teardown (headless; no engine/camera/recognition)');
}finally{await b.close();server.close();}})().catch(e=>{console.error(e&&e.stack||e);process.exit(1)});
