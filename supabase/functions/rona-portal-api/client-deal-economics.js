function text(value){return String(value??'').trim()}
function upper(value){return text(value).toUpperCase()}
function positive(value){const n=Number(value);return Number.isFinite(n)&&n>0?n:null}
function bool(value){return value===true||value===1||['TRUE','T','1','YES'].includes(upper(value))}
function money(value){return Math.round(Number(value)*100)/100}
function currency(value){const v=upper(value);return v||null}

export function resolveClientDealPassportEconomics(row={}){
  const applicationStatus=upper(row.application_status);
  const workflowBusinessStatus=upper(row.workflow_business_status??row.business_status);
  const confirmedQuantityTonnes=positive(row.confirmed_quantity_tonnes);
  const finalized=Boolean(text(row.finalized_at));
  const counterSelected=bool(row.counter_offer_used)&&finalized;
  const acceptedCounter=counterSelected&&upper(row.client_counter_response)==='ACCEPTED';

  if(applicationStatus!=='DEAL_REGISTERED'||workflowBusinessStatus!=='DEAL'||confirmedQuantityTonnes===null){
    return{
      passport_amount:null,
      passport_currency:null,
      passport_unit_price:null,
      passport_amount_source:null,
      confirmed_quantity_tonnes:confirmedQuantityTonnes,
      counter_offer_used:acceptedCounter,
    };
  }

  if(counterSelected&&!acceptedCounter){
    return{
      passport_amount:null,
      passport_currency:null,
      passport_unit_price:null,
      passport_amount_source:'FINALIZED_COUNTEROFFER_NOT_ACCEPTED',
      confirmed_quantity_tonnes:confirmedQuantityTonnes,
      counter_offer_used:false,
    };
  }

  if(acceptedCounter){
    const unitPrice=positive(row.counter_price);
    const acceptedCurrency=currency(row.counter_currency);
    if(unitPrice===null||!acceptedCurrency){
      return{
        passport_amount:null,
        passport_currency:null,
        passport_unit_price:unitPrice,
        passport_amount_source:'FINALIZED_ACCEPTED_COUNTEROFFER_INCOMPLETE',
        confirmed_quantity_tonnes:confirmedQuantityTonnes,
        counter_offer_used:true,
      };
    }
    return{
      passport_amount:money(unitPrice*confirmedQuantityTonnes),
      passport_currency:acceptedCurrency,
      passport_unit_price:unitPrice,
      passport_amount_source:'FINALIZED_ACCEPTED_COUNTEROFFER',
      confirmed_quantity_tonnes:confirmedQuantityTonnes,
      counter_offer_used:true,
    };
  }

  const applicationPrice=positive(row.application_price);
  const applicationCurrency=currency(row.application_currency);
  if(applicationPrice===null||!applicationCurrency){
    return{
      passport_amount:null,
      passport_currency:null,
      passport_unit_price:applicationPrice,
      passport_amount_source:'APPLICATION_ECONOMICS_UNAVAILABLE',
      confirmed_quantity_tonnes:confirmedQuantityTonnes,
      counter_offer_used:false,
    };
  }

  return{
    passport_amount:money(applicationPrice*confirmedQuantityTonnes),
    passport_currency:applicationCurrency,
    passport_unit_price:applicationPrice,
    passport_amount_source:finalized?'FINALIZED_APPLICATION_COMMERCIAL_TERMS':'LEGACY_REGISTERED_APPLICATION_COMMERCIAL_TERMS',
    confirmed_quantity_tonnes:confirmedQuantityTonnes,
    counter_offer_used:false,
  };
}

export function applyClientDealPassportEconomics(deal,row){
  const economics=resolveClientDealPassportEconomics(row);
  deal.confirmed_quantity_tonnes=economics.confirmed_quantity_tonnes;
  deal.passport_unit_price=economics.passport_unit_price;
  deal.passport_amount=economics.passport_amount;
  deal.passport_currency=economics.passport_currency;
  deal.passport_amount_source=economics.passport_amount_source;
  deal.passport_application_id=row?.application_id?String(row.application_id):null;
  deal.counter_offer_used=economics.counter_offer_used;
  return deal;
}
