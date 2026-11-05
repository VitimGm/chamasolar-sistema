# Belenergy: cotação de KIT FECHADO

**Regra de negócio:** o custo que entra no preço é o **valor final do kit fechado** do
"Personalize seu Gerador → Convencional". Item avulso sai mais caro e não é usado no orçamento.

## Fluxo (mapeado ao vivo no portal em 04/11/2026)
| # | Tela do portal | O que se escolhe |
|---|---|---|
| 1 | Módulo | Potência (kWp) do pré-dimensionamento → tabela em "Menor Preço Por Watt" (sem preço), quantidade e potência sugeridas |
| 2 | Inversor | Tipo (string on-grid, micro, híbrido) → ligação → tensão → fabricantes (AUXSOL, DEYE, GROWATT, HUAWEI, SOLIS, SUNGROW) → Filtrar → lista com % de overload |
| 3 | Estrutura | Com/sem estrutura; arranjos: tipo (Colonial, Telha Fibrocimento, Telha Metálico, Telha Shingle, Laje, Solo), detalhe, nº de linhas, módulos por linha, orientação (Retrato/Paisagem) → Calcular estrutura → itens com + / − / remover |
| 4 | Componentes elétricos CC | Cabos e conectores sugeridos; string box, DPS, RSD, bateria opcionais |
| 5 | Componentes elétricos CA | Opcional |
| 6 | Confirmação | Nome da proposta, estado e cidade de entrega, frete (Cliente Retira / Transportadora escolhida pelo cliente / Belenus Entrega no Cliente), forma de pagamento → **Valor da proposta** |

Os valores reais cotados ficam só no banco (tabelas `sol_`), nunca no código ou na documentação.
Campos da confirmação: `#nomeOrcamento`, `#selectEstado`, `#selectCidade`, `#selectFrete` (entrega já vem SP / Ribeirão Preto).
O robô **nunca** clica em "Comprar Agora". "Salvar" só com a opção marcada pelo vendedor.

No sistema: Novo orçamento → passo 4 "Kit Belenergy". Dá para montar até 3 kits (Econômica, Recomendada, Premium). A Recomendada é obrigatória.

## Arquivos
| Arquivo | Para quê |
|---|---|
| `cotador.mjs` | Robô que conduz o Personalize seu Gerador no seu PC e responde ao sistema em `http://127.0.0.1:8787`. |
| `robo.mjs` | Leitura do catálogo avulso (estoque, preço por Wp). Serve só de referência; **não** é o preço do orçamento. |

## Situação
- Todas as telas mapeadas ao vivo. Falta o 1º teste do robô rodando no seu PC (ajustes finos de clique podem ser necessários).
- Detalhes de estrutura dos tipos diferentes de Colonial: o robô lê na hora, do próprio portal.

## Instalar e rodar (no PC do vendedor)
```bash
cd fontes/solar-belenergy
npm i playwright@1.49.1 && npx playwright install chromium
node cotador.mjs
```
Na 1ª vez faça o login na janela que abrir. A sessão fica em `sessao-belenergy/` (fora do git). **Nenhuma senha no código.**

## Integração oficial
A Belenergy já integra o montador com softwares de proposta (ex.: SolarMarket). Pedir ao gerente de contas a mesma integração continua sendo o caminho mais estável.

## Fila do Jarvis (preço real pelo celular)
1. No sistema: Parâmetros → "Robô do escritório" → "Mostrar a chave do robô".
2. Nesta pasta, crie o arquivo `robo-config.json` e cole o que apareceu, por exemplo `{ "chave": "..." }`.
3. Abra o INICIAR-COTADOR.bat. Deve aparecer "Fila do Jarvis ligada".
O robô confere a fila a cada minuto, cota e salva na Belenergy (com Pix e a WEB). O preço volta sozinho para o orçamento, e você recebe um lembrete no Meu dia. Ele nunca clica em "Comprar Agora". Não mande a chave por mensagem.
