import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { onRequest as pricesUiRequest } from '../functions/portal/prices-current-ui.js';

const ROOT = process.cwd();
const OUT = join(ROOT, 'prices-premium-visual-proof');
mkdirSync(OUT, { recursive: true });

const css = readFileSync(join(ROOT, 'assets/portal-market-news-no-gray-bands-v1.css'), 'utf8');
const runtimeWrapper = readFileSync(join(ROOT, 'functions/portal/prices-current-ui.js'), 'utf8');
const apiSource = readFileSync(join(ROOT, 'functions/portal/price-updates-api.js'), 'utf8');
const uiResponse = await pricesUiRequest({});
const uiRuntime = await uiResponse.text();

function gitBlobSha(content) {
  const bytes = Buffer.from(content);
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}

assert.equal(
  gitBlobSha(runtimeWrapper),
  '5bf18d32a8b129727e686ba0d7790f90e943b424',
  'CURRENT FUNCTIONAL PRICES runtime must remain byte-locked',
);

for (const marker of [
  "window.__RONA_PRICES_CURRENT_UI__='20260914-pending-canonical-matrix-v1'",
  "const OWNER_API='/portal/owner-api',UPDATE_API='/portal/price-updates-api'",
  "updateApi('apply'",
  "updateApi('reject'",
  "updateApi('audience'",
  "setInterval(()=>{if(page()?.classList.contains('active'))refreshAll()},30000)",
  "e('h1','rona-visual-title','Цены и маржа')",
  "e('h2','','История решений')",
]) assert.ok(runtimeWrapper.includes(marker), `locked runtime marker missing: ${marker}`);

for (const marker of [
  'owner_apply_price_change_proposal',
  'owner_reject_price_change_proposal',
  'owner_set_price_publication_audience',
  'owner_prices_admin_workspace',
]) assert.ok(apiSource.includes(marker), `Prices API authority marker missing: ${marker}`);

for (const marker of [
  'ADMIN_PRICES_PREMIUM_EXECUTIVE_V1',
  'backdrop-filter: blur(22px)',
  '.rona-prices-kpi-value',
  '.rona-owner-table tbody tr:hover td',
  '.rona-prices-filter button[aria-pressed="true"]',
  '.rona-prices-reject:hover',
  '@media (prefers-reduced-motion: reduce)',
]) assert.ok(css.includes(marker), `premium visual marker missing: ${marker}`);

