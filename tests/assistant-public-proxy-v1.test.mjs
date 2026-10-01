import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source=readFileSync('functions/assistant/[[path]].js','utf8');
const authorize=readFileSync('functions/assistant/authorize.js','utf8');
const authorizeModule=await import('../functions/assistant/authorize.js');
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


test('Assistant exact authorize handler owns GET and POST consent traffic',()=>{
  assert.match(authorize,/rona-mcp-gateway\/assistant\/authorize/);
  assert.match(authorize,/method:request\.method/);
  assert.match(authorize,/redirect:'manual'/);
  assert.match(authorize,/request\.arrayBuffer\(\)/);
  assert.match(authorize,/text\/html; charset=utf-8/);
  assert.match(authorize,/headers:returnedHeaders\(upstream\.headers,request\.method,upstream\.status\)/);
});


test('Assistant exact authorize handler module loads',()=>{
  assert.equal(typeof authorizeModule.onRequest,'function');
});
