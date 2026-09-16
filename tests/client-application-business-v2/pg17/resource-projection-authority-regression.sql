\set ON_ERROR_STOP on
-- Regression for applications whose resource confirmation lives in the canonical
-- linked-Deal resource_decisions chain rather than owner_application_workflow.
do $$
declare
  d uuid;
  a uuid;
  receipt jsonb;
  row jsonb;
begin
  -- Create the business identity through the same canonical Operations-numbered intake
  -- path that production enforces, then reproduce the historical authority split by
  -- linking the application to a Deal whose confirmation exists only in resource_decisions.
  receipt:=test_application_v2.submit(
    1,
    test_application_v2.bundle(
      1,
      'RESOURCE_AUTHORITY_'||replace(gen_random_uuid()::text,'-',''),
      315
    )
  );
  select id into a from portal_private.client_applications
    where application_id=receipt->>'application_id';

  insert into portal_private.deals(deal_id,client_key,contract_key,business_status,lifecycle_state)
  values('QA-RESOURCE-DEAL-'||replace(gen_random_uuid()::text,'-',''),
    test_application_v2.get('client1')::uuid,test_application_v2.get('contract1')::uuid,
    'REGISTERED','ACTIVE') returning id into d;

  update portal_private.client_applications set linked_deal_key=d where id=a;
  insert into portal_private.resource_decisions(id,deal_key,decision_state)
  values(gen_random_uuid(),d,'RESOURCE_CONFIRMED');

  row:=portal_private.application_business_row_v2(a);

  perform test_application_v2.check_true(
    not exists(select 1 from portal_private.owner_application_workflow w
      where w.application_key=a and w.supplier_approved_at is not null),
    'fixture has no owner workflow resource confirmation');
  perform test_application_v2.check_true(
    row->>'resource_status'='RESOURCE_CONFIRMED',
    'application projection consumes canonical linked-deal resource confirmation');
  perform test_application_v2.check_true(
    row->>'resource_source'='RESOURCE_DECISION',
    'application projection exposes canonical resource source');
end $$;
\echo APPLICATION_RESOURCE_PROJECTION_AUTHORITY_REGRESSION_COMPLETE
