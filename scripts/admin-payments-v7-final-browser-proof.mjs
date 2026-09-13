import assert from 'node:assert/strict';
import { randomInt, randomUUID } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { recoverLiveAdminWorkspace } from './admin-payments-v7-final-live-source.mjs';

const OUT = join(process.cwd(), 'final-payments-artifacts');
mkdirSync(OUT, { recursive: true });
const money = (amount, currency, status = 'AUTHORITATIVE') => ({ amount: amount === null ? null : String(amount), currency, status, authority_refs: [] });
const fmt = (value) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(Number(value));

function sourceProjection(seed, sourceVersion) {
  const currency = 'USD';
  const dealKey = randomUUID();
  const dealId = `QA-${randomUUID().slice(0, 8)}`;
  const client = `QA Client ${randomUUID().slice(0, 6)}`;
  const total = seed.total;
  const received = seed.received;
  const expected = total - received;
  const percent = (received / total) * 100;
  return {
    contract: 'ADMIN_PAYMENTS_V7',
    generated_at: new Date().toISOString(),
    source_as_of: new Date().toISOString(),
    source_truth: {
      contour: 'AUTHORITATIVE',
      bank_receipts_and_allocations: 'AUTHORITATIVE',
      finance_authority: 'AUTHORITATIVE',
      spend_resource_chain: 'TO_VERIFY',
    },
    deals: [{
      deal_key: dealKey,
      deal_id: dealId,
      client_display: client,
      payment_handoff_state: seed.handoff,
      accounting_currency: { currency, status: 'AUTHORITATIVE', authority_refs: [] },
      total_to_receive: money(total, currency),
      verified_received: money(received, currency),
      due_now: money(total - total, currency),
      expected_not_due: money(expected, currency),
      future_conditional: money(total - total, currency),
      remaining_to_receive: money(expected, currency),
      actual_spend: money(null, currency, 'TO_VERIFY'),
      actual_spend_status: 'TO_VERIFY',
      remaining_execution: money(null, currency, 'TO_VERIFY'),
      payment_progress: { percent: String(percent), status: 'AUTHORITATIVE', reason: null },
      financial_status: expected > 0 ? 'EXPECTED' : 'PAID',
      documentary_status: 'CONFIRMED',
      exceptions: [],
      authority_refs: [{ source_type: 'QA_SOURCE', source_id: sourceVersion, source_version: sourceVersion }],
    }],
    owner_exception_queue: [],
  };
}

function chrome() {
  for (const name of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
    try { return execFileSync('which', [name], { encoding: 'utf8' }).trim(); } catch {}
  }
  throw new Error('FINAL_PAYMENTS_BROWSER_NOT_FOUND');
}

async function compile() {
  const root = mkdtempSync(join(tmpdir(), 'payments-final-'));
  recoverLiveAdminWorkspace(root);
  const mod = await import(pathToFileURL(join(root, 'functions/portal/main-ui/index.js')).href + `?${Date.now()}`);
  const response = await mod.onRequest({});
  return {
    root,
    js: await response.text(),
    html: readFileSync(join(root, 'portal-src/current/admin.html'), 'utf8'),
    shell: readFileSync(join(root, 'assets/portal-admin-shell-fast-v1.js'), 'utf8'),
    ownerApi: readFileSync(join(root, 'functions/portal/owner-api.js'), 'utf8'),
  };
}