const premiumSection = css.slice(css.indexOf('/* ADMIN_PRICES_PREMIUM_EXECUTIVE_V1'));
assert.ok(premiumSection.length > 1000, 'premium CSS section must exist');
assert.equal(/display\s*:\s*none\s*!important/i.test(premiumSection), false, 'premium layer must not hide existing Prices elements');
assert.equal(/#page-(?!prices)[a-z-]+/.test(premiumSection), false, 'premium layer must stay scoped to Prices');

const admin = {
  prices: [
    { product: 'АИ-92 К5', producer: 'Producer A', supplier: 'Supplier A', basis: 'CPT', final_station: 'Озинки', sale_price: 701, currency: 'USD', business_status: 'PUBLISHED', commercial_terms: 'Период поставки: октябрь 2026', payment_terms: '100% предварительная оплата' },
    { product: 'АИ-92 К5', producer: 'Producer A', supplier: 'Supplier A', basis: 'CPT', final_station: 'Сарыагаш', sale_price: 745, currency: 'USD', business_status: 'PUBLISHED', commercial_terms: 'Период поставки: октябрь 2026', payment_terms: '100% предварительная оплата' },
    { product: 'ДТ-Л/З К5', producer: null, supplier: 'Supplier B', basis: 'CPT', final_station: 'Озинки', sale_price: 812, currency: 'USD', business_status: 'PUBLISHED', commercial_terms: 'Период поставки: октябрь 2026', payment_terms: '100% предварительная оплата' },
  ],
};

const updates = {
  generatedAt: '2026-09-14T09:00:00Z',
  currentPublicationId: 'RONA-QA-CURRENT',
  clientEnabled: true,
  agentEnabled: false,
  updateAvailableCount: 1,
  proposals: [
    {
      proposalId: '11111111-1111-4111-8111-111111111111',
      status: 'UPDATE_AVAILABLE',
      receivedAt: '2026-09-14T08:55:00Z',
      basePublicationId: 'RONA-QA-CURRENT',
      reason: 'QA visual-only proposal',
      sourceRefs: ['QA-SOURCE-1'],
      changes: [
        { product: 'АИ-92 К5', final_station: 'Озинки', field: 'sale_price', field_label: 'Цена продажи', old_value: null, new_value: 706, external_projection: true },
        { product: 'ДТ-Л/З К5', final_station: 'Озинки', field: 'sale_price', field_label: 'Цена продажи', old_value: null, new_value: 818, external_projection: true },
      ],
    },
  ],
  history: [
    { status: 'APPLIED', basePublicationId: 'RONA-QA-PREV', newPublicationId: 'RONA-QA-CURRENT', appliedAt: '2026-09-13T12:00:00Z' },
    { status: 'REJECTED', basePublicationId: 'RONA-QA-OLDER', rejectedAt: '2026-09-12T12:00:00Z' },
  ],
};

const calls = { ownerBootstrap: 0, updateBootstrap: 0, apply: 0, reject: 0, audience: 0 };

function json(res, body, status = 200) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/assets/portal-market-news-no-gray-bands-v1.css"><style>html,body{margin:0;background:#050b13;color:#f4f8fb;font-family:Inter,Segoe UI,Arial,sans-serif}.page{display:none}.page.active{display:block}.rona-owner-page-content{width:min(100%,1660px);margin:0 auto}.rona-owner-card{padding:16px;margin:0 0 14px}.rona-owner-table{width:100%}.rona-owner-table th,.rona-owner-table td{text-align:left}.rona-visual-hero{margin-bottom:14px}.rona-prices-proposals{margin-bottom:14px}.rona-prices-kpi-grid,.rona-prices-matrix,.rona-prices-publication{margin-bottom:14px}button,select,input{font:inherit}</style></head><body><nav id="nav"><button type="button" data-page="prices" class="active">Цены</button></nav><section id="page-prices" class="page active"></section><script src="/portal/prices-current-ui"></script></body></html>`;

const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname === '/portal/admin') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(html);
    return;
  }
  if (url.pathname === '/assets/portal-market-news-no-gray-bands-v1.css') {
    res.writeHead(200, { 'content-type': 'text/css; charset=utf-8', 'cache-control': 'no-store' });
    res.end(css);
    return;
  }
  if (url.pathname === '/portal/prices-current-ui') {
    res.writeHead(200, { 'content-type': 'application/javascript; charset=utf-8', 'cache-control': 'no-store' });
    res.end(uiRuntime);
    return;
  }
  if (url.pathname === '/portal/owner-api') {
    calls.ownerBootstrap += 1;
    json(res, { ok: true, data: admin });
    return;
  }
  if (url.pathname === '/portal/price-updates-api') {
    const op = url.searchParams.get('op');
    if (op === 'bootstrap') {
      calls.updateBootstrap += 1;
      json(res, { ok: true, data: updates });
      return;
    }
    if (op === 'apply') {
      calls.apply += 1;
      json(res, { ok: true, data: { newPublicationId: 'RONA-QA-NEXT' } });
      return;
    }
    if (op === 'reject') {
      calls.reject += 1;
      json(res, { ok: true, data: {} });
      return;
    }
    if (op === 'audience') {
      calls.audience += 1;
      json(res, { ok: true, data: {} });
      return;
    }
  }
  res.writeHead(404);
  res.end('not found');
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
const origin = `http://127.0.0.1:${address.port}`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
const pageErrors = [];
const consoleErrors = [];
page.on('pageerror', error => pageErrors.push(String(error)));
page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });

