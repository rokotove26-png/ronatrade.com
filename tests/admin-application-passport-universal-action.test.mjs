import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import actionRuntime from '../functions/portal/main-ui/admin-applications-passport-action-v2.js';

assert.match(actionRuntime,/data-rona-app-passport-open/,'universal action must bind to canonical passport delegated handler');
assert.match(actionRuntime,/textContent='Открыть'/,'visible Open label must be restored');
assert.match(actionRuntime,/\.rona-owner-table tbody tr/,'all rendered application rows must be covered');
assert.match(actionRuntime,/function actionsCell\(row\)/,'layout must resolve the full actions cell, not only the nested button host');
assert.match(actionRuntime,/cell\?\.querySelectorAll\?\.\('select'\)/,'currency selector must be resolved across the complete actions cell');
assert.match(actionRuntime,/rona-app-currency-open-inline/,'currency and Open must be grouped into one nowrap inline unit');
assert.match(actionRuntime,/group\.append\(anchor,button\)/,'Open must be immediately to the right of the currency control');
assert.match(actionRuntime,/flex-wrap:nowrap!important/,'currency/Open pair must not split across visual lines');
assert.match(actionRuntime,/MutationObserver/,'action must survive application table re-render');
assert.ok(!/RONA-C\d+|DEAL-2026-|PORTAL-EVT-[0-9a-f]{8}/i.test(actionRuntime),'runtime must not hardcode production records');
assert.ok(!/\bpost\s*\(|\/admin\/applications\//.test(actionRuntime),'passport action overlay must not mutate application business state');


assert.match(actionRuntime,/host\.classList\.contains\('rona-app-actions'\)/,'supplier actions must use the dedicated three-button host');
assert.match(actionRuntime,/direct\.length===3&&direct\[2\]===button/,'Approve, Deny, Open must be direct button siblings in that order');
assert.match(actionRuntime,/data-rona-app-independent-actions/,'three-button action layout must be scoped to decision rows');
assert.match(actionRuntime,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/,'Approve and Deny must share a two-column first row');
assert.match(actionRuntime,/grid-auto-rows:minmax\(38px,auto\)/,'decision rows must keep independent hit areas');
assert.match(actionRuntime,/button\[data-rona-app-passport-open\]\{grid-column:1\/-1!important/,'Open must span its own second row');
assert.match(actionRuntime,/:has\(>button:nth-child\(3\)\[data-rona-app-passport-open\]\)/,'correction must target only decision hosts with a third Open button');
assert.doesNotMatch(actionRuntime,/grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\) 83px/,'failed three-column layout must be absent');

const composer=await readFile('functions/portal/main-ui/application-passport-runtime.js','utf8');
assert.match(composer,/admin-applications-passport-action-v2\.js/,'passport action runtime must be mounted');
assert.match(composer,/applicationPassportRuntimeBase\s*\+\s*adminApplicationsPassportActionV2/,'delegated passport handler must load before the universal trigger overlay');

console.log('ADMIN_APPLICATION_PASSPORT_UNIVERSAL_ACTION=PASS');


// The actual passport script creates Open; the browser QA verifies that
// all three buttons are DOM siblings with disjoint geometry and click targets.
// All four production CSS owners participate in the real browser cascade.
if(process.env.RONA_APPLICATIONS_GEOMETRY_QA==='1'){
 const vm=(await import('node:vm')).default;
 const {chromium}=await import('playwright');
 const {onRequest}=await import('../functions/portal/applications-total-kpi-ui.js');
 const {default:premium}=await import('../functions/portal/main-ui/admin-applications-premium-v1.js');
 const {default:readability}=await import('../functions/portal/main-ui/admin-applications-readability-v5.js');
 const total=await(await onRequest()).text();
 const cssArray=(source)=>{
  const from=source.indexOf('s.textContent=[');
  assert(from>=0,'CSS owner assignment must be present');
  const begin=source.indexOf('[',from),end=source.indexOf("].join('')",begin);
  assert(end>begin,'CSS owner array must close');
  return String(vm.runInNewContext(source.slice(begin,end+1)+".join('')"));
 };
 const cssLayers=[cssArray(premium),cssArray(readability),cssArray(total)];
 const testScript=actionRuntime.replace("if(location.pathname!=='/portal/admin')return;","if(false)return;");
 assert.notEqual(testScript,actionRuntime,'Browser test needs only a localhost-safe path guard shim');
 assert(cssLayers.every(css=>css.length>200),'Production CSS layers must load');
 const content='<!doctype html><html class="rona-applications-premium-pass3"><head></head><body>'
  +'<section id="page-applications"><div class="rona-app-table"><table class="rona-owner-table">'
  +'<thead><tr><th>Заявка</th><th>Действия</th></tr></thead>'
  +'<tbody><tr><td data-app-col="application-id">APP-FIXTURE</td>'
  +'<td data-app-col="actions"><div class="rona-owner-actions rona-app-actions">'
  +'<button type="button" class="rona-app-action--approve">Ресурс одобрен</button>'
  +'<button type="button" class="rona-app-action--reject">В ресурсе отказано</button>'
  +'</div></td></tr></tbody></table></div></section>'
  +'<script>window.actionClicks=[];document.querySelectorAll(".rona-app-actions>button").forEach((button,i)=>button.addEventListener("click",()=>window.actionClicks.push(i)));</script>'
  +'</body></html>';
 const browser=await chromium.launch({headless:true});
 try {
  for(const width of [1440,1100,750]){
   const page=await browser.newPage({viewport:{width,height:850}});
   const errors=[];
   page.on('pageerror',e=>errors.push(String(e.message||e)));
   await page.setContent(content,{waitUntil:'load'});
   await page.addScriptTag({content:testScript});
   await page.waitForSelector('.rona-app-actions>button[data-rona-app-passport-open]',{timeout:5000});
   for(const layer of cssLayers)await page.addStyleTag({content:layer});
   await page.evaluate(()=>{
    document.querySelector('.rona-app-actions>button[data-rona-app-passport-open]')
     .addEventListener('click',()=>window.actionClicks.push(2));
   });
   const actual=await page.locator('.rona-app-actions>button').evaluateAll(buttons=>{
    const rects=buttons.map(button=>{
     const box=button.getBoundingClientRect(),style=getComputedStyle(button);
     return {x:box.x,y:box.y,right:box.right,bottom:box.bottom,width:box.width,height:box.height,position:style.position};
    });
    return {rects,nested:document.querySelectorAll('button button').length,
      attr:buttons[0]?.parentElement?.getAttribute('data-rona-app-independent-actions')};
   });
   assert.equal(actual.nested,0,'Buttons must not be nested at '+width);
   assert.equal(actual.attr,'3','Runtime must discover three direct sibling buttons at '+width);
   assert.equal(actual.rects.length,3,'Exactly three decision buttons at '+width);
   const [approve,reject,open]=actual.rects;
   const overlaps=(a,b)=>Math.max(a.x,b.x)<Math.min(a.right,b.right)-1
                       &&Math.max(a.y,b.y)<Math.min(a.bottom,b.bottom)-1;
   assert(!overlaps(approve,reject),'Approve and Deny overlap at '+width);
   assert(!overlaps(approve,open),'Approve and Open overlap at '+width);
   assert(!overlaps(reject,open),'Deny and Open overlap at '+width);
   assert(approve.width>=95&&reject.width>=95&&open.width>=210,'Click rectangles too small at '+width);
   assert(open.y>=Math.max(approve.bottom,reject.bottom)+4,'Open must be on second row at '+width);
   assert(actual.rects.every(x=>x.position==='static'),'No overlay positioning at '+width);
   for(let i=0;i<3;i++)await page.locator('.rona-app-actions>button').nth(i).click();
   assert.deepEqual(await page.evaluate(()=>window.actionClicks),[0,1,2],'Each button must receive only its own click at '+width);
   await page.evaluate(()=>window.dispatchEvent(new Event('rona:admin-refreshed')));
   const count=await page.locator('.rona-app-actions>button').count();
   assert.equal(count,3,'Repeated refresh must not duplicate controls at '+width);
   assert.deepEqual(errors,[],'Runtime must not throw in browser at '+width);
   await page.close();
  }
 }finally{await browser.close()}
 console.log('ADMIN_APPLICATION_THREE_ACTIONS_BROWSER_GEOMETRY=PASS widths=1440,1100,750');
}
