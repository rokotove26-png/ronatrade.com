\set ON_ERROR_STOP on
-- Regression for historical applications where resource confirmation lives in the
-- canonical deal resource_decisions chain rather than owner_application_workflow.
do $$
declare
  d uuid;
  a uuid;
  app_id text:=test_application_v2.get('client_id1')||'-IN-'||extract(year from current_date)::text||'-901';
  row jsonb;
begin
  insert into portal_private.deals(deal_id,client_key,contract_key,business_status,lifecycle_state)
  values('QA-RESOURCE-DEAL-'||replace(gen_random_uuid()::text,'-',''),
    test_application_v2.get('client1')::uuid,test_application_v2.get('contract1')::uuid,
    'REGISTERED','ACTIVE') returning id into d;

  insert into portal_private.resource_decisions(id,deal_key,decision_state)
  values(gen_random_uuid(),d,'RESOURCE_CONFIRMED');

  insert into portal_private.client_applications(
    application_id,client_key,contract_key,product,quantity_tonnes,payment_terms,
    price_mode,proposed_price,proposed_currency,status,linked_deal_key,submitted_at,source_system
  ) values(
    app_id,test_application_v2.get('client1')::uuid,test_application_v2.get('contract1')::uuid,
    'ISOLATED_LEGACY_RESOURCE_PRODUCT',315,'TEST_TERMS','CLIENT_PROPOSED_PRICE',640,'USD',
    'DEAL_REGISTERED',d,now()-interval '1 day','ISOLATED_AUTHORITATIVE_LEGACY'
  ) returning id into a;

  perform portal_private.ensure_application_registry_v2(a);
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
