-- Client/Application resource projection authority correction.
-- No business-data mutation. The canonical application projection must consume the
-- existing deal-level resource resolver instead of treating owner_application_workflow
-- as the only source of truth. This specifically covers legacy/historical applications
-- whose RESOURCE_CONFIRMED fact was materialized in resource_decisions.

create or replace function portal_private.application_business_row_v2(p_application_key uuid)
returns jsonb language plpgsql stable security definer set search_path='pg_catalog','portal_private' as $$
declare
  row jsonb;
  source_form jsonb;
  a portal_private.client_applications;
  resource record;
begin
  row:=portal_private.application_business_row_review_base_v2(p_application_key);
  if row is null then raise exception 'CANONICAL_APPLICATION_NOT_FOUND'; end if;

  select * into a from portal_private.client_applications where id=p_application_key;

  -- A linked Deal already has a single canonical resource authority which reconciles
  -- explicit resource_decisions, legacy owner workflow evidence and deal state.
  -- Consume it here; do not synthesize confirmation from UI/application state.
  if a.linked_deal_key is not null then
    select * into resource from portal_private.resolve_deal_resource_state(a.linked_deal_key);
    row:=row||jsonb_build_object(
      'resource_status',case when resource.resource_status='RESOURCE_CONFIRMED'
        then 'RESOURCE_CONFIRMED' else 'RESOURCE_NOT_CONFIRMED' end,
      'resource_source',case when resource.resource_status='RESOURCE_CONFIRMED'
        then nullif(resource.resource_source,'NO_AUTHORITATIVE_RESOURCE_FACT') else null end
    );
  end if;

  select portal_private.client_intake_effective_payload_v1(i.intake_id) into source_form
    from portal_private.client_intake_v1 i where i.application_key=a.id
    order by case when i.actionable_type like 'APPLICATION_DETAILS_%' then 0 else 1 end,
      i.source_submitted_at desc,i.intake_id limit 1;

  return row||jsonb_build_object(
    'counter_offer_active',coalesce((row->>'counter_offer_used')::boolean,false)
      and row->>'owner_status'='COUNTER_OFFERED'
      and coalesce(row->>'client_counter_response','') not in ('ACCEPTED','DECLINED'),
    'supplier_approved_at',(select supplier_approved_at from portal_private.owner_application_workflow where application_key=a.id),
    'source_form_payload',source_form,'price_unit','t',
    'intake_id',(select primary_intake_id from portal_private.client_application_registry_v2 where application_key=a.id),
    'durable_id',(select i.durable_id from portal_private.client_intake_v1 i
      join portal_private.client_application_registry_v2 r on r.primary_intake_id=i.intake_id where r.application_key=a.id),
    'source_id',(select source_record_id from portal_private.client_application_registry_v2 where application_key=a.id)
  );
end $$;

revoke all on function portal_private.application_business_row_v2(uuid)
from public,anon,authenticated,service_role;
