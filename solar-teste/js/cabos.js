/* =====================================================================
   CABOS: quanto cabo o projeto pede pelo arranjo das placas no 3D e se o
   que veio no kit da Belenergy basta.
   - Inversor (string): cabo solar vermelho (+) e preto (−) de cada string.
       "frog" (salto de rã): liga uma placa sim, outra não, e volta pelas
       puladas; as duas pontas terminam juntas e some o cabo de retorno.
       "seguro": ligação em sequência (uma ponta em cada extremo da string),
       15% de margem e 2 m a mais em cada ponta para a conexão e as curvas.
   - Microinversor: cabo tronco passando pelos micros + cabo CA até o quadro.
   O caminho do cabo é em "L" (pela estrutura e pelas paredes), não em linha reta.
   ===================================================================== */
(function (raiz) {
  'use strict';
  const r1 = (v) => Math.round(v * 10) / 10;

  /* cabo de cada polo da placa: o nome do portal costuma trazer ("CABO 1.3M") */
  function caboDaPlaca(nome) { const m = String(nome || '').match(/CABO\s*([\d.,]+)\s*M\b/i); const v = m ? parseFloat(m[1].replace(',', '.')) : 0; return v > 0.2 && v < 3 ? v : 1.2; }
  /* tensão de circuito aberto típica pela potência (sem ficha técnica) */
  const vocDe = (potW) => (potW >= 650 ? 46 : potW >= 595 ? 53 : potW >= 535 ? 50 : potW >= 440 ? 41 : 38.5);
  /* placas por string: o máximo que a tensão do inversor aguenta no frio (+12% na Voc) */
  function maxPorString(potW, inv) { const vmax = inv && inv.vMaxDc > 0 ? inv.vMaxDc : (inv && (inv.potenciaUnKw || inv.potenciaKw) > 6 ? 1000 : 600); return Math.max(2, Math.floor(vmax / (vocDe(potW) * 1.12))); }

  /* placas em zigue-zague: água por água, fileira por fileira, alternando o sentido */
  function emOrdem(placas) {
    const porB = {}, ordemB = []; placas.forEach((s) => { if (!porB[s.b]) { porB[s.b] = []; ordemB.push(s.b); } porB[s.b].push(s); });
    const out = [];
    ordemB.forEach((b) => { const filas = {}; porB[b].forEach((s) => { (filas[s.linha] = filas[s.linha] || []).push(s); });
      Object.keys(filas).map(Number).sort((x, y) => x - y).forEach((l, k) => { const f = filas[l].sort((x, y) => x.i - y.i); out.push(...(k % 2 ? f.reverse() : f)); }); });
    return out;
  }
  function dividir(lista, n) { const out = [], base = Math.floor(lista.length / n), extra = lista.length % n; let i = 0; for (let k = 0; k < n; k++) { const q = base + (k < extra ? 1 : 0); out.push(lista.slice(i, i + q)); i += q; } return out.filter((x) => x.length); }
  const rota = (s, alvo) => Math.abs(s.c[0] - alvo.x) + Math.abs(s.c[1] - alvo.z) + Math.abs((s.y ?? 3) - (alvo.h ?? 1.5)); // em L e descendo
  const dist = (a, b) => Math.hypot(a.c[0] - b.c[0], a.c[1] - b.c[1], (a.y ?? 0) - (b.y ?? 0));

  function strings(placas, { inversor, modulo, pos, nStrings = 0, modo = 'seguro', margem = 0.15 } = {}) {
    const lead = caboDaPlaca(modulo && modulo.nome), potW = (modulo && (modulo.potW || modulo.potenciaW)) || 550;
    const ordem = emOrdem(placas), maxS = maxPorString(potW, inversor);
    const n = Math.max(+nStrings || 0, Math.ceil(ordem.length / maxS), 1);
    // cada string começa pela ponta mais perto do inversor (no frog as duas pontas ficam ali)
    const grupos = dividir(ordem, n).map((g) => (pos && g.length > 1 && rota(g[g.length - 1], pos) < rota(g[0], pos) ? [...g].reverse() : g));
    const base = { lead, maxPorString: maxS, porString: grupos.map((g) => g.length), grupos };
    if (!pos) return { ...base, erro: 'Marque no desenho onde fica o inversor.' };
    const um = (g, frog) => {
      let pulos = 0;
      // folga de 10 cm por ligação entre placas (o cabo não vai esticado)
      if (frog) { for (let i = 2; i < g.length; i++) pulos += Math.max(0, dist(g[i - 2], g[i]) - 2 * lead + 0.1); if (g.length > 1) pulos += Math.max(0, dist(g[g.length - 2], g[g.length - 1]) - 2 * lead + 0.1); }
      else for (let i = 1; i < g.length; i++) pulos += Math.max(0, dist(g[i - 1], g[i]) - 2 * lead + 0.1);
      const fim = frog ? (g[1] || g[0]) : g[g.length - 1];
      const mais = rota(g[0], pos) + 1 + pulos / 2, menos = rota(fim, pos) + 1 + pulos / 2;
      return frog ? { mais: r1(mais), menos: r1(menos), extensoes: r1(pulos) } : { mais: r1(mais * (1 + margem) + 2), menos: r1(menos * (1 + margem) + 2), extensoes: r1(pulos) };
    };
    const calc = (frog) => { const ls = grupos.map((g) => ({ placas: g.length, ...um(g, frog) })); return { lista: ls, vermelho: r1(ls.reduce((t, x) => t + x.mais, 0)), preto: r1(ls.reduce((t, x) => t + x.menos, 0)) }; };
    const frog = calc(true), seguro = calc(false);
    return { ...base, modo, frog, seguro, escolhido: modo === 'frog' ? frog : seguro };
  }

  function micros(placas, { kit, pos } = {}) {
    const inv = (kit && kit.inversor) || {}, ordem = emOrdem(placas), nMicro = Math.max(1, inv.qtd || Math.ceil(ordem.length / 4)), porMicro = Math.max(1, Math.round(ordem.length / nMicro));
    const ms = []; for (let i = 0; i < ordem.length; i += porMicro) { const g = ordem.slice(i, i + porMicro); ms.push({ c: [g.reduce((t, s) => t + s.c[0], 0) / g.length, g.reduce((t, s) => t + s.c[1], 0) / g.length], y: g.reduce((t, s) => t + (s.y ?? 3), 0) / g.length }); }
    let tronco = 0; for (let i = 1; i < ms.length; i++) tronco += dist(ms[i - 1], ms[i]) + 0.3;
    const base = { micros: ms.length, porMicro, troncoM: r1(tronco * 1.1 + 1), conexoes: ms.length, pontos: ms };
    if (!pos) return { ...base, erro: 'Marque no desenho onde fica o quadro de ligação.' };
    const ponta = Math.min(rota(ms[0], pos), rota(ms[ms.length - 1], pos));
    return { ...base, caM: r1(ponta * 1.15 + 3) };
  }

  /* o que veio no kit (itens CC e CA cotados na Belenergy) */
  function doKit(kit) {
    const itens = [...(((kit || {}).itens || {}).cc || []), ...(((kit || {}).itens || {}).ca || [])];
    const metros = (it) => { const nm = String(it.nome || ''), q = +it.qtd || 0; if (/\(\s*m\s*\)|metro/i.test(nm)) return q; const m = nm.match(/\((\d+)\s*m\)/i) || nm.match(/(\d+)\s*m(?:etros)?\b/i); return q * (m ? +m[1] : 1); };
    let preto = 0, vermelho = 0, semCor = 0, tronco = 0, troncoUn = 0, ca = 0;
    itens.forEach((it) => {
      const t = `${it.nome || ''} ${it.sku || ''}`;
      if (/cabo\s*solar|CBSOL/i.test(t)) { const m = metros(it); if (/preto|\bPT\b|-PT\b/i.test(t)) preto += m; else if (/vermelho|\bVM\b|-VM\b/i.test(t)) vermelho += m; else semCor += m; }
      else if (/tronco|trunk/i.test(t)) { troncoUn += +it.qtd || 0; const mm = String(it.nome || '').match(/([\d.,]+)\s*m\b/i); if (mm) tronco += (+it.qtd || 0) * parseFloat(mm[1].replace(',', '.')); }
      else if (/cabo/i.test(t) && /\bCA\b|flex|\bPP\b/i.test(t)) ca += metros(it);
    });
    return { preto, vermelho, semCor, tronco, troncoUn, ca, temItens: itens.length > 0 };
  }

  /* compara o que precisa com o kit; devolve as faltas em metros (0 = basta) */
  function conferir(kit, calc) {
    const k = doKit(kit);
    if (!k.temItens) return { kit: k, semDados: true };
    if (calc.escolhido) {
      const sc = k.semCor / 2, temV = k.vermelho + sc, temP = k.preto + sc;
      return { kit: k, faltaVermelho: r1(Math.max(0, calc.escolhido.vermelho - temV)), faltaPreto: r1(Math.max(0, calc.escolhido.preto - temP)), sobraVermelho: r1(Math.max(0, temV - calc.escolhido.vermelho)), sobraPreto: r1(Math.max(0, temP - calc.escolhido.preto)) };
    }
    if (calc.troncoM != null) return { kit: k, faltaTronco: k.troncoUn ? Math.max(0, calc.conexoes - k.troncoUn) : null, faltaCa: calc.caM != null && k.ca ? r1(Math.max(0, calc.caM - k.ca)) : null };
    return { kit: k };
  }

  raiz.Cabos = { caboDaPlaca, maxPorString, emOrdem, strings, micros, doKit, conferir };
})(window);
