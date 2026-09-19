-- ONLINE RAIL #644 / C1.1
-- Minimal private Storage substrate for isolated PostgreSQL rehearsal only.
\set ON_ERROR_STOP on

create schema if not exists storage;

create table if not exists storage.buckets (
  id text primary key,
  name text not null unique,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null references storage.buckets(id) on delete restrict,
  name text not null,
  metadata jsonb,
  is_delete_marker boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(bucket_id,name)
);

alter table storage.objects enable row level security;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values (
  'rona-portal-private',
  'rona-portal-private',
  false,
  52428800,
  array['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']::text[]
)
on conflict (id) do update
set name=excluded.name,
    public=excluded.public,
    file_size_limit=excluded.file_size_limit,
    allowed_mime_types=excluded.allowed_mime_types;

select 'C11_STORAGE_SUBSTRATE=PASS' as result;