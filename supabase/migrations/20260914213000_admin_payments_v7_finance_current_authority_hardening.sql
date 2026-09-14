-- Admin Payments V7 — Finance controlled-write current-authority hardening.
-- Corrects the PAYMENT_RESOURCE_CHAIN_CONFIRMED selector so the row selected after
-- the cardinality gate uses the exact same authoritative/current leaf predicate.
-- This is a source-only correction: no finance facts, allocations or resource-chain
-- business data are inserted or rewritten by this migration.

do $hardening$
declare
  v_definition text;
  v_unsafe text := $unsafe$select * into v_current_finance from portal_private.deal_finance_authority_v7 a where a.deal_key=v_deal.id and a.source_locked=true and not exists(select 1 from portal_private.deal_finance_authority_v7 n where n.supersedes_id=a.id and n.source_locked=true and upper(n.authority_state) not in ('SUPERSEDED','REJECTED','REVERSED','INVALID','INACTIVE') and upper(n.lifecycle_state) not in ('SUPERSEDED','REJECTED','REVERSED','ARCHIVED','INACTIVE')) limit 1;$unsafe$;
  v_safe text := $safe$select * into v_current_finance from portal_private.deal_finance_authority_v7 a where a.deal_key=v_deal.id and a.source_locked=true and upper(a.authority_state) not in ('SUPERSEDED','REJECTED','REVERSED','INVALID','INACTIVE') and upper(a.lifecycle_state) not in ('SUPERSEDED','REJECTED','REVERSED','ARCHIVED','INACTIVE') and not exists(select 1 from portal_private.deal_finance_authority_v7 n where n.supersedes_id=a.id and n.source_locked=true and upper(n.authority_state) not in ('SUPERSEDED','REJECTED','REVERSED','INVALID','INACTIVE') and upper(n.lifecycle_state) not in ('SUPERSEDED','REJECTED','REVERSED','ARCHIVED','INACTIVE')) limit 1;$safe$;
begin
  if to_regprocedure('portal_private.persist_finance_event_v7(jsonb,jsonb)') is null then
    raise exception 'FINANCE_CURRENT_AUTHORITY_HARDENING_PREREQUISITE_MISSING';
  end if;

  select pg_get_functiondef('portal_private.persist_finance_event_v7(jsonb,jsonb)'::regprocedure)
    into v_definition;

  if position(v_unsafe in v_definition)=0 then
    if position(v_safe in v_definition)>0 then
      return;
    end if;
    raise exception 'FINANCE_CURRENT_AUTHORITY_HARDENING_SOURCE_MISMATCH';
  end if;

  if length(v_definition)-length(replace(v_definition,v_unsafe,''))<>length(v_unsafe) then
    raise exception 'FINANCE_CURRENT_AUTHORITY_HARDENING_NON_UNIQUE_TARGET';
  end if;

  v_definition:=replace(v_definition,v_unsafe,v_safe);
  execute v_definition;

  select pg_get_functiondef('portal_private.persist_finance_event_v7(jsonb,jsonb)'::regprocedure)
    into v_definition;
  if position(v_unsafe in v_definition)>0 or position(v_safe in v_definition)=0 then
    raise exception 'FINANCE_CURRENT_AUTHORITY_HARDENING_VERIFY_FAILED';
  end if;
end
$hardening$;

comment on function portal_private.persist_finance_event_v7(jsonb,jsonb) is
'Payments V7 Finance controlled write. PAYMENT_RESOURCE_CHAIN_CONFIRMED selects only the unique live authoritative Finance leaf after the matching cardinality gate.';
