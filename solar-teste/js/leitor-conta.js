/* =====================================================================
   Leitor de conta da CPFL (PDF com texto, modelo DANF3E / NF3E)
   Roda no navegador: pdf.js extrai o texto e as regras abaixo acham os
   campos. Sem IA e sem custo. Contas escaneadas (foto) ficam para a IA.
   Testado com conta real CPFL Paulista, residencial trifásica, out/2026.
   ===================================================================== */
(function (raiz) {
  'use strict';
  const MES = { JAN: 0, FEV: 1, MAR: 2, ABR: 3, MAI: 4, JUN: 5, JUL: 6, AGO: 7, SET: 8, OUT: 9, NOV: 10, DEZ: 11 };
  const num = (s) => Number(String(s).replace(/\./g, '').replace(',', '.'));
  const titulo = (s) => String(s || '').toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());

  function ler(texto) {
    const t = String(texto).replace(/\r/g, '').replace(/[ \t]+/g, ' ');
    const r = { ok: false, avisos: [] };

    // Histórico de consumo: "OUT 26 [barras] 1301 32" → mês, ano, kWh, dias
    const hist = [];
    const re = /\b(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ) (\d{2})\b[\sl]*?(\d{1,6}) (\d{2})(?!\d|\/|,)/g;
    let m;
    while ((m = re.exec(t))) {
      const kwh = +m[3], dias = +m[4];
      if (dias >= 25 && dias <= 35) hist.push({ mes: MES[m[1]], ano: 2000 + +m[2], kwh, dias });
    }
    // fica com o mais recente de cada mês do calendário
    const porMes = Array(12).fill(null);
    hist.sort((a, b) => b.ano - a.ano || b.mes - a.mes).forEach((h) => { if (!porMes[h.mes]) porMes[h.mes] = h; });
    r.historico = hist;
    r.consumos = porMes.map((h) => (h ? h.kwh : ''));
    r.mesesLidos = porMes.filter(Boolean).length;

    // Tarifa com tributos = TUSD + TE (coluna "tarifa com tributos")
    const tusd = t.match(/TUSD[^\n]*?kWh\s+[\d.]+,\d+\s+([\d]+,\d+)\s+([\d]+,\d+)/i);
    const te = t.match(/Consumo\s*-\s*TE[^\n]*?kWh\s+[\d.]+,\d+\s+([\d]+,\d+)\s+([\d]+,\d+)/i);
    if (tusd && te) r.tarifaKwh = Math.round((num(tusd[2]) + num(te[2])) * 1e4) / 1e4;

    const lig = t.match(/Tipo de Fornecimento:?\s*(Monof|Bif|Trif)/i);
    if (lig) r.ligacao = { monof: 'mono', bif: 'bi', trif: 'tri' }[lig[1].toLowerCase()];
    const cls = t.match(/Classifica[çc][ãa]o:\s*([^\n]+?)\s*(?:Tipo de Fornecimento|\n)/i);
    if (cls) r.classe = cls[1].trim();

    // Cliente: primeiro bloco depois do cabeçalho da CPFL
    const cab = t.search(/Inscri[çc][ãa]o no CNPJ:\s*[\d./-]+/i);
    const depois = cab >= 0 ? t.slice(cab).replace(/^[^\n]*\n/, '') : t;
    const nome = depois.match(/^\s*([A-ZÀ-Ú][A-ZÀ-Ú .'&-]{3,})\s*\n/);
    if (nome) r.nome = titulo(nome[1].trim());
    const cep = [...t.matchAll(/(\d{5}-\d{3})\s+([A-ZÀ-Ú][A-ZÀ-Ú ]+?)\s+([A-Z]{2})\b/g)].find((c) => !/CAMPINAS/.test(c[2]));
    if (cep) { r.cep = cep[1]; r.cidade = titulo(cep[2].replace('RIBEIRAO', 'RIBEIRÃO').replace('SERTAOZINHO', 'SERTÃOZINHO')); r.uf = cep[3]; }

    const uc = t.match(/\b(\d\.\d{3}\.\d{3}\.\d{3}-\d{2})\b/);
    if (uc) r.instalacao = uc[1];
    const ref = t.match(/\b(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\/(\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+R\$\s*([\d.]+,\d{2})/);
    if (ref) { r.referencia = `${ref[1]}/${ref[2]}`; r.vencimento = ref[3]; r.valorTotal = num(ref[4]); }
    else { const v = t.match(/R\$\s*([\d.]+,\d{2})/); if (v) r.valorTotal = num(v[1]); }
    const band = t.match(/Adicional de Bandeira (Amarela|Vermelha[^\n]*?|Verde)\s/i);
    if (band) r.bandeira = band[1].trim();
    if (/inje[tç]/i.test(t)) r.avisos.push('A conta tem energia injetada: o cliente já tem geração. Confira antes de dimensionar.');

    if (r.mesesLidos < 12) r.avisos.push(`Li ${r.mesesLidos} de 12 meses do histórico. Complete os que faltam.`);
    if (!r.tarifaKwh) r.avisos.push('Não achei a tarifa na conta. Usei a padrão.');
    r.ok = r.mesesLidos >= 6;
    return r;
  }

  /* ---------- Navegador: lê o arquivo com pdf.js (carregado sob demanda) ---------- */
  const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  const WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  function carregarPdfJs() {
    if (raiz.pdfjsLib) return Promise.resolve(raiz.pdfjsLib);
    return new Promise((ok, erro) => {
      const s = document.createElement('script');
      s.src = PDFJS; s.onload = () => { raiz.pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER; ok(raiz.pdfjsLib); };
      s.onerror = () => erro(new Error('Não consegui carregar o leitor de PDF. Confira a internet.'));
      document.head.appendChild(s);
    });
  }
  async function lerArquivo(arquivo) {
    const pdfjs = await carregarPdfJs();
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await arquivo.arrayBuffer()) }).promise;
    let texto = '';
    for (let i = 1; i <= doc.numPages; i++) {
      const c = await (await doc.getPage(i)).getTextContent();
      texto += c.items.map((it) => it.str + (it.hasEOL ? '\n' : ' ')).join('') + '\n';
    }
    if (texto.replace(/\s/g, '').length < 200) return { ok: false, avisos: ['Este PDF parece ser uma foto da conta (sem texto). No oficial, a IA lê; no teste, digite os meses.'] };
    return ler(texto);
  }

  const LeitorConta = { ler, lerArquivo };
  if (typeof module !== 'undefined' && module.exports) module.exports = LeitorConta;
  else raiz.LeitorConta = LeitorConta;
})(typeof window !== 'undefined' ? window : globalThis);
