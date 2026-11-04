# solar-teste — Central de vendas + Proposta Viva (dados simulados)

Abra `index.html` no navegador. Não precisa instalar nada e **nada vai para o Supabase**: o banco de teste é o próprio navegador. "recomeçar dados" (no menu) recria os 7 clientes de exemplo.

## A estratégia em uma frase
O cliente não compra kit, compra o fim de uma dor. Então a proposta **abre pela dor dele, com os números dele**, mostra o custo de não fazer nada e só depois apresenta o preço — como **troca de boleto**, não como gasto.

## As duas telas

### 1. Central de vendas (`index.html`) — para o Victor
- **Painel**: dinheiro em negociação, clientes quentes agora, % de propostas abertas, taxa de fechamento e **"Fazer agora"** (a próxima melhor ação de cada cliente, em ordem).
- **Funil** com temperatura (frio/morno/quente) calculada pelo que o cliente faz na proposta.
- **Ficha do cliente**: linha do tempo do que ele fez ("simulou 84x", "mostrou para outra pessoa"), raio-x e os **5 agentes**.
- **Novo orçamento** em 6 passos, terminando em "Gerar Proposta Viva".
- **Parâmetros** de preço editáveis.

### 2. Proposta Viva (`proposta.html?t=...`) — para o cliente, no celular
1. "Você pagou R$ X de luz nos últimos 12 meses" (conta dele, não média)
2. Raio-x mês a mês + as dores detectadas (picos de verão, consumo subindo, negócio)
3. Quanto ele paga em 25 anos se nada mudar, com o gráfico da virada
4. **Relógio da conta**: dinheiro indo para a CPFL enquanto ele lê + custo da espera
5. A solução e o **custo real da energia** (R$/kWh do sistema × tarifa CPFL)
6. **Troca de boleto** interativa (prazo e entrada)
7. As 3 opções (Econômica / Recomendada / Premium-Híbrida)
8. **Usinas vizinhas**: contas reais de clientes na mesma cidade (no oficial vem do monitoramento)
9. Dúvidas respondidas com os números dele
10. Aceite, "falar com o Victor" e **"mostrar para quem decide comigo"**

Tudo que ele faz vira evento → temperatura → próxima ação na ficha. Com `&v=1` (botão "Abrir Proposta Viva") suas visitas não contam.

## Os agentes
| Agente | O que entrega |
|---|---|
| Diagnóstico da Dor | dor principal, argumentos na ordem certa, perguntas de descoberta |
| Roteirista | WhatsApp de envio, áudio de 30 s, roteiro de ligação em 5 passos |
| Matador de Objeções | resposta para "tá caro", "vou pensar", "falar com a esposa"… com os números dele |
| Follow-up | cadência de 21 dias que muda conforme o cliente se comporta |
| Comparador | tabela honesta contra o orçamento do concorrente |
| Analista de Funil | gargalos e motivos de perda (tela Agentes) |

No teste respondem por regras. No oficial chamam a IA pela Edge Function `fontes/solar-agentes` (prompts em `prompts.ts`), com a mesma saída.

## Regras de honestidade (para não virar truque)
- Urgência só com fato: custo da espera calculado, validade real da cotação, reajuste real da CPFL (+9,25% residencial em abr/2026).
- Prova social só com dado real (usinas monitoradas). No teste está marcado como simulado.
- Nenhum selo "mais vendido" sem dado.

## Arquivos
`js/motor.js` (técnico e preço) · `js/conversao.js` (dor, espera, LCOE, temperatura, próxima ação) · `js/agentes.js` · `js/banco.js` (banco simulado com o formato do Supabase) · `js/dados-teste.js` (**tudo simulado**) · `js/app.js` · `js/proposta.js` · `css/marca.css` (cores e fontes do site) · `marca/` (logos).
