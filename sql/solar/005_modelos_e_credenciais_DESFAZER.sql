-- DESFAZ 005
begin;
drop function if exists public.sol_guardar_credencial(text, jsonb);
drop function if exists public.sol_credenciais_status();
delete from vault.secrets where name like 'sol\_cred\_%';
drop table if exists public.sol_modelos;
commit;
