import { patchAdminOperationsCommandCenterV82 as patchV82 } from './admin-operations-command-center-v8-2.js';

export const OPERATIONS_COMMAND_CENTER_VERSION='v8.3-action-router-v1';
export const OPERATIONS_ACTION_ROUTER_CONTRACT='OPERATIONS_ACTION_ROUTER_V1';

function replaceRequired(source,from,to,label){
  const first=source.indexOf(from);
  if(first<0)throw new Error('ADMIN_OPERATIONS_V83_SOURCE_MISMATCH:'+label);
  if(source.indexOf(from,first+from.length)>=0)throw new Error('ADMIN_OPERATIONS_V83_SOURCE_NOT_UNIQUE:'+label);
  return source.slice(0,first)+to+source.slice(first+from.length);
}

const ACTION_ROUTER_RUNTIME=String.raw`
function ronaOpsV83CurrentOps(){return window.__RONA_ADMIN_OPERATIONS_CURRENT_V1__||adminData?.operations||{}}
function ronaOpsV83FindEntity(row){
  const ops=ronaOpsV83CurrentOps(),type=ronaFdV5Key(row?.entityType),id=String(row?.entityId||'');
  if(type==='STAFF_TASK')return (Array.isArray(ops?.tasks)?ops.tasks:[]).find(x=>String(x?.id||'')===id)||null;
  if(type==='REVERSE_EVENT')return (Array.isArray(ops?.reverseEvents)?ops.reverseEvents:[]).find(x=>String(x?.id||'')===id)||null;
  return null;
}
function ronaOpsV83ResolveAction(row,entity){
  const direct=String(row?.target||'').trim(),dealId=String(row?.dealId||entity?.deal_id||'').trim();
  if(dealId)return{kind:'DEAL',dealId,target:'deals'};
  const type=ronaFdV5Key(row?.entityType),domain=ronaFdV5Key(entity?.authority_domain),role=ronaFdV5Key(entity?.assigned_functional_role),source=ronaFdV5Key(entity?.source_type),targetType=ronaFdV5Key(entity?.authority_target_type);
  if(type==='STAFF_TASK'){
    if(String(entity?.application_id||'').trim())return{kind:'SECTION',target:'applications'};
    if(role==='RAIL_LOGISTICS')return{kind:'SECTION',target:'monitoring'};
    if(domain==='FINANCE'||role==='FINANCE')return{kind:'SECTION',target:'payments'};
    if(domain==='CONTRACT'||role==='LEGAL')return{kind:'SECTION',target:'documents'};
    if(domain==='CLIENT_INTAKE'||source==='CLIENT_INTAKE')return{kind:'SECTION',target:'applications'};
    if(domain==='PRICE_CALCULATION')return{kind:'SECTION',target:'prices'};
  }
  if(type==='REVERSE_EVENT'){
    if(targetType==='APPLICATION')return{kind:'SECTION',target:'applications'};
    if(domain==='PRICE_CALCULATION'||targetType==='PUBLICATION_ITEM')return{kind:'SECTION',target:'prices'};
  }
  if(direct&&direct!=='home')return{kind:'SECTION',target:direct};
  return{kind:'DETAIL',target:null};
}
function ronaOpsV83ShowDetail(row,entity){
  document.querySelector('#ronaOpsV83ActionDetail')?.remove();
  const layer=e('div',{id:'ronaOpsV83ActionDetail',role:'dialog','aria-modal':'true','aria-label':'Операционное действие'});
  layer.style.cssText='position:fixed;inset:0;z-index:2147483643;background:rgba(2,7,17,.78);backdrop-filter:blur(4px);display:grid;place-items:center;padding:20px';
  const panel=e('section',{});
  panel.style.cssText='width:min(720px,100%);max-height:82vh;overflow:auto;border:1px solid rgba(110,231,255,.24);border-radius:14px;background:linear-gradient(160deg,#071521,#04101a);color:#edfaff;box-shadow:0 30px 90px rgba(0,0,0,.55);padding:18px';
  const head=e('div',{});head.style.cssText='display:flex;align-items:flex-start;justify-content:space-between;gap:16px';
  const identity=e('div',{});
  identity.append(e('div',{text:'ОПЕРАЦИОННОЕ ДЕЙСТВИЕ'}),e('h3',{text:String(entity?.title||row?.name||'Действие')}));
  const close=e('button',{type:'button',text:'Закрыть',onclick:()=>layer.remove()});
  close.style.cssText='padding:8px 12px;border:1px solid rgba(110,231,255,.22);border-radius:8px;background:rgba(110,231,255,.04);color:inherit;cursor:pointer';
  head.append(identity,close);panel.append(head);
  const meta=[
    ['Статус',entity?.status||entity?.processing_state||'—'],
    ['Приоритет',entity?.priority||'—'],
    ['Контур',entity?.authority_domain||'—'],
    ['Роль',entity?.assigned_functional_role||'—'],
    ['Источник',entity?.source_type||entity?.event_type||'—'],
    ['ID',entity?.task_id||entity?.event_id||row?.entityId||'—']
  ];
  const grid=e('div',{});grid.style.cssText='display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:16px';
  for(const item of meta){const cell=e('div',{});cell.style.cssText='padding:10px;border:1px solid rgba(110,231,255,.09);border-radius:8px;background:rgba(255,255,255,.018)';cell.append(e('div',{text:item[0]}),e('strong',{text:String(item[1]??'—')}));grid.append(cell)}
  panel.append(grid);
  if(entity?.description){const desc=e('div',{text:String(entity.description)});desc.style.cssText='margin-top:14px;padding:12px;border:1px solid rgba(255,209,106,.12);border-radius:8px;white-space:pre-wrap;line-height:1.5;color:rgba(226,243,250,.82)';panel.append(desc)}
  layer.append(panel);layer.addEventListener('click',ev=>{if(ev.target===layer)layer.remove()});
  const esc=ev=>{if(ev.key==='Escape'){layer.remove();document.removeEventListener('keydown',esc,true)}};document.addEventListener('keydown',esc,true);
  document.body.append(layer);close.focus();
}
function ronaOpsV83OpenQueueRow(row){
  const entity=ronaOpsV83FindEntity(row),action=ronaOpsV83ResolveAction(row,entity);
  window.__RONA_ADMIN_OPS_LAST_ACTION__={entityType:row?.entityType||null,entityId:row?.entityId||null,dealId:row?.dealId||entity?.deal_id||null,target:action.target||null,kind:action.kind,at:Date.now()};
  if(action.kind==='DEAL'&&action.dealId){ronaOpsV5OpenDeal(action.dealId);return}
  if(action.kind==='SECTION'&&action.target){adminHomeNavigate(action.target);return}
  ronaOpsV83ShowDetail(row,entity);
}
`;

