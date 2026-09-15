const paymentsV7PassportRecoveryUi = String.raw`
const PAYMENTS_V7_PASSPORT_RECOVERY_UI='PAYMENTS_V7_PASSPORT_OWNER_TABLE_V1';

function paymentsV7PassportPrimaryMoney(value,fallbackCurrency){
  const amount=paymentsV7Num(value?.amount);
  const currency=paymentsV7Upper(value?.currency||fallbackCurrency);
  const status=paymentsV7Upper(value?.status);
  if(status==='AUTHORITATIVE'&&amount!==null&&currency)return paymentsV7OwnerRawMoney(value?.amount,currency,'AUTHORITATIVE',null);
  return 'Требуется подтверждение';
}

function paymentsV7PassportEventFunding(event){
  if(paymentsV7Upper(event?.funding_status)!=='AUTHORITATIVE')return null;
  const currency=paymentsV7Upper(event?.funding_currency);
  if(!currency)return null;
  if(paymentsV7Num(event?.allocated_funding_amount)!==null){
    return paymentsV7OwnerRawMoney(event?.allocated_funding_amount,currency,'AUTHORITATIVE',null);
  }
  const share=paymentsV7Text(event?.allocation_share);
  if(share&&share!=='1')return null;
  if(paymentsV7Num(event?.funding_amount)!==null){
    return paymentsV7OwnerRawMoney(event?.funding_amount,currency,'AUTHORITATIVE',null);
  }
  return null;
}

function paymentsV7PassportFundingSplit(row){
  const amount=paymentsV7Num(row?.allocated_funding_amount);
  const currency=paymentsV7Upper(row?.funding_currency);
  const status=paymentsV7Upper(row?.funding_allocation_status||row?.funding_status);
  if(amount===null||!currency||status!=='AUTHORITATIVE')return null;
  return paymentsV7OwnerRawMoney(row?.allocated_funding_amount,currency,'AUTHORITATIVE',null);
}

function paymentsV7PassportRowFunding(row,event,rowCount){
  const exact=paymentsV7PassportFundingSplit(row);
  if(exact)return exact;
  if(event&&rowCount===1){
    const eventFunding=paymentsV7PassportEventFunding(event);
    if(eventFunding)return eventFunding;
  }
  return 'Требуется подтверждение';
}

function paymentsV7PassportRowActual(row){
  const amount=paymentsV7Num(row?.amount);
  const currency=paymentsV7Upper(row?.currency);
  const status=paymentsV7Upper(row?.status);
  if(status==='AUTHORITATIVE'&&amount!==null&&currency)return paymentsV7OwnerRawMoney(row?.amount,currency,'AUTHORITATIVE',null);
  return 'Требуется подтверждение';
}

function paymentsV7PassportRecipient(row){
  const recipient=paymentsV7Text(row?.recipient);
  if(recipient)return recipient;
  return paymentsV7Upper(row?.row_type)==='COMMISSION'?'Банк / комиссия':'Не указан';
}

function paymentsV7PassportDetailItem(label,value){
  return e('div',{class:'rona-payments-v7-owner-table-detail-item'},e('span',{text:label}),e('strong',{text:value||'—'}));
}

function paymentsV7PassportRowDetails(row,event){
  const details=e('details',{class:'rona-payments-v7-owner-table-row-details'},e('summary',{text:'Детали операции'}));
  const grid=e('div',{class:'rona-payments-v7-owner-table-detail-grid'});
  grid.append(
    paymentsV7PassportDetailItem('Дата',paymentsV7OwnerDate(row?.payment_at||event?.payment_at)),
    paymentsV7PassportDetailItem('Назначение',paymentsV7Text(row?.purpose)||'Не указано'),
    paymentsV7PassportDetailItem('Документ',paymentsV7Text(row?.bank_document)||paymentsV7Text(event?.bank_document)||'Не указан')
  );
  if(paymentsV7Num(event?.conversion_rate)!==null){
    grid.append(paymentsV7PassportDetailItem('Курс конвертации',paymentsV7OwnerAmount(event?.conversion_rate)));
  }
  details.append(grid);
  return details;
}

function paymentsV7PassportTableRows(passport){
  const items=[];
  const events=paymentsV7Array(passport?.funding_events);
  for(const event of events){
    const rows=paymentsV7Array(event?.settlement_lines);
    for(const row of rows)items.push({row,event,rowCount:rows.length});
  }
  for(const row of paymentsV7Array(passport?.unlinked_settlement_lines))items.push({row,event:null,rowCount:0});
  return items;
}

function paymentsV7PassportTable(passport){
  const section=e('section',{class:'rona-payments-v7-owner-table-section'});
  const scroller=e('div',{class:'rona-payments-v7-owner-table-scroll'});
  const table=e('table',{class:'rona-payments-v7-owner-table'});
  table.append(e('thead',{},e('tr',{},
    e('th',{text:'Получатель'}),
    e('th',{text:'Сумма в валюте поступления'}),
    e('th',{text:'Сумма фактического списания'})
  )));
  const tbody=e('tbody',{});
  const items=paymentsV7PassportTableRows(passport);
  if(!items.length){
    tbody.append(e('tr',{class:'rona-payments-v7-owner-table-empty'},e('td',{colspan:'3',text:'Фактические списания по сделке не переданы.'})));
  }else{
    for(const item of items){
      const fee=paymentsV7Upper(item.row?.row_type)==='COMMISSION';
      tbody.append(e('tr',{class:'rona-payments-v7-owner-table-row'+(fee?' is-fee':'')},
        e('td',{},e('strong',{text:paymentsV7PassportRecipient(item.row)}),fee?e('small',{text:'Комиссия'}):null),
        e('td',{class:'is-funding',text:paymentsV7PassportRowFunding(item.row,item.event,item.rowCount)}),
        e('td',{class:'is-actual',text:paymentsV7PassportRowActual(item.row)})
      ));
      tbody.append(e('tr',{class:'rona-payments-v7-owner-table-details-row'},e('td',{colspan:'3'},paymentsV7PassportRowDetails(item.row,item.event))));
    }
  }
  table.append(tbody);
  scroller.append(table);
  section.append(scroller);
  return section;
}

function paymentsV7PassportTechnicalValue(value){
  if(value===null||value===undefined||value==='')return '—';
  if(typeof value==='string'||typeof value==='number'||typeof value==='boolean')return String(value);
  try{return JSON.stringify(value)}catch{return String(value)}
}

function paymentsV7PassportTechnical(deal,passport){
  const details=e('details',{class:'rona-payments-v7-owner-tech rona-payments-v7-passport-technical'},e('summary',{text:'Технические основания'}));
  const grid=e('div',{class:'rona-payments-v7-passport-tech-grid'});
  grid.append(
    paymentsV7OwnerField('Deal ID',paymentsV7Text(deal?.deal_id)||'—'),
    paymentsV7OwnerField('Passport contract',paymentsV7Text(passport?.contract)||'—'),
    paymentsV7OwnerField('Internal status',paymentsV7Text(passport?.status)||'—'),
    paymentsV7OwnerField('Internal reason',paymentsV7Text(passport?.reason)||'—')
  );
  const authorityRefs=paymentsV7Array(deal?.authority_refs);
  if(authorityRefs.length)grid.append(paymentsV7OwnerField('Authority refs',authorityRefs.map(ref=>paymentsV7PassportTechnicalValue(ref)).join(' · '),{wide:true}));
  const events=paymentsV7Array(passport?.funding_events);
  events.forEach((event,index)=>{
    if(paymentsV7Text(event?.funding_event_id))grid.append(paymentsV7OwnerField('Funding event '+String(index+1),paymentsV7Text(event.funding_event_id),{wide:true}));
    if(event?.technical_basis!==null&&event?.technical_basis!==undefined)grid.append(paymentsV7OwnerField('Provenance операции '+String(index+1),paymentsV7PassportTechnicalValue(event.technical_basis),{wide:true}));
    if(paymentsV7Text(event?.allocation_source))grid.append(paymentsV7OwnerField('Source basis операции '+String(index+1),paymentsV7Text(event.allocation_source),{wide:true}));
    const residuals=[...paymentsV7Array(event?.native_residuals),...paymentsV7Array(event?.shared_native_residual_refs)];
    if(residuals.length)grid.append(paymentsV7OwnerField('Дополнительные остатки операции '+String(index+1),residuals.map(item=>paymentsV7PassportTechnicalValue(item)).join(' · '),{wide:true}));
  });
  details.append(grid);
  return details;
}

paymentsV7OwnerPassportBody=function paymentsV7OwnerPassportBodyRecovered(deal,passport){
  const body=e('div',{class:'rona-payments-v7-passport-body rona-payments-v7-owner-passport-v2 rona-payments-v7-passport-recovered rona-payments-v7-passport-owner-table-document','data-passport-recovery':PAYMENTS_V7_PASSPORT_RECOVERY_UI});
  body.append(e('section',{class:'rona-payments-v7-owner-receipt'},
    e('span',{class:'rona-payments-v7-owner-receipt-label',text:'СУММА ПОСТУПЛЕНИЯ'}),
    e('strong',{class:'rona-payments-v7-owner-receipt-value',text:paymentsV7PassportPrimaryMoney(passport?.funding_received,passport?.funding_currency)})
  ));

  body.append(paymentsV7PassportTable(passport));

  body.append(e('section',{class:'rona-payments-v7-owner-totals'},
    e('div',{class:'rona-payments-v7-owner-total-card'},
      e('span',{text:'ИТОГО ПОТРАЧЕНО'}),
      e('strong',{text:paymentsV7PassportPrimaryMoney(passport?.funding_spent,passport?.funding_currency)})
    ),
    e('div',{class:'rona-payments-v7-owner-total-card'},
      e('span',{text:'ОСТАТОК'}),
      e('strong',{text:paymentsV7PassportPrimaryMoney(passport?.funding_remaining,passport?.funding_currency)})
    )
  ));

  body.append(paymentsV7PassportTechnical(deal,passport));
  return body;
};

function paymentsV7PassportRecoveryInstallStyle(){
  if(q('#ronaPaymentsV7PassportRecoveryStyle'))return;
  const s=e('style',{id:'ronaPaymentsV7PassportRecoveryStyle'});
  s.textContent='.rona-payments-v7-passport-owner-table-document{display:grid;gap:18px;padding:0}.rona-payments-v7-owner-receipt{display:grid;gap:8px;padding:22px 24px;border:1px solid rgba(116,166,201,.20);border-radius:16px;background:linear-gradient(145deg,rgba(12,31,45,.94),rgba(6,19,29,.96))}.rona-payments-v7-owner-receipt-label,.rona-payments-v7-owner-total-card>span{font-size:10px;font-weight:900;letter-spacing:.11em;color:#7898ae}.rona-payments-v7-owner-receipt-value{font-size:34px;line-height:1.05;color:#f3f8fb}.rona-payments-v7-owner-table-section{border:1px solid rgba(111,151,184,.14);border-radius:15px;background:rgba(5,15,24,.50);overflow:hidden}.rona-payments-v7-owner-table-scroll{overflow-x:auto}.rona-payments-v7-owner-table{width:100%;min-width:760px;border-collapse:collapse}.rona-payments-v7-owner-table th{padding:13px 16px;text-align:left;border-bottom:1px solid rgba(111,151,184,.16);font-size:10px;font-weight:900;letter-spacing:.055em;text-transform:uppercase;color:#7898ae;background:rgba(9,24,35,.78)}.rona-payments-v7-owner-table td{padding:15px 16px;border-bottom:1px solid rgba(111,151,184,.09);font-size:13px;color:#dce9f3;vertical-align:middle}.rona-payments-v7-owner-table-row td:first-child{width:34%}.rona-payments-v7-owner-table-row td.is-funding{width:33%;font-size:15px;font-weight:850;color:#f1f6fa}.rona-payments-v7-owner-table-row td.is-actual{width:33%;font-size:15px;font-weight:800;color:#c7d8e5}.rona-payments-v7-owner-table-row.is-fee td{background:rgba(50,34,14,.18)}.rona-payments-v7-owner-table-row td small{display:block;margin-top:4px;font-size:9px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#d3ae6b}.rona-payments-v7-owner-table-details-row td{padding:0 16px 12px;background:rgba(3,11,18,.28)}.rona-payments-v7-owner-table-row-details{border-top:0}.rona-payments-v7-owner-table-row-details>summary{cursor:pointer;width:max-content;max-width:100%;padding:7px 0;font-size:10px;font-weight:800;color:#718da3}.rona-payments-v7-owner-table-detail-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;padding:8px 0 4px}.rona-payments-v7-owner-table-detail-item{min-width:0;padding:9px 10px;border-radius:9px;background:rgba(8,22,33,.72);border:1px solid rgba(111,151,184,.10)}.rona-payments-v7-owner-table-detail-item>span{display:block;margin-bottom:4px;font-size:8px;font-weight:850;letter-spacing:.06em;text-transform:uppercase;color:#6f8da3}.rona-payments-v7-owner-table-detail-item>strong{display:block;font-size:11px;line-height:1.4;color:#d9e6ef;overflow-wrap:anywhere}.rona-payments-v7-owner-table-empty td{text-align:center;color:#8199ac}.rona-payments-v7-owner-totals{display:grid;grid-template-columns:1fr 1fr;gap:12px}.rona-payments-v7-owner-total-card{display:grid;gap:8px;padding:18px 20px;border:1px solid rgba(111,151,184,.14);border-radius:14px;background:rgba(7,20,30,.72)}.rona-payments-v7-owner-total-card>strong{font-size:24px;line-height:1.1;color:#edf6fd}.rona-payments-v7-passport-technical{margin-top:0;padding:12px 0 0;border-top:1px solid rgba(111,151,184,.09)}.rona-payments-v7-passport-technical summary{cursor:pointer;width:max-content;max-width:100%;font-size:10px;font-weight:800;color:#6d879a}.rona-payments-v7-passport-tech-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px}@media(max-width:900px){.rona-payments-v7-owner-table-detail-grid{grid-template-columns:1fr 1fr}.rona-payments-v7-passport-tech-grid{grid-template-columns:1fr}}@media(max-width:620px){.rona-payments-v7-owner-receipt{padding:18px}.rona-payments-v7-owner-receipt-value{font-size:28px}.rona-payments-v7-owner-totals{grid-template-columns:1fr}.rona-payments-v7-owner-total-card>strong{font-size:21px}.rona-payments-v7-owner-table-detail-grid{grid-template-columns:1fr}}';
  document.head.appendChild(s);
}
paymentsV7PassportRecoveryInstallStyle();
`;

export default paymentsV7PassportRecoveryUi;
