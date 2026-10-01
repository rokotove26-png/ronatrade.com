begin;

create or replace function portal_private.owner_apply_full_price_handoff_v3(p_proposal_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','portal_private','auth'
as $function$
declare
  v_base_publication_key uuid;
  v_state jsonb;
  v_target_to date;
  v_base_to date;
  v_result jsonb;
  v_target_key uuid;
  v_rows integer := 0;
begin
  select p.base_publication_key,
         coalesce(p.internal_context->'target_state','{}'::jsonb)
    into v_base_publication_key,v_state
  from portal_private.owner_price_change_proposals p
  where p.id=p_proposal_id;

  if not found then
    raise exception using errcode='P0001',message='PRICE_UPDATE_PROPOSAL_NOT_FOUND';
  end if;

  if nullif(btrim(v_state->>'delivery_period_to'),'') is not null then
    v_target_to := (v_state->>'delivery_period_to')::date;
  end if;

  if v_base_publication_key is not null then
    select max(pi.delivery_period_to)
      into v_base_to
    from portal_private.publication_items pi
    where pi.publication_key=v_base_publication_key
      and pi.item_type::text='PRICE'
      and pi.lifecycle_state::text='ACTIVE';
  end if;

  v_result := portal_private.owner_apply_full_price_handoff_v2(p_proposal_id);

  if v_target_to is not null
     and v_base_to is not null
     and v_target_to<>v_base_to then
    select p.id
      into v_target_key
    from portal_private.publications p
    where p.publication_id=v_result->>'publicationId'
    limit 1;

    if v_target_key is null then
      raise exception using errcode='P0001',message='PRICE_VALIDITY_TARGET_PUBLICATION_NOT_FOUND';
    end if;

    update portal_private.publication_items pi
       set valid_to = pi.valid_to + ((v_target_to-v_base_to) * interval '1 day'),
           updated_at = now()
     where pi.publication_key=v_target_key
       and pi.item_type::text='PRICE'
       and pi.delivery_period_to=v_target_to
       and pi.valid_to is not null
       and pi.valid_to::date=v_base_to;
    get diagnostics v_rows=row_count;
  end if;

  return v_result || jsonb_build_object(
    'validityAlignmentContract','PRICE_VALIDITY_ALIGNMENT_V1',
    'validityRowsAdjusted',v_rows
  );
end
$function$;

create or replace function public.owner_apply_price_change_proposal(p_proposal_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','portal_private','auth'
as $function$
declare
  v_mode text;
begin
  perform portal_private.owner_r1_actor('ADMIN');

  select internal_context->>'proposal_mode'
    into v_mode
  from portal_private.owner_price_change_proposals
  where id=p_proposal_id;

  if coalesce(v_mode,'')='FULL_PRICE_LIST_HANDOFF' then
    return portal_private.owner_apply_full_price_handoff_v3(p_proposal_id);
  end if;
  if coalesce(v_mode,'')='FULL_PRICE_LIST_SOURCE_HANDOFF' then
    return portal_private.owner_apply_full_price_source_handoff_v2(p_proposal_id);
  end if;
  return public.owner_apply_price_change_proposal_legacy(p_proposal_id);
end
$function$;

do $repair$
declare
  v_base_key uuid;
  v_target_key uuid;
  v_base_to date;
  v_target_to date;
  v_target_publication_id text;
  v_rows integer := 0;
  v_already_aligned integer := 0;
begin
  select p.base_publication_key,
         p.new_publication_key,
         (p.internal_context->'target_state'->>'delivery_period_to')::date
    into v_base_key,v_target_key,v_target_to
  from portal_private.owner_price_change_proposals p
  where p.proposal_status='APPLIED'
    and p.base_publication_id='RONA-PRICE-LIST-2026-09-R11'
    and p.internal_context->>'successor_publication_id'='RONA-PRICE-LIST-2026-09-R12'
  order by p.applied_at desc
  limit 1;

  if not found or v_base_key is null or v_target_key is null or v_target_to is null then
    raise exception using errcode='P0001',message='PRICE_VALIDITY_REPAIR_SOURCE_NOT_FOUND';
  end if;

  select max(pi.delivery_period_to)
    into v_base_to
  from portal_private.publication_items pi
  where pi.publication_key=v_base_key
    and pi.item_type::text='PRICE';

  select p.publication_id
    into v_target_publication_id
  from portal_private.publications p
  where p.id=v_target_key
    and p.status::text='PUBLISHED'
    and p.authority_state::text='CONFIRMED'
    and p.lifecycle_state::text='ACTIVE';

  if v_base_to is null
     or v_target_publication_id<>'RONA-PRICE-LIST-2026-09-R12'
     or v_target_to<=v_base_to then
    raise exception using errcode='P0001',message='PRICE_VALIDITY_REPAIR_PRECONDITION_FAILED';
  end if;

  update portal_private.publication_items pi
     set valid_to = pi.valid_to + ((v_target_to-v_base_to) * interval '1 day'),
         updated_at = now()
   where pi.publication_key=v_target_key
     and pi.item_type::text='PRICE'
     and pi.delivery_period_to=v_target_to
     and pi.valid_to is not null
     and pi.valid_to::date=v_base_to;
  get diagnostics v_rows=row_count;

  if v_rows=0 then
    select count(*)
      into v_already_aligned
    from portal_private.publication_items pi
    where pi.publication_key=v_target_key
      and pi.item_type::text='PRICE'
      and pi.delivery_period_to=v_target_to
      and pi.valid_to is not null
      and pi.valid_to::date=v_target_to;

    if v_already_aligned=0 then
      raise exception using errcode='P0001',message='PRICE_VALIDITY_REPAIR_NO_MATCH';
    end if;
  else
    insert into portal_private.audit_events(
      actor_role,action,entity_type,entity_id,metadata
    ) values(
      'SYSTEM_ADMIN',
      'SYSTEM_ADMIN_PRICE_VALIDITY_REPAIR',
      'PRICE_LIST',
      v_target_publication_id,
      jsonb_build_object(
        'contract','PRICE_VALIDITY_ALIGNMENT_V1',
        'base_delivery_period_to',v_base_to,
        'target_delivery_period_to',v_target_to,
        'rows_adjusted',v_rows,
        'prices_changed',false,
        'audience_changed',false,
        'publication_state_changed',false
      )
    );
  end if;
end
$repair$;

commit;
