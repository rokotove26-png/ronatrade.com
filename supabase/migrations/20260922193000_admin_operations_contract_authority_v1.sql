-- Admin Operations V10 contract authority correction.
-- Scope: read-model only. No contract mutation.

CREATE OR REPLACE FUNCTION public.rona_admin_operations_current_v2()
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'portal_private', 'auth'
AS $function$
with
actor as (
  select portal_private.owner_r1_actor('ADMIN') as portal_user_id
),
docs as (
  select
    odd.deal_key,
    count(*) filter (where doc.lifecycle_state::text='ACTIVE')::int as document_count,
    count(*) filter (where doc.lifecycle_state::text='ACTIVE' and odd.checked_by_admin=false)::int as unchecked_count,
    bool_or(doc.lifecycle_state::text='ACTIVE' and odd.document_kind='SIGNED_ADDENDUM') as has_signed_addendum,
    bool_or(doc.lifecycle_state::text='ACTIVE' and odd.document_kind='INVOICE') as has_invoice
  from portal_private.owner_deal_documents odd
  join portal_private.documents doc on doc.id=odd.document_key
  group by odd.deal_key
),
rail_docs as (
  select deal_key,count(*)::int as gu12_count
  from portal_private.rail_documents
  where lifecycle_state::text='ACTIVE' and upper(document_type)='GU-12'
  group by deal_key
),
rail_pos as (
  select effective_deal_key as deal_key,
         count(*) filter(where position_status='TRUSTED')::int as trusted_wagon_count,
         count(*) filter(where position_status<>'TRUSTED')::int as verification_wagon_count,
         max(source_received_at) as source_received_at
  from portal_private.rail_xlsx_dislocation_current_position_v1
  where effective_deal_key is not null
  group by effective_deal_key
),
active_deals_base as (
  select
    d.id as deal_key,
    d.deal_id,
    d.business_status::text as business_status,
    d.lifecycle_state::text as lifecycle_state,
    c.client_id,
    c.legal_name,
    ct.contract_id,
    ct.contract_status,
    ct.current_external_contract_number,
    ct.current_signed_document_id,
    ct.signed_contract_confirmed_at,
    (ct.current_signed_document_id is not null and ct.signed_contract_confirmed_at is not null) as contract_signed,
    w.product_confirmed_at,
    w.quantity_confirmed_at,
    a.delivery_basis,
    coalesce(doc.document_count,0) as document_count,
    coalesce(doc.unchecked_count,0) as unchecked_document_count,
    coalesce(doc.has_signed_addendum,false) as has_signed_addendum,
    coalesce(doc.has_invoice,false) as has_invoice,
    coalesce(fin.due_now,0)::numeric as due_now,
    coalesce(fin.expected_not_due,0)::numeric as expected_not_due,
    coalesce(fin.future_conditional,0)::numeric as future_conditional,
    (coalesce(fin.due_now,0)+coalesce(fin.expected_not_due,0)+coalesce(fin.future_conditional,0))::numeric as client_remaining_amount,
    coalesce(fin.obligation_currency,fin.contractual_payment_currency,fin.execution_currency) as finance_currency,
    fin.finance_status,
    fin.execution_status,
    fin.documentary_status,
    fin.effective_at as finance_effective_at,
    coalesce(rd.gu12_count,0) as gu12_count,
    coalesce(rp.trusted_wagon_count,0) as trusted_wagon_count,
    coalesce(rp.verification_wagon_count,0) as verification_wagon_count,
    ra.resolution_state as route_resolution_state,
    rp.source_received_at as rail_source_received_at
  from portal_private.deals d
  cross join actor
  join portal_private.contracts ct on ct.id=d.contract_key
  join portal_private.clients c on c.id=ct.client_key
  left join portal_private.owner_deal_workflow w on w.deal_key=d.id
  left join lateral (
    select ca.delivery_basis
    from portal_private.deal_registrations dr
    join portal_private.client_applications ca on ca.id=dr.application_key
    where dr.deal_key=d.id
    order by dr.registered_at desc
    limit 1
  ) a on true
  left join docs doc on doc.deal_key=d.id
  left join lateral (
    select f.*
    from portal_private.deal_finance_authority_payments_v8_read_v1 f
    where f.deal_key=d.id
      and f.is_terminal=true
      and upper(coalesce(f.authority_state,''))='AUTHORITATIVE'
      and upper(coalesce(f.lifecycle_state,''))='CURRENT'
      and f.source_locked=true
    order by f.effective_at desc nulls last,f.created_at desc
    limit 1
  ) fin on true
  left join rail_docs rd on rd.deal_key=d.id
  left join rail_pos rp on rp.deal_key=d.id
  left join portal_private.rail_deal_route_assignments_v1 ra on ra.deal_key=d.id
  where d.lifecycle_state::text='ACTIVE'
    and upper(d.business_status::text) not in ('CLOSED','ARCHIVED','CANCELLED','CANCELED','TERMINATED','VOID')
),
active_deals as (
  select b.*,
    case
      when b.trusted_wagon_count>0 then 'ЖД исполнение'
      when b.due_now>0 then 'Оплата'
      when upper(b.business_status) in ('EXECUTING','IN_PROGRESS','EXECUTION','CONTRACT_EXECUTION','CONTRACT_AND_EXECUTION') then 'В исполнении'
      when b.future_conditional>0 then 'Ожидание срока оплаты'
      else 'Зарегистрирована'
    end as stage,
    case
      when b.product_confirmed_at is null then 'Подтвердить продукт'
      when b.quantity_confirmed_at is null then 'Подтвердить объём'
      when nullif(trim(coalesce(b.delivery_basis,'')),'') is null then 'Подтвердить базис поставки'
      when not b.contract_signed then 'Получить подписанный контракт'
      when not b.has_signed_addendum then 'Получить подписанное доп. соглашение'
      when not b.has_invoice then 'Прикрепить инвойс'
      when b.due_now>0 then 'Контроль поступления оплаты'
      when b.verification_wagon_count>0 then 'Проверить ЖД-дислокацию'
      else 'Контроль исполнения сделки'
    end as next_action_text,
    case
      when b.product_confirmed_at is null
        or b.quantity_confirmed_at is null
        or nullif(trim(coalesce(b.delivery_basis,'')),'') is null
        or not b.contract_signed
        or not b.has_signed_addendum
        or not b.has_invoice
        or b.due_now>0
        or b.verification_wagon_count>0
      then true else false
    end as current_action_required,
    case
      when not b.contract_signed then 'documents'
      when b.due_now>0 then 'payments'
      when b.verification_wagon_count>0 then 'monitoring'
      else 'deals'
    end as next_action_target
  from active_deals_base b
),
pending_reverse as (
  select r.*
  from portal_private.portal_reverse_events r
  cross join actor
  where r.lifecycle_state::text='ACTIVE'
    and (
      upper(r.processing_state) in ('QUEUED','PENDING','FAILED','ERROR','RETRY','RETRYING')
      or upper(r.acknowledgement_state) in ('PENDING','WAITING','REQUIRED')
    )
),
staff_actions as (
  select
    'TASK:'||st.task_id as action_id,
    'STAFF_TASK'::text as kind,
    case when upper(st.priority::text) in ('CRITICAL','URGENT') then 'CRITICAL' else 'ATTENTION' end as severity,
    st.title as title,
    concat_ws(' · ',nullif(st.authority_domain,''),nullif(st.assigned_functional_role::text,''),nullif(st.status::text,'')) as meta,
    d.deal_id as deal_id,
    a.application_id as application_id,
    case
      when d.deal_id is not null then 'deals'
      when a.application_id is not null then 'applications'
      when upper(coalesce(st.authority_domain,''))='FINANCE' then 'payments'
      when upper(coalesce(st.authority_domain,''))='OPERATIONS' and upper(coalesce(st.assigned_functional_role::text,''))='RAIL_LOGISTICS' then 'monitoring'
      else 'home'
    end as target,
    st.created_at as created_at
  from portal_private.staff_tasks st
  cross join actor
  left join portal_private.deals d on d.id=st.deal_key
  left join portal_private.client_applications a on a.id=st.application_key
  left join pending_reverse pr on upper(coalesce(st.source_type,''))='PORTAL_REVERSE_EVENT' and pr.event_id=st.source_object_id
  where coalesce(st.qa_only,false)=false
    and upper(st.status::text) not in ('ACKNOWLEDGED','COMPLETED','CLOSED','REJECTED','CANCELLED','CANCELED','DONE')
    and upper(coalesce(st.authority_domain,''))<>'TECHNICAL'
    and st.task_id not like 'TASK-PAYMENTS-V7-%'
    and (
      upper(coalesce(st.source_type,''))<>'CLIENT_INTAKE'
      or (a.id is not null and a.lifecycle_state::text='ACTIVE'
          and upper(a.status::text) not in ('DEAL_REGISTERED','REJECTED','CANCELLED','CANCELED','CLOSED'))
    )
    and (
      upper(coalesce(st.source_type,''))<>'PORTAL_REVERSE_EVENT'
      or pr.id is not null
    )
),
mirrored_reverse as (
  select distinct st.source_object_id as event_id
  from portal_private.staff_tasks st
  where upper(coalesce(st.source_type,''))='PORTAL_REVERSE_EVENT'
    and st.source_object_id is not null
    and coalesce(st.qa_only,false)=false
    and upper(st.status::text) not in ('ACKNOWLEDGED','COMPLETED','CLOSED','REJECTED','CANCELLED','CANCELED','DONE')
),
reverse_actions as (
  select
    'EVENT:'||pr.event_id as action_id,
    'REVERSE_EVENT'::text as kind,
    case when upper(pr.processing_state) in ('FAILED','ERROR') or pr.last_error_code is not null then 'CRITICAL' else 'ATTENTION' end as severity,
    'Событие портала: '||pr.event_type as title,
    concat_ws(' · ',pr.processing_state,pr.acknowledgement_state,pr.authority_target_type,pr.authority_target_id) as meta,
    case when upper(coalesce(pr.authority_target_type,''))='DEAL' then pr.authority_target_id else null end as deal_id,
    case when upper(coalesce(pr.authority_target_type,''))='APPLICATION' then pr.authority_target_id else null end as application_id,
    case
      when upper(coalesce(pr.authority_target_type,''))='DEAL' then 'deals'
      when upper(coalesce(pr.authority_target_type,''))='APPLICATION' then 'applications'
      else 'home'
    end as target,
    pr.created_at as created_at
  from pending_reverse pr
  where not exists(select 1 from mirrored_reverse mr where mr.event_id=pr.event_id)
),
deal_actions as (
  select
    'DEAL:'||d.deal_id as action_id,
    'DEAL'::text as kind,
    'ATTENTION'::text as severity,
    case
      when not d.contract_signed then 'Контракт · '||d.deal_id
      when d.due_now>0 then 'Оплата · '||d.deal_id
      else 'Сделка · '||d.deal_id
    end as title,
    d.next_action_text as meta,
    d.deal_id,
    null::text as application_id,
    d.next_action_target as target,
    clock_timestamp() as created_at
  from active_deals d
  where d.current_action_required
),
application_actions as (
  select
    'APPLICATION:'||a.application_id as action_id,
    'APPLICATION'::text as kind,
    'ATTENTION'::text as severity,
    'Заявка '||a.application_id as title,
    coalesce(a.status::text,'Требует действия') as meta,
    null::text as deal_id,
    a.application_id,
    'applications'::text as target,
    a.updated_at as created_at
  from portal_private.client_applications a
  cross join actor
  where a.lifecycle_state::text='ACTIVE'
    and upper(a.status::text) in ('NEW','COUNTER_OFFERED','SUPPLIER_PENDING','UNDER_REVIEW','ACCEPTED_AWAITING_DEAL_REGISTRATION')
),
document_review_actions as (
  select
    'DOCUMENT_REVIEW:'||d.deal_id as action_id,
    'DOCUMENTS'::text as kind,
    'ATTENTION'::text as severity,
    'Документы · '||d.deal_id as title,
    d.unchecked_document_count::text||' документов требуют проверки' as meta,
    d.deal_id,
    null::text as application_id,
    'documents'::text as target,
    clock_timestamp() as created_at
  from active_deals d
  where d.unchecked_document_count>0
),
all_actions as (
  select * from staff_actions
  union all select * from reverse_actions
  union all select * from deal_actions
  union all select * from application_actions
  union all select * from document_review_actions
),
action_payload as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',action_id,
        'kind',kind,
        'severity',severity,
        'title',title,
        'meta',meta,
        'target',target,
        'dealId',deal_id,
        'applicationId',application_id
      )
      order by case severity when 'CRITICAL' then 0 else 1 end,created_at,action_id
    ),
    '[]'::jsonb
  ) as actions
  from all_actions
),
deal_payload as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'dealId',d.deal_id,
        'clientId',d.client_id,
        'clientName',d.legal_name,
        'businessStatus',d.business_status,
        'stage',d.stage,
        'contractId',d.contract_id,
        'contractStatus',d.contract_status,
        'contractExternalNumber',d.current_external_contract_number,
        'contractSigned',d.contract_signed,
        'contractSignedConfirmedAt',d.signed_contract_confirmed_at,
        'financeStatus',d.finance_status,
        'dueNow',d.due_now,
        'futureConditional',d.future_conditional,
        'remaining',d.client_remaining_amount,
        'currency',d.finance_currency,
        'gu12Count',d.gu12_count,
        'trustedWagons',d.trusted_wagon_count,
        'verificationWagons',d.verification_wagon_count,
        'documentCount',d.document_count,
        'uncheckedDocuments',d.unchecked_document_count,
        'nextAction',d.next_action_text,
        'nextActionTarget',d.next_action_target,
        'currentActionRequired',d.current_action_required
      )
      order by d.deal_id
    ),
    '[]'::jsonb
  ) as deals
  from active_deals d
),
presence_connections as (
  select *
  from portal_private.portal_presence_connections_v1
  where last_seen_at>=clock_timestamp()-interval '75 seconds'
),
presence as (
  select
    (
      select count(distinct cub.client_key)::int
      from presence_connections pc
      join portal_private.client_user_bindings cub
        on cub.user_id=pc.portal_user_id
       and cub.status::text='ACTIVE'
       and cub.lifecycle_state::text='ACTIVE'
       and cub.authority_state::text='CONFIRMED'
      where pc.portal_role='CLIENT'
    ) as clients_online,
    (
      select count(distinct aub.agent_person_key)::int
      from presence_connections pc
      join portal_private.agent_user_bindings aub
        on aub.user_id=pc.portal_user_id
       and aub.status::text='ACTIVE'
       and aub.lifecycle_state::text='ACTIVE'
       and aub.authority_state::text='CONFIRMED'
      where pc.portal_role='AGENT'
    ) as agents_online,
    (select max(last_seen_at) from presence_connections) as last_seen_at
),
doc_kpi as (
  select
    count(*) filter(where doc.lifecycle_state::text='ACTIVE')::int as documents_total,
    count(*) filter(where doc.lifecycle_state::text='ACTIVE' and odd.checked_by_admin=false)::int as documents_attention
  from portal_private.owner_deal_documents odd
  join portal_private.documents doc on doc.id=odd.document_key
  cross join actor
),
signal as (
  select coalesce(max(version),0)::bigint as version,max(updated_at) as updated_at
  from public.rona_admin_operations_invalidation_v1
),
metrics as (
  select
    count(*)::int as active_deals,
    count(*) filter(where upper(business_status) in ('EXECUTING','IN_PROGRESS','EXECUTION','CONTRACT_EXECUTION','CONTRACT_AND_EXECUTION'))::int as execution_deals,
    count(*) filter(where due_now>0)::int as payments_due,
    coalesce(sum(trusted_wagon_count),0)::int as trusted_wagons,
    coalesce(sum(verification_wagon_count),0)::int as rail_attention,
    max(rail_source_received_at) as rail_source_received_at,
    max(finance_effective_at) as finance_effective_at
  from active_deals
),
action_metrics as (
  select
    count(*)::int as actions_required,
    count(*) filter(where severity='CRITICAL')::int as critical_events
  from all_actions
)
select jsonb_build_object(
  'version','OPERATIONS_CURRENT_V2',
  'generatedAt',clock_timestamp(),
  'readiness',jsonb_build_object(
    'state','READY',
    'sources',jsonb_build_object(
      'deals','READY',
      'finance','READY',
      'rail','READY',
      'documents','READY',
      'actions','READY',
      'presence','READY',
      'contracts','READY'
    )
  ),
  'kpis',jsonb_build_object(
    'activeDeals',m.active_deals,
    'executionDeals',m.execution_deals,
    'actionsRequired',am.actions_required,
    'trustedWagons',m.trusted_wagons,
    'paymentsDue',m.payments_due,
    'criticalEvents',am.critical_events,
    'clientsOnline',p.clients_online,
    'agentsOnline',p.agents_online,
    'documentsTotal',dk.documents_total,
    'documentsAttention',dk.documents_attention
  ),
  'actions',ap.actions,
  'deals',dp.deals,
  'systems',jsonb_build_object(
    'rail',jsonb_build_object('trustedWagons',m.trusted_wagons,'attention',m.rail_attention,'state',case when m.rail_attention>0 then 'ATTENTION' else 'READY' end),
    'finance',jsonb_build_object('dueDeals',m.payments_due,'state',case when m.payments_due>0 then 'ATTENTION' else 'READY' end),
    'documents',jsonb_build_object('total',dk.documents_total,'attention',dk.documents_attention,'state',case when dk.documents_attention>0 then 'ATTENTION' else 'READY' end),
    'presence',jsonb_build_object('clientsOnline',p.clients_online,'agentsOnline',p.agents_online,'ttlSeconds',75,'state','READY')
  ),
  'signalVersion',s.version,
  'freshness',jsonb_build_object(
    'signalUpdatedAt',s.updated_at,
    'presenceLastSeenAt',p.last_seen_at,
    'railSourceReceivedAt',m.rail_source_received_at,
    'financeEffectiveAt',m.finance_effective_at
  )
)
from metrics m
cross join action_metrics am
cross join action_payload ap
cross join deal_payload dp
cross join presence p
cross join doc_kpi dk
cross join signal s;
$function$
;

revoke all on function public.rona_admin_operations_current_v2() from public, anon;
grant execute on function public.rona_admin_operations_current_v2() to authenticated, service_role;

comment on function public.rona_admin_operations_current_v2()
is 'Single authoritative read model for Admin Operations Flightdeck V10, including canonical contract signature authority.';
