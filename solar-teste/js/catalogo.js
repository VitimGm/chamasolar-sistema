/* =====================================================================
   Catálogo de equipamentos (cadastro único) — vem do robô/integração
   Belenergy ou de planilha. O vendedor marca o que usa e o nível de cada
   módulo. As 3 opções do orçamento são montadas a partir dessa escolha.
   ===================================================================== */
(function (raiz) {
  'use strict';
  const D = raiz.DadosTeste;
  const CHAVE = 'sol2_catalogo';

  // Módulos com preço real lido no portal em 03/11/2026 (amostra). Ficha elétrica estimada.
  const amostraBelenergy = {
    fornecedor: 'Belenergy', origem: 'amostra FICTÍCIA (formato do portal)', capturadoEm: '2026-11-03T23:10:00-03:00',
    produtos: [
      { sku: 'MFMA-1.3-MO-66-425W', tipo: 'modulo', marca: 'Maxeon', descricao: 'Módulo monofacial 66 cél. P type 425 W black frame', potenciaW: 425, preco: 488.75, precoPorWp: 1.15, estoque: 1000, disponivelSP: true },
      { sku: 'MFAS-1.4-BF-144-575W', tipo: 'modulo', marca: 'Astronergy', descricao: 'Módulo bifacial 144 cél. N type 575 W', potenciaW: 575, preco: 661.25, precoPorWp: 1.15, estoque: 1000, disponivelSP: true },
      { sku: 'MFAS-1.4-BF-144-580W', tipo: 'modulo', marca: 'Astronergy', descricao: 'Módulo bifacial 144 cél. N type 580 W', potenciaW: 580, preco: 667.00, precoPorWp: 1.15, estoque: 1000, disponivelSP: true },
      { sku: 'MFAS-1.4-BF-132-615W', tipo: 'modulo', marca: 'Astronergy', descricao: 'Módulo bifacial 132 cél. N type 615 W', potenciaW: 615, preco: 707.25, precoPorWp: 1.15, estoque: 1000, disponivelSP: true },
      { sku: 'MFJA-1.5-BF-132-615W', tipo: 'modulo', marca: 'JA Solar', descricao: 'Módulo bifacial 132 cél. N type 615 W', potenciaW: 615, preco: 707.25, precoPorWp: 1.15, estoque: 1000, disponivelSP: true },
      { sku: 'MFJA-1.5-BF-132-620W', tipo: 'modulo', marca: 'JA Solar', descricao: 'Módulo bifacial 132 cél. N type 620 W', potenciaW: 620, preco: 713.00, precoPorWp: 1.15, estoque: 1000, disponivelSP: true },
      { sku: 'MFJA-1.4-BF-132-625W', tipo: 'modulo', marca: 'JA Solar', descricao: 'Módulo bifacial 132 cél. N type 625 W', potenciaW: 625, preco: 718.75, precoPorWp: 1.15, estoque: 1000, disponivelSP: true },
    ],
  };

  // Ficha elétrica aproximada pela potência (para conferir strings até ter a ficha real)
  function fichaModulo(w) {
    const voc = w >= 600 ? 0.0795 * w : w >= 540 ? 0.089 * w : 0.105 * w;
    return { voc: +voc.toFixed(1), vmp: +(voc * 0.835).toFixed(1), isc: w >= 600 ? 15.8 : w >= 540 ? 14.1 : 11.2, coefVoc: -0.0026, areaM2: +(w / 222).toFixed(2), estimada: true };
  }

  function padrao() {
    // começa com os módulos reais da amostra + inversores/baterias de teste
    const modulos = amostraBelenergy.produtos.map((p) => ({ ...p, usar: ['MFAS-1.4-BF-132-615W', 'MFJA-1.5-BF-132-615W', 'MFAS-1.4-BF-144-575W'].includes(p.sku), nivel: { 'MFAS-1.4-BF-132-615W': 0, 'MFJA-1.5-BF-132-615W': 1 }[p.sku] ?? null, fornecedor: 'Belenergy' }));
    modulos.find((m) => m.sku === 'MFJA-1.5-BF-132-615W').nivel = 1;
    modulos.find((m) => m.sku === 'MFAS-1.4-BF-132-615W').nivel = 0;
    const premium = modulos.find((m) => m.sku === 'MFJA-1.5-BF-132-620W'); premium.usar = true; premium.nivel = 2;
    const invs = D.catalogo.inversores.map((i) => ({ sku: i.id, tipo: 'inversor', marca: 'teste', descricao: i.nome, potenciaW: i.potenciaKw * 1000, preco: i.preco, hibrido: i.hibrido, premium: i.id.startsWith('pinv'), usar: true, fornecedor: 'teste', ficha: i }));
    const bats = D.catalogo.baterias.map((b) => ({ sku: b.id, tipo: 'bateria', marca: 'teste', descricao: b.nome, kwh: b.kwh, preco: b.preco, usar: true, fornecedor: 'teste' }));
    return { atualizadoEm: amostraBelenergy.capturadoEm, origem: amostraBelenergy.origem, itens: [...modulos, ...invs, ...bats] };
  }

  const Catalogo = {
    ler() { try { const v = localStorage.getItem(CHAVE); if (v) return JSON.parse(v); } catch { /* */ } return padrao(); },
    gravar(c) { try { localStorage.setItem(CHAVE, JSON.stringify(c)); } catch { /* */ } },
    zerar() { try { localStorage.removeItem(CHAVE); } catch { /* */ } },

    /* Importa o JSON do robô (ou CSV com as mesmas colunas). Mantém as escolhas feitas. */
    importar(texto) {
      let dados;
      try { dados = JSON.parse(texto); } catch {
        const [cab, ...linhas] = texto.replace(/^﻿/, '').trim().split(/\r?\n/);
        const k = cab.split(';');
        dados = { produtos: linhas.map((l) => Object.fromEntries(l.split(';').map((v, i) => [k[i], isNaN(+v.replace(',', '.')) || v === '' ? v : +v.replace(',', '.')]))) };
      }
      const novos = (dados.produtos || []).filter((p) => p.sku && p.preco > 0 && ['modulo', 'inversor', 'bateria'].includes(p.tipo));
      if (!novos.length) throw new Error('Arquivo sem módulos, inversores ou baterias com preço.');
      const atual = this.ler(), antigos = new Map(atual.itens.map((i) => [i.sku, i]));
      const fundidos = novos.map((p) => { const a = antigos.get(p.sku); return { ...p, fornecedor: dados.fornecedor || 'Belenergy', fora: false, usar: a ? a.usar : false, nivel: a ? a.nivel : null, premium: a?.premium || false, precoAnterior: a && a.preco !== p.preco ? a.preco : null }; });
      // o que não veio no arquivo continua no catálogo, desmarcado e sinalizado (pode ter saído de linha)
      const mantidos = atual.itens.filter((i) => !novos.find((p) => p.sku === i.sku))
        .map((i) => (i.fornecedor === 'teste' ? i : { ...i, fora: true, usar: false }));
      const c = { atualizadoEm: dados.capturadoEm || new Date().toISOString(), origem: dados.origem || 'arquivo', itens: [...fundidos, ...mantidos] };
      this.gravar(c);
      return { total: novos.length, mudouPreco: fundidos.filter((x) => x.precoAnterior).length };
    },

    /* Monta o catálogo no formato do motor a partir do que está marcado */
    paraMotor() {
      const c = this.ler(), base = D.catalogo;
      const mods = c.itens.filter((i) => i.tipo === 'modulo' && i.usar && (i.disponivelSP ?? true));
      const invs = c.itens.filter((i) => i.tipo === 'inversor' && i.usar);
      const bat = c.itens.find((i) => i.tipo === 'bateria' && i.usar);
      if (!mods.length || !invs.length) return base;
      const modulos = mods.map((m) => ({ id: m.sku, nome: `${m.marca} ${m.potenciaW} W`, potenciaW: m.potenciaW, preco: m.preco, fornecedor: m.fornecedor, ...fichaModulo(m.potenciaW) }));
      const inversores = invs.map((i) => i.ficha ? { ...i.ficha, id: i.sku, preco: i.preco } : { id: i.sku, nome: i.descricao, potenciaKw: i.potenciaW / 1000, mppts: 2, stringsPorMppt: i.potenciaW >= 8000 ? 2 : 1, vMaxDc: i.potenciaW >= 8000 ? 1000 : 600, vMinMppt: 90, iMaxMppt: 20, preco: i.preco, hibrido: !!i.hibrido });
      // módulo de cada nível: o marcado; se faltar, o mais barato por Wp / o de maior potência
      const porWp = (a, b) => a.preco / a.potenciaW - b.preco / b.potenciaW;
      const escolha = (nv, regra) => (mods.find((m) => m.nivel === nv) || [...mods].sort(regra)[0]).sku;
      const eco = escolha(0, porWp), rec = escolha(1, (a, b) => b.potenciaW - a.potenciaW || porWp(a, b)), pre = escolha(2, (a, b) => b.potenciaW - a.potenciaW);
      const strings = inversores.filter((i) => !i.hibrido), premiumInv = invs.filter((i) => i.premium).map((i) => i.sku);
      const niveis = [
        { nome: 'Econômica', modulo: eco, inversores: strings.filter((i) => !premiumInv.includes(i.id)).map((i) => i.id), descricao: 'Melhor preço, equipamentos de linha.' },
        { nome: 'Recomendada', destaque: true, modulo: rec, inversores: (premiumInv.length ? premiumInv : strings.map((i) => i.id)), descricao: 'Módulo de maior potência e inversor com garantia estendida.' },
        { nome: 'Premium / Híbrida', modulo: pre, inversores: inversores.filter((i) => i.hibrido).map((i) => i.id), bateria: bat ? bat.sku : null, descricao: 'Bateria para manter o essencial ligado quando falta luz.' },
      ].filter((nv) => nv.inversores.length);
      const baterias = bat ? [{ id: bat.sku, nome: bat.descricao, kwh: bat.kwh || 5, preco: bat.preco }] : [];
      return { ...base, modulos, inversores, baterias, niveis };
    },
    fichaModulo,
  };
  raiz.Catalogo = Catalogo;
})(window);
