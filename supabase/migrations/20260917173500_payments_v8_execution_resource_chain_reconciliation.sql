-- PAYMENTS V8 execution resource-chain reconciliation.
-- Finance remains the controlling authority; this migration creates a derived,
-- fail-closed execution layer and never mutates payments or Finance authority.

create table if not exists portal_private.deal_execution_resource_authority_v8 (
  id uuid primary key default gen_random_uuid(),
  deal_key uuid not null,
  finance_authority_id uuid not null,
  actual_spend numeric(24,8) not null,
  execution_currency char(3) not null,
  authority_state text not null default 'AUTHORITATIVE',
  lifecycle_state text not null default 'CURRENT',
  source_locked boolean not null default true,
  source_priority text not null default 'FINANCE_FUNDING_SIDE_AUTHORITY',
  source_version text not null,
  source_timestamp timestamptz not null,
  source_refs jsonb not null default '[]'::jsonb,
  supersedes_id uuid null references portal_private.deal_execution_resource_authority_v8(id),
  created_at timestamptz not null default clock_timestamp(),
  constraint deal_execution_resource_authority_v8_amount_ck check (actual_spend >= 0),
  constraint deal_execution_resource_authority_v8_authority_ck check (authority_state in ('AUTHORITATIVE','TO_VERIFY')),
  constraint deal_execution_resource_authority_v8_lifecycle_ck check (lifecycle_state in ('CURRENT','SUPERSEDED')),
  constraint deal_execution_resource_authority_v8_source_locked_ck check (source_locked = true),
  constraint deal_execution_resource_authority_v8_finance_uq unique (finance_authority_id)
);
create unique index if not exists deal_execution_resource_authority_v8_one_current_per_deal
  on portal_private.deal_execution_resource_authority_v8(deal_key) where lifecycle_state='CURRENT';

create table if not exists portal_private.deal_execution_passport_allocations_v8 (
  id uuid primary key default gen_random_uuid(),
  deal_key uuid not null,
  execution_authority_id uuid not null references portal_private.deal_execution_resource_authority_v8(id),
  finance_authority_id uuid not null,
  allocated_amount numeric(24,8) not null,
  funding_currency char(3) not null,
  authority_state text not null default 'AUTHORITATIVE',
  lifecycle_state text not null default 'CURRENT',
  source_locked boolean not null default true,
  allocation_basis text not null default 'FINANCE_TERMINAL_EXECUTION_AUTHORITY',
  source_version text not null,
  source_timestamp timestamptz not null,
  source_refs jsonb not null default '[]'::jsonb,
  supersedes_id uuid null references portal_private.deal_execution_passport_allocations_v8(id),
  created_at timestamptz not null default clock_timestamp(),
  constraint deal_execution_passport_allocations_v8_amount_ck check (allocated_amount >= 0),
  constraint deal_execution_passport_allocations_v8_authority_ck check (authority_state in ('AUTHORITATIVE','TO_VERIFY')),
  constraint deal_execution_passport_allocations_v8_lifecycle_ck check (lifecycle_state in ('CURRENT','SUPERSEDED')),
  constraint deal_execution_passport_allocations_v8_source_locked_ck check (source_locked = true),
  constraint deal_execution_passport_allocations_v8_finance_uq unique (finance_authority_id)
);
create unique index if not exists deal_execution_passport_allocations_v8_one_current_per_deal
  on portal_private.deal_execution_passport_allocations_v8(deal_key) where lifecycle_state='CURRENT';

create or replace function portal_private.refresh_deal_execution_resource_authority_v8(p_deal_key uuid default null)
returns jsonb language plpgsql security definer
set search_path = portal_private, public, pg_temp
as $$
declare
  r record; v_old_exec uuid; v_old_pass uuid; v_exec uuid; v_pass uuid;
  v_count int := 0; v_fail jsonb := '[]'::jsonb;
