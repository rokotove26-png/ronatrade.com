import c0 from './owner-ui-chunks/chunk0.js';
import c1 from './owner-ui-chunks/chunk1.js';
import c2 from './owner-ui-chunks/chunk2.js';
import c3 from './owner-ui-chunks/chunk3.js';
import c4 from './owner-ui-chunks/chunk4.js';
import c5 from './owner-ui-chunks/chunk5.js';
import c6 from './owner-ui-chunks/chunk6.js';
import c7 from './owner-ui-chunks/chunk7.js';
const SCRIPT=[c0,c1,c2,c3,c4,c5,c6,c7].join('');
export async function onRequest(){return new Response(SCRIPT,{status:200,headers:{'content-type':'application/javascript; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}})}
