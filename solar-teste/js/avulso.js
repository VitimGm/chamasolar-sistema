/* =====================================================================
   ORÇAMENTOS AVULSOS: o que não é kit solar completo.
   - "servico": itens fora do kit (ex.: inversor híbrido + materiais CA +
     mão de obra). O vendedor digita o CUSTO de cada item; o preço sai com
     margem e imposto por fora (preço = custo ÷ (1 − imposto − margem)).
     Equipamento e material pagam o imposto de venda; mão de obra, o de serviço.
   - "manutencao": preço por placa (padrão R$ 25) + deslocamento + extras
     que o vendedor observou (telhado difícil, troca de conector…). Pode
     oferecer um plano recorrente com desconto.
   Os dois podem ter o preço final ajustado à mão (a margem vira o que sobra).
   ===================================================================== */
(function (raiz) {
  'use strict';
  const arred = (v) => Math.round(v * 100) / 100;
  const CATS = { equipamento: 'Equipamento', material: 'Material elétrico', mao: 'Mão de obra', outro: 'Outro' };
  const CHECK_MANUT = ['Limpeza das placas com escova macia e água', 'Inspeção visual das placas, cabos e estrutura', 'Conferência dos conectores MC4 e do aperto da estrutura',
    'Verificação do inversor e do aplicativo de monitoramento', 'Relatório com fotos de antes e depois'];

  function novo(tipo, p) {
    const base = { tipo, status: 'novo', nome: '', whatsapp: '', cidade: 'Ribeirão Preto', distanciaKm: 12, validadeDias: 10, prazo: '', observacoes: '', condicoes: 'pix', parcelasCartao: 6, criadoEm: new Date().toISOString() };
    if (tipo === 'manutencao') return { ...base, titulo: 'Manutenção do sistema solar', placas: 12, porPlaca: (p && p.manutencaoPorPlaca) || 25, kwp: 0, marcaInversor: '', extras: [], checklist: [...CHECK_MANUT], plano: { ativo: false, meses: 6, desconto: 0.1 }, prazo: 'Agendamento em até 5 dias úteis' };
    if (tipo === 'ampliacao') return { ...base, titulo: 'Ampliação do sistema solar', margem: (p && p.margemAvulso) ?? 0.2,
      amp: { modo: 'ampliacao', kwpAtual: 0, placasAtuais: 0, potPlacaAtualW: 550, kwInversor: 0, marcaInversor: '', consumoAtual: 0, consumoNovo: 0, geracaoAtual: 0, novaPlacaW: 610, antes2023: true, motivo: '' },
      itens: [{ desc: 'Módulos fotovoltaicos', cat: 'equipamento', qtd: 0, un: 'placa', custo: 0, auto: 'placas' }, { desc: 'Estrutura de fixação das placas novas', cat: 'material', qtd: 0, un: 'placa', custo: 0, auto: 'placas' },
        { desc: 'Cabos, conectores MC4 e proteções CC', cat: 'material', qtd: 1, un: 'kit', custo: 0 }, { desc: 'Mão de obra de instalação', cat: 'mao', qtd: 0, un: 'placa', custo: 0, auto: 'placas' },
        { desc: 'Projeto e homologação do aumento de potência na distribuidora', cat: 'mao', qtd: 1, un: '', custo: 0 }],
      inclui: ['Visita técnica e conferência do sistema atual', 'Projeto elétrico e pedido de aumento de potência na distribuidora', 'Instalação das placas novas no mesmo padrão', 'Teste, monitoramento e explicação de uso', 'Garantia do serviço de 12 meses'],
      prazo: 'Instalação após a aprovação da distribuidora' };
    return { ...base, titulo: 'Instalação de inversor híbrido', itens: [{ desc: 'Inversor híbrido', cat: 'equipamento', qtd: 1, un: 'un', custo: 0 }, { desc: 'Materiais elétricos CA (cabos, disjuntores, DPS, quadro)', cat: 'material', qtd: 1, un: 'kit', custo: 0 }, { desc: 'Mão de obra de instalação e comissionamento', cat: 'mao', qtd: 1, un: 'serv.', custo: 0 }],
      margem: (p && p.margemAvulso) ?? 0.2, inclui: ['Instalação e configuração completa', 'Teste de funcionamento e explicação de uso', 'Garantia do serviço de 12 meses'], prazo: 'Instalação em até 10 dias úteis após o aceite' };
  }

  /* AMPLIAÇÃO / RETROFIT: hoje × depois. hsp da cidade, 80% de rendimento (o mesmo do resto do sistema) */
  function ampliar(o, hsp) {
    const a = o.amp || {}, h = +hsp || 5.3, fator = h * 30 * 0.8, kwpAtual = +a.kwpAtual || ((+a.placasAtuais || 0) * (+a.potPlacaAtualW || 0)) / 1000;
    const geracaoAtual = +a.geracaoAtual || Math.round(kwpAtual * fator), consumoNovo = +a.consumoNovo || +a.consumoAtual || 0;
    if (a.modo === 'retrofit') {
      const kwInv = +a.kwInversor || 0, ratio = kwInv ? kwpAtual / kwInv : 0;
      return { modo: 'retrofit', kwpAtual: arred(kwpAtual, 2), kwpNovo: arred(kwpAtual, 2), placasNovas: 0, geracaoAtual, geracaoNova: geracaoAtual, consumoNovo, ratio: arred(ratio, 2), mesmaPotencia: true };
    }
    const falta = Math.max(0, consumoNovo - geracaoAtual), kwpExtra = falta / fator, w = +a.novaPlacaW || 610;
    const placasNovas = a.placasNovas > 0 ? Math.round(+a.placasNovas) : Math.ceil((kwpExtra * 1000) / w - 1e-9);
    const kwpNovo = kwpAtual + (placasNovas * w) / 1000, kwInv = +a.kwInversor || 0, ratio = kwInv ? kwpNovo / kwInv : 0;
    return { modo: 'ampliacao', kwpAtual: arred(kwpAtual, 2), kwpExtra: arred((placasNovas * w) / 1000, 2), kwpNovo: arred(kwpNovo, 2), placasNovas, novaPlacaW: w, geracaoAtual, geracaoNova: Math.round(kwpNovo * fator), consumoAtual: +a.consumoAtual || 0, consumoNovo,
      ratio: arred(ratio, 2), precisaInversor: kwInv > 0 && ratio > 1.35, kwInversorSugerido: kwInv > 0 && ratio > 1.35 ? Math.ceil((kwpNovo / 1.25) * 2) / 2 : 0, cobre: consumoNovo ? Math.min(1.2, (kwpNovo * fator) / consumoNovo) : 0 };
  }
  function deslocamentoDe(o, p) { return o.deslocamento != null && o.deslocamento !== '' ? +o.deslocamento : arred((+o.distanciaKm || 0) * 2 * ((p && p.custoKm) || 1)); }

  function calcular(o, p) {
    p = p || {}; const desl = deslocamentoDe(o, p), impV = p.impostoTotal ?? 0.1, impS = p.impostoServico ?? 0.06;
    if (o.tipo === 'manutencao') {
      const placas = Math.max(0, Math.round(+o.placas || 0)), porPlaca = +o.porPlaca || 25, limpeza = placas * porPlaca;
      const extras = (o.extras || []).filter((x) => x && (x.desc || +x.valor)).map((x) => ({ desc: x.desc || 'Extra', valor: +x.valor || 0 }));
      const linhas = [{ desc: `Manutenção de ${placas} placa${placas === 1 ? '' : 's'}`, qtd: placas, un: 'placa', precoUn: porPlaca, total: arred(limpeza), cat: 'mao' }, ...(desl ? [{ desc: `Deslocamento (${o.cidade || 'local'})`, qtd: 1, un: '', precoUn: desl, total: desl, cat: 'outro' }] : []), ...extras.map((x) => ({ desc: x.desc, qtd: 1, un: '', precoUn: x.valor, total: arred(x.valor), cat: 'extra' }))];
      let total = arred(linhas.reduce((t, l) => t + l.total, 0)); const calc0 = total;
      if (+o.precoManual > 0) total = +o.precoManual;
      const plano = o.plano && o.plano.ativo ? { meses: +o.plano.meses || 6, desconto: +o.plano.desconto || 0, porVisita: arred(total * (1 - (+o.plano.desconto || 0))), visitasAno: Math.round(12 / (+o.plano.meses || 6)) } : null;
      if (plano) plano.porAno = arred(plano.porVisita * plano.visitasAno);
      return { tipo: 'manutencao', linhas, total, calculado: calc0, ajustado: +o.precoManual > 0, plano, placas, porPlaca, deslocamento: desl, pagamento: pagamentos(o, total, p) };
    }
    const itens = (o.itens || []).filter((i) => i && (i.desc || +i.custo));
    const m = +o.margem || 0, linhas = itens.map((i) => { const imp = i.cat === 'mao' ? impS : impV, div = Math.max(0.05, 1 - imp - m), custoT = (+i.custo || 0) * (+i.qtd || 1), total = arred(custoT / div); return { desc: i.desc, cat: i.cat || 'outro', qtd: +i.qtd || 1, un: i.un || '', precoUn: arred(total / (+i.qtd || 1)), total, custo: custoT, imposto: arred(total * imp) }; });
    if (desl) linhas.push({ desc: `Deslocamento (${o.cidade || 'local'})`, cat: 'outro', qtd: 1, un: '', precoUn: arred(desl / Math.max(0.05, 1 - impS)), total: arred(desl / Math.max(0.05, 1 - impS)), custo: desl, imposto: arred((desl / Math.max(0.05, 1 - impS)) * impS) });
    const custo = arred(linhas.reduce((t, l) => t + l.custo, 0)), imposto = arred(linhas.reduce((t, l) => t + l.imposto, 0));
    let total = arred(linhas.reduce((t, l) => t + l.total, 0)); const calc0 = total;
    if (+o.precoManual > 0) { const f = +o.precoManual / total; linhas.forEach((l) => { l.total = arred(l.total * f); l.precoUn = arred(l.total / l.qtd); l.imposto = arred(l.imposto * f); }); total = +o.precoManual; }
    const impostoF = arred(linhas.reduce((t, l) => t + l.imposto, 0)), lucro = arred(total - custo - impostoF);
    const porCat = {}; linhas.forEach((l) => { porCat[l.cat] = arred((porCat[l.cat] || 0) + l.total); });
    return { tipo: 'servico', linhas, total, calculado: calc0, ajustado: +o.precoManual > 0, custo, imposto: impostoF, lucro, margemReal: total ? lucro / total : 0, porCat, deslocamento: desl, pagamento: pagamentos(o, total, p), impostoCalc: imposto };
  }
  function pagamentos(o, total, p) {
    const n = Math.max(1, +o.parcelasCartao || 6), tab = ((p && p.cartao) || {}).taxas || {};
    const taxa = Number.isFinite(+tab[n]) && tab[n] !== null ? +tab[n] : (((p && p.taxaPagamento) || {}).cartao ?? 0.09), cartao = arred(total / (1 - taxa));
    return { pix: total, cartaoTotal: cartao, parcelas: n, parcela: arred(cartao / n), taxa };
  }

  /* o que vai para o cliente: preços finais, sem custo, margem nem imposto */
  function publico(o, c) {
    const pick = ['tipo', 'id', 'token', 'status', 'nome', 'cidade', 'titulo', 'validadeDias', 'prazo', 'observacoes', 'condicoes', 'inclui', 'checklist', 'kwp', 'placas', 'marcaInversor', 'enviadoEm', 'criadoEm', 'amp', 'ampCalc'];
    const r = {}; pick.forEach((k) => { if (o[k] !== undefined) r[k] = o[k]; });
    r.nome = String(o.nome || '').trim(); r.calc = { ...c, linhas: c.linhas.map(({ custo, imposto, ...l }) => { void custo; void imposto; return l; }) };
    delete r.calc.custo; delete r.calc.imposto; delete r.calc.lucro; delete r.calc.margemReal; delete r.calc.impostoCalc; delete r.calc.calculado; delete r.calc.ajustado;
    return r;
  }

  raiz.Avulso = { CATS, CHECK_MANUT, novo, calcular, publico, deslocamentoDe, ampliar };
})(typeof window !== 'undefined' ? window : globalThis);
