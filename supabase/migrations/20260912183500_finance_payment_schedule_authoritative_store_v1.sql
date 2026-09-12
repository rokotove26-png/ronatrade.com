begin;

-- PR #461 final authority materialization.
-- owner_payment_plan remains the canonical payment-plan business store.
-- Coordination records are provenance/evidence only; APPROVE_FOR_NEXT_STAGE is not mutation authority.

alter table portal_private.owner_payment_plan
  add column if not exists schedule_authority_state text not null default 'SOURCE_RECEIVED',
  add column if not exists due_state text not null default 'TO_VERIFY',
  add column if not exists trigger_type text null,
  add column if not exists trigger_state text not null default 'TO_VERIFY',
  add column if not exists next_tranche_condition text null,
  add column if not exists schedule_version text null,
  add column if not exists proposal_record_id uuid null,
  add column if not exists conclusion_record_id uuid null,
  add column if not exists operations_decision_id uuid null,
  add column if not exists trigger_record_id uuid null,
  add column if not exists source_refs jsonb not null default '[]'::jsonb,
  add column if not exists source_timestamp timestamptz null,
  add column if not exists materialized_at timestamptz null,
  add column if not exists materialized_by text null;

do $$ begin
  if not exists(select 1 from pg_constraint where conname='owner_payment_plan_schedule_authority_state_chk') then
    alter table portal_private.owner_payment_plan
      add constraint owner_payment_plan_schedule_authority_state_chk
      check (schedule_authority_state in ('SOURCE_RECEIVED','CONFIRMED','SUPERSEDED'));
  end if;
  if not exists(select 1 from pg_constraint where conname='owner_payment_plan_due_state_chk') then
    alter table portal_private.owner_payment_plan
      add constraint owner_payment_plan_due_state_chk
      check (due_state in ('CURRENT_DUE','DEFERRED_NOT_DUE','TO_VERIFY','NOT_APPLICABLE'));
  end if;
  if not exists(select 1 from pg_constraint where conname='owner_payment_plan_trigger_state_chk') then
    alter table portal_private.owner_payment_plan
      add constraint owner_payment_plan_trigger_state_chk
      check (trigger_state in ('CONFIRMED','NOT_CONFIRMED','NOT_APPLICABLE','TO_VERIFY'));
  end if;
  if not exists(select 1 from pg_constraint where conname='owner_payment_plan_source_refs_array_chk') then
    alter table portal_private.owner_payment_plan
      add constraint owner_payment_plan_source_refs_array_chk
      check (jsonb_typeof(source_refs)='array');
  end if;
end $$;

create index if not exists owner_payment_plan_schedule_current_idx
  on portal_private.owner_payment_plan(deal_key,schedule_authority_state,status,tranche_no);

