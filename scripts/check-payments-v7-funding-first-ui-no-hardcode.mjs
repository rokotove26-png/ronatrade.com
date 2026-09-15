import fs from 'node:fs';

const file = 'functions/portal/main-ui/payments-v7-owner-passport-ui.js';
const source = fs.readFileSync(file, 'utf8');
const failures = [];

const forbiddenRuntimeTokens = [
  'paymentPassportLines',
  'deal_equivalent_amount',
  'resource_chain.accounting_amount',
  'financeFragment.outgoingPayments',
  'OWNER_OUTGOING_PAYMENT_FACT',
];
for (const token of forbiddenRuntimeTokens) if (source.includes(token)) failures.push(`FORBIDDEN_TOKEN:${token}`);

const forbiddenDealIds = /DEAL-2026-00(?:4|5|6|9)/g;
for (const match of source.matchAll(forbiddenDealIds)) failures.push(`HARDCODED_PRODUCTION_DEAL:${match[0]}`);

const forbiddenKnownAmounts = [
  '229862.96', '168000', '42000', '6387.04', '33750', '7320', '487320', '439862.96', '47457.04',
];
for (const amount of forbiddenKnownAmounts) if (source.includes(amount)) failures.push(`EXPECTED_VALUE_INJECTION:${amount}`);

const financialNames = '(?:funding_(?:received|spent|remaining|amount)|allocated_funding_amount|acquired_amount|allocation_share|native_residual|remaining_execution|actual_spend)';
const arithmeticPatterns = [
  new RegExp(`${financialNames}[^\\n;]{0,100}[+\\-*/][^=]`, 'gi'),
  new RegExp(`[+\\-*/][^=][^\\n;]{0,100}${financialNames}`, 'gi'),
  /Math\.(?:max|min|round|floor|ceil|abs)\s*\(/g,
  /\.reduce\s*\(/g,
];
let browserFinancialCalculationCount = 0;
for (const pattern of arithmeticPatterns) browserFinancialCalculationCount += [...source.matchAll(pattern)].length;
if (browserFinancialCalculationCount) failures.push(`BROWSER_FINANCIAL_CALCULATION_COUNT:${browserFinancialCalculationCount}`);

const requiredServerFields = [
  'payment_passport', 'funding_received', 'funding_spent', 'funding_remaining', 'funding_currency',
  'funding_events', 'allocated_funding_amount', 'allocation_share', 'allocation_source',
  'acquired_amount', 'acquired_currency', 'conversion_rate', 'conversion_source_basis',
  'settlement_lines', 'unlinked_settlement_lines', 'native_residuals', 'shared_native_residual_refs',
  'funding_status', 'settlement_status', 'residual_status',
];
for (const field of requiredServerFields) if (!source.includes(field)) failures.push(`SERVER_FIELD_NOT_RENDERED:${field}`);

if (!source.includes('ADMIN_PAYMENTS_V7_FUNDING_PAYMENT_PASSPORT_V2')) failures.push('PASSPORT_V2_CONTRACT_MISSING');
if (!source.includes('DIRECT_FUNDING_SIDE_DEBIT_MISSING')) failures.push('REASON_TRANSLATION_MISSING:DIRECT_FUNDING_SIDE_DEBIT_MISSING');
if (!source.includes('SETTLEMENT_LINKAGE_MISSING')) failures.push('REASON_TRANSLATION_MISSING:SETTLEMENT_LINKAGE_MISSING');
if (!source.includes('SETTLEMENT_LINKAGE_AMBIGUOUS')) failures.push('REASON_TRANSLATION_MISSING:SETTLEMENT_LINKAGE_AMBIGUOUS');
if (!source.includes('POLICY_CONTRACT_UNSUPPORTED')) failures.push('REASON_TRANSLATION_MISSING:POLICY_CONTRACT_UNSUPPORTED');

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('NO_EXPECTED_VALUE_INJECTION=PASS');
console.log('NO_HARDCODE=PASS');
console.log(`BROWSER_FINANCIAL_CALCULATION_COUNT=${browserFinancialCalculationCount}`);
console.log('SOURCE_FIRST=PASS');
