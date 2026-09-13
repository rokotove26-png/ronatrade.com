const OWNER = 'ADMIN_PAYMENTS_V7_NATIVE';

export const ADMIN_PAYMENTS_V7_ROUTE_OWNER = OWNER;

const asArray = (value) => Array.isArray(value) ? value : [];
const text = (value) => String(value ?? '').trim();
const upper = (value) => text(value).toUpperCase();
const esc = (value) => text(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

function projectionFrom(data) {
  const projection = data?.paymentsV7Projection;
  if (!projection || projection.contract !== 'ADMIN_PAYMENTS_V7') throw new Error('ADMIN_PAYMENTS_V7_PROJECTION_REQUIRED');
  return projection;
}

function finiteNumber(value) {
  if (value === null || value === undefined) return null;
  const raw = text(value);
  if (!raw) return null;
  const number = Number(raw);
  return Number.isFinite(number) ? number : null;
}

function numberText(value) {
  const number = finiteNumber(value);
  if (number === null) return null;
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: Number.isInteger(number) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(number);
}

function moneyText(value) {
  const amount = numberText(value?.amount);
  const currency = upper(value?.currency);
  if (!value || upper(value.status) !== 'AUTHORITATIVE' || amount === null || !currency) return 'TO_VERIFY';
  return `${amount} ${currency}`;
}

function percentText(progress) {
  const percent = numberText(progress?.percent);
  if (!progress || upper(progress.status) !== 'AUTHORITATIVE' || percent === null) return 'TO_VERIFY';
  return `${percent}%`;
}

function spendText(deal) {
  if (upper(deal?.actual_spend_status) !== 'AUTHORITATIVE') return { spend: 'TO_VERIFY', remaining: 'TO_VERIFY' };
  return { spend: moneyText(deal.actual_spend), remaining: moneyText(deal.remaining_execution) };
}

function refsFromDeal(deal) {
  const refs = [];
  for (const ref of asArray(deal?.authority_refs)) refs.push(ref);
  for (const field of ['total_to_receive', 'verified_received', 'due_now', 'expected_not_due', 'future_conditional', 'actual_spend', 'remaining_execution']) {
    for (const ref of asArray(deal?.[field]?.authority_refs)) refs.push(ref);
  }
  const seen = new Set();
  return refs.filter((ref) => {
    const key = JSON.stringify(ref || null);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizedDeal(deal) {
  const spend = spendText(deal);
  const conditionalAmount = finiteNumber(deal?.future_conditional?.amount);
  return {
    deal_key: text(deal?.deal_key),
    deal_id: text(deal?.deal_id),
    client_display: text(deal?.client_display) || '—',
    total: moneyText(deal?.total_to_receive),
    received: moneyText(deal?.verified_received),
    expected: moneyText(deal?.expected_not_due),
    due_now: moneyText(deal?.due_now),
    conditional: moneyText(deal?.future_conditional),
    conditional_present: upper(deal?.future_conditional?.status) === 'AUTHORITATIVE' && conditionalAmount !== null && conditionalAmount !== 0,
    spend: spend.spend,
    execution_remaining: spend.remaining,
    progress: percentText(deal?.payment_progress),
    financial_status: text(deal?.financial_status) || 'TO_VERIFY',
    documentary_status: text(deal?.documentary_status) || 'TO_VERIFY',
    accounting_currency: upper(deal?.accounting_currency?.currency) || 'TO_VERIFY',
    accounting_currency_status: upper(deal?.accounting_currency?.status) || 'TO_VERIFY',
    exceptions: asArray(deal?.exceptions),
    authority_refs: refsFromDeal(deal),
  };
}

function aggregateMoney(deals, field) {
  const totals = new Map();
  let toVerify = false;
  for (const deal of deals) {
    const value = deal?.[field];
    const currency = upper(value?.currency);
    const amount = finiteNumber(value?.amount);
    if (!value || upper(value.status) !== 'AUTHORITATIVE' || !currency || amount === null) { toVerify = true; continue; }
    totals.set(currency, (totals.get(currency) || 0) + amount);
  }
  return {
    rows: [...totals.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([currency, amount]) => ({ currency, amount: numberText(amount) })),
    to_verify: toVerify,
  };
}

function globalKpis(deals) {
  const total = aggregateMoney(deals, 'total_to_receive');
  const received = aggregateMoney(deals, 'verified_received');
  const expected = aggregateMoney(deals, 'expected_not_due');
  const conditional = aggregateMoney(deals, 'future_conditional');
  const spendReady = deals.length > 0 && deals.every((deal) => upper(deal?.actual_spend_status) === 'AUTHORITATIVE');
  const spend = spendReady ? aggregateMoney(deals, 'actual_spend') : { rows: [], to_verify: true };
  const remaining = spendReady ? aggregateMoney(deals, 'remaining_execution') : { rows: [], to_verify: true };
  return {
    total: { label: 'К получению', ...total },
    received: { label: 'Получено', ...received },
    expected: { label: 'Ожидается', ...expected, conditional },
    spend: { label: 'Потрачено / Остаток', spend, remaining, to_verify: !spendReady || spend.to_verify || remaining.to_verify },
  };
}

export function createAdminPaymentsV7NativeView(data) {
  const projection = projectionFrom(data);
  const rawDeals = asArray(projection.deals);
  return {
    route_owner: OWNER,
    contract: projection.contract,
    generated_at: projection.generated_at || null,
    source_as_of: projection.source_as_of || null,
    kpis: globalKpis(rawDeals),
    deals: rawDeals.map(normalizedDeal),
    owner_exception_queue: asArray(projection.owner_exception_queue),
  };
}

function provenanceHtml(refs) {
  if (!refs.length) return '<div class="payments-v7-passport-empty">Нет опубликованных provenance refs</div>';
  return `<ul class="payments-v7-provenance">${refs.map((ref) => {
    const label = [ref?.source_type, ref?.source_id, ref?.source_version].map(text).filter(Boolean).join(' · ') || 'Authority';
    const timestamp = text(ref?.source_timestamp);
    return `<li><strong>${esc(label)}</strong>${timestamp ? `<span>${esc(timestamp)}</span>` : ''}</li>`;
  }).join('')}</ul>`;
}

function kpiRowsHtml(rows, toVerify) {
  const body = rows.map((row) => `<div class="payments-v7-kpi-line"><strong>${esc(row.amount)} ${esc(row.currency)}</strong></div>`).join('');
  return body || (toVerify ? '<strong>TO_VERIFY</strong>' : '<strong>—</strong>');
}

function globalKpiHtml(kpis) {
  const conditionalRows = kpis.expected.conditional.rows.filter((row) => finiteNumber(String(row.amount).replace(/\s/g, '').replace(',', '.')) !== 0);
  const conditional = conditionalRows.length
    ? `<div class="payments-v7-kpi-sub">Conditional: ${conditionalRows.map((row) => `${esc(row.amount)} ${esc(row.currency)}`).join(' · ')}</div>`
    : '';
  const spend = kpis.spend.to_verify
    ? '<strong>TO_VERIFY</strong>'
    : `<div class="payments-v7-kpi-pair"><span>Потрачено</span>${kpiRowsHtml(kpis.spend.spend.rows, false)}<span>Остаток</span>${kpiRowsHtml(kpis.spend.remaining.rows, false)}</div>`;
  return `<div class="payments-v7-kpis" aria-label="Сводные показатели">
    <section class="payments-v7-kpi"><span>${esc(kpis.total.label)}</span>${kpiRowsHtml(kpis.total.rows, kpis.total.to_verify)}</section>
    <section class="payments-v7-kpi"><span>${esc(kpis.received.label)}</span>${kpiRowsHtml(kpis.received.rows, kpis.received.to_verify)}</section>
    <section class="payments-v7-kpi"><span>${esc(kpis.expected.label)}</span>${kpiRowsHtml(kpis.expected.rows, kpis.expected.to_verify)}${conditional}</section>
    <section class="payments-v7-kpi"><span>${esc(kpis.spend.label)}</span>${spend}</section>
  </div>`;
}

function dealRowHtml(deal) {
  const conditional = deal.conditional_present ? `<span class="payments-v7-subvalue">Conditional: ${esc(deal.conditional)}</span>` : '';
  return `<article class="payments-v7-deal" data-deal-key="${esc(deal.deal_key)}" data-deal-id="${esc(deal.deal_id)}">
    <header class="payments-v7-deal-head">
      <div><div class="payments-v7-deal-id">${esc(deal.deal_id || 'Deal')}</div><div class="payments-v7-client">${esc(deal.client_display)}</div></div>
      <div class="payments-v7-status">${esc(deal.financial_status)}</div>
    </header>
    <div class="payments-v7-grid" role="group" aria-label="Платежные показатели сделки">
      <div class="payments-v7-cell"><span>К получению</span><strong>${esc(deal.total)}</strong></div>
      <div class="payments-v7-cell"><span>Получено</span><strong>${esc(deal.received)}</strong><small>${esc(deal.progress)}</small></div>
      <div class="payments-v7-cell"><span>Ожидается</span><strong>${esc(deal.expected)}</strong>${conditional}</div>
      <div class="payments-v7-cell"><span>Потрачено / Остаток</span><strong>${esc(deal.spend)}</strong><small>${esc(deal.execution_remaining)}</small></div>
    </div>
    <details class="payments-v7-passport"><summary>Паспорт</summary>
      <div class="payments-v7-passport-meta"><span>Валюта расчётов: ${esc(deal.accounting_currency)} (${esc(deal.accounting_currency_status)})</span><span>Документы: ${esc(deal.documentary_status)}</span><span>К оплате сейчас: ${esc(deal.due_now)}</span></div>
      <div class="payments-v7-passport-tech"><strong>Provenance</strong>${provenanceHtml(deal.authority_refs)}</div>
    </details>
  </article>`;
}

function ownerQueueHtml(queue, deals) {
  if (!queue.length) return '';
  return `<section class="payments-v7-owner-queue" aria-label="Owner queue"><h3>Требуется решение Owner</h3>${queue.map((item) => {
    const candidates = new Set(asArray(item?.candidate_deal_ids).map(String));
    const options = deals.filter((deal) => deal.deal_key).map((deal) => `<option value="${esc(deal.deal_key)}">${esc(deal.deal_id || 'Deal')} · ${esc(deal.client_display)}${candidates.has(deal.deal_key) ? ' · подсказка' : ''}</option>`).join('');
    const payment = asArray(item?.payment_ids).join(', ') || item?.exception_id || 'Payment';
    const amount = moneyText({ amount: item?.payment_amount, currency: item?.payment_currency, status: 'AUTHORITATIVE' });
    return `<article class="payments-v7-owner-item" data-payment-key="${esc(item?.payment_key)}"><div><strong>${esc(payment)}</strong><span>${esc(amount)}</span></div><div class="payments-v7-owner-actions"><select data-owner-deal><option value="">Выберите сделку</option>${options}</select><button type="button" data-owner-action="BIND_TO_DEAL">Привязать к сделке</button><button type="button" data-owner-action="ASSIGN_ADVANCE_PAYMENT">Авансовый платеж</button></div></article>`;
  }).join('')}</section>`;
}

export function renderAdminPaymentsV7NativeHtml(data) {
  const view = createAdminPaymentsV7NativeView(data);
  return `<section class="payments-v7-native" data-payments-route-owner="${OWNER}" data-contract="${esc(view.contract)}">
    ${globalKpiHtml(view.kpis)}
    <div class="payments-v7-board">${view.deals.map(dealRowHtml).join('')}</div>
    ${ownerQueueHtml(view.owner_exception_queue, view.deals)}
  </section>`;
}

export function mountAdminPaymentsV7NativeRoute(routeRoot, data) {
  if (!routeRoot || typeof routeRoot !== 'object') throw new TypeError('ADMIN_PAYMENTS_ROUTE_ROOT_REQUIRED');
  const html = renderAdminPaymentsV7NativeHtml(data);
  routeRoot.innerHTML = html;
  if (typeof routeRoot.setAttribute === 'function') routeRoot.setAttribute('data-payments-route-owner', OWNER);
  return { route_owner: OWNER, html };
}
