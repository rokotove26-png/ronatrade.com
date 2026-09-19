-- ONLINE RAIL #644 / C1.1 source registry execution matrix.
\set ON_ERROR_STOP on

create temporary table c11_results(
  test_name text primary key,
  result text not null,
  detail jsonb not null default '{}'::jsonb
);

insert into storage.objects(bucket_id,name,metadata)
values
('rona-portal-private','rail/source/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/original.xlsx','{"qa":"sha-a"}'::jsonb),
('rona-portal-private','rail/source/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb/original.xlsx','{"qa":"sha-b"}'::jsonb)
on conflict do nothing;

set role service_role;
select portal_private.rail_xlsx_source_capture_register_v1(
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  'first-name.xlsx',100,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '2026-09-19T00:00:00Z','rona-portal-private',
  'rail/source/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/original.xlsx',
  'CHATGPT_FILE:file-a-1','AI-RAIL-LOGISTICS','c11-qa-client',
  '10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002',
  '1111111111111111111111111111111111111111111111111111111111111111'
) as first_capture \gset c11_first_
reset role;

insert into c11_results values (
  'same-bytes-first-capture',
  case when :'c11_first_first_capture'::jsonb->>'outcome'='CAPTURED_NEW_SOURCE' then 'PASS' else 'FAIL' end,
  :'c11_first_first_capture'::jsonb
);

set role service_role;
select portal_private.rail_xlsx_source_capture_register_v1(
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  'renamed-copy.xlsx',100,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '2026-09-19T00:01:00Z','rona-portal-private',
  'rail/source/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/original.xlsx',
  'CHATGPT_FILE:file-a-2','AI-RAIL-LOGISTICS','c11-qa-client',
  '10000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000004',
  '2222222222222222222222222222222222222222222222222222222222222222'
) as duplicate_capture \gset c11_dup_
reset role;

insert into c11_results values (
  'same-bytes-different-filename-one-source',
  case when
    :'c11_dup_duplicate_capture'::jsonb->>'outcome'='DUPLICATE_FILE'
    and :'c11_dup_duplicate_capture'::jsonb->>'sourceObjectId'=:'c11_first_first_capture'::jsonb->>'sourceObjectId'
    and :'c11_dup_duplicate_capture'::jsonb->>'importBatchId'=:'c11_first_first_capture'::jsonb->>'importBatchId'
    and (select count(*) from portal_private.source_objects where lower(checksum_sha256)=repeat('a',64))=1
    and (select count(*) from portal_private.rail_xlsx_source_receipts_v1 where canonical_sha256=repeat('a',64))=2
  then 'PASS' else 'FAIL' end,
  :'c11_dup_duplicate_capture'::jsonb
);

set role service_role;
select portal_private.rail_xlsx_source_capture_register_v1(
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  'first-name.xlsx',100,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '2026-09-19T00:00:00Z','rona-portal-private',
  'rail/source/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/original.xlsx',
  'CHATGPT_FILE:file-a-1','AI-RAIL-LOGISTICS','c11-qa-client',
  '10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002',
  '1111111111111111111111111111111111111111111111111111111111111111'
) as replay_capture \gset c11_replay_
reset role;

insert into c11_results values (
  'capture-idempotent-replay',
  case when
    :'c11_replay_replay_capture'::jsonb->>'outcome'='IDEMPOTENT_REPLAY'
    and :'c11_replay_replay_capture'::jsonb->>'receiptId'=:'c11_first_first_capture'::jsonb->>'receiptId'
    and (select count(*) from portal_private.rail_xlsx_source_receipts_v1 where canonical_sha256=repeat('a',64))=2
  then 'PASS' else 'FAIL' end,
  :'c11_replay_replay_capture'::jsonb
);

set role service_role;
select portal_private.rail_xlsx_source_capture_register_v1(
  'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  'first-name.xlsx',101,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '2026-09-19T00:02:00Z','rona-portal-private',
  'rail/source/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb/original.xlsx',
  'CHATGPT_FILE:file-b-1','AI-RAIL-LOGISTICS','c11-qa-client',
  '10000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000006',
  '3333333333333333333333333333333333333333333333333333333333333333'
) as different_bytes \gset c11_diff_
reset role;

insert into c11_results values (
  'different-bytes-same-filename-distinct-source',
  case when
    :'c11_diff_different_bytes'::jsonb->>'outcome'='CAPTURED_NEW_SOURCE'
    and :'c11_diff_different_bytes'::jsonb->>'sourceObjectId'<>:'c11_first_first_capture'::jsonb->>'sourceObjectId'
    and (select count(*) from portal_private.source_objects where source_system='RAIL_AI' and source_object_type='XLSX_WAGON_DISLOCATION')=2
  then 'PASS' else 'FAIL' end,
  :'c11_diff_different_bytes'::jsonb
);

insert into c11_results values (
  'provenance-receipts-preserve-filenames',
  case when
    (select count(distinct original_filename) from portal_private.rail_xlsx_source_receipts_v1 where canonical_sha256=repeat('a',64))=2
    and (select private_key from portal_private.rail_xlsx_source_receipts_v1 where canonical_sha256=repeat('a',64) order by created_at,id limit 1)
        ='rail/source/'||repeat('a',64)||'/original.xlsx'
  then 'PASS' else 'FAIL' end,
  jsonb_build_object('sha',repeat('a',64))
);