begin
  perform pg_advisory_xact_lock(hashtext('payments_v8_execution_resource_authority'));
  for r in
    with active_deals as (
      select d.id deal_key,d.deal_id from portal_private.deals d
      where d.lifecycle_state::text='ACTIVE' and d.closed_at is null
        and (p_deal_key is null or d.id=p_deal_key)
    ), terminal as (
      select ad.deal_key,ad.deal_id,a.*,count(*) over(partition by ad.deal_key) terminal_count
      from active_deals ad
      join portal_private.deal_finance_authority_payments_v8_read_v1 a on a.deal_key=ad.deal_key
      where a.is_terminal=true and a.authority_state='AUTHORITATIVE' and a.lifecycle_state='CURRENT'
    ) select * from terminal order by deal_id
  loop
    if r.terminal_count<>1 or r.actual_spend_status<>'AUTHORITATIVE'
       or r.execution_currency is null or r.actual_spend is null or r.source_locked is distinct from true then
      v_fail:=v_fail||jsonb_build_array(jsonb_build_object('deal_id',r.deal_id,'code','FINANCE_EXECUTION_AUTHORITY_NOT_EXACT'));
      continue;
    end if;
    select id into v_exec from portal_private.deal_execution_resource_authority_v8 where finance_authority_id=r.id;
    if v_exec is null then
      select id into v_old_exec from portal_private.deal_execution_resource_authority_v8
       where deal_key=r.deal_key and lifecycle_state='CURRENT' limit 1 for update;
      if v_old_exec is not null then
        update portal_private.deal_execution_resource_authority_v8 set lifecycle_state='SUPERSEDED' where id=v_old_exec;
      end if;
      insert into portal_private.deal_execution_resource_authority_v8(
        deal_key,finance_authority_id,actual_spend,execution_currency,authority_state,lifecycle_state,
        source_locked,source_priority,source_version,source_timestamp,source_refs,supersedes_id)
      values(r.deal_key,r.id,r.actual_spend,r.execution_currency,'AUTHORITATIVE','CURRENT',true,
        'FINANCE_FUNDING_SIDE_AUTHORITY','PAYMENTS_V8_EXECUTION_RESOURCE_CHAIN_V1',r.source_timestamp,
        coalesce(r.source_refs,'[]'::jsonb)||jsonb_build_array(
          jsonb_build_object('source_type','FINANCE_AUTHORITY','source_id',r.id::text),
          jsonb_build_object('source_type','FINANCE_POLICY','source_id','PRIMARY_FUNDING_SIDE_AUTHORITY')),v_old_exec)
      returning id into v_exec;
    else
      update portal_private.deal_execution_resource_authority_v8 set lifecycle_state='SUPERSEDED'
       where deal_key=r.deal_key and lifecycle_state='CURRENT' and id<>v_exec;
      update portal_private.deal_execution_resource_authority_v8 set lifecycle_state='CURRENT' where id=v_exec;
    end if;
    select id into v_pass from portal_private.deal_execution_passport_allocations_v8 where finance_authority_id=r.id;
    if v_pass is null then
      select id into v_old_pass from portal_private.deal_execution_passport_allocations_v8
       where deal_key=r.deal_key and lifecycle_state='CURRENT' limit 1 for update;
      if v_old_pass is not null then
        update portal_private.deal_execution_passport_allocations_v8 set lifecycle_state='SUPERSEDED' where id=v_old_pass;
      end if;
      insert into portal_private.deal_execution_passport_allocations_v8(
        deal_key,execution_authority_id,finance_authority_id,allocated_amount,funding_currency,
        authority_state,lifecycle_state,source_locked,allocation_basis,source_version,source_timestamp,source_refs,supersedes_id)
      select r.deal_key,v_exec,r.id,r.actual_spend,r.execution_currency,'AUTHORITATIVE','CURRENT',true,
        'FINANCE_TERMINAL_EXECUTION_AUTHORITY','PAYMENTS_V8_EXECUTION_PASSPORT_V1',r.source_timestamp,e.source_refs,v_old_pass
      from portal_private.deal_execution_resource_authority_v8 e where e.id=v_exec returning id into v_pass;
    else
      update portal_private.deal_execution_passport_allocations_v8 set lifecycle_state='SUPERSEDED'
       where deal_key=r.deal_key and lifecycle_state='CURRENT' and id<>v_pass;
      update portal_private.deal_execution_passport_allocations_v8 set lifecycle_state='CURRENT' where id=v_pass;
    end if;
    v_count:=v_count+1;
  end loop;
  if p_deal_key is null then
    with missing as (
      select d.deal_id from portal_private.deals d
      where d.lifecycle_state::text='ACTIVE' and d.closed_at is null
        and not exists(select 1 from portal_private.deal_execution_resource_authority_v8 e
          where e.deal_key=d.id and e.lifecycle_state='CURRENT' and e.authority_state='AUTHORITATIVE'))
    select coalesce(v_fail||jsonb_agg(jsonb_build_object('deal_id',deal_id,'code','EXECUTION_AUTHORITY_MISSING')),'[]'::jsonb)
      into v_fail from missing;
  end if;
  if jsonb_array_length(coalesce(v_fail,'[]'::jsonb))>0 then
    return jsonb_build_object('status','FAIL_CLOSED','refreshed',v_count,'failures',v_fail);
  end if;
  return jsonb_build_object('status','PASS','refreshed',v_count,'failures','[]'::jsonb);
