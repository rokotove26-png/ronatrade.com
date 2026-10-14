-- Admin Agent Rewards v19: Owner correction gate uses effective-chain reconciled v15 source.
-- A correction is still per source paymentId and must pass the existing Finance/Operations
-- approved source-locked owner correction function v7. No source finance record changes.

create or replace function public.rona_admin_agent_rewards_correct_v9(
  p_deal_id text,
  p_assignment_id uuid,
  p_corrected_payload jsonb,
  p_note text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path to pg_catalog, public, portal_private, auth
as $$
declare
  v_actor uuid;
  v_deal jsonb;
  v_allowed jsonb;
  v_key text;
  v_line_value jsonb;
  v_status text;
begin
  v_actor:=portal_private.owner_r1_actor('ADMIN');
  if coalesce(btrim(p_deal_id),'')='' then
    raise exception 'DEAL_ID_REQUIRED';
  end if;
  select x.value into v_deal
  from jsonb_array_elements(
    coalesce(public.rona_admin_agent_rewards_workspace_v15()->'deals','[]'::jsonb)
  ) x(value)
  where x.value->>'dealId'=p_deal_id
  limit 1;
  if v_deal is null then
    raise exception 'SOURCE_LOCKED_FINANCE_DEAL_NOT_FOUND';
  end if;
  v_status:=coalesce(v_deal->'financeSourceReconciliation'->>'status','');
  if v_status not in ('RECONCILED_CURRENT_FINANCE_V8','LEGACY_APPROVED_PAYMENT_SCOPE_RECONCILED') then
    raise exception 'OWNER_CORRECTION_REQUIRES_RECONCILED_FINANCE_SOURCE';
  end if;
  if v_deal->'cashFlow'->>'status'<>'APPROVED_CASH_FLOW_DDS' then
    raise exception 'OWNER_CORRECTION_REQUIRES_APPROVED_DDS';
  end if;
  if jsonb_typeof(p_corrected_payload) <> 'object'
    or jsonb_typeof(p_corrected_payload->'paymentLineAmounts') <> 'object'
    or not (p_corrected_payload?'openSettlementAdjustment') then
    raise exception 'OWNER_CORRECTION_CONTRACT_INVALID';
  end if;
  v_allowed:=coalesce(v_deal->'cashPaymentLines','[]'::jsonb);
  for v_key,v_line_value in
    select key,value from jsonb_each(p_corrected_payload->'paymentLineAmounts')
  loop
    if not exists (
      select 1 from jsonb_array_elements(v_allowed) x
      where x->>'paymentId'=v_key
        and (x->>'source' in ('FINANCE_V8_SOURCE_LOCKED_RECONCILED','SOURCE_LOCKED_PAYMENT_RESOURCE_CHAIN')
             or x->>'authorityStatus' in ('AUTHORITATIVE_FINANCE_PAYMENT','AUTHORITATIVE_PAYMENT_RESOURCE_CHAIN'))
    ) then
      raise exception 'PAYMENT_LINE_NOT_IN_RECONCILED_FINANCE_SOURCE:%',v_key;
    end if;
  end loop;
  -- Existing validated role/Finance+Operations gate and immutable correction history.
  return public.rona_admin_agent_rewards_correct_v7(
    p_deal_id,p_assignment_id,p_corrected_payload,p_note,p_idempotency_key
  );
end;
$$;

revoke all on function public.rona_admin_agent_rewards_correct_v9(text,uuid,jsonb,text,text) from public,anon;
grant execute on function public.rona_admin_agent_rewards_correct_v9(text,uuid,jsonb,text,text) to authenticated;

comment on function public.rona_admin_agent_rewards_correct_v9(text,uuid,jsonb,text,text) is
'Owner corrections limited to reconciled current Finance source payment IDs, delegated to existing audited/approved v7 correction contract; prevents stale or foreign payment overlays.';
