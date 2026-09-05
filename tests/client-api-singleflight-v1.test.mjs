import { readFile } from 'node:fs/promises';

const source=await readFile('supabase/functions/rona-portal-api/bootstrap.ts','utf8');
const required=[
  'CLIENT_READ_SINGLE_FLIGHT_ROUTES',
  "'/v1/client/context'",
  "'/v1/client/prices'",
  "'/v1/client/market'",
  "'/v1/client/shipments'",
  "'/v1/client/rail'",
  'clientReadInflight',
  "if(req.method!=='GET')return null",
  "const authorization=req.headers.get('authorization')",
  'const existing=clientReadInflight.get(key)',
  'if(existing)return (await existing).clone()',
  'clientReadInflight.set(key,task)',
  'clientReadInflight.delete(key)',
  'import "./index.ts";'
];
for(const token of required)if(!source.includes(token))throw new Error(`CLIENT_API_SINGLEFLIGHT_MISSING: ${token}`);
for(const forbidden of [
  "'/v1/client/storage'",
  'setTimeout(()=>clientReadInflight',
  'CLIENT_READ_CACHE_TTL',
  'remote.githubusercontent.com/rokotove26-png/ronatrade.com/e6a9e090'
])if(source.includes(forbidden))throw new Error(`CLIENT_API_SINGLEFLIGHT_FORBIDDEN: ${forbidden}`);

console.log('CLIENT_API_SINGLEFLIGHT=PASS scope=authenticated exact-client-GET in-flight-only stale-cache=absent storage=excluded source-lineage=local');
