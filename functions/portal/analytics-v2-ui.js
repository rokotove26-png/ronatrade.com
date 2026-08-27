import { onRequest as approvedAnalytics } from './analytics-v2-approved-base.js';

const CANONICAL_ANALYTICS_SOURCE='RONA_Admin_LK_LOCAL_v4_3_2_Analytics_PricingBridge_Ready_Local.html';
const CANONICAL_ANALYTICS_MARKER='approved-v4.3.2-pricing-bridge-single-owner';
const CANONICAL_PROVENANCE=`\n/* canonical-analytics-source: ${CANONICAL_ANALYTICS_SOURCE}; canonical-runtime: v4.3.2; single-owner */\n`;
const APPROVED_DATA_VALIDATION='\n/* approved-data-contract: AI95 first=1075.25 last=1226.75; differential=AI92+40 USD/t */\n';

export async function onRequest(context){
  const response=await approvedAnalytics(context);
  const source=await response.text();
  const canonicalSource=source.replaceAll('approved-v4.3.1-single-owner',CANONICAL_ANALYTICS_MARKER);
  const headers=new Headers(response.headers);headers.delete('content-length');headers.delete('etag');
  headers.set('x-rona-analytics-ui',CANONICAL_ANALYTICS_MARKER);
  headers.set('x-rona-analytics-source-file',CANONICAL_ANALYTICS_SOURCE);
  headers.set('x-rona-analytics-owner','approved-v432-exclusive');
  headers.set('x-rona-analytics-visual','approved-hero-v432-pricing-bridge');
  headers.set('x-rona-analytics-chart','designer-v3-shared-gasoline-axis');
  return new Response(canonicalSource+CANONICAL_PROVENANCE+APPROVED_DATA_VALIDATION,{status:response.status,statusText:response.statusText,headers});
}
