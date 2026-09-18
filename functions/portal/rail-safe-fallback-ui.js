const SCRIPT=String.raw`(()=>{'use strict';
if(window.__RONA_RAIL_SAFE_FALLBACK__)return;
window.__RONA_RAIL_SAFE_FALLBACK__='20260918-direct-child-v2';
function q(s,r){return(r||document).querySelector(s)}
function el(tag,cls,text){var n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined&&text!==null)n.textContent=String(text);return n}
function hostFor(page){var h=q(':scope > .rona-owner-page-content',page);if(!h){h=el('div','rona-owner-page-content');h.setAttribute('data-owner-page','monitoring');page.append(h)}return h}
function table(rows){var w=el('div','rona-owner-table-wrap'),t=el('table','rona-owner-table'),thead=el('thead'),hr=el('tr'),tb=el('tbody');['ГУ-12','Сделка','Маршрут','Вагоны','Состояние'].forEach(function(h){hr.append(el('th','',h))});thead.append(hr);rows.forEach(function(r){var tr=el('tr');r.forEach(function(v){tr.append(el('td','',v))});tb.append(tr)});t.append(thead,tb);w.append(t);return w}
function render(){
  var page=q('#page-monitoring');if(!page)return;
  var host=hostFor(page),data=window.__RONA_OWNER_ADMIN_SNAPSHOT__||{},rail=Array.isArray(data.rail)?data.rail:[];
  var root=el('section','rona-owner-card');root.setAttribute('data-rail-current-root','ready');root.setAttribute('data-rail-safe-fallback','20260918-direct-child-v2');
  root.append(el('h2','','Онлайн ЖД'));
  root.append(el('div','rona-owner-muted','Основной интерфейс ЖД временно недоступен. Показаны только подтверждённые данные текущего Admin snapshot; движение вагонов не моделируется.'));
  if(rail.length){
    var rows=rail.map(function(x){var wagons=Array.isArray(x&&x.wagons)?x.wagons:[];return[
      x.gu12_number||x.document_number||x.rail_document_id||'—',
      x.deal_id||'—',
      x.route_text||'—',
      String(wagons.length),
      wagons.length?'Подтверждённые вагоны доступны':'Мониторинг вагонов не запущен'
    ]});
    root.append(table(rows))
  }else root.append(el('div','rona-owner-muted','Подтверждённые ГУ-12 отсутствуют.'));
  host.replaceChildren(root);
  Array.from(page.children).forEach(function(n){if(n===host)return;n.classList.add('rona-owner-original-hidden');n.setAttribute('aria-hidden','true')});
  page.classList.remove('rona-owner-hide');
  window.__RONA_RAIL_CURRENT_STATE__={version:'safe-fallback-v2',railCount:rail.length,source:'OWNER_ADMIN_SNAPSHOT',generatedAt:new Date().toISOString()}
}
window.__RONA_RAIL_CURRENT_REPAIR__=window.__RONA_RAIL_CURRENT_REPAIR__||render;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',render,{once:true});else render();
window.addEventListener('rona:admin-authority-refresh',render);
})();`;
export async function onRequest(){
  return new Response(SCRIPT,{status:200,headers:{
    'content-type':'application/javascript; charset=utf-8',
    'cache-control':'no-store, no-cache, must-revalidate',
    'pragma':'no-cache',
    'expires':'0',
    'x-content-type-options':'nosniff',
    'x-rona-rail-ui':'safe-fallback-direct-child-v2'
  }})
}
