const ADMIN_VISUAL_V4_FINALIZE=String.raw`
(()=>{'use strict';if(location.pathname!=='/portal/admin'||window.__RONA_ADMIN_VISUAL_V4_FINALIZE__)return;window.__RONA_ADMIN_VISUAL_V4_FINALIZE__='20260912-v4.2';
const id='ronaAdminVisualV4FinalizeStyle';if(!document.getElementById(id)){const s=document.createElement('style');s.id=id;s.textContent=''
+'.rona-admin-redesign-v1.rona-admin-visual-v2.rona-admin-visual-v3.rona-admin-visual-v4 .rona-admin-v4-page-hero{background:radial-gradient(620px 230px at 88% -24%,rgba(154,230,249,.055),transparent 66%),linear-gradient(145deg,rgba(19,52,73,.26),rgba(4,24,40,.11))!important}'
+'.rona-admin-redesign-v1.rona-admin-visual-v2.rona-admin-visual-v3.rona-admin-visual-v4 #ronaAdminV2HomeTitle{display:block!important;min-height:136px!important;padding:22px 24px!important;align-items:initial!important}'
+'.rona-admin-redesign-v1.rona-admin-visual-v2.rona-admin-visual-v3.rona-admin-visual-v4 #ronaAdminV2HomeTitle h1{margin:0!important;font-size:42px!important;line-height:.98!important;font-weight:950!important;letter-spacing:-.048em!important}'
+'.rona-admin-redesign-v1.rona-admin-visual-v2.rona-admin-visual-v3.rona-admin-visual-v4 .rona-admin-v4-home-eyebrow{position:relative;z-index:1;margin:0 0 9px;color:#63d8f6;font-size:10px;font-weight:900;letter-spacing:.17em;text-transform:uppercase}'
+'.rona-admin-redesign-v1.rona-admin-visual-v2.rona-admin-visual-v3.rona-admin-visual-v4 .rona-admin-v4-home-subtitle{position:relative;z-index:1;margin:12px 0 0;color:rgba(190,219,232,.72);font-size:13.5px;line-height:1.35}';document.head.appendChild(s)}
function syncHome(){const home=document.getElementById('ronaAdminV2HomeTitle');if(!home)return;home.classList.add('rona-admin-v2-hero','rona-admin-v4-page-hero');let eyebrow=home.querySelector('.rona-admin-v4-home-eyebrow');if(!eyebrow){eyebrow=document.createElement('div');eyebrow.className='rona-admin-v4-home-eyebrow';eyebrow.textContent='RONA TRADE · OPERATIONS';home.prepend(eyebrow)}let sub=home.querySelector('.rona-admin-v4-home-subtitle');if(!sub){sub=document.createElement('p');sub.className='rona-admin-v4-home-subtitle';sub.textContent='Операционный центр и актуальное состояние исполнения.';home.appendChild(sub)}}
syncHome();if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',syncHome,{once:true});window.addEventListener('rona:admin-pagechange',syncHome);const page=document.getElementById('page-home');if(page)new MutationObserver(syncHome).observe(page,{childList:true,subtree:true});
})();
`;
export default ADMIN_VISUAL_V4_FINALIZE;
