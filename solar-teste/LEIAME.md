# solar-teste — Orçamento em 6 passos (dados simulados)

Abrir `index.html` no navegador. Não precisa instalar nada e **não grava no Supabase**: o "banco" é o próprio navegador (localStorage).

## Arquivos

- `motor.js` — cálculos: dimensionamento, DC/AC, strings, preço (fórmula nova), parcela, economia com Fio B, payback/TIR/VPL.
- `dados-teste.js` — **todos os números simulados**: parâmetros de preço, catálogo de kits, irradiação, CEPs, contas de exemplo.
- `app.js` / `index.html` / `estilo.css` — as telas.
- `prints/` — telas no celular (390 px) e no PC (1366 px).

## Fórmula de preço

```
Preço = (custos diretos + taxa fixa do projeto) ÷ (1 − (impostos + taxa de pagamento + comissão + margem + reserva))
```

- Taxa fixa = custo fixo do mês ÷ obras previstas.
- Kit faturado direto: o kit sai da nota da Chama Solar e o imposto incide só no serviço.
- Reserva de negociação = desconto máximo que o vendedor pode dar.
- Fator X do Groner removido.

## O que trocar quando chegarem os dados reais

Em `dados-teste.js` (ou na tela Parâmetros): custo fixo do mês, alíquotas, preço do terceiro por placa, material CA, preços da Belenergy, irradiação por cidade, tarifa CPFL.
