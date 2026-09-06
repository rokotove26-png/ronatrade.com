import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, relative, extname } from 'node:path';

const PROD_ROOT = process.env.RONA_PROD_ROOT || process.cwd();
const ORIGIN = process.env.RONA_PROD_ORIGIN || 'https://ronatrade.com';
const PROD_SHA = process.env.RONA_PROD_SHA || '';
const OUT = process.env.RONA_DIAG_OUT || join(process.cwd(), 'issue432-live-proof.json');
const AUTH_OUT = process.env.RONA_AUTH_OUT || join(process.cwd(), 'issue432-auth-inventory.json');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const normPath = value => String(value || '').replace(/\\/g, '/');

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
    key: 'application_lifecycle',
    basename: 'client-application-lifecycle-v1.js',
    markers: ['ISSUE432_CONTEXT_SWITCH_RELOAD_QUEUE_V1', 'ISSUE432_CONTEXT_AUTHORITY_CONSUMER_V2']
  },
  {
    key: 'applications_live_render',
    basename: 'client-applications-live-render-v1.js',
    markers: ['ISSUE432_APPLICATIONS_CENTRAL_PROJECTION_V1']
  },
  {
    key: 'contract_projection_consumer',
    basename: 'client-contract-download-v3.js',
    markers: ['ISSUE432_CONTRACT_DIRECTORY_CENTRAL_PROJECTION_V1']
  },
  {
    key: 'payments_projection_consumer',
    basename: 'client-payments-authoritative-v1.js',
    markers: ['ISSUE432_PAYMENTS_CENTRAL_PROJECTION_V1']
  },
  {
    key: 'deal_documents_projection_consumer',
    basename: 'client-deal-documents-v5.js',
    markers: ['ISSUE432_DEAL_DOCUMENTS_CENTRAL_PROJECTION_V1']
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
    etag: h.get('etag') || '',
    last_modified: h.get('last-modified') || '',
    cache_control: h.get('cache-control') || '',
    cf_cache_status: h.get('cf-cache-status') || '',
    age: h.get('age') || '',
    server: h.get('server') || '',
    cf_ray_present: Boolean(h.get('cf-ray'))
  };
}

async function fetchWithProbe(url) {
  const headers = { 'cache-control': 'no-cache, no-store, max-age=0', pragma: 'no-cache', accept: '*/*' };
  let manualMeta = null;
  try {
    const manual = await fetch(url, { headers, redirect: 'manual' });
    manualMeta = responseMeta(manual);
    await manual.arrayBuffer().catch(() => null);
  } catch (error) {
    manualMeta = { error: String(error?.message || error) };
  }
  const followed = await fetch(url, { headers, redirect: 'follow' });
  const bytes = Buffer.from(await followed.arrayBuffer());
  return { manual: manualMeta, followed: responseMeta(followed), bytes };
}

async function inspectTarget(html, target) {
  const tags = [...html.matchAll(/<script\b[^>]*>/gis)].map(match => ({ tag: match[0], attrs: parseAttrs(match[0]) }));
  const tag = tags.find(item => String(item.attrs.src || '').includes(target.basename));
  const localAsset = join(PROD_ROOT, 'dist', 'assets', 'portal-runtime', target.basename);
  const localBytes = await readFile(localAsset);
  const localText = localBytes.toString('utf8');
  const localHash = sha256(localBytes);
  const markerPresence = Object.fromEntries(target.markers.map(marker => [marker, localText.includes(marker)]));
  const localMarkersOk = Object.values(markerPresence).every(Boolean);
  const src = tag?.attrs?.src || '';
  const srcUrl = src ? new URL(src, ORIGIN) : null;
  const version = srcUrl?.searchParams.get('v') || '';
  const expectedVersion = localHash.slice(0, 16);
  const contentAddressed = Boolean(srcUrl && version === expectedVersion);

  let live = null;
  let exactMatch = false;
  const attempts = [];
  if (srcUrl) {
    for (let attempt = 1; attempt <= 6; attempt++) {
      const u = new URL(srcUrl.toString());
      u.searchParams.set('_issue432_diag', `${Date.now()}-${attempt}`);
      try {
        const probe = await fetchWithProbe(u.toString());
        const liveHash = sha256(probe.bytes);
        exactMatch = probe.followed.status === 200 && liveHash === localHash;
        const liveText = probe.bytes.toString('utf8');
        const liveMarkers = Object.fromEntries(target.markers.map(marker => [marker, liveText.includes(marker)]));
        const row = {
          attempt,
          manual: probe.manual,
          followed: probe.followed,
          bytes: probe.bytes.length,
          sha256: liveHash,
          markers: liveMarkers,
          exact_match: exactMatch
        };
        attempts.push(row);
        live = row;
        if (exactMatch) break;
      } catch (error) {
        attempts.push({ attempt, error: String(error?.stack || error) });
      }
      await sleep(3000);
    }
  }

  return {
    key: target.key,
    basename: target.basename,
    script_id: tag?.attrs?.id || '',
    emitted_src: src,
    local_path: normPath(relative(PROD_ROOT, localAsset)),
    local_bytes: localBytes.length,
    local_sha256: localHash,
    emitted_version: version,
    expected_version: expectedVersion,
    content_addressed: contentAddressed,
    required_markers: markerPresence,
    local_markers_ok: localMarkersOk,
    live,
    attempts,
    exact_match: exactMatch
  };
}

