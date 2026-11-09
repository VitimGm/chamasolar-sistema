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

  /* ---------- PROPOSTA EM PDF: capa e história por tipo de cliente (js/narrativa.js) ---------- */
  const CSS_PROP = `
    .folha { padding: 0 !important; overflow: hidden; } @media print { .folha { padding: 0 !important; } }
    .pg { padding: 11mm 15mm; } .quebra { break-before: page; }
    .capa { position: relative; color: #fff; min-height: 84mm; display: flex; flex-direction: column; justify-content: space-between; padding: 14mm 15mm 12mm; background: #1d283e; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .capa .fundo { position: absolute; inset: 0; background: center/cover no-repeat; }
    .capa .fundo::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, #0d132259 0%, #0d1322d9 60%, #0d1322f5 100%); }
    .capa.residencial .sol { background: radial-gradient(120% 95% at 85% 0%, #ffb347 0%, #ff6700 28%, #b8340a 55%, #1d283e 88%); }
    .capa.comercial .sol { background: radial-gradient(120% 95% at 85% 0%, #ffd27a 0%, #ff8a1f 25%, #23466e 62%, #121a2b 92%); }
    .capa.grandes .sol { background: radial-gradient(120% 95% at 85% 0%, #9fd3ff 0%, #2f74c0 30%, #18325a 62%, #0b1220 92%); }
    .capa.rural .sol { background: radial-gradient(120% 95% at 85% 0%, #ffe08a 0%, #f5a623 22%, #4f7a2a 55%, #1d2a17 92%); }
    .capa .sol::after { background: linear-gradient(180deg, #0000 35%, #0d1322b3 100%); }
    .capa > * { position: relative; } .capa .logo { height: 40px; }
    .capa .selo { display: inline-block; font: 700 8.5pt/1 "Albert Sans", system-ui, sans-serif; letter-spacing: .1em; text-transform: uppercase; border: 1px solid #ffffff66; padding: 6px 10px; border-radius: 99px; margin-bottom: 10px; }
    .capa h1 { font: 800 25pt/1.12 Exo, sans-serif; color: #fff; max-width: 150mm; margin: 0 0 8px; }
    .capa p { color: #ffffffe0; font-size: 12pt; max-width: 150mm; margin: 0; }
    .capa .id { font-size: 9pt; color: #ffffffb3; }
    .big3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: -14mm 15mm 0; position: relative; }
    .big3 div { background: #fff; border-radius: 14px; padding: 12px 14px; box-shadow: 0 8px 22px -10px #1d283e66; border: 1px solid #e3e6ec; }
    .big3 span { display: block; font-size: 9pt; color: #5b6476; font-weight: 600; } .big3 b { font: 800 19pt/1.15 Exo, sans-serif; }
    .big3 .r b { color: #c4283c; } .big3 .g b { color: #1e7a34; } .big3 .a b { color: #1f5fae; }
    .vend { display: flex; gap: 12px; align-items: center; margin-top: 12px; padding: 10px 14px; border: 1px solid #e3e6ec; border-radius: 12px; }
    .vend .ini { width: 40px; height: 40px; border-radius: 50%; background: #1d283e; color: #fff; display: grid; place-items: center; font: 800 14pt Exo, system-ui, sans-serif; flex: none; }
    h2 { font: 800 14pt Exo, sans-serif !important; color: #1d283e !important; margin: 14px 0 6px !important; break-after: avoid; display: flex; align-items: center; gap: 8px; }
    h2::before { content: ""; width: 6px; height: 18px; border-radius: 3px; background: #ff6700; }
    .grade { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
    .grade.g3 { grid-template-columns: repeat(3, 1fr); } .grade.g2 { grid-template-columns: repeat(2, 1fr); }
    .card { border: 1px solid #e3e6ec; border-radius: 12px; padding: 8px 10px; break-inside: avoid; }
    .grade { break-inside: auto; } .card .ic { font-size: 15pt !important; }
    .card .ic { font-size: 18pt; line-height: 1; } .card b { display: block; font-size: 11pt; margin-top: 4px; } .card small { color: #5b6476; font-size: 8.5pt; display: block; }
    .card .ok { color: #1e7a34; font-weight: 800; font-size: 10.5pt; } .card em { font-style: normal; color: #c44d00; font-size: 8.5pt; font-weight: 700; }
    .verde { background: #f1faf3; border-color: #cfe9d6; } .azul { background: #eef6ff; border-color: #d3e5fa; } .vermelho { background: #fdecee; border-color: #f6c9cf; }
    .faixa-dia { break-inside: avoid; display: flex; justify-content: space-between; align-items: center; gap: 12px; background: #fdecee; border-radius: 12px; padding: 10px 14px; margin-top: 10px; }
    .faixa-dia b { font: 800 18pt Exo, system-ui, sans-serif; color: #c4283c; }
    .cmp { display: grid; grid-template-columns: 52mm 1fr 26mm; gap: 8px; align-items: center; margin: 6px 0; font-size: 10pt; }
    .cmp .t { height: 12px; background: #eef1f6; border-radius: 6px; overflow: hidden; } .cmp .t i { display: block; height: 100%; border-radius: 6px; }
    .cmp b { text-align: right; font: 800 11pt Exo, system-ui, sans-serif; }
    .passos { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; counter-reset: p; }
    .passos div { border-top: 3px solid #ff6700; padding-top: 6px; font-size: 9.5pt; } .passos b { display: block; font-size: 10.5pt; }
    .passos div::before { counter-increment: p; content: counter(p); font: 800 13pt Exo, system-ui, sans-serif; color: #ff6700; }
    svg text { font-family: "Albert Sans", sans-serif; }
    .gar { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px 14px; } .gar div { display: flex; gap: 8px; align-items: flex-start; break-inside: avoid; }
    .gar .ic { font-size: 14pt; line-height: 1.2; } .gar b { display: block; font-size: 10pt; } .gar small { display: block; color: #5b6476; font-size: 8.5pt; line-height: 1.35; }
    .pg .qr { margin-top: 8px; padding: 6px 12px; } .pg .qr img { width: 80px; height: 80px; }
    .pg td, .pg th { padding: 4px 8px; font-size: 10pt; } .pg p { margin: 4px 0; }`;

  function graficoMeses(v) { // 12 barras da conta
    const W = 520, H = 58, max = Math.max(...v, 1), bw = W / 12, M = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'], iMax = v.indexOf(max);
    return `<svg viewBox="0 0 ${W} ${H + 18}" width="100%">${v.map((x, i) => { const h = Math.max((x / max) * H, 3); return `<rect x="${i * bw + 5}" y="${H - h}" width="${bw - 10}" height="${h}" rx="4" fill="${i === iMax ? '#c4283c' : '#ec9aa5'}"/><text x="${i * bw + bw / 2}" y="${H + 14}" text-anchor="middle" font-size="10" fill="#5b6476">${M[i]}</text>`; }).join('')}</svg>`;
  }
  function graficoCaixa(op) { // acumulado ano a ano: vermelho pagando, verde lucro
    const tab = [{ acumulado: -op.preco.precoFinal }, ...op.eco.tabela], W = 520, H = 85;
    const neg = Math.max(...tab.map((t) => (t.acumulado < 0 ? -t.acumulado : 0)), 1), pos = Math.max(...tab.map((t) => (t.acumulado > 0 ? t.acumulado : 0)), 1), z = H * pos / (neg + pos), bw = W / tab.length;
    return `<svg viewBox="0 0 ${W} ${H + 18}" width="100%"><line x1="0" x2="${W}" y1="${z}" y2="${z}" stroke="#c9ced9"/>${tab.map((t, i) => { const h = Math.abs(t.acumulado) / (neg + pos) * H; return `<rect x="${i * bw + 1.5}" y="${t.acumulado < 0 ? z : z - h}" width="${bw - 3}" height="${Math.max(h, 1)}" rx="2" fill="${t.acumulado < 0 ? '#c4283c' : '#1e7a34'}"/>`; }).join('')}${[0, 5, 10, 15, 20, 25].map((a) => `<text x="${Math.min(a * bw + bw / 2, W - 14)}" y="${H + 14}" text-anchor="middle" font-size="10" fill="#5b6476">${a ? 'ano ' + a : 'hoje'}</text>`).join('')}</svg>`;
  }

  function proposta(o, p, link) {
    const a = C().analisar(o, p), op = a.op, eco = op.eco, eq = C().equipamentos(op), e = empresaDe(p), Nr = raiz.Narrativa;
    const seg = Nr.segmento(o), CAPA = Nr.capa(seg, o, a), R = Nr.ref(p);
    const ga = C().ehGA && C().ehGA(o) ? eco.grupoA : null, tRede = ga ? (+o.grupoA.tarifas.teFP || 0) + (+o.grupoA.tarifas.tusdFP || 0) : p.tarifaKwh;
    const prazos = p.financiamento.prazos || [], sobra = eco.contaAtual - eco.contaDepois;
    const anos = eco.tabela.filter((t, i) => [0, 4, 9, 14, 19, 24].includes(i));
    const outras = a.opcoes.filter((x) => x !== op);
    const validade = new Date(Date.now() + (p.validadeDias || 7) * 864e5).toLocaleDateString('pt-BR');
    const f3 = o.projeto3d && o.projeto3d.fotos ? o.projeto3d.fotos : null, foto = f3 && (f3.depois || f3.d3);
    const logoB = new URL('marca/logo-branco.webp', location.href).href, vend = D.empresa.vendedor;
    const zap = String(e.whatsapp).replace(/^55(\d\d)(\d{5})(\d{4})$/, '($1) $2-$3');
    const B0 = (v) => brl(v, 0);

    // números da capa: família (conta), negócio (caixa), executivo (investimento), rural (produção)
    const big = seg === 'grandes'
      ? [['a', 'Investimento', B0(op.preco.precoFinal)], ['g', 'Rendimento (TIR)', `${n(eco.tir * 100, 1)}% a.a.`], ['', 'Retorno em', eco.paybackAnos ? n(eco.paybackAnos, 1) + ' anos' : '—']]
      : [['r', ga ? 'Conta de energia hoje' : 'Sua conta hoje', B0(eco.contaAtual) + '/mês'], ['', 'Com energia solar', B0(eco.contaDepois) + '/mês'], ['g', seg === 'residencial' ? 'De volta no seu bolso' : 'De volta para o caixa', B0(sobra) + '/mês']];

    // a economia contada para cada tipo de cliente
    let historia = '';
    if (seg === 'residencial') {
      const lista = Nr.sonhos(eco, p);
      historia = `<h2>O que a família vai fazer com essa economia?</h2>
        <p class="mini" style="margin:0 0 8px">Só com os ${B0(sobra)} por mês que deixam de ir para a CPFL:</p>
        <div class="grade">${lista.map((x) => `<div class="card verde"><div class="ic">${x.icone}</div><b>${esc(x.titulo)}</b><small>${B0(x.valor)}</small><div class="ok">pago ${x.quando}</div>${x.vezes > 1 ? `<em>${x.vezes} vezes em 25 anos</em>` : ''}</div>`).join('')}</div>
        <p class="mini" style="margin-top:8px">Se guardar a economia na poupança todo mês, em 25 anos a família tem <b>${B0(Nr.valorFuturo(eco.economiaMes1, 25, R.poupancaAnual))}</b>.</p>`;
    } else if (seg === 'comercial') {
      const ng = Nr.negocio(eco, p), inv = Nr.investimento(eco, op.preco.precoFinal, p);
      historia = `<h2>A conta de luz vira lucro</h2>
        <p class="mini" style="margin:0 0 8px">A conta de luz sai do caixa todo mês, venda bem ou mal. Com a usina, ${B0(ng.ano)} por ano voltam para o negócio. É o mesmo que:</p>
        <div class="grade">
          <div class="card verde"><div class="ic">👥</div><b>${ng.funcionarios >= 1 ? `${n(Math.floor(ng.funcionarios))} funcionário(s) pago(s) o ano todo` : `${n(ng.funcionarios * 12)} meses de um funcionário`}</b><small>a ${B0(ng.custoFuncionario)}/mês com encargos</small></div>
          <div class="card verde"><div class="ic">🛒</div><b>Vender ${B0(ng.vendasEquivalentes)} a mais</b><small>por ano, com margem de ${n(ng.margem * 100)}%</small></div>
          <div class="card azul"><div class="ic">📈</div><b>${n(inv.tir * 100, 1)}% ao ano</b><small>de retorno, contra ${n(inv.cdiLiquido * 100, 1)}% do CDI líquido</small></div>
          <div class="card"><div class="ic">💰</div><b>${B0(eco.economia25)}</b><small>de caixa em 25 anos</small></div></div>`;
    } else if (seg === 'grandes') {
      const inv = Nr.investimento(eco, op.preco.precoFinal, p), amb = Nr.ambiental(op, p), mx = Math.max(inv.tir, inv.cdiLiquido, 0.01);
      const bar = (rot, v, cor) => `<div class="cmp"><span>${rot}</span><div class="t"><i style="width:${Math.max(3, Math.min(v / mx, 1) * 100)}%;background:${cor}"></i></div><b>${n(v * 100, 1)}%</b></div>`;
      historia = `<h2>Comparado com deixar o dinheiro aplicado</h2>
        ${bar('Usina solar (TIR)', inv.tir, '#1e7a34')}${bar('CDI (líquido de IR)', inv.cdiLiquido, '#9aa4b8')}${bar('Poupança', inv.poupanca, '#c3c9d5')}
        <p class="mini">Os ${B0(op.preco.precoFinal)} no CDI renderiam cerca de ${B0(inv.rendeCdiMes)} por mês. Na usina, a economia é de ${B0(eco.economiaMes1)} por mês já no primeiro ano e cresce com cada reajuste da tarifa.</p>
        <div class="grade g3" style="margin-top:8px"><div class="card azul"><b>${n(amb.mwhAno, 1)} MWh/ano</b><small>de energia limpa</small></div><div class="card azul"><b>${n(amb.tco2_25, 1)} t de CO₂</b><small>evitadas em 25 anos</small></div><div class="card azul"><b>ESG</b><small>energia renovável para o relatório de sustentabilidade</small></div></div>`;
    } else {
      historia = `<h2>A economia em produção</h2>
        <p class="mini" style="margin:0 0 8px">Por ano, a economia na conta vale o mesmo que:</p>
        <div class="grade">${Nr.producao(eco, p).map((x) => `<div class="card verde"><div class="ic">${x.icone}</div><b>${n(x.qtd)} ${x.titulo}</b><small>a ${B0(x.preco)} a ${x.un}</small></div>`).join('')}<div class="card"><div class="ic">💰</div><b>${B0(eco.economia25)}</b><small>em 25 anos na propriedade</small></div></div>
        <p class="mini" style="margin-top:8px">Energia para irrigação, ordenha, resfriamento e secagem: o crédito de dia paga o consumo da noite.</p>`;
    }

    const exec = seg !== 'residencial' || ga ? `<h2>${seg === 'grandes' ? 'Resumo executivo' : 'Retorno do investimento'}</h2>
      <table><tr><th>Indicador</th><th class="v">Valor</th></tr>
        <tr><td>Investimento</td><td class="v">${B0(op.preco.precoFinal)}</td></tr>
        <tr><td>Potência · geração anual</td><td class="v">${n(op.dim.kwpReal, 2)} kWp · ${n(op.dim.geracaoMes * 12)} kWh</td></tr>
        <tr><td>Economia no 1º ano</td><td class="v">${B0(eco.economiaMes1 * 12)}</td></tr>
        <tr><td>Retorno (payback)</td><td class="v">${eco.paybackAnos ? n(eco.paybackAnos, 1) + ' anos' : '—'}</td></tr>
        <tr><td>TIR · VPL (taxa de ${n((p.taxaDesconto || 0) * 100, 1)}% a.a.)</td><td class="v">${n(eco.tir * 100, 1)}% a.a. · ${B0(eco.vpl)}</td></tr>
        <tr><td>Custo da energia gerada (LCOE)</td><td class="v">R$ ${n(a.energia.rsKwh, 2)}/kWh (rede${ga ? ', fora ponta' : ''}: R$ ${n(tRede, 2)})</td></tr>
        <tr><td>Economia em 25 anos</td><td class="v">${B0(eco.economia25)}</td></tr>
        ${ga || seg === 'grandes' ? `<tr><td>Geração garantida em contrato</td><td class="v">${n(op.dim.geracaoMes * 12 * 0.9)} kWh/ano (90% da simulada)</td></tr>` : ''}</table>` : '';

    const gaHtml = ga ? (() => { const l = op.limiteDemanda || {}, dem = ga.modalidade === 'azul' ? `${n(ga.demandaKw.p)} kW ponta · ${n(ga.demandaKw.fp)} kW fora ponta` : `${n(ga.demandaKw)} kW`; return `<h2>A conta de média tensão (Grupo A, tarifa ${ga.modalidade === 'azul' ? 'azul' : 'verde'})</h2>
      <table><tr><th>Parte da conta</th><th class="v">Hoje</th><th class="v">Com a usina</th></tr>
        <tr><td>Energia fora ponta (${n(ga.cFP)} kWh/mês)</td><td class="v">${B0(ga.valorFP)}</td><td class="v">${B0(ga.depoisFP)}</td></tr>
        <tr><td>Energia na ponta (${n(ga.cP)} kWh/mês)</td><td class="v">${B0(ga.valorP)}</td><td class="v">${B0(ga.depoisP)}</td></tr>
        <tr><td>Demanda contratada (${dem})</td><td class="v">${B0(ga.demandaMes)}</td><td class="v">${B0(ga.demandaMes)}</td></tr>
        <tr><td><b>Total por mês</b></td><td class="v"><b>${B0(eco.contaAtual)}</b></td><td class="v"><b>${B0(eco.contaDepois)}</b></td></tr></table>
      <p class="mini">Por mês: ${n(ga.autoconsumo)} kWh usados na hora em que a usina gera, ${n(ga.compensadoFP)} kWh compensados no fora ponta${ga.compensadoP ? ` e ${n(ga.compensadoP)} kWh de ponta pagos com o crédito que sobra (1 kWh de ponta = ${n(ga.fa, 2)} kWh de crédito)` : ''}. A demanda contratada continua. Fio B não compensado (Lei 14.300): cerca de ${B0(ga.fioBMes)} por mês em ${p.anoBase}, já descontado.${l.demandaKw && !l.ok ? ` O inversor (${n(l.potInvKw, 1)} kW) passa da demanda contratada (${n(l.demandaKw)} kW): a demanda precisa ser revista com a CPFL antes da ligação; o custo dessa revisão não está nesta simulação.` : ''}</p>`; })() : '';

    const corpo = `
      <section class="capa ${seg}"><div class="fundo${foto ? '' : ' sol'}"${foto ? ` style="background-image:url('${foto}')"` : ''}></div>
        <div style="display:flex;justify-content:space-between;align-items:flex-start"><img class="logo" src="${logoB}" alt="Chama Solar"><span class="id">Proposta ${esc(o.id)}<br>${hoje()}</span></div>
        <div style="padding-bottom:14mm"><span class="selo">${esc(CAPA.selo)}</span><h1>${esc(CAPA.titulo)}</h1><p>${esc(CAPA.sub)}</p></div>
      </section>
      <div class="big3">${big.map(([c, r, v]) => `<div class="${c}"><span>${r}</span><b>${v}</b></div>`).join('')}</div>
      <div class="pg" style="padding-top:8mm">
        <div class="vend"><div class="ini">${esc(vend[0])}</div><div><b>${esc(vend)}, seu consultor na Chama Solar</b><br><span class="mini">WhatsApp ${esc(zap)} · ${esc(e.email)} · proposta válida até ${validade}</span></div></div>
        ${historia}
        <h2>${ga ? 'O que a empresa pagou de energia no último ano' : 'O que você pagou de luz no último ano'}</h2>
        ${graficoMeses(a.raioX.mensal)}
        <p class="mini" style="margin:2px 0 0">Total de <b>${B0(a.raioX.pago12)}</b> para a CPFL em 12 meses. A barra mais escura foi a conta mais cara.</p>
        <div class="faixa-dia"><span>Cada dia sem energia solar custa</span><b>${brl(a.espera.porMes / 30)}</b><span class="mini">${B0(a.espera.porMes)} por mês</span></div>
      </div>
      <div class="pg" style="padding-top:2mm">
        ${exec}${gaHtml}
        <h2>Seu dinheiro ao longo de 25 anos</h2>
        <p class="mini" style="margin:0 0 4px">Caixa acumulado: em vermelho, o sistema ainda se pagando; em verde, lucro.</p>
        ${graficoCaixa(op)}
        <table><tr><th>Ano</th><th>Tarifa estimada${ga ? ' (fora ponta)' : ''}</th><th class="v">Economia no ano</th><th class="v">Acumulado</th></tr>
          ${anos.map((t) => `<tr><td>${t.ano}</td><td>R$ ${n(t.tarifa, 2)}/kWh</td><td class="v">${B0(t.economiaAno)}</td><td class="v">${B0(t.acumulado)}</td></tr>`).join('')}</table>
        <p class="mini">Estimativas com reajuste de ${n((p.reajusteAnual || 0) * 100, 1)}% ao ano, perda de ${n((p.degradacaoAnual || 0) * 100, 1)}% ao ano das placas e as regras do Fio B da Lei 14.300. ${ga ? 'A demanda contratada continua na conta.' : 'Ainda fica a taxa mínima da CPFL.'} A geração real depende do clima.</p>
        ${o.projeto3d && o.projeto3d.fotos && o.projeto3d.fotos.d3 ? secao3d(o.projeto3d) : ''}
      </div>
      <div class="pg" style="padding-top:2mm">
        <h2>O que vamos instalar</h2>
        <div class="grade">
          <div class="card"><div class="ic">☀️</div><b>${esc(eq.modulo)}</b><small>${n(op.dim.kwpReal, 2)} kWp · cerca de ${n(op.areaM2)} m² de telhado</small></div>
          <div class="card"><div class="ic">⚡</div><b>${esc(eq.inversor)}</b><small>${eq.tipo === 'micro' ? 'um para cada grupo de placas: sombra numa placa não derruba as outras' : 'transforma a energia das placas na energia da tomada'}</small></div>
          <div class="card verde"><div class="ic">📊</div><b>${n(op.dim.geracaoMes)} kWh por mês</b><small>${ga ? `consumo: ${n(ga.cFP)} kWh fora ponta e ${n(ga.cP)} kWh na ponta` : `seu consumo: ${n(C().consumoMedio(o))} kWh por mês`} (média do ano)</small></div>
          <div class="card"><div class="ic">🛠️</div><b>Tudo incluído</b><small>Projeto, ART, homologação na CPFL, estrutura, instalação e acompanhamento até ligar</small></div></div>
        <h2>Investimento</h2>
        <div class="preco"><div><span class="mini">${esc(PAGAMENTO[o.formaPagamento] || 'Valor do projeto')}</span><br><b>${brl(op.preco.precoFinal)}</b></div>
          <div class="mini" style="text-align:right">Retorno estimado em<br><b style="font-size:16pt;color:#1d283e">${eco.paybackAnos ? n(eco.paybackAnos, 1) + ' anos' : '—'}</b></div></div>
        ${prazos.length ? `<p class="mini" style="margin:10px 0 4px">Financiamento (simulação, sujeito à análise de crédito do banco). A parcela fica perto do que já ${seg === 'residencial' ? 'você paga' : 'se paga'} de conta:</p><table><tr>${prazos.map((pz) => { const bo = C().boleto(op, p, pz); return `<td class="v">${pz}x de <b>${brl(bo.parcela)}</b><br><span class="mini">${brl(bo.parcela / 30)} por dia</span></td>`; }).join('')}</tr></table>` : ''}
        ${outras.length ? `<p class="mini" style="margin-top:8px"><b>${outras.length > 1 ? 'Outras opções' : 'Outra opção'}:</b> ${outras.map((x) => `${esc(x.nivel)} (${esc(C().equipamentos(x).inversor)}) por ${B0(x.preco.precoFinal)}`).join(' · ')}</p>` : ''}
        <h2>${seg === 'residencial' ? 'Pode ficar tranquilo' : 'Segurança na decisão'}</h2>
        <div class="gar">${Nr.garantias(seg, p).map(([ic, t, d]) => `<div><span class="ic">${ic}</span><span><b>${esc(t)}</b><small>${esc(d)}</small></span></div>`).join('')}</div>
        <h2>Próximos passos</h2>
        <div class="passos"><div><b>Visita técnica gratuita</b>telhado e entrada de energia</div><div><b>Projeto e CPFL</b>a papelada é por nossa conta</div><div><b>Instalação</b>em poucos dias, com equipe própria</div><div><b>Usina ligada</b>e resumo da economia todo mês</div></div>
        ${link ? `<div class="qr"><div id="qr"></div><div><b>Veja esta proposta no celular</b><br><span class="mini">Aponte a câmera: dá para simular parcelas, ${seg === 'residencial' ? 'calcular o sonho da família, ouvir a explicação e mandar para quem decide junto' : 'ver o retorno e mandar para quem decide junto'}.</span></div></div>` : ''}
        <p style="margin-top:14px">Dúvidas? Fale com ${esc(vend)}: WhatsApp ${esc(zap)} · ${esc(e.email)}<br><span class="mini">${esc(e.nome)} · ${esc(e.endereco)}</span></p>
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
