-- DESFAZ 004_usinas_monitoramento.sql. Com dados reais, backup antes:
--   create table public.bkp_AAAAMMDD_sol_geracao as table public.sol_geracao;
--   create table public.bkp_AAAAMMDD_sol_usinas  as table public.sol_usinas;
begin;
drop table if exists public.sol_geracao cascade;
drop table if exists public.sol_usinas  cascade;
commit;