end $$;

create or replace view portal_private.payment_resource_chains_effective_v8 as
select c.*,
  case when exists(select 1 from portal_private.payment_resource_chains_v7 child where child.supersedes_id=c.id)
         then 'SUPERSEDED'
       when exists(select 1 from portal_private.deal_execution_resource_authority_v8 e
         where e.deal_key=c.deal_key and e.lifecycle_state='CURRENT' and e.authority_state='AUTHORITATIVE')
         then 'SUPERSEDED_FOR_EXECUTION'
       else c.lifecycle_state end as effective_lifecycle_state,
  case when exists(select 1 from portal_private.payment_resource_chains_v7 child where child.supersedes_id=c.id) then false
       when exists(select 1 from portal_private.deal_execution_resource_authority_v8 e
         where e.deal_key=c.deal_key and e.lifecycle_state='CURRENT' and e.authority_state='AUTHORITATIVE') then false
       else c.authority_state='AUTHORITATIVE' and c.lifecycle_state='CURRENT' and c.source_locked=true end
       as is_effective_execution_authority,
  'SECONDARY_PAYMENT_PROVENANCE'::text as execution_role
from portal_private.payment_resource_chains_v7 c;

create or replace view portal_private.deal_execution_reconciliation_v8 as
with active_deals as (
  select id deal_key,deal_id from portal_private.deals where lifecycle_state::text='ACTIVE' and closed_at is null
), f as (
  select ad.deal_key,ad.deal_id,a.id finance_authority_id,a.actual_spend finance_actual_spend,
    a.execution_currency finance_currency,a.actual_spend_status,a.source_locked finance_source_locked,
    count(*) over(partition by ad.deal_key) terminal_finance_count
  from active_deals ad left join portal_private.deal_finance_authority_payments_v8_read_v1 a
   on a.deal_key=ad.deal_key and a.is_terminal=true and a.authority_state='AUTHORITATIVE' and a.lifecycle_state='CURRENT'
), e as (
  select deal_key,id execution_authority_id,finance_authority_id,actual_spend execution_actual_spend,
    execution_currency,source_locked execution_source_locked,count(*) over(partition by deal_key) current_execution_count
  from portal_private.deal_execution_resource_authority_v8 where lifecycle_state='CURRENT' and authority_state='AUTHORITATIVE'
), p as (
  select deal_key,id passport_allocation_id,finance_authority_id,allocated_amount passport_amount,
    funding_currency passport_currency,source_locked passport_source_locked,count(*) over(partition by deal_key) current_passport_count
  from portal_private.deal_execution_passport_allocations_v8 where lifecycle_state='CURRENT' and authority_state='AUTHORITATIVE'
), dup_v7 as (
  select deal_key,count(*) duplicate_current_rows from (
    select c.deal_key,c.payment_key from portal_private.payment_resource_chains_v7 c
    where c.authority_state='AUTHORITATIVE' and c.lifecycle_state='CURRENT'
    group by c.deal_key,c.payment_key having count(*)>1) q group by deal_key
)
select f.deal_id,f.deal_key,f.finance_authority_id,e.execution_authority_id,p.passport_allocation_id,
 f.finance_actual_spend,e.execution_actual_spend,p.passport_amount,f.finance_currency,e.execution_currency,p.passport_currency,
 coalesce(f.terminal_finance_count,0) terminal_finance_count,coalesce(e.current_execution_count,0) current_execution_count,
 coalesce(p.current_passport_count,0) current_passport_count,coalesce(dup_v7.duplicate_current_rows,0) physical_v7_duplicate_current_pairs,
 case when coalesce(f.terminal_finance_count,0)<>1 then 'FAIL_CLOSED:FINANCE_TERMINAL_CARDINALITY'
      when f.actual_spend_status<>'AUTHORITATIVE' or f.finance_source_locked is distinct from true then 'FAIL_CLOSED:FINANCE_NOT_AUTHORITATIVE'
      when coalesce(e.current_execution_count,0)<>1 then 'FAIL_CLOSED:EXECUTION_CARDINALITY'
      when coalesce(p.current_passport_count,0)<>1 then 'FAIL_CLOSED:PASSPORT_CARDINALITY'
      when e.finance_authority_id is distinct from f.finance_authority_id then 'FAIL_CLOSED:EXECUTION_FINANCE_PROVENANCE_MISMATCH'
      when p.finance_authority_id is distinct from f.finance_authority_id then 'FAIL_CLOSED:PASSPORT_FINANCE_PROVENANCE_MISMATCH'
      when e.execution_source_locked is distinct from true or p.passport_source_locked is distinct from true then 'FAIL_CLOSED:SOURCE_UNLOCKED'
      when e.execution_currency is distinct from f.finance_currency or p.passport_currency is distinct from f.finance_currency then 'FAIL_CLOSED:CURRENCY_MISMATCH'
      when e.execution_actual_spend is distinct from f.finance_actual_spend then 'FAIL_CLOSED:EXECUTION_AMOUNT_MISMATCH'
      when p.passport_amount is distinct from f.finance_actual_spend then 'FAIL_CLOSED:PASSPORT_AMOUNT_MISMATCH'
      else 'PASS' end reconciliation_status
