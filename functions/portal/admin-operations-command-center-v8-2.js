import { patchAdminOperationsCommandCenterV81 as patchV81 } from './admin-operations-command-center-v8-1.js';

export const OPERATIONS_COMMAND_CENTER_VERSION='v8.2-action-queue-normalized-v1';
export const OPERATIONS_ACTION_QUEUE_CONTRACT='OPERATIONS_ACTION_QUEUE_NORMALIZED_V1';

function replaceRequired(source,from,to,label){
  const first=source.indexOf(from);
  if(first<0)throw new Error('ADMIN_OPERATIONS_V82_SOURCE_MISMATCH:'+label);
  if(source.indexOf(from,first+from.length)>=0)throw new Error('ADMIN_OPERATIONS_V82_SOURCE_NOT_UNIQUE:'+label);
  return source.slice(0,first)+to+source.slice(first+from.length);
}

function replaceSectionRequired(source,start,end,replacement,label){
  const first=source.indexOf(start);
  if(first<0)throw new Error('ADMIN_OPERATIONS_V82_SECTION_START_MISSING:'+label);
  const boundary=source.indexOf(end,first+start.length);
  if(boundary<0)throw new Error('ADMIN_OPERATIONS_V82_SECTION_END_MISSING:'+label);
  if(source.indexOf(start,first+start.length)>=0)throw new Error('ADMIN_OPERATIONS_V82_SECTION_START_NOT_UNIQUE:'+label);
  return source.slice(0,first)+replacement+source.slice(boundary);
}

export function patchAdminOperationsCommandCenterV82(script){
  let patched=patchV81(script);

  patched=replaceSectionRequired(
    patched,
    "  const opsTasks=Array.isArray(ops.tasks)?ops.tasks:[]",
    "  const selectedRequested=",
    "  const opsTasksRaw=Array.isArray(ops.tasks)?ops.tasks:[],opsReverse=Array.isArray(ops.reverseEvents)?ops.reverseEvents:[],opsMaterializer=Array.isArray(ops.financeMaterializerHealth)?ops.financeMaterializerHealth:[],opsRail=Array.isArray(ops.railRuntime)?ops.railRuntime:[];\n  const opsTasks=opsTasksRaw.filter(x=>!['ACKNOWLEDGED','COMPLETED','CLOSED','REJECTED','CANCELLED','CANCELED','DONE'].includes(ronaFdV5Key(x?.status))),taskIds=new Set(opsTasks.map(x=>String(x?.id||''))),taskSourceEventIds=new Set(opsTasks.filter(x=>ronaFdV5Key(x?.source_type)==='PORTAL_REVERSE_EVENT').map(x=>String(x?.source_object_id||'')).filter(Boolean));\n  const actionableReverse=opsReverse.filter(x=>{const p=ronaFdV5Key(x?.processing_state),a=ronaFdV5Key(x?.acknowledgement_state),eventId=String(x?.event_id||'');const pending=['QUEUED','PENDING','FAILED','ERROR','RETRY','RETRYING'].includes(p)||['PENDING','WAITING','REQUIRED'].includes(a);return pending&&!taskSourceEventIds.has(eventId)}),actionableReverseIds=new Set(actionableReverse.map(x=>String(x?.id||'')));\n  const actionableOpsAlerts=opsAlerts.filter(x=>{const t=ronaFdV5Key(x?.entity_type),sev=ronaFdV5Key(x?.severity),id=String(x?.entity_id||'');if(t==='AI_RUNTIME')return false;if(t==='STAFF_TASK'&&!taskIds.has(id))return false;if(t==='REVERSE_EVENT'&&!actionableReverseIds.has(id))return false;if(t==='FINANCE_MATERIALIZER'&&!['CRITICAL','ERROR'].includes(sev))return false;if(t==='RAIL_PROVIDER'&&!opsRail.some(r=>ronaFdV5Key(r?.mode)!=='DISABLED'&&(r?.production_polling_enabled===false||ronaFdV5Key(r?.credentials_state)!=='READY'||ronaFdV5Key(r?.api_contract_state)!=='READY')))return false;return true});\n  for(const x of actionableOpsAlerts)queueRows.push({tone:ronaFdV5Key(x?.severity)==='CRITICAL'||ronaFdV5Key(x?.severity)==='ERROR'?'red':ronaFdV5Key(x?.severity)==='INFO'?'cyan':'amber',name:String(x?.title||'Операционный сигнал'),meta:String(x?.meta||x?.detail||'Требуется проверка'),target:x?.target||'home',dealId:x?.deal_id||null});\n  const criticalCount=queueRows.filter(x=>x?.tone==='red').length;\n  const attentionCount=queueRows.length;\n",
    'normalized-action-queue'
  );

  patched=replaceRequired(
    patched,
    "  window.__RONA_ADMIN_OPERATIONS_COMMAND_CENTER__='v8.1-readmodel-recovery-v1';\n  window.__RONA_ADMIN_OPERATIONS_READMODEL_RECOVERY__='OPERATIONS_CURRENT_V1_RECOVERY_V1';",
    "  window.__RONA_ADMIN_OPERATIONS_COMMAND_CENTER__='v8.2-action-queue-normalized-v1';\n  window.__RONA_ADMIN_OPERATIONS_READMODEL_RECOVERY__='OPERATIONS_CURRENT_V1_RECOVERY_V1';\n  window.__RONA_ADMIN_OPERATIONS_ACTION_QUEUE__='OPERATIONS_ACTION_QUEUE_NORMALIZED_V1';",
    'browser-version'
  );

  if(!patched.includes("taskSourceEventIds=new Set"))throw new Error('ADMIN_OPERATIONS_V82_REVERSE_DEDUP_MISSING');
  if(!patched.includes("t==='STAFF_TASK'&&!taskIds.has(id)"))throw new Error('ADMIN_OPERATIONS_V82_TASK_FILTER_MISSING');
  if(!patched.includes("const criticalCount=queueRows.filter(x=>x?.tone==='red').length"))throw new Error('ADMIN_OPERATIONS_V82_CRITICAL_QUEUE_MISSING');
  if(!patched.includes("const attentionCount=queueRows.length"))throw new Error('ADMIN_OPERATIONS_V82_ATTENTION_QUEUE_MISSING');
  if(!patched.includes("window.__RONA_ADMIN_OPERATIONS_ACTION_QUEUE__='OPERATIONS_ACTION_QUEUE_NORMALIZED_V1'"))throw new Error('ADMIN_OPERATIONS_V82_MARKER_MISSING');
  if(patched.includes("setInterval(()=>ronaOpsV82"))throw new Error('ADMIN_OPERATIONS_V82_POLLING_FORBIDDEN');
  return patched;
}
