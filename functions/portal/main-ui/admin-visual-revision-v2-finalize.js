const ADMIN_VISUAL_REVISION_V2_FINALIZE=String.raw`
(()=>{'use strict';
if(window.__RONA_ADMIN_VISUAL_REVISION_V2_FINALIZE__)return;
if(location.pathname!=='/portal/admin')return;
window.__RONA_ADMIN_VISUAL_REVISION_V2_FINALIZE__='20260912-v2.2';
const id='ronaAdminVisualRevisionV2FinalizeStyle';if(document.getElementById(id))return;
const s=document.createElement('style');s.id=id;s.textContent=''
+'.rona-admin-redesign-v1.rona-admin-visual-v2 #page-applications .rona-owner-table tbody td:first-child{font-size:15px!important;line-height:1.25!important;font-weight:950!important;color:#fff!important;letter-spacing:.01em!important;text-shadow:0 1px 0 rgba(255,255,255,.05),0 5px 14px rgba(0,0,0,.13)!important}'
+'.rona-admin-redesign-v1.rona-admin-visual-v2 #page-deals .rona-owner-table tbody td:first-child,.rona-admin-redesign-v1.rona-admin-visual-v2 #page-deals .rona-current-deal-table tbody td:first-child{font-size:15px!important;line-height:1.25!important;font-weight:950!important;color:#fff!important;letter-spacing:.01em!important;text-shadow:0 1px 0 rgba(255,255,255,.05),0 5px 14px rgba(0,0,0,.13)!important}'
+'@media(max-width:1440px){.rona-admin-redesign-v1.rona-admin-visual-v2 #page-applications .rona-owner-table tbody td:first-child,.rona-admin-redesign-v1.rona-admin-visual-v2 #page-deals .rona-owner-table tbody td:first-child,.rona-admin-redesign-v1.rona-admin-visual-v2 #page-deals .rona-current-deal-table tbody td:first-child{font-size:14px!important}}';
document.head.appendChild(s);
})();
`;
export default ADMIN_VISUAL_REVISION_V2_FINALIZE;
