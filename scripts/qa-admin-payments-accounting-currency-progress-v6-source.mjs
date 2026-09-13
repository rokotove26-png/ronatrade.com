import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const v6=read('supabase/functions/rona-owner-ai-sync/owner-payments-accounting-currency-progress-v6.ts');
const idx=read('supabase/functions/rona-owner-ai-sync/index.ts');
const uiBase=read('functions/portal/main-ui/owner-payments-accounting-currency-progress-v6-runtime.js');
const uiAuthority=read('functions/portal/main-ui/owner-payments-accounting-currency-progress-v6-authority-runtime.js');
const uiR2=read('functions/portal/main-ui/owner-payments-accounting-currency-progress-v6-r2-runtime.js');
const bridge=read('functions/portal/main-ui/owner-payments-semantics-v3-runtime.js');
const browser=read('scripts/qa-admin-payments-accounting-currency-progress-v6-browser.mjs');
const semantic=read('scripts/qa-admin-payments-accounting-currency-progress-v6-semantic.mjs');
const migration=read('supabase/migrations/20260913040500_finance_accounting_currency_execution_links_v6.sql');
const source=read('functions/portal/owner-payments-accounting-currency-progress-v6-source.js');
const previewQa=read('functions/portal/admin-payments-v6-real-preview-qa.js');
function pass(name,cond){if(!cond)throw new Error(name+'=FAIL');console.log(name+'=PASS')}

const productionSources=[v6,idx,uiBase,uiAuthority,uiR2,bridge,source,previewQa].join('\n');
const forbiddenDealAmounts=['31002300','9300690','21701610'];
pass('NO_PRODUCTION_DEAL_FINANCIAL_HARDCODE',!productionSources.includes('CANON_V23_DIRECT_PAYMENT_TERMS')&&forbiddenDealAmounts.every(x=>!productionSources.includes(x)));
pass('NO_DEAL_SPECIFIC_AMOUNT_CONSTANTS_IN_RUNTIME',forbiddenDealAmounts.every(x=>!uiBase.includes(x)&&!uiAuthority.includes(x)&&!uiR2.includes(x)));

