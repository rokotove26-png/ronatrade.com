alter table portal_private.mcp_oauth_authorization_requests
  add column if not exists owner_portal_user_id uuid references portal_private.portal_users(id),
  add column if not exists completion_nonce_hash text,
  add column if not exists completion_expires_at timestamptz,
  add column if not exists completion_used_at timestamptz;

create unique index if not exists mcp_oauth_authorization_requests_completion_nonce_uidx
  on portal_private.mcp_oauth_authorization_requests(completion_nonce_hash)
  where completion_nonce_hash is not null;

create index if not exists mcp_oauth_authorization_requests_completion_lookup_idx
  on portal_private.mcp_oauth_authorization_requests(server_slug, functional_role, completion_nonce_hash, completion_expires_at)
  where completion_nonce_hash is not null and completion_used_at is null;

create table if not exists portal_private.mcp_oauth_authorize_trace (
  event_id uuid primary key default gen_random_uuid(),
  event_at timestamptz not null default now(),
  server_slug text not null,
  functional_role portal_private.ai_business_role_enum not null,
  phase text not null,
  request_id uuid,
  correlation_hash text,
  request_method text not null,
  origin text,
  sec_fetch_site text,
  sec_fetch_mode text,
  sec_fetch_dest text,
  referer_host text,
  referer_path text,
  user_agent_family text,
  upstream_status integer,
  returned_public_status integer,
  callback_host text,
  callback_path text,
  has_location boolean,
  has_code boolean,
  state_match boolean,
  result text not null,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists mcp_oauth_authorize_trace_request_idx
  on portal_private.mcp_oauth_authorize_trace(request_id, event_at desc);

create index if not exists mcp_oauth_authorize_trace_correlation_idx
  on portal_private.mcp_oauth_authorize_trace(correlation_hash, event_at desc)
  where correlation_hash is not null;

revoke all on table portal_private.mcp_oauth_authorize_trace from anon, authenticated, public;
