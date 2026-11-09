/* =====================================================================
   DOCUMENTOS — proposta em PDF, contrato e procuração para a CPFL.
   Abre uma página A4 pronta para imprimir ou "Salvar como PDF".
   Os textos de contrato e procuração são MODELOS: revisar com o advogado.
   ===================================================================== */
(function (raiz) {
  'use strict';
  const C = () => raiz.Conversao, D = raiz.DadosTeste;
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const brl = (v, c = 2) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: c, maximumFractionDigits: c });
  const n = (v, c = 0) => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c });
  const hoje = () => new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  const lacuna = (v, rotulo) => (v && String(v).trim() ? esc(v) : `<span class="lac">${esc(rotulo)}</span>`);
  const PAGAMENTO = { financiamento: 'Financiamento bancário', avista: 'À vista (Pix ou transferência)', cartao: 'Cartão de crédito' };

  /* Dados da empresa: o que estiver nos Parâmetros vence o padrão público */
  function empresaDe(p) {
    const e = D.empresa, d = (p && p.empresaDoc) || {};
    return {
      razao: d.razao || '', cnpj: d.cnpj || '', endereco: d.endereco || e.endereco, cidadeForo: d.cidadeForo || 'Ribeirão Preto/SP',
      telefone: e.telefone, whatsapp: e.whatsapp, email: e.email, nome: e.nome,
      respTecnico: d.respTecnico || '', crea: d.crea || '', garantiaInstalacaoAnos: d.garantiaInstalacaoAnos || 1, prazoInstalacaoDias: d.prazoInstalacaoDias || 30,
    };
  }

  const CSS = `
    @page { size: A4; margin: 16mm 16mm 18mm; }
    * { box-sizing: border-box; }
    body { font: 11.5pt/1.5 "Albert Sans", system-ui, sans-serif; color: #1d283e; margin: 0; background: #e9ecf2; }
    .folha { background: #fff; max-width: 210mm; margin: 0 auto; padding: 16mm; }
    @media screen { .folha { margin: 12px auto; box-shadow: 0 2px 18px #0002; } }
    @media print { body { background: #fff; } .folha { padding: 0; box-shadow: none; } .naoimprime { display: none !important; } .quebra { break-before: page; } }
    h1 { font: 800 22pt/1.15 Exo, sans-serif; margin: 0 0 6px; } h2 { font: 700 14pt Exo, sans-serif; margin: 22px 0 8px; color: #ff6700; }
    .topo { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #ff6700; padding-bottom: 10px; margin-bottom: 18px; }
    .topo img { height: 44px; } .topo small { color: #5b6476; text-align: right; }
    table { width: 100%; border-collapse: collapse; margin: 6px 0; } td, th { padding: 6px 8px; border-bottom: 1px solid #e3e6ec; text-align: left; vertical-align: top; }
    th { background: #f4f6fa; font-weight: 700; } td.v { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .tres { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 12px 0; }
    .tres div { border: 1px solid #e3e6ec; border-radius: 10px; padding: 10px 12px; } .tres span { display: block; color: #5b6476; font-size: 9.5pt; } .tres b { font: 800 16pt Exo, sans-serif; }
    .preco { background: #fff4ec; border: 2px solid #ff6700; border-radius: 12px; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; gap: 12px; }
    .preco b { font: 800 22pt Exo, sans-serif; color: #ff6700; }
    .qr { display: flex; gap: 14px; align-items: center; border: 1px dashed #b7bfcc; border-radius: 12px; padding: 10px 14px; margin-top: 16px; }
    .qr canvas, .qr img { width: 96px; height: 96px; }
    .clausula { margin: 10px 0; text-align: justify; } .clausula b { color: #1d283e; }
    .ass { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; margin-top: 48px; } .ass div { border-top: 1px solid #1d283e; padding-top: 6px; font-size: 10pt; }
    .lac { background: #fff3b0; padding: 0 4px; border-radius: 3px; color: #7a5b00; }
    .aviso { background: #fff3b0; color: #5a4300; padding: 8px 12px; border-radius: 8px; font-size: 10pt; margin-bottom: 14px; }
    .barra { position: sticky; top: 0; background: #1d283e; color: #fff; padding: 10px; display: flex; gap: 10px; justify-content: center; align-items: center; font: 600 14px system-ui; z-index: 2; }
    .barra button { font: 700 15px system-ui; padding: 10px 18px; border-radius: 999px; border: 0; background: #ff6700; color: #fff; cursor: pointer; }
    .mini { color: #5b6476; font-size: 9.5pt; }`;

  function pagina(titulo, corpo, { qr, css = '', semTopo = false } = {}) {
    const logo = new URL('marca/logo-cor.webp', location.href).href;
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(titulo)}</title>
      <link href="https://fonts.googleapis.com/css2?family=Albert+Sans:wght@400;600;700;800&family=Exo:wght@700;800&display=swap" rel="stylesheet">
      <style>${CSS}${css}</style>${qr ? `<script src="${new URL('js/qrcode.js', location.href).href}"></script>` : ''}</head>
      <body><div class="barra naoimprime">Confira e toque em <button onclick="print()">Salvar em PDF / Imprimir</button></div>
      <div class="folha">${semTopo ? '' : `<div class="topo"><img src="${logo}" alt="Chama Solar"><small>${esc(titulo)}<br>${hoje()}</small></div>`}${corpo}</div>
      ${qr ? `<script>try{var q=qrcode(0,'M');q.addData(${JSON.stringify(qr)});q.make();document.getElementById('qr').innerHTML=q.createImgTag(4,0);}catch(e){}</script>` : ''}
      </body></html>`;
  }

  function abrir(html) {
    const w = window.open('', '_blank');
    if (!w) { alert('Libere as janelas (pop-up) deste site para abrir o documento.'); return; }
    w.document.open(); w.document.write(html); w.document.close();
  }

  /* ---------- PROPOSTA EM PDF: limpa para imprimir (fundo branco, pouca cor, só as mensagens principais) ---------- */
  const CSS_PROP = `
    @page { size: A4; margin: 13mm 14mm 14mm; }
    body { font-size: 10.5pt; -webkit-font-smoothing: antialiased; }
    .folha { padding: 0 !important; } @media screen { .folha { padding: 13mm 14mm !important; } }
    .cab { display: flex; justify-content: space-between; align-items: center; padding-bottom: 8px; border-bottom: 2px solid #ff6700; }
    .cab img { height: 34px; } .cab small { text-align: right; color: #5b6476; font-size: 8.5pt; line-height: 1.4; }
    .rot { font: 700 8pt "Albert Sans", system-ui, sans-serif; letter-spacing: .12em; text-transform: uppercase; color: #c44d00; margin: 16px 0 2px; }
    .nome { font: 800 22pt/1.1 Exo, system-ui, sans-serif; margin: 0; color: #1d283e; }
    .frase { font: 600 13pt/1.35 "Albert Sans", system-ui, sans-serif; color: #1d283e; margin: 6px 0 0; max-width: 165mm; }
    .frase b { color: #1e7a34; }
    .kpi { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 14px 0 4px; }
    .kpi div { border: 1px solid #d5dae3; border-radius: 10px; padding: 9px 11px; break-inside: avoid; }
    .kpi span { display: block; font-size: 8pt; color: #5b6476; text-transform: uppercase; letter-spacing: .05em; font-weight: 700; }
    .kpi b { display: block; font: 800 16pt/1.2 Exo, system-ui, sans-serif; color: #1d283e; margin-top: 2px; }
    .kpi .bom { border: 2px solid #1e7a34; } .kpi .bom b { color: #1e7a34; }
    h2 { font: 800 12.5pt Exo, system-ui, sans-serif !important; color: #1d283e !important; margin: 18px 0 8px !important; padding-bottom: 4px; border-bottom: 1px solid #e3e6ec; break-after: avoid; }
    .itens { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
    .itens.c3 { grid-template-columns: repeat(3, 1fr); }
    .itens div { break-inside: avoid; } .itens b { display: block; font: 800 13pt/1.2 Exo, system-ui, sans-serif; color: #1d283e; }
    .itens span { display: block; font-size: 9pt; color: #46526b; line-height: 1.35; } .itens .ok { color: #1e7a34; font-weight: 700; }
    .ico { width: 18px; height: 18px; color: #ff6700; display: block; margin-bottom: 4px; }
    .sis { display: grid; grid-template-columns: 1fr 1fr; gap: 0 18px; } .sis div { display: flex; justify-content: space-between; gap: 10px; padding: 5px 0; border-bottom: 1px solid #eef0f4; font-size: 9.5pt; }
    .sis span { color: #5b6476; } .sis b { text-align: right; }
    .preco2 { display: flex; justify-content: space-between; align-items: center; border: 2px solid #1d283e; border-radius: 12px; padding: 10px 16px; break-inside: avoid; }
    .preco2 b { font: 800 20pt Exo, system-ui, sans-serif; } .preco2 span { color: #5b6476; font-size: 9pt; display: block; }
    .parc { display: grid; grid-template-columns: repeat(var(--n, 3), 1fr); gap: 8px; margin-top: 8px; }
    .parc div { border: 1px solid #d5dae3; border-radius: 10px; padding: 7px 10px; text-align: center; } .parc b { display: block; font: 800 12pt Exo, system-ui, sans-serif; } .parc span { font-size: 8.5pt; color: #5b6476; }
    .marcos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 6px; } .marcos div { text-align: center; } .marcos b { display: block; font: 800 13pt Exo, system-ui, sans-serif; } .marcos span { font-size: 8.5pt; color: #5b6476; }
    .gar2 { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 18px; font-size: 9.5pt; } .gar2 div { display: flex; gap: 6px; align-items: center; } .gar2 i { font-style: normal; color: #1e7a34; font-weight: 800; }
    .passos2 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; font-size: 9pt; color: #46526b; } .passos2 b { display: block; color: #1d283e; font-size: 9.5pt; } .passos2 em { font: 800 14pt Exo, system-ui, sans-serif; color: #ff6700; font-style: normal; display: block; }
    .fim { display: flex; gap: 14px; align-items: center; margin-top: 16px; padding-top: 10px; border-top: 2px solid #ff6700; break-inside: avoid; }
    .fim #qr img { width: 78px; height: 78px; } .fim b { font-size: 11pt; } .fim span { color: #5b6476; font-size: 9pt; display: block; }
    .nota { font-size: 7.5pt; color: #6a7590; margin-top: 10px; line-height: 1.4; }
    .pg2 { break-before: page; }
    table.ga td, table.ga th { padding: 4px 8px; font-size: 9.5pt; } table.ga th.v { text-align: right; }
    svg text { font-family: "Albert Sans", system-ui, sans-serif; }`;

  function graficoMeses(v) { // 12 barras da conta, em cinza (imprime bem); a mais cara em marinho
    const W = 520, H = 64, max = Math.max(...v, 1), bw = W / 12, M = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'], iMax = v.indexOf(max);
    return `<svg viewBox="0 0 ${W} ${H + 16}" width="100%">${v.map((x, i) => { const h = Math.max((x / max) * H, 3); return `<rect x="${i * bw + 7}" y="${H - h}" width="${bw - 14}" height="${h}" rx="3" fill="${i === iMax ? '#1d283e' : '#c3c9d4'}"/><text x="${i * bw + bw / 2}" y="${H + 13}" text-anchor="middle" font-size="10" fill="#5b6476">${M[i]}</text>`; }).join('')}</svg>`;
  }
  function graficoCaixa(op) { // caixa acumulado: cinza enquanto paga o sistema, verde depois
    const tab = [{ acumulado: -op.preco.precoFinal }, ...op.eco.tabela], W = 520, H = 78;
    const neg = Math.max(...tab.map((t) => (t.acumulado < 0 ? -t.acumulado : 0)), 1), pos = Math.max(...tab.map((t) => (t.acumulado > 0 ? t.acumulado : 0)), 1), z = H * pos / (neg + pos), bw = W / tab.length;
    return `<svg viewBox="0 0 ${W} ${H + 16}" width="100%"><line x1="0" x2="${W}" y1="${z}" y2="${z}" stroke="#9aa4b8"/>${tab.map((t, i) => { const h = Math.abs(t.acumulado) / (neg + pos) * H; return `<rect x="${i * bw + 2}" y="${t.acumulado < 0 ? z : z - h}" width="${bw - 4}" height="${Math.max(h, 1)}" rx="2" fill="${t.acumulado < 0 ? '#b7bfcc' : '#1e7a34'}"/>`; }).join('')}${[0, 5, 10, 15, 20, 25].map((a) => `<text x="${Math.min(a * bw + bw / 2, W - 14)}" y="${H + 13}" text-anchor="middle" font-size="10" fill="#5b6476">${a ? 'ano ' + a : 'hoje'}</text>`).join('')}</svg>`;
  }

  function proposta(o, p, link) {
    const a = C().analisar(o, p), op = a.op, eco = op.eco, eq = C().equipamentos(op), e = empresaDe(p), Nr = raiz.Narrativa;
    const seg = Nr.segmento(o), CAPA = Nr.capa(seg, o, a), R = Nr.ref(p), I = (nm) => (raiz.Icone ? raiz.Icone(nm) : '');
    const ga = C().ehGA && C().ehGA(o) ? eco.grupoA : null;
    const prazos = p.financiamento.prazos || [], sobra = eco.contaAtual - eco.contaDepois, B0 = (v) => brl(v, 0);
    const validade = new Date(Date.now() + (p.validadeDias || 7) * 864e5).toLocaleDateString('pt-BR');
    const logo = new URL('marca/logo-cor.webp', location.href).href, vend = D.empresa.vendedor;
    const zap = String(e.whatsapp).replace(/^55(\d\d)(\d{5})(\d{4})$/, '($1) $2-$3');
    const anoAc = (k) => (eco.tabela[k - 1] || {}).acumulado;

    // a frase principal de cada tipo de cliente (curta)
    const frase = {
      residencial: `Sua conta de luz cai de ${B0(eco.contaAtual)} para <b>${B0(eco.contaDepois)}</b> por mês.`,
      comercial: `<b>${B0(eco.economiaMes1 * 12)} por ano</b> que deixam de ir para a conta de luz e voltam para o caixa.`,
      grandes: `Um investimento que rende <b>${n(eco.tir * 100, 1)}% ao ano</b> e se paga em ${eco.paybackAnos ? n(eco.paybackAnos, 1) + ' anos' : 'poucos anos'}.`,
      rural: `<b>${B0(eco.economiaMes1 * 12)} por ano</b> que ficam na produção, em vez de ir para a CPFL.`,
    }[seg];
    const kpi = seg === 'grandes'
      ? [['Investimento', B0(op.preco.precoFinal)], ['Rendimento (TIR)', n(eco.tir * 100, 1) + '% a.a.'], ['Retorno', eco.paybackAnos ? n(eco.paybackAnos, 1) + ' anos' : '—'], ['Economia em 25 anos', B0(eco.economia25), 'bom']]
      : [[ga ? 'Energia hoje' : 'Conta hoje', B0(eco.contaAtual) + '/mês'], ['Com energia solar', B0(eco.contaDepois) + '/mês'], ['Economia', B0(sobra) + '/mês', 'bom'], ['Economia em 25 anos', B0(eco.economia25)]];

    // o que a economia representa (4 itens curtos)
    let econ = '', tEcon = '';
    if (seg === 'residencial') {
      tEcon = 'O que a economia paga';
      econ = `<div class="itens">${Nr.sonhos(eco, p).slice(0, 4).map((x) => `<div><b>${esc(x.titulo)}</b><span>${B0(x.valor)}</span><span class="ok">pago ${x.quando}</span></div>`).join('')}</div>`;
    } else if (seg === 'comercial') {
      const ng = Nr.negocio(eco, p), inv = Nr.investimento(eco, op.preco.precoFinal, p);
      tEcon = 'O que a economia representa para o negócio';
      econ = `<div class="itens"><div>${I('pessoas')}<b>${ng.funcionarios >= 1 ? n(Math.floor(ng.funcionarios)) + (Math.floor(ng.funcionarios) > 1 ? ' funcionários' : ' funcionário') : n(ng.funcionarios * 12) + ' meses'}</b><span>${ng.funcionarios >= 1 ? 'pagos o ano todo' : 'de salário de um funcionário'}</span></div>
        <div>${I('grafico')}<b>${B0(ng.vendasEquivalentes)}</b><span>em vendas para lucrar o mesmo (margem de ${n(ng.margem * 100)}%)</span></div>
        <div>${I('cofre')}<b>${n(inv.tir * 100, 1)}% a.a.</b><span>de retorno, contra ${n(inv.cdiLiquido * 100, 1)}% do CDI</span></div>
        <div>${I('relogio')}<b>${eco.paybackAnos ? n(eco.paybackAnos, 1) + ' anos' : '—'}</b><span>para o sistema se pagar</span></div></div>`;
    } else if (seg === 'grandes') {
      const inv = Nr.investimento(eco, op.preco.precoFinal, p), amb = Nr.ambiental(op, p);
      tEcon = 'Indicadores do investimento';
      econ = `<div class="itens"><div>${I('grafico')}<b>${n(inv.tir * 100, 1)}% × ${n(inv.cdiLiquido * 100, 1)}%</b><span>TIR da usina × CDI líquido</span></div>
        <div>${I('cofre')}<b>${B0(eco.vpl)}</b><span>VPL a ${n((p.taxaDesconto || 0) * 100, 1)}% a.a.</span></div>
        <div>${I('conta')}<b>R$ ${n(a.energia.rsKwh, 2)}/kWh</b><span>custo da energia gerada (LCOE)</span></div>
        <div>${I('sol')}<b>${n(amb.tco2_25)} t CO₂</b><span>evitadas em 25 anos (ESG)</span></div></div>`;
    } else {
      tEcon = 'A economia em produção, por ano';
      econ = `<div class="itens">${Nr.producao(eco, p).map((x) => `<div><b>${n(x.qtd)}</b><span>${x.titulo}</span><span>a ${B0(x.preco)}</span></div>`).join('')}<div><b>${B0(eco.economia25)}</b><span>em 25 anos na propriedade</span></div></div>`;
    }

    const gaHtml = ga ? `<h2>Conta de média tensão (tarifa ${ga.modalidade === 'azul' ? 'azul' : 'verde'})</h2>
      <table class="ga"><tr><th></th><th class="v">Hoje</th><th class="v">Com a usina</th></tr>
        <tr><td>Fora ponta (${n(ga.cFP)} kWh)</td><td class="v">${B0(ga.valorFP)}</td><td class="v">${B0(ga.depoisFP)}</td></tr>
        <tr><td>Ponta (${n(ga.cP)} kWh)</td><td class="v">${B0(ga.valorP)}</td><td class="v">${B0(ga.depoisP)}</td></tr>
        <tr><td>Demanda contratada</td><td class="v">${B0(ga.demandaMes)}</td><td class="v">${B0(ga.demandaMes)}</td></tr>
        <tr><td><b>Total por mês</b></td><td class="v"><b>${B0(eco.contaAtual)}</b></td><td class="v"><b>${B0(eco.contaDepois)}</b></td></tr></table>` : '';

    const foto3d = o.projeto3d && o.projeto3d.fotos && (o.projeto3d.fotos.depois || o.projeto3d.fotos.d3);
    const corpo = `
      <div class="cab"><img src="${logo}" alt="Chama Solar"><small>Proposta ${esc(o.id)} · ${hoje()}<br>Válida até ${validade}</small></div>
      <div class="rot">${esc(CAPA.selo)}</div>
      <h1 class="nome">${esc(o.nome)}</h1>
      <p class="frase">${frase}</p>
      <div class="kpi">${kpi.map(([r, v, c]) => `<div class="${c || ''}"><span>${r}</span><b>${v}</b></div>`).join('')}</div>
      <h2>${tEcon}</h2>${econ}
      <h2>${ga ? 'Energia paga nos últimos 12 meses' : 'Sua conta nos últimos 12 meses'}: ${B0(a.raioX.pago12)}</h2>
      ${graficoMeses(a.raioX.mensal)}
      <h2>O sistema</h2>
      <div class="sis"><div><span>Placas</span><b>${esc(eq.modulo)}</b></div><div><span>${eq.tipo === 'micro' ? 'Microinversores' : 'Inversor'}</span><b>${esc(eq.inversor)}</b></div>
        <div><span>Potência</span><b>${n(op.dim.kwpReal, 2)} kWp</b></div><div><span>Geração</span><b>${n(op.dim.geracaoMes)} kWh/mês</b></div>
        <div><span>Área no telhado</span><b>${n(op.areaM2)} m²</b></div><div><span>Incluso</span><b>projeto, CPFL, instalação</b></div></div>
      ${foto3d ? `<img src="${foto3d}" alt="Projeto 3D" style="width:100%;max-height:62mm;object-fit:cover;border-radius:10px;margin-top:10px">` : ''}

      <div class="pg2">
      <h2 style="margin-top:0 !important">Investimento</h2>
      <div class="preco2"><div><span>${esc(PAGAMENTO[o.formaPagamento] || 'Valor do projeto')}</span><b>${brl(op.preco.precoFinal)}</b></div><div style="text-align:right"><span>Retorno estimado</span><b style="font-size:15pt">${eco.paybackAnos ? n(eco.paybackAnos, 1) + ' anos' : '—'}</b></div></div>
      ${prazos.length ? `<div class="parc" style="--n:${prazos.length}">${prazos.map((pz) => { const bo = C().boleto(op, p, pz); return `<div><span>${pz} parcelas de</span><b>${brl(bo.parcela, 0)}</b><span>${brl(bo.parcela / 30)} por dia</span></div>`; }).join('')}</div>` : ''}
      ${gaHtml}
      <h2>Seu dinheiro em 25 anos</h2>
      ${graficoCaixa(op)}
      <div class="marcos"><div><b>${eco.paybackAnos ? n(eco.paybackAnos, 1) + ' anos' : '—'}</b><span>o sistema se paga</span></div><div><b>${B0(anoAc(10))}</b><span>de lucro em 10 anos</span></div><div><b>${B0(anoAc(25))}</b><span>de lucro em 25 anos, já pago o sistema</span></div></div>
      <h2>Garantias</h2>
      <div class="gar2">${Nr.garantias(seg, p).map(([, t]) => `<div><i>✓</i>${esc(t)}</div>`).join('')}</div>
      <h2>Próximos passos</h2>
      <div class="passos2"><div><em>1</em><b>Visita técnica</b>gratuita</div><div><em>2</em><b>Projeto e CPFL</b>por nossa conta</div><div><em>3</em><b>Instalação</b>em poucos dias</div><div><em>4</em><b>Usina ligada</b>e gerando economia</div></div>
      <div class="fim">${link ? '<div id="qr"></div>' : ''}<div><b>${esc(vend)}, seu consultor</b><span>WhatsApp ${esc(zap)} · ${esc(e.email)}</span>${link ? '<span>Aponte a câmera para ver a proposta completa no celular.</span>' : ''}</div></div>
      <p class="nota">Estimativas com reajuste de ${n((p.reajusteAnual || 0) * 100, 1)}% ao ano na tarifa, perda de ${n((p.degradacaoAnual || 0) * 100, 1)}% ao ano das placas e Fio B da Lei 14.300. ${ga ? 'A demanda contratada continua na conta.' : 'Continua a taxa mínima da CPFL.'} A geração real depende do clima. Financiamento sujeito à análise de crédito. ${esc(e.nome)} · ${esc(e.endereco)}.</p>
      </div>`;
    abrir(pagina('Proposta ' + o.id, corpo, { qr: link, css: CSS_PROP, semTopo: true }));
  }

  /* ---------- MODELOS DA EMPRESA (guardados no banco, não no código) ---------- */
  function extenso(valor) {
    const U = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
    const DZ = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
    const CT = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
    const ate999 = (n) => { if (n === 100) return 'cem'; const c = Math.floor(n / 100), r = n % 100, d = Math.floor(r / 10), u = r % 10; const p = []; if (c) p.push(CT[c]); if (r) p.push(r < 20 ? U[r] : DZ[d] + (u ? ' e ' + U[u] : '')); return p.join(' e '); };
    const grupo = (n) => {
      const partes = [], mi = Math.floor(n / 1e6), mil = Math.floor((n % 1e6) / 1000), r = n % 1000;
      if (mi) partes.push(ate999(mi) + (mi === 1 ? ' milhão' : ' milhões'));
      if (mil) partes.push(mil === 1 ? 'mil' : ate999(mil) + ' mil');
      if (r) partes.push(ate999(r));
      if (partes.length < 2) return partes.join('');
      const ult = partes.pop(), liga = (r && (r < 100 || r % 100 === 0)) || (!r && mil && (mil < 100 || mil % 100 === 0)) ? ' e ' : ' ';
      return partes.join(' ') + liga + ult;
    };
    const v = Math.round((Number(valor) || 0) * 100), reais = Math.floor(v / 100), cent = v % 100;
    const t = [];
    if (reais) t.push(grupo(reais) + (reais === 1 ? ' real' : (reais % 1e6 === 0 ? ' de reais' : ' reais')));
    if (cent) t.push(ate999(cent) + (cent === 1 ? ' centavo' : ' centavos'));
    return (t.join(' e ') || 'zero reais').toUpperCase();
  }
  const dataExtenso = () => { const s = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); return s; };
  /* projeto 3D no PDF: vistas, tabela por telhado e de onde vem a irradiação */
  const PONTOS = ['norte', 'nordeste', 'leste', 'sudeste', 'sul', 'sudoeste', 'oeste', 'noroeste'], ponto = (a) => PONTOS[Math.round((((a % 360) + 360) % 360) / 45) % 8];
  function secao3d(p3) {
    const r = p3.resultado || {}, M = (p3.layout && p3.layout.modulo) || {}, fonte = p3.drone ? 'do drone' : p3.fonte === 'google' ? 'de satélite (Imagens © Google)' : 'aérea';
    const vistas = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:8px 0">${p3.fotos.topo ? `<img src="${p3.fotos.topo}" alt="Vista de cima" style="width:100%;border-radius:6px">` : ''}<img src="${p3.fotos.d3}" alt="Vista 3D" style="width:100%;border-radius:6px"></div>`;
    if (p3.versao !== 2) return `<h2>Projeto da sua usina</h2><p class="mini">Montado sobre a foto ${fonte} do seu telhado, com a posição das placas e a sombra calculada para o ano inteiro.</p>${vistas}${r.perdaSom != null ? `<p class="mini">Perda pela direção do telhado: ${n((r.perdaOri || 0) * 100, 1)}% · perda por sombra medida: ${n(r.perdaSom * 100, 1)}% · já consideradas na geração abaixo.</p>` : ''}`;
    const linhas = (r.porBloco || []).map((b) => `<tr><td>${esc(b.nome || 'Telhado')}</td><td>${ponto(b.az)} · ${n(Math.tan((b.incl || 0) * Math.PI / 180) * 100)}%</td><td class="v">${b.placas}</td><td class="v">${n((b.tsrf || 0) * 100)}%</td><td class="v">${n(b.geracao)} kWh</td></tr>`).join('');
    return `<h2>Projeto da sua usina</h2>
      <p class="mini">Montado sobre a foto ${fonte} do seu telhado, com a medida real das placas${M.c ? ` (${n(M.c * 1000)} × ${n(M.l * 1000)} mm)` : ''}, o espaço entre elas, o afastamento das bordas e das platibandas, e a sombra calculada hora a hora para o ano inteiro.</p>${vistas}
      <p class="mini">Na vista de cima, a cor de cada placa mostra o aproveitamento do sol no ano: verde a partir de 90%, amarelo de 80 a 90%, laranja de 70 a 80% e vermelho abaixo de 70%.</p>
      ${linhas ? `<table><tr><th>Telhado</th><th>Direção · inclinação</th><th class="v">Placas</th><th class="v">Aproveitamento</th><th class="v">Geração no ano</th></tr>${linhas}
        <tr><td><b>Total</b></td><td></td><td class="v"><b>${r.placas}</b></td><td class="v"><b>${n((r.tsrfMedio || 0) * 100)}%</b></td><td class="v"><b>${n(r.geracaoAnual)} kWh</b></td></tr></table>` : ''}
      <p class="mini">Sombra medida: ${n((r.perdaSombra || 0) * 100, 1)}% da geração do ano · irradiação: ${/PVGIS/i.test(r.fonte || '') ? 'PVGIS (Comissão Europeia), base de satélite SARAH-3, no local da usina' : 'média da cidade'} · já considerados na geração abaixo.</p>`;
  }
  /* LAUDO TÉCNICO do projeto 3D: sombra placa a placa, geração mês a mês, arranjo elétrico e premissas.
     Documento de engenharia para o cliente, o financiamento e o arquivo da obra. */
  function laudo(o, p) {
    const p3 = o.projeto3d || {}, r = p3.resultado || {}, M = (p3.layout && p3.layout.modulo) || {}, e = empresaDe(p);
    if (!r.placas) { alert('Salve o projeto 3D do orçamento antes de gerar o laudo.'); return; }
    const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'], gm = (r.geracaoMes || []).map(Number), maxM = Math.max(1, ...gm);
    const barras = gm.length ? `<svg viewBox="0 0 640 200" role="img" aria-label="Geração mês a mês" style="width:100%;height:auto">${gm.map((v, i) => { const h = (v / maxM) * 150, x = 12 + i * 52; return `<rect x="${x}" y="${170 - h}" width="38" height="${h}" rx="4" fill="#ff8a3d"/><text x="${x + 19}" y="188" font-size="12" text-anchor="middle" fill="#555">${MESES[i]}</text><text x="${x + 19}" y="${164 - h}" font-size="11" text-anchor="middle" fill="#333">${n(v)}</text>`; }).join('')}</svg>` : '';
    const fonteFoto = p3.drone ? 'foto de drone' : p3.fonte === 'google' ? 'foto de satélite (Imagens © Google)' : 'foto aérea';
    const mp = r.mppt, cab = Array.isArray(r.cabos) ? r.cabos : [];
    const mpptHtml = mp && mp.mppts && mp.mppts.length ? `<h2>Arranjo elétrico (entradas MPPT)</h2><table><tr><th>MPPT</th><th>Água</th><th class="v">Placas</th><th class="v">Strings</th><th class="v">Placas por string</th><th class="v">Tensão no frio</th></tr>${mp.mppts.map((m) => `<tr><td>${m.n}</td><td>${esc(m.agua || '')}</td><td class="v">${m.placas}</td><td class="v">${m.strings}</td><td class="v">${esc(Array.isArray(m.porString) ? m.porString.join(' + ') : m.porString || '')}</td><td class="v">${m.vFrio ? n(m.vFrio) + ' V' : '—'}</td></tr>`).join('')}</table>
      <p class="mini">Conferido com a ficha do inversor${mp.conferida ? ' (cadastrada a partir do datasheet)' : ' (valores típicos: conferir no datasheet antes do projeto executivo)'}.${(mp.avisos || []).length ? ' Avisos: ' + mp.avisos.map(esc).join('; ') + '.' : ' Sem avisos.'}</p>` : '';
    const cabHtml = cab.length ? `<h2>Cabeamento estimado</h2><table><tr><th>Opção</th><th class="v">Cabo CC vermelho</th><th class="v">Cabo CC preto</th><th class="v">Cabo CA</th></tr>${cab.map((c) => { const s = c.seguro || c.frog || {}; return `<tr><td>${esc(c.nivel || c.tipo || '')}</td><td class="v">${s.vermelho != null ? n(s.vermelho) + ' m' : '—'}</td><td class="v">${s.preto != null ? n(s.preto) + ' m' : '—'}</td><td class="v">${c.caM != null ? n(c.caM) + ' m' : '—'}</td></tr>`; }).join('')}</table>` : '';
    const corpo = `<h1>Laudo técnico de sombreamento e geração</h1>
      <p class="mini">Cliente: <b>${esc(o.nome || '')}</b> · ${esc(o.cidade || '')} · Orçamento ${esc(o.id || '')}</p>
      <h2>Resumo</h2>
      <table><tr><td>Potência instalada</td><td class="v"><b>${n(r.kwp, 2)} kWp</b></td></tr><tr><td>Placas</td><td class="v">${r.placas} × ${esc(M.nome || '')}${M.c ? ` (${n(M.c * 1000)} × ${n(M.l * 1000)} mm)` : ''}</td></tr>
        <tr><td>Geração estimada no ano</td><td class="v"><b>${n(r.geracaoAnual)} kWh</b> (média de ${n((r.geracaoAnual || 0) / 12)} kWh/mês)</td></tr>
        <tr><td>Perda por sombra no ano</td><td class="v">${n((r.perdaSombra || 0) * 100, 1)}%</td></tr><tr><td>Aproveitamento médio do sol (TSRF)</td><td class="v">${n((r.tsrfMedio || 0) * 100)}%</td></tr>
        <tr><td>Base de irradiação</td><td class="v">${/PVGIS/i.test(r.fonte || '') ? 'PVGIS (Comissão Europeia), satélite SARAH-3, no local' : 'média da cidade'}</td></tr></table>
      ${p3.fotos && p3.fotos.d3 ? secao3d(p3).replace('<h2>Projeto da sua usina</h2>', '<h2>Implantação e sombra placa a placa</h2>') : ''}
      ${barras ? `<h2>Geração mês a mês (kWh)</h2>${barras}` : ''}
      ${mpptHtml}${cabHtml}
      <h2>Metodologia</h2>
      <ul class="mini" style="line-height:1.6"><li>Geometria montada sobre ${fonteFoto}: cada telhado com altura, inclinação, caimento e platibanda; obstáculos (caixa d'água, condensadoras, árvores, prédios vizinhos) modelados em 3D.</li>
        <li>Placas com a medida real do módulo do kit, espaço de grampo entre placas, afastamento das bordas e corredor de manutenção.</li>
        <li>Sombra por traçado de raios placa a placa, hora a hora, em 7 dias que representam o ano, mais a parcela de céu visível (radiação difusa). Índices por placa: acesso ao sol, orientação (TOF) e o combinado (TSRF).</li>
        <li>Geração: irradiação do PVGIS por água (inclinação e direção reais) × aproveitamento de cada placa, com perdas do sistema de 14% (cabos, temperatura, sujeira e conversão).</li>
        <li>Valores de referência de um ano típico: a geração real varia com o clima de cada ano (normalmente ±5%).</li></ul>
      <div style="margin-top:46px;display:grid;grid-template-columns:1fr 1fr;gap:40px"><div style="border-top:1px solid #333;padding-top:6px" class="mini">${esc(e.razao || 'Chama Solar')}${e.cnpj ? ' · CNPJ ' + esc(e.cnpj) : ''}<br>Responsável pelo projeto</div><div style="border-top:1px solid #333;padding-top:6px" class="mini">Responsável técnico · CREA/CFT</div></div>`;
    abrir(pagina('Laudo técnico · ' + (o.nome || ''), corpo));
  }
  function valoresModelo(o, p) {
    const a = C().analisar(o, p), op = a.op, k = o.contrato || {};
    const end = [k.rua, k.numero ? 'nº ' + k.numero : '', k.bairro].filter(Boolean).join(', ');
    const qMod = op.dim.placas || (op.modulo && op.modulo.qtd), qInv = (op.inversor && op.inversor.qtd) || 1;
    const linhaEq = (t, itens) => `<p class="clausula"><b>${t}:</b><br>${itens.map(esc).join('<br>')}</p>`;
    const eq = linhaEq('Módulos Fotovoltaicos', [`${qMod} und. – ${op.modulo.nome}${op.modulo.potenciaW ? ' - ' + op.modulo.potenciaW + 'Wp' : ''}`])
      + linhaEq(op.inversor.tipo === 'micro' ? 'Microinversores' : 'Inversores', [`${qInv} und. – ${op.inversor.nome} - ${n(op.inversor.potenciaUnKw || op.inversor.potenciaKw, 2)} kW`])
      + (op.kitFechado && op.kitFechado.estrutura && !op.kitFechado.estrutura.semEstrutura ? linhaEq('Estrutura', [`${op.kitFechado.estrutura.tipo || ''}${op.kitFechado.estrutura.detalhe ? ' – ' + op.kitFechado.estrutura.detalhe : ''}`]) : '');
    return {
      cliente_nome: o.nome, cliente_documento: k.documento, cliente_rua: k.rua, cliente_numero: k.numero, cliente_bairro: k.bairro, cliente_cep: k.cep || o.cep,
      cliente_cidade: k.cidade || o.cidade, cliente_endereco: end, local_instalacao: end ? `${end}, ${k.cidade || o.cidade || ''}${k.cep || o.cep ? ', CEP ' + (k.cep || o.cep) : ''}` : '',
      preco: brl(op.preco.precoFinal), preco_extenso: extenso(op.preco.precoFinal), equipamentos: eq,
      modulo_modelo: op.modulo.nome, inversor_modelo: op.inversor.nome, garantia_modulo: k.garantiaModulo, garantia_eficiencia: k.garantiaEficiencia,
      degradacao: k.degradacao, garantia_inversor: k.garantiaInversor, geracao_ano: n((op.dim.geracaoMes || 0) * 12, 2),
      forma_pagamento: k.condicao || PAGAMENTO[o.formaPagamento] || '', data_extenso: dataExtenso(),
    };
  }
  const ROTULOS = { cliente_documento: 'CPF/CNPJ', cliente_rua: 'rua', cliente_numero: 'número', cliente_bairro: 'bairro', cliente_cep: 'CEP', cliente_cidade: 'cidade', cliente_endereco: 'endereço', local_instalacao: 'endereço da instalação', garantia_modulo: 'anos (ficha do módulo)', garantia_eficiencia: 'anos (ficha do módulo)', degradacao: '% (ficha do módulo)', garantia_inversor: 'anos (ficha do inversor)', forma_pagamento: 'condição de pagamento' };
  function preencher(corpo, v) {
    return corpo.replace(/\{\{\{(\w+)\}\}\}/g, (_, c) => v[c] || '').replace(/\{\{(\w+)\}\}/g, (_, c) => lacuna(v[c], ROTULOS[c] || c));
  }
  function deModelo(chave, o, p) {
    const m = raiz.Banco && raiz.Banco.modelo && raiz.Banco.modelo(chave);
    if (!m) return false;
    abrir(pagina(m.titulo + ' ' + o.id, '<div class="aviso naoimprime">Campos em amarelo estão faltando: preencha em "Dados do cliente" na ficha.</div>' + preencher(m.corpo, valoresModelo(o, p))));
    return true;
  }

  /* ---------- CONTRATO (MODELO) ---------- */
  function contrato(o, p) {
    if (deModelo('contrato', o, p)) return;
    const a = C().analisar(o, p), op = a.op, eq = C().equipamentos(op), e = empresaDe(p), k = o.contrato || {};
    const cl = (num, titulo, txt) => `<div class="clausula"><b>Cláusula ${num} · ${titulo}.</b> ${txt}</div>`;
    const corpo = `
      <div class="aviso naoimprime">MODELO de contrato gerado pelo sistema. Revise com o advogado antes do primeiro uso. Os campos em amarelo estão faltando.</div>
      <h1>Contrato de fornecimento e instalação de sistema fotovoltaico</h1>
      <p><b>CONTRATADA:</b> ${lacuna(e.razao, 'razão social')}, CNPJ ${lacuna(e.cnpj, 'CNPJ')}, com sede em ${esc(e.endereco)}, doravante "CONTRATADA".</p>
      <p><b>CONTRATANTE:</b> ${lacuna(o.nome, 'nome')}, ${lacuna(k.estadoCivil, 'estado civil')}, ${lacuna(k.profissao, 'profissão')}, CPF/CNPJ ${lacuna(k.documento, 'CPF/CNPJ')}, RG ${lacuna(k.rg, 'RG')}, residente em ${lacuna(k.endereco, 'endereço completo')}, doravante "CONTRATANTE".</p>
      ${cl(1, 'Objeto', `Fornecimento e instalação de sistema de geração de energia solar fotovoltaica de ${n(op.dim.kwpReal, 2)} kWp, composto por ${esc(eq.modulo)} e ${esc(eq.inversor)}, estrutura de fixação para ${esc(o.telhado || 'telhado')}, cabos e proteções, no endereço da unidade consumidora nº ${lacuna(k.instalacao, 'nº da instalação CPFL')} da CPFL Paulista.`)}
      ${cl(2, 'Serviços inclusos', 'Projeto elétrico, solicitação de acesso e homologação junto à distribuidora, Anotação de Responsabilidade Técnica (ART), instalação completa, comissionamento e orientação de uso do aplicativo de monitoramento.')}
      ${cl(3, 'Preço e pagamento', `O valor total é de <b>${brl(op.preco.precoFinal)}</b>, pago por ${esc(PAGAMENTO[o.formaPagamento] || 'forma a combinar')}${k.condicao ? ': ' + esc(k.condicao) : ''}. Atraso no pagamento gera multa de 2% e juros de 1% ao mês.`)}
      ${cl(4, 'Prazos', `A instalação será feita em até ${e.prazoInstalacaoDias} dias após a chegada dos equipamentos e a confirmação do pagamento ou do financiamento. A ligação do sistema depende da vistoria e da troca do medidor pela distribuidora, que tem prazos próprios definidos pela ANEEL.`)}
      ${cl(5, 'Obrigações da CONTRATANTE', 'Permitir o acesso ao local, fornecer os documentos pedidos pela distribuidora, manter o padrão de entrada de energia em condições e informar qualquer mudança no imóvel que afete o sistema.')}
      ${cl(6, 'Garantias', `Os equipamentos têm a garantia dos fabricantes, conforme a ficha técnica entregue. A CONTRATADA garante o serviço de instalação por ${e.garantiaInstalacaoAnos} ano(s), contado da ligação do sistema.`)}
      ${cl(7, 'Geração de energia', `A geração de ${n(op.dim.geracaoMes)} kWh por mês é uma estimativa média, que varia com o clima, a sombra e a limpeza das placas. Não é garantia de valor fixo de conta. Permanecem a taxa mínima e os encargos da distribuidora previstos em lei.`)}
      ${cl(8, 'Rescisão', 'A desistência após a compra dos equipamentos obriga ao pagamento dos custos já realizados, incluindo equipamentos, frete e projeto.')}
      ${cl(9, 'Dados pessoais', 'Os dados da CONTRATANTE serão usados só para a execução deste contrato, a homologação e o monitoramento do sistema, conforme a Lei Geral de Proteção de Dados.')}
      ${cl(10, 'Foro', `Fica eleito o foro de ${esc(e.cidadeForo)} para resolver questões deste contrato.`)}
      <p style="margin-top:18px">${esc(e.cidadeForo.split('/')[0])}, ${hoje()}.</p>
      <div class="ass"><div>CONTRATANTE<br>${esc(o.nome)}</div><div>CONTRATADA<br>${esc(e.razao || e.nome)}</div><div>Testemunha 1 · nome e CPF</div><div>Testemunha 2 · nome e CPF</div></div>`;
    abrir(pagina('Contrato ' + o.id, corpo));
  }

  /* ---------- PROCURAÇÃO PARA A CPFL (MODELO) ---------- */
  function procuracao(o, p) {
    if (deModelo('procuracao', o, p)) return;
    const e = empresaDe(p), k = o.contrato || {};
    const corpo = `
      <div class="aviso naoimprime">MODELO de procuração. Confira se a CPFL pede formulário próprio ou firma reconhecida. Os campos em amarelo estão faltando.</div>
      <h1>Procuração particular</h1>
      <p class="clausula"><b>OUTORGANTE:</b> ${lacuna(o.nome, 'nome')}, ${lacuna(k.estadoCivil, 'estado civil')}, ${lacuna(k.profissao, 'profissão')}, CPF/CNPJ ${lacuna(k.documento, 'CPF/CNPJ')}, RG ${lacuna(k.rg, 'RG')}, residente em ${lacuna(k.endereco, 'endereço completo')}, titular da unidade consumidora nº ${lacuna(k.instalacao, 'nº da instalação CPFL')}.</p>
      <p class="clausula"><b>OUTORGADA:</b> ${lacuna(e.razao, 'razão social')}, CNPJ ${lacuna(e.cnpj, 'CNPJ')}, com sede em ${esc(e.endereco)}${e.respTecnico ? `, por seu responsável técnico ${esc(e.respTecnico)}${e.crea ? ', CREA ' + esc(e.crea) : ''}` : ''}.</p>
      <p class="clausula"><b>PODERES:</b> representar a OUTORGANTE perante a CPFL Paulista e demais órgãos, para solicitar o acesso e a conexão de micro ou minigeração distribuída na unidade consumidora acima; apresentar projeto, formulários e documentos; acompanhar o processo; receber pareceres e notificações; agendar vistoria e troca de medidor; e assinar o que for preciso para esses fins. Esta procuração não dá poderes para contratar dívidas nem receber valores em nome da OUTORGANTE.</p>
      <p class="clausula">Validade: até a conclusão da conexão do sistema ou 12 meses, o que ocorrer primeiro.</p>
      <p style="margin-top:18px">${esc(e.cidadeForo.split('/')[0])}, ${hoje()}.</p>
      <div class="ass"><div>OUTORGANTE<br>${esc(o.nome)}</div><div></div></div>`;
    abrir(pagina('Procuração ' + o.id, corpo));
  }

  /* campos que faltam para os documentos (mostra ao vendedor) */
  function faltando(o, p) {
    const k = o.contrato || {}, e = empresaDe(p), f = [];
    (raiz.Banco && raiz.Banco.modelo && raiz.Banco.modelo('contrato') ? [['documento', 'CPF/CNPJ'], ['rua', 'rua'], ['numero', 'número'], ['bairro', 'bairro'], ['cep', 'CEP'], ['garantiaModulo', 'garantia do módulo'], ['garantiaEficiencia', 'garantia de desempenho'], ['degradacao', 'perda ao ano'], ['garantiaInversor', 'garantia do inversor']] : [['documento', 'CPF/CNPJ'], ['rg', 'RG'], ['rua', 'endereço'], ['instalacao', 'nº da instalação CPFL'], ['estadoCivil', 'estado civil'], ['profissao', 'profissão']]).forEach(([c, r]) => { if (!k[c]) f.push(r); });
    if (!(raiz.Banco && raiz.Banco.modelo && raiz.Banco.modelo('contrato')) && (!e.razao || !e.cnpj)) f.push('razão social e CNPJ da Chama Solar (em Parâmetros)');
    return f;
  }

  raiz.Documentos = { proposta, contrato, procuracao, laudo, faltando, empresaDe, pagina, abrir, extenso, preencher };
})(window);
