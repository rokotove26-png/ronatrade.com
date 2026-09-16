const marker='RONA_ATOMIC_APPLICATION_FORM_V2';
function once(s,a,b){if(s.split(a).length!==2)throw new Error('ATOMIC_FORM_ANCHOR_MISMATCH:'+a.slice(0,65));return s.replace(a,b)}
function jsonObjectAfter(s,anchor){const start=s.indexOf(anchor);if(start<0)throw new Error('ATOMIC_FORM_BODY_MISSING');const a=start+anchor.length,b=s.indexOf('})});',a);if(b<0)throw new Error('ATOMIC_FORM_BODY_END_MISSING');return s.slice(a,b+1)}
export function wireAtomicForm(source,version,helper){
 if(source.includes(marker))return source;
 let s=source;
 const create=version==='v3'?"const form=overlay.querySelector('form'),submit=form.querySelector('.rona-app-v3-submit');":"const form=overlay.querySelector('form');";
 s=once(s,create,create+"const applicationIntent=window.RonaApplicationIntentV2.create();");
 const start=s.indexOf("form.addEventListener('submit'");if(start<0)throw new Error('SUBMIT_HANDLER_MISSING');
 const part=s.slice(start),body=jsonObjectAfter(part,"body:JSON.stringify(").replace(/,idempotencyKey:key$/, '');
 // V3's first JSON object is a delivered event; find the standard application object explicitly.
 const appBody=version==='v3'?jsonObjectAfter(part.slice(part.indexOf("request('/v1/client/applications'")),"body:JSON.stringify("):body;
 const normalizedApp=appBody.replace(',idempotencyKey:key}','}');
 let replacement;
 if(version==='v3'){
  const a=s.indexOf('    try{',start),b=s.indexOf('    }catch(err)',a);
  replacement=`    try{
      const details=detailsPayload(form,item,ctx,ref,basis,quantity,destinationCountry,stationCode,borderCode,calculation?'CALCULATION':'APPLICATION');
      const body=calculation?{role:'CLIENT',event_type:'CLIENT_MESSAGE_SUBMIT',authority_domain:'PRICE_CALCULATION',authority_target_type:'PUBLICATION_ITEM',authority_target_id:String(item.publication_item_id||''),client_id:ctx.client_id,contract_id:ctx.contract_id,payload:details}:{...${normalizedApp},applicationDetails:details};
      const receipt=await window.RonaApplicationIntentV2.submit(applicationIntent,calculation?'DELIVERED':'STANDARD',body,request);
      const applicationId=receipt.application_id;close();notify(\`\u0417\u0430\u044f\u0432\u043a\u0430 \${applicationId} \u043f\u043e\u0434\u0430\u043d\u0430.\`);
      window.dispatchEvent(new CustomEvent('rona:client-application-submitted',{detail:{applicationId}}));
`;
  s=s.slice(0,a)+replacement+s.slice(b);
  s=once(s,'submit.disabled=true;const calculation=',"if(submit.disabled)return;submit.disabled=true;const calculation=");
 }else{
  const a=s.indexOf('submit.disabled=true;',start),b=s.indexOf('  }catch(err)',a);
  const dstart=part.indexOf('const details=')+'const details='.length,dend=part.indexOf(';\n',dstart);
  let details=part.slice(dstart,dend).replace('application_id:applicationId','application_id:null').replace("message_type:'APPLICATION_DETAILS_V2'","message_type:'APPLICATION_DETAILS_V5',client_id:ctx.client_id,contract_id:ctx.contract_id,reference:{publication_item_id:item.publication_item_id}");
  replacement=`if(submit.disabled)return;submit.disabled=true;try{
    const details=${details};
    const body={...${normalizedApp},applicationDetails:details};
    const receipt=await window.RonaApplicationIntentV2.submit(applicationIntent,'STANDARD',body,request);
    const applicationId=receipt.application_id;close();notify(\`\u0417\u0430\u044f\u0432\u043a\u0430 \${applicationId} \u043f\u043e\u0434\u0430\u043d\u0430.\`);
    window.dispatchEvent(new CustomEvent('rona:client-application-submitted',{detail:{applicationId}}));
`;
  s=s.slice(0,a)+replacement+s.slice(b);
 }
 // No separate details transport, generated business identifier or two-stage fallback may remain.
 if(s.includes('idempotencyKey:key')||s.includes('idempotency_key:detailKey')||s.includes("uid('PRICE-APP-')"))throw new Error('ATOMIC_FORM_LEGACY_PATH_REMAINS');
 return '/* '+marker+' */\n'+helper+'\n'+s;
}
