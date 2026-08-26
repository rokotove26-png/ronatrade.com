do $$
declare
  v_actor uuid := '1eb4902b-3dea-4a04-ad30-2ba47d76cda8'::uuid;
  v_event uuid := '0ce70e6d-b9c3-4d49-af13-0a8b7d62a2c7'::uuid;
  v_task uuid := '8cce7fb9-d304-402d-be21-dfc60387dcba'::uuid;
  v_from portal_private.staff_task_status_enum;
begin
  if not exists (
    select 1 from portal_private.deals
    where id='8ed58e6d-a353-5be7-bd6e-bb739dd273ae'::uuid
      and deal_id='DEAL-2026-003'
      and business_status::text='CANCELLED'
      and lifecycle_state::text='CLOSED'
      and closed_at is not null
  ) then
    raise exception 'DEAL003_NOT_AUTHORITATIVELY_CLOSED';
  end if;

  select status into v_from from portal_private.staff_tasks where id=v_task for update;
  if not found then raise exception 'DEAL003_STALE_TASK_NOT_FOUND'; end if;

  update portal_private.portal_reverse_events
     set processing_state='ACKNOWLEDGED', acknowledgement_state='ACKNOWLEDGED',
         acknowledged_at=coalesce(acknowledged_at,now()), acknowledged_by=coalesce(acknowledged_by,v_actor),
         next_retry_at=null,last_error_code=null,last_error_text=null,updated_at=now()
   where id=v_event and event_type='DEAL_CANCELLED' and authority_target_id='DEAL-2026-003'
     and processing_state='QUEUED' and acknowledgement_state='PENDING';

  update portal_private.staff_tasks
     set status='CLOSED'::portal_private.staff_task_status_enum,
         acknowledged_at=coalesce(acknowledged_at,now()), acknowledged_by=coalesce(acknowledged_by,v_actor),
         decision='TECHNICAL_RECONCILIATION_ALREADY_CANCELLED',decision_at=now(),decision_by=v_actor,updated_at=now()
   where id=v_task and source_reverse_event_key=v_event and status not in ('DECIDED','COMPLETED','REJECTED','CLOSED');

  insert into portal_private.staff_task_history(task_key,event_type,actor_user_id,actor_functional_role,from_status,to_status,note,metadata)
  values (v_task,'TECHNICAL_RECONCILIATION',v_actor,'SYSTEM_ADMIN'::portal_private.staff_functional_role_enum,v_from,'CLOSED'::portal_private.staff_task_status_enum,
    'Redundant DEAL_CANCELLED reverse-event terminally reconciled because DEAL-2026-003 was already authoritative CANCELLED/CLOSED; no business record was changed.',
    jsonb_build_object('deal_id','DEAL-2026-003','reverse_event_id','EVT-R1-b981bb03-9650-4dc0-89f9-fefa71255dcd','legacy_assigned_role','EXECUTIVE_DIRECTOR','canonical_future_role','OPERATIONS_DIRECTOR','business_record_changed',false));

  insert into portal_private.audit_events(actor_user_id,actor_role,action,entity_type,entity_id,metadata,severity,result)
  values (v_actor,'SYSTEM_ADMIN','REVERSE_EVENT_TECHNICAL_RECONCILIATION','PORTAL_REVERSE_EVENT','EVT-R1-b981bb03-9650-4dc0-89f9-fefa71255dcd',
    jsonb_build_object('deal_id','DEAL-2026-003','deal_authoritative_state','CANCELLED/CLOSED','reverse_event_state','ACKNOWLEDGED','staff_task_state','CLOSED','legacy_staff_role_preserved_historically','EXECUTIVE_DIRECTOR','future_routing_role','OPERATIONS_DIRECTOR','authoritative_business_data_changed',false),
    'WARNING','SUCCESS');
end $$;
