const {chromium, webkit} = require('playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.mp3':'audio/mpeg'};
const root = path.resolve(__dirname,'..');
const server = http.createServer((req,res)=>{
  let url = new URL(req.url,'http://localhost').pathname;
  if (!url.startsWith('/piano-pwa/')) {res.writeHead(404).end();return;}
  const file = path.join(root, url.slice('/piano-pwa/'.length) || 'index.html');
  if (!file.startsWith(root + path.sep)) {res.writeHead(403).end();return;}
  fs.readFile(file,(err,data)=>{res.writeHead(err?404:200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(err?'Not found':data);});
});
(async()=>{
 await new Promise(r=>server.listen(4173,'127.0.0.1',r));
 for (const engine of (process.env.CHROMIUM_ONLY ? [chromium] : [chromium, webkit])) {
  const browser = await engine.launch({headless:true,args:engine===chromium?['--no-sandbox']:[]});
  try {
   const context=await browser.newContext({viewport:{width:1194,height:834},hasTouch:true});
   await context.addInitScript(() => {
    window.__audioEvents=[];
    const Context=window.AudioContext || window.webkitAudioContext;
    const original=Context.prototype.createBufferSource;
    Context.prototype.createBufferSource=function(...args){
     const source=original.apply(this,args);
     const start=source.start.bind(source),stop=source.stop.bind(source);
     source.start=(...a)=>{
      const channel=source.buffer.getChannelData(0);
      const energy=channel.reduce((sum,v)=>sum+v*v,0)/channel.length;
      window.__audioEvents.push({type:'start',rate:source.playbackRate.value,energy,state:this.state});
      return start(...a);
     };
     source.stop=(...a)=>{window.__audioEvents.push({type:'stop'});return stop(...a);};
     return source;
    };
   });
   const page=await context.newPage();
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:4173/piano-pwa/');
   await page.waitForSelector('#settings-button',{timeout:5000});
   await page.waitForFunction(()=>document.body.dataset.ready==='true');
   const key=page.locator('.key[data-note="60"]');
   const firstBox=await key.boundingBox();
   await page.mouse.move(firstBox.x+firstBox.width/2,700);
   await page.mouse.down();
   await page.waitForFunction(()=>window.__audioEvents.some(e=>e.type==='start'));
   const firstAudio=await page.evaluate(()=>window.__audioEvents.find(e=>e.type==='start'));
   assert.equal(firstAudio.state,'running');assert.ok(firstAudio.energy>0.00001);
   await page.mouse.up();
   assert.ok(await page.evaluate(()=>window.__audioEvents.some(e=>e.type==='stop')));
   await key.dispatchEvent('pointerdown',{pointerId:1,clientX:550,clientY:500,isPrimary:true});
   await page.waitForFunction(()=>document.querySelector('.key.is-active'));
   await page.locator('#keyboard').dispatchEvent('pointercancel',{pointerId:1});
   assert.equal(await page.locator('.is-active').count(),0);
   await page.locator('#settings-button').click();
   await page.waitForSelector('dialog[open]');
   assert.equal(await page.locator('#scale').inputValue(),'22');
   assert.equal(await page.locator('#slide').isChecked(),false);
   assert.match(await page.locator('#range-label').textContent(),/Фа2.*Фа5/);
   await page.locator('#theme').selectOption('neon');
   assert.equal(await page.locator('html').getAttribute('data-theme'),'neon');
   await page.locator('#transpose').selectOption('bb');
   await page.locator('#instrument').selectOption('marimba');
   await page.waitForFunction(()=>document.body.dataset.ready==='true');
   await page.locator('#close-settings').click();
   const audioCount=await page.evaluate(()=>window.__audioEvents.filter(e=>e.type==='start').length);
   await key.dispatchEvent('pointerdown',{pointerId:8,isPrimary:true});
   await page.waitForFunction(n=>window.__audioEvents.filter(e=>e.type==='start').length>n,audioCount);
   const transposedRate=await page.evaluate(()=>window.__audioEvents.filter(e=>e.type==='start').at(-1).rate);
   assert.ok(Math.abs(transposedRate - 2**(-2/12))<0.00001);
   await page.locator('#keyboard').dispatchEvent('pointerup',{pointerId:8});
   await page.locator('#settings-button').click();
   await page.locator('#scale').fill('14');
   await page.locator('#position').fill('30');
   await page.locator('#slide').check();
   await page.locator('#close-settings').click();
   const before=await page.locator('#keyboard').evaluate(el=>el.scrollLeft);
   await page.locator('#keyboard').dispatchEvent('pointerdown',{pointerId:2,clientX:600,clientY:500,isPrimary:true});
   await page.locator('#keyboard').dispatchEvent('pointermove',{pointerId:2,clientX:720,clientY:500,isPrimary:true});
   await page.locator('#keyboard').dispatchEvent('pointerup',{pointerId:2});
   assert.ok((await page.locator('#keyboard').evaluate(el=>el.scrollLeft))<before);
   await page.reload();
   await page.waitForFunction(()=>document.body.dataset.ready==='true');
   await page.locator('#settings-button').click();
   assert.equal(await page.locator('#theme').inputValue(),'neon');
   assert.equal(await page.locator('#instrument').inputValue(),'marimba');
   assert.equal(await page.locator('#transpose').inputValue(),'bb');
   assert.equal(await page.locator('#scale').inputValue(),'14');
   await page.locator('#slide').uncheck();
   await page.locator('#reset').click();
   await page.waitForFunction(()=>document.body.dataset.ready==='true');
   await page.locator('#close-settings').click();
   const start=await page.locator('#keyboard').evaluate(el=>el.scrollLeft);
   const box=await page.locator('.key[data-note="60"]').boundingBox();
   await page.mouse.move(box.x+box.width/2,700);await page.mouse.down();
   await page.mouse.move(box.x+box.width*2,700,{steps:3});
   assert.equal(await page.locator('.is-active').count(),1);
   await page.locator('#settings-button').evaluate(el=>el.click());
   assert.equal(await page.locator('.is-active').count(),0);
   await page.mouse.up();
   assert.equal(await page.locator('#keyboard').evaluate(el=>el.scrollLeft),start);
   await page.locator('#close-settings').click();
   await page.setViewportSize({width:834,height:1194});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth > innerWidth),false);
   await page.screenshot({path:`/tmp/piano-${engine.name()}.png`});
   // Enable after Task 3 adds the installable offline shell.
   if(process.env.OFFLINE_TEST){
    await page.waitForFunction(()=>document.body.dataset.offline==='ready',{timeout:30000});
    await context.setOffline(true);await page.reload();
    await page.waitForFunction(()=>document.body.dataset.ready==='true');
    await page.locator('#settings-button').click();
    for (const instrument of ['trumpet','marimba','piano']) {
     await page.locator('#instrument').selectOption(instrument);
     await page.waitForFunction(()=>document.body.dataset.ready==='true');
     await page.locator('#close-settings').click();
     const count=await page.evaluate(()=>window.__audioEvents.filter(e=>e.type==='start').length);
     const noteBox=await page.locator('.key[data-note="60"]').boundingBox();
     await page.mouse.move(noteBox.x+noteBox.width/2,1000);await page.mouse.down();
     await page.waitForFunction(n=>window.__audioEvents.filter(e=>e.type==='start').length>n,count);
     await page.waitForFunction(()=>document.querySelector('.is-active'));
     await page.mouse.up();
     await page.locator('#settings-button').click();
    }
   }
   assert.deepEqual(errors,[]);
   console.log(engine.name()+': keyboard, gestures, settings, persistence, resize'+(process.env.OFFLINE_TEST?', offline all instruments':'')+' PASS');
  } finally {await browser.close();}
 }
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
