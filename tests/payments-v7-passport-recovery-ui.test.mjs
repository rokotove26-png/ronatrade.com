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

function normalizedText(value, opts = {}) {
  return textOf(value, opts).replace(/\s*\|\s*/g, ' ').replace(/\s+/g, ' ').trim();
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
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(`${ownerRuntime}\n${finalRuntime}\n${recoveryRuntime}\nthis.__passportRecovery={paymentsV7Deal,paymentsV7OwnerPassportBody,paymentsV7OwnerPassportTableRenderer};`, sandbox);
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
  return normalizedText(render(passportValue, dealOverrides), { visibleOnly: true });
}

function cellTexts(body, className) {
  return findAll(body, (item) => item.tag === 'td' && hasClass(item, className)).map((item) => normalizedText(item));
}

// Owner-first composition: one dominant receipt, one table, two strong totals, technical detail only at the bottom.
{
  const body = render(passport({ funding_events: [fundingEvent({ settlement_lines: [settlement()] })] }));
  const text = normalizedText(body, { visibleOnly: true });
  for (const label of ['СУММА ПОСТУПЛЕНИЯ', 'Получатель', 'Сумма в валюте поступления', 'Сумма фактического списания', 'ИТОГО ПОТРАЧЕНО', 'ОСТАТОК']) assert.match(text, new RegExp(label));
  assert.equal(findAll(body, (item) => item.tag === 'table').length, 1);
  assert.equal(findAll(body, (item) => hasClass(item, 'rona-payments-v7-owner-total-card')).length, 2);
  assert.doesNotMatch(text, /Funding-side|ИСПОЛЬЗОВАНИЕ СРЕДСТВ СДЕЛКИ|ФАКТИЧЕСКИЕ ОПЛАТЫ|ОПЕРАЦИЯ 1|Internal status|Source basis|Provenance/);
}

// A. USD -> USD direct settlement: funding and actual columns both use supplied authoritative values.
{
  const event = fundingEvent({ funding_amount: '20000', allocated_funding_amount: '20000', settlement_lines: [settlement({ recipient: 'Supplier Direct', amount: '20000', currency: 'USD' })] });
  const body = render(passport({ funding_spent: money('20000'), funding_remaining: money('80000'), funding_events: [event] }));
  assert.deepEqual(cellTexts(body, 'is-funding'), ['20 000 USD']);
  assert.deepEqual(cellTexts(body, 'is-actual'), ['20 000 USD']);
}

// B. USD funding -> RUB settlement: funding stays primary and actual bank debit stays secondary.
{
  const event = fundingEvent({ acquired_amount: '2530000', acquired_currency: 'RUB', conversion_rate: '84.33333333', conversion_source_basis: 'BANK_ACTUAL', settlement_lines: [settlement({ recipient: 'Supplier FX' })] });
  const body = render(passport({ funding_events: [event] }));
  assert.deepEqual(cellTexts(body, 'is-funding'), ['30 000 USD']);
  assert.deepEqual(cellTexts(body, 'is-actual'), ['2 530 000 RUB']);
  assert.doesNotMatch(normalizedText(body, { visibleOnly: true }), /84,33333333|Фактический курс|30 000 USD → 2 530 000 RUB/);
  assert.match(normalizedText(body), /Конвертация 30 000 USD → 2 530 000 RUB/);
  assert.match(normalizedText(body), /Фактический курс 84,33333333/);
}

// C. One conversion -> several settlements without Finance split: do not infer any funding amount per row.
{
  const rows = [
    settlement({ recipient: 'Supplier A', amount: '1000000', bank_document: 'BANK-S1' }),
    settlement({ recipient: 'Supplier B', amount: '900000', bank_document: 'BANK-S2' }),
    settlement({ recipient: 'Supplier C', amount: '630000', bank_document: 'BANK-S3' }),
  ];
  const body = render(passport({ funding_events: [fundingEvent({ acquired_amount: '2530000', acquired_currency: 'RUB', conversion_rate: '84.33333333', settlement_lines: rows })] }));
  assert.deepEqual(cellTexts(body, 'is-funding'), ['Требуется подтверждение', 'Требуется подтверждение', 'Требуется подтверждение']);
  assert.deepEqual(cellTexts(body, 'is-actual'), ['1 000 000 RUB', '900 000 RUB', '630 000 RUB']);
}

