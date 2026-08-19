// Canonical portal interfaces are frozen. Agent and Client pass through byte-for-byte.
// Admin receives nonvisual technical scripts required by the existing
// server-authenticated canonical boot path. They do not rewrite canonical DOM,
// CSS, navigation, controls, or permanent business interface structure.

const ADMIN_EXTERNAL_RESOURCE_GUARD = `<script id="rona-admin-external-resource-guard">(()=>{'use strict';if(window.__RONA_ADMIN_EXTERNAL_RESOURCE_GUARD__)return;window.__RONA_ADMIN_EXTERNAL_RESOURCE_GUARD__=true;window.addEventListener('error',event=>{const target=event&&event.target;if(!target||target===window)return;const src=String(target.src||target.href||'');if(src.startsWith('https://static.cloudflareinsights.com/beacon.min.js/'))event.stopImmediatePropagation()},true)})();<\/script>`;

const ADMIN_LIVE_AUTHORITY_ADAPTER = `<script id="rona-admin-live-authority-adapter">(()=>{'use strict';
if(window.__RONA_ADMIN_LIVE_AUTHORITY_ADAPTER__)return;
window.__RONA_ADMIN_LIVE_AUTHORITY_ADAPTER__=true;
window.__RONA_ADMIN_LIVE_READY__=false;
window.__RONA_ADMIN_LIVE_ERROR__=null;
window.__RONA_ADMIN_AGENT_ACCESS_READY__=false;
const BASE='/portal/admin-authority';
const h=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c]));
async function call(path,options){const init=Object.assign({credentials:'same-origin',cache:'no-store',headers:{}},options||{});const r=await fetch(BASE+path,init);const j=await r.json().catch(()=>({}));if(!r.ok||j?.ok===false){const e=new Error(String(j?.code||('HTTP_'+r.status)));e.code=String(j?.code||'REQUEST_FAILED');e.status=r.status;e.payload=j;throw e}return j}
async function coreBootstrap(){const r=await fetch('/portal/api/v1/admin/bootstrap',{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}});const j=await r.json().catch(()=>({}));if(!r.ok||!j?.ok)throw new Error(String(j?.code||'ADMIN_BOOTSTRAP_FAILED'));return j.data}
function mapUserStatus(v){v=String(v||'').toUpperCase();if(v==='ACTIVE')return 'АКТИВЕН';if(v==='SUSPENDED'||v==='REVOKED'||v==='ARCHIVED')return 'ЗАБЛОКИРОВАН';return 'ОЖИДАЕТ АКТИВАЦИИ'}
function mapBindingStatus(v){v=String(v||'').toUpperCase();if(v==='REVOKED'||v==='EXPIRED')return 'ОТОЗВАН';if(v==='SUSPENDED')return 'ПРИОСТАНОВЛЕН';if(v==='ACTIVE')return 'АКТИВЕН';return 'ОЖИДАЕТ'}
function applyLiveContracts(authority){try{if(typeof companies==='undefined'||!Array.isArray(companies))return;const live=new Map((authority.contracts||[]).map(x=>[String(x.contractId),x]));for(const c of companies){const x=live.get(String(c.id));if(!x)continue;c.name=String(x.legalName||c.name);c.clientId=String(x.clientId||c.clientId);c.contractNumber=String(x.currentExternalContractNumber||x.contractId||c.id);c.contractDate=x.effectiveFrom?String(x.effectiveFrom).slice(0,10):(x.signedAt?String(x.signedAt).slice(0,10):c.contractDate);c.status=String(x.contractStatus||c.status);const ready=String(x.contractStatus||'')==='ACTIVE'&&String(x.lifecycleState||'')==='ACTIVE'&&['CONFIRMED','VERIFIED'].includes(String(x.authorityState||''));c.dataStatus=ready?String(x.authorityState):'TO_VERIFY';c.authorityNote='Server authority: status='+String(x.contractStatus||'')+'; authority='+String(x.authorityState||'')+'; lifecycle='+String(x.lifecycleState||'');}}catch(_e){}}
function applyAccess(authority){try{if(typeof state==='undefined'||!state)return;state.accessUsers=(authority.accessUsers||[]).map(u=>({id:String(u.id),name:String(u.name||''),login:String(u.login||''),role:String(u.role||'Клиент'),online:!!u.online,last:u.last||'—',status:mapUserStatus(u.status),bindings:(u.bindings||[]).map(b=>({id:String(b.id||''),company:String(b.company||''),clientId:String(b.clientId||''),contractId:String(b.contractId||''),status:mapBindingStatus(b.status),role:String(b.role||'Уполномоченный представитель'),dealScopeMode:String(b.dealScopeMode||'')}))}));if(typeof companies!=='undefined'&&Array.isArray(companies)){for(const c of companies){c.users=state.accessUsers.filter(u=>(u.bindings||[]).some(b=>b.contractId===c.id&&b.status!=='ОТОЗВАН')).length;c.online=state.accessUsers.filter(u=>u.online&&(u.bindings||[]).some(b=>b.contractId===c.id&&b.status!=='ОТОЗВАН')).length}}if(typeof renderAccess==='function')renderAccess()}catch(_e){}}
function applySignedGate(authority){try{window.__RONA_ADMIN_SIGNED_CONTRACT_BOOTSTRAP__=authority.signedContractGate||{scope:'ADMIN_SIGNED_CONTRACT_GATE',mode:'SNAPSHOT',contracts:[]};window.RONA_ADMIN_SIGNED_CONTRACT_GATE?.setData?.(window.__RONA_ADMIN_SIGNED_CONTRACT_BOOTSTRAP__)}catch(_e){}}
function enableExistingAgentAccessOption(){try{if(window.__RONA_ADMIN_AGENT_ACCESS_READY__!==true)return;const select=document.getElementById('newRole');if(!select)return;for(const option of Array.from(select.options||[])){if(String(option.textContent||'').trim().startsWith('Агент')){option.value='Агент';option.disabled=false}}}catch(_e){}}
function installAgentAccessActivation(){if(window.__RONA_ADMIN_AGENT_ACCESS_ACTIVATION__)return;window.__RONA_ADMIN_AGENT_ACCESS_ACTIVATION__=true;const tick=()=>{if(window.__RONA_ADMIN_AGENT_ACCESS_READY__===true)enableExistingAgentAccessOption()};document.addEventListener('click',()=>queueMicrotask(tick),true);queueMicrotask(tick);setTimeout(tick,0);window.__RONA_ADMIN_AGENT_ACCESS_ACTIVATION_TIMER__=setInterval(tick,100)}
installAgentAccessActivation();
async function refresh(){const corePromise=coreBootstrap(),authorityPromise=call('/bootstrap');let agentReadiness={ok:false,data:{matrixReady:false,profiles:[]}};try{agentReadiness=await call('/agent-readiness')}catch(_e){}const pair=await Promise.all([corePromise,authorityPromise]);const authority=pair[1].data||{};applyLiveContracts(authority);applySignedGate(authority);applyAccess(authority);window.__RONA_ADMIN_AGENT_ACCESS_READY__=agentReadiness?.data?.matrixReady===true;enableExistingAgentAccessOption();window.__RONA_ADMIN_LIVE_SNAPSHOT__={core:pair[0],authority:authority,agentAccessReadiness:agentReadiness?.data||null,at:new Date().toISOString()};window.__RONA_ADMIN_LIVE_ERROR__=null;window.__RONA_ADMIN_LIVE_READY__=true;return window.__RONA_ADMIN_LIVE_SNAPSHOT__}
function formForSigned(req){const fd=new FormData();fd.set('clientId',String(req.clientId||''));fd.set('adminClaimsBilateralSigned',String(req.adminClaimsBilateralSigned===true));fd.set('adminAttestation',JSON.stringify(req.adminAttestation||{}));fd.set('file',req.signedContractFile);return fd}
async function attachSignedContractToExistingContract(req){const j=await call('/contracts/'+encodeURIComponent(req.contractId)+'/signed-document/attach',{method:'POST',body:formForSigned(req)});await refresh();return j}
async function replaceSignedContractVersion(req){const headers={'x-current-document-id':String(req.currentDocumentId||'')};const j=await call('/contracts/'+encodeURIComponent(req.contractId)+'/signed-document/replace',{method:'POST',headers:headers,body:formForSigned(req)});await refresh();return j}
async function downloadSignedContract(req){return call('/documents/'+encodeURIComponent(req.documentId)+'/download?clientId='+encodeURIComponent(req.clientId)+'&contractId='+encodeURIComponent(req.contractId))}
function initialPasswordNotice(login,password){if(!password)return;window.__RONA_LAST_INITIAL_PASSWORD__={login:String(login||''),password:String(password),createdAt:new Date().toISOString()};setTimeout(()=>{try{if(typeof openModalRaw!=='function')return;openModalRaw('Учётная запись клиента создана','Первоначальный пароль показывается только сейчас','<div class="note warn"><b>Сохраните пароль в защищённом месте.</b> После закрытия этого окна сервер его повторно не раскрывает.</div><div class="kv subsection"><div>Логин</div><div><code>'+h(login)+'</code></div><div>Первоначальный пароль</div><div><code>'+h(password)+'</code></div></div>')}catch(_e){}},80)}
async function createAccessUser(req){const payload=Object.assign({},req,{email:String(document.querySelector('#newEmail')?.value||req.email||'').trim(),phone:String(document.querySelector('#newPhone')?.value||req.phone||'').trim()});const j=await call('/access/users',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});await refresh();initialPasswordNotice(payload.login,j.initialPassword);return j}
async function linkContractsToUser(req){const j=await call('/access/users/'+encodeURIComponent(req.userId)+'/contracts',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({contractIds:req.contractIds||[]})});await refresh();return j}
async function revokeBinding(req){const j=await call('/access/users/'+encodeURIComponent(req.userId)+'/contracts/'+encodeURIComponent(req.contractId)+'/revoke',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});await refresh();return j}
async function restoreBinding(req){const j=await call('/access/users/'+encodeURIComponent(req.userId)+'/contracts/'+encodeURIComponent(req.contractId)+'/restore',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});await refresh();return j}
async function blockAccessUser(req){const j=await call('/access/users/'+encodeURIComponent(req.userId)+'/block',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});await refresh();return j}
window.__RONA_PORTAL_BACKEND__=Object.freeze({attachSignedContractToExistingContract,replaceSignedContractVersion,downloadSignedContract,createAccessUser,linkContractsToUser,revokeBinding,restoreBinding,blockAccessUser,syncCanonical:async()=>{await refresh();return{ok:true,status:'SERVER_READ_REFRESHED'}}});
const boot=()=>refresh().catch(e=>{window.__RONA_ADMIN_LIVE_READY__=false;window.__RONA_ADMIN_LIVE_ERROR__=String(e?.code||e?.message||e)});
window.addEventListener('rona:admin-app-ready',boot,{once:true});
if(window.__RONA_ADMIN_BOOT_STATE__?.ready===true)boot();
})();<\/script>`;

