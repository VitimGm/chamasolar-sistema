/* =====================================================================
   RESUMO DA CONVERSA → FUNIL
   O vendedor escreve (ou dita) como ficou com o cliente, do jeito dele:
   "liguei, ela gostou mas vai ver com o marido no fim de semana, pediu
    para simular no banco e me ligar segunda"
   e daqui saem as ações: mudar a etapa, lembretes com data e a anotação.
   Nada é feito sem o vendedor confirmar.
   ===================================================================== */
(function (raiz) {
  'use strict';
  const sa = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const DIAS = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
  function data(s, padraoDias) {
    const d = new Date(); d.setHours(9, 0, 0, 0);
    let m;
    if (/depois de amanha/.test(s)) d.setDate(d.getDate() + 2);
    else if (/amanha/.test(s)) d.setDate(d.getDate() + 1);
    else if (/hoje|agora a tarde|mais tarde/.test(s)) { const h = new Date().getHours(); if (h >= 18) d.setDate(d.getDate() + 1); else d.setHours(Math.max(h + 2, 14)); }
    else if ((m = s.match(/\b(domingo|segunda|terca|quarta|quinta|sexta|sabado)\b/))) { const alvo = DIAS.indexOf(m[1]); let n = (alvo - d.getDay() + 7) % 7; if (!n) n = 7; d.setDate(d.getDate() + n); }
    else if (/fim de semana|final de semana/.test(s)) { let n = (6 - d.getDay() + 7) % 7 || 7; d.setDate(d.getDate() + n + 2); } // retoma na segunda depois do fim de semana
    else if ((m = s.match(/(?:em|daqui a|daqui)\s+(\d+|um|uma|dois|duas|tres)\s+(dia|semana|mes|meses)/))) { const q = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3 }[m[1]] || +m[1]; d.setDate(d.getDate() + q * (/sem/.test(m[2]) ? 7 : /mes/.test(m[2]) ? 30 : 1)); }
    else if (/semana que vem|proxima semana/.test(s)) d.setDate(d.getDate() + 7);
    else if (/mes que vem|proximo mes/.test(s)) d.setDate(d.getDate() + 30);
    else if (/ano que vem/.test(s)) d.setDate(d.getDate() + 120);
    else if ((m = s.match(/dia\s+(\d{1,2})/))) { d.setDate(+m[1]); if (d < new Date()) d.setMonth(d.getMonth() + 1); }
    else d.setDate(d.getDate() + (padraoDias || 3));
    const h = s.match(/(?:as|a partir das)\s+(\d{1,2})(?:h|:)?(\d{2})?/); if (h) d.setHours(+h[1], +(h[2] || 0));
    return d.toISOString();
  }
  /* trecho da frase que fala de cada assunto (para achar a data certa de cada ação) */
  const trecho = (s, re) => { const i = s.search(re); if (i < 0) return s; const fr = s.slice(i, i + 70); return /amanha|hoje|domingo|segunda|terca|quarta|quinta|sexta|sabado|semana|mes|dia\s+\d|daqui|em\s+\d/.test(fr) ? fr : s.slice(Math.max(0, i - 40), i + 70); };

  function analisar(texto, o) {
    const s = sa(texto), nome = String((o && o.nome) || 'cliente').split(' ')[0], acoes = [];
    let etapa = null, motivo = null;
    const add = (re, texto2, dias, extra = {}) => { if (re.test(s)) acoes.push({ tipo: 'lembrete', texto: texto2, quando: data(trecho(s, re), dias), ...extra }); };
    if (/desist|nao quer mais|fechou com outr|fechou com a concorr|perdemos|nao vai fazer/.test(s)) { etapa = 'perdido'; motivo = /outr|concorr/.test(s) ? 'fechou com concorrente' : /dinheiro|caro|preco/.test(s) ? 'preço' : 'desistiu'; acoes.push({ tipo: 'lembrete', texto: `Retomar ${nome}: ${motivo} (às vezes a outra empresa não entrega)`, quando: data('', 90) }); }
    else if (/assinou|pagou|deu entrada|contrato assinado|fechado|fechamos|fechou com a gente/.test(s)) { etapa = 'ganho'; acoes.push({ tipo: 'lembrete', texto: `Agendar a instalação de ${nome} e pedir a documentação`, quando: data('amanha') }); }
    else if (/vai fechar|quer fechar|aceitou|vai fazer|topou|mandar o contrato|manda o contrato/.test(s)) { etapa = 'negociando'; acoes.push({ tipo: 'lembrete', texto: `Mandar o contrato para ${nome}`, quando: data('hoje') }); }
    if (etapa === 'perdido') return { etapa, motivo, acoes, nota: String(texto).trim() };
    add(/visita|medir|passar la|ir la|vistoria/, `Visita técnica em ${nome}`, 2, { etapa: 'negociando' });
    add(/mandar a conta|enviar a conta|foto da conta|me mandar a conta|vai mandar a conta|nao tinha a conta/, `Cobrar a conta de luz de ${nome}`, 1);
    add(/esposa|marido|socio|familia|filh|mulher|conversar em casa/, `Retomar ${nome} depois da conversa em casa`, 2, { etapa: 'negociando' });
    add(/financ|banco|simula|parcel/, `Simular o financiamento de ${nome} no banco`, 1, { etapa: 'negociando' });
    add(/concorr|outro orcamento|outra empresa|outra proposta|comparar/, `Comparar com o orçamento do concorrente de ${nome}`, 1);
    add(/bateria|hibrido|queda de energia|falta de luz/, `Oferecer bateria/híbrido para ${nome}`, 3);
    add(/sem dinheiro|nao agora|mais pra frente|depois do|ano que vem|apertado|esperar/, `Retomar ${nome} (pediu para esperar)`, 45);
    add(/me liga|ligar|retornar|falar de novo|chamar/, `Ligar para ${nome}`, 3);
    if (!etapa) etapa = acoes.find((a) => a.etapa) ? 'negociando' : null;
    if (!acoes.length) acoes.push({ tipo: 'lembrete', texto: `Falar com ${nome}`, quando: data('', 3) });
    // o mesmo lembrete não precisa aparecer duas vezes
    const vistos = new Set(); const unicas = acoes.filter((a) => { const k = a.texto; if (vistos.has(k)) return false; vistos.add(k); return true; }).slice(0, 4);
    return { etapa, motivo, acoes: unicas, nota: String(texto).trim() };
  }
  raiz.ResumoConversa = { analisar, data };
})(typeof window !== 'undefined' ? window : globalThis);
