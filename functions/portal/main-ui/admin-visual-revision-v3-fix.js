const ADMIN_VISUAL_REVISION_V3_FIX=String.raw`
(()=>{'use strict';
if(window.__RONA_ADMIN_VISUAL_REVISION_V3_FIX__)return;
if(location.pathname!=='/portal/admin')return;
window.__RONA_ADMIN_VISUAL_REVISION_V3_FIX__='20260912-v3.1';
const id='ronaAdminVisualRevisionV3FixStyle';if(document.getElementById(id))return;
const s=document.createElement('style');s.id=id;s.textContent=''
+'.rona-admin-redesign-v1.rona-admin-visual-v2.rona-admin-visual-v3 .rona-admin-v2-hero{border:1px solid rgba(210,236,248,.20)!important;background:linear-gradient(145deg,rgba(17,48,70,.50),rgba(4,23,38,.30))!important;-webkit-backdrop-filter:blur(16px) saturate(128%);backdrop-filter:blur(16px) saturate(128%);box-shadow:inset 0 1px 0 rgba(238,250,255,.14),inset 1px 0 0 rgba(167,226,247,.07),0 18px 50px rgba(0,8,18,.20),0 0 24px rgba(78,205,238,.035)!important}'
+'.rona-admin-redesign-v1.rona-admin-visual-v2.rona-admin-visual-v3 .rona-admin-v2-hero:after{background:linear-gradient(118deg,rgba(235,250,255,.075) 0%,rgba(122,221,246,.025) 28%,transparent 48%,rgba(205,241,251,.018) 72%,transparent 100%)!important;opacity:.78}'
+'.rona-admin-redesign-v1.rona-admin-visual-v2.rona-admin-visual-v3 #page-applications .rona-owner-table thead tr,.rona-admin-redesign-v1.rona-admin-visual-v2.rona-admin-visual-v3 #page-deals .rona-owner-table thead tr,.rona-admin-redesign-v1.rona-admin-visual-v2.rona-admin-visual-v3 #page-deals .rona-current-deal-table thead tr{background:rgba(8,32,49,.42)!important;-webkit-backdrop-filter:blur(10px) saturate(118%);backdrop-filter:blur(10px) saturate(118%);box-shadow:inset 0 1px 0 rgba(226,247,255,.07)!important}'
+'.rona-admin-redesign-v1.rona-admin-visual-v2.rona-admin-visual-v3 #page-applications .rona-owner-table thead th,.rona-admin-redesign-v1.rona-admin-visual-v2.rona-admin-visual-v3 #page-deals .rona-owner-table thead th,.rona-admin-redesign-v1.rona-admin-visual-v2.rona-admin-visual-v3 #page-deals .rona-current-deal-table thead th{background:transparent!important;border-top-color:rgba(190,228,244,.10)!important;border-bottom-color:rgba(190,228,244,.11)!important;color:rgba(214,236,246,.74)!important}'
+'.rona-admin-redesign-v1.rona-admin-visual-v2.rona-admin-visual-v3 #page-applications .rona-owner-table,.rona-admin-redesign-v1.rona-admin-visual-v2.rona-admin-visual-v3 #page-deals .rona-owner-table,.rona-admin-redesign-v1.rona-admin-visual-v2.rona-admin-visual-v3 #page-deals .rona-current-deal-table{background:transparent!important}'
+'.rona-admin-redesign-v1.rona-admin-visual-v2.rona-admin-visual-v3 #page-applications .rona-admin-v2-hero h1,.rona-admin-redesign-v1.rona-admin-visual-v2.rona-admin-visual-v3 #page-deals .rona-admin-v2-hero h1{color:#f7fdff!important;text-shadow:0 0 22px rgba(101,218,247,.08)!important}'
+'.rona-admin-redesign-v1.rona-admin-visual-v2.rona-admin-visual-v3 #page-applications .rona-admin-v2-hero p,.rona-admin-redesign-v1.rona-admin-visual-v2.rona-admin-visual-v3 #page-deals .rona-admin-v2-hero p{color:rgba(185,216,230,.68)!important}';
document.head.appendChild(s);
})();
`;
export default ADMIN_VISUAL_REVISION_V3_FIX;