async function walk(root, out = []) {
  for (const name of await readdir(root).catch(() => [])) {
    if (name === '.git' || name === 'dist' || name === 'node_modules') continue;
    const full = join(root, name);
    const s = await stat(full).catch(() => null);
    if (!s) continue;
    if (s.isDirectory()) await walk(full, out);
    else out.push(full);
  }
  return out;
}

async function authInventory() {
  const allowedExt = new Set(['.yml', '.yaml', '.js', '.mjs', '.cjs', '.ts', '.json', '.toml', '.md', '.sh']);
  const roots = ['.github', 'scripts', 'tests', 'functions', 'supabase'].map(p => join(PROD_ROOT, p));
  const files = [];
  for (const root of roots) files.push(...await walk(root));
  const secretMap = new Map();
  const envMap = new Map();
  const signalMap = new Map();
  const add = (map, key, file) => {
    if (!map.has(key)) map.set(key, new Set());
    map.get(key).add(file);
  };
  const signalPatterns = [
    ['storageState', /storageState/i],
    ['playwright', /playwright/i],
    ['portal_auth_login', /portal\/auth\/login/i],
    ['cookie', /\bcookies?\b/i],
    ['session', /\bsession\b/i],
    ['client_qa', /client[-_ ]?qa/i],
    ['credential', /credential/i]
  ];

  for (const file of files) {
    if (!allowedExt.has(extname(file).toLowerCase())) continue;
    const text = await readFile(file, 'utf8').catch(() => '');
    if (!text) continue;
    const rel = normPath(relative(PROD_ROOT, file));
    for (const m of text.matchAll(/\bsecrets\.([A-Za-z0-9_]+)/g)) add(secretMap, m[1], rel);
    for (const m of text.matchAll(/\bprocess\.env\.([A-Za-z_][A-Za-z0-9_]*)/g)) {
      if (/(CLIENT|AUTH|SESSION|COOKIE|PASSWORD|PASS|LOGIN|PORTAL|QA|TOKEN|EMAIL|USER)/i.test(m[1])) add(envMap, m[1], rel);
    }
    const signals = signalPatterns.filter(([, re]) => re.test(text)).map(([name]) => name);
    if (signals.length) signalMap.set(rel, signals);
  }

  const secretReferences = [...secretMap.entries()].map(([name, fileSet]) => ({ name, files: [...fileSet].sort() })).sort((a, b) => a.name.localeCompare(b.name));
  const envReferences = [...envMap.entries()].map(([name, fileSet]) => ({ name, files: [...fileSet].sort() })).sort((a, b) => a.name.localeCompare(b.name));
  const authSignalFiles = [...signalMap.entries()].map(([file, signals]) => ({ file, signals })).sort((a, b) => a.file.localeCompare(b.file));
  const candidateSecretRefs = secretReferences.filter(item => /(CLIENT|PORTAL).*(QA|AUTH|SESSION|COOKIE|PASSWORD|PASS|LOGIN|TOKEN|EMAIL|USER)|(QA|AUTH|SESSION|COOKIE).*(CLIENT|PORTAL)/i.test(item.name));
  const candidateEnvRefs = envReferences.filter(item => /(CLIENT|PORTAL).*(QA|AUTH|SESSION|COOKIE|PASSWORD|PASS|LOGIN|TOKEN|EMAIL|USER)|(QA|AUTH|SESSION|COOKIE).*(CLIENT|PORTAL)/i.test(item.name));

  const result = {
    production_sha: PROD_SHA,
    scanned_roots: roots.map(p => normPath(relative(PROD_ROOT, p))),
    secret_references: secretReferences,
    relevant_env_references: envReferences,
    auth_signal_files: authSignalFiles,
    least_privilege_client_auth_secret_candidates: candidateSecretRefs,
    least_privilege_client_auth_env_candidates: candidateEnvRefs,
    note: 'Names and source paths only. No secret values are read or emitted.'
  };
  await writeFile(AUTH_OUT, JSON.stringify(result, null, 2) + '\n', 'utf8');
  return result;
}

