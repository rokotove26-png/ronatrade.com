import assert from 'node:assert/strict';
import vm from 'node:vm';
import ownerRuntime from '../functions/portal/main-ui/payments-v7-owner-passport-ui.js';
import finalRuntime from '../functions/portal/main-ui/payments-v7-final-display-contract.js';
import recoveryRuntime from '../functions/portal/main-ui/payments-v7-passport-recovery-ui.js';

function node(tag, attrs = {}, ...children) {
  return {
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
}

function textOf(value, { visibleOnly = false } = {}) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (visibleOnly && value.tag === 'details') return '';
  const own = value.attrs?.text ? String(value.attrs.text) : '';
  return [own, ...(value.children || []).map((child) => textOf(child, { visibleOnly }))].filter(Boolean).join(' | ');
}

function findAll(value, predicate, out = []) {
  if (!value || typeof value !== 'object') return out;
  if (predicate(value)) out.push(value);
  for (const child of value.children || []) findAll(child, predicate, out);
  return out;
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
vm.runInContext(`${ownerRuntime}\n${finalRuntime}\n${recoveryRuntime}\nthis.__passportRecovery={paymentsV7Deal,paymentsV7OwnerPassportBody};`, sandbox);
const ui = sandbox.__passportRecovery;

function money(amount, currency = 'USD', status = 'AUTHORITATIVE', reason = null) {
  return { amount: amount === undefined ? null : String(amount), currency, status, reason };
}

function settlement(overrides = {}) {
  return {
    payment_at: '2032-05-07T00:00:00Z', recipient: 'Supplier X', purpose: 'Goods payment',
    amount: '2530000', currency: 'RUB', row_type: 'SETTLEMENT', bank_document: 'BANK-SETTLE-X',
    status: 'AUTHORITATIVE', reason: null, ...overrides,
  };
}

function fundingEvent(overrides = {}) {
  return {
    funding_event_id: 'FUNDING-GENERIC-A', funding_amount: '30000', funding_currency: 'USD',
    allocated_funding_amount: '30000', allocation_share: '1', allocation_source: 'EXACT_SINGLE_DEAL',
    acquired_amount: null, acquired_currency: null, conversion_rate: null, conversion_source_basis: null,
    bank_document: 'BANK-FUND-A', payment_at: '2032-05-06T00:00:00Z', funding_status: 'AUTHORITATIVE', funding_reason: null,
    settlement_lines: [], native_residuals: [], shared_native_residual_refs: [], technical_basis: { finance_event_id: 'TECH-GENERIC-A' },
    ...overrides,
  };
}

function passport(overrides = {}) {
  return {
    contract: 'ADMIN_PAYMENTS_V7_FUNDING_PAYMENT_PASSPORT_V2', deal_id: 'DEAL-GENERIC-ALPHA', funding_currency: 'USD',
    funding_received: money('100000'), funding_spent: money('30000'), funding_remaining: money('70000'),
    funding_status: 'AUTHORITATIVE', funding_reason: null, settlement_status: 'AUTHORITATIVE', settlement_reason: null,
    residual_status: 'AUTHORITATIVE', residual_reason: null, funding_events: [fundingEvent()],
    unlinked_settlement_lines: [], status: 'AUTHORITATIVE', reason: null, ...overrides,
  };
}

function deal(passportValue = passport(), overrides = {}) {
  return {
    deal_key: 'future-key-generic', deal_id: 'DEAL-GENERIC-ALPHA', client_display: 'Generic Client',
    financial_status: 'OPEN', documentary_status: 'CONFIRMED', authority_refs: [], payment_passport: passportValue,
    ...overrides,
  };
}

function render(passportValue = passport(), dealOverrides = {}) {
  const currentDeal = deal(passportValue, dealOverrides);
  return ui.paymentsV7OwnerPassportBody(currentDeal, passportValue);
}

function renderDeal(passportValue = passport(), dealOverrides = {}) {
  return ui.paymentsV7Deal(deal(passportValue, dealOverrides));
}

function visible(passportValue = passport(), dealOverrides = {}) {
  return textOf(render(passportValue, dealOverrides), { visibleOnly: true });
}

// A. USD received -> USD paid.
{
  const p = passport({ funding_events: [fundingEvent({ acquired_amount: null, acquired_currency: null, settlement_lines: [settlement({ amount: '30000', currency: 'USD' })] })] });
  const text = visible(p);
  assert.match(text, /Потрачено средств сделки/);
  assert.match(text, /30[\s\u00a0]*000\s*USD/);
  assert.match(text, /Фактические оплаты/);
  assert.doesNotMatch(text, /Конвертация · операция/);
}

// B. USD funding -> RUB conversion -> RUB settlement. Funding spend remains primary.
{
  const p = passport({ funding_events: [fundingEvent({ acquired_amount: '2530000', acquired_currency: 'RUB', conversion_rate: '84.33333333', conversion_source_basis: 'BANK_ACTUAL', settlement_lines: [settlement()] })] });
  const text = visible(p);
  assert.match(text, /Получено от клиента[\s\S]*100[\s\u00a0]*000\s*USD/);
  assert.match(text, /Потрачено средств сделки[\s\S]*30[\s\u00a0]*000\s*USD/);
  assert.match(text, /Конвертация · операция 1/);
  assert.match(text, /2[\s\u00a0]*530[\s\u00a0]*000\s*RUB/);
  assert.match(text, /Фактическая оплата[\s\S]*2[\s\u00a0]*530[\s\u00a0]*000\s*RUB/);
}

// C. One conversion -> several RUB settlements without Finance USD split: no inferred per-payment funding split.
{
  const rows = [
    settlement({ amount: '1000000', bank_document: 'BANK-S1' }),
    settlement({ amount: '900000', bank_document: 'BANK-S2' }),
    settlement({ amount: '630000', bank_document: 'BANK-S3' }),
  ];
  const p = passport({ funding_events: [fundingEvent({ acquired_amount: '2530000', acquired_currency: 'RUB', conversion_rate: '84.33333333', conversion_source_basis: 'BANK_ACTUAL', settlement_lines: rows })] });
  const text = visible(p);
  assert.match(text, /1[\s\u00a0]*000[\s\u00a0]*000\s*RUB/);
  assert.match(text, /900[\s\u00a0]*000\s*RUB/);
  assert.match(text, /630[\s\u00a0]*000\s*RUB/);
  assert.doesNotMatch(text, /Authoritative funding split/);
}

// D. The UI may show a split only when the server row explicitly carries authoritative funding allocation fields.
{
  const rows = [
    settlement({ amount: '1000000', allocated_funding_amount: '12000', funding_currency: 'USD', funding_allocation_status: 'AUTHORITATIVE' }),
    settlement({ amount: '900000', allocated_funding_amount: '10000', funding_currency: 'USD', funding_allocation_status: 'AUTHORITATIVE' }),
    settlement({ amount: '630000', allocated_funding_amount: '8000', funding_currency: 'USD', funding_allocation_status: 'AUTHORITATIVE' }),
  ];
  const text = visible(passport({ funding_events: [fundingEvent({ acquired_amount: '2530000', acquired_currency: 'RUB', settlement_lines: rows })] }));
  assert.match(text, /Authoritative funding split/);
  assert.match(text, /12[\s\u00a0]*000\s*USD/);
  assert.match(text, /10[\s\u00a0]*000\s*USD/);
  assert.match(text, /8[\s\u00a0]*000\s*USD/);
}

// E. Finance authoritative zero is shown as zero without a synthetic funding event.
{
  const p = passport({ funding_currency: 'RUB', funding_received: money('0', 'RUB'), funding_spent: money('0', 'RUB'), funding_remaining: money('0', 'RUB'), funding_events: [] });
  const text = visible(p);
  assert.match(text, /Потрачено средств сделки[\s\S]*0\s*RUB/);
  assert.match(text, /Подтверждённых funding-side операций нет/);
  assert.doesNotMatch(text, /TO_VERIFY —/);
}

// F. Unresolved Finance spend stays TO_VERIFY and never becomes zero.
{
  const p = passport({
    funding_spent: money(undefined, 'USD', 'TO_VERIFY', 'CURRENT_FINANCE_AUTHORITY_TO_VERIFY'),
    funding_remaining: money(undefined, 'USD', 'TO_VERIFY', 'CURRENT_FINANCE_AUTHORITY_TO_VERIFY'),
    funding_status: 'TO_VERIFY', funding_reason: 'CURRENT_FINANCE_AUTHORITY_TO_VERIFY', funding_events: [], status: 'TO_VERIFY',
  });
  const text = visible(p);
  assert.match(text, /TO_VERIFY/);
  assert.doesNotMatch(text, /Потрачено средств сделки[\s\S]{0,80}0\s*USD/);
}

// G. Multiple funding events for one Deal are shown independently.
{
  const text = visible(passport({ funding_events: [fundingEvent(), fundingEvent({ funding_event_id: 'FUNDING-GENERIC-B', bank_document: 'BANK-FUND-B', funding_amount: '5000', allocated_funding_amount: '5000' })] }));
  assert.match(text, /Операция 1/);
  assert.match(text, /Операция 2/);
}

// H. Shared funding event: only server-supplied allocation/share is used for current Deal.
{
  const event = fundingEvent({ funding_amount: '50000', allocated_funding_amount: '30000', allocation_share: '0.6', allocation_source: 'PROPORTIONAL_TO_CONFIRMED_SHARES' });
  const text = visible(passport({ funding_events: [event] }));
  assert.match(text, /Использовано средств сделки[\s\S]*30[\s\u00a0]*000\s*USD/);
  assert.match(text, /Общий банковский дебет[\s\S]*50[\s\u00a0]*000\s*USD/);
  assert.match(text, /Доля сделки[\s\S]*0,6/);
}

// I. Bank commission: authoritative fee is isolated in Commission section.
{
  const fee = settlement({ row_type: 'COMMISSION', amount: '15', currency: 'USD', purpose: 'Bank fee' });
  const text = visible(passport({ funding_events: [fundingEvent({ settlement_lines: [fee] })] }));
  assert.match(text, /Комиссии/);
  assert.match(text, /15\s*USD/);
  assert.doesNotMatch(text, /Фактическая оплата[\s\S]{0,80}15\s*USD/);
}

// J. Native residual is visibly separate from funding-currency remaining.
{
  const residual = { amount: '1250', currency: 'RUB', status: 'AUTHORITATIVE', reason: null, related_deal_ids: [] };
  const text = visible(passport({ funding_events: [fundingEvent({ acquired_amount: '2530000', acquired_currency: 'RUB', native_residuals: [residual] })] }));
  assert.match(text, /Остаток в funding currency[\s\S]*70[\s\u00a0]*000\s*USD/);
  assert.match(text, /Native residuals после конвертации/);
  assert.match(text, /1[\s\u00a0]*250\s*RUB/);
}

// K. Arbitrary future Deal ID renders through the same path.
assert.match(textOf(renderDeal(passport(), { deal_id: 'FUTURE-UNSEEN-DEAL-X91' })), /FUTURE-UNSEEN-DEAL-X91/);

// Raw provenance exists only inside the collapsed Technical Grounds details.
{
  const marker = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
  const p = passport({ funding_events: [fundingEvent({ technical_basis: { finance_event_id: marker, source_refs: [{ source_type: 'BANK', source_id: marker }] } })] });
  const body = render(p, { authority_refs: [{ source_type: 'FINANCE_AUTHORITY', source_id: marker }] });
  const visibleText = textOf(body, { visibleOnly: true });
  const fullText = textOf(body);
  assert.doesNotMatch(visibleText, new RegExp(marker));
  assert.match(fullText, new RegExp(marker));
  assert.doesNotMatch(fullText, /Источник и provenance/);
  const details = findAll(body, (item) => item.tag === 'details');
  assert.equal(details.length, 1);
  assert.match(textOf(details[0]), /Технические основания/);
}

console.log('PASSPORT_RECOVERY_SCENARIOS_A_K=PASS');
console.log('FUNDING_CURRENCY_PRIMARY=PASS');
console.log('SETTLEMENT_SECONDARY=PASS');
console.log('MULTI_SETTLEMENT_NO_INFERRED_SPLIT=PASS');
console.log('ZERO_FROM_FINANCE=PASS');
console.log('TO_VERIFY_FROM_FINANCE=PASS');
console.log('RAW_PROVENANCE_HIDDEN=PASS');
console.log('FUTURE_DEAL_GENERIC=PASS');
