import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve4, resolve6, resolveCname } from 'node:dns/promises';
import { join, relative, extname } from 'node:path';

const PROD_ROOT = process.env.RONA_PROD_ROOT || process.cwd();
const PROD_ORIGIN = process.env.RONA_PROD_ORIGIN || 'https://ronatrade.com';
const PAGES_ORIGIN = process.env.RONA_PAGES_EXACT_ORIGIN || '';
const PROD_SHA = process.env.RONA_PROD_SHA || '';
const OUT = process.env.RONA_DIAG_OUT || join(process.cwd(), 'issue432-live-proof.json');
const AUTH_OUT = process.env.RONA_AUTH_OUT || join(process.cwd(), 'issue432-auth-inventory.json');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const normPath = value => String(value || '').replace(/\\/g, '/');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const TARGETS = [
  {
    key: 'context_authority',
    basename: 'client-context-selection-authority-v1.js',
    markers: [
      'RONA_CLIENT_CONTEXT_COHERENCE_432_V1',
      '20260903-client-context-selection-authority-v5-generic-header-no-contract-download',
      'CLIENT_CONTEXT_PROJECTION_STALE_RESPONSE'
    ]
  },
  {
    key: 'applications_canonical_renderer',
    basename: 'portal-client-applications-canonical-v1.js',
    markers: [
      '20260904-portal-client-applications-canonical-v3-title-frame-box-model',
      '/v1/client/applications-projection',
      'CLIENT_APPLICATIONS_AUTHORITATIVE_V1'
    ]
  },
  {
    key: 'application_lifecycle',
    basename: 'client-application-lifecycle-v1.js',
    markers: ['ISSUE432_CONTEXT_SWITCH_RELOAD_QUEUE_V1', 'ISSUE432_CONTEXT_AUTHORITY_CONSUMER_V2']
  }
];

