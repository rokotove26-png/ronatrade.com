import { patchAdminOperationsCommandCenterV10Clean as patchV10 } from './admin-operations-command-center-v10-clean.js';

export const OPERATIONS_COMMAND_CENTER_VERSION='v11-owner-ai-office-v1';
export const OWNER_AI_OFFICE_CONTRACT='RONA_OWNER_AI_OFFICE_V1';

function replaceRequired(source,from,to,label){
  const first=source.indexOf(from);
  if(first<0)throw new Error('ADMIN_OPERATIONS_V11_SOURCE_MISMATCH:'+label);
  if(source.indexOf(from,first+from.length)>=0)throw new Error('ADMIN_OPERATIONS_V11_SOURCE_NOT_UNIQUE:'+label);
  return source.slice(0,first)+to+source.slice(first+from.length);
}

export function patchAdminOperationsCommandCenterV11(script){
  let patched=patchV10(script);

  patched=replaceRequired(
    patched,
    "  const k=ready?(snap.kpis||{}):{};\n  const deals=ready&&Array.isArray(snap.deals)?snap.deals:[];",
    "  const k=ready?(snap.kpis||{}):{};\n  const aiOffice=adminData?.operations?.aiOffice||{},aiK=aiOffice?.metrics||{};\n  const deals=ready&&Array.isArray(snap.deals)?snap.deals:[];",
    'ai-office-read-model'
  );

  patched=replaceRequired(
    patched,
    "  const activeN=num('activeDeals'),executionN=num('executionDeals'),actionN=num('actionsRequired'),unseenN=unseenActions===null?null:unseenActions.length,railN=num('trustedWagons'),paymentN=num('paymentsDue'),criticalN=num('criticalEvents'),clientsN=num('clientsOnline'),agentsN=num('agentsOnline'),documentsN=num('documentsTotal'),documentsAttentionN=num('documentsAttention');",
    "  const activeN=num('activeDeals'),executionN=num('executionDeals'),actionN=num('actionsRequired'),unseenN=unseenActions===null?null:unseenActions.length,railN=num('trustedWagons'),paymentN=num('paymentsDue'),criticalN=num('criticalEvents'),clientsN=num('clientsOnline'),agentsN=num('agentsOnline'),documentsN=num('documentsTotal'),documentsAttentionN=num('documentsAttention');\n  const humanDecisionN=Number(aiK?.owner_interventions||0),activeAiN=Number(aiK?.active_ai_roles||0),aiGapN=Number(aiK?.ai_role_gaps||0),openDependencyN=Number(aiK?.open_dependencies||0),aiExceptionN=Number(aiK?.action_now||0)+Number(aiK?.blocked_ai||0)+Number(aiK?.state_conflicts||0);",
    'owner-ai-kpis'
  );

  patched=replaceRequired(
    patched,
    "  const stateTone=!ready?(ronaOpsV10Error?'amber':'cyan'):(criticalN||0)>0?'red':(actionN||0)>0?'amber':'green';\n  const stateCode=!ready?(ronaOpsV10Error?'DATA DEGRADED':'DATA SYNC'):(criticalN||0)>0?'MASTER WARNING':(actionN||0)>0?'MASTER CAUTION':'SYSTEM NORMAL';\n  const stateText=!ready?(ronaOpsV10Error?('Ошибка Operations V2: '+ronaOpsV10Error):'Синхронизация единого операционного снимка…'):(criticalN||0)>0?('Критические события: '+criticalN):(actionN||0)>0?('Открыто действий: '+actionN+' · новых: '+(unseenN===null?'—':unseenN)):'Контур стабилен';",
    "  const stateTone=!ready?(ronaOpsV10Error?'amber':'cyan'):humanDecisionN>0?'amber':(criticalN||0)>0?'red':aiGapN>0?'amber':'green';\n  const stateCode=!ready?(ronaOpsV10Error?'DATA DEGRADED':'DATA SYNC'):humanDecisionN>0?'OWNER ACTION':(criticalN||0)>0?'MASTER WARNING':aiGapN>0?'AI ROLE GAP':'AI OFFICE NORMAL';\n  const stateText=!ready?(ronaOpsV10Error?('Ошибка Operations V2: '+ronaOpsV10Error):'Синхронизация единого операционного снимка…'):humanDecisionN>0?('Нужно решение собственника/казначея: '+humanDecisionN):(criticalN||0)>0?('Критические события ИИ-контура: '+criticalN):aiGapN>0?('Не материализовано ИИ-ролей: '+aiGapN):'ИИ-контур стабилен';",
    'owner-state-semantics'
  );

  patched=replaceRequired(
    patched,
    "e('div',{class:'rona-fd-v5__overline',text:'RONA TRADE · OPERATIONS FLIGHTDECK'}),e('h1',{class:'rona-ops-v4__title',text:'Операционный центр'}),e('div',{class:'rona-fd-v5__subtitle'},e('span',{class:'rona-fd-v5__bus-dot'}),e('span',{text:'OPERATIONS CURRENT V2'}),e('span',{text:'·'}),e('span',{text:'FACTUAL STATE ONLY'}))",
    "e('div',{class:'rona-fd-v5__overline',text:'RONA TRADE · OWNER AI COMMAND CENTER'}),e('h1',{class:'rona-ops-v4__title',text:'Центр собственника'}),e('div',{class:'rona-fd-v5__subtitle'},e('span',{class:'rona-fd-v5__bus-dot'}),e('span',{text:'OWNER + TREASURY · HUMAN'}),e('span',{text:'·'}),e('span',{text:'ОСТАЛЬНЫЕ ОПЕРАЦИОННЫЕ РОЛИ · AI'}))",
    'owner-ai-title'
  );

  patched=replaceRequired(
    patched,
    "gauge('CAUT-03','Требует действия',unseenN===null?'—':unseenN,ready?(unseenN===null?('Статус просмотра недоступен · открыто: '+String(actionN||0)):('Непросмотренные · открыто всего: '+String(actionN||0))):'Источник не готов','home',ready&&(unseenN||0)>0?'amber':'green'),",
    "gauge('OWN-03','Решение человека',humanDecisionN,'Только собственник / казначей','home',humanDecisionN>0?'amber':'green'),",
    'human-decision-gauge'
  );

  patched=replaceRequired(
    patched,
    "const gauge=(code,label,value,foot,target,tone)=>e('button',{class:'rona-fd-v5-gauge is-'+(tone||'cyan'),type:'button','data-code':code,'aria-label':label+': '+String(value),onclick:()=>code==='CAUT-03'?ronaOpsV10OpenAttention():adminHomeNavigate(target)},",
    "const gauge=(code,label,value,foot,target,tone)=>e('button',{class:'rona-fd-v5-gauge is-'+(tone||'cyan'),type:'button','data-code':code,'aria-label':label+': '+String(value),onclick:()=>code==='OWN-03'?ronaOpsV10OpenAttention():adminHomeNavigate(target)},",
    'human-decision-open'
  );

  patched=replaceRequired(
    patched,
    "system('DOCUMENT CONTROL','Документы',documentsN===null?'—':documentsN,ready?(String(documentsAttentionN||0)+' требуют контроля'):'Источник не готов','documents',ready&&(documentsAttentionN||0)>0?'amber':ready?'green':'cyan')\n  );",
    "system('DOCUMENT CONTROL','Документы',documentsN===null?'—':documentsN,ready?(String(documentsAttentionN||0)+' требуют контроля'):'Источник не готов','documents',ready&&(documentsAttentionN||0)>0?'amber':ready?'green':'cyan'),\n    system('AI OFFICE','ИИ-офис',activeAiN,'gaps: '+String(aiGapN)+' · dependencies: '+String(openDependencyN)+' · exceptions: '+String(aiExceptionN),'home',(aiGapN||aiExceptionN)?'amber':'green')\n  );",
    'ai-office-system-card'
  );

  patched=replaceRequired(
    patched,
    "const footer=e('footer',{class:'rona-fd-v5__footer'},e('span',{},'DATA BUS · ',e('strong',{text:'OPERATIONS CURRENT V2'}),' · SINGLE OWNER'),e('span',{text:stamp?('CURRENT STATE · '+String(stamp)):'CURRENT STATE · —'}));",
    "const footer=e('footer',{class:'rona-fd-v5__footer'},e('span',{},'OWNER/AI BUS · ',e('strong',{text:'OWNER + TREASURY ARE THE ONLY HUMAN ACTORS'}),' · TASK ROLES = AI ROUTING TAXONOMY'),e('span',{text:stamp?('CURRENT STATE · '+String(stamp)):'CURRENT STATE · —'}));",
    'owner-ai-footer'
  );

  patched=replaceRequired(
    patched,
    "  window.__RONA_ADMIN_OPERATIONS_COMMAND_CENTER__='v10-operations-current-v2-single-owner';",
    "  window.__RONA_ADMIN_OPERATIONS_COMMAND_CENTER__='v11-owner-ai-office-v1';\n  window.__RONA_OWNER_AI_OFFICE__='RONA_OWNER_AI_OFFICE_V1';\n  window.__RONA_HUMAN_ACTOR_RULE__='ONLY_OWNER_AND_TREASURY_ARE_HUMAN';",
    'browser-version'
  );

  if(!patched.includes("window.__RONA_OWNER_AI_OFFICE__='RONA_OWNER_AI_OFFICE_V1'"))throw new Error('ADMIN_OPERATIONS_V11_MARKER_MISSING');
  if(!patched.includes("'Решение человека'"))throw new Error('ADMIN_OPERATIONS_V11_HUMAN_DECISION_MISSING');
  if(!patched.includes("'OWNER + TREASURY · HUMAN'"))throw new Error('ADMIN_OPERATIONS_V11_HUMAN_TOPOLOGY_MISSING');
  if(!patched.includes("'ИИ-офис'"))throw new Error('ADMIN_OPERATIONS_V11_AI_OFFICE_MISSING');
  return patched;
}
