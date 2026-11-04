-- =====================================================================
-- Chama Solar · 003 · App ligado ao banco + vitrine pública segura
-- Depende de 001 e 002. Só mexe em objetos sol_.
-- Desfazer: 003_app_e_vitrine_DESFAZER.sql
--
-- dados   = o orçamento completo como o app usa (custos, kit, margens).
--           Só quem é do solar lê (RLS da 001).
-- vitrine = o que o CLIENTE pode ver: preço final congelado, equipamentos,
--           geração, economia. Nenhum custo, margem ou valor de kit.
-- =====================================================================
begin;

alter table public.sol_orcamentos
  add column if not exists dados   jsonb not null default '{}'::jsonb,
  add column if not exists vitrine jsonb;

-- A leitura pública passa a devolver SÓ a vitrine (antes devolvia os parâmetros, que têm custos)
create or replace function public.sol_proposta_publica(p_token text)
returns jsonb
language sql stable security definer
set search_path = public, pg_temp
as $$
  select o.vitrine || jsonb_build_object('status', o.status, 'token', o.token_publico)
  from public.sol_orcamentos o
  where o.token_publico = p_token and length(p_token) >= 20 and o.status <> 'novo' and o.vitrine is not null;
$$;

-- Eventos do cliente (só pelo token)
create or replace function public.sol_registrar_evento(p_token text, p_tipo text, p_dados jsonb default '{}'::jsonb)
returns boolean
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_id bigint; v_status text; v_qtd int; v_novo text;
begin
  if p_tipo not in ('abriu','viu','simulou','escolheu','compartilhou','whatsapp','duvida','aceite') then return false; end if;
  if pg_column_size(p_dados) > 2048 then return false; end if;
  select id, status into v_id, v_status from public.sol_orcamentos
   where token_publico = p_token and length(p_token) >= 20 and status <> 'novo';
  if v_id is null then return false; end if;
  select count(*) into v_qtd from public.sol_proposta_eventos where orcamento_id = v_id and em > now() - interval '1 day';
  if v_qtd >= 300 then return false; end if;

  insert into public.sol_proposta_eventos (orcamento_id, tipo, dados) values (v_id, p_tipo, coalesce(p_dados, '{}'::jsonb));

  v_novo := v_status;
  if v_status not in ('ganho','perdido') then
    if p_tipo = 'aceite' then v_novo := 'ganho';
    elsif p_tipo in ('simulou','compartilhou','whatsapp','escolheu') and v_status in ('proposta','visualizou') then v_novo := 'negociando';
    elsif p_tipo = 'abriu' and v_status = 'proposta' then v_novo := 'visualizou';
    end if;
  end if;
  if v_novo <> v_status or p_tipo = 'aceite' then
    update public.sol_orcamentos
       set status = v_novo,
           aceite = case when p_tipo = 'aceite' then p_dados else aceite end,
           dados  = jsonb_set(dados || case when p_tipo = 'aceite' then jsonb_build_object('aceite', p_dados) else '{}'::jsonb end, '{status}', to_jsonb(v_novo))
     where id = v_id;
  end if;
  return true;
end; $$;

revoke all on function public.sol_proposta_publica(text), public.sol_registrar_evento(text, text, jsonb) from public;
grant execute on function public.sol_proposta_publica(text), public.sol_registrar_evento(text, text, jsonb) to anon, authenticated;

commit;
