-- 007 · Treino do robô: cada cotação de teste (cenário, deu certo?, tempo, valor, erro)
create table if not exists public.sol_robo_treino (
  id bigserial primary key, em timestamptz not null default now(), lote text, cenario jsonb not null, ok boolean not null,
  segundos numeric, valor_kit numeric, rs_wp numeric, kit jsonb, etapa text, erro text);
create index if not exists sol_robo_treino_lote on public.sol_robo_treino (lote);
alter table public.sol_robo_treino enable row level security;
create policy sol_robo_treino_tudo on public.sol_robo_treino for all to authenticated using (public.eh_solar()) with check (public.eh_solar());
revoke all on public.sol_robo_treino from anon;
-- 008 · contas de luz das usinas (relatório de economia)
-- (aplicada como sol_010_faturas; ver tabela sol_faturas)
