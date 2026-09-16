-- Candidate-only declarative coverage for the server-accepted CLIENT_APPLICATION_SUBMIT reverse-event family.
-- This is configuration, not an event-ID special case.
insert into portal_private.client_intake_routing_registry_v1
  (policy_key,source_kind,actionable_type,responsible_role,task_required,client_visible,admin_visible,acknowledgement_required,priority,effective_at)
values
  ('CLIENT_APPLICATION_SUBMIT_EVENT_V1','PORTAL_REVERSE_EVENT','CLIENT_APPLICATION_SUBMIT','OPERATIONS_DIRECTOR',true,true,true,true,100,'2026-09-15 00:00:00+00')
on conflict(policy_key) do nothing;
