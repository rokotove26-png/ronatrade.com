-- RONA Trade / Stage D.1 document standard v2 — non-destructive rollback
-- Preserve v2 and asset provenance for audit; restore v1 as production-active.

do $do$
begin
  update portal_private.owner_canonical_document_standards
     set status='RETIRED',updated_at=clock_timestamp()
   where standard_key='RONA-DOC-STANDARD'
     and version=2
     and status='ACTIVE';

  update portal_private.owner_canonical_document_standards
     set status='ACTIVE',updated_at=clock_timestamp()
   where standard_key='RONA-DOC-STANDARD'
     and version=1;

  update portal_private.owner_canonical_document_assets a
     set status='RETIRED',updated_at=clock_timestamp()
   where exists(
     select 1
     from portal_private.owner_canonical_document_asset_manifest_v2 m
     where m.asset_key=a.asset_key
       and m.version=a.version
       and m.required_for_standard=true
   )
     and a.status='ACTIVE';
end
$do$;

comment on table portal_private.owner_canonical_document_asset_manifest_v2 is
'Stage D.1 source-lock manifest retained after rollback for audit. Canonical asset bytes remain retained but inactive.';
