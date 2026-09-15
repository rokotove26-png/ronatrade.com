import assert from 'node:assert/strict';
import vm from 'node:vm';
import paymentsRuntime from '../functions/portal/main-ui/payments-v7-owner-passport-ui.js';

function node(tag, attrs = {}, ...children) {
  const value = {
    tag,
    attrs: attrs || {},
    children: children.filter(Boolean),
    append(...items) { this.children.push(...items.filter(Boolean)); return this; },
    querySelector(selector) {
      if (!selector?.startsWith('.')) return null;
      const wanted = selector.slice(1);
      const queue = [...this.children];
      while (queue.length) {
        const current = queue.shift();
        if (!current || typeof current !== 'object') continue;
        const classes = String(current.attrs?.class || '').split(/\s+/);
        if (classes.includes(wanted)) return current;
        queue.push(...(current.children || []));
      }
      return null;
    },
  };
  return value;
}

function textOf(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  const own = value.attrs?.text ? String(value.attrs.text) : '';
  return [own, ...(value.children || []).map(textOf)].filter(Boolean).join(' | ');
}

const sandbox = {
  console,
  Intl,
  Date,
  JSON,
  document: { head: { appendChild() {} } },
  q: () => null,
  e: node,
  paymentsV7Array: (value) => Array.isArray(value) ? value : [],
  paymentsV7Text: (value) => value === null || value === undefined ? '' : String(value).trim(),
  paymentsV7Upper: (value) => value === null || value === undefined ? '' : String(value).trim().toUpperCase(),
  paymentsV7Num: (value) => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  },
  paymentsV7Fmt: (value) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 8 }).format(value),
};
vm.createContext(sandbox);
vm.runInContext(paymentsRuntime + '\nthis.__paymentsUi={paymentsV7Deal,paymentsV7OwnerPassportBody,paymentsV7OwnerReasonText};', sandbox);
const ui = sandbox.__paymentsUi;

function money(amount, currency = 'USD', status = 'AUTHORITATIVE', reason = null) {
  return { amount: amount === undefined ? null : String(amount), currency, status, reason };
}

function settlement(overrides = {}) {
  return {
    payment_at: '2031-04-05T00:00:00Z', recipient: 'Future Supplier', purpose: 'Future settlement',
    amount: '410', currency: 'RUB', row_type: 'SETTLEMENT', bank_document: 'BANK-DOC-FUTURE',
    status: 'AUTHORITATIVE', reason: null, ...overrides,
  };
}

function fundingEvent(overrides = {}) {
  return {
    funding_event_id: 'FUNDING-FUTURE-A', funding_amount: '25', funding_currency: 'USD',
    allocated_funding_amount: '25', direct_funding_side: true, bank_fact_status: 'BANK_CONFIRMED',
    allocation_share: '1', allocation_source: 'EXACT_SINGLE_DEAL', synthetic_allocation: false,
    acquired_amount: null, acquired_currency: null, conversion_rate: null, conversion_source_basis: null,
    bank_document: 'BANK-FUTURE-A', payment_at: '2031-04-01T00:00:00Z', funding_status: 'AUTHORITATIVE',
    funding_reason: null, settlement_status: 'AUTHORITATIVE', settlement_reason: null,
    residual_status: 'AUTHORITATIVE', residual_reason: null, status: 'AUTHORITATIVE', reason: null,
    settlement_lines: [], native_residuals: [], shared_native_residual_refs: [], technical_basis: { finance_event_id: 'TECH-FUTURE-A' },
    ...overrides,
  };
}

function passport(overrides = {}) {
  return {
    contract: 'ADMIN_PAYMENTS_V7_FUNDING_PAYMENT_PASSPORT_V2', deal_id: 'DEAL-FUTURE-ALPHA', funding_currency: 'USD',
    funding_received: money('100'), funding_spent: money('25'), funding_remaining: money('75'),
    funding_status: 'AUTHORITATIVE', funding_reason: null, settlement_status: 'AUTHORITATIVE', settlement_reason: null,
    residual_status: 'AUTHORITATIVE', residual_reason: null, funding_events: [fundingEvent()],
    unlinked_settlement_lines: [], status: 'AUTHORITATIVE', reason: null, ...overrides,
  };
}

function deal(passportValue = passport(), overrides = {}) {
  return { deal_key: 'future-key-alpha', deal_id: 'DEAL-FUTURE-ALPHA', client_display: 'Future Client', financial_status: 'OPEN', payment_passport: passportValue, ...overrides };
}

function renderText(passportValue = passport(), overrides = {}) {
  return textOf(ui.paymentsV7Deal(deal(passportValue, overrides)));
}

// authoritative funding remains visible while secondary settlement/residual are TO_VERIFY
{
  const p = passport({
    settlement_status: 'TO_VERIFY', settlement_reason: 'SETTLEMENT_LINKAGE_MISSING',
    residual_status: 'TO_VERIFY', residual_reason: 'SETTLEMENT_LINKAGE_TO_VERIFY_FOR_RESIDUAL',
    status: 'TO_VERIFY',
    funding_events: [fundingEvent({ settlement_status: 'TO_VERIFY', settlement_reason: 'SETTLEMENT_LINKAGE_MISSING', residual_status: 'TO_VERIFY', residual_reason: 'SETTLEMENT_LINKAGE_TO_VERIFY_FOR_RESIDUAL' })],
  });
  const text = renderText(p);
  assert.match(text, /25\s*USD/);
  assert.match(text, /Расход средств сделки подтверждён/);
  assert.match(text, /Связь оплаты с конкретным funding event требует подтверждения/);
}

