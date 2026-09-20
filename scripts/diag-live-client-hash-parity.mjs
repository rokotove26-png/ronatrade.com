import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex');
const base='https://ronaoil.com';
const targets=[
  'assets/portal-runtime/client-context-selection-authority-v1.js',
  'assets/portal-runtime/client-home-command-center-v2.js',
  'assets/portal-runtime/client-home-current-only-v1.js'
];
for(const path of targets){
  const local=await readFile('dist/'+path);
  const r=await fetch(base+'/'+path+'?_diag='+Date.now(),{headers:{'cache-control':'no-cache'},redirect:'manual'});
  const remote=Buffer.from(await r.arrayBuffer());
  const row={path,status:r.status,localBytes:local.length,remoteBytes:remote.length,localSha:sha(local),remoteSha:sha(remote),same:sha(local)===sha(remote)};
  console.log('LIVE_CLIENT_HASH_PARITY '+JSON.stringify(row));
  if(r.status!==200||!row.same)throw new Error('LIVE_CLIENT_HASH_PARITY_FAIL '+JSON.stringify(row));
}
console.log('LIVE_CLIENT_HASH_PARITY=PASS');