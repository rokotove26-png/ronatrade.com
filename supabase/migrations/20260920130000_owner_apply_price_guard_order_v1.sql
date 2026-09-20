-- Harden the public SECURITY DEFINER router so authorization happens
-- before any proposal-row lookup. This removes the pre-auth existence oracle
-- while preserving all authorized routing semantics.
create or replace function public.owner_apply_price_change_proposal(p_proposal_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'portal_private', 'auth'
as $function$
declare
  v_mode text;
begin
  -- Fail closed before touching proposal data.
  perform portal_private.owner_r1_actor('ADMIN');

  select internal_context->>'proposal_mode' into v_mode
  from portal_private.owner_price_change_proposals
  where id=p_proposal_id;

  if coalesce(v_mode,'')='FULL_PRICE_LIST_HANDOFF' then
    return portal_private.owner_apply_full_price_handoff_v2(p_proposal_id);
  end if;
  if coalesce(v_mode,'')='FULL_PRICE_LIST_SOURCE_HANDOFF' then
    return portal_private.owner_apply_full_price_source_handoff_v2(p_proposal_id);
  end if;
  return public.owner_apply_price_change_proposal_legacy(p_proposal_id);
end
$function$;
