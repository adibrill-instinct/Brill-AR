const {chromium}=require('playwright-core'),assert=require('assert/strict'),server=require('../../server/server');
// Model lifecycle in the scanner mount, REAL kicked a-scene (headless SwiftShader, 390x844, no engine, no camera, no recognition): a glb model element (committed library/gem.glb) loads its mesh through buildElementEntity, is VISIBLE on the canvas (pixels differ from the empty scene), is hidden after lost, resumes, and is gone after a switch to another scene.
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,b=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
try{const p=await (await b.newContext({viewport:{width:390,height:844}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.goto(base+'/index.html');await p.waitForSelector('#element-list li');
 for(const f of ['scanner-core.js','scanner-mount.js'])await p.addScriptTag({url:base+'/'+f});
 const o=await p.evaluate(async(base)=>{
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const glb=await (await fetch(base+'/library/gem.glb')).blob();
  const mk=(id,els,assets)=>{const rec=Studio.blankExperience(id);rec.id=id;rec.target={artRect:{x:0,y:0,w:768,h:1024},natural:{w:768,h:1024}};rec.assets=assets||{};rec.elements=els;return rec;};
  const scn=document.createElement('a-scene');window.HTMLElement.prototype.setAttribute.call(scn,'gltf-model','dracoDecoderPath: '+Studio.DECODER_DRACO_PATH+'; meshoptDecoderPath: '+Studio.DECODER_MESHOPT_PATH);
  scn.setAttribute('embedded','');scn.setAttribute('vr-mode-ui','enabled: false');scn.style.cssText='position:fixed;inset:0;z-index:99999';
  const cam=document.createElement('a-entity');cam.setAttribute('camera','fov: 50');cam.setAttribute('position','0 0 1.6');scn.appendChild(cam);const box=window.__box=document.createElement('a-entity');scn.appendChild(box);document.body.appendChild(scn);
  const kick=()=>{try{scn.play()}catch(e){}};kick();setTimeout(kick,600);await new Promise(r=>scn.hasLoaded?r():scn.addEventListener('loaded',r,{once:true}));await sleep(500);
  window.__sc=ScannerCore.create({catalog:[{name:'a',scene:'scene-aaaa000'},{name:'b',scene:'scene-bbbb000'}],loadScene:async id=>id==='scene-aaaa000'?mk(id,[{id:'m1',type:'model',assetId:'g1',x:0,y:0,w:.5,aspect:1,scale:1,modelPlaying:true}],{g1:glb}):mk(id,[{id:'t1',type:'text',text:'BBB',x:0,y:.3,w:.6,h:.12,scale:1}]),mount:async rec=>ScannerMount.mountScene(rec,box)});
  return {};},base);
 const shot=async()=>(await p.screenshot());
 const diff=async(a,bb)=>p.evaluate(async([x,y])=>{const ld=async d=>{const im=new Image();im.src='data:image/png;base64,'+d;await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const g=c.getContext('2d');g.drawImage(im,0,0);return g.getImageData(0,0,c.width,c.height).data};const A=await ld(x),B=await ld(y);let n=0;for(let i=0;i<A.length;i+=4)if(Math.abs(A[i]-B[i])+Math.abs(A[i+1]-B[i+1])+Math.abs(A[i+2]-B[i+2])>60)n++;return n},[a.toString('base64'),bb.toString('base64')]);
 const empty=await shot();
 await p.evaluate(()=>window.__sc.found('a'));let info;for(let i=0;i<40;i++){await p.waitForTimeout(250);info=await p.evaluate(()=>{const e=document.querySelector('[data-el-id="m1"]');const inner=e&&e.querySelector('[gltf-model]');return {ent:!!e,mesh:!!(inner&&inner.getObject3D('mesh')),clips:!!(inner&&inner.components['model-clips'])}});if(info.mesh)break;}
 await p.waitForTimeout(800);
 assert(info.ent&&info.mesh,'model entity built and mesh loaded: '+JSON.stringify(info));assert(info.clips,'model-clips component attached');
 const shown=await shot();require('fs').writeFileSync('/downloads/scanner-render-model-'+Date.now()+'.png',shown);const dShown=await diff(empty,shown);
 await p.evaluate(()=>window.__sc.lost('a'));await p.waitForTimeout(800);const hidden=await shot();const dHidden=await diff(empty,hidden);
 await p.evaluate(()=>window.__sc.found('a'));await p.waitForTimeout(1200);const back=await shot();const dBack=await diff(empty,back);
 await p.evaluate(()=>window.__sc.found('b'));await p.waitForTimeout(2500);
 const after=await p.evaluate(()=>({models:document.querySelectorAll('[data-el-id="m1"]').length,holders:[...document.querySelectorAll('[data-scanner-scene]')].map(h=>h.dataset.scannerScene)}));
 console.log(JSON.stringify({dShown,dHidden,dBack,after,errs}));
 assert(dShown>3000,'model visible on canvas: '+dShown);assert(dHidden<500,'model hidden after lost: '+dHidden);assert(dBack>3000,'model visible again on resume: '+dBack);
 assert.deepEqual(after,{models:0,holders:['scene-bbbb000']});assert.deepEqual(errs,[]);
 console.log('PASS scanner-render-model: glb mesh loads, visible by pixels, hidden on lost, back on resume, removed on switch (headless SwiftShader; no engine/camera/recognition)');
}finally{await b.close();server.close();}})().catch(e=>{console.error(e&&e.stack||e);process.exit(1)});
