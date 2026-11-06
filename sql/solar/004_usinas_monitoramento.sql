-- =====================================================================
-- Chama Solar · 004 · Usinas e geração (monitoramento sem SolarZ)
-- Só cria objetos sol_. Desfazer: 004_usinas_monitoramento_DESFAZER.sql
-- A geração chega pelas plataformas dos fabricantes (robô/API, 1x por dia)
-- ou por planilha exportada da plataforma.
-- =====================================================================
begin;

create table if not exists public.sol_usinas (
  id              bigint generated always as identity primary key,
  orcamento_id    bigint references public.sol_orcamentos(id) on delete set null,
  cliente_nome    text not null,
  whatsapp        text,
  cidade          text,
  kwp             numeric(10,3) not null check (kwp > 0),
  marca           text not null,                    -- Auxsol, Huawei, Deye, Growatt, Solis, Sungrow...
  plataforma_id   text,                             -- id da usina na plataforma do fabricante
  ligada_em       date,
  esperado_mes    numeric(10,2),                    -- kWh/mês médio prometido
  tarifa_kwh      numeric(8,4),
  ativo           boolean not null default true,
  obs             text,
  criado_em       timestamptz not null default now(),
  unique (marca, plataforma_id)
);

create table if not exists public.sol_geracao (
  usina_id   bigint not null references public.sol_usinas(id) on delete cascade,
  dia        date not null,
  kwh        numeric(12,3) not null check (kwh >= 0),
  origem     text not null default 'planilha' check (origem in ('planilha','api','robo','manual')),
  lido_em    timestamptz not null default now(),
  primary key (usina_id, dia)
);

alter table public.sol_usinas  enable row level security;
alter table public.sol_geracao enable row level security;
create policy sol_usinas_tudo  on public.sol_usinas  for all to authenticated using (public.eh_solar()) with check (public.eh_solar());
create policy sol_geracao_tudo on public.sol_geracao for all to authenticated using (public.eh_solar()) with check (public.eh_solar());

commit;
