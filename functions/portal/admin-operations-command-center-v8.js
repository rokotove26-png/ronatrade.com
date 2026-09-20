import { patchAdminOperationsCommandCenterV7 as patchV7 } from './admin-operations-command-center-v7.js';

export const OPERATIONS_COMMAND_CENTER_VERSION='v8-mission-control-current-v1';
export const OPERATIONS_MISSION_CONTRACT='DEALS_CURRENT_V4_MISSION_V1';

function replaceRequired(source,from,to,label){
  const first=source.indexOf(from);
  if(first<0)throw new Error('ADMIN_OPERATIONS_V8_SOURCE_MISMATCH:'+label);
  if(source.indexOf(from,first+from.length)>=0)throw new Error('ADMIN_OPERATIONS_V8_SOURCE_NOT_UNIQUE:'+label);
  return source.slice(0,first)+to+source.slice(first+from.length);
}

function replaceSectionRequired(source,start,end,replacement,label){
  const first=source.indexOf(start);
  if(first<0)throw new Error('ADMIN_OPERATIONS_V8_SECTION_START_MISSING:'+label);
  const boundary=source.indexOf(end,first+start.length);
  if(boundary<0)throw new Error('ADMIN_OPERATIONS_V8_SECTION_END_MISSING:'+label);
  if(source.indexOf(start,first+start.length)>=0)throw new Error('ADMIN_OPERATIONS_V8_SECTION_START_NOT_UNIQUE:'+label);
  return source.slice(0,first)+replacement+source.slice(boundary);
}

