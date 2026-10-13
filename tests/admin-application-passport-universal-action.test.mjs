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


// Production regression: exercise the ACTUAL emitted Main UI action composer
// (outer Open button + NESTED two-button business div), not a flat mock.
if(process.env.RONA_APPLICATIONS_GEOMETRY_QA==='1'){
 const vm=(await import('node:vm')).default;
 const {chromium}=await import('playwright');
 const {onRequest:realMainUi}=await import('../functions/portal/main-ui/index.js');
 const {onRequest:totalUI}=await import('../functions/portal/applications-total-kpi-ui.js');
 const {default:premium}=await import('../functions/portal/main-ui/admin-applications-premium-v1.js');
 const {default:readability}=await import('../functions/portal/main-ui/admin-applications-readability-v5.js');
 const live=await realMainUi({});
 assert.equal(live.status,200,'Actual Main UI must not regress to startup HTTP 500');
 const source=await live.text();

// Captured from the deployed Main UI: outer Open action + nested supplier decision host.
// Local development assembler contains only the legacy flat actions implementation.
 const deployedNestedActionFixture=[
 "function application2BLegacyBusinessActions(a){const run=async(action,body={})=>{try{await post('/admin/applications/'+encodeURIComponent(a.application_id)+'/'+action,body);await refreshAdmin()}catch(err){await notify(err.code||err.message,'Ошибка')}};if(a.owner_status==='SUPPLIER_PENDING'){const box=e('div',{class:'rona-owner-actions rona-app-actions'});box.append(e('button',{text:'Ресурс одобрен',onclick:()=>run('supplier-approved')}),e('button',{text:'В ресурсе отказано',onclick:()=>run('cancel',{reason:'SUPPLIER_RESOURCE_DENIED'})}));return box}return applicationActions(a)}",
 "function application2BActions(a){const legacy=application2BLegacyBusinessActions(a);if(legacy?.getAttribute?.('data-rona-app-passport-open')||legacy?.querySelector?.('[data-rona-app-passport-open]'))return legacy;const box=e('div',{class:'rona-owner-actions rona-app-actions'});box.append(e('button',{type:'button','data-rona-app-passport-open':a.application_id,text:'Открыть'}));if(legacy)box.append(legacy);return box}"
 ].join('\n');
 const actualProductionSource=source.includes('function application2BLegacyBusinessActions(a){')?
   source:deployedNestedActionFixture;
 const start=actualProductionSource.indexOf('function application2BLegacyBusinessActions(a){');
 const end=actualProductionSource.indexOf('let ownerApplication2BFilter',start);
 const actualActions=end>start?actualProductionSource.slice(start,end):actualProductionSource.slice(start);
 assert(start>=0&&actualActions.includes('function application2BActions(a){'),'Nested production action fixture must be present');
 assert.match(actualActions,/box\.append\(legacy\)/,'Current production uses nested legacy action div');
 const total=await(await totalUI()).text();
 const cssArray=(src)=>{
   const n=src.indexOf('s.textContent=[');
   assert(n>=0,'CSS owner assignment required');
   const a=src.indexOf('[',n),b=src.indexOf("].join('')",a);
   assert(b>a,'CSS array must close');
   return String(vm.runInNewContext(src.slice(a,b+1)+".join('')"));
 };
 const cssLayers=[cssArray(premium),cssArray(readability),cssArray(total)];
 const passportScript=actionRuntime.replace("if(location.pathname!=='/portal/admin')return;","if(false)return;");
 const html='<!doctype html><html class="rona-applications-premium-pass3"><head></head><body>'
 +'<section id="page-applications"><div class="rona-app-table"><table class="rona-owner-table">'
 +'<thead><tr><th>Заявка</th><th>Действия</th></tr></thead><tbody><tr>'
 +'<td data-app-col="application-id">APP-DOM-QA</td><td data-app-col="actions"></td>'
 +'</tr></tbody></table></div></section></body></html>';
 const fixture=[
  "const e=(tag,attrs={})=>{const n=document.createElement(tag);for(const [k,v] of Object.entries(attrs)){if(k==='class')n.className=v;else if(k==='text')n.textContent=String(v);else if(k==='onclick')n.addEventListener('click',v);else n.setAttribute(k,String(v))}return n};",
  "function application2BBucket(){return 'DECISION'}",
  "window.__supplierCalls=[];window.__openClicks=[];",
  "const post=async(path,body)=>{window.__supplierCalls.push({path,body});return {ok:true}};",
  "const refreshAdmin=async()=>{};const notify=async()=>{};const applicationActions=()=>null;",
  actualActions,
  "document.querySelector('td[data-app-col=actions]').append(application2BActions({application_id:'APP-DOM-QA',owner_status:'SUPPLIER_PENDING',deal_status:'SUPPLIER_PENDING'}));",
  "document.querySelector('button[data-rona-app-passport-open]').addEventListener('click',()=>window.__openClicks.push('APP-DOM-QA'));"
 ].join('\n');
 const browser=await chromium.launch({headless:true});
 try{
  for(const width of [1440,1170,750]){
   const page=await browser.newPage({viewport:{width,height:900}});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.setContent(html,{waitUntil:'load'});
   await page.addScriptTag({content:fixture});
   const initial=await page.evaluate(()=>{
     const outer=document.querySelector('td[data-app-col="actions"]>.rona-app-actions');
     const inner=outer?.querySelector(':scope>.rona-app-actions');
     return {outer:outer?.children.length,inner:inner?.children.length,
      open:outer?.querySelector(':scope>button[data-rona-app-passport-open]')?.textContent,
      approve:inner?.children[0]?.textContent,reject:inner?.children[1]?.textContent};
   });
   assert.equal(initial.outer,2,'Actual outer wrapper contains Open and inner div at '+width);
   assert.equal(initial.inner,2,'Actual inner business wrapper has two buttons at '+width);
   assert.equal(initial.open,'Открыть');assert.equal(initial.approve,'Ресурс одобрен');
   assert.equal(initial.reject,'В ресурсе отказано');
   await page.addScriptTag({content:passportScript});
   for(const css of cssLayers)await page.addStyleTag({content:css});
   await page.waitForTimeout(100);
   const layout=await page.evaluate(()=>{
     const outer=document.querySelector('td[data-app-col="actions"]>.rona-app-actions');
     const inner=outer.querySelector(':scope>.rona-app-actions');
     const buttons=[inner.children[0],inner.children[1],outer.querySelector(':scope>button[data-rona-app-passport-open]')];
     return {outerDisplay:getComputedStyle(outer).display,innerDisplay:getComputedStyle(inner).display,
      nestedCount:document.querySelectorAll('.rona-app-actions .rona-app-actions').length,
      nestedButtons:document.querySelectorAll('button button').length,
      rects:buttons.map(n=>{const b=n.getBoundingClientRect(),c=getComputedStyle(n);return {
       x:b.left,y:b.top,right:b.right,bottom:b.bottom,width:b.width,height:b.height,position:c.position};})};
   });
   assert.equal(layout.nestedCount,1,'Only the real nested div at '+width);
   assert.equal(layout.nestedButtons,0,'No nested buttons at '+width);
   assert.equal(layout.outerDisplay,'flex','Outer wrapper must stack rows at '+width);
   assert.equal(layout.innerDisplay,'grid','Inner business buttons must be side by side at '+width);
   const [approve,reject,open]=layout.rects;
   const overlaps=(a,b)=>Math.min(a.right,b.right)-Math.max(a.x,b.x)>1 &&
     Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>1;
   assert(!overlaps(approve,reject),'Approve/Reject overlap at '+width);
   assert(!overlaps(approve,open),'Approve/Open overlap at '+width);
   assert(!overlaps(reject,open),'Reject/Open overlap at '+width);
   assert(approve.width>=100&&reject.width>=100&&open.width>=230,'Insufficient clickable width at '+width);
   assert(open.y>=Math.max(approve.bottom,reject.bottom)+4,'Open must be BELOW both decisions at '+width);
   assert(layout.rects.every(r=>r.position==='static'),'No absolutely positioned buttons at '+width);
   await page.locator('td[data-app-col="actions"]>.rona-app-actions>.rona-app-actions>button').first().click();
   await page.locator('td[data-app-col="actions"]>.rona-app-actions>.rona-app-actions>button').nth(1).click();
   await page.locator('td[data-app-col="actions"]>.rona-app-actions>button[data-rona-app-passport-open]').click();
   await page.waitForFunction(()=>window.__supplierCalls.length===2&&window.__openClicks.length===1);
   const calls=await page.evaluate(()=>({supplier:window.__supplierCalls,open:window.__openClicks}));
   assert.deepEqual(calls.supplier.map(x=>x.path),[
    '/admin/applications/APP-DOM-QA/supplier-approved','/admin/applications/APP-DOM-QA/cancel'
   ],'Preserve independent business handlers at '+width);
   assert.deepEqual(calls.open,['APP-DOM-QA'],'Preserve independent passport opening at '+width);
   await page.evaluate(()=>window.dispatchEvent(new Event('rona:admin-refreshed')));
   await page.waitForTimeout(50);
   assert.equal(await page.locator('td[data-app-col="actions"] button').count(),3,'No duplicate buttons after refresh at '+width);
   assert.deepEqual(errors,[],'Browser must have no script errors at '+width);
   await page.close();
  }
 }finally{await browser.close()}
 console.log('ADMIN_APPLICATION_NESTED_PRODUCTION_ACTIONS=PASS widths=1440,1170,750');
}
