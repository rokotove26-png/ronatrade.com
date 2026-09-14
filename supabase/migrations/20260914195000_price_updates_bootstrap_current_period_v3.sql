create or replace function public.owner_price_updates_bootstrap()
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','portal_private','auth'
as $function$
declare
 v_actor uuid;
 v_current text;
 v_current_key uuid;
 v_rows jsonb;
 v_history jsonb;
 v_client boolean:=false;
 v_agent boolean:=false;
 v_period_from date;
 v_period_to date;
 v_period_total integer:=0;
 v_period_missing integer:=0;
 v_period_variants integer:=0;
 v_period_status text:='TO_VERIFY';
begin
 v_actor:=portal_private.owner_r1_actor('ADMIN');

 select p.id,p.publication_id,c.client_enabled,c.agent_enabled
 into v_current_key,v_current,v_client,v_agent
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

 if v_current_key is not null then
   select min(pi.delivery_period_from),max(pi.delivery_period_to),count(*)::int,
          count(*) filter(where pi.delivery_period_from is null or pi.delivery_period_to is null)::int,
          count(distinct concat(coalesce(pi.delivery_period_from::text,'NULL'),'|',coalesce(pi.delivery_period_to::text,'NULL')))::int
   into v_period_from,v_period_to,v_period_total,v_period_missing,v_period_variants
   from portal_private.publication_items pi
   where pi.publication_key=v_current_key
     and pi.item_type::text='PRICE'
     and pi.lifecycle_state::text='ACTIVE';

   if v_period_total>0 and v_period_missing=0 and v_period_variants=1 and v_period_from is not null and v_period_to is not null then
     v_period_status:='AUTHORITATIVE';
   end if;
 end if;

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
   'generatedAt',now(),
   'currentPublicationId',v_current,
   'currentDeliveryPeriod',jsonb_build_object(
      'status',v_period_status,
      'from',case when v_period_status='AUTHORITATIVE' then v_period_from else null end,
      'to',case when v_period_status='AUTHORITATIVE' then v_period_to else null end,
      'itemCount',v_period_total,
      'missingCount',v_period_missing,
      'variantCount',v_period_variants
   ),
   'clientEnabled',v_client,'agentEnabled',v_agent,
   'updateAvailableCount',(select count(*) from portal_private.owner_price_change_proposals where proposal_status='UPDATE_AVAILABLE'),
   'proposals',v_rows,'history',v_history
 );
end
$function$;
