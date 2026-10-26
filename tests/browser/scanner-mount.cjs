const {chromium}=require('playwright-core'),assert=require('assert/strict'),server=require('../../server/server');
// SIMULATION: synthetic found/lost events drive ScannerCore with real DOM mounts of two dummy text-only scenes. No camera, no recognition, no user art.
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,b=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
try{const p=await b.newPage();await p.goto(base+'/index.html');await p.waitForSelector('#element-list li');
 for(const f of ['scanner-core.js','scanner-mount.js'])await p.addScriptTag({url:base+'/'+f});
 const r=await p.evaluate(async()=>{
  const mkRec=(id,txt)=>{const rec=Studio.blankExperience(id);rec.id=id;rec.target={artRect:{x:0,y:0,w:768,h:1024},natural:{w:768,h:1024}};rec.elements=[{id:'t1',type:'text',text:txt,x:.5,y:.5,w:.4,h:.1,scale:1}];return rec;};
  const recs={'scene-aaaa000':mkRec('scene-aaaa000','AAA'),'scene-bbbb000':mkRec('scene-bbbb000','BBB')};
  const scn=document.createElement('a-scene');scn.setAttribute('embedded','');scn.style.cssText='width:200px;height:200px';document.body.appendChild(scn);const box=document.createElement('a-entity');scn.appendChild(box);
  const loads=[],media=[];
  const sc=ScannerCore.create({catalog:[{name:'a',scene:'scene-aaaa000'},{name:'b',scene:'scene-bbbb000'},{name:'m',scene:'scene-miss000'}],
   loadScene:async id=>{loads.push(id);if(!recs[id])throw new Error('missing');return recs[id];},
   validate:r=>{if(!Array.isArray(r.elements))throw new Error('bad');},
   mount:async(rec)=>{const v=document.createElement('video');v.loop=true;media.push(v);document.body.appendChild(v);return ScannerMount.mountScene(rec,box,[v]);}});
  const out={};const holders=()=>[...box.querySelectorAll('[data-scanner-scene]')].map(h=>h.dataset.scannerScene);
  await sc.found('a');out.afterA=holders();
  sc.lost('a');out.lostKeeps=holders();
  await sc.found('a');out.reloadsA=loads.filter(x=>x==='scene-aaaa000').length;
  await sc.found('b');out.afterB=holders();out.mediaAfterSwitch=media.map(m=>m.isConnected);
  await sc.found('m');out.afterMissing=holders();out.state=sc.info().state;
  sc.destroy();out.afterDestroy=holders();out.mediaAfterDestroy=media.map(m=>m.isConnected);
  return out;});
 assert.deepEqual(r.afterA,['scene-aaaa000']);assert.deepEqual(r.lostKeeps,['scene-aaaa000']);assert.equal(r.reloadsA,1,'reacquire does not reload');
 assert.deepEqual(r.afterB,['scene-bbbb000'],'only one scene DOM after switch');assert.deepEqual(r.mediaAfterSwitch,[false,true],'old scene media element released, new still live');
 assert.deepEqual(r.afterMissing,[]);assert.equal(r.state,'scene-error');assert.deepEqual(r.afterDestroy,[]);assert.deepEqual(r.mediaAfterDestroy,[false,false]);
 console.log('PASS scanner-mount (SIMULATION, no camera, text-only dummy scenes, an empty <video> as media probe): one scene DOM at a time, switch removes old DOM and releases its media element, missing scene leaves nothing mounted');
}finally{await b.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exit(1)});
