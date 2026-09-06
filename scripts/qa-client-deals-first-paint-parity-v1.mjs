import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {extname,join,normalize} from 'node:path';
import {chromium} from 'playwright';

const ROOT=process.cwd();
const DIST=join(ROOT,'dist');
const LABEL=process.env.RONA_DEALS_FIRST_PAINT_LABEL||'TARGET';
const ARTIFACT_DIR=process.env.RONA_OWNER_ARTIFACT_DIR||ROOT;
const NAV='#nav [data-page],[data-rona-client-nav] [data-page],nav [data-page]';
const CLIENT='CLIENT-QA-A',CONTRACT='CONTRACT-QA-A',FOREIGN_CLIENT='CLIENT-QA-B',FOREIGN_CONTRACT='CONTRACT-QA-B';
const DEAL_IDS=['DEAL-2099-901','DEAL-2099-902'];
const norm=v=>String(v??'').replace(/\s+/g,' ').trim();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const safeLabel=LABEL.replace(/[^A-Za-z0-9._-]+/g,'_').slice(0,80);
const screenshotPre=join(ARTIFACT_DIR,`owner-deals-${safeLabel}-pre-open.png`);
const screenshotPost=join(ARTIFACT_DIR,`owner-deals-${safeLabel}-post-close.png`);

