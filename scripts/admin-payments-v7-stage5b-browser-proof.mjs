import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { recoverLiveAdminWorkspace } from './admin-payments-v7-stage5b-live-source.mjs';

const ARTIFACT_DIR = join(process.cwd(), 'stage5b-artifacts');
mkdirSync(ARTIFACT_DIR, { recursive: true });

const money=(amount,currency,status='AUTHORITATIVE')=>({amount:amount===null?null:String(amount),currency,status,reason:null,authority_refs:[{source_type:'STAGE5B_ACCEPTANCE',source_id:null,source_version:'CURRENT_V7'}]});
const deal=({id,client,total,received,expected,conditional='0',progress})=>({
  deal_id:id,client_display:client,payment_handoff_state:'READY',
  accounting_currency:{currency:total.currency,status:'AUTHORITATIVE',reason:null,authority_refs:[]},
  total_to_receive:total,verified_received:received,due_now:money('0',total.currency),expected_not_due:expected,future_conditional:money(conditional,total.currency),
  remaining_to_receive:money(Number(total.amount)-Number(received.amount),total.currency),actual_spend:money(null,total.currency,'TO_VERIFY'),actual_spend_status:'TO_VERIFY',remaining_execution:money(null,total.currency,'TO_VERIFY'),
  payment_progress:{percent:String(progress),status:'AUTHORITATIVE',reason:null},financial_status:Number(received.amount)===Number(total.amount)?'PAID':'EXPECTED',documentary_status:'TO_VERIFY',exceptions:[],authority_refs:[]
});
const projection={contract:'ADMIN_PAYMENTS_V7',generated_at:'2026-09-13T17:00:00Z',source_as_of:'2026-09-13T17:00:00Z',deals:[
  deal({id:'DEAL-2026-004',client:'FARGONA',total:money('236250','USD'),received:money('236250','USD'),expected:money('0','USD'),progress:'100'}),
  deal({id:'DEAL-2026-005',client:'UNVERSAL SOLYARIS GRAND',total:money('672500','USD'),received:money('201750','USD'),expected:money('470750','USD'),progress:'30'}),
  deal({id:'DEAL-2026-006',client:'UNVERSAL SOLYARIS GRAND',total:money('164400','USD'),received:money('49320','USD'),expected:money('115080','USD'),progress:'30'}),
  deal({id:'DEAL-2026-009',client:'ГазОнэ',total:money('31002300','RUB'),received:money('0','RUB'),expected:money('9300690','RUB'),conditional:'21701610',progress:'0'})
],owner_exception_queue:[],payment_exceptions:[],materialization_gaps:[],reconciliation_summary:{}};

