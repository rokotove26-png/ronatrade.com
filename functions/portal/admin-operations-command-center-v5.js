import { patchAdminOperationsCommandCenterV4 as patchVisualBaseline } from './admin-operations-command-center-v4.js';

export const OPERATIONS_COMMAND_CENTER_VERSION='v5-operational-automation';
export const OPERATIONS_VISUAL_BASELINE='83fa7bf3ebf6eed4992ae380aab703b174009a21:flightdeck-v5-full-rebuild';

function replaceRequired(source,from,to,label){
  const first=source.indexOf(from);
  if(first<0)throw new Error('ADMIN_OPERATIONS_V5_FUNCTIONAL_ADAPTER_SOURCE_MISMATCH:'+label);
  if(source.indexOf(from,first+from.length)>=0)throw new Error('ADMIN_OPERATIONS_V5_FUNCTIONAL_ADAPTER_NOT_UNIQUE:'+label);
  return source.slice(0,first)+to+source.slice(first+from.length);
}

const SEARCH_AND_DEEPLINK_RUNTIME=String.raw`
function ronaOpsV5OpenDeal(id){id=String(id||'').trim();if(!id)return;window.__RONA_DEALS_REQUESTED_ID__=id;adminHomeNavigate('deals');setTimeout(()=>window.dispatchEvent(new CustomEvent('rona:deal-select',{detail:{dealId:id,source:'operations-center'}})),0)}
function ronaOpsV5Go(target,id){if(target==='deals'&&id)return ronaOpsV5OpenDeal(id);if(target)adminHomeNavigate(target)}
function ronaOpsV5SearchRows(query){const d=adminData||{},ops=d.operations||{},needle=String(query||'').trim().toLocaleLowerCase('ru-RU'),rows=[];if(!needle)return rows;const add=(title,meta,target,id,hay)=>{if(String(hay||'').toLocaleLowerCase('ru-RU').includes(needle))rows.push({title,meta,target,id})};for(const x of d.deals||[])add('Сделка '+String(x.deal_id||'—'),[x.legal_name,x.contract_id,ronaFdV5NextAction(x)].filter(Boolean).join(' · '),'deals',x.deal_id,[x.deal_id,x.legal_name,x.client_id,x.contract_id,x.application_id,x.product,ronaFdV5NextAction(x)].join(' '));for(const x of d.applications||[])add('Заявка '+String(x.application_id||'—'),[x.legal_name,x.product,ronaFdV5Text(x.owner_status||x.status)].filter(Boolean).join(' · '),'applications',null,[x.application_id,x.legal_name,x.client_id,x.contract_id,x.deal_id,x.product,x.destination].join(' '));for(const x of d.dealDocuments||[])add('Документ '+String(x.document_id||'—'),[x.deal_id,x.document_kind,x.authoritative_filename].filter(Boolean).join(' · '),'documents',null,[x.document_id,x.deal_id,x.document_kind,x.authoritative_filename].join(' '));for(const x of ops.tasks||[])add('Задача '+String(x.task_id||'—'),[x.title,x.status,x.priority].filter(Boolean).join(' · '),x.deal_id?'deals':'home',x.deal_id,[x.task_id,x.title,x.description,x.deal_id,x.application_id,x.source_object_id].join(' '));for(const x of ops.reverseEvents||[])add('Событие '+String(x.event_id||'—'),[x.event_type,x.processing_state,x.acknowledgement_state].filter(Boolean).join(' · '),x.deal_id?'deals':'home',x.deal_id,[x.event_id,x.event_type,x.authority_target_id,x.deal_id,x.processing_state].join(' '));return rows.slice(0,100)}
function ronaOpsV5Search(query){const needle=String(query||'').trim();if(needle.length<2){notify('Введите не менее двух символов.','Поиск');return}q('#ronaOpsV5SearchLayer')?.remove();const rows=ronaOpsV5SearchRows(needle),layer=e('div',{id:'ronaOpsV5SearchLayer',role:'dialog','aria-modal':'true','aria-label':'Результаты поиска'});layer.style.cssText='position:fixed;inset:0;z-index:2147483639;background:rgba(2,6,23,.72);backdrop-filter:blur(3px);display:grid;place-items:start center;padding:8vh 16px';const panel=e('section',{});panel.style.cssText='width:min(880px,100%);max-height:82vh;overflow:auto;border:1px solid rgba(93,215,255,.25);border-radius:18px;background:#071321;color:#eefaff;box-shadow:0 28px 80px rgba(0,0,0,.5);padding:18px';const head=e('div',{});head.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px';const close=e('button',{type:'button',text:'Закрыть',onclick:()=>layer.remove()});close.style.cssText='padding:8px 12px;border:1px solid rgba(128,181,214,.24);border-radius:9px;background:transparent;color:inherit;cursor:pointer';head.append(e('strong',{text:'Поиск: '+needle}),close);panel.append(head);if(rows.length){for(const row of rows){const b=e('button',{type:'button',onclick:()=>{layer.remove();ronaOpsV5Go(row.target,row.id)}});b.style.cssText='display:block;width:100%;padding:12px;margin-top:5px;border:1px solid rgba(128,181,214,.13);border-radius:11px;background:rgba(255,255,255,.025);color:inherit;text-align:left;cursor:pointer';b.append(e('strong',{text:row.title}),e('div',{class:'rona-owner-muted',text:row.meta||'Открыть'}));panel.append(b)}}else{const empty=e('div',{});empty.style.cssText='padding:28px 12px;text-align:center;color:rgba(188,221,239,.72)';empty.append(e('strong',{text:'Совпадений нет'}),e('div',{class:'rona-owner-muted',text:'Проверьте номер сделки, заявки, документа или название контрагента.'}));panel.append(empty)}layer.append(panel);layer.addEventListener('click',ev=>{if(ev.target===layer)layer.remove()});const esc=ev=>{if(ev.key==='Escape'){layer.remove();document.removeEventListener('keydown',esc,true)}};document.addEventListener('keydown',esc,true);document.body.append(layer);close.focus()}
function ensureAdminGlobalSearchV5(){window.__RONA_ADMIN_GLOBAL_SEARCH__=ronaOpsV5Search;if(window.__RONA_ADMIN_OPS_EVENTS_V5__)return;window.__RONA_ADMIN_OPS_EVENTS_V5__=true;window.addEventListener('rona:admin-refresh-error',()=>{const p=page('home');if(p&&getComputedStyle(p).display!=='none')renderAdminHome()});window.addEventListener('rona:admin-authority-refresh',()=>{window.__RONA_OWNER_ADMIN_REFRESH_ERROR__=null})}
`;

