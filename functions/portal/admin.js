import { onRequest as basePortalRequest } from './[[path]].js';

const SERVER_AUTHENTICATED_ADMIN_BOOTSTRAP = `<script id="rona-server-authenticated-admin-bootstrap">(()=>{'use strict';
if(window.__RONA_SERVER_AUTHENTICATED_ADMIN_BOOTSTRAP_INSTALLED__)return;
window.__RONA_SERVER_AUTHENTICATED_ADMIN_BOOTSTRAP_INSTALLED__=true;
const DEFERRED_SCRIPT_TYPE='application/rona-admin-deferred';
const APP_READY_TIMEOUT_MS=9000;
const REQUIRED_PAGE_IDS=['page-home','page-applications','page-deals','page-access','page-publication','page-analytics','page-portal-contour'];
const deferredNodes=()=>Array.from(document.querySelectorAll('script[type="'+DEFERRED_SCRIPT_TYPE+'"][data-rona-admin-deferred="true"]')).sort((a,b)=>Number(a.dataset.ronaOrder||0)-Number(b.dataset.ronaOrder||0));
const moduleIdentity=node=>String(node?.id||('deferred-'+(node?.dataset?.ronaOrder||'x')));
const nodesAtInstall=deferredNodes();
const state=window.__RONA_ADMIN_BOOT_STATE__={
 authenticated:true,started:false,ready:false,failed:false,failureReason:null,errorCount:0,errors:[],timedOut:false,startCount:0,
 deferredScriptCount:nodesAtInstall.length,
 modules:nodesAtInstall.map(node=>({id:moduleIdentity(node),order:Number(node.dataset.ronaOrder||0),status:'PENDING',executionCount:0})),
 bootStage:'SERVER_AUTHORIZED',productionAuthActive:true,authMode:'SERVER_AUTHENTICATED_ADMIN_BOOTSTRAP',readyEventCount:0
};
window.RONA_ADMIN_AUTH_CONTEXT=Object.freeze({schema:'RONA_ADMIN_AUTH_CONTEXT/1.0',mode:'SERVER_AUTHENTICATED_ADMIN_BOOTSTRAP',source:'SERVER_SESSION',serverSession:true,authenticatedByServer:true,productionHandoffActive:true});
let readyTimer=null,currentBootModule=null,readyCommitted=false;
const seenErrors=new Set();
const byId=id=>document.getElementById(id);
const mark=(id,status)=>{const row=state.modules.find(x=>x.id===id);if(row)row.status=status};
const safe=v=>String(v??'Unknown boot error').replace(/[\r\n\t]+/g,' ').replace(/password|passphrase|token|secret|authorization/ig,'[redacted]').slice(0,240);
function fail(reason,error,source='ORCHESTRATOR'){
 if(state.ready||readyCommitted)return false;
 const message=safe(error?.message||error?.reason?.message||error?.reason||error||reason);
 const fp=source+'|'+reason+'|'+message;
 if(!seenErrors.has(fp)){seenErrors.add(fp);state.errors.push({source,stage:reason,message,time:new Date().toISOString()});state.errorCount=state.errors.length;}
 if(source&&source!=='ORCHESTRATOR')mark(source,'FAILED');
 state.failed=true;state.ready=false;state.failureReason=reason;state.bootStage='FAILED';
 if(readyTimer){clearTimeout(readyTimer);readyTimer=null;}
 document.body.classList.add('admin-auth-locked');
 return false;
}
function onWindowError(event){if(!state.ready)fail('WINDOW_ERROR',event?.error||event?.message||'window error',currentBootModule||'BOOT_ASYNC')}
function onUnhandled(event){if(!state.ready)fail('UNHANDLED_REJECTION',event?.reason||'unhandled rejection',currentBootModule||'BOOT_ASYNC')}
window.addEventListener('error',onWindowError,true);
window.addEventListener('unhandledrejection',onUnhandled,true);
window.__RONA_ADMIN_RECORD_BOOT_ERROR__=(error,stage,source)=>fail(stage||'BOOT_RUNTIME_ERROR',error,source||currentBootModule||'BOOT_ASYNC');
function executeDeferredApplicationScripts(){
 state.bootStage='DEFERRED_EXECUTION';
 const nodes=deferredNodes();
 if(nodes.length===0)return fail('DEFERRED_COUNT_ZERO','No canonical deferred Admin modules found');
 if(nodes.length!==state.deferredScriptCount)return fail('DEFERRED_COUNT_MISMATCH','Deferred module count changed during boot');
 const executed=new Set();
 for(const source of nodes){
  if(state.failed||state.timedOut)break;
  const identity=moduleIdentity(source),row=state.modules.find(x=>x.id===identity);
  if(executed.has(identity)||(row&&row.executionCount>0))return fail('DEFERRED_DUPLICATE_EXECUTION','Deferred module attempted twice',identity);
  executed.add(identity);currentBootModule=identity;if(row)row.executionCount+=1;mark(identity,'STARTED');
  try{
   const runtime=document.createElement('script');runtime.type='text/javascript';runtime.dataset.ronaRuntimeFrom=identity;
   runtime.textContent=source.textContent+'\n//# sourceURL=rona-admin-deferred-'+(source.dataset.ronaOrder||'x')+'.js';
   document.body.appendChild(runtime);runtime.remove();if(!state.failed)mark(identity,'EXECUTED');
  }catch(error){fail('DEFERRED_EXECUTION',error,identity)}finally{currentBootModule=null}
 }
 if(state.failed||state.timedOut)return false;
 if(!state.modules.every(x=>x.status==='EXECUTED'&&x.executionCount===1))return fail('DEFERRED_COMPLETION','Not all deferred modules executed exactly once');
 state.bootStage='WAITING_READY';return true;
}
function readinessValidation(){
 const issues=[];
 if(state.started!==true||state.startCount!==1)issues.push('INVALID_START_COUNT');
 if(state.failed)issues.push('BOOT_FAILED');if(state.timedOut)issues.push('BOOT_TIMED_OUT');if(state.errorCount!==0)issues.push('BOOT_ERRORS_PRESENT');
 if(state.deferredScriptCount<=0)issues.push('DEFERRED_COUNT_ZERO');
 if(!state.modules.every(x=>x.status==='EXECUTED'&&x.executionCount===1))issues.push('DEFERRED_MODULES_INCOMPLETE');
 for(const id of REQUIRED_PAGE_IDS)if(!byId(id))issues.push('DOM_MISSING_'+id);
 if(typeof window.renderAccess!=='function')issues.push('RENDER_ACCESS_MISSING');
 if(window.__RONA_ADMIN_RENDER_ACCESS_COMPLETED__!==true)issues.push('RENDER_ACCESS_NOT_COMPLETED');
 if(window.__RONA_ADMIN_EXECUTIVE_BOOTSTRAP_ERROR__===true)issues.push('EXECUTIVE_BOOTSTRAP_ERROR');
 if(!window.RONA_ADMIN_PUBLICATION_CONTROL_V345||typeof window.RONA_ADMIN_PUBLICATION_CONTROL_V345.getWorklist!=='function')issues.push('PUBLICATION_CORE_MISSING');
 if(!window.RONA_ADMIN_V349)issues.push('ADMIN_CORE_MISSING');
 if(window.__RONA_ADMIN_RUSSIFY_COMPLETED__!==true)issues.push('RUSSIFICATION_NOT_COMPLETED');
 if(window.__RONA_ADMIN_APP_READY_DISPATCHED__!==true)issues.push('READY_DISPATCH_MARKER_MISSING');
 if(state.readyEventCount!==1)issues.push('READY_EVENT_COUNT_'+state.readyEventCount);
 return {ok:issues.length===0,issues};
}
function commitReady(){
 if(readyCommitted||state.failed||state.timedOut)return false;
 state.bootStage='READINESS_VALIDATION';const validation=readinessValidation();
 if(!validation.ok)return fail('READINESS_VALIDATION',validation.issues.join(','));
 readyCommitted=true;state.ready=true;state.failed=false;state.failureReason=null;state.bootStage='READY';
 if(readyTimer){clearTimeout(readyTimer);readyTimer=null;}
 window.removeEventListener('error',onWindowError,true);window.removeEventListener('unhandledrejection',onUnhandled,true);delete window.__RONA_ADMIN_RECORD_BOOT_ERROR__;
 document.body.classList.remove('admin-auth-locked');const logout=byId('adminLogoutBtn');if(logout)logout.hidden=false;
 return true;
}
window.addEventListener('rona:admin-app-ready',()=>{state.readyEventCount+=1;if(state.readyEventCount>1){fail('READY_EVENT_DUPLICATE','rona:admin-app-ready fired more than once');return;}queueMicrotask(commitReady)});
function start(){
 if(state.started||state.failed||state.timedOut)return;
 state.started=true;state.startCount=1;state.bootStage='STARTING';
 document.body.classList.add('admin-auth-locked');
 window.dispatchEvent(new CustomEvent('rona:admin-app-started',{detail:{mode:'SERVER_AUTHENTICATED_ADMIN_BOOTSTRAP',startCount:1}}));
 readyTimer=setTimeout(()=>{if(state.ready||state.failed)return;state.timedOut=true;fail('BOOT_TIMEOUT','Admin application readiness timeout')},APP_READY_TIMEOUT_MS);
 if(!executeDeferredApplicationScripts()&&!state.failed)fail('BOOT_START_FAILED','Deferred application execution did not start');
 document.title='RONA Trade — Кабинет администратора v3.4.13';
}
window.RONA_ADMIN_SERVER_BOOTSTRAP=Object.freeze({mode:'SERVER_AUTHENTICATED_ADMIN_BOOTSTRAP',bootState:()=>JSON.parse(JSON.stringify(state)),start});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else queueMicrotask(start);
})();<\/script>`;

class RelockAndBootstrapAdmin {
  element(el) {
    const classes=String(el.getAttribute('class')||'').split(/\s+/).filter(Boolean);
    if(!classes.includes('admin-auth-locked'))classes.push('admin-auth-locked');
    el.setAttribute('class',classes.join(' '));
    el.append(SERVER_AUTHENTICATED_ADMIN_BOOTSTRAP,{html:true});
  }
}

export async function onRequest(context) {
  const response = await basePortalRequest(context);
  const contentType = response.headers.get('content-type') || '';
  if (response.status !== 200 || !contentType.toLowerCase().includes('text/html')) return response;
  return new HTMLRewriter().on('body', new RelockAndBootstrapAdmin()).transform(response);
}
