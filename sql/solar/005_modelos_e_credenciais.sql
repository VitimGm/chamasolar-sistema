-- Chama Solar · 005 · Modelos de documento (contrato, procuração) e cofre de acessos
-- Aplicado em 04/11/2026. O TEXTO dos modelos fica só no banco (tem dados bancários
-- e do engenheiro): não versionar aqui. Desfazer: 005_modelos_e_credenciais_DESFAZER.sql
create table if not exists public.sol_modelos (
  chave text primary key check (chave in ('contrato','procuracao')), titulo text not null, corpo text not null,
  versao integer not null default 1, atualizado_em timestamptz not null default now(), atualizado_por uuid default auth.uid() references auth.users(id));
alter table public.sol_modelos enable row level security;
create policy sol_modelos_ler on public.sol_modelos for select to authenticated using (public.eh_solar());
create policy sol_modelos_admin on public.sol_modelos for all to authenticated using (public.eh_solar_admin()) with check (public.eh_solar_admin());
-- sol_guardar_credencial(marca, dados) e sol_credenciais_status(): só admin; valores no Vault (vault.secrets 'sol_cred_<marca>')
