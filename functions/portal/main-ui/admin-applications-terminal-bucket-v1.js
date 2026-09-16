const ADMIN_APPLICATIONS_TERMINAL_BUCKET_V1=String.raw`
(()=>{'use strict';
if(window.__RONA_ADMIN_APPLICATIONS_TERMINAL_BUCKET_V1__)return;
const CONTRACT='20260916-v1-terminal-request-bucket';
if(typeof application2BBucket!=='function'){
  window.__RONA_ADMIN_APPLICATIONS_TERMINAL_BUCKET_V1__='SOURCE_MISMATCH';
  return;
}
const previousBucket=application2BBucket;
const upper=v=>String(v??'').trim().toUpperCase();
application2BBucket=function ronaTerminalAwareApplicationBucket(a){
  const owner=upper(a?.owner_status);
  const status=upper(a?.status);
  const lifecycle=upper(a?.lifecycle_state);
  if(
    ['COMPLETED','DONE','CLOSED'].includes(owner)||
    ['COMPLETED','DONE','CLOSED'].includes(status)||
    lifecycle==='ARCHIVED'
  )return 'COMPLETED';
  return previousBucket(a);
};
window.__RONA_ADMIN_APPLICATIONS_TERMINAL_BUCKET_V1__=CONTRACT;
const rerender=()=>{
  if(typeof refreshAdmin!=='function')return;
  Promise.resolve(refreshAdmin()).catch(error=>console.error('RONA_TERMINAL_BUCKET_REFRESH_FAIL',error));
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>queueMicrotask(rerender),{once:true});
else queueMicrotask(rerender);
})();
`;
export default ADMIN_APPLICATIONS_TERMINAL_BUCKET_V1;
