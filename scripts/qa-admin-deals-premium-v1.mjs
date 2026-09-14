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
assert.match(premium,/font-size:13\.5px!important;font-variant-numeric:tabular-nums/,'main Deals table typography must stay readable');
assert.match(premium,/font-size:10\.5px!important;line-height:1\.16/,'table header typography must stay readable');
assert.match(premium,/white-space:normal!important;min-width:215px!important;max-width:255px!important/,'company names must keep natural wrapping');
assert.doesNotMatch(premium,/display\s*:\s*none/,'visual layer must not hide Deal controls or blocks');
assert.doesNotMatch(premium,/fetch\s*\(|\/portal\/owner-api|\/api\//,'visual layer must not access APIs');
assert.doesNotMatch(premium,/renderDeals\s*=|function\s+renderDeals|post\s*\(|upload\s*\(/,'visual layer must not own Deal business actions');
assert.doesNotMatch(premium,/\.rona-visual-title[^}]*font-size/s,'Deals premium layer must not change title font size');
assert.doesNotMatch(premium,/rona-current-deal-drawer/,'approved Deal Passport must remain outside section visual scope');

assert.match(semantic,/__RONA_ADMIN_DEALS_SEMANTIC_BUTTONS_V1__/);
assert.match(semantic,/20260914-semantic-buttons-v1/);
assert.doesNotMatch(semantic,/fetch\s*\(|\/portal\/owner-api|\/api\//,'semantic visual layer must not access APIs');
assert.doesNotMatch(semantic,/rona-current-deal-drawer/,'semantic section layer must not style approved Deal Passport');

assert.match(semanticFix,/20260914-live-dom-bind-v3/,'live DOM-binding revision must be present');
assert.match(semanticFix,/querySelectorAll\('button,\[role="button"\]'\)/,'runtime must locate real rendered subsection controls');
assert.match(semanticFix,/toneFor\(x\.textContent\)/,'runtime must classify subsection controls from live labels');
assert.match(semanticFix,/rona-deal-filter-live-v3/,'runtime must attach stable class to live controls host');
assert.match(semanticFix,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)!important/,'desktop subsection controls must be four equal premium buttons');
assert.match(semanticFix,/min-height:56px!important/,'premium subsection buttons must have executive visual weight');
assert.match(semanticFix,/\.is-attention\{--live-accent:#ffc86f/,'attention control must be amber');
assert.match(semanticFix,/\.is-completed\{--live-accent:#58e3bc/,'completed control must be green');
assert.match(semanticFix,/\.is-annulled\{--live-accent:#ff7180/,'annulled control must be red');
assert.match(semanticFix,/findDealTable\(root\)/,'runtime must bind semantic typography to the live Deal table');
assert.match(semanticFix,/rona-deal-table-live-v3/,'live Deal table must receive stable semantic class');
assert.match(semanticFix,/thead th:nth-child\(6\).*#ffd28a/,'finance header must be amber');
assert.match(semanticFix,/thead th:nth-child\(7\).*#9ddcff/,'logistics header must be blue');
assert.match(semanticFix,/thead th:nth-child\(8\).*#8fe3c7/,'documents header must be green');
assert.match(semanticFix,/thead th:nth-child\(9\).*#8ccfff/,'accounting header must be sky blue');
assert.match(semanticFix,/MutationObserver\(schedule\)/,'live binding must restore itself after renderer redraws');
assert.match(semanticFix,/rona:admin-pagechange/,'live binding must re-run on Admin navigation');
assert.doesNotMatch(semanticFix,/fetch\s*\(|\/portal\/owner-api|\/api\//,'live visual binding must not access APIs');
assert.doesNotMatch(semanticFix,/renderDeals\s*=|function\s+renderDeals|post\s*\(|upload\s*\(/,'live visual binding must not own business actions');
assert.doesNotMatch(semanticFix,/rona-current-deal-drawer/,'live visual binding must not style approved Deal Passport');
assert.doesNotMatch(semanticFix,/\.rona-visual-title[^}]*font-size/s,'live visual binding must not change title size');

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

console.log('ADMIN_DEALS_LIVE_DOM_BIND_V3_QA=PASS title_size=UNCHANGED passport=UNCHANGED live_controls=BOUND semantic_typography=BOUND business_logic=UNCHANGED api=UNCHANGED');
