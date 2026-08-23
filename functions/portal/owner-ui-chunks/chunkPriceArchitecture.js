export default `
function ensureLkArchitectureV2Style(){
  if(q('#ronaLkArchitectureV2Style'))return;
  const s=e('style',{id:'ronaLkArchitectureV2Style'});
  s.textContent=\`.rona-fin-pill{justify-content:center!important;text-align:center!important;min-height:28px;box-sizing:border-box;vertical-align:middle}.rona-price-kpi-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.rona-price-kpi{min-height:126px;border-width:1px;border-style:solid}.rona-price-kpi--active{border-color:rgba(59,130,246,.44);background:rgba(59,130,246,.08)}.rona-price-kpi--published{border-color:rgba(34,197,94,.42);background:rgba(34,197,94,.08)}.rona-price-kpi--attention{border-color:rgba(245,158,11,.46);background:rgba(245,158,11,.09)}.rona-price-kpi-caption{margin-top:7px;font-size:12px;opacity:.72;font-weight:700}.rona-price-filter{display:flex;gap:8px;flex-wrap:wrap;margin:2px 0 14px}.rona-price-filter button{font:inherit;color:inherit;background:transparent;border:1px solid var(--line,rgba(255,255,255,.22));border-radius:999px;padding:8px 13px;cursor:pointer;font-weight:800}.rona-price-filter button[aria-pressed='true']{box-shadow:inset 0 0 0 1px currentColor}.rona-price-filter .is-all[aria-pressed='true']{background:rgba(59,130,246,.12);border-color:rgba(59,130,246,.5)}.rona-price-filter .is-published[aria-pressed='true']{background:rgba(34,197,94,.12);border-color:rgba(34,197,94,.5)}.rona-price-filter .is-verify[aria-pressed='true']{background:rgba(245,158,11,.13);border-color:rgba(245,158,11,.55)}.rona-price-table .rona-owner-table th:nth-child(n+4),.rona-price-table .rona-owner-table td:nth-child(n+4){text-align:center}.rona-price-value{font-weight:850;white-space:nowrap}.rona-price-meta-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.rona-price-meta-item{padding:12px;border:1px solid var(--line-soft,rgba(255,255,255,.12));border-radius:11px}.rona-price-meta-label{font-size:11px;opacity:.68;font-weight:800;text-transform:uppercase;letter-spacing:.03em}.rona-price-meta-value{margin-top:5px;font-weight:800}.rona-price-publish-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.rona-price-publish-row select,.rona-price-publish-row button{font:inherit;color:inherit;background:transparent;border:1px solid var(--line,rgba(255,255,255,.22));border-radius:9px;padding:9px 11px}.rona-price-publish-row button{cursor:pointer;font-weight:800}.rona-price-publish-status{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.rona-price-note{margin-top:9px;font-size:12px;opacity:.72}@media(max-width:900px){.rona-price-kpi-grid,.rona-price-meta-grid{grid-template-columns:1fr}}\`;
  document.head.appendChild(s);
}
function priceKpiCard(title,value,caption,tone){
  const c=card(title,e('div',{class:'rona-owner-kpi',text:value}),caption?e('div',{class:'rona-price-kpi-caption',text:caption}):null);
  c.classList.add('rona-price-kpi','rona-price-kpi--'+tone);
  return c;
}
function priceStationKey(v){
  const s=String(v||'').trim().toUpperCase();
  if(s.includes('ОЗИН'))return 'OZINKI';
  if(s.includes('САРЫ'))return 'SARYAGASH';
  if(s.includes('НАУШ'))return 'NAUSHKI';
  return '';
}
function pricePeriod(rows){
  const t=String((rows||[]).find(x=>x&&x.commercial_terms)?.commercial_terms||'');
  const m=t.match(/Период поставки:\s*([^;]+)/i);
  return m?m[1].trim():'Требует подтверждения';
}
function groupedPrices(rows){
  const map=new Map();
  for(const p of rows||[]){
    const product=String(p.product||'').trim()||'Без наименования';
    if(!map.has(product))map.set(product,{product,rows:[],producerSet:new Set(),supplierSet:new Set(),stations:{},published:true});
    const g=map.get(product);g.rows.push(p);
    if(String(p.producer||'').trim())g.producerSet.add(String(p.producer).trim());
    if(String(p.supplier||'').trim())g.supplierSet.add(String(p.supplier).trim());
    const k=priceStationKey(p.final_station||p.basis||p.border_crossing);if(k)g.stations[k]=p;
    if(String(p.business_status||'').toUpperCase()!=='PUBLISHED')g.published=false;
  }
  return Array.from(map.values()).map(g=>{
    g.producer=g.producerSet.size===1?Array.from(g.producerSet)[0]:null;
    g.supplier=g.supplierSet.size===1?Array.from(g.supplierSet)[0]:null;
    g.needsVerify=!g.producer||!g.supplier;
    return g;
  });
}
function priceCell(p){return p?e('span',{class:'rona-price-value',text:money(p.sale_price,(p.currency||'USD')+'/т')}):financePill('Не сформировано','neutral')}
let ownerPriceFilter='ALL';
renderPrices=function(){
  ensureLkArchitectureV2Style();
  const rows=Array.isArray(adminData?.prices)?adminData.prices:[];
  if(!rows.length){replacePage('prices',card('Цены',e('div',{class:'rona-owner-muted',text:'Согласованные цены из authoritative контура пока не сформированы.'})));return}
  const groups=groupedPrices(rows),publishedRows=rows.filter(x=>String(x.business_status||'').toUpperCase()==='PUBLISHED'),verifyGroups=groups.filter(x=>x.needsVerify),period=pricePeriod(rows),allClient=rows.every(x=>x.publish_client===true),allAgent=rows.every(x=>x.publish_agent===true);
  const kpi=e('div',{class:'rona-owner-grid rona-price-kpi-grid'});
  kpi.append(
    priceKpiCard('Действующий прайс',period,'USD/т · CPT · Incoterms 2020','active'),
    priceKpiCard('Позиций опубликовано',String(publishedRows.length),allClient&&allAgent?'Клиентам и агентам':allClient?'Клиентам':allAgent?'Агентам':'Аудитория требует проверки','published'),
    priceKpiCard('Требует обновления',verifyGroups.length?verifyGroups.length+' товара':'0','Производитель / поставщик — только по подтверждённым данным','attention')
  );
  const filter=e('div',{class:'rona-price-filter'});
  [['ALL','Все','is-all'],['PUBLISHED','Опубликовано','is-published'],['VERIFY','Требует подтверждения','is-verify']].forEach(([v,t,cls])=>filter.append(e('button',{type:'button',class:cls,'aria-pressed':String(ownerPriceFilter===v),text:t,onclick:()=>{ownerPriceFilter=v;renderPrices()}})));
  const visible=groups.filter(g=>ownerPriceFilter==='VERIFY'?g.needsVerify:ownerPriceFilter==='PUBLISHED'?g.published:true);
  const tableRows=visible.map(g=>[
    e('strong',{text:g.product}),
    g.producer||financePill('Требует подтверждения','warn'),
    g.supplier||financePill('Требует подтверждения','warn'),
    priceCell(g.stations.OZINKI),priceCell(g.stations.SARYAGASH),priceCell(g.stations.NAUSHKI)
  ]);
  const matrix=card('Действующие цены',tableRows.length?tbl(['Продукт','Производитель','Поставщик','CPT Ozinki','CPT Saryagash','CPT Naushki'],tableRows):e('div',{class:'rona-owner-muted',text:'По выбранному фильтру позиций нет.'}));
  matrix.classList.add('rona-price-table');
  const paymentTerms=String(rows.find(x=>String(x.payment_terms||'').trim())?.payment_terms||'Требует подтверждения');
  const terms=card('Условия прайса',e('div',{class:'rona-price-meta-grid'},
    e('div',{class:'rona-price-meta-item'},e('div',{class:'rona-price-meta-label',text:'Период'}),e('div',{class:'rona-price-meta-value',text:period})),
    e('div',{class:'rona-price-meta-item'},e('div',{class:'rona-price-meta-label',text:'Базис'}),e('div',{class:'rona-price-meta-value',text:'CPT · Incoterms 2020'})),
    e('div',{class:'rona-price-meta-item'},e('div',{class:'rona-price-meta-label',text:'Единица цены'}),e('div',{class:'rona-price-meta-value',text:'USD / тонна'}))
  ),e('div',{class:'rona-price-note',text:paymentTerms}));
  const audience=e('select');
  [['BOTH','Клиенты и агенты'],['CLIENTS','Только клиенты'],['AGENTS','Только агенты'],['NONE','Снять публикацию']].forEach(([v,t])=>audience.append(e('option',{value:v,text:t})));
  audience.value=allClient&&allAgent?'BOTH':allClient?'CLIENTS':allAgent?'AGENTS':'NONE';
  const publishButton=e('button',{type:'button',text:'Применить публикацию',onclick:async()=>{
    const client=audience.value==='BOTH'||audience.value==='CLIENTS',agent=audience.value==='BOTH'||audience.value==='AGENTS';
    publishButton.disabled=true;publishButton.textContent='Сохраняю…';
    try{for(const p of rows)await post('/admin/prices/'+encodeURIComponent(p.id)+'/publication',{client,agent});await refreshAdmin();await notify('Публикация прайса обновлена.')}catch(err){await notify(err.code||err.message,'Ошибка')}finally{publishButton.disabled=false;publishButton.textContent='Применить публикацию'}
  }});
  const pubStatus=e('div',{class:'rona-price-publish-status'},financePill('Клиенты · '+(allClient?'опубликовано':'не опубликовано'),allClient?'success':'neutral'),financePill('Агенты · '+(allAgent?'опубликовано':'не опубликовано'),allAgent?'success':'neutral'));
  const lastPublished=rows.map(x=>x.published_at).filter(Boolean).sort().pop();
  const publication=card('Публикация прайса',pubStatus,e('div',{class:'rona-price-publish-row'},e('span',{text:'Аудитория'}),audience,publishButton),e('div',{class:'rona-price-note',text:'Публикация применяется ко всей выбранной аудитории. Индивидуальная адресация не имитируется без отдельного authoritative механизма.'}),lastPublished?e('div',{class:'rona-price-note',text:'Последняя подтверждённая публикация: '+date(lastPublished)}):null);
  replacePage('prices',e('div',{},kpi,filter,matrix,terms,publication));
};
ensureLkArchitectureV2Style();
`;