try {
  await page.goto(`${origin}/portal/admin`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('.rona-visual-title')?.textContent === 'Цены и маржа');

  const initial = await page.evaluate(() => ({
    title: document.querySelector('.rona-visual-title')?.textContent,
    roots: document.querySelectorAll('#page-prices > #rona-prices-current').length,
    kpis: document.querySelectorAll('.rona-prices-kpi').length,
    proposals: document.querySelectorAll('.rona-prices-proposal').length,
    publication: document.querySelectorAll('.rona-prices-publication').length,
    history: document.querySelectorAll('.rona-prices-history-row').length,
    filterButtons: document.querySelectorAll('.rona-prices-filter button').length,
    buttons: [...document.querySelectorAll('#rona-prices-current button')].map(x => x.textContent.trim()),
  }));
  assert.equal(initial.title, 'Цены и маржа');
  assert.equal(initial.roots, 1);
  assert.equal(initial.kpis, 3);
  assert.ok(initial.proposals >= 1);
  assert.equal(initial.publication, 1);
  assert.ok(initial.history >= 1);
  assert.equal(initial.filterButtons, 3);
  for (const label of ['Открыть детали', 'Отклонить', 'Обновить', 'Все', 'Опубликовано', 'Требует подтверждения', 'Применить публикацию']) {
    assert.ok(initial.buttons.includes(label), `required control missing: ${label}`);
  }

  const visual = await page.evaluate(() => {
    const card = getComputedStyle(document.querySelector('.rona-owner-card'));
    const hero = getComputedStyle(document.querySelector('.rona-visual-hero'));
    const kpi = getComputedStyle(document.querySelector('.rona-prices-kpi-value'));
    const active = getComputedStyle(document.querySelector('.rona-prices-filter button[aria-pressed="true"]'));
    return {
      cardBackground: card.backgroundImage,
      cardRadius: card.borderRadius,
      cardBackdrop: card.backdropFilter || card.webkitBackdropFilter,
      heroBackground: hero.backgroundImage,
      heroBackdrop: hero.backdropFilter || hero.webkitBackdropFilter,
      kpiFontSize: Number.parseFloat(kpi.fontSize),
      activeBackground: active.backgroundImage,
    };
  });
  assert.match(visual.cardBackground, /linear-gradient/i);
  assert.equal(visual.cardRadius, '18px');
  assert.match(visual.cardBackdrop, /blur\(18px\)/i);
  assert.match(visual.heroBackground, /gradient/i);
  assert.match(visual.heroBackdrop, /blur\(22px\)/i);
  assert.ok(visual.kpiFontSize >= 27);
  assert.match(visual.activeBackground, /gradient/i);

  const detailButton = page.locator('.rona-prices-proposal .rona-prices-actions button').filter({ hasText: 'Открыть детали' }).first();
  await detailButton.click();
  assert.equal(await page.locator('.rona-prices-proposal .rona-prices-details').first().getAttribute('hidden'), null);

  const allRows = await page.locator('.rona-prices-matrix .rona-owner-table tbody tr').count();
  await page.getByRole('button', { name: 'Требует подтверждения', exact: true }).click();
  const verifyRows = await page.locator('.rona-prices-matrix .rona-owner-table tbody tr').count();
  assert.ok(verifyRows > 0 && verifyRows < allRows, 'filter must narrow the current price matrix');
  await page.getByRole('button', { name: 'Все', exact: true }).click();
  assert.equal(await page.locator('.rona-prices-matrix .rona-owner-table tbody tr').count(), allRows);

  const publication = page.locator('.rona-prices-publication');
  await publication.locator('select').selectOption('BOTH');
  await publication.getByRole('button', { name: 'Применить публикацию', exact: true }).click();
  await page.locator('.rona-prices-modal').waitFor({ state: 'visible' });
  await page.locator('.rona-prices-modal .primary').click();
  await page.waitForFunction(() => !document.querySelector('.rona-prices-modal'));
  assert.ok(calls.audience >= 1, 'publication action must reach the locked API path');

  await page.locator('.rona-prices-apply').first().click();
  await page.locator('.rona-prices-modal').waitFor({ state: 'visible' });
  await page.locator('.rona-prices-modal .primary').click();
  await page.waitForFunction(() => !document.querySelector('.rona-prices-modal'));
  assert.ok(calls.apply >= 1, 'approval action must reach the locked API path');

  await page.locator('.rona-prices-reject').first().click();
  await page.locator('.rona-prices-modal-input').waitFor({ state: 'visible' });
  await page.locator('.rona-prices-modal-input').fill('QA visual-only regression proof');
  await page.locator('.rona-prices-modal .primary').click();
  await page.waitForFunction(() => document.querySelector('.rona-prices-modal-title')?.textContent === 'Подтвердить отклонение');
  await page.locator('.rona-prices-modal .primary').click();
  await page.waitForFunction(() => !document.querySelector('.rona-prices-modal'));
  assert.ok(calls.reject >= 1, 'reject action must reach the locked API path');

  await page.evaluate(() => { window.__RONA_PRICES_QA_ROOT__ = document.querySelector('#rona-prices-current'); });
  const beforeStable = await page.evaluate(() => ({
    rootCount: document.querySelectorAll('#page-prices > #rona-prices-current').length,
    runtime: window.__RONA_PRICES_CURRENT_UI__,
    title: document.querySelector('.rona-visual-title')?.textContent,
    cardBackground: getComputedStyle(document.querySelector('.rona-owner-card')).backgroundImage,
    kpiFontSize: getComputedStyle(document.querySelector('.rona-prices-kpi-value')).fontSize,
    historyCount: document.querySelectorAll('.rona-prices-history-row').length,
  }));
  const refreshBefore = calls.updateBootstrap;
  await page.screenshot({ path: join(OUT, 'prices-premium-before-30s.png'), fullPage: true });
  await page.waitForTimeout(31_500);
  const refreshAfter = calls.updateBootstrap;
  assert.ok(refreshAfter > refreshBefore, '30-second auto-refresh must remain active');

  const afterStable = await page.evaluate(() => ({
    sameRoot: window.__RONA_PRICES_QA_ROOT__ === document.querySelector('#rona-prices-current'),
    rootCount: document.querySelectorAll('#page-prices > #rona-prices-current').length,
    runtime: window.__RONA_PRICES_CURRENT_UI__,
    title: document.querySelector('.rona-visual-title')?.textContent,
    cardBackground: getComputedStyle(document.querySelector('.rona-owner-card')).backgroundImage,
    kpiFontSize: getComputedStyle(document.querySelector('.rona-prices-kpi-value')).fontSize,
    historyCount: document.querySelectorAll('.rona-prices-history-row').length,
  }));
  assert.equal(afterStable.sameRoot, true, 'auto-refresh must not replace the Prices renderer root');
  assert.equal(afterStable.rootCount, 1);
  assert.equal(afterStable.runtime, beforeStable.runtime);
  assert.equal(afterStable.title, 'Цены и маржа');
  assert.equal(afterStable.cardBackground, beforeStable.cardBackground);
  assert.equal(afterStable.kpiFontSize, beforeStable.kpiFontSize);
  assert.equal(afterStable.historyCount, beforeStable.historyCount);
  await page.screenshot({ path: join(OUT, 'prices-premium-after-30s.png'), fullPage: true });

  assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join(' | ')}`);
  assert.deepEqual(consoleErrors, [], `console errors: ${consoleErrors.join(' | ')}`);
  console.log(JSON.stringify({
    result: 'ADMIN_PRICES_PREMIUM_VISUAL_ONLY_QA_PASS',
    runtimeBlob: gitBlobSha(runtimeWrapper),
    initial,
    visual,
    calls,
    stableAfter30s: afterStable,
  }, null, 2));
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
