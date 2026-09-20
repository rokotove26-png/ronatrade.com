import { patchAdminOperationsCommandCenterV8 as patchV8 } from './admin-operations-command-center-v8.js';

export const OPERATIONS_COMMAND_CENTER_VERSION='v8.1-readmodel-recovery-v1';
export const OPERATIONS_READMODEL_RECOVERY_CONTRACT='OPERATIONS_CURRENT_V1_RECOVERY_V1';

function replaceRequired(source,from,to,label){
  const first=source.indexOf(from);
  if(first<0)throw new Error('ADMIN_OPERATIONS_V81_SOURCE_MISMATCH:'+label);
  if(source.indexOf(from,first+from.length)>=0)throw new Error('ADMIN_OPERATIONS_V81_SOURCE_NOT_UNIQUE:'+label);
  return source.slice(0,first)+to+source.slice(first+from.length);
}

export function patchAdminOperationsCommandCenterV81(script){
  let patched=patchV8(script);

  patched=replaceRequired(
    patched,
    "let ronaOpsV7Busy=false,ronaOpsV7Queued=false,ronaOpsV7Debounce=0,ronaOpsV7ReconnectTimer=0,ronaOpsV7HeartbeatTimer=0,ronaOpsV7StaleTimer=0,ronaOpsV7ReconnectAttempt=0,ronaOpsV7Ref=1;const ronaOpsV7DirtyDomains=new Set();",
    "let ronaOpsV7Busy=false,ronaOpsV7Queued=false,ronaOpsV7Debounce=0,ronaOpsV7ReconnectTimer=0,ronaOpsV7HeartbeatTimer=0,ronaOpsV7StaleTimer=0,ronaOpsV7ReconnectAttempt=0,ronaOpsV7Ref=1,ronaOpsV81RecoveryTimer=0;const ronaOpsV7DirtyDomains=new Set();",
    'recovery-timer'
  );

  patched=replaceRequired(
    patched,
    "async function ronaOpsV7RefreshCurrent(reason='EVENT'){\n  if(ronaOpsV7Busy){ronaOpsV7Queued=true;return null}\n  ronaOpsV7Busy=true;\n  const domains=[...ronaOpsV7DirtyDomains];ronaOpsV7DirtyDomains.clear();",
    "async function ronaOpsV7RefreshCurrent(reason='EVENT'){\n  if(ronaOpsV7Busy){ronaOpsV7Queued=true;return null}\n  ronaOpsV7Busy=true;\n  const hadCurrent=window.__RONA_ADMIN_OPERATIONS_CURRENT_V1__?.version==='OPERATIONS_CURRENT_V1';\n  if(!hadCurrent){window.__RONA_ADMIN_OPERATIONS_CURRENT_STATUS__='LOADING';window.__RONA_ADMIN_OPERATIONS_CURRENT_ERROR__=null}\n  const domains=[...ronaOpsV7DirtyDomains];ronaOpsV7DirtyDomains.clear();",
    'loading-state'
  );

  patched=replaceRequired(
    patched,
    "    window.__RONA_ADMIN_OPERATIONS_CURRENT_ERROR__=null;\n    window.__RONA_ADMIN_OPERATIONS_CURRENT_LAST_FETCH__={reason,at:Date.now(),signalVersion:Number(next.signal_version||0)};",
    "    window.__RONA_ADMIN_OPERATIONS_CURRENT_ERROR__=null;\n    window.__RONA_ADMIN_OPERATIONS_CURRENT_STATUS__='READY';\n    if(ronaOpsV81RecoveryTimer){clearTimeout(ronaOpsV81RecoveryTimer);ronaOpsV81RecoveryTimer=0}\n    window.__RONA_ADMIN_OPERATIONS_CURRENT_LAST_FETCH__={reason,at:Date.now(),signalVersion:Number(next.signal_version||0)};",
    'ready-state'
  );

  patched=replaceRequired(
    patched,
    "  }catch(err){\n    window.__RONA_ADMIN_OPERATIONS_CURRENT_ERROR__=String(err?.code||err?.message||err);\n    window.dispatchEvent(new CustomEvent('rona:operations-current-error',{detail:{code:window.__RONA_ADMIN_OPERATIONS_CURRENT_ERROR__,reason}}));\n    if(ronaOpsV7HomeVisible())renderAdminHome();\n    return null;",
    "  }catch(err){\n    window.__RONA_ADMIN_OPERATIONS_CURRENT_ERROR__=String(err?.code||err?.message||err);\n    window.__RONA_ADMIN_OPERATIONS_CURRENT_STATUS__='ERROR';\n    window.dispatchEvent(new CustomEvent('rona:operations-current-error',{detail:{code:window.__RONA_ADMIN_OPERATIONS_CURRENT_ERROR__,reason}}));\n    if(!window.__RONA_ADMIN_OPERATIONS_CURRENT_V1__&&reason!=='RECOVERY_RETRY'&&!ronaOpsV81RecoveryTimer){ronaOpsV81RecoveryTimer=setTimeout(()=>{ronaOpsV81RecoveryTimer=0;ronaOpsV7DirtyDomains.add('OPERATIONS');ronaOpsV7RefreshCurrent('RECOVERY_RETRY')},1200)}\n    if(ronaOpsV7HomeVisible())renderAdminHome();\n    return null;",
    'bounded-recovery'
  );

  patched=replaceRequired(
    patched,
    "  const opsCurrentReady=ops?.version==='OPERATIONS_CURRENT_V1',opsEventConnected=window.__RONA_ADMIN_OPERATIONS_EVENT_STATE__?.connected===true,opsCurrentError=window.__RONA_ADMIN_OPERATIONS_CURRENT_ERROR__;\n  const stateTone=!opsCurrentReady||opsCurrentError||!opsEventConnected?'amber':effectiveCriticalCount?'red':effectiveAttentionCount?'amber':'green';\n  const stateCode=!opsCurrentReady||opsCurrentError?'DATA DEGRADED':!opsEventConnected?'EVENT LINK':effectiveCriticalCount?'MASTER WARNING':effectiveAttentionCount?'MASTER CAUTION':'SYSTEM NORMAL';\n  const stateText=!opsCurrentReady?'Операционный read model недоступен':opsCurrentError?'Ошибка read model: '+String(opsCurrentError):!opsEventConnected?'Канал событий переподключается':effectiveCriticalCount?'Критические события: '+effectiveCriticalCount:effectiveAttentionCount?'Требует внимания: '+effectiveAttentionCount:'Контур стабилен';",
    "  const opsCurrentReady=ops?.version==='OPERATIONS_CURRENT_V1',opsEventConnected=window.__RONA_ADMIN_OPERATIONS_EVENT_STATE__?.connected===true,opsCurrentError=window.__RONA_ADMIN_OPERATIONS_CURRENT_ERROR__,opsCurrentStatus=String(window.__RONA_ADMIN_OPERATIONS_CURRENT_STATUS__||''),opsCurrentLoading=!opsCurrentReady&&!opsCurrentError&&opsCurrentStatus==='LOADING';\n  const stateTone=opsCurrentLoading?'cyan':!opsCurrentReady||opsCurrentError||!opsEventConnected?'amber':effectiveCriticalCount?'red':effectiveAttentionCount?'amber':'green';\n  const stateCode=opsCurrentLoading?'DATA SYNC':opsCurrentError?'DATA DEGRADED':!opsCurrentReady?'DATA DEGRADED':!opsEventConnected?'EVENT LINK':effectiveCriticalCount?'MASTER WARNING':effectiveAttentionCount?'MASTER CAUTION':'SYSTEM NORMAL';\n  const stateText=opsCurrentLoading?'Синхронизация операционного read model…':opsCurrentError?'Ошибка read model: '+String(opsCurrentError):!opsCurrentReady?'Операционный read model недоступен':!opsEventConnected?'Канал событий переподключается':effectiveCriticalCount?'Критические события: '+effectiveCriticalCount:effectiveAttentionCount?'Требует внимания: '+effectiveAttentionCount:'Контур стабилен';",
    'truthful-system-state'
  );

  patched=replaceRequired(
    patched,
    "  window.__RONA_ADMIN_OPERATIONS_COMMAND_CENTER__='v8-mission-control-current-v1';",
    "  window.__RONA_ADMIN_OPERATIONS_COMMAND_CENTER__='v8.1-readmodel-recovery-v1';",
    'browser-version'
  );

  if(!patched.includes("window.__RONA_ADMIN_OPERATIONS_CURRENT_STATUS__='LOADING'"))throw new Error('ADMIN_OPERATIONS_V81_LOADING_STATE_MISSING');
  if(!patched.includes("reason!=='RECOVERY_RETRY'"))throw new Error('ADMIN_OPERATIONS_V81_BOUNDED_RETRY_MISSING');
  if(!patched.includes("opsCurrentLoading?'DATA SYNC'"))throw new Error('ADMIN_OPERATIONS_V81_SYNC_STATE_MISSING');
  if(!patched.includes("opsCurrentError?'Ошибка read model: '+String(opsCurrentError)"))throw new Error('ADMIN_OPERATIONS_V81_ERROR_DETAIL_MISSING');
  if(!patched.includes("window.__RONA_ADMIN_OPERATIONS_COMMAND_CENTER__='v8.1-readmodel-recovery-v1'"))throw new Error('ADMIN_OPERATIONS_V81_VERSION_MISSING');
  if(patched.includes("setInterval(()=>ronaOpsV81"))throw new Error('ADMIN_OPERATIONS_V81_POLLING_FORBIDDEN');
  return patched;
}
