import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const OWNER_POSTGREST_READ_FALLBACK_NAMES = Object.freeze([
  'owner_analytics_admin_bootstrap',
  'owner_r1_admin_bootstrap',
  'rona_admin_cash_source_projection_v1',
  'owner_deals_current_v4',
  'owner_deals_current_v3',
  'owner_access_workspace_bootstrap',
  'rona_admin_operations_current_v2',
  'rona_admin_operations_current_v1',
  'rona_admin_operations_attention_seen_v1',
  'owner_r1_client_bootstrap',
  'owner_analytics_client_feed',
]);

export const PRICE_POSTGREST_READ_FALLBACK_NAMES = Object.freeze([
  'owner_price_updates_bootstrap',
  'owner_prices_admin_workspace',
]);

const FALLBACK_PATH = '/functions/v1/rona-owner-rpc-read-fallback';

function replaceBetween(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0 || end <= start) {
    throw new Error(`POSTGREST_READ_FALLBACK_${label}_SOURCE_MISMATCH`);
  }
  return source.slice(0, start) + replacement + source.slice(end);
}

function commonFallbackRuntime(setName, names) {
  return `const ${setName}=new Set(${JSON.stringify(names)});
async function ronaPostgrestReadUnavailable(response){if(!response||response.status!==503)return false;const data=await response.clone().json().catch(()=>({})),code=String(data?.code||''),message=String(data?.message||data?.details||'');return code==='PGRST000'||code==='PGRST002'||/schema cache|database connection error|retrying/i.test(message)}
async function ronaPostgrestReadFallback(token,name,args){try{return await fetch(\`\${SUPABASE_URL}/functions/v1/rona-owner-rpc-read-fallback\`,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,authorization:\`Bearer \${token}\`,'content-type':'application/json',accept:'application/json'},body:JSON.stringify({name,args:args||{}})})}catch(_){return null}}
`;
}

export function patchOwnerApiSource(source) {
  const setName = 'RONA_OWNER_POSTGREST_READ_FALLBACK_NAMES';
  const replacement = commonFallbackRuntime(setName, OWNER_POSTGREST_READ_FALLBACK_NAMES) +
    `async function rpcCall(token,name,args){const primary=await fetch(\`\${RPC_UPSTREAM}/\${encodeURIComponent(name)}\`,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,authorization:\`Bearer \${token}\`,'content-type':'application/json',accept:'application/json'},body:JSON.stringify(args||{})});if(!${setName}.has(name)||!(await ronaPostgrestReadUnavailable(primary)))return primary;const fallback=await ronaPostgrestReadFallback(token,name,args);if(fallback&&(fallback.ok||fallback.status===401||fallback.status===403))return fallback;return primary}
`;
  const out = replaceBetween(
    source,
    'async function rpcCall(token,name,args){',
    'async function rpcAuthFailure',
    replacement,
    'OWNER_API',
  );
  if (!out.includes(FALLBACK_PATH)) {
    throw new Error('POSTGREST_READ_FALLBACK_OWNER_API_CONTRACT_INVALID');
  }
  return out;
}

export function patchPriceUpdatesApiSource(source) {
  const setName = 'RONA_PRICE_POSTGREST_READ_FALLBACK_NAMES';
  const replacement = commonFallbackRuntime(setName, PRICE_POSTGREST_READ_FALLBACK_NAMES) +
    `async function rpc(token,name,args={}){const primary=await fetch(\`\${RPC}/\${encodeURIComponent(name)}\`,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,authorization:\`Bearer \${token}\`,'content-type':'application/json',accept:'application/json'},body:JSON.stringify(args)});if(!${setName}.has(name)||!(await ronaPostgrestReadUnavailable(primary)))return primary;const fallback=await ronaPostgrestReadFallback(token,name,args);if(fallback&&(fallback.ok||fallback.status===401||fallback.status===403))return fallback;return primary}
`;
  const out = replaceBetween(
    source,
    'async function rpc(token,name,args={}){',
    'async function session',
    replacement,
    'PRICE_API',
  );
  if (!out.includes(FALLBACK_PATH)) {
    throw new Error('POSTGREST_READ_FALLBACK_PRICE_API_CONTRACT_INVALID');
  }
  return out;
}

export function applyPortalPostgrestReadFallback(root) {
  const ownerPath = join(root, 'functions/portal/owner-api.js');
  const pricesPath = join(root, 'functions/portal/price-updates-api.js');

  const ownerSource = readFileSync(ownerPath, 'utf8');
  const pricesSource = readFileSync(pricesPath, 'utf8');

  writeFileSync(ownerPath, patchOwnerApiSource(ownerSource));
  writeFileSync(pricesPath, patchPriceUpdatesApiSource(pricesSource));

  return {
    contract: 'RONA_POSTGREST_READ_FALLBACK_V1',
    ownerReadFallbackNames: [...OWNER_POSTGREST_READ_FALLBACK_NAMES],
    priceReadFallbackNames: [...PRICE_POSTGREST_READ_FALLBACK_NAMES],
  };
}
