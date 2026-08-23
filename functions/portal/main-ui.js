import c0 from './owner-ui-chunks/chunk0.js';
import c1 from './owner-ui-chunks/chunk1.js';
import c2 from './owner-ui-chunks/chunk2.js';
import c3 from './owner-ui-chunks/chunk3.js';
import c4 from './owner-ui-chunks/chunk4.js';
import c5 from './owner-ui-chunks/chunk5.js';
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

const BUILD='owner-main-v2-20260824-0124';
const RAW=[
  "window.__RONA_MAIN_UI_ENTRY__=true;window.__RONA_UI_BUILD__="+JSON.stringify(BUILD)+";",
  c0,c1,c2,c3,c4,c5,c6,c7,c8,c9,c10,c11,c12,c13,c14,c15,c16,
  "window.__RONA_MAIN_UI_RUNTIME_LOADED__=true;"
].join('');

const DEALS_SHELL="function isolateDealsShell(p){if(!p)return null;let host=q(':scope > .rona-owner-page-content[data-owner-page=\"deals\"]',p)||q(':scope > .rona-owner-page-content',p);for(const child of Array.from(p.children)){if(child===host)continue;child.classList.add('rona-owner-original-hidden');child.setAttribute('aria-hidden','true');child.style.setProperty('display','none','important')}if(host){host.classList.remove('rona-owner-original-hidden');host.removeAttribute('aria-hidden');host.style.removeProperty('display')}return host}function renderDealsCurrentShell(){const p=page('deals');if(!p)return;const ready=window.__RONA_DEALS_CURRENT_STATE__||document.documentElement.classList.contains('rona-deals-current-ready');if(!ready&&!q(':scope > .rona-owner-page-content[data-owner-page=\"deals\"]',p))replacePage('deals',card('Сделки',e('div',{class:'rona-owner-muted',text:'Загрузка актуальных данных…'})));isolateDealsShell(p)}\n";
const SCRIPT=RAW
  .replace('function renderOwnedAdminPage(id){',DEALS_SHELL+'function renderOwnedAdminPage(id){')
  .replace('deals:renderDeals,','deals:renderDealsCurrentShell,')
  .replace('renderAdminHome();renderPrices();renderApplications();renderDeals();renderDocuments();','renderAdminHome();renderPrices();renderApplications();renderDealsCurrentShell();renderDocuments();');

export async function onRequest(){
  return new Response(SCRIPT,{status:200,headers:{
    'content-type':'application/javascript; charset=utf-8',
    'cache-control':'no-store, no-cache, must-revalidate',
    'pragma':'no-cache',
    'expires':'0',
    'x-content-type-options':'nosniff',
    'x-rona-ui':'main-v2',
    'x-rona-ui-build':BUILD,
    'x-rona-deals-owner':'current-only-v1.4'
  }});
}
