begin;

create table if not exists portal_private.rail_route_nodes_v1 (
  esr_code text primary key,
  station_name text not null,
  country_code text not null,
  ecp5 text,
  border_role text,
  authority_state text not null default 'CONFIRMED',
  source_system text not null,
  source_ref text not null,
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rail_route_nodes_v1_esr_ck check (esr_code ~ '^[0-9]{6}$'),
  constraint rail_route_nodes_v1_country_ck check (country_code ~ '^[A-Z]{2}$'),
  constraint rail_route_nodes_v1_authority_ck check (authority_state in ('CONFIRMED','SUPERSEDED'))
);
alter table portal_private.rail_route_nodes_v1 enable row level security;
revoke all on table portal_private.rail_route_nodes_v1 from public, anon, authenticated;
grant select on table portal_private.rail_route_nodes_v1 to service_role;

create table if not exists portal_private.rail_route_edges_v1 (
  id uuid primary key default gen_random_uuid(),
  from_esr_code text not null references portal_private.rail_route_nodes_v1(esr_code) on delete restrict,
  to_esr_code text not null references portal_private.rail_route_nodes_v1(esr_code) on delete restrict,
  edge_kind text not null,
  authority_state text not null default 'CONFIRMED',
  source_system text not null,
  source_ref text not null,
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rail_route_edges_v1_distinct_ck check (from_esr_code<>to_esr_code),
  constraint rail_route_edges_v1_kind_ck check (edge_kind in ('PRIMARY','BRANCH')),
  constraint rail_route_edges_v1_authority_ck check (authority_state in ('CONFIRMED','SUPERSEDED')),
  constraint rail_route_edges_v1_pair_uk unique (from_esr_code,to_esr_code,source_system)
);
alter table portal_private.rail_route_edges_v1 enable row level security;
revoke all on table portal_private.rail_route_edges_v1 from public, anon, authenticated;
grant select on table portal_private.rail_route_edges_v1 to service_role;

create table if not exists portal_private.rail_station_aliases_v1 (
  alias_key text primary key,
  alias_text text not null,
  esr_code text not null references portal_private.rail_route_nodes_v1(esr_code) on delete restrict,
  authority_state text not null default 'CONFIRMED',
  source_system text not null,
  source_ref text not null,
  created_at timestamptz not null default now(),
  constraint rail_station_aliases_v1_authority_ck check (authority_state in ('CONFIRMED','SUPERSEDED'))
);
alter table portal_private.rail_station_aliases_v1 enable row level security;
revoke all on table portal_private.rail_station_aliases_v1 from public, anon, authenticated;
grant select on table portal_private.rail_station_aliases_v1 to service_role;

create table if not exists portal_private.rail_deal_route_assignments_v1 (
  deal_key uuid primary key references portal_private.deals(id) on delete restrict,
  origin_esr_code text references portal_private.rail_route_nodes_v1(esr_code) on delete restrict,
  destination_esr_code text references portal_private.rail_route_nodes_v1(esr_code) on delete restrict,
  origin_authority text,
  destination_authority text,
  resolution_state text not null,
  route_nodes jsonb not null default '[]'::jsonb,
  route_hop_count integer,
  route_source_refs jsonb not null default '[]'::jsonb,
  resolved_at timestamptz,
  refreshed_at timestamptz not null default now(),
  provenance jsonb not null default '{}'::jsonb,
  constraint rail_deal_route_assignments_v1_state_ck check (resolution_state in ('RESOLVED','PENDING_ORIGIN','PENDING_DESTINATION','NO_PATH'))
);
alter table portal_private.rail_deal_route_assignments_v1 enable row level security;
revoke all on table portal_private.rail_deal_route_assignments_v1 from public, anon, authenticated;
grant select on table portal_private.rail_deal_route_assignments_v1 to service_role;

