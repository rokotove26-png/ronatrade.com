(()=>{'use strict';
if(window.__RONA_ACCESS_FULL_VISIBILITY_GUARD__)return;
window.__RONA_ACCESS_FULL_VISIBILITY_GUARD__='20260826-v1';
const STYLE_ID='ronaAccessFullVisibilityGuardStyle';
function ensureStyle(){
  if(document.getElementById(STYLE_ID))return;
  const s=document.createElement('style');s.id=STYLE_ID;
  s.textContent='.rona-access-full label>span:first-child{display:block!important;visibility:visible!important;opacity:1!important;position:static!important;width:auto!important;height:auto!important;clip:auto!important;clip-path:none!important;overflow:visible!important;white-space:normal!important}.rona-access-full .rona-access-field-label{display:block!important;visibility:visible!important;opacity:1!important}';
  document.head.append(s);
}
function normalize(v){return String(v||'').replace(/\s+/g,' ').trim()}
function stabilize(root){
  if(!root||root.dataset.ronaAccessSemantics==='ready')return;
  ensureStyle();
  const labels=Array.from(root.querySelectorAll('label'));
  for(const label of labels){
    const control=label.querySelector('input,select,textarea');if(!control)continue;
    const span=label.querySelector('span');const text=normalize(span?.textContent||label.childNodes?.[0]?.textContent||'');
    if(span)span.classList.add('rona-access-field-label');
    if(text){control.setAttribute('aria-label',text);label.dataset.ronaAccessLabel=text;}
  }
  const grid=root.querySelector('.rona-access-full-grid');
  if(grid){
    const controls=Array.from(grid.querySelectorAll('input,select'));
    const expected=['Тип доступа','Ф.И.О.','Единый логин','Электронная почта','Телефон','Роль привязки'];
    controls.slice(0,expected.length).forEach((control,i)=>{
      const name=expected[i];control.dataset.ronaAccessField=['type','name','login','email','phone','binding'][i];control.setAttribute('aria-label',name);
      const label=control.closest('label');if(label){label.dataset.ronaAccessLabel=name;let span=label.querySelector('span');if(!span){span=document.createElement('span');label.prepend(span)}span.textContent=name;span.classList.add('rona-access-field-label')}
    });
  }
  root.dataset.ronaAccessSemantics='ready';
  window.__RONA_ACCESS_FULL_SEMANTICS_READY__=true;
}
function scan(){document.querySelectorAll('.rona-access-full').forEach(stabilize)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{scan();new MutationObserver(scan).observe(document.body,{childList:true,subtree:true})},{once:true});
else{scan();new MutationObserver(scan).observe(document.body,{childList:true,subtree:true})}
})();