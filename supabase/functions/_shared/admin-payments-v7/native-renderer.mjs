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
  if (!projection || projection.contract !== 'ADMIN_PAYMENTS_V7') {
    throw new Error('ADMIN_PAYMENTS_V7_PROJECTION_REQUIRED');
  }
  return projection;
}

function numberText(value) {
  const raw = text(value);
  if (!raw) return null;
  const number = Number(raw);
  if (!Number.isFinite(number)) return raw;
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: Number.isInteger(number) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(number);
}

function moneyText(value) {
  if (!value || upper(value.status) !== 'AUTHORITATIVE' || value.amount === null || !text(value.currency)) return 'TO_VERIFY';
  return `${numberText(value.amount)} ${upper(value.currency)}`;
}

function percentText(progress) {
  if (!progress || upper(progress.status) !== 'AUTHORITATIVE' || progress.percent === null) return 'TO_VERIFY';
  return `${numberText(progress.percent)}%`;
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
  return {
    deal_id: text(deal?.deal_id),
    client_display: text(deal?.client_display) || '—',
    total: moneyText(deal?.total_to_receive),
    received: moneyText(deal?.verified_received),
    expected: moneyText(deal?.expected_not_due),
    due_now: moneyText(deal?.due_now),
    conditional: moneyText(deal?.future_conditional),
    conditional_present: !!deal?.future_conditional && upper(deal.future_conditional.status) === 'AUTHORITATIVE' && Number(deal.future_conditional.amount) !== 0,
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

export function createAdminPaymentsV7NativeView(data) {
  const projection = projectionFrom(data);
  return {
    route_owner: OWNER,
    contract: projection.contract,
    generated_at: projection.generated_at || null,
    source_as_of: projection.source_as_of || null,
    deals: asArray(projection.deals).map(normalizedDeal),
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

function dealRowHtml(deal) {
  const conditional = deal.conditional_present ? `<span class="payments-v7-subvalue">Conditional: ${esc(deal.conditional)}</span>` : '';
  return `<article class="payments-v7-deal" data-deal-id="${esc(deal.deal_id)}">
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
    <details class="payments-v7-passport"><summary>Паспорт / provenance</summary>
      <div class="payments-v7-passport-meta"><span>Accounting currency: ${esc(deal.accounting_currency)} (${esc(deal.accounting_currency_status)})</span><span>Documentary: ${esc(deal.documentary_status)}</span><span>Due now: ${esc(deal.due_now)}</span></div>
      ${provenanceHtml(deal.authority_refs)}
    </details>
  </article>`;
}

function ownerQueueHtml(queue) {
  if (!queue.length) return '';
  return `<section class="payments-v7-owner-queue" aria-label="Owner queue"><h3>Требуется решение Owner</h3>${queue.map((item) => `<article><strong>${esc(asArray(item.payment_ids).join(', ') || item.exception_id)}</strong><span>${esc(item.reconciliation_class)}</span></article>`).join('')}</section>`;
}

export function renderAdminPaymentsV7NativeHtml(data) {
  const view = createAdminPaymentsV7NativeView(data);
  return `<section class="payments-v7-native" data-payments-route-owner="${OWNER}" data-contract="${esc(view.contract)}">
    <header class="payments-v7-title"><div><h2>Платежи</h2><p>Authoritative V7 projection</p></div></header>
    <div class="payments-v7-board">${view.deals.map(dealRowHtml).join('')}</div>
    ${ownerQueueHtml(view.owner_exception_queue)}
  </section>`;
}

export function mountAdminPaymentsV7NativeRoute(routeRoot, data) {
  if (!routeRoot || typeof routeRoot !== 'object') throw new TypeError('ADMIN_PAYMENTS_ROUTE_ROOT_REQUIRED');
  const html = renderAdminPaymentsV7NativeHtml(data);
  routeRoot.innerHTML = html;
  if (typeof routeRoot.setAttribute === 'function') routeRoot.setAttribute('data-payments-route-owner', OWNER);
  return { route_owner: OWNER, html };
}
