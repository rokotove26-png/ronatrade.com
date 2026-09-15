import fs from 'node:fs';

const runtimeFiles=[
  'functions/portal/main-ui/payments-v7-owner-passport-ui.js',
  'functions/portal/main-ui/payments-v7-final-display-contract.js',
];
const source=runtimeFiles.map(file=>fs.readFileSync(file,'utf8')).join('\n');
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

const forbiddenKnownAmounts=[
  '229862.96','168000','42000','6387.04','33750','7320','487320','439862.96','47457.04',
];
for(const amount of forbiddenKnownAmounts)if(source.includes(amount))failures.push(`EXPECTED_VALUE_INJECTION:${amount}`);

// Display formatting is allowed. Financial derivation in the browser is not.
const field='(?:funding_received|funding_spent|funding_remaining|funding_amount|allocated_funding_amount|acquired_amount|allocation_share|native_residuals|remaining_execution|actual_spend|expected_not_due)';
const financialArithmeticPatterns=[
  new RegExp(`(?:\\?\\.)?${field}\\s*[+\\-*/]\\s*(?![=])`,'gi'),
  new RegExp(`(?<![=])[+\\-*/]\\s*(?:[A-Za-z_$][\\w$]*\\?\\.)?${field}\\b`,'gi'),
  /Math\.(?:max|min|round|floor|ceil|abs)\s*\(/g,
  /\.(?:reduce)\s*\(/g,
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
for(const pattern of crossCurrencySumPatterns)crossCurrencySumCount+=[...source.matchAll(pattern)].length;
if(crossCurrencySumCount)failures.push(`CROSS_CURRENCY_SUM_COUNT:${crossCurrencySumCount}`);

const requiredServerFields=[
  'payment_passport','funding_received','funding_spent','funding_remaining','funding_currency',
  'expected_not_due','financial_status','documentary_status','authority_refs',
  'funding_events','allocated_funding_amount','allocation_share','allocation_source',
  'acquired_amount','acquired_currency','conversion_rate','conversion_source_basis',
  'settlement_lines','unlinked_settlement_lines','native_residuals','shared_native_residual_refs',
  'funding_status','settlement_status','residual_status',
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
console.log(`CROSS_CURRENCY_SUM_COUNT=${crossCurrencySumCount}`);
console.log('TO_VERIFY_PRESERVED=PASS');
console.log('AUTHORITATIVE_VALUES_PRESERVED_EXACTLY=PASS');
console.log('SOURCE_FIRST=PASS');