// C2. BANK_CONFIRMED + VERIFIED settlement amounts remain visible when only funding linkage/split is unresolved.
// The server emits unlinked settlement rows only after exact authoritative Finance attribution to the Deal;
// SETTLEMENT_LINKAGE_* may therefore affect only the middle funding column, never the actual bank debit.
{
  const unresolvedFundingRows = [
    settlement({ recipient: 'Supplier Confirmed A', amount: '987654.32', currency: 'RUB', status: 'TO_VERIFY', reason: 'SETTLEMENT_LINKAGE_MISSING' }),
    settlement({ recipient: 'Supplier Confirmed B', amount: '765432.10', currency: 'KZT', status: 'TO_VERIFY', reason: 'SETTLEMENT_LINKAGE_AMBIGUOUS' }),
  ];
  const body = render(passport({
    funding_events: [],
    unlinked_settlement_lines: unresolvedFundingRows,
    settlement_status: 'TO_VERIFY',
    settlement_reason: 'SETTLEMENT_LINKAGE_MISSING',
  }));
  assert.deepEqual(cellTexts(body, 'is-funding'), ['Требуется подтверждение', 'Требуется подтверждение']);
  assert.deepEqual(cellTexts(body, 'is-actual'), ['987 654,32 RUB', '765 432,1 KZT']);
}

// D. One conversion -> several settlements with exact Finance split: show only server-provided allocations.
{
  const rows = [
    settlement({ recipient: 'Supplier A', amount: '1000000', allocated_funding_amount: '12000', funding_currency: 'USD', funding_allocation_status: 'AUTHORITATIVE' }),
    settlement({ recipient: 'Supplier B', amount: '900000', allocated_funding_amount: '10000', funding_currency: 'USD', funding_allocation_status: 'AUTHORITATIVE' }),
    settlement({ recipient: 'Supplier C', amount: '630000', allocated_funding_amount: '8000', funding_currency: 'USD', funding_allocation_status: 'AUTHORITATIVE' }),
  ];
  const body = render(passport({ funding_events: [fundingEvent({ acquired_amount: '2530000', acquired_currency: 'RUB', settlement_lines: rows })] }));
  assert.deepEqual(cellTexts(body, 'is-funding'), ['12 000 USD', '10 000 USD', '8 000 USD']);
}

// E. Finance authoritative zero remains exact zero and does not synthesize rows.
{
  const p = passport({ funding_currency: 'RUB', funding_received: money('0', 'RUB'), funding_spent: money('0', 'RUB'), funding_remaining: money('0', 'RUB'), funding_events: [] });
  const body = render(p);
  const text = normalizedText(body, { visibleOnly: true });
  assert.match(text, /СУММА ПОСТУПЛЕНИЯ[\s\S]*0 RUB/);
  assert.match(text, /ИТОГО ПОТРАЧЕНО[\s\S]*0 RUB/);
  assert.match(text, /ОСТАТОК[\s\S]*0 RUB/);
  assert.equal(findAll(body, (item) => hasClass(item, 'rona-payments-v7-owner-table-row')).length, 0);
}

// F. Finance TO_VERIFY remains unresolved; internal codes never surface in the owner layer.
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

// G. Multiple funding events are represented by compact settlement rows, not operation cards.
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

// H. Shared funding uses only the server-supplied deal allocation and does not expose shared technical prose in owner view.
{
  const event = fundingEvent({ funding_amount: '50000', allocated_funding_amount: '30000', allocation_share: '0.6', allocation_source: 'PROPORTIONAL_TO_CONFIRMED_SHARES', settlement_lines: [settlement({ recipient: 'Shared Supplier' })] });
  const body = render(passport({ funding_events: [event] }));
  assert.deepEqual(cellTexts(body, 'is-funding'), ['30 000 USD']);
  assert.doesNotMatch(normalizedText(body, { visibleOnly: true }), /50 000 USD|0,6|PROPORTIONAL_TO_CONFIRMED_SHARES/);
}