export function deriveOperationsMissionCurrentRows(baseDeals,snapshot){
  const base=Array.isArray(baseDeals)?baseDeals:[];
  if(!snapshot||!Array.isArray(snapshot.deals))return base.slice();

  const baseById=new Map(base.map(row=>[String(row?.deal_id||''),row]));
  const documents=Array.isArray(snapshot.documents)?snapshot.documents:[];
  const rail=Array.isArray(snapshot.rail)?snapshot.rail:[];

  const key=v=>String(v??'').trim().toUpperCase();
  const num=v=>{
    if(v===null||v===undefined||v==='')return null;
    const n=Number(v);
    return Number.isFinite(n)?n:null;
  };
  const terminal=d=>{
    const business=key(d?.business_status),lifecycle=key(d?.lifecycle_state),cancellation=key(d?.cancellation_state);
    return cancellation==='CANCELLED'
      ||['CLOSED','COMPLETED','SETTLED','ARCHIVED','CANCELLED','CANCELED','TERMINATED','VOID'].includes(business)
      ||['CLOSED','ARCHIVED','SUPERSEDED'].includes(lifecycle);
  };
  const executionText=v=>{
    const k=key(v);
    if(k==='CONFIRMED_EXECUTION_STATE')return 'Исполнение подтверждено';
    if(k==='CONFIRMED_SPEND_BEFORE_CLIENT_RECEIPT')return 'Расходы подтверждены';
    if(k==='EXECUTING'||k==='IN_PROGRESS')return 'В исполнении';
    return v||'—';
  };

  return snapshot.deals.map(current=>{
    const id=String(current?.deal_id||'');
    const original=baseById.get(id)||{};
    const d={...original,...current};
    d.deal_id=current?.deal_id||original?.deal_id||null;

    const dealDocs=documents.filter(x=>String(x?.deal_id||'')===id);
    const railRow=rail.find(x=>String(x?.deal_id||'')===id)||null;
    const hasSigned=dealDocs.some(x=>key(x?.document_kind)==='SIGNED_ADDENDUM');
    const hasInvoice=dealDocs.some(x=>key(x?.document_kind)==='INVOICE');
    const uncheckedDocs=dealDocs.filter(x=>x?.checked_by_admin===false).length;

    const trusted=num(railRow?.trusted_wagon_count)??(Array.isArray(railRow?.wagon_positions)?railRow.wagon_positions.length:0);
    const verify=num(railRow?.unresolved_or_conflict_count)??(Array.isArray(railRow?.verification_wagons)?railRow.verification_wagons.length:0);
    const gu12=num(railRow?.gu12_count)??0;
    const railState=key(railRow?.rail_state);
    const routeState=key(railRow?.route_resolution_state);
    const finance=key(d?.finance_status);
    const financeProjection=key(d?.finance_projection_version);
    const remaining=num(d?.client_remaining_amount);
    const dueNow=num(d?.due_now)??0;
    const expectedNotDue=num(d?.expected_not_due)??0;
    const futureConditional=num(d?.future_conditional)??0;
    const expectation=key(d?.payment_expectation_state);
    const handoff=key(d?.payment_handoff_state||'NOT_SENT');
    const business=key(d?.business_status);
    const contract=key(d?.contract_status);
    const documentary=key(d?.documentary_status);

    d.resource_status=d?.product_confirmed_at&&d?.quantity_confirmed_at?'Подтверждено':'Требует подтверждения';
    d.delivery_status=executionText(d?.execution_status);
    d.rail_state=railState||null;
    d.rail_route_resolution_state=routeState||null;
    d.rail_gu12_count=gu12;
    d.rail_trusted_wagons=trusted;
    d.rail_verification_wagons=verify;
    d.rail_position_groups=Array.isArray(railRow?.position_groups)?railRow.position_groups:[];
    d.deal_documents_count=dealDocs.length;
    d.unchecked_documents_count=uncheckedDocs;
    d.mission_document_status=documentary||null;
    d.current_projection_source='DEALS_CURRENT_V4_MISSION_V1';
    d.current_action_required=false;
    d.next_action_target='deals';
    d.next_action_domain='DEAL';
    d.next_action_kind='MONITOR';

    if(terminal(d)){
      d.stage=d?.business_status||d?.lifecycle_state||'Закрыто';
      d.next_action_text='Открыть архивную карточку сделки';
      d.next_action_kind='INFO';
      return d;
    }

    if(!d?.product_confirmed_at){
      d.stage='Подтверждение продукта';
      d.next_action_text='Подтвердить продукт';
      d.current_action_required=true;
      d.next_action_kind='ACTION';
      d.next_action_domain='DEAL_SETUP';
      return d;
    }
    if(!d?.quantity_confirmed_at){
      d.stage='Подтверждение объёма';
      d.next_action_text='Подтвердить объём';
      d.current_action_required=true;
      d.next_action_kind='ACTION';
      d.next_action_domain='DEAL_SETUP';
      return d;
    }
    if(!String(d?.delivery_basis||'').trim()){
      d.stage='Коммерческие условия';
      d.next_action_text='Подтвердить базис поставки';
      d.current_action_required=true;
      d.next_action_kind='ACTION';
      d.next_action_domain='DEAL_SETUP';
      return d;
    }
    if(contract&&contract!=='ACTIVE'){
      d.stage='Договор';
      d.next_action_text='Проверить состояние договора';
      d.current_action_required=true;
      d.next_action_kind='ACTION';
      d.next_action_domain='DEAL_SETUP';
      return d;
    }
    if(!hasSigned){
      d.stage='Документы';
      d.next_action_text='Получить подписанное доп. соглашение';
      d.current_action_required=true;
      d.next_action_kind='ACTION';
      d.next_action_domain='DEAL_SETUP';
      return d;
    }
    if(!hasInvoice){
      d.stage='Документы';
      d.next_action_text='Прикрепить инвойс';
      d.current_action_required=true;
      d.next_action_kind='ACTION';
      d.next_action_domain='DEAL_SETUP';
      return d;
    }

    if(financeProjection==='FINANCE_V8'&&dueNow>0){
      d.stage='Оплата';
      d.next_action_text='Контроль оплаты по наступившему сроку';
      d.next_action_target='payments';
      d.next_action_domain='PAYMENT';
      d.next_action_kind='ACTION';
      d.current_action_required=true;
      return d;
    }

    if(financeProjection!=='FINANCE_V8'&&remaining!==null&&remaining>0&&handoff!=='SENT'&&expectation!=='ACTIVE'){
      d.stage='Передача в оплату';
      d.next_action_text='Передать сделку в оплату';
      d.next_action_domain='PAYMENT_HANDOFF';
      d.next_action_kind='ACTION';
      d.current_action_required=true;
      return d;
    }

    if(verify>0){
      d.stage='ЖД / исполнение';
      d.next_action_text='Проверить дислокацию: '+String(verify);
      d.next_action_target='monitoring';
      d.next_action_domain='RAIL';
      d.next_action_kind='REVIEW';
      return d;
    }

    if(railState==='WAGONS_ACTIVE'&&trusted>0){
      d.stage='ЖД / исполнение';
      d.next_action_text='Контроль движения '+String(trusted)+' вагонов';
      d.next_action_target='monitoring';
      d.next_action_domain='RAIL';
      return d;
    }

    if(business==='EXECUTING'&&routeState==='RESOLVED'&&gu12<=0){
      d.stage='ЖД / исполнение';
      d.next_action_text='Ожидается назначение ГУ-12';
      d.next_action_target='monitoring';
      d.next_action_domain='RAIL';
      return d;
    }

    if(business==='EXECUTING'&&routeState!=='RESOLVED'){
      d.stage='ЖД / исполнение';
      d.next_action_text='Контроль формирования маршрута';
      d.next_action_target='monitoring';
      d.next_action_domain='RAIL';
      return d;
    }

    if(documentary==='TO_VERIFY'||uncheckedDocs>0){
      d.stage='Документы';
      d.next_action_text=uncheckedDocs>0?'Проверить документы: '+String(uncheckedDocs):'Проверить документальный контур';
      d.next_action_target='deals';
      d.next_action_domain='DOCUMENTS';
      d.next_action_kind='REVIEW';
      return d;
    }

    if(documentary==='BANK_STATEMENT_PENDING'){
      d.stage='Документы';
      d.next_action_text='Ожидается банковская выписка';
      d.next_action_target='payments';
      d.next_action_domain='DOCUMENTS';
      return d;
    }

    if(financeProjection==='FINANCE_V8'&&(expectedNotDue>0||futureConditional>0||finance==='NOT_DUE')){
      d.stage='Оплата';
      d.next_action_text=expectedNotDue>0?'Срок оплаты не наступил':'Следующий условный этап оплаты';
      d.next_action_target='payments';
      d.next_action_domain='PAYMENT';
      return d;
    }

    if(remaining!==null&&remaining<=0){
      d.stage=business==='EXECUTING'?'Исполнение сделки':'Закрытие';
      d.next_action_text=business==='EXECUTING'?'Контроль исполнения сделки':'Контроль закрытия сделки';
      d.next_action_target='deals';
      return d;
    }

    d.stage=d?.business_status||d?.lifecycle_state||'В работе';
    d.next_action_text='Открыть карточку сделки';
    return d;
  });
}

