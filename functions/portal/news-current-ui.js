// Retired debug endpoint. The canonical Market News owner is
// /assets/portal-market-news-current-v1.js, loaded by remaining-sections-ui.
// This route must never paint a competing news page or expose a test fixture.
export function onRequest(){
  return new Response(JSON.stringify({ok:false,code:'RUNTIME_RETIRED_POST_OWNER_ACCEPTANCE'}),{
    status:410,
    headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-rona-route-retired':'news-current-ui-v1'}
  });
}
