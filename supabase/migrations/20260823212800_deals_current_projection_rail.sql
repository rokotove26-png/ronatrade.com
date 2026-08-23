create or replace function public.owner_r1_admin_bootstrap()
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'portal_private', 'auth'
as $function$
declare
  v_actor uuid;
  v_out jsonb;
begin
  v_actor := portal_private.owner_r1_actor('ADMIN');

  select jsonb_build_object(
    'generatedAt', now(),
    'deals', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.updated_at desc)
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
          ps.producer as producer_value,
          ps.supplier as supplier_value,
          fs.obligation_amount,
          fs.received_amount,
          fs.client_remaining_amount,
          fs.currency as finance_currency,
          fs.finance_status,
          fs.accounting_status,
          d.updated_at
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
      select jsonb_agg(to_jsonb(x) order by x.updated_at desc)
      from (
        select
          d.deal_id,
          rd.rail_document_id,
          rd.gu12_number,
          rd.document_number,
          rd.document_date,
          rd.route_text,
          rd.updated_at,
          coalesce(
            jsonb_agg(
              jsonb_build_object(
                'wagonNumber', rw.wagon_number,
                'station', rw.current_station_name,
                'stationCode', rw.current_station_code,
                'operation', rw.operation_code,
                'operationAt', rw.operation_at,
                'status', rw.status,
                'lastPositionAt', rw.last_position_at
              ) order by rw.wagon_number
            ) filter (where rw.id is not null),
            '[]'::jsonb
          ) as wagons
        from portal_private.rail_documents rd
        left join portal_private.deals d on d.id = rd.deal_key
        left join portal_private.rail_wagons rw
          on rw.rail_document_key = rd.id
         and rw.lifecycle_state = 'ACTIVE'::portal_private.lifecycle_state_enum
        where upper(rd.document_type) = 'GU-12'
          and rd.lifecycle_state = 'ACTIVE'::portal_private.lifecycle_state_enum
        group by d.deal_id, rd.id, rd.rail_document_id, rd.gu12_number, rd.document_number,
                 rd.document_date, rd.route_text, rd.updated_at
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

comment on function public.owner_r1_admin_bootstrap() is
'Admin Deals authoritative current-state projection. One MVCC statement supplies Deals KPI, rows, statuses, documents and rail state. Company is resolved only through contract.client_key; delivery basis and finance/accounting state are included.';
