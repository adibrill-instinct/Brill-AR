const {chromium}=require('playwright-core'),assert=require('assert/strict'),server=require('../../server/server');
// Real media lifecycle through ScannerCore+ScannerMount: committed demo video/audio fixtures actually PLAY, then are paused/released on switch and destroy. Headless Chrome (autoplay flags), not a phone.
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,b=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
try{const p=await b.newPage();await p.goto(base+'/index.html');await p.waitForSelector('#element-list li');
 for(const f of ['scanner-core.js','scanner-mount.js'])await p.addScriptTag({url:base+'/'+f});
 const r=await p.evaluate(async(base)=>{
  const mkRec=(id)=>{const rec=Studio.blankExperience(id);rec.id=id;rec.target={artRect:{x:0,y:0,w:768,h:1024},natural:{w:768,h:1024}};rec.elements=[{id:'t1',type:'text',text:id,x:.5,y:.5,w:.4,h:.1,scale:1}];return rec;};
  const box=document.createElement('div');document.body.appendChild(box);const made=[];
  const mk=async(kind)=>{const m=document.createElement(kind);m.src=base+(kind==='video'?'/assets/demo/art-video.mp4':'/assets/demo/art-audio.mp3');m.muted=true;m.loop=true;document.body.appendChild(m);await m.play();made.push(m);return m;};
  const sc=ScannerCore.create({catalog:[{name:'a',scene:'scene-aaaa000'},{name:'b',scene:'scene-bbbb000'}],loadScene:async id=>mkRec(id),
   mount:async(rec)=>{const v=await mk('video'),a=await mk('audio');return ScannerMount.mountScene(rec,box,[v,a]);}});
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));const o={};
  await sc.found('a');await sleep(600);const [v1,a1]=made;o.playingA=[!v1.paused&&v1.currentTime>0,!a1.paused];
  sc.lost('a');await sleep(100);o.lostPaused=[v1.paused,a1.paused];
  await sc.found('a');await sleep(400);o.resumed=[!v1.paused,!a1.paused,made.length];
  await sc.found('b');await sleep(300);const [v2,a2]=made.slice(2);o.afterSwitch={oldGone:[!v1.isConnected,!a1.isConnected],oldNoSrc:[!v1.getAttribute('src'),!a1.getAttribute('src')],newPlaying:[!v2.paused,!a2.paused]};
  for(let i=0;i<6;i++){await sc.found(i%2?'b':'a');}await sleep(300);
  o.live=[...document.querySelectorAll('video,audio')].filter(m=>!m.paused).length;o.holders=box.querySelectorAll('[data-scanner-scene]').length;
  sc.destroy();await sleep(100);o.afterDestroy={holders:box.querySelectorAll('[data-scanner-scene]').length,media:document.querySelectorAll('video,audio').length};
  return o;},base);
 assert.deepEqual(r.playingA,[true,true],'demo video/audio really play');assert.deepEqual(r.lostPaused,[true,true]);assert.deepEqual(r.resumed.slice(0,2),[true,true]);assert.equal(r.resumed[2],2,'reacquire reuses the mount');
 assert.deepEqual(r.afterSwitch.oldGone,[true,true]);assert.deepEqual(r.afterSwitch.oldNoSrc,[true,true]);assert.deepEqual(r.afterSwitch.newPlaying,[true,true]);
 assert.equal(r.live,2,'after 6 more switches only the current scene media is playing: '+JSON.stringify(r));assert.equal(r.holders,1);assert.deepEqual(r.afterDestroy,{holders:0,media:0});
 console.log('PASS scanner-media (headless Chrome, committed demo mp4/mp3): playing, pause on lost, resume on refound, old media removed+src cleared on switch, 6 rapid switches leave only 2 playing elements, destroy leaves 0');
}finally{await b.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exit(1)});