const legacySummaries=[
  {deal_id:'DEAL-2026-004',client_name:'FARGONA',obligation_amount:236250,received_amount:236250,client_remaining_amount:0,currency:'USD',finance_status:'PAID',accounting_status:'OPEN'},
  {deal_id:'DEAL-2026-005',client_name:'UNVERSAL SOLYARIS GRAND',obligation_amount:672500,received_amount:201750,client_remaining_amount:470750,currency:'USD',finance_status:'NOT_DUE',accounting_status:'OPEN'},
  {deal_id:'DEAL-2026-006',client_name:'UNVERSAL SOLYARIS GRAND',obligation_amount:164400,received_amount:49320,client_remaining_amount:115080,currency:'USD',finance_status:'NOT_DUE',accounting_status:'OPEN'},
  {deal_id:'DEAL-2026-009',client_name:'ГазОнэ',obligation_amount:362600,received_amount:0,client_remaining_amount:362600,currency:'USD',finance_status:'NOT_DUE',accounting_status:'OPEN'}
];
const financeFragment={sourceAsOf:'2026-09-13',paymentTotalsByCurrency:[{currency:'USD',amount:487320}],paidDealTotalsByCurrency:[],outgoingPayments:[],payments:[],incomingPayments:[],paymentAllocations:[],incomingPaymentAllocations:[],dealFinanceSummaries:legacySummaries,dealFinanceCurrentState:legacySummaries,obligationPlanAvailable:true,cash:[]};
const adminSync={generatedAt:'2026-09-13T17:00:00Z',financeFragment,paymentsV7Projection:projection,railTariffs:[],aiEmployees:[],latestAiConclusions:[],homeCoordination:{generatedAt:'2026-09-13T17:00:00Z',totals:{TODAY:{sent:0,responses:0,awaiting:0,slaBreached:0,errors:0,portalRequests:0},'7D':{},'30D':{},ALL:{sent:0,responses:0,awaiting:0,slaBreached:0,errors:0,portalRequests:0}},periods:{TODAY:[],'7D':[],'30D':[],ALL:[]},recent:[]},aiRuntime:{enabled:true,scheduler_state:'ENABLED'}};
const bootstrap={applications:[],deals:legacySummaries.map(x=>({deal_id:x.deal_id,finance_status:x.finance_status,business_status:'ACTIVE',lifecycle_state:'ACTIVE'})),documents:[],prices:[],clients:[],companies:[],agents:[],rail:[],claims:[],radio:[],cash:[],analytics:[]};

function browserExecutable(){for(const name of ['google-chrome','google-chrome-stable','chromium','chromium-browser']){try{return execFileSync('which',[name],{encoding:'utf8'}).trim()}catch{}}throw new Error('STAGE5B_BROWSER_NOT_FOUND')}

async function compileMain({patched}){
  const root=mkdtempSync(join(tmpdir(),patched?'rona-stage5b-after-':'rona-stage5b-before-'));
  recoverLiveAdminWorkspace(root);
  if(!patched){const original=readFileSync(join(root,'functions/portal/admin-main-ui-current.live-original.js'),'utf8');writeFileSync(join(root,'functions/portal/admin-main-ui-current.js'),original)}
  const mod=await import(`${pathToFileURL(join(root,'functions/portal/main-ui/index.js')).href}?mode=${patched?'after':'before'}-${Date.now()}`);
  const response=await mod.onRequest({});
  return{root,source:await response.text(),html:readFileSync(join(root,'portal-src/current/admin.html'),'utf8'),shell:readFileSync(join(root,'assets/portal-admin-shell-fast-v1.js'),'utf8')};
}

