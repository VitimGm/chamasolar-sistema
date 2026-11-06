/* =====================================================================
   FICHAS TÉCNICAS: lê o PDF do fabricante (placa ou inversor/micro),
   tira os números que o 3D e a conferência de MPPT usam e guarda num
   cadastro por modelo (Parâmetros), para a próxima vez vir pronto.
   Os números lidos aparecem para o vendedor conferir antes de usar.
   ===================================================================== */
(function (raiz) {
  'use strict';
  const num = (t) => parseFloat(String(t).replace(',', '.'));
  const linhas = (txt) => txt.replace(/\r/g, '').split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  /* números de uma linha (ignora o que vem antes do rótulo) */
  const valores = (l) => (l.match(/-?\d+(?:[.,]\d+)?/g) || []).map(num);
  function achar(ls, re) { for (let i = 0; i < ls.length; i++) if (re.test(ls[i])) { const depois = ls[i].replace(re, '§').split('§').slice(1).join(' '); const v = valores(depois); if (v.length) return v; const v2 = valores(ls[i + 1] || ''); if (v2.length) return v2; } return null; }

  function placa(txt, potW) {
    const ls = linhas(txt);
    const pots = achar(ls, /(maximum power|max(?:imum)?\.? power|pmax|potência máxima|rated power)[^0-9]*?(\(?\s*p\s*max\s*\)?)?/i) || [];
    let idx = pots.findIndex((p) => Math.abs(p - potW) < 0.6); if (idx < 0) idx = 0;
    const col = (re) => { const v = achar(ls, re); return v ? (v.length > idx ? v[idx] : v[0]) : null; };
    const voc = col(/(open[- ]circuit voltage|tensão de circuito aberto)[^0-9]*?(\(?\s*v\s*oc\s*\)?)?(\s*\[?\(?v\)?\]?)?/i), vmp = col(/(maximum power voltage|optimum operating voltage|tensão de máxima potência)[^0-9]*?(\(?\s*v\s*mp+\s*\)?)?(\s*\[?\(?v\)?\]?)?/i);
    const isc = col(/(short[- ]circuit current|corrente de curto)[^0-9]*?(\(?\s*i\s*sc\s*\)?)?(\s*\[?\(?a\)?\]?)?/i), imp = col(/(maximum power current|optimum operating current|corrente de máxima potência)[^0-9]*?(\(?\s*i\s*mp+\s*\)?)?(\s*\[?\(?a\)?\]?)?/i);
    const dim = txt.match(/(\d{4})\s*[x×*]\s*(\d{3,4})\s*[x×*]\s*(\d{2})\s*mm/i);
    const coef = achar(ls, /(temperature coefficient of voc|coeficiente de temperatura (da )?voc)[^0-9-]*/i);
    const out = { potW, voc, vmp, isc, imp, c: dim ? +dim[1] / 1000 : null, l: dim ? +dim[2] / 1000 : null, coefVoc: coef ? coef[0] / 100 : null };
    out.lidos = Object.entries(out).filter(([k, v]) => v != null && k !== 'potW').length;
    return out;
  }

  function inversor(txt, kwUn) {
    const ls = linhas(txt);
    // várias colunas (um modelo por coluna): acha a coluna do modelo pela potência
    const cab = ls.find((l) => (l.match(/\b[A-Z]*-?\d+(?:[.,]\d+)?\s?K?(?:TL|W|KTL|K)[A-Z0-9-]*\b/gi) || []).length >= 2) || '';
    const mods = cab.match(/\b[A-Z]*-?\d+(?:[.,]\d+)?\s?K?(?:TL|W|KTL|K)[A-Z0-9-]*\b/gi) || [];
    // coluna do modelo mais perto da potência do kit (5000TL = 5 kW; 5K = 5 kW)
    let idx = 0, dm = Infinity; mods.forEach((m, i) => { let v = num((m.match(/\d+(?:[.,]\d+)?/) || [0])[0]); if (v >= 100) v /= 1000; const d = Math.abs(v - kwUn); if (d < dm) { dm = d; idx = i; } });
    const col = (re) => { const v = achar(ls, re); return v ? (v.length > idx ? v[idx] : v[0]) : null; };
    const mppts = col(/(number of (independent )?mppt|no\.? of mppt|mppt trackers?|quantidade de mppt|n[uú]mero de mppt|number of mpp trackers)[^0-9]*/i);
    const strPorMppt = col(/((max\.? )?(number|no\.?) of (pv |input )?strings? per mpp(t| tracker)?|strings? por mppt)[^0-9]*/i);
    const vMax = col(/(max(?:imum)?\.? (dc )?input voltage|max\.? pv input voltage|tensão (cc|dc)? ?máxima( de entrada)?|max\.? dc voltage)[^0-9]*/i);
    const faixa = (() => { for (const l of ls) { if (!/mppt? (operating )?voltage range|faixa de tensão (do )?mppt|mpp voltage range/i.test(l)) continue; const m = l.match(/(\d{2,4})\s*V?\s*[-–~]\s*(\d{2,4})\s*V/i); if (m) return [num(m[1]), num(m[2])]; } return null; })();
    const iMax = col(/(max(?:imum)?\.? (dc )?input current( per mppt)?|corrente (cc )?máxima de entrada)[^0-9]*/i);
    const isc = col(/(max(?:imum)?\.? short[- ]circuit current( per mppt)?|corrente de curto[- ]circuito máxima)[^0-9]*/i);
    const micro = /micro ?inver/i.test(txt), entradas = micro ? (col(/(number of (pv )?inputs|entradas|no\.? of inputs|module quantity)[^0-9]*/i) || null) : null;
    const out = micro ? { tipo: 'micro', entradas, vMax, vMinMppt: faixa ? faixa[0] : null, vMaxMppt: faixa ? faixa[1] : null, iMax, iscMax: isc }
      : { tipo: 'string', mppts, strPorMppt, vMax, vMinMppt: faixa ? faixa[0] : null, vMaxMppt: faixa ? faixa[1] : null, iMax, iscMax: isc };
    out.lidos = Object.values(out).filter((v) => v != null && v !== 'string' && v !== 'micro').length; out.coluna = mods[idx] || null;
    return out;
  }

  /* cadastro por modelo (fica em Parâmetros → vale para todos os orçamentos) */
  const chave = (nome) => String(nome || '').toUpperCase().replace(/\s+/g, ' ').trim();
  function cadastro() { const B = raiz.Banco; return (B && B.parametros && B.parametros().fichas) || { modulos: {}, inversores: {} }; }
  function guardar(tipo, nome, ficha) { const B = raiz.Banco; if (!B || !B.salvarParametros) return; const f = cadastro(); f[tipo] = { ...(f[tipo] || {}), [chave(nome)]: { ...ficha, em: new Date().toISOString() } }; B.salvarParametros({ fichas: f }); }
  function buscar(tipo, nome) { return (cadastro()[tipo] || {})[chave(nome)] || null; }

  raiz.Fichas = { placa, inversor, guardar, buscar, chave };
})(window);
