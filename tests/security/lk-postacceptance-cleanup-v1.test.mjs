import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,readdirSync,statSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {onRequest as retiredNewsRoute} from '../../functions/portal/news-current-ui.js';

const retired='functions/portal/news-current-ui.js';
const frozen={
  'portal-src/current/admin.html':'cca468590d2353f64d30300284a302479a2b972c',
  'assets/portal-runtime/client-market-intelligence-v1.js':'417bf3773613a54b0aa4420f0978cf94d4d04a02',
  'functions/portal/admin-approved-shell-v455-ui.js':'1746a7f83373857f455cff8a8f1d320d032685fc',
  'functions/portal/analytics-v2-ui.js':'1f760a3eb14d7d085b65f5d83daae008bfae3d1c',
  'functions/portal/admin-operations-command-center-v10-clean.js':'ca30b1cf4e1f21f1148d8eb7159da1deeed59714',
  'assets/portal-runtime/client-context-selection-authority-v1.js':'abe541dbd6162dd7cc03462e1b37ba23d6fb5b60',
  'functions/portal/owner-ui-chunks/chunk3.js':'653f7dbec0d19aee55274567aee9dd03a8a88f05',
  'functions/portal/admin-main-ui-current.js':'f2e8b14931c7801af36f9b0f6652405b423720b1',
  'assets/portal-market-news-current-v1.js':'2fd42ac01b51c5769a480b32cf5ca78bbcca69d6'
};
function gitBlob(path) {
  const data=readFileSync(path);
  return createHash('sha1').update(Buffer.concat([Buffer.from('blob '+data.length+'\0'),data])).digest('hex');
}
function sourceFiles(dir) {
  if(!existsSync(dir))return[];
  const paths=[];
  for(const d of readdirSync(dir,{withFileTypes:true})){
    if(['node_modules','.git','dist'].includes(d.name))continue;
    const path=join(dir,d.name);
    if(d.isDirectory()){paths.push(...sourceFiles(path));continue}
    if(d.isFile()&&/\.(?:js|mjs|ts|tsx|html|json|css|txt|0[0-9]|sql)$/i.test(d.name))paths.push(path);
  }
  return paths;
}
test('retired news route answers 410 without current caller references',async()=>{
  assert.ok(existsSync(retired));
  const r=retiredNewsRoute();
  assert.equal(r.status,410);
  assert.equal(r.headers.get('cache-control'),'no-store');
  assert.equal((await r.json()).code,'RUNTIME_RETIRED_POST_OWNER_ACCEPTANCE');
  const sources=['assets','functions','portal-src/current','_routes.json','scripts/build-pages-direct-canonical.mjs'];
  let count=0;
  for(const item of sources){
    const files=statSync(item).isDirectory()?sourceFiles(item):[item];
    for(const path of files){
      if(path===retired)continue;
      count++;
      const source=readFileSync(path,'utf8');
      assert.doesNotMatch(source,/(?:\/portal\/)?news-current-ui(?:\.js)?(?:[?'"]|$)/m,'current deployable reference survived: '+path);
    }
  }
  assert.ok(count>=100,'source inventory unexpectedly incomplete: '+count);
  console.log('LK_RETIRED_STUB_ZERO_ACTIVE_REFERENCES=PASS scanned='+count);
});
test('preserve current Admin/Client canonical visuals and live source dependency chain by Git blob SHA',()=>{
  for(const [path,sha] of Object.entries(frozen)){
    assert.equal(existsSync(path),true,'protected current source missing: '+path);
    assert.equal(gitBlob(path),sha,'active/source-locked file changed without Owner approval: '+path);
  }
  const admin=readFileSync('portal-src/current/admin.html','utf8');
  assert.doesNotMatch(admin,/data-page="claims"/,'Claims must remain retired from current Admin UI');
  const main=readFileSync('functions/portal/admin-main-ui-current.js','utf8');
  assert.match(main,/patchRetiredAnalyticsOwner/,'required legacy analytics visual writer is still stripped');
  const ops=readFileSync('functions/portal/admin-operations-command-center-v10-clean.js','utf8');
  assert.match(ops,/patchLegacy/,'versioned operations patch dependency is active and must not be purged');
  const news=readFileSync('assets/portal-market-news-current-v1.js','utf8');
  assert.match(news,/__RONA_MARKET_NEWS_CURRENT_V1__/,'current Market News owner removed');
  console.log('LK_CURRENT_VISUAL_SOURCE_BLOBS_UNCHANGED=PASS protected='+Object.keys(frozen).length);
});
test('Rail RPC hardening revokes only explicit anon EXECUTE and preserves authenticated callers',()=>{
  const sql=readFileSync('supabase/migrations/20261013093500_lk_rail_anon_execute_and_parser_path_v1.sql','utf8');
  const rb=readFileSync('supabase/rollbacks/20261013093500_lk_rail_anon_execute_and_parser_path_v1_rollback.sql','utf8');
  for(const fn of ['rona_admin_rail_monitoring_complete_v1(text)','rona_admin_rail_monitoring_lifecycle_v1()']){
    assert.ok(sql.includes('REVOKE EXECUTE ON FUNCTION public.'+fn+' FROM anon;'),'missing exact anon REVOKE for '+fn);
    assert.ok(sql.includes("has_function_privilege('authenticated','public."+fn+"','EXECUTE')"),'authenticated caller guard missing for '+fn);
    assert.ok(rb.includes('GRANT EXECUTE ON FUNCTION public.'+fn+' TO anon;'),'rollback does not restore exact old grant for '+fn);
  }
  assert.match(sql,/ALTER FUNCTION portal_private\.mi_curve_code_value_v1\(text,text\)\s+SET search_path TO pg_catalog, pg_temp;/i);
  assert.match(rb,/ALTER FUNCTION portal_private\.mi_curve_code_value_v1\(text,text\) RESET search_path;/i);
  const executable=sql.split('\n').filter(line=>!line.trimStart().startsWith('--')).join('\n');
  assert.doesNotMatch(executable,/\b(?:DROP|TRUNCATE|DELETE FROM|UPDATE\s+portal_private|INSERT INTO|GRANT EXECUTE TO anon)\b/i);
  assert.doesNotMatch(sql,/REVOKE\s+(?:ALL|EXECUTE)\s+ON\s+(?:ALL|SCHEMA|TABLE)/i);
  console.log('LK_RAIL_ANON_AND_PARSER_HARDENING_EXACT_SCOPE=PASS');
});
