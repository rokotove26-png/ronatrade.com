import c0 from './deals-current-state-chunks/chunk0.js';
import c1 from './deals-current-state-chunks/chunk1.js';
import c2 from './deals-current-state-chunks/chunk2.js';
import c3 from './deals-current-state-chunks/chunk3.js';
import c4 from './deals-current-state-chunks/chunk4.js';

const SCRIPT=[c0,c1,c2,c3,c4].join('');
export async function onRequest(){return new Response(SCRIPT,{status:200,headers:{'content-type':'application/javascript; charset=utf-8','cache-control':'no-store, no-cache, must-revalidate','pragma':'no-cache','expires':'0','x-content-type-options':'nosniff','x-rona-deals-ui':'current-state-v1'}})}
