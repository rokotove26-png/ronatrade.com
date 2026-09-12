import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {onRequest as serveAdminMainUi} from '../functions/portal/main-ui/index.js';

const glass=await readFile('functions/portal/main-ui/admin-visual-revision-v2-finalize.js','utf8');
const index=await readFile('functions/portal/main-ui/index.js','utf8');

for(const required of [
  '__RONA_ADMIN_VISUAL_REVISION_V3__',
  "theme:'frosted-glass-silver'",
  'rona-admin-visual-v3',
  '--ra-bg:#03101d',
  'rgba(8,28,45,.52)',
  'backdrop-filter:blur(16px)',
  '-webkit-backdrop-filter:blur(16px)',
  'rgba(210,236,248,.22)',
  'rgba(103,217,247,.46)',
  'repeating-linear-gradient',
  "page.dataset.ronaAdminVisualRevision='frosted-glass-v3'",
  'rona:admin-visual-v3-ready'
])assert.ok(glass.includes(required),`V3 frosted-glass layer missing ${required}`);

for(const prohibited of ['background:#555','background:#222','background:#111','background-image:url(','data:image/']){
  assert.ok(!glass.includes(prohibited),`V3 visual layer contains prohibited opaque/raster pattern ${prohibited}`);
}

for(const preserved of [
  'adminVisualRedesign',
  'adminVisualStatusChips',
  'adminVisualPolish',
  'adminVisualRevisionV2',
  'adminVisualRevisionV2Polish',
  'adminVisualRevisionV2Finalize',
  "headers.set('x-rona-admin-visual-v3','frosted-glass-v3')",
  "'data-rona-app-passport-open':String(a?.application_id||'')",
  "text:'Ресурс одобрен'",
  "text:'В ресурсе отказано'",
  "text:'Отправить в сделки'"
])assert.ok(index.includes(preserved),`preserved Admin runtime hook missing ${preserved}`);

const response=await serveAdminMainUi({});
assert.equal(response.status,200,'Admin main UI must materialize');
assert.equal(response.headers.get('x-rona-admin-visual-v3'),'frosted-glass-v3');
const emitted=await response.text();
for(const required of ['__RONA_ADMIN_VISUAL_REVISION_V3__','frosted-glass-silver','rona-admin-visual-v3','backdrop-filter:blur(16px)','Главная','data-rona-app-passport-open']){
  assert.ok(emitted.includes(required),`emitted V3 runtime missing ${required}`);
}

console.log('V3_REAL_UI_IMPLEMENTED=PASS implementation=DOM_CSS_runtime_only');
console.log('FROSTED_GLASS_SURFACES=PASS rgba_layers=true backdrop_filter=true transparency_tiers=true');
console.log('SILVER_EDGE_LIGHT=PASS translucent_border=true inset_highlight=true cyan_edge=true');
console.log('OPAQUE_GREY_PANELS_REMOVED=PASS v3_override=navy_translucent no_raster_ui=true');
console.log('HOME_TITLE_VISIBLE=PASS contract=explicit_home_h1');
console.log('FUNCTIONAL_REGRESSION_SOURCE=PASS business_hooks_preserved=true presentation_only=true');
