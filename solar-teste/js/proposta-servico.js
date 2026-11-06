/* =====================================================================
   PROPOSTA DE SERVIÇO / MANUTENÇÃO (link para o cliente)
   O cliente vê o que será feito, o valor, escolhe a forma de pagamento
   (e o plano, na manutenção) e aceita. Cada ação vira evento na ficha.
   ===================================================================== */
(function () {
  'use strict';
  const B = window.Banco, D = window.DadosTeste, AV = window.Avulso;
  const $ = (s, r = document) => r.querySelector(s);
  const brl = (v, c = 2) => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: c, maximumFractionDigits: c });
  const nf = (v, c = 0) => (v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c });
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  if (B.semear) B.semear();
  const qs = new URLSearchParams(location.search), vendedor = qs.get('v') === '1';
  const o = B.porToken(qs.get('t') || '');
  const raiz = $('#ps');
  if (!o) { raiz.innerHTML = '<div class="ps"><div class="bloco vis" style="margin-top:20vh;text-align:center"><h2 style="justify-content:center">Proposta não encontrada</h2><p class="apoio">Confira o link ou fale com a Chama Solar.</p></div></div>'; return; }
  const P = B.parametros(), E = D.empresa, M = o.tipo === 'manutencao';
  const c = o.calc || AV.calcular(o, P);
  const est = { pag: 'pix', plano: !!c.plano, aceito: o.status === 'ganho' || !!((B.eventos && B.eventos(o.token)) || []).find((e) => e.tipo === 'aceite') };
  const registrar = (tipo, dados) => { if (!vendedor) try { B.evento(o.token, tipo, dados); } catch { /* sem conexão */ } };
  const ICON = { equipamento: ['⚡', '#4cc3ff33'], material: ['🔌', '#ffb23d33'], mao: ['🛠️', '#3ddc9733'], extra: ['🔧', '#ff6a0026'], outro: ['🚐', '#ffffff1a'] };
  const COR = { equipamento: '#4cc3ff', material: '#ffb23d', mao: '#3ddc97', outro: '#8792ad' };
  const primeiro = String(o.nome || '').trim().split(' ')[0];
  const validade = (() => { const ini = new Date(o.enviadoEm || o.criadoEm || Date.now()), fim = new Date(ini.getTime() + (+o.validadeDias || 10) * 864e5), dias = Math.ceil((fim - Date.now()) / 864e5); return { fim, dias }; })();
  const valorAtual = () => { const base = M && est.plano && c.plano ? c.plano.porVisita : c.total; const taxa = ((P.taxaPagamento || {}).cartao ?? 0.09); return est.pag === 'cartao' ? { total: base / (1 - taxa), parcela: base / (1 - taxa) / c.pagamento.parcelas } : { total: base }; };
  const zap = (txt) => `https://wa.me/${E.whatsapp}?text=${encodeURIComponent(txt)}`;

  function blocoItens() {
    const porCat = {}; c.linhas.forEach((l) => { porCat[l.cat] = (porCat[l.cat] || 0) + l.total; });
    const nomes = { equipamento: 'Equipamentos', material: 'Materiais', mao: 'Mão de obra', outro: 'Deslocamento e outros' };
    return `<section class="bloco" data-secao="itens"><h2><i>🧾</i>O que está na proposta</h2><p class="apoio">${M ? 'Valor por placa, deslocamento e o que foi observado no seu sistema.' : 'Tudo o que vai ser fornecido e instalado.'}</p>
      ${!M && Object.keys(porCat).length > 1 ? `<div class="barra-c">${Object.entries(porCat).map(([k, v]) => `<i data-w="${(v / c.total) * 100}" style="background:${COR[k]}"></i>`).join('')}</div>
        <div class="leg" style="margin-bottom:12px">${Object.entries(porCat).map(([k, v]) => `<span style="--c:${COR[k]}">${nomes[k]} ${nf((v / c.total) * 100)}%</span>`).join('')}</div>` : ''}
      <div class="itens">${c.linhas.map((l) => `<div class="it"><span class="ic" style="background:${(ICON[l.cat] || ICON.outro)[1]}">${(ICON[l.cat] || ICON.outro)[0]}</span><div><b>${esc(l.desc)}</b>${l.qtd > 1 ? `<small>${nf(l.qtd)} ${esc(l.un === 'placa' ? 'placas' : l.un || '')} × ${brl(l.precoUn)}</small>` : ''}</div><span class="v">${brl(l.total)}</span></div>`).join('')}</div>
      <div class="total-l"><span>Total</span><span>${brl(c.total)}</span></div></section>`;
  }
  function blocoManut() {
    const kwp = +o.kwp || Math.round((c.placas || 0) * 0.55 * 10) / 10, cid = (D.cidades || {})[o.cidade], hsp = cid ? cid.hsp : 5.3, tarifa = P.tarifaKwh || 0.98;
    return `<section class="bloco" data-secao="sujeira"><h2><i>☀️</i>Placa limpa gera mais</h2><p class="apoio">Poeira, folhas e fezes de pássaro fazem sombra nas células e a placa gera menos. A limpeza devolve o rendimento.</p>
        <div class="placa-anim" aria-hidden="true"><div class="poeira"></div><div class="brilho"></div></div>
        <div class="sim"><label><span class="linha"><span>Quanto a sujeira pode estar tirando</span><b class="num" id="simPct">8%</b></span><input type="range" id="simR" min="2" max="20" value="8" aria-label="perda por sujeira"></label>
          <div class="out"><div><small>kWh perdidos por mês</small><b id="simKwh">–</b></div><div><small>dinheiro por mês</small><b id="simRs">–</b></div><div><small>a limpeza se paga em</small><b id="simMes">–</b></div></div>
          <p class="apoio" style="margin:0;font-size:.8rem">Simulação para um sistema de ${nf(kwp, 1)} kWp em ${esc(o.cidade || 'Ribeirão Preto')}, com a tarifa de R$ ${nf(tarifa, 2)}/kWh. A perda real depende da poeira e das chuvas: mexa no controle.</p></div>
        <script type="application/json" id="simD">${JSON.stringify({ kwp, hsp, tarifa })}</script></section>
      ${(o.checklist || []).length ? `<section class="bloco" data-secao="checklist"><h2><i>🧽</i>O que a manutenção inclui</h2><ul class="checks">${o.checklist.map((t, i) => `<li style="transition-delay:${i * 0.12}s">${esc(t)}</li>`).join('')}</ul></section>` : ''}
      ${c.plano ? `<section class="bloco" data-secao="plano"><h2><i>📅</i>Uma vez ou com plano?</h2><p class="apoio">Com o plano, a Chama Solar volta sozinha a cada ${c.plano.meses} meses e você paga menos por visita.</p>
        <div class="opcoes"><button class="op" data-plano="0" aria-pressed="${!est.plano}"><small>só esta vez</small><b>${brl(c.total)}</b><small>1 visita</small></button>
          <button class="op" data-plano="1" aria-pressed="${est.plano}"><span class="tag">economize ${nf(c.plano.desconto * 100)}%</span><small style="margin-top:6px">plano a cada ${c.plano.meses} meses</small><b>${brl(c.plano.porVisita)}</b><small>por visita · ${c.plano.visitasAno}× por ano = ${brl(c.plano.porAno)}</small></button></div></section>` : ''}`;
  }
  function blocoServ() {
    return `${(o.inclui || []).length ? `<section class="bloco" data-secao="inclui"><h2><i>✅</i>Está incluso</h2><ul class="checks">${o.inclui.map((t, i) => `<li style="transition-delay:${i * 0.12}s">${esc(t)}</li>`).join('')}</ul></section>` : ''}
      <section class="bloco" data-secao="etapas"><h2><i>🗓️</i>Como vai ser</h2><p class="apoio">${esc(o.prazo || 'Combinamos a data com você.')}</p>
        <div class="tempo"><div><b>Aceite</b>aqui no link</div><div><b>Agenda</b>data no WhatsApp</div><div><b>Instalação</b>equipe da Chama Solar</div><div><b>Entrega</b>teste e explicação</div></div></section>`;
  }
  function blocoPagar() {
    const v = valorAtual(), taxa = ((P.taxaPagamento || {}).cartao ?? 0.09), base = M && est.plano && c.plano ? c.plano.porVisita : c.total;
    return `<section class="bloco vis" data-secao="pagamento" id="sPag"><h2><i>💳</i>Como prefere pagar?</h2>
      <div class="opcoes"><button class="op" data-pag="pix" aria-pressed="${est.pag === 'pix'}"><small>PIX ou transferência</small><b>${brl(base)}</b><small>à vista</small></button>
        <button class="op" data-pag="cartao" aria-pressed="${est.pag === 'cartao'}"><small>cartão de crédito</small><b>${c.pagamento.parcelas}× ${brl(base / (1 - taxa) / c.pagamento.parcelas)}</b><small>total ${brl(base / (1 - taxa))}</small></button></div>
      ${o.observacoes ? `<p class="apoio" style="margin:14px 0 0;white-space:pre-line">${esc(o.observacoes)}</p>` : ''}
      <p class="apoio" style="margin:12px 0 0;font-size:.85rem">${validade.dias > 0 ? `Proposta válida até ${validade.fim.toLocaleDateString('pt-BR')} (${validade.dias === 1 ? 'último dia' : `faltam ${validade.dias} dias`}).` : 'Esta proposta passou da validade: fale com a gente para atualizar.'}</p>
      <div id="sAceite" style="margin-top:16px">${est.aceito ? feito() : `<button class="btn sol" id="aceitar" style="width:100%">Aceitar a proposta · ${brl(v.total)}</button>`}</div></section>`;
  }
  const feito = () => `<div class="feito"><div class="ok">✓</div><h2 style="justify-content:center">Proposta aceita${primeiro ? `, ${esc(primeiro)}` : ''}!</h2><p class="apoio">O ${esc(E.vendedor)} vai chamar você no WhatsApp para combinar a data.</p>
    <a class="btn zap" href="${zap(`Olá, ${E.vendedor}! Aceitei a proposta ${o.id} (${o.titulo}). Vamos combinar a data?`)}" target="_blank" rel="noopener">Falar agora no WhatsApp</a></div>`;

  function montar() {
    raiz.innerHTML = `${vendedor ? '<div class="faixa-v">VOCÊ ESTÁ VENDO COMO O CLIENTE · nada aqui conta como visita</div>' : ''}<div class="ps">
      <header class="heroi"><div class="topo"><img src="marca/logo-branco.webp" alt="Chama Solar" width="94" height="40"><span class="selo">${M ? 'Manutenção' : 'Serviço'} · ${esc(o.id || '')}</span></div>
        <h1>${primeiro ? `${esc(primeiro)}, ` : ''}${M ? 'seu sistema solar <em>de volta ao máximo</em>' : `<em>${esc(o.titulo || 'sua proposta')}</em>`}</h1>
        <p>${M ? `Manutenção completa de ${nf(c.placas)} placa${c.placas === 1 ? '' : 's'}${o.marcaInversor ? ` e do inversor ${esc(o.marcaInversor)}` : ''}, em ${esc(o.cidade || 'sua cidade')}.` : `Proposta preparada pela Chama Solar para ${esc(o.cidade || 'você')}.`}</p>
        <div class="valor-h"><div><small id="vLeg">valor ${M && est.plano && c.plano ? 'por visita no plano' : 'total'}</small><b class="num" id="vTopo">${brl(M && est.plano && c.plano ? c.plano.porVisita : c.total)}</b></div><div class="val">${esc(o.prazo || '')}</div></div></header>
      ${M ? blocoManut() : ''}${blocoItens()}${M ? '' : blocoServ()}${blocoPagar()}
      <section class="bloco" data-secao="quem"><h2><i>🔆</i>Quem vai cuidar disso</h2><p class="apoio" style="margin:0">A ${esc(E.nome)} instala e cuida de sistemas solares há ${E.anos} anos em Ribeirão Preto e região. ${esc(E.selo || '')}.</p>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px"><a class="btn zap" href="${zap(`Olá, ${E.vendedor}! Tenho uma dúvida sobre a proposta ${o.id}.`)}" target="_blank" rel="noopener" data-z="1">Tirar dúvida no WhatsApp</a><a class="btn vidro" href="${esc(E.instagram)}" target="_blank" rel="noopener">Ver obras no Instagram</a><button class="btn vidro" id="pdf">📄 Baixar PDF</button></div></section>
      <footer class="rodape">${esc(E.nome)} · ${esc(E.endereco)}<br>${esc(E.telefone)} · ${esc(E.email)}</footer></div>
      <div class="barra-acao"><div class="ps-in"><div class="tot"><small id="bLeg">${est.pag === 'cartao' ? 'no cartão' : 'à vista'}</small><b class="num" id="bTot">${brl(valorAtual().total)}</b></div>${est.aceito ? '<span class="selo" style="color:var(--bom)">aceita ✓</span>' : '<button class="btn sol" id="irAceitar">Aceitar</button>'}</div></div>`;
    ligar(); simular();
  }
  function atualizarValores() {
    const v = valorAtual(), base = M && est.plano && c.plano ? c.plano.porVisita : c.total;
    $('#bTot').textContent = brl(v.total); $('#bLeg').textContent = est.pag === 'cartao' ? `no cartão · ${c.pagamento.parcelas}× ${brl(v.parcela)}` : 'à vista';
    $('#vTopo').textContent = brl(base); $('#vLeg').textContent = M && est.plano && c.plano ? 'valor por visita no plano' : 'valor total'; const a = $('#aceitar'); if (a) a.textContent = `Aceitar a proposta · ${brl(v.total)}`;
    const pag = $('#sPag'); if (pag) { pag.outerHTML = blocoPagar(); ligarPag(); }
  }
  function ligarPag() {
    document.querySelectorAll('[data-pag]').forEach((b) => b.onclick = () => { est.pag = b.dataset.pag; registrar('viu', { secao: 'pagamento:' + est.pag }); atualizarValores(); });
    const a = $('#aceitar'); if (a) a.onclick = aceitar;
  }
  function aceitar() {
    const v = valorAtual();
    registrar('aceite', { tipo: o.tipo, pagamento: est.pag, plano: est.plano, valor: Math.round(v.total * 100) / 100 });
    est.aceito = true; $('#sAceite').innerHTML = feito(); const ir = $('#irAceitar'); if (ir) ir.outerHTML = '<span class="selo" style="color:var(--bom)">aceita ✓</span>';
    $('#sAceite').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function simular() {
    const r = $('#simR'); if (!r) return; const d = JSON.parse($('#simD').textContent);
    const calc = () => { const pct = +r.value / 100, kwhMes = d.kwp * d.hsp * 30 * 0.8, perde = kwhMes * pct, rs = perde * d.tarifa, base = est.plano && c.plano ? c.plano.porVisita : c.total;
      $('#simPct').textContent = nf(pct * 100) + '%'; $('#simKwh').textContent = nf(perde); $('#simRs').textContent = brl(rs, 0); $('#simMes').textContent = rs > 0 ? `${nf(Math.max(1, Math.ceil(base / rs)))} ${Math.ceil(base / rs) === 1 ? 'mês' : 'meses'}` : '–'; };
    r.oninput = calc; r.onchange = () => registrar('viu', { secao: 'simulador:' + r.value }); calc();
  }
  function ligar() {
    ligarPag();
    const ir = $('#irAceitar'); if (ir) ir.onclick = () => { $('#sPag').scrollIntoView({ behavior: 'smooth', block: 'center' }); };
    document.querySelectorAll('[data-plano]').forEach((b) => b.onclick = () => { est.plano = b.dataset.plano === '1'; document.querySelectorAll('[data-plano]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); registrar('viu', { secao: 'plano:' + (est.plano ? 'sim' : 'nao') }); atualizarValores(); simular(); });
    document.querySelectorAll('[data-z]').forEach((a) => a.addEventListener('click', () => registrar('whatsapp', {})));
    // entra na tela: aparece com animação, enche as barras e registra o que foi visto
    const vistos = new Set();
    const ob = 'IntersectionObserver' in window ? new IntersectionObserver((es) => es.forEach((e) => { if (!e.isIntersecting) return; e.target.classList.add('vis'); e.target.querySelectorAll('[data-w]').forEach((i) => { i.style.width = i.dataset.w + '%'; }); const s = e.target.dataset.secao; if (s && !vistos.has(s)) { vistos.add(s); registrar('viu', { secao: s }); } }), { threshold: 0.25 }) : null;
    document.querySelectorAll('.bloco').forEach((b) => (ob ? ob.observe(b) : b.classList.add('vis')));
    if (!ob) document.querySelectorAll('[data-w]').forEach((i) => { i.style.width = i.dataset.w + '%'; });
  }
  montar();
  // PDF: a mesma proposta em versão para imprimir (fundo branco, tudo aberto)
  const pdf = () => { document.querySelectorAll('.bloco').forEach((x) => x.classList.add('vis')); document.querySelectorAll('[data-w]').forEach((i) => { i.style.width = i.dataset.w + '%'; }); registrar('viu', { secao: 'pdf' }); setTimeout(() => print(), 300); };
  $('#pdf').onclick = pdf; if (qs.get('pdf') === '1') setTimeout(pdf, 800);
  registrar('abriu', { tipo: o.tipo });
})();
