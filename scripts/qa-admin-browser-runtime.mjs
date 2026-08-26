import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';
import { onRequest as mainUiRequest } from '../functions/portal/main-ui.js';

const ROOT=process.cwd();
const DIST=join(ROOT,'dist');
const now=new Date().toISOString();
const adminBootstrap={
  clients:[{client_id:'RONA-QA-C001',legal_name:'QA Client',contract_id:'RONA-QA-CTR-001',current_external_contract_number:'QA-001',agent_person_id:'RONA-QA-A001'}],
  companies:[{client_id:'RONA-QA-C001',legal_name:'QA Client',contract_id:'RONA-QA-CTR-001',current_external_contract_number:'QA-001',agent_person_id:'RONA-QA-A001'}],
  agents:[{agent_person_id:'RONA-QA-A001',agent_name:'QA Agent'}],
  applications:[],deals:[],documents:[],payments:[],cash:[],rail:[],publications:[],operationalConflicts:[],claims:[],
  agentRewards:[{agent_person_id:'RONA-QA-A001',agent_name:'QA Agent',deal_id:'QA-DEAL-001',amount:100,currency:'USD',status:'DUE',created_at:now}]
};
const zero={sent:0,responses:0,awaiting:0,slaBreached:0,errors:0,portalRequests:0};
const aiSync={
  generatedAt:now,
  marketAnalystFragment:{generatedAt:now,analytics:[],news:[],currentPublications:[]},
  homeCoordination:{generatedAt:now,totals:{TODAY:zero,'7D':zero,'30D':zero,ALL:zero},periods:{TODAY:[],'7D':[],'30D':[],ALL:[]},recent:[]},
  aiRuntime:{enabled:true,scheduler_state:'ENABLED',worker_version:'qa-browser'}
};
const authority={
  accessUsers:[],
  contracts:[{contractId:'RONA-QA-CTR-001',id:'RONA-QA-CTR-001',contractStatus:'ACTIVE',status:'ACTIVE',clientId:'RONA-QA-C001',company:'QA Client',externalContractNumber:'QA-001'}]
};

const mainResponse=await mainUiRequest();
const mainUi=await mainResponse.text();

function send(res,status,body,type='text/plain; charset=utf-8',headers={}){
  res.writeHead(status,{'content-type':type,'cache-control':'no-store',...headers});
  res.end(body);
}
function json(res,data,status=200){send(res,status,JSON.stringify(data),'application/json; charset=utf-8')}
function safeDistPath(pathname){
  const clean=normalize(pathname).replace(/^([.][.][/\\])+/, '').replace(/^[/\\]+/,'');
  const full=join(DIST,clean);
  return full.startsWith(DIST)?full:null;
}
function mime(path){const e=extname(path).toLowerCase();return e==='.html'?'text/html; charset=utf-8':e==='.js'?'application/javascript; charset=utf-8':e==='.css'?'text/css; charset=utf-8':e==='.svg'?'image/svg+xml':e==='.png'?'image/png':'application/octet-stream'}
async function serveFile(res,path,contentType){try{const b=await readFile(path);send(res,200,b,contentType||mime(path));return true}catch{return false}}

