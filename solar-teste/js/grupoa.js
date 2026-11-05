/* =====================================================================
   GRUPO A (média tensão: supermercado, indústria, hospital…)
   A conta tem três partes: consumo na PONTA, consumo FORA DA PONTA e a
   DEMANDA contratada (R$/kW). A usina gera quase tudo fora da ponta.
   Compensação (REN 1000 e Lei 14.300):
   - o que é consumido na hora em que gera (simultâneo) abate direto;
   - o que vai para a rede compensa primeiro o fora ponta;
   - a sobra compensa a ponta pela relação das tarifas de energia (TE):
       1 kWh de ponta = (TE ponta ÷ TE fora ponta) kWh de crédito;
   - a parte "Fio B" da TUSD não é compensada (60% em 2026, 75% em 2027…);
   - a demanda continua igual na conta (a usina não reduz a demanda).
   As tarifas são digitadas da fatura, COM impostos.
   ===================================================================== */
(function (raiz) {
  'use strict';
  const arred = (v, c = 2) => Math.round(v * 10 ** c) / 10 ** c;
  const media = (v) => { const x = (v || []).map(Number).filter((n) => n > 0); return x.length ? x.reduce((s, n) => s + n, 0) / x.length : 0; };
  const PADRAO = { modalidade: 'verde', consumoP: Array(12).fill(''), consumoFP: Array(12).fill(''), demanda: 0, demandaP: 0, demandaFP: 0,
    tarifas: { teP: 0, tusdP: 0, teFP: 0, tusdFP: 0, demanda: 0, demandaP: 0 }, fioBParte: 0.5, simultaneidade: 0.6, alvo: 'fp', limitarDemanda: false };
  const novo = () => JSON.parse(JSON.stringify(PADRAO));
  const completo = (ga) => { const t = (ga && ga.tarifas) || {}; return media(ga && ga.consumoFP) > 0 && t.teFP > 0 && t.tusdFP >= 0 && (t.teP > 0 || !(media(ga.consumoP) > 0)); };
  /* 1 kWh de ponta vale "fa" kWh de crédito gerado fora da ponta */
  const fatorAjuste = (ga) => { const t = ga.tarifas || {}; return t.teFP > 0 && t.teP > 0 ? t.teP / t.teFP : 1; };
  /* consumo que o motor usa para dimensionar: só o fora ponta, ou fora ponta + ponta convertida em crédito */
  function consumosParaDimensionar(ga) {
    const fa = fatorAjuste(ga);
    return Array.from({ length: 12 }, (_, i) => { const fp = Number(ga.consumoFP[i]) || 0, pt = Number(ga.consumoP[i]) || 0; const v = fp + (ga.alvo === 'total' ? pt * fa : 0); return v > 0 ? Math.round(v) : ''; });
  }
  /* conta de cada mês (ponta + fora ponta + demanda), para as barras da proposta */
  function mensal(ga) {
    const t = ga.tarifas || {}, vP = (t.teP || 0) + (t.tusdP || 0), vFP = (t.teFP || 0) + (t.tusdFP || 0), dem = demandaMes(ga);
    return Array.from({ length: 12 }, (_, i) => arred((Number(ga.consumoP[i]) || 0) * vP + (Number(ga.consumoFP[i]) || 0) * vFP + dem));
  }
  /* demanda que limita a usina: a potência do inversor (CA) não passa dela */
  const demandaLimite = (ga) => (ga.modalidade === 'azul' ? Math.max(+ga.demandaFP || 0, +ga.demandaP || 0) : +ga.demanda || 0);
  function demandaMes(ga) { const t = ga.tarifas || {}; return ga.modalidade === 'azul' ? (Number(ga.demandaFP) || 0) * (t.demanda || 0) + (Number(ga.demandaP) || 0) * (t.demandaP || 0) : (Number(ga.demanda) || 0) * (t.demanda || 0); }

  function economia(ga, { geracaoMes, investimento, anoInicio }, p) {
    const M = raiz.Motor, t = ga.tarifas || {}, cP = media(ga.consumoP), cFP = media(ga.consumoFP), fa = fatorAjuste(ga), dem = demandaMes(ga);
    const vFP = (t.teFP || 0) + (t.tusdFP || 0), vP = (t.teP || 0) + (t.tusdP || 0), sim = ga.simultaneidade ?? 0.6, parte = ga.fioBParte ?? 0.5;
    const contaAtual = cP * vP + cFP * vFP + dem;
    const fluxos = [-investimento], tabela = []; let acumulado = -investimento, payback = null, mes1 = null;
    for (let a = 0; a < 25; a++) {
      const ano = anoInicio + a, reaj = (1 + p.reajusteAnual) ** a, fb = parte * M.fioBPct(ano, p);
      const ger = geracaoMes * (1 - p.degradacaoAnual) ** a;
      const auto = Math.min(ger * sim, cFP), inj = ger - auto;
      const compFP = Math.min(inj, Math.max(cFP - auto, 0)), sobra = inj - compFP, compP = Math.min(sobra / fa, cP), credito = sobra - compP * fa;
      const econMes = (auto * vFP + compFP * ((t.teFP || 0) + (t.tusdFP || 0) * (1 - fb)) + compP * ((t.teP || 0) + (t.tusdP || 0) * (1 - fb))) * reaj;
      if (a === 0) mes1 = { auto, compFP, compP, credito, fioB: fb, naoCompensado: (compFP * (t.tusdFP || 0) + compP * (t.tusdP || 0)) * fb,
        depoisFP: Math.max(cFP - auto - compFP, 0) * vFP + compFP * (t.tusdFP || 0) * fb, depoisP: Math.max(cP - compP, 0) * vP + compP * (t.tusdP || 0) * fb };
      const econAno = econMes * 12; acumulado += econAno;
      if (payback === null && acumulado >= 0) { const ant = acumulado - econAno; payback = a + (-ant / econAno); }
      fluxos.push(econAno); tabela.push({ ano, tarifa: arred(vFP * reaj, 3), fioBPct: M.fioBPct(ano, p), economiaAno: arred(econAno), acumulado: arred(acumulado) });
    }
    const econ1 = tabela[0].economiaAno / 12;
    return {
      contaAtual: arred(contaAtual), economiaMes1: arred(econ1), contaDepois: arred(Math.max(contaAtual - econ1, dem)),
      paybackAnos: payback === null ? null : arred(payback, 1), tir: arred(M.tir(fluxos), 4), vpl: arred(M.vpl(fluxos, p.taxaDesconto)),
      economia25: arred(tabela.reduce((s, x) => s + x.economiaAno, 0)), tabela,
      grupoA: { modalidade: ga.modalidade, cP: arred(cP, 0), cFP: arred(cFP, 0), fa: arred(fa, 3), demandaMes: arred(dem), demandaKw: ga.modalidade === 'azul' ? { p: +ga.demandaP || 0, fp: +ga.demandaFP || 0 } : +ga.demanda || 0,
        valorP: arred(cP * vP), valorFP: arred(cFP * vFP), depoisP: arred(mes1.depoisP), depoisFP: arred(mes1.depoisFP), tarifaMedia: cP + cFP > 0 ? arred((cP * vP + cFP * vFP) / (cP + cFP), 3) : vFP,
        autoconsumo: arred(mes1.auto, 0), compensadoFP: arred(mes1.compFP, 0), compensadoP: arred(mes1.compP, 0), creditoSobra: arred(mes1.credito, 0), fioBMes: arred(mes1.naoCompensado), fioBPct: mes1.fioB, simultaneidade: sim },
    };
  }
  /* limite da usina no Grupo A: a potência do inversor não passa da demanda contratada */
  function limiteDemanda(ga, potInvKw) { const d = demandaLimite(ga); return { demandaKw: d, potInvKw: arred(potInvKw || 0, 1), ok: !d || potInvKw <= d + 0.01, falta: d ? Math.max(0, Math.ceil(potInvKw - d)) : 0 }; }
  /* "limitar à demanda": maior consumo a dimensionar sem passar da demanda (inversor com 25% de sobrecarga CC/CA) */
  function consumoMaximo(ga, { hspEf, pr, margem = 0 }) { const d = demandaLimite(ga); return d > 0 && hspEf > 0 ? (d * 1.25 * hspEf * 30 * pr) / (1 + margem) : Infinity; }

  raiz.GrupoA = { novo, completo, fatorAjuste, consumosParaDimensionar, demandaMes, demandaLimite, mensal, economia, limiteDemanda, consumoMaximo, media };
})(typeof window !== 'undefined' ? window : globalThis);
