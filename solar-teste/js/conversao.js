/* =====================================================================
   Chama Solar — Motor de CONVERSÃO
   Transforma o orçamento técnico em argumentos de venda com números do
   próprio cliente. Regra: só números reais/calculados, nada inventado.
   ===================================================================== */
(function (raiz) {
  'use strict';
  const M = raiz.Motor, D = raiz.DadosTeste;
  const soma = (a) => a.reduce((s, x) => s + x, 0);
  const r2 = (v) => Math.round(v * 100) / 100;

  function consumoMedio(o) {
    const v = (o.consumos || []).map(Number).filter((x) => x > 0);
    return v.length ? soma(v) / v.length : 0;
  }
  const hspDe = (o) => (D.cidades[o.cidade] || D.cidades['Ribeirão Preto']).hsp;

  function entrada(o) {
    const p3 = o.projeto3d && Number.isFinite(o.projeto3d.perda) ? o.projeto3d.perda : null; // perda medida no 3D (direção + sombra)
    const desconhecida = p3 === null && (!o.orientacao || o.orientacao === '?');
    const perda = p3 !== null ? p3 : desconhecida ? ((raiz.Banco && raiz.Banco.parametros().perdaOrientacao) ?? 0.07) : 0;
    return {
      consumoMedio: consumoMedio(o), ligacao: o.ligacao, hsp: hspDe(o) * (1 - perda), orientacao: desconhecida || p3 !== null ? 'N' : o.orientacao, telhado: o.telhado || 'ceramico',
      distanciaKm: Number(o.distanciaKm) || 0, trocaPadrao: !!o.trocaPadrao, areaDisponivel: Number(o.areaDisponivel) || 0,
      formaPagamento: o.formaPagamento || 'financiamento', comissaoParceria: (Number(o.comissaoParceria) || 0) / 100,
      kitFaturadoDireto: !!o.kitFaturadoDireto, descontoPct: (Number(o.descontoPct) || 0) / 100,
      // ajustes do vendedor neste orçamento (todos opcionais)
      margemManual: o.margemManual === '' || o.margemManual == null || !Number.isFinite(+o.margemManual) ? undefined : +o.margemManual / 100,
      custosExtras: Array.isArray(o.custosExtras) ? o.custosExtras : [], custosAjustados: o.custosAjustados || {},
      precoModo: o.precoModo || 'chama', precoManual: o.precoManual || {},
    };
  }

  function indiceOpcao(o, ops) { const i = o.opcaoEscolhida ?? 1; return ops[i] ? i : Math.max(ops.findIndex((x) => x.destaque), 0); }
  function opcoes(o, p) {
    const pp = { ...p, tarifaKwh: Number(o.tarifaKwh) || p.tarifaKwh };
    const ops = M.montarOpcoes({ ...entrada(o), kitsFechados: o.kitsFechados }, raiz.Catalogo ? raiz.Catalogo.paraMotor() : D.catalogo, pp);
    ops.forEach((x) => { if (x.bateria) x.preco.semaforo = 'neutro'; });
    return ops;
  }

  /* ---------- Raio-X da dor: o que o cliente já paga e vai pagar ---------- */
  function raioX(o, p, op) {
    const tarifa = Number(o.tarifaKwh) || p.tarifaKwh;
    const mensal = (o.consumos || []).map((c) => (Number(c) || 0) * tarifa);
    const pago12 = soma(mensal);
    const media = consumoMedio(o);
    const anos = Array.from({ length: 25 }, (_, a) => media * 12 * tarifa * (1 + p.reajusteAnual) ** a);
    const total25 = soma(anos);
    // acumulado ano a ano: sem solar × com solar (investimento + o que ainda paga à CPFL)
    let semAc = 0, comAc = op ? op.preco.precoFinal : 0;
    const curva = anos.map((contaAno, a) => {
      semAc += contaAno;
      if (op) comAc += Math.max(contaAno - op.eco.tabela[a].economiaAno, 0) + p.manutencaoAnual;
      return { ano: p.anoBase + a, sem: Math.round(semAc), com: Math.round(comAc) };
    });
    const cruzamento = curva.findIndex((c) => c.com <= c.sem);
    return {
      tarifa, mensal: mensal.map(r2), pago12: r2(pago12), contaMedia: r2(pago12 / 12), maiorConta: r2(Math.max(...mensal)),
      total25: Math.round(total25), curva, anoVirada: cruzamento >= 0 ? curva[cruzamento].ano : null,
      contaApósReajuste: r2((pago12 / 12) * (1 + p.reajusteAnual)),
    };
  }

  /* ---------- Custo da espera ---------- */
  function espera(o, p, op) {
    const porMes = op.eco.economiaMes1;
    const contaMedia = consumoMedio(o) * (Number(o.tarifaKwh) || p.tarifaKwh);
    return {
      porMes: r2(porMes), porDia: r2(porMes / 30), seisMeses: Math.round(porMes * 6),
      contaPorSegundo: contaMedia / 30 / 86400, // para o "relógio da conta"
    };
  }

  /* ---------- Custo da energia (LCOE): R$/kWh do sistema em 25 anos ---------- */
  function custoEnergia(op, p) {
    let energia = 0;
    for (let a = 0; a < 25; a++) energia += op.dim.geracaoMes * 12 * (1 - p.degradacaoAnual) ** a;
    const custo = op.preco.precoFinal + p.manutencaoAnual * 25;
    return { rsKwh: r2(custo / energia), energia25: Math.round(energia) };
  }

  /* ---------- Troca de boleto ---------- */
  function boleto(op, p, prazo, entradaRs = 0) {
    const financiado = Math.max(op.preco.precoFinal - entradaRs, 0);
    const parcela = prazo ? M.parcelaPrice(financiado, p.financiamento.jurosMes, prazo) : 0;
    const contaDepois = op.eco.contaDepois, contaAtual = op.eco.contaAtual;
    return {
      prazo, parcela: r2(parcela), contaDepois, contaAtual, totalMes: r2(parcela + contaDepois),
      diferenca: r2(contaAtual - (parcela + contaDepois)), livreDepois: r2(contaAtual - contaDepois),
    };
  }

  /* ---------- Perfil de dor (qual argumento abre a conversa) ---------- */
  function perfil(o, rx) {
    const c = (o.consumos || []).map(Number);
    const ini = soma(c.slice(0, 6)) / 6, fim = soma(c.slice(6)) / 6;
    const subida = ini > 0 ? fim / ini - 1 : 0;
    const pico = Math.max(...c), vale = Math.min(...c.filter((x) => x > 0));
    const negocio = o.ligacao === 'tri' && consumoMedio(o) >= 1200;
    const dores = [];
    if (negocio) dores.push({ id: 'negocio', peso: 5, titulo: 'Energia está comendo a margem', texto: `R$ ${fmt(rx.pago12)} por ano de energia é custo fixo que sai do lucro todo mês.` });
    if (subida > 0.05) dores.push({ id: 'crescendo', peso: 4, titulo: 'O consumo está subindo', texto: `O consumo subiu ${Math.round(subida * 100)}% entre o 1º e o 2º semestre. A conta cresce junto.` });
    if (pico / vale > 1.2) dores.push({ id: 'verao', peso: 3, titulo: 'Picos de calor pesam', texto: `O mês mais caro (R$ ${fmt(rx.maiorConta)}) é ${Math.round((pico / vale - 1) * 100)}% maior que o mais barato — ar-condicionado e verão.` });
    dores.push({ id: 'reajuste', peso: 2, titulo: 'A tarifa não para de subir', texto: 'A CPFL Paulista reajustou a tarifa residencial em 9,25% em 2026. Quem gera a própria energia sai dessa fila.' });
    dores.push({ id: 'conta', peso: 1, titulo: 'Dinheiro que não volta', texto: `R$ ${fmt(rx.pago12)} pagos à CPFL nos últimos 12 meses. Em 25 anos, R$ ${fmt(rx.total25)}.` });
    dores.sort((a, b) => b.peso - a.peso);
    return { principal: dores[0], dores, negocio, subida };
  }

  /* ---------- Temperatura do lead (comportamento na Proposta Viva) ---------- */
  const PONTOS = { abriu: 10, reabriu: 8, viu: 2, simulou: 7, escolheu: 6, compartilhou: 18, whatsapp: 15, duvida: 6, aceite: 100 };
  function temperatura(o, eventos, agora = Date.now()) {
    if (o.status === 'ganho') return { pontos: 100, nivel: 'ganho', rotulo: 'Fechado' };
    if (o.status === 'perdido') return { pontos: 0, nivel: 'perdido', rotulo: 'Perdido' };
    let pts = 0, aberturas = 0;
    for (const e of eventos) {
      if (e.tipo === 'abriu') { pts += aberturas ? PONTOS.reabriu : PONTOS.abriu; aberturas++; }
      else pts += PONTOS[e.tipo] || 0;
    }
    const ultimo = eventos.length ? Math.max(...eventos.map((e) => +new Date(e.em))) : null;
    const horasParado = ultimo ? (agora - ultimo) / 3600e3 : null;
    if (horasParado !== null) pts *= Math.max(0.35, 1 - horasParado / 168); // esfria em ~7 dias
    if (horasParado !== null && horasParado < 3) pts += 25;                 // está mexendo agora
    pts = Math.round(Math.min(pts, 99));
    const nivel = pts >= 55 ? 'quente' : pts >= 25 ? 'morno' : 'frio';
    return { pontos: pts, nivel, rotulo: { quente: 'Quente', morno: 'Morno', frio: 'Frio' }[nivel], aberturas, horasParado, ultimo };
  }

  /* ---------- Próxima melhor ação (gatilhos de comportamento) ---------- */
  function proximaAcao(o, eventos, agora = Date.now()) {
    const t = temperatura(o, eventos, agora);
    const conta = (tipo) => eventos.filter((e) => e.tipo === tipo).length;
    const horasCriado = (agora - new Date(o.criadoEm)) / 3600e3;
    if (o.status === 'ganho') return { prioridade: 1, icone: '🤝', texto: 'Pedir indicação 21 dias depois de ligar a usina, com a conta nova na mão.', agente: 'roteirista' };
    if (o.status === 'perdido') return { prioridade: 0, icone: '🗂️', texto: 'Motivo registrado. Reabordar em 90 dias com o novo reajuste da CPFL.', agente: 'analista' };
    if (o.status === 'novo') return { prioridade: horasCriado > 24 ? 5 : 4, icone: '⚡', texto: horasCriado > 24 ? `Lead esperando há ${Math.round(horasCriado)} h. Envie a Proposta Viva hoje — velocidade fecha venda.` : 'Montar e enviar a Proposta Viva ainda hoje.', agente: 'diagnostico' };
    if (!conta('abriu')) return horasCriado > 24
      ? { prioridade: 4, icone: '📞', texto: 'Proposta não foi aberta. Ligue — mensagem já não está funcionando.', agente: 'roteirista' }
      : { prioridade: 2, icone: '🎙️', texto: 'Mande um áudio curto de 30 s apresentando a proposta.', agente: 'roteirista' };
    if (t.horasParado !== null && t.horasParado < 2) return { prioridade: 5, icone: '🔥', texto: 'Cliente está com a proposta aberta AGORA. Ligue enquanto o assunto está quente.', agente: 'roteirista' };
    if (conta('aceite')) return { prioridade: 5, icone: '✅', texto: 'Aceite recebido. Confirmar visita técnica e documentos.', agente: null };
    if (conta('compartilhou')) return { prioridade: 4, icone: '👥', texto: 'Compartilhou a proposta: há outro decisor. Proponha uma chamada com os dois.', agente: 'objecoes' };
    if (conta('simulou') >= 2) return { prioridade: 4, icone: '💳', texto: 'Simulou parcelas várias vezes: dúvida é financeira. Mande a troca de boleto e ofereça ligar.', agente: 'objecoes' };
    if (t.aberturas >= 3) return { prioridade: 4, icone: '❓', texto: `Abriu ${t.aberturas} vezes sem responder. Ligue e pergunte o que falta para decidir.`, agente: 'objecoes' };
    if (t.horasParado > 48) return { prioridade: 3, icone: '⏰', texto: 'Parado há mais de 2 dias. Follow-up com pergunta sobre a parte que ele leu.', agente: 'followup' };
    return { prioridade: 2, icone: '💬', texto: 'Viu a proposta. Pergunte qual das duas opções fez mais sentido.', agente: 'followup' };
  }

  /* ---------- Prova social real: usinas na mesma cidade ---------- */
  /* Prova social: no oficial, SÓ casos reais cadastrados em Parâmetros → Depoimentos (nada inventado).
     No modo teste, usa os exemplos fictícios. */
  function vizinhos(o, p) {
    const reais = ((p && p.depoimentos) || []).filter((d) => d && (d.texto || d.contaAntes)).map((d) => ({ ...d, contaMes: Number(d.contaDepois) || 0, contaAntes: Number(d.contaAntes) || 0, real: true }));
    const fonte = reais.length ? reais : raiz.Banco && raiz.Banco.nuvem ? [] : D.usinasVizinhas;
    const lista = fonte.filter((u) => u.cidade === o.cidade);
    const base = reais.length ? [...lista, ...fonte.filter((u) => u.cidade !== o.cidade)] : lista.length ? lista : fonte.filter((u) => u.cidade === 'Ribeirão Preto');
    const econMedia = base.length ? soma(base.map((u) => u.contaAntes - u.contaMes)) / base.length : 0;
    return { usinas: base, mesmaCidade: lista.length > 0, economiaMedia: Math.round(econMedia), total: base.length, reais: reais.length > 0 };
  }

  /* ---------- Análise completa de um orçamento ---------- */
  function analisar(o, p, prazo) {
    const ops = opcoes(o, p);
    const op = ops[o.opcaoEscolhida ?? 1] || ops.find((x) => x.destaque) || ops[0];
    const rx = raioX(o, p, op);
    return {
      opcoes: ops, op, raioX: rx, espera: espera(o, p, op), energia: custoEnergia(op, p),
      boleto: boleto(op, p, prazo || p.financiamento.prazos[2]), perfil: perfil(o, rx), vizinhos: vizinhos(o, p),
    };
  }

  function funil(lista, eventosDe) {
    const por = (s) => lista.filter((o) => o.status === s);
    const fechados = por('ganho').length, perdidos = por('perdido').length;
    const ativos = lista.filter((o) => !['ganho', 'perdido'].includes(o.status));
    return {
      ativos: ativos.length, fechados, perdidos,
      taxa: fechados + perdidos ? fechados / (fechados + perdidos) : 0,
      quentes: ativos.filter((o) => temperatura(o, eventosDe(o.token)).nivel === 'quente').length,
    };
  }


  /* Equipamento por extenso, com marca e potência escolhidas */
  const MARCAS = ['AUXSOL', 'DEYE', 'GROWATT', 'HUAWEI', 'SOLIS', 'SUNGROW', 'HOYMILES', 'TSUNESS', 'ENPHASE', 'FOX', 'GOODWE'];
  const tituloMarca = (m) => (m ? (m.length <= 4 ? m.toUpperCase() : m[0] + m.slice(1).toLowerCase()) : '');
  function equipamentos(op) {
    const kw = (v) => fmt(v, v % 1 ? 2 : 0).replace(/,?0+$/, (z) => (z.startsWith(',') ? '' : z));
    const marcaMod = op.modulo.marca || (op.modulo.nome.match(/^(JA Solar|\S+)/) || [])[1] || '';
    const fabInv = op.inversor.fabricante || (op.inversor.nome.toUpperCase().match(new RegExp('\\b(' + MARCAS.join('|') + ')\\b')) || [])[1] || '';
    const qtdInv = op.inversor.qtd || 1;
    let potUn = op.inversor.potenciaUnKw || op.inversor.potenciaKw / qtdInv;
    // cotações antigas leram "7.5KW" como 75: o nome do portal é a fonte certa
    const pNome = parseFloat(String((String(op.inversor.nome || '').match(/(\d+(?:[.,]\d+)?)\s*KW/i) || [])[1] || '').replace(',', '.'));
    if (pNome && Math.abs(pNome - potUn) > 0.01) potUn = pNome;
    const tipo = op.inversor.tipo === 'micro' || /micro/i.test(op.inversor.nome) ? 'micro' : op.inversor.hibrido || op.inversor.tipo === 'hibrido' ? 'hibrido' : 'string';
    const nomeTipo = { micro: qtdInv > 1 ? 'microinversores' : 'microinversor', hibrido: 'inversor híbrido', string: 'inversor' }[tipo];
    return {
      modulo: `${op.dim.placas} placas ${marcaMod} de ${op.modulo.potenciaW} W`.replace(/\s+/g, ' '),
      moduloCurto: `${marcaMod} ${op.modulo.potenciaW} W`.trim(),
      inversor: `${qtdInv > 1 ? qtdInv + ' ' : ''}${nomeTipo} ${tituloMarca(fabInv)} de ${kw(potUn)} kW`.replace(/\s+/g, ' ').replace(/^./, (c) => c.toUpperCase()),
      inversorCurto: tipo === 'micro' ? `${qtdInv} micro${qtdInv > 1 ? 's' : ''} ${tituloMarca(fabInv)} de ${kw(potUn)} kW` : `${tituloMarca(fabInv)} ${kw(potUn)} kW${qtdInv > 1 ? ' × ' + qtdInv : ''}`.trim(),
      marcaMod, fabInv: tituloMarca(fabInv), tipo,
    };
  }

  function fmt(v, c = 0) { return (v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c }); }

  raiz.Conversao = { equipamentos, indiceOpcao, consumoMedio, entrada, opcoes, raioX, espera, custoEnergia, boleto, perfil, temperatura, proximaAcao, vizinhos, analisar, funil, fmt };
})(window);
