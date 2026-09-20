(()=>{'use strict';
  const MARK='RONA_CLIENT_ADMIN_IMPERSONATION_RETURN_V1';
  if(window.__RONA_CLIENT_ADMIN_IMPERSONATION_RETURN__===MARK)return;
  window.__RONA_CLIENT_ADMIN_IMPERSONATION_RETURN__=MARK;
  if(location.pathname!=='/portal/client')return;

  const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const session=String(new URLSearchParams(location.search).get('impSession')||'').trim();
  if(!UUID.test(session))return;

  const target='/portal/admin?accessView=companies';
  function install(){
    if(document.getElementById('ronaReturnAdmin'))return;
    const candidates=[...document.querySelectorAll('button,a')];
    const logout=candidates.find(x=>/^(выход|выйти|logout)$/i.test(String(x.textContent||'').trim()))
      ||document.querySelector('#logoutBtn,#ronaLogout,[data-action="logout"]');
    if(!logout)return;
    const button=document.createElement('button');
    button.id='ronaReturnAdmin';
    button.type='button';
    button.className=logout.className||'';
    button.textContent='Вернуться в раздел администратора';
    button.setAttribute('aria-label','Вернуться в раздел администратора');
    button.addEventListener('click',async event=>{
      event.preventDefault();
      button.disabled=true;
      try{
        await fetch('/portal/admin-authority/impersonation/end',{
          method:'POST',
          credentials:'same-origin',
          headers:{accept:'application/json','x-rona-impersonation-tab':session}
        });
      }finally{
        location.replace(target);
      }
    });
    logout.parentNode?.insertBefore(button,logout);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else queueMicrotask(install);
})();