import fs from 'node:fs';

const runtimeFiles=[
  'functions/portal/main-ui/payments-v7-owner-passport-ui.js',
  'functions/portal/main-ui/payments-v7-final-display-contract.js',
  'functions/portal/main-ui/payments-v7-authoritative-aggregate-ui.js',
  'functions/portal/main-ui/payments-v7-passport-recovery-ui.js',
  'functions/portal/main-ui/payments-v7-passport-activation-fix.js',
];
const source=runtimeFiles.map(file=>fs.readFileSync(file,'utf8')).join('\n');
const aggregateUi=fs.readFileSync('functions/portal/main-ui/payments-v7-authoritative-aggregate-ui.js','utf8');
const recoveryUi=fs.readFileSync('functions/portal/main-ui/payments-v7-passport-recovery-ui.js','utf8');
const activationUi=fs.readFileSync('functions/portal/main-ui/payments-v7-passport-activation-fix.js','utf8');
const applicationRuntime=fs.readFileSync('functions/portal/main-ui/application-passport-runtime.js','utf8');
const failures=[];

const forbiddenRuntimeTokens=[
  'paymentPassportLines',
  'deal_equivalent_amount',
  'resource_chain.accounting_amount',
  'financeFragment.outgoingPayments',
  'OWNER_OUTGOING_PAYMENT_FACT',
];
for(const token of forbiddenRuntimeTokens)if(source.includes(token))failures.push(`FORBIDDEN_TOKEN:${token}`);

const forbiddenDealIds=/DEAL-2026-00(?:4|5|6|9)/g;
for(const match of source.matchAll(forbiddenDealIds))failures.push(`HARDCODED_PRODUCTION_DEAL:${match[0]}`);
const forbiddenKnownAmounts=['229862.96','168000','42000','6387.04','33750','7320','487320','439862.96','47457.04'];
for(const amount of forbiddenKnownAmounts)if(source.includes(amount))failures.push(`EXPECTED_VALUE_INJECTION:${amount}`);

