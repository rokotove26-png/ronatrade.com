const SECURITY_HEADERS=Object.freeze({'cache-control':'no-store, no-cache, must-revalidate','pragma':'no-cache','referrer-policy':'no-referrer','x-content-type-options':'nosniff','x-frame-options':'DENY','permissions-policy':'camera=(), microphone=(), geolocation=(), payment=()','cross-origin-opener-policy':'same-origin','cross-origin-resource-policy':'same-origin'});
function redirect(location){return new Response(null,{status:303,headers:{...SECURITY_HEADERS,location}})}
export function onRequestGet(){return redirect('/portal/recovery');}
export function onRequestPost(){return new Response(null,{status:405,headers:SECURITY_HEADERS});}
