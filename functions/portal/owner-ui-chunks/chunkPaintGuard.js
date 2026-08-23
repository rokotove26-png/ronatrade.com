export default `
function ronaPrimaryUiFailVisible(reason){
  if(location.pathname!=='/portal/admin'||window.__RONA_OWNER_ADMIN_READY__===true)return;
  const code=String(reason||window.__RONA_OWNER_ADMIN_ERROR__||'PRIMARY_UI_TIMEOUT');
  window.__RONA_OWNER_ADMIN_ERROR__=code;
  for(const child of Array.from(document.body.children)){
    if(child.tagName==='SCRIPT'||child.tagName==='STYLE'||child.id==='ronaOwnerPrimaryUiFailure')continue;
    child.classList.add('rona-owner-original-hidden');
  }
  let host=q('#ronaOwnerPrimaryUiFailure');
  if(!host){
    host=e('section',{id:'ronaOwnerPrimaryUiFailure',class:'rona-owner-client-summary'});
    host.style.maxWidth='760px';host.style.marginTop='72px';
    host.append(card('Личный кабинет не загрузился',
      e('div',{class:'rona-fin-pill rona-fin-pill--danger',text:'Ошибка загрузки интерфейса или данных'}),
      e('p',{text:'Старый интерфейс не показан. Перезагрузите страницу. Если ошибка повторится, зафиксирован код: '+code}),
      e('div',{class:'rona-owner-muted',text:'UI build: '+String(window.__RONA_UI_BUILD__||'не загружен')})
    ));
    document.body.append(host);
  }
  document.documentElement.classList.add('rona-owner-paint-ready');
}
const __ronaRenderAdminBase=renderAdmin;
renderAdmin=function(){
  try{
    const out=__ronaRenderAdminBase();
    document.documentElement.classList.add('rona-owner-paint-ready');
    return out;
  }catch(err){
    ronaPrimaryUiFailVisible(err?.message||err);
    throw err;
  }
};
setTimeout(()=>{
  if(location.pathname==='/portal/admin'&&window.__RONA_OWNER_ADMIN_READY__!==true)ronaPrimaryUiFailVisible(window.__RONA_OWNER_ADMIN_ERROR__||'PRIMARY_UI_TIMEOUT');
},10000);
`;