const MISSION_RUNTIME=String.raw`
${deriveOperationsMissionCurrentRows.toString()}
function ronaOpsV8OpenTarget(target,dealId){
  const id=String(dealId||'').trim(),t=String(target||'deals');
  window.__RONA_ADMIN_OPS_CONTEXT__={dealId:id||null,target:t,source:'operations-mission-v8',at:Date.now()};
  if(t==='deals'&&id)return ronaOpsV5OpenDeal(id);
  adminHomeNavigate(t);
}
function ronaOpsV8MissionSteps(d){
  const key=v=>String(v??'').trim().toUpperCase(),trusted=Number(d?.rail_trusted_wagons||0),verify=Number(d?.rail_verification_wagons||0),gu12=Number(d?.rail_gu12_count||0),railState=key(d?.rail_state),routeState=key(d?.rail_route_resolution_state),docState=key(d?.mission_document_status),accounting=key(d?.accounting_status),contract=key(d?.contract_status);
  const railText=verify>0?'Требует проверки: '+verify:railState==='WAGONS_ACTIVE'&&trusted>0?String(trusted)+' вагонов':gu12>0?String(gu12)+' ГУ-12':routeState==='RESOLVED'?'Маршрут определён':'Не начато';
  const railTone=verify>0?'amber':railState==='WAGONS_ACTIVE'?'green':routeState==='RESOLVED'?'cyan':'amber';
  const docText=docState==='TO_VERIFY'?(Number(d?.unchecked_documents_count||0)>0?'Проверить: '+Number(d.unchecked_documents_count):'Требует проверки'):docState==='BANK_STATEMENT_PENDING'?'Ожидается выписка':docState==='CONFIRMED'?'Подтверждено':String(d?.mission_document_status||d?.deal_documents_count||'—');
  const docTone=docState==='TO_VERIFY'?'amber':docState==='BANK_STATEMENT_PENDING'?'cyan':docState==='CONFIRMED'?'green':'cyan';
  const accountingText=accounting==='OPEN'?'Открыто':accounting==='CLOSED'?'Закрыто':ronaFdV5Text(d?.accounting_status);
  return [
    ['Ресурс',String(d?.resource_status||'—'),String(d?.resource_status||'').includes('Подтвержден')?'green':'amber','deals'],
    ['Договор',contract==='ACTIVE'?'Активен':ronaFdV5Text(d?.contract_status||d?.contract_id),contract==='ACTIVE'?'green':'amber','deals'],
    ['Оплата',ronaFdV5Text(d?.finance_status),ronaFdV5Tone(d?.finance_status),'payments'],
    ['ЖД',railText,railTone,'monitoring'],
    ['Исполнение',String(d?.delivery_status||'—'),key(d?.execution_status).startsWith('CONFIRMED')?'green':'cyan','deals'],
    ['Документы',docText,docTone,'deals'],
    ['Закрытие',accountingText,accounting==='CLOSED'?'green':'cyan','deals']
  ];
}
function installAdminOperationsMissionV8Style(){
  if(document.getElementById('ronaOpsMissionV8Style'))return;
  const s=document.createElement('style');s.id='ronaOpsMissionV8Style';s.textContent=
    '#page-home .rona-fd-v5-stage[type=button]{appearance:none;width:100%;font:inherit;color:inherit;text-align:left;cursor:pointer}' +
    '#page-home .rona-fd-v5-stage[type=button]:focus-visible,#page-home .rona-fd-v5__next-action[type=button]:focus-visible{outline:2px solid rgba(110,231,255,.62);outline-offset:2px}' +
    '#page-home .rona-fd-v5__next-action[type=button]{appearance:none;width:100%;font:inherit;color:inherit;text-align:left;cursor:pointer}' +
    '#page-home .rona-fd-v5__next-action[type=button]:hover{border-color:rgba(255,209,106,.38);background:rgba(255,209,106,.055)}';
  document.head.appendChild(s);
}
`;

