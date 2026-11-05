/* =====================================================================
   Chama Solar — Motor técnico e de preço (versão de TESTE)
   Funciona no navegador (window.Motor) e no Node (require) para testes.
   Nenhum valor aqui é definitivo: tudo vem de "parametros" (dados-teste.js).
   ===================================================================== */
(function (raiz) {
  'use strict';

  const DISPONIBILIDADE = { mono: 30, bi: 50, tri: 100 }; // kWh mínimos cobrados (REN 1000)
  const FATOR_ORIENTACAO = { N: 1.0, NE: 0.97, NO: 0.97, L: 0.88, O: 0.88, S: 0.75 };

  const arred = (v, c = 2) => Math.round(v * 10 ** c) / 10 ** c;

  /* ---------- 1. Dimensionamento ---------- */
  // Alvo = consumo que dá para zerar (consumo − taxa mínima da CPFL) + margem de segurança
  // (a margem cobre a perda natural dos módulos com os anos e variação de clima).
  // Padrão do mercado (e o seguro): dimensionar pelo consumo TOTAL, sem descontar a taxa mínima.
  function dimensionar({ consumoMedio, ligacao, hsp, orientacao, pr, potModuloW, margemGeracao = 0, descontarDisponibilidade = false }) {
    const disp = DISPONIBILIDADE[ligacao] ?? 50;
    const hspEf = hsp * (FATOR_ORIENTACAO[orientacao] ?? 1);
    const descontado = descontarDisponibilidade ? disp : 0;
    const alvoKwh = Math.max(consumoMedio - descontado, 0);
    const kwpNecessario = (alvoKwh * (1 + margemGeracao)) / (hspEf * 30 * pr);
    const placas = Math.max(Math.ceil((kwpNecessario * 1000) / potModuloW), 1);
    const kwpReal = (placas * potModuloW) / 1000;
    const geracaoMes = kwpReal * hspEf * 30 * pr;
    return {
      disponibilidade: disp, descontado,
      hspEfetivo: arred(hspEf, 2),
      alvoKwh: arred(alvoKwh, 0),
      kwpNecessario: arred(kwpNecessario, 2),
      placas,
      kwpReal: arred(kwpReal, 2),
      geracaoMes: arred(geracaoMes, 0),
      cobertura: alvoKwh > 0 ? arred(geracaoMes / alvoKwh, 3) : 0,
    };
  }

  /* ---------- 2. Escolha do inversor (DC/AC 1,10–1,35) ---------- */
  function escolherInversor(kwpReal, inversores, faixa = { min: 1.1, max: 1.35 }) {
    // Prefere o MENOR inversor que fique dentro da faixa; se nenhum, o mais próximo de 1,20.
    const ordenados = [...inversores].sort((a, b) => a.potenciaKw - b.potenciaKw);
    const dentro = ordenados.filter((i) => {
      const r = kwpReal / i.potenciaKw;
      return r >= faixa.min && r <= faixa.max;
    });
    // Fora da faixa: nunca passar do máximo (sobrecarga); entre os que não passam, o mais próximo de 1,20.
    const semSobrecarga = ordenados.filter((i) => kwpReal / i.potenciaKw <= faixa.max);
    const candidatos = semSobrecarga.length ? semSobrecarga : [ordenados[ordenados.length - 1]];
    const escolhido = dentro[0] || candidatos.reduce((m, i) =>
      Math.abs(kwpReal / i.potenciaKw - 1.2) < Math.abs(kwpReal / m.potenciaKw - 1.2) ? i : m);
    const relacao = kwpReal / escolhido.potenciaKw;
    return { inversor: escolhido, relacaoDcAc: arred(relacao, 2), dentroDaFaixa: relacao >= faixa.min && relacao <= faixa.max };
  }

  /* ---------- 3. Conferência de strings ---------- */
  function conferirStrings(placas, modulo, inversor, tempMin = 5) {
    // Voc corrigida para a temperatura mínima (coef. típico −0,28%/°C)
    const coef = modulo.coefVoc ?? -0.0028;
    const vocFrio = modulo.voc * (1 + coef * (tempMin - 25));
    const maxPorString = Math.floor(inversor.vMaxDc / vocFrio);
    const minPorString = Math.ceil(inversor.vMinMppt / modulo.vmp);
    const entradas = inversor.mppts * (inversor.stringsPorMppt || 1);
    let strings = Math.max(Math.ceil(placas / maxPorString), 1);
    while (strings < entradas && placas / (strings + 1) >= minPorString && placas / strings > maxPorString) strings++;
    const porString = Math.ceil(placas / strings);
    const avisos = [];
    if (porString > maxPorString) avisos.push(`String de ${porString} módulos passa da tensão máxima do inversor (máx. ${maxPorString}).`);
    if (Math.floor(placas / strings) < minPorString) avisos.push(`String curta: menos de ${minPorString} módulos não atinge a tensão mínima de MPPT.`);
    if (strings > entradas) avisos.push(`Precisa de ${strings} strings e o inversor tem ${entradas} entradas.`);
    if (modulo.isc > (inversor.iMaxMppt ?? 99)) avisos.push('Corrente do módulo acima do limite de entrada do inversor.');
    return { strings, porString, maxPorString, minPorString, vocFrio: arred(vocFrio * porString, 0), ok: avisos.length === 0, avisos };
  }

  /* ---------- 4. Preço (fórmula nova) ----------
     Preço = (custos diretos + taxa fixa) ÷ (1 − (impostos + taxa pgto + comissão + margem + reserva))
     Com faturamento direto do kit, o kit sai da nota da Chama Solar:
       Serviço S = (C − K + F + (comissão+margem+reserva)·K) ÷ (1 − impostos − pgto − comissão − margem − reserva)
       Total ao cliente = K + S
  ------------------------------------------------------------------------- */
  function faixaDe(tabela, valor) {
    return tabela.find((f) => valor <= f.ate) || tabela[tabela.length - 1];
  }

  function custosDiretos({ kit, placas, kwp, distanciaKm, trocaPadrao, custosAjustados, custosExtras }, p) {
    const linhas = [
      { id: 'kit', nome: 'Kit solar (valor final Belenergy)', valor: kit },
      { id: 'terceiro', nome: `Instalação terceirizada (${placas} placas)`, valor: placas * p.maoDeObraPorPlaca },
      { id: 'projeto', nome: 'Projeto e homologação', valor: faixaDe(p.engenharia, kwp).valor },
      { id: 'art', nome: 'ART', valor: p.art },
      { id: 'materialCa', nome: 'Material CA (cabos, proteção, quadro)', valor: p.materialCaBase + p.materialCaPorKwp * kwp },
      { id: 'frete', nome: 'Frete', valor: p.freteIncluso ? 0 : p.fretePadrao },
      { id: 'deslocamento', nome: `Deslocamento (${distanciaKm} km ida e volta × visitas)`, valor: distanciaKm * 2 * p.visitasObra * p.custoKm },
      { id: 'padrao', nome: 'Troca de padrão de entrada', valor: trocaPadrao ? p.trocaPadrao : 0 },
      { id: 'garantia', nome: 'Reserva de garantia', valor: kit * p.reservaGarantia },
    ];
    // custos que o vendedor ajustou neste orçamento (ex.: o terceiro cobrou diferente) e custos extras
    const aj = custosAjustados || {};
    const base = linhas.map((l) => (aj[l.id] != null && aj[l.id] !== '' && Number.isFinite(+aj[l.id]) ? { ...l, valorPadrao: arred(l.valor), valor: +aj[l.id], ajustado: true } : l));
    const extras = (custosExtras || []).filter((x) => Number(x && x.valor) > 0).map((x, i) => ({ id: 'extra' + i, nome: String(x.nome || 'Custo extra').slice(0, 60), valor: +x.valor, extra: true }));
    return [...base, ...extras].map((l) => ({ ...l, valor: arred(l.valor) }));
  }

  /* Preço como a Groner calcula hoje (para comparar):
     (kit + engenharia + mão de obra + ART + deslocamento + outros) ÷ (1 − (36,5% + Fator X + comissão)) */
  function precoGroner(entrada, p) {
    const G = { percentual: 0.365, maoDeObraPorPlaca: 100, art: 70, custoKm: 1, kmIdaVolta: 0, eng: [300, 500, 700], ...(p.groner || {}) };
    const kwp = entrada.kwp || 0, eng = kwp <= 10 ? G.eng[0] : kwp <= 30 ? G.eng[1] : G.eng[2];
    const outros = (entrada.custosExtras || []).reduce((s, x) => s + (Number(x && x.valor) > 0 ? +x.valor : 0), 0) + (entrada.trocaPadrao ? p.trocaPadrao || 0 : 0);
    const linhas = [
      { id: 'kit', nome: 'Kit', valor: entrada.kit },
      { id: 'engenharia', nome: 'Engenharia', valor: eng },
      { id: 'maoDeObra', nome: `Mão de obra (${entrada.placas} × ${G.maoDeObraPorPlaca})`, valor: entrada.placas * G.maoDeObraPorPlaca },
      { id: 'art', nome: 'ART', valor: G.art },
      { id: 'deslocamento', nome: 'Deslocamento', valor: (Number(entrada.distanciaKm) || 0) * (G.kmIdaVolta ? 2 : 1) * G.custoKm },
      { id: 'outros', nome: 'Outros', valor: outros },
    ].map((l) => ({ ...l, valor: arred(l.valor) }));
    const custos = linhas.reduce((s, l) => s + l.valor, 0), cm = entrada.comissaoParceria || 0;
    let X = 0, preco = 0;
    for (let k = 0; k < 4; k++) { preco = custos / (1 - (G.percentual + X + cm)); const nx = preco <= 100000 ? 0 : preco <= 500000 ? 0.05 : 0.06; if (nx === X) break; X = nx; }
    return { linhas, custos: arred(custos), percentual: G.percentual + X + cm, fatorX: X, preco: arred(preco), rsPorWp: arred(preco / (kwp * 1000 || 1), 2) };
  }

  function precificar(entrada, p) {
    const linhas = custosDiretos(entrada, p);
    const C = linhas.reduce((s, l) => s + l.valor, 0);
    const K = entrada.kit;
    // custo fixo: rateado por kWp vendido (justo com sistema pequeno) ou, se não houver meta em kWp, por obra
    const F = p.kwpPrevistosMes > 0 ? (p.custoFixoMes * entrada.kwp) / p.kwpPrevistosMes : p.custoFixoMes / p.obrasPrevistasMes;
    const margemTabela = faixaDe(p.margens, entrada.kwp).margem;
    let margem = Number.isFinite(entrada.margemManual) ? entrada.margemManual : margemTabela;
    const t = entrada.kitFaturadoDireto ? p.impostoServico : p.impostoTotal;
    const pg = p.taxaPagamento[entrada.formaPagamento] ?? 0;
    const cm = entrada.comissaoParceria || 0;
    const rs = p.reservaNegociacao;
    const alvo = Number(entrada.precoAlvo) > 0 ? +entrada.precoAlvo : 0;

    let total, notaChama, desconto;
    if (alvo) {
      // preço final escolhido (digitado ou o da Groner): a margem é o que sobra depois de custos, impostos, taxas, comissão e reserva
      const baseN = entrada.kitFaturadoDireto ? alvo - K : alvo;
      margem = (alvo - C - F - baseN * (t + pg) - alvo * (cm + rs)) / alvo;
      total = alvo; notaChama = baseN; desconto = 0;
    } else {
      const den = 1 - (t + pg + cm + margem + rs);
      if (den <= 0.05) throw new Error('Somatório de percentuais alto demais (≥ 95%). Revise os parâmetros.');
      if (entrada.kitFaturadoDireto) {
        notaChama = (C - K + F + (cm + margem + rs) * K) / den;
        total = K + notaChama;
      } else {
        total = (C + F) / den;
        notaChama = total;
      }
      desconto = Math.min(Math.max(entrada.descontoPct || 0, 0), rs);
    }
    const totalFinal = total * (1 - desconto);
    const rsPorWp = totalFinal / (entrada.kwp * 1000);
    const sem = p.semaforo;
    const cor = rsPorWp <= sem.verdeAte ? 'verde' : rsPorWp <= sem.amareloAte ? 'amarelo' : 'vermelho';
    // O desconto sai inteiro da nota da Chama Solar (o kit direto tem preço fixo do distribuidor)
    const base = entrada.kitFaturadoDireto ? totalFinal - K : totalFinal;
    const decomp = {
      custos: C, taxaFixa: F,
      impostos: base * t,
      taxaPagamento: base * pg,
      comissao: totalFinal * cm,
      margem: totalFinal * margem,
      reservaRestante: totalFinal * rs - total * desconto,
    };
    return {
      linhas, custosDiretos: arred(C), taxaFixa: arred(F),
      percentuais: { impostos: t, pagamento: pg, comissao: cm, margem, reserva: rs }, margemTabela, margemManual: Number.isFinite(entrada.margemManual), precoAlvo: alvo ? arred(alvo) : 0,
      precoCheio: arred(total), descontoPct: desconto, precoFinal: arred(totalFinal),
      notaChamaSolar: arred(base),
      kitDireto: entrada.kitFaturadoDireto ? arred(K) : 0,
      rsPorWp: arred(rsPorWp, 2), semaforo: cor,
      lucroLiquido: arred(totalFinal * margem + (totalFinal * rs - total * desconto)),
      decomp: Object.fromEntries(Object.entries(decomp).map(([k, v]) => [k, arred(v)])),
    };
  }

  /* ---------- 5. Pagamento ---------- */
  function parcelaPrice(valor, jurosMes, n) {
    if (jurosMes === 0) return valor / n;
    return (valor * jurosMes) / (1 - (1 + jurosMes) ** -n);
  }

  /* ---------- 6. Economia, Fio B, payback, TIR, VPL (25 anos) ---------- */
  function fioBPct(ano, p) {
    const tab = p.fioB.cronograma; // { 2026: 0.6, 2027: 0.75, 2028: 0.9 }
    if (tab[ano] != null) return tab[ano];
    const anos = Object.keys(tab).map(Number).sort();
    return ano < anos[0] ? 0 : p.fioB.depois;
  }

  function economia({ consumoMedio, ligacao, geracaoMes, investimento, anoInicio }, p) {
    const disp = DISPONIBILIDADE[ligacao] ?? 50;
    const fluxos = [-investimento];
    const tabela = [];
    let acumulado = -investimento, payback = null;
    for (let a = 0; a < 25; a++) {
      const ano = anoInicio + a;
      const tarifa = p.tarifaKwh * (1 + p.reajusteAnual) ** a;
      const fioB = p.fioB.valorKwh * (1 + p.reajusteAnual) ** a * fioBPct(ano, p);
      const ger = geracaoMes * (1 - p.degradacaoAnual) ** a;
      const autoconsumo = Math.min(ger * p.simultaneidade, consumoMedio);
      const injetada = ger - autoconsumo;
      const compensavel = Math.min(injetada, Math.max(consumoMedio - autoconsumo - disp, 0));
      const econMes = autoconsumo * tarifa + compensavel * (tarifa - fioB);
      const econAno = econMes * 12;
      acumulado += econAno;
      if (payback === null && acumulado >= 0) {
        const anterior = acumulado - econAno;
        payback = a + (-anterior / econAno);
      }
      fluxos.push(econAno);
      tabela.push({ ano, tarifa: arred(tarifa, 3), fioBPct: fioBPct(ano, p), economiaAno: arred(econAno), acumulado: arred(acumulado) });
    }
    const contaAntes = consumoMedio * p.tarifaKwh;
    return {
      contaAtual: arred(contaAntes),
      economiaMes1: arred(tabela[0].economiaAno / 12),
      contaDepois: arred(Math.max(contaAntes - tabela[0].economiaAno / 12, disp * p.tarifaKwh)),
      paybackAnos: payback === null ? null : arred(payback, 1),
      tir: arred(tir(fluxos), 4),
      vpl: arred(vpl(fluxos, p.taxaDesconto)),
      economia25: arred(tabela.reduce((s, t) => s + t.economiaAno, 0)),
      tabela,
    };
  }

  function vpl(fluxos, taxa) {
    return fluxos.reduce((s, f, i) => s + f / (1 + taxa) ** i, 0);
  }
  function tir(fluxos) {
    let lo = -0.99, hi = 2;
    if (vpl(fluxos, hi) > 0) return hi;
    for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2;
      vpl(fluxos, mid) > 0 ? (lo = mid) : (hi = mid);
    }
    return (lo + hi) / 2;
  }

  /* ---------- 7. Montar as 3 opções de kit ---------- */
  /* preço final escolhido pelo vendedor: o da Groner, ou o digitado para esta opção */
  function precoAlvoDe(orc, nivel, groner) {
    if (orc.precoModo === 'groner') return groner.preco;
    if (orc.precoModo === 'manual') { const v = Number((orc.precoManual || {})[nivel]); return v > 0 ? v : 0; }
    return 0;
  }

  /* Opção a partir de um KIT FECHADO cotado no "Personalize seu Gerador" da Belenergy.
     O valor final do kit (já com estrutura e componentes) é o custo do kit. */
  function opcaoKitFechado(orc, k, p) {
    const modulo = { id: k.modulo.sku, nome: k.modulo.nome, marca: k.modulo.marca || (k.modulo.nome.match(/^(JA Solar|\S+)/) || [])[1], potenciaW: k.modulo.potenciaW, preco: 0, areaM2: k.modulo.areaM2 || k.modulo.potenciaW / 222, voc: k.modulo.voc, vmp: k.modulo.vmp, isc: k.modulo.isc };
    const placas = k.modulo.qtd;
    const hspEf = orc.hsp * (FATOR_ORIENTACAO[orc.orientacao] ?? 1);
    const kwpReal = (placas * modulo.potenciaW) / 1000;
    const disp = DISPONIBILIDADE[orc.ligacao] ?? 50, descontado = p.descontarDisponibilidade ? disp : 0;
    const alvoKwh = Math.max(orc.consumoMedio - descontado, 0);
    const geracaoMes = kwpReal * hspEf * 30 * p.pr;
    const dim = { disponibilidade: disp, descontado, hspEfetivo: arred(hspEf, 2), alvoKwh: arred(alvoKwh, 0), kwpNecessario: arred((alvoKwh * (1 + (p.margemGeracao ?? 0))) / (hspEf * 30 * p.pr), 2), placas, kwpReal: arred(kwpReal, 2), geracaoMes: arred(geracaoMes, 0), cobertura: alvoKwh ? arred(geracaoMes / alvoKwh, 3) : 0 };
    const inversor = { id: k.inversor.sku, nome: k.inversor.nome, fabricante: k.inversor.fabricante || '', qtd: k.inversor.qtd || 1, potenciaUnKw: k.inversor.potenciaUnKw || k.inversor.potenciaKw, tipo: k.inversor.tipo, potenciaKw: k.inversor.potenciaKw, hibrido: k.inversor.tipo === 'hibrido', vMaxDc: k.inversor.vMaxDc || 0 };
    const relacao = inversor.potenciaKw ? kwpReal / inversor.potenciaKw : 0;
    const ent = { ...orc, kit: k.valorKit, placas, kwp: kwpReal }, groner = precoGroner(ent, p);
    const preco = precificar({ ...ent, precoAlvo: precoAlvoDe(orc, k.nivel, groner) }, p);
    const eco = economia({ ...orc, geracaoMes, investimento: preco.precoFinal, anoInicio: p.anoBase }, p);
    const areaM2 = arred(placas * modulo.areaM2, 1);
    return { groner, precoModo: orc.precoModo || 'chama', nivel: k.nivel, destaque: k.nivel === 'Inversor' || k.nivel === 'Recomendada', descricao: k.descricao || 'Kit fechado Belenergy.', modulo, inversor, relacaoDcAc: arred(relacao, 2), dcAcOk: relacao >= p.faixaDcAc.min && relacao <= p.faixaDcAc.max,
      bateria: k.bateria || null, dim, strings: { strings: k.estrutura?.linhas || 1, porString: k.estrutura?.modulosPorLinha || placas, avisos: [], vocFrio: 0, ok: true }, kit: k.valorKit, kitFechado: k, preco, eco, areaM2, cabeNoTelhado: !orc.areaDisponivel || areaM2 <= orc.areaDisponivel };
  }

  function montarOpcoes(orc, catalogo, p) {
    // Kits fechados cotados na Belenergy têm prioridade sobre a estimativa por catálogo
    if (Array.isArray(orc.kitsFechados) && orc.kitsFechados.some(Boolean)) {
      return orc.kitsFechados.filter(Boolean).map((k) => opcaoKitFechado(orc, k, p));
    }
    const res = [];
    for (const nivel of catalogo.niveis) {
      const modulo = catalogo.modulos.find((m) => m.id === nivel.modulo);
      const invs = catalogo.inversores.filter((i) => nivel.inversores.includes(i.id));
      const dim = dimensionar({ ...orc, potModuloW: modulo.potenciaW, pr: p.pr, margemGeracao: p.margemGeracao ?? 0, descontarDisponibilidade: !!p.descontarDisponibilidade });
      const inv = escolherInversor(dim.kwpReal, invs, p.faixaDcAc);
      const str = conferirStrings(dim.placas, modulo, inv.inversor, p.tempMinima);
      const bateria = nivel.bateria ? catalogo.baterias.find((b) => b.id === nivel.bateria) : null;
      const kit = arred(
        dim.placas * modulo.preco + inv.inversor.preco + dim.placas * catalogo.estrutura[orc.telhado] + (bateria ? bateria.preco : 0)
      );
      const ent = { ...orc, kit, placas: dim.placas, kwp: dim.kwpReal }, groner = precoGroner(ent, p);
      const preco = precificar({ ...ent, precoAlvo: precoAlvoDe(orc, nivel.nome, groner) }, p);
      const eco = economia({ ...orc, geracaoMes: dim.geracaoMes, investimento: preco.precoFinal, anoInicio: p.anoBase }, p);
      const areaM2 = arred(dim.placas * modulo.areaM2, 1);
      res.push({ groner, precoModo: orc.precoModo || 'chama', nivel: nivel.nome, destaque: nivel.destaque, descricao: nivel.descricao, modulo, inversor: inv.inversor, relacaoDcAc: inv.relacaoDcAc, dcAcOk: inv.dentroDaFaixa, bateria, dim, strings: str, kit, preco, eco, areaM2, cabeNoTelhado: !orc.areaDisponivel || areaM2 <= orc.areaDisponivel });
    }
    return res;
  }

  const Motor = { DISPONIBILIDADE, FATOR_ORIENTACAO, dimensionar, escolherInversor, conferirStrings, custosDiretos, precificar, precoGroner, parcelaPrice, economia, fioBPct, tir, vpl, montarOpcoes, opcaoKitFechado };
  if (typeof module !== 'undefined' && module.exports) module.exports = Motor;
  else raiz.Motor = Motor;
})(typeof window !== 'undefined' ? window : globalThis);
