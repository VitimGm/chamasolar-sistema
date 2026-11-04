/* =====================================================================
   Cotador de KIT FECHADO Belenergy — idêntico ao portal (mapeado ao vivo
   em 04/11/2026 em belenus.com.br → Personalize seu Gerador → Convencional):
   0 Potência → 1 Módulo (Menor Preço Por Watt) → 2 Inversor (tipo, ligação,
   tensão, fabricante; lista com % de overload) → 3 Estrutura (arranjos) →
   4 Itens da estrutura (+/−/remover) → 5 Elétricos CC → 6 Elétricos CA →
   7 Confirmação (nome, entrega, frete, pagamento) → VALOR DA PROPOSTA.
   Conectado: robô no PC (fontes/solar-belenergy/cotador.mjs).
   Simulado: mesmas telas; valor calibrado por um kit real (R$ 1,59/Wp).
   ===================================================================== */
(function (raiz) {
  'use strict';
  const URL_ROBO = 'http://127.0.0.1:8787';
  const ETAPAS = ['Potência', 'Módulo', 'Inversor', 'Estrutura', 'Itens da estrutura', 'Elétricos CC', 'Elétricos CA', 'Confirmação'];
  const r2 = (v) => Math.round(v * 100) / 100;

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

  /* ---------- Dados reais do portal (listas) + simulação de valores ---------- */
  const PORTAL = {
    modulos: [ // ordem real do portal em "Menor Preço Por Watt" (04/11/2026)
      ['MFMB-1.3-MO-66-425W', 'Maxeon 425 W monofacial black', 425], ['MFMA-1.3-MO-66-425W', 'Maxeon 425 W monofacial', 425],
      ['MFAS-1.4-BF-132-615W', 'Astronergy 615 W bifacial N type', 615], ['MFRI-1.4-HJ-132-685W', 'Risen 685 W bifacial HJT', 685],
      ['MFJA-1.5-BF-132-615W', 'JA Solar 615 W bifacial N type', 615], ['MFAS-1.4-BF-144-575W', 'Astronergy 575 W bifacial N type', 575],
      ['MFAS-1.4-BF-144-580W', 'Astronergy 580 W bifacial N type', 580], ['MFAS-1.4-BF-132-705W', 'Astronergy 705 W bifacial N type', 705],
      ['MFTR-1.4-BF-132-720W', 'Trina 720 W bifacial N type', 720], ['MFJA-1.5-BF-132-620W', 'JA Solar 620 W bifacial N type', 620],
      ['MFJA-1.4-BF-132-625W', 'JA Solar 625 W bifacial N type', 625], ['MFTR-1.4-BF-132-715W', 'Trina 715 W bifacial N type', 715],
    ],
    tipos: ['INVERSOR STRING ON-GRID', 'MICROINVERSOR', 'INVERSOR STRING HÍBRIDO'],
    ligacoes: ['MONOFÁSICO', 'BIFÁSICO', 'TRIFÁSICO'],
    tensoes: { 'MONOFÁSICO': ['127/220V'], 'BIFÁSICO': ['127/220V', '220/380V'], 'TRIFÁSICO': ['127/220V', '220/380V'] },
    fabricantes: ['AUXSOL', 'DEYE', 'GROWATT', 'HUAWEI', 'SOLIS', 'SUNGROW'],
    estruturas: {
      'Colonial': ['Modelo Belenergy em alumínio com ajuste vertical, indicado para telhas cerâmicas em geral', 'Modelo Belenergy em alumínio com ajuste horizontal, não indicado em telhas tégula e capa canal', 'Modelo SSM em alumínio com ajuste vertical, indicado para telhas cerâmicas em geral', 'Modelo Belenergy em aço galvanizado a fogo, com ajuste horizontal, não indicado para telhas do tipo tégula e capa canal'],
      'Telha Fibrocimento': ['Parafuso estrutural (detalhe a confirmar no portal)'], 'Telha Metálico': ['Mini trilho (detalhe a confirmar no portal)'],
      'Telha Shingle': ['(detalhe a confirmar no portal)'], 'Laje': ['(detalhe a confirmar no portal)'], 'Solo': ['(detalhe a confirmar no portal)'],
    },
    orientacoes: ['Retrato', 'Paisagem'],
    fretes: ['Cliente Retira', 'Transportadora escolhida pelo cliente', 'Belenus Entrega no Cliente'],
    pagamentos: ['Plano de Pagamento', 'Outras Formas de Pagamento'],
  };

  function simInversores({ tipo, ligacao, fabricantes, kwp }) {
    const fabs = fabricantes && fabricantes.length ? fabricantes : PORTAL.fabricantes;
    const pots = tipo === 'MICROINVERSOR' ? [2.25] : [3, 4, 5, 6, 7.5, 8, 10, 12, 15];
    const lista = [];
    fabs.forEach((f) => pots.forEach((kw) => {
      if (ligacao === 'MONOFÁSICO' && kw > 10) return;
      if (ligacao === 'TRIFÁSICO' && kw < 5) return;
      const qtd = tipo === 'MICROINVERSOR' ? Math.ceil(kwp / kw) : 1;
      const over = (kwp / (kw * qtd) - 1) * 100;
      if (tipo !== 'MICROINVERSOR' && (over > 50 || over < -45)) return;
      const lig = ligacao.slice(0, 2);
      lista.push({ sku: `INV${f.slice(0, 2)}-${lig}-${kw}KW`, nome: `Inversor ${tipo === 'MICROINVERSOR' ? 'micro' : tipo === 'INVERSOR STRING HÍBRIDO' ? 'híbrido' : 'on-grid'} ${ligacao.toLowerCase()} ${String(kw).replace('.', ',')} kW ${f}`, fabricante: f, potenciaKw: kw * qtd, qtd, overload: r2(over), tipo: tipo === 'INVERSOR STRING HÍBRIDO' ? 'hibrido' : tipo === 'MICROINVERSOR' ? 'micro' : 'string' });
    }));
    // ordem do portal: menor overload positivo primeiro, depois os maiores
    return lista.sort((a, b) => (b.overload >= 0) - (a.overload >= 0) || (a.overload >= 0 ? b.overload - a.overload : a.overload - b.overload)).slice(0, 30);
  }
  function simItensEstrutura(placas, linhas) {
    return [
      { sku: 'ATERRA2A', nome: 'Garra aterramento 2 peças alumínio', qtd: Math.ceil(placas / 7) },
      { sku: 'GANCHOAJ2PROL2A', nome: 'Suporte gancho telha colonial c/ prolongador', qtd: Math.ceil(placas * 0.72) },
      { sku: 'GRFN304A', nome: 'Grampo final 30 mm (4 peças)', qtd: linhas },
      { sku: 'GRINT2A', nome: 'Grampo intermediário 2 peças', qtd: Math.max(placas - linhas, 1) },
      { sku: 'JUNPERF1A', nome: 'Junção para perfil', qtd: Math.max(Math.round(placas * 0.86), 1) },
      { sku: 'PERFIL1.23AL', nome: 'Perfil alumínio 1,23 m', qtd: 2 * linhas },
      { sku: 'PERFIL2.36AL', nome: 'Perfil alumínio 2,36 m', qtd: Math.max(Math.round(placas * 0.86), 2) },
    ];
  }
  const simCC = (placas) => [
    { sku: 'CBSOLBE-4MM-PT', nome: 'Cabo solar 4 mm preto (m)', qtd: 18 + Math.max(placas - 7, 0) * 2 },
    { sku: 'CBSOLBE-4MM-VM', nome: 'Cabo solar 4 mm vermelho (m)', qtd: 18 + Math.max(placas - 7, 0) * 2 },
    { sku: 'CONECSOLAR-01', nome: 'Conector solar macho/fêmea (2 pares)', qtd: Math.max(Math.ceil(placas / 7), 1) * 2 },
    { sku: 'SBCP-1E1S-1000V', nome: 'String box 1E/1S 1000V Clamper', qtd: 0 },
    { sku: 'DPSCP-CC-1000V-40KA', nome: 'DPS solar classe II CC 1000V Clamper', qtd: 0 },
    { sku: 'RSD-ARESWATT-1', nome: 'Desligamento rápido (RSD) p/ 2 módulos', qtd: 0 },
    { sku: 'BATHW-450V-5KW', nome: 'Bateria lítio Huawei LUNA2000 5 kWh', qtd: 0 },
  ];
  const simCA = () => [
    { sku: 'CBCA-4MM-PT', nome: 'Cabo CA flex 4 mm preto (100 m)', qtd: 0 },
    { sku: 'CBCA-4MM-VM', nome: 'Cabo CA flex 4 mm vermelho (100 m)', qtd: 0 },
    { sku: 'CBCA-4MM-VD', nome: 'Cabo CA flex 4 mm verde (100 m)', qtd: 0 },
    { sku: 'CBCA-6MM-PT', nome: 'Cabo CA flex 6 mm preto (100 m)', qtd: 0 },
  ];
  const ADIC = { 'SBCP-1E1S-1000V': 280, 'DPSCP-CC-1000V-40KA': 150, 'RSD-ARESWATT-1': 210, 'BATHW-450V-5KW': 9800, 'CBCA-4MM-PT': 430, 'CBCA-4MM-VM': 430, 'CBCA-4MM-VD': 430, 'CBCA-6MM-PT': 640 };

  async function detalhes(s, tipo) { return s.modo === 'conectado' ? (await chamar('/detalhes', { tipo })).detalhes || [] : PORTAL.estruturas[tipo] || []; }

  function novaSessao(modo) { return { modo, etapa: 0, escolhas: {}, opcoes: {} }; }

  async function avancar(s, entrada) {
    const e = s.escolhas;
    if (s.modo === 'conectado') {
      const ant = s.opcoes; Object.assign(e, entrada || {});
      if (s.etapa === 1) { const m = ant.modulos.find((x) => x.sku === e.moduloSku); e.modulo = { ...m, qtd: +e.moduloQtd || m.qtdSugerida }; }
      if (s.etapa === 2 && !(entrada && entrada.filtrar)) e.inversor = ant.inversores.find((x) => x.sku === e.inversorSku);
      if (s.etapa === 3) e.estrutura = { tipo: e.estruturaTipo, detalhe: e.estruturaDetalhe, linhas: +e.linhas, modulosPorLinha: +e.modulosPorLinha, orientacao: e.orientacao, semEstrutura: !!e.semEstrutura };
      const r = await chamar('/passo', { etapa: s.etapa, entrada });
      s.etapa = r.etapa; s.opcoes = r.opcoes || {}; if (r.final) s.final = r.final;
      return s;
    }
    Object.assign(e, entrada || {});
    if (s.etapa === 0) {
      const kwp = +e.kwp;
      s.opcoes = { modulos: PORTAL.modulos.map(([sku, nome, w]) => { const qtd = Math.max(Math.ceil((kwp * 1000) / w - 0.05), 1); /* portal arredonda para cima: 4 kWp → 7 × 615 W */ return { sku, nome, potenciaW: w, qtdSugerida: qtd, kwp: r2((qtd * w) / 1000) }; }) };
      s.etapa = 1;
    } else if (s.etapa === 1) {
      const m = s.opcoes.modulos.find((x) => x.sku === e.moduloSku); e.modulo = { ...m, qtd: +e.moduloQtd || m.qtdSugerida };
      s.opcoes = { tipos: PORTAL.tipos, ligacoes: PORTAL.ligacoes, tensoes: PORTAL.tensoes, fabricantes: PORTAL.fabricantes, inversores: null };
      s.etapa = 2;
    } else if (s.etapa === 2 && entrada && entrada.filtrar) {
      s.opcoes.inversores = simInversores({ tipo: e.tipoInversor || PORTAL.tipos[0], ligacao: e.ligacao, fabricantes: e.fabricantes, kwp: (e.modulo.qtd * e.modulo.potenciaW) / 1000 });
    } else if (s.etapa === 2) {
      e.inversor = s.opcoes.inversores.find((x) => x.sku === e.inversorSku);
      const placas = e.modulo.qtd, lin = placas > 12 ? 2 : 1;
      s.opcoes = { estruturas: PORTAL.estruturas, orientacoes: PORTAL.orientacoes, sugestao: { linhas: lin, modulosPorLinha: Math.ceil(placas / lin) } };
      s.etapa = 3;
    } else if (s.etapa === 3) {
      e.estrutura = { tipo: e.estruturaTipo, detalhe: e.estruturaDetalhe, linhas: +e.linhas, modulosPorLinha: +e.modulosPorLinha, orientacao: e.orientacao, semEstrutura: !!e.semEstrutura };
      s.opcoes = { itens: e.estrutura.semEstrutura ? [] : simItensEstrutura(e.modulo.qtd, e.estrutura.linhas) };
      s.etapa = 4;
    } else if (s.etapa === 4) {
      e.itensEstrutura = entrada.itens || s.opcoes.itens; s.opcoes = { itens: simCC(e.modulo.qtd) }; s.etapa = 5;
    } else if (s.etapa === 5) {
      e.itensCC = entrada.itens || s.opcoes.itens; s.opcoes = { itens: simCA() }; s.etapa = 6;
    } else if (s.etapa === 6) {
      e.itensCA = entrada.itens || s.opcoes.itens;
      const kwp = (e.modulo.qtd * e.modulo.potenciaW) / 1000;
      // calibrado no kit real: 4,3 kWp (7×615 W Astronergy + Huawei 4 kW + colonial) = R$ 6.848,21
      const fatorMod = 1 + (PORTAL.modulos.findIndex((m) => m[0] === e.modulo.sku) / PORTAL.modulos.length) * 0.12;
      const fatorInv = e.inversor.tipo === 'hibrido' ? 1.55 : e.inversor.tipo === 'micro' ? 1.25 : 1;
      const extras = [...(e.itensCC || []), ...(e.itensCA || [])].reduce((t, i) => t + (ADIC[i.sku] || 0) * i.qtd, 0);
      const semEstr = e.estrutura.semEstrutura ? 0.88 : 1;
      const valorProdutos = r2(kwp * 1000 * 1.5926 * fatorMod * fatorInv * semEstr + extras);
      s.opcoes = { fretes: PORTAL.fretes, pagamentos: PORTAL.pagamentos, valorProdutos };
      s.etapa = 7;
    } else if (s.etapa === 7) {
      const frete = /Entrega no Cliente/.test(e.frete) ? r2(s.opcoes.valorProdutos * 0.03) : 0;
      s.final = { valorKit: r2(s.opcoes.valorProdutos + frete), valorProdutos: s.opcoes.valorProdutos, frete, numero: 'SIMULADO' };
      s.etapa = 8;
    }
    return s;
  }

  function paraKit(s, nivel) {
    const e = s.escolhas, f = s.final, ficha = raiz.Catalogo ? raiz.Catalogo.fichaModulo(e.modulo.potenciaW) : {};
    return {
      nivel, origem: s.modo, numeroBelenergy: f.numero, nomeOrcamento: e.nome, frete: e.frete, pagamento: e.pagamento, entrega: `${e.cidadeEntrega || ''}/${e.estadoEntrega || ''}`, cotadoEm: new Date().toISOString(),
      valorKit: f.valorKit, valorProdutos: f.valorProdutos, valorFrete: f.frete,
      modulo: { sku: e.modulo.sku, nome: e.modulo.nome, potenciaW: e.modulo.potenciaW, qtd: e.modulo.qtd, ...ficha },
      inversor: { sku: e.inversor.sku, nome: e.inversor.nome + (e.inversor.qtd > 1 ? ` (${e.inversor.qtd} un.)` : ''), potenciaKw: e.inversor.potenciaKw, tipo: e.inversor.tipo, fabricante: e.inversor.fabricante, overload: e.inversor.overload },
      estrutura: e.estrutura, itens: { estrutura: e.itensEstrutura, cc: (e.itensCC || []).filter((i) => i.qtd > 0), ca: (e.itensCA || []).filter((i) => i.qtd > 0) },
      descricao: { Econômica: 'Melhor preço com equipamentos de linha.', Recomendada: 'Equilíbrio entre preço e garantia.', Premium: 'Equipamentos de topo ou bateria.' }[nivel] || 'Kit fechado Belenergy.',
    };
  }

  raiz.Cotador = { ETAPAS, PORTAL, detalhes, conectado, novaSessao, avancar, paraKit, URL_ROBO };
})(window);