const applications=DEAL_IDS.map((deal_id,i)=>({
  application_id:`APP-QA-${i+1}`,
  product:i===0?'QA LPG':'QA DIESEL',
  quantity_tonnes:i===0?250:175,
  delivery_period_from:'2099-01-01',delivery_period_to:'2099-01-31',
  delivery_basis:'CPT',destination:i===0?'QA STATION ALPHA (123456)':'QA STATION BETA (654321)',
  payment_terms:'PREPAYMENT',price_mode:'FIXED',proposed_price:i===0?454:600,proposed_currency:'USD',
  status:'DEAL_REGISTERED',deal_id,submitted_at:'2099-01-01T00:00:00Z',updated_at:'2099-01-02T00:00:00Z'
}));
const deals=DEAL_IDS.map((deal_id,i)=>({
  deal_id,business_status:'EXECUTING',current_status:'EXECUTING',current_status_label:'В исполнении',status_source:'OPERATIONS_DEAL_BUSINESS_STATUS',
  payment_status:'NOT_DUE',payment_label:'Оплата не наступила',payment_received_amount:null,payment_obligation_amount:null,payment_currency:null,payment_percent:null,payment_source:'DEAL_FINANCE_STATUS',
  passport_amount:applications[i].quantity_tonnes*applications[i].proposed_price,passport_currency:'USD',passport_amount_source:'FINALIZED_APPLICATION_COMMERCIAL_TERMS',passport_application_id:applications[i].application_id,
  resource_status:'RESOURCE_CONFIRMED',resource_label:'Ресурс подтвержден',resource_source:'OPERATIONS_DEAL_BUSINESS_STATUS',opened_at:'2099-01-01T00:00:00Z',closed_at:null,updated_at:'2099-01-02T00:00:00Z'
}));
const documents=DEAL_IDS.flatMap((deal_id,i)=>[
  {document_id:`DOC-QA-${i+1}-A`,document_type:'ADDENDUM',authoritative_filename:`Addendum-${i+1}.pdf`,deal_id,updated_at:'2099-01-02T00:00:00Z',storage_object_id:`00000000-0000-4000-8000-0000000000${i+10}`},
  {document_id:`DOC-QA-${i+1}-I`,document_type:'INVOICE',authoritative_filename:`Invoice-${i+1}.pdf`,deal_id,updated_at:'2099-01-02T00:00:00Z',storage_object_id:`00000000-0000-4000-8000-0000000000${i+20}`}
]);
const projection={projection_contract:'ADMIN_CLIENT_SERVER_V1',contract:{client_id:CLIENT,legal_name:'QA ALPHA ENERGY LLC',registration_country:'TEST',registered_address:null,contact_phone:null,contract_id:CONTRACT,current_external_contract_number:'QA-EXT-A',contract_status:'ACTIVE',effective_from:'2099-01-01',effective_to:'2099-12-31',reference_status:'CONFIRMED'},applications,deals,documents,payments:[],prices:[]};
const contexts=[projection.contract,{client_id:FOREIGN_CLIENT,legal_name:'QA FOREIGN BETA LLC',registration_country:'TEST',contract_id:FOREIGN_CONTRACT,current_external_contract_number:'QA-EXT-B',contract_status:'ACTIVE',effective_from:'2099-01-01',effective_to:'2099-12-31'}];
const stages=()=>[['contract','DONE'],['documents','DONE'],['resource','CURRENT'],['payment','PENDING'],['logistics','PENDING'],['close','PENDING']].map(([key,state])=>({key,state,detail:`${key} fixture status`}));
const requests=[];
function send(res,body){const text=JSON.stringify(body);res.writeHead(200,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','content-length':Buffer.byteLength(text)});res.end(text)}
async function api(req,res,u){
  const clientId=u.searchParams.get('clientId')||'',contractId=u.searchParams.get('contractId')||'';
  let body;
  if(u.pathname==='/portal/api/v1/client/bootstrap') body={ok:true,data:{contexts,selected_context:contexts[0],requires_context_selection:false}};
  else if(u.pathname==='/portal/api/v1/client/context') body={ok:true,data:projection};
  else if(u.pathname==='/portal/api/v1/client/applications-projection') body={ok:true,data:{client_id:CLIENT,contract_id:CONTRACT,applications}};
  else if(u.pathname==='/portal/api/v1/client/deal-documents/state') body={ok:true,client_id:CLIENT,contract_id:CONTRACT,deals:DEAL_IDS.map(deal_id=>({deal_id,client_id:CLIENT,contract_id:CONTRACT,client_stage:'DOCUMENTS_AVAILABLE',payment_handoff_state:'NOT_SENT',realization_status:{source:'SERVER_AUTHORITATIVE_REALIZATION_V1',current_stage_key:'resource',stages:stages()}}))};
  else if(u.pathname==='/portal/api/v1/client/prices') body={ok:true,client_id:CLIENT,contract_id:CONTRACT,prices:[]};
  else if(u.pathname.startsWith('/portal/api/v1/client/')) body={ok:true,data:{}};
  else return false;
  requests.push({path:u.pathname,client_id:clientId,contract_id:contractId,source:norm(req.headers['x-rona-client-source']||'')});
  send(res,body);return true;
}
function mime(path){const e=extname(path).toLowerCase();return e==='.html'?'text/html; charset=utf-8':e==='.js'?'application/javascript; charset=utf-8':e==='.css'?'text/css; charset=utf-8':e==='.svg'?'image/svg+xml':e==='.png'?'image/png':'application/octet-stream'}
async function start(){const html=join(DIST,'portal/client.html');const server=http.createServer(async(req,res)=>{try{const u=new URL(req.url||'/','http://127.0.0.1');if(u.pathname==='/portal/client'||u.pathname==='/portal/client/'){const b=await readFile(html);res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});return res.end(b)}if(await api(req,res,u))return;const clean=normalize(u.pathname).replace(/^([.][.][/\\])+/, '').replace(/^[/\\]+/,'');const p=join(DIST,clean);if(p.startsWith(DIST)){try{if((await stat(p)).isFile()){const b=await readFile(p);res.writeHead(200,{'content-type':mime(p),'cache-control':'no-store'});return res.end(b)}}catch{}}res.writeHead(404);res.end('not found')}catch(error){res.writeHead(500);res.end(String(error))}});await new Promise(r=>server.listen(0,'127.0.0.1',r));return{server,origin:`http://127.0.0.1:${server.address().port}`}}
const stop=server=>new Promise(resolve=>{server.closeAllConnections?.();server.close(()=>resolve())});
const failures=[];
function fail(code,detail={}){failures.push({code,detail});console.log('ASSERTION_FAILED',code,JSON.stringify(detail))}
async function wait(page,fn,arg=null,timeout=5000){try{await page.waitForFunction(fn,arg,{timeout});return true}catch{return false}}
async function nav(page,name){await page.evaluate(({name,sel})=>{const target=[...document.querySelectorAll(sel)].find(n=>n.dataset.page===name);if(!target)throw new Error('NAV_MISSING:'+name);target.click()},{name,sel:NAV})}
function overlap(a,b){if(!a||!b)return 0;const w=Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left)),h=Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));return Math.round(w*h*100)/100}
function rectClose(a,b,tolerance=2){return ['x','y','width','height'].every(k=>Math.abs(Number(a?.[k]||0)-Number(b?.[k]||0))<=tolerance)}
function amountMatches(text,deal){const compact=String(text||'').replace(/\s+/g,'').toUpperCase();return compact.includes(String(deal.passport_amount))&&compact.includes(String(deal.passport_currency||'').toUpperCase())}

