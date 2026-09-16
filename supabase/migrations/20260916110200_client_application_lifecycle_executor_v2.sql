-- Generic source-driven lifecycle executor. Technical source evidence is not a business application.
create function portal_private.application_retention_decision_v2(p_application_key uuid)
returns jsonb language plpgsql stable security definer set search_path='pg_catalog','portal_private' as $$
declare a portal_private.client_applications; w portal_private.owner_application_workflow; reason text; protected boolean;
begin
 select * into a from portal_private.client_applications where id=p_application_key;
 if not found then return jsonb_build_object('decision','ABSENT','reason','NO_LIVE_BUSINESS_ROW'); end if;
 select * into w from portal_private.owner_application_workflow where application_key=a.id;
 if a.status::text in ('REJECTED','CANCELLED') or coalesce(w.business_status,'') in ('REJECTED','CANCELLED','SUPPLIER_REJECTED','RESOURCE_DENIED') then
  reason:=case when a.status::text='REJECTED' or coalesce(w.business_status,'') in ('REJECTED','SUPPLIER_REJECTED','RESOURCE_DENIED')
   then 'REJECTED_BY_BUSINESS_PROCESS' else 'CANCELLED_BY_BUSINESS_PROCESS' end;
 else
  -- Staleness/duplication requires an authoritative decision, never an invented age cutoff.
  select ae.metadata->>'reason_code' into reason from portal_private.audit_events ae
   where ae.entity_type='APPLICATION' and ae.entity_id=a.application_id and ae.action='APPLICATION_RETIREMENT_CONFIRMED'
    and ae.actor_role::text='ADMIN' and ae.actor_user_id is not null and ae.metadata->>'disposition'='DELETE'
    and ae.metadata->>'reason_code' in ('STALE','DUPLICATE','TECHNICAL_ERROR','RESOURCE_DENIED')
   order by ae.event_at desc limit 1;
 end if;
 if reason is not null then
  protected:=a.linked_deal_key is not null or exists(select 1 from portal_private.deal_registrations where application_key=a.id);
  return jsonb_build_object('decision',case when protected then 'BLOCKED' else 'DELETE' end,
   'reason',case when protected then 'REGISTERED_DEAL_DEPENDENCY' else reason end,
   'business_reason',reason,'source_reason',a.decision_reason,'linked_deal_key',a.linked_deal_key);
 end if;
 if a.lifecycle_state::text='ARCHIVED' and a.status::text in ('DRAFT','SUBMITTED','UNDER_REVIEW') then
  return jsonb_build_object('decision','BLOCKED','reason','AMBIGUOUS_ARCHIVED_BUSINESS_STATE');
 end if;
 return jsonb_build_object('decision','KEEP','reason',case when a.linked_deal_key is not null then 'CANONICAL_REGISTERED_DEAL'
  when a.status::text='CLOSED' then 'COMPLETED_REAL_BUSINESS_APPLICATION' else 'ACTIVE_REAL_BUSINESS_APPLICATION' end);
end $$;

