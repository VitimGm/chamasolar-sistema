/* =====================================================================
   Chama Solar — CENTRAL DE VENDAS (teste, banco simulado)
   Rotas: #painel · #novo · #lead-ORC-0001 · #agentes · #parametros
   ===================================================================== */
(function () {
  'use strict';
  const B = window.Banco, C = window.Conversao, D = window.DadosTeste, M = window.Motor, A = window.Agentes;
  const $ = (s, r = document) => r.querySelector(s);
  const app = $('#app');
  const brl = (v, c = 0) => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: c, maximumFractionDigits: c });
  const n = (v, c = 0) => C.fmt(v, c);
  const pct = (v, c = 1) => n(v * 100, c) + '%';
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const STATUS = [['novo', 'Novo lead'], ['proposta', 'Proposta enviada'], ['visualizou', 'Cliente viu'], ['negociando', 'Negociando'], ['ganho', 'Fechado'], ['perdido', 'Perdido']];
  const NOME_SEMAFORO = { verde: 'Dentro do mercado', amarelo: 'Acima da média', vermelho: 'Caro para o mercado', neutro: 'Com bateria' };
  const SECOES = { resumo: 'resumo em 3 números', conta: 'conta do último ano', espera: 'custo de esperar', pagamento: 'como fica o pagamento', sistema: 'o que vamos instalar', vizinhos: 'clientes vizinhos', duvidas: 'dúvidas', decidir: 'próximo passo', ouviu: 'ouviu a proposta em áudio', dor: 'conta do último ano', boleto: 'como fica o pagamento', opcoes: 'o que vamos instalar' };

  B.semear();
  const P = () => B.parametros();
  const linkProposta = (o, vendedor) => new URL(`proposta.html?t=${o.token}${vendedor ? '&v=1' : ''}`, location.href).href;
  const tempoRel = (iso) => {
    if (!iso) return '—';
    const m = (Date.now() - new Date(iso)) / 6e4;
    if (m < 1) return 'agora'; if (m < 60) return `há ${Math.round(m)} min`;
    if (m < 1440) return `há ${Math.round(m / 60)} h`; return `há ${Math.round(m / 1440)} d`;
  };
  const rotuloEvento = (e) => ({
    abriu: '👀 Abriu a proposta', viu: `📖 Leu: ${SECOES[e.dados?.secao] || e.dados?.secao}`, simulou: `💳 Simulou ${e.dados?.prazo ? e.dados.prazo + 'x' : 'à vista'}${e.dados?.entrada ? ` com ${e.dados.entrada}% de entrada` : ''}`,
    escolheu: `👆 Olhou outra opção de kit`, compartilhou: '👥 Mostrou para outra pessoa', whatsapp: '💬 Clicou para falar com você',
    duvida: `❓ Abriu a dúvida "${e.dados?.tema}"`, aceite: '✅ ACEITOU a proposta',
  }[e.tipo] || e.tipo);
  function toast(t) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 2300); }
  async function copiar(t) { try { await navigator.clipboard.writeText(t); toast('Copiado'); } catch { toast('Não deu para copiar'); } }
  const cabCelular = () => `<div class="topo-celular"><img src="marca/logo-branco.webp" alt="Chama Solar" width="80" height="34"></div>`;

  /* ======================= PAINEL ======================= */
  function painel() {
    const lista = B.orcamentos(), p = P();
    const evDe = (t) => B.eventos(t);
    const info = lista.map((o) => {
      const ev = evDe(o.token), a = C.analisar(o, p);
      return { o, ev, a, t: C.temperatura(o, ev), acao: C.proximaAcao(o, ev) };
    });
    const ativos = info.filter((x) => !['ganho', 'perdido'].includes(x.o.status));
    const f = C.funil(lista, evDe);
    const enviados = info.filter((x) => x.o.status !== 'novo');
    const abertas = enviados.filter((x) => x.ev.some((e) => e.tipo === 'abriu')).length;
    const h = new Date().getHours();
    const fazer = ativos.concat(info.filter((x) => x.o.status === 'ganho')).sort((a, b) => b.acao.prioridade - a.acao.prioridade || b.t.pontos - a.t.pontos).slice(0, 5);
    app.innerHTML = `${cabCelular()}
      <div class="cab entra"><div><h1>${h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'}, ${esc(D.empresa.vendedor)}.</h1>
        <p class="sutil">${f.quentes ? `<b style="color:var(--sol)">${f.quentes} cliente(s) quente(s)</b> agora. Comece por ele(s).` : 'Nenhum cliente quente agora. Bom momento para follow-up.'}</p></div>
        <a class="btn sol" href="#novo">＋ Novo orçamento</a></div>
      <div class="kpis entra">
        <div class="kpi destaque"><span class="rotulo">Em negociação</span><b>${brl(ativos.reduce((s, x) => s + x.a.op.preco.precoFinal, 0))}</b><span class="sutil">${ativos.length} proposta(s) ativa(s)</span></div>
        <div class="kpi"><span class="rotulo">Quentes agora</span><b>${f.quentes}</b><span class="sutil">mexendo na proposta</span></div>
        <div class="kpi"><span class="rotulo">Propostas abertas</span><b>${enviados.length ? pct(abertas / enviados.length, 0) : '—'}</b><span class="sutil">${abertas} de ${enviados.length} enviadas</span></div>
        <div class="kpi"><span class="rotulo">Fechamento</span><b>${pct(f.taxa, 0)}</b><span class="sutil">${f.fechados} ganho(s) · ${f.perdidos} perdido(s) · Groner: 5,7%</span></div>
      </div>
      <div class="secao-t"><h2>Fazer agora</h2><span class="sutil">ordenado pelo que mais aproxima do fechamento</span></div>
      <div class="agora">${fazer.map((x) => `
        <a class="acao p${x.acao.prioridade} entra" href="#lead-${x.o.id}"><div class="ic">${x.acao.icone}</div>
          <div><b>${esc(x.o.nome)} <span class="temp ${x.t.nivel}">${x.t.rotulo}</span></b><p>${esc(x.acao.texto)}</p></div>
          <span class="sutil">›</span></a>`).join('')}</div>
      <div class="secao-t"><h2>Funil</h2><span class="sutil">arraste para o lado no celular</span></div>
      <div class="funil">${STATUS.map(([s, rot]) => {
        const col = info.filter((x) => x.o.status === s).sort((a, b) => b.t.pontos - a.t.pontos);
        return `<div class="coluna-f"><h3>${rot}<em>${col.length}</em></h3>${col.map((x) => `
          <a class="cartao-l" href="#lead-${x.o.id}"><b>${esc(x.o.nome)}</b>
            <div class="entre"><span class="valor">${brl(x.a.op.preco.precoFinal)}</span><span class="temp ${x.t.nivel}">${x.t.nivel === 'quente' ? '🔥 ' : ''}${x.t.rotulo}</span></div>
            <div class="rodape"><span>${esc(x.o.cidade)} · ${n(x.a.op.dim.kwpReal, 1)} kWp</span><span>${x.ev.length ? tempoRel(x.ev[x.ev.length - 1].em) : tempoRel(x.o.criadoEm)}</span></div></a>`).join('') || '<p class="mini" style="padding:6px">vazio</p>'}</div>`;
      }).join('')}</div>`;
  }

  /* ======================= FICHA DO LEAD ======================= */
  let agenteAtual = 'diagnostico', entradaAgente = { texto: '', conc: {} };
  function ficha(id) {
    const o = B.obter(id);
    if (!o) { app.innerHTML = '<p>Orçamento não encontrado.</p>'; return; }
    const p = P(), ev = B.eventos(o.token), a = C.analisar(o, p), t = C.temperatura(o, ev), acao = C.proximaAcao(o, ev);
    const cor = { quente: 'var(--laranja)', morno: 'var(--amarelo)', frio: '#7a9dff', ganho: 'var(--verde-claro)', perdido: 'var(--texto-3)' }[t.nivel];
    const link = linkProposta(o);
    const msgZap = A.lista[1].fn({ o, a, link }).blocos[0].texto;
    app.innerHTML = `${cabCelular()}
      <a href="#painel" class="sutil" style="text-decoration:none">‹ Painel</a>
      <div class="painel entra" style="margin-top:10px">
        <div class="ficha-topo">
          <div class="anel" style="--p:${t.pontos};--cor:${cor}"><span>${t.pontos}<small>${t.rotulo.toUpperCase()}</small></span></div>
          <div><h1 style="font-size:clamp(22px,4vw,30px);margin:0">${esc(o.nome)}</h1>
            <div class="sutil">${esc(o.id)} · ${esc(o.cidade)} · origem ${esc(o.origem || '—')} · criado ${tempoRel(o.criadoEm)}</div>
            <div class="linha-h" style="margin-top:8px"><select id="status" style="width:auto;padding:7px 10px;font-size:14px">${STATUS.map(([s, r]) => `<option value="${s}" ${o.status === s ? 'selected' : ''}>${r}</option>`).join('')}</select>
            ${o.status === 'perdido' ? `<input type="text" id="motivo" placeholder="Motivo da perda" value="${esc(o.motivoPerda)}" style="flex:1;min-width:180px;padding:7px 10px;font-size:14px">` : ''}</div></div>
        </div>
        <div class="proxima" style="margin-top:14px"><div class="ic">${acao.icone}</div><div><span class="rotulo" style="color:var(--sol)">Próxima melhor ação</span><div style="font-weight:600;margin-top:4px">${esc(acao.texto)}</div></div></div>
        <div class="acoes-r" style="margin-top:14px">
          <a class="btn sol pequeno" href="${linkProposta(o, true)}" id="abrirPV">Abrir Proposta Viva</a>
          <a class="btn zap pequeno" href="https://wa.me/55${String(o.whatsapp).replace(/\D/g, '')}?text=${encodeURIComponent(msgZap)}" target="_blank" rel="noopener" id="enviarZap">Enviar no WhatsApp</a>
          <button class="btn vidro pequeno" id="copiarLink">Copiar link</button>
          <button class="btn vidro pequeno" id="editar">Editar orçamento</button>
        </div>
      </div>
      <div class="ficha" style="margin-top:14px">
        <div>
          <div class="painel">
            <span class="rotulo">Raio-x do cliente</span>
            <p style="margin:8px 0 12px;font-weight:600">${esc(a.perfil.principal.titulo)} — <span class="sutil" style="font-size:14px">${esc(a.perfil.principal.texto)}</span></p>
            <div class="numeros4">
              <div><span>Pagou em 12 meses</span><b>${brl(a.raioX.pago12)}</b></div>
              <div><span>Conta hoje → com solar</span><b>${brl(a.op.eco.contaAtual)} → ${brl(a.op.eco.contaDepois)}</b></div>
              <div><span>Proposta (${esc(a.op.nivel)})</span><b>${brl(a.op.preco.precoFinal)}</b></div>
              <div><span>Retorno · custo energia</span><b>${n(a.op.eco.paybackAnos, 1)} a · R$ ${n(a.energia.rsKwh, 2)}</b></div>
            </div>
          </div>
          <div class="painel">
            <span class="rotulo">O que o cliente fez na proposta</span>
            <ul class="tempo" style="margin-top:10px">${ev.length ? ev.slice().reverse().map((e) => `<li><span></span><span>${esc(rotuloEvento(e))}</span><em>${tempoRel(e.em)}</em></li>`).join('') : `<li><span></span><span class="sutil">${o.status === 'novo' ? 'Proposta ainda não enviada.' : 'Ainda não abriu. Se passar de 24 h, ligue.'}</span><em></em></li>`}</ul>
          </div>
        </div>
        <div class="painel brilha">
          <span class="rotulo">Agentes de conversão</span>
          <div class="abas" style="margin-top:12px">${A.lista.map((ag) => `<button class="aba ${agenteAtual === ag.id ? 'sel' : ''}" data-ag="${ag.id}">${ag.icone} ${ag.nome}</button>`).join('')}</div>
          <div id="saidaAgente"></div>
        </div>
      </div>`;

    function rodarAgente() {
      const ag = A.lista.find((x) => x.id === agenteAtual);
      let entradaHtml = '';
      if (ag.entrada === 'texto') entradaHtml = `<div class="entrada-ag"><input type="text" id="objTexto" placeholder='Cole o que o cliente disse. Ex.: "vou falar com minha esposa"' value="${esc(entradaAgente.texto)}"></div>`;
      if (ag.entrada === 'concorrente') {
        const c = entradaAgente.conc;
        entradaHtml = `<div class="entrada-ag grade g2">
          <label class="campo"><span>Preço do concorrente (R$)</span><input type="number" id="cPreco" value="${c.preco || ''}"></label>
          <label class="campo"><span>Potência (kWp)</span><input type="number" step="0.01" id="cKwp" value="${c.kwp || ''}"></label>
          <label class="campo"><span>Garantia inversor (anos)</span><input type="number" id="cGar" value="${c.garantiaInv || ''}"></label>
          <label class="alternar" style="align-self:end"><span>Homologação inclusa?</span><input type="checkbox" id="cHom" ${c.homologacao ? 'checked' : ''}></label></div>`;
      }
      // campos e resposta ficam separados: digitar nunca apaga o que já foi digitado
      $('#saidaAgente').innerHTML = `<p class="sutil" style="margin:0 0 12px">${esc(ag.missao)}</p>${entradaHtml}<div id="respAgente"></div>`;
      const responder = () => { $('#respAgente').innerHTML = blocos(ag.fn({ o, a, eventos: ev, link, texto: entradaAgente.texto, conc: entradaAgente.conc }), o); };
      const lerConc = () => { entradaAgente.conc = { preco: +$('#cPreco').value, kwp: +$('#cKwp').value, garantiaInv: +$('#cGar').value, homologacao: $('#cHom').checked }; responder(); };
      const obj = $('#objTexto');
      if (obj) obj.addEventListener('input', () => { entradaAgente.texto = obj.value; clearTimeout(rodarAgente.t); rodarAgente.t = setTimeout(responder, 350); });
      ['#cPreco', '#cKwp', '#cGar', '#cHom'].forEach((s) => { const el = $(s); if (el) el.addEventListener(s === '#cHom' ? 'change' : 'input', lerConc); });
      responder();
    }
    app.querySelectorAll('[data-ag]').forEach((b) => b.onclick = () => { agenteAtual = b.dataset.ag; app.querySelectorAll('[data-ag]').forEach((x) => x.classList.toggle('sel', x === b)); rodarAgente(); });
    rodarAgente();
    $('#copiarLink').onclick = () => copiar(link);
    $('#abrirPV').onclick = () => { try { sessionStorage.setItem('sol2_abrir', JSON.stringify({ t: o.token, v: 1 })); } catch { /* sem armazenamento */ } };
    $('#enviarZap').onclick = () => { if (o.status === 'novo') { o.status = 'proposta'; o.enviadoEm = new Date().toISOString(); B.salvar(o); } B.interacao(o.id, 'whatsapp', 'Proposta enviada'); };
    $('#editar').onclick = () => { B.rascunho.gravar(o); B.rascunho.gravarEtapa(0); location.hash = '#novo'; };
    $('#status').onchange = (e) => { o.status = e.target.value; if (o.status !== 'novo' && !o.enviadoEm) o.enviadoEm = new Date().toISOString(); B.salvar(o); ficha(id); };
    const mot = $('#motivo'); if (mot) mot.onchange = (e) => { o.motivoPerda = e.target.value; B.salvar(o); toast('Motivo salvo'); };
  }

  let ultimaSaida = null;
  app.addEventListener('click', (e) => { const b = e.target.closest('[data-copiar]'); if (b && ultimaSaida) copiar(ultimaSaida.blocos[+b.dataset.copiar].texto); });
  function blocos(s, o) {
    ultimaSaida = s;
    const zap = (t) => o ? `https://wa.me/55${String(o.whatsapp).replace(/\D/g, '')}?text=${encodeURIComponent(t)}` : '#';
    return `<div class="saida"><h3>${esc(s.titulo)}</h3><p class="resumo">${esc(s.resumo)}</p>${(s.blocos || []).map((b, i) => {
      if (b.tipo === 'lista') return `<div class="bloco"><h4>${esc(b.titulo)}</h4><ul>${b.itens.map((x) => `<li><b>${esc(x.t)}</b>${x.d ? `<span>${esc(x.d)}</span>` : ''}</li>`).join('')}</ul></div>`;
      if (b.tipo === 'copiar') return `<div class="bloco"><h4>${esc(b.titulo)}</h4><pre>${esc(b.texto)}</pre><div class="acoes-r"><button class="btn vidro pequeno" data-copiar="${i}">Copiar</button>${o ? `<a class="btn zap pequeno" target="_blank" rel="noopener" href="${zap(b.texto)}">Abrir no WhatsApp</a>` : ''}</div></div>`;
      if (b.tipo === 'alerta') return `<div class="bloco alerta">⚠ ${esc(b.texto)}</div>`;
      if (b.tipo === 'cadencia') return `<div class="bloco"><h4>Cadência</h4>${b.itens.map((c) => `<div class="cad"><div class="d">D+${c.d}<small>${esc(c.data || '')}</small></div><div><b>${esc(c.canal)} · ${esc(c.t)}</b><p>${esc(c.msg)}</p></div></div>`).join('')}</div>`;
      if (b.tipo === 'tabela') return `<div class="bloco"><table><tr>${b.cab.map((h, j) => `<th class="${j ? 'v' : ''}">${esc(h)}</th>`).join('')}</tr>${b.linhas.map((l) => `<tr>${l.map((c, j) => `<td class="${j ? 'v' : ''}">${esc(c)}</td>`).join('')}</tr>`).join('')}</table></div>`;
      return '';
    }).join('')}</div>`;
  }

  /* ======================= AGENTES (visão geral) ======================= */
  function agentesPag() {
    const lista = B.orcamentos();
    const an = A.analista({ lista, eventosDe: (t) => B.eventos(t) });
    app.innerHTML = `${cabCelular()}<div class="cab"><div><h1>Agentes de conversão</h1><p class="sutil">Cada agente trabalha dentro da ficha do cliente, com os números dele. Aqui está a visão do funil inteiro.</p></div></div>
      <div class="painel brilha">${blocos(an, null)}</div>
      <div class="secao-t"><h2>A equipe</h2><span class="sutil">no teste respondem por regras; no oficial, com IA (fontes/solar-agentes)</span></div>
      <div class="grade-ag">${A.lista.map((ag) => `<div class="cartao-ag"><div class="ic">${ag.icone}</div><h3>${ag.nome}</h3><p class="sutil" style="margin:0">${ag.missao}</p></div>`).join('')}
        <div class="cartao-ag"><div class="ic">📊</div><h3>Analista de Funil</h3><p class="sutil" style="margin:0">Lê o funil inteiro, aponta gargalos e motivos de perda.</p></div></div>`;
  }

  /* ======================= NOVO ORÇAMENTO (6 passos) ======================= */
  const novoOrc = () => ({ nome: '', whatsapp: '', cep: '', cidade: '', distanciaKm: 0, ligacao: 'bi', consumos: Array(12).fill(''), tarifaKwh: P().tarifaKwh, lidoPorIA: false, modo: 'pdf', telhado: 'ceramico', orientacao: '?', areaDisponivel: '', trocaPadrao: false, opcaoEscolhida: 1, formaPagamento: 'financiamento', comissaoParceria: 0, kitFaturadoDireto: false, descontoPct: 0, origem: 'WhatsApp', status: 'novo' });
  let orc = B.rascunho.ler() || novoOrc();
  let etapa = B.rascunho.etapa();
  const salvarR = () => { B.rascunho.gravar(orc); B.rascunho.gravarEtapa(etapa); };
  const ETAPAS = [
    ['Cliente e conta', passo1, () => (orc.nome.trim() && C.consumoMedio(orc) > 0 && orc.cidade) ? '' : 'Preencha nome, CEP e o consumo.'],
    ['Local e telhado', passo2, () => ''], ['Dimensionamento', passo3, () => ''], ['Kit Belenergy', passo4, () => (orc.kitsFechados && orc.kitsFechados[0]) ? '' : 'Monte o kit da opção Inversor para continuar.'],
    ['Preço e pagamento', passo5, () => ''], ['Proposta Viva', passo6, () => ''],
  ];
  function novo() {
    document.body.classList.add('com-barra'); $('#barra').hidden = false;
    app.innerHTML = `${cabCelular()}<div class="cab"><div><span class="rotulo" style="color:var(--sol)">Passo ${etapa + 1} de 6</span><h1>${ETAPAS[etapa][0]}</h1></div>${orc.id ? `<span class="sutil">editando ${esc(orc.id)}</span>` : ''}</div>
      <div class="etapas">${ETAPAS.map((e, i) => `<button class="etapa ${i < etapa ? 'feita' : ''} ${i === etapa ? 'atual' : ''}" data-ir="${i}" ${i > etapa ? 'disabled' : ''}><i></i><span class="t">${e[0]}</span></button>`).join('')}</div>
      <div id="corpo" class="entra"></div>`;
    app.querySelectorAll('[data-ir]').forEach((b) => b.onclick = () => { etapa = +b.dataset.ir; salvarR(); novo(); });
    ETAPAS[etapa][1]($('#corpo'));
    barra();
  }
  function barra() {
    $('#btnVoltar').style.visibility = etapa ? 'visible' : 'hidden';
    $('#btnAvancar').textContent = etapa === 5 ? (orc.id ? 'Salvar e abrir ficha' : 'Gerar Proposta Viva') : 'Continuar';
    const r = $('#barraResumo');
    if (C.consumoMedio(orc) > 0 && orc.cidade && etapa >= 2) { const ops0 = C.opcoes(orc, P()); const op = ops0[C.indiceOpcao(orc, ops0)]; r.innerHTML = `<b>${brl(op.preco.precoFinal)}</b>${op.nivel} · ${n(op.dim.kwpReal, 2)} kWp`; }
    else r.innerHTML = C.consumoMedio(orc) ? `<b>${n(C.consumoMedio(orc))} kWh/mês</b>${esc(orc.nome)}` : '';
  }
  $('#btnVoltar').onclick = () => { if (etapa) { etapa--; salvarR(); novo(); scrollTo(0, 0); } };
  $('#btnAvancar').onclick = () => {
    const erro = ETAPAS[etapa][2](); if (erro) return toast(erro);
    if (etapa < 5) { etapa++; salvarR(); novo(); scrollTo(0, 0); return; }
    const novoLead = !orc.id;
    if (novoLead) { orc.status = 'proposta'; orc.enviadoEm = new Date().toISOString(); }
    const salvo = B.salvar(orc);
    orc = novoOrc(); etapa = 0; salvarR();
    toast(novoLead ? 'Proposta Viva criada' : 'Orçamento atualizado');
    location.hash = '#lead-' + salvo.id;
  };

  const MODOS = [['pdf', '📄', 'Anexar conta (PDF)'], ['meses', '✏️', 'Digitar 12 meses'], ['media', '≈', 'Só a média'], ['geracao', '☀️', 'Geração desejada']];
  function passo1(el) {
    const media = C.consumoMedio(orc), modo = orc.modo || 'pdf', disp = M.DISPONIBILIDADE[orc.ligacao] ?? 50;
    const unico = orc.consumos.every((x) => x === orc.consumos[0]) && orc.consumos[0] !== '';
    const blocoModo = {
      pdf: `<label class="ia-caixa" id="soltar" for="f-pdf" style="display:block;cursor:pointer">
          <b style="font-size:16px;color:var(--texto)">📄 Toque para anexar a conta da CPFL em PDF</b><br>ou arraste o arquivo aqui · lemos nome, CEP, ligação, 12 meses e tarifa
          <input type="file" id="f-pdf" accept="application/pdf,.pdf" hidden></label>
        <div id="pdf-status">${orc.leitura ? `<div class="aviso ok">✓ Conta lida: ${esc(orc.leitura)}</div>` : ''}</div>
        <div class="mini" style="margin-top:8px">Sem PDF à mão? Teste com: ${D.contasExemplo.map((c, i) => `<button class="link" data-conta="${i}">${esc(c.nome)}</button>`).join(' · ')}</div>`,
      meses: '<p class="mini" style="margin:0">Preencha os meses ao lado, como estão no histórico da conta.</p>',
      media: `<label class="campo"><span>Consumo médio do cliente (kWh por mês)</span><input type="number" id="f-media" placeholder="ex.: 500" value="${unico ? orc.consumos[0] : ''}" inputmode="numeric"></label>
        <p class="mini" style="margin:6px 0 0">Usado nos 12 meses. A proposta mostra o mesmo valor todo mês.</p>`,
      geracao: `<label class="campo"><span>Geração desejada (kWh por mês)</span><input type="number" id="f-ger" placeholder="ex.: 500" value="${unico ? Math.max(+orc.consumos[0] - disp, 0) : ''}" inputmode="numeric"></label>
        <p class="mini" style="margin:6px 0 0">O sistema é dimensionado para gerar isso. Somamos a taxa mínima da ligação (${disp} kWh) para montar o consumo.</p>`,
    }[modo];
    el.innerHTML = `<div class="lado"><div>
      <div class="painel brilha"><span class="rotulo" style="color:var(--sol)">Como você tem o consumo?</span>
        <div class="chips" style="margin:12px 0">${MODOS.map(([v, ic, t]) => `<button class="chip ${modo === v ? 'sel' : ''}" data-modo="${v}">${ic} ${t}</button>`).join('')}</div>
        ${blocoModo}</div>
      <div class="painel grade">
        <label class="campo"><span>Nome do cliente</span><input type="text" id="f-nome" value="${esc(orc.nome)}"></label>
        <div class="grade g2"><label class="campo"><span>WhatsApp</span><input type="tel" id="f-zap" value="${esc(orc.whatsapp)}"></label>
        <label class="campo"><span>CEP da obra</span><input type="text" id="f-cep" value="${esc(orc.cep)}" inputmode="numeric"></label></div>
        <div class="mini" id="cep-info">${orc.cidade ? `📍 ${esc(orc.cidade)} · ${orc.distanciaKm} km da base` : 'Teste: CEPs 140/141 (Ribeirão), 1416 (Sertãozinho), 144 (Franca)'}</div>
        <div class="campo"><span>Origem do lead</span><div class="chips">${['WhatsApp', 'Instagram', 'Indicação', 'Site', 'Google', 'Parceiro'].map((x) => `<button class="chip ${orc.origem === x ? 'sel' : ''}" data-orig="${x}">${x}</button>`).join('')}</div></div>
        <div class="campo"><span>Tipo de ligação</span><div class="chips">${[['mono', 'Monofásica', '30 kWh'], ['bi', 'Bifásica', '50 kWh'], ['tri', 'Trifásica', '100 kWh']].map(([v, t, d]) => `<button class="chip ${orc.ligacao === v ? 'sel' : ''}" data-lig="${v}">${t}<small>${d}</small></button>`).join('')}</div></div>
      </div></div>
      <div class="painel"><span class="rotulo">Consumo dos últimos 12 meses (kWh)</span>
        <div class="meses" style="margin-top:12px">${MESES.map((m, i) => `<label>${m}<input type="number" min="0" data-mes="${i}" value="${orc.consumos[i]}"></label>`).join('')}</div>
        <div class="numeros4" style="margin-top:12px"><div><span>Média</span><b id="media">${n(media)} kWh</b></div><div><span>Tarifa (R$/kWh)</span><b><input type="number" step="0.01" id="f-tar" value="${orc.tarifaKwh}" style="padding:4px 8px;font-size:17px"></b></div>
        <div style="grid-column:1/-1"><span>Pagou nos últimos 12 meses (estimado)</span><b id="pago" class="grad">${brl(media * 12 * orc.tarifaKwh)}</b></div></div>
        ${orc.avisosLeitura ? orc.avisosLeitura.map((a) => `<div class="aviso">${esc(a)}</div>`).join('') : ''}</div></div>`;
    const atual = () => { const m = C.consumoMedio(orc); $('#media').textContent = n(m) + ' kWh'; $('#pago').textContent = brl(orc.consumos.map(Number).filter(Boolean).reduce((s, x) => s + x, 0) * orc.tarifaKwh); salvarR(); barra(); };
    const preencher = (v) => { orc.consumos = Array(12).fill(v > 0 ? Math.round(v) : ''); el.querySelectorAll('[data-mes]').forEach((i) => { i.value = orc.consumos[+i.dataset.mes]; }); atual(); };
    $('#f-nome').oninput = (e) => { orc.nome = e.target.value; salvarR(); barra(); };
    $('#f-zap').oninput = (e) => { orc.whatsapp = e.target.value; salvarR(); };
    $('#f-cep').oninput = (e) => { orc.cep = e.target.value; const c = B.cepInfo(orc.cep); orc.cidade = c?.cidade || ''; orc.distanciaKm = c?.km || 0; $('#cep-info').textContent = c ? `📍 ${c.cidade} · ${c.km} km da base` : 'CEP fora da tabela de teste'; salvarR(); };
    $('#f-tar').oninput = (e) => { orc.tarifaKwh = +e.target.value || 0; atual(); };
    el.querySelectorAll('[data-mes]').forEach((i) => i.oninput = () => { orc.consumos[+i.dataset.mes] = i.value; atual(); });
    el.querySelectorAll('[data-modo]').forEach((b) => b.onclick = () => { orc.modo = b.dataset.modo; salvarR(); novo(); });
    el.querySelectorAll('[data-lig]').forEach((b) => b.onclick = () => {
      const antes = M.DISPONIBILIDADE[orc.ligacao] ?? 50; orc.ligacao = b.dataset.lig;
      if (modo === 'geracao' && unico) orc.consumos = orc.consumos.map((x) => +x - antes + (M.DISPONIBILIDADE[orc.ligacao] ?? 50));
      salvarR(); novo();
    });
    el.querySelectorAll('[data-orig]').forEach((b) => b.onclick = () => { orc.origem = b.dataset.orig; salvarR(); novo(); });
    const fm = $('#f-media'); if (fm) fm.oninput = () => preencher(+fm.value);
    const fg = $('#f-ger'); if (fg) fg.oninput = () => preencher(+fg.value ? +fg.value + disp : 0);
    el.querySelectorAll('[data-conta]').forEach((b) => b.onclick = () => {
      const c = D.contasExemplo[+b.dataset.conta], cep = B.cepInfo(c.cep);
      Object.assign(orc, { nome: c.nome, whatsapp: c.whatsapp, cep: c.cep, ligacao: c.ligacao, consumos: [...c.consumos], tarifaKwh: c.tarifaKwh, cidade: cep.cidade, distanciaKm: cep.km, lidoPorIA: true, leitura: 'conta de exemplo', avisosLeitura: null });
      salvarR(); novo(); toast('Conta de exemplo carregada');
    });
    const arquivo = $('#f-pdf'), zona = $('#soltar');
    const lerPdf = async (f) => {
      if (!f) return;
      $('#pdf-status').innerHTML = '<div class="aviso">Lendo a conta…</div>';
      try {
        const r = await window.LeitorConta.lerArquivo(f);
        if (!r.ok && !r.mesesLidos) { $('#pdf-status').innerHTML = r.avisos.map((a) => `<div class="aviso ruim">${esc(a)}</div>`).join(''); return; }
        const cep = r.cep ? B.cepInfo(r.cep) : null;
        Object.assign(orc, {
          nome: r.nome || orc.nome, cep: r.cep || orc.cep, cidade: cep?.cidade || r.cidade || orc.cidade, distanciaKm: cep?.km ?? (orc.distanciaKm || 15),
          ligacao: r.ligacao || orc.ligacao, consumos: r.consumos.map((x, i) => x || orc.consumos[i] || ''), tarifaKwh: r.tarifaKwh || orc.tarifaKwh,
          instalacao: r.instalacao, lidoPorIA: true, avisosLeitura: r.avisos.length ? r.avisos : null,
          leitura: `${r.mesesLidos} meses${r.referencia ? `, ref. ${r.referencia}` : ''}${r.valorTotal ? `, conta de ${brl(r.valorTotal, 2)}` : ''}${r.classe ? ` · ${r.classe}` : ''}`,
        });
        salvarR(); novo(); toast('Conta lida');
      } catch (e) { $('#pdf-status').innerHTML = `<div class="aviso ruim">${esc(e.message || 'Não consegui ler este PDF.')}</div>`; }
    };
    if (arquivo) arquivo.onchange = () => lerPdf(arquivo.files[0]);
    if (zona) {
      zona.addEventListener('dragover', (e) => { e.preventDefault(); zona.style.borderColor = 'var(--laranja)'; });
      zona.addEventListener('dragleave', () => { zona.style.borderColor = ''; });
      zona.addEventListener('drop', (e) => { e.preventDefault(); zona.style.borderColor = ''; lerPdf(e.dataTransfer.files[0]); });
    }
  }

  function passo2(el) {
    const p = P(), hsp = (D.cidades[orc.cidade] || D.cidades['Ribeirão Preto']).hsp;
    el.innerHTML = `<div class="lado"><div class="painel grade">
      <div class="campo"><span>Tipo de telhado</span><div class="chips">${[['ceramico', 'Cerâmico'], ['fibrocimento', 'Fibrocimento'], ['metalico', 'Metálico'], ['laje', 'Laje'], ['solo', 'Solo']].map(([v, t]) => `<button class="chip ${orc.telhado === v ? 'sel' : ''}" data-tel="${v}">${t}<small>${brl(D.catalogo.estrutura[v])}/pl</small></button>`).join('')}</div></div>
      <div class="campo"><span>Orientação do telhado</span>
        <button class="chip ${!orc.orientacao || orc.orientacao === '?' ? 'sel' : ''}" data-ori="?" style="justify-self:start">A confirmar na visita técnica<small>perda de segurança ${n((p.perdaOrientacao ?? 0.07) * 100)}%</small></button>
        <details ${orc.orientacao && orc.orientacao !== '?' ? 'open' : ''}><summary class="mini" style="cursor:pointer">Já sei a orientação</summary>
          <div class="chips" style="margin-top:8px">${[['N', 'Norte', 'ideal'], ['NE', 'Nordeste', '−3%'], ['NO', 'Noroeste', '−3%'], ['L', 'Leste', '−12%'], ['O', 'Oeste', '−12%'], ['S', 'Sul', '−25%']].map(([v, t, d]) => `<button class="chip ${orc.orientacao === v ? 'sel' : ''}" data-ori="${v}">${t}<small>${d}</small></button>`).join('')}</div></details></div>
      <div class="grade g2"><label class="campo"><span>Área livre (m²)</span><input type="number" id="f-area" value="${esc(orc.areaDisponivel)}" placeholder="opcional"></label>
      <label class="campo"><span>Distância (km)</span><input type="number" id="f-km" value="${esc(orc.distanciaKm)}"></label></div>
      <label class="alternar"><span><b>Troca de padrão de entrada</b><br><span class="sutil">soma ${brl(p.trocaPadrao)}</span></span><input type="checkbox" id="f-pad" ${orc.trocaPadrao ? 'checked' : ''}></label></div>
      <div class="painel"><span class="rotulo">Sol no local</span><div class="numeros4" style="margin-top:12px">
        <div><span>${esc(orc.cidade || 'Ribeirão Preto')}</span><b>${n(hsp, 2)} HSP</b></div><div><span>${!orc.orientacao || orc.orientacao === '?' ? 'Com a perda de segurança' : 'Com a orientação'}</span><b>${n(hsp * (!orc.orientacao || orc.orientacao === '?' ? 1 - (p.perdaOrientacao ?? 0.07) : M.FATOR_ORIENTACAO[orc.orientacao]), 2)} HSP</b></div></div>
        <p class="mini" style="margin-top:10px">Irradiação de teste. No oficial vem da base pública pelo endereço. A perda de segurança cobre telhado leste/oeste até a visita técnica (ajustável em Parâmetros).</p></div></div>`;
    el.querySelectorAll('[data-tel]').forEach((b) => b.onclick = () => { orc.telhado = b.dataset.tel; salvarR(); novo(); });
    el.querySelectorAll('[data-ori]').forEach((b) => b.onclick = () => { orc.orientacao = b.dataset.ori; salvarR(); novo(); });
    $('#f-area').oninput = (e) => { orc.areaDisponivel = e.target.value; salvarR(); };
    $('#f-km').oninput = (e) => { orc.distanciaKm = e.target.value; salvarR(); };
    $('#f-pad').onchange = (e) => { orc.trocaPadrao = e.target.checked; salvarR(); };
  }

  function passo3(el) {
    const p = P(), op = C.opcoes({ ...orc, kitsFechados: null }, p)[1], d = op.dim;
    el.innerHTML = `<div class="kpis">
        <div class="kpi destaque"><span class="rotulo">Potência</span><b>${n(d.kwpReal, 2)} kWp</b></div>
        <div class="kpi"><span class="rotulo">Módulos</span><b>${d.placas} × ${op.modulo.potenciaW} W</b></div>
        <div class="kpi"><span class="rotulo">Geração</span><b>${n(d.geracaoMes)} kWh</b><span class="sutil">por mês</span></div>
        <div class="kpi"><span class="rotulo">Área</span><b>${n(op.areaM2, 1)} m²</b></div></div>
      ${!op.cabeNoTelhado ? `<div class="aviso ruim">Área necessária passa da área livre informada (${orc.areaDisponivel} m²).</div>` : ''}
      <div class="painel"><span class="rotulo">Como foi calculado</span>
        <p class="num" style="margin:10px 0">kWp = (${n(C.consumoMedio(orc))} − ${d.disponibilidade}) ÷ (${n(d.hspEfetivo, 2)} × 30 × ${n(p.pr, 3)}) = <b>${n(d.kwpNecessario, 2)} kWp</b></p>
        <table><tr><td>Inversor (${esc(op.nivel)})</td><td class="v">${esc(op.inversor.nome)}</td></tr>
        <tr><td>DC/AC (ideal ${n(p.faixaDcAc.min, 2)}–${n(p.faixaDcAc.max, 2)})</td><td class="v">${n(op.relacaoDcAc, 2)} ${op.dcAcOk ? '✓' : '⚠'}</td></tr>
        <tr><td>Strings</td><td class="v">${op.strings.strings} × ${op.strings.porString}</td></tr>
        <tr><td>Tensão no frio (${p.tempMinima} °C)</td><td class="v">${n(op.strings.vocFrio)} V / ${op.inversor.vMaxDc} V</td></tr></table>
        ${op.strings.avisos.map((x) => `<div class="aviso ruim">${esc(x)}</div>`).join('') || '<div class="aviso ok">✓ Strings dentro dos limites do inversor.</div>'}</div>`;
  }

  /* ---------- Passo 4: KIT FECHADO na Belenergy (mesmo caminho do portal) ---------- */
  const NIVEIS_KIT = ['Inversor', 'Microinversor', 'Premium'];
  const PRINCIPAL = 0; // a opção Inversor (string) é a principal e aparece em destaque
  const TIPO_POR_OPCAO = ['INVERSOR STRING ON-GRID', 'MICROINVERSOR', 'INVERSOR STRING HÍBRIDO'];
  const DICA_OPCAO = ['String on-grid: melhor preço por Wp. É a opção principal que o cliente vê em destaque.', 'Para telhado com sombra ou águas diferentes. Desliga placa por placa (mais seguro).', 'Híbrido com bateria ou equipamento de topo: energia mesmo quando a luz cai.'];
  let cot = null, cotSlot = 0, cotModo = null;
  function passo4(el) {
    const p = P();
    orc.kitsFechados = orc.kitsFechados || [null, null, null];
    if (cot) return assistente(el);
    const est = C.opcoes({ ...orc, kitsFechados: null }, p)[1];
    const kwpSug = Math.max(est.dim.kwpNecessario, 0.5);
    el.innerHTML = `
      <div class="painel brilha"><span class="rotulo" style="color:var(--sol)">Kit fechado Belenergy</span>
        <p style="margin:8px 0 4px">Monte cada opção no <b>Personalize seu Gerador</b>. O valor final do kit é o que entra no preço.</p>
        <p class="mini" id="cot-status">Verificando o robô no seu computador…</p></div>
      <div class="ops-v" style="margin-top:14px">${NIVEIS_KIT.map((nv, i) => { const k = orc.kitsFechados[i]; return `
        <div class="op-v ${k ? 'sel' : ''}" style="cursor:default">
          <span class="rotulo" style="color:var(--sol)">${i === PRINCIPAL ? 'Principal' : 'Opcional'}</span><h3 style="margin:4px 0">${nv}</h3>
          ${k ? `<div class="preco">${brl(k.valorKit, 2)}</div><span class="mini">valor do kit · ${k.origem === 'simulado' ? 'SIMULADO' : 'Belenergy ' + esc(k.numeroBelenergy)}</span>
            <ul><li><span>Módulos</span><span>${k.modulo.qtd} × ${esc(k.modulo.nome)}</span></li><li><span>Inversor</span><span>${esc(k.inversor.nome)}</span></li>
            <li><span>Estrutura</span><span>${k.estrutura.semEstrutura ? 'sem estrutura' : esc(k.estrutura.tipo)}</span></li><li><span>Frete</span><span>${esc(k.frete)}</span></li>
            <li><span>R$/Wp do kit</span><span>R$ ${n(k.valorKit / (k.modulo.qtd * k.modulo.potenciaW), 2)}</span></li></ul>
            <div class="acoes-r" style="margin-top:10px"><button class="btn vidro pequeno" data-montar="${i}">Refazer</button><button class="btn vidro pequeno" data-tirar="${i}">Remover</button></div>`
          : `<p class="sutil" style="margin:8px 0 12px">${DICA_OPCAO[i]}</p>
            <button class="btn ${i === PRINCIPAL ? 'sol' : 'vidro'} pequeno" data-montar="${i}">Montar kit · ${n(kwpSug, 2)} kWp</button>`}
        </div>`; }).join('')}</div>
      <p class="mini" style="margin-top:12px">Potência sugerida pelo pré-dimensionamento: <b>${n(kwpSug, 2)} kWp</b> (consumo que dá para zerar + ${n((p.margemGeracao || 0) * 100)}% de margem${!orc.orientacao || orc.orientacao === '?' ? ` + perda de segurança de ${n((p.perdaOrientacao ?? 0.07) * 100)}% da orientação` : ''}).</p>`;
    Cotador.conectado().then((ok) => { cotModo = ok ? 'conectado' : 'simulado'; const st = $('#cot-status'); if (st) st.innerHTML = ok ? '🟢 Robô conectado: a cotação é feita no site da Belenergy, com a sua sessão.' : '🟡 Robô não encontrado neste computador. Modo <b>simulado</b> (mesmas telas, valores de teste).'; });
    el.querySelectorAll('[data-montar]').forEach((b) => b.onclick = async () => {
      cotSlot = +b.dataset.montar; cot = Cotador.novaSessao(cotModo || 'simulado'); cot.escolhas.kwp = +kwpSug.toFixed(2); cot.escolhas.tipoInversor = TIPO_POR_OPCAO[cotSlot];
      cot.escolhas.ligacao = { mono: 'MONOFÁSICO', bi: 'BIFÁSICO', tri: 'TRIFÁSICO' }[orc.ligacao];
      cot.escolhas.estruturaTipo = { ceramico: 'Colonial', fibrocimento: 'Telha Fibrocimento', metalico: 'Telha Metálico', laje: 'Laje', solo: 'Solo' }[orc.telhado];
      cot.escolhas.nome = `${orc.id || 'NOVO'} ${orc.nome} ${NIVEIS_KIT[cotSlot]}`.trim();
      novo();
    });
    el.querySelectorAll('[data-tirar]').forEach((b) => b.onclick = () => { orc.kitsFechados[+b.dataset.tirar] = null; salvarR(); novo(); });
  }

  async function passoCot(entrada) {
    const alvo = $('#cot-corpo');
    let seg = 0, timer = null;
    if (alvo) {
      alvo.style.pointerEvents = 'none';
      alvo.insertAdjacentHTML('afterbegin', `<div class="aviso" id="cot-espera">${cot.modo === 'conectado' ? '⏳ O robô está trabalhando no site da Belenergy' : '⏳ Calculando'}… <b id="cot-seg">0 s</b></div>`);
      timer = setInterval(() => { seg++; const el = $('#cot-seg'); if (el) el.textContent = seg + ' s'; }, 1000);
    }
    try { await Cotador.avancar(cot, entrada); clearInterval(timer); novo(); }
    catch (e) {
      clearInterval(timer);
      if (alvo) {
        alvo.style.pointerEvents = '';
        $('#cot-espera').outerHTML = `<div class="aviso ruim"><b>Não deu certo:</b> ${esc(e.message)}<div class="acoes-r" style="margin-top:10px"><button class="btn vidro pequeno" id="c-tentar">Tentar de novo</button><button class="btn vidro pequeno" id="c-simular">Continuar no simulado</button></div></div>`;
        $('#c-tentar').onclick = () => passoCot(entrada);
        $('#c-simular').onclick = () => { const kwp = cot.escolhas.kwp, base = { ...cot.escolhas }; cot = Cotador.novaSessao('simulado'); Object.assign(cot.escolhas, { kwp, ligacao: base.ligacao, estruturaTipo: base.estruturaTipo, nome: base.nome }); cotModo = 'simulado'; novo(); };
      }
    }
  }

  function assistente(el) {
    const e = cot.escolhas, o = cot.opcoes, et = cot.etapa;
    const trilha = Cotador.ETAPAS.map((t, i) => `<span class="chip ${i === et ? 'sel' : ''}" style="cursor:default;${i < et ? 'opacity:.6' : ''}">${i < et ? '✓' : i + 1} ${t}</span>`).join('');
    const tabelaItens = (lista, dica) => `<p class="sutil">${dica}</p><div class="tabela-cat"><table><tr><th>Item</th><th class="v">Quantidade</th></tr>
      ${lista.map((c, i) => `<tr><td>${esc(c.nome)}<div class="desc mono">${esc(c.sku || '')}</div></td><td class="v"><div class="linha-h" style="justify-content:flex-end;gap:6px">
        <button class="btn vidro pequeno" data-menos="${i}" aria-label="Diminuir">−</button><input type="number" min="0" data-cq="${i}" value="${c.qtd}" style="width:70px;padding:6px;text-align:center">
        <button class="btn vidro pequeno" data-mais="${i}" aria-label="Aumentar">+</button></div></td></tr>`).join('')}</table></div>`;
    let corpo = '';
    if (et === 0) corpo = `<label class="campo"><span>Informe a potência do sistema (kWp)</span><input type="number" step="0.01" id="c-kwp" value="${e.kwp}"></label>
      <p class="mini">Vem do pré-dimensionamento. Pode ajustar.</p><button class="btn sol" id="c-ok" style="margin-top:12px">Avançar ›</button>`;
    else if (et === 1) corpo = `<p class="sutil">Ordem do portal: <b>Menor Preço Por Watt</b> (do mais barato ao mais caro). O portal não mostra o preço nesta etapa.</p>
      <div class="tabela-cat"><table><tr><th></th><th>Módulo</th><th class="v">Potência</th><th class="v">Qtd</th><th class="v">Sistema</th></tr>
      ${o.modulos.map((m, i) => `<tr><td><input type="radio" name="c-mod" value="${esc(m.sku)}" ${i === (o.modulos.findIndex((x) => /615W/.test(x.sku)) >= 0 ? o.modulos.findIndex((x) => /615W/.test(x.sku)) : 0) ? 'checked' : ''} class="marcar"></td><td><b>${esc(m.nome)}</b><div class="desc mono">${esc(m.sku)}</div></td>
        <td class="v">${m.potenciaW} W</td><td class="v"><input type="number" min="1" data-qtd="${esc(m.sku)}" value="${m.qtdSugerida}" style="width:64px;padding:6px"></td><td class="v">${n(m.kwp, 2)} kWp</td></tr>`).join('')}</table></div>
      <p class="mini" id="c-modaviso">Mínimo para cobrir o consumo: <b>${n(e.kwp, 2)} kWp</b>.</p>
      <button class="btn sol" id="c-ok" style="margin-top:12px">Próximo ›</button>`;
    else if (et === 2) {
      const sel = (id, lista, atual) => `<select id="${id}">${lista.map((x) => `<option ${x === atual ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>`;
      const tipo = e.tipoInversor || o.tipos[0], lig = e.ligacao && o.ligacoes.includes(e.ligacao) ? e.ligacao : o.ligacoes[0];
      const fabs = e.fabricantes || [];
      corpo = `<p class="sutil">Módulos: <b>${e.modulo.qtd} × ${e.modulo.potenciaW} W</b> = ${n((e.modulo.qtd * e.modulo.potenciaW) / 1000, 2)} kWp</p><div class="grade g2">
        <label class="campo"><span>1º Tipo do inversor</span>${sel('c-tipo', o.tipos, tipo)}</label>
        <label class="campo"><span>2º Tipo de ligação</span>${sel('c-lig', o.ligacoes, lig)}</label>
        <label class="campo"><span>3º Tensão de saída</span>${sel('c-ten', o.tensoes[lig] || ['127/220V'], e.tensao)}</label>
        <div class="campo"><span>4º Fabricante (vazio = melhor custo-benefício)</span><div class="chips">${o.fabricantes.map((f) => `<button class="chip ${fabs.includes(f) ? 'sel' : ''}" data-fab="${esc(f)}">${esc(f)}</button>`).join('')}</div></div></div>
        <button class="btn vidro" id="c-filtrar" style="margin-top:12px">Filtrar</button>
        ${o.inversores ? (o.inversores.length ? `<div class="tabela-cat" style="margin-top:12px"><table><tr><th></th><th>Inversor</th><th class="v">Potência</th><th class="v">Overload</th><th class="v">Qtd</th></tr>
          ${o.inversores.map((v, i) => `<tr><td><input type="radio" name="c-inv" value="${esc(v.sku)}" ${i === 0 ? 'checked' : ''} class="marcar"></td><td><b>${esc(v.nome)}</b><div class="desc mono">${esc(v.sku)}</div></td><td class="v">${n(v.potenciaKw, 1)} kW</td>
            <td class="v"><span class="${v.overload > 35 ? 'sobe' : v.overload < 0 ? 'desce' : ''}">${n(v.overload, 1)}%</span></td><td class="v">${v.qtd}</td></tr>`).join('')}</table></div>
          <p class="mini">Overload = quanto a potência dos módulos passa a do inversor. Negativo = inversor folgado.</p>
          <button class="btn sol" id="c-ok" style="margin-top:12px">Próximo ›</button>` : '<div class="aviso">Nenhum inversor para esse filtro.</div>') : ''}`;
    } else if (et === 3) {
      const tipos = Object.keys(o.estruturas), t = e.estruturaTipo && o.estruturas[e.estruturaTipo] ? e.estruturaTipo : tipos[0];
      if (!o.estruturas[t].length && !o.buscando) { o.buscando = true; Cotador.detalhes(cot, t).then((d) => { o.estruturas[t] = d.length ? d : ['(sem detalhes)']; o.buscando = false; novo(); }).catch((er) => { o.buscando = false; toast(er.message); }); }
      corpo = `<label class="alternar" style="margin-bottom:12px"><span><b>Sem estrutura</b><br><span class="sutil">o cliente já tem a estrutura</span></span><input type="checkbox" id="c-sem" ${e.semEstrutura ? 'checked' : ''}></label>
        <p class="rotulo">Arranjo nº 1</p><div class="grade g2">
        <label class="campo"><span>Tipo de estrutura</span><select id="c-et">${tipos.map((x) => `<option ${x === t ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label>
        <label class="campo"><span>Detalhes da estrutura</span><select id="c-ed">${o.estruturas[t].map((x) => `<option>${esc(x)}</option>`).join('')}</select></label>
        <label class="campo"><span>Nº de linhas</span><input type="number" min="1" id="c-lin" value="${e.linhas || o.sugestao.linhas}"></label>
        <label class="campo"><span>Módulos por linha</span><input type="number" min="1" id="c-mpl" value="${e.modulosPorLinha || o.sugestao.modulosPorLinha || e.modulo.qtd}"></label>
        <label class="campo"><span>Tipo de orientação</span><select id="c-ori">${o.orientacoes.map((x) => `<option>${esc(x)}</option>`).join('')}</select></label></div>
        <p class="mini" id="c-conf"></p>
        <button class="btn sol" id="c-ok" style="margin-top:12px">Calcular estrutura ›</button>`;
    } else if (et >= 4 && et <= 6) {
      e['itens' + et] = e['itens' + et] || o.itens.map((x) => ({ ...x }));
      corpo = tabelaItens(e['itens' + et], { 4: 'Produtos estruturais recomendados. Aumente, diminua ou zere.', 5: 'Componentes elétricos CC. Os sugeridos já vêm com quantidade; o resto é opcional.', 6: 'Componentes elétricos CA (opcional).' }[et])
        + `<button class="btn sol" id="c-ok" style="margin-top:12px">Próximo ›</button>`;
    } else if (et === 7) {
      corpo = `<div class="kpis"><div class="kpi"><span class="rotulo">Valor dos produtos</span><b>${o.valorProdutos ? brl(o.valorProdutos, 2) : '—'}</b></div>
          <div class="kpi"><span class="rotulo">Módulos</span><b>${e.modulo.qtd} × ${e.modulo.potenciaW} W</b></div><div class="kpi"><span class="rotulo">Inversor</span><b style="font-size:15px">${esc(e.inversor.nome)}</b></div></div>
        <div class="grade">
        <label class="campo"><span>Nome da proposta</span><input type="text" id="c-nome" value="${esc(e.nome)}"></label>
        <div class="grade g2"><label class="campo"><span>Estado de entrega</span><input type="text" id="c-uf" value="${esc(e.estadoEntrega || 'SP')}" maxlength="2"></label>
        <label class="campo"><span>Cidade de entrega</span><input type="text" id="c-cid" value="${esc(e.cidadeEntrega || orc.cidade || 'Ribeirão Preto')}"></label>
        <label class="campo"><span>Dados de frete</span><select id="c-frete">${o.fretes.map((x) => `<option ${x === (e.frete || 'Cliente Retira') ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label>
        <label class="campo"><span>Forma de pagamento</span><select id="c-pg">${o.pagamentos.map((x) => `<option>${esc(x)}</option>`).join('')}</select></label></div></div>
        <label class="alternar" style="margin-top:12px"><span><b>Salvar a proposta na Belenergy</b><br><span class="sutil">fica em "Meus Orçamentos". O robô nunca clica em "Comprar agora".</span></span><input type="checkbox" id="c-salvar" ${cot.modo === 'conectado' ? '' : 'disabled'}></label>
        <button class="btn sol" id="c-ok" style="margin-top:12px">Pegar o valor da proposta</button>`;
    } else if (et === 8) {
      const f = cot.final;
      corpo = `<div class="kpis"><div class="kpi destaque"><span class="rotulo">Valor do kit solar</span><b>${brl(f.valorKit, 2)}</b><span class="sutil">${cot.modo === 'simulado' ? 'SIMULADO (calibrado em kit real)' : 'Belenergy · ' + esc(f.numero)}</span></div>
        <div class="kpi"><span class="rotulo">R$/Wp do kit</span><b>R$ ${n(f.valorKit / (e.modulo.qtd * e.modulo.potenciaW), 2)}</b></div><div class="kpi"><span class="rotulo">Frete</span><b>${f.frete ? brl(f.frete) : esc(e.frete)}</b></div>
        <div class="kpi"><span class="rotulo">Sistema</span><b>${n((e.modulo.qtd * e.modulo.potenciaW) / 1000, 2)} kWp</b></div></div>
        <button class="btn sol" id="c-usar">Usar este kit na opção ${NIVEIS_KIT[cotSlot]}</button>`;
    }
    el.innerHTML = `<div class="painel brilha"><div class="entre"><span class="rotulo" style="color:var(--sol)">Personalize seu Gerador · ${NIVEIS_KIT[cotSlot]} · ${cot.modo === 'conectado' ? '🟢 site Belenergy' : '🟡 simulado'}</span>
        <button class="link" id="c-sair">cancelar</button></div>
        <div class="chips" style="margin:12px 0 16px">${trilha}</div><div id="cot-corpo">${corpo}</div></div>`;

    const v = (id) => $('#' + id)?.value;
    $('#c-sair').onclick = () => { cot = null; novo(); };
    const lista = e['itens' + et];
    el.querySelectorAll('[data-cq]').forEach((i) => i.oninput = () => { lista[+i.dataset.cq].qtd = Math.max(+i.value || 0, 0); });
    el.querySelectorAll('[data-mais],[data-menos]').forEach((b) => b.onclick = () => { const k = +(b.dataset.mais ?? b.dataset.menos); lista[k].qtd = Math.max(lista[k].qtd + (b.dataset.mais !== undefined ? 1 : -1), 0); el.querySelector(`[data-cq="${k}"]`).value = lista[k].qtd; });
    if (et === 1) {
      const aviso = () => { const sku = el.querySelector('[name=c-mod]:checked').value, m = o.modulos.find((x) => x.sku === sku), q = +el.querySelector(`[data-qtd="${sku}"]`).value, k = (q * m.potenciaW) / 1000;
        $('#c-modaviso').innerHTML = k + 0.001 < e.kwp ? `⚠ <b>${n(k, 2)} kWp</b> fica abaixo dos ${n(e.kwp, 2)} kWp necessários: a geração não cobre o consumo.` : `✓ ${n(k, 2)} kWp cobre os ${n(e.kwp, 2)} kWp necessários.`; };
      el.querySelectorAll('[name=c-mod], [data-qtd]').forEach((x) => { x.onchange = aviso; x.oninput = aviso; }); aviso();
    }
    if (et === 2) {
      $('#c-tipo').onchange = () => { e.tipoInversor = v('c-tipo'); o.inversores = null; novo(); };
      $('#c-lig').onchange = () => { e.ligacao = v('c-lig'); e.tensao = null; o.inversores = null; novo(); };
      el.querySelectorAll('[data-fab]').forEach((b) => b.onclick = () => { const f = b.dataset.fab; e.fabricantes = (e.fabricantes || []).includes(f) ? e.fabricantes.filter((x) => x !== f) : [...(e.fabricantes || []), f]; b.classList.toggle('sel'); });
      $('#c-filtrar').onclick = () => passoCot({ filtrar: true, tipoInversor: v('c-tipo'), ligacao: v('c-lig'), tensao: v('c-ten'), fabricantes: e.fabricantes || [] });
    }
    if (et === 3) {
      const conf = () => { const tt = +v('c-lin') * +v('c-mpl'); $('#c-conf').textContent = $('#c-sem').checked ? 'Sem estrutura: o kit vai sem fixação.' : tt === e.modulo.qtd ? `✓ Você utilizou ${tt} dos ${e.modulo.qtd} módulos.` : `⚠ Você utilizou ${tt} dos ${e.modulo.qtd} módulos. O portal exige que bata.`; };
      ['c-lin', 'c-mpl'].forEach((id) => $('#' + id).oninput = conf); $('#c-sem').onchange = conf; conf();
      $('#c-et').onchange = () => { e.estruturaTipo = v('c-et'); e.linhas = +v('c-lin'); e.modulosPorLinha = +v('c-mpl'); novo(); };
    }
    const ok = $('#c-ok');
    if (ok) ok.onclick = () => {
      if (et === 0) return passoCot({ kwp: +v('c-kwp') });
      if (et === 1) { const sku = el.querySelector('[name=c-mod]:checked').value; return passoCot({ moduloSku: sku, moduloQtd: +el.querySelector(`[data-qtd="${sku}"]`).value }); }
      if (et === 2) return passoCot({ inversorSku: el.querySelector('[name=c-inv]:checked').value });
      if (et === 3) {
        if (!$('#c-sem').checked && +v('c-lin') * +v('c-mpl') !== e.modulo.qtd) return toast('Linhas × módulos por linha precisa dar ' + e.modulo.qtd);
        return passoCot({ semEstrutura: $('#c-sem').checked, estruturaTipo: v('c-et'), estruturaDetalhe: v('c-ed'), linhas: +v('c-lin'), modulosPorLinha: +v('c-mpl'), orientacao: v('c-ori') });
      }
      if (et >= 4 && et <= 6) return passoCot({ itens: lista });
      if (et === 7) return passoCot({ nome: v('c-nome'), estadoEntrega: v('c-uf'), cidadeEntrega: v('c-cid'), frete: v('c-frete'), pagamento: v('c-pg'), salvar: $('#c-salvar').checked });
    };
    const usar = $('#c-usar');
    if (usar) usar.onclick = () => { orc.kitsFechados[cotSlot] = Cotador.paraKit(cot, NIVEIS_KIT[cotSlot]); orc.opcaoEscolhida = orc.kitsFechados.filter(Boolean).findIndex((k) => k.nivel === NIVEIS_KIT[PRINCIPAL]); cot = null; salvarR(); toast('Kit fechado salvo na opção ' + NIVEIS_KIT[cotSlot]); novo(); };
  }

  function passo5(el) {
    const p = P(), ops5 = C.opcoes(orc, p), op = ops5[C.indiceOpcao(orc, ops5)], pr = op.preco, sem = p.semaforo;
    const pos = (v) => Math.min(Math.max((v - 1.8) / 1.7, 0), 1) * 100;
    el.innerHTML = `<div class="lado"><div>
      <div class="painel grade">
        <div class="campo"><span>Forma de pagamento</span><div class="chips">${[['financiamento', 'Financiamento'], ['avista', 'À vista / Pix'], ['cartao', 'Cartão 12x']].map(([v, t]) => `<button class="chip ${orc.formaPagamento === v ? 'sel' : ''}" data-pg="${v}">${t}</button>`).join('')}</div></div>
        <div class="grade g2"><label class="campo"><span>Comissão de parceiro (%)</span><input type="number" id="f-com" step="0.5" value="${orc.comissaoParceria}"></label>
        <label class="campo"><span>Desconto: ${n(orc.descontoPct, 1)}% de ${pct(p.reservaNegociacao, 0)}</span><input type="range" id="f-desc" min="0" max="${p.reservaNegociacao * 100}" step="0.5" value="${orc.descontoPct}"></label></div>
        <label class="alternar"><span><b>Kit faturado direto pela Belenergy</b><br><span class="sutil">imposto só no serviço (validar com o contador)</span></span><input type="checkbox" id="f-dir" ${orc.kitFaturadoDireto ? 'checked' : ''}></label></div>
      <div class="painel"><span class="rotulo">Composição do preço · ${esc(op.nivel)} · só você vê</span><table style="margin-top:8px">
        ${pr.linhas.filter((l) => l.valor).map((l) => `<tr><td>${esc(l.nome)}</td><td class="v">${brl(l.valor)}</td></tr>`).join('')}
        <tr class="sub"><td>Custos diretos</td><td class="v">${brl(pr.custosDiretos)}</td></tr>
        <tr><td>Taxa fixa (${brl(p.custoFixoMes)} ÷ ${p.obrasPrevistasMes} obras)</td><td class="v">${brl(pr.taxaFixa)}</td></tr>
        <tr><td>Impostos (${pct(pr.percentuais.impostos)})</td><td class="v">${brl(pr.decomp.impostos)}</td></tr>
        ${pr.decomp.taxaPagamento ? `<tr><td>Taxa do cartão</td><td class="v">${brl(pr.decomp.taxaPagamento)}</td></tr>` : ''}${pr.decomp.comissao ? `<tr><td>Comissão parceiro</td><td class="v">${brl(pr.decomp.comissao)}</td></tr>` : ''}
        <tr><td>Margem (${pct(pr.percentuais.margem, 0)})</td><td class="v">${brl(pr.decomp.margem)}</td></tr>
        <tr><td>Reserva de negociação restante</td><td class="v">${brl(pr.decomp.reservaRestante)}</td></tr>
        <tr class="total"><td>Preço ao cliente</td><td class="v">${brl(pr.precoFinal)}</td></tr>
        ${orc.kitFaturadoDireto ? `<tr class="sub"><td>↳ Nota Belenergy (kit)</td><td class="v">${brl(pr.kitDireto)}</td></tr><tr class="sub"><td>↳ Nota Chama Solar</td><td class="v">${brl(pr.notaChamaSolar)}</td></tr>` : ''}
        <tr><td><b>Sobra para a empresa</b></td><td class="v"><b class="grad">${brl(pr.lucroLiquido)}</b></td></tr></table></div></div>
      <div class="painel"><span class="rotulo">Preço × mercado</span><div style="margin-top:8px"><span class="semaforo ${pr.semaforo}">${NOME_SEMAFORO[pr.semaforo]}</span></div>
        <div class="regua" style="background:linear-gradient(90deg,var(--verde) 0 ${pos(sem.verdeAte)}%,var(--amarelo) ${pos(sem.verdeAte)}% ${pos(sem.amareloAte)}%,var(--vermelho) ${pos(sem.amareloAte)}%)">
          <span class="ponteiro" style="left:${Math.min(Math.max(pos(pr.rsPorWp), 8), 92)}%">R$ ${n(pr.rsPorWp, 2)}/Wp</span>
          <div class="marcas"><span style="left:0;transform:none">1,80</span><span style="left:${pos(sem.verdeAte)}%">${n(sem.verdeAte, 2)}</span><span style="left:${pos(sem.amareloAte)}%">${n(sem.amareloAte, 2)}</span><span style="left:100%;transform:translateX(-100%)">3,50</span></div></div>
        <p class="mini">Média nacional residencial: R$ ${n(sem.referencia, 2)}/Wp (1º tri 2026).</p></div></div>`;
    el.querySelectorAll('[data-pg]').forEach((b) => b.onclick = () => { orc.formaPagamento = b.dataset.pg; salvarR(); novo(); });
    $('#f-com').onchange = (e) => { orc.comissaoParceria = +e.target.value || 0; salvarR(); novo(); };
    $('#f-desc').onchange = (e) => { orc.descontoPct = +e.target.value; salvarR(); novo(); };
    $('#f-dir').onchange = (e) => { orc.kitFaturadoDireto = e.target.checked; salvarR(); novo(); };
  }

  function passo6(el) {
    const p = P(), a = C.analisar(orc, p), diag = A.lista[0].fn({ o: orc, a });
    el.innerHTML = `<div class="lado"><div class="painel brilha">
        <span class="rotulo" style="color:var(--sol)">O que o cliente vai ver primeiro</span>
        <h2 style="font-size:26px;margin:10px 0">${/padaria|auto|peças|ltda|comércio|mercado|loja/i.test(orc.nome) ? 'Sua empresa pagou' : 'Você pagou'} <span class="grad">${brl(a.raioX.pago12)}</span> de luz nos últimos 12 meses.</h2>
        <div class="numeros4"><div><span>Em 25 anos sem solar</span><b>${brl(a.raioX.total25)}</b></div><div><span>Custo da espera</span><b>${brl(a.espera.porMes)}/mês</b></div>
        <div><span>${a.boleto.prazo}x parcela + conta mínima</span><b>${brl(a.boleto.totalMes)}</b></div><div><span>Conta hoje</span><b>${brl(a.boleto.contaAtual)}</b></div></div>
        <p class="sutil" style="margin-top:12px">Ao gerar, o sistema cria um link único. Cada vez que o cliente abrir, ler uma parte, simular parcela ou compartilhar, você fica sabendo na ficha dele.</p></div>
      <div class="painel">${blocos(diag, null)}</div></div>`;
  }

  /* ======================= PARÂMETROS ======================= */
  const CAMPOS = [
    ['Custo fixo', [['custoFixoMes', 'Custo fixo do mês (R$)', 1], ['obrasPrevistasMes', 'Obras previstas/mês', 1]]],
    ['Custos por obra', [['maoDeObraPorPlaca', 'Terceiro por placa (R$)', 1], ['art', 'ART (R$)', 1], ['materialCaBase', 'Material CA fixo (R$)', 1], ['materialCaPorKwp', 'Material CA/kWp (R$)', 1], ['custoKm', 'Custo por km (R$)', 1], ['visitasObra', 'Viagens por obra', 1], ['trocaPadrao', 'Troca de padrão (R$)', 1], ['reservaGarantia', 'Reserva garantia (% kit)', 100]]],
    ['Percentuais', [['impostoTotal', 'Imposto com kit (%)', 100], ['impostoServico', 'Imposto só serviço (%)', 100], ['reservaNegociacao', 'Reserva de negociação (%)', 100]]],
    ['Conversão e retorno', [['tarifaKwh', 'Tarifa padrão (R$/kWh)', 1], ['margemGeracao', 'Margem de geração (%)', 100], ['perdaOrientacao', 'Perda de segurança da orientação (%)', 100], ['reajusteAnual', 'Reajuste ao ano (%)', 100], ['simultaneidade', 'Simultaneidade (%)', 100], ['validadeDias', 'Validade da cotação (dias)', 1], ['manutencaoAnual', 'Manutenção/ano (R$)', 1], ['pr', 'PR (eficiência)', 1]]],
  ];
  function parametrosPag() {
    const p = P();
    app.innerHTML = `${cabCelular()}<div class="cab"><div><h1>Parâmetros</h1><p class="sutil">Valores de teste. Troque pelos reais quando tiver custo fixo, alíquota e preço do terceiro.</p></div></div>
      <div class="lado"><div>${CAMPOS.map(([t, cs]) => `<div class="painel"><span class="rotulo">${t}</span><div class="grade g2" style="margin-top:12px">${cs.map(([k, r, m]) => `<label class="campo"><span>${r}</span><input type="number" step="any" data-par="${k}" data-m="${m}" value="${+(p[k] * m).toFixed(4)}"></label>`).join('')}</div></div>`).join('')}</div>
      <div><div class="painel"><span class="rotulo">Margem por tamanho</span><table style="margin-top:8px">${p.margens.map((x, i) => `<tr><td>até ${x.ate >= 1e9 ? '∞' : x.ate} kWp</td><td class="v"><input type="number" step="0.5" data-mg="${i}" value="${+(x.margem * 100).toFixed(2)}" style="width:90px;padding:6px 8px;text-align:right"> %</td></tr>`).join('')}</table></div>
        <div class="painel"><span class="rotulo">Fórmula</span><p class="sutil" style="margin-top:8px">Preço = (custos diretos + taxa fixa) ÷ (1 − (impostos + taxa de pagamento + comissão + margem + reserva))</p></div>
        <div class="acoes-r" style="margin-top:14px"><button class="btn sol" id="salvarP">Salvar</button><button class="btn vidro" id="resetP">Voltar ao teste</button></div></div></div>`;
    $('#salvarP').onclick = () => {
      const novoP = {}; app.querySelectorAll('[data-par]').forEach((i) => { novoP[i.dataset.par] = +i.value / +i.dataset.m; });
      novoP.margens = p.margens.map((x, i) => ({ ate: x.ate, margem: +app.querySelector(`[data-mg="${i}"]`).value / 100 }));
      B.salvarParametros(novoP); toast('Parâmetros salvos');
    };
    $('#resetP').onclick = () => { B.zerarParametros(); parametrosPag(); toast('Voltou aos valores de teste'); };
  }


  /* ======================= CATÁLOGO ======================= */
  let filtroCat = 'modulo';
  function catalogoPag() {
    const K = window.Catalogo, c = K.ler();
    const itens = c.itens.filter((i) => i.tipo === filtroCat).sort((a, b) => (b.usar - a.usar) || (a.preco / (a.potenciaW || 1)) - (b.preco / (b.potenciaW || 1)));
    const usados = c.itens.filter((i) => i.usar);
    const nv = ['Econômica', 'Recomendada', 'Premium'];
    app.innerHTML = `${cabCelular()}<div class="cab"><div><h1>Catálogo</h1><p class="sutil">Fonte: ${esc(c.origem)} · atualizado em ${new Date(c.atualizadoEm).toLocaleString('pt-BR')}. ${usados.length} produto(s) marcados para orçamento.</p></div>
        <label class="btn sol" for="f-imp" style="cursor:pointer">⬆ Importar arquivo do robô<input type="file" id="f-imp" accept=".json,.csv" hidden></label></div>
      <div class="painel"><div class="filtros">${[['modulo', 'Módulos'], ['inversor', 'Inversores'], ['bateria', 'Baterias']].map(([v, t]) => `<button class="chip ${filtroCat === v ? 'sel' : ''}" data-fc="${v}">${t} <small>${c.itens.filter((i) => i.tipo === v).length}</small></button>`).join('')}
        <span class="mini" style="margin-left:auto">Marque o que pode entrar nos orçamentos${filtroCat === 'modulo' ? ' e o nível de cada módulo' : ''}.</span></div>
        <div class="tabela-cat"><table><tr><th>Usar</th><th>Produto</th><th class="v">Preço</th>${filtroCat === 'modulo' ? '<th class="v">R$/Wp</th><th>Nível</th>' : '<th class="v">Potência</th><th>Linha</th>'}<th class="v">Estoque</th></tr>
        ${itens.map((i) => `<tr><td><input type="checkbox" class="marcar" data-usar="${esc(i.sku)}" ${i.usar ? 'checked' : ''} aria-label="Usar ${esc(i.descricao)}"></td>
          <td><b>${esc(i.marca || '')} ${i.potenciaW && i.tipo === 'modulo' ? i.potenciaW + ' W' : ''}</b><div class="desc">${esc(i.descricao)} · <span class="mono">${esc(i.sku)}</span></div></td>
          <td class="v">${brl(i.preco, 2)}${i.precoAnterior ? `<div class="${i.preco > i.precoAnterior ? 'sobe' : 'desce'}">${i.preco > i.precoAnterior ? '▲' : '▼'} era ${brl(i.precoAnterior, 2)}</div>` : ''}</td>
          ${i.tipo === 'modulo' ? `<td class="v">R$ ${n(i.preco / i.potenciaW, 2)}</td><td><select data-nivel="${esc(i.sku)}"><option value="">—</option>${nv.map((t, k) => `<option value="${k}" ${i.nivel === k ? 'selected' : ''}>${t}</option>`).join('')}</select></td>`
            : `<td class="v">${i.tipo === 'bateria' ? n(i.kwh, 1) + ' kWh' : n((i.potenciaW || 0) / 1000, 1) + ' kW'}</td><td>${i.tipo === 'inversor' ? `<select data-linha="${esc(i.sku)}"><option value="">${i.hibrido ? 'Híbrido' : 'Padrão'}</option><option value="p" ${i.premium ? 'selected' : ''}>Premium (Recomendada)</option></select>` : '—'}</td>`}
          <td class="v">${i.estoque != null ? n(i.estoque) : '—'}${i.disponivelSP === false ? '<div class="sobe">sem estoque SP</div>' : ''}${i.fora ? '<div class="sobe">fora da última leitura</div>' : ''}</td></tr>`).join('')}</table></div>
        <div class="acoes-r" style="margin-top:14px"><button class="btn vidro pequeno" id="zerarCat">Voltar à amostra</button></div></div>
      <div class="painel"><span class="rotulo">Como o catálogo vira proposta</span>
        <ul class="tempo" style="margin-top:8px">
          <li><span>1</span><span><b>Econômica</b>: o módulo marcado como Econômica (ou o mais barato por Wp) + inversores padrão.</span><em></em></li>
          <li><span>2</span><span><b>Recomendada</b>: o módulo marcado como Recomendada + inversores marcados como Premium.</span><em></em></li>
          <li><span>3</span><span><b>Premium</b>: o módulo Premium + inversor híbrido + a bateria marcada.</span><em></em></li>
          <li><span>!</span><span>Preços dos módulos são reais (lidos no portal em 03/11). Inversores e baterias ainda são de teste até rodar o robô. Ficha elétrica dos módulos estimada pela potência: confira antes de fechar o projeto.</span><em></em></li>
        </ul></div>`;
    const salvar = (fn) => { const cc = K.ler(); fn(cc); K.gravar(cc); };
    app.querySelectorAll('[data-fc]').forEach((b) => b.onclick = () => { filtroCat = b.dataset.fc; catalogoPag(); });
    app.querySelectorAll('[data-usar]').forEach((x) => x.onchange = () => salvar((cc) => { cc.itens.find((i) => i.sku === x.dataset.usar).usar = x.checked; }));
    app.querySelectorAll('[data-nivel]').forEach((x) => x.onchange = () => salvar((cc) => {
      const v = x.value === '' ? null : +x.value;
      cc.itens.forEach((i) => { if (i.tipo === 'modulo' && v !== null && i.nivel === v) i.nivel = null; });
      const it = cc.itens.find((i) => i.sku === x.dataset.nivel); it.nivel = v; if (v !== null) it.usar = true;
      catalogoPag();
    }));
    app.querySelectorAll('[data-linha]').forEach((x) => x.onchange = () => salvar((cc) => { cc.itens.find((i) => i.sku === x.dataset.linha).premium = x.value === 'p'; }));
    $('#zerarCat').onclick = () => { K.zerar(); catalogoPag(); toast('Catálogo de amostra restaurado'); };
    $('#f-imp').onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try { const r = K.importar(await f.text()); toast(`${r.total} produtos importados · ${r.mudouPreco} mudaram de preço`); catalogoPag(); }
      catch (err) { toast(err.message); }
    };
  }

  /* ======================= ROTAS ======================= */
  function render() {
    const h = location.hash.slice(1) || 'painel';
    const [rota, arg] = h.startsWith('lead-') ? ['lead', h.slice(5)] : [h, null];
    document.querySelectorAll('[data-rota]').forEach((a) => a.classList.toggle('ativo', a.dataset.rota === (rota === 'lead' ? 'painel' : rota)));
    if (rota !== 'novo') { document.body.classList.remove('com-barra'); $('#barra').hidden = true; }
    const ir = () => { if (rota === 'novo') { orc = B.rascunho.ler() || novoOrc(); etapa = B.rascunho.etapa(); novo(); } else if (rota === 'lead') ficha(arg); else if (rota === 'agentes') agentesPag(); else if (rota === 'catalogo') catalogoPag(); else if (rota === 'parametros') parametrosPag(); else painel(); };
    if (document.startViewTransition) {
      const t = document.startViewTransition(ir);
      [t.ready, t.finished, t.updateCallbackDone].forEach((pr) => pr && pr.catch(() => {})); // navegação rápida cancela a animação, sem problema
    } else ir();
    scrollTo(0, 0);
  }
  $('#resetar').onclick = () => { B.zerarTudo(); B.semear(true); toast('Dados de teste recriados'); render(); };
  addEventListener('hashchange', render);
  // atualiza o painel/ficha quando o cliente mexe na proposta em outra aba
  addEventListener('storage', (e) => { if (e.key === 'sol2_eventos' && /^#(painel|lead)|^$/.test(location.hash)) render(); });
  render();
})();
