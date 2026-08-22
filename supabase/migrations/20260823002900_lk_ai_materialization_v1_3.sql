create table if not exists portal_private.owner_rail_tariff_matrix (
  id uuid primary key default gen_random_uuid(),
  tariff_key text not null unique,
  product_group text not null check (product_group in ('LIGHT_PETROLEUM','LPG_SPBT')),
  territory text not null,
  route_text text not null,
  tariff_usd_per_t numeric(18,6),
  source_provider text not null,
  status text not null check (status in ('WORKING_CONFIRMED','ROUTE_SPECIFIC_CONFIRMED','HISTORICAL','TO_VERIFY','FX_DEPENDENT')),
  original_rate numeric(18,6),
  original_currency char(3),
  original_unit text,
  valid_to date,
  notes text,
  source_record_id uuid,
  source_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(source_refs)='array'),
  client_visible boolean not null default false,
  agent_visible boolean not null default false,
  source_system text not null default 'OWNER_APPROVED_AI_SYNC',
  source_version text not null default 'V1.3',
  approved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists portal_private.owner_agent_display_policies (
  policy_key text primary key,
  numeric_value numeric(18,8),
  unit text,
  applies_to text not null,
  status text not null check (status in ('ACTIVE_DISPLAY_ONLY','HOLD','RETIRED')),
  note text,
  source_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(source_refs)='array'),
  client_visible boolean not null default false,
  agent_visible boolean not null default true,
  source_system text not null default 'OWNER_APPROVED_AI_SYNC',
  source_version text not null default 'V1.3',
  approved_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

revoke all on portal_private.owner_rail_tariff_matrix from public, anon, authenticated;
revoke all on portal_private.owner_agent_display_policies from public, anon, authenticated;

