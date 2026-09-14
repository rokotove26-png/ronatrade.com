-- RECOVERY ADMIN PRICES ONLY.
-- Restores canonical Owner/Admin gate without changing agreed price values.

create or replace function public.owner_price_updates_bootstrap()
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'portal_private', 'auth'
as $function$
declare
 v_actor uuid;
 v_current text;
 v_rows jsonb;
 v_history jsonb;
 v_client boolean:=false;
 v_agent boolean:=false;
begin
 v_actor:=portal_private.owner_r1_actor('ADMIN');

 select p.publication_id,c.client_enabled,c.agent_enabled
 into v_current,v_client,v_agent
 from portal_private.publications p
 join portal_private.owner_price_list_controls c on c.publication_key=p.id
 where p.publication_type::text='PRICE'
   and p.status::text='PUBLISHED'
   and p.authority_state::text='CONFIRMED'
   and p.lifecycle_state::text='ACTIVE'
   and c.internal_state='CURRENT'
   and c.authority_state::text='CONFIRMED'
   and c.lifecycle_state::text='ACTIVE'
 order by p.published_at desc nulls last,p.created_at desc
 limit 1;

 select coalesce(jsonb_agg(jsonb_build_object(
       'proposalId',p.id,'coordinationRecordId',p.coordination_record_id,'basePublicationId',p.base_publication_id,
       'status',p.proposal_status,'reason',p.reason,'changes',p.changes,'sourceRefs',p.source_refs,
       'receivedFromRole',p.received_from_role,'receivedFromIdentity',p.received_from_identity,'receivedAt',p.received_at,
       'blocker',nullif(p.internal_context->>'error',''),'newPublicationId',np.publication_id,
       'appliedAt',p.applied_at,'rejectedAt',p.rejected_at,'rejectionReason',p.rejection_reason
     ) order by p.received_at desc),'[]'::jsonb)
 into v_rows
 from portal_private.owner_price_change_proposals p
 left join portal_private.publications np on np.id=p.new_publication_key
 where p.proposal_status in ('UPDATE_AVAILABLE','BLOCKED');

 select coalesce(jsonb_agg(jsonb_build_object(
       'proposalId',p.id,'basePublicationId',p.base_publication_id,'status',p.proposal_status,'reason',p.reason,
       'receivedAt',p.received_at,'appliedAt',p.applied_at,'rejectedAt',p.rejected_at,
       'rejectionReason',p.rejection_reason,'newPublicationId',np.publication_id
     ) order by coalesce(p.applied_at,p.rejected_at,p.updated_at) desc),'[]'::jsonb)
 into v_history
 from (
   select *
   from portal_private.owner_price_change_proposals
   where proposal_status in ('APPLIED','REJECTED','SUPERSEDED')
   order by updated_at desc
   limit 3
 ) p
 left join portal_private.publications np on np.id=p.new_publication_key;

 return jsonb_build_object(
   'generatedAt',now(),'currentPublicationId',v_current,'clientEnabled',v_client,'agentEnabled',v_agent,
   'updateAvailableCount',(select count(*) from portal_private.owner_price_change_proposals where proposal_status='UPDATE_AVAILABLE'),
   'proposals',v_rows,'history',v_history
 );
end
$function$;

create or replace function portal_private.materialize_owner_price_list_control_v1()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'portal_private'
as $function$
declare v_publication_key uuid;
begin
  if new.source_publication_item_key is null or new.business_status='SUPERSEDED' then return new; end if;
  select publication_key into v_publication_key from portal_private.publication_items where id=new.source_publication_item_key limit 1;
  if v_publication_key is null then return new; end if;
  insert into portal_private.owner_price_list_controls(publication_key,internal_state,received_from_role,received_from_identity,received_at,source_refs,authority_state,lifecycle_state)
  values(v_publication_key,'RECEIVED_IN_ADMIN','OPERATIONS_DIRECTOR','AI-OPERATIONS-DIRECTOR',coalesce(new.agreed_at,now()),jsonb_build_array(coalesce(new.source_reference,'')),'CONFIRMED','ACTIVE')
  on conflict(publication_key) do update set
    internal_state=case
      when portal_private.owner_price_list_controls.internal_state='RETIRED' then 'RETIRED'
      when portal_private.owner_price_list_controls.internal_state='CURRENT' then 'CURRENT'
      else 'RECEIVED_IN_ADMIN'
    end,
    received_at=least(portal_private.owner_price_list_controls.received_at,excluded.received_at),
    updated_at=now();
  return new;
