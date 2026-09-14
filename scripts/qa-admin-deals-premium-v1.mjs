import assert from 'node:assert/strict';
import fs from 'node:fs';

const premium=fs.readFileSync('functions/portal/main-ui/admin-deals-premium-v1.js','utf8');
const wrapper=fs.readFileSync('functions/portal/owner-ui-chunks/chunk18.js','utf8');
const preserved=fs.readFileSync('functions/portal/owner-ui-chunks/chunk18-base.js','utf8');
const dealsBase=fs.readFileSync('functions/portal/owner-ui-chunks/chunk6.js','utf8');
const visualBase=fs.readFileSync('functions/portal/owner-ui-chunks/chunk7.js','utf8');
const passport=fs.readFileSync('functions/portal/main-ui/admin-deal-passport-premium-v1.js','utf8');

assert.match(premium,/__RONA_ADMIN_DEALS_PREMIUM_V1__/);
assert.match(premium,/20260914-executive-v2/);
assert.match(premium,/rona-deal-kpi-grid/);
assert.match(premium,/rona-deal-filter/);
assert.match(premium,/rona-deal-table/);
assert.match(premium,/rona-deal-detail-grid/);
assert.match(premium,/nth-child\(6\).*#ffc86f/,'sixth KPI must keep executive amber accent');
assert.match(premium,/nth-child\(2\).*#c9c0ff/,'client column must carry violet hierarchy accent');
assert.match(premium,/nth-child\(4\).*#ffd58b/,'volume column must carry amber hierarchy accent');
assert.match(premium,/nth-child\(8\).*#8fe8c9/,'documents column must carry green hierarchy accent');
assert.match(premium,/font-size:13\.5px!important;font-variant-numeric:tabular-nums/,'main Deals table typography must be readable');
assert.match(premium,/font-size:10\.5px!important;line-height:1\.16/,'table header typography must be readable');
assert.match(premium,/\.rona-deal-filter button\{[\s\S]*?font-size:11\.5px!important/,'filters must be visually legible');
assert.match(premium,/\.rona-deal-open,[\s\S]*?font-size:11\.5px!important/,'primary row action must be legible');
assert.match(premium,/background:rgba\(1,8,14,\.84\)!important/,'work table must suppress distracting background artwork');
assert.match(premium,/tbody tr:nth-child\(even\) td/,'table rows need calm visual rhythm');
assert.match(premium,/white-space:normal!important;min-width:215px!important;max-width:255px!important/,'company names must wrap naturally');
assert.match(premium,/td:nth-child\(3\) \.rona-fin-pill[\s\S]*?color:#bdd0dc/,'product helper pills must be visually neutralized');
assert.match(premium,/td:nth-child\(10\) \.rona-fin-pill[\s\S]*?font-weight:920/,'final management status remains visually prominent');
assert.match(premium,/rona-deal-open:focus-visible/,'keyboard focus must remain visible');
assert.doesNotMatch(premium,/display\s*:\s*none/,'visual layer must not hide Deal controls or blocks');
assert.doesNotMatch(premium,/fetch\s*\(|\/portal\/owner-api|\/api\//,'visual layer must not access APIs');
assert.doesNotMatch(premium,/renderDeals\s*=|function\s+renderDeals|post\s*\(|upload\s*\(/,'visual layer must not own Deal business actions');
assert.doesNotMatch(premium,/\.rona-visual-title[^}]*font-size/s,'Deals premium layer must not change the title font size');
assert.doesNotMatch(premium,/\.rona-visual-title[^}]*line-height/s,'Deals premium layer must not change title typography metrics');
assert.doesNotMatch(premium,/rona-current-deal-drawer/,'approved Deal Passport visual scope must remain untouched by section V2');

assert.match(dealsBase,/renderDeals=function\(\)/,'authoritative Deals renderer must remain in the base runtime');
assert.match(dealsBase,/data-deal-open|rona-deal-open/,'existing deal-open action must remain present');
assert.match(dealsBase,/Операционная картина сделок/);
assert.match(dealsBase,/Активные ·/);
assert.match(dealsBase,/Требует внимания ·/);
assert.match(dealsBase,/Завершённые ·/);
assert.match(dealsBase,/Аннулированные ·/);
assert.match(visualBase,/deals:\['Сделки','Документы, статусы и действия по активным контрактам\.'\]/,'global Deals hero content must remain unchanged');
assert.match(visualBase,/\.rona-visual-v2 \.rona-visual-title\{[\s\S]*?font-size:clamp\(28px,3\.1vw,44px\);[\s\S]*?line-height:1\.02;/,'global title size authority must remain unchanged');
assert.match(passport,/20260914-executive-passport-v1-readable-type/,'approved readable Deal Passport runtime must remain composed');

assert.equal(wrapper.trim(),"import baseRuntime from './chunk18-base.js';\nimport adminDealsPremiumRuntime from '../main-ui/admin-deals-premium-v1.js';\nimport adminDealPassportPremiumRuntime from '../main-ui/admin-deal-passport-premium-v1.js';\n\nexport default baseRuntime + adminDealsPremiumRuntime + adminDealPassportPremiumRuntime;",'chunk18 wrapper must preserve base + section visual + approved passport composition');
assert.match(preserved,/__RONA_AGENT_REWARDS_CANONICAL_V1__/,'preserved chunk18 runtime must remain intact');

console.log('ADMIN_DEALS_PREMIUM_V2_QA=PASS title_size=UNCHANGED passport=UNCHANGED table=READABLE semantic_color=RESTRAINED business_logic=UNCHANGED api=UNCHANGED');
