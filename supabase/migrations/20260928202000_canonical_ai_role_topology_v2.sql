-- RONA Trade canonical AI role topology V2
-- Owner instruction: ACCOUNTING and EXECUTIVE_DIRECTOR are not separate roles.
-- Their responsibilities belong to FINANCE and OPERATIONS_DIRECTOR respectively.
-- Historical enum labels are retained only for backward-compatible storage/history.
-- No commercial, financial amount, price, payment, deal, client, shipment or legal fact is changed.

update portal_private.ai_role_authority_registry_v2
set lifecycle_state='LEGACY',
    actor_kind='LEGACY_AI',
    ai_materialized=false,
    human_materialized=false,
    staff_materialized=false,
    handoff_target_enabled=false,
    legacy_alias_of=case role_key
      when 'ACCOUNTING' then 'FINANCE'
      when 'EXECUTIVE_DIRECTOR' then 'OPERATIONS_DIRECTOR'
      else legacy_alias_of
    end,
    source_ref='OWNER_INSTRUCTION:2026-09-28:CANONICAL_AI_ROLE_TOPOLOGY_V2',
    updated_at=clock_timestamp()
where role_key in ('ACCOUNTING','EXECUTIVE_DIRECTOR');

update portal_private.ai_role_authority_registry_v2
set source_ref='OWNER_INSTRUCTION:2026-09-28:CANONICAL_AI_ROLE_TOPOLOGY_V2',
    updated_at=clock_timestamp()
where role_key in (
  'OWNER','TREASURY','OPERATIONS_DIRECTOR','FINANCE','LEGAL',
  'COMMERCIAL_DIRECTOR','RAIL_LOGISTICS','SYSTEM_ADMIN','MARKET_ANALYST'
);

-- Client payment proof belongs to the Financial Director, not a nonexistent Accounting role.
update portal_private.client_intake_routing_registry_v1
set responsible_role='FINANCE'::portal_private.staff_functional_role_enum
where policy_key='CLIENT_PAYMENT_PROOF_SUBMIT_V1'
  and responsible_role='ACCOUNTING'::portal_private.staff_functional_role_enum;

create or replace function portal_private.staff_role_for_reverse_event(p_event_type text)
returns portal_private.staff_functional_role_enum
language sql
immutable
set search_path='pg_catalog','portal_private'
as $function$
  select case
    when p_event_type='CLIENT_CLAIM_SUBMIT'
      then 'LEGAL'::portal_private.staff_functional_role_enum
    when p_event_type='CLIENT_PAYMENT_PROOF_SUBMIT'
      then 'FINANCE'::portal_private.staff_functional_role_enum
    else 'OPERATIONS_DIRECTOR'::portal_private.staff_functional_role_enum
  end
$function$;

-- Re-route only nonterminal technical work. Historical terminal records are preserved.
update portal_private.staff_tasks
set assigned_functional_role=case assigned_functional_role::text
      when 'ACCOUNTING' then 'FINANCE'::portal_private.staff_functional_role_enum
      when 'EXECUTIVE_DIRECTOR' then 'OPERATIONS_DIRECTOR'::portal_private.staff_functional_role_enum
      else assigned_functional_role
    end,
    updated_at=clock_timestamp()
where qa_only=false
  and status::text not in ('COMPLETED','CLOSED','REJECTED')
  and assigned_functional_role::text in ('ACCOUNTING','EXECUTIVE_DIRECTOR');

update portal_private.client_intake_v1
set responsible_role='FINANCE'::portal_private.staff_functional_role_enum,
    updated_at=clock_timestamp()
where responsible_role='ACCOUNTING'::portal_private.staff_functional_role_enum
  and routing_state not in ('APPLIED','DEAD_LETTER');

update portal_private.ai_task_dependencies_v1
set depends_on_role=case depends_on_role
      when 'ACCOUNTING' then 'FINANCE'
      when 'EXECUTIVE_DIRECTOR' then 'OPERATIONS_DIRECTOR'
      else depends_on_role
    end,
    source_ref='OWNER_INSTRUCTION:2026-09-28:CANONICAL_AI_ROLE_TOPOLOGY_V2',
    updated_at=clock_timestamp()
where depends_on_role in ('ACCOUNTING','EXECUTIVE_DIRECTOR');

create or replace function portal_private.ai_canonical_role_map_v1(p_role text)
returns text
language sql
immutable
set search_path='pg_catalog'
as $function$
  select case upper(btrim(coalesce(p_role,'')))
    when 'ACCOUNTING' then 'FINANCE'
    when 'EXECUTIVE_DIRECTOR' then 'OPERATIONS_DIRECTOR'
    when 'MARKET_ANALYST' then 'COMMERCIAL_DIRECTOR'
    else upper(btrim(coalesce(p_role,'')))
  end
$function$;

revoke all on function portal_private.ai_canonical_role_map_v1(text)
from public,anon,authenticated,service_role;

