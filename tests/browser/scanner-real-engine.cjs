const {chromium,devices}=require('playwright-core'),assert=require('assert/strict'),fs=require('fs'),cp=require('child_process'),path=require('path'),server=require('../../server/server');
// REAL 8th Wall engine (studio/external/xr) on the intended scanner.html, fed a SYNTHETIC camera: Chrome's fake-capture device plays a y4m built with ffmpeg from the generated demo artworks (A for 14s, then B for 14s, looping).
// Only shim: getUserMedia drops facingMode (Chrome's fake device cannot satisfy exact:environment). Synthetic input, Pixel 5 emulation, SwiftShader. NOT a phone, NOT a printed image, NOT a real camera.
(async()=>{
 const tmp=fs.mkdtempSync('/tmp/scanreal-');const dir=path.resolve(__dirname,'../../studio/scanner-demo');
 for(const x of ['a','b']){const j=JSON.parse(fs.readFileSync(dir+'/demo-'+x+'-0001.json','utf8'));fs.writeFileSync(tmp+'/'+x+'.png',Buffer.from(j.assets.__artwork.split(',')[1],'base64'));
  cp.execFileSync('ffmpeg',['-y','-loglevel','error','-loop','1','-t','14','-i',tmp+'/'+x+'.png','-vf','scale=480:640,fps=10,format=yuv420p','-pix_fmt','yuv420p',tmp+'/'+x+'.y4m']);}
 cp.execFileSync('ffmpeg',['-y','-loglevel','error','-i',tmp+'/a.y4m','-i',tmp+'/b.y4m','-filter_complex','[0:v][1:v]concat=n=2:v=1[o]','-map','[o]','-pix_fmt','yuv420p',tmp+'/fake.y4m']);
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--use-file-for-fake-video-capture='+tmp+'/fake.y4m','--autoplay-policy=no-user-gesture-required']});
 try{const ctx=await b.newContext({...devices['Pixel 5'],permissions:['camera']});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.addInitScript(()=>{const g=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=c=>{const v=c&&c.video&&typeof c.video==='object'?{...c.video}:c&&c.video;if(v&&typeof v==='object')delete v.facingMode;return g({...c,video:v});};window.__seq=[];document.addEventListener('DOMContentLoaded',()=>new MutationObserver(()=>{const s=document.body.dataset.scanState+':'+document.body.dataset.scanTarget;if(window.__seq[window.__seq.length-1]!==s)window.__seq.push(s);}).observe(document.body,{attributes:true,attributeFilter:['data-scan-state','data-scan-target']}));});
  await p.goto(base+'/scanner.html'+(process.env.SCAN_DIR?'?dir='+process.env.SCAN_DIR:''));
  const got=new Set();const poseSeen=[];const proof={};
  const cur=()=>p.evaluate(()=>{const c=document.getElementById('scanner-container');if(!c||!c.object3D)return {st:'boot',hold:0,vis:false,pos:[],sc:0,seq:window.__seq||[]};const o=c.object3D;return {st:document.body.dataset.scanState+':'+document.body.dataset.scanTarget,hold:[...document.querySelectorAll('[data-scanner-scene]')].length,vis:o.visible,pos:o.position.toArray().map(v=>+v.toFixed(2)),sc:+o.scale.x.toFixed(3),seq:window.__seq};});
  const near=async(buf,rgb)=>p.evaluate(async([d,rgb])=>{const im=new Image();im.src='data:image/png;base64,'+d;await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const g=c.getContext('2d');g.drawImage(im,0,0);const a=g.getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<a.length;i+=4)if(Math.abs(a[i]-rgb[0])<=5&&Math.abs(a[i+1]-rgb[1])<=5&&Math.abs(a[i+2]-rgb[2])<=5)n++;return n;},[buf.toString('base64'),rgb]);
  const COL={'demo-a':[224,49,49],'demo-b':[47,158,68]};
  for(let i=0;i<200&&!(proof['demo-a']&&proof['demo-b']);i++){await p.waitForTimeout(250);const s1=await cur();s1.seq.forEach(x=>got.add(x));
   const buf=await p.screenshot();const s2=await cur();if(s2.st!==s1.st)continue; // state must not change around the screenshot
   const m=/^tracking:(demo-[ab])$/.exec(s1.st);if(!m)continue;
   const own=await near(buf,COL[m[1]]),other=await near(buf,COL[m[1]==='demo-a'?'demo-b':'demo-a']);
   proof[m[1]]={own,other,pose:{pos:s1.pos,sc:s1.sc}};poseSeen.push({vis:true,pos:s1.pos,sc:s1.sc});fs.writeFileSync('/downloads/scanner-real-engine-'+m[1]+'-'+Date.now()+'.png',buf);}
  const seq=await p.evaluate(()=>window.__seq);
  console.log(JSON.stringify({seq,errs,proof}));assert(proof['demo-a']&&proof['demo-b'],'pixel proof for both targets: '+JSON.stringify(proof));assert(proof['demo-a'].own>3000&&proof['demo-a'].other<300,'tracking A shows A image colour only: '+JSON.stringify(proof['demo-a']));assert(proof['demo-b'].own>3000&&proof['demo-b'].other<300,'tracking B shows B image colour only: '+JSON.stringify(proof['demo-b']));
  assert(seq.includes('tracking:demo-a')&&seq.includes('tracking:demo-b'),'both targets recognised from the synthetic feed: '+seq);
  assert(!seq.includes('tracking:undefined'));assert(!seq.some(x=>x.startsWith('scene-error')||x.startsWith('unknown-target')),'no scene errors or unknown names: '+seq);
  assert.deepEqual(errs,[]);assert(poseSeen.length>0&&poseSeen.some(q=>q.sc>0&&q.pos.some(v=>v!==0)),'engine pose applied to the scanner container while tracking: '+JSON.stringify(poseSeen.slice(0,3)));
  console.log('PASS scanner-real-engine (REAL engine, SYNTHETIC camera feed from generated demo art): recognised demo-a and demo-b by name and switched scenes; sequence '+seq.join(' > ')+'. Not a phone, not a printed image.');
 }finally{await b.close();await new Promise(r=>server.close(r));fs.rmSync(tmp,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exit(1)});