async function snapshot(page){return page.evaluate(ids=>{
  const vis=n=>!!n&&getComputedStyle(n).display!=='none'&&getComputedStyle(n).visibility!=='hidden'&&n.getBoundingClientRect().width>0&&n.getBoundingClientRect().height>0;
  const nrm=v=>String(v??'').replace(/\s+/g,' ').trim();
  const rect=n=>{if(!vis(n))return null;const r=n.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,left:r.left,right:r.right,top:r.top,bottom:r.bottom}};
  const pick=(card,sel)=>card.querySelector(sel);
  return ids.map(id=>{const cards=[...document.querySelectorAll(`[data-rona-deals-authoritative-list] [data-rona-canonical-deal-id="${id}"]`)].filter(vis),card=cards[0]||null;if(!card)return{id,count:cards.length,missing:true};const fields={dealId:pick(card,'[data-rona-deal-slot="deal-id"]'),product:pick(card,'[data-rona-deal-slot="product"]'),quantity:pick(card,'[data-rona-deal-slot="quantity"]'),unitPrice:pick(card,'[data-rona-deal-slot="unit-price"]'),basis:pick(card,'[data-rona-deal-slot="basis"]'),destination:pick(card,'[data-rona-deal-slot="destination"]'),amount:pick(card,'[data-rona-deal-slot="amount"]'),open:pick(card,'[data-rona-deal-slot="open"]'),documents:pick(card,'.rona-deal-documents-v5')};const amountStyle=fields.amount?getComputedStyle(fields.amount):null;return{id,count:cards.length,missing:false,summary:!!pick(card,'[data-rona-deal-summary="canonical-v8"]'),ready:card.dataset.ronaDealSummaryReady==='true',slots:Object.fromEntries(Object.entries(fields).map(([k,n])=>[k,{present:!!n,visible:vis(n),text:nrm(n?.textContent),className:String(n?.className||''),rect:rect(n)}])),cardRect:rect(card),className:card.className,amountStyle:amountStyle?{position:amountStyle.position,transform:amountStyle.transform,zIndex:amountStyle.zIndex}:null,docButtons:fields.documents?[...fields.documents.querySelectorAll('button')].filter(vis).map(n=>nrm(n.textContent)):[]}})
},DEAL_IDS)}
function semanticOk(rows){return rows.length===DEAL_IDS.length&&rows.every((row,i)=>!row.missing&&row.count===1&&row.summary&&row.ready&&['dealId','product','quantity','unitPrice','basis','destination','amount','open','documents'].every(k=>row.slots[k]?.present&&row.slots[k]?.visible)&&amountMatches(row.slots.amount.text,deals[i])&&row.docButtons.length>=2)}
function noOverlapProof(rows){return rows.map(row=>{const s=row.slots,pairs=[['amount','product'],['amount','quantity'],['amount','unitPrice'],['amount','basis'],['amount','destination'],['amount','open'],['open','product'],['open','quantity'],['open','unitPrice'],['open','basis'],['open','destination'],['documents','amount'],['documents','open']];return{id:row.id,overlaps:Object.fromEntries(pairs.map(([a,b])=>[`${a}:${b}`,overlap(s[a]?.rect,s[b]?.rect)])),amountStyle:row.amountStyle}})}
function parity(pre,post){const byId=new Map(post.map(x=>[x.id,x]));const detail=[];let ok=true;for(const a of pre){const b=byId.get(a.id);if(!b){ok=false;detail.push({id:a.id,missingPost:true});continue}const classes=['dealId','product','quantity','unitPrice','basis','destination','amount','open','documents'];const structure=classes.every(k=>a.slots[k]?.className===b.slots[k]?.className&&a.slots[k]?.text===b.slots[k]?.text);const geometry=classes.every(k=>rectClose(a.slots[k]?.rect,b.slots[k]?.rect,2))&&rectClose(a.cardRect,b.cardRect,2);const docs=JSON.stringify(a.docButtons)===JSON.stringify(b.docButtons);if(!structure||!geometry||!docs)ok=false;detail.push({id:a.id,structure,geometry,docs})}return{ok,detail}}