// I. Commission remains part of the same table and is visually distinguishable.
{
  const fee = settlement({ recipient: '', row_type: 'COMMISSION', amount: '15', currency: 'USD', purpose: 'Bank fee', allocated_funding_amount: '15', funding_currency: 'USD', funding_allocation_status: 'AUTHORITATIVE' });
  const body = render(passport({ funding_events: [fundingEvent({ settlement_lines: [fee] })] }));
  const text = normalizedText(body, { visibleOnly: true });
  assert.match(text, /Банк \/ комиссия/);
  assert.match(text, /Комиссия/);
  assert.match(text, /15 USD/);
  assert.equal(findAll(body, (item) => hasClass(item, 'is-fee')).length, 1);
}

// J. Native residuals, provenance and internal IDs remain only inside collapsed Technical Grounds.
{
  const marker = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
  const residual = { amount: '1250', currency: 'RUB', status: 'AUTHORITATIVE', reason: null, source_id: marker };
  const p = passport({ funding_events: [fundingEvent({ settlement_lines: [settlement()], native_residuals: [residual], technical_basis: { finance_event_id: marker } })] });
  const body = render(p, { authority_refs: [{ source_type: 'FINANCE_AUTHORITY', source_id: marker }] });
  const visibleText = normalizedText(body, { visibleOnly: true });
  const fullText = normalizedText(body);
  assert.doesNotMatch(visibleText, /1 250 RUB|aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee|Passport contract|Internal status|Authority refs|Provenance/);
  assert.match(fullText, new RegExp(marker));
  const technical = findAll(body, (item) => hasClass(item, 'rona-payments-v7-passport-technical'));
  assert.equal(technical.length, 1);
  assert.match(normalizedText(technical[0]), /Технические основания/);
}

// K. Arbitrary future Deal uses the same renderer; no registration or Deal-specific code is required.
assert.match(normalizedText(renderDeal(passport(), { deal_id: 'FUTURE-UNSEEN-DEAL-X91' })), /FUTURE-UNSEEN-DEAL-X91/);

// Renderer pin: activation can target a stable owner-table renderer even if generic binding is later shadowed.
assert.equal(ui.paymentsV7OwnerPassportTableRenderer, ui.paymentsV7OwnerPassportBody);
assert.equal(ui.paymentsV7OwnerPassportTableRenderer.__ronaOwnerTableVersion, 'OWNER_TABLE_V2');

// Premium UI contract: money aligned, currencies separated, compact row density, hover/focus, long-recipient safety and notebook responsiveness.
{
  const source = String(recoveryRuntime);
  for (const token of [
    'PAYMENTS_V7_PASSPORT_OWNER_TABLE_V2',
    'rona-payments-v7-owner-money-amount',
    'rona-payments-v7-owner-money-currency',
    'text-align:right',
    'font-variant-numeric:tabular-nums',
    'rona-payments-v7-owner-table-row:hover',
    'summary:focus-visible',
    'overflow-wrap:anywhere',
    '@media(max-width:1180px)',
    '@media(max-width:900px)',
  ]) assert.match(source, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(source, /DEAL-2026-00(?:4|5|6|9)/);
  assert.doesNotMatch(source, /229862\.96|168000|42000|6387\.04|33750|7320|439862\.96|47457\.04/);
}

console.log('OWNER_TABLE=PASS');
console.log('VISUAL_HIERARCHY=PASS');
console.log('INFORMATION_DENSITY=PASS');
console.log('PRIMARY_TABLE_READABILITY=PASS');
console.log('TOTALS_VISUAL_PRIORITY=PASS');
console.log('FUNDING_AMOUNT_COLUMN=PASS');
console.log('ACTUAL_SETTLEMENT_COLUMN=PASS');
console.log('CONFIRMED_SETTLEMENT_ALWAYS_VISIBLE=PASS');
console.log('FUNDING_SPLIT_ONLY_AFFECTS_MIDDLE_COLUMN=PASS');
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