function driver(expected) {
  return `(()=>{const sleep=ms=>new Promise(r=>setTimeout(r,ms));async function wait(fn,ms=12000){const end=Date.now()+ms;while(Date.now()<end){try{if(fn())return true}catch{}await sleep(100)}return false}function emit(id,payload){const pre=document.createElement('pre');pre.id=id;pre.textContent=typeof payload==='string'?payload:JSON.stringify(payload);document.body.append(pre)}async function run(){const readiness={adminReady:await wait(()=>window.__RONA_OWNER_ADMIN_READY__===true),snapshot:await wait(()=>window.__RONA_OWNER_AI_SYNC_SNAPSHOT__),fastUi:await wait(()=>window.__RONA_ADMIN_FAST_UI_LOADED__===true)};document.querySelector('#nav button[data-page="payments"]')?.click();readiness.payments=await wait(()=>document.querySelector('#page-payments .rona-payments-v7'));await sleep(250);const page=document.querySelector('#page-payments'),root=page?.querySelector('.rona-payments-v7'),kpis=page?.querySelector('.rona-payments-v7-kpis'),deal=page?.querySelector('.rona-payments-v7-deal[data-deal-id="'+${JSON.stringify(expected.dealId)}+'"]'),cells=Array.from(deal?.querySelectorAll('.rona-payments-v7-deal-cell')||[]),receivedCell=cells.find(x=>x.querySelector('span')?.textContent.trim()==='Получено'),expectedCell=cells.find(x=>x.querySelector('span')?.textContent.trim()==='Ожидается'),passport=deal?.querySelector('.rona-payments-v7-passport'),status=deal?.querySelector('.rona-payments-v7-status'),progress=deal?.querySelector('.rona-payments-v7-progress>i'),pr=page?.getBoundingClientRect(),rr=root?.getBoundingClientRect(),kr=kpis?.getBoundingClientRect(),dr=deal?.getBoundingClientRect(),kpiCardMaxHeight=Math.max(0,...Array.from(kpis?.children||[]).map(x=>x.getBoundingClientRect().height));const out={readiness,routeOwner:root?.getAttribute('data-rona-payments-owner')||'',kpiCount:kpis?.children?.length||0,gridColumns:kpis?getComputedStyle(kpis).gridTemplateColumns.split(/\\s+/).filter(Boolean).length:0,received:receivedCell?.querySelector('strong')?.textContent.trim()||'',expected:expectedCell?.querySelector('strong')?.textContent.trim()||'',statusClass:status?.className||'',progressWidth:progress?.getBoundingClientRect().width||0,progressTrackWidth:progress?.parentElement?.getBoundingClientRect().width||0,passportClosed:passport?.open===false,technicalInPrimary:cells.some(x=>/Provenance|Валюта расчётов|Документы/.test(x.textContent||'')),kpiHeight:kr?.height||0,kpiCardMaxHeight,dealHeight:dr?.height||0,overflow:!!page&&page.scrollWidth>page.clientWidth+1,visible:!!page&&!!root&&getComputedStyle(page).display!=='none'&&getComputedStyle(root).visibility!=='hidden'&&(pr?.width||0)>200&&(rr?.width||0)>200};emit('payments-final-proof',out)}run().catch(err=>emit('payments-final-proof-error',String(err?.stack||err)))})();`;
}

async function serve(compiled, projection, fn) {
  const expected = {
    dealId: projection.deals[0].deal_id,
    received: `${fmt(projection.deals[0].verified_received.amount)} ${projection.deals[0].verified_received.currency}`,
    expected: `${fmt(projection.deals[0].expected_not_due.amount)} ${projection.deals[0].expected_not_due.currency}`,
  };
  const html = compiled.html.replace('</body>', `<script>${driver(expected).replaceAll('</script>', '<\\/script>')}</script></body>`);
  const boot = { applications: [], deals: projection.deals.map((d) => ({ deal_id: d.deal_id, business_status: 'ACTIVE', finance_status: d.financial_status, lifecycle_state: 'ACTIVE' })), documents: [], prices: [], clients: [], companies: [], agents: [], rail: [], claims: [], radio: [], cash: [], analytics: [] };
  const sync = { paymentsV7Projection: projection, financeFragment: { dealFinanceSummaries: [], dealFinanceCurrentState: [], payments: [], cash: [] }, railTariffs: [], aiEmployees: [], latestAiConclusions: [], homeCoordination: { totals: { TODAY: {}, '7D': {}, '30D': {}, ALL: {} }, periods: { TODAY: [], '7D': [], '30D': [], ALL: [] }, recent: [] }, aiRuntime: { enabled: true } };
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://local');
    const path = url.pathname;
    const json = (body) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
    if (path === '/' || path === '/portal/admin') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(html); }
    if (path === '/assets/portal-admin-shell-fast-v1.js') { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(compiled.shell); }
    if (path === '/portal/main-ui') { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(compiled.js); }
    if (path === '/portal/api/session/me') return json({ ok: true });
    if (path === '/portal/owner-api') {
      const routed = url.searchParams.get('path');
      if (routed === '/admin/ai-sync') return json({ ok: true, data: sync });
      return json({ ok: true, data: {} });
    }
    if (path === '/portal/admin-completed-bootstrap') return json({ ok: true, data: boot });
    if (path.startsWith('/portal/admin-authority/agent-readiness')) return json({ ok: true, data: { matrixReady: true } });
    if (path.startsWith('/portal/admin-authority/')) return json({ ok: true, data: {} });
    if (path.startsWith('/portal/api')) return json({ ok: true, data: boot });
    if (path === '/portal/rail-current-v81-maplibre-ui') { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end("window.__RONA_RAIL_CURRENT_V81__=true;const x=document.createElement('div');x.hidden=true;x.setAttribute('data-rail-current-root','ready');document.body.append(x);"); }
    if (path === '/portal/analytics-v2-ui') { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end('window.__RONA_ANALYTICS_V2_READY__=true'); }
    if (path.startsWith('/portal/') || path.endsWith('.js')) { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(';'); }
    res.writeHead(204); res.end();
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  try { return { expected, result: await fn(`http://127.0.0.1:${server.address().port}/portal/admin`) }; }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

