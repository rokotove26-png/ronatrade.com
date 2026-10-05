import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync('supabase/migrations/20261005193000_admin_closeout_documents_projection_v1.sql','utf8');

test('Admin deals projection exposes every CLOSEOUT document kind',()=>{
  for(const kind of [
    'ADDENDUM',
    'INVOICE',
    'SIGNED_ADDENDUM',
    'EMPTY_WAGON_RETURN_INSTRUCTION',
    'EMPTY_WAGON_RETURN_RAIL_CODES',
    'SMGS_DELIVERY_STAMP',
    'SMGS_EMPTY_WAGONS'
  ]) assert.match(sql,new RegExp(kind));
  assert.match(sql,/owner_deals_current_v3/);
  assert.match(sql,/create or replace function public\.owner_deals_current_v3\(\)/);
  assert.match(sql,/security definer/);
  assert.match(sql,/position\(v_old in v_src\)=0/);
});