function driverScript(mode){return `(()=>{const sleep=ms=>new Promise(r=>setTimeout(r,ms));const proof={mode:${JSON.stringify(mode)}};async function waitFor(fn,timeout=10000){const end=Date.now()+timeout;while(Date.now()<end){try{if(fn())return true}catch{}await sleep(100)}return false}async function run(){await waitFor(()=>window.__RONA_OWNER_ADMIN_READY__===true,10000);await waitFor(()=>window.__RONA_OWNER_AI_SYNC_SNAPSHOT__,10000);const top=document.querySelector('.topbar'),side=document.querySelector('.sidebar'),nav=document.querySelector('#nav'),top0=top?.innerHTML,side0=side?.innerHTML,navCount0=nav?.querySelectorAll('button[data-page]').length||0;const pay=nav?.querySelector('button[data-page="payments"]');pay?.click();if(${JSON.stringify(mode)}==='after')await waitFor(()=>document.querySelector('#page-payments .rona-payments-v7'),10000);else await waitFor(()=>document.querySelector('#page-payments')?.textContent?.includes('Поступило от клиентов'),10000);await sleep(250);const page=document.querySelector('#page-payments'),text0=page?.innerText||'';proof.firstOwnerCount=page?.querySelectorAll('.rona-payments-v7').length||0;proof.routeOwner=page?.querySelector('[data-rona-payments-owner]')?.getAttribute('data-rona-payments-owner')||page?.querySelector('[data-rona-payments-owner]')?.dataset?.ronaPaymentsOwner||'';proof.legacyContent=/Поступило от клиентов/.test(text0);proof.legacy362600=/362[\\s\\u00a0]*600\\s*USD/.test(text0);proof.hasV7Values=/236[\\s\\u00a0]*250\\s*USD/.test(text0)&&/672[\\s\\u00a0]*500\\s*USD/.test(text0)&&/201[\\s\\u00a0]*750\\s*USD/.test(text0)&&/470[\\s\\u00a0]*750\\s*USD/.test(text0)&&/164[\\s\\u00a0]*400\\s*USD/.test(text0)&&/49[\\s\\u00a0]*320\\s*USD/.test(text0)&&/115[\\s\\u00a0]*080\\s*USD/.test(text0)&&/31[\\s\\u00a0]*002[\\s\\u00a0]*300\\s*RUB/.test(text0)&&/9[\\s\\u00a0]*300[\\s\\u00a0]*690\\s*RUB/.test(text0)&&/21[\\s\\u00a0]*701[\\s\\u00a0]*610\\s*RUB/.test(text0);proof.ownerQueueVisible=!!page?.querySelector('.rona-payments-v7-owner');const grid=page?.querySelector('.rona-payments-v7-kpis');proof.kpiCount=grid?.children?.length||0;proof.gridColumns=grid?getComputedStyle(grid).gridTemplateColumns.split(/\\s+/).filter(Boolean).length:0;proof.paymentsOverflow=!!page&&page.scrollWidth>page.clientWidth+1;nav?.querySelector('button[data-page="home"]')?.click();await sleep(100);pay?.click();await sleep(250);proof.secondOwnerCount=page?.querySelectorAll('.rona-payments-v7').length||0;proof.headerPreserved=top0===top?.innerHTML;proof.sidebarPreserved=side0===side?.innerHTML;proof.navPreserved=navCount0===(nav?.querySelectorAll('button[data-page]').length||0);const pre=document.createElement('pre');pre.id='stage5b-browser-proof';pre.textContent=JSON.stringify(proof);document.body.appendChild(pre);document.documentElement.dataset.stage5bProof='ready'}run()})();`}
function htmlFor(compiled,mode){return compiled.html.replace('</body>',`<script>${driverScript(mode).replaceAll('</script>','<\\/script>')}</script></body>`)}

async function withServer(compiled,mode,fn){
  const html=htmlFor(compiled,mode);
  const server=createServer((req,res)=>{const url=new URL(req.url,'http://127.0.0.1'),path=url.pathname,json=body=>{res.writeHead(200,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(body))};
    if(path==='/portal/admin'||path==='/'){res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(html);return}
    if(path==='/assets/portal-admin-shell-fast-v1.js'){res.writeHead(200,{'content-type':'application/javascript; charset=utf-8'});res.end(compiled.shell);return}
    if(path==='/portal/main-ui'){res.writeHead(200,{'content-type':'application/javascript; charset=utf-8'});res.end(compiled.source);return}
    if(path==='/portal/api/session/me'){json({ok:true,user:{id:'stage5b'}});return}
    if(path==='/portal/owner-api'&&url.searchParams.get('path')==='/admin/ai-sync'){json({ok:true,data:adminSync});return}
    if(path==='/portal/admin-completed-bootstrap'){json({ok:true,data:bootstrap});return}
    if(path.startsWith('/portal/admin-authority/agent-readiness')){json({ok:true,data:{matrixReady:true}});return}
    if(path.startsWith('/portal/admin-authority/')){json({ok:true,data:{}});return}
    if(path.startsWith('/portal/api')){json({ok:true,data:bootstrap});return}
    if(path==='/portal/rail-current-v81-maplibre-ui'){res.writeHead(200,{'content-type':'application/javascript'});res.end("window.__RONA_RAIL_CURRENT_V81__=true;const x=document.createElement('div');x.hidden=true;x.setAttribute('data-rail-current-root','ready');document.body.append(x);");return}
    if(path==='/portal/analytics-v2-ui'){res.writeHead(200,{'content-type':'application/javascript'});res.end('window.__RONA_ANALYTICS_V2_READY__=true;');return}
    if(path.endsWith('.js')||path.startsWith('/portal/')){res.writeHead(200,{'content-type':'application/javascript; charset=utf-8'});res.end(';');return}
    res.writeHead(204);res.end();
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});const address=server.address();try{return await fn(`http://127.0.0.1:${address.port}/portal/admin`)}finally{await new Promise(resolve=>server.close(resolve))}
}

