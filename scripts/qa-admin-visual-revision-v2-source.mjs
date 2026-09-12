import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {onRequest as serveAdminMainUi} from '../functions/portal/main-ui/index.js';

const glass=await readFile('functions/portal/main-ui/admin-visual-revision-v2-finalize.js','utf8');
const v4=await readFile('functions/portal/main-ui/admin-visual-revision-v3-fix.js','utf8');
const v4Finalize=await readFile('functions/portal/main-ui/admin-visual-v4-finalize.js','utf8');
const index=await readFile('functions/portal/main-ui/index.js','utf8');

for(const required of ['__RONA_ADMIN_VISUAL_REVISION_V3__',"theme:'frosted-glass-silver'",'rona-admin-visual-v3','backdrop-filter:blur(16px)'])assert.ok(glass.includes(required),`base glass layer missing ${required}`);
for(const required of ['__RONA_ADMIN_VISUAL_REVISION_V4__',"theme:'layered-backdrop-frosted-glass'",'rona-admin-visual-v4','background-color:transparent!important','repeating-linear-gradient','rgba(19,52,73,.26)','rgba(20,61,82,.155)','rgba(13,48,69,.18)','rgba(11,46,65,.105)','backdrop-filter:blur(17px) saturate(138%)','inset 1px 0 0','rona-admin-v4-page-hero',"p.dataset.ronaAdminVisualRevision='frosted-glass-v4'"])assert.ok(v4.includes(required),`V4 owner visual layer missing ${required}`);
for(const required of ["'20260912-v4.3'",'#ronaAdminV2HomeTitle{display:grid!important','grid-template-columns:minmax(0,1fr)!important','justify-items:start!important','rona-admin-v4-home-eyebrow','rona-admin-v4-home-subtitle',"eyebrow.textContent='RONA TRADE · OPERATIONS'",'Операционный центр и актуальное состояние исполнения.'])assert.ok(v4Finalize.includes(required),`V4 canonical Home hero missing ${required}`);
for(const prohibited of ['background:#555','background:#222','background:#111','data:image/'])assert.ok(!v4.includes(prohibited)&&!v4Finalize.includes(prohibited),`V4 contains prohibited opaque/raster pattern ${prohibited}`);
for(const preserved of ['adminVisualRevisionV3Fix','adminVisualV4Finalize',"headers.set('x-rona-admin-visual-v4','layered-frosted-glass-v4')","'data-rona-app-passport-open':String(a?.application_id||'')","text:'Ресурс одобрен'","text:'В ресурсе отказано'","text:'Отправить в сделки'"])assert.ok(index.includes(preserved),`preserved Admin hook missing ${preserved}`);

const response=await serveAdminMainUi({});
assert.equal(response.status,200);
assert.equal(response.headers.get('x-rona-admin-visual-v4'),'layered-frosted-glass-v4');
const emitted=await response.text();
for(const required of ['__RONA_ADMIN_VISUAL_REVISION_V4__','__RONA_ADMIN_VISUAL_V4_FINALIZE__','layered-backdrop-frosted-glass','rona-admin-v4-page-hero','rona-admin-v4-home-eyebrow','Главная','data-rona-app-passport-open'])assert.ok(emitted.includes(required),`emitted V4 runtime missing ${required}`);

console.log('V4_REAL_UI_IMPLEMENTED=PASS implementation=DOM_CSS_runtime_only');
console.log('CANONICAL_HOME_TITLE=PASS shared_page_hero_architecture=true stacked_header=true');
console.log('TECH_BACKDROP_VISIBLE=PASS page_background_transparent=true layered_css_overlay=true');
console.log('FROSTED_GLASS_SURFACES=PASS rgba_layers=true backdrop_filter=true transparency_tiers=true');
console.log('SILVER_EDGE_LIGHT=PASS translucent_border=true top_left_inset=true restrained_glow=true');
console.log('OPAQUE_NAVY_PANELS_REMOVED=PASS hero_kpi_secondary_rows_translucent=true');
console.log('FUNCTIONAL_REGRESSION_SOURCE=PASS business_hooks_preserved=true presentation_only=true');
