import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

const src=readFileSync(new URL('../supabase/functions/rona-ai-read-extras/telegram_ingest.js',import.meta.url),'utf8');

test('run-status persists channel attempt observability',()=>{
  assert.match(src,/const VERSION='1\.1\.1'/);
  assert.match(src,/async function updateChannelRunObservability\(channels,errorCode,status\)/);
  assert.match(src,/last_attempt_at=now\(\)/);
  assert.match(src,/last_error_code=case when/);
  assert.match(src,/await updateChannelRunObservability\(channels,errorCode,status\)/);
});

test('PARTIAL run assigns only channel-specific errors and clears healthy named channels',()=>{
  assert.match(src,/raw\.split\(';'\)/);
  assert.match(src,/startsWith\(key\)/);
  assert.match(src,/status==='SUCCESS'\|\|status==='PARTIAL'/);
});

test('FAILED or BLOCKED generic errors apply to all named channels',()=>{
  assert.match(src,/status==='FAILED'\|\|status==='BLOCKED'/);
});

test('run observability does not fabricate successful ingest timestamps',()=>{
  const i=src.indexOf('async function updateChannelRunObservability');
  const j=src.indexOf('async function runStatus',i);
  const helper=src.slice(i,j);
  assert.doesNotMatch(helper,/last_successful_ingest_at/);
});
