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
  while (Date.now() - started < 60000) {
    const ready = await page.evaluate(() => {
      const p = window.__RONA_OWNER_AI_SYNC_SNAPSHOT__?.paymentsV7Projection;
      const root = document.querySelector('#page-payments .rona-payments-v7');
      return p?.contract === 'ADMIN_PAYMENTS_V7' && root?.dataset?.paymentsContract === 'ADMIN_PAYMENTS_V7';
    }).catch(() => false);
    if (ready) return;
    await sleep(250);
  }
  throw new Error('PAYMENTS_V7_READY_TIMEOUT');
}

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
      const ancestors = [];
      let a = h1;
      while (a && a !== pageEl) {
        ancestors.push({ tag: a.tagName, cls: a.className || '', rect: rect(a) });
        a = a.parentElement;
      }
      return {
        viewport: { width: innerWidth, height: innerHeight },
        page: rect(pageEl),
        host: rect(host),
        root: rect(root),
        title: h1?.textContent?.trim() || null,
        titleFrame: rect(titleFrame),
        titleFrameClass: titleFrame?.className || '',
        titleAncestors: ancestors,
        hostPadding: host ? { left: getComputedStyle(host).paddingLeft, right: getComputedStyle(host).paddingRight } : null,
        frameDataset: pageEl?.dataset?.ronaPaymentsFrameWidth || null,
        boardCols,
        dealCount: root?.querySelectorAll('.rona-payments-v7-deal').length || 0,
        horizontalOverflow: pageEl ? pageEl.scrollWidth > pageEl.clientWidth + 2 : true,
        childWidths: pageEl ? [...pageEl.children].filter(el => getComputedStyle(el).display !== 'none').map(el => ({ tag: el.tagName, cls: el.className, width: el.getBoundingClientRect().width })) : [],
      };
    });
    proof.ratio = proof.page?.width ? proof.host?.width / proof.page.width : 0;
    evidence.proofs.push(proof);
    persist();
    console.log('FRAME_PROOF=' + JSON.stringify(proof));

    assert(proof.title === 'Платежи', `TITLE_CHANGED_${proof.title}`);
    assert(proof.host && proof.root && proof.titleFrame, 'FRAME_ELEMENTS_MISSING');
    assert(proof.dealCount > 0, 'NO_DEALS');
    assert(proof.boardCols === 1, `DEAL_BOARD_NOT_SINGLE_COLUMN_${proof.boardCols}`);
    assert(!proof.horizontalOverflow, 'HORIZONTAL_OVERFLOW');
    assert(Math.abs(proof.host.width - proof.root.width) <= 2, `HOST_ROOT_WIDTH_MISMATCH_${proof.host.width}_${proof.root.width}`);
    assert(Math.abs(proof.titleFrame.width - proof.root.width) <= 2, `TITLE_BODY_WIDTH_MISMATCH_${proof.titleFrame.width}_${proof.root.width}`);
    if (width > 760) assert(proof.ratio >= 0.58 && proof.ratio <= 0.62, `DESKTOP_RATIO_${proof.ratio}`);
    else assert(proof.ratio >= 0.98 && proof.ratio <= 1.01, `MOBILE_RATIO_${proof.ratio}`);
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
  console.log('ADMIN_PAYMENTS_V7_FRAME_PRODUCTION_ACCEPTANCE=PASS');
  console.log(JSON.stringify(evidence));
} catch (error) {
  evidence.error = String(error?.message || error);
  persist();
  console.error('ADMIN_PAYMENTS_V7_FRAME_PRODUCTION_ACCEPTANCE=FAIL', evidence.error);
  throw error;
} finally {
  if (browser) await browser.close().catch(() => {});
  if (issued) await broker('/cleanup', { expectedHead: String(process.env.GITHUB_SHA || '') }).catch(e => console.error('BROKER_CLEANUP_FAILED', String(e?.message || e)));
}
