(()=>{
'use strict';
const RETIRED='20260830-client-deal-documents-legacy-retired-to-v5';
for(const key of ['__RONA_CLIENT_DEAL_DOCUMENTS_V1__','__RONA_CLIENT_DEAL_DOCUMENTS_V2__','__RONA_CLIENT_DEAL_DOCUMENTS_V3__','__RONA_CLIENT_DEAL_DOCUMENTS_V4__'])window[key]=RETIRED;
if(location.pathname!=='/portal/client')return;
function attach(id,src){
  if(document.getElementById(id))return;
  const s=document.createElement('script');
  s.id=id;s.src=src;s.async=false;
  (document.head||document.documentElement).appendChild(s);
}
attach('rona-client-deal-documents-authoritative-v5','/assets/portal-runtime/client-deal-documents-v5.js?v=20260830-single-owner-prepaint-v8');
attach('rona-client-deal-canonical-visual-authoritative-v2','/assets/portal-runtime/client-deal-canonical-visual-v2.js?v=20260830-single-owner-prepaint-v8');
})();
