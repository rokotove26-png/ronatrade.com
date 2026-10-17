-- Operations V12: event invalidation only. No Finance/source record mutation.
-- Existing portal_private.rona_admin_operations_touch_v1() emits one coalesced
-- transaction-level FINANCE or DOCUMENTS domain version increment.
-- Rollback: DROP TRIGGER rona_admin_operations_signal_v1 ON each of the three tables.
DO $$
DECLARE item record;
BEGIN
 IF to_regprocedure('portal_private.rona_admin_operations_touch_v1()') IS NULL
    OR to_regclass('public.rona_admin_operations_invalidation_v1') IS NULL THEN
   RAISE EXCEPTION 'OPERATIONS_V12_EVENT_INFRASTRUCTURE_REQUIRED';
 END IF;
 FOR item IN SELECT * FROM (VALUES
   ('deal_finance_authority_v7','FINANCE'),
   ('finance_signed_schedule_jobs_v8','FINANCE'),
   ('document_versions','DOCUMENTS')
 ) AS target(table_name,domain)
 LOOP
   IF to_regclass('portal_private.'||item.table_name) IS NULL THEN
     RAISE EXCEPTION 'OPERATIONS_V12_SOURCE_TABLE_MISSING: %',item.table_name;
   END IF;
   IF EXISTS (
     SELECT 1 FROM pg_catalog.pg_trigger
     WHERE tgrelid=to_regclass('portal_private.'||item.table_name)
       AND tgname='rona_admin_operations_signal_v1'
   ) THEN
     RAISE EXCEPTION 'OPERATIONS_V12_SOURCE_SIGNAL_ALREADY_PRESENT: %',item.table_name;
   END IF;
   EXECUTE format(
     'CREATE TRIGGER rona_admin_operations_signal_v1 AFTER INSERT OR UPDATE OR DELETE ON portal_private.%I FOR EACH ROW EXECUTE FUNCTION portal_private.rona_admin_operations_touch_v1(%L)',
     item.table_name,item.domain
   );
 END LOOP;
 -- Presence connection lifecycle, not 25-second last_seen_at heartbeats:
 -- publish a small OPERATIONS version only when a client/agent connects,
 -- disconnects or their identity/role changes.
 IF to_regclass('portal_private.portal_presence_connections_v1') IS NULL THEN
   RAISE EXCEPTION 'OPERATIONS_V12_PRESENCE_TABLE_MISSING';
 END IF;
 IF EXISTS (SELECT 1 FROM pg_catalog.pg_trigger
   WHERE tgrelid='portal_private.portal_presence_connections_v1'::regclass
     AND tgname='rona_admin_operations_presence_signal_v12') THEN
   RAISE EXCEPTION 'OPERATIONS_V12_PRESENCE_SIGNAL_ALREADY_PRESENT';
 END IF;
 CREATE TRIGGER rona_admin_operations_presence_signal_v12
   AFTER INSERT OR DELETE OR UPDATE OF portal_user_id, portal_role, session_subject
   ON portal_private.portal_presence_connections_v1
   FOR EACH ROW EXECUTE FUNCTION portal_private.rona_admin_operations_touch_v1('OPERATIONS');
END $;
