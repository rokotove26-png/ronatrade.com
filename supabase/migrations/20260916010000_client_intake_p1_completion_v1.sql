-- P1 Client Intake completion delta, 2026-09-16.
-- Fixes bounded historical reconciliation progress and exposes durable client requests
-- through the existing authenticated Client Applications projection contract.

create or replace function portal_private.reconcile_client_intake_v1(
  p_limit integer default 500,
  p_stuck_interval interval default interval '5 minutes'
) returns jsonb
language plpgsql
security definer
set search_path='pg_catalog','portal_private'
as $$
declare
  r record;
begin
  -- Recover only source rows that do not yet have a durable intake. Repeated bounded runs
  -- therefore advance through the full historical set instead of selecting the same prefix.
  for r in
    select e.event_id
      from portal_private.portal_reverse_events e
     where e.actor_role='CLIENT'::portal_private.portal_role_enum
       and e.event_type like 'CLIENT_%'
       and e.processing_state not in ('REJECTED','FAILED','DEAD_LETTER')
       and not exists(
         select 1 from portal_private.client_intake_v1 i
          where i.source_kind='PORTAL_REVERSE_EVENT'
            and i.source_record_id=e.event_id
       )
     order by e.created_at,e.id
     limit greatest(1,least(coalesce(p_limit,500),5000))
  loop
    perform portal_private.ensure_client_intake_from_reverse_event_v1(r.event_id);
  end loop;

  for r in
    select a.application_id
      from portal_private.client_applications a
     where a.submitted_at is not null
       and not exists(
         select 1 from portal_private.client_intake_v1 i
          where i.source_kind='CLIENT_APPLICATION'
            and i.source_record_id=a.application_id
       )
     order by a.created_at,a.id
     limit greatest(1,least(coalesce(p_limit,500),5000))
  loop
    perform portal_private.ensure_client_intake_from_application_v1(r.application_id);
  end loop;

  insert into portal_private.client_intake_routing_outbox_v1(intake_id,stage_key,state,last_error_code,next_attempt_at)
  select i.intake_id,'RESPONSIBLE_ROLE_ROUTING',
         case when i.routing_policy_key is null then 'FAILED_RETRYABLE' else 'PENDING' end,
         case when i.routing_policy_key is null then 'ROUTING_POLICY_RECHECK' end,
         now()
    from portal_private.client_intake_v1 i
   where i.routing_state<>'DEAD_LETTER'
     and not exists(
       select 1 from portal_private.client_intake_routing_outbox_v1 q
        where q.intake_id=i.intake_id and q.stage_key='RESPONSIBLE_ROLE_ROUTING'
     )
  on conflict(intake_id,stage_key) do nothing;

  update portal_private.client_intake_routing_outbox_v1 q
     set state='FAILED_RETRYABLE',last_error_code='STUCK_PROCESSING_RECOVERED',next_attempt_at=now(),updated_at=now()
   where q.state='PROCESSING'
     and coalesce(q.processing_started_at,q.updated_at)<now()-p_stuck_interval;
  update portal_private.client_intake_v1 i
     set routing_state='FAILED_RETRYABLE',routing_reason='STUCK_PROCESSING_RECOVERED',updated_at=now()
    from portal_private.client_intake_routing_outbox_v1 q
   where q.intake_id=i.intake_id
     and q.state='FAILED_RETRYABLE'
     and q.last_error_code='STUCK_PROCESSING_RECOVERED';

  update portal_private.client_intake_v1 i
     set client_visible=true,admin_visible=true,updated_at=now()
   where (not i.client_visible or not i.admin_visible)
     and i.routing_state<>'DEAD_LETTER';

  update portal_private.client_intake_routing_outbox_v1 q
     set state='FAILED_RETRYABLE',last_error_code='REQUIRED_TASK_MISSING',next_attempt_at=now(),updated_at=now()
    from portal_private.client_intake_v1 i
   where q.intake_id=i.intake_id
     and q.stage_key='RESPONSIBLE_ROLE_ROUTING'
     and q.state='APPLIED'
     and i.task_required
     and not exists(
       select 1 from portal_private.client_intake_task_links_v1 l
        where l.intake_id=i.intake_id and l.stage_key=q.stage_key
     );
  update portal_private.client_intake_routing_outbox_v1
     set next_attempt_at=now(),updated_at=now()
   where state='FAILED_RETRYABLE' and (next_attempt_at is null or next_attempt_at>now());

  perform portal_private.process_client_intake_outbox_v1(p_limit);

  -- Only convergable applied rows are considered. Successful convergence removes each row
  -- from this working set, so a small p_limit cannot permanently starve later historical rows.
  for r in
    select i.intake_id
      from portal_private.client_intake_v1 i
      join portal_private.portal_reverse_events e on e.id=i.source_internal_key
     where i.source_kind='PORTAL_REVERSE_EVENT'
       and i.routing_state='APPLIED'
       and e.processing_state in ('RECEIVED','VALIDATED','QUEUED','PROCESSING')
     order by i.created_at,i.intake_id
     limit greatest(1,least(coalesce(p_limit,500),5000))
  loop
    perform portal_private.converge_client_intake_source_state_v1(r.intake_id);
  end loop;

  return (
    select pg_catalog.jsonb_build_object(
      'actionable_client_intake_total',count(*),
      'unrouted_client_intake_count',count(*) filter(where routing_state<>'APPLIED'),
      'client_invisible_intake_count',count(*) filter(where not client_visible),
      'admin_invisible_intake_count',count(*) filter(where not admin_visible),
      'dual_invisible_actionable_intake_count',count(*) filter(where not client_visible and not admin_visible),
      'reverse_source_missing_intake_count',(
        select count(*) from portal_private.portal_reverse_events e
         where e.actor_role='CLIENT'::portal_private.portal_role_enum
           and e.event_type like 'CLIENT_%'
           and e.processing_state not in ('REJECTED','FAILED','DEAD_LETTER')
           and not exists(
             select 1 from portal_private.client_intake_v1 i2
              where i2.source_kind='PORTAL_REVERSE_EVENT' and i2.source_record_id=e.event_id
           )
      ),
      'application_source_missing_intake_count',(
        select count(*) from portal_private.client_applications a
         where a.submitted_at is not null
           and not exists(
             select 1 from portal_private.client_intake_v1 i2
              where i2.source_kind='CLIENT_APPLICATION' and i2.source_record_id=a.application_id
           )
      ),
      'stuck_intake_count',(
        select count(*) from portal_private.client_intake_routing_outbox_v1
         where state='PROCESSING' and coalesce(processing_started_at,updated_at)<now()-p_stuck_interval
      ),
      'oldest_stuck_intake_age',(
        select max(now()-coalesce(processing_started_at,updated_at)) from portal_private.client_intake_routing_outbox_v1
         where state='PROCESSING' and coalesce(processing_started_at,updated_at)<now()-p_stuck_interval
      )
    )
    from portal_private.client_intake_v1
  );