// single-deal funding event
assert.match(renderText(), /Прямой банковский дебет/);

// multi-deal funding event displays only backend allocation fields
{
  const shared = fundingEvent({ funding_amount: '100', allocated_funding_amount: '60', allocation_share: '0.6', allocation_source: 'PROPORTIONAL_TO_CONFIRMED_SHARES' });
  const text = renderText(passport({ funding_events: [shared] }));
  assert.match(text, /Общий банковский дебет/);
  assert.match(text, /Доля текущей сделки/);
  assert.match(text, /На текущую сделку отнесено/);
  assert.match(text, /0,6/);
}

// same-currency funding has no fabricated conversion block
{
  const text = renderText(passport({ funding_events: [fundingEvent({ acquired_amount: null, acquired_currency: null })] }));
  assert.doesNotMatch(text, /Фактическая банковская конвертация/);
}

// FX event renders only supplied acquired leg / rate
{
  const text = renderText(passport({ funding_events: [fundingEvent({ acquired_amount: '2050', acquired_currency: 'RUB', conversion_rate: '82', conversion_source_basis: 'BANK_ACTUAL' })] }));
  assert.match(text, /Фактическая банковская конвертация/);
  assert.match(text, /2\s*050\s*RUB|2050\s*RUB/);
  assert.match(text, /Фактический курс/);
}

// several funding events for one Deal
{
  const text = renderText(passport({ funding_events: [fundingEvent(), fundingEvent({ funding_event_id: 'FUNDING-FUTURE-B', bank_document: 'BANK-FUTURE-B' })] }));
  assert.match(text, /операция 1/);
  assert.match(text, /операция 2/);
}

// unlinked settlement facts stay visible; commissions are separate
{
  const text = renderText(passport({ unlinked_settlement_lines: [settlement(), settlement({ row_type: 'COMMISSION', amount: '7', purpose: 'Bank fee' })] }));
  assert.match(text, /Оплаты контрагентам — связь требует подтверждения/);
  assert.match(text, /Комиссии — связь требует подтверждения/);
  assert.match(text, /Future Supplier/);
}

// missing direct funding fails closed and must not become zero
{
  const p = passport({
    funding_spent: money(undefined, 'USD', 'TO_VERIFY', 'DIRECT_FUNDING_SIDE_DEBIT_MISSING'),
    funding_remaining: money(undefined, 'USD', 'TO_VERIFY', 'DIRECT_FUNDING_SIDE_DEBIT_MISSING'),
    funding_status: 'TO_VERIFY', funding_reason: 'DIRECT_FUNDING_SIDE_DEBIT_MISSING', funding_events: [], status: 'TO_VERIFY',
  });
  const text = renderText(p);
  assert.match(text, /Прямой банковский дебет средств сделки не подтверждён/);
  assert.doesNotMatch(text, /Потрачено средств сделки[^|]*\|\s*0\s*USD/);
}

// shared residual is explicitly event-scoped and references related deals
{
  const sharedResidual = { funding_event_id: 'FUNDING-FUTURE-SHARED', scope: 'FUNDING_EVENT_SHARED', amount: null, currency: 'RUB', status: 'TO_VERIFY', reason: 'SETTLEMENT_LINKAGE_MISSING', source_basis: 'FUNDING_EVENT_NATIVE_RESIDUAL', related_deal_ids: ['DEAL-FUTURE-ALPHA', 'DEAL-FUTURE-BETA'] };
  const text = renderText(passport({ funding_events: [fundingEvent({ shared_native_residual_refs: [sharedResidual] })] }));
  assert.match(text, /Общий остаток банковской операции/);
  assert.match(text, /DEAL-FUTURE-BETA/);
}

// incompatible policy is owner-facing fail-closed, not a silent fallback
{
  const p = passport({ funding_status: 'TO_VERIFY', funding_reason: 'POLICY_CONTRACT_UNSUPPORTED', funding_spent: money(undefined, 'USD', 'TO_VERIFY', 'POLICY_CONTRACT_UNSUPPORTED'), status: 'TO_VERIFY' });
  assert.match(renderText(p), /Текущая версия финансовой политики не поддерживается этим интерфейсом/);
}

// arbitrary future Deal renders without a special branch
assert.match(renderText(passport(), { deal_id: 'DEAL-FUTURE-OMEGA' }), /DEAL-FUTURE-OMEGA/);

// contract mismatch must fail closed instead of falling back to a legacy equivalent model
{
  const text = renderText({ ...passport(), contract: 'UNSUPPORTED_CONTRACT' });
  assert.match(text, /Старые equivalent-модели не используются/);
}

console.log('PAYMENTS_V7_FUNDING_FIRST_UI_REGRESSIONS=PASS');
console.log('UI_REGRESSION_COUNT=13');
