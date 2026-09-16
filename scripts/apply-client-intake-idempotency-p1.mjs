import { readFile, writeFile } from 'node:fs/promises';

const targets=[
  ['assets/portal-runtime/client-application-form-v3.js','v3'],
  ['assets/portal-runtime/client-application-form-v2.js','v2'],
];

function once(source,from,to,label){
  const count=source.split(from).length-1;
  if(count!==1)throw new Error(`${label}: expected exactly one match, got ${count}`);
  return source.replace(from,to);
}

function patchV3(source){
  if(source.includes("20260916-intake-idempotency-v8"))return source;
  source=once(source,
    "window.__RONA_CLIENT_APPLICATION_FORM_V3__='20260902-destination-price-calc-v7-current-context-authority';",
    "window.__RONA_CLIENT_APPLICATION_FORM_V3__='20260916-intake-idempotency-v8';",
    'V3_MARK');
  source=once(source,
    "const form=overlay.querySelector('form'),submit=form.querySelector('.rona-app-v3-submit');overlay.addEventListener",
    "const form=overlay.querySelector('form'),submit=form.querySelector('.rona-app-v3-submit');const submission={calculationKey:null,applicationKey:null,applicationId:null,detailsKey:null};overlay.addEventListener",
    'V3_SUBMISSION_STATE');
  source=once(source,
    "const key=uid('PRICE-CALC-'),details=detailsPayload",
    "const key=submission.calculationKey||(submission.calculationKey=uid('PRICE-CALC-')),details=detailsPayload",
    'V3_CALC_KEY');
  source=once(source,
    "const key=uid('PRICE-APP-'),appResult=await request('/v1/client/applications'",
    "const key=submission.applicationKey||(submission.applicationKey=uid('PRICE-APP-'));let applicationId=submission.applicationId;if(!applicationId){const appResult=await request('/v1/client/applications'",
    'V3_APP_KEY');
  source=once(source,
    "const app=appResult?.application||appResult?.data||{},applicationId=String(app.application_id||app.applicationId||'').trim();if(!applicationId)throw new Error('APPLICATION_ID_MISSING');const detailKey=key+'-DETAILS',details=detailsPayload",
    "const app=appResult?.application||appResult?.data||{};applicationId=String(app.application_id||app.applicationId||'').trim();if(!applicationId)throw new Error('APPLICATION_ID_MISSING');submission.applicationId=applicationId}const detailKey=submission.detailsKey||(submission.detailsKey=key+'-DETAILS'),details=detailsPayload",
    'V3_APP_ID_DETAILS_KEY');
  return source;
}

function patchV2(source){
  if(source.includes("20260916-intake-idempotency-v3"))return source;
  source=once(source,
    "window.__RONA_CLIENT_APPLICATION_FORM_V2__='20260828-rail-application-v2';",
    "window.__RONA_CLIENT_APPLICATION_FORM_V2__='20260916-intake-idempotency-v3';",
    'V2_MARK');
  source=once(source,
    "const form=overlay.querySelector('form');overlay.addEventListener",
    "const form=overlay.querySelector('form');const submission={applicationKey:null,applicationId:null,detailsKey:null};overlay.addEventListener",
    'V2_SUBMISSION_STATE');
  source=once(source,
    "submit.disabled=true;const key='PRICE-APP-'+(crypto.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random().toString(36).slice(2));try{\n    const appResult=await request('/v1/client/applications'",
    "submit.disabled=true;const key=submission.applicationKey||(submission.applicationKey='PRICE-APP-'+(crypto.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random().toString(36).slice(2)));try{\n    let applicationId=submission.applicationId;if(!applicationId){const appResult=await request('/v1/client/applications'",
    'V2_APP_KEY');
  source=once(source,
    "const app=appResult?.application||appResult?.data||{};const applicationId=String(app.application_id||app.applicationId||'').trim();if(!applicationId)throw new Error('APPLICATION_ID_MISSING');\n    const detailKey=key+'-DETAILS';const details=",
    "const app=appResult?.application||appResult?.data||{};applicationId=String(app.application_id||app.applicationId||'').trim();if(!applicationId)throw new Error('APPLICATION_ID_MISSING');submission.applicationId=applicationId}\n    const detailKey=submission.detailsKey||(submission.detailsKey=key+'-DETAILS');const details=",
    'V2_APP_ID_DETAILS_KEY');
  return source;
}

for(const [path,version] of targets){
  const source=await readFile(path,'utf8');
  const next=version==='v3'?patchV3(source):patchV2(source);
  if(!next.includes('submission.applicationId')||!next.includes('submission.detailsKey'))throw new Error(`${version}: retry identity contract missing`);
  await writeFile(path,next,'utf8');
  console.log(`CLIENT_INTAKE_RETRY_PATCH_${version.toUpperCase()}=PASS`);
}