from f left join e using(deal_key) left join p using(deal_key) left join dup_v7 using(deal_key);

create or replace function portal_private.assert_deal_execution_reconciliation_v8()
returns jsonb language plpgsql security definer set search_path=portal_private,public,pg_temp as $$
declare v_bad jsonb; v_total int; v_refresh jsonb;
begin
  v_refresh:=portal_private.refresh_deal_execution_resource_authority_v8(null);
  if v_refresh->>'status'<>'PASS' then return v_refresh; end if;
  select count(*) into v_total from portal_private.deal_execution_reconciliation_v8;
  select coalesce(jsonb_agg(to_jsonb(r) order by r.deal_id),'[]'::jsonb) into v_bad
    from portal_private.deal_execution_reconciliation_v8 r where r.reconciliation_status<>'PASS';
  if jsonb_array_length(v_bad)>0 then
    return jsonb_build_object('status','FAIL_CLOSED','active_deals',v_total,'failures',v_bad);
  end if;
  return jsonb_build_object('status','PASS','active_deals',v_total,'failures','[]'::jsonb);
end $$;

create or replace function portal_private.sync_deal_execution_resource_authority_v8_trigger()
returns trigger language plpgsql security definer set search_path=portal_private,public,pg_temp as $$
begin
  perform portal_private.refresh_deal_execution_resource_authority_v8(new.deal_key);
  return new;
end $$;

drop trigger if exists deal_execution_resource_authority_v8_sync on portal_private.deal_finance_authority_v7;
create trigger deal_execution_resource_authority_v8_sync after insert on portal_private.deal_finance_authority_v7
for each row execute function portal_private.sync_deal_execution_resource_authority_v8_trigger();

revoke all on portal_private.deal_execution_resource_authority_v8 from public,anon,authenticated;
revoke all on portal_private.deal_execution_passport_allocations_v8 from public,anon,authenticated;
revoke all on portal_private.payment_resource_chains_effective_v8 from public,anon,authenticated;
revoke all on portal_private.deal_execution_reconciliation_v8 from public,anon,authenticated;
revoke all on function portal_private.refresh_deal_execution_resource_authority_v8(uuid) from public,anon,authenticated;
revoke all on function portal_private.assert_deal_execution_reconciliation_v8() from public,anon,authenticated;

select portal_private.refresh_deal_execution_resource_authority_v8(null);
