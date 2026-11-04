-- =====================================================================
-- Chama Solar · Fase 1 · Orçamento
-- Banco: chamae-apps (PRODUÇÃO do Chamae). NÃO aplicar sem o ok do Victor.
-- Regras: só cria objetos com prefixo sol_ ; não altera nenhuma tabela do Chamae.
-- Desfazer: 001_fase1_orcamento_DESFAZER.sql
-- =====================================================================
begin;

-- ---------- Quem pode usar o módulo solar ----------
create table if not exists public.sol_usuarios (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  papel       text not null default 'vendedor' check (papel in ('admin','vendedor','parceiro')),
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now()
);

-- eh_solar(): true se o usuário logado tem acesso ao módulo solar.
-- security definer + search_path fixo para não ser enganada por objetos de outros schemas.
create or replace function public.eh_solar()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.sol_usuarios u where u.user_id = auth.uid() and u.ativo);
$$;

create or replace function public.eh_solar_admin()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.sol_usuarios u where u.user_id = auth.uid() and u.ativo and u.papel = 'admin');
$$;

revoke all on function public.eh_solar(), public.eh_solar_admin() from public, anon;
grant execute on function public.eh_solar(), public.eh_solar_admin() to authenticated;

-- ---------- Atualiza "atualizado_em" ----------
create or replace function public.sol_tocar_atualizado()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin new.atualizado_em := now(); return new; end; $$;

-- ---------- Parâmetros de preço (versão vigente + histórico) ----------
create table if not exists public.sol_parametros (
  id            bigint generated always as identity primary key,
  vigente       boolean not null default false,
  dados         jsonb not null,            -- mesmo formato de "parametros" em dados-teste.js
  observacao    text,
  criado_por    uuid default auth.uid() references auth.users(id),
  criado_em     timestamptz not null default now()
);
create unique index if not exists sol_parametros_um_vigente on public.sol_parametros (vigente) where vigente;

-- ---------- Irradiação por cidade (base pública) ----------
create table if not exists public.sol_irradiacao (
  id            bigint generated always as identity primary key,
  cidade        text not null,
  uf            char(2) not null default 'SP',
  ibge          text,
  lat           numeric(8,5),
  lon           numeric(8,5),
  hsp_anual     numeric(4,2) not null,     -- kWh/m²·dia, plano inclinado
  hsp_mensal    numeric(4,2)[] check (hsp_mensal is null or array_length(hsp_mensal,1) = 12),
  fonte         text,
  unique (cidade, uf)
);

-- ---------- Fornecedores e cadastro único de equipamentos ----------
create table if not exists public.sol_fornecedores (
  id            bigint generated always as identity primary key,
  nome          text not null unique,      -- Belenergy, ...
  ativo         boolean not null default true,
  obs           text
);

create table if not exists public.sol_equipamentos (
  id            bigint generated always as identity primary key,
  tipo          text not null check (tipo in ('modulo','inversor','bateria','estrutura','outro')),
  fabricante    text not null,
  modelo        text not null,
  potencia_w    numeric(10,2),             -- módulo em W; inversor em W (AC)
  ficha         jsonb not null default '{}'::jsonb,  -- voc, vmp, isc, mppts, v_max_dc, hibrido, area_m2...
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  unique (tipo, fabricante, modelo)
);

create table if not exists public.sol_precos_fornecedor (
  id              bigint generated always as identity primary key,
  equipamento_id  bigint not null references public.sol_equipamentos(id) on delete cascade,
  fornecedor_id   bigint not null references public.sol_fornecedores(id) on delete cascade,
  codigo_fornecedor text,
  preco           numeric(12,2) not null check (preco >= 0),
  origem          text not null default 'planilha' check (origem in ('planilha','robo','api','manual')),
  capturado_em    timestamptz not null default now()
);
create index if not exists sol_precos_ultimo on public.sol_precos_fornecedor (equipamento_id, fornecedor_id, capturado_em desc);

-- ---------- Clientes ----------
create table if not exists public.sol_clientes (
  id              bigint generated always as identity primary key,
  nome            text not null,
  whatsapp        text,
  email           text,
  documento       text,                    -- CPF/CNPJ
  cep             text,
  cidade          text,
  endereco        text,
  instalacao_cpfl text,                    -- número da instalação na conta
  ligacao         text check (ligacao in ('mono','bi','tri')),
  criado_por      uuid default auth.uid() references auth.users(id),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);
create index if not exists sol_clientes_nome on public.sol_clientes (lower(nome));

