import { patchAdminOperationsCommandCenterV88 as patchV88 } from './admin-operations-command-center-v8-8.js';

export const OPERATIONS_COMMAND_CENTER_VERSION='v8.9-exact-object-routing-v1';
export const OPERATIONS_EXACT_OBJECT_ROUTING_CONTRACT='OPERATIONS_EXACT_OBJECT_ROUTING_V1';

function replaceRequired(source,from,to,label){
  const first=source.indexOf(from);
  if(first<0)throw new Error('ADMIN_OPERATIONS_V89_SOURCE_MISMATCH:'+label);
  if(source.indexOf(from,first+from.length)>=0)throw new Error('ADMIN_OPERATIONS_V89_SOURCE_NOT_UNIQUE:'+label);
  return source.slice(0,first)+to+source.slice(first+from.length);
}

const EXACT_OBJECT_RUNTIME=String.raw`
function ronaOpsV89FindApplication(applicationId){
  const id=String(applicationId||'').trim();
  if(!id)return null;
  const rows=Array.isArray(adminData?.applications)?adminData.applications:[];
  return rows.find(x=>String(x?.application_id||x?.id||'').trim()===id)||null;
}
function ronaOpsV89FocusApplicationRow(applicationId){
  const id=String(applicationId||'').trim(),page=document.getElementById('page-applications');
  if(!id||!page)return false;
  const rows=Array.from(page.querySelectorAll('tbody tr'));
  const row=rows.find(x=>String(x?.firstElementChild?.textContent||'').trim()===id)||null;
  if(!row)return false;
  const hadTabindex=row.hasAttribute('tabindex'),previousTabindex=row.getAttribute('tabindex');
  row.setAttribute('tabindex','-1');
  row.dataset.ronaOpsExactFocus='true';
  try{row.focus({preventScroll:true})}catch(_e){}
  try{row.scrollIntoView({block:'center',behavior:'smooth'})}catch(_e){row.scrollIntoView()}
  setTimeout(()=>{
    delete row.dataset.ronaOpsExactFocus;
    if(hadTabindex)row.setAttribute('tabindex',previousTabindex??'');else row.removeAttribute('tabindex');
  },1800);
  return true;
}
function ronaOpsV89OpenApplication(applicationId){
  const id=String(applicationId||'').trim();
  if(!id){adminHomeNavigate('applications');return}
  const app=ronaOpsV89FindApplication(id);
  if(app&&typeof application2BBucket==='function'){
    try{ownerApplication2BFilter=application2BBucket(app)}catch(_e){}
  }
  adminHomeNavigate('applications');
  try{if(typeof renderApplications==='function')renderApplications()}catch(_e){}
  requestAnimationFrame(()=>{if(!ronaOpsV89FocusApplicationRow(id))requestAnimationFrame(()=>ronaOpsV89FocusApplicationRow(id))});
}
function ronaOpsV89OpenPaymentDeal(dealId){
  const id=String(dealId||'').trim();
  adminHomeNavigate('payments');
  if(!id)return;
  const open=()=>{
    const fn=window.__RONA_PAYMENTS_V8_OPEN_PASSPORT__;
    if(typeof fn!=='function')return false;
    try{fn(id);return true}catch(_e){return false}
  };
  requestAnimationFrame(()=>{
    if(open())return;
    let timer=0;
    const cleanup=()=>{window.removeEventListener('rona:finance-sync',onSync);if(timer)clearTimeout(timer)};
    const onSync=()=>{if(open())cleanup()};
    window.addEventListener('rona:finance-sync',onSync);
    timer=setTimeout(()=>{open();cleanup()},1200);
  });
}
`;

