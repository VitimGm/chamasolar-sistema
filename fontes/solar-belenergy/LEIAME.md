# Robô de preços Belenergy

## Caminhos, do melhor para o pior
1. **Integração oficial (recomendado).** A Belenergy já integra com softwares de proposta (ex.: SolarMarket monta kits Belenergy direto). Peça ao seu gerente de contas acesso à mesma integração/API para o sistema da Chama Solar. Preço, estoque e montagem de kit vêm prontos, sem robô.
2. **Robô no seu PC (este).** Usa a sua própria sessão: você faz o login, ele só lê o catálogo como você leria. Roda 1x por dia. Antes de usar, confira nos termos de uso do portal se leitura automatizada é permitida.
3. **Planilha.** Se a Belenergy mandar a tabela de preços, a central importa o CSV.

## O que o robô lê (mapeado em 03/11/2026)
- Endpoint interno da vitrine: `POST /api/catalogo/catalogo/vitrine` com `{siteId, familia, skip, take}`.
- Por item: SKU, descrição, preço, **R$/Wp**, estoque, embalagem, disponibilidade por estado (SP/ES/GO), marca, foto.
- Montador "Personalize seu Gerador": `KitPersonalizado/Modulos` (potência → módulos sugeridos) e `KitPersonalizado/InversorFiltro` (tipo, ligação, tensão, fabricante). Pode ser usado numa fase 2 para montar o kit pelo próprio montador da Belenergy.

## Segurança
- **Nenhuma senha no código, no repositório ou no Supabase.** A sessão fica em `sessao-belenergy/` (no `.gitignore`), só no seu PC.
- O robô não clica em carrinho, orçamento ou pedido.
- Como a senha foi compartilhada em conversa, troque-a no portal (Minha Conta > Senha de acesso).

## Uso
```bash
cd fontes/solar-belenergy
npm i playwright@1.49.1 && npx playwright install chromium
node robo.mjs
```
Depois: Central de vendas → **Catálogo** → "Importar arquivo do robô" → marque os produtos que você quer usar e o nível de cada um (Econômica, Recomendada, Premium).
