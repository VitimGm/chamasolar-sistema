/* =====================================================================
   PROPOSTA VIVA — versão clara e simples, pensada para quem decide
   (muitas vezes 55+, alguns pouco à vontade com tecnologia).
   Regras: um assunto por bloco · título em forma de pergunta · letra
   grande · botões grandes (nada de arrastar) · uma opção em destaque ·
   o consultor sempre à vista · "ouvir a proposta" · enviar para familiar.
   Cada interação vira evento para o vendedor ver na ficha.
   ===================================================================== */
(function () {
  'use strict';
  const B = window.Banco, C = window.Conversao, D = window.DadosTeste, A = window.Agentes;
  const $ = (s, r = document) => r.querySelector(s);
  const brl = (v, c = 0) => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: c, maximumFractionDigits: c });
  const n = (v, c = 0) => C.fmt(v, c);
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const MESES = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
  const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

  B.semear();
  const qs = new URLSearchParams(location.search);
  let reserva = {}; try { reserva = JSON.parse(sessionStorage.getItem('sol2_abrir') || '{}'); } catch { /* sem armazenamento */ }
  const vendedor = qs.has('t') ? qs.get('v') === '1' : !!reserva.v;
  const o = B.porToken(qs.get('t') || reserva.t) || B.orcamentos().find((x) => x.status !== 'novo');
  const raiz = $('#proposta');
  if (!o) { raiz.innerHTML = '<div class="pv"><div class="bloco"><h2>Proposta não encontrada</h2><p>Peça um novo link ao seu consultor.</p></div></div>'; return; }

  const p = B.parametros();
  const est = { opcao: C.indiceOpcao(o, C.opcoes(o, B.parametros())), prazo: p.financiamento.prazos[2], hr: null };
  const registrar = (tipo, dados) => { if (!vendedor) B.evento(o.token, tipo, dados); };
  let a = C.analisar({ ...o, opcaoEscolhida: est.opcao }, p, est.prazo);

  const ehEmpresa = /padaria|auto|peças|ltda|comércio|mercado|loja|restaurante/i.test(o.nome);
  const nomeCurto = ehEmpresa ? o.nome : String(o.nome).split(' ')[0];
  const validade = new Date(+new Date(o.enviadoEm || o.criadoEm) + p.validadeDias * 864e5);
  const link = location.href.replace(/[?&]v=1/, '');
  const vend = D.empresa.vendedor, telVend = '(16) 98136-6288';
  const zapVend = () => `https://wa.me/${D.empresa.whatsapp}?text=${encodeURIComponent(`Olá ${vend}! Vi a proposta ${o.id} e quero conversar.`)}`;

  /* ---------- Estrutura fixa da página ---------- */
  raiz.innerHTML = `
    ${vendedor ? `<div class="faixa">MODO VENDEDOR · suas visitas não contam · <a href="index.html#lead-${esc(o.id)}">voltar para a central</a></div>` : ''}
    <div class="faixa" style="background:#e9edf5;color:#46526b">Versão de teste · números simulados</div>
    <header class="topo"><div class="pv">
      <img src="marca/logo-cor.webp" alt="Chama Solar" width="123" height="52">
      <div class="ferramentas">
        <button type="button" id="ouvir" aria-pressed="false">${Icone('som')} <span>Ouvir</span></button>
        <button type="button" id="letra" aria-pressed="false">${Icone('letra')} <span>Letra</span></button>
      </div>
    </div></header>
    <main class="pv">
      <section class="ola">
        <h1>${ehEmpresa ? `Proposta para ${esc(o.nome)}` : `Olá, ${esc(nomeCurto)}!`}</h1>
        <p>Preparamos esta proposta com base na sua conta de luz. Leva uns 3 minutos.</p>
        <div class="consultor">
          <div class="foto" aria-hidden="true">${esc(vend[0])}</div>
          <div><b>${esc(vend)}, seu consultor na Chama Solar</b><span>Qualquer dúvida, é só me chamar:</span>
            <div class="tel">${telVend}</div></div>
        </div>
      </section>

      <section class="bloco" data-secao="resumo" aria-labelledby="t-resumo">
        <h2 id="t-resumo"><i class="bolha">${Icone('grafico')}</i>Resumo em três números</h2>
        <div class="tres" id="tres"></div>
      </section>

      <section class="bloco" data-secao="conta" aria-labelledby="t-conta">
        <h2 id="t-conta"><i class="bolha">${Icone('conta')}</i>Quanto você pagou de luz no último ano?</h2>
        <p class="apoio">Cada barra é um mês da sua conta. A mais escura foi a mais cara.</p>
        <div class="barras" id="barras" aria-hidden="true"></div>
        <p class="frase" id="frase-conta"></p>
      </section>

      <section class="bloco" data-secao="espera" aria-labelledby="t-espera">
        <h2 id="t-espera"><i class="bolha">${Icone('relogio')}</i>E se deixar para depois?</h2>
        <p class="apoio">Enquanto o sistema não é instalado, a conta continua chegando.</p>
        <div class="duas" id="espera"></div>
      </section>

      <section class="bloco" data-secao="pagamento" aria-labelledby="t-pag">
        <h2 id="t-pag"><i class="bolha">${Icone('cofre')}</i>Como fica o pagamento?</h2>
        <p class="apoio">Toque para ver em quantas vezes:</p>
        <div class="opcoes-g" id="prazos" role="group" aria-label="Prazo"></div>
        <div id="comparar"></div>
      </section>

      <section class="bloco" data-secao="sistema" aria-labelledby="t-sis">
        <h2 id="t-sis"><i class="bolha">${Icone('painel')}</i>O que vamos instalar?</h2>
        <div id="sistema"></div>
      </section>

      <section class="bloco" data-secao="vizinhos" aria-labelledby="t-viz">
        <h2 id="t-viz"><i class="bolha">${Icone('casa')}</i>Quem já tem perto de você?</h2>
        <p class="apoio">Contas reais de clientes Chama Solar${a.vizinhos.mesmaCidade ? ' em ' + esc(o.cidade) : ' na região'}. <em>(Teste: dados simulados.)</em></p>
        ${a.vizinhos.usinas.slice(0, 3).map((u) => `<div class="viz"><b>Bairro ${esc(u.bairro)}</b><div class="de-para"><s>${brl(u.contaAntes)}</s><span>${brl(u.contaMes)}</span></div><small>Pagava ${brl(u.contaAntes)} por mês. Hoje paga ${brl(u.contaMes)}. Instalado em ${u.desde}.</small></div>`).join('')}
        <div class="selos">
          <div>${Icone('medalha')} ${D.empresa.anos} anos na região</div><div>${Icone('estrela')} ${esc(D.empresa.selo)}</div>
          <div>${Icone('documento')} Papelada da CPFL por nossa conta</div><div>${Icone('monitor')} Acompanhamos sua usina todo mês</div>
        </div>
      </section>

      <section class="bloco" data-secao="duvidas" aria-labelledby="t-duv">
        <h2 id="t-duv"><i class="bolha">${Icone('conversa')}</i>Dúvidas mais comuns</h2>
        <div id="duvidas"></div>
      </section>

      <section class="bloco" id="s-decidir" data-secao="decidir" aria-labelledby="t-dec">
        <h2 id="t-dec"><i class="bolha">${Icone('seta')}</i>Vamos para o próximo passo?</h2>
        <div id="decidir"></div>
      </section>

      <footer class="rodape">
        <img src="marca/logo-cor.webp" alt="Chama Solar" width="104" height="44">
        ${esc(D.empresa.endereco)}<br>Telefone ${esc(D.empresa.telefone)} · ${esc(D.empresa.email)}<br><br>
        Valores estimados com base no seu consumo e no sol médio da sua cidade. A geração real varia com o clima. Financiamento sujeito a aprovação de crédito. Proposta ${esc(o.id)}, válida até ${validade.toLocaleDateString('pt-BR')}.
      </footer>
    </main>
    <div class="cta-fixo" id="cta"><div class="pv">
      <a class="btn-g verde" id="zap-fixo" href="${zapVend()}" target="_blank" rel="noopener" aria-label="Falar com ${esc(vend)} no WhatsApp">${Icone('conversa')}</a>
      <a class="btn-g laranja" href="#s-decidir">Quero minha usina</a>
    </div></div>`;

  /* Item tocável: ícone + título; ao tocar, abre a explicação */
  const item = (ic, titulo, sub, explica, extra = '') => `<details class="item"><summary><i class="bolha">${Icone(ic)}</i><span class="txt"><b>${titulo}</b><span>${sub}</span></span><span class="abrir" aria-hidden="true">${Icone('mais')}</span></summary><div class="explica">${explica}${extra}</div></details>`;

  /* ---------- Partes que mudam com as escolhas ---------- */
  function desenhar() {
    a = C.analisar({ ...o, opcaoEscolhida: est.opcao }, p, est.prazo);
    const op = a.op, eco = op.eco;
    const sobra = eco.contaAtual - eco.contaDepois;

    $('#tres').innerHTML = `
      <div class="num-card hoje"><i class="bolha">${Icone('conta')}</i><span>Hoje você paga</span><b>${brl(eco.contaAtual)}</b><small>por mês, em média</small></div>
      <div class="num-card depois"><i class="bolha">${Icone('sol')}</i><span>Com energia solar</span><b>${brl(eco.contaDepois)}</b><small>por mês (taxa mínima da CPFL)</small></div>
      <div class="num-card sobra"><i class="bolha">${Icone('cofre')}</i><span>Sobra no seu bolso</span><b>${brl(sobra)}</b><small>por mês, depois de pago o sistema</small></div>`;

    const v = a.raioX.mensal, max = Math.max(...v), iMax = v.indexOf(max);
    $('#barras').innerHTML = v.map((x, i) => `<div class="b ${i === iMax ? 'max' : ''}"><i style="height:${Math.max((x / max) * 100, 4)}%"></i><em>${MESES[i]}</em></div>`).join('');
    $('#frase-conta').innerHTML = `No total foram <b class="destaque-ruim">${brl(a.raioX.pago12)}</b> para a CPFL. A conta mais cara foi em ${MESES_LONGOS[iMax]}: <b>${brl(max)}</b>.`;

    const t25 = a.raioX.curva[24];
    const mx = Math.max(t25.sem, t25.com);
    $('#espera').innerHTML = `
      <p class="frase" style="margin:0 0 14px">Cada mês sem energia solar custa <b class="destaque-ruim">${brl(a.espera.porMes)}</b>. Em seis meses, <b class="destaque-ruim">${brl(a.espera.seisMeses)}</b>.</p>
      <div class="linha-c"><div class="rot"><span>25 anos só com a CPFL</span><b class="destaque-ruim">${brl(t25.sem)}</b></div><div class="trilho"><i style="width:100%;background:var(--ruim)"></i></div></div>
      <div class="linha-c"><div class="rot"><span>25 anos com energia solar</span><b class="destaque-bom">${brl(t25.com)}</b></div><div class="trilho"><i style="width:${(t25.com / mx) * 100}%;background:var(--bom)"></i></div></div>
      <p class="apoio" style="margin:12px 0 0">Com solar já está tudo somado: o sistema, a taxa mínima da CPFL e a limpeza anual. A CPFL reajustou a tarifa residencial em ${n(p.reajusteUltimo * 100, 2)}% em 2026.</p>`;

    $('#prazos').innerHTML = [...p.financiamento.prazos.slice().reverse(), 0].map((pz) => {
      const parc = pz ? C.boleto(op, p, pz).parcela : 0;
      return `<button type="button" data-prazo="${pz}" aria-pressed="${est.prazo === pz}">${pz ? `${pz} vezes<small>${brl(parc)}/mês</small>` : `À vista<small>${brl(op.preco.precoFinal)}</small>`}</button>`;
    }).join('');
    const b = C.boleto(op, p, est.prazo);
    $('#comparar').innerHTML = `
      <div class="conta-vs">
        <div class="caixa hoje"><span>Hoje</span><b>${brl(b.contaAtual)}</b><small>conta de luz</small></div>
        <div class="caixa solar"><span>Com energia solar</span><b>${brl(b.totalMes)}</b><small>${b.parcela ? `parcela ${brl(b.parcela)} + conta ${brl(b.contaDepois)}` : `só a conta mínima`}</small></div>
      </div>
      <div class="veredito ${b.diferenca >= 0 ? 'bom' : 'quase'}">${b.diferenca >= 0 ? `Você já começa pagando ${brl(b.diferenca)} a menos por mês.` : `Fica só ${brl(-b.diferenca)} a mais por mês, até terminar de pagar.`}</div>
      <p class="frase" style="font-size:1rem">${b.parcela ? `Depois de ${b.prazo / 12} anos as parcelas acabam e você passa a pagar só ${brl(b.contaDepois)} de luz.` : `Desde o primeiro mês você paga só ${brl(b.contaDepois)} de luz.`}</p>`;

    const consumoZerar = Math.max(C.consumoMedio(o) - op.dim.disponibilidade, 0);
    const eq = C.equipamentos(op);
    $('#sistema').innerHTML = `
      <p class="apoio">A opção que recomendamos para a sua casa:</p>
      <div class="itens">
        ${item('painel', esc(eq.modulo), `Ocupam cerca de ${n(op.areaM2)} m² do telhado`, `As placas transformam a luz do sol em energia. As placas ${esc(eq.marcaMod)} têm garantia de fábrica do produto e de rendimento. Os prazos de cada modelo vêm na ficha técnica que entregamos com o contrato.`)}
        ${item(eq.tipo === 'micro' ? 'micro' : 'inversor', esc(eq.inversor), eq.tipo === 'micro' ? 'Um para cada grupo de placas' : eq.tipo === 'hibrido' ? 'Converte a energia e carrega a bateria' : 'O "cérebro" do sistema', eq.tipo === 'micro' ? 'Cada microinversor cuida de poucas placas. Se uma placa pegar sombra, as outras continuam gerando normalmente, e o sistema é desligado placa por placa, o que é mais seguro.' : eq.tipo === 'hibrido' ? 'Além de transformar a energia do sol, ele guarda energia na bateria e mantém o essencial ligado quando a luz da rua cai.' : 'Transforma a energia das placas na energia da tomada da sua casa e manda o que sobrar para a CPFL, que vira crédito na sua conta.')}
        ${op.bateria ? item('bateria', `Bateria de ${n(op.bateria.kwh, 1)} kWh`, 'Energia guardada para quando faltar luz', 'Mantém geladeira, luzes e internet ligadas durante uma queda de energia.') : ''}
        ${item('grafico', `Gera ${n(op.dim.geracaoMes)} kWh por mês`, `Você usa ${n(C.consumoMedio(o))} kWh por mês`, `Desses ${n(C.consumoMedio(o))} kWh, ${n(consumoZerar)} kWh dá para zerar. Os outros ${op.dim.disponibilidade} kWh são a taxa mínima que a CPFL cobra de todo mundo, mesmo de quem tem energia solar. A conta mostra a média do ano, com dias de sol e de chuva.`, `<div class="trilho" style="margin-top:10px"><i style="width:${Math.min(op.dim.geracaoMes / Math.max(consumoZerar, 1), 1) * 100}%;background:var(--bom)"></i></div><p class="mini-p" style="text-align:left">${n(Math.min(op.dim.geracaoMes / Math.max(consumoZerar, 1), 1) * 100)}% do que dá para zerar</p>`)}
        ${item('ferramenta', 'Instalação, projeto e papelada da CPFL', 'Tudo incluído no preço', 'Fazemos a visita técnica, o projeto, a aprovação na CPFL, a instalação e a troca do medidor. Você não precisa ir a lugar nenhum.')}
      </div>
      <div class="preco-sis"><span>Investimento</span><b>${brl(op.preco.precoFinal)}</b></div>
      <details class="outras"><summary>Ver a outra opção (microinversor)</summary>
        ${a.opcoes.map((x, i) => i === est.opcao ? '' : `<div class="op-mini"><span><b style="font-family:inherit">${esc(x.nivel)}</b></span><b>${brl(x.preco.precoFinal)}</b><p>${esc(C.equipamentos(x).modulo)} + ${esc(C.equipamentos(x).inversor.replace(/^./, (c) => c.toLowerCase()))}. Gera ${n(x.dim.geracaoMes)} kWh/mês. ${esc(x.descricao)}</p><button type="button" data-op="${i}">Escolher esta opção</button></div>`).join('')}
      </details>`;

    const perguntas = [
      ['caro', 'É muito dinheiro para agora?'], ['taxacao', 'Ouvi falar que agora o sol é taxado. Ainda compensa?'],
      ['tecnologia', 'Não é melhor esperar a tecnologia melhorar?'], ['mudar', 'E se eu mudar de casa?'],
    ];
    $('#duvidas').innerHTML = perguntas.map(([id, q]) => `<details class="duvida" data-duvida="${id}"><summary>${q}</summary><p>${esc(A.resposta(id, a, o))}</p></details>`).join('') +
      `<details class="duvida" data-duvida="nublado"><summary>E em dia nublado ou à noite?</summary><p>À noite você usa a energia da CPFL normalmente. De dia, o que sobra vira crédito na sua conta. O cálculo já usa a média do ano inteiro, com os dias nublados.</p></details>
       <details class="duvida" data-duvida="manutencao"><summary>Dá trabalho para cuidar?</summary><p>Quase nenhum: uma limpeza por ano. E a gente acompanha a sua usina todo mês e te avisa se algo sair do normal.</p></details>`;
    decidir();
  }

  function decidir() {
    const op = a.op;
    if ((o.status === 'ganho' && o.aceite) || est.aceito) {
      $('#decidir').innerHTML = `<div class="sucesso"><div class="grande">☀️</div><h2>Recebemos o seu sim!</h2><p class="apoio">O ${esc(vend)} vai te ligar para combinar a visita técnica gratuita.</p></div>${passos()}`;
      return;
    }
    const msgFam = `Olha a proposta de energia solar que recebi. A conta de luz cai de ${brl(op.eco.contaAtual)} para ${brl(op.eco.contaDepois)} por mês. Me ajuda a decidir? ${link}`;
    $('#decidir').innerHTML = `
      <p class="apoio">Você escolheu: <b style="color:var(--tinta)">${esc(op.nivel)} · ${brl(op.preco.precoFinal)}</b>.<br>Não paga nada agora. O próximo passo é uma visita técnica gratuita.</p>
      <p style="font-weight:700;margin:0 0 8px">Qual o melhor horário para a visita?</p>
      <div class="opcoes-g" id="horarios">${['Manhã', 'Tarde', 'Sábado', 'Me liguem'].map((h) => `<button type="button" data-hr="${h}" aria-pressed="${est.hr === h}">${h}</button>`).join('')}</div>
      <button type="button" class="btn-g laranja" id="aceitar">Quero agendar a visita gratuita</button>
      <a class="btn-g verde" href="${zapVend()}" target="_blank" rel="noopener" id="zap">${Icone('conversa')} Conversar com o ${esc(vend)}</a>
      <a class="btn-g contorno" id="compartilhar" href="https://wa.me/?text=${encodeURIComponent(msgFam)}" target="_blank" rel="noopener">${Icone('pessoas')} Mandar para um familiar</a>
      ${window.Documentos ? `<button class="btn-g contorno" id="baixarPdf" type="button">${Icone('documento')} Baixar em PDF</button>` : ''}
      <p class="mini-p">Preço do material garantido até ${validade.toLocaleDateString('pt-BR')}.</p>
      ${passos()}`;
  }
  const passos = () => `<ol class="passos">
      <li><div><b>Visita técnica gratuita</b><span>Olhamos o telhado e a entrada de energia.</span></div></li>
      <li><div><b>Projeto e aprovação na CPFL</b><span>A gente cuida de toda a papelada.</span></div></li>
      <li><div><b>Instalação</b><span>Normalmente em 1 ou 2 dias.</span></div></li>
      <li><div><b>Usina ligada</b><span>Todo mês você recebe um resumo da sua economia.</span></div></li></ol>`;

  /* ---------- Interações ---------- */
  raiz.addEventListener('click', (ev) => {
    const t = ev.target.closest('[data-prazo],[data-op],[data-hr],#aceitar,#compartilhar,#baixarPdf,#zap,#zap-fixo,#letra,#ouvir');
    if (!t) return;
    if (t.dataset.prazo !== undefined) { est.prazo = +t.dataset.prazo; registrar('simulou', { prazo: est.prazo }); desenhar(); }
    else if (t.dataset.op !== undefined) { est.opcao = +t.dataset.op; registrar('escolheu', { opcao: est.opcao }); desenhar(); $('#t-sis').scrollIntoView({ behavior: 'smooth' }); }
    else if (t.dataset.hr) { est.hr = t.dataset.hr; document.querySelectorAll('[data-hr]').forEach((b) => b.setAttribute('aria-pressed', b === t)); }
    else if (t.id === 'zap' || t.id === 'zap-fixo') registrar('whatsapp', {});
    else if (t.id === 'compartilhar') registrar('compartilhou', { para: 'familiar' });
    else if (t.id === 'baixarPdf') { registrar('viu', { secao: 'pdf' }); Documentos.proposta({ ...o, opcaoEscolhida: est.opcao }, p, location.href.replace(/&v=1/, '')); }
    else if (t.id === 'letra') { const on = document.documentElement.classList.toggle('maior'); t.setAttribute('aria-pressed', on); try { localStorage.setItem('sol2_letra', on ? '1' : ''); } catch { /* */ } }
    else if (t.id === 'ouvir') falar(t);
    else if (t.id === 'aceitar') {
      const dados = { opcao: est.opcao, nivel: a.op.nivel, preco: a.op.preco.precoFinal, prazo: est.prazo, horario: est.hr || 'a combinar' };
      if (!vendedor) { B.evento(o.token, 'aceite', dados); Object.assign(o, B.porToken(o.token)); }
      est.aceito = true; decidir(); $('#s-decidir').scrollIntoView({ behavior: 'smooth' });
    }
  });
  $('#sistema').addEventListener('toggle', (ev) => { if (ev.target.open && ev.target.classList.contains('item')) registrar('viu', { secao: 'item:' + ev.target.querySelector('b').textContent.slice(0, 30) }); }, true);
  $('#duvidas').addEventListener('toggle', (ev) => { if (ev.target.open) registrar('duvida', { tema: ev.target.dataset.duvida }); }, true);

  /* ---------- Ouvir a proposta (voz do próprio aparelho) ---------- */
  function falar(botao) {
    const voz = window.speechSynthesis;
    if (!voz) { botao.innerHTML = `${Icone('som')} <span>Indisponível</span>`; return; }
    if (voz.speaking) { voz.cancel(); botao.innerHTML = `${Icone('som')} <span>Ouvir</span>`; botao.setAttribute('aria-pressed', 'false'); return; }
    const op = a.op, b = C.boleto(op, p, est.prazo);
    const texto = `Olá ${nomeCurto}. Aqui é a Chama Solar. Hoje você paga, em média, ${n(op.eco.contaAtual)} reais de luz por mês. ` +
      `No último ano foram ${n(a.raioX.pago12)} reais. Com energia solar, a sua conta cai para cerca de ${n(op.eco.contaDepois)} reais por mês. ` +
      (b.parcela ? `Parcelando em ${b.prazo} vezes, a parcela fica em ${n(b.parcela)} reais. Somando a conta mínima, dá ${n(b.totalMes)} reais por mês. ` : '') +
      `Depois de pago, sobram cerca de ${n(op.eco.contaAtual - op.eco.contaDepois)} reais todo mês no seu bolso. ` +
      `O próximo passo é uma visita técnica gratuita. Se tiver qualquer dúvida, fale com o ${vend} pelo WhatsApp.`;
    const u = new SpeechSynthesisUtterance(texto); u.lang = 'pt-BR'; u.rate = 0.92;
    const pt = voz.getVoices().find((x) => /pt(-|_)BR/i.test(x.lang)); if (pt) u.voice = pt;
    u.onend = () => { botao.innerHTML = `${Icone('som')} <span>Ouvir</span>`; botao.setAttribute('aria-pressed', 'false'); };
    voz.speak(u); botao.innerHTML = '<span>■ Parar</span>'; botao.setAttribute('aria-pressed', 'true');
    registrar('viu', { secao: 'ouviu' });
  }

  try { if (localStorage.getItem('sol2_letra')) { document.documentElement.classList.add('maior'); $('#letra').setAttribute('aria-pressed', 'true'); } } catch { /* */ }

  /* ---------- Rastreamento de leitura ---------- */
  registrar('abriu', {});
  const vistas = new Set();
  const obs = new IntersectionObserver((ents) => ents.forEach((e) => {
    const s = e.target.dataset.secao;
    if (e.isIntersecting && !vistas.has(s)) { vistas.add(s); registrar('viu', { secao: s }); }
  }), { threshold: 0.45 });
  document.querySelectorAll('[data-secao]').forEach((s) => obs.observe(s));
  new IntersectionObserver(([e]) => $('#cta').classList.toggle('some', e.isIntersecting), { threshold: 0.15 }).observe($('#s-decidir'));

  desenhar();
})();
