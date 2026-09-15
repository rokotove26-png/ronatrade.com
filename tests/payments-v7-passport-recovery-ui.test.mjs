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

function hasClass(value, className) {
  return String(value?.attrs?.class || '').split(/\s+/).includes(className);
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

// Owner-facing structure: one received amount, one payment table, totals, collapsed details.
{
  const body = render(passport({ funding_events: [fundingEvent({ settlement_lines: [settlement()] })] }));
  const text = textOf(body, { visibleOnly: true });
  for (const label of ['СУММА ПОСТУПЛЕНИЯ', 'Получатель', 'Сумма в валюте поступления', 'Сумма фактического списания', 'ИТОГО ПОТРАЧЕНО', 'ОСТАТОК']) assert.match(text, new RegExp(label));
  assert.equal(findAll(body, (item) => item.tag === 'table').length, 1);
  assert.doesNotMatch(text, /Funding-side|ИСПОЛЬЗОВАНИЕ СРЕДСТВ СДЕЛКИ|ФАКТИЧЕСКИЕ ОПЛАТЫ|КОМИССИИ|Остатки в иных валютах|Internal status|Source basis/);
}

// A. Direct USD payment: one linked settlement may use the authoritative event amount without any split calculation.
{
  const event = fundingEvent({ funding_amount: '20000', allocated_funding_amount: '20000', settlement_lines: [settlement({ recipient: 'Supplier Direct', amount: '20000', currency: 'USD' })] });
  const body = render(passport({ funding_spent: money('20000'), funding_remaining: money('80000'), funding_events: [event] }));
  const fundingCells = findAll(body, (item) => item.tag === 'td' && hasClass(item, 'is-funding')).map(textOf);
  const actualCells = findAll(body, (item) => item.tag === 'td' && hasClass(item, 'is-actual')).map(textOf);
  assert.deepEqual(fundingCells, ['20 000 USD']);
  assert.deepEqual(actualCells, ['20 000 USD']);
}

// B. USD funding -> RUB settlement: funding is primary, actual settlement is secondary.
{
  const event = fundingEvent({ acquired_amount: '2530000', acquired_currency: 'RUB', conversion_rate: '84.33333333', conversion_source_basis: 'BANK_ACTUAL', settlement_lines: [settlement({ recipient: 'Supplier FX' })] });
  const body = render(passport({ funding_events: [event] }));
  const fundingCells = findAll(body, (item) => item.tag === 'td' && hasClass(item, 'is-funding')).map(textOf);
  const actualCells = findAll(body, (item) => item.tag === 'td' && hasClass(item, 'is-actual')).map(textOf);
  assert.deepEqual(fundingCells, ['30 000 USD']);
  assert.deepEqual(actualCells, ['2 530 000 RUB']);
  assert.doesNotMatch(textOf(body, { visibleOnly: true }), /84,33333333|Курс конвертации/);
  assert.match(textOf(body), /Курс конвертации[\s\S]*84,33333333/);
}

// C. One conversion -> several settlements without authoritative split: every funding column stays unresolved.
{
  const rows = [
    settlement({ recipient: 'Supplier A', amount: '1000000', bank_document: 'BANK-S1' }),
    settlement({ recipient: 'Supplier B', amount: '900000', bank_document: 'BANK-S2' }),
    settlement({ recipient: 'Supplier C', amount: '630000', bank_document: 'BANK-S3' }),
  ];
  const body = render(passport({ funding_events: [fundingEvent({ acquired_amount: '2530000', acquired_currency: 'RUB', conversion_rate: '84.33333333', settlement_lines: rows })] }));
  const fundingCells = findAll(body, (item) => item.tag === 'td' && hasClass(item, 'is-funding')).map(textOf);
  assert.deepEqual(fundingCells, ['Требуется подтверждение', 'Требуется подтверждение', 'Требуется подтверждение']);
  const actualCells = findAll(body, (item) => item.tag === 'td' && hasClass(item, 'is-actual')).map(textOf);
  assert.deepEqual(actualCells, ['1 000 000 RUB', '900 000 RUB', '630 000 RUB']);
}

// D. Exact per-settlement funding allocation is shown only when supplied by the server.
{
  const rows = [
    settlement({ recipient: 'Supplier A', amount: '1000000', allocated_funding_amount: '12000', funding_currency: 'USD', funding_allocation_status: 'AUTHORITATIVE' }),
    settlement({ recipient: 'Supplier B', amount: '900000', allocated_funding_amount: '10000', funding_currency: 'USD', funding_allocation_status: 'AUTHORITATIVE' }),
    settlement({ recipient: 'Supplier C', amount: '630000', allocated_funding_amount: '8000', funding_currency: 'USD', funding_allocation_status: 'AUTHORITATIVE' }),
  ];
  const body = render(passport({ funding_events: [fundingEvent({ acquired_amount: '2530000', acquired_currency: 'RUB', settlement_lines: rows })] }));
  const fundingCells = findAll(body, (item) => item.tag === 'td' && hasClass(item, 'is-funding')).map(textOf);
  assert.deepEqual(fundingCells, ['12 000 USD', '10 000 USD', '8 000 USD']);
}

// E. Finance authoritative zero stays exact zero without synthetic rows.
{
  const p = passport({ funding_currency: 'RUB', funding_received: money('0', 'RUB'), funding_spent: money('0', 'RUB'), funding_remaining: money('0', 'RUB'), funding_events: [] });
  const text = visible(p);
  assert.match(text, /СУММА ПОСТУПЛЕНИЯ[\s\S]*0 RUB/);
  assert.match(text, /ИТОГО ПОТРАЧЕНО[\s\S]*0 RUB/);
  assert.match(text, /ОСТАТОК[\s\S]*0 RUB/);
}

// F. Finance TO_VERIFY stays unresolved and internal status tokens do not leak into the main document.
{
  const p = passport({
    funding_spent: money(undefined, 'USD', 'TO_VERIFY', 'CURRENT_FINANCE_AUTHORITY_TO_VERIFY'),
    funding_remaining: money(undefined, 'USD', 'TO_VERIFY', 'CURRENT_FINANCE_AUTHORITY_TO_VERIFY'),
    funding_status: 'TO_VERIFY', funding_reason: 'CURRENT_FINANCE_AUTHORITY_TO_VERIFY', funding_events: [], status: 'TO_VERIFY',
  });
  const text = visible(p);
  assert.match(text, /ИТОГО ПОТРАЧЕНО[\s\S]*Требуется подтверждение/);
  assert.match(text, /ОСТАТОК[\s\S]*Требуется подтверждение/);
  assert.doesNotMatch(text, /TO_VERIFY|CURRENT_FINANCE/);
}

// G. Multiple funding events produce the same generic table rows without operation cards.
{
  const events = [
    fundingEvent({ funding_amount: '12000', allocated_funding_amount: '12000', settlement_lines: [settlement({ recipient: 'Supplier One', amount: '12000', currency: 'USD' })] }),
    fundingEvent({ funding_event_id: 'FUNDING-GENERIC-B', funding_amount: '5000', allocated_funding_amount: '5000', settlement_lines: [settlement({ recipient: 'Supplier Two', amount: '5000', currency: 'USD' })] }),
  ];
  const text = visible(passport({ funding_events: events }));
  assert.match(text, /Supplier One/);
  assert.match(text, /Supplier Two/);
  assert.doesNotMatch(text, /ОПЕРАЦИЯ 1|ОПЕРАЦИЯ 2/);
}

// H. Shared funding uses the server-supplied deal allocation for a single linked settlement.
{
  const event = fundingEvent({ funding_amount: '50000', allocated_funding_amount: '30000', allocation_share: '0.6', allocation_source: 'PROPORTIONAL_TO_CONFIRMED_SHARES', settlement_lines: [settlement({ recipient: 'Shared Supplier' })] });
  const body = render(passport({ funding_events: [event] }));
  const fundingCells = findAll(body, (item) => item.tag === 'td' && hasClass(item, 'is-funding')).map(textOf);
  assert.deepEqual(fundingCells, ['30 000 USD']);
  assert.doesNotMatch(textOf(body, { visibleOnly: true }), /50 000 USD|0,6|PROPORTIONAL_TO_CONFIRMED_SHARES/);
}

// I. Commission is a table row, not a separate visual section.
{
  const fee = settlement({ recipient: '', row_type: 'COMMISSION', amount: '15', currency: 'USD', purpose: 'Bank fee', allocated_funding_amount: '15', funding_currency: 'USD', funding_allocation_status: 'AUTHORITATIVE' });
  const body = render(passport({ funding_events: [fundingEvent({ settlement_lines: [fee] })] }));
  const text = visible(passport({ funding_events: [fundingEvent({ settlement_lines: [fee] })] }));
  assert.match(text, /Банк \/ комиссия/);
  assert.match(text, /15 USD/);
  assert.equal(findAll(body, (item) => item.tag === 'table').length, 1);
}

// J. Native residuals and provenance are outside the main visual level and remain inside Technical Grounds.
{
  const marker = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
  const residual = { amount: '1250', currency: 'RUB', status: 'AUTHORITATIVE', reason: null, source_id: marker };
  const p = passport({ funding_events: [fundingEvent({ settlement_lines: [settlement()], native_residuals: [residual], technical_basis: { finance_event_id: marker } })] });
  const body = render(p, { authority_refs: [{ source_type: 'FINANCE_AUTHORITY', source_id: marker }] });
  const visibleText = textOf(body, { visibleOnly: true });
  const fullText = textOf(body);
  assert.doesNotMatch(visibleText, /1 250 RUB|aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee|Passport contract|Internal status|Authority refs|Provenance/);
  assert.match(fullText, /aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee/);
  const technical = findAll(body, (item) => item.tag === 'details' && hasClass(item, 'rona-payments-v7-passport-technical'));
  assert.equal(technical.length, 1);
  assert.match(textOf(technical[0]), /Технические основания/);
}

// K. Arbitrary future Deal renders through the existing generic Payments path.
assert.match(textOf(renderDeal(passport(), { deal_id: 'FUTURE-UNSEEN-DEAL-X91' })), /FUTURE-UNSEEN-DEAL-X91/);

const source = String(recoveryRuntime);
assert.match(source, /PAYMENTS_V7_PASSPORT_OWNER_TABLE_V1/);
assert.doesNotMatch(source, /DEAL-2026-00(?:4|5|6|9)/);
assert.doesNotMatch(source, /229862\.96|168000|42000|6387\.04|33750|7320|439862\.96|47457\.04/);
assert.doesNotMatch(source, /acquired_amount\s*\/|funding_amount\s*\/|conversion_rate\s*\*/);

console.log('OWNER_TABLE=PASS');
console.log('FUNDING_AMOUNT_COLUMN=PASS');
console.log('ACTUAL_SETTLEMENT_COLUMN=PASS');
console.log('TOTAL_SPENT_VISIBLE=PASS');
console.log('REMAINING_VISIBLE=PASS');
console.log('TECHNICAL_DETAILS_COLLAPSED=PASS');
console.log('FUNDING_CURRENCY_PRIMARY=PASS');
console.log('SETTLEMENT_SECONDARY=PASS');
console.log('MULTI_SETTLEMENT_NO_INFERRED_SPLIT=PASS');
console.log('ZERO_FROM_FINANCE=PASS');
console.log('TO_VERIFY_FROM_FINANCE=PASS');
console.log('FUTURE_DEAL_GENERIC=PASS');
console.log('NO_HARDCODE=PASS');
