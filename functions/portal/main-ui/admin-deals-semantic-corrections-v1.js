const ADMIN_DEALS_SEMANTIC_CORRECTIONS_V1=String.raw`
(()=>{'use strict';
if(window.__RONA_ADMIN_DEALS_SEMANTIC_CORRECTIONS_V1__)return;
if(location.pathname!=='/portal/admin')return;
window.__RONA_ADMIN_DEALS_SEMANTIC_CORRECTIONS_V1__='20260914-column-map-v1';
const id='ronaAdminDealsSemanticCorrectionsV1Style';
if(document.getElementById(id))return;
const s=document.createElement('style');s.id=id;s.textContent=[
'html.rona-deals-premium-v1 #page-deals .rona-deal-filter{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:12px!important;padding:11px 12px!important;border:1px solid rgba(130,210,247,.18)!important;border-radius:16px!important;background:linear-gradient(180deg,rgba(8,24,38,.90),rgba(3,13,22,.82))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.05),0 16px 36px rgba(0,0,0,.22)!important}',
'html.rona-deals-premium-v1 #page-deals .rona-deal-filter button{min-height:50px!important;padding:0 18px 0 40px!important;border-radius:14px!important;font-size:12.5px!important;border-color:color-mix(in srgb,var(--sb-accent) 42%,transparent)!important;background:linear-gradient(180deg,color-mix(in srgb,var(--sb-accent) 16%,rgba(15,37,54,.98)),rgba(5,17,28,.98))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 10px 24px rgba(0,0,0,.24)!important}',
'html.rona-deals-premium-v1 #page-deals .rona-deal-filter button::before{width:8px!important;height:8px!important;box-shadow:0 0 0 4px color-mix(in srgb,var(--sb-accent) 13%,transparent),0 0 17px color-mix(in srgb,var(--sb-accent) 72%,transparent)!important}',
'html.rona-deals-premium-v1 #page-deals .rona-deal-filter button:hover{transform:translateY(-2px);border-color:color-mix(in srgb,var(--sb-accent) 72%,transparent)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.10),0 14px 30px rgba(0,0,0,.30),0 0 22px color-mix(in srgb,var(--sb-accent) 12%,transparent)!important}',
'html.rona-deals-premium-v1 #page-deals .rona-deal-filter button[aria-pressed="true"]{border-color:color-mix(in srgb,var(--sb-accent) 84%,transparent)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.12),inset 0 0 0 1px color-mix(in srgb,var(--sb-accent) 32%,transparent),0 13px 30px rgba(0,0,0,.28),0 0 26px color-mix(in srgb,var(--sb-accent) 16%,transparent)!important}',
'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table thead th{font-weight:950!important;letter-spacing:.07em!important}',
'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table thead th:nth-child(1){color:#9af0ff!important;box-shadow:inset 0 -2px 0 rgba(99,220,255,.55)}',
'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table thead th:nth-child(2){color:#e5ddff!important;box-shadow:inset 0 -2px 0 rgba(179,156,255,.50)}',
'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table thead th:nth-child(3){color:#b9f1ff!important;box-shadow:inset 0 -2px 0 rgba(99,220,255,.38)}',
'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table thead th:nth-child(4){color:#ffd78f!important;box-shadow:inset 0 -2px 0 rgba(255,200,111,.55)}',
'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table thead th:nth-child(5){color:#d8ccff!important;box-shadow:inset 0 -2px 0 rgba(179,156,255,.48)}',
'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table thead th:nth-child(6){color:#ffd483!important;box-shadow:inset 0 -2px 0 rgba(255,200,111,.62)}',
'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table thead th:nth-child(7){color:#a8e4ff!important;box-shadow:inset 0 -2px 0 rgba(101,169,255,.56)}',
'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table thead th:nth-child(8){color:#9ce8c9!important;box-shadow:inset 0 -2px 0 rgba(88,227,188,.58)}',
'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table thead th:nth-child(9){color:#98dcff!important;box-shadow:inset 0 -2px 0 rgba(99,180,255,.54)}',
'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table thead th:nth-child(10){color:#efc8ff!important;box-shadow:inset 0 -2px 0 rgba(210,145,255,.48)}',
'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table thead th:nth-child(11){color:#a8efff!important;box-shadow:inset 0 -2px 0 rgba(99,220,255,.48)}',
'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table tbody td:nth-child(5){color:#d8ccff!important;font-weight:840!important}',
'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table tbody td:nth-child(6){color:#ffd483!important;font-weight:860!important}',
'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table tbody td:nth-child(7){color:#a8e4ff!important;font-weight:850!important}',
'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table tbody td:nth-child(8){color:#9ce8c9!important;font-weight:850!important}',
'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table tbody td:nth-child(9){color:#98dcff!important;font-weight:850!important}',
'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table tbody td:nth-child(5) .rona-fin-pill{color:#d8ccff!important;border-color:rgba(179,156,255,.34)!important;background:rgba(105,82,171,.13)!important}',
'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table tbody td:nth-child(6) .rona-fin-pill{color:#ffd483!important;border-color:rgba(255,200,111,.38)!important;background:rgba(174,108,25,.14)!important}',
'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table tbody td:nth-child(7) .rona-fin-pill{color:#a8e4ff!important;border-color:rgba(101,169,255,.34)!important;background:rgba(52,101,176,.13)!important}',
'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table tbody td:nth-child(8) .rona-fin-pill{color:#9ce8c9!important;border-color:rgba(88,227,188,.34)!important;background:rgba(36,139,105,.13)!important}',
'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table tbody td:nth-child(9) .rona-fin-pill{color:#98dcff!important;border-color:rgba(99,180,255,.34)!important;background:rgba(46,111,178,.13)!important}',
'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table tbody td:nth-child(10) .rona-fin-pill{font-weight:950!important}',
'@media(max-width:980px){html.rona-deals-premium-v1 #page-deals .rona-deal-filter{grid-template-columns:repeat(2,minmax(0,1fr))!important}}',
'@media(max-width:620px){html.rona-deals-premium-v1 #page-deals .rona-deal-filter{grid-template-columns:1fr!important}}'
].join('');document.head.appendChild(s);
})();
`;
export default ADMIN_DEALS_SEMANTIC_CORRECTIONS_V1;
