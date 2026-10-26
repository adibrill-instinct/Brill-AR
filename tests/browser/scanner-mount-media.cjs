const {chromium}=require('playwright-core'),assert=require('assert/strict'),server=require('../../server/server');
// ScannerMount builds media from the scene's OWN assets (committed demo mp4/mp3 as blobs), ids namespaced per scene; entities reference them; play, pause, teardown + blob revoke. Headless Chrome (autoplay flag); entities are not rendered by A-Frame here.
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,b=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
try{const p=await b.newPage();await p.goto(base+'/index.html');await p.waitForSelector('#element-list li');
 for(const f of ['scanner-core.js','scanner-mount.js'])await p.addScriptTag({url:base+'/'+f});
 const r=await p.evaluate(async(base)=>{
  const vb=await (await fetch(base+'/assets/demo/art-video.mp4')).blob(),ab=await (await fetch(base+'/assets/demo/art-audio.mp3')).blob();
  const mkRec=(id)=>{const rec=Studio.blankExperience(id);rec.id=id;rec.target={artRect:{x:0,y:0,w:768,h:1024},natural:{w:768,h:1024}};
   rec.assets={v1:vb,s1:ab};rec.elements=[{id:'vid',type:'video',assetId:'v1',x:0,y:0,w:.5,aspect:1,scale:1},{id:'snd',type:'sound',assetId:'s1',x:0,y:0,w:.1,scale:1}];return rec;};
  const revoked=[];const orig=URL.revokeObjectURL;URL.revokeObjectURL=u=>{revoked.push(u);return orig.call(URL,u);};
  const box=document.createElement('div');document.body.appendChild(box);const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const sc=ScannerCore.create({catalog:[{name:'a',scene:'scene-aaaa000'},{name:'b',scene:'scene-bbbb000'}],loadScene:async id=>mkRec(id),mount:async rec=>ScannerMount.mountScene(rec,box)});
  const o={};await sc.found('a');
  const ms=[...document.querySelectorAll('[data-scanner-media="scene-aaaa000"] video, [data-scanner-media="scene-aaaa000"] audio')];
  o.ids=ms.map(m=>m.id);o.refs=[...box.querySelectorAll('[data-scanner-scene] *')].map(e=>(e.getAttribute('studio-target-video')||'')+(e.getAttribute('src')||'')).filter(Boolean);
  for(const m of ms){m.muted=true;await m.play();}await sleep(500);o.playing=ms.map(m=>!m.paused&&m.currentTime>0);
  sc.lost('a');await sleep(100);o.paused=ms.map(m=>m.paused);
  await sc.found('b');await sleep(200);o.aGone=[!box.querySelector('[data-scanner-media="scene-aaaa000"]'),!ms[0].isConnected];o.bIds=[...box.querySelectorAll('[data-scanner-media="scene-bbbb000"] video, [data-scanner-media="scene-bbbb000"] audio')].map(m=>m.id);o.revokedAfterSwitch=revoked.length;
  sc.destroy();await sleep(100);o.after={media:box.querySelectorAll('[data-scanner-media]').length,holders:box.children.length,revoked:revoked.length};return o;},base);
assert.deepEqual(r.ids,['m-scene-aaaa000-vid','m-scene-aaaa000-snd']);assert(r.refs.some(x=>x.includes('#m-scene-aaaa000-vid')),'entity references the namespaced video id: '+JSON.stringify(r.refs));
 assert.deepEqual(r.playing,[true,true]);assert.deepEqual(r.paused,[true,true]);assert.deepEqual(r.aGone,[true,true]);assert.deepEqual(r.bIds,['m-scene-bbbb000-vid','m-scene-bbbb000-snd']);assert.equal(r.revokedAfterSwitch,2,'scene A blob URLs revoked');
 assert.deepEqual(r.after,{media:0,holders:0,revoked:4});
 console.log('PASS scanner-mount-media: media built from scene assets, namespaced ids referenced by the entity, play/pause, switch removes A media + revokes its 2 blob URLs, destroy leaves nothing and revokes 4 total');
}finally{await b.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exit(1)});
