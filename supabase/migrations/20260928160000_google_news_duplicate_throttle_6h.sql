-- RONA Trade public Google News duplicate-write throttle.
-- Owner-authorized write #7, 2026-09-28.
-- Existing duplicate detection and 15-minute ingest cadence are unchanged.
-- Known OPEN_WEB_GNEWS duplicates refresh last_seen_at/updated_at at most once per 6 hours.
-- New documents remain insertable immediately.

CREATE OR REPLACE FUNCTION portal_private.collect_public_market_news_v1()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'portal_private', 'public', 'extensions'
AS $function$
declare
  v_run_key text := 'DB-RSS-' || to_char(clock_timestamp(),'YYYYMMDDHH24MISS') || '-' || substr(gen_random_uuid()::text,1,8);
  v_query text; v_url text; v_status integer; v_content text; v_doc xml; v_item xml;
  v_title text; v_link text; v_pub_raw text; v_source_name text; v_pub_at timestamptz; v_body text; v_sha text;
  v_message_id bigint; v_scanned integer:=0; v_accepted integer:=0; v_duplicates integer:=0; v_filtered integer:=0; v_failed integer:=0; v_feeds_ok integer:=0;
  v_errors text[]:=array[]::text[]; v_final_status text; v_existing uuid;
  v_queries text[] := array[
    'Россия бензин дизель НПЗ экспорт топливо when:2d','Беларусь бензин дизель НПЗ нефтепродукты when:2d','Казахстан бензин дизель СУГ НПЗ экспорт when:2d',
    'Узбекистан бензин дизель СУГ нефтепродукты when:2d','Кыргызстан бензин дизель СУГ нефтепродукты when:2d','Таджикистан бензин дизель нефтепродукты when:2d',
    'Армения Азербайджан бензин дизель СУГ when:2d','Молдова бензин дизель нефтепродукты when:2d','Центральная Азия бензин дизель СУГ НПЗ when:2d',
    'Афганистан СУГ бензин дизель поставки Россия Центральная Азия when:2d','CIS gasoline diesel LPG refinery fuel supply when:2d','oil refinery outage sanctions fuel exports Russia Central Asia when:2d'
  ];
