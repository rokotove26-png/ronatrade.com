import { resolveAuthorityClaims } from './authority.mjs';
import { canonicalDecimalString, decimalAdd, decimalCompare, decimalToString, parseDecimal } from './decimal.mjs';
import { moneyValue, toVerifyMoney } from './money.mjs';

function upper(value) { return value === null || value === undefined ? null : String(value).trim().toUpperCase(); }
function chainSignature(chain) {
  return JSON.stringify({ payment_key: String(chain.payment_key), deal_key: String(chain.deal_key), native_amount: canonicalDecimalString(chain.native_amount), native_currency: upper(chain.native_currency), accounting_amount: canonicalDecimalString(chain.accounting_amount), accounting_currency: upper(chain.accounting_currency) });
}
function spendEligible(payment) {
  return payment.direction === 'OUTGOING'
    && payment.bank_fact_status === 'BANK_CONFIRMED'
    && ['VERIFIED', 'PAID', 'CONFIRMED'].includes(payment.finance_verification_status)
    && payment.kind !== 'FX_CONVERSION';
}

export function computeDealSpend({ dealKey, accountingCurrency, payments, reconciliations, resourceChains, capability }) {
  if (!accountingCurrency) return { value: toVerifyMoney(null, 'ACCOUNTING_CURRENCY_TO_VERIFY'), status: 'TO_VERIFY', issues: ['ACCOUNTING_CURRENCY_TO_VERIFY'] };
  let total = parseDecimal('0'); let authoritativeComponents = 0; const issues = []; const refs = [];
  for (const payment of payments || []) {
    if (!spendEligible(payment)) continue;
    const reconciliation = reconciliations.get(String(payment.payment_key));
    if (!reconciliation || reconciliation.business_disposition === 'ASSIGN_ADVANCE_PAYMENT') continue;
    const scopeTouchesDeal = (reconciliation.scope_deal_keys || []).some((key) => String(key) === String(dealKey));
    if (reconciliation.status !== 'AUTHORITATIVE') {
      if (scopeTouchesDeal) { issues.push(reconciliation.integrity_reason || reconciliation.reason || reconciliation.reconciliation_class); refs.push(...(reconciliation.authority_refs || [])); }
      continue;
    }
    if (reconciliation.reconciliation_class === 'ASSOCIATED_BANK_FEE' && reconciliation.fee_attribution_state === 'NOT_APPLICABLE') continue;
    const lines = (reconciliation.current_lines || []).filter((line) => String(line.deal_key) === String(dealKey));
    if (!lines.length) continue;
    if (reconciliation.integrity_status !== 'AUTHORITATIVE') {
      issues.push(reconciliation.integrity_reason || 'ATTRIBUTION_INTEGRITY_ERROR');
      refs.push(...(reconciliation.authority_refs || []));
      continue;
    }
    for (const line of lines) {
      refs.push(...(reconciliation.authority_refs || []));
      if (upper(line.currency) !== upper(payment.currency)) { issues.push('ATTRIBUTION_PAYMENT_CURRENCY_MISMATCH'); continue; }
      if (upper(payment.currency) === upper(accountingCurrency)) {
        total = decimalAdd(total, line.amount); authoritativeComponents += 1; continue;
      }
      const chains = (resourceChains || []).filter((chain) => String(chain.payment_key) === String(payment.payment_key) && String(chain.deal_key) === String(dealKey));
      const resolved = resolveAuthorityClaims(chains, chainSignature);
      if (resolved.status !== 'AUTHORITATIVE') {
        issues.push(resolved.status === 'TO_VERIFY' ? 'RESOURCE_CHAIN_AUTHORITY_CONFLICT' : (capability ? 'EXACT_RESOURCE_CHAIN_MISSING' : 'AUTHORITY_MATERIALIZATION_REQUIRED'));
        continue;
      }
      const chain = resolved.claim;
      if (upper(chain.native_currency) !== upper(payment.currency) || decimalCompare(chain.native_amount, line.amount) !== 0 || upper(chain.accounting_currency) !== upper(accountingCurrency)) {
        issues.push('RESOURCE_CHAIN_SCOPE_MISMATCH'); continue;
      }
      total = decimalAdd(total, chain.accounting_amount); authoritativeComponents += 1; refs.push(...resolved.authority_refs);
    }
  }
  if (!issues.length) return { value: moneyValue(decimalToString(total), accountingCurrency, 'AUTHORITATIVE', null, refs), status: 'AUTHORITATIVE', issues: [] };
  if (authoritativeComponents > 0) return { value: moneyValue(decimalToString(total), accountingCurrency, 'TO_VERIFY', 'PARTIAL_TO_VERIFY', refs), status: 'PARTIAL_TO_VERIFY', issues: [...new Set(issues)] };
  return { value: toVerifyMoney(accountingCurrency, issues[0], refs), status: 'TO_VERIFY', issues: [...new Set(issues)] };
}
