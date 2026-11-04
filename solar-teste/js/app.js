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
  const SECOES = { dor: 'raio-x da conta', futuro: '25 anos sem solar', relogio: 'relógio da conta', solucao: 'a solução', boleto: 'troca de boleto', opcoes: 'as 3 opções', vizinhos: 'usinas vizinhas', duvidas: 'dúvidas', decidir: 'próximo passo' };

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
    escolheu: `👆 Olhou a opção ${['Econômica', 'Recomendada', 'Premium'][e.dados?.opcao] || ''}`, compartilhou: '👥 Mostrou para outra pessoa', whatsapp: '💬 Clicou para falar com você',
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
  const novoOrc = () => ({ nome: '', whatsapp: '', cep: '', cidade: '', distanciaKm: 0, ligacao: 'bi', consumos: Array(12).fill(''), tarifaKwh: P().tarifaKwh, lidoPorIA: false, telhado: 'ceramico', orientacao: 'N', areaDisponivel: '', trocaPadrao: false, opcaoEscolhida: 1, formaPagamento: 'financiamento', comissaoParceria: 0, kitFaturadoDireto: false, descontoPct: 0, origem: 'WhatsApp', status: 'novo' });
  let orc = B.rascunho.ler() || novoOrc();
  let etapa = B.rascunho.etapa();
  const salvarR = () => { B.rascunho.gravar(orc); B.rascunho.gravarEtapa(etapa); };
  const ETAPAS = [
    ['Cliente e conta', passo1, () => (orc.nome.trim() && C.consumoMedio(orc) > 0 && orc.cidade) ? '' : 'Preencha nome, CEP e o consumo.'],
    ['Local e telhado', passo2, () => ''], ['Dimensionamento', passo3, () => ''], ['Kits e preços', passo4, () => ''],
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
    if (C.consumoMedio(orc) > 0 && orc.cidade && etapa >= 2) { const op = C.opcoes(orc, P())[orc.opcaoEscolhida]; r.innerHTML = `<b>${brl(op.preco.precoFinal)}</b>${op.nivel} · ${n(op.dim.kwpReal, 2)} kWp`; }
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

  function passo1(el) {
    const media = C.consumoMedio(orc);
    el.innerHTML = `<div class="lado"><div>
      <div class="painel brilha"><span class="rotulo" style="color:var(--sol)">✦ Leitura da conta com IA</span>
        <div class="ia-caixa">📄 Arraste o PDF da CPFL ou tire foto da conta<br><span class="mini">(no teste, escolha uma conta de exemplo)</span></div>
        <div class="chips">${D.contasExemplo.map((c, i) => `<button class="chip" data-conta="${i}">${esc(c.nome)}</button>`).join('')}</div></div>
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
        <div style="grid-column:1/-1"><span>Pagou nos últimos 12 meses</span><b id="pago" class="grad">${brl(media * 12 * orc.tarifaKwh)}</b></div></div>
        ${orc.lidoPorIA ? '<div class="aviso ok">✓ Lido da conta (simulado). Confira antes de seguir.</div>' : ''}</div></div>`;
    const atual = () => { const m = C.consumoMedio(orc); $('#media').textContent = n(m) + ' kWh'; $('#pago').textContent = brl(orc.consumos.map(Number).filter(Boolean).reduce((s, x) => s + x, 0) * orc.tarifaKwh); salvarR(); barra(); };
    $('#f-nome').oninput = (e) => { orc.nome = e.target.value; salvarR(); barra(); };
    $('#f-zap').oninput = (e) => { orc.whatsapp = e.target.value; salvarR(); };
    $('#f-cep').oninput = (e) => { orc.cep = e.target.value; const c = B.cepInfo(orc.cep); orc.cidade = c?.cidade || ''; orc.distanciaKm = c?.km || 0; $('#cep-info').textContent = c ? `📍 ${c.cidade} · ${c.km} km da base` : 'CEP fora da tabela de teste'; salvarR(); };
    $('#f-tar').oninput = (e) => { orc.tarifaKwh = +e.target.value || 0; atual(); };
    el.querySelectorAll('[data-mes]').forEach((i) => i.oninput = () => { orc.consumos[+i.dataset.mes] = i.value; atual(); });
    el.querySelectorAll('[data-lig]').forEach((b) => b.onclick = () => { orc.ligacao = b.dataset.lig; salvarR(); novo(); });
    el.querySelectorAll('[data-orig]').forEach((b) => b.onclick = () => { orc.origem = b.dataset.orig; salvarR(); novo(); });
    el.querySelectorAll('[data-conta]').forEach((b) => b.onclick = () => {
      const c = D.contasExemplo[+b.dataset.conta], cep = B.cepInfo(c.cep);
      Object.assign(orc, { nome: c.nome, whatsapp: c.whatsapp, cep: c.cep, ligacao: c.ligacao, consumos: [...c.consumos], tarifaKwh: c.tarifaKwh, cidade: cep.cidade, distanciaKm: cep.km, lidoPorIA: true });
      salvarR(); novo(); toast('Conta lida (simulação)');
    });
  }

  function passo2(el) {
    const p = P(), hsp = (D.cidades[orc.cidade] || D.cidades['Ribeirão Preto']).hsp;
    el.innerHTML = `<div class="lado"><div class="painel grade">
      <div class="campo"><span>Tipo de telhado</span><div class="chips">${[['ceramico', 'Cerâmico'], ['fibrocimento', 'Fibrocimento'], ['metalico', 'Metálico'], ['laje', 'Laje'], ['solo', 'Solo']].map(([v, t]) => `<button class="chip ${orc.telhado === v ? 'sel' : ''}" data-tel="${v}">${t}<small>${brl(D.catalogo.estrutura[v])}/pl</small></button>`).join('')}</div></div>
      <div class="campo"><span>Orientação do telhado</span><div class="chips">${[['N', 'Norte', 'ideal'], ['NE', 'Nordeste', '−3%'], ['NO', 'Noroeste', '−3%'], ['L', 'Leste', '−12%'], ['O', 'Oeste', '−12%'], ['S', 'Sul', '−25%']].map(([v, t, d]) => `<button class="chip ${orc.orientacao === v ? 'sel' : ''}" data-ori="${v}">${t}<small>${d}</small></button>`).join('')}</div></div>
      <div class="grade g2"><label class="campo"><span>Área livre (m²)</span><input type="number" id="f-area" value="${esc(orc.areaDisponivel)}" placeholder="opcional"></label>
      <label class="campo"><span>Distância (km)</span><input type="number" id="f-km" value="${esc(orc.distanciaKm)}"></label></div>
      <label class="alternar"><span><b>Troca de padrão de entrada</b><br><span class="sutil">soma ${brl(p.trocaPadrao)}</span></span><input type="checkbox" id="f-pad" ${orc.trocaPadrao ? 'checked' : ''}></label></div>
      <div class="painel"><span class="rotulo">Sol no local</span><div class="numeros4" style="margin-top:12px">
        <div><span>${esc(orc.cidade || 'Ribeirão Preto')}</span><b>${n(hsp, 2)} HSP</b></div><div><span>Com a orientação</span><b>${n(hsp * M.FATOR_ORIENTACAO[orc.orientacao], 2)} HSP</b></div></div>
        <p class="mini" style="margin-top:10px">Irradiação de teste. No oficial vem da base pública pelo endereço.</p></div></div>`;
    el.querySelectorAll('[data-tel]').forEach((b) => b.onclick = () => { orc.telhado = b.dataset.tel; salvarR(); novo(); });
    el.querySelectorAll('[data-ori]').forEach((b) => b.onclick = () => { orc.orientacao = b.dataset.ori; salvarR(); novo(); });
    $('#f-area').oninput = (e) => { orc.areaDisponivel = e.target.value; salvarR(); };
    $('#f-km').oninput = (e) => { orc.distanciaKm = e.target.value; salvarR(); };
    $('#f-pad').onchange = (e) => { orc.trocaPadrao = e.target.checked; salvarR(); };
  }

  function passo3(el) {
    const p = P(), op = C.opcoes(orc, p)[orc.opcaoEscolhida], d = op.dim;
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

  function passo4(el) {
    const ops = C.opcoes(orc, P());
    el.innerHTML = `<p class="sutil">Mesmo dimensionamento, três níveis. O cliente verá as três na Proposta Viva, com a Recomendada em destaque.</p>
      <div class="ops-v">${ops.map((o, i) => `<button class="op-v ${orc.opcaoEscolhida === i ? 'sel' : ''}" data-op="${i}">
        <span class="rotulo" style="color:var(--sol)">${o.destaque ? 'Recomendada' : '&nbsp;'}</span><h3 style="margin:4px 0">${esc(o.nivel)}</h3>
        <div class="preco">${brl(o.preco.precoFinal)}</div><span class="semaforo ${o.preco.semaforo}">R$ ${n(o.preco.rsPorWp, 2)}/Wp · ${NOME_SEMAFORO[o.preco.semaforo]}</span>
        <ul><li><span>Potência</span><span>${n(o.dim.kwpReal, 2)} kWp</span></li><li><span>Inversor</span><span>${esc(o.inversor.nome)}</span></li>${o.bateria ? `<li><span>Bateria</span><span>${esc(o.bateria.nome)}</span></li>` : ''}
        <li><span>Retorno</span><span>${n(o.eco.paybackAnos, 1)} anos</span></li><li><span>Kit (custo)</span><span>${brl(o.kit)}</span></li></ul>
        ${!o.dcAcOk ? `<div class="aviso">DC/AC ${n(o.relacaoDcAc, 2)} fora da faixa ideal.</div>` : ''}</button>`).join('')}</div>`;
    el.querySelectorAll('[data-op]').forEach((b) => b.onclick = () => { orc.opcaoEscolhida = +b.dataset.op; salvarR(); novo(); });
  }

  function passo5(el) {
    const p = P(), op = C.opcoes(orc, p)[orc.opcaoEscolhida], pr = op.preco, sem = p.semaforo;
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
    ['Conversão e retorno', [['tarifaKwh', 'Tarifa padrão (R$/kWh)', 1], ['reajusteAnual', 'Reajuste ao ano (%)', 100], ['simultaneidade', 'Simultaneidade (%)', 100], ['validadeDias', 'Validade da cotação (dias)', 1], ['manutencaoAnual', 'Manutenção/ano (R$)', 1], ['pr', 'PR (eficiência)', 1]]],
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

  /* ======================= ROTAS ======================= */
  function render() {
    const h = location.hash.slice(1) || 'painel';
    const [rota, arg] = h.startsWith('lead-') ? ['lead', h.slice(5)] : [h, null];
    document.querySelectorAll('[data-rota]').forEach((a) => a.classList.toggle('ativo', a.dataset.rota === (rota === 'lead' ? 'painel' : rota)));
    if (rota !== 'novo') { document.body.classList.remove('com-barra'); $('#barra').hidden = true; }
    const ir = () => { if (rota === 'novo') { orc = B.rascunho.ler() || novoOrc(); etapa = B.rascunho.etapa(); novo(); } else if (rota === 'lead') ficha(arg); else if (rota === 'agentes') agentesPag(); else if (rota === 'parametros') parametrosPag(); else painel(); };
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