async function screenshot(url, width, height, file) {
  return new Promise((resolve, reject) => {
    const child = spawn(chrome(), ['--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--disable-dev-shm-usage', `--window-size=${width},${height}`, '--virtual-time-budget=18000', '--dump-dom', `--screenshot=${file}`, url], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    child.stdout.on('data', (d) => out += d);
    child.stderr.on('data', (d) => err += d);
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolve(out) : reject(new Error(`CHROME_${code}:${err.slice(-2000)}`)));
  });
}

function decodeHtml(text) {
  return text.replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&').replaceAll('&nbsp;', '\u00a0');
}

function proof(dom) {
  const error = dom.match(/<pre id="payments-final-proof-error">([^<]+)<\/pre>/);
  if (error) throw new Error(`FINAL_PAYMENTS_BROWSER_RUNTIME_ERROR:${decodeHtml(error[1])}`);
  const match = dom.match(/<pre id="payments-final-proof">([^<]+)<\/pre>/);
  if (!match) throw new Error('FINAL_PAYMENTS_BROWSER_PROOF_MISSING');
  return JSON.parse(decodeHtml(match[1]));
}

const compiled = await compile();
try {
  assert.match(compiled.ownerApi, /admin\/payments-v7\/owner-decision/);
  assert.doesNotMatch(compiled.ownerApi, /PROD_RPC_UPSTREAM.*persist_owner_payment_decision_v7/);

  const total = randomInt(2000, 9000);
  const firstReceived = randomInt(400, total - 400);
  const sourceA = sourceProjection({ total, received: firstReceived, handoff: 'READY' }, `QA-${randomUUID().slice(0, 8)}`);
  const sourceB = structuredClone(sourceA);
  const delta = randomInt(17, Math.max(18, Math.floor((total - firstReceived) / 2)));
  sourceB.deals[0].verified_received.amount = String(firstReceived + delta);
  sourceB.deals[0].expected_not_due.amount = String(total - firstReceived - delta);
  sourceB.deals[0].remaining_to_receive.amount = sourceB.deals[0].expected_not_due.amount;
  sourceB.deals[0].payment_progress.percent = String(((firstReceived + delta) / total) * 100);
  sourceB.deals[0].authority_refs = [{ source_type: 'QA_SOURCE', source_id: `QA-${randomUUID().slice(0, 8)}`, source_version: `QA-${randomUUID().slice(0, 8)}` }];
  sourceB.source_as_of = new Date(Date.now() + 1000).toISOString();

  const responsive = {};
  for (const [name, width, height, columns] of [['desktop', 1440, 1000, 4], ['medium-900x1100', 900, 1100, 2], ['mobile', 600, 1200, 1]]) {
    const served = await serve(compiled, sourceA, (url) => screenshot(url, width, height, join(OUT, `payments-final-${name}.png`)));
    const current = proof(served.result);
    responsive[name] = current;
    assert.equal(current.readiness.payments, true, `${name}:payments-ready`);
    assert.equal(current.routeOwner, 'admin-payments-v7-native');
    assert.equal(current.kpiCount, 4);
    assert.equal(current.gridColumns, columns);
    assert.equal(current.received, served.expected.received);
    assert.equal(current.expected, served.expected.expected);
    assert.equal(current.visible, true);
    assert.equal(current.overflow, false);
    assert.equal(current.technicalInPrimary, false);
    assert.equal(current.passportClosed, true);
    assert.match(current.statusClass, /status-(expected|paid)/);
    assert.ok(current.progressWidth > 0 && current.progressWidth <= current.progressTrackWidth + 1);
    assert.ok(current.kpiCardMaxHeight > 0 && current.kpiCardMaxHeight < 130);
    assert.ok(current.dealHeight < 320);
  }

  const changed = await serve(compiled, sourceB, (url) => screenshot(url, 1440, 1000, join(OUT, 'payments-final-source-change.png')));
  const changedProof = proof(changed.result);
  assert.equal(changedProof.readiness.payments, true, 'source-change:payments-ready');
  assert.equal(changedProof.received, changed.expected.received);
  assert.equal(changedProof.expected, changed.expected.expected);
  assert.notEqual(changedProof.received, responsive.desktop.received);
  assert.notEqual(changedProof.expected, responsive.desktop.expected);

  console.log('FINAL_PAYMENTS_BROWSER_PASS', JSON.stringify({ responsive, sourceChange: { before: responsive.desktop, after: changedProof } }));
} finally {
  rmSync(compiled.root, { recursive: true, force: true });
}
