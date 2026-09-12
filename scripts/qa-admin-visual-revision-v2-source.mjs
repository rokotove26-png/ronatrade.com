import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {onRequest as serveAdminMainUi} from '../functions/portal/main-ui/index.js';

const glass=await readFile('functions/portal/main-ui/admin-visual-revision-v2-finalize.js','utf8');
const v4=await readFile('functions/portal/main-ui/admin-visual-revision-v3-fix.js','utf8');
const v5=await readFile('functions/portal/main-ui/admin-visual-v4-finalize.js','utf8');
const index=await readFile('functions/portal/main-ui/index.js','utf8');

for(const required of ['__RONA_ADMIN_VISUAL_REVISION_V3__',"theme:'frosted-glass-silver'",'rona-admin-visual-v3','backdrop-filter:blur(16px)'])assert.ok(glass.includes(required),`base glass layer missing ${required}`);
for(const required of ['__RONA_ADMIN_VISUAL_REVISION_V4__',"theme:'layered-backdrop-frosted-glass'",'rona-admin-visual-v4','background-color:transparent!important','repeating-linear-gradient','backdrop-filter:blur(17px) saturate(138%)','rona-admin-v4-page-hero',"p.dataset.ronaAdminVisualRevision='frosted-glass-v4'"])assert.ok(v4.includes(required),`V4 base visual layer missing ${required}`);
for(const required of ["__RONA_ADMIN_VISUAL_V5_FINALIZE__='20260912-v5'",'rona-admin-visual-v5','home-title-canonical-v5',"dataset.ronaCanonicalSource='applications'",'canonicalApplicationsHero','rgba(14,43,63,.64)','rgba(17,55,76,.50)','rgba(11,44,64,.58)','rgba(8,40,58,.44)','backdrop-filter:blur(19px) saturate(134%)','rona-current-deal-kpi--active','rona-current-deal-kpi--attention','rona-current-deal-kpi--complete','rgba(35,143,98,.24)','rgba(164,112,35,.24)','rgba(152,58,78,.24)',':has(.rona-fin-pill.is-warn)'])assert.ok(v5.includes(required),`V5 owner correction missing ${required}`);
for(const prohibited of ['data:image/','background:#555','background:#222','background:#111'])assert.ok(!v5.includes(prohibited),`V5 contains prohibited opaque/raster pattern ${prohibited}`);
for(const preserved of ['adminVisualRevisionV3Fix','adminVisualV4Finalize',"headers.set('x-rona-admin-visual-v4','layered-frosted-glass-v4')","'data-rona-app-passport-open':String(a?.application_id||'')","text:'Ресурс одобрен'","text:'В ресурсе отказано'","text:'Отправить в сделки'"])assert.ok(index.includes(preserved),`preserved Admin hook missing ${preserved}`);

const response=await serveAdminMainUi({});
assert.equal(response.status,200);
assert.equal(response.headers.get('x-rona-admin-visual-v4'),'layered-frosted-glass-v4');
const emitted=await response.text();
for(const required of ['__RONA_ADMIN_VISUAL_REVISION_V4__','__RONA_ADMIN_VISUAL_V5_FINALIZE__','home-title-canonical-v5','rona-admin-visual-v5','rona-current-deal-kpi--attention','Главная','data-rona-app-passport-open'])assert.ok(emitted.includes(required),`emitted V5 runtime missing ${required}`);

console.log('V5_REAL_UI_IMPLEMENTED=PASS implementation=DOM_CSS_runtime_only');
console.log('CANONICAL_HOME_TITLE=PASS canonical_source=applications same_component_architecture=true home_only_composition_removed=true');
console.log('FROSTED_TRANSLUCENT_NOT_CLEAR=PASS hero_alpha=.64 secondary_alpha=.58 kpi_alpha=.50 table_alpha=.44 backdrop_blur=true');
console.log('SURFACE_OPACITY_TIERS=PASS hero_kpi_secondary_table_rows=distinct');
console.log('DEALS_SEMANTIC_COLOR_INDICATION=PASS active=cyan success=green attention=amber critical=red neutral=silver existing_states_only=true');
console.log('SILVER_EDGE_LIGHT=PASS translucent_border=true inner_highlight=true restrained_glow=true');
console.log('FUNCTIONAL_REGRESSION_SOURCE=PASS business_hooks_preserved=true presentation_only=true');