end
$function$;

create or replace function public.owner_decide_received_price_list(
  p_publication_id text,
  p_decision text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'portal_private', 'auth'
as $function$
declare
 v_actor uuid;
 v_req uuid:=gen_random_uuid();
 v_target portal_private.publications%rowtype;
 v_target_control portal_private.owner_price_list_controls%rowtype;
 v_current portal_private.publications%rowtype;
 v_current_control portal_private.owner_price_list_controls%rowtype;
 v_decision text:=upper(btrim(coalesce(p_decision,'')));
 v_client boolean:=false;
 v_agent boolean:=false;
 v_target_rows integer:=0;
 v_current_count integer:=0;
begin
 v_actor:=portal_private.owner_r1_actor('ADMIN');
 if v_decision not in ('ACCEPT','REJECT') then
   raise exception using errcode='P0001',message='PRICE_LIST_DECISION_INVALID';
 end if;

 select p.* into v_target
 from portal_private.publications p
 where p.publication_id=p_publication_id
 for update;
 if not found then raise exception using errcode='P0001',message='PRICE_LIST_NOT_FOUND'; end if;

 select c.* into v_target_control
 from portal_private.owner_price_list_controls c
 where c.publication_key=v_target.id
 for update;
 if not found then raise exception using errcode='P0001',message='PRICE_LIST_CONTROL_NOT_FOUND'; end if;

 if v_target.publication_type::text<>'PRICE'
    or v_target.status::text<>'APPROVED'
    or v_target.authority_state::text<>'CONFIRMED'
    or v_target.lifecycle_state::text<>'ACTIVE'
    or v_target.published_at is not null
    or v_target_control.internal_state not in ('RECEIVED_IN_ADMIN','READY_FOR_REVIEW')
    or v_target_control.authority_state::text<>'CONFIRMED'
    or v_target_control.lifecycle_state::text<>'ACTIVE'
    or v_target_control.client_enabled
    or v_target_control.agent_enabled then
   raise exception using errcode='P0001',message='PRICE_LIST_NOT_PENDING_ADMIN_DECISION';
 end if;

 select count(*) into v_target_rows
 from portal_private.owner_price_snapshots s
 where s.source_reference=v_target.publication_id and s.business_status<>'SUPERSEDED';
 if v_target_rows=0 then raise exception using errcode='P0001',message='PRICE_LIST_PENDING_ROWS_EMPTY'; end if;

 if v_decision='REJECT' then
   update portal_private.owner_price_snapshots
   set business_status='SUPERSEDED',publish_client=false,publish_agent=false,updated_at=now()
   where source_reference=v_target.publication_id and business_status<>'SUPERSEDED';

   update portal_private.publication_items
   set distribution_allowed=false,lifecycle_state='ARCHIVED',updated_at=now()
   where publication_key=v_target.id and item_type::text='PRICE' and lifecycle_state::text<>'ARCHIVED';

   update portal_private.owner_price_list_controls
   set internal_state='RETIRED',client_enabled=false,agent_enabled=false,
       authority_state='REJECTED',lifecycle_state='ARCHIVED',updated_at=now()
   where id=v_target_control.id;

   update portal_private.publications
   set status='ARCHIVED',authority_state='REJECTED',lifecycle_state='ARCHIVED',updated_at=now()
   where id=v_target.id;

   insert into portal_private.audit_events(actor_user_id,actor_role,action,entity_type,entity_id,request_id,metadata)
   values(v_actor,'ADMIN','OWNER_RECEIVED_PRICE_LIST_REJECTED','PRICE_LIST',v_target.publication_id,v_req,
          jsonb_build_object('reason',nullif(btrim(p_reason),''),'row_count',v_target_rows,'previous_state','RECEIVED_IN_ADMIN'));

   return jsonb_build_object('publicationId',v_target.publication_id,'decision','REJECT','status','ARCHIVED','currentUnchanged',true);
 end if;

 select count(*) into v_current_count
 from portal_private.publications p
 join portal_private.owner_price_list_controls c on c.publication_key=p.id
 where p.publication_type::text='PRICE'
   and p.status::text='PUBLISHED'
   and p.authority_state::text='CONFIRMED'
   and p.lifecycle_state::text='ACTIVE'
   and c.internal_state='CURRENT'
   and c.authority_state::text='CONFIRMED'
   and c.lifecycle_state::text='ACTIVE';
 if v_current_count<>1 then raise exception using errcode='P0001',message='PRICE_LIST_CURRENT_CARDINALITY_INVALID'; end if;

 select p.* into v_current
 from portal_private.publications p
 join portal_private.owner_price_list_controls c on c.publication_key=p.id
 where p.publication_type::text='PRICE'
   and p.status::text='PUBLISHED'
   and p.authority_state::text='CONFIRMED'
   and p.lifecycle_state::text='ACTIVE'
   and c.internal_state='CURRENT'
   and c.authority_state::text='CONFIRMED'
   and c.lifecycle_state::text='ACTIVE'
 order by p.published_at desc nulls last,p.created_at desc
 limit 1
 for update of p;

 select c.* into v_current_control
 from portal_private.owner_price_list_controls c
 where c.publication_key=v_current.id
 for update;

 if v_current.id=v_target.id then raise exception using errcode='P0001',message='PRICE_LIST_TARGET_ALREADY_CURRENT'; end if;
 v_client:=v_current_control.client_enabled;
 v_agent:=v_current_control.agent_enabled;

 update portal_private.publication_items
 set distribution_allowed=false,lifecycle_state='SUPERSEDED',updated_at=now()
 where publication_key=v_current.id and item_type::text='PRICE' and lifecycle_state::text='ACTIVE';

 update portal_private.owner_price_snapshots
 set business_status='SUPERSEDED',publish_client=false,publish_agent=false,updated_at=now()
 where source_reference=v_current.publication_id and business_status<>'SUPERSEDED';

 update portal_private.publications
 set status='SUPERSEDED',superseded_at=now(),superseded_by_publication=v_target.id,lifecycle_state='SUPERSEDED',updated_at=now()
 where id=v_current.id;

 update portal_private.owner_price_list_controls
 set internal_state='RETIRED',client_enabled=false,agent_enabled=false,lifecycle_state='SUPERSEDED',updated_at=now()
 where id=v_current_control.id;

 update portal_private.publications
 set status='PUBLISHED',published_at=now(),published_by=v_actor,lifecycle_state='ACTIVE',authority_state='CONFIRMED',updated_at=now()
 where id=v_target.id;

 update portal_private.publication_items
 set distribution_allowed=(v_client or v_agent),lifecycle_state='ACTIVE',updated_at=now()
 where publication_key=v_target.id and item_type::text='PRICE';

 update portal_private.owner_price_snapshots
 set publish_client=v_client,
     publish_agent=v_agent,
     client_published_at=case when v_client then coalesce(client_published_at,now()) else null end,
     agent_published_at=case when v_agent then coalesce(agent_published_at,now()) else null end,
     business_status=case when v_client or v_agent then 'PUBLISHED' else 'AGREED' end,
     published_at=case when v_client or v_agent then coalesce(published_at,now()) else null end,
     published_by=v_actor,
     updated_at=now()
 where source_reference=v_target.publication_id and business_status<>'SUPERSEDED';

 update portal_private.owner_price_list_controls
 set internal_state='CURRENT',
     client_enabled=v_client,
     agent_enabled=v_agent,
     client_published_at=case when v_client then coalesce(client_published_at,now()) else null end,
     agent_published_at=case when v_agent then coalesce(agent_published_at,now()) else null end,
     published_by=v_actor,
     authority_state='CONFIRMED',lifecycle_state='ACTIVE',updated_at=now()
 where id=v_target_control.id;

 insert into portal_private.audit_events(actor_user_id,actor_role,action,entity_type,entity_id,request_id,metadata)
 values(v_actor,'ADMIN','OWNER_RECEIVED_PRICE_LIST_ACCEPTED','PRICE_LIST',v_target.publication_id,v_req,
        jsonb_build_object('superseded_publication_id',v_current.publication_id,'row_count',v_target_rows,'client',v_client,'agent',v_agent,'reason',nullif(btrim(p_reason),'')));

 return jsonb_build_object('publicationId',v_target.publication_id,'decision','ACCEPT','status','PUBLISHED','previousPublicationId',v_current.publication_id,'client',v_client,'agent',v_agent,'rowCount',v_target_rows);
end
$function$;

create or replace function public.owner_prices_publication_action(p_publication_id text,p_audience text)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'portal_private', 'auth'
as $function$
declare
 v_actor uuid;
 v_req uuid:=gen_random_uuid();
 v_pub uuid;
 v_client boolean;
 v_agent boolean;
begin
 v_actor:=portal_private.owner_r1_actor('ADMIN');
 if upper(coalesce(p_audience,'')) not in ('CLIENTS','AGENTS','BOTH','NONE') then raise exception 'INVALID_PRICE_AUDIENCE'; end if;
 v_client:=upper(p_audience) in ('CLIENTS','BOTH');
 v_agent:=upper(p_audience) in ('AGENTS','BOTH');

 select p.id into v_pub
 from portal_private.publications p
 join portal_private.owner_price_list_controls c on c.publication_key=p.id and c.lifecycle_state::text='ACTIVE'
 where p.publication_id=p_publication_id
   and p.publication_type::text='PRICE'
   and p.status::text='PUBLISHED'
   and p.lifecycle_state::text='ACTIVE'
   and p.authority_state::text='CONFIRMED'
   and c.internal_state='CURRENT'
   and c.authority_state::text='CONFIRMED'
 limit 1;
 if v_pub is null then raise exception 'PRICE_LIST_NOT_CURRENT_PUBLISHED'; end if;

 update portal_private.owner_price_snapshots ops
 set publish_client=v_client,
     publish_agent=v_agent,
     client_published_at=case when v_client then coalesce(client_published_at,now()) else null end,
     agent_published_at=case when v_agent then coalesce(agent_published_at,now()) else null end,
     business_status=case when v_client or v_agent then 'PUBLISHED' else 'AGREED' end,
     published_at=case when v_client or v_agent then coalesce(published_at,now()) else null end,
     published_by=v_actor,
     updated_at=now()
 where ops.source_publication_item_key in (select id from portal_private.publication_items where publication_key=v_pub)
   and ops.business_status<>'SUPERSEDED';

 update portal_private.publication_items
 set distribution_allowed=(v_client or v_agent),updated_at=now()
 where publication_key=v_pub and item_type::text='PRICE' and lifecycle_state::text='ACTIVE';

 update portal_private.owner_price_list_controls
 set client_enabled=v_client,
     agent_enabled=v_agent,
     client_published_at=case when v_client then coalesce(client_published_at,now()) else null end,
     agent_published_at=case when v_agent then coalesce(agent_published_at,now()) else null end,
     published_by=v_actor,
     internal_state='CURRENT',
     updated_at=now()
 where publication_key=v_pub;

 insert into portal_private.audit_events(actor_user_id,actor_role,action,entity_type,entity_id,request_id,metadata)
 values(v_actor,'ADMIN','OWNER_PRICE_LIST_PUBLICATION_UPDATED','PRICE_LIST',p_publication_id,v_req,
        jsonb_build_object('audience',upper(p_audience),'client',v_client,'agent',v_agent,'deliveryModel','STANDARD_PRICE_LIST'));

 return jsonb_build_object('publicationId',p_publication_id,'audience',upper(p_audience),'client',v_client,'agent',v_agent,'status',case when v_client or v_agent then 'PUBLISHED' else 'INTERNAL_ONLY' end,'deliveryModel','STANDARD_PRICE_LIST');
end
$function$;

revoke all on function public.owner_decide_received_price_list(text,text,text) from public;
revoke all on function public.owner_decide_received_price_list(text,text,text) from anon;
grant execute on function public.owner_decide_received_price_list(text,text,text) to authenticated,service_role;
revoke all on function public.owner_prices_publication_action(text,text) from anon;

-- Strict recovery guard. Abort the entire migration on drift.
do $guard$
declare
 v_r9_status text; v_r9_auth text; v_r9_lifecycle text; v_r9_rows int; v_r9_published int; v_r9_client boolean; v_r9_agent boolean;
 v_r10_status text; v_r10_state text; v_r10_client boolean; v_r10_agent boolean; v_r10_published_at timestamptz; v_r10_rows int;
 v_oct_status text; v_oct_state text;
begin
 select p.status::text,p.authority_state::text,p.lifecycle_state::text,
        count(s.id) filter (where s.business_status<>'SUPERSEDED'),
        count(s.id) filter (where s.business_status='PUBLISHED'),
        coalesce(bool_or(s.publish_client),false),coalesce(bool_or(s.publish_agent),false)
 into v_r9_status,v_r9_auth,v_r9_lifecycle,v_r9_rows,v_r9_published,v_r9_client,v_r9_agent
 from portal_private.publications p
 left join portal_private.owner_price_snapshots s on s.source_reference=p.publication_id
 where p.publication_id='RONA-PRICE-LIST-2026-09-R9'
 group by p.id;
 if v_r9_status is distinct from 'PUBLISHED' or v_r9_auth is distinct from 'CONFIRMED' or v_r9_lifecycle is distinct from 'ACTIVE'
    or v_r9_rows<>18 or v_r9_published<>18 or not v_r9_client or not v_r9_agent then
   raise exception 'RECOVERY_R9_PRECONDITION_FAILED';
 end if;

 select p.status::text,c.internal_state,c.client_enabled,c.agent_enabled,p.published_at,
        (select count(*) from portal_private.owner_price_snapshots s where s.source_reference=p.publication_id and s.business_status<>'SUPERSEDED')
 into v_r10_status,v_r10_state,v_r10_client,v_r10_agent,v_r10_published_at,v_r10_rows
 from portal_private.publications p join portal_private.owner_price_list_controls c on c.publication_key=p.id
 where p.publication_id='RONA-PRICE-LIST-2026-09-R10';
 if v_r10_status is distinct from 'APPROVED' or v_r10_state is distinct from 'RECEIVED_IN_ADMIN'
    or v_r10_client or v_r10_agent or v_r10_published_at is not null or v_r10_rows<>37 then
   raise exception 'RECOVERY_R10_PRECONDITION_FAILED';
 end if;

 select p.status::text,c.internal_state into v_oct_status,v_oct_state
 from portal_private.publications p join portal_private.owner_price_list_controls c on c.publication_key=p.id
 where p.publication_id='RONA-PRICE-LIST-2026-10-R1';
 if v_oct_status is distinct from 'SUPERSEDED' or v_oct_state is distinct from 'RETIRED' then
   raise exception 'RECOVERY_OCT_R1_PRECONDITION_FAILED';
 end if;
end
$guard$;

-- One-time administrative recovery only. No price row, audience, or publication date is changed here.
update portal_private.owner_price_list_controls c
set internal_state='CURRENT'
from portal_private.publications p
where p.id=c.publication_key
  and p.publication_id='RONA-PRICE-LIST-2026-09-R9'
  and p.status::text='PUBLISHED'
  and p.authority_state::text='CONFIRMED'
  and p.lifecycle_state::text='ACTIVE'
  and c.internal_state='RECEIVED_IN_ADMIN';
