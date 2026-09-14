-- Operations -> Admin price handoff V3.
-- Prevent a repeated silent-success failure where Operations can approve a
-- FUNCTIONAL_CONCLUSION/HANDOFF for a price publication while the Admin price
-- materializer only consumes BUSINESS_CHANGE_PROPOSAL parents.

create or replace function portal_private.guard_operations_price_approval_v3()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, portal_private
as $$
declare
  v_parent portal_private.ai_coordination_records%rowtype;
  v_is_price_target boolean := false;
  v_action text;
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
    raise exception using errcode='P0001', message='OPERATIONS_DECISION_PARENT_NOT_FOUND';
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

  if v_parent.record_type <> 'BUSINESS_CHANGE_PROPOSAL' then
    raise exception using errcode='P0001', message='PRICE_APPROVAL_REQUIRES_BUSINESS_CHANGE_PROPOSAL';
  end if;

  v_action := coalesce(v_parent.payload->>'proposed_action','');
  if v_action not in (
    'CREATE_SUCCESSOR_REVISION_FOR_APPROVAL',
    'CREATE_SUCCESSOR_FOR_ADMIN_APPROVAL',
    'PROPOSE_PRICE_LIST_UPDATE'
  ) then
    raise exception using errcode='P0001', message='PRICE_APPROVAL_PROPOSAL_ACTION_UNSUPPORTED';
  end if;

  if v_action = 'CREATE_SUCCESSOR_REVISION_FOR_APPROVAL' then
    if jsonb_typeof(v_parent.payload->'proposed_state') <> 'object'
       or coalesce(v_parent.payload#>>'{proposed_state,publication_guard}','') <> 'DO_NOT_PUBLISH_BEFORE_ADMIN_APPROVAL'
       or nullif(btrim(v_parent.payload#>>'{proposed_state,successor_publication_id}'),'') is null
       or jsonb_typeof(v_parent.payload#>'{proposed_state,ordered_products}') <> 'array'
       or jsonb_typeof(v_parent.payload#>'{proposed_state,stations}') <> 'array'
       or jsonb_typeof(v_parent.payload#>'{proposed_state,prices}') <> 'object' then
      raise exception using errcode='P0001', message='PRICE_APPROVAL_STRUCTURED_STATE_REQUIRED';
    end if;
  end if;

  return new;
end
$$;

drop trigger if exists trg_guard_operations_price_approval_v3
  on portal_private.ai_coordination_records;

create trigger trg_guard_operations_price_approval_v3
before insert on portal_private.ai_coordination_records
for each row execute function portal_private.guard_operations_price_approval_v3();

revoke all on function portal_private.guard_operations_price_approval_v3() from public;
