-- =====================================================================
-- DESFAZ 003_app_e_vitrine.sql (volta ao estado da 002). Só objetos sol_.
-- Com dados reais, fazer backup antes, ex.:
--   create table public.bkp_AAAAMMDD_sol_orcamentos as table public.sol_orcamentos;
-- =====================================================================
begin;

-- ---------- Leitura pública da proposta (só pelo token) ----------
create or replace function public.sol_proposta_publica(p_token text)
returns jsonb
language sql stable security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'codigo', o.codigo, 'status', o.status, 'enviado_em', o.enviado_em, 'criado_em', o.criado_em,
    'cliente', jsonb_build_object('nome', c.nome, 'cidade', c.cidade, 'ligacao', c.ligacao),  -- sem telefone/documento
    'consumos_kwh', o.consumos_kwh, 'tarifa_kwh', o.tarifa_kwh, 'local', o.local, 'pagamento', o.pagamento,
    'opcao_escolhida', o.opcao_escolhida, 'aceite', o.aceite,
    'opcoes', (select coalesce(jsonb_agg(jsonb_build_object('ordem', op.ordem, 'nivel', op.nivel, 'kwp', op.kwp, 'placas', op.placas,
                 'geracao_mes_kwh', op.geracao_mes_kwh, 'itens', op.itens, 'preco_final', op.preco_final, 'economia', op.economia) order by op.ordem), '[]'::jsonb)
               from public.sol_orcamento_opcoes op where op.orcamento_id = o.id),
    'parametros', (select p.dados from public.sol_parametros p where p.id = o.parametros_id)
  )
  from public.sol_orcamentos o
  left join public.sol_clientes c on c.id = o.cliente_id
  where o.token_publico = p_token and length(p_token) >= 20 and o.status <> 'novo';
$$;

-- ---------- Registro de evento pelo cliente (só pelo token) ----------
create or replace function public.sol_registrar_evento(p_token text, p_tipo text, p_dados jsonb default '{}'::jsonb)
returns boolean
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_id bigint; v_status text; v_qtd int;
begin
  if p_tipo not in ('abriu','viu','simulou','escolheu','compartilhou','whatsapp','duvida','aceite') then return false; end if;
  if pg_column_size(p_dados) > 2048 then return false; end if;
  select id, status into v_id, v_status from public.sol_orcamentos
   where token_publico = p_token and length(p_token) >= 20 and status <> 'novo';
  if v_id is null then return false; end if;
  -- trava contra abuso: no máximo 300 eventos por proposta por dia
  select count(*) into v_qtd from public.sol_proposta_eventos where orcamento_id = v_id and em > now() - interval '1 day';
  if v_qtd >= 300 then return false; end if;

  insert into public.sol_proposta_eventos (orcamento_id, tipo, dados) values (v_id, p_tipo, coalesce(p_dados, '{}'::jsonb));

  -- o funil anda sozinho com o comportamento do cliente
  if v_status not in ('ganho','perdido') then
    if p_tipo = 'aceite' then
      update public.sol_orcamentos set status = 'ganho', aceite = p_dados where id = v_id;
    elsif p_tipo in ('simulou','compartilhou','whatsapp','escolheu') and v_status in ('proposta','visualizou') then
      update public.sol_orcamentos set status = 'negociando' where id = v_id;
    elsif p_tipo = 'abriu' and v_status = 'proposta' then
      update public.sol_orcamentos set status = 'visualizou' where id = v_id;
    end if;
  end if;
  return true;
end; $$;

revoke all on function public.sol_proposta_publica(text), public.sol_registrar_evento(text, text, jsonb) from public;
grant execute on function public.sol_proposta_publica(text), public.sol_registrar_evento(text, text, jsonb) to anon, authenticated;

alter table public.sol_orcamentos drop column if exists vitrine, drop column if exists dados;

commit;
