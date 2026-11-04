-- =====================================================================
-- DESFAZ 002_conversao.sql (volta ao estado da 001). Só objetos sol_.
-- Com dados reais, fazer backup antes, ex.:
--   create table public.bkp_AAAAMMDD_sol_proposta_eventos as table public.sol_proposta_eventos;
-- =====================================================================
begin;

drop function if exists public.sol_registrar_evento(text, text, jsonb);
drop function if exists public.sol_proposta_publica(text);
drop table if exists public.sol_agentes_execucoes cascade;
drop table if exists public.sol_interacoes        cascade;
drop table if exists public.sol_proposta_eventos  cascade;

alter table public.sol_orcamentos drop constraint if exists sol_orcamentos_status_check;
update public.sol_orcamentos set status = case status
  when 'novo' then 'rascunho' when 'proposta' then 'enviado' when 'visualizou' then 'enviado'
  when 'ganho' then 'aceito' else status end;
alter table public.sol_orcamentos add constraint sol_orcamentos_status_check
  check (status in ('rascunho','enviado','negociando','aceito','perdido','cancelado'));
alter table public.sol_orcamentos alter column status set default 'rascunho';

alter table public.sol_orcamentos
  drop column if exists aceite,
  drop column if exists enviado_em,
  drop column if exists origem,
  drop column if exists token_publico;

commit;
