# Belenergy: cotação de KIT FECHADO

**Regra de negócio:** o custo que entra no preço é o **valor final do kit fechado** do
"Personalize seu Gerador → Convencional". Item avulso sai mais caro e não é usado no orçamento.

## Fluxo (igual ao portal belenus.com.br)
1. **Potência (kWp)**: vem do pré-dimensionamento do sistema (consumo que dá para zerar + margem).
2. **Módulo**: opções na ordem do portal, do mais barato para o mais caro (menor preço por Watt). O vendedor escolhe e pode ajustar a quantidade.
3. **Inversor**: tipo (string on-grid, micro ou híbrido), ligação, tensão e fabricante → filtrar → escolher.
4. **Estrutura**: tipo, detalhe, número de linhas, módulos por linha e orientação.
5. **Componentes**: aumentar, diminuir ou tirar.
6. **Componentes elétricos**: opcional.
7. **Orçamento**: nome, tipo de frete e forma de pagamento → **valor do kit solar**.

No sistema: Novo orçamento → passo 4 "Kit Belenergy". Dá para montar até 3 kits (Econômica, Recomendada, Premium). A Recomendada é obrigatória.

## Arquivos
| Arquivo | Para quê |
|---|---|
| `cotador.mjs` | Robô que conduz o Personalize seu Gerador no seu PC e responde ao sistema em `http://127.0.0.1:8787`. |
| `cotador.mjs --mapear` | Você faz um orçamento à mão; ele grava os campos de cada tela em `mapa-telas.json` (para ajustar as etapas 4 a 7). |
| `robo.mjs` | Leitura do catálogo avulso (estoque, preço por Wp). Serve só de referência; **não** é o preço do orçamento. |

## Situação do mapeamento
- Etapas 1–3 (potência, módulo, inversor): mapeadas no portal em 03/11/2026.
- Etapas 4–7 (estrutura, componentes, elétricos, orçamento): o robô lê os campos da própria tela. Precisa de uma passada real (`--mapear`) para fixar os nomes dos campos e o texto do botão final.

## Instalar e rodar (no PC do vendedor)
```bash
cd fontes/solar-belenergy
npm i playwright@1.49.1 && npx playwright install chromium
node cotador.mjs
```
Na 1ª vez faça o login na janela que abrir. A sessão fica em `sessao-belenergy/` (fora do git). **Nenhuma senha no código.**

## Integração oficial
A Belenergy já integra o montador com softwares de proposta (ex.: SolarMarket). Pedir ao gerente de contas a mesma integração continua sendo o caminho mais estável.
