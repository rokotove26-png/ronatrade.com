const paymentsV7PassportRecoveryUi = String.raw`
const PAYMENTS_V7_PASSPORT_RECOVERY_UI='PAYMENTS_V7_PASSPORT_RECOVERY_UI_V1';

function paymentsV7PassportEventSpend(event){
  const allocated=paymentsV7Num(event?.allocated_funding_amount);
  if(allocated!==null){
    return paymentsV7OwnerRawMoney(event?.allocated_funding_amount,event?.funding_currency,event?.funding_status,event?.funding_reason);
  }
  const share=paymentsV7Text(event?.allocation_share);
  if(share&&share!=='1'){
    return paymentsV7OwnerRawMoney(null,event?.funding_currency,'TO_VERIFY',event?.funding_reason||'CURRENT_FINANCE_EXACT_ATTRIBUTION_MISSING');
  }
  return paymentsV7OwnerRawMoney(event?.funding_amount,event?.funding_currency,event?.funding_status,event?.funding_reason);
}

function paymentsV7PassportFundingSplit(row){
  const amount=paymentsV7Num(row?.allocated_funding_amount);
  const currency=paymentsV7Upper(row?.funding_currency);
  const status=paymentsV7Upper(row?.funding_allocation_status||row?.funding_status);
  if(amount===null||!currency||status!=='AUTHORITATIVE')return null;
  return paymentsV7OwnerRawMoney(row?.allocated_funding_amount,currency,'AUTHORITATIVE',null);
}

function paymentsV7PassportSettlementRow(row,linkState='LINKED'){
  const status=paymentsV7Upper(row?.status)||'TO_VERIFY';
  const fee=paymentsV7Upper(row?.row_type)==='COMMISSION';
  const wrap=e('div',{class:'rona-payments-v7-owner-settlement-row'+(fee?' is-fee':'')+(linkState==='UNLINKED'?' is-unlinked':'')});
  wrap.append(
    paymentsV7OwnerField('Получатель',paymentsV7Text(row?.recipient)||'Не указан'),
    paymentsV7OwnerField('Дата',paymentsV7OwnerDate(row?.payment_at)),
    paymentsV7OwnerField(fee?'Комиссия':'Фактическая оплата',paymentsV7OwnerRawMoney(row?.amount,row?.currency,status,row?.reason)),
    paymentsV7OwnerField('Назначение',paymentsV7Text(row?.purpose)||'Не указано',{wide:true}),
    paymentsV7OwnerField('Банковский документ',paymentsV7Text(row?.bank_document)||'Не указан')
  );
  const split=fee?null:paymentsV7PassportFundingSplit(row);
  if(split)wrap.append(paymentsV7OwnerField('Authoritative funding split',split));
  if(linkState==='UNLINKED')wrap.append(e('div',{class:'rona-payments-v7-owner-link-note',text:'Факт оплаты показан отдельно; связь с конкретной funding-side операцией требует подтверждения.'}));
  return wrap;
}

function paymentsV7PassportSection(title,className=''){
  return e('section',{class:'rona-payments-v7-owner-section rona-payments-v7-passport-section '+className},e('h3',{text:title}));
}

function paymentsV7PassportUsageEvent(event,index){
  const status=paymentsV7Upper(event?.funding_status)||'TO_VERIFY';
  const shared=paymentsV7Text(event?.allocation_share)&&paymentsV7Text(event?.allocation_share)!=='1';
  const card=e('div',{class:'rona-payments-v7-passport-usage-event','data-funding-status':status});
  card.append(e('div',{class:'rona-payments-v7-owner-event-head'},
    e('div',{},e('span',{class:'rona-payments-v7-owner-kicker',text:'Funding-side'}),e('h4',{text:'Операция '+String(index)})),
    e('span',{class:'rona-payments-v7-owner-badge '+(status==='AUTHORITATIVE'?'is-ok':'is-verify'),text:paymentsV7OwnerStatusText(status)})
  ));
  const grid=e('div',{class:'rona-payments-v7-owner-event-grid'});
  grid.append(
    paymentsV7OwnerField('Использовано средств сделки',paymentsV7PassportEventSpend(event)),
    paymentsV7OwnerField('Funding currency',paymentsV7Upper(event?.funding_currency)||'—'),
    paymentsV7OwnerField('Дата',paymentsV7OwnerDate(event?.payment_at)),
    paymentsV7OwnerField('Банковский документ',paymentsV7Text(event?.bank_document)||'Не указан'),
    paymentsV7OwnerField('Источник / основание',paymentsV7Text(event?.allocation_source)||'Не указано',{wide:true})
  );
  if(shared){
    grid.append(
      paymentsV7OwnerField('Общий банковский дебет',paymentsV7OwnerRawMoney(event?.funding_amount,event?.funding_currency,event?.funding_status,event?.funding_reason)),
      paymentsV7OwnerField('Доля сделки',paymentsV7OwnerShare(event?.allocation_share))
    );
  }
  card.append(grid);
  return card;
}

function paymentsV7PassportConversion(event,index){
  if(paymentsV7Num(event?.acquired_amount)===null||!paymentsV7Upper(event?.acquired_currency))return null;
  const shared=paymentsV7Text(event?.allocation_share)&&paymentsV7Text(event?.allocation_share)!=='1';
  const box=e('div',{class:'rona-payments-v7-owner-conversion'});
  box.append(e('div',{class:'rona-payments-v7-owner-conversion-title',text:'Конвертация · операция '+String(index)}));
  box.append(e('div',{class:'rona-payments-v7-owner-conversion-flow'},
    e('strong',{text:paymentsV7OwnerRawMoney(event?.funding_amount,event?.funding_currency,event?.funding_status,event?.funding_reason)}),
    e('span',{text:'→'}),
    e('strong',{text:paymentsV7OwnerRawMoney(event?.acquired_amount,event?.acquired_currency,'AUTHORITATIVE',null)})
  ));
  const meta=e('div',{class:'rona-payments-v7-owner-conversion-meta'});
  if(paymentsV7Num(event?.conversion_rate)!==null)meta.append(e('span',{text:'Фактический курс: '+paymentsV7OwnerAmount(event?.conversion_rate)}));
  meta.append(
    e('span',{text:'Дата: '+paymentsV7OwnerDate(event?.payment_at)}),
    e('span',{text:'Банковский документ: '+(paymentsV7Text(event?.bank_document)||'не указан')}),
    e('span',{text:'Основание: '+(paymentsV7Text(event?.conversion_source_basis)||'не указано')})
  );
  box.append(meta);
  if(shared)box.append(e('div',{class:'rona-payments-v7-owner-link-note',text:'Конвертация относится к общей банковской операции. Разбивка acquired currency по сделкам не рассчитывается интерфейсом.'}));
  return box;
}

function paymentsV7PassportTechnical(deal,passport,events){
  const details=e('details',{class:'rona-payments-v7-owner-tech rona-payments-v7-passport-technical'},e('summary',{text:'Технические основания'}));
  details.append(e('pre',{text:JSON.stringify({
    deal_id:deal?.deal_id||null,
    passport_contract:passport?.contract||null,
    passport_status:passport?.status||null,
    passport_reason:passport?.reason||null,
    authority_refs:paymentsV7Array(deal?.authority_refs),
    event_basis:events.map(event=>event?.technical_basis||null)
  },null,2)}));
  return details;
}

paymentsV7OwnerPassportBody=function paymentsV7OwnerPassportBodyRecovered(deal,passport){
  const body=e('div',{class:'rona-payments-v7-passport-body rona-payments-v7-owner-passport-v2 rona-payments-v7-passport-recovered','data-passport-recovery':PAYMENTS_V7_PASSPORT_RECOVERY_UI});
  body.append(e('div',{class:'rona-payments-v7-owner-funding-summary'},
    paymentsV7OwnerField('Получено от клиента',paymentsV7OwnerMoney(passport?.funding_received,passport?.funding_currency)),
    paymentsV7OwnerField('Потрачено средств сделки',paymentsV7OwnerMoney(passport?.funding_spent,passport?.funding_currency)),
    paymentsV7OwnerField('Остаток средств сделки',paymentsV7OwnerMoney(passport?.funding_remaining,passport?.funding_currency)),
    paymentsV7OwnerField('Funding currency',paymentsV7Upper(passport?.funding_currency)||'—')
  ));

  body.append(e('div',{class:'rona-payments-v7-owner-layer-statuses'},
    paymentsV7OwnerStatusRow('Использование средств сделки',passport?.funding_status,passport?.funding_reason),
    paymentsV7OwnerStatusRow('Фактические оплаты',passport?.settlement_status,passport?.settlement_reason),
    paymentsV7OwnerStatusRow('Native residuals',passport?.residual_status,passport?.residual_reason)
  ));

  const events=paymentsV7Array(passport?.funding_events);
  const usage=paymentsV7PassportSection('Использование средств сделки','is-funding');
  if(events.length){
    events.forEach((event,index)=>usage.append(paymentsV7PassportUsageEvent(event,index+1)));
  }else if(paymentsV7Upper(passport?.funding_status)==='AUTHORITATIVE'){
    usage.append(e('div',{class:'rona-payments-v7-owner-empty is-ok',text:'Подтверждённых funding-side операций нет. Финансовый результат: '+paymentsV7OwnerMoney(passport?.funding_spent,passport?.funding_currency)+'.'}));
  }else{
    usage.append(e('div',{class:'rona-payments-v7-owner-empty is-verify',text:'TO_VERIFY — '+paymentsV7OwnerReasonText(passport?.funding_reason||'CURRENT_FINANCE_AUTHORITY_TO_VERIFY')}));
  }
  body.append(usage);

  const conversions=events.map((event,index)=>paymentsV7PassportConversion(event,index+1)).filter(Boolean);
  if(conversions.length){
    const conversionSection=paymentsV7PassportSection('Конвертация','is-conversion');
    conversionSection.append(...conversions);
    body.append(conversionSection);
  }

  const linked=[];
  const unlinked=paymentsV7Array(passport?.unlinked_settlement_lines);
  for(const event of events)for(const row of paymentsV7Array(event?.settlement_lines))linked.push(row);
  const factualPayments=[...linked.filter(row=>paymentsV7Upper(row?.row_type)!=='COMMISSION').map(row=>({row,linkState:'LINKED'})),...unlinked.filter(row=>paymentsV7Upper(row?.row_type)!=='COMMISSION').map(row=>({row,linkState:'UNLINKED'}))];
  const paymentsSection=paymentsV7PassportSection('Фактические оплаты','is-settlement');
  if(factualPayments.length){
    for(const item of factualPayments)paymentsSection.append(paymentsV7PassportSettlementRow(item.row,item.linkState));
  }else paymentsSection.append(e('div',{class:'rona-payments-v7-owner-empty',text:'Фактические оплаты сервером не переданы.'}));
  body.append(paymentsSection);

  const feeRows=[...linked,...unlinked].filter(row=>paymentsV7Upper(row?.row_type)==='COMMISSION');
  const authoritativeFees=feeRows.filter(row=>paymentsV7Upper(row?.status)==='AUTHORITATIVE');
  const fees=paymentsV7PassportSection('Комиссии','is-fee');
  if(authoritativeFees.length){
    for(const row of authoritativeFees)fees.append(paymentsV7PassportSettlementRow(row,unlinked.includes(row)?'UNLINKED':'LINKED'));
  }else if(feeRows.length){
    fees.append(e('div',{class:'rona-payments-v7-owner-empty is-verify',text:'TO_VERIFY — неподтверждённые комиссии не включены в основной паспорт.'}));
  }else fees.append(e('div',{class:'rona-payments-v7-owner-empty',text:'Authoritative комиссии отсутствуют.'}));
  body.append(fees);

  const residuals=[];
  for(const event of events){
    for(const residual of paymentsV7Array(event?.native_residuals))residuals.push({residual,shared:false});
    for(const residual of paymentsV7Array(event?.shared_native_residual_refs))residuals.push({residual,shared:true});
  }
  const remainder=paymentsV7PassportSection('Остаток средств сделки','is-remainder');
  remainder.append(paymentsV7OwnerField('Остаток в funding currency',paymentsV7OwnerMoney(passport?.funding_remaining,passport?.funding_currency)));
  if(residuals.length){
    remainder.append(e('div',{class:'rona-payments-v7-passport-native-title',text:'Native residuals после конвертации — отдельно от funding currency остатка'}));
    for(const item of residuals)remainder.append(paymentsV7OwnerResidualRow(item.residual,item.shared));
  }
  body.append(remainder);

  body.append(paymentsV7PassportTechnical(deal,passport,events));
  return body;
};

function paymentsV7PassportRecoveryInstallStyle(){
  if(q('#ronaPaymentsV7PassportRecoveryStyle'))return;
  const s=e('style',{id:'ronaPaymentsV7PassportRecoveryStyle'});
  s.textContent='.rona-payments-v7-passport-recovered{gap:16px}.rona-payments-v7-passport-section{display:grid;gap:9px;padding:12px;border:1px solid rgba(111,151,184,.12);border-radius:11px;background:rgba(5,15,24,.50)}.rona-payments-v7-passport-section>h3{margin:0 0 2px;font-size:12px;letter-spacing:.045em;color:#dce9f3}.rona-payments-v7-passport-section.is-conversion>h3{color:#89bba9}.rona-payments-v7-passport-section.is-fee>h3{color:#f2c378}.rona-payments-v7-passport-usage-event{display:grid;gap:9px;padding:11px;border:1px solid rgba(100,181,255,.14);border-radius:9px;background:rgba(7,20,31,.72)}.rona-payments-v7-passport-native-title{margin-top:4px;font-size:9px;font-weight:850;letter-spacing:.04em;text-transform:uppercase;color:#718da3}.rona-payments-v7-passport-technical{margin-top:2px}.rona-payments-v7-owner-empty.is-ok{border-color:rgba(72,223,164,.24);color:#8ed9ba}';
  document.head.appendChild(s);
}
paymentsV7PassportRecoveryInstallStyle();
`;

export default paymentsV7PassportRecoveryUi;
