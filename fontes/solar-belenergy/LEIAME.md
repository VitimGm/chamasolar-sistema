# Belenergy: cotação de KIT FECHADO

**Regra de negócio:** o custo que entra no preço é o **valor final do kit fechado** do
"Personalize seu Gerador → Convencional". Item avulso sai mais caro e não é usado no orçamento.

## Fluxo (mapeado ao vivo no portal em 04/11/2026)
| # | Tela do portal | O que se escolhe |
|---|---|---|
| 1 | Módulo | Potência (kWp) do pré-dimensionamento → tabela em "Menor Preço Por Watt" (sem preço), quantidade e potência sugeridas |
| 2 | Inversor | Tipo (string on-grid, micro, híbrido) → ligação → tensão → fabricantes (AUXSOL, DEYE, GROWATT, HUAWEI, SOLIS, SUNGROW) → Filtrar → lista com % de overload |
| 3 | Estrutura | Com/sem estrutura; arranjos: tipo (Colonial, Telha Fibrocimento, **Telha Metálica**, Telha Shingle, Laje, Solo), detalhe, nº de linhas, módulos por linha, orientação (Retrato/Paisagem) → Calcular estrutura → itens com + / − / remover |
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

## Versão 2026-11-10b
- Tira o aviso falso "Valor da tela diferente do carrinho": o carrinho é lido antes do frete, então a diferença era o frete. Agora compara só o valor dos produtos.

## Versão 2026-11-10a
- A Belenergy trocou o campo "Tipo de estrutura" (agora `.combo__trigger`). O robô não achava o campo antigo e dava "arranjo travado / Modificar layout". Agora reconhece os dois jeitos.

## Versão 2026-11-09h
- Forma de pagamento mapeada: caixa "Forma de pagamento:" → janela com Pix / Boleto Antecipado / Financiamentos / Cartão De Crédito. Escolhe Boleto Antecipado (senão Pix) e salva.

## Versão 2026-11-09g
- Para salvar: escolhe a forma de pagamento (Boleto; se não houver, Pix) e o frete padrão passa a ser "Belenus Entrega no Cliente".

## Versão 2026-11-09f
- Se o botão "Salvar" do portal não responder, a cotação não para: o preço volta com aviso "não salvo", print e diagnóstico.

## Versão 2026-11-09e
- Corrige "strict mode violation: locator(body) resolved to 2 elements" ao escolher fabricante do inversor (o portal tem dois <body>).

## Versão 2026-11-09d (mapeado de novo ao vivo em 08/11/2026)
- **Preço pelo carrinho do portal**: além do texto da tela, o robô lê o JSON que o portal manda para a própria tela
  (API `KitPersonalizado`): preço de lista de cada item, desconto do kit (~15%), frete e plano de pagamento.
  Se a tela e o carrinho discordarem, o kit chega no sistema com aviso.
- **Correção de preço**: o portal chama a estrutura de "Telha Metálica" (com A). O sistema procurava "Telha Metálico"
  e o robô caía na 1ª opção (Colonial): telhado metálico saía com estrutura colonial (~10% a mais no kit).
  Agora os nomes vêm da própria API e, se a estrutura pedida não existir, o robô PARA (nunca troca por outra).
- **Escolha do módulo**: menor custo por kWp instalado (placa + estrutura + mão de obra por placa), não só o menor R$/W.
- **Inversor**: dentro da faixa de overload (Parâmetros → Robô de cotação), o mais barato.
- **Mais rápido**: espera a resposta da API em vez de esperar a tela "parar"; pré-propostas do mesmo tamanho
  são cotadas juntas (só troca a estrutura, sem refazer módulo e inversor).
- **Uma cotação por vez**: a do vendedor e a da fila não se misturam mais na mesma tela.
- **Cupons**: 2× por dia o robô abre "Ver cupons" (só leitura) e o sistema mostra no Radar antes de vencer.
- Pagamento: Pix e "Plano de Pagamento" dão o mesmo valor (conferido em 08/11/2026). Para salvar, o robô escolhe Boleto (ou Pix se não houver); dá para trocar depois no portal.

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
1. No sistema: Parâmetros → "Robô do escritório" → "⬇ Baixar robo-config.json".
2. Salve esse arquivo NESTA pasta (a mesma do INICIAR-COTADOR.bat).
3. Abra o INICIAR-COTADOR.bat. Deve aparecer "Fila do Jarvis ligada".
Pré-propostas: em Parâmetros, ligue "Pré-propostas todo dia de manhã", toque em "Sugerir pelas mais vendidas" e salve. O robô cota esses tamanhos no horário escolhido (ou assim que o computador ligar).
O robô confere a fila a cada minuto, cota e salva na Belenergy (com Boleto e a WEB). O preço volta sozinho para o orçamento, e você recebe um lembrete no Meu dia. Ele nunca clica em "Comprar Agora". Não mande a chave por mensagem.

## Se der problema
Tudo o que aparece na janela preta também fica gravado em `robo.log`, nesta pasta. O sistema mostra em Parâmetros → Robô do escritório se o robô está ligado, a versão e se a Belenergy está conectada.
