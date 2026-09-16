\set ON_ERROR_STOP on
begin;
-- Disposable fixture writer only; live HTTP paths are tested without this context.
set local rona.application_atomic_bundle='on';
create function pg_temp.check_true(value boolean,label text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'ASSERTION_FAILED: %',label; end if; raise notice 'CHECK_OK: %',label; end $$;

-- Generated test identities live only in this rollback transaction on disposable PG17.
create temp table fixture(k text primary key,v text not null);
do $$
declare c uuid;ct uuid;u uuid;au uuid;s uuid;p uuid;pi uuid;z integer;
  cid text;ctid text;eid text;i uuid;old_event uuid;authority uuid;
begin
  insert into portal_private.ai_service_identities(identity_id,business_role,status)
    values('QA-OPERATIONS-'||gen_random_uuid(),'OPERATIONS_DIRECTOR','ACTIVE') returning id into authority;
  insert into fixture values('authority',authority::text);
  insert into portal_private.publications(status,audience) values('PUBLISHED','ALL_CLIENTS') returning id into p;
  insert into portal_private.publication_items(publication_key,product,price,currency,payment_terms,basis)
    values(p,'LPG',612.35,'USD','AGREEMENT_REQUIRED','CPT') returning id into pi;
  insert into fixture values('publication_item',pi::text);
  for z in 1..2 loop
    cid:='QA-C-'||replace(gen_random_uuid()::text,'-','');ctid:=cid||'-CTR';
    insert into portal_private.clients(client_id,legal_name) values(cid,'Test client '||z) returning id into c;
    insert into portal_private.contracts(contract_id,client_key) values(ctid,c) returning id into ct;
    au:=gen_random_uuid();s:=gen_random_uuid();
    insert into portal_private.portal_users(auth_user_id,display_name) values(au,'Test user '||z) returning id into u;
    insert into auth.sessions(id,user_id,not_after) values(s,au,now()+interval '1 day');
    insert into portal_private.qa_session_roles values(u,array['CLIENT']);
    insert into portal_private.client_user_bindings(user_id,client_key,contract_key) values(u,c,ct);
    insert into fixture values('client'||z,c::text),('client_id'||z,cid),('contract'||z,ct::text),('contract_id'||z,ctid),
      ('auth'||z,au::text),('session'||z,s::text),('user'||z,u::text);
  end loop;
  c:=(select v::uuid from fixture where k='client1');ct:=(select v::uuid from fixture where k='contract1');
  cid:=(select v from fixture where k='client_id1');ctid:=(select v from fixture where k='contract_id1');
  for z in 1..3 loop
    eid:='TEST-SOURCE-'||gen_random_uuid();
    insert into portal_private.portal_reverse_events(event_id,idempotency_key,actor_role,client_key,contract_key,
      event_type,authority_domain,authority_target_type,authority_target_id,payload,created_at)
    values(eid,'TEST-KEY-'||gen_random_uuid(),'CLIENT',c,ct,'CLIENT_MESSAGE_SUBMIT','PRICE_CALCULATION','PUBLICATION_ITEM',pi::text,
      jsonb_build_object('message_type','DELIVERED_PRICE_CALCULATION_REQUEST_V1','client_id',cid,'contract_id',ctid,
      'quantity_tonnes',case z when 1 then 10000 when 2 then 175 else 500 end,'product','LPG',
      'destination',jsonb_build_object('station','Test destination','country','UZ'),
      'reference',jsonb_build_object('publication_item_id',pi),
      'commercial',jsonb_build_object('price_mode','REQUEST_DELIVERED_PRICE'),
      'comment','Price requested; not an agreement'),now()-make_interval(days=>z)) returning id into old_event;
    select intake_id into i from portal_private.client_intake_v1 where source_record_id=eid;
    insert into fixture values('source'||z,eid),('intake'||z,i::text);
    if z=1 then
      perform portal_private.append_client_intake_correction_v1(i,'payload.quantity_tonnes','10000'::jsonb,'1000'::jsonb,'OWNER','Isolated correction rehearsal');
    elsif z=3 then
      update portal_private.staff_tasks set status='COMPLETED',decision_at=now()-interval '1 day' where source_reverse_event_key=old_event;
    end if;
  end loop;
end $$;
-- Install the actual review delta over historical sources, exactly as a future rollout will.
-- Both schema changes and fixture data are rolled back at the end of this isolated test.
\ir ../../../supabase/migrations/20260916110600_client_application_review_lifecycle_v2.sql
\ir ../../../supabase/migrations/20260916110700_client_application_review_contract_v2.sql
create temp table raw_before as select event_id,payload,created_at,source_timestamp from portal_private.portal_reverse_events;
update portal_private.client_application_policy_v2 set enabled=true,activated_at=now();
select portal_private.reconcile_client_applications_v2(500);
select portal_private.reconcile_client_applications_v2(500);

do $$
declare a portal_private.client_applications;b portal_private.client_applications;old_i uuid;cl text;ct text;projection jsonb;task_count integer;
begin
  select * into a from portal_private.client_applications where source_intake_key=(select v::uuid from fixture where k='intake1');
  select * into b from portal_private.client_applications where source_intake_key=(select v::uuid from fixture where k='intake2');
  old_i:=(select v::uuid from fixture where k='intake3');
  perform pg_temp.check_true(a.id is not null and b.id is not null,'both historical actionable requests materialized');
  perform pg_temp.check_true(a.application_id<>b.application_id and a.application_id ~ '^.+-IN-[0-9]{4}-[0-9]+$','canonical distinct business numbers');
  perform pg_temp.check_true(a.quantity_tonnes=1000 and b.quantity_tonnes=175,'effective source quantities without raw rewrite');
  perform pg_temp.check_true(not exists(select 1 from portal_private.client_applications where source_intake_key=old_i),'completed historical request is not a business application');
  perform pg_temp.check_true((select disposition='TERMINAL_REQUEST' from portal_private.client_application_source_disposition_v2 where intake_id=old_i),'terminal source disposition persisted');
  perform pg_temp.check_true(not exists(select 1 from raw_before rb join portal_private.portal_reverse_events e using(event_id)
    where (rb.payload,rb.created_at,rb.source_timestamp) is distinct from (e.payload,e.created_at,e.source_timestamp)),'immutable raw content and timestamps preserved');
  perform pg_temp.check_true((select count(*)=2 from portal_private.client_application_number_reservations_v2),'reconciliation does not reserve duplicate numbers');
  perform pg_temp.check_true(not exists(select 1 from portal_private.client_application_registry_v2 where
    numbering_identity_key is distinct from (select v::uuid from fixture where k='authority')),'numbering belongs to actual Operations executor identity');
  select count(*) into task_count from portal_private.staff_tasks where application_key in (a.id,b.id);
  perform pg_temp.check_true(task_count=2,'existing Operations work reused exactly once');
  cl:=(select v from fixture where k='client_id1');ct:=(select v from fixture where k='contract_id1');
  projection:=portal_private.application_business_projection_v2('CLIENT',cl,ct);
  perform pg_temp.check_true(jsonb_array_length(projection->'applications')=2,'client sees both real business rows');
  perform pg_temp.check_true((projection#>>'{application_kpi,tonnage}')::numeric=1175,'KPI excludes technical historical request');
  perform pg_temp.check_true(not exists(select 1 from jsonb_array_elements(projection->'applications') x
    where x->>'client_id'<>cl or x->>'client_name'<>'Test client 1' or x->>'contract_id'<>ct),'client attribution from authoritative joins');
  perform pg_temp.check_true((projection#>>'{application_kpi,amounts}') is null,'unagreed requested price does not become financial total');
  perform pg_temp.check_true(projection->'applications'=portal_private.application_business_projection_v2('ADMIN',cl,ct)->'applications','Client/Admin share the identical business projection');
  insert into fixture values('application1',a.application_id),('application_key1',a.id::text),('application2',b.application_id),('application_key2',b.id::text);
end $$;

-- One atomic application+details API payload, independently bound to each client's session.
create function pg_temp.bundle(client_no integer,intent text,quantity numeric,price_mode text default 'ACCEPT_PUBLISHED_PRICE')
returns jsonb language sql as $$
  select jsonb_build_object('clientId',(select v from fixture where k='client_id'||client_no),
    'contractId',(select v from fixture where k='contract_id'||client_no),
    'publicationItemId',(select v from fixture where k='publication_item'),'quantityTonnes',quantity,
    'priceMode',price_mode,'proposedPrice',case when price_mode='CLIENT_PROPOSED_PRICE' then 610.11 end,
    'proposedCurrency',case when price_mode='CLIENT_PROPOSED_PRICE' then 'EUR' end,
    'destinationCountry','UZ','destinationStation','Test destination','deliveryPeriodFrom',null,'deliveryPeriodTo',null,
    'idempotencyKey',intent,'applicationDetails',jsonb_build_object('message_type','APPLICATION_DETAILS_V5',
      'client_id',(select v from fixture where k='client_id'||client_no),'contract_id',(select v from fixture where k='contract_id'||client_no),
      'product','LPG','quantity_tonnes',quantity,'application_id',null,
      'reference',jsonb_build_object('publication_item_id',(select v from fixture where k='publication_item'))))
$$;
create function pg_temp.submit(client_no integer,payload jsonb) returns jsonb language sql as $$
  select portal_private.submit_client_application_bundle_v2((select v::uuid from fixture where k='auth'||client_no),
    (select v::uuid from fixture where k='session'||client_no),payload,gen_random_uuid(),gen_random_uuid())
$$;

do $$
declare first_result jsonb;again jsonb;other_result jsonb;proposed jsonb;key text:='SHARED-INTENT-'||gen_random_uuid();
  before_count integer;app uuid;row jsonb;
begin
  first_result:=pg_temp.submit(1,pg_temp.bundle(1,key,51));
  again:=pg_temp.submit(1,pg_temp.bundle(1,key,51));
  perform pg_temp.check_true(first_result->>'application_id'=again->>'application_id','network retry returns the same canonical number');
  other_result:=pg_temp.submit(2,pg_temp.bundle(2,key,52));
  perform pg_temp.check_true(first_result->>'application_id'<>other_result->>'application_id','two clients using the same intent key remain isolated');
  perform pg_temp.check_true((first_result->>'bundle_complete')::boolean,'application and details commit atomically');
  proposed:=pg_temp.submit(2,pg_temp.bundle(2,'PROPOSED-'||gen_random_uuid(),53,'CLIENT_PROPOSED_PRICE'));
  select id into app from portal_private.client_applications where application_id=proposed->>'application_id';
  perform pg_temp.check_true((select proposed_currency='EUR' from portal_private.client_applications where id=app),'currency is not truncated by RPC casting');
  select count(*) into before_count from portal_private.client_applications;
  begin
    perform pg_temp.submit(1,pg_temp.bundle(1,key,54));
    raise exception 'EXPECTED_IDEMPOTENCY_CONFLICT_NOT_RAISED';
  exception when others then
    if sqlerrm not like '%APPLICATION_IDEMPOTENCY_PAYLOAD_CONFLICT%' then raise; end if;
  end;
  perform pg_temp.check_true((select count(*)=before_count from portal_private.client_applications),'conflicting retry creates no business row');
  begin
    perform pg_temp.submit(1,pg_temp.bundle(2,'DENIED-'||gen_random_uuid(),70));
    raise exception 'EXPECTED_SCOPE_DENIAL_NOT_RAISED';
  exception when others then if sqlerrm not like '%CLIENT_PRICE_CONTEXT_DENIED%' then raise; end if; end;
  perform pg_temp.check_true((select count(*)=before_count from portal_private.client_applications),'cross-client submission denied');
  insert into portal_private.owner_application_workflow(application_key,business_status,counter_price,counter_currency,counter_offer_used,client_counter_response)
    values(app,'CLIENT_COUNTER_ACCEPTED',609.27,'EUR',true,'ACCEPTED');
  row:=portal_private.application_business_row_v2(app);
  perform pg_temp.check_true((row->>'application_price')::numeric=609.27 and row->>'application_currency'='EUR'
    and (row->>'price_is_owner_agreed')::boolean,'historical accepted counter offer is the price authority');
  update portal_private.publication_items set price=9999 where id=(select v::uuid from fixture where k='publication_item');
  select id into app from portal_private.client_applications where application_id=first_result->>'application_id';
  row:=portal_private.application_business_row_v2(app);
  perform pg_temp.check_true((row->>'application_price')::numeric=612.35,'later price-list changes do not replace submission snapshot');
  insert into fixture values('published_application_key',app::text),('proposed_application_key',
    (select id::text from portal_private.client_applications where application_id=proposed->>'application_id'));
end $$;

-- Business retirement is physical, with immutable identity/tombstone preventing resurrection.
do $$
declare app uuid:=(select v::uuid from fixture where k='application_key2');cid text;tasks_before integer;retired jsonb;
  inventory_before integer;deleted_payload jsonb;
begin
  select application_id into cid from portal_private.client_applications where id=app;
  update portal_private.client_applications set status='REJECTED',decision_reason='Resource not available' where id=app;
  select count(*) into inventory_before from portal_private.client_application_inventory_runs_v2;
  retired:=portal_private.retire_client_application_v2(app);
  perform pg_temp.check_true((retired->>'deleted')::boolean and not exists(select 1 from portal_private.client_applications where id=app),'resource refusal deletes actual business row');
  perform pg_temp.check_true(exists(select 1 from portal_private.client_application_tombstones_v2 where application_key=app),'retired canonical identity and source proof persist');
  perform pg_temp.check_true((select count(*)>inventory_before from portal_private.client_application_inventory_runs_v2),'pre-delete machine inventory exists even on direct lifecycle retirement');
  select count(*) into tasks_before from portal_private.staff_tasks;
  perform portal_private.reconcile_client_intake_v1(500,interval '5 minutes');
  perform portal_private.reconcile_client_applications_v2(500);
  perform portal_private.materialize_client_application_v2((select v::uuid from fixture where k='intake2'));
  perform pg_temp.check_true(not exists(select 1 from portal_private.client_applications where application_id=cid),'deleted source never resurrects as business row');
  perform pg_temp.check_true((select count(*)=tasks_before from portal_private.staff_tasks),'legacy and new reconciliation do not recreate retired staff tasks');
  begin
    update portal_private.client_application_tombstones_v2 set reason_code='ALTERED' where application_key=app;
    raise exception 'EXPECTED_IMMUTABILITY_NOT_RAISED';
  exception when others then if sqlerrm not like '%APPLICATION_AUDIT_IS_APPEND_ONLY%' then raise; end if; end;
end $$;

do $$
declare app uuid:=(select v::uuid from fixture where k='published_application_key');decision jsonb;d uuid;
begin
  insert into portal_private.audit_events(actor_user_id,actor_role,action,entity_type,entity_id,metadata)
    select gen_random_uuid(),'ADMIN','APPLICATION_RETIREMENT_CONFIRMED','APPLICATION',application_id,
      jsonb_build_object('disposition','DELETE','reason_code','STALE') from portal_private.client_applications where id=app;
  perform portal_private.reconcile_client_applications_v2(500);
  perform pg_temp.check_true(not exists(select 1 from portal_private.client_applications where id=app),'authoritatively stale application physically removed');
  app:=(select v::uuid from fixture where k='proposed_application_key');
  insert into portal_private.deals(deal_id,client_key,contract_key)
    select 'TEST-DEAL-'||gen_random_uuid(),client_key,contract_key from portal_private.client_applications where id=app returning id into d;
  update portal_private.client_applications set linked_deal_key=d,status='DEAL_REGISTERED',lifecycle_state='ARCHIVED' where id=app;
  update portal_private.owner_application_workflow set business_status='DEAL',supplier_approved_at=now() where application_key=app;
  perform pg_temp.check_true(portal_private.application_business_row_v2(app)->>'business_bucket'='COMPLETED','resource-confirmed canonical Deal completion retained');
  update portal_private.client_applications set status='CANCELLED' where id=app;
  decision:=portal_private.retire_client_application_v2(app);
  perform pg_temp.check_true(decision->>'decision'='BLOCKED' and exists(select 1 from portal_private.client_applications where id=app),'registered-deal dependency is not destructively bypassed');
  perform pg_temp.check_true(exists(select 1 from portal_private.deals where id=d),'Deal and financial lineage unchanged');
end $$;
select pg_temp.check_true(not exists(select 1 from raw_before rb join portal_private.portal_reverse_events e using(event_id)
  where (rb.payload,rb.created_at,rb.source_timestamp) is distinct from (e.payload,e.created_at,e.source_timestamp)), 'final immutable source invariant');
select portal_private.application_inventory_v2()->'counts' as isolated_final_counts;
rollback;
\echo REAL_POSTGRES_APPLICATION_LIFECYCLE_REGRESSIONS_COMPLETE
