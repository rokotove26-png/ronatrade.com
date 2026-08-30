with system_actor as (
  select u.id
  from portal_private.portal_users u
  join portal_private.staff_user_roles r on r.user_id=u.id
  where u.status='ACTIVE'::portal_private.portal_user_status_enum
    and r.status='ACTIVE'::portal_private.binding_status_enum
    and r.functional_role='SYSTEM_ADMIN'::portal_private.staff_functional_role_enum
  order by u.created_at
  limit 1
), candidates as (
  select d.id as deal_key,d.deal_id,d.source_timestamp,d.created_at,d.source_version,
         coalesce(o.supplier_approved_by,(select id from system_actor)) as decided_by
  from portal_private.deals d
  left join lateral (
    select ow.supplier_approved_by
    from portal_private.client_applications a
    join portal_private.owner_application_workflow ow on ow.application_key=a.id
    where a.linked_deal_key=d.id
    order by ow.updated_at desc
    limit 1
  ) o on true
  where d.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
    and upper(d.business_status)='EXECUTING'
    and d.source_system like 'SOURCE_FREEZE_V5%'
    and not exists(select 1 from portal_private.resource_decisions rd where rd.deal_key=d.id)
)
insert into portal_private.resource_decisions(
  resource_decision_id,deal_key,supplier_response_key,decision_state,decision_reason,decided_by,decided_at,source_system,source_version,created_at
)
select
  'RDEC-'||c.deal_id,
  c.deal_key,
  null,
  'RESOURCE_CONFIRMED',
  'Materialized from canonical legacy deal state EXECUTING imported from SOURCE_FREEZE_V5/EXECUTIVE+ACCOUNTING. This normalizes the pre-existing server meaning into resource_decisions.',
  c.decided_by,
  coalesce(c.source_timestamp,c.created_at),
  'CANONICAL_LEGACY_RESOURCE_MATERIALIZATION',
  coalesce(c.source_version,'SOURCE_FREEZE_V5'),
  now()
from candidates c
where c.decided_by is not null
on conflict(deal_key) do nothing;

insert into portal_private.audit_events(actor_user_id,actor_role,action,entity_type,entity_id,metadata)
select
  rd.decided_by,
  'SYSTEM_ADMIN',
  'LEGACY_RESOURCE_CONFIRMATION_MATERIALIZED',
  'DEAL',
  d.deal_id,
  jsonb_build_object(
    'resource_decision_id',rd.resource_decision_id,
    'decision_state',rd.decision_state,
    'source_system',rd.source_system,
    'source_version',rd.source_version,
    'source_timestamp',d.source_timestamp,
    'reason','Normalize canonical legacy EXECUTING state into authoritative resource_decisions'
  )
from portal_private.resource_decisions rd
join portal_private.deals d on d.id=rd.deal_key
where rd.source_system='CANONICAL_LEGACY_RESOURCE_MATERIALIZATION'
  and not exists(
    select 1 from portal_private.audit_events a
    where a.action='LEGACY_RESOURCE_CONFIRMATION_MATERIALIZED'
      and a.entity_type='DEAL'
      and a.entity_id=d.deal_id
  );

create or replace function portal_private.enforce_resource_confirmation_before_executing()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog','public','portal_private','auth'
as $$
declare
  v_status text;
begin
  if upper(coalesce(new.business_status,'')) <> 'EXECUTING' then return new; end if;
  if tg_op='INSERT' then
    raise exception 'RESOURCE_CONFIRMATION_REQUIRED_BEFORE_EXECUTING' using errcode='23514';
  end if;
  select r.resource_status into v_status
  from portal_private.resolve_deal_resource_state(new.id) r;
  if coalesce(v_status,'RESOURCE_PENDING') <> 'RESOURCE_CONFIRMED' then
    raise exception 'RESOURCE_CONFIRMATION_REQUIRED_BEFORE_EXECUTING' using errcode='23514';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_deal_executing_requires_resource on portal_private.deals;
create trigger trg_deal_executing_requires_resource
before insert or update of business_status
on portal_private.deals
for each row
execute function portal_private.enforce_resource_confirmation_before_executing();
