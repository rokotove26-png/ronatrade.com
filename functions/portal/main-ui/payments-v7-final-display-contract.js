const paymentsV7FinalDisplayContract = String.raw`
const paymentsV7OwnerEventBeforeFinalDisplay=paymentsV7OwnerEvent;
paymentsV7OwnerEvent=function paymentsV7OwnerEventFinalDisplay(event,index){
  const card=paymentsV7OwnerEventBeforeFinalDisplay(event,index);
  const grid=card?.querySelector?.('.rona-payments-v7-owner-event-grid');
  if(grid){
    grid.append(paymentsV7OwnerField('Статус распределения',paymentsV7OwnerStatusText(event?.funding_status)));
  }
  return card;
};

const paymentsV7OwnerPassportBodyBeforeFinalDisplay=paymentsV7OwnerPassportBody;
paymentsV7OwnerPassportBody=function paymentsV7OwnerPassportBodyFinalDisplay(deal,passport){
  const body=paymentsV7OwnerPassportBodyBeforeFinalDisplay(deal,passport);
  const summary=body?.querySelector?.('.rona-payments-v7-owner-funding-summary');
  if(summary){
    summary.append(
      paymentsV7OwnerField('Ожидается сейчас',paymentsV7OwnerMoney(deal?.due_now,deal?.funding_currency||passport?.funding_currency)),
      paymentsV7OwnerField('Условно / будущий срок',paymentsV7OwnerMoney(deal?.expected_not_due,deal?.funding_currency||passport?.funding_currency)),
      paymentsV7OwnerField('Статус сделки',paymentsV7OwnerDealStatusText(deal?.financial_status)),
      paymentsV7OwnerField('Документарный статус',paymentsV7Text(deal?.documentary_status)||'TO_VERIFY')
    );
  }
  body.append(e('details',{class:'rona-payments-v7-owner-tech rona-payments-v7-authority-provenance'},
    e('summary',{text:'Источник и provenance'}),
    e('pre',{text:JSON.stringify({
      financial_status:deal?.financial_status||null,
      documentary_status:deal?.documentary_status||null,
      authority_refs:paymentsV7Array(deal?.authority_refs)
    },null,2)})
  ));
  return body;
};

const paymentsV7DealBeforeFinalDisplay=paymentsV7Deal;
paymentsV7Deal=function paymentsV7DealFinalDisplay(deal){
  const card=paymentsV7DealBeforeFinalDisplay(deal);
  const passport=paymentsV7OwnerPassport(deal);
  const summary=card?.querySelector?.('.rona-payments-v7-deal-owner-summary');
  if(summary&&passport){
    summary.append(
      e('div',{class:'rona-payments-v7-deal-cell'},
        e('span',{text:'Ожидается сейчас'}),
        e('strong',{text:paymentsV7OwnerMoney(deal?.due_now,deal?.funding_currency||passport?.funding_currency)}),
        e('small',{text:paymentsV7OwnerDealStatusText(deal?.financial_status)})),
      e('div',{class:'rona-payments-v7-deal-cell'},
        e('span',{text:'Условно / будущий срок'}),
        e('strong',{text:paymentsV7OwnerMoney(deal?.expected_not_due,deal?.funding_currency||passport?.funding_currency)}))
    );
  }
  return card;
};
`;

export default paymentsV7FinalDisplayContract;
