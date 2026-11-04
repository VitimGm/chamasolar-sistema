/* =====================================================================
   Cotador de KIT FECHADO Belenergy — mesmo caminho do portal:
   Personalize seu Gerador → Convencional →
   1 Potência → 2 Módulo → 3 Inversor → 4 Estrutura → 5 Componentes →
   6 Componentes elétricos → 7 Orçamento (nome, frete, pagamento) → VALOR DO KIT
   Conectado: fala com o robô no PC do vendedor (fontes/solar-belenergy/cotador.mjs),
   que conduz o site com a sessão do próprio vendedor.
   Simulado: mesmas telas e escolhas, com valores de teste.
   ===================================================================== */
(function (raiz) {
  'use strict';
  const URL_ROBO = 'http://127.0.0.1:8787';
  const ETAPAS = ['Potência', 'Módulo', 'Inversor', 'Estrutura', 'Componentes', 'Elétricos', 'Orçamento'];

  /* ---------- Conectado ---------- */
  async function chamar(rota, corpo) {
    const r = await fetch(URL_ROBO + rota, { method: corpo ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json' }, body: corpo ? JSON.stringify(corpo) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.erro || `O robô respondeu ${r.status}`);
    return j;
  }
  async function conectado() {
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 1200);
      const r = await fetch(URL_ROBO + '/status', { signal: ctl.signal }); clearTimeout(t);
      const j = await r.json(); return !!j.ok && !!j.logado;
    } catch { return false; }
  }

  /* ---------- Simulado (valores de teste, preços de módulo reais da amostra) ---------- */
  const SIM = {
    modulos: [
      { sku: 'MFMA-1.3-MO-66-425W', nome: 'Maxeon 425 W monofacial', marca: 'Maxeon', potenciaW: 425, precoUn: 335.75 },
      { sku: 'MFAS-1.4-BF-132-615W', nome: 'Astronergy 615 W bifacial N type', marca: 'Astronergy', potenciaW: 615, precoUn: 559.04 },
      { sku: 'MFAS-1.4-BF-144-575W', nome: 'Astronergy 575 W bifacial N type', marca: 'Astronergy', potenciaW: 575, precoUn: 557.75 },
      { sku: 'MFAS-1.4-BF-144-580W', nome: 'Astronergy 580 W bifacial N type', marca: 'Astronergy', potenciaW: 580, precoUn: 562.61 },
      { sku: 'MFJA-1.5-BF-132-615W', nome: 'JA Solar 615 W bifacial N type', marca: 'JA Solar', potenciaW: 615, precoUn: 590.40 },
      { sku: 'MFJA-1.5-BF-132-620W', nome: 'JA Solar 620 W bifacial N type', marca: 'JA Solar', potenciaW: 620, precoUn: 620.00 },
    ],
    tipos: ['INVERSOR STRING ON-GRID', 'MICROINVERSOR', 'INVERSOR STRING HÍBRIDO'],
    ligacoes: ['MONOFÁSICO', 'BIFÁSICO', 'TRIFÁSICO'],
    tensoes: { 'MONOFÁSICO': ['220'], 'BIFÁSICO': ['220'], 'TRIFÁSICO': ['220', '380'] },
    fabricantes: { 'INVERSOR STRING ON-GRID': ['DEYE', 'SOLIS', 'GROWATT', 'SUNGROW'], 'MICROINVERSOR': ['DEYE', 'HOYMILES', 'TSUNESS'], 'INVERSOR STRING HÍBRIDO': ['DEYE', 'SOLIS'] },
    estruturas: {
      'TELHADO CERÂMICO / COLONIAL': ['Gancho ajustável alumínio + perfil 2,4 m', 'Gancho ajustável alumínio + perfil 4,8 m'],
      'TELHADO FIBROCIMENTO': ['Parafuso estrutural + perfil 2,4 m', 'Mini trilho'],
      'TELHADO METÁLICO': ['Mini trilho', 'Perfil + suporte telha trapezoidal'],
      'LAJE': ['Triângulo alumínio', 'Lastro'],
      'SOLO': ['Estrutura de solo em alumínio'],
    },
    orientacoes: ['RETRATO', 'PAISAGEM'],
    fretes: ['CIF (entrega da Belenergy)', 'FOB (retira / transportadora própria)'],
    pagamentos: ['À vista (Pix/boleto)', 'Boleto 28 dias', 'Cartão', 'Financiamento Belenergy'],
  };
  const r2 = (v) => Math.round(v * 100) / 100;

  function simInversores({ tipo, ligacao, fabricante, kwp }) {
    const fabs = fabricante ? [fabricante] : SIM.fabricantes[tipo] || ['DEYE'];
    const pot = tipo === 'MICROINVERSOR' ? [1.6, 2.25] : [3, 3.6, 4, 5, 6, 8, 10, 12, 15];
    const lista = [];
    fabs.forEach((f, fi) => pot.forEach((kw) => {
      if (ligacao === 'MONOFÁSICO' && kw > 10) return;
      if (ligacao === 'TRIFÁSICO' && kw < 5 && tipo !== 'MICROINVERSOR') return;
      const qtd = tipo === 'MICROINVERSOR' ? Math.ceil((kwp * 1000) / (kw * 1000)) : 1;
      const rel = tipo === 'MICROINVERSOR' ? 1.2 : kwp / kw;
      if (tipo !== 'MICROINVERSOR' && (rel < 0.95 || rel > 1.45)) return;
      const base = tipo === 'INVERSOR STRING HÍBRIDO' ? 1700 : tipo === 'MICROINVERSOR' ? 1250 : 620;
      lista.push({ sku: `${f.slice(0, 3)}-${tipo[9] || 'M'}-${kw}K`, nome: `${f} ${tipo === 'MICROINVERSOR' ? 'microinversor' : tipo.toLowerCase().replace('inversor ', '')} ${String(kw).replace('.', ',')} kW`, fabricante: f, potenciaKw: kw * qtd, qtd,
        precoUn: r2((base * kw + 1400) * (1 + fi * 0.06)), relacaoDcAc: r2(rel), tipo: tipo === 'INVERSOR STRING HÍBRIDO' ? 'hibrido' : tipo === 'MICROINVERSOR' ? 'micro' : 'string' });
    }));
    return lista.sort((a, b) => a.precoUn * a.qtd - b.precoUn * b.qtd);
  }
  function simComponentes(placas, estrutura) {
    const pares = Math.ceil(placas / 2);
    return [
      { sku: 'PERFIL-24A', nome: 'Perfil de alumínio 2,4 m', qtd: Math.ceil(placas * 0.85) * 2, precoUn: 58.9 },
      { sku: 'GANCHO-AJ', nome: estrutura.detalhe.split('+')[0].trim() || 'Suporte de fixação', qtd: placas * 2, precoUn: 31.14 },
      { sku: 'GRFN304A', nome: 'Grampo final 30 mm (4 peças)', qtd: estrutura.linhas * 2, precoUn: 16.75 },
      { sku: 'GRIN304A', nome: 'Grampo intermediário 30 mm (4 peças)', qtd: Math.max(pares - estrutura.linhas, 1), precoUn: 18.9 },
      { sku: 'ATERRA2A', nome: 'Garra de aterramento', qtd: Math.ceil(placas / 2), precoUn: 7.38 },
      { sku: 'CABO-6MM', nome: 'Cabo solar 6 mm² (m)', qtd: 50, precoUn: 6.9 },
      { sku: 'MC4-PAR', nome: 'Conector MC4 (par)', qtd: 4, precoUn: 9.5 },
    ];
  }
  function simEletricos(kwInv) {
    return [
      { sku: 'SB-DC', nome: 'String box CC', qtd: 1, precoUn: 389, opcional: true },
      { sku: 'DPS-CA', nome: `DPS CA ${kwInv > 8 ? 'trifásico' : 'bipolar'}`, qtd: 1, precoUn: 119, opcional: true },
      { sku: 'DISJ-CA', nome: `Disjuntor CA ${kwInv > 8 ? '50' : '32'} A`, qtd: 1, precoUn: 64, opcional: true },
    ];
  }

  /* Converte o que o robô leu da tela para o formato das telas do sistema */
  function adaptar(o, e) {
    const num = (t) => +String(t || '').replace(/[^\d,.]/g, '').replace(',', '.') || 0;
    const kwpKit = e.modulo ? (e.modulo.qtd * e.modulo.potenciaW) / 1000 : +e.kwp;
    if (o.modulos) o.modulos = o.modulos.map((m) => { const w = num(m.potencia) || num((m.nome.match(/(\d{3,4})\s?W/i) || [])[1]); const qtd = m.qtdSugerida || Math.ceil((+e.kwp * 1000) / w); return { ...m, potenciaW: w, qtdSugerida: qtd, kwp: r2((qtd * w) / 1000), total: m.preco ? r2(m.preco * qtd) : null, precoUn: m.preco }; });
    if (o.campos && !o.estruturas) {
      const c = (fc) => (o.campos.find((x) => x.fc === fc) || {}).opcoes || [];
      if (c('tipoInversor').length) { o.tipos = c('tipoInversor'); o.ligacoes = c('tipoLigacao').length ? c('tipoLigacao') : SIM.ligacoes; o.tensoes = new Proxy({}, { get: () => (c('tensaoNominal').length ? c('tensaoNominal') : ['220', '380']) }); o.fabricantes = new Proxy({}, { get: () => c('fabricante') }); }
    }
    if (o.inversores) o.inversores = o.inversores.map((v) => { const kw = num((v.nome.match(/(\d+(?:[.,]\d+)?)\s?K\s?W/i) || [])[1]); return { ...v, potenciaKw: kw, qtd: 1, precoUn: v.preco || 0, relacaoDcAc: kw ? r2(kwpKit / kw) : 0, tipo: /H[IÍ]BRID/i.test(v.nome) ? 'hibrido' : /MICRO/i.test(v.nome) ? 'micro' : 'string', fabricante: '' }; });
    if (o.componentes) o.componentes = o.componentes.map((x) => ({ ...x, sku: '', precoUn: x.precoUn || 0 }));
    if (o.eletricos) o.eletricos = o.eletricos.map((x) => ({ ...x, sku: '', precoUn: x.precoUn || 0 }));
    return o;
  }

  /* Sessão de cotação: guarda as escolhas, devolve as opções da próxima etapa */
  function novaSessao(modo) {
    const s = { modo, etapa: 0, escolhas: {}, opcoes: {} };
    return s;
  }
  async function avancar(s, entrada) {
    if (s.modo === 'conectado') {
      const e = s.escolhas, anterior = s.opcoes; Object.assign(e, entrada || {});
      if (s.etapa === 1) { const m = anterior.modulos.find((x) => x.sku === e.moduloSku); e.modulo = { ...m, qtd: +e.moduloQtd || m.qtdSugerida }; }
      if (s.etapa === 2 && !(entrada && entrada.filtrar)) e.inversor = anterior.inversores.find((x) => x.sku === e.inversorSku);
      if (s.etapa === 3) e.estrutura = { tipo: Object.values(entrada.campos || {})[0] || 'estrutura', detalhe: '', linhas: +(entrada.campos?.linhas || entrada.campos?.numeroLinhas || 1), modulosPorLinha: +(entrada.campos?.modulosPorLinha || 0), orientacao: entrada.campos?.orientacao || '', campos: entrada.campos };
      if (s.etapa === 6) { e.nome = entrada.campos?.nome || entrada.campos?.nomeOrcamento || e.nome; e.frete = Object.entries(entrada.campos || {}).find(([k]) => /frete/i.test(k))?.[1] || '—'; e.pagamento = Object.entries(entrada.campos || {}).find(([k]) => /pag/i.test(k))?.[1] || '—'; }
      const r = await chamar('/passo', { etapa: s.etapa, entrada });
      s.etapa = r.etapa; s.opcoes = adaptar(r.opcoes || {}, e); if (r.final) s.final = r.final;
      if (s.etapa === 4 && !e.componentes) e.componentes = null;
      return s;
    }
    // ----- simulado -----
    const e = s.escolhas; Object.assign(e, entrada || {});
    if (s.etapa === 0) { // potência informada → módulos do mais barato ao mais caro
      const kwp = +e.kwp;
      s.opcoes = { modulos: SIM.modulos.map((m) => { const qtd = Math.max(Math.ceil((kwp * 1000) / m.potenciaW), 1); return { ...m, qtdSugerida: qtd, kwp: r2((qtd * m.potenciaW) / 1000), total: r2(qtd * m.precoUn) }; }).sort((a, b) => a.total - b.total) };
      s.etapa = 1;
    } else if (s.etapa === 1) { // módulo escolhido → filtros de inversor
      const m = s.opcoes.modulos.find((x) => x.sku === e.moduloSku); e.modulo = { ...m, qtd: +e.moduloQtd || m.qtdSugerida };
      s.opcoes = { tipos: SIM.tipos, ligacoes: SIM.ligacoes, tensoes: SIM.tensoes, fabricantes: SIM.fabricantes, inversores: null };
      s.etapa = 2;
    } else if (s.etapa === 2 && entrada && entrada.filtrar) { // filtrar inversores (fica na etapa)
      s.opcoes.inversores = simInversores({ tipo: e.tipoInversor || SIM.tipos[0], ligacao: e.ligacao, fabricante: e.fabricante, kwp: (e.modulo.qtd * e.modulo.potenciaW) / 1000 });
    } else if (s.etapa === 2) { // inversor escolhido → estrutura
      e.inversor = s.opcoes.inversores.find((x) => x.sku === e.inversorSku);
      const placas = e.modulo.qtd;
      s.opcoes = { estruturas: SIM.estruturas, orientacoes: SIM.orientacoes, sugestao: { linhas: placas > 10 ? 2 : 1, modulosPorLinha: Math.ceil(placas / (placas > 10 ? 2 : 1)) } };
      s.etapa = 3;
    } else if (s.etapa === 3) { // estrutura → componentes
      e.estrutura = { tipo: e.estruturaTipo, detalhe: e.estruturaDetalhe, linhas: +e.linhas, modulosPorLinha: +e.modulosPorLinha, orientacao: e.orientacao };
      s.opcoes = { componentes: simComponentes(e.modulo.qtd, e.estrutura) };
      s.etapa = 4;
    } else if (s.etapa === 4) { // componentes ajustados → elétricos
      e.componentes = e.componentes || s.opcoes.componentes;
      s.opcoes = { eletricos: simEletricos(e.inversor.potenciaKw) };
      s.etapa = 5;
    } else if (s.etapa === 5) { // elétricos → orçamento
      e.eletricos = (e.eletricos || []).filter((x) => x.qtd > 0);
      s.opcoes = { fretes: SIM.fretes, pagamentos: SIM.pagamentos };
      s.etapa = 6;
    } else if (s.etapa === 6) { // finalizar → VALOR DO KIT
      const avulso = e.modulo.qtd * e.modulo.precoUn + e.inversor.qtd * e.inversor.precoUn
        + e.componentes.reduce((t, c) => t + c.qtd * c.precoUn, 0) + e.eletricos.reduce((t, c) => t + c.qtd * c.precoUn, 0);
      const frete = /CIF/.test(e.frete) ? avulso * 0.025 : 0;
      const ajustePg = /Cartão/.test(e.pagamento) ? 1.045 : /28/.test(e.pagamento) ? 1.015 : 1;
      const valorKit = r2((avulso * 0.9 + frete) * ajustePg); // kit fechado ~10% abaixo do avulso (SIMULADO)
      s.final = { valorKit, valorAvulso: r2(avulso), economiaKit: r2(avulso - avulso * 0.9), frete: r2(frete), numero: 'SIM-' + Math.floor(Math.random() * 90000 + 10000) };
      s.etapa = 7;
    }
    return s;
  }

  /* Converte a sessão finalizada no "kit fechado" que o motor usa */
  function paraKit(s, nivel) {
    const e = s.escolhas, f = s.final, ficha = raiz.Catalogo ? raiz.Catalogo.fichaModulo(e.modulo.potenciaW) : {};
    return {
      nivel, origem: s.modo, numeroBelenergy: f.numero, nomeOrcamento: e.nome, frete: e.frete, pagamento: e.pagamento, cotadoEm: new Date().toISOString(),
      valorKit: f.valorKit, valorAvulso: f.valorAvulso,
      modulo: { sku: e.modulo.sku, nome: e.modulo.nome, potenciaW: e.modulo.potenciaW, qtd: e.modulo.qtd, ...ficha },
      inversor: { sku: e.inversor.sku, nome: e.inversor.nome + (e.inversor.qtd > 1 ? ` (${e.inversor.qtd} un.)` : ''), potenciaKw: e.inversor.potenciaKw, tipo: e.inversor.tipo, fabricante: e.inversor.fabricante },
      estrutura: e.estrutura, componentes: e.componentes, eletricos: e.eletricos,
      descricao: { Econômica: 'Melhor preço com equipamentos de linha.', Recomendada: 'Equilíbrio entre preço e garantia.', Premium: 'Equipamentos de topo ou bateria.' }[nivel] || 'Kit fechado Belenergy.',
    };
  }

  raiz.Cotador = { adaptar, ETAPAS, conectado, novaSessao, avancar, paraKit, URL_ROBO };
})(window);
