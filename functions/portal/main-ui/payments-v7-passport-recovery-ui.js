const paymentsV7PassportRecoveryUi = String.raw`
const PAYMENTS_V7_PASSPORT_RECOVERY_UI='PAYMENTS_V7_PASSPORT_DESIGNER_DOCUMENT_V1';

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
    paymentsV7OwnerField('Дата',paymentsV7OwnerDate(row?.payment_at)),
    paymentsV7OwnerField('Получатель',paymentsV7Text(row?.recipient)||'Не указан'),
    paymentsV7OwnerField('Назначение',paymentsV7Text(row?.purpose)||'Не указано',{wide:true}),
    paymentsV7OwnerField(fee?'Комиссия':'Фактически оплачено',paymentsV7OwnerRawMoney(row?.amount,row?.currency,status,row?.reason)),
    paymentsV7OwnerField('Документ',paymentsV7Text(row?.bank_document)||'Не указан')
  );
  const split=fee?null:paymentsV7PassportFundingSplit(row);
  if(split)wrap.append(paymentsV7OwnerField('Первичный расход средств сделки',split));
  if(linkState==='UNLINKED')wrap.append(e('div',{class:'rona-payments-v7-owner-link-note',text:'Фактическая оплата показана отдельно: точная связь с конкретной операцией расходования не подтверждена.'}));
  return wrap;
}

function paymentsV7PassportSection(title,className=''){
  return e('section',{class:'rona-payments-v7-owner-section rona-payments-v7-passport-section '+className},e('div',{class:'rona-payments-v7-passport-section-head'},e('h3',{text:title})));
}

function paymentsV7PassportLinkedPayments(event){
  return paymentsV7Array(event?.settlement_lines).filter(row=>paymentsV7Upper(row?.row_type)!=='COMMISSION');
}

function paymentsV7PassportOperationText(rows,key,emptyText,multiText){
  if(rows.length===1)return paymentsV7Text(rows[0]?.[key])||emptyText;
  if(rows.length>1)return multiText;
  return emptyText;
}

function paymentsV7PassportOperationPaid(rows){
  if(rows.length===1)return paymentsV7OwnerRawMoney(rows[0]?.amount,rows[0]?.currency,rows[0]?.status,rows[0]?.reason);
  if(rows.length>1)return 'Несколько оплат — см. раздел «Фактические оплаты»';
  return 'Не передано';
}

function paymentsV7PassportConversion(event,index){
  if(paymentsV7Num(event?.acquired_amount)===null||!paymentsV7Upper(event?.acquired_currency))return null;
  const shared=paymentsV7Text(event?.allocation_share)&&paymentsV7Text(event?.allocation_share)!=='1';
  const left=shared
    ?paymentsV7OwnerRawMoney(event?.funding_amount,event?.funding_currency,event?.funding_status,event?.funding_reason)
    :paymentsV7PassportEventSpend(event);
  const box=e('div',{class:'rona-payments-v7-owner-conversion'});
  box.append(e('div',{class:'rona-payments-v7-owner-conversion-title',text:'КОНВЕРТАЦИЯ'}));
  box.append(e('div',{class:'rona-payments-v7-owner-conversion-flow'},
    e('strong',{text:left}),
    e('span',{text:'→'}),
    e('strong',{text:paymentsV7OwnerRawMoney(event?.acquired_amount,event?.acquired_currency,'AUTHORITATIVE',null)})
  ));
  const meta=e('div',{class:'rona-payments-v7-owner-conversion-meta'});
  if(paymentsV7Num(event?.conversion_rate)!==null)meta.append(e('span',{text:'Фактический курс: '+paymentsV7OwnerAmount(event?.conversion_rate)}));
  meta.append(
    e('span',{text:'Дата: '+paymentsV7OwnerDate(event?.payment_at)}),
    e('span',{text:'Банковский документ: '+(paymentsV7Text(event?.bank_document)||'не указан')})
  );
  box.append(meta);
  if(shared)box.append(e('div',{class:'rona-payments-v7-owner-link-note',text:'Конвертация относится к общей банковской операции. Интерфейс не распределяет полученную валюту между сделками и оплатами без точного распределения Finance.'}));
  return box;
}

function paymentsV7PassportUsageEvent(event,index){
  const status=paymentsV7Upper(event?.funding_status)||'TO_VERIFY';
  const shared=paymentsV7Text(event?.allocation_share)&&paymentsV7Text(event?.allocation_share)!=='1';
  const rows=paymentsV7PassportLinkedPayments(event);
  const card=e('article',{class:'rona-payments-v7-passport-usage-event','data-funding-status':status});
  card.append(e('div',{class:'rona-payments-v7-owner-event-head'},
    e('div',{},e('span',{class:'rona-payments-v7-owner-kicker',text:'ОПЕРАЦИЯ '+String(index)}),e('h4',{text:'Использование средств сделки'})),
    e('span',{class:'rona-payments-v7-owner-badge '+(status==='AUTHORITATIVE'?'is-ok':'is-verify'),text:paymentsV7OwnerStatusText(status)})
  ));
  const grid=e('div',{class:'rona-payments-v7-owner-event-grid rona-payments-v7-passport-operation-grid'});
  grid.append(
    paymentsV7OwnerField('Дата',paymentsV7OwnerDate(event?.payment_at)),
    paymentsV7OwnerField('Назначение',paymentsV7PassportOperationText(rows,'purpose','Не указано','Несколько назначений — см. фактические оплаты'),{wide:true}),
    paymentsV7OwnerField('Получатель',paymentsV7PassportOperationText(rows,'recipient','Не указан','Несколько получателей — см. фактические оплаты')),
    paymentsV7OwnerField('Первичный расход средств сделки',paymentsV7PassportEventSpend(event)),
    paymentsV7OwnerField('Фактически оплачено',paymentsV7PassportOperationPaid(rows)),
    paymentsV7OwnerField('Документ',paymentsV7Text(event?.bank_document)||paymentsV7PassportOperationText(rows,'bank_document','Не указан','Несколько документов — см. фактические оплаты'))
  );
  if(shared){
    grid.append(
      paymentsV7OwnerField('Общий банковский дебет',paymentsV7OwnerRawMoney(event?.funding_amount,event?.funding_currency,event?.funding_status,event?.funding_reason)),
      paymentsV7OwnerField('Доля сделки',paymentsV7OwnerShare(event?.allocation_share))
    );
  }
  card.append(grid);
  const conversion=paymentsV7PassportConversion(event,index);
  if(conversion)card.append(conversion);
  return card;
}

function paymentsV7PassportTechnicalValue(value){
  if(value===null||value===undefined||value==='')return '—';
  if(typeof value==='string'||typeof value==='number'||typeof value==='boolean')return String(value);
  try{return JSON.stringify(value)}catch{return String(value)}
}

function paymentsV7PassportTechnical(deal,passport,events){
  const details=e('details',{class:'rona-payments-v7-owner-tech rona-payments-v7-passport-technical'},e('summary',{text:'Технические основания'}));
  const grid=e('div',{class:'rona-payments-v7-passport-tech-grid'});
  grid.append(
    paymentsV7OwnerField('Deal ID',paymentsV7Text(deal?.deal_id)||'—'),
    paymentsV7OwnerField('Passport contract',paymentsV7Text(passport?.contract)||'—'),
    paymentsV7OwnerField('Internal status',paymentsV7Text(passport?.status)||'—'),
    paymentsV7OwnerField('Internal reason',paymentsV7Text(passport?.reason)||'—')
  );
  const authorityRefs=paymentsV7Array(deal?.authority_refs);
  if(authorityRefs.length){
    grid.append(paymentsV7OwnerField('Authority refs',authorityRefs.map(ref=>paymentsV7PassportTechnicalValue(ref)).join(' · '),{wide:true}));
  }
  events.forEach((event,index)=>{
    if(event?.technical_basis!==null&&event?.technical_basis!==undefined){
      grid.append(paymentsV7OwnerField('Provenance операции '+String(index+1),paymentsV7PassportTechnicalValue(event.technical_basis),{wide:true}));
    }
    if(paymentsV7Text(event?.allocation_source))grid.append(paymentsV7OwnerField('Source basis операции '+String(index+1),paymentsV7Text(event.allocation_source),{wide:true}));
  });
  details.append(grid);
  return details;
}

paymentsV7OwnerPassportBody=function paymentsV7OwnerPassportBodyRecovered(deal,passport){
  const body=e('div',{class:'rona-payments-v7-passport-body rona-payments-v7-owner-passport-v2 rona-payments-v7-passport-recovered rona-payments-v7-passport-designer-document','data-passport-recovery':PAYMENTS_V7_PASSPORT_RECOVERY_UI});
  body.append(e('section',{class:'rona-payments-v7-owner-funding-summary rona-payments-v7-passport-hero'},
    paymentsV7OwnerField('Получено от клиента',paymentsV7OwnerMoney(passport?.funding_received,passport?.funding_currency)),
    paymentsV7OwnerField('Потрачено средств сделки',paymentsV7OwnerMoney(passport?.funding_spent,passport?.funding_currency)),
    paymentsV7OwnerField('Остаток средств сделки',paymentsV7OwnerMoney(passport?.funding_remaining,passport?.funding_currency)),
    paymentsV7OwnerField('Валюта поступления',paymentsV7Upper(passport?.funding_currency)||'—')
  ));

  const events=paymentsV7Array(passport?.funding_events);
  const usage=paymentsV7PassportSection('ИСПОЛЬЗОВАНИЕ СРЕДСТВ СДЕЛКИ','is-funding');
  if(events.length){
    events.forEach((event,index)=>usage.append(paymentsV7PassportUsageEvent(event,index+1)));
  }else if(paymentsV7Upper(passport?.funding_status)==='AUTHORITATIVE'){
    usage.append(e('div',{class:'rona-payments-v7-owner-empty is-ok',text:'Подтвержденных операций расходования нет. Потрачено средств сделки: '+paymentsV7OwnerMoney(passport?.funding_spent,passport?.funding_currency)+'.'}));
  }else{
    usage.append(e('div',{class:'rona-payments-v7-owner-empty is-verify',text:'Требуется проверка — '+paymentsV7OwnerReasonText(passport?.funding_reason||'CURRENT_FINANCE_AUTHORITY_TO_VERIFY')}));
  }
  body.append(usage);

  const linked=[];
  const unlinked=paymentsV7Array(passport?.unlinked_settlement_lines);
  for(const event of events)for(const row of paymentsV7Array(event?.settlement_lines))linked.push(row);
  const factualPayments=[...linked.filter(row=>paymentsV7Upper(row?.row_type)!=='COMMISSION').map(row=>({row,linkState:'LINKED'})),...unlinked.filter(row=>paymentsV7Upper(row?.row_type)!=='COMMISSION').map(row=>({row,linkState:'UNLINKED'}))];
  const paymentsSection=paymentsV7PassportSection('ФАКТИЧЕСКИЕ ОПЛАТЫ','is-settlement');
  if(factualPayments.length){
    for(const item of factualPayments)paymentsSection.append(paymentsV7PassportSettlementRow(item.row,item.linkState));
  }else paymentsSection.append(e('div',{class:'rona-payments-v7-owner-empty',text:'Фактические оплаты не переданы.'}));
  body.append(paymentsSection);

  const feeRows=[...linked,...unlinked].filter(row=>paymentsV7Upper(row?.row_type)==='COMMISSION');
  const authoritativeFees=feeRows.filter(row=>paymentsV7Upper(row?.status)==='AUTHORITATIVE');
  const fees=paymentsV7PassportSection('КОМИССИИ','is-fee');
  if(authoritativeFees.length){
    for(const row of authoritativeFees)fees.append(paymentsV7PassportSettlementRow(row,unlinked.includes(row)?'UNLINKED':'LINKED'));
  }else if(feeRows.length){
    fees.append(e('div',{class:'rona-payments-v7-owner-empty is-verify',text:'Комиссии требуют подтверждения и не включены в основной финансовый результат.'}));
  }else fees.append(e('div',{class:'rona-payments-v7-owner-empty',text:'Подтвержденные комиссии отсутствуют.'}));
  body.append(fees);

  const residuals=[];
  for(const event of events){
    for(const residual of paymentsV7Array(event?.native_residuals))residuals.push({residual,shared:false});
    for(const residual of paymentsV7Array(event?.shared_native_residual_refs))residuals.push({residual,shared:true});
  }
  const remainder=paymentsV7PassportSection('ОСТАТОК СРЕДСТВ СДЕЛКИ','is-remainder');
  remainder.append(e('div',{class:'rona-payments-v7-passport-remainder-primary'},paymentsV7OwnerField('Основной остаток',paymentsV7OwnerMoney(passport?.funding_remaining,passport?.funding_currency)),paymentsV7OwnerField('Валюта поступления',paymentsV7Upper(passport?.funding_currency)||'—')));
  if(residuals.length){
    remainder.append(e('div',{class:'rona-payments-v7-passport-native-title',text:'Остатки в иных валютах'}));
    for(const item of residuals)remainder.append(paymentsV7OwnerResidualRow(item.residual,item.shared));
  }
  body.append(remainder);

  body.append(paymentsV7PassportTechnical(deal,passport,events));
  return body;
};

function paymentsV7PassportRecoveryInstallStyle(){
  if(q('#ronaPaymentsV7PassportRecoveryStyle'))return;
  const s=e('style',{id:'ronaPaymentsV7PassportRecoveryStyle'});
  s.textContent='.rona-payments-v7-passport-designer-document{display:grid;gap:18px;padding:0}.rona-payments-v7-passport-hero{gap:12px}.rona-payments-v7-passport-hero .rona-payments-v7-owner-field{min-height:112px;padding:18px;border-radius:14px;background:linear-gradient(145deg,rgba(12,31,45,.94),rgba(6,19,29,.96));border-color:rgba(116,166,201,.20)}.rona-payments-v7-passport-hero .rona-payments-v7-owner-field>span{font-size:10px;letter-spacing:.075em}.rona-payments-v7-passport-hero .rona-payments-v7-owner-field>strong{margin-top:12px;font-size:24px;line-height:1.12}.rona-payments-v7-passport-section{display:grid;gap:12px;padding:17px;border:1px solid rgba(111,151,184,.12);border-radius:15px;background:rgba(5,15,24,.50)}.rona-payments-v7-passport-section-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.rona-payments-v7-passport-section h3{margin:0;font-size:12px;font-weight:900;letter-spacing:.10em;color:#dce9f3}.rona-payments-v7-passport-section.is-fee h3{color:#f2c378}.rona-payments-v7-passport-usage-event{display:grid;gap:12px;padding:15px;border:1px solid rgba(100,181,255,.14);border-radius:13px;background:linear-gradient(145deg,rgba(7,21,32,.90),rgba(5,16,25,.96))}.rona-payments-v7-passport-operation-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.rona-payments-v7-passport-operation-grid .rona-payments-v7-owner-field{min-height:82px}.rona-payments-v7-owner-conversion{margin-top:2px;padding:14px;border-radius:12px}.rona-payments-v7-owner-conversion-title{font-size:10px;letter-spacing:.11em}.rona-payments-v7-owner-conversion-flow{font-size:17px}.rona-payments-v7-owner-settlement-row{grid-template-columns:.8fr 1.2fr 1.7fr 1fr 1.15fr}.rona-payments-v7-owner-settlement-row .rona-payments-v7-owner-field{min-height:72px}.rona-payments-v7-passport-remainder-primary{display:grid;grid-template-columns:2fr 1fr;gap:9px}.rona-payments-v7-passport-native-title{margin-top:4px;font-size:10px;font-weight:850;letter-spacing:.06em;text-transform:uppercase;color:#718da3}.rona-payments-v7-passport-technical{margin-top:2px;padding:12px 0 0}.rona-payments-v7-passport-technical summary{font-size:10px;color:#7f98aa}.rona-payments-v7-passport-tech-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px}.rona-payments-v7-owner-empty.is-ok{border-color:rgba(72,223,164,.24);color:#8ed9ba}@media(max-width:900px){.rona-payments-v7-passport-operation-grid{grid-template-columns:1fr 1fr}.rona-payments-v7-owner-settlement-row{grid-template-columns:1fr 1fr}.rona-payments-v7-passport-tech-grid{grid-template-columns:1fr}}@media(max-width:620px){.rona-payments-v7-passport-hero,.rona-payments-v7-passport-operation-grid,.rona-payments-v7-owner-settlement-row,.rona-payments-v7-passport-remainder-primary{grid-template-columns:1fr}.rona-payments-v7-passport-hero .rona-payments-v7-owner-field{min-height:94px}.rona-payments-v7-passport-hero .rona-payments-v7-owner-field>strong{font-size:20px}}';
  document.head.appendChild(s);
}
paymentsV7PassportRecoveryInstallStyle();
`;

export default paymentsV7PassportRecoveryUi;
