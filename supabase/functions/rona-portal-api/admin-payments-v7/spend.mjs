import { resolveAuthorityClaims } from './authority.mjs';
import { decimalAdd, decimalCompare, decimalToString, parseDecimal } from './decimal.mjs';
import { moneyValue, toVerifyMoney } from './money.mjs';

function upper(value) { return value === null || value === undefined ? null : String(value).toUpperCase(); }

function chainSignature(chain) {
  return JSON.stringify({
    payment_key: chain.payment_key,
    deal_key: chain.deal_key,
    native_amount: String(chain.native_amount),
    native_currency: chain.native_currency,
    accounting_amount: String(chain.accounting_amount),
    accounting_currency: chain.accounting_currency,
  });
}

function spendEligible(payment) {
  return payment.direction === 'OUTGOING'
    && payment.bank_fact_status === 'BANK_CONFIRMED'
    && ['VERIFIED', 'PAID', 'CONFIRMED'].includes(payment.finance_verification_status)
    && payment.kind !== 'FX_CONVERSION';
}

export function computeDealSpend({ dealKey, accountingCurrency, payments, reconciliations, resourceChains, capability }) {
  if (!accountingCurrency) return { value: toVerifyMoney(null, 'ACCOUNTING_CURRENCY_TO_VERIFY'), status: 'TO_VERIFY', issues: ['ACCOUNTING_CURRENCY_TO_VERIFY'] };
  let total = parseDecimal('0');
  let authoritativeComponents = 0;
  const issues = [];
  const refs = [];
  for (const payment of payments) {
    if (!spendEligible(payment)) continue;
    const reconciliation = reconciliations.get(payment.payment_key);
    if (!reconciliation || reconciliation.business_disposition === 'ASSIGN_ADVANCE_PAYMENT') continue;
    const lines = reconciliation.current_lines.filter((line) => String(line.deal_key) === String(dealKey));
    const scopeTouchesDeal = (reconciliation.scope_deal_keys || []).some((key) => String(key) === String(dealKey));
    if (!lines.length && scopeTouchesDeal && reconciliation.reconciliation_class !== 'FX_CONVERSION_NOT_APPLICABLE') {
      issues.push(reconciliation.reason || 'DEAL_ATTRIBUTION_TO_VERIFY');
      refs.push(...(reconciliation.authority_refs || []));
      continue;
    }
    for (const line of lines) {
      if (line.currency !== payment.currency) {
        issues.push('ATTRIBUTION_PAYMENT_CURRENCY_MISMATCH');
        continue;
      }
      refs.push(...(reconciliation.authority_refs || []));
      if (payment.currency === accountingCurrency) {
        total = decimalAdd(total, line.amount);
        authoritativeComponents += 1;
        continue;
      }
      const chains = (resourceChains || []).filter((chain) => String(chain.payment_key) === String(payment.payment_key) && String(chain.deal_key) === String(dealKey));
      const resolved = resolveAuthorityClaims(chains, chainSignature);
      if (resolved.status !== 'AUTHORITATIVE') {
        issues.push(resolved.status === 'TO_VERIFY' ? 'RESOURCE_CHAIN_AUTHORITY_CONFLICT' : (capability ? 'EXACT_RESOURCE_CHAIN_MISSING' : 'AUTHORITY_MATERIALIZATION_REQUIRED'));
        continue;
      }
      const chain = resolved.claim;
      if (chain.native_currency !== payment.currency || decimalCompare(chain.native_amount, line.amount) !== 0 || chain.accounting_currency !== accountingCurrency) {
        issues.push('RESOURCE_CHAIN_SCOPE_MISMATCH');
        continue;
      }
      total = decimalAdd(total, chain.accounting_amount);
      authoritativeComponents += 1;
      refs.push(...resolved.authority_refs);
    }
  }
  if (!issues.length) {
    return { value: moneyValue(decimalToString(total), accountingCurrency, 'AUTHORITATIVE', null, refs), status: 'AUTHORITATIVE', issues: [] };
  }
  if (authoritativeComponents > 0) {
    return {
      value: moneyValue(decimalToString(total), accountingCurrency, 'TO_VERIFY', 'PARTIAL_TO_VERIFY', refs),
      status: 'PARTIAL_TO_VERIFY',
      issues: [...new Set(issues)],
    };
  }
  return { value: toVerifyMoney(accountingCurrency, issues[0], refs), status: 'TO_VERIFY', issues: [...new Set(issues)] };
}
