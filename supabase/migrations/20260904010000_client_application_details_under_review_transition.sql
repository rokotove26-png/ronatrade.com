create or replace function portal_private.trg_client_application_details_under_review()
returns trigger
language plpgsql
set search_path to 'pg_catalog','portal_private'
as $$
declare
  v_updated integer := 0;
begin
  if new.actor_role = 'CLIENT'::portal_private.portal_role_enum
     and new.event_type = 'CLIENT_MESSAGE_SUBMIT'
     and upper(coalesce(new.authority_domain,'')) = 'APPLICATION'
     and upper(coalesce(new.authority_target_type,'')) = 'APPLICATION'
     and coalesce(new.authority_target_id,'') <> ''
     and coalesce(new.payload->>'application_id','') = new.authority_target_id
     and coalesce(new.payload->>'message_type','') like 'APPLICATION_DETAILS_%'
  then
    update portal_private.client_applications a
       set status='UNDER_REVIEW'::portal_private.application_status_enum,
           updated_at=now()
     where a.application_id=new.authority_target_id
       and a.client_key=new.client_key
       and a.contract_key=new.contract_key
       and a.status='SUBMITTED'::portal_private.application_status_enum;
    get diagnostics v_updated = row_count;
    if v_updated > 0 then
      insert into portal_private.audit_events(
        actor_user_id,actor_role,action,entity_type,entity_id,
        request_id,correlation_id,metadata
      ) values(
        new.actor_user_id,'CLIENT','APPLICATION_AUTO_UNDER_REVIEW','APPLICATION',new.authority_target_id,
        new.request_id,new.correlation_id,
        jsonb_build_object('event_id',new.event_id,'source','APPLICATION_DETAILS_EVENT')
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_client_application_details_under_review on portal_private.portal_reverse_events;
create trigger trg_client_application_details_under_review
after insert on portal_private.portal_reverse_events
for each row execute function portal_private.trg_client_application_details_under_review();