const optionalUiPaths=new Set([
  '/portal/deals-current-state-ui','/portal/deals-r1-r11-ui','/portal/cash-r2-ui','/portal/rail-current-v81-maplibre-ui','/portal/applications-total-kpi-ui','/portal/prices-current-ui'
]);
const server=http.createServer(async(req,res)=>{
  const u=new URL(req.url||'/', 'http://127.0.0.1');
  const p=u.pathname;
  if(p==='/portal/admin')return void await serveFile(res,join(DIST,'portal','admin.html'),'text/html; charset=utf-8');
  if(p==='/portal/main-ui')return send(res,200,mainUi,'application/javascript; charset=utf-8');
  if(p==='/portal/clients-agents-current-ui'||p==='/portal/claims-r2-ui'||p==='/portal/remaining-sections-ui')return void await serveFile(res,join(DIST,p),'application/javascript; charset=utf-8');
  if(optionalUiPaths.has(p))return send(res,200,'/* QA optional current module */','application/javascript; charset=utf-8');
  if(p==='/portal/api/session/me')return json(res,{ok:true,user:{roles:['ADMIN'],display_name:'QA Admin'}});
  if(p==='/portal/logout')return json(res,{ok:true});
  if(p==='/portal/admin-authority/bootstrap')return json(res,{ok:true,data:authority});
  if(p==='/portal/admin-authority/agent-readiness')return json(res,{ok:true,data:{matrixReady:true}});
  if(p.startsWith('/portal/admin-authority/'))return json(res,{ok:true,data:{}});
  if(p==='/portal/owner-api'){
    const ownerPath=u.searchParams.get('path')||'';
    if(ownerPath==='/admin/bootstrap')return json(res,{ok:true,data:adminBootstrap});
    if(ownerPath==='/admin/ai-sync')return json(res,{ok:true,data:aiSync});
    if(ownerPath==='/admin/claims')return json(res,{ok:true,data:{claims:[]}});
    return json(res,{ok:true,data:{}});
  }
  const f=safeDistPath(p);
  if(f&&await serveFile(res,f))return;
  send(res,404,'not found');
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
const address=server.address();
const origin=`http://127.0.0.1:${address.port}`;

const failures=[];
const notes=[];
const assert=(v,m)=>{if(!v)throw new Error(m)};
async function stableSelection(page,key,wait=900){
  await page.waitForTimeout(wait);
  const state=await page.evaluate(k=>({
    dataset:document.documentElement.dataset.ronaAdminPage||'',
    activeNav:Array.from(document.querySelectorAll('#nav button[data-page].active')).map(x=>x.dataset.page),
    aria:Array.from(document.querySelectorAll('#nav button[data-page][aria-current="page"]')).map(x=>x.dataset.page),
    activePages:Array.from(document.querySelectorAll('#current-admin-main>.page.active')).map(x=>x.id.replace(/^page-/,''))
  }),key);
  assert(state.dataset===key,`${key}: dataset switched to ${state.dataset}`);
  assert(state.activeNav.length===1&&state.activeNav[0]===key,`${key}: active nav ${JSON.stringify(state.activeNav)}`);
  assert(state.aria.length===1&&state.aria[0]===key,`${key}: aria current ${JSON.stringify(state.aria)}`);
  assert(state.activePages.length===1&&state.activePages[0]===key,`${key}: active pages ${JSON.stringify(state.activePages)}`);
}
async function clickSection(page,key){
  const b=page.locator(`#nav button[data-page="${key}"]`);
  await b.waitFor({state:'visible',timeout:10000});
  await b.click();
  await page.locator(`#page-${key}.active`).waitFor({state:'visible',timeout:10000});
  await stableSelection(page,key);
}

let browser;
try{
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1920,height:1080}});
  const page=await context.newPage();
  page.on('pageerror',e=>failures.push(`pageerror:${String(e.message||e)}`));
  page.on('console',m=>{if(m.type()==='error')failures.push(`console:${m.text()}`)});
  await page.goto(origin+'/portal/admin',{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>window.__RONA_ADMIN_CURRENT_ROUTER__==='current-only-router-v2',{timeout:10000});
  await page.waitForFunction(()=>window.__RONA_OWNER_ADMIN_READY__===true,{timeout:15000});
  await page.waitForTimeout(600);

  const visual=await page.evaluate(()=>{
    const side=document.querySelector('.sidebar'),nav=document.querySelector('#nav button[data-page="home"]'),app=document.querySelector('.app');
    const ss=getComputedStyle(side),ns=getComputedStyle(nav),as=getComputedStyle(app);
    return{sidebarWidth:side.getBoundingClientRect().width,rowHeight:nav.getBoundingClientRect().height,fontSize:parseFloat(ns.fontSize),grid:as.gridTemplateColumns,sidebarBackground:ss.backgroundImage};
  });
  assert(visual.sidebarWidth>=260,`sidebar too small: ${visual.sidebarWidth}`);
  assert(visual.rowHeight>=46,`nav row too small: ${visual.rowHeight}`);
  assert(visual.fontSize>=14,`nav font too small: ${visual.fontSize}`);
  notes.push({visual});

  await clickSection(page,'access');
  await page.locator('#page-access #rona-ca4').waitFor({state:'visible',timeout:10000});
  const create=page.locator('#page-access #rona-ca4 button[data-rona-create-access="primary"]');
  await create.waitFor({state:'visible',timeout:10000});
  await create.click();
  const modal=page.locator('.ca-modal');
  await modal.waitFor({state:'visible',timeout:5000});
  assert((await modal.innerText()).includes('Тип доступа'),'access modal: Тип доступа missing');
  assert((await modal.innerText()).includes('Договоры клиента'),'access modal: Договоры клиента missing');
  const role=modal.locator('select').first();
  await role.selectOption({label:'Агент'});
  await page.waitForTimeout(100);
  assert((await modal.innerText()).includes('Профиль агента'),'access modal: Профиль агента missing');
  await modal.locator('button:has-text("Отмена")').click();
  await stableSelection(page,'access',1200);

  // Deliberately emulate a late competing runtime mutation. The current router must restore the user's explicit page.
  await page.evaluate(()=>{
    document.querySelector('#nav button[data-page="access"]')?.classList.remove('active');
    document.querySelector('#nav button[data-page="home"]')?.classList.add('active');
    document.querySelector('#page-access')?.classList.remove('active');
    document.querySelector('#page-home')?.classList.add('active');
  });
  await stableSelection(page,'access',250);

  await clickSection(page,'claims');
  await page.locator('#page-claims .rona-claims-r2-root').waitFor({state:'visible',timeout:10000});
  assert((await page.locator('#page-claims').innerText()).includes('Претензии'),'claims functional page did not render');
  await stableSelection(page,'claims',1200);

  await clickSection(page,'agent-settlements');
  await page.locator('#page-agent-settlements .rona-rs-root[data-kind="rewards"]').waitFor({state:'visible',timeout:10000});
  assert((await page.locator('#page-agent-settlements').innerText()).includes('Вознаграждения агентов'),'agent rewards functional page did not render');
  await stableSelection(page,'agent-settlements',1200);

  for(let i=0;i<3;i++){
    for(const key of ['access','claims','agent-settlements'])await clickSection(page,key);
  }
  await page.waitForTimeout(1200);
  await stableSelection(page,'agent-settlements',0);

  const runtime=await page.evaluate(()=>({
    shell:window.__RONA_ADMIN_CURRENT_SHELL__,router:window.__RONA_ADMIN_CURRENT_ROUTER__,runtime:window.__RONA_ADMIN_RUNTIME_OWNER__,
    access:window.__RONA_CLIENTS_AGENTS_CURRENT__,accessReady:window.__RONA_CLIENTS_AGENTS_CURRENT_READY__,claims:window.__RONA_CLAIMS_R2_UI__,remaining:window.__RONA_REMAINING_SECTIONS_R2__,
    moduleErrors:window.__RONA_ADMIN_SHELL_OPTIONAL_ERRORS__||[]
  }));
  assert(runtime.shell==='current-only-v2','wrong shell '+runtime.shell);
  assert(runtime.router==='current-only-router-v2','wrong router '+runtime.router);
  assert(runtime.runtime==='single-owner-v3','wrong runtime '+runtime.runtime);
  assert(runtime.accessReady===true,'Clients/Agents module never became ready');
  assert(!!runtime.claims,'Claims module marker absent');
  assert(!!runtime.remaining,'Remaining sections module marker absent');
  assert(!runtime.moduleErrors.some(x=>String(x.stage||'').includes('claims')||String(x.stage||'').includes('remaining')||String(x.stage||'').includes('clients-agents')),'functional module load errors '+JSON.stringify(runtime.moduleErrors));
  assert(failures.length===0,'browser errors: '+failures.join(' | '));
  console.log('ADMIN_REAL_BROWSER_RUNTIME_QA=PASS');
  console.log(JSON.stringify({origin,visual,runtime,failures,notes}));
  await context.close();
}catch(e){
  console.error('ADMIN_REAL_BROWSER_RUNTIME_QA=FAIL',e?.stack||e);
  if(failures.length)console.error(JSON.stringify({failures}));
  process.exitCode=1;
}finally{
  if(browser)await browser.close().catch(()=>{});
  await new Promise(resolve=>server.close(resolve));
}
