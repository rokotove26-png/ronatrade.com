import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';

const applied=[
  {
    version:'20261013093143',
    name:'lk_rail_anon_execute_and_parser_path_v1',
    md5:'5c99d0beee7ce0cfff675e11ff1fd680',
    bytes:2465,
    priorDraftVersion:'20261013093500'
  },
  {
    version:'20261013104046',
    name:'quarantine_stale_pr462_qa_admin_v1',
    md5:'c58459191891cb5e99d95ea3f3edd466',
    bytes:6507,
    priorDraftVersion:'20261013133500'
  },
  {
    version:'20261013110724',
    name:'radio_qa_orphan_admin_and_suspended_oidc_session_closure_v1',
    md5:'06ab0896148867026dfb3f0ccdcb226e',
    bytes:8671,
    priorDraftVersion:'20261013113500'
  },
  {
    version:'20261013112823',
    name:'expire_single_suspended_phase5c_qa_session_v1',
    md5:'32672e237d8dc70900383bea2da41572',
    bytes:3480,
    priorDraftVersion:'20261013115000'
  }
];
function fileName(x){return 'supabase/migrations/'+x.version+'_'+x.name+'.sql';}
function digest(s){return createHash('md5').update(s).digest('hex');}

test('four recorded SQL migrations have exact live registered versions and byte-identical content',()=>{
  assert.equal(applied.length,4);
  assert.equal(new Set(applied.map(x=>x.version)).size,4);
  assert.equal(new Set(applied.map(x=>x.name)).size,4);
  for(const x of applied){
    const path=fileName(x);
    assert.ok(existsSync(path), 'missing known production migration '+path);
    const s=readFileSync(path,'utf8');
    assert.equal(s.length,x.bytes,'source length drift '+path);
    assert.equal(digest(s),x.md5,'deployed SQL digest drift '+path);
    assert.equal(existsSync('supabase/migrations/'+x.priorDraftVersion+'_'+x.name+'.sql'),false,
      'duplicate stale timestamp would trigger unwanted db push '+x.name);
    assert.match(s,/^BEGIN;/m);
    assert.match(s,/\bCOMMIT;\s*$/);
    console.log('LIVE_SOURCE_HISTORY_PARITY=PASS '+x.version+' '+x.name+' '+x.md5);
  }
});
test('source recovery is audit-only: reject any SQL rewrite or fresh security privilege expansion',()=>{
  const rail=readFileSync(fileName(applied[0]),'utf8');
  const oidc=readFileSync(fileName(applied[1]),'utf8');
  const roles=readFileSync(fileName(applied[2]),'utf8');
  const phase=readFileSync(fileName(applied[3]),'utf8');
  assert.match(rail,/REVOKE EXECUTE ON FUNCTION public\.rona_admin_rail_monitoring_complete_v1\(text\) FROM anon/);
  assert.match(rail,/REVOKE EXECUTE ON FUNCTION public\.rona_admin_rail_monitoring_lifecycle_v1\(\) FROM anon/);
  assert.match(oidc,/QA_GITHUB_OIDC_PR462/);
  assert.match(oidc,/PR462_QA_QUARANTINE_SOURCE_LOCK_FAIL/);
  assert.match(roles,/RADIO_QA_ORPHAN_PERMISSIONS_SOURCE_LOCK/);
  assert.match(roles,/OIDC_SUSPENDED_QA_OTHER_ROLE_OR_AUTH_LINK_SOURCE_LOCK/);
  assert.match(phase,/QA_PHASE5C_EXACT_ONE_SUSPENDED_SESSION_REQUIRED/);
  for(const x of applied){
    const s=readFileSync(fileName(x),'utf8');
    const executable=s.split('\n').filter(line=>!line.trimStart().startsWith('--')).join('\n');
    assert.doesNotMatch(executable,/\b(?:DROP|TRUNCATE|DELETE\s+FROM)\b/i);
    assert.doesNotMatch(executable,/GRANT EXECUTE ON FUNCTION[\s\S]{0,160}TO (?:anon|public)/i);
  }
});
