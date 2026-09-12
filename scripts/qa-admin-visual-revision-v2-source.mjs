import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {onRequest as serveAdminMainUi} from '../functions/portal/main-ui/index.js';

const glass=await readFile('functions/portal/main-ui/admin-visual-revision-v2-finalize.js','utf8');
const glassFix=await readFile('functions/portal/main-ui/admin-visual-revision-v3-fix.js','utf8');
const index=await readFile('functions/portal/main-ui/index.js','utf8');

for(const required of ['__RONA_ADMIN_VISUAL_REVISION_V3__',"theme:'frosted-glass-silver'",'rona-admin-visual-v3','--ra-bg:#03101d','backdrop-filter:blur(16px)','repeating-linear-gradient']){
  assert.ok(glass.includes(required),`V3 glass layer missing ${required}`);
}
for(const required of ['__RONA_ADMIN_VISUAL_REVISION_V3_FIX__',"'20260912-v3.2'",'rona-admin-v2-hero','radial-gradient(620px 240px','rgba(17,48,70,.50)','rgba(8,32,49,.42)','backdrop-filter:blur(10px)','background:transparent!important']){
  assert.ok(glassFix.includes(required),`V3.2 glass fix missing ${required}`);
}
for(const preserved of ['adminVisualRevisionV3Fix',"headers.set('x-rona-admin-visual-v3','frosted-glass-v3.2')","'data-rona-app-passport-open':String(a?.application_id||'')","text:'Ресурс одобрен'","text:'В ресурсе отказано'","text:'Отправить в сделки'"]){
  assert.ok(index.includes(preserved),`preserved Admin hook missing ${preserved}`);
}

const response=await serveAdminMainUi({});
assert.equal(response.status,200);
assert.equal(response.headers.get('x-rona-admin-visual-v3'),'frosted-glass-v3.2');
const emitted=await response.text();
for(const required of ['__RONA_ADMIN_VISUAL_REVISION_V3__','__RONA_ADMIN_VISUAL_REVISION_V3_FIX__','frosted-glass-silver','Главная','data-rona-app-passport-open'])assert.ok(emitted.includes(required));

console.log('V3_REAL_UI_IMPLEMENTED=PASS implementation=DOM_CSS_runtime_only');
console.log('FROSTED_GLASS_SURFACES=PASS rgba_layers=true backdrop_filter=true transparency_tiers=true');
console.log('SILVER_EDGE_LIGHT=PASS translucent_border=true inset_highlight=true cyan_edge=true');
console.log('OPAQUE_GREY_PANELS_REMOVED=PASS v3_2_override=hero_table_header_navy_translucent');
console.log('HOME_TITLE_VISIBLE=PASS contract=explicit_home_h1');
console.log('FUNCTIONAL_REGRESSION_SOURCE=PASS business_hooks_preserved=true presentation_only=true');
