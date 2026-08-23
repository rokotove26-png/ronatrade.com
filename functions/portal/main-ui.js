import c0 from './owner-ui-chunks/chunk0.js';
import c1 from './owner-ui-chunks/chunk1.js';
import c2 from './owner-ui-chunks/chunk2.js';
import c3 from './owner-ui-chunks/chunk3.js';
import c4 from './owner-ui-chunks/chunk4.js';
import c5 from './owner-ui-chunks/chunk5.js';
import cPriceArchitecture from './owner-ui-chunks/chunkPriceArchitecture.js';
import c6 from './owner-ui-chunks/chunk6.js';
import c7 from './owner-ui-chunks/chunk7.js';
import c8 from './owner-ui-chunks/chunk8.js';
import c9 from './owner-ui-chunks/chunk9.js';
import c10 from './owner-ui-chunks/chunk10.js';
import c11 from './owner-ui-chunks/chunk11.js';
import c12 from './owner-ui-chunks/chunk12.js';
import c13 from './owner-ui-chunks/chunk13.js';
import c14 from './owner-ui-chunks/chunk14.js';
import c15 from './owner-ui-chunks/chunk15.js';
import c16 from './owner-ui-chunks/chunk16.js';
import cPaintGuard from './owner-ui-chunks/chunkPaintGuard.js';

const BUILD='owner-main-v2-20260823-1830-prices2a-hotfix';
const SCRIPT=[
  "window.__RONA_MAIN_UI_ENTRY__=true;window.__RONA_UI_BUILD__="+JSON.stringify(BUILD)+";",
  c0,c1,c2,c3,c4,c5,cPriceArchitecture,c6,c7,c8,c9,c10,c11,c12,c13,c14,c15,c16,cPaintGuard,
  "window.__RONA_MAIN_UI_RUNTIME_LOADED__=true;"
].join('');

export async function onRequest(){
  return new Response(SCRIPT,{status:200,headers:{
    'content-type':'application/javascript; charset=utf-8',
    'cache-control':'no-store, no-cache, must-revalidate',
    'pragma':'no-cache',
    'expires':'0',
    'x-content-type-options':'nosniff',
    'x-rona-ui':'main-v2',
    'x-rona-ui-build':BUILD
  }});
}