function parseAttrs(tag) {
  const attrs = {};
  for (const match of tag.matchAll(/([:\w-]+)\s*=\s*(["'])(.*?)\2/gis)) attrs[match[1].toLowerCase()] = match[3];
  return attrs;
}
function responseMeta(response) {
  const h = response.headers;
  return {
    status: response.status,
    url: response.url,
    location: h.get('location') || '',
    content_type: h.get('content-type') || '',
    content_length: h.get('content-length') || '',
    cache_control: h.get('cache-control') || '',
    cf_cache_status: h.get('cf-cache-status') || '',
    server: h.get('server') || '',
    cf_ray_present: Boolean(h.get('cf-ray'))
  };
}
function isJavascript(meta) {
  return /javascript|ecmascript|text\/plain/i.test(String(meta?.content_type || ''));
}
function isBitNinjaHtml(meta) {
  return /bitninja/i.test(String(meta?.server || '')) && /text\/html/i.test(String(meta?.content_type || ''));
}
async function fetchBytes(origin, src, attempt = 1) {
  const url = new URL(src, origin);
  url.searchParams.set('_issue432_liveproof', `${Date.now()}-${attempt}`);
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/152 Safari/537.36',
      'cache-control': 'no-cache, no-store, max-age=0',
      pragma: 'no-cache',
      accept: '*/*'
    }
  });
  const bytes = Buffer.from(await response.arrayBuffer());
  return { meta: responseMeta(response), bytes, sha256: sha256(bytes) };
}
async function probeOrigin(origin, src, localHash) {
  if (!origin || !src) return { origin, available: false, exact_match: false, attempts: [] };
  const attempts = [];
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await fetchBytes(origin, src, attempt);
      const row = {
        attempt,
        meta: r.meta,
        bytes: r.bytes.length,
        sha256: r.sha256,
        javascript_payload: isJavascript(r.meta),
        bitninja_html_interposition: isBitNinjaHtml(r.meta),
        exact_match: r.meta.status === 200 && r.sha256 === localHash
      };
      attempts.push(row);
      if (row.exact_match || row.bitninja_html_interposition) return { origin, available: true, ...row, attempts };
    } catch (error) {
      attempts.push({ attempt, error: String(error?.message || error) });
    }
    await sleep(1500);
  }
  const last = attempts.at(-1) || {};
  return { origin, available: Boolean(attempts.length), ...last, exact_match: false, attempts };
}
async function dnsSnapshot(origin) {
  if (!origin) return null;
  const host = new URL(origin).hostname;
  const safe = async fn => fn(host).catch(() => []);
  return { host, a: await safe(resolve4), aaaa: await safe(resolve6), cname: await safe(resolveCname) };
}
async function probePage(origin) {
  if (!origin) return null;
  try {
    const url = new URL('/portal/client', origin);
    url.searchParams.set('_issue432_liveproof', String(Date.now()));
    const response = await fetch(url, {
      redirect: 'manual',
      headers: {
        'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/152 Safari/537.36',
        'cache-control': 'no-cache, no-store, max-age=0',
        pragma: 'no-cache'
      }
    });
    const bytes = Buffer.from(await response.arrayBuffer());
    return { ...responseMeta(response), bytes: bytes.length, sha256: sha256(bytes) };
  } catch (error) {
    return { error: String(error?.message || error) };
  }
}
async function walk(root, out = []) {
  for (const name of await readdir(root).catch(() => [])) {
    if (name === '.git' || name === 'dist' || name === 'node_modules') continue;
    const full = join(root, name);
    const s = await stat(full).catch(() => null);
    if (!s) continue;
    if (s.isDirectory()) await walk(full, out); else out.push(full);
  }
  return out;
}
async function authInventory() {
  const roots = ['.github', 'scripts', 'tests', 'functions', 'supabase'].map(p => join(PROD_ROOT, p));
  const allowed = new Set(['.yml', '.yaml', '.js', '.mjs', '.cjs', '.ts', '.json', '.toml', '.md', '.sh']);
  const secrets = new Map(), envs = new Map();
  const add = (map, key, file) => { if (!map.has(key)) map.set(key, new Set()); map.get(key).add(file); };
  for (const root of roots) for (const file of await walk(root)) {
    if (!allowed.has(extname(file).toLowerCase())) continue;
    const text = await readFile(file, 'utf8').catch(() => '');
    const rel = normPath(relative(PROD_ROOT, file));
    for (const m of text.matchAll(/\bsecrets\.([A-Za-z0-9_]+)/g)) add(secrets, m[1], rel);
    for (const m of text.matchAll(/\bprocess\.env\.([A-Za-z_][A-Za-z0-9_]*)/g)) {
      if (/(CLIENT|AUTH|SESSION|COOKIE|PASSWORD|PASS|LOGIN|PORTAL|QA|TOKEN|EMAIL|USER)/i.test(m[1])) add(envs, m[1], rel);
    }
  }
  const rows = map => [...map.entries()].map(([name, files]) => ({ name, files: [...files].sort() })).sort((a, b) => a.name.localeCompare(b.name));
  const secretRows = rows(secrets), envRows = rows(envs);
  const relevant = item => /(CLIENT|PORTAL).*(QA|AUTH|SESSION|COOKIE|PASSWORD|PASS|LOGIN|TOKEN|EMAIL|USER)|(QA|AUTH|SESSION|COOKIE).*(CLIENT|PORTAL)/i.test(item.name);
  const result = {
    production_sha: PROD_SHA,
    secret_references: secretRows,
    relevant_env_references: envRows,
    least_privilege_client_auth_secret_candidates: secretRows.filter(relevant),
    least_privilege_client_auth_env_candidates: envRows.filter(relevant),
    note: 'Names and source paths only. No secret values are read or emitted.'
  };
  await writeFile(AUTH_OUT, JSON.stringify(result, null, 2) + '\n');
  return result;
}

const htmlPath = join(PROD_ROOT, 'dist', 'portal', 'client.html');
const htmlBytes = await readFile(htmlPath);
const html = htmlBytes.toString('utf8');
const scriptTags = [...html.matchAll(/<script\b[^>]*>/gis)].map(m => ({ tag: m[0], attrs: parseAttrs(m[0]) }));
const targets = [];
for (const target of TARGETS) {
  const tag = scriptTags.find(x => String(x.attrs.src || '').includes(target.basename));
  const src = tag?.attrs?.src || '';
  const localPath = join(PROD_ROOT, 'dist', 'assets', 'portal-runtime', target.basename);
  const localBytes = await readFile(localPath);
  const localText = localBytes.toString('utf8');
  const localHash = sha256(localBytes);
  const markers = Object.fromEntries(target.markers.map(m => [m, localText.includes(m)]));
  targets.push({
    key: target.key,
    basename: target.basename,
    emitted_src: src,
    local_path: normPath(relative(PROD_ROOT, localPath)),
    local_bytes: localBytes.length,
    local_sha256: localHash,
    required_markers: markers,
    local_markers_ok: Object.values(markers).every(Boolean),
    pages_exact: await probeOrigin(PAGES_ORIGIN, src, localHash),
    production: await probeOrigin(PROD_ORIGIN, src, localHash)
  });
}

