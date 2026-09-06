import {writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const REPO=process.env.GITHUB_REPOSITORY||'rokotove26-png/ronatrade.com';
const HEAD=String(process.env.RONA_EXACT_HEAD||process.env.GITHUB_SHA||'').trim();
const GH_TOKEN=String(process.env.RONA_GITHUB_TOKEN||'').trim();
const ISSUER=String(process.env.RONA_QA_ISSUER_URL||'').trim();
const OIDC_AUDIENCE=String(process.env.RONA_OIDC_AUDIENCE||'rona-pr431-client-qa').trim();
const EXPECTED_BACKEND='PR429_EXISTING_CANDIDATE_SLOT';
const TARGET={clientId:'RONA-C002',contractId:'RONA-C002-CTR-2026-001',dealId:'DEAL-2026-004',amount:236250};
const FOREIGN=['RONA-C003','RONA-C004'];
const ARTIFACT='issue430-real-authenticated-lifecycle-proof.json';
if(!/^[0-9a-f]{40}$/i.test(HEAD))throw new Error('EXACT_HEAD_REQUIRED');
if(!GH_TOKEN)throw new Error('GITHUB_TOKEN_REQUIRED');
if(!ISSUER.startsWith('https://'))throw new Error('QA_ISSUER_URL_REQUIRED');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const compact=v=>String(v??'').replace(/\s+/gu,'').toUpperCase();

async function githubJson(path){const r=await fetch(`https://api.github.com/repos/${REPO}${path}`,{headers:{accept:'application/vnd.github+json','x-github-api-version':'2022-11-28',authorization:`Bearer ${GH_TOKEN}`}});if(!r.ok)throw new Error(`GITHUB_HTTP_${r.status}`);return r.json()}
async function exactPreview(){for(let i=0;i<72;i++){const data=await githubJson(`/commits/${HEAD}/check-runs?per_page=100`),runs=Array.isArray(data?.check_runs)?data.check_runs:[],run=runs.find(x=>x?.name==='Cloudflare Pages'&&x?.head_sha===HEAD&&x?.status==='completed'&&x?.conclusion==='success'),summary=String(run?.output?.summary||''),urls=[...summary.matchAll(/https:\/\/[0-9a-f]{8}\.rona-trade-public\.pages\.dev/ig)].map(m=>m[0]);if(run&&urls.length===1)return{origin:urls[0],checkRunId:run.id};await sleep(5000)}throw new Error('EXACT_HEAD_CLOUDFLARE_PREVIEW_NOT_READY')}
async function oidcToken(){const base=String(process.env.ACTIONS_ID_TOKEN_REQUEST_URL||''),bearer=String(process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN||'');if(!base||!bearer)throw new Error('GITHUB_OIDC_ENV_REQUIRED');const u=new URL(base);u.searchParams.set('audience',OIDC_AUDIENCE);const r=await fetch(u,{headers:{authorization:`Bearer ${bearer}`,accept:'application/json'}}),b=await r.json().catch(()=>null);if(!r.ok||!b?.value)throw new Error(`GITHUB_OIDC_HTTP_${r.status}`);const token=String(b.value);console.log(`::add-mask::${token}`);return token}
async function issue(oidc){const r=await fetch(ISSUER,{method:'POST',headers:{authorization:`Bearer ${oidc}`,'content-type':'application/json',accept:'application/json'},body:JSON.stringify({clientId:TARGET.clientId,contractId:TARGET.contractId})}),b=await r.json().catch(()=>null);if(!r.ok||b?.ok!==true||!b?.access_token||!b?.refresh_token)throw new Error(`QA_SESSION_ISSUER_HTTP_${r.status}_${String(b?.code||'INVALID_RESPONSE')}`);const access=String(b.access_token),refresh=String(b.refresh_token);console.log(`::add-mask::${access}`);console.log(`::add-mask::${refresh}`);return{access,refresh}}
async function cleanup(oidc,session){const r=await fetch(`${ISSUER.replace(/\/+$/,'')}/cleanup`,{method:'POST',headers:{authorization:`Bearer ${oidc}`,'content-type':'application/json',accept:'application/json'},body:JSON.stringify({clientId:TARGET.clientId,contractId:TARGET.contractId,accessToken:session.access})}),b=await r.json().catch(()=>null);if(!r.ok||b?.ok!==true||b?.cleanup!=='REVOKED')throw new Error(`QA_SESSION_CLEANUP_HTTP_${r.status}_${String(b?.code||'INVALID_RESPONSE')}`);return true}
async function ensureContext(page){await page.waitForFunction(()=>Boolean(window.RONA_CLIENT_CONTEXT?.whenReady&&window.RONA_CLIENT_CONTEXT?.getCurrentContext),null,{timeout:15000});await page.evaluate(async t=>{const a=window.RONA_CLIENT_CONTEXT;await a.whenReady();const c=a.getCurrentContext?.();if(!c||String(c.client_id)!==t.clientId||String(c.contract_id)!==t.contractId)await a.select(t.clientId,t.contractId)},TARGET);await page.waitForFunction(t=>{const a=window.RONA_CLIENT_CONTEXT,c=a?.getCurrentContext?.(),p=a?.getCurrentProjection?.();return String(c?.client_id||'')===t.clientId&&String(c?.contract_id||'')===t.contractId&&String(p?.contract?.client_id||'')===t.clientId&&String(p?.contract?.contract_id||'')===t.contractId},TARGET,{timeout:20000})}
async function navDeals(page){const b=page.locator('#nav [data-page="deals"],[data-rona-client-nav] [data-page="deals"],nav [data-page="deals"]').first();await b.waitFor({state:'visible',timeout:10000});await b.click();const card=page.locator(`[data-rona-canonical-deal-id="${TARGET.dealId}"]`).first();await card.waitFor({state:'visible',timeout:15000});const text=await card.innerText();if(!compact(text).includes(`${TARGET.amount}USD`))throw new Error('C002_RELOAD_DEAL_AMOUNT_MISSING')}
async function isolation(page){const result=await page.evaluate(ids=>{const body=String(document.body?.innerText||''),attrs=[...document.querySelectorAll('[data-rona-client-id]')].map(x=>String(x.getAttribute('data-rona-client-id')||''));return{foreignText:ids.some(x=>body.includes(x)),foreignAttr:ids.some(x=>attrs.includes(x))}},FOREIGN);if(result.foreignText||result.foreignAttr)throw new Error(`REAL_AUTH_FOREIGN_DOM_${JSON.stringify(result)}`);return result}
async function exercise(browser,preview,session,label){const host=new URL(preview.origin).hostname,ctx=await browser.newContext();await ctx.addCookies([{name:'rona_portal_at',value:session.access,domain:host,path:'/portal',secure:true,httpOnly:true,sameSite:'Lax'},{name:'rona_portal_rt',value:session.refresh,domain:host,path:'/portal',secure:true,httpOnly:true,sameSite:'Lax'}]);const page=await ctx.newPage();let boundary=null;page.on('response',r=>{try{const u=new URL(r.url());if(u.origin===preview.origin&&u.pathname==='/portal/api/v1/client/context'&&u.searchParams.get('clientId')===TARGET.clientId&&u.searchParams.get('contractId')===TARGET.contractId)boundary=r.headers()['x-rona-client-context-backend']||null}catch{}});const cycles=[];for(let cycle=0;cycle<3;cycle++){if(cycle===0)await page.goto(`${preview.origin}/portal/client`,{waitUntil:'domcontentloaded',timeout:30000});else await page.reload({waitUntil:'domcontentloaded',timeout:30000});await ensureContext(page);for(let i=0;i<50&&!boundary;i++)await sleep(100);if(boundary!==EXPECTED_BACKEND)throw new Error(`${label}_CANDIDATE_BOUNDARY_${String(boundary||'MISSING')}`);await navDeals(page);const foreign=await isolation(page);cycles.push({cycle,boundary,foreign})}await ctx.close();return{label,cycles}}

const preview=await exactPreview(),oidc=await oidcToken(),browser=await chromium.launch({headless:true});
const proof={schema:'ISSUE430_REAL_AUTHENTICATED_LIFECYCLE_PROOF_V1',exact_head:HEAD,immutable_preview:`${preview.origin}/portal/client`,cloudflare_check_run_id:preview.checkRunId,cold_reload:null,relogin:null,cleanup:{first:false,second:false}};
try{
  const first=await issue(oidc);try{proof.cold_reload=await exercise(browser,preview,first,'FIRST_LOGIN')}finally{proof.cleanup.first=await cleanup(oidc,first)}
  const second=await issue(oidc);try{proof.relogin=await exercise(browser,preview,second,'SECOND_LOGIN')}finally{proof.cleanup.second=await cleanup(oidc,second)}
}finally{await browser.close()}
if(!proof.cleanup.first||!proof.cleanup.second)throw new Error('QA_SESSION_CLEANUP_NOT_CONFIRMED');
await writeFile(ARTIFACT,JSON.stringify(proof,null,2)+'\n','utf8');
console.log('REAL_AUTH_COLD_LOAD=PASS');
console.log('REAL_AUTH_RELOAD_CYCLES=PASS count=2');
console.log('REAL_AUTH_LOGOUT_LOGIN=PASS');
console.log('REAL_AUTH_CONTEXT_ISOLATION=PASS');
console.log(`REAL_AUTH_CANDIDATE_BOUNDARY=${EXPECTED_BACKEND}`);
console.log('REAL_AUTH_SESSION_CLEANUP=PASS');