-- ---------- Orçamentos ----------
create table if not exists public.sol_orcamentos (
  id                bigint generated always as identity primary key,
  codigo            text unique,           -- ORC-0001
  cliente_id        bigint references public.sol_clientes(id) on delete set null,
  vendedor_id       uuid default auth.uid() references auth.users(id),
  status            text not null default 'rascunho'
                    check (status in ('rascunho','enviado','negociando','aceito','perdido','cancelado')),
  etapa             smallint not null default 1 check (etapa between 1 and 6),
  consumos_kwh      numeric(10,2)[] check (consumos_kwh is null or array_length(consumos_kwh,1) = 12),
  tarifa_kwh        numeric(8,4),
  local             jsonb not null default '{}'::jsonb,  -- telhado, orientação, área, km, troca de padrão
  pagamento         jsonb not null default '{}'::jsonb,  -- forma, comissão, desconto, kit direto
  opcao_escolhida   smallint,
  parametros_id     bigint references public.sol_parametros(id),  -- congela os parâmetros usados
  conta_pdf_path    text,                  -- storage
  proposta_pdf_path text,
  motivo_perda      text,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now()
);
create index if not exists sol_orcamentos_status on public.sol_orcamentos (status, atualizado_em desc);

create table if not exists public.sol_orcamento_opcoes (
  id              bigint generated always as identity primary key,
  orcamento_id    bigint not null references public.sol_orcamentos(id) on delete cascade,
  ordem           smallint not null,       -- 0 Econômica, 1 Recomendada, 2 Premium/Híbrida
  nivel           text not null,
  kwp             numeric(10,3) not null,
  placas          integer not null,
  geracao_mes_kwh numeric(10,2),
  itens           jsonb not null,          -- módulo, inversor, bateria, preços de custo usados
  preco_custos    jsonb not null,          -- linhas da composição
  preco_final     numeric(12,2) not null,
  rs_por_wp       numeric(6,2),
  economia        jsonb,                   -- payback, TIR, VPL, tabela 25 anos
  unique (orcamento_id, ordem)
);

create trigger sol_clientes_atualizado before update on public.sol_clientes
  for each row execute function public.sol_tocar_atualizado();
create trigger sol_orcamentos_atualizado before update on public.sol_orcamentos
  for each row execute function public.sol_tocar_atualizado();

-- ---------- RLS em todas ----------
alter table public.sol_usuarios          enable row level security;
alter table public.sol_parametros        enable row level security;
alter table public.sol_irradiacao        enable row level security;
alter table public.sol_fornecedores      enable row level security;
alter table public.sol_equipamentos      enable row level security;
alter table public.sol_precos_fornecedor enable row level security;
alter table public.sol_clientes          enable row level security;
alter table public.sol_orcamentos        enable row level security;
alter table public.sol_orcamento_opcoes  enable row level security;

-- Usuários: cada um vê a própria linha; admin vê e mexe em todas.
create policy sol_usuarios_ver on public.sol_usuarios for select to authenticated
  using (user_id = auth.uid() or public.eh_solar_admin());
create policy sol_usuarios_admin on public.sol_usuarios for all to authenticated
  using (public.eh_solar_admin()) with check (public.eh_solar_admin());

-- Tabelas de referência: quem é do solar lê; só admin grava.
do $$
declare t text;
begin
  foreach t in array array['sol_parametros','sol_irradiacao','sol_fornecedores','sol_equipamentos','sol_precos_fornecedor'] loop
    execute format('create policy %I on public.%I for select to authenticated using (public.eh_solar())', t || '_ler', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.eh_solar_admin()) with check (public.eh_solar_admin())', t || '_admin', t);
  end loop;
end $$;

-- Clientes e orçamentos: quem é do solar lê e grava (hoje só o Victor vende).
create policy sol_clientes_tudo on public.sol_clientes for all to authenticated
  using (public.eh_solar()) with check (public.eh_solar());
create policy sol_orcamentos_tudo on public.sol_orcamentos for all to authenticated
  using (public.eh_solar()) with check (public.eh_solar());
create policy sol_orcamento_opcoes_tudo on public.sol_orcamento_opcoes for all to authenticated
  using (public.eh_solar()) with check (public.eh_solar());

-- Dados iniciais mínimos
insert into public.sol_fornecedores (nome) values ('Belenergy') on conflict (nome) do nothing;

commit;

-- Depois de aplicar, liberar o Victor (trocar pelo id dele em auth.users):
-- insert into public.sol_usuarios (user_id, papel) values ('<UUID-DO-VICTOR>', 'admin');
