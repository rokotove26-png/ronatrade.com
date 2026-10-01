import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source=readFileSync('functions/assistant/[[path]].js','utf8');
const routes=JSON.parse(readFileSync('_routes.json','utf8'));

test('Assistant public proxy uses fixed canonical upstream',()=>{
  assert.match(source,/rona-mcp-gateway\/assistant/);
  assert.match(source,/const prefix='\/assistant'/);
});

test('Assistant public proxy forwards methods and buffers non-GET bodies',()=>{
  assert.match(source,/redirect:'manual'/);
  assert.match(source,/request\.method!=='GET'&&request\.method!=='HEAD'/);
  assert.match(source,/request\.arrayBuffer\(\)/);
});

test('Assistant public route is included in Cloudflare Pages Functions routing',()=>{
  assert.ok(routes.include.includes('/assistant/*'));
});

test('Assistant proxy normalizes MCP-relative metadata discovery',()=>{
  assert.match(source,/well-known/);
});

test('Assistant authorize page is forced to HTML at the public proxy',()=>{
  assert.match(source,/pathname==='\/assistant\/authorize'/);
  assert.match(source,/text\/html; charset=utf-8/);
});