export function patchAdminOperationsCommandCenterV89(script){
  let patched=patchV88(script);

  patched=replaceRequired(
    patched,
    'function ronaOpsV83OpenQueueRow(row){',
    EXACT_OBJECT_RUNTIME+'\nfunction ronaOpsV83OpenQueueRow(row){',
    'exact-object-runtime'
  );

  patched=replaceRequired(
    patched,
    "    if(String(entity?.application_id||'').trim())return{kind:'SECTION',target:'applications'};",
    "    if(String(entity?.application_id||'').trim())return{kind:'SECTION',target:'applications',applicationId:String(entity.application_id).trim()};",
    'direct-application-id'
  );

  patched=replaceRequired(
    patched,
    "    if(targetType==='APPLICATION')return{kind:'SECTION',target:'applications'};",
    "    if(targetType==='APPLICATION')return{kind:'SECTION',target:'applications',applicationId:String(entity?.authority_target_id||'').trim()||null};",
    'reverse-application-id'
  );

  patched=replaceRequired(
    patched,
    "  window.__RONA_ADMIN_OPS_LAST_ACTION__={entityType:row?.entityType||null,entityId:row?.entityId||null,dealId:row?.dealId||entity?.deal_id||null,target:action.target||null,kind:action.kind,at:Date.now()};\n  if(action.kind==='DEAL'&&action.dealId){ronaOpsV5OpenDeal(action.dealId);return}\n  if(action.kind==='SECTION'&&action.target){adminHomeNavigate(action.target);return}",
    "  window.__RONA_ADMIN_OPS_LAST_ACTION__={entityType:row?.entityType||null,entityId:row?.entityId||null,dealId:action.dealId||row?.dealId||entity?.deal_id||null,applicationId:action.applicationId||entity?.application_id||null,target:action.target||null,kind:action.kind,at:Date.now()};\n  if(action.kind==='DEAL'&&action.dealId){ronaOpsV5OpenDeal(action.dealId);return}\n  if(action.kind==='SECTION'&&action.target==='payments'&&action.dealId){ronaOpsV89OpenPaymentDeal(action.dealId);return}\n  if(action.kind==='SECTION'&&action.target==='applications'&&action.applicationId){ronaOpsV89OpenApplication(action.applicationId);return}\n  if(action.kind==='SECTION'&&action.target){adminHomeNavigate(action.target);return}",
    'exact-section-routing'
  );

  patched=replaceRequired(
    patched,
    "  window.__RONA_ADMIN_OPERATIONS_COMMAND_CENTER__='v8.8-mirrored-event-routing-v1';\n  window.__RONA_ADMIN_OPERATIONS_READMODEL_RECOVERY__='OPERATIONS_CURRENT_V1_RECOVERY_V1';\n  window.__RONA_ADMIN_OPERATIONS_ACTION_QUEUE__='OPERATIONS_ACTION_QUEUE_NORMALIZED_V1';\n  window.__RONA_ADMIN_OPERATIONS_ACTION_ROUTER__='OPERATIONS_ACTION_ROUTER_V1';\n  window.__RONA_ADMIN_OPERATIONS_COMPLETE_SCROLL__='OPERATIONS_COMPLETE_SCROLL_V1';\n  window.__RONA_ADMIN_OPERATIONS_EFFECTIVE_KPI__='OPERATIONS_EFFECTIVE_KPI_V1';\n  window.__RONA_ADMIN_OPERATIONS_CANONICAL_CONTROLS__='OPERATIONS_CANONICAL_CONTROLS_V1';\n  window.__RONA_ADMIN_OPERATIONS_FINANCE_ACTIONS__='OPERATIONS_FINANCE_ACTIONS_V1';\n  window.__RONA_ADMIN_OPERATIONS_MIRRORED_EVENT_ROUTING__='OPERATIONS_MIRRORED_EVENT_ROUTING_V1';",
    "  window.__RONA_ADMIN_OPERATIONS_COMMAND_CENTER__='v8.9-exact-object-routing-v1';\n  window.__RONA_ADMIN_OPERATIONS_READMODEL_RECOVERY__='OPERATIONS_CURRENT_V1_RECOVERY_V1';\n  window.__RONA_ADMIN_OPERATIONS_ACTION_QUEUE__='OPERATIONS_ACTION_QUEUE_NORMALIZED_V1';\n  window.__RONA_ADMIN_OPERATIONS_ACTION_ROUTER__='OPERATIONS_ACTION_ROUTER_V1';\n  window.__RONA_ADMIN_OPERATIONS_COMPLETE_SCROLL__='OPERATIONS_COMPLETE_SCROLL_V1';\n  window.__RONA_ADMIN_OPERATIONS_EFFECTIVE_KPI__='OPERATIONS_EFFECTIVE_KPI_V1';\n  window.__RONA_ADMIN_OPERATIONS_CANONICAL_CONTROLS__='OPERATIONS_CANONICAL_CONTROLS_V1';\n  window.__RONA_ADMIN_OPERATIONS_FINANCE_ACTIONS__='OPERATIONS_FINANCE_ACTIONS_V1';\n  window.__RONA_ADMIN_OPERATIONS_MIRRORED_EVENT_ROUTING__='OPERATIONS_MIRRORED_EVENT_ROUTING_V1';\n  window.__RONA_ADMIN_OPERATIONS_EXACT_OBJECT_ROUTING__='OPERATIONS_EXACT_OBJECT_ROUTING_V1';",
    'browser-version'
  );

  if(!patched.includes("function ronaOpsV89OpenApplication(applicationId)"))throw new Error('ADMIN_OPERATIONS_V89_APPLICATION_FOCUS_MISSING');
  if(!patched.includes("ownerApplication2BFilter=application2BBucket(app)"))throw new Error('ADMIN_OPERATIONS_V89_APPLICATION_BUCKET_MISSING');
  if(!patched.includes("window.__RONA_PAYMENTS_V8_OPEN_PASSPORT__"))throw new Error('ADMIN_OPERATIONS_V89_PAYMENT_PASSPORT_MISSING');
  if(!patched.includes("action.target==='payments'&&action.dealId"))throw new Error('ADMIN_OPERATIONS_V89_PAYMENT_ROUTE_MISSING');
  if(!patched.includes("action.target==='applications'&&action.applicationId"))throw new Error('ADMIN_OPERATIONS_V89_APPLICATION_ROUTE_MISSING');
  if(!patched.includes("window.__RONA_ADMIN_OPERATIONS_EXACT_OBJECT_ROUTING__='OPERATIONS_EXACT_OBJECT_ROUTING_V1'"))throw new Error('ADMIN_OPERATIONS_V89_MARKER_MISSING');
  if(patched.includes("setInterval(()=>ronaOpsV89"))throw new Error('ADMIN_OPERATIONS_V89_POLLING_FORBIDDEN');
  return patched;
}
