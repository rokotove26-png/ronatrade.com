-- Atomic acknowledgement for Operations -> Admin price handoff.
-- The Operations decision must not commit successfully unless the synchronous
-- materializers have produced the exact Admin queue state consumed by the
-- current Prices UI. This makes "APPROVE_FOR_NEXT_STAGE" fail closed instead
-- of reporting a false successful handoff.

create or replace function portal_private.assert_operations_price_admin_queue_v3()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, portal_private
as $$
declare
  v_parent portal_private.ai_coordination_records%rowtype;
  v_is_price_target boolean := false;
  v_queue_status text;
begin
  if new.record_type <> 'OPERATIONS_INTERNAL_DECISION'
     or new.functional_role::text <> 'OPERATIONS_DIRECTOR'
     or new.status <> 'APPROVE_FOR_NEXT_STAGE'
     or new.parent_record_id is null then
    return new;
  end if;

  select * into v_parent
  from portal_private.ai_coordination_records
  where record_id = new.parent_record_id;

  if not found then
    return new;
  end if;

  v_is_price_target :=
       coalesce(v_parent.target_type,'') in ('PRICE','PRICE_LIST')
       or (
         coalesce(v_parent.target_type,'') = 'PUBLICATION'
         and exists (
           select 1
           from portal_private.publications p
           where p.publication_id = v_parent.target_id
             and p.publication_type::text = 'PRICE'
         )
       );

  if not v_is_price_target then
    return new;
  end if;

  select p.proposal_status into v_queue_status
  from portal_private.owner_price_change_proposals p
  where p.coordination_record_id = new.parent_record_id
  order by p.created_at desc
  limit 1;

  if v_queue_status is distinct from 'UPDATE_AVAILABLE' then
    raise exception using
      errcode='P0001',
      message='PRICE_ADMIN_QUEUE_MATERIALIZATION_FAILED',
      detail=coalesce(v_queue_status,'NO_QUEUE_RECORD');
  end if;

  return new;
end
$$;

drop trigger if exists trg_zz_operations_price_admin_queue_assert_v3
  on portal_private.ai_coordination_records;

create trigger trg_zz_operations_price_admin_queue_assert_v3
after insert on portal_private.ai_coordination_records
for each row execute function portal_private.assert_operations_price_admin_queue_v3();

revoke all on function portal_private.assert_operations_price_admin_queue_v3() from public;
