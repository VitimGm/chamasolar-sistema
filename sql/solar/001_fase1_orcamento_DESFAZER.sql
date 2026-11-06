-- =====================================================================
-- DESFAZ 001_fase1_orcamento.sql
-- Apaga SOMENTE objetos sol_ / eh_solar*. Nenhuma tabela do Chamae é tocada.
-- Se já houver dados reais, fazer backup antes (bkp_AAAAMMDD_nome), ex.:
--   create table public.bkp_20261103_sol_orcamentos as table public.sol_orcamentos;
-- =====================================================================
begin;

drop table if exists public.sol_orcamento_opcoes  cascade;
drop table if exists public.sol_orcamentos        cascade;
drop table if exists public.sol_clientes          cascade;
drop table if exists public.sol_precos_fornecedor cascade;
drop table if exists public.sol_equipamentos      cascade;
drop table if exists public.sol_fornecedores      cascade;
drop table if exists public.sol_irradiacao        cascade;
drop table if exists public.sol_parametros        cascade;
drop table if exists public.sol_usuarios          cascade;

drop function if exists public.sol_tocar_atualizado();
drop function if exists public.eh_solar_admin();
drop function if exists public.eh_solar();

commit;
