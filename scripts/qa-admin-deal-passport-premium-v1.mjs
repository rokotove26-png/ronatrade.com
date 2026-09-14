import assert from 'node:assert/strict';
import fs from 'node:fs';

const premium=fs.readFileSync('functions/portal/main-ui/admin-deal-passport-premium-v1.js','utf8');
const wrapper=fs.readFileSync('functions/portal/owner-ui-chunks/chunk18.js','utf8');
const dealsRuntime=fs.readFileSync('functions/portal/deals-current-state-ui.js','utf8');
const dealChunk0=fs.readFileSync('functions/portal/deals-current-state-chunks/chunk0.js','utf8');
const dealChunk1=fs.readFileSync('functions/portal/deals-current-state-chunks/chunk1.js','utf8');
const dealChunk3=fs.readFileSync('functions/portal/deals-current-state-chunks/chunk3.js','utf8');

assert.match(premium,/__RONA_ADMIN_DEAL_PASSPORT_PREMIUM_V1__/);
assert.match(premium,/20260914-executive-passport-v1-readable-type/);
assert.match(premium,/rona-current-deal-drawer-layer/);
assert.match(premium,/width:min\(980px,calc\(100vw - 40px\)\)/,'desktop passport width must be preserved');
assert.match(premium,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/,'passport content must preserve the two-column executive grid on wide screens');
assert.match(premium,/\.rona-current-deal-detail-grid>\.rona-owner-card:nth-child\(1\).*#63dcff/,'commercial card accent missing');
assert.match(premium,/\.rona-current-deal-detail-grid>\.rona-owner-card:nth-child\(2\).*#ffc86f/,'finance card accent missing');
assert.match(premium,/\.rona-current-deal-detail-grid>\.rona-owner-card:nth-child\(3\).*#65a9ff/,'rail card accent missing');
assert.match(premium,/\.rona-current-deal-detail-grid>\.rona-owner-card:nth-child\(4\).*#58e3bc/,'documents card accent missing');
assert.match(premium,/\.rona-current-deal-drawer-head>strong\{[^}]*font-size:20px!important/,'drawer title must be readable at desktop scale');
assert.match(premium,/\.rona-current-deal-detail-grid>\.rona-owner-card>h2\{[^}]*font-size:16px!important/,'section headings must use readable typography');
assert.match(premium,/\.rona-current-deal-detail-label\{[^}]*font-size:11\.5px!important/,'passport labels must not use microtype');
assert.match(premium,/\.rona-current-deal-detail-row>div:last-child\{[^}]*font-size:15px!important/,'passport values must be readable');
assert.match(premium,/\.rona-fin-pill\{[^}]*font-size:11px!important/,'status pills must be readable');
assert.match(premium,/\.rona-current-deal-doc-item strong\{[^}]*font-size:13px!important/,'document titles must be readable');
assert.match(premium,/\.rona-current-deal-doc-item button\{[^}]*font-size:11\.5px!important/,'document actions must be readable');
assert.match(premium,/\.rona-current-deal-actions button\{[^}]*font-size:11\.5px!important/,'passport action labels must be readable');
assert.match(premium,/rona-current-deal-doc-item/,'document tiles must be styled');
assert.match(premium,/rona-current-deal-primary/,'primary payment action must remain visually distinct');
assert.match(premium,/rona-current-deal-danger/,'destructive action must remain visually distinct');
assert.match(premium,/rona-current-deal-drawer-close:focus-visible/,'drawer close focus state must remain visible');
assert.match(premium,/rona-current-deal-doc-item button:focus-visible/,'document action focus state must remain visible');
assert.match(premium,/prefers-reduced-motion:reduce/,'reduced-motion path required');
assert.doesNotMatch(premium,/display\s*:\s*none/i,'visual layer must not hide passport content or actions');
assert.doesNotMatch(premium,/\.rona-visual-title/,'page title typography must remain outside passport visual scope');
assert.doesNotMatch(premium,/fetch\s*\(|\/portal\/owner-api|\/api\//i,'passport visual layer must not access APIs');
assert.doesNotMatch(premium,/postJson|uploadPdf|sendToPayments|renderDeals\s*=|function\s+syncDealDrawer|MutationObserver|addEventListener\s*\(/,'passport visual layer must not own business actions or renderer lifecycle');

assert.match(dealsRuntime,/function syncDealDrawer\(d\)/,'authoritative right-side drawer runtime must remain in Deals runtime');
assert.match(dealsRuntime,/body\.append\(buildDetail\(d\)\)/,'authoritative drawer must still render the existing passport content');
assert.match(dealsRuntime,/button\('Закрыть','rona-current-deal-drawer-close',closeDealDrawer\)/,'existing drawer close action must remain');
assert.match(dealsRuntime,/send\.disabled=overall\(d\)!=='GO'/,'GO payment handoff gate must remain authoritative');
assert.match(dealsRuntime,/rona-current-deal-doc-download/,'authoritative document download action must remain');
assert.match(dealChunk0,/function pill\(text,tone\)/,'authoritative status-pill data renderer must remain');
assert.match(dealChunk1,/rona-current-deal-actions/,'authoritative action group must remain');
assert.match(dealChunk3,/function buildDetail\(d\)/,'authoritative passport content builder must remain');
assert.match(dealChunk3,/Платежи и взаиморасчёты/);
assert.match(dealChunk3,/ЖД \/ исполнение/);
assert.match(dealChunk3,/Документы/);

const expectedWrapper="import baseRuntime from './chunk18-base.js';\nimport adminDealsPremiumRuntime from '../main-ui/admin-deals-premium-v1.js';\nimport adminDealPassportPremiumRuntime from '../main-ui/admin-deal-passport-premium-v1.js';\n\nexport default baseRuntime + adminDealsPremiumRuntime + adminDealPassportPremiumRuntime;";
assert.equal(wrapper.trim(),expectedWrapper,'owner UI wrapper must only compose existing runtimes with the presentation layer');

console.log('ADMIN_DEAL_PASSPORT_PREMIUM_V1_QA=PASS drawer=PREMIUM typography=READABLE content=UNCHANGED business_logic=UNCHANGED api=UNCHANGED title=UNCHANGED');
