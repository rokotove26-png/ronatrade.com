import assert from 'node:assert/strict';
import fs from 'node:fs';

const premium=fs.readFileSync('functions/portal/main-ui/admin-deals-premium-v1.js','utf8');
const semantic=fs.readFileSync('functions/portal/main-ui/admin-deals-semantic-buttons-v1.js','utf8');
const semanticFix=fs.readFileSync('functions/portal/main-ui/admin-deals-semantic-corrections-v1.js','utf8');
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
assert.match(premium,/font-size:13\.5px!important;font-variant-numeric:tabular-nums/,'main Deals table typography must be readable');
assert.match(premium,/font-size:10\.5px!important;line-height:1\.16/,'table header typography must be readable');
assert.match(premium,/\.rona-deal-filter button\{[\s\S]*?font-size:11\.5px!important/,'filters must remain legible');
assert.match(premium,/background:rgba\(1,8,14,\.84\)!important/,'work table must suppress distracting background artwork');
assert.match(premium,/tbody tr:nth-child\(even\) td/,'table rows need calm visual rhythm');
assert.match(premium,/white-space:normal!important;min-width:215px!important;max-width:255px!important/,'company names must wrap naturally');
assert.match(premium,/rona-deal-open:focus-visible/,'keyboard focus must remain visible');
assert.doesNotMatch(premium,/display\s*:\s*none/,'visual layer must not hide Deal controls or blocks');
assert.doesNotMatch(premium,/fetch\s*\(|\/portal\/owner-api|\/api\//,'visual layer must not access APIs');
assert.doesNotMatch(premium,/renderDeals\s*=|function\s+renderDeals|post\s*\(|upload\s*\(/,'visual layer must not own Deal business actions');
assert.doesNotMatch(premium,/\.rona-visual-title[^}]*font-size/s,'Deals premium layer must not change title font size');
assert.doesNotMatch(premium,/\.rona-visual-title[^}]*line-height/s,'Deals premium layer must not change title typography metrics');
assert.doesNotMatch(premium,/rona-current-deal-drawer/,'approved Deal Passport must remain outside section visual scope');

assert.match(semantic,/__RONA_ADMIN_DEALS_SEMANTIC_BUTTONS_V1__/);
assert.match(semantic,/20260914-semantic-buttons-v1/);
assert.match(semantic,/--sb-accent:#63dcff/,'active subsection must have cyan semantic accent');
assert.match(semantic,/button\.is-attention\{--sb-accent:#ffc86f/,'attention subsection must have amber semantic accent');
assert.match(semantic,/button\.is-completed\{--sb-accent:#58e3bc/,'completed subsection must have green semantic accent');
assert.match(semantic,/button\.is-annulled\{--sb-accent:#ff7180/,'annulled subsection must have red semantic accent');
assert.match(semantic,/button::before/,'premium subsection buttons must have signal indicator');
assert.match(semantic,/aria-pressed="true"/,'premium subsection buttons must preserve active-state semantics');
assert.match(semantic,/tbody td:nth-child\(2\).*#ded7ff/,'client typography must have violet semantic tone');
assert.match(semantic,/tbody td:nth-child\(4\).*#ffd489/,'volume typography must have amber semantic tone');
assert.match(semantic,/\.rona-deal-open\{[\s\S]*?linear-gradient/,'primary open action must keep premium button treatment');
assert.doesNotMatch(semantic,/fetch\s*\(|\/portal\/owner-api|\/api\//,'semantic visual layer must not access APIs');
assert.doesNotMatch(semantic,/renderDeals\s*=|function\s+renderDeals|post\s*\(|upload\s*\(/,'semantic visual layer must not own business actions');
assert.doesNotMatch(semantic,/rona-current-deal-drawer/,'semantic section layer must not style approved Deal Passport');
assert.doesNotMatch(semantic,/\.rona-visual-title[^}]*font-size/s,'semantic section layer must not change title size');

assert.match(semanticFix,/20260914-column-map-v1/);
assert.match(semanticFix,/thead th:nth-child\(5\).*#cbbcff/,'contract column must be violet');
assert.match(semanticFix,/thead th:nth-child\(6\).*#ffd28a/,'finance column must be amber');
assert.match(semanticFix,/thead th:nth-child\(7\).*#9ddcff/,'logistics column must be blue');
assert.match(semanticFix,/thead th:nth-child\(8\).*#8fe3c7/,'documents column must be green');
assert.match(semanticFix,/thead th:nth-child\(9\).*#8ccfff/,'accounting column must be sky blue');
assert.match(semanticFix,/tbody td:nth-child\(10\) \.rona-fin-pill\{font-weight:950/,'final management status must remain strongest');
assert.doesNotMatch(semanticFix,/fetch\s*\(|\/portal\/owner-api|\/api\//,'semantic correction layer must remain CSS-only');
assert.doesNotMatch(semanticFix,/rona-current-deal-drawer/,'semantic correction layer must not style approved Deal Passport');

assert.match(dealsBase,/renderDeals=function\(\)/,'authoritative Deals renderer must remain in base runtime');
assert.match(dealsBase,/data-deal-open|rona-deal-open/,'existing deal-open action must remain present');
assert.match(dealsBase,/Операционная картина сделок/);
assert.match(dealsBase,/Активные ·/);
assert.match(dealsBase,/Требует внимания ·/);
assert.match(dealsBase,/Завершённые ·/);
assert.match(dealsBase,/Аннулированные ·/);
assert.match(visualBase,/deals:\['Сделки','Документы, статусы и действия по активным контрактам\.'\]/,'global Deals hero content must remain unchanged');
assert.match(visualBase,/\.rona-visual-v2 \.rona-visual-title\{[\s\S]*?font-size:clamp\(28px,3\.1vw,44px\);[\s\S]*?line-height:1\.02;/,'global title size authority must remain unchanged');
assert.match(passport,/20260914-executive-passport-v1-readable-type/,'approved readable Deal Passport runtime must remain composed');

assert.equal(wrapper.trim(),"import baseRuntime from './chunk18-base.js';\nimport adminDealsPremiumRuntime from '../main-ui/admin-deals-premium-v1.js';\nimport adminDealsSemanticButtonsRuntime from '../main-ui/admin-deals-semantic-buttons-v1.js';\nimport adminDealsSemanticCorrectionsRuntime from '../main-ui/admin-deals-semantic-corrections-v1.js';\nimport adminDealPassportPremiumRuntime from '../main-ui/admin-deal-passport-premium-v1.js';\n\nexport default baseRuntime + adminDealsPremiumRuntime + adminDealsSemanticButtonsRuntime + adminDealsSemanticCorrectionsRuntime + adminDealPassportPremiumRuntime;",'chunk18 wrapper must preserve base + Deals visual layers + approved passport composition');
assert.match(preserved,/__RONA_AGENT_REWARDS_CANONICAL_V1__/,'preserved chunk18 runtime must remain intact');

console.log('ADMIN_DEALS_SEMANTIC_BUTTONS_V3_QA=PASS title_size=UNCHANGED passport=UNCHANGED subsection_buttons=PREMIUM semantic_typography=PASS business_logic=UNCHANGED api=UNCHANGED');
