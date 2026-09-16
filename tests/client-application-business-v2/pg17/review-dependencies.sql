-- Disposable fixture extensions, not a production migration.
-- The old non-application resolver is a sentinel used to prove delegation, not real Finance.
create role service_role;
create type portal_private.ai_business_role_enum as enum
 ('OPERATIONS_DIRECTOR','FINANCE','LEGAL','RAIL_LOGISTICS','MARKET_ANALYST','COMMERCIAL_DIRECTOR');
alter table portal_private.deals add column business_status text default 'EXECUTING';
alter table portal_private.deals add column lifecycle_state text default 'ACTIVE';
create function portal_private.canonical_target_snapshot(p_type text,p_id text) returns jsonb
 language sql stable as $$ select jsonb_build_object('legacy_type',p_type,'legacy_id',p_id) $$;
create function portal_private.ai_role_state_current_v2(p_role portal_private.ai_business_role_enum,p_task_limit integer default 10,p_coord_limit integer default 20)
 returns jsonb language sql stable as $$ select jsonb_build_object('functional_role',p_role::text,'unrelated_sentinel','UNCHANGED') $$;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt()->>'sub','')::uuid $$;