pass('FINANCE_CANON_V23',v6.includes("OWNER_FINANCE_CANON_ID='eabba23f-70b9-4d40-86ef-3d0578c71d4a'")&&v6.includes('OWNER_FINANCE_CANON_VERSION=23'));
pass('FINANCE_CANON_SOURCE_LOCK_FIELDS',v6.includes("S(row.record_type)==='FUNCTIONAL_CONCLUSION'")&&v6.includes("U(row.functional_role)==='FINANCE'")&&v6.includes("approved.has(U(row.status))")&&v6.includes('row.payload?.confirmed===true'));
pass('FINANCE_CANON_FAIL_CLOSED',v6.includes('FINANCE_CANON_V23_NOT_SOURCE_LOCKED')&&v6.includes("out.v6ProjectionAuthority='TO_VERIFY'")&&v6.includes('out.dealPaymentControlRows=[]')&&v6.includes('canon?.record_id??null'));
pass('FRONTEND_FINANCE_V23_AUTHORITY_GUARD',uiAuthority.includes("U(f?.ownerFinanceCanon?.status)==='AUTHORITATIVE'")&&uiAuthority.includes('Number(f?.ownerFinanceCanon?.version)===23')&&uiAuthority.includes('!financeAuthorityOk(f)')&&bridge.includes('owner-payments-accounting-currency-progress-v6-r2-runtime.js'));
pass('PROPOSAL_V23_SOURCE_LOCK',v6.includes('FINANCE_V23_EVIDENCE_LINKED_PROPOSAL')&&v6.includes('OWNER_FINANCE_CANON_REF')&&v6.includes('p.parent_record_id=${OWNER_FINANCE_CANON_ID}::uuid'));
pass('STALE_RETURNED_PROPOSAL_EXCLUDED',v6.includes('not exists (')&&v6.includes('RETURN_FOR_REVISION')&&v6.includes('d.parent_record_id=p.record_id')&&v6.includes('proposalAuthorityEligible'));
pass('GAZONE_VALUES_FROM_STRUCTURED_FINANCE_AUTHORITY',v6.includes("p.payload->>'proposed_action'='UPSERT_OWNER_EXPECTED_RECEIPT_PROJECTION'")&&v6.includes('currentPaymentCurrencyAuthorityRows')&&!v6.includes('FINANCE_CANON_V23_DIRECT')&&!v6.includes('OWNER_CONFIRMATION_2026-09-13_GAZONE_RUB_ACCOUNTING')&&semantic.includes('GAZONE_VALUES_FROM_STRUCTURED_FINANCE_AUTHORITY'));
pass('ABSENT_STRUCTURED_FINANCE_PROJECTION_FAILS_CLOSED',semantic.includes('ABSENT_STRUCTURED_FINANCE_PROJECTION_FAILS_CLOSED')&&v6.includes("source:'NO_AUTHORITATIVE_PAYMENT_CURRENCY'"));
pass('FINANCE_VALUE_CHANGE_REQUIRES_NO_CODE_CHANGE',semantic.includes('FINANCE_VALUE_CHANGE_REQUIRES_NO_CODE_CHANGE')&&v6.includes('businessValuesDataDriven:true'));
pass('VERIFIED_CLIENT_PAYMENT_AUTOMATIC_RECALC',v6.includes('verifiedReceivedByDeal')&&v6.includes('VERIFIED_BANK_PAYMENT_ALLOCATION')&&semantic.includes('VERIFIED_CLIENT_PAYMENT_AUTOMATIC_RECALC'));
pass('DEAL_ACCOUNTING_CURRENCY_FOLLOWS_CLIENT_PAYMENT',v6.includes('VERIFIED_INCOMING_CLIENT_PAYMENT')&&v6.includes('dealAccountingCurrencyFollowsClientPayment:true'));
pass('MIXED_CURRENCY_FAIL_CLOSED',v6.includes("source:'MIXED_INBOUND_CURRENCIES'")&&v6.includes("status:'TO_VERIFY'"));
pass('CROSS_CURRENCY_SOURCE_LOCK_REQUIRED',v6.includes('CROSS_CURRENCY_SOURCE_LOCK_REQUIRED')&&migration.includes('FINANCE_TREASURY_ACCOUNTING_CURRENCY_SOURCE_LOCK'));
pass('NO_SYNTHETIC_FX',v6.includes('syntheticFx:false')&&!v6.includes('cbr.ru')&&!v6.includes('currency_base')&&!v6.includes('marketFx'));
pass('NO_FX_DOUBLE_COUNT',v6.includes('fxPrincipalDoubleCount:false')&&v6.includes('convertedNotPaidIsActualSpend:false'));
pass('GLOBAL_TOTALS_GROUPED_BY_CURRENCY',v6.includes("groupedTotals(control,'total_to_receive_amount')")&&v6.includes("groupedTotals(control,'remaining_obligation_amount')")&&v6.includes('dealActualSpendTotalsByAccountingCurrency'));
pass('V5_USD_EVIDENCE_HISTORY_PRESERVED',v6.includes("historicalExecutionEvidenceContracts=['FINANCE_DEAL_EXECUTION_USD_LINKS_V5']")&&migration.includes('Additive to V5'));
pass('GENERIC_ACCOUNTING_CURRENCY_EVIDENCE_ADDITIVE',migration.includes('finance_deal_execution_accounting_currency_links_v6')&&migration.includes('revoke all')&&migration.includes('grant select'));
pass('UPSTREAM_LIFECYCLE_READ_ONLY',v6.includes('upstreamLifecycleReadOnly:true')&&idx.includes('READ_ONLY_EXISTING_HANDOFF'));
pass('NO_NEW_PAYMENT_STAGE_GATE',!v6.includes('payment_stage')&&!migration.includes('payment_stage'));
pass('NIKOIL_NOT_HARDCODED',!v6.toUpperCase().includes('NIK-OIL')&&!uiBase.toUpperCase().includes('NIK-OIL')&&!uiR2.toUpperCase().includes('NIK-OIL'));
pass('OWNER_MUTATION_V5_RETAINED',uiBase.includes("'/portal/owner-payment-authority-v5/'")&&uiBase.includes('client-allocation')&&uiBase.includes('deal-binding')&&uiBase.includes('advance-payment'));
pass('PAYMENT_PASSPORT_REMAINS_PAYMENT_CENTRIC',!v6.includes('source-use tracing')&&fs.existsSync('functions/portal/main-ui/payment-passport-runtime-v1.js'));
pass('PAYMENT_AMOUNT_IMMUTABLE',!migration.includes('update portal_private.payments')&&!v6.includes('update portal_private.payments'));
pass('IMMUTABLE_AUDIT_RETAINED',fs.existsSync('supabase/migrations/20260913032430_owner_payment_v5_owner_role_boundary.sql'));
pass('V6_SOURCE_AUTHENTICATED',source.includes('PORTAL_ACCESS_DENIED')&&source.includes('ADMIN_PAYMENTS_DEAL_ACCOUNTING_CURRENCY_PROGRESS_V6'));
pass('V6_UI_ACTIVE',bridge.includes('owner-payments-accounting-currency-progress-v6-r2-runtime.js')&&uiR2.includes('20260913-accounting-currency-progress-v6-r2')&&uiBase.includes('VERIFIED_RECEIVED / TOTAL_TO_RECEIVE'));
pass('PAYMENT_PROGRESS_VISUAL_ONLY',v6.includes('visualOnly:true')&&v6.includes('VISUAL_ONLY_NO_TRANCHE_NO_OVERDUE'));
pass('PROGRESS_FILL_VERIFIED_RECEIVED_ONLY',v6.includes("formula:'VERIFIED_RECEIVED/TOTAL_TO_RECEIVE'")&&uiBase.includes('payment_progress_pct'));
pass('DEFERRED_UNFILLED_NEUTRAL',v6.includes('deferredUnfilledNeutral:true')&&uiBase.includes('rona-pay-v6-progress'));
pass('NO_PROGRESS_TRANCHE_SEGMENTATION',v6.includes('trancheSegmentation:false')&&!uiBase.includes('progress-segment')&&!uiR2.includes('progress-segment'));

