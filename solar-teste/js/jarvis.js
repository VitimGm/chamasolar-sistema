/* =====================================================================
   JARVIS: comando de voz (ou digitado) para o dia corrido.
   Entende pedidos como:
   "Jarvis, crie uma proposta de geração de 500 kWh para o cliente João
    Silva, telhado cerâmico em Ribeirão Preto, as 2 opções, e me deixa um
    lembrete no topo do dia para preencher os dados depois"
   "manutenção de 16 placas para a Maria em Sertãozinho"
   "me lembra amanhã de ligar para o Carlos"
   Sempre mostra o que entendeu e só cria depois do "Confirmar".
   A voz usa o reconhecimento do próprio navegador (Chrome/Edge, pt-BR).
   ===================================================================== */
(function (raiz) {
  'use strict';
  const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const titulo = (s) => String(s || '').trim().replace(/\s+/g, ' ').replace(/(^|\s)(\S)/g, (m, a, b) => a + b.toUpperCase()).replace(/\b(Da|De|Do|Das|Dos|E)\b/g, (x) => x.toLowerCase());
  const NUM = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, doze: 12, quinze: 15, vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, cem: 100 };
  const numero = (s) => { const t = String(s).replace(/\./g, '').replace(',', '.'); const v = parseFloat(t); return isNaN(v) ? NUM[semAcento(s)] || null : v; };
  const PARADA = /,|\.|;|\s(?:telhado|telha|em|na cidade|com|crie|cria|faca|e me|me deixa|deixa|as duas|as 2|duas opcoes|2 opcoes|de geracao|geracao|lembrete|para preench)\b/;

  function cliente(t) {
    const m = t.match(/(?:para o cliente|pro cliente|para a cliente|para o|para a|pra|cliente)\s+(?!o\b|a\b)([a-zà-ú][a-zà-ú'’]+(?:\s+(?!telhado|telha|em\b|com\b|e\b|sobre\b|no\b|na\b|amanh)[a-zà-ú][a-zà-ú'’]+){0,3})/i);
    if (!m) return null; let nome = m[1]; const corte = semAcento(' ' + nome).search(PARADA); if (corte > 0) nome = nome.slice(0, corte - 1);
    return titulo(nome.replace(/\s+(de|da|do)$/i, ''));
  }
  function cidade(t, cidades) {
    const s = semAcento(t); let melhor = null;
    Object.keys(cidades || {}).forEach((c) => { const k = semAcento(c); if (s.includes(k) && (!melhor || k.length > semAcento(melhor).length)) melhor = c; });
    return melhor;
  }
  function telhado(s) { return /cerami|colonial|barro/.test(s) ? 'ceramico' : /fibro|eternit|amianto/.test(s) ? 'fibrocimento' : /metal|zinco|galvalume|sanduiche/.test(s) ? 'metalico' : /laje/.test(s) ? 'laje' : /solo|chao/.test(s) ? 'solo' : null; }
  function quando(s) {
    const d = new Date(); d.setHours(9, 0, 0, 0);
    if (/depois de amanha/.test(s)) d.setDate(d.getDate() + 2); else if (/amanha/.test(s)) d.setDate(d.getDate() + 1);
    const m = s.match(/dia\s+(\d{1,2})(?:\s*(?:\/|de)\s*(\d{1,2}))?/); if (m) { d.setDate(+m[1]); if (m[2]) d.setMonth(+m[2] - 1); if (d < new Date(Date.now() - 864e5)) d.setMonth(d.getMonth() + 1); }
    const h = s.match(/(?:as|às)\s+(\d{1,2})(?:h|:)?(\d{2})?/); if (h) d.setHours(+h[1], +(h[2] || 0));
    return d.toISOString();
  }

  /* devolve a intenção com os campos entendidos (nada é criado aqui) */
  function entender(texto, { cidades } = {}) {
    const t = String(texto || '').replace(/^\s*(ok\s+)?jarvis[,:\s]*/i, '').trim(), s = semAcento(t);
    const lembrar = /lembr/.test(s);
    if (/manuten|limpeza/.test(s)) {
      const pl = s.match(/(\d+|\w+)\s+placas?/); return { acao: 'manutencao', texto: t, nome: cliente(t), placas: pl ? numero(pl[1]) : null, cidade: cidade(t, cidades), lembrete: lembrar ? 'Completar os dados da manutenção' : null };
    }
    if (/(proposta|orcamento|cotacao)/.test(s) && /(cri|fac|mont|gera|abr|prepar)/.test(s)) {
      const g = s.match(/(\d[\d.,]*)\s*(?:mil\s*)?(kwh|kw|k\s?w|quilowatts?|quilos?)/), mil = /\d\s*mil\s*(kwh|kw|k\s?w|quilo)/.test(s);
      const kwh = g ? numero(g[1]) * (mil ? 1000 : 1) : null;
      const dois = /(2|duas|as duas)\s+op/.test(s) || /inversor e micro|micro e inversor/.test(s), so = /so (o )?micro/.test(s) ? 'micro' : /so (o )?inversor/.test(s) ? 'inversor' : null;
      return { acao: 'proposta', texto: t, nome: cliente(t), kwh, telhado: telhado(s), cidade: cidade(t, cidades), opcoes: so || (dois ? 'ambos' : 'ambos'), grupoA: /grupo a|media tensao|ponta/.test(s),
        lembrete: lembrar ? 'Completar os dados do orçamento (conta, telhado e kit)' : null };
    }
    if (lembrar || /anota|agenda/.test(s)) {
      const corpo = t.replace(/^.*?(?:me lembr[ae]\w*|lembrete|anota[r]?|agenda[r]?)\s*(?:de\s+|que\s+|para\s+|pra\s+)?/i, '').replace(/(depois de )?amanh[ãa]|hoje|dia\s+\d{1,2}(\s*(\/|de)\s*\d{1,2})?|[àa]s\s+\d{1,2}(h|:)?(\d{2})?(\s*horas?)?/gi, '').replace(/\s+/g, ' ').replace(/^\s*(de|que|para|pra)\s+/i, '').trim();
      return { acao: 'lembrete', texto: t, lembrete: corpo ? corpo[0].toUpperCase() + corpo.slice(1) : t, quando: quando(s), nome: cliente(t) };
    }
    return { acao: 'nada', texto: t };
  }

  raiz.Jarvis = { entender, semAcento };
})(typeof window !== 'undefined' ? window : globalThis);
