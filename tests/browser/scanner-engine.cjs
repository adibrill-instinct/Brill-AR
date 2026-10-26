const {chromium}=require('playwright-core'),assert=require('assert/strict'),server=require('../../server/server');
// SIMULATION: synthetic xrimagefound/xrimagelost CustomEvents (the engine's event shape) on a plain element drive ScannerCore through ScannerEngine.attach. No camera, no recognition, no user art.
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,b=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
try{const p=await b.newPage();await p.goto(base+'/index.html');await p.waitForSelector('#element-list li');
 for(const f of ['scanner-core.js','scanner-engine.js'])await p.addScriptTag({url:base+'/'+f});
 const r=await p.evaluate(async()=>{
  const ev=[];const sc=ScannerCore.create({catalog:[{name:'a',scene:'scene-aaaa000'}],loadScene:async id=>({id,elements:[]}),mount:async()=>({pause(){ev.push('pause')},resume(){ev.push('resume')},destroy(){ev.push('destroy')}}),onState:s=>ev.push(s)});
  const el=document.createElement('div');const detach=ScannerEngine.attach(el,sc);const fire=(t,d)=>el.dispatchEvent(new CustomEvent(t,{detail:d}));
  const tick=()=>new Promise(r=>setTimeout(r,20));
  fire('xrimagefound',{name:'a'});await tick();fire('xrimagelost',{name:'a'});await tick();fire('xrimagefound',{name:'a'});await tick();
  fire('xrimagefound',{name:'zzz'});await tick();fire('xrimagefound',{});fire('xrimagefound',{name:42});fire('xrimagefound');await tick();
  const before=ev.length;detach();fire('xrimagelost',{name:'a'});await tick();
  return {ev,afterDetachExtra:ev.length-before,info:sc.info()};});
 assert.deepEqual(r.ev,['scanning'].slice(1).concat(['loading','tracking','pause','lost','resume','tracking','unknown-target']),JSON.stringify(r.ev));
 assert.equal(r.afterDetachExtra,0,'detached: no more events handled');
 const pose=await p.evaluate(async()=>{const sc=ScannerCore.create({catalog:[{name:'a',scene:'scene-aaaa000'},{name:'b',scene:'scene-bbbb000'}],loadScene:async id=>({id,elements:[]}),mount:async()=>({pause(){},resume(){},destroy(){}})});
 const mk=()=>({visible:true,position:{v:null,copy(x){this.v=[x.x,x.y,x.z]}},quaternion:{v:null,copy(x){this.v=[x.x,x.y,x.z,x.w]}},scale:{v:null,set(a,b,c){this.v=[a,b,c]}}});
 const o3=mk(),el=document.createElement('div');el.object3D=o3;const s=document.createElement('div');ScannerEngine.attach(s,sc,el);
 const fire=(t,d)=>s.dispatchEvent(new CustomEvent(t,{detail:d}));const P=(x)=>({x,y:0,z:-1}),R={x:0,y:0,z:0,w:1};const out={initialVisible:o3.visible};
 fire('xrimagefound',{name:'a',position:P(1),rotation:R,scale:2});out.afterFound=[o3.visible,o3.position.v,o3.scale.v];
 fire('xrimageupdated',{name:'a',position:P(3),rotation:R,scale:2});out.updated=o3.position.v;
 fire('xrimageupdated',{name:'b',position:P(9),rotation:R,scale:2});out.otherIgnored=o3.position.v;
 fire('xrimageupdated',{name:'a',position:P(4),rotation:R,scale:0});out.badScaleIgnored=o3.position.v;
 fire('xrimagelost',{name:'b'});out.otherLostKeeps=o3.visible;
 fire('xrimagelost',{name:'a'});out.afterLost=o3.visible;return out;});
 assert.equal(pose.initialVisible,false);assert.deepEqual(pose.afterFound,[true,[1,0,-1],[2,2,2]]);assert.deepEqual(pose.updated,[3,0,-1]);assert.deepEqual(pose.otherIgnored,[3,0,-1]);assert.deepEqual(pose.badScaleIgnored,[3,0,-1]);assert.equal(pose.otherLostKeeps,true);assert.equal(pose.afterLost,false);
 console.log('PASS scanner-engine pose (stub object3D): copies position/rotation/scale like xrextras-named-image-target, ignores other targets and bad scale, hidden before found and after lost');
 console.log('PASS scanner-engine (SIMULATION, synthetic engine-shaped events): found->load+track, lost->pause, refound->resume without reload, unknown name ignored safely, malformed events ignored, detach stops handling');
}finally{await b.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exit(1)});
