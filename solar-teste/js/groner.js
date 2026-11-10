/* =====================================================================
   PROPOSTAS DA GRONER — lê o PDF da proposta comercial gerada na Groner
   (modelo "Proposta comercial · sistema fotovoltaico" da Chama Solar)
   e tira: número, data, kWp, geração, consumo, placas, inversor,
   estrutura, valor do projeto, 12x no cartão, financiamentos e à vista.
   ===================================================================== */
(function (raiz) {
  'use strict';
  const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  const WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  function pdfjs() {
    if (raiz.pdfjsLib) return Promise.resolve(raiz.pdfjsLib);
    return new Promise((ok, erro) => {
      const s = document.createElement('script'); s.src = PDFJS;
      s.onload = () => { raiz.pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER; ok(raiz.pdfjsLib); };
      s.onerror = () => erro(new Error('Não consegui carregar o leitor de PDF. Confira a internet.'));
      document.head.appendChild(s);
    });
  }
  const num = (t) => Number(String(t || '').replace(/\./g, '').replace(',', '.'));

  async function textoDoPdf(arquivo) {
    const lib = await pdfjs();
    const doc = await lib.getDocument({ data: new Uint8Array(await arquivo.arrayBuffer()) }).promise;
    let t = '';
    for (let i = 1; i <= doc.numPages; i++) { const c = await (await doc.getPage(i)).getTextContent(); t += c.items.map((it) => it.str + (it.hasEOL ? '\n' : ' ')).join('') + '\n'; }
    return t;
  }

  /* texto → proposta (null se não for uma proposta da Groner) */
  function ler(texto) {
    const t = String(texto || '').replace(/ /g, ' ').replace(/[ \t]+/g, ' ');
    const cab = t.match(/^\s*([^\n]+?)\s*\n?\s*([\d.,]+)\s*kWp\s*\n?\s*(\d{4,7})\s*\n?\s*(\d{2}\/\d{2}\/\d{4})/);
    if (!/M[óo]dulos Fotovoltaicos/i.test(t) || !cab) return null;
    const pega = (re) => { const m = t.match(re); return m ? m[1].trim() : ''; };
    const lista = (rotulo, prox) => { const m = t.match(new RegExp(rotulo + '\\s*:?\\s*([\\s\\S]*?)' + prox, 'i')); return m ? (m[1].match(/(\d+)\s*und\.?\s*[–-]\s*([^\n]+?)(?=\s*\d+\s*und\.|\n|$)/gi) || []).map((x) => { const y = x.match(/(\d+)\s*und\.?\s*[–-]\s*(.+)/i); return { qtd: +y[1], nome: y[2].trim() }; }) : []; };
    const modulos = lista('M[óo]dulos Fotovoltaicos', 'Inversores'), inversores = lista('Inversores', '(Estrutura para|Microinversores|$)');
    const p = {
      cliente: cab[1].trim(), kwp: num(cab[2]), numero: cab[3], data: cab[4].split('/').reverse().join('-'),
      geracaoMes: num(pega(/Gera[çc][ãa]o Estimada M[êe]s\s*([\d.]+)\s*kWh/i)), consumoMes: num(pega(/Consumo M[ée]dio M[êe]s\s*([\d.]+)\s*kWh/i)),
      modulos, inversores, estrutura: pega(/Estrutura para:?\s*([^\n]+?)\s*(?:\n|[ÁA]rea Estimada)/i), area: num(pega(/[ÁA]rea Estimada:?\s*([\d.,]+)\s*m/i)), peso: num(pega(/Peso Estimado:?\s*([\d.,]+)\s*kg/i)),
      retornoMeses: +pega(/Retorno do investimento estimado em\s*(\d+)\s*meses/i) || null,
    };
    // valores (em ordem) depois das garantias: acha o par "valor do projeto / 12x" e o "à vista" logo antes do retorno
    const fim = t.search(/Retorno do investimento/i), ini = t.search(/Servi[çc]o de Instala[çc][ãa]o/i);
    const vs = (t.slice(ini > 0 ? ini : 0, fim > 0 ? fim : undefined).match(/R\$\s*[\d.]+,\d{2}/g) || []).map((x) => num(x.replace(/R\$\s*/, '')));
    for (let i = 0; i < vs.length - 1; i++) if (vs[i] > 1000 && Math.abs(vs[i] / 12 - vs[i + 1]) / vs[i + 1] < 0.02) { p.valor = vs[i]; p.parcela12 = vs[i + 1]; p.financiamento = vs.slice(i + 2, i + 8); break; }
    if (vs.length) { const ult = vs[vs.length - 1]; if (p.valor && ult < p.valor && ult > p.valor * 0.7) p.avista = ult; }
    if (vs.length >= 2) { p.contaAntes = vs[0]; p.contaDepois = vs[1]; }
    const m0 = modulos[0], i0 = inversores[0];
    p.placas = modulos.reduce((s, x) => s + x.qtd, 0);
    p.placaW = m0 ? +((m0.nome.match(/(\d{3,4})\s*W\b/i) || [])[1] || 0) : 0;
    p.inversorResumo = i0 ? `${i0.qtd > 1 ? i0.qtd + '× ' : ''}${i0.nome}` : '';
    return p;
  }

  async function lerArquivo(arquivo) { const p = ler(await textoDoPdf(arquivo)); if (!p) throw new Error(`${arquivo.name}: não parece uma proposta da Groner`); return p; }

  /* compra no formato do sistema (o que o cliente comprou) */
  function paraCompra(p, forma) {
    const valor = forma === 'avista' && p.avista ? p.avista : p.valor || 0;
    return { data: p.data + 'T15:00:00.000Z', descricao: `Proposta ${p.numero} (Groner) · ${String(p.kwp).replace('.', ',')} kWp`, kwp: p.kwp, placas: p.placas, placaW: p.placaW,
      placa: p.modulos[0] ? p.modulos[0].nome : '', inversor: p.inversorResumo, valorTotal: valor, formaPagamento: forma || '',
      obs: `Proposta ${p.numero} de ${p.data.split('-').reverse().join('/')} (Groner)${p.valor ? `: R$ ${p.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''}${p.avista ? ` · à vista R$ ${p.avista.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''}. Estrutura ${p.estrutura || '—'}.`,
      itens: [...p.modulos.map((m) => ({ nome: m.nome, qtd: m.qtd, grupo: 'Módulo' })), ...p.inversores.map((i) => ({ nome: i.nome, qtd: i.qtd, grupo: 'Inversor' })), ...(p.estrutura ? [{ nome: 'Estrutura para ' + p.estrutura, qtd: 1, grupo: 'Estrutura' }] : [])] };
  }

  raiz.Groner = { ler, lerArquivo, textoDoPdf, paraCompra };
})(window);