create or replace function portal_private.ai_role_routing_contract_v4()
returns jsonb
language sql
stable security definer
set search_path='portal_private','pg_catalog'
as $function$
  with r as (
    select *
    from portal_private.ai_role_authority_registry_v2
    where role_key not in ('ACCOUNTING','EXECUTIVE_DIRECTOR')
    order by role_key
  )
  select jsonb_build_object(
    'contract','RONA_ROLE_ROUTING_CONTRACT_V4',
    'topology_authority','OWNER_INSTRUCTION:2026-09-28:CANONICAL_AI_ROLE_TOPOLOGY_V2',
    'human_actor_rule','ONLY_OWNER_AND_TREASURY_ARE_HUMAN',
    'canonical_ai_roles',jsonb_build_array(
      'FINANCE','OPERATIONS_DIRECTOR','COMMERCIAL_DIRECTOR','LEGAL','RAIL_LOGISTICS','SYSTEM_ADMIN'
    ),
    'nonexistent_roles',jsonb_build_array('ACCOUNTING','EXECUTIVE_DIRECTOR'),
    'compatibility_role_map',jsonb_build_object(
      'ACCOUNTING','FINANCE',
      'EXECUTIVE_DIRECTOR','OPERATIONS_DIRECTOR',
      'MARKET_ANALYST','COMMERCIAL_DIRECTOR'
    ),
    'canonical_commercial_role','COMMERCIAL_DIRECTOR',
    'roles',coalesce((
      select jsonb_agg(jsonb_build_object(
        'role_key',role_key,
        'canonical_role',canonical_role,
        'organizational_title',organizational_title,
        'lifecycle_state',lifecycle_state,
        'actor_kind',actor_kind,
        'ai_materialized',ai_materialized,
        'human_materialized',human_materialized,
        'task_role_materialized',staff_materialized,
        'handoff_target_enabled',handoff_target_enabled,
        'legacy_alias_of',legacy_alias_of,
        'entity_scopes',entity_scopes,
        'source_ref',source_ref,
        'updated_at',updated_at
      ) order by role_key)
      from r
    ),'[]'::jsonb),
    'human_actors',coalesce((
      select jsonb_agg(jsonb_build_object(
        'role',role_key,'title',organizational_title,'materialized',human_materialized
      ) order by role_key)
      from r
      where actor_kind='HUMAN' and lifecycle_state='ACTIVE'
    ),'[]'::jsonb),
    'active_ai_roles',coalesce((
      select jsonb_agg(role_key order by role_key)
      from r
      where actor_kind='AI' and lifecycle_state='ACTIVE' and ai_materialized
    ),'[]'::jsonb),
    'legacy_ai_roles',coalesce((
      select jsonb_agg(role_key order by role_key)
      from r where actor_kind='LEGACY_AI'
    ),'[]'::jsonb),
    'ai_role_gaps','[]'::jsonb,
    'canonical_ai_handoff_targets',coalesce((
      select jsonb_agg(role_key order by role_key)
      from r
      where actor_kind='AI'
        and lifecycle_state='ACTIVE'
        and ai_materialized
        and handoff_target_enabled
    ),'[]'::jsonb),
    'human_escalation_targets',coalesce((
      select jsonb_agg(role_key order by role_key)
      from r
      where actor_kind='HUMAN'
        and lifecycle_state='ACTIVE'
        and human_materialized
    ),'[]'::jsonb),
    'legacy_aliases',coalesce((
      select jsonb_object_agg(role_key,legacy_alias_of order by role_key)
      from r
      where lifecycle_state='LEGACY' and legacy_alias_of is not null
    ),'{}'::jsonb),
    'task_assignment_roles_semantics','TECHNICAL_ROLE_TAXONOMY_NOT_HUMAN_HEADCOUNT'
  )
$function$;

revoke all on function portal_private.ai_role_routing_contract_v4()
from public,anon,authenticated,service_role;

create or replace function portal_private.ai_role_state_current_v5(
  p_role portal_private.ai_business_role_enum,
  p_task_limit integer default 10,
  p_coord_limit integer default 20
)
returns jsonb
language plpgsql
stable security definer
set search_path='portal_private','pg_catalog'
as $function$
declare
  v_state jsonb;
  v_bootstrap jsonb;
  v_routing jsonb;
begin
  v_state:=portal_private.ai_role_state_current_v4(p_role,p_task_limit,p_coord_limit);
  v_routing:=portal_private.ai_role_routing_contract_v4() - 'roles';

  v_bootstrap:=coalesce(v_state->'bootstrap','{}'::jsonb)
    || jsonb_build_object(
      'routing_contract','RONA_ROLE_ROUTING_CONTRACT_V4',
      'canonical_role_topology','OWNER_INSTRUCTION:2026-09-28:CANONICAL_AI_ROLE_TOPOLOGY_V2',
      'nonexistent_roles',jsonb_build_array('ACCOUNTING','EXECUTIVE_DIRECTOR'),
      'full_role_registry_in_current_state',false
    );

  return v_state
    || jsonb_build_object(
      'data_contract','RONA_ROLE_STATE_RECOVERY_V5',
      'routing_capabilities',v_routing,
      'bootstrap',v_bootstrap
    );
end
$function$;

revoke all on function portal_private.ai_role_state_current_v5(
  portal_private.ai_business_role_enum,integer,integer
) from public,anon,authenticated,service_role;

comment on function portal_private.ai_role_routing_contract_v4() is
'Canonical RONA Trade role topology: OWNER/TREASURY human; six operational AI roles; ACCOUNTING and EXECUTIVE_DIRECTOR do not exist as separate roles.';
comment on function portal_private.ai_canonical_role_map_v1(text) is
'Compatibility mapping only. ACCOUNTING -> FINANCE; EXECUTIVE_DIRECTOR -> OPERATIONS_DIRECTOR; MARKET_ANALYST -> COMMERCIAL_DIRECTOR.';
