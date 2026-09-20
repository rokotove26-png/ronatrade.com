-- Admin Deals Current V3 execution read model.
-- Purpose: keep readiness/GO semantics unchanged while sourcing post-handoff
-- Finance from the current Finance V8 authority and Rail from the current route/Gu-12 model.
-- Read-only projection. No business, finance, payment, rail, or document mutation.

create or replace function public.owner_deals_current_v3()
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','portal_private','auth'
as $function$
declare
  v_actor uuid;
  v_out jsonb;
begin
  -- Preserve the same ADMIN authorization gate as the existing owner bootstrap.
  v_actor := portal_private.owner_r1_actor('ADMIN');

  select jsonb_build_object(
    'readModelVersion', 'ADMIN_DEALS_CURRENT_V3',
    'generatedAt', now(),
    'deals', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.updated_at desc, x.deal_id desc)
      from (
        select
          d.deal_id,
          ccl.client_id,
          ccl.legal_name,
          ct.contract_id,
          ct.contract_status,
          (d.client_key is distinct from ct.client_key) as contract_client_conflict,
          'CONTRACT_CANONICAL'::text as company_resolution,
          d.business_status,
          d.lifecycle_state::text,
          coalesce(w.cancellation_state, 'ACTIVE') as cancellation_state,
          w.cancellation_reason,
          w.cancelled_at,
          w.product_value,
          w.product_confirmed_at,
          w.quantity_tonnes_value,
          w.quantity_confirmed_at,
          coalesce(w.payment_handoff_state, 'NOT_SENT') as payment_handoff_state,
          w.payment_handoff_at,
          coalesce(w.payment_expectation_state, 'NOT_CREATED') as payment_expectation_state,
          w.payment_expectation_amount,
          w.payment_expectation_currency,
          w.client_addendum_downloaded_at,
          w.client_invoice_downloaded_at,
          a.application_id,
          a.product as source_product,
          a.quantity_tonnes as source_quantity_tonnes,
          a.delivery_basis,
          a.destination,
          a.proposed_price as source_proposed_price,
          a.proposed_currency as source_proposed_currency,
          coalesce(nullif(w.producer_value,''), ps.producer) as producer_value,
          ps.supplier as supplier_value,

          -- Compatibility fields consumed by the current Deals UI.
          coalesce(fv8.total_to_receive, fs.obligation_amount) as obligation_amount,
          case
            when fv8.id is not null then greatest(
              coalesce(fv8.total_to_receive,0)
              - coalesce(fv8.due_now,0)
              - coalesce(fv8.expected_not_due,0)
              - coalesce(fv8.future_conditional,0),
              0
            )
            else fs.received_amount
          end as received_amount,
          case
            when fv8.id is not null then
              coalesce(fv8.due_now,0)
              + coalesce(fv8.expected_not_due,0)
              + coalesce(fv8.future_conditional,0)
            else fs.client_remaining_amount
          end as client_remaining_amount,
          coalesce(btrim(fv8.obligation_currency::text), btrim(fs.currency::text)) as finance_currency,
          coalesce(fv8.finance_status, fs.finance_status) as finance_status,
          fs.accounting_status,

          -- Current Finance execution fields.
          case when fv8.id is not null then 'FINANCE_V8' else 'PRE_HANDOFF_R1' end as finance_projection_version,
          fv8.due_now,
          fv8.expected_not_due,
          fv8.future_conditional,
          fv8.actual_spend,
          fv8.actual_spend_status,
          fv8.remaining_execution,
          fv8.remaining_execution_status,
          btrim(fv8.execution_currency::text) as execution_currency,
          fv8.execution_status,
          fv8.documentary_status,
          fv8.authority_state as finance_authority_state,
          fv8.lifecycle_state as finance_lifecycle_state,
          fv8.source_locked as finance_source_locked,
          fv8.source_version as finance_source_version,
          fv8.source_timestamp as finance_source_timestamp,
          fv8.effective_at as finance_effective_at,
          fv8.signed_schedule_document_id,
          fv8.signed_schedule_state,
          fv8.is_terminal as finance_is_terminal,

          greatest(
            d.updated_at,
            coalesce(w.updated_at, d.updated_at),
            coalesce(fv8.effective_at, d.updated_at),
            coalesce(fv8.source_timestamp, d.updated_at)
          ) as updated_at
        from portal_private.deals d
        join portal_private.contracts ct on ct.id = d.contract_key
        join portal_private.clients ccl on ccl.id = ct.client_key
        left join portal_private.owner_deal_workflow w on w.deal_key = d.id
        left join lateral (
          select rr.application_key
          from portal_private.deal_registrations rr
          where rr.deal_key = d.id
          order by rr.registered_at desc
          limit 1
        ) r on true
        left join portal_private.client_applications a on a.id = r.application_key
        left join lateral (
          select p.producer, p.supplier
          from portal_private.owner_price_snapshots p
          where p.business_status <> 'SUPERSEDED'
            and p.producer is not null
            and (
              (a.product ilike '%АИ-92%' and p.product = 'АИ-92 К5') or
              (a.product ilike '%АИ-95%' and p.product = 'АИ-95 К5') or
              ((a.product ilike '%СПБТ%' or a.product ilike '%СУГ%') and p.product = 'СУГ / СПБТ') or
              ((a.product ilike '%ДТ%' or a.product ilike '%ДИЗЕЛ%') and p.product = 'ДТ сорт C К5')
            )
          order by p.agreed_at desc nulls last, p.updated_at desc
          limit 1
        ) ps on true
        left join portal_private.owner_deal_finance_summary fs on fs.deal_id = d.deal_id
        left join lateral (
          select f.*
          from portal_private.deal_finance_authority_payments_v8_read_v1 f
          where f.deal_key = d.id
            and f.is_terminal = true
            and upper(coalesce(f.authority_state,'')) = 'AUTHORITATIVE'
            and upper(coalesce(f.lifecycle_state,'')) = 'CURRENT'
            and f.source_locked = true
          order by f.effective_at desc nulls last, f.created_at desc
          limit 1
        ) fv8 on true
      ) x
    ), '[]'::jsonb),

    'documents', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_at desc)
      from (
        select
          d.deal_id,
          odd.document_kind,
          doc.document_id,
          doc.authoritative_filename,
          odd.checked_by_admin,
          odd.checked_at,
          doc.created_at
        from portal_private.owner_deal_documents odd
        join portal_private.deals d on d.id = odd.deal_key
        join portal_private.documents doc on doc.id = odd.document_key
        where doc.lifecycle_state = 'ACTIVE'::portal_private.lifecycle_state_enum
          and odd.document_kind in ('ADDENDUM', 'INVOICE', 'SIGNED_ADDENDUM')
      ) x
    ), '[]'::jsonb),

    'rail', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.updated_at desc, x.deal_id desc)
      from (
        select
          d.deal_id,
          case
            when coalesce(g.wagon_count,0) > 0 then 'WAGONS_ACTIVE'
            when coalesce(g.gu12_count,0) > 0 then 'GU12_REGISTERED'
            when upper(coalesce(ra.resolution_state,'')) = 'RESOLVED' then 'ROUTE_RESOLVED'
            when ra.deal_key is not null then 'ROUTE_PENDING'
            else 'NOT_STARTED'
          end as rail_state,
          ra.resolution_state as route_resolution_state,
          ra.origin_esr_code,
          ra.destination_esr_code,
          ra.route_hop_count,
          ra.resolved_at as route_resolved_at,
          ra.refreshed_at as route_refreshed_at,
          coalesce(g.gu12_count,0) as gu12_count,
          coalesce(g.wagon_count,0) as wagon_count,
          coalesce(g.gu12_documents,'[]'::jsonb) as gu12_documents,
          g.gu12_updated_at,
          lm.wagon_number as latest_wagon_number,
          lm.station_name as latest_station_name,
          lm.esr_code as latest_station_code,
          lm.operation as latest_operation,
          lm.event_at as latest_movement_at,
          lm.source as latest_movement_source,
          greatest(
            d.updated_at,
            coalesce(ra.refreshed_at,d.updated_at),
            coalesce(g.gu12_updated_at,d.updated_at),
            coalesce(lm.event_at,d.updated_at)
          ) as updated_at
        from portal_private.deals d
        left join portal_private.rail_deal_route_assignments_v1 ra on ra.deal_key = d.id
        left join lateral (
          select
            count(*)::int as gu12_count,
            coalesce(sum((
              select count(*)
              from portal_private.rail_wagons rwc
              where rwc.rail_document_key = rd.id
                and rwc.lifecycle_state = 'ACTIVE'::portal_private.lifecycle_state_enum
            )),0)::int as wagon_count,
            coalesce(jsonb_agg(
              jsonb_build_object(
                'railDocumentId', rd.rail_document_id,
                'gu12Number', rd.gu12_number,
                'documentNumber', rd.document_number,
                'documentDate', rd.document_date,
                'routeText', rd.route_text,
                'updatedAt', rd.updated_at,
                'wagons', coalesce((
                  select jsonb_agg(
                    jsonb_build_object(
                      'wagonNumber', rw.wagon_number,
                      'station', rw.current_station_name,
                      'stationCode', rw.current_station_code,
                      'operation', rw.operation_code,
                      'operationAt', rw.operation_at,
                      'status', rw.status,
                      'lastPositionAt', rw.last_position_at,
                      'positionResolutionStatus', rw.position_resolution_status
                    )
                    order by rw.wagon_number
                  )
                  from portal_private.rail_wagons rw
                  where rw.rail_document_key = rd.id
                    and rw.lifecycle_state = 'ACTIVE'::portal_private.lifecycle_state_enum
                ),'[]'::jsonb)
              )
              order by rd.updated_at desc
            ),'[]'::jsonb) as gu12_documents,
            max(rd.updated_at) as gu12_updated_at
          from portal_private.rail_documents rd
          where rd.deal_key = d.id
            and upper(rd.document_type) = 'GU-12'
            and rd.lifecycle_state = 'ACTIVE'::portal_private.lifecycle_state_enum
        ) g on true
        left join lateral (
          select
            me.wagon_number,
            me.station_name,
            me.esr_code,
            me.operation,
            me.event_at,
            me.source
          from portal_private.rail_movement_events me
          where me.deal_key = d.id
            and me.lifecycle_state = 'ACTIVE'::portal_private.lifecycle_state_enum
          order by me.event_at desc nulls last, me.received_at desc nulls last
          limit 1
        ) lm on true
      ) x
    ), '[]'::jsonb),

    'dataConflicts', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.contract_id)
      from (
        select
          'CONTRACT_COMPANY_CONFLICT'::text as code,
          ct.contract_id,
          count(distinct ct.client_key)::int as company_count,
          array_agg(distinct cl.client_id order by cl.client_id) as client_ids
        from portal_private.contracts ct
        join portal_private.clients cl on cl.id = ct.client_key
        group by ct.contract_id
        having count(distinct ct.client_key) > 1
      ) x
    ), '[]'::jsonb),

    'applications', coalesce((
      select jsonb_agg(to_jsonb(x))
      from (
        select
          a.application_id,
          d.deal_id,
          coalesce(w.business_status, a.status::text) as owner_status,
          w.cancelled_at,
          w.cancellation_reason
        from portal_private.client_applications a
        left join portal_private.owner_application_workflow w on w.application_key = a.id
        left join portal_private.deals d on d.id = a.linked_deal_key
      ) x
    ), '[]'::jsonb)
  ) into v_out;

  return v_out;
end
$function$;

revoke all on function public.owner_deals_current_v3() from public;
revoke all on function public.owner_deals_current_v3() from anon;
grant execute on function public.owner_deals_current_v3() to authenticated;
grant execute on function public.owner_deals_current_v3() to service_role;

comment on function public.owner_deals_current_v3() is
  'Read-only Admin Deals V3 projection. Readiness/GO remains Owner R1; post-handoff Finance reads terminal source-locked Finance V8; Rail reads current route/Gu-12 state.';