begin
  perform extensions.http_set_curlopt('CURLOPT_CONNECTTIMEOUT_MS','3000');
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS','8000');
  insert into portal_private.public_market_news_ingest_runs(run_key,status,scanned_items,accepted_items,duplicate_items,filtered_items,failed_items,started_at,updated_at)
  values(v_run_key,'STARTED',0,0,0,0,0,now(),now());
  foreach v_query in array v_queries loop
    begin
      v_url := 'https://news.google.com/rss/search?q='||extensions.urlencode(v_query::varchar)||'&hl=ru&gl=RU&ceid=RU%3Aru';
      select (r).status,(r).content into v_status,v_content from (select extensions.http_get(v_url) as r) s;
      if v_status<>200 or coalesce(length(v_content),0)<100 then raise exception 'HTTP_%',coalesce(v_status,0); end if;
      v_doc:=xmlparse(document v_content); v_feeds_ok:=v_feeds_ok+1;
      for v_item in select item from unnest(xpath('//channel/item',v_doc)) with ordinality as t(item,ord) where ord<=25 loop
        v_scanned:=v_scanned+1;
        v_title:=nullif(btrim(coalesce((xpath('/item/title/text()',v_item))[1]::text,'')),'');
        v_link:=nullif(btrim(coalesce((xpath('/item/link/text()',v_item))[1]::text,'')),'');
        v_pub_raw:=nullif(btrim(coalesce((xpath('/item/pubDate/text()',v_item))[1]::text,'')),'');
        v_source_name:=coalesce(nullif(btrim(coalesce((xpath('/item/source/text()',v_item))[1]::text,'')),''),'Google News source');
        if v_title is null or v_link is null or v_link !~ '^https://' or length(v_title)<20 then v_filtered:=v_filtered+1; continue; end if;
        begin v_pub_at:=coalesce(v_pub_raw::timestamptz,now()); exception when others then v_pub_at:=now(); end;
        if v_pub_at<now()-interval '3 days' or v_pub_at>now()+interval '1 day' then v_filtered:=v_filtered+1; continue; end if;
        v_body:=left(v_title||E'\nSource: '||v_source_name||E'\nPublished: '||to_char(v_pub_at at time zone 'UTC','YYYY-MM-DD HH24:MI:SS UTC'),30000);
        v_sha:=encode(extensions.digest(lower(regexp_replace(v_title,'\s+',' ','g'))||E'\n'||lower(v_source_name)||E'\n'||to_char(v_pub_at at time zone 'UTC','YYYY-MM-DD HH24:MI'),'sha256'),'hex');
        select id into v_existing from portal_private.telegram_market_documents
        where ingest_source='OPEN_WEB_GNEWS' and (
          sha256=v_sha or lower(regexp_replace(btrim(telegram_caption),'\s+',' ','g'))=lower(regexp_replace(btrim(v_title),'\s+',' ','g'))
        ) order by ingested_at desc limit 1;
        if v_existing is not null then update portal_private.telegram_market_documents set last_seen_at=now(),updated_at=now() where id=v_existing and last_seen_at<=now()-interval '6 hours'; v_duplicates:=v_duplicates+1; v_existing:=null; continue; end if;
        v_message_id:=abs(hashtextextended(v_sha,0)); if v_message_id=0 then v_message_id:=1; end if;
        insert into portal_private.telegram_market_documents(channel_username,channel_priority,message_id,message_timestamp,source_url,telegram_caption,file_name,file_size,mime_type,sha256,storage_bucket,storage_path,extraction_state,extracted_text,extracted_tables,extraction_note,ingest_source,ingested_at,last_seen_at,updated_at)
        values('public_web',50,v_message_id,v_pub_at,v_link,v_title,'public-'||substr(v_sha,1,12)||'.txt',octet_length(v_body),'text/plain',v_sha,'market-source-private','public-web/'||to_char(v_pub_at,'YYYY/MM/')||v_sha||'.txt','TEXT_EXTRACTED',v_body,'[]'::jsonb,left('OPEN_WEB_GNEWS; source='||v_source_name||'; query='||v_query||'; run='||v_run_key,4000),'OPEN_WEB_GNEWS',now(),now(),now())
        on conflict(channel_username,message_id,sha256) do update set last_seen_at=now(),updated_at=now() where portal_private.telegram_market_documents.last_seen_at<=now()-interval '6 hours';
        v_accepted:=v_accepted+1;
      end loop;
    exception when others then v_failed:=v_failed+1; v_errors:=array_append(v_errors,left(v_query||':'||sqlstate||':'||sqlerrm,500));
    end;
  end loop;
  update portal_private.telegram_market_channels set last_successful_ingest_at=case when v_feeds_ok>0 then now() else last_successful_ingest_at end,last_attempt_at=now(),last_error_code=case when v_failed>0 then 'PUBLIC_WEB_PARTIAL' else null end,updated_at=now() where channel_username='public_web';
  v_final_status:=case when v_feeds_ok=0 then 'FAILED' when v_failed>0 then 'PARTIAL' else 'SUCCESS' end;
  update portal_private.public_market_news_ingest_runs set status=v_final_status,scanned_items=v_scanned,accepted_items=v_accepted,duplicate_items=v_duplicates,filtered_items=v_filtered,failed_items=v_failed,error_code=case when v_failed>0 then left(array_to_string(v_errors,' | '),200) else null end,finished_at=now(),updated_at=now() where run_key=v_run_key;
  perform extensions.http_reset_curlopt();
  return jsonb_build_object('ok',v_final_status<>'FAILED','run_key',v_run_key,'status',v_final_status,'feeds_ok',v_feeds_ok,'feeds_failed',v_failed,'scanned_items',v_scanned,'accepted_items',v_accepted,'duplicate_items',v_duplicates,'filtered_items',v_filtered,'errors',to_jsonb(v_errors));
exception when others then
  begin perform extensions.http_reset_curlopt(); exception when others then null; end;
  update portal_private.public_market_news_ingest_runs set status='FAILED',failed_items=greatest(failed_items,1),error_code=left(sqlstate||':'||sqlerrm,200),finished_at=now(),updated_at=now() where run_key=v_run_key;
  return jsonb_build_object('ok',false,'run_key',v_run_key,'status','FAILED','error',sqlstate||':'||sqlerrm);
end;
$function$;

comment on function portal_private.collect_public_market_news_v1()
  is 'Public Google News collector. Stage2: duplicate last_seen_at/updated_at refresh is throttled to once per 6 hours; new-item ingest and duplicate detection remain unchanged.';
