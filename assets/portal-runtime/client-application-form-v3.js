(()=>{'use strict';
if(window.__RONA_CLIENT_APPLICATION_FORM_V3__)return;
window.__RONA_CLIENT_APPLICATION_FORM_V3__='20260828-cis-rail-reference-v4';

const API='/portal/api';
const COUNTRIES=Object.freeze(['Беларусь','Россия','Украина','Молдова','Азербайджан','Армения','Грузия','Казахстан','Кыргызстан','Узбекистан','Таджикистан','Туркменистан']);
const PRODUCER_BY_PRODUCT=new Map([
  ['АИ-92 К5','ОАО «Мозырский НПЗ»'],
  ['АИ-95 К5','ОАО «Мозырский НПЗ»'],
  ['ДТ сорт C К5','ОАО «Мозырский НПЗ»'],
  ['СУГ / СПБТ','ОАО «Мозырский НПЗ»'],
]);

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=v=>String(v??'').trim().toLocaleLowerCase('ru-RU').replaceAll('ё','е').replace(/\s+/g,' ');
const num=v=>{const n=Number(String(v??'').replace(',','.'));return Number.isFinite(n)?n:null};

function fmtDate(v){
  const m=String(v||'').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m?`${m[3]}.${m[2]}.${m[1]}`:String(v||'');
}
function periodText(item){return [fmtDate(item?.delivery_period_from),fmtDate(item?.delivery_period_to)].filter(Boolean).join('–')}
function priceText(item){
  const n=num(item?.price);
  const p=n===null?String(item?.price||'—'):new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(n);
  return `${p} ${String(item?.currency||'USD')}/т`;
}
function close(){document.getElementById('ronaClientApplicationV3')?.remove()}
function notify(message,bad=false){
  try{if(typeof window.toast==='function'){window.toast(message);return}}catch(_e){}
  let n=document.getElementById('ronaClientApplicationV3Notice');
  if(!n){
    n=document.createElement('div');
    n.id='ronaClientApplicationV3Notice';
    Object.assign(n.style,{position:'fixed',right:'22px',bottom:'22px',zIndex:'2147483647',maxWidth:'440px',padding:'12px 15px',borderRadius:'10px',font:'600 13px/1.45 Inter,Arial,sans-serif',boxShadow:'0 18px 50px rgba(0,0,0,.45)',color:'#f4f8fb'});
    document.body.appendChild(n);
  }
  n.style.background=bad?'#3a1b21':'#0d2631';
  n.style.border=bad?'1px solid rgba(255,120,130,.38)':'1px solid rgba(101,217,255,.34)';
  n.textContent=message;n.hidden=false;
  clearTimeout(notify.t);notify.t=setTimeout(()=>{n.hidden=true},4200);
}
async function request(path,init={}){
  const r=await fetch(API+path,{credentials:'same-origin',cache:'no-store',...init,headers:{accept:'application/json',...(init.headers||{})}});
  const j=await r.json().catch(()=>null);
  if(!r.ok||j?.ok===false)throw new Error(String(j?.code||j?.error?.code||('HTTP_'+r.status)));
  return j;
}

function field(label,name,value='',required=true,type='text',extra=''){
  return `<label class="rona-app-v3-field"><span>${label}${required?' <b>*</b>':''}</span><input name="${name}" type="${type}" value="${esc(value)}" ${required?'required':''} ${extra}></label>`;
}
function textarea(label,name,value='',required=true,rows=3,readonly=false){
  return `<label class="rona-app-v3-field rona-app-v3-wide"><span>${label}${required?' <b>*</b>':''}</span><textarea name="${name}" rows="${rows}" ${required?'required':''} ${readonly?'readonly':''}>${esc(value)}</textarea></label>`;
}
function readonlyRow(label,value){return `<div class="rona-app-v3-read"><span>${label}</span><strong>${esc(value||'—')}</strong></div>`}
function countrySelect(){
  return `<label class="rona-app-v3-field"><span>Страна назначения <b>*</b></span><select name="destination_country" required><option value="">Выберите страну</option>${COUNTRIES.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('')}</select></label>`;
}
function combo(label,inputName,placeholder,kind){
  return `<label class="rona-app-v3-field rona-app-v3-combo-wrap" data-combo="${kind}"><span>${label} <b>*</b></span><div class="rona-app-v3-combo"><input name="${inputName}" type="text" autocomplete="off" placeholder="${esc(placeholder)}" required aria-autocomplete="list" aria-expanded="false"><div class="rona-app-v3-dropdown" role="listbox" hidden></div></div></label>`;
}

function currentState(){return window.__RONA_CLIENT_PRICE_SYNC_STATE__||null}
function findItem(button){
  const state=currentState();if(!state)return null;
  const id=String(button?.dataset?.ronaPriceItem||'');
  return (state.prices||[]).find(x=>String(x.publication_item_id||'')===id)||null;
}
function producer(item){return PRODUCER_BY_PRODUCT.get(String(item?.product||'').trim())||String(item?.producer||'')||'—'}
function reference(){
  const r=window.__RONA_CIS_RAIL_REFERENCE__;
  return r&&Array.isArray(r.stations)&&r.stations.length>10000?r:null;
}

function searchRows(rows,query,limit=80){
  const q=norm(query);
  const digits=String(query||'').replace(/\D/g,'');
  const out=[];
  for(const s of rows){
    const name=norm(s[0]),code=String(s[1]||''),road=norm(s[2]),country=norm(s[3]);
    let score=0;
    if(!q&&!digits)score=1;
    else{
      if(digits&&code.startsWith(digits))score=120+(digits.length*2);
      else if(digits&&code.includes(digits))score=70+digits.length;
      if(q){
        if(name===q)score=Math.max(score,150);
        else if(name.startsWith(q))score=Math.max(score,110);
        else if(name.includes(q))score=Math.max(score,80);
        if(road.includes(q)||country.includes(q))score=Math.max(score,50);
      }
    }
    if(score)out.push([score,s]);
  }
  out.sort((a,b)=>b[0]-a[0]||a[1][0].localeCompare(b[1][0],'ru'));
  return out.slice(0,limit).map(x=>x[1]);
}

function wireCombo(form,kind,rows){
  const wrap=form.querySelector(`[data-combo="${kind}"]`);
  const input=wrap?.querySelector('input');
  const drop=wrap?.querySelector('.rona-app-v3-dropdown');
  if(!input||!drop)return null;
  const code=form.elements[kind==='station'?'destination_station_code':'border_station_code'];
  const road=form.elements[kind==='station'?'destination_station_road':'border_station_road'];
  const country=form.elements[kind==='station'?'destination_station_country':'border_station_country'];
  let active=-1,current=[];

  function clearMeta(){if(code)code.value='';if(road)road.value='';if(country)country.value=''}
  function hide(){drop.hidden=true;input.setAttribute('aria-expanded','false');active=-1}
  function paint(){Array.from(drop.children).forEach((el,i)=>el.classList.toggle('active',i===active))}
  function choose(s){
    input.value=s[0];
    if(code)code.value=s[1];
    if(road)road.value=s[2];
    if(country)country.value=s[3];
    hide();
    input.dispatchEvent(new Event('change',{bubbles:true}));
  }
  function render(){
    current=searchRows(rows,input.value,80);
    drop.innerHTML=current.length?current.map((s,i)=>`<button type="button" class="rona-app-v3-option" data-i="${i}" role="option"><strong>${esc(s[0])}</strong><span>${esc(s[3])} · ${esc(s[2])}</span><em>ЕСР ${esc(s[1])}</em></button>`).join(''):`<div class="rona-app-v3-empty">Совпадений не найдено</div>`;
    drop.hidden=false;input.setAttribute('aria-expanded','true');active=-1;
  }

  input.addEventListener('focus',render);
  input.addEventListener('input',()=>{clearMeta();render()});
  input.addEventListener('keydown',e=>{
    if(e.key==='ArrowDown'){e.preventDefault();if(drop.hidden)render();active=Math.min(active+1,current.length-1);paint()}
    else if(e.key==='ArrowUp'){e.preventDefault();active=Math.max(active-1,0);paint()}
    else if(e.key==='Enter'&&!drop.hidden&&active>=0){e.preventDefault();choose(current[active])}
    else if(e.key==='Escape'){hide()}
  });
  drop.addEventListener('pointerdown',e=>{
    const b=e.target.closest('button[data-i]');if(!b)return;
    e.preventDefault();const s=current[Number(b.dataset.i)];if(s)choose(s);
  });
  document.addEventListener('pointerdown',e=>{if(!wrap.contains(e.target))hide()},{capture:true});
  return {clear(){input.value='';clearMeta();hide()},choose,render};
}

function open(item,ctx){
  close();
  const ref=reference();
  if(!ref){notify('Справочник железнодорожных станций временно недоступен. Обновите страницу.',true);return}

  const overlay=document.createElement('div');
  overlay.id='ronaClientApplicationV3';
  overlay.className='rona-app-v3-overlay';
  const basis=String(item.basis||'');
  const consignee=String(ctx?.legal_name||ctx?.client_name||'');
  const address=String(ctx?.registered_address||'');
  const phone=String(ctx?.contact_phone||'');
  const statements=`Базис поставки ${basis}. Цена ${String(item.product||'')} — ${priceText(item)}.`;

  overlay.innerHTML=`<style>
#ronaClientApplicationV3{position:fixed;inset:0;z-index:2147483600;display:grid;place-items:center;padding:24px;background:rgba(2,7,12,.78);font-family:Inter,Arial,sans-serif;color:#f4f8fb}
#ronaClientApplicationV3 *{box-sizing:border-box}.rona-app-v3-panel{width:min(980px,calc(100vw - 32px));max-height:calc(100vh - 48px);overflow:auto;border:1px solid rgba(101,217,255,.22);border-radius:18px;padding:24px;background:linear-gradient(160deg,rgba(10,28,42,.99),rgba(5,14,23,.99));box-shadow:0 28px 90px rgba(0,0,0,.58)}
.rona-app-v3-kicker{font-size:10px;letter-spacing:.15em;text-transform:uppercase;color:#65d9ff;font-weight:850}.rona-app-v3-panel h2{margin:6px 0 4px;font-size:26px}.rona-app-v3-sub{color:#9eb3c1;margin-bottom:18px}.rona-app-v3-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:18px}.rona-app-v3-read{padding:10px 12px;border:1px solid rgba(132,196,224,.14);border-radius:10px;background:rgba(8,22,33,.55);min-width:0}.rona-app-v3-read span{display:block;color:#8fa8b6;font-size:10px;text-transform:uppercase;letter-spacing:.07em;margin-bottom:4px}.rona-app-v3-read strong{display:block;font-size:13px;line-height:1.35;overflow-wrap:anywhere}.rona-app-v3-section{margin:18px 0 8px;padding-top:14px;border-top:1px solid rgba(132,196,224,.12);font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#79dcff;font-weight:850}.rona-app-v3-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 14px}.rona-app-v3-field{display:grid;gap:6px;min-width:0;position:relative}.rona-app-v3-field>span{font-size:12px;color:#c6d5dc}.rona-app-v3-field b{color:#79dcff}.rona-app-v3-field input,.rona-app-v3-field textarea,.rona-app-v3-field select{width:100%;min-width:0;padding:11px 12px;border-radius:9px;border:1px solid rgba(145,194,216,.25);background:#081722;color:#fff;font:13px/1.4 Inter,Arial,sans-serif;outline:none}.rona-app-v3-field select{appearance:auto}.rona-app-v3-field textarea{resize:vertical}.rona-app-v3-field input:focus,.rona-app-v3-field textarea:focus,.rona-app-v3-field select:focus{border-color:rgba(101,217,255,.7);box-shadow:0 0 0 2px rgba(101,217,255,.10)}.rona-app-v3-field input[readonly]{color:#b9dce9;background:#07131c;cursor:default}.rona-app-v3-wide{grid-column:1/-1}.rona-app-v3-price-mode{display:flex;align-items:center;gap:9px;margin:12px 0;color:#d9e5ea}.rona-app-v3-combo{position:relative}.rona-app-v3-dropdown{position:absolute;left:0;right:0;top:calc(100% + 5px);z-index:15;max-height:290px;overflow:auto;padding:5px;border:1px solid rgba(101,217,255,.30);border-radius:10px;background:#07141e;box-shadow:0 18px 44px rgba(0,0,0,.56)}.rona-app-v3-option{width:100%;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 12px;text-align:left;padding:9px 10px;border:0;border-radius:7px;background:transparent;color:#eef7fa;cursor:pointer}.rona-app-v3-option strong{font-size:13px}.rona-app-v3-option span{grid-column:1;color:#8da9b6;font-size:11px}.rona-app-v3-option em{grid-column:2;grid-row:1/3;align-self:center;color:#65d9ff;font-size:11px;font-style:normal;white-space:nowrap}.rona-app-v3-option:hover,.rona-app-v3-option.active{background:rgba(65,188,232,.12);outline:1px solid rgba(101,217,255,.22)}.rona-app-v3-empty{padding:12px;color:#8da9b6;font-size:12px}.rona-app-v3-hint{font-size:10px;color:#76919e;margin-top:4px}.rona-app-v3-error{margin:12px 0;padding:10px 12px;border-radius:9px;background:#3a1b21;color:#ffdfe3}.rona-app-v3-actions{display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap;margin-top:20px}.rona-app-v3-actions button{min-height:42px;padding:10px 16px;border-radius:9px;cursor:pointer;font-weight:800}.rona-app-v3-cancel{border:1px solid rgba(255,255,255,.16);background:#0b1a25;color:#dbe9ef}.rona-app-v3-submit{border:1px solid rgba(101,217,255,.35);background:#123b4b;color:#fff}.rona-app-v3-submit:disabled{opacity:.55;cursor:wait}@media(max-width:760px){.rona-app-v3-summary,.rona-app-v3-grid{grid-template-columns:1fr}.rona-app-v3-wide{grid-column:auto}.rona-app-v3-panel{padding:18px}}
</style><form class="rona-app-v3-panel" autocomplete="off"><div class="rona-app-v3-kicker">RONA TRADE · ЗАЯВКА НА ПОСТАВКУ</div><h2>${esc(String(item.product||'Заявка'))}</h2><div class="rona-app-v3-sub">Заполняются реквизиты заявки, необходимые для дальнейшего договорного и железнодорожного оформления.</div><div class="rona-app-v3-summary">${readonlyRow('Наименование нефтепродукта',String(item.product||''))}${readonlyRow('Производитель',producer(item))}${readonlyRow('Период отгрузки',periodText(item))}${readonlyRow('Базис / цена',`${basis} · ${priceText(item)}`)}</div>
<div class="rona-app-v3-section">Товар и объём</div><div class="rona-app-v3-grid">${field('Объём, т','quantity','',true,'number','min="0.001" step="0.001" inputmode="decimal"')}${countrySelect()}<label class="rona-app-v3-price-mode rona-app-v3-wide"><input name="list_price" type="checkbox" checked><span>Цена по опубликованному прайс-листу</span></label><label class="rona-app-v3-field rona-app-v3-wide" data-proposed hidden><span>Предлагаемая цена, ${esc(String(item.currency||'USD'))}/т <b>*</b></span><input name="proposed_price" type="number" min="0.01" step="0.01" inputmode="decimal"></label></div>
<div class="rona-app-v3-section">Грузополучатель / Графа 4</div><div class="rona-app-v3-grid">${field('Грузополучатель','consignee_name',consignee,true)}${field('Код грузополучателя','consignee_code','',true)}${field('Почтовый адрес грузополучателя','consignee_address',address,true)}${field('Телефон грузополучателя','consignee_phone',phone,true,'tel')}</div>
<div class="rona-app-v3-section">Станция назначения / Графа 5</div><div class="rona-app-v3-grid">${combo('Станция назначения','destination_station','Поиск по всем станциям СНГ: название или 6-значный код ЕСР','station')}<label class="rona-app-v3-field"><span>Код станции ЕСР</span><input name="destination_station_code" type="text" readonly tabindex="-1" placeholder="Заполнится автоматически"></label><input name="destination_station_road" type="hidden"><input name="destination_station_country" type="hidden"><div class="rona-app-v3-hint rona-app-v3-wide">В списке — все ${Number(ref.station_count||ref.stations.length).toLocaleString('ru-RU')} станций и раздельных пунктов СНГ. После выбора станции код ЕСР и страна назначения заполняются автоматически.</div></div>
<div class="rona-app-v3-section">Особые заявления и отметки отправителя / Графа 2</div><div class="rona-app-v3-grid">${textarea('Особые заявления и отметки отправителя','special_statements',statements,true,3)}</div>
<div class="rona-app-v3-section">Пограничные станции переходов / Графа 6</div><div class="rona-app-v3-grid">${combo('Погранпереход','border_station','Поиск по всем ЖД-погранпереходам СНГ: название или код ЕСР','border')}<label class="rona-app-v3-field"><span>Код погранперехода ЕСР</span><input name="border_station_code" type="text" readonly tabindex="-1" placeholder="Заполнится автоматически"></label><input name="border_station_road" type="hidden"><input name="border_station_country" type="hidden"><div class="rona-app-v3-hint rona-app-v3-wide">В списке — экспортные и стыковые станции железнодорожных администраций СНГ из ТР №4, Книга 2, редакция ${esc(String(ref.as_of||'27.08.2026'))}.</div></div>
<div class="rona-app-v3-section">Уплата провозных платежей / Графа 23</div><div class="rona-app-v3-grid">${textarea('Условия уплаты провозных платежей','freight_payment_terms','Согласно условиям договора поставки',true,2)}</div>
<div class="rona-app-v3-section">Коммерческие условия</div><div class="rona-app-v3-grid">${textarea('Условия оплаты товара','payment_terms',String(item.payment_terms||''),true,2,true)}${textarea('Комментарий клиента','comment','',false,3)}</div><div class="rona-app-v3-error" data-error hidden></div><div class="rona-app-v3-actions"><button type="button" class="rona-app-v3-cancel" data-cancel>Отмена</button><button type="submit" class="rona-app-v3-submit">Подать заявку</button></div></form>`;

  document.body.appendChild(overlay);
  const form=overlay.querySelector('form');
  overlay.addEventListener('mousedown',e=>{if(e.target===overlay)close()});
  form.querySelector('[data-cancel]').addEventListener('click',close);

  const stationCombo=wireCombo(form,'station',ref.stations);
  wireCombo(form,'border',Array.isArray(ref.borders)?ref.borders:ref.stations.filter(s=>/эксп|стык/i.test(String(s[0]||''))));

  form.elements.destination_station.addEventListener('change',()=>{
    const stationCountry=String(form.elements.destination_station_country.value||'').trim();
    if(COUNTRIES.includes(stationCountry))form.elements.destination_country.value=stationCountry;
  });
  form.elements.destination_country.addEventListener('change',()=>{
    const stationCountry=String(form.elements.destination_station_country.value||'').trim();
    const selectedCountry=String(form.elements.destination_country.value||'').trim();
    if(stationCountry&&selectedCountry!==stationCountry)stationCombo?.clear();
  });

  const listPrice=form.elements.list_price;
  const proposedWrap=form.querySelector('[data-proposed]');
  listPrice.addEventListener('change',()=>{
    proposedWrap.hidden=listPrice.checked;
    form.elements.proposed_price.required=!listPrice.checked;
  });

  form.addEventListener('submit',async e=>{
    e.preventDefault();
    const error=form.querySelector('[data-error]');
    const submit=form.querySelector('.rona-app-v3-submit');
    error.hidden=true;

    const quantity=num(form.elements.quantity.value);
    if(!quantity||quantity<=0){error.textContent='Укажите объём больше нуля.';error.hidden=false;return}

    const destinationCountry=String(form.elements.destination_country.value||'').trim();
    if(!COUNTRIES.includes(destinationCountry)){error.textContent='Выберите страну назначения из списка.';error.hidden=false;return}

    const stationCode=String(form.elements.destination_station_code.value||'').trim();
    if(!stationCode){error.textContent='Выберите станцию назначения из справочника СНГ.';error.hidden=false;form.elements.destination_station.focus();return}
    if(String(form.elements.destination_station_country.value||'')!==destinationCountry){error.textContent='Страна назначения и выбранная станция не совпадают.';error.hidden=false;return}

    const borderCode=String(form.elements.border_station_code.value||'').trim();
    if(!borderCode){error.textContent='Выберите погранпереход из справочника СНГ.';error.hidden=false;form.elements.border_station.focus();return}

    const byList=listPrice.checked;
    const proposed=byList?null:num(form.elements.proposed_price.value);
    if(!byList&&(!proposed||proposed<=0)){error.textContent='Укажите предлагаемую цену.';error.hidden=false;return}

    submit.disabled=true;
    const key='PRICE-APP-'+(crypto.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random().toString(36).slice(2));
    try{
      const appResult=await request('/v1/client/applications',{
        method:'POST',
        headers:{'content-type':'application/json','x-idempotency-key':key},
        body:JSON.stringify({
          clientId:ctx.client_id,
          contractId:ctx.contract_id,
          publicationItemId:item.publication_item_id,
          quantityTonnes:quantity,
          priceMode:byList?'ACCEPT_PUBLISHED_PRICE':'CLIENT_PROPOSED_PRICE',
          proposedPrice:byList?null:proposed,
          proposedCurrency:byList?null:String(item.currency||'USD'),
          destinationCountry,
          destinationStation:String(form.elements.destination_station.value||'').trim(),
          deliveryPeriodFrom:item.delivery_period_from||null,
          deliveryPeriodTo:item.delivery_period_to||null,
          idempotencyKey:key
        })
      });

      const app=appResult?.application||appResult?.data||{};
      const applicationId=String(app.application_id||app.applicationId||'').trim();
      if(!applicationId)throw new Error('APPLICATION_ID_MISSING');

      const detailKey=key+'-DETAILS';
      const details={
        application_id:applicationId,
        message_type:'APPLICATION_DETAILS_V4',
        source:'CLIENT_PRICE_APPLICATION',
        reference:{source:'TR4_BOOK2',as_of:String(ref.as_of||''),station_count:Number(ref.station_count||ref.stations.length),border_count:Number(ref.border_count||ref.borders?.length||0)},
        product:String(item.product||''),
        producer:producer(item),
        quantity_tonnes:quantity,
        consignee:{
          name:String(form.elements.consignee_name.value||'').trim(),
          code:String(form.elements.consignee_code.value||'').trim(),
          postal_address:String(form.elements.consignee_address.value||'').trim(),
          phone:String(form.elements.consignee_phone.value||'').trim()
        },
        destination:{
          country:destinationCountry,
          station:String(form.elements.destination_station.value||'').trim(),
          station_code:stationCode,
          road:String(form.elements.destination_station_road.value||'').trim()
        },
        shipment:{period_from:item.delivery_period_from||null,period_to:item.delivery_period_to||null,basis},
        border_crossing:{
          station:String(form.elements.border_station.value||'').trim(),
          station_code:borderCode,
          road:String(form.elements.border_station_road.value||'').trim(),
          country:String(form.elements.border_station_country.value||'').trim()
        },
        railway:{
          special_statements:String(form.elements.special_statements.value||'').trim(),
          freight_payment_terms:String(form.elements.freight_payment_terms.value||'').trim()
        },
        commercial:{
          payment_terms:String(form.elements.payment_terms.value||'').trim(),
          price_mode:byList?'ACCEPT_PUBLISHED_PRICE':'CLIENT_PROPOSED_PRICE',
          published_price:num(item.price),
          proposed_price:proposed,
          currency:String(item.currency||'USD')
        },
        comment:String(form.elements.comment.value||'').trim()
      };

      await request('/v1/events',{
        method:'POST',
        headers:{'content-type':'application/json','x-idempotency-key':detailKey},
        body:JSON.stringify({
          role:'CLIENT',
          event_type:'CLIENT_MESSAGE_SUBMIT',
          authority_domain:'APPLICATION',
          authority_target_type:'APPLICATION',
          authority_target_id:applicationId,
          client_id:ctx.client_id,
          contract_id:ctx.contract_id,
          payload:details,
          idempotency_key:detailKey
        })
      });

      close();
      notify(`Заявка ${applicationId} подана.`);
      window.dispatchEvent(new CustomEvent('rona:client-application-submitted',{detail:{applicationId}}));
    }catch(err){
      error.textContent='Не удалось подать заявку: '+String(err?.message||'ошибка сервера');
      error.hidden=false;
    }finally{submit.disabled=false}
  });
}

document.addEventListener('click',e=>{
  const button=e.target?.closest?.('button[data-rona-price-item]');
  if(!button)return;
  const state=currentState();
  const item=findItem(button);
  const ctx=state?.context;
  if(!item||!ctx)return;
  e.preventDefault();
  e.stopImmediatePropagation();
  open(item,ctx);
},true);
})();
