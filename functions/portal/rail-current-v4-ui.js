const SCRIPT=String.raw`(function(){
'use strict';
if(window.__RONA_RAIL_CURRENT_V4__)return;
window.__RONA_RAIL_CURRENT_V4__='20260824-0252-v4';
var API='/portal/owner-api',snapshot=null,selected='ALL',timer=null,matrixNode=null;
function q(s,r){return(r||document).querySelector(s)}
function qa(s,r){return Array.from((r||document).querySelectorAll(s))}
function el(tag,cls,text){var n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined&&text!==null)n.textContent=String(text);return n}
function fmtDate(v,withTime){if(!v)return '—';var d=new Date(v);if(Number.isNaN(d.getTime()))return '—';return withTime?d.toLocaleString('ru-RU'):d.toLocaleDateString('ru-RU')}
function api(path){return fetch(API+'?path='+encodeURIComponent(path),{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}}).then(function(r){return r.json().catch(function(){return{}}).then(function(j){if(!r.ok||j&&j.ok===false)throw new Error(String(j&&j.code||'HTTP_'+r.status));return j&&j.data||{}})})}
function pill(text,tone){return el('span','rona-rail-v4-pill rona-rail-v4-pill--'+(tone||'neutral'),text)}
function card(title,extra){var c=el('section','rona-owner-card rona-rail-v4-card'+(extra?' '+extra:''));if(title)c.append(el('h2','',title));return c}
function ensureStyle(){if(q('#ronaRailV4Style'))return;var s=el('style');s.id='ronaRailV4Style';s.textContent=[
'#page-monitoring{width:100%!important;max-width:none!important}',
'#page-monitoring>.rona-owner-page-content{width:100%!important;max-width:none!important}',
'.rona-rail-v4-root{display:grid;gap:16px;width:100%}',
'.rona-rail-v4-hero{margin:0!important}',
'.rona-rail-v4-work{display:grid;grid-template-columns:minmax(300px,.72fr) minmax(620px,1.75fr);gap:16px;align-items:start}',
'.rona-rail-v4-left{display:grid;gap:16px;min-width:0}',
'.rona-rail-v4-card{margin:0!important;box-sizing:border-box}',
'.rona-rail-v4-card h2{margin:0 0 12px}',
'.rona-rail-v4-kpis{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}',
'.rona-rail-v4-kpi{padding:13px 14px;border:1px solid rgba(145,185,209,.14);border-radius:14px;background:rgba(6,11,17,.34)}',
'.rona-rail-v4-kpi span{display:block;font-size:11px;opacity:.7}',
'.rona-rail-v4-kpi strong{display:block;margin-top:7px;font-size:25px;line-height:1}',
'.rona-rail-v4-filters{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}',
'.rona-rail-v4-filter{font:inherit;color:inherit;background:rgba(6,11,17,.36);border:1px solid var(--line,rgba(255,255,255,.22));border-radius:999px;padding:8px 12px;cursor:pointer;font-weight:800}',
'.rona-rail-v4-filter[aria-pressed=true]{background:rgba(59,130,246,.15);border-color:rgba(89,215,255,.42)}',
'.rona-rail-v4-banner{margin-top:12px;padding:11px 12px;border-radius:12px;border:1px solid rgba(245,158,11,.32);background:rgba(245,158,11,.07);font-size:12px;line-height:1.45}',
'.rona-rail-v4-table-wrap{width:100%;overflow:auto;border:1px solid rgba(145,185,209,.10);border-radius:14px;background:rgba(6,11,17,.28)}',
'.rona-rail-v4-table{width:100%;border-collapse:collapse;font-size:12px}',
'.rona-rail-v4-table th,.rona-rail-v4-table td{padding:10px 9px;border-bottom:1px solid rgba(255,255,255,.10);text-align:center;vertical-align:middle}',
'.rona-rail-v4-table th{font-size:10px;letter-spacing:.05em;text-transform:uppercase;opacity:.72;white-space:nowrap}',
'.rona-rail-v4-pill{display:inline-flex;align-items:center;padding:4px 9px;border-radius:999px;font-size:11px;font-weight:800;border:1px solid rgba(148,163,184,.25)}',
'.rona-rail-v4-pill--success{color:#4ce1b8;border-color:rgba(34,197,94,.28);background:rgba(34,197,94,.09)}',
'.rona-rail-v4-pill--warn{color:#ffc76b;border-color:rgba(245,158,11,.30);background:rgba(245,158,11,.09)}',
'.rona-rail-v4-pill--info{color:#8ee8ff;border-color:rgba(59,130,246,.28);background:rgba(59,130,246,.09)}',
'.rona-rail-v4-map{position:relative;overflow:hidden;min-height:350px;margin-bottom:14px;border:1px solid rgba(89,215,255,.14);border-radius:18px;background:radial-gradient(520px 260px at 58% 45%,rgba(41,100,145,.16),transparent 70%),linear-gradient(180deg,rgba(5,12,20,.86),rgba(6,13,20,.60))}',
'.rona-rail-v4-map::after{content:"";position:absolute;inset:0;pointer-events:none;background-image:linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px);background-size:32px 32px}',
'.rona-rail-v4-map-title{position:absolute;z-index:2;left:16px;top:14px;font-size:12px;font-weight:900;letter-spacing:.06em;text-transform:uppercase}',
'.rona-rail-v4-map-badge{position:absolute;z-index:2;right:14px;top:12px}',
'.rona-rail-v4-map-canvas{position:absolute;inset:42px 10px 48px;display:grid;place-items:center}',
'.rona-rail-v4-map-canvas svg{width:100%;height:100%;max-height:270px}',
'.rona-rail-v4-map-note{position:absolute;z-index:2;left:16px;right:16px;bottom:13px;font-size:11px;line-height:1.4;opacity:.72}',
'.rona-rail-v4-map [data-country]{fill:rgba(81,139,174,.11);stroke:rgba(121,202,237,.38);stroke-width:1.3;vector-effect:non-scaling-stroke}',
'.rona-rail-v4-map [data-country=KZ],.rona-rail-v4-map [data-country=UZ],.rona-rail-v4-map [data-country=KG]{fill:rgba(76,225,184,.08);stroke:rgba(76,225,184,.42)}',
'.rona-rail-v4-map text{fill:rgba(221,238,247,.66);font:700 14px Inter,Arial,sans-serif}',
'.rona-rail-v4-empty{padding:18px;border:1px dashed rgba(145,185,209,.18);border-radius:14px;font-size:12px;opacity:.72}',
'.rona-rail-v4-loading{min-height:220px;display:grid;place-items:center}',
'@media(max-width:1040px){.rona-rail-v4-work{grid-template-columns:1fr}.rona-rail-v4-map{min-height:300px}}',
'@media(max-width:680px){.rona-rail-v4-kpis{grid-template-columns:1fr 1fr}.rona-rail-v4-card{padding:14px!important}}'
].join('');document.head.appendChild(s)}
function getHost(page){var host=q(':scope > .rona-owner-page-content',page);if(!host){host=el('div','rona-owner-page-content');host.setAttribute('data-owner-page','monitoring');page.append(host)}return host}
function isolate(page,host){Array.from(page.children).forEach(function(n){if(n===host)return;n.classList.add('rona-owner-original-hidden');n.setAttribute('aria-hidden','true')})}
function findMatrix(page){if(matrixNode&&document.documentElement.contains(matrixNode))return matrixNode;var hs=qa('h1,h2,h3,h4,h5,.section-title,.card-title',page);for(var i=0;i<hs.length;i++){var t=String(hs[i].textContent||'').replace(/\s+/g,' ').trim().toLowerCase();if(t.indexOf('матриц')>=0&&t.indexOf('тариф')>=0){var n=hs[i].closest('section,.rona-owner-card,.card,.panel,[data-section]')||hs[i].parentElement;if(n&&n!==page){matrixNode=n;return n}}}return null}
function table(headers,rows){var w=el('div','rona-rail-v4-table-wrap'),t=el('table','rona-rail-v4-table'),th=el('thead'),hr=el('tr'),tb=el('tbody');headers.forEach(function(h){hr.append(el('th','',h))});th.append(hr);rows.forEach(function(r){var tr=el('tr');r.forEach(function(v){var td=el('td');if(v instanceof Node)td.append(v);else td.textContent=v===null||v===undefined||v===''?'—':String(v);tr.append(td)});tb.append(tr)});t.append(th,tb);w.append(t);return w}
function filterBtn(text,pressed,fn){var b=el('button','rona-rail-v4-filter',text);b.type='button';b.setAttribute('aria-pressed',pressed?'true':'false');b.onclick=fn;return b}
function docKey(x){return String(x&&x.gu12_number||x&&x.document_number||x&&x.rail_document_id||'')}
function status(x,exchange){var ws=Array.isArray(x&&x.wagons)?x.wagons:[];if(Number(exchange&&exchange.active_targets||0)===0)return pill('Мониторинг не запущен','warn');if(!ws.length)return pill('Вагоны не зарегистрированы','warn');if(ws.some(function(w){return !w.lastPositionAt}))return pill('Ожидаются позиции','warn');return pill('Позиции получены','success')}
function mapSvg(){return '<svg viewBox="0 0 920 340" role="img" aria-label="Карта СНГ"><path data-country="RU" d="M180 56 L254 30 L365 41 L452 24 L560 43 L663 28 L784 62 L846 99 L824 135 L747 151 L676 139 L610 166 L518 145 L435 168 L349 139 L276 151 L207 122 Z"></path><path data-country="BY" d="M118 123 L172 111 L202 139 L179 168 L126 163 L101 143 Z"></path><path data-country="KZ" d="M317 178 L399 157 L487 176 L562 161 L650 186 L677 226 L630 252 L548 246 L489 267 L409 247 L344 255 L298 222 Z"></path><path data-country="UZ" d="M423 258 L484 249 L525 270 L505 300 L449 306 L405 286 Z"></path><path data-country="KG" d="M526 269 L575 262 L602 284 L575 305 L527 297 Z"></path><path data-country="TJ" d="M577 307 L620 296 L648 316 L617 332 L578 328 Z"></path><path data-country="TM" d="M356 280 L405 278 L432 306 L401 329 L348 321 L329 302 Z"></path><text x="450" y="92">Россия</text><text x="433" y="218">Казахстан</text><text x="441" y="287">Узбекистан</text><text x="530" y="290">Кыргызстан</text><text x="112" y="146">Беларусь</text></svg>'}
function mapPanel(exchange,wagons){var box=el('div','rona-rail-v4-map');box.append(el('div','rona-rail-v4-map-title','Карта СНГ'));var badge=el('div','rona-rail-v4-map-badge');badge.append(Number(exchange&&exchange.active_targets||0)>0?pill('Контур активен','success'):pill('Ожидает мониторинг','info'));box.append(badge);var c=el('div','rona-rail-v4-map-canvas');c.innerHTML=mapSvg();box.append(c);var live=wagons.filter(function(w){return w&&w.lastPositionAt}).length;box.append(el('div','rona-rail-v4-map-note',live?'Подтверждённые позиции: '+live+'. Маркеры движения появятся после подключения доверенных координат.':'Карта подготовлена под будущий интерактивный мониторинг вагонов.'));return box}
function shell(){var root=el('div','rona-rail-v4-root');root.setAttribute('data-rail-current-v4','loading');var hero=el('div','rona-visual-hero rona-rail-v4-hero'),copy=el('div');copy.append(el('div','rona-visual-kicker','Железнодорожный контур'),el('div','rona-visual-title','Онлайн ЖД'),el('div','rona-visual-sub','Загрузка актуального состояния…'));hero.append(copy);root.append(hero);var c=card('', 'rona-rail-v4-loading');c.append(el('div','rona-owner-muted','Получаем актуальные ГУ-12 и позиции вагонов.'));root.append(c);return root}
function renderShell(){ensureStyle();var page=q('#page-monitoring');if(!page)return;var host=getHost(page),matrix=findMatrix(page);host.replaceChildren(shell());if(matrix)host.append(matrix);isolate(page,host);page.classList.remove('rona-owner-hide')}
function render(data){ensureStyle();var page=q('#page-monitoring');if(!page)return;var host=getHost(page),matrix=findMatrix(page),rail=Array.isArray(data&&data.rail)?data.rail:[],exchange=data&&data.exchange||{},wagons=[];rail.forEach(function(x){(Array.isArray(x&&x.wagons)?x.wagons:[]).forEach(function(w){wagons.push(w)})});var visible=selected==='ALL'?rail:rail.filter(function(x){return docKey(x)===selected}),chosen=visible[0]||rail[0]||null,active=Number(exchange.active_targets||0),attention=Number(exchange.conflicts||0)+wagons.filter(function(w){return !w.lastPositionAt}).length;
var root=el('div','rona-rail-v4-root');root.setAttribute('data-rail-current-v4','ready');var hero=el('div','rona-visual-hero rona-rail-v4-hero'),copy=el('div');copy.append(el('div','rona-visual-kicker','Железнодорожный контур'),el('div','rona-visual-title','Онлайн ЖД'),el('div','rona-visual-sub','ГУ-12, позиции вагонов и рабочее пространство мониторинга.'));hero.append(copy);root.append(hero);
var work=el('div','rona-rail-v4-work'),left=el('div','rona-rail-v4-left'),control=card('ЖД-контур'),kg=el('div','rona-rail-v4-kpis');[['ГУ-12',rail.length],['Вагоны',wagons.length],['Активный мониторинг',active],['Требуют внимания',attention]].forEach(function(p){var k=el('div','rona-rail-v4-kpi');k.append(el('span','',p[0]),el('strong','',p[1]));kg.append(k)});control.append(kg);var filters=el('div','rona-rail-v4-filters');filters.append(filterBtn('Все ГУ-12',selected==='ALL',function(){selected='ALL';render(snapshot||data)}));rail.forEach(function(x){var key=docKey(x);filters.append(filterBtn('ГУ-12 '+(key||'—'),selected===key,function(){selected=key;render(snapshot||data)}))});control.append(filters);if(active===0)control.append(el('div','rona-rail-v4-banner','Онлайн-мониторинг пока не запущен. Показываются подтверждённые ЖД-документы и фактически зарегистрированные позиции.'));left.append(control);
var rows=visible.map(function(x){var ws=Array.isArray(x&&x.wagons)?x.wagons:[];return[x.gu12_number||x.document_number||x.rail_document_id||'—',x.deal_id||'—',x.route_text||'—',String(ws.length),status(x,exchange)]}),ops=card('Операционная картина ЖД');ops.append(rows.length?table(['ГУ-12','Сделка','Маршрут','Вагоны','Статус'],rows):el('div','rona-rail-v4-empty','Подтверждённые ГУ-12 отсутствуют.'));left.append(ops);
var pos=card('Позиции вагонов'),chosenW=chosen&&Array.isArray(chosen.wagons)?chosen.wagons:[];pos.append(mapPanel(exchange,chosenW));if(chosenW.length)pos.append(table(['Вагон','Текущая станция','Код','Операция','Статус','Последнее обновление'],chosenW.map(function(w){return[w.wagonNumber||'—',w.station||'—',w.stationCode||'—',w.operation||'—',w.status||'—',fmtDate(w.lastPositionAt,true)]})));else pos.append(el('div','rona-rail-v4-empty','По выбранной ГУ-12 подтверждённые вагоны пока не зарегистрированы.'));
work.append(left,pos);root.append(work);host.replaceChildren(root);if(matrix)host.append(matrix);isolate(page,host);page.classList.remove('rona-owner-hide');document.documentElement.classList.add('rona-rail-v4-ready');window.__RONA_RAIL_CURRENT_STATE__={version:'v4',generatedAt:new Date().toISOString(),railCount:rail.length,wagonCount:wagons.length,monitoringTargets:active,tariffMatrixPreserved:!!matrix}}
function paint(){if(snapshot)render(snapshot);else renderShell()}
async function sync(){try{snapshot=await api('/admin/bootstrap');window.__RONA_RAIL_CURRENT_V4_SNAPSHOT__=snapshot;render(snapshot);window.__RONA_RAIL_CURRENT_V4_ERROR__=null}catch(e){window.__RONA_RAIL_CURRENT_V4_ERROR__=String(e&&e.message||e);if(!snapshot)renderShell()}}
function bind(){var nav=q('#nav button[data-page="monitoring"]');if(!nav||nav.__ronaRailV4Bound)return;nav.__ronaRailV4Bound=true;nav.addEventListener('click',function(){setTimeout(paint,0);setTimeout(paint,120);setTimeout(function(){sync()},350)})}
function start(){ensureStyle();snapshot=window.__RONA_OWNER_ADMIN_SNAPSHOT__||null;paint();bind();sync();[180,700,1600].forEach(function(ms){setTimeout(function(){bind();paint()},ms)});timer=setInterval(sync,30000)}
if(location.pathname==='/portal/admin'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start()}
})();`;
export async function onRequest(){return new Response(SCRIPT,{status:200,headers:{'content-type':'application/javascript; charset=utf-8','cache-control':'no-store, no-cache, must-revalidate','pragma':'no-cache','expires':'0','x-content-type-options':'nosniff','x-rona-rail-ui':'current-v4'}})}