end
$$;

-- Keep the existing public function signature used by the deployed Cloudflare Client LK,
-- but add visible durable CLIENT_REQUEST rows sourced from the unified intake ledger.
create or replace function public.rona_client_application_projection(p_client_id text, p_contract_id text)
returns table(
  application_id text,
  product text,
  quantity_tonnes numeric,
  delivery_period_from date,
  delivery_period_to date,
  delivery_basis text,
  destination text,
  payment_terms text,
  application_price numeric,
  application_currency character,
  status text,
  resource_status text,
  resource_label text,
  resource_source text,
  deal_id text,
  submitted_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path='public','portal_private','pg_temp'
as $$
  with authorized as (
    select cl.id as client_key,ct.id as contract_key,pu.id as portal_user_id
      from portal_private.clients cl
      join portal_private.contracts ct on ct.client_key=cl.id
      join portal_private.portal_users pu on pu.auth_user_id=auth.uid()
       and pu.status='ACTIVE'::portal_private.portal_user_status_enum
       and pu.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
      join portal_private.client_user_bindings b on b.user_id=pu.id
       and b.client_key=cl.id
       and b.contract_key=ct.id
       and b.status='ACTIVE'::portal_private.binding_status_enum
       and b.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
       and b.revoked_at is null
       and b.valid_from<=now()
       and (b.valid_to is null or b.valid_to>now())
     where cl.client_id=p_client_id
       and ct.contract_id=p_contract_id
       and portal_private.client_user_has_contract_access(pu.id,ct.id,now())
  ), current_applications as (
    select
      a.application_id,
      a.product,
      a.quantity_tonnes,
      a.delivery_period_from,
      a.delivery_period_to,
      a.delivery_basis,
      a.destination,
      a.payment_terms,
      coalesce(al.proposed_price,al.published_price,a.proposed_price) as application_price,
      coalesce(al.currency,a.proposed_currency) as application_currency,
      a.status::text as status,
      case when oaw.supplier_approved_at is not null then 'RESOURCE_CONFIRMED' else 'RESOURCE_NOT_CONFIRMED' end as resource_status,
      case when oaw.supplier_approved_at is not null then 'Ресурс подтвержден' else 'Ресурс не подтвержден' end as resource_label,
      case when oaw.supplier_approved_at is not null then 'OWNER_APPLICATION_WORKFLOW_SUPPLIER_APPROVAL' else 'OWNER_APPLICATION_WORKFLOW_PENDING' end as resource_source,
      d.deal_id,
      a.submitted_at,
      a.updated_at
    from portal_private.client_applications a
    join authorized z on z.client_key=a.client_key and z.contract_key=a.contract_key
    left join portal_private.application_lines al on al.application_key=a.id and al.line_no=1
    left join portal_private.owner_application_workflow oaw on oaw.application_key=a.id
    left join portal_private.deals d on d.id=a.linked_deal_key
    where a.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
      and (a.linked_deal_key is null or portal_private.client_user_has_deal_access(z.portal_user_id,a.linked_deal_key,now()))
  ), request_intakes as (
    select
      i.source_record_id as application_id,
      ep.payload->>'product' as product,
      case when pg_catalog.jsonb_typeof(ep.payload->'quantity_tonnes')='number' then (ep.payload->>'quantity_tonnes')::numeric end as quantity_tonnes,
      case when coalesce(ep.payload#>>'{shipment,period_from}',ep.payload#>>'{delivery,period_from}','') ~ '^\d{4}-\d{2}-\d{2}' then left(coalesce(ep.payload#>>'{shipment,period_from}',ep.payload#>>'{delivery,period_from}'),10)::date end as delivery_period_from,
      case when coalesce(ep.payload#>>'{shipment,period_to}',ep.payload#>>'{delivery,period_to}','') ~ '^\d{4}-\d{2}-\d{2}' then left(coalesce(ep.payload#>>'{shipment,period_to}',ep.payload#>>'{delivery,period_to}'),10)::date end as delivery_period_to,
      coalesce(ep.payload#>>'{shipment,source_basis}',ep.payload#>>'{delivery,basis}') as delivery_basis,
      coalesce(ep.payload#>>'{destination,station}',ep.payload->>'destination') as destination,
      ep.payload#>>'{commercial,payment_terms}' as payment_terms,
      null::numeric as application_price,
      null::character as application_currency,
      'SUBMITTED'::text as status,
      'RESOURCE_NOT_CONFIRMED'::text as resource_status,
      'Ресурс не подтвержден'::text as resource_label,
      'CLIENT_INTAKE_DURABLE_V1'::text as resource_source,
      d.deal_id,
      i.source_submitted_at as submitted_at,
      i.updated_at
    from portal_private.client_intake_v1 i
    join authorized z on z.client_key=i.client_key and z.contract_key=i.contract_key
    cross join lateral (
      select portal_private.client_intake_effective_payload_v1(i.intake_id) as payload
    ) ep
    left join portal_private.deals d on d.id=i.deal_key
    where i.source_kind='PORTAL_REVERSE_EVENT'
      and i.client_visible
      and (i.actionable_type not like 'APPLICATION_DETAILS_%' or i.application_key is null)
      and (i.deal_key is null or portal_private.client_user_has_deal_access(z.portal_user_id,i.deal_key,now()))
  )
  select * from current_applications
  union all
  select * from request_intakes
  order by submitted_at desc nulls last,application_id;
$$;

comment on function portal_private.reconcile_client_intake_v1(integer,interval)
  is 'P1 Client Intake bounded self-healing reconciler with anti-starvation source recovery.';
comment on function public.rona_client_application_projection(text,text)
  is 'Authenticated Client LK applications/request projection backed by client_applications plus durable client intake.';