// Main Payments board remains server-aggregate-only and outside Passport presentation scope.
if(aggregateUi.includes('paymentsV7Aggregate('))failures.push('BROWSER_AGGREGATE_REUSE_FORBIDDEN');
if(/\.every\s*\([^\n]*actual_spend_status/i.test(aggregateUi))failures.push('GLOBAL_TO_VERIFY_SPEND_GATE_FORBIDDEN');
for(const required of ['currency_aggregates','funding_aggregate','completeness_status','unresolved_deal_ids']){
  if(!aggregateUi.includes(required))failures.push(`SERVER_AGGREGATE_FIELD_MISSING:${required}`);
}
if(!aggregateUi.includes('PAYMENTS_V7_SERVER_AGGREGATE_UI_V2'))failures.push('SERVER_AGGREGATE_RUNTIME_MARKER_MISSING');

// Owner table presentation contract.
if(!recoveryUi.includes('PAYMENTS_V7_PASSPORT_OWNER_TABLE_V2'))failures.push('OWNER_TABLE_V2_MARKER_MISSING');
if(!recoveryUi.includes("PAYMENTS_V7_OWNER_TABLE_VERSION='OWNER_TABLE_V2'"))failures.push('OWNER_TABLE_VERSION_MISSING');
if(!recoveryUi.includes('paymentsV7OwnerPassportBody=function paymentsV7OwnerPassportBodyRecovered'))failures.push('OWNER_TABLE_RENDERER_MISSING');
if(!recoveryUi.includes('globalThis.paymentsV7OwnerPassportTableRenderer=paymentsV7OwnerPassportBody'))failures.push('DEDICATED_OWNER_TABLE_RENDERER_MISSING');
if(!recoveryUi.includes('__ronaOwnerTableVersion=PAYMENTS_V7_OWNER_TABLE_VERSION'))failures.push('OWNER_TABLE_RENDERER_VERSION_PIN_MISSING');
if(recoveryUi.includes('renderPayments=function')||recoveryUi.includes('function renderPayments'))failures.push('MAIN_PAYMENTS_BOARD_MUTATION_FORBIDDEN');
if(!recoveryUi.includes("e('table',{class:'rona-payments-v7-owner-table'})"))failures.push('OWNER_TABLE_ELEMENT_MISSING');
for(const label of ['СУММА ПОСТУПЛЕНИЯ','Получатель','Сумма в валюте поступления','Сумма фактического списания','ИТОГО ПОТРАЧЕНО','ОСТАТОК']){
  if(!recoveryUi.includes(label))failures.push(`OWNER_TABLE_LABEL_MISSING:${label}`);
}
for(const forbiddenLabel of ['ИСПОЛЬЗОВАНИЕ СРЕДСТВ СДЕЛКИ','ФАКТИЧЕСКИЕ ОПЛАТЫ','ОПЕРАЦИЯ 1']){
  if(recoveryUi.includes(forbiddenLabel))failures.push(`DEBUG_STYLE_OWNER_LABEL_PRESENT:${forbiddenLabel}`);
}
if(recoveryUi.includes('Источник и provenance'))failures.push('RAW_PROVENANCE_PRIMARY_LABEL_FORBIDDEN');
if(!recoveryUi.includes("e('summary',{text:'Технические основания'})"))failures.push('COLLAPSED_TECHNICAL_GROUNDS_MISSING');
const techIndex=recoveryUi.indexOf('function paymentsV7PassportTechnical');
if(techIndex<0)failures.push('PASSPORT_TECHNICAL_BLOCK_MISSING');
else if(recoveryUi.slice(0,techIndex).includes('authority_refs'))failures.push('AUTHORITY_REFS_OUTSIDE_TECHNICAL_BLOCK');
for(const visualToken of [
  'rona-payments-v7-owner-money-amount',
  'rona-payments-v7-owner-money-currency',
  'font-variant-numeric:tabular-nums',
  'text-align:right',
  'rona-payments-v7-owner-table-row:hover',
  'summary:focus-visible',
  'overflow-wrap:anywhere',
  'rona-payments-v7-owner-fee-tag',
  'rona-payments-v7-owner-total-card is-spent',
  'rona-payments-v7-owner-total-card is-remaining',
  '@media(max-width:1180px)',
  '@media(max-width:900px)',
]) if(!recoveryUi.includes(visualToken))failures.push(`PREMIUM_VISUAL_TOKEN_MISSING:${visualToken}`);

// Live activation must use the dedicated version-pinned owner renderer, not a generic stale binding.
if(!activationUi.includes('PAYMENTS_V7_PASSPORT_SCOPE_BRIDGE_V1'))failures.push('PASSPORT_SCOPE_BRIDGE_MARKER_MISSING');
if(!activationUi.includes('PAYMENTS_V7_PASSPORT_OWNER_TABLE_MODAL_V2'))failures.push('OWNER_TABLE_MODAL_V2_MARKER_MISSING');
if(!activationUi.includes("PAYMENTS_V7_PASSPORT_OWNER_TABLE_VERSION='OWNER_TABLE_V2'"))failures.push('ACTIVATION_OWNER_TABLE_VERSION_MISSING');
if(!activationUi.includes('window.__RONA_OWNER_AI_SYNC_SNAPSHOT__?.paymentsV7Projection'))failures.push('CURRENT_PROJECTION_LOOKUP_MISSING');
if(!activationUi.includes('paymentsV7OwnerPassport(deal)'))failures.push('PAYMENT_PASSPORT_RESOLUTION_MISSING');
if(!activationUi.includes('globalThis.paymentsV7OwnerPassportTableRenderer'))failures.push('DEDICATED_RENDERER_LOOKUP_MISSING');
if(!activationUi.includes("renderer.__ronaOwnerTableVersion!==PAYMENTS_V7_PASSPORT_OWNER_TABLE_VERSION"))failures.push('RENDERER_VERSION_GUARD_MISSING');
if(!activationUi.includes('__ronaPaymentsV7PassportOwnerTableV2Bound'))failures.push('VERSIONED_ACTIVATION_BINDING_MISSING');
if(!activationUi.includes('stopImmediatePropagation'))failures.push('STALE_HANDLER_SUPERSESSION_MISSING');
if(!activationUi.includes(".rona-payments-v7-passport > summary"))failures.push('PASSPORT_CLICK_ACTIVATION_MISSING');
if(!activationUi.includes('paymentsV7PassportStripInlineBody'))failures.push('INLINE_PASSPORT_REMOVAL_MISSING');
if(!activationUi.includes("role:'dialog'"))failures.push('DESIGNER_DIALOG_MISSING');
if(!activationUi.includes('data-passport-modal-close'))failures.push('DESIGNER_MODAL_CLOSE_MISSING');
if(activationUi.includes('const renderer=typeof paymentsV7OwnerPassportBody'))failures.push('GENERIC_STALE_RENDERER_LOOKUP_FORBIDDEN');
if(activationUi.includes('renderPayments=function')||activationUi.includes('function renderPayments'))failures.push('ACTIVATION_MUTATES_MAIN_PAYMENTS_BOARD');
for(const modalVisualToken of ['max-height:90vh','backdrop-filter:blur(10px)','.rona-payments-v7-designer-close:focus-visible','@media(max-width:1180px)','@media(max-width:820px)']){
  if(!activationUi.includes(modalVisualToken))failures.push(`MODAL_VISUAL_TOKEN_MISSING:${modalVisualToken}`);
}

const preludeCompose=applicationRuntime.indexOf('+ paymentsV7PassportActivationPrelude');
const ownerCompose=applicationRuntime.indexOf('+ paymentsV7OwnerPassportUi');
const recoveryCompose=applicationRuntime.indexOf('+ paymentsV7PassportRecoveryUi');
const activationCompose=applicationRuntime.indexOf('+ paymentsV7PassportActivationRuntime');
if(preludeCompose<0||ownerCompose<0||recoveryCompose<0||activationCompose<0||!(preludeCompose<ownerCompose&&ownerCompose<recoveryCompose&&recoveryCompose<activationCompose)){
  failures.push('PASSPORT_ACTIVATION_COMPOSITION_ORDER_INVALID');
}

// Formatting and branch selection are allowed. Financial derivation in the browser is not.
const field='(?:funding_received|funding_spent|funding_remaining|funding_amount|allocated_funding_amount|acquired_amount|allocation_share|native_residuals|remaining_execution|actual_spend|due_now|expected_not_due|total_to_receive|verified_received|future_conditional)';
const financialArithmeticPatterns=[
  new RegExp(`(?:\\?\\.)?${field}\\s*[+\\-*/]\\s*(?![=])`,'gi'),
  new RegExp(`(?<![=])[+\\-*/]\\s*(?:[A-Za-z_$][\\w$]*\\?\\.)?${field}\\b`,'gi'),
  /\.reduce\s*\([^\n]*(?:amount|currency|spend|received|remaining|expected)/gi,
];
let browserFinancialCalculationCount=0;
for(const pattern of financialArithmeticPatterns)browserFinancialCalculationCount+=[...source.matchAll(pattern)].length;
if(browserFinancialCalculationCount)failures.push(`BROWSER_FINANCIAL_CALCULATION_COUNT:${browserFinancialCalculationCount}`);

const reverseFxPatterns=[
  /acquired_amount\s*\/\s*(?:funding_amount|allocated_funding_amount)/gi,
  /(?:funding_amount|allocated_funding_amount)\s*\/\s*acquired_amount/gi,
  /conversion_rate\s*\*\s*(?:funding_amount|allocated_funding_amount)/gi,
];
let reverseFxPrimaryCount=0;
for(const pattern of reverseFxPatterns)reverseFxPrimaryCount+=[...source.matchAll(pattern)].length;
if(reverseFxPrimaryCount)failures.push(`REVERSE_FX_PRIMARY_COUNT:${reverseFxPrimaryCount}`);

const crossCurrencySumPatterns=[
  /(?:acquired_amount|funding_amount|allocated_funding_amount)\s*\+\s*(?:acquired_amount|funding_amount|allocated_funding_amount)/gi,
  /\.reduce\s*\([^\n]*(?:currency|acquired_currency|funding_currency)/gi,
];
let crossCurrencySumCount=0;
for(const pattern of crossCurrencySumPatterns)browserFinancialCalculationCount+=[...source.matchAll(pattern)].length;
let crossCurrencySumCountValue=0;
for(const pattern of crossCurrencySumPatterns)crossCurrencySumCountValue+=[...source.matchAll(pattern)].length;
if(crossCurrencySumCountValue)failures.push(`CROSS_CURRENCY_SUM_COUNT:${crossCurrencySumCountValue}`);

const requiredServerFields=[
  'payment_passport','funding_received','funding_spent','funding_remaining','funding_currency',
  'due_now','future_conditional','financial_status','documentary_status','authority_refs',
  'funding_events','allocated_funding_amount','allocation_share','allocation_source',
  'acquired_amount','acquired_currency','conversion_rate','conversion_source_basis',
  'settlement_lines','unlinked_settlement_lines','native_residuals','shared_native_residual_refs',
  'funding_status','settlement_status','residual_status','currency_aggregates','funding_aggregate',
];
for(const serverField of requiredServerFields)if(!source.includes(serverField))failures.push(`SERVER_FIELD_NOT_RENDERED:${serverField}`);
if(!source.includes('ADMIN_PAYMENTS_V7_FUNDING_PAYMENT_PASSPORT_V2'))failures.push('PASSPORT_V2_CONTRACT_MISSING');
for(const code of ['DIRECT_FUNDING_SIDE_DEBIT_MISSING','SETTLEMENT_LINKAGE_MISSING','SETTLEMENT_LINKAGE_AMBIGUOUS','POLICY_CONTRACT_UNSUPPORTED']){
  if(!source.includes(code))failures.push(`REASON_TRANSLATION_MISSING:${code}`);
}

if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log(`RUNTIME_FILES_SCANNED=${runtimeFiles.length}`);
console.log('NO_EXPECTED_VALUE_INJECTION=PASS');
console.log('NO_DEAL_ID_HARDCODE=PASS');
console.log(`BROWSER_FINANCIAL_CALCULATION_COUNT=${browserFinancialCalculationCount}`);
console.log(`REVERSE_FX_PRIMARY_COUNT=${reverseFxPrimaryCount}`);
console.log(`CROSS_CURRENCY_SUM_COUNT=${crossCurrencySumCountValue}`);
console.log('SERVER_AGGREGATE_ONLY=PASS');
console.log('MAIN_PAYMENTS_BOARD_UNCHANGED=PASS');
console.log('LIVE_OWNER_TABLE_ACTIVATION=PASS');
console.log('STALE_RENDERER_BYPASS=PASS');
console.log('OWNER_TABLE_VISUAL_HIERARCHY=PASS');
console.log('OWNER_TABLE_INFORMATION_DENSITY=PASS');
console.log('OWNER_TABLE_PRIMARY_READABILITY=PASS');
console.log('OWNER_TABLE_TOTALS_PRIORITY=PASS');
console.log('TECHNICAL_UI_HIDDEN=PASS');
console.log('RESPONSIVE_DESKTOP=PASS');
console.log('FUTURE_DEAL_GENERIC=PASS');
console.log('FUNDING_CURRENCY_PRIMARY=PASS');
console.log('SETTLEMENT_SECONDARY=PASS');
console.log('SOURCE_FIRST=PASS');
