import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const ORIGIN = String(process.env.TARGET_ORIGIN || 'https://ronaoil.com').replace(/\/$/, '');
const ISSUER = 'https://sxawrwzeobaqwwmlkzws.supabase.co/functions/v1/rona-g82-github-oidc-browser-qa-20260816';
const AUDIENCE = 'rona-pr462-live-preview';
const OUT = 'artifacts/admin-payments-v7-final-production';
const assert = (v, m) => { if (!v) throw new Error(m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function githubOidc() {
  const base = process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
  const token = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if (!base || !token) throw new Error('GITHUB_OIDC_ENV_MISSING');
  const url = base + (base.includes('?') ? '&' : '?') + 'audience=' + encodeURIComponent(AUDIENCE);
  const r = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j?.value) throw new Error(`GITHUB_OIDC_${r.status}`);
  return j.value;
}

async function broker(path, body = {}) {
  const jwt = await githubOidc();
  const r = await fetch(ISSUER + path, {
    method: 'POST',
    headers: { authorization: `Bearer ${jwt}`, 'content-type': 'application/json', 'cache-control': 'no-store' },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j?.ok) throw new Error(`BROKER_${path}_${r.status}_${j?.code || 'UNKNOWN'}`);
  return j;
}

async function issueSession() {
  const expectedHead = String(process.env.GITHUB_SHA || '');
  assert(/^[0-9a-f]{40}$/i.test(expectedHead), 'WORKFLOW_SHA_REQUIRED');
  const issued = await broker('', { expectedHead });
  assert(issued?.session?.access_token, 'BROKER_ACCESS_TOKEN_MISSING');
  return issued;
}

async function waitFor(page, fn, label, timeout = 60000) {
  const started = Date.now();
  let last = '';
  while (Date.now() - started < timeout) {
    try {
      const value = await page.evaluate(fn);
      if (value) return value;
    } catch (e) { last = String(e?.message || e); }
    await sleep(250);
  }
  throw new Error(`${label}_TIMEOUT${last ? ':' + last : ''}`);
}

async function acceptViewport(browser, accessToken, spec) {
  const context = await browser.newContext({ viewport: { width: spec.width, height: spec.height } });
  await context.addCookies([{ name: 'rona_portal_at', value: accessToken, url: ORIGIN + '/portal', httpOnly: true, secure: true, sameSite: 'Lax' }]);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(`pageerror:${e?.message || e}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`console:${m.text()}`); });

  let response;
  for (let i = 0; i < 20; i++) {
    response = await page.goto(ORIGIN + '/portal/admin?_payments_v7_final=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 45000 });
    if (response?.status() === 200) break;
    await sleep(1500);
  }
  assert(response?.status() === 200, `ADMIN_AUTH_HTTP_${response?.status()}`);
  assert(!page.url().includes('/portal/login'), 'ADMIN_AUTH_REDIRECTED_TO_LOGIN');

  const nav = page.locator('button[data-page="payments"]').first();
  await nav.waitFor({ state: 'visible', timeout: 60000 });
  await nav.click();

  await waitFor(page, () => {
    const p = window.__RONA_OWNER_AI_SYNC_SNAPSHOT__?.paymentsV7Projection;
    const root = document.querySelector('#page-payments .rona-payments-v7');
    return p?.contract === 'ADMIN_PAYMENTS_V7' && root?.dataset?.paymentsContract === 'ADMIN_PAYMENTS_V7';
  }, 'PAYMENTS_V7_LIVE_READY', 60000);

  const proof = await page.evaluate(async () => {
    const projection = window.__RONA_OWNER_AI_SYNC_SNAPSHOT__?.paymentsV7Projection;
    const root = document.querySelector('#page-payments .rona-payments-v7');
    const pageHost = document.querySelector('#page-payments');
    const dealEls = [...root.querySelectorAll('.rona-payments-v7-deal')];
    const kpis = [...root.querySelectorAll('.rona-payments-v7-kpi')];
    const board = root.querySelector('.rona-payments-v7-board');
    const texts = (root.innerText || '').replace(/\s+/g, ' ').trim();
    const gridCols = el => {
      const value = getComputedStyle(el).gridTemplateColumns;
      return value ? value.split(' ').filter(Boolean).length : 0;
    };
    let fresh = null;
    try {
      const r = await fetch('/portal/owner-api?path=' + encodeURIComponent('/admin/ai-sync') + '&_qa=' + Date.now(), { credentials: 'same-origin', cache: 'no-store', headers: { accept: 'application/json' } });
      const j = await r.json().catch(() => null);
      fresh = { status: r.status, projection: j?.data?.paymentsV7Projection || j?.paymentsV7Projection || null };
    } catch (e) { fresh = { status: 0, error: String(e?.message || e) }; }
    return {
      contract: projection?.contract || null,
      generatedAt: projection?.generated_at || null,
      dealCount: Array.isArray(projection?.deals) ? projection.deals.length : -1,
      projectionDealIds: Array.isArray(projection?.deals) ? projection.deals.map(d => String(d?.deal_id || '')) : [],
      renderedDealIds: dealEls.map(d => String(d.dataset.dealId || '')),
      ownerQueueCount: Array.isArray(projection?.owner_exception_queue) ? projection.owner_exception_queue.length : -1,
      renderedOwnerCount: root.querySelectorAll('.rona-payments-v7-owner-item').length,
      routeOwner: root.dataset.ronaPaymentsOwner || null,
      kpiCount: kpis.length,
      kpiColumns: root.querySelector('.rona-payments-v7-kpis') ? gridCols(root.querySelector('.rona-payments-v7-kpis')) : 0,
      dealColumns: dealEls[0]?.querySelector('.rona-payments-v7-deal-grid') ? gridCols(dealEls[0].querySelector('.rona-payments-v7-deal-grid')) : 0,
      kpiBeforeBoard: kpis.length > 0 && board ? !!(kpis[0].compareDocumentPosition(board) & Node.DOCUMENT_POSITION_FOLLOWING) : false,
      horizontalOverflow: pageHost ? pageHost.scrollWidth > pageHost.clientWidth + 2 : true,
      legacyTableVisible: texts.includes('Поступило от клиентов'),
      staleFixtureVisible: texts.includes('362 600 USD'),
      allDealHeights: dealEls.map(d => Math.round(d.getBoundingClientRect().height)),
      kpiHeights: kpis.map(k => Math.round(k.getBoundingClientRect().height)),
      progress: [...root.querySelectorAll('.rona-payments-v7-progress')].map(p => ({ track: p.getBoundingClientRect().width, fill: p.querySelector('i')?.getBoundingClientRect().width || 0, status: p.dataset.progressStatus || null })),
      statusClasses: dealEls.map(d => d.querySelector('.rona-payments-v7-status')?.className || ''),
      freshStatus: fresh?.status || 0,
      freshContract: fresh?.projection?.contract || null,
      freshDealIds: Array.isArray(fresh?.projection?.deals) ? fresh.projection.deals.map(d => String(d?.deal_id || '')) : [],
      freshGeneratedAt: fresh?.projection?.generated_at || null,
    };
  });

  assert(proof.contract === 'ADMIN_PAYMENTS_V7', `${spec.name}_CONTRACT`);
  assert(proof.routeOwner === 'admin-payments-v7-native', `${spec.name}_ROUTE_OWNER`);
  assert(proof.dealCount > 0, `${spec.name}_NO_REAL_DEALS`);
  assert(JSON.stringify(proof.renderedDealIds) === JSON.stringify(proof.projectionDealIds), `${spec.name}_DOM_PROJECTION_DEAL_MISMATCH`);
  assert(proof.kpiCount === 4 && proof.kpiBeforeBoard, `${spec.name}_KPI_CONTRACT`);
  assert(proof.kpiColumns === spec.columns, `${spec.name}_KPI_COLUMNS_${proof.kpiColumns}`);
  assert(proof.dealColumns === spec.columns, `${spec.name}_DEAL_COLUMNS_${proof.dealColumns}`);
  assert(!proof.horizontalOverflow, `${spec.name}_HORIZONTAL_OVERFLOW`);
  assert(!proof.legacyTableVisible, `${spec.name}_LEGACY_PAYMENTS_VISIBLE`);
  assert(!proof.staleFixtureVisible, `${spec.name}_STALE_FIXTURE_VISIBLE`);
  assert(proof.renderedOwnerCount === Math.max(0, proof.ownerQueueCount), `${spec.name}_OWNER_QUEUE_MISMATCH`);
  assert(proof.allDealHeights.every(h => h > 0 && h < spec.maxDealHeight), `${spec.name}_DEAL_DENSITY_${proof.allDealHeights.join(',')}`);
  assert(proof.kpiHeights.every(h => h > 0 && h < 130), `${spec.name}_KPI_DENSITY_${proof.kpiHeights.join(',')}`);
  assert(proof.progress.every(p => p.fill >= 0 && p.fill <= p.track + 1), `${spec.name}_PROGRESS_GEOMETRY`);
  assert(proof.statusClasses.every(x => /status-(paid|expected|due|overdue|conditional|to_verify)/.test(x)), `${spec.name}_STATUS_SEMANTICS`);
  assert(proof.freshStatus === 200 && proof.freshContract === 'ADMIN_PAYMENTS_V7', `${spec.name}_FRESH_SOURCE_ENDPOINT`);
  assert(JSON.stringify(proof.freshDealIds) === JSON.stringify(proof.projectionDealIds), `${spec.name}_LIVE_SOURCE_MISMATCH`);

  await page.screenshot({ path: `${OUT}/${spec.name}.png`, fullPage: true });
  await context.close();
  return { ...spec, proof, runtimeErrors: errors.slice(0, 20) };
}

await mkdir(OUT, { recursive: true });
let issued = null;
let browser = null;
let result = null;
try {
  issued = await issueSession();
  browser = await chromium.launch({ headless: true });
  const viewports = [
    { name: 'desktop-1440', width: 1440, height: 1000, columns: 4, maxDealHeight: 320 },
    { name: 'medium-900', width: 900, height: 1100, columns: 2, maxDealHeight: 320 },
    { name: 'mobile-600', width: 600, height: 1200, columns: 1, maxDealHeight: 520 },
  ];
  const proofs = [];
  for (const spec of viewports) proofs.push(await acceptViewport(browser, issued.session.access_token, spec));
  result = { ok: true, contract: 'ADMIN_PAYMENTS_V7', origin: ORIGIN, workflowHead: process.env.GITHUB_SHA, brokerHead: issued.head, proofs };
  await writeFile(`${OUT}/acceptance.json`, JSON.stringify(result, null, 2));
  console.log('ADMIN_PAYMENTS_V7_FINAL_PRODUCTION_ACCEPTANCE=PASS');
  console.log(JSON.stringify(result));
} finally {
  if (browser) await browser.close().catch(() => {});
  if (issued) {
    try { await broker('/cleanup', { expectedHead: String(process.env.GITHUB_SHA || '') }); }
    catch (e) { console.error('BROKER_CLEANUP_FAILED', String(e?.message || e)); process.exitCode = 1; }
  }
}