export function patchAdminOperationsCommandCenterV5(script){
  let patched=patchVisualBaseline(script);

  patched=replaceRequired(
    patched,
    "function ronaFdV5NextAction(deal){return deal?.next_action||deal?.next_step||deal?.action_required||deal?.execution_next_action||'—'}",
    "function ronaFdV5NextAction(deal){return deal?.next_action_text||deal?.next_action||deal?.next_step||deal?.action_required||deal?.execution_next_action||'—'}",
    'next-action'
  );

  patched=replaceRequired(
    patched,
    'function renderAdminHome(){',
    SEARCH_AND_DEEPLINK_RUNTIME+'\nfunction renderAdminHome(){',
    'functional-runtime'
  );

  patched=replaceRequired(
    patched,
    "  ensureAdminHomeFinanceListenerV4();\n  window.__RONA_ADMIN_OPERATIONS_COMMAND_CENTER__='v4-canonical-single-owner';",
    "  ensureAdminHomeFinanceListenerV4();\n  ensureAdminGlobalSearchV5();\n  window.__RONA_ADMIN_OPERATIONS_COMMAND_CENTER__='v5-operational-automation';",
    'runtime-marker'
  );

  patched=replaceRequired(
    patched,
    "'data-rona-operations-command-center':'v4'",
    "'data-rona-operations-command-center':'v5'",
    'dom-owner-marker'
  );

  patched=replaceRequired(
    patched,
    "const d=adminData||{};\n  const conflicts=",
    "const d=adminData||{},ops=d.operations||{},opsMetrics=ops.metrics||{},opsAlerts=Array.isArray(ops.alerts)?ops.alerts:[];\n  const conflicts=",
    'operations-read-model'
  );

  patched=replaceRequired(
    patched,
    "  if(uncheckedDocs.length)queueRows.push({tone:'amber',name:'Документы · требуется контроль',meta:String(uncheckedDocs.length)+' документов не отмечены как проверенные',target:'documents'});\n  const criticalCount=conflicts.length;\n  const attentionCount=queueRows.length;",
    "  if(uncheckedDocs.length)queueRows.push({tone:'amber',name:'Документы · требуется контроль',meta:String(uncheckedDocs.length)+' документов не отмечены как проверенные',target:'documents'});\n  const opsTasks=Array.isArray(ops.tasks)?ops.tasks:[],opsReverse=Array.isArray(ops.reverseEvents)?ops.reverseEvents:[],opsMaterializer=Array.isArray(ops.financeMaterializerHealth)?ops.financeMaterializerHealth:[],opsRail=Array.isArray(ops.railRuntime)?ops.railRuntime:[];\n  const actionableReverse=opsReverse.filter(x=>{const p=ronaFdV5Key(x?.processing_state),a=ronaFdV5Key(x?.acknowledgement_state);return ['QUEUED','PENDING','FAILED','ERROR','RETRY','RETRYING'].includes(p)||['PENDING','WAITING','REQUIRED'].includes(a)}),actionableReverseIds=new Set(actionableReverse.map(x=>String(x?.id||'')));\n  const actionableOpsAlerts=opsAlerts.filter(x=>{const t=ronaFdV5Key(x?.entity_type);if(t==='AI_RUNTIME')return false;if(t==='REVERSE_EVENT'&&!actionableReverseIds.has(String(x?.entity_id||'')))return false;return true});\n  for(const x of actionableOpsAlerts)queueRows.push({tone:ronaFdV5Key(x?.severity)==='CRITICAL'||ronaFdV5Key(x?.severity)==='ERROR'?'red':ronaFdV5Key(x?.severity)==='INFO'?'cyan':'amber',name:String(x?.title||'Операционный сигнал'),meta:String(x?.meta||x?.detail||'Требуется проверка'),target:x?.target||'home',dealId:x?.deal_id||null});\n  const nowMs=Date.now(),criticalTaskCount=opsTasks.filter(x=>['CRITICAL','URGENT'].includes(ronaFdV5Key(x?.priority))||(x?.due_at&&Date.parse(x.due_at)<nowMs)).length,criticalReverseCount=actionableReverse.filter(x=>!!x?.last_error_code||['FAILED','ERROR'].includes(ronaFdV5Key(x?.processing_state))).length,materializerIssueCount=opsMaterializer.reduce((n,x)=>n+(['DENIED','FAILED','ERROR','DEAD_LETTER'].includes(ronaFdV5Key(x?.status))?Number(x?.job_count||0):0),0),materializerCriticalCount=opsMaterializer.reduce((n,x)=>n+(['FAILED','ERROR','DEAD_LETTER'].includes(ronaFdV5Key(x?.status))?Number(x?.job_count||0):0),0),railIssueCount=opsRail.filter(x=>ronaFdV5Key(x?.mode)==='DISABLED'||x?.production_polling_enabled===false||ronaFdV5Key(x?.credentials_state)!=='READY'||ronaFdV5Key(x?.api_contract_state)!=='READY').length;\n  const criticalCount=conflicts.length+criticalTaskCount+criticalReverseCount+materializerCriticalCount;\n  const attentionCount=conflicts.length+attentionApps.length+paymentControl.length+waitingWagons.length+uncheckedDocs.length+opsTasks.length+actionableReverse.length+materializerIssueCount+railIssueCount;",
    'operations-alerts'
  );

  patched=replaceRequired(
    patched,
    "onclick:async()=>{try{await refreshAdmin()}catch(err){notify(err?.message||String(err),'Ошибка обновления')}}",
    "onclick:async()=>{try{await ownerAdminRefreshTick(true);renderAdminHome()}catch(err){window.__RONA_OWNER_ADMIN_REFRESH_ERROR__=String(err?.message||err);renderAdminHome();notify(err?.message||String(err),'Ошибка обновления')}}",
    'authority-refresh'
  );

  patched=replaceRequired(
    patched,
    "onclick:()=>adminHomeNavigate('deals'),text:'Deal Control'",
    "onclick:()=>ronaOpsV5OpenDeal(id),text:'Deal Control'",
    'exact-deal-deeplink'
  );

  patched=replaceRequired(
    patched,
    "const generated=d.generated_at||d.generatedAt||d.as_of||null;\n  const footer=e('footer',{class:'rona-fd-v5__footer'},e('span',{},'DATA BUS · ',e('strong',{text:'CURRENT ADMIN RUNTIME'}),' · business values are not synthesized'),e('span',{text:generated?'CURRENT STATE · '+String(generated):'LOCAL PANEL TIME · '+timeText}));",
    "const generated=d.generated_at||d.generatedAt||d.as_of||null,sourceAsOf=ops?.freshness?.source_as_of||ops?.freshness?.deals||generated;\n  const footer=e('footer',{class:'rona-fd-v5__footer'},e('span',{},'DATA BUS · ',e('strong',{text:'CURRENT ADMIN RUNTIME'}),' · business values are not synthesized'),e('span',{text:sourceAsOf?'CURRENT STATE · '+String(sourceAsOf):'LOCAL PANEL TIME · '+timeText}));",
    'source-freshness'
  );

  if(!patched.includes("window.__RONA_ADMIN_OPERATIONS_COMMAND_CENTER__='v5-operational-automation'"))throw new Error('ADMIN_OPERATIONS_V5_MARKER_MISSING');
  if(!patched.includes("window.__RONA_ADMIN_OPERATIONS_FLIGHTDECK__='v5-full-rebuild'"))throw new Error('ADMIN_OPERATIONS_FLIGHTDECK_BASELINE_MISSING');
  if(!patched.includes("window.__RONA_ADMIN_GLOBAL_SEARCH__=ronaOpsV5Search"))throw new Error('ADMIN_OPERATIONS_GLOBAL_SEARCH_MISSING');
  if(!patched.includes("'data-rona-operations-command-center':'v5'")||!patched.includes("'data-rona-single-owner':'true'"))throw new Error('ADMIN_OPERATIONS_V5_DOM_OWNER_MISSING');
  if((patched.match(/function renderAdminHome\(\)\{/g)||[]).length!==1)throw new Error('ADMIN_OPERATIONS_V5_NOT_SINGLE_OWNER');
  return patched;
}