// Generates the DEMO-ONLY scanner catalog: two scenes with generated artwork (seeded canvas noise) and generated elements. No user art.
// usage: node scripts/make-scanner-demo.cjs   -> studio/scanner-demo/{catalog.json,demo-a-0001.json,demo-b-0001.json}
const {chromium}=require('playwright-core'),fs=require('fs'),path=require('path'),server=require('../server/server');
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,b=await chromium.launch({executablePath:process.env.CHROME||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
try{const p=await b.newPage();await p.goto(base+'/index.html');await p.waitForSelector('#element-list li');
 const out=await p.evaluate(async()=>{
  const png=(w,h,fn)=>new Promise(res=>{const c=document.createElement('canvas');c.width=w;c.height=h;fn(c.getContext('2d'));c.toBlob(res,'image/png');});
  const art=(seed)=>png(768,1024,g=>{let s=seed;g.fillStyle='#fff';g.fillRect(0,0,768,1024);for(let i=0;i<500;i++){s=(s*9301+49297)%233280;g.fillStyle='hsl('+(s%360)+',70%,50%)';g.fillRect((s*7)%768,(s*13)%1024,30+s%90,30+s%70);}});
  const out={};
  for(const [id,seed,txt,col] of [['demo-a-0001',11,'דמו א','#e03131'],['demo-b-0001',97,'דמו ב','#2f9e44']]){
   const rec=Studio.blankExperience(id);rec.id=id;rec.name=txt;
   rec.assets={__artwork:await art(seed),i1:await png(64,64,g=>{g.fillStyle=col;g.fillRect(0,0,64,64);})};
   const t=await Studio.makeTarget(await Studio.loadImage(URL.createObjectURL(rec.assets.__artwork)));rec.target={artRect:t.artRect,natural:{w:768,h:1024}};
   rec.elements=[{id:'t1',type:'text',text:txt,x:0,y:.32,w:.6,h:.12,scale:1},{id:'im',type:'image',assetId:'i1',x:0,y:-.05,w:.35,aspect:1,scale:1}];
   out[id]=await Studio.exportJSON(rec);
  }
  return out;});
 const dir=path.resolve(__dirname,'../studio/scanner-demo');fs.mkdirSync(dir,{recursive:true});
 for(const [id,txt] of Object.entries(out))fs.writeFileSync(path.join(dir,id+'.json'),typeof txt==='string'?txt:JSON.stringify(txt));
 fs.writeFileSync(path.join(dir,'catalog.json'),JSON.stringify([{name:'demo-a',scene:'demo-a-0001'},{name:'demo-b',scene:'demo-b-0001'}],null,1));
 console.log('wrote',Object.keys(out).join(','));
}finally{await b.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exit(1)});