const MISSION_BLOCK=String.raw`  let mission;
  if(selected){
    const id=String(selected?.deal_id||''),summary=financeMap.get(id),dealDocs=ronaFdV5DocsForDeal(id,docs),stage=ronaFdV5Stage(selected),payment=ronaFdV5PaymentStatus(selected,summary),nextAction=ronaFdV5NextAction(selected),steps=ronaOpsV8MissionSteps(selected);
    const vector=e('div',{class:'rona-fd-v5__vector'});
    for(const step of steps)vector.append(e('button',{class:'rona-fd-v5-stage',type:'button','data-tone':step[2],'aria-label':step[0]+': '+step[1],onclick:()=>ronaOpsV8OpenTarget(step[3],id)},e('span',{class:'rona-fd-v5-stage__lamp'}),e('div',{class:'rona-fd-v5-stage__label',text:step[0]}),e('div',{class:'rona-fd-v5-stage__value',text:step[1]})));
    mission=e('section',{class:'rona-fd-v5-screen rona-fd-v5__mission'},
      e('div',{class:'rona-fd-v5__mission-head'},
        e('div',{},e('div',{class:'rona-fd-v5__mission-kicker',text:'EXECUTION VECTOR · SELECTED FLIGHT'}),e('div',{class:'rona-fd-v5__mission-id',text:id||'Сделка'}),e('div',{class:'rona-fd-v5__mission-client',text:selected?.legal_name||selected?.client_name||selected?.client_id||'—'})),
        e('button',{class:'rona-fd-v5__mission-open',type:'button',onclick:()=>ronaOpsV5OpenDeal(id),text:'Deal Control'})
      ),
      e('div',{class:'rona-fd-v5__mission-status'},
        e('div',{class:'rona-fd-v5__status-cell'},e('div',{class:'rona-fd-v5__status-label',text:'Current stage'}),e('div',{class:'rona-fd-v5__status-value',text:ronaFdV5Text(stage)})),
        e('div',{class:'rona-fd-v5__status-cell'},e('div',{class:'rona-fd-v5__status-label',text:'Payment'}),e('div',{class:'rona-fd-v5__status-value',text:ronaFdV5Text(payment)})),
        e('div',{class:'rona-fd-v5__status-cell'},e('div',{class:'rona-fd-v5__status-label',text:'Documents'}),e('div',{class:'rona-fd-v5__status-value',text:selected?.mission_document_status?ronaFdV5Text(selected.mission_document_status):String(dealDocs.length)))
      ),
      vector,
      e('button',{class:'rona-fd-v5__next-action',type:'button','data-action-kind':selected?.next_action_kind||'MONITOR','aria-label':'Следующее действие: '+String(nextAction),onclick:()=>ronaOpsV8OpenTarget(selected?.next_action_target||'deals',id)},e('span',{class:'rona-fd-v5__next-label',text:'NEXT ACTION'}),e('span',{class:'rona-fd-v5__next-value',text:String(nextAction)}))
    );
  }else mission=e('section',{class:'rona-fd-v5-screen rona-fd-v5__mission'},e('div',{class:'rona-fd-v5-screen__head'},e('div',{},e('div',{class:'rona-fd-v5-screen__code',text:'EXECUTION VECTOR'}),e('div',{class:'rona-fd-v5-screen__title',text:'Контур исполнения'}))),ronaFdV5Empty('NO SELECTED FLIGHT','Когда появится сделка, здесь будет показана подтверждённая фактическая цепочка исполнения.'));
`;

