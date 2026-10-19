// RONA Admin Operations supplier resource KPI: additive post-V12 patch.
// The governed V10 source stays byte-for-byte unchanged (source-lock SHA).
// No client-side fake values, business transitions, writes, or scheduled polling.
function replaceOnce(source,from,to,label){
  const first=source.indexOf(from);
  if(first<0||source.indexOf(from,first+from.length)>=0)
    throw new Error('OPS_SUPPLIER_RESOURCE_V1_SOURCE_MISMATCH:'+label);
  return source.slice(0,first)+to+source.slice(first+from.length);
}

export function patchAdminSupplierResourceV1(input){
  let output=String(input||'');
  if(!output.includes('OPERATIONS_CURRENT_V2')||
     !output.includes('__RONA_ADMIN_OPERATIONS_LEGACY_60S_POLL_DISABLED__'))
    throw new Error('OPS_SUPPLIER_RESOURCE_V1_OWNER_SOURCE_REQUIRED');
  if(output.includes('__RONA_ADMIN_OPERATIONS_RESOURCE_PENDING__'))
    throw new Error('OPS_SUPPLIER_RESOURCE_V1_DUPLICATE_PATCH');

  output=replaceOnce(
    output,
    "  window.__RONA_ADMIN_OPERATIONS_ATTENTION_UNSEEN__={ready:unseenN!==null,unseen:unseenN,total:actionN,at:Date.now()};",
    [
      "  // Resource authority: Owner supplier workflow, never ACCEPTED_AWAITING_DEAL_REGISTRATION.",
      "  const supplierPendingN=num('supplierResourcePending'),",
      "        supplierConflictN=num('supplierResourceStageConflict'),",
      "        failedPortalN=num('failedPortalEvents');",
      "  const supplierQueue=ready&&Array.isArray(snap.supplierResourceQueue)?snap.supplierResourceQueue:[];",
      "  window.__RONA_ADMIN_OPERATIONS_RESOURCE_PENDING__={",
      "    ready:ready&&supplierPendingN!==null,",
      "    count:supplierPendingN,stageConflicts:supplierConflictN,",
      "    authority:ready?(snap.supplierResourceAuthority||null):null,",
      "    applications:supplierQueue,at:Date.now()",
      "  };",
      "  window.__RONA_ADMIN_OPERATIONS_ATTENTION_UNSEEN__={ready:unseenN!==null,unseen:unseenN,total:actionN,at:Date.now()};"
    ].join('\n'),
    'kpi-and-provenance'
  );

  output=replaceOnce(
    output,
    "e('div',{class:'rona-fd-v5__ann-value',text:stateText})",
    "e('div',{class:'rona-fd-v5__ann-value',text:stateText+(supplierPendingN===null?'':' · Ресурс ожидают: '+supplierPendingN)})",
    'annunciator'
  );

  output=replaceOnce(
    output,
    "onclick:()=>code==='CAUT-03'?ronaOpsV10OpenAttention():adminHomeNavigate(target)",
    "onclick:()=>code==='CAUT-03'?ronaOpsV10OpenAttention():code==='WARN-06'?ronaOpsV10OpenAttention():adminHomeNavigate(target)",
    'critical-action-navigation'
  );

  const gauge02="    gauge('FLT-02','В исполнении по реестру',executionN===null?'—':executionN,ready?sourceFoot('deals'):'Источник не готов','deals',sourceGood('deals')?'indigo':'amber'),";
  output=replaceOnce(
    output,
    gauge02,
    gauge02+[
      "",
      "    gauge('RES-03','Ожидают ресурс',supplierPendingN===null?'—':supplierPendingN,",
      "      ready?(supplierPendingN===null?'Реестр поставщика недоступен':('SUPPLIER_PENDING · расхождение статусов: '+String(supplierConflictN===null?'—':supplierConflictN))):'Источник не готов',",
      "      'applications',ready&&supplierPendingN>0?'amber':supplierPendingN===0?'green':'cyan'),"
    ].join('\n'),
    'resource-card'
  );

  // CAUT-03 counts unread notices, NOT all actions awaiting business decisions.
  // The previous label "Требует действия" falsely showed 0 alongside 5 pending resources.
  output=replaceOnce(
    output,
    "gauge('CAUT-03','Требует действия',unseenN===null?'—':unseenN",
    "gauge('CAUT-03','Непросмотренные',unseenN===null?'—':unseenN",
    'unread-only-label'
  );

  output=replaceOnce(
    output,
    "gauge('WARN-06','Критические события',criticalN===null?'—':criticalN,ready?(sourceGood('actions')?'Исключения по реестру':'СТАРЫЕ ОТКРЫТЫЕ ЗАДАЧИ'):'Источник не готов','home',ready&&(criticalN||0)>0?'red':'green')",
    "gauge('WARN-06','Критические события',criticalN===null?'—':criticalN,ready?(failedPortalN===null?'Ошибки портала · источник не подтверждён':('Сбои отправки клиентских запросов: '+String(failedPortalN))):'Источник не готов','home',ready&&(criticalN||0)>0?'red':'green')",
    'technical-card'
  );

  if(!output.includes("gauge('RES-03','Ожидают ресурс'")||
     !output.includes("gauge('WARN-06','Критические события'")||
     !output.includes("gauge('CAUT-03','Непросмотренные'")||
     !output.includes("window.__RONA_ADMIN_OPERATIONS_RESOURCE_PENDING__"))
    throw new Error('OPS_SUPPLIER_RESOURCE_V1_RENDER_CONTRACT_MISSING');

  return output;
}

export const __test={replaceOnce};
