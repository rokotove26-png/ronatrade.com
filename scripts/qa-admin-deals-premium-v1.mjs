import assert from 'node:assert/strict';
import fs from 'node:fs';

const premium=fs.readFileSync('functions/portal/main-ui/admin-deals-premium-v1.js','utf8');
const wrapper=fs.readFileSync('functions/portal/owner-ui-chunks/chunk18.js','utf8');
const preserved=fs.readFileSync('functions/portal/owner-ui-chunks/chunk18-base.js','utf8');
const dealsBase=fs.readFileSync('functions/portal/owner-ui-chunks/chunk6.js','utf8');
const visualBase=fs.readFileSync('functions/portal/owner-ui-chunks/chunk7.js','utf8');

assert.match(premium,/__RONA_ADMIN_DEALS_PREMIUM_V1__/);
assert.match(premium,/20260914-executive-v1/);
assert.match(premium,/rona-deal-kpi-grid/);
assert.match(premium,/rona-deal-filter/);
assert.match(premium,/rona-deal-table/);
assert.match(premium,/rona-deal-detail-grid/);
assert.match(premium,/nth-child\(6\).*#ffc86f/,'sixth KPI must have executive amber accent');
assert.match(premium,/nth-child\(2\).*#c9c0ff/,'client column must carry violet hierarchy accent');
assert.match(premium,/nth-child\(4\).*#ffd58b/,'volume column must carry amber hierarchy accent');
assert.match(premium,/nth-child\(8\).*#8fe8c9/,'documents column must carry green hierarchy accent');
assert.match(premium,/white-space:normal!important;min-width:190px;max-width:250px/,'company names must wrap naturally');
assert.match(premium,/rona-deal-open:focus-visible/,'keyboard focus must remain visible');
assert.doesNotMatch(premium,/display\s*:\s*none/,'visual layer must not hide Deal controls or blocks');
assert.doesNotMatch(premium,/fetch\s*\(|\/portal\/owner-api|\/api\//,'visual layer must not access APIs');
assert.doesNotMatch(premium,/renderDeals\s*=|function\s+renderDeals|post\s*\(|upload\s*\(/,'visual layer must not own Deal business actions');
assert.doesNotMatch(premium,/\.rona-visual-title[^}]*font-size/s,'Deals premium layer must not change the title font size');
assert.doesNotMatch(premium,/\.rona-visual-title[^}]*line-height/s,'Deals premium layer must not change title typography metrics');

assert.match(dealsBase,/renderDeals=function\(\)/,'authoritative Deals renderer must remain in the base runtime');
assert.match(dealsBase,/data-deal-open|rona-deal-open/,'existing deal-open action must remain present');
assert.match(dealsBase,/Операционная картина сделок/);
assert.match(dealsBase,/Активные ·/);
assert.match(dealsBase,/Требует внимания ·/);
assert.match(dealsBase,/Завершённые ·/);
assert.match(dealsBase,/Аннулированные ·/);
assert.match(visualBase,/deals:\['Сделки','Документы, статусы и действия по активным контрактам\.'\]/,'global Deals hero content must remain unchanged');
assert.match(visualBase,/\.rona-visual-title\{margin:0;font-size:clamp\(28px,3\.1vw,44px\)/,'global title size authority must remain unchanged');

assert.equal(wrapper.trim(),"import baseRuntime from './chunk18-base.js';\nimport adminDealsPremiumRuntime from '../main-ui/admin-deals-premium-v1.js';\n\nexport default baseRuntime + adminDealsPremiumRuntime;",'chunk18 wrapper must only compose the preserved runtime with the Deals visual layer');
assert.match(preserved,/__RONA_AGENT_REWARDS_CANONICAL_V1__/,'preserved chunk18 runtime must remain intact');

console.log('ADMIN_DEALS_PREMIUM_V1_QA=PASS title_size=UNCHANGED visual=executive-premium business_logic=UNCHANGED api=UNCHANGED');
