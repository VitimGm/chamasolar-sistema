/* =====================================================================
   PROPOSTA VIVA — o que o cliente vê. Ordem pensada para conversão:
   1. a dor dele (com números dele)  2. o custo de não fazer nada
   3. a solução  4. troca de boleto  5. escolha  6. prova vizinha
   7. dúvidas respondidas  8. decidir (com quem decide junto)
   Cada interação vira um evento para o vendedor saber a temperatura.
   ===================================================================== */
(function () {
  'use strict';
  const B = window.Banco, C = window.Conversao, D = window.DadosTeste, A = window.Agentes;
  const $ = (s, r = document) => r.querySelector(s);
  const brl = (v, c = 0) => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: c, maximumFractionDigits: c });
  const n = (v, c = 0) => C.fmt(v, c);
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const MESES = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

  B.semear();
  const qs = new URLSearchParams(location.search);
  // reserva: se o endereço perder o ?t=, usa a última proposta aberta pela central
  let reserva = {}; try { reserva = JSON.parse(sessionStorage.getItem('sol2_abrir') || '{}'); } catch { /* sem armazenamento */ }
  const vendedor = qs.has('t') ? qs.get('v') === '1' : !!reserva.v;
  const o = B.porToken(qs.get('t') || reserva.t) || B.orcamentos().find((x) => x.status !== 'novo');
  const raiz = $('#proposta');
  if (!o) { raiz.innerHTML = '<div class="pv secao"><h2>Proposta não encontrada</h2><p class="lead">Peça um novo link ao seu consultor.</p></div>'; return; }

  const p = B.parametros();
  const est = { opcao: o.opcaoEscolhida ?? 1, prazo: p.financiamento.prazos[2], entradaPct: 0 };
  const registrar = (tipo, dados) => { if (!vendedor) B.evento(o.token, tipo, dados); };
  const analise = () => C.analisar({ ...o, opcaoEscolhida: est.opcao }, p, est.prazo);
  let a = analise();

  const nome = String(o.nome).split(' ')[0];
  const ehEmpresa = /padaria|auto|peças|ltda|comércio|mercado|loja|restaurante/i.test(o.nome);
  const validade = new Date(+new Date(o.enviadoEm || o.criadoEm) + p.validadeDias * 864e5);
  const link = location.href.replace(/[?&]v=1/, '');
  const ICONES = { negocio: '🏪', crescendo: '📈', verao: '🌡️', reajuste: '⚡', conta: '💸' };

  raiz.innerHTML = `
    ${vendedor ? `<div class="faixa-teste">MODO VENDEDOR · suas visitas não contam · <a href="index.html#lead-${esc(o.id)}" style="color:inherit">‹ voltar para a central</a></div>` : ''}
    <div class="faixa-teste" style="background:#2a3656;color:#cfd8ee">VERSÃO DE TESTE · números simulados</div>
    <div class="pv">
      <header class="topo-pv">
        <img src="marca/logo-branco.webp" alt="Chama Solar" width="100" height="42">
        <div class="valid">Proposta ${esc(o.id)}<br>Cotação válida até <b>${validade.toLocaleDateString('pt-BR')}</b></div>
      </header>

      <section class="heroi entra" id="s-topo">
        <div class="ola">Olá, ${esc(ehEmpresa ? o.nome : nome)}.</div>
        <h1>${ehEmpresa ? 'Sua empresa pagou' : 'Você pagou'} <span class="grad">${brl(a.raioX.pago12)}</span> de luz nos últimos 12&nbsp;meses.</h1>
        <p>Esta proposta mostra como esse dinheiro passa a ficar com ${ehEmpresa ? 'a empresa' : 'você'} — com os números da sua própria conta.</p>
        <div class="resumo3" id="resumo3"></div>
        <a class="descer" href="#s-dor"><i></i>Ver o raio-x da sua conta</a>
      </section>

      <section class="secao" id="s-dor" data-secao="dor">
        <span class="rotulo">01 · Raio-x da sua conta</span>
        <h2>Para onde vai o seu dinheiro hoje</h2>
        <p class="lead">Cada barra é um mês da sua conta na CPFL. ${a.perfil.principal.texto}</p>
        <div class="barras" aria-label="Conta mês a mês">${barras()}</div>
        <div class="dores">${a.perfil.dores.slice(0, 3).map((d) => `<div class="dor"><div class="ic">${ICONES[d.id] || '•'}</div><div><b>${esc(d.titulo)}</b><p>${esc(d.texto)}</p></div></div>`).join('')}</div>
      </section>

      <section class="secao" id="s-futuro" data-secao="futuro">
        <span class="rotulo">02 · Se nada mudar</span>
        <h2>Em 25 anos, sua conta soma</h2>
        <div class="grande-num ruim">${brl(a.raioX.total25)}</div>
        <p class="lead">Considerando reajuste médio de ${n(p.reajusteAnual * 100)}% ao ano (o último da CPFL foi de ${n(p.reajusteUltimo * 100, 2)}%).</p>
        <div id="curva"></div>
      </section>

      <section class="secao" data-secao="relogio">
        <div class="painel brilha relogio">
          <div class="rotulo">Enquanto você lê esta página</div>
          <div class="valor" id="relogio">R$ 0,0000</div>
          <div class="mini">foram para a conta de luz, no ritmo do seu consumo</div>
          <div class="espera3" id="espera3"></div>
        </div>
      </section>

      <section class="secao" id="s-solucao" data-secao="solucao">
        <span class="rotulo">03 · A solução</span>
        <h2>Sua própria usina no telhado</h2>
        <p class="lead" id="lcoe"></p>
        <div class="usina" id="usina"></div>
        <div class="kwh" id="kwh"></div>
      </section>

      <section class="secao" id="s-boleto" data-secao="boleto">
        <span class="rotulo">04 · Troca de boleto</span>
        <h2>Em vez da conta, uma parcela que acaba</h2>
        <p class="lead">Escolha o prazo e veja quanto sai por mês comparado com o que você paga hoje.</p>
        <div class="painel boleto">
          <div class="chips" id="prazos"></div>
          <label class="campo" style="margin-top:16px"><span id="entrada-rot">Entrada: sem entrada</span><input type="range" id="entrada" min="0" max="50" step="5" value="0"></label>
          <div id="comparar"></div>
        </div>
      </section>

      <section class="secao" id="s-opcoes" data-secao="opcoes">
        <span class="rotulo">05 · Escolha a sua</span>
        <h2>Três caminhos, mesma economia de base</h2>
        <div class="ops" id="ops"></div>
      </section>

      <section class="secao" id="s-vizinhos" data-secao="vizinhos">
        <span class="rotulo">06 · Quem já gera perto de você</span>
        <h2>Contas reais de clientes Chama Solar${a.vizinhos.mesmaCidade ? ' em ' + esc(o.cidade) : ''}</h2>
        <p class="lead"><span class="ponto-vivo"></span>Dados das usinas monitoradas no último mês. <em class="mini">(Teste: dados simulados.)</em></p>
        <div class="vizinhos">${a.vizinhos.usinas.slice(0, 4).map((u) => `
          <div class="viz"><b>${esc(u.bairro)}</b><div class="de-para"><s>${brl(u.contaAntes)}</s><span>${brl(u.contaMes)}</span></div>
          <div class="sutil">${n(u.kwp, 1)} kWp · desde ${u.desde} · gerou ${n(u.geracaoPct * 100)}% do previsto</div></div>`).join('')}</div>
        <div class="confianca">
          <div><span>🏆</span><span>${D.empresa.anos} anos instalando em Ribeirão Preto e região</span></div>
          <div><span>⭐</span><span>${esc(D.empresa.selo)}</span></div>
          <div><span>📄</span><span>Projeto e homologação na CPFL inclusos</span></div>
          <div><span>📡</span><span>Monitoramento mensal da sua usina</span></div>
        </div>
      </section>

      <section class="secao" id="s-duvidas" data-secao="duvidas">
        <span class="rotulo">07 · Perguntas que todo mundo faz</span>
        <h2>Respostas com os seus números</h2>
        <div class="duvidas" id="duvidas"></div>
      </section>

      <section class="secao" id="s-decidir" data-secao="decidir">
        <span class="rotulo">08 · Próximo passo</span>
        <h2>Vamos tirar sua usina do papel?</h2>
        <div class="painel decidir" id="decidir"></div>
      </section>

      <footer class="rodape-pv">
        <img src="marca/logo-branco.webp" alt="Chama Solar" width="86" height="36">
        ${esc(D.empresa.endereco)}<br>${esc(D.empresa.telefone)} · ${esc(D.empresa.email)}<br><br>
        <span class="mini">Estimativas com base no seu consumo e na irradiação média do local. A geração real varia com o clima. Financiamento sujeito a análise de crédito.</span>
      </footer>
    </div>
    <div class="cta-fixo" id="cta"><div class="pv">
      <a class="btn zap" id="zap-fixo" href="#" aria-label="Falar no WhatsApp">💬</a>
      <a class="btn sol" href="#s-decidir">Quero minha usina</a>
    </div></div>`;

  /* ---------- Partes que mudam com a escolha ---------- */
  function barras() {
    const v = a.raioX.mensal, max = Math.max(...v);
    return v.map((x, i) => `<div class="b ${x === max ? 'max' : ''}" style="--i:${i}"><small>${brl(x)}</small><i style="height:${(x / max) * 88}%;animation-delay:${i * 40}ms"></i><em>${MESES[i]}</em></div>`).join('');
  }

  function curva() {
    const c = a.raioX.curva, W = 640, H = 230, pad = 34;
    const max = Math.max(...c.map((x) => Math.max(x.sem, x.com)));
    const X = (i) => pad + (i / (c.length - 1)) * (W - pad - 8), Y = (v) => H - 24 - (v / max) * (H - 40);
    const linha = (k) => c.map((x, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(x[k]).toFixed(1)}`).join(' ');
    const vi = c.findIndex((x) => x.ano === a.raioX.anoVirada);
    return `<svg class="curva" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gasto acumulado com e sem energia solar">
      <defs><linearGradient id="gs" x1="0" x2="1"><stop offset="0" stop-color="#e85018"/><stop offset="1" stop-color="#f8b818"/></linearGradient>
      <linearGradient id="ar" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#ff4d6d" stop-opacity=".28"/><stop offset="1" stop-color="#ff4d6d" stop-opacity="0"/></linearGradient></defs>
      <path d="${linha('sem')} L${X(c.length - 1)},${H - 24} L${X(0)},${H - 24} Z" fill="url(#ar)"/>
      <path d="${linha('sem')}" fill="none" stroke="#ff4d6d" stroke-width="3" stroke-linecap="round"/>
      <path d="${linha('com')}" fill="none" stroke="url(#gs)" stroke-width="3.5" stroke-linecap="round"/>
      ${vi >= 0 ? `<circle cx="${X(vi)}" cy="${Y(c[vi].com)}" r="6" fill="#f8b818"/><text x="${X(vi) + 10}" y="${Y(c[vi].com) - 10}" style="fill:#f8b818;font-weight:700">Virada em ${c[vi].ano}</text>` : ''}
      <text x="${X(0)}" y="${H - 6}">${c[0].ano}</text><text x="${X(c.length - 1)}" y="${H - 6}" text-anchor="end">${c[c.length - 1].ano}</text>
      <text x="${X(c.length - 1)}" y="${Y(c[c.length - 1].sem) - 8}" text-anchor="end" style="fill:#ff8099;font-weight:700">${brl(c[c.length - 1].sem)}</text>
      <text x="${X(c.length - 1)}" y="${Y(c[c.length - 1].com) - 8}" text-anchor="end" style="fill:#f8b818;font-weight:700">${brl(c[c.length - 1].com)}</text>
    </svg>
    <div class="legenda-c"><span><i style="background:#ff4d6d"></i>Só conta de luz</span><span><i style="background:linear-gradient(90deg,#e85018,#f8b818)"></i>Com solar (investimento + conta mínima + manutenção)</span></div>`;
  }

  function dinamico() {
    a = analise();
    const op = a.op, eco = op.eco;
    $('#resumo3').innerHTML = `
      <div><b class="num grad">${brl(eco.contaDepois)}</b><span>conta com solar <s>${brl(eco.contaAtual)}</s></span></div>
      <div><b class="num">${n(eco.paybackAnos, 1)} anos</b><span>para se pagar</span></div>
      <div><b class="num">${eco.economia25 >= 1e5 ? `R$ ${n(eco.economia25 / 1000)} mil` : brl(eco.economia25)}</b><span>de economia em 25 anos</span></div>`;
    $('#curva').innerHTML = curva();
    $('#espera3').innerHTML = `
      <div><b>${brl(a.espera.porDia, 2)}</b><span>por dia de espera</span></div>
      <div><b>${brl(a.espera.porMes)}</b><span>por mês</span></div>
      <div><b>${brl(a.espera.seisMeses)}</b><span>em 6 meses</span></div>`;
    $('#lcoe').innerHTML = `Com o sistema, cada kWh que você usa sai por <b class="grad num">R$ ${n(a.energia.rsKwh, 2)}</b> ao longo de 25 anos — contra <b class="num">R$ ${n(a.raioX.tarifa, 2)}</b> que a CPFL cobra hoje, e subindo.`;
    $('#usina').innerHTML = `
      <div><span>Potência</span><b>${n(op.dim.kwpReal, 2)}<small>kWp</small></b></div>
      <div><span>Painéis solares</span><b>${op.dim.placas}<small>× ${op.modulo.potenciaW} W</small></b></div>
      <div><span>Geração média</span><b>${n(op.dim.geracaoMes)}<small>kWh/mês</small></b></div>
      <div><span>Espaço no telhado</span><b>${n(op.areaM2, 0)}<small>m²</small></b></div>`;
    const cons = C.consumoMedio(o), mx = Math.max(cons, op.dim.geracaoMes);
    $('#kwh').innerHTML = `
      <div class="linha"><span>Seu consumo</span><div class="trilho"><i style="width:${(cons / mx) * 100}%;background:#5d6b8a"></i></div><span class="v">${n(cons)} kWh</span></div>
      <div class="linha"><span>Sua geração</span><div class="trilho"><i style="width:${(op.dim.geracaoMes / mx) * 100}%;background:var(--grad-sol)"></i></div><span class="v">${n(op.dim.geracaoMes)} kWh</span></div>`;

    $('#prazos').innerHTML = [...p.financiamento.prazos, 0].map((pz) => `<button type="button" class="chip ${est.prazo === pz ? 'sel' : ''}" data-prazo="${pz}">${pz ? pz + 'x' : 'À vista'}</button>`).join('');
    const entradaRs = est.prazo ? op.preco.precoFinal * est.entradaPct / 100 : 0;
    const b = C.boleto(op, p, est.prazo, entradaRs);
    $('#entrada').disabled = !est.prazo;
    $('#entrada-rot').textContent = est.prazo ? (est.entradaPct ? `Entrada: ${brl(entradaRs)} (${est.entradaPct}%)` : 'Entrada: sem entrada') : `Pagamento à vista: ${brl(op.preco.precoFinal)}`;
    const hoje = b.contaAtual, depois = b.totalMes, mx2 = Math.max(hoje, depois) || 1;
    const h = (v) => Math.max((v / mx2) * 170, 4);
    $('#comparar').innerHTML = `
      <div class="comparar">
        <div class="coluna"><b class="num">${brl(hoje)}</b><div class="pilha" style="height:${h(hoje)}px"><i class="p1" style="height:100%"></i></div><span>Hoje: só conta de luz</span></div>
        <div class="coluna"><b class="num">${brl(depois)}</b><div class="pilha" style="height:${h(depois)}px">${b.parcela ? `<i class="p2" style="height:${(b.parcela / depois) * 100}%"></i>` : ''}<i class="p3" style="height:${(b.contaDepois / depois) * 100}%"></i></div><span>${b.parcela ? `${b.prazo}x de ${brl(b.parcela)} + conta mínima` : 'Só a conta mínima'}</span></div>
      </div>
      <div class="veredito ${b.diferenca >= 0 ? 'bom' : 'quase'}">${b.diferenca >= 0 ? `Você já começa pagando ${brl(b.diferenca)} a menos por mês` : `Só ${brl(-b.diferenca)} a mais por mês — e a parcela acaba`}</div>
      <p class="depois">${b.parcela ? `Depois de ${b.prazo / 12} anos, a parcela some e sobram <b>${brl(b.livreDepois)}</b> todo mês.` : `A partir do primeiro mês sobram <b>${brl(b.livreDepois)}</b>.`}</p>`;

    $('#ops').innerHTML = a.opcoes.map((x, i) => {
      const parc = C.boleto(x, p, p.financiamento.prazos[2]).parcela;
      const itens = [`${x.dim.placas} painéis de ${x.modulo.potenciaW} W`, x.inversor.nome.replace(/\s*\(.*\)/, ''), x.bateria ? `Bateria de ${n(x.bateria.kwh, 1)} kWh para quedas de energia` : `Retorno em ${n(x.eco.paybackAnos, 1)} anos`, i === 1 ? 'Garantia estendida do inversor' : i === 0 ? 'Melhor preço' : 'Casa com energia mesmo sem a CPFL'];
      return `<button type="button" class="op ${est.opcao === i ? 'sel' : ''}" data-op="${i}">
        ${x.destaque ? '<span class="fita">RECOMENDADA PARA VOCÊ</span>' : ''}<span class="marca-sel"></span>
        <h3>${esc(x.nivel)}</h3><div class="sutil">${esc(x.descricao)}</div>
        <div class="preco">${brl(x.preco.precoFinal)}</div><div class="parc">ou ${p.financiamento.prazos[2]}x de ${brl(parc)}</div>
        <ul>${itens.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></button>`;
    }).join('');

    const perguntas = [
      ['caro', 'Não é muito dinheiro para agora?'], ['taxacao', 'Ouvi falar de taxação do sol. Ainda compensa?'],
      ['tecnologia', 'Não é melhor esperar a tecnologia melhorar?'], ['mudar', 'E se eu mudar de casa?'],
    ];
    $('#duvidas').innerHTML = perguntas.map(([id, q]) => `<details class="duvida" data-duvida="${id}"><summary>${q}</summary><p>${esc(A.resposta(id, a, o))}</p></details>`).join('') +
      `<details class="duvida" data-duvida="nublado"><summary>E em dia nublado ou à noite?</summary><p>À noite você usa energia da rede e, de dia, o que sobra vira crédito na CPFL. A simulação usa a média do ano inteiro em ${esc(o.cidade || 'Ribeirão Preto')}, com dias nublados incluídos.</p></details>
       <details class="duvida" data-duvida="manutencao"><summary>Dá muito trabalho de manutenção?</summary><p>Praticamente nenhum: uma limpeza por ano e o monitoramento a gente faz. Você recebe todo mês um relatório da sua usina com a conta da CPFL lado a lado.</p></details>`;
    const zap = `https://wa.me/${D.empresa.whatsapp}?text=${encodeURIComponent(`Oi Victor! Vi a proposta ${o.id} (opção ${op.nivel}) e tenho uma dúvida:`)}`;
    $('#zap-fixo').href = zap;
    decidir(zap);
  }

  function decidir(zap) {
    const op = a.op;
    if (o.status === 'ganho' && o.aceite) {
      $('#decidir').innerHTML = `<div class="sucesso"><div class="sol-grande">☀️</div><h3>Proposta aceita!</h3><p class="sutil">O Victor vai te chamar para agendar a visita técnica.</p></div>${passos()}`;
      return;
    }
    $('#decidir').innerHTML = `
      <p class="sutil" style="margin-bottom:14px">Opção escolhida: <b style="color:var(--texto)">${esc(op.nivel)} · ${brl(op.preco.precoFinal)}</b>. Sem compromisso de pagamento agora: o próximo passo é a visita técnica gratuita.</p>
      <div class="campo"><span>Como prefere pagar?</span><div class="chips" id="pg">${[['financiamento', 'Financiado'], ['avista', 'À vista / Pix'], ['cartao', 'Cartão']].map(([v, t]) => `<button type="button" class="chip ${(est.pg || 'financiamento') === v ? 'sel' : ''}" data-pg="${v}">${t}</button>`).join('')}</div></div>
      <div class="campo"><span>Melhor horário para a visita</span><div class="chips" id="hr">${['Manhã', 'Tarde', 'Sábado'].map((t) => `<button type="button" class="chip ${est.hr === t ? 'sel' : ''}" data-hr="${t}">${t}</button>`).join('')}</div></div>
      <button class="btn sol bloco" id="aceitar" style="margin-top:18px">Quero minha usina ☀️</button>
      <a class="btn zap bloco" href="${zap}" target="_blank" rel="noopener" id="zap" style="margin-top:10px">Tirar uma dúvida com o Victor</a>
      <a class="btn vidro bloco" id="compartilhar" target="_blank" rel="noopener" style="margin-top:10px" href="https://wa.me/?text=${encodeURIComponent(`Olha a proposta de energia solar que recebi: a conta cai de ${brl(a.op.eco.contaAtual)} para ${brl(a.op.eco.contaDepois)}. ${link}`)}">Mostrar para quem decide comigo</a>
      <p class="mini" style="margin-top:12px;text-align:center">Preço do kit garantido até ${validade.toLocaleDateString('pt-BR')} (cotação do distribuidor).</p>
      ${passos()}`;
  }
  const passos = () => `<ol class="passos">
      <li><div><b>Visita técnica gratuita</b><span>Conferimos telhado, padrão de entrada e sombras.</span></div></li>
      <li><div><b>Projeto e homologação na CPFL</b><span>A gente cuida de toda a papelada.</span></div></li>
      <li><div><b>Instalação</b><span>Normalmente em 1 a 2 dias.</span></div></li>
      <li><div><b>Usina ligada e monitorada</b><span>Relatório mensal da geração × conta.</span></div></li></ol>`;

  /* ---------- Interações ---------- */
  raiz.addEventListener('click', (ev) => {
    const t = ev.target.closest('[data-prazo],[data-op],[data-pg],[data-hr],#aceitar,#compartilhar,#zap,#zap-fixo');
    if (!t) return;
    if (t.dataset.prazo !== undefined) { est.prazo = +t.dataset.prazo; registrar('simulou', { prazo: est.prazo }); dinamico(); }
    else if (t.dataset.op !== undefined) { est.opcao = +t.dataset.op; registrar('escolheu', { opcao: est.opcao }); dinamico(); }
    else if (t.dataset.pg) { est.pg = t.dataset.pg; decidir($('#zap').href); }
    else if (t.dataset.hr) { est.hr = t.dataset.hr; decidir($('#zap').href); }
    else if (t.id === 'zap' || t.id === 'zap-fixo') registrar('whatsapp', {});
    else if (t.id === 'compartilhar') registrar('compartilhou', {});
    else if (t.id === 'aceitar') {
      const dados = { opcao: est.opcao, nivel: a.op.nivel, preco: a.op.preco.precoFinal, pagamento: est.pg || 'financiamento', horario: est.hr || 'a combinar' };
      if (!vendedor) { B.evento(o.token, 'aceite', dados); Object.assign(o, B.porToken(o.token)); }
      else { o.status = 'ganho'; o.aceite = dados; }
      decidir(); $('#s-decidir').scrollIntoView({ behavior: 'smooth' });
    }
  });
  $('#entrada').addEventListener('change', (ev) => { est.entradaPct = +ev.target.value; registrar('simulou', { prazo: est.prazo, entrada: est.entradaPct }); dinamico(); });
  $('#duvidas').addEventListener('toggle', (ev) => { if (ev.target.open) registrar('duvida', { tema: ev.target.dataset.duvida }); }, true);

  /* ---------- Relógio da conta ---------- */
  const inicio = performance.now();
  (function tique() {
    const s = (performance.now() - inicio) / 1000;
    $('#relogio').textContent = brl(a.espera.contaPorSegundo * s, 4);
    requestAnimationFrame(tique);
  })();

  /* ---------- Rastreamento de leitura ---------- */
  registrar('abriu', { origem: document.referrer ? 'link' : 'direto' });
  const vistas = new Set();
  const obs = new IntersectionObserver((ents) => ents.forEach((e) => {
    const s = e.target.dataset.secao;
    if (e.isIntersecting && !vistas.has(s)) { vistas.add(s); registrar('viu', { secao: s }); }
  }), { threshold: 0.45 });
  document.querySelectorAll('[data-secao]').forEach((s) => obs.observe(s));
  // esconde a barra fixa quando o formulário de decisão está na tela
  new IntersectionObserver(([e]) => $('#cta').classList.toggle('some', e.isIntersecting), { threshold: 0.2 }).observe($('#s-decidir'));

  dinamico();
})();
