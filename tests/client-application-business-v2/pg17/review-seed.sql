\set ON_ERROR_STOP on
-- Synthetic fixture ONLY. This seed refuses a database without the explicitly disposable auth fixture.
do $$ begin if to_regclass('portal_private.qa_session_roles') is null then raise exception 'DISPOSABLE_DATABASE_REQUIRED'; end if; end $$;
create schema test_application_v2;
create table test_application_v2.fixture(k text primary key,v text not null);
create function test_application_v2.get(k text) returns text language sql stable as $$ select v from test_application_v2.fixture f where f.k=$1 $$;
create function test_application_v2.check_true(v boolean,label text) returns void language plpgsql as $$
begin if v is distinct from true then raise exception 'REVIEW_ASSERTION_FAILED: %',label; end if; raise notice 'REVIEW_CHECK_OK: %',label; end $$;
do $$
declare c uuid; ct uuid; u uuid; au uuid; s uuid; p uuid; pi uuid; n integer; cid text; ctid text;
begin
 insert into portal_private.ai_service_identities(identity_id,business_role,status)
 values('QA-OPERATIONS-'||gen_random_uuid(),'OPERATIONS_DIRECTOR','ACTIVE');
 insert into portal_private.publications(status,audience) values('PUBLISHED','ALL_CLIENTS') returning id into p;
 insert into portal_private.publication_items(publication_key,product,price,currency,payment_terms,basis)
 values(p,'ISOLATED-LPG',628.17,'USD','TEST_TERMS','CPT TEST') returning id into pi;
 insert into test_application_v2.fixture values('publication_item',pi::text);
 for n in 1..4 loop
  au:=gen_random_uuid();s:=gen_random_uuid();
  insert into portal_private.portal_users(auth_user_id,display_name) values(au,'Isolated user '||n) returning id into u;
  insert into auth.sessions(id,user_id,not_after) values(s,au,now()+interval '1 day');
  insert into portal_private.qa_session_roles values(u,case when n=3 then array['ADMIN'] when n=4 then array['OPERATIONS_DIRECTOR'] else array['CLIENT'] end);
  insert into test_application_v2.fixture values('auth'||n,au::text),('session'||n,s::text),('user'||n,u::text);
  if n<3 then
   cid:='QA-C-'||replace(gen_random_uuid()::text,'-','');ctid:=cid||'-CTR';
   insert into portal_private.clients(client_id,legal_name) values(cid,'Isolated client '||n) returning id into c;
   insert into portal_private.contracts(contract_id,client_key) values(ctid,c) returning id into ct;
   insert into portal_private.client_user_bindings(user_id,client_key,contract_key) values(u,c,ct);
   insert into test_application_v2.fixture values('client'||n,c::text),('client_id'||n,cid),('contract'||n,ct::text),('contract_id'||n,ctid);
  end if;
 end loop;

-- Explicit simulated independent approval, permitted ONLY in this disposable fixture.
insert into portal_private.client_application_numbering_delegations_v2
 (operations_identity_key,executor_role,executor_entrypoint,approval_source_type,
  approval_source_ref,approved_release_sha,approved_at)
 select id,'rona_application_executor_v2','portal_private.operations_issue_application_number_v2(uuid)',
  'SYSTEM_ADMIN_INDEPENDENT_REVIEW','ISOLATED_TEST_APPROVAL_NOT_PRODUCTION',repeat('a',40),now()
 from portal_private.ai_service_identities where business_role::text='OPERATIONS_DIRECTOR' and revoked_at is null;
update portal_private.client_application_policy_v2
 set numbering_delegation_id=(select delegation_id from portal_private.client_application_numbering_delegations_v2);

 update portal_private.client_application_policy_v2 set enabled=true,activated_at=now() where singleton;
end $$;
create function test_application_v2.bundle(n integer,intent text,quantity numeric) returns jsonb language sql stable as $$
 select jsonb_build_object('clientId',test_application_v2.get('client_id'||n),'contractId',test_application_v2.get('contract_id'||n),
 'publicationItemId',test_application_v2.get('publication_item'),'quantityTonnes',quantity,'priceMode','ACCEPT_PUBLISHED_PRICE',
 'proposedPrice',null,'proposedCurrency',null,'destinationCountry','UZ','destinationStation','TEST STATION',
 'deliveryPeriodFrom',null,'deliveryPeriodTo',null,'idempotencyKey',intent,'applicationDetails',jsonb_build_object(
  'message_type','APPLICATION_DETAILS_V5','application_id',null,'client_id',test_application_v2.get('client_id'||n),
  'contract_id',test_application_v2.get('contract_id'||n),'product','ISOLATED-LPG','quantity_tonnes',quantity,
  'reference',jsonb_build_object('publication_item_id',test_application_v2.get('publication_item')),
  'destination',jsonb_build_object('country','UZ','station','TEST STATION')))
$$;
create function test_application_v2.delivered(n integer,intent text,quantity numeric) returns jsonb language sql stable as $$
 select jsonb_build_object('role','CLIENT','event_type','CLIENT_MESSAGE_SUBMIT','authority_domain','PRICE_CALCULATION',
 'authority_target_type','PUBLICATION_ITEM','authority_target_id',test_application_v2.get('publication_item'),
 'client_id',test_application_v2.get('client_id'||n),'contract_id',test_application_v2.get('contract_id'||n),'idempotency_key',intent,
 'payload',jsonb_build_object('source','CLIENT_PRICE_CALCULATION_REQUEST','message_type','DELIVERED_PRICE_CALCULATION_REQUEST_V1',
  'client_id',test_application_v2.get('client_id'||n),'contract_id',test_application_v2.get('contract_id'||n),
  'product','ISOLATED-LPG','quantity_tonnes',quantity,'reference',jsonb_build_object('publication_item_id',test_application_v2.get('publication_item')),
  'destination',jsonb_build_object('country','UZ','station','TEST STATION'),'commercial',jsonb_build_object('payment_terms','TEST_TERMS')))
$$;
create function test_application_v2.submit(n integer,body jsonb) returns jsonb language sql as $$
 select portal_private.submit_client_application_bundle_v2(test_application_v2.get('auth'||n)::uuid,
 test_application_v2.get('session'||n)::uuid,body,gen_random_uuid(),gen_random_uuid())
$$;
create function test_application_v2.request(n integer,body jsonb) returns jsonb language sql as $$
 select portal_private.submit_delivered_application_bundle_v2(test_application_v2.get('auth'||n)::uuid,
 test_application_v2.get('session'||n)::uuid,body,gen_random_uuid(),gen_random_uuid())
$$;