export function patchAdminOperationsCommandCenterV8(script){
  let patched=patchV7(script);

  patched=replaceRequired(
    patched,
    'function renderAdminHome(){',
    MISSION_RUNTIME+'\nfunction renderAdminHome(){',
    'mission-runtime'
  );

  patched=replaceRequired(
    patched,
    "  ensureAdminHomeColorNetworkV6();\n  ensureAdminHomeDealCurrentV6();\n  ensureAdminOperationsCurrentV7();\n  window.__RONA_ADMIN_OPERATIONS_COMMAND_CENTER__='v7-event-driven-current-v1';",
    "  ensureAdminHomeColorNetworkV6();\n  ensureAdminHomeDealCurrentV6();\n  ensureAdminOperationsCurrentV7();\n  installAdminOperationsMissionV8Style();\n  window.__RONA_ADMIN_OPERATIONS_COMMAND_CENTER__='v8-mission-control-current-v1';",
    'runtime-marker'
  );

  patched=replaceRequired(
    patched,
    "const deals=deriveOperationsDealCurrentRows(Array.isArray(d.deals)?d.deals:[],window.__RONA_DEALS_CURRENT_STATE_SNAPSHOT__);",
    "const currentDealSnapshot=window.__RONA_DEALS_CURRENT_STATE_SNAPSHOT__,deals=deriveOperationsMissionCurrentRows(Array.isArray(d.deals)?d.deals:[],currentDealSnapshot);",
    'current-deals-source'
  );

  patched=replaceRequired(
    patched,
    "const railKnown=Array.isArray(d.rail),rail=railKnown?d.rail:[];",
    "const railKnown=!!(currentDealSnapshot&&Array.isArray(currentDealSnapshot.rail))||Array.isArray(d.rail),rail=currentDealSnapshot&&Array.isArray(currentDealSnapshot.rail)?currentDealSnapshot.rail:(Array.isArray(d.rail)?d.rail:[]);",
    'current-rail-source'
  );

  patched=replaceRequired(
    patched,
    "const docsKnown=Array.isArray(d.dealDocuments),docs=docsKnown?d.dealDocuments:[];",
    "const docsKnown=!!(currentDealSnapshot&&Array.isArray(currentDealSnapshot.documents))||Array.isArray(d.dealDocuments),docs=currentDealSnapshot&&Array.isArray(currentDealSnapshot.documents)?currentDealSnapshot.documents:(Array.isArray(d.dealDocuments)?d.dealDocuments:[]);",
    'current-documents-source'
  );

  patched=replaceRequired(
    patched,
    "function ronaFdV5Wagons(rows){const out=[];for(const r of rows)if(Array.isArray(r?.wagons))out.push(...r.wagons);return out}",
    "function ronaFdV5Wagons(rows){const out=[];for(const r of rows){if(Array.isArray(r?.wagon_positions))out.push(...r.wagon_positions);else if(Array.isArray(r?.wagons))out.push(...r.wagons);if(Array.isArray(r?.verification_wagons))out.push(...r.verification_wagons)}return out}",
    'rail-v4-wagons'
  );

  patched=replaceRequired(
    patched,
    "function ronaFdV5WaitingWagons(wagons){return wagons.filter(w=>{const s=ronaFdV5Key(w?.status),stamp=w?.operationAt||w?.operation_at||w?.lastPositionAt||w?.last_position_at;return !stamp||s.includes('WAIT')||s.includes('HOLD')})}",
    "function ronaFdV5WaitingWagons(wagons){return wagons.filter(w=>{const position=ronaFdV5Key(w?.positionStatus),resolution=ronaFdV5Key(w?.effectiveResolutionStatus),s=ronaFdV5Key(w?.status),stamp=w?.eventAtLocal||w?.eventTimestamp||w?.operationAt||w?.operation_at||w?.lastPositionAt||w?.last_position_at;if(position&&position!=='TRUSTED')return true;if(resolution&&resolution!=='MATCHED')return true;return !stamp||s.includes('WAIT')||s.includes('HOLD')})}",
    'rail-v4-waiting'
  );

  patched=replaceRequired(
    patched,
    "text:railKnown?(wagons.length?String(wagons.length)+' WGN':railRows.length?String(railRows.length)+' GU12':'RAIL —'):'RAIL —'",
    "text:railKnown?(wagons.length?String(wagons.length)+' WGN':Number(x?.rail_gu12_count||0)?String(x.rail_gu12_count)+' GU12':x?.rail_route_resolution_state==='RESOLVED'?'ROUTE':'RAIL —'):'RAIL —'",
    'deal-list-rail-telemetry'
  );

  patched=replaceSectionRequired(
    patched,
    '  let mission;\n  if(selected){',
    "  const masterBody=e('div',{});",
    MISSION_BLOCK,
    'mission-control'
  );

  if(!patched.includes("window.__RONA_ADMIN_OPERATIONS_COMMAND_CENTER__='v8-mission-control-current-v1'"))throw new Error('ADMIN_OPERATIONS_V8_MARKER_MISSING');
  if(!patched.includes("deriveOperationsMissionCurrentRows(Array.isArray(d.deals)?d.deals:[],currentDealSnapshot)"))throw new Error('ADMIN_OPERATIONS_V8_CURRENT_DEALS_MISSING');
  if(!patched.includes("currentDealSnapshot&&Array.isArray(currentDealSnapshot.rail)"))throw new Error('ADMIN_OPERATIONS_V8_CURRENT_RAIL_MISSING');
  if(!patched.includes("wagon_positions"))throw new Error('ADMIN_OPERATIONS_V8_RAIL_V4_WAGONS_MISSING');
  if(!patched.includes("onclick:()=>ronaOpsV5OpenDeal(id),text:'Deal Control'"))throw new Error('ADMIN_OPERATIONS_V8_EXACT_DEAL_CONTROL_MISSING');
  if(!patched.includes("onclick:()=>ronaOpsV8OpenTarget(selected?.next_action_target||'deals',id)"))throw new Error('ADMIN_OPERATIONS_V8_NEXT_ACTION_MISSING');
  if(!patched.includes("data-action-kind"))throw new Error('ADMIN_OPERATIONS_V8_ACTION_KIND_MISSING');
  if(patched.includes("setInterval(()=>ronaOpsV8"))throw new Error('ADMIN_OPERATIONS_V8_POLLING_FORBIDDEN');
  if((patched.match(/function renderAdminHome\(\)\{/g)||[]).length!==1)throw new Error('ADMIN_OPERATIONS_V8_NOT_SINGLE_OWNER');
  return patched;
}