const attached = targets.filter(t => t.emitted_src);
const pagesExact = Boolean(PAGES_ORIGIN) && attached.length >= 2 && attached.every(t => t.pages_exact.exact_match);
const prodExact = attached.length >= 2 && attached.every(t => t.production.exact_match);
const prodJsDivergence = attached.length >= 2 && attached.every(t => t.production.javascript_payload && !t.production.exact_match);
const prodBitNinjaInterposition = attached.length >= 2 && attached.every(t => t.production.bitninja_html_interposition && !t.production.exact_match);
const localMarkersOk = attached.every(t => t.local_markers_ok);
const dns = { production: await dnsSnapshot(PROD_ORIGIN), pages_exact: await dnsSnapshot(PAGES_ORIGIN) };
const pagesPage = await probePage(PAGES_ORIGIN), productionPage = await probePage(PROD_ORIGIN);
const dnsDifferent = JSON.stringify(dns.production?.a || []) !== JSON.stringify(dns.pages_exact?.a || []) || JSON.stringify(dns.production?.cname || []) !== JSON.stringify(dns.pages_exact?.cname || []);

let phaseA = 'PHASE_A_INCONCLUSIVE';
let classification = 'PHASE_A_INCONCLUSIVE';
if (pagesExact && prodExact && localMarkersOk) {
  phaseA = 'EXACT_DEPLOYED_ASSET_MATCH';
  classification = 'AUTHENTICATED_LIVE_PROOF_REQUIRED';
} else if (pagesExact && prodJsDivergence) {
  phaseA = 'DEPLOYED_ASSET_DIVERGENCE';
  classification = 'LIVE_ROOT_CAUSE_PROVEN=DEPLOYED_ASSET_DIVERGENCE';
} else if (pagesExact && prodBitNinjaInterposition && dnsDifferent) {
  phaseA = 'PRODUCTION_ORIGIN_CHAIN_DIVERGENCE';
  classification = 'LIVE_ROOT_CAUSE_PROVEN=PRODUCTION_ORIGIN_CHAIN_DIVERGENCE';
} else if (prodBitNinjaInterposition) {
  phaseA = 'PRODUCTION_WAF_INTERPOSITION_BLOCKS_ASSET_PROOF';
  classification = 'PHASE_A_BLOCKED_BY_PRODUCTION_WAF_INTERPOSITION';
}

const inventory = await authInventory();
if (classification === 'AUTHENTICATED_LIVE_PROOF_REQUIRED' && inventory.least_privilege_client_auth_secret_candidates.length === 0 && inventory.least_privilege_client_auth_env_candidates.length === 0) classification = 'BLOCKED_AUTH_PROVISIONING_REQUIRED';

const result = {
  issue: 432,
  system_admin_comment: 5562501746,
  production_sha: PROD_SHA,
  production_origin: PROD_ORIGIN,
  exact_pages_origin: PAGES_ORIGIN,
  built_client_html: { path: normPath(relative(PROD_ROOT, htmlPath)), bytes: htmlBytes.length, sha256: sha256(htmlBytes) },
  dns,
  production_page_probe: productionPage,
  pages_page_probe: pagesPage,
  targets,
  phase_a: {
    status: phaseA,
    attached_targets: attached.map(t => t.key),
    pages_exact_assets_match: pagesExact,
    production_exact_assets_match: prodExact,
    production_javascript_divergence: prodJsDivergence,
    production_bitninja_html_interposition: prodBitNinjaInterposition,
    dns_chain_differs_from_pages_exact: dnsDifferent,
    local_issue432_markers_ok: localMarkersOk
  },
  phase_b_inventory: {
    candidate_secret_names: inventory.least_privilege_client_auth_secret_candidates.map(x => x.name),
    candidate_env_names: inventory.least_privilege_client_auth_env_candidates.map(x => x.name)
  },
  classification
};
await writeFile(OUT, JSON.stringify(result, null, 2) + '\n');
console.log('ISSUE432_PHASE_A=' + phaseA);
console.log('ISSUE432_ORIGIN_CHAIN ' + JSON.stringify({ dns, production_page: productionPage, pages_page: pagesPage }));
for (const t of targets) console.log('ISSUE432_ASSET ' + JSON.stringify({ key: t.key, src: t.emitted_src, local_sha256: t.local_sha256, local_bytes: t.local_bytes, pages_exact_sha256: t.pages_exact.sha256 || '', pages_exact_match: Boolean(t.pages_exact.exact_match), prod_sha256: t.production.sha256 || '', prod_bytes: t.production.bytes || 0, prod_exact_match: Boolean(t.production.exact_match), prod_content_type: t.production.meta?.content_type || '', prod_server: t.production.meta?.server || '', prod_cf_ray: Boolean(t.production.meta?.cf_ray_present), prod_bitninja_html_interposition: Boolean(t.production.bitninja_html_interposition), markers_ok: t.local_markers_ok }));
console.log('ISSUE432_AUTH_INVENTORY ' + JSON.stringify({ candidate_secret_names: result.phase_b_inventory.candidate_secret_names, candidate_env_names: result.phase_b_inventory.candidate_env_names }));
console.log('ISSUE432_CLASSIFICATION=' + classification);