export function patchAdminOperationsCommandCenterV83(script){
  let patched=patchV82(script);

  patched=replaceRequired(
    patched,
    'function renderAdminHome(){',
    ACTION_ROUTER_RUNTIME+'\nfunction renderAdminHome(){',
    'action-router-runtime'
  );

  patched=replaceRequired(
    patched,
    "for(const x of actionableOpsAlerts)queueRows.push({tone:ronaFdV5Key(x?.severity)==='CRITICAL'||ronaFdV5Key(x?.severity)==='ERROR'?'red':ronaFdV5Key(x?.severity)==='INFO'?'cyan':'amber',name:String(x?.title||'Операционный сигнал'),meta:String(x?.meta||x?.detail||'Требуется проверка'),target:x?.target||'home',dealId:x?.deal_id||null});",
    "for(const x of actionableOpsAlerts)queueRows.push({tone:ronaFdV5Key(x?.severity)==='CRITICAL'||ronaFdV5Key(x?.severity)==='ERROR'?'red':ronaFdV5Key(x?.severity)==='INFO'?'cyan':'amber',name:String(x?.title||'Операционный сигнал'),meta:String(x?.meta||x?.detail||'Требуется проверка'),target:x?.target||'home',dealId:x?.deal_id||null,entityType:x?.entity_type||null,entityId:x?.entity_id||null});",
    'actionable-entity-context'
  );

  patched=replaceRequired(
    patched,
    "row.target?e('button',{class:'rona-fd-v5-event__open',type:'button','aria-label':'Открыть раздел',onclick:()=>adminHomeNavigate(row.target),text:'›'}):e('span',{class:'rona-fd-v5-screen__count',text:'!'})",
    "e('button',{class:'rona-fd-v5-event__open',type:'button','aria-label':'Открыть действие',onclick:()=>ronaOpsV83OpenQueueRow(row),text:'›'})",
    'queue-action-button'
  );

  patched=replaceRequired(
    patched,
    "  window.__RONA_ADMIN_OPERATIONS_COMMAND_CENTER__='v8.2-action-queue-normalized-v1';\n  window.__RONA_ADMIN_OPERATIONS_READMODEL_RECOVERY__='OPERATIONS_CURRENT_V1_RECOVERY_V1';\n  window.__RONA_ADMIN_OPERATIONS_ACTION_QUEUE__='OPERATIONS_ACTION_QUEUE_NORMALIZED_V1';",
    "  window.__RONA_ADMIN_OPERATIONS_COMMAND_CENTER__='v8.3-action-router-v1';\n  window.__RONA_ADMIN_OPERATIONS_READMODEL_RECOVERY__='OPERATIONS_CURRENT_V1_RECOVERY_V1';\n  window.__RONA_ADMIN_OPERATIONS_ACTION_QUEUE__='OPERATIONS_ACTION_QUEUE_NORMALIZED_V1';\n  window.__RONA_ADMIN_OPERATIONS_ACTION_ROUTER__='OPERATIONS_ACTION_ROUTER_V1';",
    'browser-version'
  );

  if(!patched.includes("function ronaOpsV83OpenQueueRow(row)"))throw new Error('ADMIN_OPERATIONS_V83_ROUTER_MISSING');
  if(!patched.includes("if(action.kind==='DEAL'&&action.dealId){ronaOpsV5OpenDeal(action.dealId);return}"))throw new Error('ADMIN_OPERATIONS_V83_DEAL_DEEPLINK_MISSING');
  if(!patched.includes("role==='RAIL_LOGISTICS'"))throw new Error('ADMIN_OPERATIONS_V83_RAIL_ROUTE_MISSING');
  if(!patched.includes("domain==='FINANCE'"))throw new Error('ADMIN_OPERATIONS_V83_FINANCE_ROUTE_MISSING');
  if(!patched.includes("domain==='CLIENT_INTAKE'"))throw new Error('ADMIN_OPERATIONS_V83_APPLICATION_ROUTE_MISSING');
  if(!patched.includes("window.__RONA_ADMIN_OPERATIONS_ACTION_ROUTER__='OPERATIONS_ACTION_ROUTER_V1'"))throw new Error('ADMIN_OPERATIONS_V83_MARKER_MISSING');
  if(patched.includes("setInterval(()=>ronaOpsV83"))throw new Error('ADMIN_OPERATIONS_V83_POLLING_FORBIDDEN');
  return patched;
}
