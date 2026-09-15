const paymentsV7PassportRecoveryUi = String.raw`
const PAYMENTS_V7_PASSPORT_RECOVERY_UI='PAYMENTS_V7_PASSPORT_OWNER_TABLE_V2';
const PAYMENTS_V7_OWNER_TABLE_VERSION='OWNER_TABLE_V2';

function paymentsV7PassportAuthority(value,fallbackCurrency){
  const amount=paymentsV7Num(value?.amount);
  const currency=paymentsV7Upper(value?.currency||fallbackCurrency);
  const status=paymentsV7Upper(value?.status);
  if(status!=='AUTHORITATIVE'||amount===null||!currency)return null;
  return {amount:value?.amount,currency};
}

function paymentsV7PassportMoneyNode(value,{hero=false,total=false}={}){
  if(!value)return e('span',{class:'rona-payments-v7-owner-money is-verify',text:'Требуется подтверждение'});
  return e('span',{class:'rona-payments-v7-owner-money'+(hero?' is-hero':'')+(total?' is-total':'')},
    e('span',{class:'rona-payments-v7-owner-money-amount',text:paymentsV7OwnerAmount(value.amount)}),
    e('span',{class:'rona-payments-v7-owner-money-currency',text:value.currency})
  );
}

function paymentsV7PassportPrimaryMoneyNode(value,fallbackCurrency,opts={}){
  return paymentsV7PassportMoneyNode(paymentsV7PassportAuthority(value,fallbackCurrency),opts);
}

function paymentsV7PassportEventFunding(event){
  if(paymentsV7Upper(event?.funding_status)!=='AUTHORITATIVE')return null;
  const currency=paymentsV7Upper(event?.funding_currency);
  if(!currency)return null;
  if(paymentsV7Num(event?.allocated_funding_amount)!==null)return {amount:event?.allocated_funding_amount,currency};
  const share=paymentsV7Text(event?.allocation_share);
  if(share&&share!=='1')return null;
  if(paymentsV7Num(event?.funding_amount)!==null)return {amount:event?.funding_amount,currency};
  return null;
}

function paymentsV7PassportFundingSplit(row){
  const amount=paymentsV7Num(row?.allocated_funding_amount);
  const currency=paymentsV7Upper(row?.funding_currency);
  const status=paymentsV7Upper(row?.funding_allocation_status||row?.funding_status);
  if(amount===null||!currency||status!=='AUTHORITATIVE')return null;
  return {amount:row?.allocated_funding_amount,currency};
}

function paymentsV7PassportRowFunding(row,event,rowCount){
  const exact=paymentsV7PassportFundingSplit(row);
  if(exact)return exact;
  if(event&&rowCount===1)return paymentsV7PassportEventFunding(event);
  return null;
}

function paymentsV7PassportRowActual(row){
  if(paymentsV7Upper(row?.status)!=='AUTHORITATIVE'||paymentsV7Num(row?.amount)===null||!paymentsV7Upper(row?.currency))return null;
  return {amount:row?.amount,currency:paymentsV7Upper(row?.currency)};
}

function paymentsV7PassportRecipient(row){
  const recipient=paymentsV7Text(row?.recipient);
  if(recipient)return recipient;
  return paymentsV7Upper(row?.row_type)==='COMMISSION'?'Банк / комиссия':'Не указан';
}

function paymentsV7PassportDetailItem(label,value){
  return e('div',{class:'rona-payments-v7-owner-table-detail-item'},e('span',{text:label}),e('strong',{text:value||'—'}));
}

function paymentsV7PassportConversionText(event){
  if(!event)return '';
  const share=paymentsV7Text(event?.allocation_share);
  if(share&&share!=='1')return '';
  const funding=paymentsV7PassportEventFunding(event);
  const acquiredAmount=paymentsV7Num(event?.acquired_amount);
  const acquiredCurrency=paymentsV7Upper(event?.acquired_currency);
  if(!funding||acquiredAmount===null||!acquiredCurrency)return '';
  return paymentsV7OwnerAmount(funding.amount)+' '+funding.currency+' → '+paymentsV7OwnerAmount(event?.acquired_amount)+' '+acquiredCurrency;
}

function paymentsV7PassportRowDetails(row,event){
  const details=e('details',{class:'rona-payments-v7-owner-table-row-details'},e('summary',{text:'Детали'}));
  const grid=e('div',{class:'rona-payments-v7-owner-table-detail-grid'});
  grid.append(
    paymentsV7PassportDetailItem('Дата',paymentsV7OwnerDate(row?.payment_at||event?.payment_at)),
    paymentsV7PassportDetailItem('Назначение',paymentsV7Text(row?.purpose)||'Не указано'),
    paymentsV7PassportDetailItem('Документ',paymentsV7Text(row?.bank_document)||paymentsV7Text(event?.bank_document)||'Не указан')
  );
  const conversion=paymentsV7PassportConversionText(event);
  if(conversion)grid.append(paymentsV7PassportDetailItem('Конвертация',conversion));
  if(paymentsV7Num(event?.conversion_rate)!==null)grid.append(paymentsV7PassportDetailItem('Фактический курс',paymentsV7OwnerAmount(event?.conversion_rate)));
  details.append(grid);
  return details;
}

function paymentsV7PassportTableRows(passport){
  const items=[];
  for(const event of paymentsV7Array(passport?.funding_events)){
    const rows=paymentsV7Array(event?.settlement_lines);
    for(const row of rows)items.push({row,event,rowCount:rows.length});
  }
  for(const row of paymentsV7Array(passport?.unlinked_settlement_lines))items.push({row,event:null,rowCount:0});
  return items;
}

function paymentsV7PassportTable(passport){
  const section=e('section',{class:'rona-payments-v7-owner-table-section','aria-label':'Куда ушли деньги сделки'});
  const scroller=e('div',{class:'rona-payments-v7-owner-table-scroll'});
  const table=e('table',{class:'rona-payments-v7-owner-table'});
  table.append(e('thead',{},e('tr',{},
    e('th',{scope:'col',text:'Получатель'}),
    e('th',{scope:'col',class:'is-money-head',text:'Сумма в валюте поступления'}),
    e('th',{scope:'col',class:'is-money-head',text:'Сумма фактического списания'})
  )));
  const tbody=e('tbody',{});
  const items=paymentsV7PassportTableRows(passport);
  if(!items.length){
    tbody.append(e('tr',{class:'rona-payments-v7-owner-table-empty'},e('td',{colspan:'3',text:'Фактические списания по сделке не переданы.'})));
  }else{
    for(const item of items){
      const fee=paymentsV7Upper(item.row?.row_type)==='COMMISSION';
      const recipient=e('div',{class:'rona-payments-v7-owner-recipient'},
        e('strong',{text:paymentsV7PassportRecipient(item.row)}),
        fee?e('span',{class:'rona-payments-v7-owner-fee-tag',text:'Комиссия'}):null
      );
      tbody.append(e('tr',{class:'rona-payments-v7-owner-table-row'+(fee?' is-fee':'')},
        e('td',{class:'is-recipient'},recipient),
        e('td',{class:'is-funding'},paymentsV7PassportMoneyNode(paymentsV7PassportRowFunding(item.row,item.event,item.rowCount))),
        e('td',{class:'is-actual'},paymentsV7PassportMoneyNode(paymentsV7PassportRowActual(item.row)))
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
  paymentsV7Array(passport?.funding_events).forEach((event,index)=>{
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
  const body=e('div',{class:'rona-payments-v7-passport-body rona-payments-v7-owner-passport-v2 rona-payments-v7-passport-recovered rona-payments-v7-passport-owner-table-document','data-passport-recovery':PAYMENTS_V7_PASSPORT_RECOVERY_UI,'data-owner-table-version':PAYMENTS_V7_OWNER_TABLE_VERSION});
  body.append(e('section',{class:'rona-payments-v7-owner-receipt'},
    e('div',{class:'rona-payments-v7-owner-receipt-copy'},
      e('span',{class:'rona-payments-v7-owner-receipt-label',text:'СУММА ПОСТУПЛЕНИЯ'}),
      e('span',{class:'rona-payments-v7-owner-receipt-caption',text:'Средства, поступившие от клиента по сделке'})
    ),
    e('strong',{class:'rona-payments-v7-owner-receipt-value'},paymentsV7PassportPrimaryMoneyNode(passport?.funding_received,passport?.funding_currency,{hero:true}))
  ));

  body.append(paymentsV7PassportTable(passport));

  body.append(e('section',{class:'rona-payments-v7-owner-totals'},
    e('div',{class:'rona-payments-v7-owner-total-card is-spent'},
      e('span',{class:'rona-payments-v7-owner-total-label',text:'ИТОГО ПОТРАЧЕНО'}),
      e('strong',{},paymentsV7PassportPrimaryMoneyNode(passport?.funding_spent,passport?.funding_currency,{total:true}))
    ),
    e('div',{class:'rona-payments-v7-owner-total-card is-remaining'},
      e('span',{class:'rona-payments-v7-owner-total-label',text:'ОСТАТОК'}),
      e('strong',{},paymentsV7PassportPrimaryMoneyNode(passport?.funding_remaining,passport?.funding_currency,{total:true}))
    )
  ));

  body.append(paymentsV7PassportTechnical(deal,passport));
  return body;
};
paymentsV7OwnerPassportBody.__ronaOwnerTableVersion=PAYMENTS_V7_OWNER_TABLE_VERSION;
globalThis.paymentsV7OwnerPassportTableRenderer=paymentsV7OwnerPassportBody;

function paymentsV7PassportRecoveryInstallStyle(){
  if(q('#ronaPaymentsV7PassportRecoveryStyle'))return;
  const s=e('style',{id:'ronaPaymentsV7PassportRecoveryStyle'});
  s.textContent='.rona-payments-v7-passport-owner-table-document{display:grid;gap:14px;padding:0;font-variant-numeric:tabular-nums}.rona-payments-v7-owner-receipt{min-height:92px;display:flex;align-items:flex-end;justify-content:space-between;gap:24px;padding:18px 20px;border:1px solid rgba(116,166,201,.18);border-radius:14px;background:linear-gradient(145deg,rgba(11,29,42,.96),rgba(6,18,28,.98))}.rona-payments-v7-owner-receipt-copy{display:grid;gap:5px;min-width:0}.rona-payments-v7-owner-receipt-label,.rona-payments-v7-owner-total-label{font-size:10px;font-weight:900;letter-spacing:.11em;color:#7898ae}.rona-payments-v7-owner-receipt-caption{font-size:11px;color:#68859a}.rona-payments-v7-owner-receipt-value{display:flex;justify-content:flex-end;min-width:0}.rona-payments-v7-owner-money{display:inline-flex;align-items:baseline;justify-content:flex-end;gap:7px;white-space:nowrap}.rona-payments-v7-owner-money-amount{font-size:15px;font-weight:850;letter-spacing:-.015em;color:#eef5fa}.rona-payments-v7-owner-money-currency{font-size:10px;font-weight:900;letter-spacing:.09em;color:#7898ae}.rona-payments-v7-owner-money.is-hero .rona-payments-v7-owner-money-amount{font-size:36px;font-weight:900;color:#f5f9fc}.rona-payments-v7-owner-money.is-hero .rona-payments-v7-owner-money-currency{font-size:13px}.rona-payments-v7-owner-money.is-total .rona-payments-v7-owner-money-amount{font-size:25px}.rona-payments-v7-owner-money.is-total .rona-payments-v7-owner-money-currency{font-size:11px}.rona-payments-v7-owner-money.is-verify{white-space:normal;text-align:right;font-size:11px;font-weight:750;color:#d9b97e}.rona-payments-v7-owner-table-section{border:1px solid rgba(111,151,184,.13);border-radius:14px;background:rgba(5,15,24,.48);overflow:hidden}.rona-payments-v7-owner-table-scroll{overflow-x:auto;overscroll-behavior-inline:contain}.rona-payments-v7-owner-table{width:100%;min-width:720px;border-collapse:collapse;table-layout:fixed}.rona-payments-v7-owner-table th{padding:12px 16px;text-align:left;border-bottom:1px solid rgba(111,151,184,.16);font-size:9px;font-weight:900;line-height:1.35;letter-spacing:.055em;text-transform:uppercase;color:#7898ae;background:rgba(9,24,35,.82)}.rona-payments-v7-owner-table th.is-money-head{text-align:right}.rona-payments-v7-owner-table td{padding:13px 16px;border-bottom:1px solid rgba(111,151,184,.08);font-size:13px;color:#dce9f3;vertical-align:middle;transition:background .16s ease,border-color .16s ease}.rona-payments-v7-owner-table-row:hover td{background:rgba(100,181,255,.035);border-bottom-color:rgba(111,151,184,.14)}.rona-payments-v7-owner-table-row td.is-recipient{width:38%}.rona-payments-v7-owner-table-row td.is-funding{width:31%;text-align:right}.rona-payments-v7-owner-table-row td.is-actual{width:31%;text-align:right}.rona-payments-v7-owner-recipient{display:flex;align-items:center;gap:8px;min-width:0}.rona-payments-v7-owner-recipient>strong{min-width:0;max-width:100%;font-size:13px;line-height:1.35;color:#e5eef4;overflow-wrap:anywhere}.rona-payments-v7-owner-fee-tag{flex:0 0 auto;padding:3px 6px;border:1px solid rgba(212,174,103,.20);border-radius:999px;background:rgba(69,47,18,.28);font-size:8px;font-weight:900;letter-spacing:.06em;text-transform:uppercase;color:#d9b66f}.rona-payments-v7-owner-table-row.is-fee td{background:rgba(50,34,14,.12)}.rona-payments-v7-owner-table-row.is-fee td:first-child{box-shadow:inset 3px 0 0 rgba(212,174,103,.34)}.rona-payments-v7-owner-table-details-row td{padding:0 16px 8px;background:rgba(3,11,18,.20)}.rona-payments-v7-owner-table-row-details{border-top:0}.rona-payments-v7-owner-table-row-details>summary{cursor:pointer;width:max-content;max-width:100%;padding:6px 2px;border-radius:6px;font-size:9px;font-weight:850;letter-spacing:.02em;color:#6f8da3;list-style-position:inside}.rona-payments-v7-owner-table-row-details>summary:hover{color:#9bb5c7}.rona-payments-v7-owner-table-row-details>summary:focus-visible{outline:2px solid rgba(106,178,229,.55);outline-offset:2px}.rona-payments-v7-owner-table-detail-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px;padding:7px 0 5px}.rona-payments-v7-owner-table-detail-item{min-width:0;padding:8px 9px;border-radius:8px;background:rgba(8,22,33,.66);border:1px solid rgba(111,151,184,.09)}.rona-payments-v7-owner-table-detail-item>span{display:block;margin-bottom:4px;font-size:8px;font-weight:850;letter-spacing:.055em;text-transform:uppercase;color:#6f8da3}.rona-payments-v7-owner-table-detail-item>strong{display:block;font-size:10px;line-height:1.4;color:#d9e6ef;overflow-wrap:anywhere}.rona-payments-v7-owner-table-empty td{text-align:center;color:#8199ac}.rona-payments-v7-owner-totals{display:grid;grid-template-columns:1fr 1fr;gap:10px}.rona-payments-v7-owner-total-card{min-height:88px;display:flex;align-items:flex-end;justify-content:space-between;gap:18px;padding:16px 18px;border:1px solid rgba(111,151,184,.14);border-radius:13px;background:linear-gradient(145deg,rgba(8,23,34,.86),rgba(5,16,25,.94))}.rona-payments-v7-owner-total-card.is-remaining{border-color:rgba(72,223,164,.15);background:linear-gradient(145deg,rgba(7,29,27,.42),rgba(5,17,24,.94))}.rona-payments-v7-owner-total-card>strong{display:flex;justify-content:flex-end;min-width:0}.rona-payments-v7-passport-technical{margin-top:1px;padding:10px 0 0;border-top:1px solid rgba(111,151,184,.08)}.rona-payments-v7-passport-technical summary{cursor:pointer;width:max-content;max-width:100%;padding:5px 2px;border-radius:6px;font-size:9px;font-weight:800;color:#627f94}.rona-payments-v7-passport-technical summary:hover{color:#8ea9bc}.rona-payments-v7-passport-technical summary:focus-visible{outline:2px solid rgba(106,178,229,.45);outline-offset:2px}.rona-payments-v7-passport-tech-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:9px}@media(max-width:1180px){.rona-payments-v7-owner-receipt{min-height:84px}.rona-payments-v7-owner-money.is-hero .rona-payments-v7-owner-money-amount{font-size:32px}.rona-payments-v7-owner-table th,.rona-payments-v7-owner-table td{padding-left:13px;padding-right:13px}.rona-payments-v7-owner-table-detail-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:900px){.rona-payments-v7-owner-receipt{align-items:flex-start;flex-direction:column;gap:12px}.rona-payments-v7-owner-receipt-value{justify-content:flex-start}.rona-payments-v7-owner-totals{grid-template-columns:1fr}.rona-payments-v7-owner-table-detail-grid{grid-template-columns:1fr 1fr}.rona-payments-v7-passport-tech-grid{grid-template-columns:1fr}}@media(max-width:680px){.rona-payments-v7-owner-receipt{padding:16px}.rona-payments-v7-owner-money.is-hero .rona-payments-v7-owner-money-amount{font-size:28px}.rona-payments-v7-owner-total-card{align-items:flex-start;flex-direction:column;min-height:0}.rona-payments-v7-owner-total-card>strong{justify-content:flex-start}.rona-payments-v7-owner-table-detail-grid{grid-template-columns:1fr}}';
  document.head.appendChild(s);
}
paymentsV7PassportRecoveryInstallStyle();
`;

export default paymentsV7PassportRecoveryUi;
