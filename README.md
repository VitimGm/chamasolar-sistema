# Chama Solar — Sistema

Módulo solar que vai entrar no Chamae como uma "representada", usando o mesmo Supabase (`chamae-apps`).

## Pastas

| Pasta | Para quê |
|---|---|
| `solar-teste/` | Versão de teste. Pode quebrar. |
| `solar/` | Versão oficial (só recebe o que foi aprovado no teste). |
| `solar-anterior/` | Cópia da oficial anterior, para voltar atrás. |
| `fontes/solar-*/` | Edge Functions (leitura de conta com IA, preços, monitoramento). |
| `sql/solar/` | SQL numerado. Todo arquivo tem o seu `_DESFAZER.sql` junto. |

## O que já existe em `solar-teste/`
Central de vendas (painel, funil com temperatura, ficha com 5 agentes, orçamento em 6 passos) e a **Proposta Viva**, o link interativo que substitui o PDF. Detalhes em `solar-teste/LEIAME.md`.

## SQL
- `001_fase1_orcamento` — clientes, orçamentos, opções, equipamentos, preços, parâmetros, irradiação.
- `002_conversao` — link público da proposta, eventos do cliente, interações, execuções dos agentes; funções `sol_proposta_publica` e `sol_registrar_evento` (únicas portas para quem não tem login).

## Regras do banco

- O `chamae-apps` é o banco de **produção** do Chamae.
- Tabelas novas só com prefixo `sol_`, RLS ligado em todas, acesso pela função `eh_solar()`.
- Nunca mexer em tabelas do Chamae sem ok. Antes de qualquer limpeza: `bkp_AAAAMMDD_nome`.
