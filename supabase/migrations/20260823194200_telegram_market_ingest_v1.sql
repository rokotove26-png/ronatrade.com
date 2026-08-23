begin;

create table if not exists portal_private.telegram_market_channels (
  channel_username text primary key,
  channel_role text not null check (channel_role in ('PRIMARY','FALLBACK')),
  priority smallint not null check (priority between 1 and 100),
  enabled boolean not null default true,
  allow_pdf boolean not null default true,
  allow_images boolean not null default true,
  last_message_id bigint,
  last_successful_ingest_at timestamptz,
  last_attempt_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (channel_username ~ '^[A-Za-z0-9_]{5,64}$')
);

insert into portal_private.telegram_market_channels(channel_username,channel_role,priority,enabled,allow_pdf,allow_images)
values
  ('platts_digits','PRIMARY',1,true,true,true),
  ('Samantahlil','FALLBACK',2,true,true,true)
on conflict (channel_username) do update
set channel_role=excluded.channel_role,
    priority=excluded.priority,
    enabled=excluded.enabled,
    allow_pdf=excluded.allow_pdf,
    allow_images=excluded.allow_images,
    updated_at=now();

create table if not exists portal_private.telegram_market_documents (
  id uuid primary key default gen_random_uuid(),
  channel_username text not null references portal_private.telegram_market_channels(channel_username),
  channel_priority smallint not null check (channel_priority between 1 and 100),
  message_id bigint not null,
  message_timestamp timestamptz not null,
  source_url text not null,
  telegram_caption text,
  file_name text not null,
  file_size bigint not null check (file_size > 0 and file_size <= 67108864),
  mime_type text not null,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  storage_bucket text not null default 'market-source-private',
  storage_path text not null,
  extraction_state text not null default 'PENDING' check (extraction_state in ('PENDING','TEXT_EXTRACTED','TEXT_AND_TABLES_EXTRACTED','BINARY_ONLY','FAILED')),
  extracted_text text,
  extracted_tables jsonb not null default '[]'::jsonb,
  extraction_note text,
  ingest_source text not null default 'TELEGRAM_MTPROTO' check (ingest_source in ('TELEGRAM_MTPROTO','TELEGRAM_PUBLIC_PREVIEW')),
  ingested_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(channel_username,message_id,sha256)
);

create index if not exists telegram_market_documents_sha256_idx
  on portal_private.telegram_market_documents(sha256);
create index if not exists telegram_market_documents_message_time_idx
  on portal_private.telegram_market_documents(message_timestamp desc);
create index if not exists telegram_market_documents_channel_time_idx
  on portal_private.telegram_market_documents(channel_priority,channel_username,message_timestamp desc);

create table if not exists portal_private.telegram_market_ingest_runs (
  run_id uuid primary key default gen_random_uuid(),
  source text not null default 'GITHUB_ACTIONS_MTPROTO',
  run_key text not null unique,
  status text not null check (status in ('STARTED','SUCCESS','PARTIAL','FAILED','BLOCKED')),
  channels jsonb not null default '[]'::jsonb,
  scanned_messages integer not null default 0 check (scanned_messages >= 0),
  accepted_files integer not null default 0 check (accepted_files >= 0),
  duplicate_files integer not null default 0 check (duplicate_files >= 0),
  failed_files integer not null default 0 check (failed_files >= 0),
  error_code text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into storage.buckets(id,name,public)
values ('market-source-private','market-source-private',false)
on conflict (id) do update set public=false;

revoke all on portal_private.telegram_market_channels from anon, authenticated;
revoke all on portal_private.telegram_market_documents from anon, authenticated;
revoke all on portal_private.telegram_market_ingest_runs from anon, authenticated;

comment on table portal_private.telegram_market_documents is
  'Read-only Telegram market-source archive for Commercial Director analytics. Original files remain private and are never client-published by this table.';
comment on column portal_private.telegram_market_documents.sha256 is
  'Server-verified SHA-256 of the original Telegram binary.';
comment on column portal_private.telegram_market_documents.ingest_source is
  'Protocol/source class. TELEGRAM_MTPROTO is the production binary-ingest path.';

commit;
