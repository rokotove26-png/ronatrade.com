alter table portal_private.owner_deal_workflow
  add column if not exists producer_value text,
  add column if not exists producer_source_document_id text,
  add column if not exists producer_confirmed_at timestamptz;

with src as (
  select d.id as deal_key,
         doc.document_id,
         coalesce(dv.source_timestamp,dv.uploaded_at,doc.updated_at,doc.created_at,now()) as confirmed_at
  from portal_private.deals d
  join portal_private.documents doc on doc.deal_key=d.id
  left join portal_private.document_versions dv on dv.id=doc.current_version_id
  where (d.deal_id,doc.document_id) in (
    ('DEAL-2026-004','DEAL-2026-004-ADD-003'),
    ('DEAL-2026-005','DEAL-2026-005-ADD-001'),
    ('DEAL-2026-006','DEAL-2026-006-ADD-001')
  )
  and doc.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
  and coalesce(dv.is_current,true)=true
  and coalesce(dv.is_effective,true)=true
)
update portal_private.owner_deal_workflow w
set producer_value='ОАО «Мозырский НПЗ»',
    producer_source_document_id=src.document_id,
    producer_confirmed_at=src.confirmed_at,
    updated_at=now()
from src
where w.deal_key=src.deal_key;

create or replace function public.owner_r1_admin_bootstrap()
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','portal_private','auth'
as $function$
declare v_actor uuid; v_out jsonb;
begin
  v_actor := portal_private.owner_r1_actor('ADMIN');
  select jsonb_build_object(
    'generatedAt',now(),
    'deals',coalesce((select jsonb_agg(to_jsonb(x) order by x.updated_at desc) from (
      select d.deal_id,cl.client_id,cl.legal_name,ct.contract_id,ct.contract_status,d.business_status,d.lifecycle_state::text,
        coalesce(w.cancellation_state,'ACTIVE') cancellation_state,w.cancellation_reason,w.cancelled_at,
        w.product_value,w.product_confirmed_at,w.quantity_tonnes_value,w.quantity_confirmed_at,
        w.producer_value,w.producer_source_document_id,w.producer_confirmed_at,
        coalesce(w.payment_handoff_state,'NOT_SENT') payment_handoff_state,w.payment_handoff_at,
        coalesce(w.payment_expectation_state,'NOT_CREATED') payment_expectation_state,w.payment_expectation_amount,w.payment_expectation_currency,
        w.client_addendum_downloaded_at,w.client_invoice_downloaded_at,
        a.application_id,a.product source_product,a.quantity_tonnes source_quantity_tonnes,
        fs.obligation_amount,fs.received_amount,fs.client_remaining_amount,fs.currency finance_currency,d.updated_at
      from portal_private.deals d
      join portal_private.clients cl on cl.id=d.client_key
      join portal_private.contracts ct on ct.id=d.contract_key
      left join portal_private.owner_deal_workflow w on w.deal_key=d.id
      left join lateral(select rr.application_key from portal_private.deal_registrations rr where rr.deal_key=d.id order by rr.registered_at desc limit 1) r on true
      left join portal_private.client_applications a on a.id=r.application_key
      left join portal_private.owner_deal_finance_summary fs on fs.deal_id=d.deal_id
    ) x),'[]'::jsonb),
    'documents',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
      select d.deal_id,odd.document_kind,doc.document_id,doc.authoritative_filename,odd.checked_by_admin,odd.checked_at,doc.created_at
      from portal_private.owner_deal_documents odd
      join portal_private.deals d on d.id=odd.deal_key
      join portal_private.documents doc on doc.id=odd.document_key
      where doc.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum and odd.document_kind in ('ADDENDUM','INVOICE','SIGNED_ADDENDUM')
    ) x),'[]'::jsonb),
    'applications',coalesce((select jsonb_agg(to_jsonb(x)) from (
      select a.application_id,d.deal_id,coalesce(w.business_status,a.status::text) owner_status,w.cancelled_at,w.cancellation_reason
      from portal_private.client_applications a
      left join portal_private.owner_application_workflow w on w.application_key=a.id
      left join portal_private.deals d on d.id=a.linked_deal_key
    ) x),'[]'::jsonb)
  ) into v_out;
  return v_out;
end $function$;
