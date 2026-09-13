import ownerPaymentsAccountingCurrencyProgressV6Runtime from './owner-payments-accounting-currency-progress-v6-r2-runtime.js';

const LIVE_OWNER_PAYMENTS_TAKEOVER=String.raw`
;try{
  if(typeof renderPayments==='function'){
    window.__RONA_OWNER_PAYMENTS_LEGACY_RENDERER__=renderPayments;
    renderPayments=function(){
      const fn=window.__RONA_OWNER_PAYMENTS_V6_RENDER__;
      if(typeof fn==='function')return fn();
      const d=window.__RONA_OWNER_PAYMENTS_V6_DIAGNOSTICS__||{};
      window.__RONA_OWNER_PAYMENTS_V6_DIAGNOSTICS__=Object.assign({},d,{legacyRendererTakeover:true,legacyRendererCalledBeforeV6Hook:true,runtime:window.__RONA_OWNER_PAYMENTS_V6_RUNTIME__||null,pathname:location.pathname,at:new Date().toISOString()});
    };
    const d=window.__RONA_OWNER_PAYMENTS_V6_DIAGNOSTICS__||{};
    window.__RONA_OWNER_PAYMENTS_V6_DIAGNOSTICS__=Object.assign({},d,{legacyRendererTakeover:true,legacyRendererOwner:'V6_R2',runtime:window.__RONA_OWNER_PAYMENTS_V6_RUNTIME__||null,pathname:location.pathname,at:new Date().toISOString()});
  }
}catch(err){
  console.error('owner payments v6 r2 legacy renderer takeover',err);
}
`;

export default ownerPaymentsAccountingCurrencyProgressV6Runtime+LIVE_OWNER_PAYMENTS_TAKEOVER;