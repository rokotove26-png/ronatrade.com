import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration=fs.readFileSync(
  'supabase/migrations/20260922151500_admin_user_delete_auth_history_v1.sql',
  'utf8'
);

test('reverse-event auth identity becomes an immutable insert-validated snapshot',()=>{
  for(const marker of [
    'validate_reverse_event_actor_auth_identity_v1',
    "pu.auth_user_id=new.actor_auth_user_id",
    "pu.status='ACTIVE'",
    "pu.lifecycle_state='ACTIVE'",
    'REVERSE_EVENT_ACTOR_AUTH_IDENTITY_INVALID',
    'drop constraint if exists portal_reverse_events_actor_auth_user_id_fkey',
    'Immutable historical Auth subject snapshot'
  ]) assert.ok(migration.includes(marker),marker);
});

test('permanent Auth deletion never deletes or rewrites reverse-event history',()=>{
  assert.ok(migration.includes('before insert on portal_private.portal_reverse_events'));
  assert.ok(migration.includes('actor_auth_user_id_nullable'));
  assert.doesNotMatch(migration,/delete\s+from\s+portal_private\.portal_reverse_events/i);
  assert.doesNotMatch(migration,/update\s+portal_private\.portal_reverse_events\s+set\s+actor_auth_user_id/i);
});

test('failed user deletion remains visible and retryable in Admin access workspace',()=>{
  for(const marker of [
    "'deletionPending',u.deletion_pending",
    "PORTAL_USER_DELETE_AUTH_FAILED_BY_ADMIN",
    "PORTAL_USER_DELETED_BY_ADMIN",
    'u.deletion_pending'
  ]) assert.ok(migration.includes(marker),marker);
});
