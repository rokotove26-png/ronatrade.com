-- Preserve the Operations-confirmed delivery period when Admin applies a full
-- price-list successor. The legacy V1 materializer clones the current
-- publication period; V2 applies the structured successor period atomically in
-- the same transaction and keeps the existing explicit Admin approval gate.

create or replace function portal_private.owner_apply_full_price_handoff_v2(
  p_proposal_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, portal_private, auth
as $$
declare
  v_state jsonb;
  v_from date;
  v_to date;
  v_result jsonb;
  v_publication_id text;
  v_publication_key uuid;
begin
  select coalesce(internal_context->'target_state','{}'::jsonb)
    into v_state
  from portal_private.owner_price_change_proposals
  where id = p_proposal_id;

  if not found then
    raise exception using errcode='P0001', message='PRICE_UPDATE_PROPOSAL_NOT_FOUND';
  end if;

  if nullif(btrim(v_state->>'delivery_period_from'),'') is not null then
    v_from := (v_state->>'delivery_period_from')::date;
  end if;
  if nullif(btrim(v_state->>'delivery_period_to'),'') is not null then
    v_to := (v_state->>'delivery_period_to')::date;
  end if;

  if v_from is not null and v_to is not null and v_to < v_from then
    raise exception using errcode='P0001', message='PRICE_HANDOFF_DELIVERY_PERIOD_INVALID';
  end if;

  v_result := portal_private.owner_apply_full_price_handoff_v1(p_proposal_id);
  v_publication_id := v_result->>'publicationId';

  if v_publication_id is null then
    raise exception using errcode='P0001', message='PRICE_HANDOFF_RESULT_PUBLICATION_REQUIRED';
  end if;

  select id into v_publication_key
  from portal_private.publications
  where publication_id = v_publication_id;

  if v_publication_key is null then
    raise exception using errcode='P0001', message='PRICE_HANDOFF_RESULT_PUBLICATION_NOT_FOUND';
  end if;

  if v_from is not null or v_to is not null then
    update portal_private.publication_items
       set delivery_period_from = coalesce(v_from, delivery_period_from),
           delivery_period_to = coalesce(v_to, delivery_period_to),
           updated_at = now()
     where publication_key = v_publication_key
       and item_type::text = 'PRICE';
  end if;

  return v_result || jsonb_build_object(
    'deliveryPeriodFrom', v_from,
    'deliveryPeriodTo', v_to,
    'handoffContract', 'OPERATIONS_PRICE_ADMIN_HANDOFF_V3'
  );
end
$$;

create or replace function public.owner_apply_price_change_proposal(
  p_proposal_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, portal_private, auth
as $$
declare
  v_mode text;
begin
  select internal_context->>'proposal_mode' into v_mode
  from portal_private.owner_price_change_proposals
  where id = p_proposal_id;

  if coalesce(v_mode,'') = 'FULL_PRICE_LIST_HANDOFF' then
    return portal_private.owner_apply_full_price_handoff_v2(p_proposal_id);
  end if;

  if coalesce(v_mode,'') = 'FULL_PRICE_LIST_SOURCE_HANDOFF' then
    return portal_private.owner_apply_full_price_source_handoff_v2(p_proposal_id);
  end if;

  return public.owner_apply_price_change_proposal_legacy(p_proposal_id);
end
$$;

revoke all on function portal_private.owner_apply_full_price_handoff_v2(uuid) from public;