const target=await start();let browser;
try{
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const page=await context.newPage();
  await page.addInitScript(()=>{
    window.__RONA_DEALS_FIRST_RENDER_CAPTURE__=[];
    addEventListener('rona:client:deals-rendered',event=>{
      const cards=[...document.querySelectorAll('[data-rona-deals-authoritative-list] [data-rona-canonical-deal-id]')].map(card=>({id:String(card.dataset.ronaCanonicalDealId||''),summary:!!card.querySelector('[data-rona-deal-summary="canonical-v8"]'),ready:card.dataset.ronaDealSummaryReady==='true',slots:['deal-id','product','quantity','unit-price','basis','destination','amount','open'].filter(slot=>card.querySelector(`[data-rona-deal-slot="${slot}"]`))}));
      window.__RONA_DEALS_FIRST_RENDER_CAPTURE__.push({detail:event.detail,cards});
    },true);
  });
  page.on('pageerror',error=>console.log('BROWSER_PAGE_ERROR',String(error?.stack||error)));
  await page.goto(target.origin+'/portal/client',{waitUntil:'domcontentloaded',timeout:30000});
  const projectionReady=await wait(page,()=>!!window.RONA_CLIENT_CONTEXT?.getCurrentProjection?.()?.deals?.length,null,7000);
  if(!projectionReady)fail('DEALS_PROJECTION_NOT_READY');
  await nav(page,'deals');
  const firstCaptured=await wait(page,()=>Array.isArray(window.__RONA_DEALS_FIRST_RENDER_CAPTURE__)&&window.__RONA_DEALS_FIRST_RENDER_CAPTURE__.length>0,null,4000);
  const first=firstCaptured?await page.evaluate(()=>window.__RONA_DEALS_FIRST_RENDER_CAPTURE__[0]):null;
  console.log('DEALS_FIRST_PAINT_OWNER_PROOF',JSON.stringify(first));
  const firstSemantic=!!first&&first.cards.length===DEAL_IDS.length&&first.cards.every(card=>card.summary&&card.ready&&card.slots.length===8);
  if(!firstSemantic)fail('DEALS_CARD_FIRST_PAINT_SEMANTIC',{first});

  const docsReady=await wait(page,ids=>ids.every(id=>{const card=document.querySelector(`[data-rona-deals-authoritative-list] [data-rona-canonical-deal-id="${id}"]`);return !!card?.querySelector('.rona-deal-documents-v5 button')}),DEAL_IDS,5000);
  if(!docsReady)fail('DEALS_DOCUMENTS_FIRST_PAINT_NOT_READY');
  await sleep(120);
  const pre=await snapshot(page);
  console.log('DEALS_PRE_OPEN_DOM_SEMANTIC_PROOF',JSON.stringify(pre));
  if(!semanticOk(pre))fail('DEALS_CARD_PRE_OPEN_SEMANTIC_OR_SOURCE',{pre});
  const overlapPre=noOverlapProof(pre);
  console.log('DEALS_PRE_OPEN_BOUNDING_BOX_PROOF',JSON.stringify(overlapPre));
  for(const row of overlapPre){if(Object.values(row.overlaps).some(v=>v>0))fail('DEALS_CARD_PRE_OPEN_OVERLAP',row);if(!row.amountStyle||['absolute','fixed'].includes(row.amountStyle.position)||row.amountStyle.transform!=='none'||!['auto','0'].includes(row.amountStyle.zIndex))fail('DEALS_CARD_AMOUNT_POSITION_HACK',row)}
  await page.screenshot({path:screenshotPre,fullPage:true});
  console.log('DEALS_PRE_OPEN_SCREENSHOT',screenshotPre);

  const foreignPre=await page.evaluate(values=>values.some(v=>String(document.querySelector('main')?.innerText||'').includes(v)),[FOREIGN_CLIENT,FOREIGN_CONTRACT,'QA FOREIGN BETA LLC','QA-EXT-B']);
  if(foreignPre)fail('DEALS_FOREIGN_CONTEXT_VISIBLE_PRE_OPEN');
  const counts=await page.evaluate(ids=>Object.fromEntries(ids.map(id=>[id,[...document.querySelectorAll(`[data-rona-deals-authoritative-list] [data-rona-canonical-deal-id="${id}"]`)].filter(n=>n.getBoundingClientRect().width>0&&n.getBoundingClientRect().height>0).length])),DEAL_IDS);
  console.log('DEALS_NO_DUPLICATE_PROOF',JSON.stringify(counts));
  if(DEAL_IDS.some(id=>counts[id]!==1))fail('DEALS_DUPLICATE_CARD',{counts});

  await page.evaluate(id=>document.querySelector(`[data-rona-deals-authoritative-list] [data-open-deal="${id}"]`)?.click(),DEAL_IDS[0]);
  const passportReady=await wait(page,id=>{const d=document.querySelector(`.rona-deal-command-center-v3[data-rona-authoritative-deal-id="${id}"][data-rona-authoritative-binding="authoritative-binding"]`);return !!d&&d.getBoundingClientRect().width>0},DEAL_IDS[0],5000);
  if(!passportReady)fail('PASSPORT_DID_NOT_OPEN');
  const lifecycleReady=passportReady&&await wait(page,id=>{const d=document.querySelector(`.rona-deal-command-center-v3[data-rona-authoritative-deal-id="${id}"]`),flow=d?.querySelector('#rona-deal-realization-flow-v3'),text=String(flow?.innerText||'');return /resource fixture status|Подтверждение ресурса/iu.test(text)&&!/Загрузка актуального статуса реализации/u.test(text)},DEAL_IDS[0],5000);
  if(passportReady&&!lifecycleReady)fail('PASSPORT_LIFECYCLE_NOT_READY');
  const passport=passportReady?await page.evaluate(id=>{const nrm=v=>String(v??'').replace(/\s+/g,' ').trim(),d=document.querySelector(`.rona-deal-command-center-v3[data-rona-authoritative-deal-id="${id}"]`),pairs=[...d.querySelectorAll('.pair,[data-rona-command-field]')].map(n=>nrm(n.innerText)),amountPair=pairs.find(x=>/Сумма/i.test(x))||'',flow=d.querySelector('#rona-deal-realization-flow-v3');return{id,amountPair,lifecycleOwner:flow?.dataset?.ronaRealizationOwner||'',lifecycleText:nrm(flow?.innerText),client:d.dataset.ronaAuthoritativeClientId,contract:d.dataset.ronaAuthoritativeContractId}},DEAL_IDS[0]):null;
  console.log('DEALS_PASSPORT_REGRESSION_PROOF',JSON.stringify(passport));
  const passportAmountDigits=String(passport?.amountPair||'').replace(/\D/g,'');
  if(!passport||passport.client!==CLIENT||passport.contract!==CONTRACT||!passportAmountDigits.includes(String(deals[0].passport_amount))||!passport.amountPair.includes('USD')||!/server-authoritative/i.test(passport.lifecycleOwner)||!/resource fixture status|Подтверждение ресурса/iu.test(passport.lifecycleText))fail('PASSPORT_AMOUNT_LIFECYCLE_REGRESSION',{passport});

  const closed=await page.evaluate(id=>{const d=document.querySelector(`.rona-deal-command-center-v3[data-rona-authoritative-deal-id="${id}"]`);if(!d)return false;const candidates=[...d.querySelectorAll('button,[role="button"],a')];const close=candidates.find(n=>/^(?:закрыть|×|✕|close)$/iu.test(String(n.getAttribute('aria-label')||n.getAttribute('title')||n.textContent||'').replace(/\s+/g,' ').trim()));if(close){close.click();return true}return false},DEAL_IDS[0]);
  if(!closed)await page.keyboard.press('Escape');
  await sleep(250);
  await nav(page,'deals');
  await sleep(180);
  const post=await snapshot(page);
  await page.screenshot({path:screenshotPost,fullPage:true});
  console.log('DEALS_POST_CLOSE_SCREENSHOT',screenshotPost);
  console.log('DEALS_POST_CLOSE_DOM_SEMANTIC_PROOF',JSON.stringify(post));
  const parityProof=parity(pre,post);
  console.log('DEALS_CARD_PRE_OPEN_POST_CLOSE_PARITY_PROOF',JSON.stringify(parityProof));
  if(!parityProof.ok)fail('DEALS_CARD_PRE_OPEN_POST_CLOSE_PARITY',parityProof);
  else console.log('DEALS_CARD_PRE_OPEN_POST_CLOSE_PARITY=PASS');
  const overlapPost=noOverlapProof(post);console.log('DEALS_POST_CLOSE_BOUNDING_BOX_PROOF',JSON.stringify(overlapPost));
  for(const row of overlapPost)if(Object.values(row.overlaps).some(v=>v>0))fail('DEALS_CARD_POST_CLOSE_OVERLAP',row);
  const foreignPost=await page.evaluate(values=>values.some(v=>String(document.querySelector('main')?.innerText||'').includes(v)),[FOREIGN_CLIENT,FOREIGN_CONTRACT,'QA FOREIGN BETA LLC','QA-EXT-B']);
  if(foreignPost)fail('DEALS_FOREIGN_CONTEXT_VISIBLE_POST_CLOSE');

  const contextRequests=requests.filter(r=>r.path==='/portal/api/v1/client/context');
  console.log('DEALS_CONTEXT_NETWORK_PROOF',JSON.stringify({contextRequests}));
  if(contextRequests.some(r=>r.client_id&&r.client_id!==CLIENT)||contextRequests.some(r=>r.contract_id&&r.contract_id!==CONTRACT))fail('DEALS_CONTEXT_REQUEST_SCOPE',{contextRequests});

  if(failures.length){console.log('DEALS_FIRST_PAINT_PARITY_RESULT=FAIL',JSON.stringify({label:LABEL,failures}));process.exitCode=1}
  else{
    console.log('DEALS_FIRST_PAINT_ASSERTION_SET=PASS',JSON.stringify({label:LABEL,assertions:['synchronous-first-render-semantic-slots','one-visible-card-per-authoritative-deal','passport-amount-source-visible','documents-first-paint','zero-prohibited-overlap','no-position-transform-zindex-repair','pre-open-post-close-parity','passport-amount-lifecycle-preserved','no-foreign-context']}));
    console.log('DEALS_FIRST_PAINT_PARITY_RESULT=PASS');
  }
}finally{if(browser)await browser.close();await stop(target.server)}
