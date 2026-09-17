import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const ORIGIN = 'https://ronaoil.com';
const ISSUER = 'https://sxawrwzeobaqwwmlkzws.supabase.co/functions/v1/rona-g82-github-oidc-browser-qa-20260816';
const AUDIENCE = 'rona-pr462-live-preview';
const EVIDENCE = 'payments-frame-proof.json';
const evidence = { ok: false, proofs: [], error: null, generatedAt: new Date().toISOString() };
const persist = () => writeFileSync(EVIDENCE, JSON.stringify(evidence, null, 2));
const assert = (v, m) => { if (!v) throw new Error(m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
persist();

async function githubOidc() {
  const base = process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
  const token = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if (!base || !token) throw new Error('GITHUB_OIDC_ENV_MISSING');
  const url = base + (base.includes('?') ? '&' : '?') + 'audience=' + encodeURIComponent(AUDIENCE);
  const r = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  const j = await r.json();
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

async function waitReady(page) {
  const started = Date.now();
  while (Date.now() - started < 180000) {
    const ready = await page.evaluate(() => {
      const p = window.__RONA_OWNER_AI_SYNC_SNAPSHOT__?.paymentsV7Projection;
      const root = document.querySelector('#page-payments .rona-payments-v7');
      const s = p?.actual_spend_native_summary;
      return p?.contract === 'ADMIN_PAYMENTS_V7' && root?.dataset?.paymentsContract === 'ADMIN_PAYMENTS_V7' && s?.source === 'OWNER_OUTGOING_PAYMENT_FACTS';
    }).catch(() => false);
    if (ready) return;
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => null);
    const nav = page.locator('button[data-page="payments"]').first();
    await nav.waitFor({ state: 'visible', timeout: 60000 });
    await nav.click().catch(() => null);
    await sleep(2500);
  }
  throw new Error('PAYMENTS_V7_NATIVE_SPEND_READY_TIMEOUT');
}

const rowMap = rows => Object.fromEntries((Array.isArray(rows) ? rows : []).map(x => [String(x?.currency || '').toUpperCase(), Number(x?.amount)]));

async function measure(browser, token, width, height) {
  const context = await browser.newContext({ viewport: { width, height } });
  try {
    await context.addCookies([{ name: 'rona_portal_at', value: token, url: ORIGIN + '/portal', httpOnly: true, secure: true, sameSite: 'Lax' }]);
    const page = await context.newPage();
    const response = await page.goto(`${ORIGIN}/portal/admin?_frame_qa=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    assert(response?.status() === 200, `ADMIN_HTTP_${response?.status()}`);
    assert(!page.url().includes('/portal/login'), 'AUTH_REDIRECT');
    const nav = page.locator('button[data-page="payments"]').first();
    await nav.waitFor({ state: 'visible', timeout: 60000 });
    await nav.click();
    await waitReady(page);
    await sleep(1800);

    const proof = await page.evaluate(() => {
      const pageEl = document.querySelector('#page-payments');
      const host = pageEl?.querySelector(':scope > .rona-owner-page-content[data-owner-page="payments"],:scope > .rona-owner-page-content');
      const root = pageEl?.querySelector('.rona-payments-v7');
      const h1 = [...(pageEl?.querySelectorAll('h1') || [])].find(el => (el.textContent || '').trim() === 'Платежи') || null;
      let titleFrame = h1;
      while (titleFrame && titleFrame.parentElement && host && titleFrame.parentElement !== host) titleFrame = titleFrame.parentElement;
      if (!titleFrame || titleFrame.parentElement !== host) titleFrame = h1?.closest('.rona-visual-hero,.page-head,.page-header,.hero,section,header') || h1;
      const board = root?.querySelector('.rona-payments-v7-board');
      const boardCols = board ? getComputedStyle(board).gridTemplateColumns.split(' ').filter(Boolean).length : 0;
      const rect = el => el ? ({ width: el.getBoundingClientRect().width, left: el.getBoundingClientRect().left, right: el.getBoundingClientRect().right }) : null;
      const p = window.__RONA_OWNER_AI_SYNC_SNAPSHOT__?.paymentsV7Projection || null;
      const deal004 = p?.deals?.find(d => d?.deal_id === 'DEAL-2026-004') || null;
      const deal005 = p?.deals?.find(d => d?.deal_id === 'DEAL-2026-005') || null;
      const deal006 = p?.deals?.find(d => d?.deal_id === 'DEAL-2026-006') || null;
      const deal009 = p?.deals?.find(d => d?.deal_id === 'DEAL-2026-009') || null;
      const topSpend = [...(root?.querySelectorAll('.rona-payments-v7-kpi') || [])].find(k => (k.querySelector('.rona-payments-v7-kpi-label')?.textContent || '').trim() === 'Потрачено / Остаток') || null;
      const dealSpendText = id => {
        const a = root?.querySelector(`.rona-payments-v7-deal[data-deal-id="${id}"]`);
        const c = [...(a?.querySelectorAll('.rona-payments-v7-deal-cell') || [])].find(x => (x.querySelector('span')?.textContent || '').trim() === 'Потрачено / Остаток');
        return c?.textContent?.replace(/\s+/g, ' ').trim() || null;
      };
      return {
        viewport: { width: innerWidth, height: innerHeight },
        page: rect(pageEl), host: rect(host), root: rect(root),
        title: h1?.textContent?.trim() || null,
        titleFrame: rect(titleFrame),
        frameDataset: pageEl?.dataset?.ronaPaymentsFrameWidth || null,
        boardCols,
        dealCount: root?.querySelectorAll('.rona-payments-v7-deal').length || 0,
        horizontalOverflow: pageEl ? pageEl.scrollWidth > pageEl.clientWidth + 2 : true,
        nativeSummary: p?.actual_spend_native_summary || null,
        deal004Native: deal004 ? { rows: deal004.actual_spend_native, status: deal004.actual_spend_native_status, unresolved: deal004.actual_spend_native_unresolved_scope } : null,
        deal005Native: deal005 ? { rows: deal005.actual_spend_native, status: deal005.actual_spend_native_status, unresolved: deal005.actual_spend_native_unresolved_scope } : null,
        deal006Native: deal006 ? { rows: deal006.actual_spend_native, status: deal006.actual_spend_native_status, unresolved: deal006.actual_spend_native_unresolved_scope } : null,
        deal009Native: deal009 ? { rows: deal009.actual_spend_native, status: deal009.actual_spend_native_status, unresolved: deal009.actual_spend_native_unresolved_scope } : null,
        topSpendText: topSpend?.textContent?.replace(/\s+/g, ' ').trim() || null,
        deal004SpendText: dealSpendText('DEAL-2026-004'),
        deal005SpendText: dealSpendText('DEAL-2026-005'),
        deal006SpendText: dealSpendText('DEAL-2026-006'),
        deal009SpendText: dealSpendText('DEAL-2026-009'),
      };
    });
    proof.ratio = proof.page?.width ? proof.host?.width / proof.page.width : 0;
    evidence.proofs.push(proof);
    persist();
    console.log('FRAME_SPEND_PROOF=' + JSON.stringify(proof));

    assert(proof.title === 'Платежи', `TITLE_CHANGED_${proof.title}`);
    assert(proof.host && proof.root && proof.titleFrame, 'FRAME_ELEMENTS_MISSING');
    assert(proof.dealCount === 4, `DEAL_COUNT_${proof.dealCount}`);
    assert(proof.boardCols === 1, `DEAL_BOARD_NOT_SINGLE_COLUMN_${proof.boardCols}`);
    assert(!proof.horizontalOverflow, 'HORIZONTAL_OVERFLOW');
    assert(Math.abs(proof.host.width - proof.root.width) <= 2, `HOST_ROOT_WIDTH_MISMATCH_${proof.host.width}_${proof.root.width}`);
    assert(Math.abs(proof.titleFrame.width - proof.root.width) <= 2, `TITLE_BODY_WIDTH_MISMATCH_${proof.titleFrame.width}_${proof.root.width}`);
    if (width > 760) assert(proof.ratio >= 0.73 && proof.ratio <= 0.77, `DESKTOP_RATIO_${proof.ratio}`);
    else assert(proof.ratio >= 0.98 && proof.ratio <= 1.01, `MOBILE_RATIO_${proof.ratio}`);

    assert(proof.nativeSummary?.source === 'OWNER_OUTGOING_PAYMENT_FACTS', 'NATIVE_SPEND_SOURCE_MISSING');
    assert(proof.nativeSummary?.no_synthetic_fx === true, 'NATIVE_SPEND_SYNTHETIC_FX_GUARD_MISSING');
    assert(proof.nativeSummary?.no_proportional_split === true, 'NATIVE_SPEND_SPLIT_GUARD_MISSING');
    const totals = rowMap(proof.nativeSummary?.totals);
    const unresolved = rowMap(proof.nativeSummary?.unresolved_scope_totals);
    assert(Math.abs((totals.RUB ?? NaN) - 14389568.9) < 0.001, `RUB_SPEND_${totals.RUB}`);
    assert(Math.abs((totals.KZT ?? NaN) - 25464800) < 0.001, `KZT_SPEND_${totals.KZT}`);
    assert(Math.abs((unresolved.RUB ?? NaN) - 16539960) < 0.001, `UNRESOLVED_RUB_${unresolved.RUB}`);

    const d4 = rowMap(proof.deal004Native?.rows);
    assert(proof.deal004Native?.status === 'AUTHORITATIVE', `D004_STATUS_${proof.deal004Native?.status}`);
    assert(Math.abs((d4.RUB ?? NaN) - 14389568.9) < 0.001 && Math.abs((d4.KZT ?? NaN) - 25464800) < 0.001, 'D004_NATIVE_TOTALS');
    assert(proof.deal005Native?.status === 'TO_VERIFY', `D005_STATUS_${proof.deal005Native?.status}`);
    assert(proof.deal006Native?.status === 'TO_VERIFY', `D006_STATUS_${proof.deal006Native?.status}`);
    assert(Math.abs((rowMap(proof.deal005Native?.unresolved).RUB ?? NaN) - 16539960) < 0.001, 'D005_UNRESOLVED');
    assert(Math.abs((rowMap(proof.deal006Native?.unresolved).RUB ?? NaN) - 16539960) < 0.001, 'D006_UNRESOLVED');
    assert(proof.deal009Native?.status === 'AUTHORITATIVE', `D009_STATUS_${proof.deal009Native?.status}`);
    assert(Math.abs((rowMap(proof.deal009Native?.rows).RUB ?? NaN) - 0) < 0.001, 'D009_ZERO_SPEND');

    assert(proof.topSpendText?.includes('14') && proof.topSpendText?.includes('RUB') && proof.topSpendText?.includes('KZT'), `TOP_SPEND_DOM_${proof.topSpendText}`);
    assert(proof.deal004SpendText?.includes('RUB') && proof.deal004SpendText?.includes('KZT'), `D004_DOM_${proof.deal004SpendText}`);
    assert(proof.deal005SpendText?.includes('16') && proof.deal005SpendText?.includes('RUB'), `D005_DOM_${proof.deal005SpendText}`);
    assert(proof.deal006SpendText?.includes('16') && proof.deal006SpendText?.includes('RUB'), `D006_DOM_${proof.deal006SpendText}`);
    assert(proof.deal009SpendText?.includes('0') && proof.deal009SpendText?.includes('RUB'), `D009_DOM_${proof.deal009SpendText}`);
    return proof;
  } finally {
    await context.close();
  }
}

let issued;
let browser;
try {
  const expectedHead = String(process.env.GITHUB_SHA || '');
  issued = await broker('', { expectedHead });
  browser = await chromium.launch({ headless: true });
  await measure(browser, issued.session.access_token, 1920, 1080);
  await measure(browser, issued.session.access_token, 1440, 1000);
  await measure(browser, issued.session.access_token, 600, 1100);
  evidence.ok = true;
  persist();
  console.log('ADMIN_PAYMENTS_V7_NATIVE_SPEND_PRODUCTION_ACCEPTANCE=PASS');
  console.log(JSON.stringify(evidence));
} catch (error) {
  evidence.error = String(error?.message || error);
  persist();
  console.error('ADMIN_PAYMENTS_V7_NATIVE_SPEND_PRODUCTION_ACCEPTANCE=FAIL', evidence.error);
  throw error;
} finally {
  if (browser) await browser.close().catch(() => {});
  if (issued) await broker('/cleanup', { expectedHead: String(process.env.GITHUB_SHA || '') }).catch(e => console.error('BROKER_CLEANUP_FAILED', String(e?.message || e)));
}
