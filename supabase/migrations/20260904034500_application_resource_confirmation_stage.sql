create or replace function portal_private.normalize_application_resource_confirmation_stage()
returns trigger
language plpgsql
set search_path = 'pg_catalog', 'portal_private'
as $$
begin
  if new.business_status in ('SUPPLIER_REVIEW','CLIENT_COUNTER_ACCEPTED') then
    new.business_status := 'SUPPLIER_PENDING';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_normalize_application_resource_confirmation_stage on portal_private.owner_application_workflow;
create trigger trg_normalize_application_resource_confirmation_stage
before insert or update of business_status on portal_private.owner_application_workflow
for each row
execute function portal_private.normalize_application_resource_confirmation_stage();

update portal_private.owner_application_workflow w
set business_status='SUPPLIER_PENDING', updated_at=now()
from portal_private.client_applications a
where a.id=w.application_key
  and a.status='ACCEPTED_AWAITING_DEAL_REGISTRATION'::portal_private.application_status_enum
  and w.business_status in ('SUPPLIER_REVIEW','CLIENT_COUNTER_ACCEPTED')
  and w.supplier_approved_at is null;
