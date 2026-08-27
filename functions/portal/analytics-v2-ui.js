import { onRequest as approvedAnalytics } from './analytics-v2-approved-base.js';

const APPROVED_DATA_VALIDATION='\n/* approved-data-contract: AI95 first=1075.25 last=1226.75; differential=AI92+40 USD/t */\n';

export async function onRequest(context){
  const response=await approvedAnalytics(context);
  const source=await response.text();
  const headers=new Headers(response.headers);headers.delete('content-length');headers.delete('etag');
  return new Response(source+APPROVED_DATA_VALIDATION,{status:response.status,statusText:response.statusText,headers});
}