const htmlPath = join(PROD_ROOT, 'dist', 'portal', 'client.html');
const htmlBytes = await readFile(htmlPath);
const html = htmlBytes.toString('utf8');
const targets = [];
for (const target of TARGETS) targets.push(await inspectTarget(html, target));

const portalUrl = new URL('/portal/client', ORIGIN);
portalUrl.searchParams.set('_issue432_diag', String(Date.now()));
let protectedPortal = null;
try {
  const response = await fetch(portalUrl, {
    redirect: 'manual',
    headers: { 'cache-control': 'no-cache, no-store, max-age=0', pragma: 'no-cache' }
  });
  protectedPortal = responseMeta(response);
  await response.arrayBuffer().catch(() => null);
} catch (error) {
  protectedPortal = { error: String(error?.stack || error) };
}

const inventory = await authInventory();
const allTargetsAttached = targets.every(t => Boolean(t.emitted_src));
const allContentAddressed = targets.filter(t => t.emitted_src).every(t => t.content_addressed);
const allLocalMarkers = targets.every(t => t.local_markers_ok);
const allLiveExact = targets.filter(t => t.emitted_src).every(t => t.exact_match) && allTargetsAttached;
const divergent = targets.filter(t => !t.exact_match || !t.emitted_src).map(t => t.key);
const phaseA = allLiveExact && allContentAddressed && allLocalMarkers ? 'EXACT_DEPLOYED_ASSET_MATCH' : 'DEPLOYED_ASSET_DIVERGENCE';
const classification = phaseA === 'DEPLOYED_ASSET_DIVERGENCE'
  ? 'LIVE_ROOT_CAUSE_PROVEN=DEPLOYED_ASSET_DIVERGENCE'
  : (inventory.least_privilege_client_auth_secret_candidates.length === 0 && inventory.least_privilege_client_auth_env_candidates.length === 0
      ? 'BLOCKED_AUTH_PROVISIONING_REQUIRED'
      : 'AUTH_CANDIDATE_REVIEW_REQUIRED');

const result = {
  issue: 432,
  system_admin_comment: 5562501746,
  production_sha: PROD_SHA,
  production_origin: ORIGIN,
  built_client_html: {
    path: normPath(relative(PROD_ROOT, htmlPath)),
    bytes: htmlBytes.length,
    sha256: sha256(htmlBytes)
  },
  protected_portal_probe: protectedPortal,
  targets,
  phase_a: {
    status: phaseA,
    all_targets_attached: allTargetsAttached,
    all_content_addressed: allContentAddressed,
    all_local_issue432_markers: allLocalMarkers,
    all_live_bytes_exact: allLiveExact,
    divergent_targets: divergent
  },
  phase_b_inventory: {
    candidate_secret_names: inventory.least_privilege_client_auth_secret_candidates.map(x => x.name),
    candidate_env_names: inventory.least_privilege_client_auth_env_candidates.map(x => x.name),
    auth_inventory_file: normPath(relative(process.cwd(), AUTH_OUT))
  },
  classification
};
await writeFile(OUT, JSON.stringify(result, null, 2) + '\n', 'utf8');

console.log('ISSUE432_PHASE_A=' + phaseA);
for (const t of targets) {
  console.log('ISSUE432_ASSET ' + JSON.stringify({
    key: t.key,
    src: t.emitted_src,
    local_sha256: t.local_sha256,
    live_sha256: t.live?.sha256 || '',
    local_bytes: t.local_bytes,
    live_bytes: t.live?.bytes || 0,
    exact_match: t.exact_match,
    content_addressed: t.content_addressed,
    markers_ok: t.local_markers_ok,
    final_url: t.live?.followed?.url || '',
    http_status: t.live?.followed?.status || 0,
    cf_cache_status: t.live?.followed?.cf_cache_status || ''
  }));
}
console.log('ISSUE432_PROTECTED_PORTAL ' + JSON.stringify(protectedPortal));
console.log('ISSUE432_AUTH_INVENTORY ' + JSON.stringify({
  secret_names: inventory.secret_references.map(x => x.name),
  relevant_env_names: inventory.relevant_env_references.map(x => x.name),
  least_privilege_client_auth_secret_candidates: inventory.least_privilege_client_auth_secret_candidates.map(x => x.name),
  least_privilege_client_auth_env_candidates: inventory.least_privilege_client_auth_env_candidates.map(x => x.name)
}));
console.log('ISSUE432_CLASSIFICATION=' + classification);
