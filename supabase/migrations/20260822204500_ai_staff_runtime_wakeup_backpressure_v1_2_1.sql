-- AI STAFF RUNTIME V1.2.1
-- Prevent row-level wakeup fan-out during bulk queue inserts while preserving immediate event-driven dispatch.

create or replace function portal_private.wake_ai_runtime_after_queue_insert()
returns trigger language plpgsql security definer set search_path='pg_catalog','portal_private','private' as $$
begin
  perform private.invoke_rona_ai_coordination_runtime('dispatch','{}'::jsonb);
  return null;
exception when others then
  return null;
end $$;

drop trigger if exists trg_ai_runtime_queue_wake on portal_private.ai_runtime_queue;
create trigger trg_ai_runtime_queue_wake
after insert on portal_private.ai_runtime_queue
for each statement execute function portal_private.wake_ai_runtime_after_queue_insert();

update portal_private.ai_runtime_control
set worker_version='1.2.1',updated_at=now()
where singleton=true;
