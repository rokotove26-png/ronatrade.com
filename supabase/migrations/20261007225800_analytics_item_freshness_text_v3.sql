-- RONA Analytics item freshness text V3
-- Completes publication_semantics_v2: per-item freshness must be reflected in human-readable content.
-- Authority: Commercial proposal 6ce870c7-3d04-4f18-a588-aabc44b1ff90 + Operations approval 9fbd8563-bf93-47f1-8083-bc8155dcfdcc.
-- No DOM/CSS/visual asset or raw market fact mutation.

CREATE OR REPLACE FUNCTION portal_private.refresh_market_intelligence_analytics_core_v1(p_reason text DEFAULT 'AUTO'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'portal_private', 'auth'
AS $function$
declare
  v_ctl portal_private.market_intelligence_control%rowtype;
  v_sig text;
  v_run uuid;
  v_actor uuid;
  v_pub uuid;
  v_pub_id text;
  v_news_count int:=0;
  v_news_max timestamptz;
  v_fact_count int:=0;
  v_fc_count int:=0;
  v_src_count int:=0;
  v_m record;
  v_lpg record;
  v_content text;
  v_headline text;
  v_basis text;
  v_chart jsonb;
  v_sources jsonb;
  v_dir text;
  v_latest_display numeric;
  v_mtd_display numeric;
  v_forward_display numeric;
  v_grade_diff numeric;
  v_last_platts date;
  v_expected_platts date;
  v_source_gap boolean:=false;
  v_primary_telegram_ok boolean:=false;
  v_freshness_note text;
  v_telegram_note text;
  v_item_freshness text;
  v_item_freshness_note text;
  v_mtd_label text;
  v_forward_label text;
  v_lpg_turksib numeric;
  v_lpg_bekabad numeric;
  v_lpg_saryagash numeric;
  v_lpg_turksib_change numeric;
  v_lpg_bekabad_change numeric;
  v_lpg_saryagash_change numeric;
begin
  perform pg_advisory_xact_lock(hashtext('RONA_MARKET_INTELLIGENCE_AUTO_V1'));
  select * into v_ctl from portal_private.market_intelligence_control where singleton=true for update;
  if not found or not v_ctl.enabled then
    return jsonb_build_object('ok',false,'status','DISABLED');
  end if;

  select count(*)::int into v_fact_count from portal_private.market_intelligence_facts;
  select count(*)::int into v_fc_count from portal_private.market_intelligence_forecast_snapshots;
  select count(*)::int into v_src_count from portal_private.market_intelligence_source_documents;
  select count(*)::int,max(updated_at) into v_news_count,v_news_max
  from public.rona_market_news
  where verified=true and publication_status='ОПУБЛИКОВАНО';

  select max(source_date) into v_last_platts
  from portal_private.market_intelligence_source_documents
  where source_family='PLATTS';

  v_expected_platts := case extract(isodow from (now() at time zone 'Europe/Moscow')::date)::int
    when 1 then (now() at time zone 'Europe/Moscow')::date - 3
    when 7 then (now() at time zone 'Europe/Moscow')::date - 2
    when 6 then (now() at time zone 'Europe/Moscow')::date - 1
    else (now() at time zone 'Europe/Moscow')::date - 1
  end;
  v_source_gap := v_last_platts is null or v_last_platts < v_expected_platts;

  select exists(
    select 1 from portal_private.telegram_market_channels t
    where t.enabled=true and t.channel_role='PRIMARY'
      and t.last_successful_ingest_at is not null
      and t.last_successful_ingest_at>=now()-interval '24 hours'
      and t.last_error_code is null
  ) into v_primary_telegram_ok;

  v_freshness_note := case when v_source_gap then
      'Последний доступный Platts: '||coalesce(to_char(v_last_platts,'DD.MM.YYYY'),'нет данных')||'; ожидаемый последний торговый день '||to_char(v_expected_platts,'DD.MM.YYYY')||' в контуре отсутствует. Источник помечен как РАЗРЫВ ДАННЫХ.'
    else
      'Platts актуален по последнему ожидаемому торговому дню: '||to_char(v_last_platts,'DD.MM.YYYY')||'.'
    end;
  v_telegram_note := case when v_primary_telegram_ok then
      'Основной Telegram-источник доступен.'
    else
      'Основной Telegram-источник Platts сейчас деградирован; данные не достраиваются и не подменяются.'
    end;

  select md5(concat_ws('|',
    (select count(*)::text from portal_private.market_intelligence_facts),
    (select coalesce(sum(coalesce(assessment_value,0)+coalesce(calc_value,0)+coalesce(value_low,0)+coalesce(value_high,0)),0)::text from portal_private.market_intelligence_facts),
    (select coalesce(max(as_of_date)::text,'') from portal_private.market_intelligence_facts),
    (select count(*)::text from portal_private.market_intelligence_forecast_snapshots),
    (select coalesce(sum(coalesce(low_usd_t,0)+coalesce(base_usd_t,0)+coalesce(high_usd_t,0)+coalesce(forward_implied_usd_t,0)),0)::text from portal_private.market_intelligence_forecast_snapshots),
    (select count(*)::text from portal_private.market_intelligence_rules where rule_status<>'RETIRED'),
    coalesce(v_news_count::text,'0'),coalesce(v_news_max::text,''),coalesce(v_last_platts::text,''),v_expected_platts::text,v_source_gap::text,v_primary_telegram_ok::text,
    'PUBLIC_DISPLAY_FACT_MTD_FORWARD_V4')) into v_sig;

  if not v_ctl.dirty and v_ctl.last_input_signature=v_sig then
    update portal_private.market_intelligence_control set last_run_at=now(),last_status='NO_CHANGE',last_error_code=null,updated_at=now() where singleton=true;
    return jsonb_build_object('ok',true,'status','NO_CHANGE','signature',v_sig,'publication_id',v_ctl.last_publication_id);
  end if;

  insert into portal_private.market_intelligence_runs(trigger_reason,status,material_change,input_signature,source_doc_count,fact_count,forecast_count,metadata)
  values(coalesce(nullif(btrim(p_reason),''),'AUTO'),'STARTED',true,v_sig,v_src_count,v_fact_count,v_fc_count,
         jsonb_build_object('owner_authorization_ref',v_ctl.owner_authorization_ref,'news_count',v_news_count,'news_max_updated_at',v_news_max,'last_platts_date',v_last_platts,'expected_platts_date',v_expected_platts,'source_gap',v_source_gap,'primary_telegram_ok',v_primary_telegram_ok,'public_display_semantics','FACT_MTD_FORWARD'))
  returning run_id into v_run;

  select id into v_actor from portal_private.portal_users where login_name='rokotove' and status='ACTIVE' and lifecycle_state='ACTIVE' order by created_at limit 1;
  if v_actor is null then raise exception 'OWNER_ADMIN_ACTOR_NOT_FOUND'; end if;

  if not exists(select 1 from portal_private.market_intelligence_daily_metrics_v1 where product='АИ-92' and latest_date>=date '2026-08-27') then
    raise exception 'CURRENT_PLATTS_FACTS_NOT_RESTORED';
  end if;

  update portal_private.publications
     set status='SUPERSEDED',lifecycle_state='ARCHIVED',authority_state='SUPERSEDED',updated_at=now()
   where source_system='RONA_MARKET_INTELLIGENCE_AUTO_V1'
     and publication_type='ANALYTICS'
     and lifecycle_state='ACTIVE';
  update portal_private.publication_items pi
     set distribution_allowed=false,lifecycle_state='ARCHIVED',authority_state='SUPERSEDED',source_visibility_state='ARCHIVED_NOT_DISTRIBUTED',updated_at=now()
   where pi.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
     and exists(select 1 from portal_private.publications p where p.id=pi.publication_key and p.source_system='RONA_MARKET_INTELLIGENCE_AUTO_V1' and p.lifecycle_state='ARCHIVED');

  v_pub_id:='RONA-MARKET-ANALYTICS-AUTO-'||to_char(clock_timestamp(),'YYYYMMDD-HH24MISS')||'-'||upper(substr(v_sig,1,8));
  insert into portal_private.publications(publication_id,publication_type,title,status,audience,prepared_at,prepared_by,approved_at,approved_by,published_at,published_by,source_system,source_version,source_timestamp,authority_state,lifecycle_state,metadata)
  values(v_pub_id,'ANALYTICS','Рыночная аналитика RONA Trade — текущие данные и прогнозные входы','PUBLISHED','ALL_CLIENTS',now(),v_actor,now(),v_actor,now(),v_actor,'RONA_MARKET_INTELLIGENCE_AUTO_V1','AUTO_V2:'||v_sig,now(),'VERIFIED','ACTIVE',
         jsonb_build_object('publication_layer','DERIVED_ANALYTICS','automatic',true,'owner_authorization_ref',v_ctl.owner_authorization_ref,'raw_platts_private',true,'price_mutation_allowed',false,'input_signature',v_sig,'run_id',v_run,'news_signal_count',v_news_count,'public_display_semantics','FACT_MTD_FORWARD','last_platts_date',v_last_platts,'expected_platts_date',v_expected_platts,'source_freshness_state',case when v_source_gap then 'SOURCE_GAP' else 'CURRENT' end,'primary_telegram_ok',v_primary_telegram_ok))
  returning id into v_pub;

  for v_m in select * from portal_private.market_intelligence_daily_metrics_v2 order by case product when 'АИ-92' then 1 when 'АИ-95' then 2 when 'ДТ' then 3 when 'НАФТА' then 4 else 9 end
  loop
    v_grade_diff:=case when v_m.product='АИ-95' then 40 else 0 end;
    v_latest_display:=v_m.latest_value_usd_t+v_grade_diff;
    v_mtd_display:=v_m.mtd_avg_usd_t+v_grade_diff;
    v_forward_display:=case when v_m.forward_usd_t is null then null else v_m.forward_usd_t+v_grade_diff end;
    v_dir:=case when v_m.d1_change_usd_t>0 then 'вырос' when v_m.d1_change_usd_t<0 then 'снизился' else 'не изменился' end;
    v_basis:=case when v_m.product in ('АИ-92','АИ-95','ДТ') then 'RONA: Озинки / Сарыагаш / Турксиб / Наушки' else 'RONA: коммерческие базисы' end;
    v_item_freshness:=case when v_m.latest_date is null then 'TO_VERIFY_FRESHNESS' when v_m.latest_date<v_expected_platts then 'STALE_SOURCE' else 'CURRENT' end;
    v_item_freshness_note:=case
      when v_item_freshness='CURRENT' then 'Источник продукта актуален по последнему ожидаемому торговому дню: '||to_char(v_m.latest_date,'DD.MM.YYYY')||'.'
      when v_item_freshness='STALE_SOURCE' then 'Источник продукта устарел: последний доступный день '||to_char(v_m.latest_date,'DD.MM.YYYY')||', ожидаемый последний торговый день '||to_char(v_expected_platts,'DD.MM.YYYY')||'. Данные не достраиваются и не подменяются.'
      else 'Актуальность источника продукта требует проверки; данные не достраиваются и не подменяются.'
    end;
    v_mtd_label:='MTD '||to_char(v_m.latest_date,'MM.YYYY');
    v_forward_label:='FORWARD '||to_char(v_m.target_month,'MM.YYYY');

    if v_m.product='АИ-92' then
      v_headline:='АИ-92: текущий ориентир '||to_char(v_latest_display,'FM999999990D00')||'; MTD '||to_char(v_mtd_display,'FM999999990D00')||'; forward '||to_char(v_m.target_month,'MM.YYYY')||' '||coalesce(to_char(v_forward_display,'FM999999990D00'),'нет данных')||' USD/т';
      v_content:='По последнему подтвержденному торговому дню '||to_char(v_m.latest_date,'DD.MM.YYYY')||' базовый бензиновый ориентир '||v_dir||' относительно предыдущего наблюдения и составляет '||to_char(v_latest_display,'FM999999990D00')||' USD/т. Среднее MTD '||to_char(v_m.latest_date,'MM.YYYY')||' — '||to_char(v_mtd_display,'FM999999990D00')||' USD/т; forward '||to_char(v_m.target_month,'MM.YYYY')||' — '||coalesce(to_char(v_forward_display,'FM999999990D00'),'нет данных')||' USD/т. Старый LOW/BASE/HIGH больше не показывается как текущий прогноз: он сохранен только в историческом сценарном архиве. '||v_item_freshness_note||' '||v_telegram_note||' Финальный клиентский прайс автоматически не изменяется.';
    elsif v_m.product='АИ-95' then
      v_headline:='АИ-95: расчетный слой '||to_char(v_latest_display,'FM999999990D00')||'; MTD '||to_char(v_mtd_display,'FM999999990D00')||'; forward '||to_char(v_m.target_month,'MM.YYYY')||' '||coalesce(to_char(v_forward_display,'FM999999990D00'),'нет данных')||' USD/т';
      v_content:='Для АИ-95 текущий расчетный слой формируется отдельно от исходных данных Platts: к базовому бензиновому индексу применяется действующая расчетная разница марки +40 USD/т. На '||to_char(v_m.latest_date,'DD.MM.YYYY')||' расчетный ориентир — '||to_char(v_latest_display,'FM999999990D00')||' USD/т, MTD '||to_char(v_m.latest_date,'MM.YYYY')||' — '||to_char(v_mtd_display,'FM999999990D00')||' USD/т, forward '||to_char(v_m.target_month,'MM.YYYY')||' — '||coalesce(to_char(v_forward_display,'FM999999990D00'),'нет данных')||' USD/т. Это расчетный слой RONA, а не отдельная исходная котировка Platts. Старый LOW/BASE/HIGH сохранен только как исторический сценарий. '||v_item_freshness_note||' '||v_telegram_note||' Финальный клиентский прайс остается под отдельным шлюзом обновления цен Руководителя.';
    elsif v_m.product='ДТ' then
      v_headline:='ДТ: '||case when v_item_freshness='CURRENT' then 'текущий композит ' else 'последний доступный композит ' end||to_char(v_latest_display,'FM999999990D00')||'; MTD '||to_char(v_mtd_display,'FM999999990D00')||'; forward '||to_char(v_m.target_month,'MM.YYYY')||' '||coalesce(to_char(v_forward_display,'FM999999990D00'),'нет данных')||' USD/т';
      v_content:='По состоянию на '||to_char(v_m.latest_date,'DD.MM.YYYY')||' композитная база БНК, рассчитанная как среднее применимых ULSD/Diesel индексов, '||case when v_m.d1_change_usd_t>0 then 'выросла' when v_m.d1_change_usd_t<0 then 'снизилась' else 'не изменилась' end||' и составляет '||to_char(v_latest_display,'FM999999990D00')||' USD/т. MTD '||to_char(v_m.latest_date,'MM.YYYY')||' — '||to_char(v_mtd_display,'FM999999990D00')||' USD/т; forward '||to_char(v_m.target_month,'MM.YYYY')||' — '||coalesce(to_char(v_forward_display,'FM999999990D00'),'нет данных')||' USD/т. Старый LOW/BASE/HIGH не используется как текущая рыночная оценка. '||v_item_freshness_note||' '||v_telegram_note||' Финальный прайс не изменяется автоматически.';
    else
      v_headline:='Нафта: текущий ориентир '||to_char(v_latest_display,'FM999999990D00')||'; MTD '||to_char(v_mtd_display,'FM999999990D00')||'; forward '||to_char(v_m.target_month,'MM.YYYY')||' '||coalesce(to_char(v_forward_display,'FM999999990D00'),'нет данных')||' USD/т';
      v_content:='По состоянию на '||to_char(v_m.latest_date,'DD.MM.YYYY')||' подтвержденный индикатор нафты составляет '||to_char(v_latest_display,'FM999999990D00')||' USD/т, MTD '||to_char(v_m.latest_date,'MM.YYYY')||' — '||to_char(v_mtd_display,'FM999999990D00')||' USD/т, forward '||to_char(v_m.target_month,'MM.YYYY')||' — '||coalesce(to_char(v_forward_display,'FM999999990D00'),'нет данных')||' USD/т. В процедуре БНК отдельная формула закупочной цены для нафты не определена, поэтому это только рыночная аналитика. Старый LOW/BASE/HIGH оставлен исключительно в историческом сценарном архиве. '||v_item_freshness_note||' '||v_telegram_note;
    end if;

    v_chart:=jsonb_build_object('type','FORECAST_RANGE','target_month',to_char(v_m.target_month,'YYYY-MM'),'labels',jsonb_build_array('ФАКТ',v_mtd_label,v_forward_label),'values',jsonb_build_array(v_latest_display,v_mtd_display,v_forward_display),'unit','USD/т','raw_benchmark_private',true,'chart_semantics','CURRENT_FACT_MTD_FORWARD','latest_source_date',v_m.latest_date,'source_freshness_state',v_item_freshness,'expected_source_date',v_expected_platts);
    v_sources:=jsonb_build_array(v_m.latest_fact_id,v_m.forward_fact_id,v_m.snapshot_id,'BNK-PRICING-PROCEDURE-2026-08');

    insert into portal_private.publication_items(publication_key,item_type,item_order,product,basis,audience,distribution_allowed,headline,content_text,analytics_as_of,analytics_period_from,analytics_period_to,forecast_scenario,actual_value,forecast_value,analytics_unit,metadata,source_system,source_version,source_timestamp,authority_state,lifecycle_state,source_item_subtype,source_visibility_state)
    values(v_pub,'ANALYTICS',case v_m.product when 'АИ-92' then 1 when 'АИ-95' then 2 when 'ДТ' then 3 else 4 end,v_m.product,v_basis,'ALL_CLIENTS',true,v_headline,v_content,v_m.latest_date::timestamptz,date_trunc('month',v_m.latest_date)::timestamptz,v_m.latest_date::timestamptz,null,v_latest_display,v_forward_display,'USD/т',
           jsonb_build_object('publication_layer','DERIVED_ANALYTICS','public_chart_ready',true,'public_chart',v_chart,'source_refs',v_sources,'data_state','CALCULATED-DERIVED','raw_source_values_exposed',false,'public_display_semantics','FACT_MTD_FORWARD','mtd_value_usd_t',v_mtd_display,'mtd_observation_count',v_m.obs_count,'current_forward_as_of',v_m.forward_as_of,'forecast_snapshot_date',v_m.snapshot_date,'historical_scenario',jsonb_build_object('low',v_m.low_usd_t,'base',v_m.base_usd_t,'high',v_m.high_usd_t,'current',false),'source_freshness_state',v_item_freshness,'last_platts_date',v_last_platts,'expected_platts_date',v_expected_platts,'primary_telegram_ok',v_primary_telegram_ok,'ai95_grade_diff_usd_t',v_grade_diff),
           'RONA_MARKET_INTELLIGENCE_AUTO_V1','AUTO_V2:'||v_sig,now(),'VERIFIED','ACTIVE','MARKET_INTELLIGENCE','ALL_LK_AUTO_PUBLISHED');
  end loop;

  select * into v_lpg
  from portal_private.market_intelligence_facts
  where market_family='CENTRAL_ASIA_LPG' and upper(coalesce(basis,'')) like '%ГАЛАБ%'
  order by as_of_date desc,publication_date desc nulls last,created_at desc limit 1;

  if found then
    select assessment_value,(metadata->>'weekly_change')::numeric into v_lpg_turksib,v_lpg_turksib_change from portal_private.market_intelligence_facts where market_family='CENTRAL_ASIA_LPG' and as_of_date=v_lpg.as_of_date and upper(coalesce(basis,'')) like '%ТУРКСИБ%' order by created_at desc limit 1;
    select assessment_value,(metadata->>'weekly_change')::numeric into v_lpg_bekabad,v_lpg_bekabad_change from portal_private.market_intelligence_facts where market_family='CENTRAL_ASIA_LPG' and as_of_date=v_lpg.as_of_date and upper(coalesce(basis,'')) like '%БЕКАБАД%' order by created_at desc limit 1;
    select assessment_value,(metadata->>'weekly_change')::numeric into v_lpg_saryagash,v_lpg_saryagash_change from portal_private.market_intelligence_facts where market_family='CENTRAL_ASIA_LPG' and as_of_date=v_lpg.as_of_date and upper(coalesce(basis,'')) like '%САРЫАГАШ%' order by created_at desc limit 1;
    v_chart:=jsonb_build_object('type','REGIONAL_RANGE','basis','CPT Галаба','labels',jsonb_build_array('MIN','AVG','MAX'),'values',jsonb_build_array((v_lpg.metadata->>'min')::numeric,v_lpg.assessment_value,(v_lpg.metadata->>'max')::numeric),'unit','USD/т','source_date',v_lpg.as_of_date,'chart_semantics','LATEST_REGIONAL_SOURCE','source_freshness_state','TO_VERIFY_FRESHNESS','expected_source_date',null);
    v_content:='Последний доступный региональный выпуск по СУГ: дата рынка '||to_char(v_lpg.as_of_date,'DD.MM.YYYY')||', публикация '||coalesce(to_char(v_lpg.publication_date,'DD.MM.YYYY'),'не указана')||'. CPT Галаба — '||to_char(v_lpg.assessment_value,'FM999999990D00')||' USD/т, недельное изменение '||coalesce(to_char((v_lpg.metadata->>'weekly_change')::numeric,'FM999999990D00'),'нет данных')||'; CPT Турксиб — '||coalesce(to_char(v_lpg_turksib,'FM999999990D00'),'нет данных')||' ('||coalesce(to_char(v_lpg_turksib_change,'FM999999990D00'),'нет данных')||'); DAP Бекабад — '||coalesce(to_char(v_lpg_bekabad,'FM999999990D00'),'нет данных')||' ('||coalesce(to_char(v_lpg_bekabad_change,'FM999999990D00'),'нет данных')||'); DAP Сарыагаш — '||coalesce(to_char(v_lpg_saryagash,'FM999999990D00'),'нет данных')||' ('||coalesce(to_char(v_lpg_saryagash_change,'FM999999990D00'),'нет данных')||') USD/т. Актуальность регионального источника к текущей дате требует проверки; данные не достраиваются и не подменяются. Это индикативная региональная аналитика; финальный клиентский прайс автоматически не изменяется.';
    insert into portal_private.publication_items(publication_key,item_type,item_order,product,basis,audience,distribution_allowed,headline,content_text,analytics_as_of,analytics_period_from,analytics_period_to,forecast_scenario,actual_value,forecast_value,analytics_unit,metadata,source_system,source_version,source_timestamp,authority_state,lifecycle_state,source_item_subtype,source_visibility_state)
    values(v_pub,'ANALYTICS',5,'СУГ / СПБТ','RONA: Галаба / Турксиб / Сарыагаш','ALL_CLIENTS',true,'СУГ: актуальный региональный срез по последнему доступному выпуску',v_content,v_lpg.as_of_date::timestamptz,v_lpg.as_of_date::timestamptz,v_lpg.as_of_date::timestamptz,'REGIONAL_INDICATIVE',v_lpg.assessment_value,null,'USD/т',
           jsonb_build_object('publication_layer','DERIVED_ANALYTICS','public_chart_ready',true,'public_chart',v_chart,'source_refs',jsonb_build_array(v_lpg.fact_id,coalesce(v_lpg.source_ref,'PETROMARKET')),'data_state','INDICATIVE-FORECAST','raw_source_values_exposed',true,'price_mutation_allowed',false,'public_display_semantics','LATEST_REGIONAL_SOURCE','source_freshness_state','TO_VERIFY_FRESHNESS','expected_source_date',null),
           'RONA_MARKET_INTELLIGENCE_AUTO_V1','AUTO_V2:'||v_sig,now(),'VERIFIED','ACTIVE','REGIONAL_LPG_ANALYTICS','ALL_LK_AUTO_PUBLISHED');
  end if;

  update portal_private.market_intelligence_control
     set dirty=false,last_input_signature=v_sig,last_run_at=now(),last_success_at=now(),last_status='SUCCESS',last_error_code=null,last_publication_id=v_pub_id,updated_at=now()
   where singleton=true;
  update portal_private.market_intelligence_runs set status='SUCCESS',publication_id=v_pub_id,finished_at=now(),metadata=metadata||jsonb_build_object('item_count',(select count(*) from portal_private.publication_items where publication_key=v_pub),'price_auto_publish',false,'public_display_semantics','FACT_MTD_FORWARD') where run_id=v_run;
  insert into portal_private.audit_events(actor_user_id,actor_role,action,entity_type,entity_id,metadata,result)
  values(v_actor,'ADMIN','ANALYTICS_AUTO_REFRESHED','PUBLICATION',v_pub_id,jsonb_build_object('gate','OWNER_AUTHORIZED_DERIVED_ANALYTICS_AUTO','owner_authorization_ref',v_ctl.owner_authorization_ref,'run_id',v_run,'input_signature',v_sig,'price_mutation_allowed',false,'public_display_semantics','FACT_MTD_FORWARD','source_gap',v_source_gap),'SUCCESS');
  return jsonb_build_object('ok',true,'status','SUCCESS','run_id',v_run,'publication_id',v_pub_id,'signature',v_sig,'fact_count',v_fact_count,'forecast_count',v_fc_count,'source_doc_count',v_src_count,'news_count',v_news_count,'last_platts_date',v_last_platts,'expected_platts_date',v_expected_platts,'source_gap',v_source_gap,'primary_telegram_ok',v_primary_telegram_ok);
exception when others then
  update portal_private.market_intelligence_control set last_run_at=now(),last_status='FAILED',last_error_code=sqlstate||':'||left(sqlerrm,180),updated_at=now() where singleton=true;
  if v_run is not null then update portal_private.market_intelligence_runs set status='FAILED',error_code=sqlstate,error_text=left(sqlerrm,1000),finished_at=now() where run_id=v_run; end if;
  raise;
end;
$function$;

comment on function portal_private.refresh_market_intelligence_analytics_core_v1(text) is
'V4 publication semantics: dynamic periods, per-item metadata freshness and matching human-readable freshness; stale inputs fail closed.';
