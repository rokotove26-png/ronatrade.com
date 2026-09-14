-- Keep historical source metadata from changing the control semantics of a new successor.
-- The source lineage is preserved, but stale block/correction flags must not be inherited
-- as live top-level metadata on a newly approved source-handoff publication.

create or replace function portal_private.sanitize_price_source_handoff_metadata_v1()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'portal_private'
as $function$
begin
  if coalesce(new.source_system,'')='OPERATIONS_DIRECTOR_SOURCE_HANDOFF' then
    new.metadata := coalesce(new.metadata,'{}'::jsonb)
      - 'stage'
      - 'corrected_by'
      - 'correction_reason'
      - 'owner_decision_freeze'
      - 'blocked_from_publication'
      - 'owner_instruction';
  end if;
  return new;
end
$function$;

drop trigger if exists trg_sanitize_price_source_handoff_metadata_v1 on portal_private.publications;
create trigger trg_sanitize_price_source_handoff_metadata_v1
before insert or update of metadata,source_system on portal_private.publications
for each row execute function portal_private.sanitize_price_source_handoff_metadata_v1();

revoke all on function portal_private.sanitize_price_source_handoff_metadata_v1() from public,anon,authenticated;