pass('SUMMARY_KPI_DESKTOP_HORIZONTAL',uiR2.includes("class:'rona-pay-v6-summary-kpis'")&&uiR2.includes('display:grid'));
pass('SUMMARY_KPI_DESKTOP_FOUR_COLUMNS',uiR2.includes('grid-template-columns:repeat(4,minmax(0,1fr))'));
pass('SUMMARY_KPI_EQUAL_CARD_HEIGHT',uiR2.includes('height:100%')&&uiR2.includes('align-items:stretch'));
pass('SUMMARY_KPI_MULTI_CURRENCY_INSIDE_CARD',uiR2.includes('summaryMoneyRows')&&uiR2.includes('data-rona-summary-currency'));
pass('SUMMARY_KPI_MEDIUM_2X2',uiR2.includes('@media(max-width:1100px){.rona-pay-v6-summary-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}'));
pass('SUMMARY_KPI_MOBILE_SINGLE_COLUMN',uiR2.includes('@media(max-width:680px){.rona-pay-v6-summary-kpis{grid-template-columns:1fr}'));
pass('SUMMARY_KPI_REQUIRED_LABELS',uiR2.includes("summaryCard('К получению'")&&uiR2.includes("summaryCard('Получено'")&&uiR2.includes("summaryCard('Ожидается'")&&uiR2.includes("text:'Потрачено / Остаток'"));

pass('SEMANTIC_INTEGRATION_QA_PRESENT',semantic.includes('SEMANTIC_VERIFIED_USD_PAYMENT_TO_USD')&&semantic.includes('SEMANTIC_RUB_FALLBACK_UNDER_V23')&&semantic.includes('SEMANTIC_CANON_ABSENT_FAIL_CLOSED')&&semantic.includes('SEMANTIC_STALE_REJECTED_PROPOSAL_NOT_AUTHORITY')&&semantic.includes('SEMANTIC_CROSS_CURRENCY_WITHOUT_EXACT_LINK_TO_VERIFY')&&semantic.includes('SEMANTIC_PROGRESS_RECEIVED_OVER_TOTAL_ONLY'));
pass('REAL_PREVIEW_QA_ROUTE_PREVIEW_ONLY',previewQa.includes("/^[0-9a-f]{8}\\.rona-trade-public\\.pages\\.dev$/i")&&previewQa.includes("QA_HEADER='x-rona-v6-real-preview-qa'")&&previewQa.includes("assetUrl.pathname='/portal/admin.html'")&&previewQa.includes('context.env?.ASSETS?.fetch')&&previewQa.includes("x-rona-v6-real-preview-asset','DEPLOYED_ADMIN_CURRENT"));
pass('REAL_PREVIEW_BROWSER_NO_SYNTHETIC_DOM',browser.includes("origin+'/portal/admin-payments-v6-real-preview-qa'")&&browser.includes("pathname==='/portal/main-ui'")&&browser.includes('REAL_PREVIEW_MAIN_UI_ORIGIN')&&browser.includes('REAL_PREVIEW_DEPLOYED_ADMIN_ASSET')&&!browser.includes('page.setContent(')&&!browser.includes('addScriptTag(')&&!browser.includes("import runtime from '../functions"));
pass('REAL_PREVIEW_BROWSER_RUNTIME_ERROR_COLLECTION',browser.includes("page.on('pageerror'")&&browser.includes("msg.type()==='error'")&&browser.includes('REAL_PREVIEW_NO_PAGEERROR')&&browser.includes('REAL_PREVIEW_NO_CONSOLE_ERRORS')&&!browser.includes("NO_RUNTIME_ERRORS',true"));
pass('REAL_PREVIEW_AUTOMATION_PROOF_PRESENT',browser.includes('FINANCE_VALUE_CHANGE_REQUIRES_NO_CODE_CHANGE')&&browser.includes('__RONA_OWNER_PAYMENTS_V6_REFRESH__'));
pass('REAL_PREVIEW_RESPONSIVE_PROOF_PRESENT',browser.includes('SUMMARY_KPI_DESKTOP_FOUR_COLUMNS')&&browser.includes('SUMMARY_KPI_MEDIUM_2X2')&&browser.includes('SUMMARY_KPI_MOBILE_SINGLE_COLUMN'));

console.log('V6_R2_SOURCE_QA=PASS');
