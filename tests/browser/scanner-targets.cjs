const {chromium}=require('playwright-core'),assert=require('assert/strict'),server=require('../../server/server');
// Generated demo artwork (canvas noise drawn in-page), no user art. Builds tagged multi-target data; a stub XR8 receives it. Headless: proves target data shape/naming only, not recognition quality or camera behaviour.
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,b=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
try{const p=await b.newPage();await p.goto(base+'/index.html');await p.waitForSelector('#element-list li');
 for(const f of ['scanner-core.js','scanner-targets.js'])await p.addScriptTag({url:base+'/'+f});
 const r=await p.evaluate(async()=>{
  const art=(seed)=>new Promise(res=>{const c=document.createElement('canvas');c.width=768;c.height=1024;const g=c.getContext('2d');let s=seed;for(let i=0;i<400;i++){s=(s*9301+49297)%233280;g.fillStyle='hsl('+(s%360)+',70%,50%)';g.fillRect((s*7)%768,(s*13)%1024,40+s%80,40+s%60);}c.toBlob(res,'image/png');});
  const mk=async(id,seed)=>{const rec=Studio.blankExperience(id);rec.id=id;rec.assets={__artwork:await art(seed)};return rec;};
  const recs={'scene-aaaa000':await mk('scene-aaaa000',11),'scene-bbbb000':await mk('scene-bbbb000',97),'scene-noart00':Studio.blankExperience('scene-noart00')};
  const cat=ScannerCore.cleanCatalog([{name:'a',scene:'scene-aaaa000'},{name:'b',scene:'scene-bbbb000'},{name:'n',scene:'scene-noart00'},{name:'m',scene:'scene-miss000'}]).entries;
  const out=await ScannerTargets.buildTargetData(cat,async id=>{if(!recs[id])throw new Error('missing');return recs[id];});
  let cfg=null;const XR8s={XrController:{configure:o=>{cfg=o;}}};XR8s.XrController.configure({imageTargetData:out.targets});
  return {names:out.targets.map(t=>t.name),types:out.targets.map(t=>t.type),lum:out.targets.map(t=>typeof t.imagePath==='string'&&t.imagePath.startsWith('data:')),skipped:out.skipped,cfgN:cfg.imageTargetData.length,distinct:new Set(out.targets.map(t=>t.imagePath)).size};});
 assert.deepEqual(r.names,['a','b']);assert.deepEqual(r.types,['PLANAR','PLANAR']);assert.deepEqual(r.lum,[true,true]);assert.equal(r.distinct,2);assert.equal(r.cfgN,2);
 assert.deepEqual(r.skipped.map(s=>s.name),['n','m'],JSON.stringify(r.skipped));
 console.log('PASS scanner-targets (generated artwork, headless): 2 named PLANAR targets, distinct images, scene with no artwork and scene that fails to load are skipped and reported');
}finally{await b.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exit(1)});