insert into portal_private.owner_rail_tariff_matrix
(tariff_key,product_group,territory,route_text,tariff_usd_per_t,source_provider,status,original_rate,original_currency,original_unit,valid_to,notes,source_record_id,source_refs)
values
('LPG-BY-BARBAROV-OSINOVKA','LPG_SPBT','Беларусь','Барбаров → Осиновка (эксп.)',35.36,'РУП «СГ-ТРАНС»','FX_DEPENDENT',null,null,null,null,'Рабочий ориентир в USD/т зависит от применимого курса BYN/USD; не повышать до firm/current без расчета на актуальную дату.','96c4c5d6-a13c-4744-a5d1-992312d67037'::uuid,'["96c4c5d6-a13c-4744-a5d1-992312d67037","OWNER_APPROVAL_2026-08-23_TARIFF_MATRIX_SUG"]'::jsonb),
('LPG-RU-ZLYNKA-OZINKI','LPG_SPBT','Россия','Злынка → Озинки',141.11,'Источник Rail matrix','HISTORICAL',141.11,'USD','USD/t',null,'Историческая ставка; не использовать как текущую без нового подтверждения.','96c4c5d6-a13c-4744-a5d1-992312d67037'::uuid,'["96c4c5d6-a13c-4744-a5d1-992312d67037","OWNER_APPROVAL_2026-08-23_TARIFF_MATRIX_SUG"]'::jsonb),
('LPG-RU-KRASNOE-OZINKI','LPG_SPBT','Россия','Красное → Озинки',null,'Источник не подтвержден','TO_VERIFY',null,null,null,null,'Текущий тариф отсутствует в подтвержденном источнике; значение не достраивать.','96c4c5d6-a13c-4744-a5d1-992312d67037'::uuid,'["96c4c5d6-a13c-4744-a5d1-992312d67037","OWNER_APPROVAL_2026-08-23_TARIFF_MATRIX_SUG"]'::jsonb),
('LPG-KZH-OZINKI-SARYAGASH','LPG_SPBT','Казахстан','Озинки → Сарыагаш',137.24,'ТОО «Orient Logistic»','WORKING_CONFIRMED',137.24,'USD','USD/t',null,'Рабочая подтвержденная ставка КЗХ; сохранять route/product scope.','96c4c5d6-a13c-4744-a5d1-992312d67037'::uuid,'["96c4c5d6-a13c-4744-a5d1-992312d67037","OWNER_APPROVAL_2026-08-23_ORIENT_LOGISTIC_KZH_UTI"]'::jsonb),
('LPG-UTI-SARYAGASH-KELES-KIRGILI','LPG_SPBT','Узбекистан','Сарыагаш / Келес → Киргили',33.91,'ТОО «Orient Logistic»','WORKING_CONFIRMED',33.91,'USD','USD/t',null,'Рабочая подтвержденная ставка УТИ; сохранять route/product scope.','96c4c5d6-a13c-4744-a5d1-992312d67037'::uuid,'["96c4c5d6-a13c-4744-a5d1-992312d67037","OWNER_APPROVAL_2026-08-23_ORIENT_LOGISTIC_KZH_UTI"]'::jsonb),
('LPG-KZH-UTI-CONSOLIDATED','LPG_SPBT','Казахстан + Узбекистан','Озинки → Сарыагаш → Киргили',171.43,'ТОО «Orient Logistic»','WORKING_CONFIRMED',171.43,'USD','USD/t',null,'Consolidated working basis; не смешивать с отдельными сегментами при расчете.','96c4c5d6-a13c-4744-a5d1-992312d67037'::uuid,'["96c4c5d6-a13c-4744-a5d1-992312d67037","OWNER_APPROVAL_2026-08-23_ORIENT_LOGISTIC_KZH_UTI"]'::jsonb),
('LIGHT-GARANT-BARBAROV-NAUSHKI-MONGOLIA','LIGHT_PETROLEUM','Беларусь / Россия / Монголия','Барбаров → Наушки (эксп. АО «УБЖД») → Монголия',162.666667,'ООО «ГАРАНТ»','ROUTE_SPECIFIC_CONFIRMED',9760.00,'USD','USD/wagon',date '2026-08-31','Пересчет 9 760 USD/вагон при подтвержденной ВК 60 т = 162.666667 USD/т. Только для указанного маршрута/кодов груза; не переносить на другие маршруты.','96c4c5d6-a13c-4744-a5d1-992312d67037'::uuid,'["96c4c5d6-a13c-4744-a5d1-992312d67037","RONA-RAIL-TARIFF-GARANT-20260818-001"]'::jsonb)
on conflict(tariff_key) do update set
  product_group=excluded.product_group,territory=excluded.territory,route_text=excluded.route_text,
  tariff_usd_per_t=excluded.tariff_usd_per_t,source_provider=excluded.source_provider,status=excluded.status,
  original_rate=excluded.original_rate,original_currency=excluded.original_currency,original_unit=excluded.original_unit,
  valid_to=excluded.valid_to,notes=excluded.notes,source_record_id=excluded.source_record_id,source_refs=excluded.source_refs,updated_at=now();

insert into portal_private.owner_agent_display_policies
(policy_key,numeric_value,unit,applies_to,status,note,source_refs)
values
('POSITIVE_ACTUAL_FX_EFFECT_AGENT_VISIBLE_SHARE',0.10,'SHARE','CONFIRMED_POSITIVE_ACTUAL_FX_EFFECT_ONLY','ACTIVE_DISPLAY_ONLY',
 'В ЛК Агента показывать только 10% подтвержденного положительного фактического FX effect. Внутренние Finance/Accounting/P&L/audit сохраняют 100%. Не применять к forecast/planned/unconfirmed FX. Это правило отображения и не является самостоятельным основанием уменьшения договорно причитающейся выплаты до Legal confirmation fee base.',
 '["OWNER_INSTRUCTION_2026-08-22_AGENT_LK_FX_EFFECT_10PCT","5b25be18-81be-43d7-8b36-8597ca4ed56c","cda353ed-b6db-4537-a892-8664ea8131c3"]'::jsonb)
on conflict(policy_key) do update set numeric_value=excluded.numeric_value,unit=excluded.unit,applies_to=excluded.applies_to,status=excluded.status,note=excluded.note,source_refs=excluded.source_refs,updated_at=now();
