/* =====================================================================
   MPPT: como ligar as placas no inversor (ou no micro) sem passar dos
   limites do datasheet.
   - Cada MPPT só recebe placas da MESMA água (mesma inclinação e direção):
     placas viradas para lados diferentes na mesma entrada perdem geração.
   - Inversor de 1 MPPT = todas as placas numa água só.
   - Por MPPT: tensão no frio (Voc +12%) abaixo da máxima, tensão no calor
     (Vmp −15%) acima do mínimo do MPPT e corrente das strings em paralelo
     abaixo da máxima da entrada.
   - Micro: cada entrada é independente (pode ser em águas diferentes).
   A ficha vem do datasheet quando o modelo é conhecido; senão é típica e o
   vendedor confere e corrige (fica salva no projeto).
   ===================================================================== */
(function (raiz) {
  'use strict';
  /* fichas conferidas no datasheet do fabricante */
  const FICHAS = [
    { re: /growatt.*\bmin\b|growatt.*(2500|3000|3600|4200|4600|5000|6000)tl-x/i, tipo: 'string', mppts: 2, strPorMppt: 1, vMax: 550, vMinMppt: 80, vMaxMppt: 550, iMax: 12.5, iscMax: 16, fonte: 'datasheet Growatt MIN 2500–6000TL-X' },
    { re: /deye.*sun-?\s?(3|4|5|6|8|10|12)k-?g05/i, tipo: 'string', mppts: 2, strPorMppt: 1, vMax: 1000, vMinMppt: 200, vMaxMppt: 850, iMax: 13, iscMax: 19.5, fonte: 'datasheet Deye SUN-3~12K-G05' },
    { re: /hms-?(1600|1800|2000)-?4t/i, tipo: 'micro', entradas: 4, vMax: 65, vMinMppt: 16, vMaxMppt: 60, iMax: 16, iscMax: 25, fonte: 'datasheet Hoymiles HMS-1600/1800/2000-4T' },
  ];
  /* sem o modelo exato: valores típicos pela potência e pelo tipo (conferir no datasheet) */
  function tipica(inv) {
    const kw = inv.potenciaUnKw || (inv.potenciaKw || 0) / (inv.qtd || 1) || 5, tipo = inv.tipo === 'micro' || /micro/i.test(inv.nome || '') ? 'micro' : 'string';
    if (tipo === 'micro') { const ent = kw >= 1.5 ? 4 : kw >= 0.7 ? 2 : 1; return { tipo, entradas: ent, vMax: 60, vMinMppt: 16, vMaxMppt: 60, iMax: 16, iscMax: 20, fonte: 'valores típicos de micro de ' + ent + ' entradas' }; }
    if (kw <= 3) return { tipo, mppts: 1, strPorMppt: 1, vMax: 550, vMinMppt: 80, vMaxMppt: 550, iMax: 13, iscMax: 16, fonte: 'valores típicos (inversor pequeno de 1 MPPT)' };
    if (kw <= 6) return { tipo, mppts: 2, strPorMppt: 1, vMax: 550, vMinMppt: 80, vMaxMppt: 550, iMax: 13, iscMax: 16, fonte: 'valores típicos (2 MPPT)' };
    if (kw <= 15) return { tipo, mppts: 2, strPorMppt: kw > 8 ? 2 : 1, vMax: 1100, vMinMppt: 160, vMaxMppt: 1000, iMax: kw > 8 ? 26 : 13, iscMax: kw > 8 ? 32 : 16, fonte: 'valores típicos (2 MPPT)' };
    return { tipo, mppts: kw <= 30 ? 3 : 4, strPorMppt: 2, vMax: 1100, vMinMppt: 200, vMaxMppt: 1000, iMax: 32, iscMax: 40, fonte: 'valores típicos (inversor trifásico grande)' };
  }
  function fichaDe(inv) {
    if (!inv) return null;
    const txt = `${inv.fabricante || ''} ${inv.nome || ''} ${inv.sku || ''}`, f = FICHAS.find((x) => x.re.test(txt));
    const base = f ? { ...f, conferida: true } : { ...tipica(inv), conferida: false };
    delete base.re; base.qtd = inv.qtd || 1; return base;
  }

  /* chave da água para o MPPT: mesma inclinação e direção (±5°) */
  const grupo = (s) => `${Math.round(s.incl)}|${(Math.round(s.az / 5) * 5) % 360}`;
  const totalEntradas = (f) => (f.tipo === 'micro' ? (f.entradas || 4) * (f.qtd || 1) : (f.mppts || 1) * (f.qtd || 1));

  /* distribui as placas pelas MPPTs e confere os limites */
  function planejar(placas, ficha, mod) {
    if (!ficha) return null;
    const voc = mod.voc || 45, vmp = mod.vmp || voc * 0.83, isc = mod.isc || 14, imp = mod.imp || isc * 0.94;
    const nMax = Math.max(1, Math.floor(ficha.vMax / (voc * 1.12))), nMin = Math.max(1, Math.ceil(ficha.vMinMppt / (vmp * 0.85)));
    const grupos = {}; placas.forEach((s) => { (grupos[grupo(s)] = grupos[grupo(s)] || { k: grupo(s), nome: s.nomeAgua || '', placas: [] }).placas.push(s); });
    const gs = Object.values(grupos).sort((a, b) => b.placas.length - a.placas.length), avisos = [], total = totalEntradas(ficha);
    if (ficha.tipo === 'micro') {
      const cap = total, n = placas.length;
      if (n > cap) avisos.push(`${n} placas e ${ficha.qtd} micro(s) de ${ficha.entradas} entradas: cabem ${cap}.`);
      if (isc > ficha.iscMax) avisos.push(`Corrente da placa (${isc} A) acima da entrada do micro (${ficha.iscMax} A).`);
      if (voc > ficha.vMax) avisos.push(`Tensão da placa (${voc} V) acima da entrada do micro (${ficha.vMax} V).`);
      return { tipo: 'micro', grupos: gs.map((g) => ({ k: g.k, placas: g.placas.length })), entradas: cap, usadas: Math.min(n, cap), avisos, ok: !avisos.length, nMax, nMin };
    }
    const spm = ficha.strPorMppt || 1;
    if (gs.length > total) avisos.push(`As placas estão em ${gs.length} águas diferentes e o inversor tem ${total} MPPT${total > 1 ? 's' : ''}: cada MPPT só pode ter placas de uma água.`);
    // MPPTs para cada água: 1 para cada; as que sobram vão para as águas que mais precisam
    const nM = gs.map(() => 1); let livres = total - gs.length;
    const precisa = (g, k) => Math.ceil(g.placas.length / (k * spm)) > nMax; // string longa demais com k MPPTs
    while (livres > 0) { const i = gs.findIndex((g, j) => precisa(g, nM[j])); if (i < 0) break; nM[i]++; livres--; }
    const mppts = []; let id = 0;
    gs.slice(0, total).forEach((g, j) => {
      const k = nM[j], base = Math.floor(g.placas.length / k), extra = g.placas.length % k;
      let ini = 0;
      for (let q = 0; q < k; q++) {
        const n = base + (q < extra ? 1 : 0); if (!n) continue;
        let s = 1; while (s < spm && (n / s > nMax) && n % (s + 1) === 0) s++;
        const por = n / s, inteiro = Number.isInteger(por), comp = Math.ceil(por);
        const vFrio = Math.round(comp * voc * 1.12), vCalor = Math.round(Math.floor(por) * vmp * 0.85), corr = +(s * imp).toFixed(1), corrSc = +(s * isc).toFixed(1);
        const av = [];
        if (!inteiro) av.push(`${n} placas não dividem em ${s} strings iguais`);
        if (vFrio > ficha.vMax) av.push(`${comp} placas em série passam de ${ficha.vMax} V no frio (${vFrio} V): máximo ${nMax}`);
        if (vCalor < ficha.vMinMppt) av.push(`${Math.floor(por)} placas ficam abaixo do mínimo do MPPT (${ficha.vMinMppt} V): mínimo ${nMin}`);
        if (corr > ficha.iMax || corrSc > (ficha.iscMax || 99)) av.push(`corrente ${corr} A (curto ${corrSc} A) acima da entrada (${ficha.iMax} A / ${ficha.iscMax} A)`);
        mppts.push({ n: ++id, agua: g.k, placas: n, strings: s, porString: comp, vFrio, vCalor, corrente: corr, avisos: av, ok: !av.length, slots: g.placas.slice(ini, ini + n) });
        ini += n;
      }
    });
    gs.slice(total).forEach((g) => avisos.push(`${g.placas.length} placa(s) sem MPPT (água ${g.k.replace('|', '° · ')}°).`));
    return { tipo: 'string', mppts, total, livres: Math.max(0, total - mppts.length), grupos: gs.length, avisos, ok: !avisos.length && mppts.every((m) => m.ok), nMax, nMin };
  }

  raiz.Mppt = { FICHAS, fichaDe, tipica, grupo, totalEntradas, planejar };
})(window);