const ADMIN_BOOT_KICK = `<script id="rona-server-authenticated-admin-boot-kick">(()=>{'use strict';if(window.__RONA_ADMIN_BOOT_KICK_INSTALLED__)return;window.__RONA_ADMIN_BOOT_KICK_INSTALLED__=true;const kick=()=>{try{window.RONA_ADMIN_SERVER_BOOTSTRAP?.start?.()}catch(_e){}};kick();if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',kick,{once:true});queueMicrotask(kick);setTimeout(kick,0)})();<\/script>`;

export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (url.pathname !== '/portal/admin') return context.next();

  const response = await context.next();
  const contentType = response.headers.get('content-type') || '';
  if (response.status !== 200 || !contentType.toLowerCase().includes('text/html')) return response;

  let source = await response.text();
  if (!source.includes('rona-admin-external-resource-guard')) source = source.replace('</head>', `${ADMIN_EXTERNAL_RESOURCE_GUARD}${ADMIN_LIVE_AUTHORITY_ADAPTER}</head>`);
  if (!source.includes('rona-admin-live-authority-adapter')) source = source.replace('</head>', `${ADMIN_LIVE_AUTHORITY_ADAPTER}</head>`);
  if (!source.includes('rona-server-authenticated-admin-boot-kick')) source = source.replace('</body>', `${ADMIN_BOOT_KICK}</body>`);

  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.delete('etag');
  return new Response(source, { status: response.status, statusText: response.statusText, headers });
}
