-- 006 · Erros do robô Belenergy (para o Claude analisar) e anexos das cotações (PDF da Belenergy)
create table if not exists public.sol_robo_erros (
  id bigserial primary key,
  em timestamptz not null default now(),
  usuario uuid default auth.uid(),
  orcamento text,
  opcao text,
  etapa text,
  mensagem text,
  diagnostico jsonb,          -- url, avisos do portal, linhas visíveis, trecho da tela, entrada do passo
  print_jpg text,             -- print da tela (base64, jpeg pequeno)
  resolvido boolean not null default false
);
create table if not exists public.sol_anexos (
  id bigserial primary key,
  em timestamptz not null default now(),
  orcamento text not null,    -- ORC-0001
  nome text not null,         -- ex.: WEB-123456.pdf
  tipo text not null default 'application/pdf',
  conteudo_b64 text not null
);
create index if not exists sol_anexos_orc on public.sol_anexos (orcamento);
alter table public.sol_robo_erros enable row level security;
alter table public.sol_anexos enable row level security;
create policy sol_robo_erros_tudo on public.sol_robo_erros for all to authenticated using (public.eh_solar()) with check (public.eh_solar());
create policy sol_anexos_tudo on public.sol_anexos for all to authenticated using (public.eh_solar()) with check (public.eh_solar());
revoke all on public.sol_robo_erros, public.sol_anexos from anon;