create or replace function portal_private.finance_materialize_payment_schedule(
  p_deal_id text,
  p_schedule jsonb,
  p_proposal_record_id uuid default null,
  p_conclusion_record_id uuid default null,
  p_operations_decision_id uuid default null,
  p_source_refs jsonb default '[]'::jsonb,
  p_source_timestamp timestamptz default now(),
  p_materialized_by text default 'FINANCE_BACKEND'
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','portal_private','auth'
as $$
declare
  v_deal uuid;
  v_currency text;
  v_version text;
  v_count int := 0;
  v_seen int[] := '{}';
  v_tranche jsonb;
  v_no int;
  v_amount numeric;
  v_basis text;
  v_input_status text;
  v_status text;
  v_trigger_state text;
  v_trigger_type text;
  v_due_state text;
begin
  select id into v_deal from portal_private.deals where deal_id=p_deal_id limit 1;
  if v_deal is null then raise exception using errcode='P0001',message='DEAL_NOT_FOUND'; end if;
  if jsonb_typeof(p_schedule)<>'object' then raise exception using errcode='P0001',message='PAYMENT_SCHEDULE_OBJECT_REQUIRED'; end if;
  if jsonb_typeof(p_schedule->'tranches')<>'array' or jsonb_array_length(p_schedule->'tranches')=0 then
    raise exception using errcode='P0001',message='PAYMENT_SCHEDULE_TRANCHES_REQUIRED';
  end if;
  if jsonb_typeof(coalesce(p_source_refs,'[]'::jsonb))<>'array' then raise exception using errcode='P0001',message='PAYMENT_SCHEDULE_SOURCE_REFS_ARRAY_REQUIRED'; end if;

  v_currency:=upper(btrim(coalesce(p_schedule->>'currency','')));
  v_version:=btrim(coalesce(p_schedule->>'schedule_version',''));
  if v_currency!~'^[A-Z]{3}$' then raise exception using errcode='P0001',message='PAYMENT_SCHEDULE_CURRENCY_INVALID'; end if;
  if v_version='' then raise exception using errcode='P0001',message='PAYMENT_SCHEDULE_VERSION_REQUIRED'; end if;

  -- Provenance references are checked only for referential integrity. They do not authorize this mutation.
  if p_proposal_record_id is not null and not exists(select 1 from portal_private.ai_coordination_records where record_id=p_proposal_record_id) then
    raise exception using errcode='P0001',message='PAYMENT_SCHEDULE_PROPOSAL_PROVENANCE_MISSING';
  end if;
  if p_conclusion_record_id is not null and not exists(select 1 from portal_private.ai_coordination_records where record_id=p_conclusion_record_id) then
    raise exception using errcode='P0001',message='PAYMENT_SCHEDULE_CONCLUSION_PROVENANCE_MISSING';
  end if;
  if p_operations_decision_id is not null and not exists(select 1 from portal_private.ai_coordination_records where record_id=p_operations_decision_id) then
    raise exception using errcode='P0001',message='PAYMENT_SCHEDULE_DECISION_PROVENANCE_MISSING';
  end if;

  for v_tranche in select value from jsonb_array_elements(p_schedule->'tranches') loop
    v_count:=v_count+1;
    v_no:=coalesce(nullif(v_tranche->>'tranche_no','')::int,nullif(v_tranche->>'sequence','')::int,v_count);
    v_amount:=nullif(v_tranche->>'planned_amount','')::numeric;
    if v_amount is null then v_amount:=nullif(v_tranche->>'amount','')::numeric; end if;
    v_basis:=nullif(btrim(coalesce(v_tranche->>'next_tranche_condition',v_tranche->>'basis','')),'');
    v_input_status:=upper(btrim(coalesce(v_tranche->>'status','EXPECTED')));
    v_trigger_state:=upper(btrim(coalesce(v_tranche->>'trigger_state','')));
    v_trigger_type:=nullif(btrim(coalesce(v_tranche->>'trigger_type','')),'');
    v_due_state:=upper(btrim(coalesce(v_tranche->>'due_state','')));

    if v_no<=0 or v_no=any(v_seen) then raise exception using errcode='P0001',message='PAYMENT_SCHEDULE_TRANCHE_NUMBER_INVALID'; end if;
    v_seen:=array_append(v_seen,v_no);
    if v_amount is null or v_amount<0 then raise exception using errcode='P0001',message='PAYMENT_SCHEDULE_TRANCHE_AMOUNT_INVALID'; end if;

    if v_trigger_state='' then
      if v_input_status in ('PAID','PAID_VERIFIED','RECEIVED') then v_trigger_state:='NOT_APPLICABLE';
      elsif v_due_state='CURRENT_DUE' then v_trigger_state:='NOT_APPLICABLE';
      else v_trigger_state:='TO_VERIFY'; end if;
    end if;
    if v_trigger_state='SENT' then raise exception using errcode='P0001',message='SENT_IS_NOT_PAYMENT_SCHEDULE_TRIGGER'; end if;
    if v_trigger_state not in ('CONFIRMED','NOT_CONFIRMED','NOT_APPLICABLE','TO_VERIFY') then
      raise exception using errcode='P0001',message='PAYMENT_SCHEDULE_TRIGGER_STATE_INVALID';
    end if;

    if v_due_state='' then
      if v_input_status in ('PAID','PAID_VERIFIED','RECEIVED') then v_due_state:='CURRENT_DUE';
      elsif v_trigger_state='CONFIRMED' then v_due_state:='CURRENT_DUE';
      elsif v_trigger_state='NOT_CONFIRMED' then v_due_state:='DEFERRED_NOT_DUE';
      else v_due_state:='TO_VERIFY'; end if;
    end if;
    if v_due_state not in ('CURRENT_DUE','DEFERRED_NOT_DUE','TO_VERIFY','NOT_APPLICABLE') then
      raise exception using errcode='P0001',message='PAYMENT_SCHEDULE_DUE_STATE_INVALID';
    end if;
    if v_trigger_state='CONFIRMED' and v_due_state<>'CURRENT_DUE' then
      raise exception using errcode='P0001',message='CONFIRMED_TRIGGER_REQUIRES_CURRENT_DUE';
    end if;
    if v_trigger_state='NOT_CONFIRMED' and v_due_state='CURRENT_DUE' then
      raise exception using errcode='P0001',message='UNCONFIRMED_TRIGGER_CANNOT_CREATE_DUE';
    end if;

    if v_trigger_type is null and v_tranche ? 'trigger_state' then v_trigger_type:='PAYMENT_SCHEDULE_TRIGGER'; end if;
    v_status:=case when v_input_status in ('PAID','PAID_VERIFIED','RECEIVED') then 'RECEIVED'
                   when v_input_status='PARTIAL' then 'PARTIAL'
                   when v_input_status='CANCELLED' then 'CANCELLED'
                   else 'EXPECTED' end;

    insert into portal_private.owner_payment_plan(
      deal_key,tranche_no,share_text,planned_amount,currency,due_at,status,source_system,
      schedule_authority_state,due_state,trigger_type,trigger_state,next_tranche_condition,schedule_version,
      proposal_record_id,conclusion_record_id,operations_decision_id,trigger_record_id,source_refs,source_timestamp,
      materialized_at,materialized_by,updated_at
    ) values(
      v_deal,v_no,v_basis,v_amount,v_currency,null,v_status,'FINANCE_AUTHORITATIVE_PAYMENT_SCHEDULE_V1',
      'CONFIRMED',v_due_state,v_trigger_type,v_trigger_state,v_basis,v_version,
      p_proposal_record_id,p_conclusion_record_id,p_operations_decision_id,null,coalesce(p_source_refs,'[]'::jsonb),p_source_timestamp,
      now(),p_materialized_by,now()
    )
    on conflict(deal_key,tranche_no) do update set
      share_text=excluded.share_text,planned_amount=excluded.planned_amount,currency=excluded.currency,status=excluded.status,
      source_system=excluded.source_system,schedule_authority_state='CONFIRMED',due_state=excluded.due_state,
      trigger_type=excluded.trigger_type,trigger_state=excluded.trigger_state,next_tranche_condition=excluded.next_tranche_condition,
      schedule_version=excluded.schedule_version,proposal_record_id=excluded.proposal_record_id,
      conclusion_record_id=excluded.conclusion_record_id,operations_decision_id=excluded.operations_decision_id,
      trigger_record_id=null,source_refs=excluded.source_refs,source_timestamp=excluded.source_timestamp,
      materialized_at=excluded.materialized_at,materialized_by=excluded.materialized_by,updated_at=now();
  end loop;

  update portal_private.owner_payment_plan
     set status='CANCELLED',schedule_authority_state='SUPERSEDED',updated_at=now()
   where deal_key=v_deal and schedule_authority_state='CONFIRMED' and not (tranche_no=any(v_seen));

  return jsonb_build_object('materialized',true,'dealId',p_deal_id,'scheduleVersion',v_version,'trancheCount',v_count,'materializedAt',now());
end
$$;

create or replace function portal_private.finance_materialize_payment_schedule_trigger(
  p_deal_id text,
  p_trigger_state text,
  p_trigger_record_id uuid default null,
  p_source_refs jsonb default '[]'::jsonb,
  p_source_timestamp timestamptz default now(),
  p_materialized_by text default 'FINANCE_RAIL_BACKEND'
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','portal_private','auth'
as $$
declare
  v_deal uuid;
  v_state text:=upper(btrim(coalesce(p_trigger_state,'')));
  v_count int;
begin
  select id into v_deal from portal_private.deals where deal_id=p_deal_id limit 1;
  if v_deal is null then raise exception using errcode='P0001',message='DEAL_NOT_FOUND'; end if;
  if v_state='SENT' then raise exception using errcode='P0001',message='SENT_IS_NOT_PAYMENT_SCHEDULE_TRIGGER'; end if;
  if v_state not in ('CONFIRMED','NOT_CONFIRMED') then raise exception using errcode='P0001',message='PAYMENT_SCHEDULE_TRIGGER_STATE_INVALID'; end if;
  if jsonb_typeof(coalesce(p_source_refs,'[]'::jsonb))<>'array' then raise exception using errcode='P0001',message='PAYMENT_SCHEDULE_SOURCE_REFS_ARRAY_REQUIRED'; end if;
  if p_trigger_record_id is not null and not exists(select 1 from portal_private.ai_coordination_records where record_id=p_trigger_record_id) then
    raise exception using errcode='P0001',message='PAYMENT_SCHEDULE_TRIGGER_PROVENANCE_MISSING';
  end if;

  update portal_private.owner_payment_plan
     set trigger_state=v_state,
         due_state=case when v_state='CONFIRMED' then 'CURRENT_DUE' else 'DEFERRED_NOT_DUE' end,
         trigger_record_id=p_trigger_record_id,
         source_refs=coalesce(source_refs,'[]'::jsonb)||coalesce(p_source_refs,'[]'::jsonb),
         source_timestamp=p_source_timestamp,
         materialized_at=now(),materialized_by=p_materialized_by,updated_at=now()
   where deal_key=v_deal
     and schedule_authority_state='CONFIRMED'
     and status<>'CANCELLED'
     and trigger_type is not null;
  get diagnostics v_count=row_count;
  if v_count=0 then raise exception using errcode='P0001',message='MATERIALIZED_PAYMENT_SCHEDULE_TRIGGER_NOT_FOUND'; end if;
  return jsonb_build_object('materialized',true,'dealId',p_deal_id,'triggerState',v_state,'updatedTranches',v_count,'materializedAt',now());
end
$$;

revoke all on function portal_private.finance_materialize_payment_schedule(text,jsonb,uuid,uuid,uuid,jsonb,timestamptz,text) from public,anon,authenticated;
revoke all on function portal_private.finance_materialize_payment_schedule_trigger(text,text,uuid,jsonb,timestamptz,text) from public,anon,authenticated;

-- Owner-authorized PR #461 business materialization for the two reconciled current schedules.
-- Numeric schedule values are read from the Finance evidence payload; none are embedded in code/migration.
-- The Operations decision is retained only as provenance/approval evidence. This DO block is the explicit business mutation.
do $$
declare
  r record;
  v_schedule jsonb;
  v_source_refs jsonb;
  v_source_timestamp timestamptz;
begin
  for r in
    select * from (values
      ('DEAL-2026-005'::text,'0dddcff8-99d7-4a51-bd23-2ba02b8d8cc3'::uuid,'6d1cac49-e5b6-49f6-8282-9bc37f6e8e97'::uuid,'b291371f-4d6e-4bc5-8aa8-bb801bf90b43'::uuid),
      ('DEAL-2026-006'::text,'f2912b70-df16-4d77-956d-9a247c3823dd'::uuid,'e72308be-3b07-4033-812a-329db4682404'::uuid,'dc2f028e-e57f-4b8e-b410-7e0373461a6d'::uuid)
    ) v(deal_id,proposal_id,conclusion_id,decision_id)
  loop
    select p.payload->'proposed_value',
           jsonb_build_array(
             'OWNER_COMMAND_2026-09-12_FINAL_AUTHORITY_MATERIALIZATION_REVISION',
             'BUSINESS_CHANGE_PROPOSAL:'||p.record_id::text,
             'FINANCE_CONCLUSION:'||c.record_id::text,
             'OPERATIONS_DECISION:'||d.record_id::text
           ),
           greatest(p.created_at,c.created_at,d.created_at)
      into v_schedule,v_source_refs,v_source_timestamp
      from portal_private.ai_coordination_records p
      join portal_private.ai_coordination_records c on c.record_id=r.conclusion_id
      join portal_private.ai_coordination_records d on d.record_id=r.decision_id
     where p.record_id=r.proposal_id
       and p.target_type='DEAL' and p.target_id=r.deal_id
       and c.target_type='DEAL' and c.target_id=r.deal_id
       and d.target_type='DEAL' and d.target_id=r.deal_id;

    if v_schedule is null then
      raise exception using errcode='P0001',message='OWNER_AUTHORIZED_PAYMENT_SCHEDULE_EVIDENCE_MISSING',detail=r.deal_id;
    end if;

    perform portal_private.finance_materialize_payment_schedule(
      r.deal_id,v_schedule,r.proposal_id,r.conclusion_id,r.decision_id,
      v_source_refs,v_source_timestamp,'OWNER_AUTHORIZED_PR461_MIGRATION'
    );
  end loop;
end
$$;

-- DEAL-2026-009 is deliberately not materialized here. Its live Finance reconciliation remains TO_VERIFY.

commit;
