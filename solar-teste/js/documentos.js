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

  function pagina(titulo, corpo, { qr } = {}) {
    const logo = new URL('marca/logo-cor.webp', location.href).href;
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(titulo)}</title>
      <link href="https://fonts.googleapis.com/css2?family=Albert+Sans:wght@400;600;700;800&family=Exo:wght@700;800&display=swap" rel="stylesheet">
      <style>${CSS}</style>${qr ? `<script src="${new URL('js/qrcode.js', location.href).href}"></script>` : ''}</head>
      <body><div class="barra naoimprime">Confira e toque em <button onclick="print()">Salvar em PDF / Imprimir</button></div>
      <div class="folha"><div class="topo"><img src="${logo}" alt="Chama Solar"><small>${esc(titulo)}<br>${hoje()}</small></div>${corpo}</div>
      ${qr ? `<script>try{var q=qrcode(0,'M');q.addData(${JSON.stringify(qr)});q.make();document.getElementById('qr').innerHTML=q.createImgTag(4,0);}catch(e){}</script>` : ''}
      </body></html>`;
  }

  function abrir(html) {
    const w = window.open('', '_blank');
    if (!w) { alert('Libere as janelas (pop-up) deste site para abrir o documento.'); return; }
    w.document.open(); w.document.write(html); w.document.close();
  }

  /* ---------- PROPOSTA EM PDF ---------- */
  function proposta(o, p, link) {
    const a = C().analisar(o, p), op = a.op, eq = C().equipamentos(op), e = empresaDe(p);
    const prazos = p.financiamento.prazos || [];
    const parcelas = prazos.map((pz) => `<td class="v">${pz}x de <b>${brl(C().boleto(op, p, pz).parcela)}</b></td>`).join('');
    const anos = op.eco.tabela.filter((t, i) => [0, 4, 9, 14, 19, 24].includes(i));
    const outras = a.opcoes.filter((x) => x !== op);
    const validade = new Date(Date.now() + (p.validadeDias || 7) * 864e5).toLocaleDateString('pt-BR');
    const corpo = `
      <h1>Proposta de energia solar para ${esc(o.nome)}</h1>
      <p class="mini">${esc(o.id)} · ${esc(o.cidade || '')} · válida até ${validade} (o preço do kit muda com o fornecedor)</p>
      <div class="tres"><div><span>Sua conta hoje</span><b>${brl(op.eco.contaAtual, 0)}</b></div><div><span>Com energia solar</span><b>${brl(op.eco.contaDepois, 0)}</b></div><div><span>Economia por mês</span><b>${brl(op.eco.economiaMes1, 0)}</b></div></div>
      ${(o.segmento === 'grandes' || o.segmento === 'comercial' || o.segmento === 'rural') ? `<h2>${o.segmento === 'grandes' ? 'Resumo executivo' : 'Retorno do investimento'}</h2>
      <table><tr><th>Indicador</th><th class="v">Valor</th></tr>
        <tr><td>Investimento</td><td class="v">${brl(op.preco.precoFinal, 0)}</td></tr>
        <tr><td>Geração anual estimada</td><td class="v">${n(op.dim.geracaoMes * 12)} kWh</td></tr>
        <tr><td>Economia no 1º ano</td><td class="v">${brl(op.eco.economiaMes1 * 12, 0)}</td></tr>
        <tr><td>Retorno (payback)</td><td class="v">${op.eco.paybackAnos ? n(op.eco.paybackAnos, 1) + ' anos' : '—'}</td></tr>
        <tr><td>TIR</td><td class="v">${n(op.eco.tir * 100, 1)}% ao ano</td></tr>
        <tr><td>VPL (taxa de ${n((p.taxaDesconto || 0) * 100, 1)}% a.a.)</td><td class="v">${brl(op.eco.vpl, 0)}</td></tr>
        <tr><td>Custo da energia gerada (LCOE)</td><td class="v">R$ ${n(C().analisar(o, p).energia.rsKwh, 2)}/kWh (rede: R$ ${n(p.tarifaKwh, 2)})</td></tr>
        <tr><td>Economia em 25 anos</td><td class="v">${brl(op.eco.economia25, 0)}</td></tr>
        ${o.segmento === 'grandes' ? `<tr><td>Geração garantida em contrato</td><td class="v">${n(op.dim.geracaoMes * 12 * 0.9)} kWh/ano (90% da simulada, média de 12 meses)</td></tr>` : ''}</table>` : ''}
      ${o.projeto3d && o.projeto3d.fotos && o.projeto3d.fotos.d3 ? secao3d(o.projeto3d) : ''}
      <h2>O sistema</h2>
      <table><tr><th>Item</th><th>Detalhe</th></tr>
        <tr><td>Placas solares</td><td>${esc(eq.modulo)}</td></tr><tr><td>${eq.tipo === 'micro' ? 'Microinversores' : 'Inversor'}</td><td>${esc(eq.inversor)}</td></tr>
        <tr><td>Potência</td><td>${n(op.dim.kwpReal, 2)} kWp</td></tr><tr><td>Geração estimada</td><td>${n(op.dim.geracaoMes)} kWh por mês (média do ano)</td></tr>
        <tr><td>Seu consumo</td><td>${n(C().consumoMedio(o))} kWh por mês</td></tr><tr><td>Área no telhado</td><td>cerca de ${n(op.areaM2)} m²</td></tr>
        <tr><td>Incluso</td><td>Projeto, homologação na CPFL, ART, estrutura, instalação completa e acompanhamento até ligar</td></tr></table>
      <h2>Investimento</h2>
      <div class="preco"><div><span class="mini">${esc(PAGAMENTO[o.formaPagamento] || 'Valor do projeto')}</span><br><b>${brl(op.preco.precoFinal)}</b></div>
        <div class="mini" style="text-align:right">Retorno estimado em<br><b style="font-size:16pt;color:#1d283e">${op.eco.paybackAnos ? n(op.eco.paybackAnos, 1) + ' anos' : '—'}</b></div></div>
      ${prazos.length ? `<p class="mini" style="margin:10px 0 4px">Financiamento (simulação, sujeito à análise de crédito do banco):</p><table><tr>${parcelas}</tr></table>` : ''}
      <h2>Economia ao longo do tempo</h2>
      <table><tr><th>Ano</th><th>Tarifa estimada</th><th class="v">Economia no ano</th><th class="v">Acumulado</th></tr>
        ${anos.map((t) => `<tr><td>${t.ano}</td><td>R$ ${n(t.tarifa, 2)}/kWh</td><td class="v">${brl(t.economiaAno, 0)}</td><td class="v">${brl(t.acumulado, 0)}</td></tr>`).join('')}</table>
      <p class="mini">Estimativas com reajuste de ${n((p.reajusteAnual || 0) * 100, 1)}% ao ano, perda de ${n((p.degradacaoAnual || 0) * 100, 1)}% ao ano das placas e as regras do Fio B da Lei 14.300. Ainda fica a taxa mínima da CPFL. A geração real depende do clima.</p>
      ${outras.length ? `<h2>${outras.length > 1 ? 'Outras opções' : 'Outra opção'}</h2><table>${outras.map((x) => `<tr><td><b>${esc(x.nivel)}</b>: ${esc(C().equipamentos(x).modulo)} + ${esc(C().equipamentos(x).inversor)}</td><td class="v">${brl(x.preco.precoFinal)}</td></tr>`).join('')}</table>` : ''}
      ${link ? `<div class="qr"><div id="qr"></div><div><b>Veja esta proposta no celular</b><br><span class="mini">Aponte a câmera para o código: dá para simular parcelas, ouvir a explicação e mandar para a família.</span></div></div>` : ''}
      <p style="margin-top:18px">Dúvidas? Fale com ${esc(D.empresa.vendedor)}: WhatsApp ${esc(String(e.whatsapp).replace(/^55(\d\d)(\d{5})(\d{4})$/, '($1) $2-$3'))} · ${esc(e.email)}<br><span class="mini">${esc(e.nome)} · ${esc(e.endereco)}</span></p>`;
    abrir(pagina('Proposta ' + o.id, corpo, { qr: link }));
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

  raiz.Documentos = { proposta, contrato, procuracao, faltando, empresaDe, pagina, abrir, extenso, preencher };
})(window);