async function runChrome(url,width,height,screenshot){const browser=browserExecutable(),args=['--headless=new','--no-sandbox','--disable-gpu','--hide-scrollbars','--disable-dev-shm-usage',`--window-size=${width},${height}`,'--virtual-time-budget=12000','--dump-dom',`--screenshot=${screenshot}`,url];return new Promise((resolve,reject)=>{const child=spawn(browser,args,{stdio:['ignore','pipe','pipe']});let out='',err='';child.stdout.on('data',d=>out+=d);child.stderr.on('data',d=>err+=d);child.on('error',reject);child.on('close',code=>code===0?resolve(out):reject(new Error(`CHROME_${code}:${err.slice(-4000)}`)))})}
function proofFromDom(dom){const m=dom.match(/<pre id="stage5b-browser-proof">([^<]+)<\/pre>/);if(!m)throw new Error('STAGE5B_BROWSER_PROOF_MISSING');return JSON.parse(m[1].replaceAll('&quot;','"').replaceAll('&amp;','&').replaceAll('&#39;',"'").replaceAll('&lt;','<').replaceAll('&gt;','>'))}

const before=await compileMain({patched:false}),after=await compileMain({patched:true});
try{
  const beforeDom=await withServer(before,'before',url=>runChrome(url,1440,1100,join(ARTIFACT_DIR,'before-live-legacy-desktop.png'))),beforeProof=proofFromDom(beforeDom);assert.equal(beforeProof.legacyContent,true);assert.equal(beforeProof.legacy362600,true);
  const sizes=[['desktop',1440,1100,4],['medium',900,1100,2],['mobile',600,1300,1]],afterProofs={};
  for(const [name,w,h,cols] of sizes){const dom=await withServer(after,'after',url=>runChrome(url,w,h,join(ARTIFACT_DIR,`after-v7-${name}.png`))),p=proofFromDom(dom);afterProofs[name]=p;assert.equal(p.firstOwnerCount,1,`${name}: first owner`);assert.equal(p.secondOwnerCount,1,`${name}: second owner`);assert.equal(p.routeOwner,'admin-payments-v7-native',`${name}: owner marker`);assert.equal(p.legacyContent,false,`${name}: legacy content`);assert.equal(p.legacy362600,false,`${name}: legacy amount`);assert.equal(p.hasV7Values,true,`${name}: V7 values`);assert.equal(p.ownerQueueVisible,false,`${name}: empty queue hidden`);assert.equal(p.kpiCount,4,`${name}: kpi count`);assert.equal(p.gridColumns,cols,`${name}: columns`);assert.equal(p.paymentsOverflow,false,`${name}: viewport overflow`);assert.equal(p.headerPreserved,true,`${name}: header`);assert.equal(p.sidebarPreserved,true,`${name}: sidebar`);assert.equal(p.navPreserved,true,`${name}: nav`)}
  const result={before:beforeProof,after:afterProofs};writeFileSync(join(ARTIFACT_DIR,'browser-proof.json'),JSON.stringify(result,null,2));console.log('STAGE5B_BROWSER_PASS',JSON.stringify(result));
}finally{rmSync(before.root,{recursive:true,force:true});rmSync(after.root,{recursive:true,force:true})}
