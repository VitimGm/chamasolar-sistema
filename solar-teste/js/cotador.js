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
    const cab = { 'Content-Type': 'application/json' };
    if (raiz.__donoRobo) cab['X-Dono'] = raiz.__donoRobo; // só o próprio robô (fila) manda: o navegador não, para funcionar com robôs antigos
    const r = await fetch(URL_ROBO + rota, { method: corpo ? 'POST' : 'GET', headers: cab, body: corpo ? JSON.stringify(corpo) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const x = new Error(j.erro || `O robô respondeu ${r.status}`); x.diag = j.diag || null; throw x; }
    return j;
  }
  const ROBO_ESPERADO = '2026-11-09e'; // versão do robô que acompanha este sistema
  let versaoRobo = null;
  let motivoRobo = '';
  async function conectado() {
    for (let tent = 0; tent < 2; tent++) {
      try {
        const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 4000);
        const r = await fetch(URL_ROBO + '/status', { signal: ctl.signal }); clearTimeout(t);
        const j = await r.json(); versaoRobo = j.versao || '0';
        motivoRobo = !j.ok ? 'erro' : (!j.logado ? 'sem-login' : '');
        return !!j.ok && !!j.logado;
      } catch { motivoRobo = 'bloqueado'; }
    }
    return false;
  }
  const roboDesatualizado = () => versaoRobo !== null && versaoRobo < ROBO_ESPERADO;

  /* ---------- Dados reais do portal (listas) + simulação de valores ---------- */
  const PORTAL = {
    modulos: [ // ordem real do portal em "Menor Preço Por Watt" (API, 08/11/2026). O robô novo manda a lista atual (catálogo).
      ['MFMA-1.3-MO-66-425W', 'Maxeon 425 W monofacial black', 425], ['MFOB-0.3-BF-132-620W', 'OSDA 620 W bifacial N type black', 620],
      ['MFAS-1.4-BF-132-615W', 'Astronergy 615 W bifacial N type', 615], ['MFRI-1.4-HJ-132-690W', 'Risen 690 W bifacial HJT', 690],
      ['MFJA-1.5-BF-132-615W', 'JA Solar 615 W bifacial N type', 615], ['MFAS-1.4-BF-144-575W', 'Astronergy 575 W bifacial N type', 575],
      ['MFAS-1.4-BF-144-580W', 'Astronergy 580 W bifacial N type', 580], ['MFTR-1.4-BF-132-720W', 'Trina 720 W bifacial N type', 720],
      ['MFAS-1.4-BF-132-705W', 'Astronergy 705 W bifacial N type', 705], ['MFJA-1.5-BF-132-620W', 'JA Solar 620 W bifacial N type', 620],
      ['MFJA-1.4-BF-132-625W', 'JA Solar 625 W bifacial N type', 625], ['MFTR-1.4-BF-132-715W', 'Trina 715 W bifacial N type', 715],
      ['MFRI-1.4-HJ-132-715W', 'Risen 715 W bifacial HJT', 715], ['MFLO-1.4-MO-144-635W', 'Longi 635 W monofacial N type', 635],
      ['MFLO-1.4-MO-144-650W', 'Longi 650 W monofacial N type', 650],
    ],
    tipos: ['INVERSOR STRING ON-GRID', 'MICROINVERSOR', 'INVERSOR STRING HÍBRIDO'],
    ligacoes: ['MONOFÁSICO', 'BIFÁSICO', 'TRIFÁSICO'],
    tensoes: { 'MONOFÁSICO': ['127/220V'], 'BIFÁSICO': ['127/220V', '220/380V'], 'TRIFÁSICO': ['127/220V', '220/380V'] },
    fabricantes: ['AUXSOL', 'DEYE', 'GROWATT', 'HUAWEI', 'SOLIS', 'SUNGROW'],
    fabricantesMicro: ['DEYE', 'HOYMILES', 'TSUNESS', 'ENPHASE'], // a confirmar no portal
    potInversor: { 'INVERSOR STRING ON-GRID': [3, 4, 5, 6, 7.5, 8, 10, 12, 15], 'MICROINVERSOR': [1.6, 2.25], 'INVERSOR STRING HÍBRIDO': [3, 3.6, 5, 6, 8, 10, 12] },
    estruturas: {
      'Colonial': ['Modelo Belenergy em alumínio com ajuste vertical, indicado para telhas cerâmicas em geral', 'Modelo Belenergy em alumínio com ajuste horizontal, não indicado em telhas tégula e capa canal', 'Modelo SSM em alumínio com ajuste vertical, indicado para telhas cerâmicas em geral', 'Modelo Belenergy em aço galvanizado a fogo, com ajuste horizontal, não indicado para telhas do tipo tégula e capa canal'],
      // nomes exatos do portal (API "TipoEstrutura", conferidos em 08/11/2026). Atenção: é "Telha Metálica" (com A)
      'Telha Fibrocimento': ['Haste de aço inoxidável - Modelo com 200mm para Madeira', 'Haste de aço inoxidável - Modelo com 250mm para Madeira', 'Haste de aço inoxidável - Modelo com 300mm para Madeira', 'Haste de aço inoxidável - Modelo com 200mm para Madeira com sextavado interno', 'Haste de aço inoxidável - Modelo com 200mm para metal com rosca máquina', 'Haste galvanizada a fogo - Modelo com 200mm para Madeira', 'Haste galvanizada a fogo - Modelo com 250mm para Madeira', 'Haste galvanizada a fogo - Modelo com 300mm para Madeira'],
      'Telha Metálica': ['Suporte Pé em L c/ Perfil', 'Mini Trilho 130mm', 'Mini Trilho 260mm', 'Mini Trilho 550mm', 'Mini Trilho Alto', 'Mini Trilho - Telha Zipada'],
      'Telha Shingle': ['Suporte pé em L para telha Shingle'], 'Laje': ['Suporte para Laje Ajustável'], 'Solo': ['Isopleta de 45 m/s - Mesa de 8 até 64 módulos'],
    },
    orientacoes: ['Retrato', 'Paisagem'],
    fretes: ['Cliente Retira', 'Transportadora escolhida pelo cliente', 'Belenus Entrega no Cliente'],
    pagamentos: ['Plano de Pagamento', 'Outras Formas de Pagamento'],
  };

  function simInversores({ tipo, ligacao, fabricantes, kwp, placas }) {
    const fabs = fabricantes && fabricantes.length ? fabricantes : PORTAL.fabricantes;
    const pots = tipo === 'MICROINVERSOR' ? [2.25] : [3, 4, 5, 6, 7.5, 8, 10, 12, 15];
    const lista = [];
    fabs.forEach((f) => pots.forEach((kw) => {
      if (ligacao === 'MONOFÁSICO' && kw > 10) return;
      if (ligacao === 'TRIFÁSICO' && kw < 5) return;
      const qtd = tipo === 'MICROINVERSOR' ? (placas ? Math.ceil(placas / 4) : Math.ceil(kwp / kw)) : 1; // micro de 2,25 kW: 4 placas por unidade
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
      // o que o portal REALMENTE usou (estrutura/fixação): é isso que vai para o kit e para a proposta
      if (s.etapa === 3 && r.opcoes && e.estrutura) { if (r.opcoes.tipoUsado) e.estrutura.tipo = r.opcoes.tipoUsado; if (r.opcoes.detalheUsado) e.estrutura.detalhe = r.opcoes.detalheUsado; }
      s.tempos = s.tempos || []; if (r.ms) s.tempos.push({ etapa: s.etapa, ms: r.ms });
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
      s.opcoes.inversores = simInversores({ tipo: e.tipoInversor || PORTAL.tipos[0], ligacao: e.ligacao, fabricantes: e.fabricantes, kwp: (e.modulo.qtd * e.modulo.potenciaW) / 1000, placas: e.modulo.qtd });
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
      // valores FICTÍCIOS de teste: o preço real vem só do robô / banco, nunca do código
      const fatorMod = 1 + (PORTAL.modulos.findIndex((m) => m[0] === e.modulo.sku) / PORTAL.modulos.length) * 0.12;
      const fatorInv = e.inversor.tipo === 'hibrido' ? 1.55 : e.inversor.tipo === 'micro' ? 1.25 : 1;
      const extras = [...(e.itensCC || []), ...(e.itensCA || [])].reduce((t, i) => t + (ADIC[i.sku] || 0) * i.qtd, 0);
      const semEstr = e.estrutura.semEstrutura ? 0.88 : 1;
      const valorProdutos = r2(kwp * 1000 * 1.85 * fatorMod * fatorInv * semEstr + extras);
      s.opcoes = { fretes: PORTAL.fretes, pagamentos: PORTAL.pagamentos, valorProdutos };
      s.etapa = 7;
    } else if (s.etapa === 7) {
      const frete = /Entrega no Cliente/.test(e.frete) ? r2(s.opcoes.valorProdutos * 0.08) : 0; /* fictício */
      s.final = { valorKit: r2(s.opcoes.valorProdutos + frete), valorProdutos: s.opcoes.valorProdutos, frete, numero: 'SIMULADO' };
      s.etapa = 8;
    }
    return s;
  }


  /* ---------- Cotação automática de uma opção (mesmas telas, escolhas por regra) ---------- */
  const REGRAS = { overloadMin: 0, overloadMax: 35 };
  const semAcento = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  // o sistema e o portal escrevem diferente ("Telha Metálico" × "Telha Metálica"): compara sempre pela chave
  const ALIAS_TIPO = { 'telha metalico': 'telha metalica', metalico: 'telha metalica', metalica: 'telha metalica', ceramico: 'colonial', ceramica: 'colonial', fibrocimento: 'telha fibrocimento', shingle: 'telha shingle' };
  const chaveTipo = (t) => { const x = semAcento(t); return ALIAS_TIPO[x] || x; };
  const acharTipo = (tipos, pedido) => (tipos || []).find((t) => chaveTipo(t) === chaveTipo(pedido)) || null;
  // marca do módulo: o portal manda o fabricante; nos nomes antigos vem no fim ("... CABO 1.4M JA SOLAR")
  const fabModulo = (nome) => (String(nome || '').match(/CABO\s+[\d.,]+\s*M\s+(.+)$/i) || [])[1] || (String(nome || '').match(/^(JA Solar|\S+)/) || [])[1];
  const marcaDe = (m) => (m && (m.fabricante || fabModulo(m.nome))) || '';
  const parametrosDe = () => (raiz.Banco && raiz.Banco.parametros && raiz.Banco.parametros()) || {};
  function regrasDe(base, par) {
    const r = (base && base.regras) || {}, num = (v) => (v === '' || v == null || !isFinite(+v) ? null : +v);
    // overloadMax 0 (ou vazio) = vale o limite do fabricante (datasheet: potência máxima de entrada ÷ potência do inversor)
    return { overloadMin: num(r.overloadMin) ?? num(par.roboOverloadMin) ?? REGRAS.overloadMin, overloadMax: num(r.overloadMax) ?? num(par.roboOverloadMax) ?? 0, modMinW: num(r.modMinW) ?? num(par.roboModMinW) ?? 0 };
  }
  /* custo de estrutura por placa (preço de lista, R$), só para comparar placas grandes × pequenas.
     Medido no portal em 08/11/2026: colonial ≈ 98, metálica mini trilho ≈ 40; os outros são estimativas. */
  const EST_POR_PLACA = { colonial: 98, 'telha fibrocimento': 85, 'telha metalica': 40, 'telha shingle': 90, laje: 180, solo: 250 };
  const DESCONTO_KIT = 0.85; // o portal dá ~15% no kit montado sobre o preço de lista de cada item
  const qtdPara = (m, kwp) => Math.max(m.qtdSugerida || 0, Math.ceil((kwp * 1000) / m.potenciaW - 0.05));
  /* Escolha do módulo: com preço do portal, o menor custo por kWp INSTALADO (placa + estrutura + mão de obra por placa).
     Placa barata por watt mas pequena pede mais estrutura e mais mão de obra: isso também entra no preço da proposta. */
  function escolherModulo(mods, base, par) {
    const fab = semAcento(base.fabMod), pot = +base.potMod || 0, rg = regrasDe(base, par);
    let cands = (mods || []).filter((m) => (!fab || semAcento(marcaDe(m)) === fab || semAcento(fabModulo(m.nome)) === fab) && (!pot || m.potenciaW === pot));
    if (base.moduloSku) { const x = cands.find((m) => m.sku === base.moduloSku); if (x) return { mod: x, motivo: 'módulo pedido' }; }
    if (!cands.length) return { mod: null, motivo: '' };
    if (!fab && !pot && rg.modMinW) { const c2 = cands.filter((m) => m.potenciaW >= rg.modMinW); if (c2.length) cands = c2; }
    const comPreco = cands.filter((m) => m.precoUnEst > 0 && m.potenciaW > 0);
    if (comPreco.length < 2) return { mod: cands.find((m) => m.kwp + 0.001 >= base.kwp) || cands[0], motivo: 'menor preço por watt do portal' };
    const est = EST_POR_PLACA[chaveTipo(base.estruturaTipo)] ?? 90, mao = +base.custoPorPlaca || +par.maoDeObraPorPlaca || 100;
    const custo = (m) => { const q = qtdPara(m, base.kwp); return (q * ((m.precoUnEst + (base.semEstrutura ? 0 : est)) * DESCONTO_KIT + mao)) / ((q * m.potenciaW) / 1000); };
    let pool = comPreco.filter((m) => (qtdPara(m, base.kwp) * m.potenciaW) / 1000 <= base.kwp * 1.12 + 0.001); // sem passar muito do tamanho pedido
    if (!pool.length) pool = comPreco;
    pool = [...pool].sort((a, b) => custo(a) - custo(b));
    return { mod: pool[0], motivo: 'menor custo por kWp instalado (placa + estrutura + mão de obra): ' + pool.slice(0, 3).map((m) => `${marcaDe(m)} ${m.potenciaW} W ≈ R$ ${Math.round(custo(m))}/kWp`).join(' · ') };
  }
  /* Sobrecarga (overload) do inversor: o limite é o do FABRICANTE (datasheet: potência máxima de entrada CC).
     Acima de ~20% o inversor começa a "cortar" o pico do meio-dia (clipping). Perda anual estimada para o Brasil
     (sol forte, telhado fixo), pela razão CC/CA: conta conservadora, usada para escolher e para avisar. */
  const CLIP = [[1.0, 0], [1.2, 0], [1.3, 0.005], [1.4, 0.015], [1.5, 0.03], [1.6, 0.05], [1.7, 0.075], [1.8, 0.1], [2.0, 0.15], [2.5, 0.25]];
  function perdaClipping(overloadPct) {
    const r = 1 + (Number(overloadPct) || 0) / 100; if (r <= CLIP[0][0]) return 0;
    for (let i = 1; i < CLIP.length; i++) if (r <= CLIP[i][0]) { const [r0, p0] = CLIP[i - 1], [r1, p1] = CLIP[i]; return Math.round((p0 + ((p1 - p0) * (r - r0)) / (r1 - r0)) * 1000) / 1000; }
    return CLIP[CLIP.length - 1][1];
  }
  const limiteFabricante = (v) => (v && v.maxEntradaKw > 0 && v.potenciaKw > 0 ? Math.round((v.maxEntradaKw / v.potenciaKw - 1) * 1000) / 10 : null);
  const VALOR_WP = 3.0; // R$ por Wp de uma usina instalada: dá o valor da energia perdida no corte
  /* Inversor: aceito até o limite do fabricante (ou o teto dos Parâmetros, se tiver); entre os aceitos, o de menor
     custo TOTAL = preço do inversor + valor da geração perdida no corte. Assim um inversor pequeno só ganha quando compensa. */
  function escolherInversor(lista, tipo, potKw, regras = REGRAS, kwp = 0) {
    if (!lista || !lista.length) return null;
    const unKw = (v) => v.potenciaUnKw || (v.potenciaKw || 0) / (v.qtd || 1);
    if (potKw) { const exato = lista.filter((v) => Math.abs(unKw(v) - potKw) < 0.01); if (exato.length) lista = exato; else return null; }
    const custo = (v) => v.precoEst * 0.85 + perdaClipping(v.overload) * (kwp || (v.potenciaKw || 0) * (1 + (v.overload || 0) / 100)) * 1000 * VALOR_WP;
    const melhor = (l) => { const c = l.filter((v) => v.precoEst > 0); return c.length ? [...c].sort((a, b) => custo(a) - custo(b) || Math.abs(a.overload - 15) - Math.abs(b.overload - 15))[0] : l[0]; };
    if (tipo === 'MICROINVERSOR') return melhor(lista);
    const teto = (v) => (regras.overloadMax > 0 ? regras.overloadMax : limiteFabricante(v) ?? REGRAS.overloadMax);
    const dentro = lista.filter((v) => v.overload >= regras.overloadMin && v.overload <= teto(v));
    return dentro.length ? melhor(dentro) : [...lista].sort((a, b) => Math.abs(a.overload - 15) - Math.abs(b.overload - 15))[0];
  }
  async function cotarAuto(modo, base, aviso = () => {}) {
    const par = parametrosDe(), rg = regrasDe(base, par);
    const s = novaSessao(modo);
    Object.assign(s.escolhas, { kwp: base.kwp, ligacao: base.ligacao, nome: base.nome });
    aviso('potência'); await avancar(s, { kwp: base.kwp });
    const { mod, motivo } = escolherModulo(s.opcoes.modulos || [], base, par);
    if (!mod && (base.fabMod || base.potMod)) throw new Error(`O portal não tem módulo ${base.fabMod || ''} ${base.potMod ? base.potMod + ' W' : ''} hoje.`);
    if (!mod) throw new Error('O portal não devolveu módulos.');
    s.escolhaModulo = motivo;
    aviso('módulo'); await avancar(s, { moduloSku: mod.sku, moduloQtd: qtdPara(mod, base.kwp) });
    /* Ligação do INVERSOR (não é a do cliente): em rede 127/220 V o inversor monofásico 220 V liga entre 2 fases.
       Cliente bifásico → mono 220. Cliente trifásico → mono 220 até o limite em kW (Parâmetros), acima disso trifásico 220.
       Microinversor é sempre monofásico 220 V. */
    const limite = Number(par.limiteMonoEmTriKw) || 10;
    const potEst = +base.potInv || (base.kwp / 1.2);
    let ligDesejada = base.tipoInversor === 'MICROINVERSOR' || base.ligacao !== 'TRIFÁSICO' ? 'MONOFÁSICO' : potEst <= limite ? 'MONOFÁSICO' : 'TRIFÁSICO';
    const ligs = s.opcoes.ligacoes || [];
    const lig = ligs.includes(ligDesejada) ? ligDesejada : ligs.includes(base.ligacao) ? base.ligacao : ligs[0];
    const tens = (s.opcoes.tensoes || {})[lig] || [];
    const ten = tens.find((t) => /127\s*\/\s*220|^220/.test(t) && !/380/.test(t)) || tens[0];
    const fabs = base.fabInv ? [base.fabInv] : [];
    aviso('inversor'); await avancar(s, { filtrar: true, tipoInversor: base.tipoInversor, ligacao: lig, tensao: ten, fabricantes: fabs });
    const kwpSis = (s.escolhas.modulo.qtd * s.escolhas.modulo.potenciaW) / 1000;
    let inv = escolherInversor(s.opcoes.inversores, base.tipoInversor, +base.potInv || 0, rg, kwpSis);
    // não achou: tenta a outra ligação possível (mono ↔ trifásico) antes de desistir
    const outra = lig === 'MONOFÁSICO' ? (base.ligacao === 'TRIFÁSICO' ? 'TRIFÁSICO' : null) : 'MONOFÁSICO';
    if (!inv && outra && ligs.includes(outra)) { const t2 = ((s.opcoes.tensoes || {})[outra] || []).find((t) => /127\s*\/\s*220|^220/.test(t) && !/380/.test(t)) || '127/220V'; await avancar(s, { filtrar: true, tipoInversor: base.tipoInversor, ligacao: outra, tensao: t2, fabricantes: fabs }); inv = escolherInversor(s.opcoes.inversores, base.tipoInversor, +base.potInv || 0, rg, kwpSis); }
    if (!inv) throw new Error(`O portal não tem ${base.tipoInversor.toLowerCase()}${base.fabInv ? ' ' + base.fabInv : ''}${base.potInv ? ' de ' + base.potInv + ' kW' : ''} para ${base.kwp} kWp nessa ligação.`);
    await avancar(s, { inversorSku: inv.sku });
    return fecharEstrutura(s, base, aviso);
  }
  // fixação pedida pelo vendedor (madeira/metal no fibrocimento; mini trilho, mini trilho alto ou suporte L na metálica; gancho no cerâmico)
  const RX_FIX = { madeira200: /200\s*mm.*madeira(?!.*sextavado)/i, madeira250: /250\s*mm.*madeira/i, madeira300: /300\s*mm.*madeira/i, madeiraSext: /madeira.*sextavado/i, metal: /met[aá]l|perfil/i,
    minitrilho130: /mini\s*trilho\s*130/i, minitrilho260: /mini\s*trilho\s*260/i, minitrilho550: /mini\s*trilho\s*550/i, minitrilhoAlto: /mini\s*trilho\s*alto/i, suporteL: /p[ée]\s*em\s*L/i, zipada: /zipada/i,
    vertical: /Belenergy em alum[ií]nio com ajuste vertical/i, horizontal: /Belenergy em alum[ií]nio com ajuste horizontal/i, ssm: /SSM/i, galvanizado: /galvaniza/i,
    galv200: /galvaniza.*200\s*mm.*madeira/i, galv250: /galvaniza.*250\s*mm.*madeira/i, galv300: /galvaniza.*300\s*mm.*madeira/i };
  const FIX_PADRAO = { colonial: 'vertical' }; // cerâmico: o gancho indicado para telhas cerâmicas em geral
  /* Da estrutura até a confirmação (o mesmo para a cotação completa e para a "só troca a estrutura") */
  async function fecharEstrutura(s, base, aviso) {
    const tipos = Object.keys(s.opcoes.estruturas || {});
    const tipo = acharTipo(tipos, base.estruturaTipo);
    // nunca cota com outra estrutura no lugar da pedida (antes caía no 1º tipo da lista: colonial no lugar de metálica)
    if (!tipo && !base.semEstrutura) throw new Error(`O portal não tem a estrutura "${base.estruturaTipo}" (tem: ${tipos.join(', ') || 'nenhuma'}).`);
    let det = (s.opcoes.estruturas || {})[tipo] || [];
    if (!det.length && tipo && !base.semEstrutura) det = await detalhes(s, tipo);
    const fx = base.fixacao || FIX_PADRAO[chaveTipo(tipo)];
    const pref = fx && RX_FIX[fx] ? det.find((d) => RX_FIX[fx].test(d)) : null;
    if (pref) det = [pref, ...det.filter((d) => d !== pref)];
    const placas = s.escolhas.modulo.qtd, linhas = placas > 12 ? 2 : 1;
    const lin = placas % linhas ? 1 : linhas; // número ímpar em 2 linhas: usa 1 linha
    aviso('estrutura'); await avancar(s, { semEstrutura: !!base.semEstrutura, estruturaTipo: tipo || base.estruturaTipo, estruturaDetalhe: det[0], linhas: lin, modulosPorLinha: placas / lin, orientacao: 'Retrato' });
    // automático: não mexe nas quantidades do portal (mandar a lista de volta podia zerar o MC4 lido antes da tela carregar)
    const manter = () => ({ itens: s.modo === 'conectado' ? [] : s.opcoes.itens });
    aviso('componentes'); await avancar(s, manter());
    await avancar(s, manter());
    await avancar(s, manter());
    aviso('confirmação'); await avancar(s, { nome: base.nome, estadoEntrega: 'SP', cidadeEntrega: base.cidade || 'Ribeirão Preto', frete: base.frete || 'Cliente Retira', pagamento: (s.opcoes.pagamentos || [])[0], salvar: base.salvar !== false });
    return s;
  }
  /* Mesmo kit (módulo e inversor) com OUTRA estrutura: o robô volta da confirmação para a estrutura e só recalcula
     (bem mais rápido: não refaz a lista de módulos, que leva ~10 s no portal). Usado nas pré-propostas. */
  async function recotarEstrutura(anterior, base, aviso = () => {}) {
    if (!anterior || anterior.modo !== 'conectado' || !anterior.final || !anterior.escolhas.modulo || !anterior.escolhas.inversor) throw new Error('sem cotação anterior para reaproveitar');
    const s = novaSessao('conectado');
    s.escolhas = JSON.parse(JSON.stringify(anterior.escolhas)); s.escolhas.nome = base.nome; s.escolhaModulo = anterior.escolhaModulo; s.reaproveitada = true;
    s.etapa = 30; aviso('trocando só a estrutura');
    await avancar(s, { moduloSku: s.escolhas.modulo.sku, moduloQtd: s.escolhas.modulo.qtd, inversorSku: s.escolhas.inversor.sku });
    return fecharEstrutura(s, base, aviso);
  }

  function paraKit(s, nivel) {
    const e = s.escolhas, f = s.final, ficha = raiz.Catalogo ? raiz.Catalogo.fichaModulo(e.modulo.potenciaW) : {};
    const kwp = (e.modulo.qtd * e.modulo.potenciaW) / 1000, avisos = [...(f.avisos || [])];
    if (f.valorKit > 0 && kwp > 0) { const rsWp = f.valorKit / (kwp * 1000); if (rsWp < 0.6 || rsWp > 4.5) avisos.push(`R$ ${rsWp.toFixed(2)}/Wp está fora do normal: confira a cotação no portal.`); }
    const pc = e.inversor && e.inversor.tipo !== 'micro' ? perdaClipping(e.inversor.overload) : 0;
    if (pc >= 0.02) avisos.push(`Inversor com sobrecarga de ${String(e.inversor.overload).replace('.', ',')}%: corta ~${Math.round(pc * 100)}% da geração no pico (o fabricante aceita${limiteFabricante(e.inversor) ? ' até ' + limiteFabricante(e.inversor) + '%' : ''}).`);
    return {
      nivel, origem: s.modo, numeroBelenergy: f.numero, pdfBelenergy: f.pdf ? f.pdf.nome : null, nomeOrcamento: e.nome, segundos: s.tempos ? Math.round(s.tempos.reduce((a, t) => a + t.ms, 0) / 1000) : null, frete: e.frete, pagamento: e.pagamento, entrega: `${e.cidadeEntrega || ''}/${e.estadoEntrega || ''}`, cotadoEm: new Date().toISOString(),
      valorKit: f.valorKit, valorProdutos: f.valorProdutos, valorFrete: f.frete,
      // preço de cada item (lista do portal) e de onde veio o valor: 'api' = carrinho do portal; 'tela' = texto da tela
      itensPreco: f.itensPreco || null, descontoKit: f.descontoKit ?? null, fonte: f.fonte || (s.modo === 'conectado' ? 'tela' : 'simulado'), versaoRobo: f.versao || null, avisos, escolhaModulo: s.escolhaModulo || null, reaproveitada: !!s.reaproveitada,
      modulo: { sku: e.modulo.sku, nome: e.modulo.nome, marca: marcaDe(e.modulo), potenciaW: e.modulo.potenciaW, qtd: e.modulo.qtd, ...ficha },
      inversor: { sku: e.inversor.sku, qtd: e.inversor.qtd || 1, potenciaUnKw: e.inversor.potenciaUnKw || (e.inversor.potenciaKw || 0) / (e.inversor.qtd || 1), nome: e.inversor.nome + (e.inversor.qtd > 1 ? ` (${e.inversor.qtd} un.)` : ''), potenciaKw: e.inversor.potenciaKw, tipo: e.inversor.tipo, fabricante: e.inversor.fabricante, overload: e.inversor.overload,
        // datasheet: até quanto o fabricante aceita de sobrecarga e quanto do pico o inversor corta (estimado)
        overloadMaxFabricante: limiteFabricante(e.inversor), maxEntradaKw: e.inversor.maxEntradaKw || null, perdaClipping: e.inversor.tipo === 'micro' ? null : perdaClipping(e.inversor.overload) },
      estrutura: e.estrutura, itens: { estrutura: e.itensEstrutura, cc: (e.itensCC || []).filter((i) => i.qtd > 0), ca: (e.itensCA || []).filter((i) => i.qtd > 0) },
      descricao: { Inversor: 'Inversor string: o melhor custo por energia gerada.', Microinversor: 'Um microinversor para cada par de placas: ideal com sombra e mais seguro.' }[nivel] || 'Kit fechado Belenergy.',
    };
  }

  raiz.Cotador = { ETAPAS, PORTAL, REGRAS, perdaClipping, limiteFabricante, cotarAuto, recotarEstrutura, escolherModulo, escolherInversor, chaveTipo, acharTipo, regrasDe, fabModulo, marcaDe, detalhes, conectado, novaSessao, avancar, paraKit, URL_ROBO, ROBO_ESPERADO, roboDesatualizado, versaoRobo: () => versaoRobo, motivoRobo: () => motivoRobo };
})(window);