do $$
begin
  begin
    perform portal_private.rail_xlsx_source_capture_register_v1(
      repeat('a',64),'bad-key.xlsx',100,null,now(),'rona-portal-private','rail/source/not-the-sha/original.xlsx',
      'CHATGPT_FILE:bad-key','AI-RAIL-LOGISTICS','c11-qa-client',gen_random_uuid(),gen_random_uuid(),repeat('4',64));
    raise exception 'C11_EXPECTED_REJECTION_MISSING';
  exception when others then
    if sqlerrm not like '%RAIL_XLSX_CAPTURE_STORAGE_KEY_INVALID%' then raise; end if;
  end;
end $$;
insert into c11_results values ('wrong-storage-key-rejected','PASS','{}');

do $$
begin
  begin
    perform portal_private.rail_xlsx_source_capture_register_v1(
      repeat('c',64),'missing.xlsx',100,null,now(),'rona-portal-private','rail/source/'||repeat('c',64)||'/original.xlsx',
      'CHATGPT_FILE:missing','AI-RAIL-LOGISTICS','c11-qa-client',gen_random_uuid(),gen_random_uuid(),repeat('5',64));
    raise exception 'C11_EXPECTED_REJECTION_MISSING';
  exception when others then
    if sqlerrm not like '%RAIL_XLSX_CAPTURE_STORAGE_OBJECT_NOT_FOUND%' then raise; end if;
  end;
end $$;
insert into c11_results values ('missing-storage-object-rejected','PASS','{}');

do $$
begin
  begin
    perform portal_private.rail_xlsx_source_capture_register_v1(
      repeat('a',64),'identity.xlsx',100,null,now(),'rona-portal-private','rail/source/'||repeat('a',64)||'/original.xlsx',
      'CHATGPT_FILE:bad-identity','AI-FINANCE','c11-qa-client',gen_random_uuid(),gen_random_uuid(),repeat('6',64));
    raise exception 'C11_EXPECTED_REJECTION_MISSING';
  exception when others then
    if sqlerrm not like '%RAIL_XLSX_CAPTURE_IDENTITY_DENIED%' then raise; end if;
  end;
end $$;
insert into c11_results values ('wrong-role-identity-rejected','PASS','{}');

do $$
declare v_id uuid;
begin
  select id into v_id from portal_private.rail_xlsx_source_receipts_v1 order by created_at,id limit 1;
  begin
    update portal_private.rail_xlsx_source_receipts_v1 set original_filename=original_filename where id=v_id;
    raise exception 'C11_EXPECTED_APPEND_ONLY_REJECTION_MISSING';
  exception when others then
    if sqlerrm not like '%RAIL_XLSX_APPEND_ONLY%' then raise; end if;
  end;
  begin
    delete from portal_private.rail_xlsx_source_receipts_v1 where id=v_id;
    raise exception 'C11_EXPECTED_APPEND_ONLY_REJECTION_MISSING';
  exception when others then
    if sqlerrm not like '%RAIL_XLSX_APPEND_ONLY%' then raise; end if;
  end;
end $$;
insert into c11_results values ('receipt-update-delete-append-only','PASS','{}');

set role service_role;
do $$
begin
  begin
    insert into portal_private.rail_xlsx_source_receipts_v1 default values;
    raise exception 'C11_DIRECT_INSERT_UNEXPECTEDLY_ALLOWED';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
insert into c11_results values ('service-role-direct-receipt-insert-rejected','PASS','{}');

set role authenticated;
do $$
begin
  begin
    insert into portal_private.rail_xlsx_source_receipts_v1 default values;
    raise exception 'C11_DIRECT_INSERT_UNEXPECTEDLY_ALLOWED';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
insert into c11_results values ('authenticated-direct-receipt-insert-rejected','PASS','{}');

set role anon;
do $$
begin
  begin
    insert into portal_private.rail_xlsx_source_receipts_v1 default values;
    raise exception 'C11_DIRECT_INSERT_UNEXPECTEDLY_ALLOWED';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
insert into c11_results values ('anon-direct-receipt-insert-rejected','PASS','{}');

insert into c11_results values (
  'grants-surface',
  case when
    has_function_privilege('service_role','portal_private.rail_xlsx_source_capture_register_v1(text,text,bigint,text,timestamp with time zone,text,text,text,text,text,uuid,uuid,text)','EXECUTE')
    and not has_function_privilege('authenticated','portal_private.rail_xlsx_source_capture_register_v1(text,text,bigint,text,timestamp with time zone,text,text,text,text,text,uuid,uuid,text)','EXECUTE')
    and not has_function_privilege('anon','portal_private.rail_xlsx_source_capture_register_v1(text,text,bigint,text,timestamp with time zone,text,text,text,text,text,uuid,uuid,text)','EXECUTE')
    and not has_table_privilege('service_role','portal_private.rail_xlsx_source_receipts_v1','INSERT')
  then 'PASS' else 'FAIL' end,
  '{}'::jsonb
);

insert into c11_results values (
  'no-business-facts-created',
  case when (select count(*) from portal_private.deals)=0 and (select count(*) from portal_private.rail_wagons)=0 then 'PASS' else 'FAIL' end,
  jsonb_build_object('deals',(select count(*) from portal_private.deals),'rail_wagons',(select count(*) from portal_private.rail_wagons))
);

do $$
begin
  if exists(select 1 from c11_results where result<>'PASS') then
    raise exception 'C11_SOURCE_REGISTRY_TEST_FAILURE: %',(
      select jsonb_agg(to_jsonb(r)) from c11_results r where result<>'PASS'
    );
  end if;
end $$;

select test_name,result,detail from c11_results order by test_name;
select 'C11_SOURCE_REGISTRY=PASS' as result;