create function portal_private.application_inventory_v2()
returns jsonb language sql stable security definer set search_path='pg_catalog','portal_private' as $$
 select jsonb_build_object(
 'applications',coalesce((select jsonb_agg(jsonb_build_object('record_type','CLIENT_APPLICATION','record_id',a.application_id,
  'application_key',a.id,'client_id',c.client_id,'client_name',c.legal_name,'contract_id',ct.contract_id,
  'quantity_tonnes',a.quantity_tonnes,'status',a.status::text,'lifecycle',a.lifecycle_state::text,
  'source_system',a.source_system,'source_submission_state',a.source_submission_state,
  'source_intake_id',r.primary_intake_id,'deal_id',d.deal_id,'classification',portal_private.application_retention_decision_v2(a.id))
  order by a.created_at,a.id) from portal_private.client_applications a
  join portal_private.clients c on c.id=a.client_key
  join portal_private.contracts ct on ct.id=a.contract_key and ct.client_key=a.client_key
  left join portal_private.client_application_registry_v2 r on r.application_key=a.id
  left join portal_private.deals d on d.id=a.linked_deal_key),'[]'::jsonb),
 'intakes',coalesce((select jsonb_agg(jsonb_build_object('record_type','IMMUTABLE_INTAKE','record_id',i.intake_id,
  'source_kind',i.source_kind,'source_record_id',i.source_record_id,'client_id',c.client_id,'contract_id',ct.contract_id,
  'source_submitted_at',i.source_submitted_at,'source_fingerprint',i.source_fingerprint,'actionable_type',i.actionable_type,
  'routing_state',i.routing_state,'business_application_id',r.application_id,'disposition',sd.disposition,'reason',sd.reason_code)
  order by i.source_submitted_at,i.intake_id) from portal_private.client_intake_v1 i
  left join portal_private.clients c on c.id=i.client_key left join portal_private.contracts ct on ct.id=i.contract_key
  left join portal_private.client_application_registry_v2 r on r.application_key=i.application_key
  left join portal_private.client_application_source_disposition_v2 sd on sd.intake_id=i.intake_id),'[]'::jsonb),
 'counts',jsonb_build_object('live_business_rows',(select count(*) from portal_private.client_applications),
  'immutable_intakes',(select count(*) from portal_private.client_intake_v1),
  'retired_business_rows',(select count(*) from portal_private.client_application_tombstones_v2),
  'blocked_retirements',(select count(*) from portal_private.client_applications a
   where portal_private.application_retention_decision_v2(a.id)->>'decision'='BLOCKED')))
$$;

create function portal_private.retire_client_application_v2(p_application_key uuid)
returns jsonb language plpgsql security definer set search_path='pg_catalog','portal_private' as $$
declare a portal_private.client_applications; r portal_private.client_application_registry_v2;
 decision jsonb; lines jsonb; workflow jsonb; authority uuid; fingerprint text;
begin
 authority:=portal_private.application_operations_authority_v2();
 select * into a from portal_private.client_applications where id=p_application_key for update;
 if not found then return jsonb_build_object('deleted',false,'already_absent',true); end if;
 decision:=portal_private.application_retention_decision_v2(a.id);
 if decision->>'decision'<>'DELETE' then return decision||jsonb_build_object('deleted',false); end if;
 insert into portal_private.client_application_inventory_runs_v2(inventory,source_fingerprint,operations_identity_key)
  select inventory,encode(extensions.digest(inventory::text,'sha256'),'hex'),authority
  from (select portal_private.application_inventory_v2() inventory) snapshot;
 perform portal_private.ensure_application_registry_v2(a.id);
 select * into r from portal_private.client_application_registry_v2 where application_key=a.id;
 perform 1 from portal_private.application_lines where application_key=a.id for update;
 perform 1 from portal_private.owner_application_workflow where application_key=a.id for update;
 select coalesce(jsonb_agg(to_jsonb(l) order by l.line_no),'[]'::jsonb) into lines from portal_private.application_lines l where l.application_key=a.id;
 select to_jsonb(w) into workflow from portal_private.owner_application_workflow w where w.application_key=a.id;
 fingerprint:=encode(extensions.digest((to_jsonb(a)||jsonb_build_object('lines',lines,'workflow',workflow))::text,'sha256'),'hex');
 insert into portal_private.client_application_tombstones_v2(application_key,application_id,primary_intake_id,reason_code,
  source_fingerprint,application_snapshot,lines_snapshot,workflow_snapshot,operations_identity_key)
 values(a.id,a.application_id,r.primary_intake_id,decision->>'reason',fingerprint,to_jsonb(a),lines,workflow,authority);
 insert into portal_private.client_application_audit_v2(application_id,intake_id,event_type,operations_identity_key,evidence)
 values(a.application_id,r.primary_intake_id,'BUSINESS_APPLICATION_DELETE_AUTHORIZED',authority,decision||jsonb_build_object('snapshot_sha256',fingerprint));
 insert into portal_private.client_application_source_disposition_v2(intake_id,disposition,reason_code,application_key)
 select i.intake_id,'DELETED',decision->>'reason',a.id from portal_private.client_intake_v1 i
  where i.application_key=a.id or i.intake_id=r.primary_intake_id
 on conflict(intake_id) do update set disposition='DELETED',reason_code=excluded.reason_code,application_key=excluded.application_key;
 -- Stop the old routing executor as well as the new materializer. Preserve its audit/task identity.
 update portal_private.client_intake_routing_outbox_v1 q
  set state='DEAD_LETTER',last_error_code='BUSINESS_APPLICATION_RETIRED',next_attempt_at=null,updated_at=now()
  from portal_private.client_application_source_disposition_v2 sd
  where sd.intake_id=q.intake_id and sd.application_key=a.id and sd.disposition='DELETED';
 update portal_private.client_intake_v1 set application_key=null,task_required=false,
  routing_state='DEAD_LETTER',routing_reason='BUSINESS_APPLICATION_RETIRED' where application_key=a.id;
 update portal_private.staff_tasks set application_key=null,
  status=case when status::text in ('NEW','ACKNOWLEDGED','IN_PROGRESS','WAITING') then 'CLOSED'::portal_private.staff_task_status_enum else status end
  where application_key=a.id;
 delete from portal_private.application_lines where application_key=a.id;
 delete from portal_private.owner_application_workflow where application_key=a.id;
 delete from portal_private.client_applications where id=a.id;
 update portal_private.client_application_registry_v2 set retired_at=clock_timestamp() where application_key=a.id;
 return decision||jsonb_build_object('deleted',true,'application_id',a.application_id,'snapshot_sha256',fingerprint);