insert into portal_private.rail_route_nodes_v1
(esr_code,station_name,country_code,ecp5,border_role,authority_state,source_system,source_ref,provenance)
values
('151408','Барбаров','BY','15140',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('151338','Михалки','BY','15133',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('151802','Пхов','BY','15180',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('153808','Калинковичи','BY','15380',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('154406','Василевичи','BY','15440',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('154800','Речица','BY','15480',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('150119','Гомель Четный','BY','15011',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('150000','Гомель','BY','15000',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('150208','Новобелицкая','BY','15020',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('150212','Березки','BY','15021',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('150513','Закопытье','BY','15051',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('150405','Закопытье (эксп.)','BY','15040','BY_EXIT','CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('201202','Злынка (эксп.)','RU','20120','RU_ENTRY','CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('202309','Злынка','RU','20230',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('202205','Новозыбков','RU','20220',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('202101','Клинцы','RU','20210',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('202008','Унеча','RU','20200',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('200002','Брянск-Льговский','RU','20000',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('200207','Брянск-Восточный','RU','20020',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('200500','Карачев','RU','20050',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('216301','Саханская','RU','21630',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('216104','Кромская','RU','21610',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('216000','Орел','RU','21600',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('216392','Семинарская','RU','21639',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('216424','Кузмичевка','RU','21642',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('217709','Верховье','RU','21770',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('593000','Елец','RU','59300',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('592929','Извалы','RU','59292',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('592100','Казинка','RU','59210',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('592011','Грязи-Орловские','RU','59201',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('591907','Грязи-Воронежские','RU','59190',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('600102','Мичуринск-Воронежский','RU','60010',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('600044','Каменка','RU','60004',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('600006','Кочетовка I','RU','60000',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('601032','Турмасово','RU','60103',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('601403','Тамбов I','RU','60140',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('602209','Цна','RU','60220',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('602503','Иноковка','RU','60250',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('602919','Тоновка','RU','60291',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('607400','Вертуновская','RU','60740',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('607607','Ртищево I','RU','60760',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('607700','Ртищево II','RU','60770',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('607720','Благодатка','RU','60772',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('608807','Аткарск','RU','60880',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('609208','Красавка','RU','60920',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('620103','Трофимовский I','RU','62010',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('620004','Саратов I-Пассажирский','RU','62000',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('620508','Саратов II-Товарный','RU','62050',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('625408','Князевка','RU','62540',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('625427','Правобережный','RU','62542',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('625501','Анисовка','RU','62550',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('626307','Урбах','RU','62630',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('627206','Ершов','RU','62720',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('628406','Озинки','RU','62840',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('628508','Озинки (эксп.)','RU','62850','RU_EXIT','CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('664900','Семиглавый Мар (эксп.)','KZ','66490','KZ_ENTRY','CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('665000','Семиглавый Мар','KZ','66500',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('665602','Орал','KZ','66560',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('666906','Илецк I','KZ','66690',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('667805','Жинишке','KZ','66780',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('689503','Актобе I','KZ','68950',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('660007','Кандыагаш','KZ','66000',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('669904','Шалкар','KZ','66990',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('670102','Сексеул','KZ','67010',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('670309','Арал тенизи','KZ','67030',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('670507','Казалы','KZ','67050',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('670600','Торетам','KZ','67060',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('697800','Туркестан','KZ','69780',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('698004','Арыс I','KZ','69800',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('697406','Шагыр','KZ','69740',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('697904','Шенгелды','KZ','69790',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('704101','Сарыагаш (эксп.)','KZ','70410','KZ_EXIT','CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('720602','Келес (эксп.)','UZ','72060','UZ_ENTRY','CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('720104','Келес','UZ','72010',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('720000','Чукурсай','UZ','72000',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('720903','Салар','UZ','72090',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('722400','Ташкент-Товарный','UZ','72240',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('723600','Тукимачи','UZ','72360',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('723102','Озодлик','UZ','72310',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('722608','Ангрен','UZ','72260',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('740702','Пап','UZ','74070',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('740004','Коканд I','UZ','74000',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('742508','Маргилан','UZ','74250',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('743209','Ахунбабаева','UZ','74320',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('742705','Киргили','UZ','74270',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('722203','Назарбек','UZ','72220',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('722307','Далигузар','UZ','72230',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('723827','Узбекистан','UZ','72382',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('723812','Мустакиллик','UZ','72381',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://railwayz.info/photolines/station/22533',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('723808','Уртааул','UZ',null,null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://tr4.info/station/723808',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19')),
('722504','Хамза','UZ','72250',null,'CONFIRMED','PUBLIC_ROUTE_GRAPH_V1','https://railway.uz/en/uslugi/gruzovye_perevozki/355/',jsonb_build_object('seed','ROUTE_ENGINE_V1','capturedAt','2026-09-19'))
on conflict (esr_code) do update set
 station_name=excluded.station_name,country_code=excluded.country_code,ecp5=excluded.ecp5,
 border_role=coalesce(excluded.border_role,portal_private.rail_route_nodes_v1.border_role),
 authority_state='CONFIRMED',source_system=excluded.source_system,source_ref=excluded.source_ref,
 provenance=excluded.provenance,updated_at=now();

insert into portal_private.rail_route_edges_v1
(from_esr_code,to_esr_code,edge_kind,authority_state,source_system,source_ref,provenance)
values
('151408','151338','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('151338','151802','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('151802','153808','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('153808','154406','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('154406','154800','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('154800','150119','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('150119','150000','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('150000','150208','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('150208','150212','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('150212','150513','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('150513','150405','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('150405','201202','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('201202','202309','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('202309','202205','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('202205','202101','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('202101','202008','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('202008','200002','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('200002','200207','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('200207','200500','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('200500','216301','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('216301','216104','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('216104','216000','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('216000','216392','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('216392','216424','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('216424','217709','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('217709','593000','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('593000','592929','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('592929','592100','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('592100','592011','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('592011','591907','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('591907','600102','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('600102','600044','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('600044','600006','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('600006','601032','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('601032','601403','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('601403','602209','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('602209','602503','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('602503','602919','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('602919','607400','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('607400','607607','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('607607','607700','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('607700','607720','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('607720','608807','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('608807','609208','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('609208','620103','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('620103','620004','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('620004','620508','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('620508','625408','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('625408','625427','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('625427','625501','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('625501','626307','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('626307','627206','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('627206','628406','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('628406','628508','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('628508','664900','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('664900','665000','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('665000','665602','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('665602','666906','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('666906','667805','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('667805','689503','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('689503','660007','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('660007','669904','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('669904','670102','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('670102','670309','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('670309','670507','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('670507','670600','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('670600','697800','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('697800','698004','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('698004','697406','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('697406','697904','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('697904','704101','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('704101','720602','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('720602','720104','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('720104','720000','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('720000','720903','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('720903','722400','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('722400','723600','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('723600','723102','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('723102','722608','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('722608','740702','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('740702','740004','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('740004','742508','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('742508','743209','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('743209','742705','PRIMARY','CONFIRMED','ALTA_PUBLIC_ROUTE_CAPTURE','https://www.alta.ru/railway/route/',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('720104','722203','BRANCH','CONFIRMED','RAILWAYZ_TR4','https://railwayz.info/photolines/line/1723',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('722203','722307','BRANCH','CONFIRMED','RAILWAYZ_TR4','https://railwayz.info/photolines/line/1723',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('722307','723827','BRANCH','CONFIRMED','RAILWAYZ_TR4','https://railwayz.info/photolines/line/1723',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('723827','723812','BRANCH','CONFIRMED','TR4_OSM','https://osm.sbin.ru/esr/esr%3A723812',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('723812','723808','BRANCH','CONFIRMED','TR4_OSM','https://osm.sbin.ru/esr/esr%3A723812',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('722400','722504','BRANCH','CONFIRMED','RAILWAYZ_UZ','https://railwayz.info/photolines/line/1701',jsonb_build_object('seed','ROUTE_ENGINE_V1')),
('722504','723600','BRANCH','CONFIRMED','RAILWAYZ_UZ','https://railwayz.info/photolines/line/1701',jsonb_build_object('seed','ROUTE_ENGINE_V1'))
on conflict (from_esr_code,to_esr_code,source_system) do update set
 edge_kind=excluded.edge_kind,authority_state='CONFIRMED',source_ref=excluded.source_ref,
 provenance=excluded.provenance,updated_at=now();

insert into portal_private.rail_station_aliases_v1(alias_key,alias_text,esr_code,authority_state,source_system,source_ref)
values
('киригили','Киргили','742705','CONFIRMED','UZ_RAILWAYS','https://railway.uz/en/uslugi/gruzovye_perevozki/355/'),
('маргилан','Маргилан','742508','CONFIRMED','UZ_RAILWAYS','https://railway.uz/en/uslugi/gruzovye_perevozki/355/'),
('уртааул','Уртааул','723808','CONFIRMED','UZ_RAILWAYS','https://railway.uz/en/uslugi/gruzovye_perevozki/355/'),
('уртаовул','Уртаовул','723808','CONFIRMED','TR4','https://tr4.info/station/723808'),
('хамза','Хамза','722504','CONFIRMED','UZ_RAILWAYS','https://railway.uz/en/uslugi/gruzovye_perevozki/355/')
on conflict (alias_key) do update set esr_code=excluded.esr_code,authority_state='CONFIRMED',source_system=excluded.source_system,source_ref=excluded.source_ref;

insert into portal_private.rail_station_geo_directory_v1
(esr_code,canonical_station_name,aliases,country_code,latitude,longitude,authority_state,source_system,source_url,corroboration_refs,source_retrieved_at,provenance)
values
('151408','Барбаров',array['Барбаров']::text[],'BY',51.880371,29.320477,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/15140/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('151338','Михалки',array['Михалки']::text[],'BY',51.945891,29.211431,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/15133/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('151802','Пхов',array['Пхов']::text[],'BY',52.086193,29.233066,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/15180/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('153808','Калинковичи',array['Калинковичи']::text[],'BY',52.138686,29.319788,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/15380/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('154406','Василевичи',array['Василевичи']::text[],'BY',52.252481,29.836807,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/15440/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('154800','Речица',array['Речица']::text[],'BY',52.348902,30.392058,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/15480/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('150119','Гомель Четный',array['Гомель Четный']::text[],'BY',52.432782,30.911396,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/15011/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('150000','Гомель',array['Гомель']::text[],'BY',52.429214,30.995167,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/15000/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('150208','Новобелицкая',array['Новобелицкая']::text[],'BY',52.395203,31.039799,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/15020/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('150212','Березки',array['Березки']::text[],'BY',52.408643,31.091297,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/15021/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('150513','Закопытье',array['Закопытье']::text[],'BY',52.433918,31.48512,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/15051/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('150405','Закопытье (эксп.)',array['Закопытье (эксп.)']::text[],'BY',52.433918,31.48512,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/15040/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('201202','Злынка (эксп.)',array['Злынка (эксп.)']::text[],'RU',52.475127,31.665759,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/20120/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('202309','Злынка',array['Злынка']::text[],'RU',52.475127,31.665759,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/20230/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('202205','Новозыбков',array['Новозыбков']::text[],'RU',52.523284,31.94722,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/20220/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('202101','Клинцы',array['Клинцы']::text[],'RU',52.734985,32.232788,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/20210/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('202008','Унеча',array['Унеча']::text[],'RU',52.842361,32.678923,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/20200/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('200002','Брянск-Льговский',array['Брянск-Льговский']::text[],'RU',53.213516,34.409938,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/20000/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('200207','Брянск-Восточный',array['Брянск-Восточный']::text[],'RU',53.222646,34.451367,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/20020/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('200500','Карачев',array['Карачев']::text[],'RU',53.134361,34.982041,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/20050/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('216301','Саханская',array['Саханская']::text[],'RU',52.927216,35.928466,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/21630/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('216104','Кромская',array['Кромская']::text[],'RU',52.942529,36.059084,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/21610/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('216000','Орел',array['Орел']::text[],'RU',52.979401,36.112363,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/21600/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('216424','Кузмичевка',array['Кузмичевка']::text[],'RU',52.936744,36.196716,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/21642/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('217709','Верховье',array['Верховье']::text[],'RU',52.813823,37.239619,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/21770/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('593000','Елец',array['Елец']::text[],'RU',52.606287,38.528695,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/59300/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('592929','Извалы',array['Извалы']::text[],'RU',52.609714,38.700541,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/59292/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('592100','Казинка',array['Казинка']::text[],'RU',52.54498,39.748774,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/59210/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('592011','Грязи-Орловские',array['Грязи-Орловские']::text[],'RU',52.475801,39.897289,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/59201/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('591907','Грязи-Воронежские',array['Грязи-Воронежские']::text[],'RU',52.495046,39.945729,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/59190/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('600102','Мичуринск-Воронежский',array['Мичуринск-Воронежский']::text[],'RU',52.900536,40.449179,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/60010/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('600044','Каменка',array['Каменка']::text[],'RU',52.921641,40.479735,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/60004/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('600006','Кочетовка I',array['Кочетовка I']::text[],'RU',52.960491,40.481451,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/60000/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('601032','Турмасово',array['Турмасово']::text[],'RU',52.914632,40.521037,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/60103/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('601403','Тамбов I',array['Тамбов I']::text[],'RU',52.718284,41.426608,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/60140/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('602209','Цна',array['Цна']::text[],'RU',52.68778,41.46605,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/60220/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('602503','Иноковка',array['Иноковка']::text[],'RU',52.64819,42.384152,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/60250/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('602919','Тоновка',array['Тоновка']::text[],'RU',52.633802,42.821664,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/60291/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('607400','Вертуновская',array['Вертуновская']::text[],'RU',52.418072,43.527627,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/60740/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('607607','Ртищево I',array['Ртищево I']::text[],'RU',52.261133,43.785955,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/60760/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('607700','Ртищево II',array['Ртищево II']::text[],'RU',52.248017,43.82681,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/60770/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('607720','Благодатка',array['Благодатка']::text[],'RU',52.210019,43.883393,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/60772/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('608807','Аткарск',array['Аткарск']::text[],'RU',51.877333,45.010865,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/60880/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('609208','Красавка',array['Красавка']::text[],'RU',51.87003,45.068772,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/60920/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('620103','Трофимовский I',array['Трофимовский I']::text[],'RU',51.592316,45.940483,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/62010/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('620004','Саратов I-Пассажирский',array['Саратов I-Пассажирский']::text[],'RU',51.541877,45.997264,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/62000/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('620508','Саратов II-Товарный',array['Саратов II-Товарный']::text[],'RU',51.526691,45.991335,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/62050/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('625408','Князевка',array['Князевка']::text[],'RU',51.456159,45.957427,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/62540/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('625427','Правобережный',array['Правобережный']::text[],'RU',51.40854,46.01502,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/62542/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('625501','Анисовка',array['Анисовка']::text[],'RU',51.409244537354,46.0820729,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/62550/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('626307','Урбах',array['Урбах']::text[],'RU',51.236975,46.97797,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/62630/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('627206','Ершов',array['Ершов']::text[],'RU',51.347733,48.278305,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/62720/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('628406','Озинки',array['Озинки']::text[],'RU',51.195125,49.738165,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/62840/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('628508','Озинки (эксп.)',array['Озинки (эксп.)']::text[],'RU',51.195126,49.738134,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/62850/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('664900','Семиглавый Мар (эксп.)',array['Семиглавый Мар (эксп.)']::text[],'KZ',51.194994,50.052155,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/66490/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('665000','Семиглавый Мар',array['Семиглавый Мар']::text[],'KZ',51.19494,50.052177,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/66500/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('665602','Орал',array['Орал']::text[],'KZ',51.22902,51.369647,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/66560/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('666906','Илецк I',array['Илецк I']::text[],'KZ',51.171194,54.985952,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/66690/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('667805','Жинишке',array['Жинишке']::text[],'KZ',50.337993,57.13061,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/66780/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('689503','Актобе I',array['Актобе I']::text[],'KZ',50.280748,57.213793,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/68950/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('660007','Кандыагаш',array['Кандыагаш']::text[],'KZ',49.472647,57.426311,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/66000/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('669904','Шалкар',array['Шалкар']::text[],'KZ',47.833327,59.623625,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/66990/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('670102','Сексеул',array['Сексеул']::text[],'KZ',47.085378,61.153201,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/67010/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('670309','Арал тенизи',array['Арал тенизи']::text[],'KZ',46.801152,61.6754,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/67030/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('670507','Казалы',array['Казалы']::text[],'KZ',45.852756,62.157101,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/67050/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('670600','Торетам',array['Торетам']::text[],'KZ',45.651563,63.31629,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/67060/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('697800','Туркестан',array['Туркестан']::text[],'KZ',43.285665,68.212742,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/69780/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('698004','Арыс I',array['Арыс I']::text[],'KZ',42.417985,68.793848,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/69800/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('697406','Шагыр',array['Шагыр']::text[],'KZ',42.170136,68.975922,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/69740/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('697904','Шенгелды',array['Шенгелды']::text[],'KZ',41.86348,68.991133,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/69790/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('704101','Сарыагаш (эксп.)',array['Сарыагаш (эксп.)']::text[],'KZ',41.466334,69.147492,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/70410/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('720602','Келес (эксп.)',array['Келес (эксп.)']::text[],'UZ',41.407083,69.205111,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/72060/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('720104','Келес',array['Келес']::text[],'UZ',41.40705,69.205111,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/72010/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('720000','Чукурсай',array['Чукурсай']::text[],'UZ',41.378262,69.241457,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/72000/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('720903','Салар',array['Салар']::text[],'UZ',41.322657,69.313693,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/72090/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('722400','Ташкент-Товарный',array['Ташкент-Товарный']::text[],'UZ',41.296997,69.307975,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/72240/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('723600','Тукимачи',array['Тукимачи']::text[],'UZ',41.265342,69.250122,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/72360/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('723102','Озодлик',array['Озодлик']::text[],'UZ',40.936971,69.513605,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/72310/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('722608','Ангрен',array['Ангрен']::text[],'UZ',40.998984,70.082702,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/72260/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('740702','Пап',array['Пап']::text[],'UZ',40.857452,71.150558,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/74070/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('740004','Коканд I',array['Коканд I']::text[],'UZ',40.518895,70.928329,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/74000/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('742508','Маргилан',array['Маргилан']::text[],'UZ',40.44259,71.723127,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/74250/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('743209','Ахунбабаева',array['Ахунбабаева']::text[],'UZ',40.456557,71.751571,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/74320/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('742705','Киргили',array['Киргили']::text[],'UZ',40.43600136,71.80608625,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/74270/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('722203','Назарбек',array['Назарбек']::text[],'UZ',41.295112,69.120614,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/72220/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('722307','Далигузар',array['Далигузар']::text[],'UZ',41.193634,69.118335,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/72230/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('723827','Узбекистан',array['Узбекистан']::text[],'UZ',41.16191,69.103364,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/72382/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('723812','Мустакиллик',array['Мустакиллик']::text[],'UZ',41.177505493164,69.1241395,'CONFIRMED','RAILWAYZ','https://railwayz.info/photolines/station/22533','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('723808','Уртааул',array['Уртааул']::text[],'UZ',41.18972778,69.1402359,'CONFIRMED','FREICON','https://online.freicon.ru/info/stations/723808','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1')),
('722504','Хамза',array['Хамза']::text[],'UZ',41.26733,69.306443,'CONFIRMED','ALTA_SOFT','https://www.alta.ru/railway/station/72250/','[]'::jsonb,now(),jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','PUBLIC_DIRECTORY','routeEngineSeed','V1'))
on conflict (esr_code) do nothing;

create or replace function portal_private.rail_normalize_station_text_v1(p_text text)
returns text language sql immutable
set search_path=pg_catalog,portal_private
as $fn$
  select btrim(regexp_replace(lower(coalesce(p_text,'')),'[^0-9a-zа-яё]+',' ','g'))
$fn$;

create or replace function portal_private.rail_resolve_route_v1(p_origin_esr text,p_destination_esr text)
returns jsonb language sql stable
set search_path=pg_catalog,portal_private
as $fn$
with recursive walk(code,path,depth) as (
  select p_origin_esr,array[p_origin_esr]::text[],0
  where exists(select 1 from portal_private.rail_route_nodes_v1 n where n.esr_code=p_origin_esr and n.authority_state='CONFIRMED')
  union all
  select nx.next_code,w.path||nx.next_code,w.depth+1
  from walk w
  join portal_private.rail_route_edges_v1 e
    on e.authority_state='CONFIRMED'
   and (e.from_esr_code=w.code or e.to_esr_code=w.code)
  cross join lateral (
    select case when e.from_esr_code=w.code then e.to_esr_code else e.from_esr_code end as next_code
  ) nx
  where w.depth<160 and not nx.next_code=any(w.path)
),
best as (
  select path,depth from walk where code=p_destination_esr order by depth limit 1
),
points as (
  select ord::int as sequence,n.esr_code,n.station_name,n.country_code,n.border_role,
         g.latitude,g.longitude,n.source_system,n.source_ref
  from best b
  cross join unnest(b.path) with ordinality p(esr_code,ord)
  join portal_private.rail_route_nodes_v1 n on n.esr_code=p.esr_code
  left join portal_private.rail_station_geo_directory_v1 g
    on g.esr_code=n.esr_code and g.authority_state='CONFIRMED'
)
select case when not exists(select 1 from best) then null else jsonb_build_object(
  'originEsr',p_origin_esr,
  'destinationEsr',p_destination_esr,
  'hopCount',(select depth from best),
  'points',(select jsonb_agg(jsonb_build_object(
     'sequence',sequence,'stationCode',esr_code,'station',station_name,'countryCode',country_code,
     'borderRole',border_role,'lat',latitude,'lng',longitude,'trusted',latitude is not null and longitude is not null,
     'trust',case when latitude is not null and longitude is not null then 'CONFIRMED' else 'IDENTITY_ONLY' end,
     'provenance',jsonb_build_object('routeSourceSystem',source_system,'routeSourceRef',source_ref,'identityBasis','ESR_CODE')
   ) order by sequence) from points),
  'sourcePolicy','PUBLIC_SOURCE_GRAPH_V1'
) end
$fn$;

create or replace function portal_private.rail_detect_deal_origin_v1(p_deal_key uuid)
returns jsonb language plpgsql stable
set search_path=pg_catalog,portal_private
as $fn$
declare v_code text; v_deal_id text;
begin
  select d.deal_id into v_deal_id from portal_private.deals d where d.id=p_deal_key;
  select lpad(c->>'rawValue',6,'0') into v_code
  from portal_private.rail_xlsx_dislocation_effective_v1 e
  cross join lateral jsonb_array_elements(coalesce(e.source_row->'cells','[]'::jsonb)) c
  where e.effective_deal_key=p_deal_key and e.position_status='TRUSTED' and coalesce(e.is_superseded,false)=false
    and lower(c->>'header')='код станции отправления вагона'
    and (c->>'rawValue') ~ '^[0-9]+$'
  order by coalesce(e.parsed_event_at,e.source_received_at) asc limit 1;
  if v_code is not null and exists(select 1 from portal_private.rail_route_nodes_v1 where esr_code=v_code and authority_state='CONFIRMED') then
    return jsonb_build_object('esrCode',v_code,'authority','TRUSTED_XLSX_SOURCE_ROW');
  end if;

  select w.esr_code into v_code
  from portal_private.rail_planned_route_waypoints_v1 w
  join portal_private.rail_documents rd on rd.id=w.rail_document_key
  where rd.deal_key=p_deal_key and rd.lifecycle_state::text='ACTIVE'
    and w.waypoint_role='ORIGIN' and w.authority_state='OWNER_CONFIRMED'
  order by w.sequence_no limit 1;
  if v_code is not null then
    return jsonb_build_object('esrCode',v_code,'authority','OWNER_CONFIRMED_RAIL_DOCUMENT');
  end if;

  if exists(
    select 1 from portal_private.payments p
    where p.lifecycle_state::text='ACTIVE'
      and v_deal_id=any(coalesce(p.candidate_deal_ids,array[]::text[]))
      and upper(coalesce(p.counterparty_name,'')) like '%КУЗМАШ%'
      and upper(coalesce(p.counterparty_role,''))='SUPPLIER'
  ) then
    return jsonb_build_object('esrCode','151408','authority','OWNER_RULE_KUZMASH_WITH_FINANCE_EVIDENCE');
  end if;

  return null;
end
$fn$;

create or replace function portal_private.rail_detect_deal_destination_v1(p_deal_key uuid)
returns jsonb language plpgsql stable
set search_path=pg_catalog,portal_private
as $fn$
declare v_code text; v_dest text; v_match text[];
begin
  select lpad(c->>'rawValue',6,'0') into v_code
  from portal_private.rail_xlsx_dislocation_effective_v1 e
  cross join lateral jsonb_array_elements(coalesce(e.source_row->'cells','[]'::jsonb)) c
  where e.effective_deal_key=p_deal_key and e.position_status='TRUSTED' and coalesce(e.is_superseded,false)=false
    and lower(c->>'header')='код станции назначения вагона'
    and (c->>'rawValue') ~ '^[0-9]+$'
  order by coalesce(e.parsed_event_at,e.source_received_at) desc limit 1;
  if v_code is not null and exists(select 1 from portal_private.rail_route_nodes_v1 where esr_code=v_code and authority_state='CONFIRMED') then
    return jsonb_build_object('esrCode',v_code,'authority','TRUSTED_XLSX_SOURCE_ROW');
  end if;

  select ca.destination into v_dest
  from portal_private.client_applications ca
  where ca.lifecycle_state::text='ACTIVE'
    and (ca.linked_deal_key=p_deal_key or exists(select 1 from portal_private.deal_registrations dr where dr.deal_key=p_deal_key and dr.application_key=ca.id))
  order by ca.updated_at desc nulls last,ca.created_at desc limit 1;

  if v_dest is not null then
    v_match:=regexp_match(v_dest,'([0-9]{6})');
    if v_match is not null and exists(select 1 from portal_private.rail_route_nodes_v1 where esr_code=v_match[1] and authority_state='CONFIRMED') then
      return jsonb_build_object('esrCode',v_match[1],'authority','CLIENT_APPLICATION_EXPLICIT_ESR','destinationText',v_dest);
    end if;
    select a.esr_code into v_code
    from portal_private.rail_station_aliases_v1 a
    where a.authority_state='CONFIRMED'
      and portal_private.rail_normalize_station_text_v1(v_dest) like '%'||a.alias_key||'%'
    order by length(a.alias_key) desc limit 1;
    if v_code is not null then
      return jsonb_build_object('esrCode',v_code,'authority','CLIENT_APPLICATION_STATION_ALIAS','destinationText',v_dest);
    end if;
  end if;

  select m.code into v_code
  from portal_private.rail_documents rd
  cross join lateral (
    select captures[1] as code
    from regexp_matches(coalesce(rd.route_text,''),'([0-9]{6})','g') with ordinality r(captures,ord)
    order by ord desc limit 1
  ) m
  where rd.deal_key=p_deal_key and rd.lifecycle_state::text='ACTIVE'
    and exists(select 1 from portal_private.rail_route_nodes_v1 where esr_code=m.code and authority_state='CONFIRMED')
  order by rd.document_date desc nulls last limit 1;
  if v_code is not null then return jsonb_build_object('esrCode',v_code,'authority','RAIL_DOCUMENT_ROUTE_TEXT'); end if;

  return null;
end
$fn$;

create or replace function portal_private.rail_route_refresh_assignments_v1()
returns jsonb language plpgsql
set search_path=pg_catalog,portal_private
as $fn$
declare d record; o jsonb; t jsonb; r jsonb; state text; c_resolved int:=0; c_pending int:=0;
begin
  for d in select id,deal_id from portal_private.deals where lifecycle_state::text='ACTIVE' loop
    o:=portal_private.rail_detect_deal_origin_v1(d.id);
    t:=portal_private.rail_detect_deal_destination_v1(d.id);
    r:=null;
    if o is null then state:='PENDING_ORIGIN';
    elsif t is null then state:='PENDING_DESTINATION';
    else
      r:=portal_private.rail_resolve_route_v1(o->>'esrCode',t->>'esrCode');
      state:=case when r is null then 'NO_PATH' else 'RESOLVED' end;
    end if;

    insert into portal_private.rail_deal_route_assignments_v1
      (deal_key,origin_esr_code,destination_esr_code,origin_authority,destination_authority,resolution_state,route_nodes,route_hop_count,route_source_refs,resolved_at,refreshed_at,provenance)
    values
      (d.id,o->>'esrCode',t->>'esrCode',o->>'authority',t->>'authority',state,
       coalesce(r->'points','[]'::jsonb),nullif(r->>'hopCount','')::int,
       jsonb_build_array(jsonb_build_object('system','ALTA_PUBLIC_ROUTE_CAPTURE','url','https://www.alta.ru/railway/route/'),
                         jsonb_build_object('system','UZ_RAILWAYS_TR4','url','https://railway.uz/en/uslugi/gruzovye_perevozki/355/')),
       case when state='RESOLVED' then now() else null end,now(),
       jsonb_build_object('dealId',d.deal_id,'originEvidence',o,'destinationEvidence',t,'sourcePolicy','PUBLIC_SOURCE_GRAPH_V1'))
    on conflict (deal_key) do update set
       origin_esr_code=excluded.origin_esr_code,destination_esr_code=excluded.destination_esr_code,
       origin_authority=excluded.origin_authority,destination_authority=excluded.destination_authority,
       resolution_state=excluded.resolution_state,route_nodes=excluded.route_nodes,route_hop_count=excluded.route_hop_count,
       route_source_refs=excluded.route_source_refs,resolved_at=excluded.resolved_at,refreshed_at=now(),provenance=excluded.provenance;

    if state='RESOLVED' then c_resolved:=c_resolved+1; else c_pending:=c_pending+1; end if;
  end loop;
  return jsonb_build_object('resolved',c_resolved,'pending',c_pending,'refreshedAt',now());
end
$fn$;

create or replace function portal_private.rail_deal_route_progress_v1(p_deal_key uuid)
returns jsonb language plpgsql stable
set search_path=pg_catalog,portal_private
as $fn$
declare v_route jsonb; v_count int:=0; v_furthest int; v_observed jsonb:='[]'::jsonb; v_actual jsonb:='[]'::jsonb; v_remaining jsonb:='[]'::jsonb; v_origin jsonb;
begin
  select a.route_nodes into v_route from portal_private.rail_deal_route_assignments_v1 a
  where a.deal_key=p_deal_key and a.resolution_state='RESOLVED';
  if v_route is null then return jsonb_build_object('state','ROUTE_NOT_RESOLVED','observedStations','[]'::jsonb,'actualPoints','[]'::jsonb,'remainingPoints','[]'::jsonb); end if;
  v_count:=jsonb_array_length(v_route);

  with ev as (
    select e.station_code,max(e.station_name) station_name,
           min(coalesce(e.parsed_event_at,e.source_received_at)) first_seen_at,
           max(coalesce(e.parsed_event_at,e.source_received_at)) last_seen_at
    from portal_private.rail_xlsx_dislocation_effective_v1 e
    where e.effective_deal_key=p_deal_key and e.position_status='TRUSTED' and coalesce(e.is_superseded,false)=false
      and e.station_code is not null
    group by e.station_code
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'stationCode',ev.station_code,'station',ev.station_name,'firstSeenAt',ev.first_seen_at,'lastSeenAt',ev.last_seen_at,
      'lat',g.latitude,'lng',g.longitude,'trusted',g.id is not null,'sourceKind','OBSERVED_HISTORY'
    ) order by ev.first_seen_at,ev.station_code),'[]'::jsonb)
  into v_observed
  from ev
  left join portal_private.rail_station_geo_directory_v1 g on g.esr_code=ev.station_code and g.authority_state='CONFIRMED';

  select max((p->>'sequence')::int) into v_furthest
  from jsonb_array_elements(v_route) p
  where exists(select 1 from jsonb_array_elements(v_observed) o where o->>'stationCode'=p->>'stationCode');

  select p into v_origin from jsonb_array_elements(v_route) p where (p->>'sequence')::int=1 limit 1;
  if v_origin is not null and v_origin->>'lat' is not null and v_origin->>'lng' is not null then
    v_actual:=jsonb_build_array(v_origin||jsonb_build_object('sourceKind','SOURCE_ORIGIN'));
  end if;
  v_actual:=v_actual||coalesce((
    select jsonb_agg(o order by (o->>'firstSeenAt')::timestamptz,o->>'stationCode')
    from jsonb_array_elements(v_observed) o
    where o->>'lat' is not null and o->>'lng' is not null
      and not (v_origin is not null and o->>'stationCode'=v_origin->>'stationCode')
  ),'[]'::jsonb);

  select coalesce(jsonb_agg(p order by (p->>'sequence')::int),'[]'::jsonb) into v_remaining
  from jsonb_array_elements(v_route) p
  where (p->>'sequence')::int>=coalesce(v_furthest,1)
    and p->>'lat' is not null and p->>'lng' is not null;

  return jsonb_build_object(
    'state',case when jsonb_array_length(v_observed)=0 then 'NO_OBSERVATIONS' when v_furthest is null then 'OBSERVED_OFF_ROUTE' else 'OBSERVED_AND_MATCHED' end,
    'routeNodeCount',v_count,'furthestMatchedSequence',v_furthest,
    'historyStationCount',jsonb_array_length(v_observed),
    'observedStations',v_observed,'actualPoints',v_actual,'remainingPoints',v_remaining
  );
end
$fn$;

create or replace function public.rona_admin_rail_deal_map_read_model_v4(p_deal_id text default null)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,portal_private
as $fn$
declare v_actor uuid; v_base jsonb; v_deals jsonb:='[]'::jsonb; v_deal jsonb; v_assignment record; v_progress jsonb; v_planned jsonb;
begin
  v_actor:=portal_private.owner_r1_actor('ADMIN');
  v_base:=public.rona_admin_rail_deal_map_read_model_v2(p_deal_id);

  for v_deal in select value from jsonb_array_elements(coalesce(v_base->'deals','[]'::jsonb)) loop
    select a.* into v_assignment from portal_private.rail_deal_route_assignments_v1 a
    where a.deal_key=nullif(v_deal->>'dealKey','')::uuid;

    if v_assignment.deal_key is not null and v_assignment.resolution_state='RESOLVED' then
      v_progress:=portal_private.rail_deal_route_progress_v1(v_assignment.deal_key);
      v_planned:=jsonb_build_array(jsonb_build_object(
        'railDocumentKey',null,'railDocumentId',null,'gu12Number',null,
        'routeMode','PUBLIC_SOURCE_RESOLVED',
        'points',coalesce((select jsonb_agg(p order by (p->>'sequence')::int) from jsonb_array_elements(v_assignment.route_nodes) p where p->>'lat' is not null and p->>'lng' is not null),'[]'::jsonb),
        'geometry',null,'status','PUBLIC_SOURCE_ROUTE_RESOLVED',
        'provenance',jsonb_build_object('routeSource','PUBLIC_SOURCE_GRAPH_V1','geometryPolicy','STATION_SEQUENCE_POLYLINE','sourceRefs',v_assignment.route_source_refs)
      ));
      v_deal:=jsonb_set(v_deal,'{plannedRoute}',v_planned,true);
      v_deal:=jsonb_set(v_deal,'{actualRoute}',jsonb_build_object('status','OBSERVED_HISTORY','points',coalesce(v_progress->'actualPoints','[]'::jsonb)),true);
      v_deal:=jsonb_set(v_deal,'{remainingRoute}',jsonb_build_object('status','ROUTE_REMAINDER','points',coalesce(v_progress->'remainingPoints','[]'::jsonb)),true);
      v_deal:=jsonb_set(v_deal,'{routeProgress}',v_progress,true);
      v_deal:=jsonb_set(v_deal,'{routeStations}',v_assignment.route_nodes,true);
      v_deal:=jsonb_set(v_deal,'{routeAssignment}',jsonb_build_object(
        'resolutionState',v_assignment.resolution_state,'originEsr',v_assignment.origin_esr_code,'destinationEsr',v_assignment.destination_esr_code,
        'originAuthority',v_assignment.origin_authority,'destinationAuthority',v_assignment.destination_authority,
        'routeHopCount',v_assignment.route_hop_count,'resolvedAt',v_assignment.resolved_at,'refreshedAt',v_assignment.refreshed_at
      ),true);
    elsif v_assignment.deal_key is not null then
      v_deal:=jsonb_set(v_deal,'{routeAssignment}',jsonb_build_object(
        'resolutionState',v_assignment.resolution_state,'originEsr',v_assignment.origin_esr_code,'destinationEsr',v_assignment.destination_esr_code,
        'originAuthority',v_assignment.origin_authority,'destinationAuthority',v_assignment.destination_authority,'refreshedAt',v_assignment.refreshed_at
      ),true);
    end if;
    v_deals:=v_deals||jsonb_build_array(v_deal);
  end loop;

  v_base:=jsonb_set(v_base,'{deals}',v_deals,true);
  v_base:=jsonb_set(v_base,'{modelVersion}',to_jsonb('RONA_ADMIN_RAIL_DEAL_MAP_READ_MODEL_V4'::text),true);
  v_base:=jsonb_set(v_base,'{sourcePolicy}',to_jsonb('PUBLIC_SOURCE_ROUTE_GRAPH_PLUS_TRUSTED_DISLOCATION_HISTORY_V1'::text),true);
  return v_base;
end
$fn$;

revoke all on function public.rona_admin_rail_deal_map_read_model_v4(text) from public,anon;
grant execute on function public.rona_admin_rail_deal_map_read_model_v4(text) to authenticated,service_role;
revoke all on function portal_private.rail_normalize_station_text_v1(text) from public,anon,authenticated;
revoke all on function portal_private.rail_resolve_route_v1(text,text) from public,anon,authenticated;
revoke all on function portal_private.rail_detect_deal_origin_v1(uuid) from public,anon,authenticated;
revoke all on function portal_private.rail_detect_deal_destination_v1(uuid) from public,anon,authenticated;
revoke all on function portal_private.rail_route_refresh_assignments_v1() from public,anon,authenticated;
revoke all on function portal_private.rail_deal_route_progress_v1(uuid) from public,anon,authenticated;
grant execute on function portal_private.rail_resolve_route_v1(text,text) to service_role;
grant execute on function portal_private.rail_route_refresh_assignments_v1() to service_role;
grant execute on function portal_private.rail_deal_route_progress_v1(uuid) to service_role;

select portal_private.rail_route_refresh_assignments_v1();

do $cron$
declare v_job bigint;
begin
  select jobid into v_job from cron.job where jobname='rail-route-assignments-v1';
  if v_job is not null then perform cron.unschedule(v_job); end if;
  perform cron.schedule('rail-route-assignments-v1','*/15 * * * *','select portal_private.rail_route_refresh_assignments_v1();');
end
$cron$;

commit;
