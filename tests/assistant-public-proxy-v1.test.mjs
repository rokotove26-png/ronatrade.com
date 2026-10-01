import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source=readFileSync('functions/assistant/[[path]].js','utf8');

test('Assistant public proxy uses fixed canonical upstream',()=>{
  assert.match(source,/rona-mcp-gateway\/assistant/);
  assert.match(source,/const prefix='\/assistant'/);
});

test('Assistant public proxy forwards request methods and keeps redirects manual',()=>{
  assert.match(source,/redirect:'manual'/);
  assert.match(source,/request\.method!=='GET'&&request\.method!=='HEAD'/);
  assert.match(source,/init\.body=request\.body/);
});