end $$;

create function portal_private.materialize_client_application_v2(p_intake_id uuid)
returns text language plpgsql security definer set search_path='pg_catalog','portal_private' as $$
declare i portal_private.client_intake_v1; a portal_private.client_applications; p jsonb; authority uuid;
 app_key uuid; app_id text; old_task_status text; pub_item uuid; pub_key uuid; source_quantity numeric;
 source_destination text; source_product text;
begin
 authority:=portal_private.application_operations_authority_v2();
 perform pg_advisory_xact_lock(hashtextextended('RONA_APPLICATION_INTAKE:'||p_intake_id::text,0));
 select * into i from portal_private.client_intake_v1 where intake_id=p_intake_id for update;
 if not found then raise exception 'APPLICATION_SOURCE_INTAKE_MISSING'; end if;
 if exists(select 1 from portal_private.client_application_source_disposition_v2 where intake_id=i.intake_id
  and disposition in ('DELETED','TECHNICAL_ONLY','TERMINAL_REQUEST')) then return null; end if;
 if exists(select 1 from portal_private.client_application_tombstones_v2 where primary_intake_id=i.intake_id) then return null; end if;
 if i.source_kind='CLIENT_APPLICATION' then
  select * into a from portal_private.client_applications where id=i.source_internal_key and application_id=i.source_record_id;
  if not found then
   if exists(select 1 from portal_private.client_application_tombstones_v2 where application_id=i.source_record_id) then return null; end if;
   raise exception 'APPLICATION_SOURCE_BUSINESS_ROW_MISSING';
  end if;
  if (i.client_key,i.contract_key) is distinct from (a.client_key,a.contract_key) then raise exception 'APPLICATION_SOURCE_CONTEXT_CONFLICT'; end if;
  update portal_private.client_intake_v1 set application_key=a.id where intake_id=i.intake_id;
  app_id:=portal_private.ensure_application_registry_v2(a.id);
  insert into portal_private.client_application_source_disposition_v2(intake_id,disposition,reason_code,application_key)
   values(i.intake_id,'BUSINESS','CANONICAL_CLIENT_APPLICATION',a.id) on conflict(intake_id) do nothing;
  return app_id;
 end if;
 if i.source_kind<>'PORTAL_REVERSE_EVENT' then raise exception 'APPLICATION_SOURCE_KIND_UNSUPPORTED'; end if;
 if i.actionable_type<>'DELIVERED_PRICE_CALCULATION_REQUEST_V1' then
  if i.actionable_type not in ('APPLICATION_DETAILS_V5','APPLICATION_DETAILS_V4','APPLICATION_DETAILS_V3',
   'CLIENT_CLAIM_SUBMIT','CLIENT_PAYMENT_PROOF_SUBMIT','CLIENT_DOCUMENT_ACK','CLIENT_MESSAGE_SUBMIT','COMMERCIAL_TERMS_REQUEST_V1')
   then raise exception 'APPLICATION_CLASSIFICATION_POLICY_MISSING'; end if;
  insert into portal_private.client_application_source_disposition_v2(intake_id,disposition,reason_code)
  values(i.intake_id,'TECHNICAL_ONLY',case when i.actionable_type like 'APPLICATION_DETAILS_%'
   then 'DETAIL_EVENT_IS_NOT_AN_APPLICATION' else 'NON_APPLICATION_ACTIONABLE_EVENT' end) on conflict(intake_id) do nothing;
  return null;
 end if;
 select * into a from portal_private.client_applications where source_intake_key=i.intake_id;
 if found then return portal_private.ensure_application_registry_v2(a.id); end if;
 select st.status::text into old_task_status from portal_private.staff_tasks st
  where st.source_reverse_event_key=i.source_internal_key
   or st.id in (select staff_task_id from portal_private.client_intake_task_links_v1 where intake_id=i.intake_id)
  order by st.decision_at desc nulls last,st.created_at desc limit 1;
 if old_task_status in ('COMPLETED','CLOSED','REJECTED') then
  insert into portal_private.client_application_source_disposition_v2(intake_id,disposition,reason_code)
   values(i.intake_id,'TERMINAL_REQUEST','HISTORICAL_REQUEST_PROCESS_ALREADY_FINISHED') on conflict(intake_id) do nothing;
  return null;
 end if;
 if not exists(select 1 from portal_private.clients cl join portal_private.contracts ct on ct.client_key=cl.id
  where cl.id=i.client_key and ct.id=i.contract_key and nullif(btrim(cl.legal_name),'') is not null)
  then raise exception 'APPLICATION_CLIENT_CHAIN_MISSING'; end if;
 p:=portal_private.client_intake_effective_payload_v1(i.intake_id);
 if p->>'client_id' is distinct from (select client_id from portal_private.clients where id=i.client_key)
  or p->>'contract_id' is distinct from (select contract_id from portal_private.contracts where id=i.contract_key)
  then raise exception 'APPLICATION_SOURCE_CONTEXT_CONFLICT'; end if;
 if jsonb_typeof(p->'quantity_tonnes') is distinct from 'number' then raise exception 'APPLICATION_SOURCE_QUANTITY_INVALID'; end if;
 source_quantity:=(p->>'quantity_tonnes')::numeric;source_product:=nullif(btrim(p->>'product'),'');
 source_destination:=case when jsonb_typeof(p->'destination')='object' then nullif(btrim(p#>>'{destination,station}'),'')
  else nullif(btrim(p->>'destination'),'') end;
 if source_quantity<=0 or source_product is null or source_destination is null then raise exception 'APPLICATION_SOURCE_FACTS_INCOMPLETE'; end if;
 if nullif(p#>>'{reference,publication_item_id}','') is not null then
  pub_item:=(p#>>'{reference,publication_item_id}')::uuid;
  select publication_key into pub_key from portal_private.publication_items where id=pub_item;
  if not found then raise exception 'APPLICATION_SOURCE_PUBLICATION_MISSING'; end if;
 end if;
 app_key:=gen_random_uuid();app_id:=portal_private.next_application_business_id(i.client_key);
 insert into portal_private.client_applications(id,application_id,client_key,contract_key,source_intake_key,
  source_publication_id,source_publication_item_id,product,quantity_tonnes,delivery_period_from,delivery_period_to,
  delivery_basis,destination,delivery_method,payment_terms,price_mode,proposed_price,proposed_currency,status,submitted_at,
  source_system,source_version,source_timestamp,authority_state,lifecycle_state,source_price_mode,source_submission_state)
 values(app_key,app_id,i.client_key,i.contract_key,i.intake_id,pub_key,pub_item,source_product,source_quantity,
  nullif(p#>>'{shipment,period_from}','')::timestamptz::date,nullif(p#>>'{shipment,period_to}','')::timestamptz::date,
  p#>>'{shipment,source_basis}',source_destination,'TO_BE_CONFIRMED',coalesce(nullif(p#>>'{commercial,payment_terms}',''),'TO_BE_AGREED'),
  'REQUEST_DELIVERED_PRICE',null,null,'SUBMITTED',i.source_submitted_at,'CLIENT_INTAKE','APPLICATION_BUSINESS_V2',
  i.source_submitted_at,'SOURCE_RECEIVED','ACTIVE','REQUEST_DELIVERED_PRICE','SOURCE_INTAKE:'||i.intake_id::text);
 update portal_private.client_intake_v1 set application_key=app_key where intake_id=i.intake_id;
 perform portal_private.ensure_application_registry_v2(app_key);
 update portal_private.staff_tasks st set application_key=app_key,title='Application '||app_id,
  description=coalesce(st.description,'')||E'\nCanonical application: '||app_id
  where (st.source_reverse_event_key=i.source_internal_key
   or st.id in (select staff_task_id from portal_private.client_intake_task_links_v1 where intake_id=i.intake_id)) and st.application_key is null;
 insert into portal_private.client_application_source_disposition_v2(intake_id,disposition,reason_code,application_key)
  values(i.intake_id,'BUSINESS','MATERIALIZED_FROM_AUTHORITATIVE_INTAKE',app_key) on conflict(intake_id) do nothing;
 return app_id;
end $$;

create function portal_private.process_application_jobs_v2(p_limit integer default 100)
returns jsonb language plpgsql security definer set search_path='pg_catalog','portal_private' as $$
declare j record;app_id text;processed integer:=0;errors integer:=0;
begin
 if not coalesce((select enabled from portal_private.client_application_policy_v2 where singleton),false) then return jsonb_build_object('state','DISABLED'); end if;
 for j in select * from portal_private.client_application_jobs_v2 where state in ('PENDING','RETRY') and next_attempt_at<=now()
  order by next_attempt_at,intake_id for update skip locked limit greatest(1,least(coalesce(p_limit,100),1000)) loop
  begin
   app_id:=portal_private.materialize_client_application_v2(j.intake_id);
   update portal_private.client_application_jobs_v2 set state='DONE',attempts=attempts+1,last_error=null,updated_at=now() where intake_id=j.intake_id;
   processed:=processed+1;
  exception when others then
   errors:=errors+1;
   update portal_private.client_application_jobs_v2 set state='RETRY',attempts=attempts+1,last_error=left(sqlerrm,300),
    next_attempt_at=now()+interval '1 minute',updated_at=now() where intake_id=j.intake_id;
  end;
 end loop;
 return jsonb_build_object('processed',processed,'errors',errors);
end $$;

create function portal_private.application_intake_business_trigger_v2()
returns trigger language plpgsql security definer set search_path='pg_catalog','portal_private' as $$
begin
 insert into portal_private.client_application_jobs_v2(intake_id) values(new.intake_id) on conflict do nothing;
 if coalesce((select enabled from portal_private.client_application_policy_v2 where singleton),false) then
  begin
   perform portal_private.materialize_client_application_v2(new.intake_id);
   update portal_private.client_application_jobs_v2 set state='DONE',attempts=attempts+1,updated_at=now() where intake_id=new.intake_id;
  exception when others then
   update portal_private.client_application_jobs_v2 set state='RETRY',attempts=attempts+1,last_error=left(sqlerrm,300),
    next_attempt_at=now()+interval '1 minute',updated_at=now() where intake_id=new.intake_id;
  end;
 end if;
 return new;
end $$;
create trigger client_intake_business_v2 after insert on portal_private.client_intake_v1
for each row execute function portal_private.application_intake_business_trigger_v2();

create or replace function portal_private.client_intake_application_trigger_v1()
returns trigger language plpgsql security definer set search_path='pg_catalog','portal_private' as $$
begin
 if new.source_intake_key is not null then
  if not exists(select 1 from portal_private.client_intake_v1 where intake_id=new.source_intake_key
   and client_key=new.client_key and contract_key=new.contract_key) then raise exception 'APPLICATION_SOURCE_CONTEXT_CONFLICT'; end if;
  update portal_private.client_intake_v1 set application_key=new.id where intake_id=new.source_intake_key;
  perform portal_private.ensure_application_registry_v2(new.id);return new;
 end if;
 perform portal_private.ensure_client_intake_from_application_v1(new.application_id);
 perform portal_private.process_client_intake_outbox_v1(100);return new;
end $$;

create function portal_private.reconcile_client_applications_v2(p_limit integer default 500)
returns jsonb language plpgsql security definer set search_path='pg_catalog','portal_private' as $$
declare a record;before_inventory jsonb;results jsonb:='[]'::jsonb;run_key uuid;authority uuid;jobs_result jsonb;
begin
 if not coalesce((select enabled from portal_private.client_application_policy_v2 where singleton),false) then return jsonb_build_object('state','DISABLED'); end if;
 authority:=portal_private.application_operations_authority_v2();before_inventory:=portal_private.application_inventory_v2();
 insert into portal_private.client_application_inventory_runs_v2(inventory,source_fingerprint,operations_identity_key)
  values(before_inventory,encode(extensions.digest(before_inventory::text,'sha256'),'hex'),authority) returning run_id into run_key;
 for a in select id from portal_private.client_applications where not exists(select 1 from portal_private.client_application_registry_v2 r
  where r.application_key=client_applications.id) order by created_at,id limit greatest(1,least(coalesce(p_limit,500),5000)) loop
  perform portal_private.ensure_application_registry_v2(a.id);
 end loop;
 insert into portal_private.client_application_jobs_v2(intake_id)
  select i.intake_id from portal_private.client_intake_v1 i where not exists(select 1 from portal_private.client_application_jobs_v2 j where j.intake_id=i.intake_id)
  order by i.source_submitted_at,i.intake_id limit greatest(1,least(coalesce(p_limit,500),5000)) on conflict do nothing;
 jobs_result:=portal_private.process_application_jobs_v2(p_limit);
 perform portal_private.process_client_intake_outbox_v1(p_limit);
 for a in select id from portal_private.client_applications where portal_private.application_retention_decision_v2(id)->>'decision'='DELETE'
  order by created_at,id limit greatest(1,least(coalesce(p_limit,500),5000)) loop
  results:=results||jsonb_build_array(portal_private.retire_client_application_v2(a.id));
 end loop;
 return jsonb_build_object('inventory_run_id',run_key,'jobs',jobs_result,'retirements',results,'after',portal_private.application_inventory_v2()->'counts');
end $$;
revoke all on function portal_private.application_retention_decision_v2(uuid),portal_private.application_inventory_v2(),
 portal_private.retire_client_application_v2(uuid),portal_private.materialize_client_application_v2(uuid),
 portal_private.process_application_jobs_v2(integer),portal_private.application_intake_business_trigger_v2(),
 portal_private.client_intake_application_trigger_v1(),portal_private.reconcile_client_applications_v2(integer) from public,anon,authenticated;
