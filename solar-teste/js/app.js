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
  document.querySelectorAll('[data-ico]').forEach((i) => { i.outerHTML = Icone(i.dataset.ico); });
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
    const ag = Cadencia.agenda(lista, evDe, (id) => B.interacoes(id));
    app.innerHTML = `${cabCelular()}
      <div class="cab entra"><div><h1>${h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'}, ${esc(D.empresa.vendedor)}.</h1>
        <p class="sutil">${f.quentes ? `<b style="color:var(--sol)">${f.quentes} cliente(s) quente(s)</b> agora. Comece por ele(s).` : 'Nenhum cliente quente agora. Bom momento para follow-up.'}</p></div>
        <div class="linha-h"><button class="btn vidro" id="rapida">⚡ Resposta rápida</button><a class="btn sol" href="#novo">＋ Novo orçamento</a></div></div>
      <div class="kpis entra">
        <div class="kpi destaque"><span class="rotulo">Em negociação</span><b>${brl(ativos.reduce((s, x) => s + x.a.op.preco.precoFinal, 0))}</b><span class="sutil">${ativos.length} proposta(s) ativa(s)</span></div>
        <div class="kpi"><span class="rotulo">Quentes agora</span><b>${f.quentes}</b><span class="sutil">mexendo na proposta</span></div>
        <div class="kpi"><span class="rotulo">Propostas abertas</span><b>${enviados.length ? pct(abertas / enviados.length, 0) : '—'}</b><span class="sutil">${abertas} de ${enviados.length} enviadas</span></div>
        <div class="kpi"><span class="rotulo">Fechamento</span><b>${pct(f.taxa, 0)}</b><span class="sutil">${f.fechados} ganho(s) · ${f.perdidos} perdido(s) · Groner: 5,7%</span></div>
      </div>
      ${resultadoMes(info, p)}
      <div class="secao-t"><h2>Agenda de hoje</h2><span class="sutil">${ag.length ? ag.length + ' contato(s) · do mais quente para o resto' : 'nada vencido: bom momento para pedir indicação'} ${'Notification' in window && Notification.permission !== 'granted' ? '<button class="link" id="ativarAvisos">ativar avisos</button>' : ''}</span></div>
      <div class="agora">${ag.slice(0, 12).map(({ o, passo }) => { const x = info.find((y) => y.o.id === o.id); return `
        <div class="acao p${passo.quente ? 5 : passo.atrasoDias > 0 ? 4 : 3} entra" style="cursor:default"><div class="ic">${passo.quente ? '🔥' : passo.canal === 'ligacao' ? '📞' : '💬'}</div>
          <div style="flex:1;min-width:0"><b><a href="#lead-${o.id}" style="color:inherit">${esc(o.nome)}</a> <span class="temp ${x ? x.t.nivel : ''}">${x ? x.t.rotulo : ''}</span></b>
            <p>${passo.quente ? '<b>Está com a proposta aberta agora: ligue já.</b> ' : ''}<b>${esc(passo.id)} · ${esc(passo.titulo)}</b>${passo.atrasoDias > 0 ? ` <span style="color:var(--laranja)">(${passo.atrasoDias} dia(s) de atraso)</span>` : ''} — ${esc(passo.porque)}</p>
            <div class="acoes-r" style="margin-top:6px"><button class="btn zap pequeno" data-cad="zap" data-id="${o.id}" data-passo="${passo.id}">WhatsApp</button><button class="btn vidro pequeno" data-cad="lig" data-id="${o.id}" data-passo="${passo.id}">Liguei</button><button class="link" data-cad="ok" data-id="${o.id}" data-passo="${passo.id}">pular</button></div></div></div>`; }).join('')}</div>
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
  /* ======================= RESPOSTA RÁPIDA =======================
     Lead chegou: em 1 minuto manda uma faixa de preço e a economia,
     antes do orçamento completo. Quem responde primeiro vende mais. */
  function estimativaRapida(dados) {
    const p = P(), o = { cidade: dados.cidade || 'Ribeirão Preto', ligacao: dados.ligacao || 'bi', consumos: Array(12).fill(dados.kwh), orientacao: '?', tarifaKwh: p.tarifaKwh };
    const e = C.entrada(o), disp = p.descontarDisponibilidade ? (M.DISPONIBILIDADE[o.ligacao] ?? 50) : 0;
    const alvo = Math.max(e.consumoMedio - disp, 0) * (1 + (p.margemGeracao || 0));
    const wMod = p.moduloRefW || 685, placas = Math.max(Math.ceil((alvo / (e.hsp * 30 * p.pr)) * 1000 / wMod - 0.05), 2);
    const kwp = (placas * wMod) / 1000, ger = kwp * e.hsp * 30 * p.pr;
    const kit = (p.kitRefWp || 1.35) * kwp * 1000;
    const pr = M.precificar({ ...e, kit, placas, kwp, formaPagamento: 'avista', comissaoParceria: 0, kitFaturadoDireto: false, descontoPct: 0 }, p);
    const eco = M.economia({ ...e, geracaoMes: ger, investimento: pr.precoFinal, anoInicio: p.anoBase }, p);
    const arred = (v) => Math.round(v / 100) * 100;
    return { kwp, placas, ger, min: arred(pr.precoFinal * 0.95), max: arred(pr.precoFinal * 1.07), eco, parcela: M.parcelaPrice(pr.precoFinal, p.financiamento.jurosMes, p.financiamento.prazos[p.financiamento.prazos.length - 1]), prazo: p.financiamento.prazos[p.financiamento.prazos.length - 1] };
  }
  function respostaRapida() {
    const p = P(), ov = document.createElement('div');
    ov.className = 'modal-rapida';
    ov.style.cssText = 'position:fixed;inset:0;z-index:80;background:#0009;display:grid;place-items:center;padding:16px';
    ov.innerHTML = `<div class="painel" style="max-width:520px;width:100%;max-height:92vh;overflow:auto">
      <div class="entre"><span class="rotulo" style="color:var(--sol)">⚡ Resposta rápida</span><button class="link" data-fechar>fechar</button></div>
      <p class="sutil" style="margin:6px 0 12px">Mande em 1 minuto uma faixa de preço e a economia. O orçamento completo vem depois da visita.</p>
      <div class="grade g2"><label class="campo"><span>Nome</span><input id="rr-nome" type="text"></label><label class="campo"><span>WhatsApp</span><input id="rr-zap" type="tel" placeholder="16 99999-9999"></label>
        <label class="campo"><span>Consumo médio (kWh) ou conta (R$)</span><input id="rr-kwh" type="number" placeholder="ex.: 450"></label>
        <label class="campo"><span>É kWh ou R$?</span><select id="rr-unid"><option value="kwh">kWh por mês</option><option value="rs">R$ da conta</option></select></label>
        <label class="campo"><span>Cidade</span><select id="rr-cid">${Object.keys(D.cidades).map((c) => `<option ${c === 'Ribeirão Preto' ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
        <label class="campo"><span>Ligação</span><select id="rr-lig"><option value="mono">Monofásica</option><option value="bi" selected>Bifásica</option><option value="tri">Trifásica</option></select></label></div>
      <div id="rr-res" style="margin-top:12px" hidden><div class="numeros4" id="rr-num"></div>
        <textarea id="rr-msg" rows="9" style="width:100%;margin-top:10px"></textarea>
        <p class="mini" style="margin:6px 0 0">Estimativa com kit de referência de R$ ${n(p.kitRefWp || 1.35, 2)}/Wp (Parâmetros). O preço final sai do kit fechado da Belenergy.</p>
        <div class="acoes-r" style="margin-top:10px"><button class="btn zap" id="rr-enviar">Enviar no WhatsApp e salvar lead</button><button class="btn vidro" id="rr-copiar">Copiar</button></div></div></div>`;
    document.body.appendChild(ov);
    const $o = (s) => ov.querySelector(s);
    ov.onclick = (ev) => { if (ev.target === ov || ev.target.closest('[data-fechar]')) ov.remove(); };
    const calc = () => {
      let v = +$o('#rr-kwh').value; if (!v) { $o('#rr-res').hidden = true; ultimo = null; return; }
      const kwh = $o('#rr-unid').value === 'rs' ? Math.round(v / p.tarifaKwh) : v;
      const r = estimativaRapida({ kwh, cidade: $o('#rr-cid').value, ligacao: $o('#rr-lig').value });
      const nome = ($o('#rr-nome').value.trim().split(' ')[0]) || '';
      const msg = `Oi${nome ? ' ' + nome : ''}! Aqui é o ${D.empresa.vendedor}, da Chama Solar ☀️\n\nCom um consumo de ${n(kwh)} kWh por mês, o sistema ideal fica perto de ${n(r.kwp, 2)} kWp (${r.placas} placas), gerando cerca de ${n(r.ger)} kWh por mês.\n\n💰 Investimento: entre ${brl(r.min)} e ${brl(r.max)}\n📉 Sua conta cai de ${brl(r.eco.contaAtual)} para cerca de ${brl(r.eco.contaDepois)}\n🏦 Financiado: parcelas a partir de ${brl(r.parcela)} em ${r.prazo}x\n\nPara fechar o valor exato, preciso ver o telhado e a conta de luz. Posso passar aí amanhã? Leva 20 minutos.`;
      ultimo = { kwh, r };
      $o('#rr-res').hidden = false;
      $o('#rr-num').innerHTML = `<div><span>Sistema</span><b>${n(r.kwp, 2)} kWp</b></div><div><span>Faixa de preço</span><b>${brl(r.min)} a ${brl(r.max)}</b></div><div><span>Conta hoje → depois</span><b>${brl(r.eco.contaAtual)} → ${brl(r.eco.contaDepois)}</b></div><div><span>Parcela ${r.prazo}x</span><b>${brl(r.parcela)}</b></div>`;
      $o('#rr-msg').value = msg;
    };
    let ultimo = null;
    $o('#rr-copiar').onclick = () => copiar($o('#rr-msg').value);
    $o('#rr-enviar').onclick = () => {
      if (!ultimo) { toast('Informe o consumo'); return; }
      const { kwh, r } = ultimo, zap = $o('#rr-zap').value.replace(/\D/g, '');
      if (!$o('#rr-nome').value.trim() || zap.length < 10) { toast('Preencha nome e WhatsApp'); return; }
      const o = { ...novoOrc(), nome: $o('#rr-nome').value.trim(), whatsapp: $o('#rr-zap').value.trim(), cidade: $o('#rr-cid').value, ligacao: $o('#rr-lig').value, consumos: Array(12).fill(kwh), status: 'novo', origem: 'resposta rápida', estimativa: { min: r.min, max: r.max, kwp: r.kwp, em: new Date().toISOString() } };
      B.salvar(o); B.interacao(o.id, 'whatsapp', 'Resposta rápida: faixa ' + brl(r.min) + ' a ' + brl(r.max));
      window.open('https://wa.me/55' + zap.replace(/^55/, '') + '?text=' + encodeURIComponent($o('#rr-msg').value), '_blank', 'noopener');
      ov.remove(); toast('Lead salvo. Agora marque a visita.'); render();
    };
    ov.querySelectorAll('input,select').forEach((x) => { x.oninput = calc; x.onchange = calc; });
    $o('#rr-nome').focus();
  }

  /* ---------- Resultado do mês (visão do dono), obras e indicações ---------- */
  function resultadoMes(info, p) {
    const mes = new Date().toISOString().slice(0, 7);
    const quando = (o) => String(o.ganhoEm || (o.aceite && o.aceite.em) || o.atualizadoEm || '').slice(0, 7);
    const ganhos = info.filter((x) => x.o.status === 'ganho' && quando(x.o) === mes);
    const kwp = ganhos.reduce((s, x) => s + x.a.op.dim.kwpReal, 0), receita = ganhos.reduce((s, x) => s + x.a.op.preco.precoFinal, 0);
    const meta = Number(p.kwpPrevistosMes) || 0;
    const origens = {}; info.forEach((x) => { const k = x.o.origem || 'sem origem'; origens[k] = origens[k] || { leads: 0, ganhos: 0 }; origens[k].leads++; if (x.o.status === 'ganho') origens[k].ganhos++; });
    const obras = info.filter((x) => x.o.status === 'ganho').map((x) => ({ x, et: posVendaEtapa(x.o) })).filter((y) => y.et);
    const inds = info.filter((x) => x.o.indicadoPor);
    return `<div class="secao-t"><h2>Resultado do mês</h2><span class="sutil">meta de ${n(meta)} kWp cobre o custo fixo (ponto de equilíbrio)</span></div>
      <div class="kpis"><div class="kpi ${meta && kwp >= meta ? 'destaque' : ''}"><span class="rotulo">kWp vendidos</span><b>${n(kwp, 1)} / ${n(meta)}</b><div class="progresso"><i style="width:${meta ? Math.min(kwp / meta * 100, 100) : 0}%"></i></div><span class="sutil">${meta ? n(Math.min(kwp / meta, 9.99) * 100) + '% do ponto de equilíbrio' : 'defina a meta em Parâmetros'}</span></div>
        <div class="kpi"><span class="rotulo">Vendido no mês</span><b>${brl(receita)}</b><span class="sutil">${ganhos.length} contrato(s)</span></div>
        <div class="kpi"><span class="rotulo">Obras em andamento</span><b>${obras.length}</b><span class="sutil">${obras.filter((y) => { const pr = y.et.e[2], d = y.et.desde ? diasEntre(y.et.desde, new Date().toISOString()) : 0; return pr && d > pr; }).length} passou(aram) do prazo</span></div>
        <div class="kpi"><span class="rotulo">Indicações</span><b>${inds.length}</b><span class="sutil">${inds.filter((x) => x.o.status === 'ganho' && !x.o.presenteEntregue).length} presente(s) a entregar</span></div></div>
      <div class="ops-v duas" style="margin-top:12px">
        <div class="painel"><span class="rotulo">De onde vêm as vendas</span><table style="margin-top:8px"><tr><th>Origem</th><th class="v">Leads</th><th class="v">Fechados</th><th class="v">Conversão</th></tr>${Object.entries(origens).sort((a, b) => b[1].leads - a[1].leads).map(([k, v]) => `<tr><td>${esc(k)}</td><td class="v">${v.leads}</td><td class="v">${v.ganhos}</td><td class="v">${v.leads ? pct(v.ganhos / v.leads, 0) : '—'}</td></tr>`).join('')}</table></div>
        <div class="painel"><span class="rotulo">Obras e indicações</span>
          ${obras.map(({ x, et }) => `<div class="entre" style="padding:6px 0;border-top:1px dashed var(--linha)"><a href="#lead-${x.o.id}" style="color:inherit"><b>${esc(x.o.nome)}</b></a><span class="mini">${esc(et.e[1])}</span></div>`).join('') || '<p class="mini" style="margin:6px 0">Nenhuma obra em andamento.</p>'}
          ${inds.map((x) => `<div class="entre" style="padding:6px 0;border-top:1px dashed var(--linha)"><span><a href="#lead-${x.o.id}" style="color:inherit"><b>${esc(x.o.nome)}</b></a> <span class="mini">indicado por ${esc(x.o.indicadoPor)}</span></span>${x.o.status === 'ganho' ? (x.o.presenteEntregue ? '<span class="mini">🎁 presente entregue</span>' : `<button class="link" data-presente="${x.o.id}">🎁 marcar presente entregue</button>`) : `<span class="mini">${esc(x.o.status)}</span>`}</div>`).join('')}</div></div>`;
  }
  document.addEventListener('click', (e) => { const b = e.target.closest('[data-presente]'); if (!b) return; const o = B.obter(b.dataset.presente); if (!o) return; o.presenteEntregue = new Date().toISOString(); B.salvar(o); B.interacao(o.id, 'nota', 'Presente de indicação entregue a ' + o.indicadoPor); toast('Presente marcado'); render(); });

  /* ---------- PÓS-VENDA: da assinatura até a usina ligada ---------- */
  // [chave, etapa, prazo de referência em dias depois da etapa anterior, mensagem ao cliente]
  const POS_VENDA = [
    ['contrato', 'Contrato assinado', 0, '{nome}, contrato assinado! 🎉 Agora começa a parte boa. Vou te avisando aqui de cada etapa.'],
    ['projeto', 'Projeto e ART prontos', 5, '{nome}, o projeto da sua usina está pronto e assinado pelo engenheiro. Próximo passo: pedido na CPFL.'],
    ['protocolo', 'Pedido protocolado na CPFL', 2, '{nome}, já protocolamos o pedido da sua usina na CPFL. Agora é aguardar a aprovação (parecer de acesso).'],
    ['parecer', 'Parecer de acesso aprovado', 15, '{nome}, a CPFL aprovou o projeto! ✅ Já vamos agendar a instalação.'],
    ['kit', 'Kit entregue no local', 10, '{nome}, os equipamentos chegaram. Vamos combinar o melhor dia para a instalação?'],
    ['instalacao', 'Instalação concluída', 7, '{nome}, instalação concluída! ☀️ Agora pedimos a vistoria da CPFL para trocar o medidor.'],
    ['vistoria', 'Vistoria e troca do medidor', 7, '{nome}, a CPFL trocou o medidor. Sua usina está oficialmente ligada! Te mando o app para acompanhar a geração.'],
    ['ligada', 'Usina ligada e cadastrada no monitoramento', 3, '{nome}, cadastrei sua usina no nosso monitoramento. Todo mês te mando o relatório da economia. 🙌'],
  ];
  const diasEntre = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);
  function posVendaEtapa(o) { const pv = o.posVenda || {}; const i = POS_VENDA.findIndex(([k]) => !pv[k]); return i < 0 ? null : { i, e: POS_VENDA[i], desde: i ? pv[POS_VENDA[i - 1][0]] : ((o.aceite && o.aceite.em) || o.atualizadoEm || o.criadoEm || '').slice(0, 10) }; }
  function posVendaHtml(o) {
    const pv = o.posVenda || {}, atual = posVendaEtapa(o);
    return `<div class="painel" style="margin-top:14px"><div class="entre"><span class="rotulo">Pós-venda · da assinatura à usina ligada</span><span class="mini">${atual ? `agora: <b>${esc(atual.e[1])}</b>` : '✅ concluído'}</span></div>
      <div style="display:grid;gap:4px;margin-top:10px">${POS_VENDA.map(([k, t, prazo], i) => {
        const feito = pv[k], ehAtual = atual && atual.i === i, dias = ehAtual && atual.desde ? diasEntre(atual.desde, new Date().toISOString()) : 0;
        return `<div class="entre" style="padding:6px 0;border-top:1px dashed var(--linha)"><label class="chk" style="display:flex;gap:8px;align-items:center"><input type="checkbox" data-pv="${k}" ${feito ? 'checked' : ''} ${!feito && atual && i > atual.i ? 'disabled' : ''}> <span style="${feito ? 'opacity:.6' : ehAtual ? 'font-weight:700' : ''}">${esc(t)}</span></label>
          <span class="mini">${feito ? feito.split('-').reverse().join('/') : ehAtual ? `${dias} dia(s)${prazo && dias > prazo ? ` <span style="color:var(--laranja)">· passou do prazo de referência (${prazo} d)</span>` : prazo ? ` · ref. ${prazo} d` : ''}` : ''} ${feito ? `<button class="link" data-pv-zap="${k}">avisar cliente</button>` : ''}</span></div>`;
      }).join('')}</div>
      <p class="mini" style="margin:8px 0 0">Prazos de referência para você ser avisado de atraso; a CPFL tem os prazos dela conforme o tipo de ligação.</p></div>`;
  }
  /* indicação: link pessoal do cliente para o formulário público */
  const linkIndicacao = (o) => new URL('captacao.html?ind=' + encodeURIComponent(o.nome), location.href).href;
  const msgIndicacao = (o) => `${String(o.nome).split(' ')[0]}, que bom ter você com a gente! ☀️ Se conhecer alguém que paga caro de luz, manda esse link pra pessoa: ${linkIndicacao(o)}\nSe ela fechar, você ganha um presente de agradecimento 🎁`;

  /* ---------- botões Fechou / Perdeu ---------- */
  function modal(html) {
    const ov = document.createElement('div'); ov.className = 'modal-rapida'; ov.style.cssText = 'position:fixed;inset:0;z-index:80;background:#0009;display:grid;place-items:center;padding:16px';
    ov.innerHTML = `<div class="painel" style="max-width:520px;width:100%;max-height:92vh;overflow:auto">${html}</div>`; ov.onclick = (e) => { if (e.target === ov || e.target.closest('[data-fechar]')) ov.remove(); }; document.body.appendChild(ov); return ov;
  }
  function fecharGanho(o, depois) {
    let ops = []; try { ops = C.opcoes(o, P()); } catch { /* sem consumo */ }
    const esc0 = o.opcaoEscolhida ?? Math.max(ops.findIndex((x) => x.destaque), 0);
    const FP = [['avista', 'À vista (PIX/transferência)'], ['financiamento', 'Financiamento'], ['cartao', 'Cartão'], ['entrada', 'Entrada + parcelas']];
    const ov = modal(`<div class="entre"><span class="rotulo" style="color:var(--verde-claro)">✅ Fechou com ${esc(String(o.nome || '').split(' ')[0])}</span><button class="link" data-fechar>cancelar</button></div>
      ${ops.length ? `<p class="mini" style="margin:8px 0 4px">Qual opção ele comprou?</p><div style="display:grid;gap:6px">${ops.map((op, i) => `<label class="entre" style="border:1px solid var(--linha);border-radius:12px;padding:10px;cursor:pointer;gap:8px"><span><input type="radio" name="gOp" value="${i}" ${i === esc0 ? 'checked' : ''}> <b>${esc(op.nivel)}</b> · ${n(op.dim.kwpReal, 2)} kWp · ${op.dim.placas}× ${op.modulo.potenciaW} W</span><b>${brl(op.preco.precoFinal)}</b></label>`).join('')}</div>` : '<p class="mini" style="margin:8px 0">Este orçamento não tem opções calculadas. Informe o valor fechado:</p>'}
      <div class="grade g2" style="margin-top:10px"><label class="campo"><span>Valor fechado (R$)</span><input type="number" step="any" id="gValor" placeholder="${ops[esc0] ? Math.round(ops[esc0].preco.precoFinal) : ''}"></label>
        <label class="campo"><span>Forma de pagamento</span><select id="gPag">${FP.map(([v, t]) => `<option value="${v}" ${o.formaPagamento === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label></div>
      <div class="grade g2" style="margin-top:6px"><label class="campo"><span>Data do fechamento</span><input type="date" id="gData" value="${esc(String(o.ganhoEm || new Date(Date.now() - 3 * 3600e3).toISOString()).slice(0, 10))}" max="${new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10)}"></label>
        <label class="campo"><span>Observação (opcional)</span><input type="text" id="gObs" placeholder="ex.: desconto de 3% à vista"></label></div>
      <p class="mini" style="margin:4px 0 0">Fechou antes e esqueceu de marcar? Escolha a data real: a venda entra no mês certo do relatório.</p>
      <button class="btn sol" id="gOk" style="width:100%;margin-top:12px">Confirmar: cliente fechou</button>`);
    ov.querySelectorAll('[name=gOp]').forEach((r) => r.onchange = () => { const op = ops[+r.value]; if (op) ov.querySelector('#gValor').placeholder = Math.round(op.preco.precoFinal); });
    ov.querySelector('#gOk').onclick = () => {
      const i = +((ov.querySelector('[name=gOp]:checked') || {}).value ?? esc0); o.opcaoEscolhida = i; o.formaPagamento = ov.querySelector('#gPag').value;
      const dt = ov.querySelector('#gData').value; o.status = 'ganho'; o.ganhoEm = dt ? dt + 'T12:00:00.000Z' : o.ganhoEm || new Date().toISOString(); if (!o.enviadoEm || o.enviadoEm > o.ganhoEm) o.enviadoEm = o.ganhoEm;
      const c = compraDe(o) || { data: o.ganhoEm, descricao: 'Venda', valorTotal: 0, formaPagamento: o.formaPagamento };
      const vm = +ov.querySelector('#gValor').value; if (vm > 0) c.valorTotal = vm; c.data = o.ganhoEm; c.formaPagamento = o.formaPagamento; if (ov.querySelector('#gObs').value.trim()) c.obs = ov.querySelector('#gObs').value.trim();
      o.compras = [c, ...(o.compras || []).slice(1)]; o.valorFechado = c.valorTotal;
      o.posVenda = { ...(o.posVenda || {}), contrato: (o.posVenda || {}).contrato || o.ganhoEm.slice(0, 10) };
      o.arquivado = false; B.salvar(o); B.interacao && B.interacao(o.id, 'nota', `Fechou em ${o.ganhoEm.slice(0, 10).split('-').reverse().join('/')}: ${c.descricao || ''} · ${brl(c.valorTotal)} · ${o.formaPagamento}`);
      ov.remove(); toast(`🎉 Venda registrada: ${brl(c.valorTotal)}. ${o.nome} já está em Clientes, com o pós-venda começando.`); depois && depois();
    };
  }
  function marcarPerda(o, depois) {
    const MOT = ['Preço / achou caro', 'Fechou com concorrente', 'Financiamento negado', 'Sem condição agora', 'Parou de responder', 'Desistiu do projeto', 'Inviável tecnicamente', 'Outro'];
    const ov = modal(`<div class="entre"><span class="rotulo">❌ Perdeu ${esc(String(o.nome || '').split(' ')[0])}</span><button class="link" data-fechar>cancelar</button></div>
      <p class="mini" style="margin:8px 0">Qual foi o motivo?</p><div class="chips">${MOT.map((m) => `<button class="chip" data-mot="${esc(m)}">${esc(m)}</button>`).join('')}</div>
      <label class="campo" style="margin-top:10px"><span>Detalhe (opcional)</span><input type="text" id="pDet" placeholder="ex.: fechou com a X por R$ 2 mil a menos"></label>
      <label class="campo" style="margin-top:6px"><span>Retomar o contato em</span><select id="pRet"><option value="30">30 dias</option><option value="90" selected>90 dias</option><option value="180">6 meses</option><option value="0">não retomar</option></select></label>
      <button class="btn vidro" id="pOk" style="width:100%;margin-top:12px" disabled>Confirmar perda</button>`);
    let mot = ''; ov.querySelectorAll('[data-mot]').forEach((b) => b.onclick = () => { mot = b.dataset.mot; ov.querySelectorAll('[data-mot]').forEach((x) => x.classList.toggle('sel', x === b)); ov.querySelector('#pOk').disabled = false; });
    ov.querySelector('#pOk').onclick = () => {
      const det = ov.querySelector('#pDet').value.trim(), dias = +ov.querySelector('#pRet').value;
      o.status = 'perdido'; o.motivoPerda = det ? `${mot}: ${det}` : mot; o.perdidoEm = new Date().toISOString(); if (!o.enviadoEm) o.enviadoEm = o.perdidoEm;
      if (dias) { const q = new Date(Date.now() + dias * 864e5); q.setHours(9, 0, 0, 0); novoLembrete({ texto: `Retomar ${o.nome} (perdido: ${mot.toLowerCase()})`, ref: o.id, quando: q.toISOString() }); }
      B.salvar(o); B.interacao && B.interacao(o.id, 'nota', 'Perdido: ' + o.motivoPerda); ov.remove();
      toast(`Perda registrada (${mot}).${dias ? ` Retomada em ${dias} dias.` : ''} Em 7 dias vai para o Arquivo.`); depois && depois();
    };
  }
  /* o que o cliente comprou: fica gravado no fechamento (Groner traz as compras de lá) */
  function compraDe(o) {
    try { const ops = C.opcoes(o, P()), op = ops[o.opcaoEscolhida ?? 1] || ops.find((x) => x.destaque) || ops[0]; if (!op) return null;
      const k = (o.kitsFechados || []).find((x) => x && x.nivel === op.nivel) || null;
      const inv = k && k.inversor ? [k.inversor.qtd > 1 ? k.inversor.qtd + '×' : '', k.inversor.marca || '', k.inversor.nome || k.inversor.modelo || ''].join(' ').trim() : (op.inversor && op.inversor.nome) || '';
      return { data: new Date().toISOString(), descricao: `${op.nivel} · ${n(op.dim.kwpReal, 2)} kWp`, kwp: op.dim.kwpReal, placas: (k && k.modulo && k.modulo.qtd) || op.dim.placas, placa: (k && k.modulo && [k.modulo.marca, k.modulo.nome].filter(Boolean).join(' ')) || op.modulo.nome, placaW: (k && k.modulo && k.modulo.potenciaW) || op.modulo.potenciaW, inversor: inv,
        valorTotal: Math.round(op.preco.precoFinal * 100) / 100, formaPagamento: o.formaPagamento || '', numeroBelenergy: k && k.numeroBelenergy || '', itens: ((k && k.itens) || []).map((i) => ({ nome: i.nome || i.descricao || '', qtd: i.qtd || i.quantidade || '', grupo: i.grupo || '' })).slice(0, 40) };
    } catch { return null; }
  }
  const resumoCompra = (o) => { const c = (o.compras || [])[0]; if (!c) return ''; const tot = (o.compras || []).reduce((t, x) => t + (+x.kwp || 0), 0); return `${n(tot || c.kwp, 2)} kWp${c.placas ? ` · ${c.placas}× ${c.placaW || ''}W` : ''}${c.inversor ? ` · ${String(c.inversor).replace(/INVERSOR( DE CORRENTE)?/i, '').trim().slice(0, 40)}` : ''}`; };
  function painelCompra(o) {
    const cs = o.compras || [];
    return `<div class="painel entra" id="compraBox"><div class="entre"><span class="rotulo">🛒 O que ${esc(String(o.nome || '').split(' ')[0])} comprou</span>${o.valorFechado || cs.length ? `<b>${brl(cs.reduce((t, c) => t + (+c.valorTotal || 0), 0) || o.valorFechado)}</b>` : ''}</div>
      ${cs.length ? cs.map((c) => `<div style="border-top:1px dashed var(--linha);padding-top:8px;margin-top:8px">
          <div class="entre"><b>${esc(c.descricao || `${n(c.kwp, 2)} kWp`)}</b><span class="mini">${c.data ? new Date(c.data).toLocaleDateString('pt-BR') : ''}</span></div>
          <div class="numeros4" style="margin-top:6px"><div><span>Potência</span><b>${n(c.kwp, 2)} kWp</b></div><div><span>Placas</span><b>${c.placas || '–'}${c.placaW ? ` × ${c.placaW} W` : ''}</b></div><div><span>Inversor</span><b style="font-size:14px">${esc(c.inversor || '–')}</b></div><div><span>Valor</span><b>${brl(c.valorTotal)}</b></div></div>
          ${c.placa ? `<p class="mini" style="margin:6px 0 0">Placa: ${esc(c.placa)}</p>` : ''}
          ${+c.valorProduto || +c.valorServico || +c.valorFinanciado || c.formaPagamento ? `<p class="mini" style="margin:4px 0 0">${+c.valorProduto ? `kit ${brl(c.valorProduto)} · ` : ''}${+c.valorServico ? `serviço ${brl(c.valorServico)} · ` : ''}${+c.valorFinanciado ? `financiado ${brl(c.valorFinanciado)} · ` : ''}${c.formaPagamento ? 'pagamento: ' + esc(c.formaPagamento) : ''}${c.numeroBelenergy ? ' · Belenergy ' + esc(c.numeroBelenergy) : ''}</p>` : ''}
          ${(c.itens || []).length ? `<details style="margin-top:6px"><summary class="mini" style="cursor:pointer">Itens do kit (${c.itens.length})</summary>${c.itens.map((i) => `<div class="entre mini" style="padding:2px 0"><span>${esc(i.nome || i.cod || '')}${i.grupo ? ` <span style="opacity:.6">· ${esc(i.grupo)}</span>` : ''}</span><b>${esc(String(i.qtd || ''))}</b></div>`).join('')}</details>` : ''}</div>`).join('')
        : `<p class="mini" style="margin:6px 0">Ainda sem os equipamentos registrados.${o.status === 'ganho' ? ' <button class="link" id="compraGerar">Puxar do orçamento</button>' : ''}</p>`}
      <label class="campo" style="margin-top:8px"><span>Anotações da compra (garantias, número de série, observações)</span><textarea id="compraNota" rows="2">${esc(o.compraNota || '')}</textarea></label></div>`;
  }
  async function painelArquivos(o, el) {
    let lista = []; try { lista = (await B.arquivosCliente(o.id)) || []; } catch { /* sem nuvem */ }
    const PASTAS = ['Contratos e procurações', 'Documentos pessoais', 'Contas de luz', 'Visita técnica', 'Projeto', 'Financeiro', 'Outros'];
    const grupos = {}; lista.forEach((a) => { (grupos[a.pasta] = grupos[a.pasta] || []).push(a); });
    const ico = (a) => /pdf/.test(a.tipo) ? '📄' : /image/.test(a.tipo) ? '🖼️' : /zip/.test(a.tipo) ? '🗜️' : /video/.test(a.tipo) ? '🎬' : '📎';
    el.innerHTML = `<div class="entre"><span class="rotulo">📁 Documentos e fotos (${lista.length})</span><label class="btn vidro pequeno" style="cursor:pointer">＋ Enviar arquivo<input type="file" id="arqEnv" multiple hidden></label></div>
      <div class="grade g2" style="margin-top:6px"><label class="campo"><span>Pasta para os novos arquivos</span><select id="arqPasta">${PASTAS.map((x) => `<option>${x}</option>`).join('')}</select></label></div>
      ${lista.length ? Object.keys(grupos).sort((a, b) => (PASTAS.indexOf(a) + 99) % 99 - (PASTAS.indexOf(b) + 99) % 99).map((g) => `<details ${/Contratos/.test(g) ? 'open' : ''} style="margin-top:6px"><summary style="cursor:pointer;font-weight:700">${esc(g)} <span class="mini">(${grupos[g].length})</span></summary>
          ${grupos[g].map((a) => `<div class="entre mini" style="padding:4px 0;border-top:1px dashed var(--linha)"><button class="link" data-arqab="${a.id}" style="text-align:left">${ico(a)} ${esc(a.nome)}</button><span>${a.tamanho ? n(a.tamanho / 1e6, 1) + ' MB' : ''} <button class="link" data-arqdel="${a.id}" title="apagar">✕</button></span></div>`).join('')}</details>`).join('') : '<p class="mini" style="margin:6px 0">Nenhum arquivo ainda. Contrato, procuração, RG/CNH, conta de luz e fotos da visita ficam aqui.</p>'}`;
    el.querySelectorAll('[data-arqab]').forEach((b) => b.onclick = async () => { const a = lista.find((x) => x.id === b.dataset.arqab); const w = window.open('', '_blank'); try { const u = await B.linkArquivo(a.caminho); if (w) w.location = u; else location.href = u; } catch (e) { if (w) w.close(); toast(e.message); } });
    el.querySelectorAll('[data-arqdel]').forEach((b) => b.onclick = async () => { const a = lista.find((x) => x.id === b.dataset.arqdel); if (!confirm(`Apagar "${a.nome}"? Não dá para desfazer.`)) return; try { await B.apagarArquivo(a); toast('Arquivo apagado'); painelArquivos(o, el); } catch (e) { toast(e.message); } });
    $('#arqEnv').onchange = async (e) => { const fs = [...e.target.files], pasta = $('#arqPasta').value; let k = 0; for (const f of fs) { try { await B.enviarArquivo(o.id, pasta, f); k++; } catch (er) { toast(`${f.name}: ${er.message}`); } } if (k) toast(`${k} arquivo(s) guardado(s) em ${pasta}`); painelArquivos(o, el); };
  }
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
            <div class="linha-h" style="margin-top:8px"><select id="status" style="width:auto;padding:7px 10px;font-size:14px">${STATUS.map(([s, r]) => `<option value="${s}" ${o.status === s ? 'selected' : ''}>${r}</option>`).join('')}</select>${o.status !== 'ganho' ? '<button class="btn sol pequeno" id="fGanho">✅ Fechou</button>' : ''}${o.status !== 'perdido' && o.status !== 'ganho' ? '<button class="btn vidro pequeno" id="fPerda">❌ Perdeu</button>' : ''}<button class="btn vidro pequeno" id="fNova" title="Outra proposta para o mesmo cliente (ex.: outro tamanho, bateria, outro endereço)">＋ Nova proposta</button><button class="btn vidro pequeno" id="fExcluir">🗑 Excluir</button>
            ${o.status === 'ganho' ? `<label class="mini" style="display:inline-flex;align-items:center;gap:6px">fechado em <input type="date" id="fGanhoEm" value="${esc(String(o.ganhoEm || '').slice(0, 10))}" max="${new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10)}" style="width:auto;padding:5px 8px;font-size:13px"></label>` : ''}
            ${o.status === 'perdido' ? `<input type="text" id="motivo" placeholder="Motivo da perda" value="${esc(o.motivoPerda)}" style="flex:1;min-width:180px;padding:7px 10px;font-size:14px">` : ''}</div></div>
        </div>
        <div class="proxima" style="margin-top:14px"><div class="ic">${acao.icone}</div><div><span class="rotulo" style="color:var(--sol)">Próxima melhor ação</span><div style="font-weight:600;margin-top:4px">${esc(acao.texto)}</div></div></div>${alertasPrecoHtml(o)}
        <div class="linha-h" style="margin-top:10px;gap:6px;flex-wrap:wrap"><span class="mini">📌 Próximo contato:</span>${[['amanhã', 1], ['3 dias', 3], ['1 semana', 7], ['15 dias', 15]].map(([t, d]) => `<button class="chip" data-prox="${d}">${t}</button>`).join('')}${lembretes().filter((l) => l.ref === o.id).map((l) => `<span class="mini" style="color:var(--sol)">· ${esc(l.texto)} em ${new Date(l.quando).toLocaleDateString('pt-BR')}</span>`).join('')}</div>
        <div class="painel" style="margin-top:12px" id="resumoCv"><span class="rotulo">📝 Como ficou a conversa</span>
          <textarea id="rsTxt" rows="2" placeholder="Escreva do seu jeito: liguei, ela gostou, vai ver com o marido no fim de semana e pediu para simular no banco" style="width:100%;margin-top:8px"></textarea>
          <div class="acoes-r" style="margin-top:6px"><button class="btn vidro pequeno" id="rsVoz">🎙 Ditar</button><button class="btn sol pequeno" id="rsOk">Organizar o funil</button></div><div id="rsRes"></div></div>
        <div class="painel" style="margin-top:12px" id="conversa"><span class="rotulo">💬 O cliente respondeu</span>
          <textarea id="cvTxt" rows="2" placeholder="Cole aqui o que o cliente disse (ex.: achei caro, vou falar com minha esposa)" style="width:100%;margin-top:8px"></textarea>
          <div class="acoes-r" style="margin-top:6px"><button class="btn vidro pequeno" id="cvOk">O que eu respondo?</button></div><div id="cvRes"></div></div>
        <div class="acoes-r" style="margin-top:14px">
          <a class="btn sol pequeno" href="${linkProposta(o, true)}" id="abrirPV">Abrir Proposta Viva</a>
          <a class="btn zap pequeno" href="https://wa.me/55${String(o.whatsapp).replace(/\D/g, '')}?text=${encodeURIComponent(msgZap)}" target="_blank" rel="noopener" id="enviarZap">Enviar no WhatsApp</a>
          <button class="btn vidro pequeno" id="copiarLink">Copiar link</button>
          <button class="btn vidro pequeno" id="editar">Editar orçamento</button>
        </div>
      </div>
      ${o.status === 'ganho' ? posVendaHtml(o) : ''}
      ${o.status === 'ganho' ? `<div class="painel" style="margin-top:14px"><div class="entre"><span class="rotulo">Indicação</span><span class="mini">${B.orcamentos().filter((x) => x.indicadoPor && x.indicadoPor.trim().toLowerCase() === String(o.nome).trim().toLowerCase()).length} indicação(ões) deste cliente</span></div>
        <p class="sutil" style="margin:6px 0 8px">Link pessoal: quem entrar por ele já chega marcado como indicação de ${esc(String(o.nome).split(' ')[0])}.</p>
        <div class="acoes-r"><button class="btn vidro pequeno" id="copiarInd">Copiar link de indicação</button><a class="btn zap pequeno" target="_blank" rel="noopener" href="https://wa.me/55${String(o.whatsapp).replace(/\D/g, '').replace(/^55/, '')}?text=${encodeURIComponent(msgIndicacao(o))}">Mandar no WhatsApp</a></div></div>` : ''}
      <div class="painel" style="margin-top:14px">
        <div class="entre"><span class="rotulo">Documentos</span><span class="mini">${(() => { const f = Documentos.faltando(o, p); return f.length ? 'Falta: ' + esc(f.join(', ')) : 'Tudo pronto para contrato e procuração'; })()}</span></div>
        <div class="acoes-r" style="margin-top:10px">
          <button class="btn sol pequeno" id="docPdf">${Icone('documento')} Proposta em PDF</button>
          <button class="btn vidro pequeno" id="docContrato">Contrato</button>
          <button class="btn vidro pequeno" id="docProc">Procuração CPFL</button>
          ${o.projeto3d && o.projeto3d.resultado ? '<button class="btn vidro pequeno" id="docLaudo">📐 Laudo técnico (sombra e geração)</button>' : ''}
          <button class="btn vidro pequeno" id="docVideo">🎥 Vídeo da proposta${o.videoApresentacao ? ' ✓' : ''}</button>
          <span id="anexosBel"></span>
          ${(o.kitsFechados || []).filter((k) => k && /WEB/.test(k.numeroBelenergy || '')).map((k) => `<span class="chip">${esc(k.nivel)}: ${esc(k.numeroBelenergy)}</span>`).join(' ')}
          ${o.status === 'ganho' ? '<button class="btn sol pequeno" id="docOS">🛠️ Ordem de serviço (instalador)</button><button class="btn vidro pequeno" id="virarUsina">Cadastrar usina</button>' : ''}
        </div>
        <details style="margin-top:10px"><summary class="link">Dados do cliente para contrato e procuração</summary>
          <div class="grade g2" style="margin-top:10px">${[['documento', 'CPF ou CNPJ'], ['rua', 'Rua / estrada'], ['numero', 'Número'], ['bairro', 'Bairro'], ['cep', 'CEP'], ['cidade', 'Cidade (se diferente)'], ['instalacao', 'Nº da instalação na CPFL'], ['rg', 'RG'], ['estadoCivil', 'Estado civil'], ['profissao', 'Profissão'], ['condicao', 'Condição de pagamento (Anexo 1)'], ['garantiaModulo', 'Garantia do módulo (anos, ficha técnica)'], ['garantiaEficiencia', 'Garantia de desempenho do módulo (anos)'], ['degradacao', 'Perda de potência ao ano (ex.: 0,4%)'], ['garantiaInversor', 'Garantia do inversor (anos, ficha técnica)']]
            .map(([c, r]) => `<label class="campo"><span>${r}</span><input type="text" data-ct="${c}" value="${esc((o.contrato || {})[c] || '')}"></label>`).join('')}</div>
          <div class="acoes-r" style="margin-top:8px"><button class="btn sol pequeno" id="ctSalvar">Salvar dados</button></div>
        </details>
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
              <div style="grid-column:1/-1"><span>Equipamento</span><b style="font-size:15px">${esc(C.equipamentos(a.op).modulo)} · ${esc(C.equipamentos(a.op).inversor)}</b></div>
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
    if ($('#copiarInd')) $('#copiarInd').onclick = () => copiar(linkIndicacao(o));
    app.querySelectorAll('[data-pv]').forEach((c) => c.onchange = () => { o.posVenda = { ...(o.posVenda || {}) }; if (c.checked) o.posVenda[c.dataset.pv] = new Date().toISOString().slice(0, 10); else delete o.posVenda[c.dataset.pv]; B.salvar(o); B.interacao(o.id, 'nota', `Pós-venda · ${POS_VENDA.find((x) => x[0] === c.dataset.pv)[1]}${c.checked ? '' : ' (desmarcado)'}`); ficha(id); });
    app.querySelectorAll('[data-pv-zap]').forEach((b) => b.onclick = () => { const e = POS_VENDA.find((x) => x[0] === b.dataset.pvZap); window.open('https://wa.me/55' + String(o.whatsapp).replace(/\D/g, '').replace(/^55/, '') + '?text=' + encodeURIComponent(e[3].replace('{nome}', String(o.nome).split(' ')[0])), '_blank', 'noopener'); B.interacao(o.id, 'whatsapp', 'Pós-venda · avisou: ' + e[1]); });
    B.anexos(o.id).then((l) => { const el = $('#anexosBel'); if (!el || !l || !l.length) return; el.innerHTML = l.map((a) => `<button class="btn vidro pequeno" data-anexo="${a.id}">📎 ${esc(a.nome)}</button>`).join(' ');
      el.querySelectorAll('[data-anexo]').forEach((b) => b.onclick = async () => { const a = await B.anexo(b.dataset.anexo); if (!a) return toast('Anexo não encontrado'); const bin = atob(a.conteudo_b64), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); window.open(URL.createObjectURL(new Blob([u8], { type: a.tipo })), '_blank'); }); }).catch(() => {});
    $('#docPdf').onclick = () => { if (!podeEnviar(o)) return; Documentos.proposta(o, p, o.status !== 'novo' ? link : null); B.interacao(o.id, 'nota', 'Gerou a proposta em PDF'); };
    if ($('#enviarZap')) $('#enviarZap').addEventListener('click', (e) => { if (!podeEnviar(o)) e.preventDefault(); });
    if ($('#docOS')) $('#docOS').onclick = () => ordemServico(o, p);
    if ($('#docLaudo')) $('#docLaudo').onclick = () => { Documentos.laudo(o, p); B.interacao(o.id, 'nota', 'Gerou o laudo técnico do 3D'); };
    $('#docVideo').onclick = () => { if (!window.Apresentacao) return toast('Recarregue a página para usar o vídeo.'); if (!podeEnviar(o)) return; Apresentacao.abrir(o, { aoSalvar: (x) => { B.salvar(x); B.interacao(o.id, 'nota', 'Colocou o vídeo de apresentação na proposta'); toast('Vídeo na proposta ✓'); } }); };
    $('#docContrato').onclick = () => Documentos.contrato(o, p);
    $('#docProc').onclick = () => Documentos.procuracao(o, p);
    if ($('#virarUsina')) $('#virarUsina').onclick = () => { location.hash = '#usinas'; setTimeout(() => formUsina({ cliente_nome: o.nome, whatsapp: o.whatsapp, cidade: o.cidade, kwp: a.op.dim.kwpReal, marca: (C.equipamentos(a.op).fabInv || '').toLowerCase().replace(/^./, (x) => x.toUpperCase()), esperado_mes: a.op.dim.geracaoMes, tarifa_kwh: o.tarifaKwh }), 200); };
    $('#ctSalvar').onclick = () => { o.contrato = { ...(o.contrato || {}) }; app.querySelectorAll('[data-ct]').forEach((x) => { o.contrato[x.dataset.ct] = x.value.trim(); }); B.salvar(o); toast('Dados do contrato salvos'); ficha(o.id); };
    $('#abrirPV').onclick = () => { try { sessionStorage.setItem('sol2_abrir', JSON.stringify({ t: o.token, v: 1 })); } catch { /* sem armazenamento */ } };
    if ($('#enviarZap')) $('#enviarZap').onclick = () => { if (o.status === 'novo') { o.status = 'proposta'; o.enviadoEm = new Date().toISOString(); B.salvar(o); } B.interacao(o.id, 'whatsapp', 'Proposta enviada'); };
    $('#editar').onclick = () => { B.rascunho.gravar(o); B.rascunho.gravarEtapa(0); location.hash = '#novo'; };
    /* simulador de conversa: entende a resposta do cliente, sugere o caminho e aprende com o que você usa */
    const rep = () => P().repertorio || [];
    const INT = [{ id: 'aceitou', t: 'Cliente quer fechar', k: ['fechar', 'vamos fazer', 'pode fazer', 'quero fazer', 'aceito', 'bora', 'pode mandar o contrato'], r: () => `Que notícia boa, ${o.nome.split(' ')[0]}! Você tomou uma decisão que vai fazer diferença por mais de 20 anos. Vou te mandar agora o contrato para você conferir com calma: está tudo ali, os equipamentos, a garantia, a geração prevista e o prazo de instalação. Assim que assinar, já reservo a data na agenda da nossa equipe e começo a homologação com a CPFL, que é o que mais demora, então quanto antes, mais cedo você começa a economizar.\n\nFica melhor você assinar pelo celular hoje ainda ou amanhã cedo?`, prox: 1, st: 'negociando' },
      { id: 'financiamento', t: 'Pediu financiamento', k: ['financ', 'parcel', 'banco', 'prestação', 'prestacao', 'boleto'], r: () => `Consigo sim, e é o caminho que a maioria dos nossos clientes escolhe, porque a parcela fica perto do que já se paga de conta. Na proposta deixei uma estimativa de ${a.boleto.prazo}x de ${brl(a.boleto.parcela)}, mas o valor exato depende da análise do banco. Trabalho com mais de um banco e linha específica para energia solar, então consigo comparar e te trazer a melhor condição, não só a primeira que aparecer.\n\nPara simular de verdade preciso só do seu CPF e de uma ideia da renda mensal. Não tem compromisso nenhum: é só para você ver o número real. Prefere me mandar por aqui ou que eu te ligue rapidinho para preencher junto?`, prox: 2, st: 'negociando' },
      { id: 'sumiu', t: 'Sem resposta', k: ['não respondeu', 'nao respondeu', 'sumiu', 'visualizou e não'], r: () => `Oi ${o.nome.split(' ')[0]}, tudo bem? Sei que a rotina é corrida, então vou direto ao ponto. Preparei sua proposta com base na sua conta e o resultado ficou bem interessante: a conta cai para perto de ${brl(a.boleto.contaDepois)} e o sistema se paga em ${n(a.op.eco.paybackAnos, 1)} anos. Só não quero que você perca a condição atual, porque o kit tem validade de preço com o fornecedor.\n\nVocê prefere que eu te explique em 5 minutinhos por ligação, ou te mando um áudio rápido resumindo os pontos principais?`, prox: 3 }];
    const entenderResp = (txt) => { const t = txt.toLowerCase(), i = INT.find((x) => x.k.some((k) => t.includes(k))); if (i) return { id: i.id, t: i.t, resposta: i.r(), prox: i.prox, st: i.st };
      const ob = A.lista.find((x) => x.id === 'objecoes').fn({ o, a, texto: txt }); return ob.blocos.length === 1 ? { id: 'obj:' + ob.blocos[0].titulo, t: ob.blocos[0].titulo, resposta: ob.blocos[0].texto, prox: 2 } : { id: 'geral', t: 'Resposta livre', resposta: '', prox: 2 }; };
    const cvMostrar = () => {
      const txt = $('#cvTxt').value.trim(); if (!txt) return; const r = entenderResp(txt), minhas = rep().filter((x) => x.id === r.id).sort((x, y) => (y.usos || 0) - (x.usos || 0)).slice(0, 3);
      const opc = [...minhas.map((m) => ({ txt: m.texto, de: `sua resposta · usada ${m.usos || 0}×` })), ...(r.resposta ? [{ txt: r.resposta, de: 'sugestão do agente' }] : [])];
      $('#cvRes').innerHTML = `<p class="mini" style="margin:8px 0 4px">Entendi: <b>${esc(r.t)}</b>. Caminho: ${r.st === 'negociando' ? 'passar para "Negociando" e ' : ''}responder agora e voltar a falar em ${r.prox} dia(s).</p>
        ${opc.map((x, k) => `<div class="painel" style="margin-top:6px"><span class="mini">${x.de}</span><textarea data-cvop="${k}" rows="3" style="width:100%;margin-top:4px">${esc(x.txt)}</textarea>
          <div class="acoes-r" style="margin-top:4px"><button class="btn zap pequeno" data-cvusar="${k}">Mandar no WhatsApp</button></div></div>`).join('') || '<p class="mini">Escreva a sua resposta e mande: ela entra no seu repertório.</p><textarea data-cvop="0" rows="3" style="width:100%"></textarea><div class="acoes-r"><button class="btn zap pequeno" data-cvusar="0">Mandar no WhatsApp</button></div>'}
        <p class="mini" style="margin-top:6px">O que você mandar (do jeito que ajustou) fica no seu repertório e aparece primeiro na próxima vez.</p>`;
      $('#cvRes').querySelectorAll('[data-cvusar]').forEach((bt) => bt.onclick = () => {
        const texto = $('#cvRes').querySelector(`[data-cvop="${bt.dataset.cvusar}"]`).value.trim(); if (!texto) return;
        const lista = rep(), ja = lista.find((x) => x.id === r.id && x.texto === texto); if (ja) ja.usos = (ja.usos || 0) + 1; else lista.push({ id: r.id, tema: r.t, cliente: txt.slice(0, 200), texto, usos: 1 });
        B.salvarParametros({ repertorio: lista.slice(-300) });
        window.open('https://wa.me/55' + String(o.whatsapp || '').replace(/\D/g, '').replace(/^55/, '') + '?text=' + encodeURIComponent(texto), '_blank', 'noopener');
        B.interacao(o.id, 'nota', `Cliente: "${txt.slice(0, 120)}" → respondi (${r.t})`);
        if (r.st && ['proposta', 'visualizou'].includes(o.status)) { o.status = r.st; B.salvar(o); }
        novoLembrete({ texto: `Retomar ${o.nome} (${r.t})`, ref: o.id, quando: new Date(Date.now() + r.prox * 864e5).toISOString() });
        toast(`Resposta guardada no repertório · lembrete em ${r.prox} dia(s)`); ficha(id);
      });
    };
    $('#cvOk').onclick = cvMostrar;
    /* resumo da conversa → etapa, lembretes e anotação (confirma antes) */
    const ETQ = Object.fromEntries(STATUS);
    $('#rsOk').onclick = () => {
      const txt = $('#rsTxt').value.trim(); if (!txt) return; const r = window.ResumoConversa.analisar(txt, o);
      $('#rsRes').innerHTML = `<div style="margin-top:8px">${r.etapa && r.etapa !== o.status ? `<label class="chk"><input type="checkbox" data-rs="etapa" checked> Mudar a etapa para <b>${esc(ETQ[r.etapa] || r.etapa)}</b>${r.motivo ? ` (motivo: ${esc(r.motivo)})` : ''}</label>` : ''}
        ${r.acoes.map((x, k) => `<label class="chk" style="display:flex;gap:6px;margin-top:4px"><input type="checkbox" data-rs="${k}" checked> 📌 ${esc(x.texto)} · <input type="datetime-local" data-rsq="${k}" value="${new Date(new Date(x.quando).getTime() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16)}" style="padding:2px 6px;font-size:13px"></label>`).join('')}
        <label class="chk" style="margin-top:4px"><input type="checkbox" data-rs="nota" checked> Guardar o resumo na ficha</label>
        <div class="acoes-r" style="margin-top:8px"><button class="btn sol pequeno" id="rsAplicar">✓ Aplicar</button></div></div>`;
      $('#rsAplicar').onclick = () => {
        const on = (k) => { const x = $('#rsRes').querySelector(`[data-rs="${k}"]`); return x && x.checked; };
        if (on('etapa')) { o.status = r.etapa; if (r.motivo) o.motivoPerda = r.motivo; if (r.etapa === 'ganho' && !o.ganhoEm) o.ganhoEm = new Date().toISOString(); B.salvar(o); }
        r.acoes.forEach((x, k) => { if (on(k)) novoLembrete({ texto: x.texto, ref: o.id, quando: new Date($('#rsRes').querySelector(`[data-rsq="${k}"]`).value).toISOString() }); });
        if (on('nota')) B.interacao(o.id, 'nota', 'Resumo: ' + txt);
        toast('Funil atualizado: etapa, lembretes e anotação'); ficha(id);
      };
    };
    $('#rsVoz').onclick = () => { const R = window.SpeechRecognition || window.webkitSpeechRecognition; if (!R) { toast('Ditado funciona no Chrome e no Edge'); return; } const rec = new R(); rec.lang = 'pt-BR'; rec.interimResults = false; rec.onresult = (e) => { $('#rsTxt').value = ($('#rsTxt').value + ' ' + e.results[0][0].transcript).trim(); }; rec.onend = () => { $('#rsVoz').textContent = '🎙 Ditar'; }; rec.start(); $('#rsVoz').textContent = '● ouvindo…'; };
    app.querySelectorAll('[data-prox]').forEach((bt) => bt.onclick = () => { const d = +bt.dataset.prox, q = new Date(Date.now() + d * 864e5); q.setHours(9, 0, 0, 0); novoLembrete({ texto: `Falar com ${o.nome}`, ref: o.id, quando: q.toISOString() }); toast('Próximo contato marcado no Meu dia'); ficha(id); });
    { const irmas = propostasDoCliente(o).filter((x) => x.id !== o.id);
      if (irmas.length) { const box = document.createElement('div'); box.className = 'painel entra'; box.innerHTML = `<span class="rotulo">Outras propostas de ${esc(String(o.nome || '').split(' ')[0])} (${irmas.length})</span>${irmas.map((x) => `<a class="entre mini" href="#lead-${x.id}" style="padding:6px 0;border-top:1px dashed var(--linha);text-decoration:none;color:inherit"><span><b>${esc(x.id)}</b> · ${esc(x.titulo || ((x.consumos || []).filter(Boolean).length ? 'conta de ' + Math.round(((x.consumos || []).map(Number).filter((v) => v > 0).reduce((a, b, _, l) => a + b / l.length, 0))) + ' kWh' : 'proposta'))}${x.arquivado ? ' · no arquivo' : ''}</span><span>${esc((STATUS.find(([v]) => v === x.status) || [, x.status])[1])} · ${tempoRel(x.criadoEm)}</span></a>`).join('')}`; const topo = app.querySelector('.painel'); if (topo) topo.after(box); } }
    if (o.status === 'ganho' || o.carteira) {
      const cb = document.createElement('div'); cb.innerHTML = painelCompra(o); const ref0 = app.querySelector('.painel'); if (ref0) ref0.after(cb.firstElementChild);
      const nota = $('#compraNota'); if (nota) nota.onchange = () => { o.compraNota = nota.value; B.salvar(o); toast('Anotação salva'); };
      const ger = $('#compraGerar'); if (ger) ger.onclick = () => { const c = compraDe(o); if (!c) { toast('Este orçamento não tem kit para puxar'); return; } o.compras = [c]; B.salvar(o); ficha(id); };
    }
    { const ab = document.createElement('div'); ab.className = 'painel entra'; ab.id = 'arqBox'; ab.innerHTML = '<span class="rotulo">📁 Documentos e fotos</span><p class="mini">carregando…</p>'; const ref1 = app.querySelector('#compraBox') || app.querySelector('.painel'); if (ref1) ref1.after(ab); painelArquivos(o, ab); }
    if ($('#fGanho')) $('#fGanho').onclick = () => fecharGanho(o, () => ficha(id));
    if ($('#fPerda')) $('#fPerda').onclick = () => marcarPerda(o, () => ficha(id));
    $('#fNova').onclick = () => { const n = novaPropostaDe(o); toast(`Nova proposta para ${o.nome}: os dados do cliente já vieram`); location.hash = '#novo'; void n; };
    $('#fExcluir').onclick = (ev) => { const b = ev.currentTarget; if (!b.dataset.c) { b.dataset.c = 1; b.textContent = 'Tocar de novo para excluir'; setTimeout(() => { if (b.isConnected) { b.textContent = '🗑 Excluir'; delete b.dataset.c; } }, 4000); return; }
      o.apagado = true; o.apagadoEm = new Date().toISOString(); B.salvar(o); toast(`${o.nome} foi para a lixeira (Arquivo → Lixeira). Dá para restaurar.`); location.hash = '#painel'; };
    if ($('#fGanhoEm')) $('#fGanhoEm').onchange = (e) => { if (!e.target.value) return; o.ganhoEm = e.target.value + 'T12:00:00.000Z'; if (o.compras && o.compras[0]) o.compras[0].data = o.ganhoEm; B.salvar(o); B.interacao(o.id, 'nota', 'Data do fechamento ajustada para ' + e.target.value.split('-').reverse().join('/')); toast('Data do fechamento salva: ' + e.target.value.split('-').reverse().join('/')); };
    $('#status').onchange = (e) => { if (e.target.value === 'ganho' && o.status !== 'ganho') { e.target.value = o.status; fecharGanho(o, () => ficha(id)); return; } o.status = e.target.value; if (o.status === 'perdido') { const q = new Date(Date.now() + 90 * 864e5); q.setHours(9, 0, 0, 0); novoLembrete({ texto: `Retomar ${o.nome} (perdido há 90 dias: preço e momento mudam)`, ref: o.id, quando: q.toISOString() }); toast('Perdido: retomada agendada em 90 dias. Anote o motivo.'); } if (o.status !== 'novo' && !o.enviadoEm) o.enviadoEm = new Date().toISOString(); if (o.status === 'ganho' && !o.ganhoEm) o.ganhoEm = new Date().toISOString(); if (o.status === 'ganho' && !(o.compras || []).length) { const c = compraDe(o); if (c) { o.compras = [c]; o.valorFechado = c.valorTotal; } } B.salvar(o); ficha(id); };
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
      if (b.tipo === 'abordagens') return blocoAbordagens(b, o, i);
      if (b.tipo === 'cadencia') return `<div class="bloco"><h4>Cadência</h4>${b.itens.map((c) => `<div class="cad"><div class="d">D+${c.d}<small>${esc(c.data || '')}</small></div><div><b>${esc(c.canal)} · ${esc(c.t)}</b><p>${esc(c.msg)}</p></div></div>`).join('')}</div>`;
      if (b.tipo === 'tabela') return `<div class="bloco"><table><tr>${b.cab.map((h, j) => `<th class="${j ? 'v' : ''}">${esc(h)}</th>`).join('')}</tr>${b.linhas.map((l) => `<tr>${l.map((c, j) => `<td class="${j ? 'v' : ''}">${esc(c)}</td>`).join('')}</tr>`).join('')}</table></div>`;
      return '';
    }).join('')}</div>`;
  }

  /* Abordagens do follow-up: dias como abas, 3 cards por dia, texto editável, copiar / WhatsApp / marcar feito */
  let abDia = null;
  function blocoAbordagens(b, o, i) {
    const dia = b.passos.find((p) => p.id === abDia) ? abDia : b.atual;
    const p = b.passos.find((x) => x.id === dia);
    const dias = b.passos.map((x) => `<button class="aba ${x.id === dia ? 'sel' : ''}" data-ab-dia="${x.id}">${x.feito ? '✓ ' : x.atual ? '● ' : ''}D+${x.dia >= 1 ? x.dia : 0}<small style="display:block;font-weight:500;font-size:11px;opacity:.8">${esc(x.data)}</small></button>`).join('');
    const cards = p.variantes.map((v, k) => `<label class="ab-card ${b.destaque === v.tec ? 'dest' : ''}"><div class="entre"><span><input type="radio" name="ab-sel" value="${k}" ${k === 0 ? 'checked' : ''}> <b>${esc(v.titulo)}</b></span>${b.destaque === v.tec ? '<span class="chip">indicada agora</span>' : ''}</div>
        <span class="mini">${esc(v.tecnica)}</span><textarea data-ab-txt="${k}" rows="${Math.min(Math.max(Math.ceil(v.texto.length / 70), 3), 8)}">${esc(v.texto)}</textarea></label>`).join('');
    return `<div class="bloco" data-ab-bloco="${i}"><h4>Dia a dia</h4><div class="abas ab-dias">${dias}</div>
      <p style="margin:4px 0 10px"><b>${esc(p.titulo)}</b> · ${p.canal === 'ligacao' ? '📞 ligação (use o texto como roteiro)' : '💬 WhatsApp'}<br><span class="mini">${esc(p.porque)}</span></p>
      <div class="ab-lista">${cards}</div>
      <div class="acoes-r" style="margin-top:10px"><button class="btn vidro pequeno" data-ab="copiar">Copiar a escolhida</button>${o ? `<button class="btn zap pequeno" data-ab="zap" data-orc="${esc(o.id)}" data-passo="${p.id}">Abrir no WhatsApp</button><button class="link" data-ab="feito" data-orc="${esc(o.id)}" data-passo="${p.id}">${p.canal === 'ligacao' ? 'liguei' : 'marcar como enviado'}</button>` : ''}</div></div>`;
  }
  app.addEventListener('click', (e) => {
    const d = e.target.closest('[data-ab-dia]'); if (d) { abDia = d.dataset.abDia; const r = $('#respAgente'); if (r && ultimaSaida) r.innerHTML = blocos(ultimaSaida, B.obter(location.hash.replace('#lead-', ''))); return; }
    const bt = e.target.closest('[data-ab]'); if (!bt) return;
    const bloco = bt.closest('[data-ab-bloco]'); const k = (bloco.querySelector('input[name="ab-sel"]:checked') || {}).value || 0;
    const txt = bloco.querySelector(`[data-ab-txt="${k}"]`).value;
    if (bt.dataset.ab === 'copiar') { copiar(txt); return; }
    const o = B.obter(bt.dataset.orc), passo = Object.values(Cadencia.PASSOS).flat().find((x) => x.id === bt.dataset.passo);
    if (bt.dataset.ab === 'zap') window.open('https://wa.me/55' + String(o.whatsapp || '').replace(/\D/g, '').replace(/^55/, '') + '?text=' + encodeURIComponent(txt.replace(/^\[ÁUDIO[^\]]*\]\s*/, '')), '_blank', 'noopener');
    B.interacao(o.id, passo.canal === 'ligacao' && bt.dataset.ab === 'feito' ? 'ligacao' : 'whatsapp', `Cadência ${passo.id} · ${passo.titulo}`);
    if (passo.id === 'P0' && o.status === 'novo') { o.status = 'proposta'; o.enviadoEm = new Date().toISOString(); B.salvar(o); }
    abDia = null; toast('Registrado. Próximo passo agendado.');
  });

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
  const SEGMENTOS = [['residencial', '🏠 Residencial'], ['comercial', '🏪 Comercial'], ['grandes', '🏭 Grandes contas / indústria'], ['rural', '🌾 Rural']];
  const novoOrc = () => ({ segmento: 'residencial', nome: '', whatsapp: '', cep: '', cidade: '', distanciaKm: 0, ligacao: 'bi', consumos: Array(12).fill(''), tarifaKwh: P().tarifaKwh, lidoPorIA: false, modo: 'pdf', telhado: 'ceramico', orientacao: '?', areaDisponivel: '', trocaPadrao: false, opcaoEscolhida: 1, formaPagamento: 'financiamento', comissaoParceria: 0, kitFaturadoDireto: false, descontoPct: 0, origem: 'WhatsApp', status: 'novo' });
  /* várias propostas no mesmo cliente: todas ligadas pelo clienteId (o código da primeira) */
  const CAMPOS_CLIENTE = ['segmento', 'nome', 'whatsapp', 'email', 'cpf', 'documento', 'cep', 'endereco', 'numero', 'bairro', 'cidade', 'distanciaKm', 'ligacao', 'consumos', 'tarifaKwh', 'cargasFuturas', 'grupo', 'grupoA', 'telhado', 'orientacao', 'areaDisponivel', 'lat', 'lng', 'origem', 'indicadoPor', 'parceiro'];
  function propostasDoCliente(o) { const cid = o.clienteId || o.id; return B.todos().filter((x) => !x.apagado && !['servico', 'manutencao', 'ampliacao'].includes(x.tipo) && (x.id === cid || x.clienteId === cid)).sort((a, b) => String(a.criadoEm).localeCompare(String(b.criadoEm))); }
  function novaPropostaDe(o) {
    if (!o.clienteId) { o.clienteId = o.id; B.salvar(o); }
    const n = novoOrc(); CAMPOS_CLIENTE.forEach((k) => { if (o[k] !== undefined) n[k] = JSON.parse(JSON.stringify(o[k])); });
    n.clienteId = o.clienteId; n.status = 'novo'; n.nota = `Nova proposta para o cliente de ${o.id}`;
    orc = n; etapa = 0; B.rascunho.gravar(n); B.rascunho.gravarEtapa(0); return n;
  }
  let orc = B.rascunho.ler() || novoOrc();
  let etapa = B.rascunho.etapa();
  const PDFS_PENDENTES = {}; // PDF da Belenergy de cada opção, anexado quando o orçamento ganha número
  const salvarR = () => { B.rascunho.gravar(orc); B.rascunho.gravarEtapa(etapa); };
  const ETAPAS = [
    ['Cliente e conta', passo1, () => (orc.nome.trim() && C.consumoMedio(orc) > 0 && orc.cidade) ? '' : 'Preencha nome, cidade e o consumo (ou a potência em kWp).'],
    ['Local e telhado', passo2, () => ''], ['Dimensionamento', passo3, () => ''], ['Kit Belenergy', passo4, () => (orc.kitsFechados && orc.kitsFechados.some(Boolean)) ? '' : 'Cote pelo menos uma opção (inversor ou micro).'],
    ['Preço e pagamento', passo5, () => ''], ['Proposta Viva', passo6, () => ''],
  ];
  function novo() {
    document.body.classList.add('com-barra'); $('#barra').hidden = false;
    app.innerHTML = `${cabCelular()}<div class="cab"><div><span class="rotulo" style="color:var(--sol)">Passo ${etapa + 1} de 6</span><h1>${ETAPAS[etapa][0]}</h1></div><div class="linha-h" style="gap:10px;align-items:center">${orc.id ? `<span class="sutil">editando ${esc(orc.id)}</span>` : ''}<button class="btn vidro pequeno" id="btnZerar" type="button" title="Apaga o rascunho e começa um orçamento novo">↺ ${orc.id ? 'Sair e começar outro' : 'Zerar orçamento'}</button></div></div>
      <div class="etapas">${ETAPAS.map((e, i) => `<button class="etapa ${i < etapa ? 'feita' : ''} ${i === etapa ? 'atual' : ''}" data-ir="${i}" ${i > etapa ? 'disabled' : ''}><i></i><span class="t">${e[0]}</span></button>`).join('')}</div>
      <div id="corpo" class="entra"></div>`;
    app.querySelectorAll('[data-ir]').forEach((b) => b.onclick = () => { etapa = +b.dataset.ir; salvarR(); novo(); });
    $('#btnZerar').onclick = (ev) => {
      const bt = ev.currentTarget;
      if (!bt.dataset.conf) { bt.dataset.conf = '1'; bt.textContent = orc.id ? 'Tocar de novo: sai sem salvar as mudanças' : 'Tocar de novo para apagar o rascunho'; bt.style.borderColor = 'var(--laranja)'; setTimeout(() => { if (bt.isConnected) { delete bt.dataset.conf; bt.textContent = '↺ ' + (orc.id ? 'Sair e começar outro' : 'Zerar orçamento'); bt.style.borderColor = ''; } }, 4000); return; }
      cot = null; kitDig = null; orc = novoOrc(); etapa = 0; salvarR(); novo(); scrollTo(0, 0); toast('Orçamento zerado: pode começar do zero');
    };
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
    const erro = ETAPAS[etapa][2]();
    if (erro && etapa === 3 && $('#a-cotar') && !$('#a-cotar').disabled) { toast('Cotando os kits agora…'); $('#a-cotar').click(); return; }
    if (erro) return toast(erro);
    if (etapa < 5) { etapa++; salvarR(); novo(); scrollTo(0, 0); return; }
    const novoLead = !orc.id;
    if (novoLead) { orc.status = 'proposta'; orc.enviadoEm = new Date().toISOString(); }
    const salvo = B.salvar(orc);
    const escolhidos = (orc.kitsFechados || []).filter(Boolean).map((k) => k.nivel);
    Object.entries(PDFS_PENDENTES).forEach(([nv, f]) => { if (escolhidos.includes(nv)) B.anexar(salvo.id, f.nome, f.base64).catch((e) => toast('PDF não anexado: ' + e.message)); delete PDFS_PENDENTES[nv]; });
    orc = novoOrc(); etapa = 0; salvarR();
    toast(novoLead ? 'Proposta Viva criada' : 'Orçamento atualizado');
    location.hash = '#lead-' + salvo.id;
  };

  const MODOS = [['pdf', 'documento', 'Anexar conta (PDF)'], ['meses', 'conta', 'Digitar 12 meses'], ['media', 'grafico', 'Só a média'], ['geracao', 'sol', 'Geração desejada']];
  /* ---------- Grupo A: conta de média tensão (ponta, fora ponta, demanda) ---------- */
  const GA = window.GrupoA;
  /* ---------- aparelhos que o cliente vai instalar: aumentam o consumo usado no dimensionamento ---------- */
  const TIPOS_CARGA = { ar: 'Ar-condicionado', carro: 'Carro elétrico', outro: 'Outro aparelho' };
  function painelCargas() {
    const L = orc.cargasFuturas || [], tot = C.cargaExtra(orc), atual = C.consumoMedio(orc);
    const campo = (i, k, rot, v, ph, st = '1') => `<label class="campo"><span>${rot}</span><input type="number" min="0" step="${st}" data-cg="${i}" data-k="${k}" value="${v ?? ''}" placeholder="${ph}"></label>`;
    const linha = (c, i) => `<div class="painel" style="margin-top:8px;padding:12px">
      <div style="display:flex;gap:8px;align-items:center;justify-content:space-between"><div class="chips">${Object.entries(TIPOS_CARGA).map(([v, t]) => `<button class="chip ${c.tipo === v ? 'sel' : ''}" data-cgtipo="${i}" data-v="${v}">${t}</button>`).join('')}</div>
        <button class="btn vidro pequeno" data-cgdel="${i}" title="Tirar">✕</button></div>
      <div class="grade g2" style="margin-top:8px;align-items:end">
        ${c.tipo === 'ar' ? campo(i, 'btu', 'BTUs (cada)', c.btu, '12000', '1000') + campo(i, 'qtd', 'Quantidade', c.qtd, '1') + campo(i, 'horas', 'Horas ligado por dia', c.horas, '8', '0.5') + campo(i, 'dias', 'Dias por mês', c.dias, '30')
          : c.tipo === 'carro' ? campo(i, 'km', 'Km rodados por mês', c.km, '1500', '50') + campo(i, 'qtd', 'Quantidade', c.qtd, '1') + campo(i, 'kwhKm', 'kWh por km', c.kwhKm, '0,18', '0.01')
          : campo(i, 'watts', 'Potência (W)', c.watts, '1500', '10') + campo(i, 'qtd', 'Quantidade', c.qtd, '1') + campo(i, 'horas', 'Horas por dia', c.horas, '2', '0.5') + campo(i, 'dias', 'Dias por mês', c.dias, '30')}</div>
      ${c.tipo === 'ar' ? `<label class="alternar" style="margin-top:6px"><span>Aparelho convencional (sem inverter) <small class="sutil">gasta uns 40% a mais</small></span><input type="checkbox" data-cgconv="${i}" ${c.convencional ? 'checked' : ''}></label>` : ''}
      <p class="mini" style="margin:6px 0 0">≈ <b data-cgkwh="${i}">${n(C.kwhCarga(c))} kWh por mês</b></p></div>`;
    return `<div class="painel"><span class="rotulo">Aparelhos que o cliente vai instalar</span>
      <p class="mini" style="margin:6px 0 0">Ar-condicionado, carro elétrico, piscina… entram no tamanho da usina e na economia.</p>
      ${L.map(linha).join('')}
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:10px"><button class="btn vidro pequeno" id="cg-mais">+ aparelho</button>
      ${L.length ? `<span class="mini">Consumo de hoje <b>${n(atual)}</b> + aparelhos <b id="cg-tot">${n(tot)}</b> = <b id="cg-fim" class="grad">${n(atual + tot)} kWh/mês</b></span>` : ''}</div></div>`;
  }
  function ligarCargas(el) {
    const L = () => (orc.cargasFuturas = orc.cargasFuturas || []);
    const mais = $('#cg-mais', el); if (mais) mais.onclick = () => { L().push({ tipo: 'ar', btu: 12000, qtd: 1, horas: 8, dias: 30 }); salvarR(); novo(); };
    el.querySelectorAll('[data-cgdel]').forEach((b) => b.onclick = () => { L().splice(+b.dataset.cgdel, 1); salvarR(); novo(); });
    el.querySelectorAll('[data-cgtipo]').forEach((b) => b.onclick = () => { const c = L()[+b.dataset.cgtipo]; c.tipo = b.dataset.v; if (c.tipo === 'carro' && !c.km) c.km = 1500; if (c.tipo === 'outro' && !c.watts) c.watts = 1500; salvarR(); novo(); });
    const refaz = () => { const tot = C.cargaExtra(orc), at = C.consumoMedio(orc); L().forEach((c, i) => { const e = el.querySelector(`[data-cgkwh="${i}"]`); if (e) e.textContent = n(C.kwhCarga(c)) + ' kWh por mês'; }); const t = $('#cg-tot', el), f = $('#cg-fim', el); if (t) t.textContent = n(tot); if (f) f.textContent = n(at + tot) + ' kWh/mês'; salvarR(); barra(); };
    el.querySelectorAll('[data-cg]').forEach((x) => x.oninput = () => { const c = L()[+x.dataset.cg]; c[x.dataset.k] = x.value === '' ? '' : +String(x.value).replace(',', '.'); refaz(); });
    el.querySelectorAll('[data-cgconv]').forEach((x) => x.onchange = () => { L()[+x.dataset.cgconv].convencional = x.checked; refaz(); });
  }
  function painelGrupoA() {
    const ga = orc.grupoA = orc.grupoA || GA.novo(), t = ga.tarifas, azul = ga.modalidade === 'azul';
    const mP = GA.media(ga.consumoP), mFP = GA.media(ga.consumoFP), fa = GA.fatorAjuste(ga), dem = GA.demandaMes(ga), conta = mP * ((t.teP || 0) + (t.tusdP || 0)) + mFP * ((t.teFP || 0) + (t.tusdFP || 0)) + dem;
    const inp = (k, v, ph, st = '0.0001') => `<input type="number" step="${st}" min="0" data-ga="${k}" value="${v || ''}" placeholder="${ph}">`;
    return `<div class="painel"><span class="rotulo">Grupo A · conta de média tensão</span>
      <div class="chips" style="margin:10px 0">${[['verde', 'Tarifa verde'], ['azul', 'Tarifa azul']].map(([v, tt]) => `<button class="chip ${ga.modalidade === v ? 'sel' : ''}" data-gamod="${v}">${tt}</button>`).join('')}</div>
      <div class="chips" style="margin:0 0 8px">${[[true, 'Pela média'], [false, 'Mês a mês']].map(([v, tt]) => `<button class="chip ${(ga.porMedia !== false) === v ? 'sel' : ''}" data-gamedia="${v ? 1 : 0}">${tt}</button>`).join('')}</div>
      ${ga.porMedia !== false ? `<div class="grade g2" style="align-items:end"><label class="campo"><span>Média fora ponta (kWh por mês)</span><input type="number" min="0" id="ga-medFP" value="${mFP ? Math.round(mFP) : ''}" placeholder="ex.: 36.000"></label>
        <label class="campo"><span>Média ponta (kWh por mês)</span><input type="number" min="0" id="ga-medP" value="${mP ? Math.round(mP) : ''}" placeholder="ex.: 3.500"></label></div>
        <p class="mini" style="margin:4px 0 0">Vale a média dos últimos 12 meses da fatura. Para usar mês a mês, toque em "Mês a mês".</p>`
      : `<table class="ga-tab" style="margin-top:4px"><tr><th>Mês</th><th class="v">Ponta (kWh)</th><th class="v">Fora ponta (kWh)</th></tr>
        ${MESES.map((m, i) => `<tr><td>${m}</td><td class="v"><input type="number" min="0" data-gap="${i}" value="${ga.consumoP[i]}" style="width:110px"></td><td class="v"><input type="number" min="0" data-gafp="${i}" value="${ga.consumoFP[i]}" style="width:120px"></td></tr>`).join('')}</table>`}
      <p class="mini" style="margin:12px 0 0">Tarifas como estão na fatura, <b>com impostos</b>.</p>
      <div class="grade g2" style="margin-top:8px;align-items:end">
        ${azul ? `<label class="campo"><span>Demanda contratada na ponta (kW)</span>${inp('demandaP', ga.demandaP, 'ex.: 180', '1')}</label><label class="campo"><span>Demanda contratada fora ponta (kW)</span>${inp('demandaFP', ga.demandaFP, 'ex.: 250', '1')}</label>`
          : `<label class="campo"><span>Demanda contratada (kW)</span>${inp('demanda', ga.demanda, 'ex.: 250', '1')}</label><span></span>`}
        <label class="campo"><span>TE ponta (R$/kWh)</span>${inp('t.teP', t.teP, 'ex.: 0,62')}</label>
        <label class="campo"><span>TUSD ponta (R$/kWh)</span>${inp('t.tusdP', t.tusdP, 'ex.: 2,10')}</label>
        <label class="campo"><span>TE fora ponta (R$/kWh)</span>${inp('t.teFP', t.teFP, 'ex.: 0,40')}</label>
        <label class="campo"><span>TUSD fora ponta (R$/kWh)</span>${inp('t.tusdFP', t.tusdFP, 'ex.: 0,14')}</label>
        <label class="campo"><span>Demanda${azul ? ' fora ponta' : ''} (R$/kW)</span>${inp('t.demanda', t.demanda, 'ex.: 32', '0.01')}</label>
        ${azul ? `<label class="campo"><span>Demanda ponta (R$/kW)</span>${inp('t.demandaP', t.demandaP, 'ex.: 85', '0.01')}</label>` : '<span></span>'}
        <label class="campo"><span>Consumido na hora em que gera (%)<small style="display:block;font-weight:400;opacity:.75">supermercado com frio: 60 a 80%</small></span><input type="number" step="1" min="0" max="100" data-ga="simultaneidade" data-pct="1" value="${Math.round((ga.simultaneidade ?? 0.6) * 100)}"></label>
        <label class="campo"><span>Parte Fio B da TUSD (%)<small style="display:block;font-weight:400;opacity:.75">não compensa (Lei 14.300). Confira com a engenharia</small></span><input type="number" step="1" min="0" max="100" data-ga="fioBParte" data-pct="1" value="${Math.round((ga.fioBParte ?? 0.5) * 100)}"></label></div>
      <div class="campo" style="margin-top:8px"><span>Dimensionar a usina para</span><div class="chips">${[['fp', 'Cobrir o fora ponta'], ['total', 'Fora ponta + ponta (crédito vai para a ponta)']].map(([v, tt]) => `<button class="chip ${ga.alvo === v ? 'sel' : ''}" data-gaalvo="${v}">${tt}</button>`).join('')}</div></div>
      <label class="alternar" style="margin-top:8px"><span><b>Limitar a usina à demanda contratada</b><br><span class="sutil">o inversor não passa de ${n(GA.demandaLimite(ga))} kW: liga sem pedir aumento de demanda à CPFL</span></span><input type="checkbox" id="ga-lim" ${ga.limitarDemanda ? 'checked' : ''}></label>
      <div class="numeros4" style="margin-top:12px"><div><span>Ponta (média)</span><b id="ga-mp">${n(mP)} kWh</b></div><div><span>Fora ponta (média)</span><b id="ga-mfp">${n(mFP)} kWh</b></div>
        <div><span>1 kWh de ponta =</span><b id="ga-fa">${n(fa, 2)} kWh de crédito</b></div><div><span>Conta média estimada</span><b id="ga-conta" class="grad">${brl(conta)}</b></div></div>
      <p class="mini" style="margin-top:8px">A usina gera fora da ponta: o crédito abate primeiro o fora ponta; a sobra vai para a ponta na proporção das tarifas de energia (TE). A demanda continua na conta. ${GA.completo(ga) ? '' : '<b style="color:var(--laranja)">Faltam o consumo fora ponta e as tarifas de energia (TE) para calcular.</b>'}</p>
      ${D.grupoAExemplo ? `<div class="mini">Sem a fatura à mão? <button class="link" id="ga-ex">Testar com um supermercado de exemplo</button></div>` : ''}</div>`;
  }
  function ligarGrupoA(el) {
    const f = $('#f-grupoA', el); if (f) f.onchange = () => { orc.grupo = f.checked ? 'A' : 'B'; if (orc.grupo === 'A') { orc.grupoA = orc.grupoA || GA.novo(); orc.ligacao = 'tri'; if ((orc.segmento || 'residencial') === 'residencial') orc.segmento = 'grandes'; sincGA(); } salvarR(); novo(); };
    if (orc.grupo !== 'A') return;
    const ga = orc.grupoA;
    const lim = $('#ga-lim', el); if (lim) lim.onchange = () => { ga.limitarDemanda = lim.checked; salvarR(); novo(); };
    const ex = $('#ga-ex', el); if (ex) ex.onclick = () => { const e = D.grupoAExemplo; orc.grupoA = { ...GA.novo(), ...JSON.parse(JSON.stringify(e.grupoA)) }; Object.assign(orc, { nome: orc.nome || e.nome, cidade: orc.cidade || e.cidade, distanciaKm: orc.distanciaKm || e.distanciaKm, ligacao: 'tri' }); sincGA(); salvarR(); novo(); toast('Conta de exemplo do Grupo A carregada'); };
    el.querySelectorAll('[data-gamod]').forEach((b) => b.onclick = () => { ga.modalidade = b.dataset.gamod; sincGA(); salvarR(); novo(); });
    el.querySelectorAll('[data-gaalvo]').forEach((b) => b.onclick = () => { ga.alvo = b.dataset.gaalvo; sincGA(); salvarR(); novo(); });
    el.querySelectorAll('[data-gamedia]').forEach((b) => b.onclick = () => { ga.porMedia = b.dataset.gamedia === '1'; salvarR(); novo(); });
    const mfp = $('#ga-medFP', el), mp = $('#ga-medP', el);
    if (mfp) mfp.oninput = () => { ga.consumoFP = Array(12).fill(+mfp.value > 0 ? Math.round(+mfp.value) : ''); sincGA(true); };
    if (mp) mp.oninput = () => { ga.consumoP = Array(12).fill(+mp.value > 0 ? Math.round(+mp.value) : ''); sincGA(true); };
    el.querySelectorAll('[data-gap]').forEach((x) => x.oninput = () => { ga.consumoP[+x.dataset.gap] = x.value; sincGA(true); });
    el.querySelectorAll('[data-gafp]').forEach((x) => x.oninput = () => { ga.consumoFP[+x.dataset.gafp] = x.value; sincGA(true); });
    el.querySelectorAll('[data-ga]').forEach((x) => x.oninput = () => { const k = x.dataset.ga, v = Number(String(x.value).replace(',', '.')) || 0, val = x.dataset.pct ? v / 100 : v; if (k.startsWith('t.')) ga.tarifas[k.slice(2)] = val; else ga[k] = val; sincGA(true); });
  }
  /* o motor dimensiona por orc.consumos: no Grupo A vem do fora ponta (+ ponta em crédito, se escolhido) */
  function sincGA(parcial) {
    const ga = orc.grupoA; if (!ga) return;
    orc.consumos = GA.consumosParaDimensionar(ga); orc.tarifaKwh = +((ga.tarifas.teFP || 0) + (ga.tarifas.tusdFP || 0)).toFixed(4) || orc.tarifaKwh;
    salvarR(); barra();
    if (parcial) { const t = ga.tarifas, mP = GA.media(ga.consumoP), mFP = GA.media(ga.consumoFP), conta = mP * ((t.teP || 0) + (t.tusdP || 0)) + mFP * ((t.teFP || 0) + (t.tusdFP || 0)) + GA.demandaMes(ga);
      const s1 = (id, v) => { const e = $(id); if (e) e.textContent = v; }; s1('#ga-mp', n(mP) + ' kWh'); s1('#ga-mfp', n(mFP) + ' kWh'); s1('#ga-fa', n(GA.fatorAjuste(ga), 2) + ' kWh de crédito'); s1('#ga-conta', brl(conta)); }
  }

  function passo1(el) {
    const media = C.consumoMedio(orc), modo = orc.modo || 'pdf', disp = P().descontarDisponibilidade ? (M.DISPONIBILIDADE[orc.ligacao] ?? 50) : 0;
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
        <p class="mini" style="margin:6px 0 0">O sistema é dimensionado para gerar isso${disp ? `. Somamos a taxa mínima da ligação (${disp} kWh) para montar o consumo` : ', sem descontar a taxa mínima'}.</p>`,
    }[modo];
    el.innerHTML = `<div class="lado"><div>
      <div class="painel brilha"><span class="rotulo" style="color:var(--sol)">Como você tem o consumo?</span>
        <label class="alternar" style="margin:10px 0"><span><b>Cliente do Grupo A</b><br><span class="sutil">média tensão: ponta, fora ponta e demanda contratada (supermercado, indústria)</span></span><input type="checkbox" id="f-grupoA" ${orc.grupo === 'A' ? 'checked' : ''}></label>
        ${orc.grupo === 'A' ? '<p class="mini" style="margin:0">Preencha a conta de média tensão ao lado: a média (ou os 12 meses) de ponta e fora ponta, a demanda e as tarifas da fatura.</p>' : `<div class="chips" style="margin:12px 0">${MODOS.map(([v, ic, t]) => `<button class="chip ${modo === v ? 'sel' : ''}" data-modo="${v}">${Icone(ic)} ${t}</button>`).join('')}</div>
        ${blocoModo}`}</div>
      <div class="painel grade">
        <label class="campo"><span>Nome do cliente</span><input type="text" id="f-nome" value="${esc(orc.nome)}"></label>
        <div class="grade g2"><label class="campo"><span>WhatsApp</span><input type="tel" id="f-zap" value="${esc(orc.whatsapp)}"></label>
        <label class="campo"><span>Cidade da obra</span><select id="f-cid"><option value="">Escolha a cidade</option>${Object.keys(D.cidades).sort((a, b) => a.localeCompare(b, 'pt')).map((c) => `<option ${orc.cidade === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}${orc.cidade && !D.cidades[orc.cidade] ? `<option selected>${esc(orc.cidade)}</option>` : ''}<option value="__outra">Outra cidade…</option></select></label></div>
        <div class="grade g2"><label class="campo"><span>Distância da base (km, ida)</span><input type="number" id="f-km" value="${orc.distanciaKm || ''}" inputmode="numeric"></label>
        <label class="campo"><span>CEP (opcional)</span><input type="text" id="f-cep" value="${esc(orc.cep)}" inputmode="numeric"></label></div>
        <div class="campo"><span>Tipo de cliente (muda a proposta)</span><div class="chips">${SEGMENTOS.map(([v, t]) => `<button class="chip ${(orc.segmento || 'residencial') === v ? 'sel' : ''}" data-seg="${v}">${t}</button>`).join('')}</div></div>
        <div class="campo"><span>Origem do lead</span><div class="chips">${['WhatsApp', 'Instagram', 'Indicação', 'Site', 'Google', 'Parceiro'].map((x) => `<button class="chip ${orc.origem === x ? 'sel' : ''}" data-orig="${x}">${x}</button>`).join('')}</div></div>
        ${orc.origem === 'Indicação' ? `<label class="campo"><span>Quem indicou (cliente ou parceiro)</span><input type="text" id="f-indicou" list="lista-clientes" value="${esc(orc.indicadoPor || '')}" placeholder="nome de quem indicou"><datalist id="lista-clientes">${B.orcamentos().filter((x) => x.status === 'ganho').map((x) => `<option value="${esc(x.nome)}">`).join('')}</datalist></label>` : ''}
        ${orc.grupo === 'A' ? '' : `<div class="campo"><span>Tipo de ligação</span><div class="chips">${[['mono', 'Monofásica', '30 kWh'], ['bi', 'Bifásica', '50 kWh'], ['tri', 'Trifásica', '100 kWh']].map(([v, t, d]) => `<button class="chip ${orc.ligacao === v ? 'sel' : ''}" data-lig="${v}">${t}<small>${d}</small></button>`).join('')}</div></div>`}
      </div></div>
      ${orc.grupo === 'A' ? painelGrupoA() : `<div class="painel"><span class="rotulo">Consumo dos últimos 12 meses (kWh)</span>
        <div class="meses" style="margin-top:12px">${MESES.map((m, i) => `<label>${m}<input type="number" min="0" data-mes="${i}" value="${orc.consumos[i]}"></label>`).join('')}</div>
        <div class="numeros4" style="margin-top:12px"><div><span>Média</span><b id="media">${n(media)} kWh</b></div><div><span>Tarifa (R$/kWh)</span><b><input type="number" step="0.01" id="f-tar" value="${orc.tarifaKwh}" style="padding:4px 8px;font-size:17px"></b></div>
        <div style="grid-column:1/-1"><span>Pagou nos últimos 12 meses (estimado)</span><b id="pago" class="grad">${brl(media * 12 * orc.tarifaKwh)}</b></div></div>
        <label class="campo" style="margin-top:14px"><span>Potência da usina em kWp (opcional)</span><input type="text" id="f-kwp" inputmode="decimal" placeholder="ex.: 13,75 · vazio = calcula pelo consumo" value="${orc.kwpDesejado ? String(orc.kwpDesejado).replace('.', ',') : ''}"></label>
        <p class="mini" style="margin:6px 0 0" id="kwpInfo">${orc.kwpDesejado ? `Usina fixa em ${esc(String(orc.kwpDesejado).replace('.', ','))} kWp: o dimensionamento, o robô e a proposta usam esse tamanho.` : 'Use quando o cliente já pediu um tamanho. Sem consumo, estimamos a conta pela geração dessa potência.'}</p>
        ${orc.avisosLeitura ? orc.avisosLeitura.map((a) => `<div class="aviso">${esc(a)}</div>`).join('') : ''}</div>`}
      ${painelCargas()}</div>`;
    ligarGrupoA(el); ligarCargas(el);
    const atual = () => { const m = C.consumoMedio(orc); if (!$('#media')) { salvarR(); barra(); return; } $('#media').textContent = n(m) + ' kWh'; $('#pago').textContent = brl(orc.consumos.map(Number).filter(Boolean).reduce((s, x) => s + x, 0) * orc.tarifaKwh); salvarR(); barra(); };
    const preencher = (v) => { orc.consumos = Array(12).fill(v > 0 ? Math.round(v) : ''); el.querySelectorAll('[data-mes]').forEach((i) => { i.value = orc.consumos[+i.dataset.mes]; }); atual(); };
    $('#f-nome').oninput = (e) => { orc.nome = e.target.value; salvarR(); barra(); };
    $('#f-zap').oninput = (e) => { orc.whatsapp = e.target.value; salvarR(); };
    $('#f-cep').oninput = (e) => { orc.cep = e.target.value; const c = B.cepInfo(orc.cep); if (c && !orc.cidade) { orc.cidade = c.cidade; orc.distanciaKm = c.km; $('#f-cid').value = c.cidade; $('#f-km').value = c.km; } salvarR(); barra(); };
    $('#f-cid').onchange = (e) => { let v = e.target.value; if (v === '__outra') { v = (prompt('Nome da cidade:') || '').trim(); if (!v) { e.target.value = orc.cidade || ''; return; } orc.cidade = v; salvarR(); novo(); return; } orc.cidade = v; if (D.cidades[v]) { orc.distanciaKm = D.cidades[v].km || orc.distanciaKm; $('#f-km').value = orc.distanciaKm; } salvarR(); barra(); };
    $('#f-km').oninput = (e) => { orc.distanciaKm = +e.target.value || 0; salvarR(); };
    if ($('#f-tar')) $('#f-tar').oninput = (e) => { orc.tarifaKwh = +e.target.value || 0; atual(); };
    el.querySelectorAll('[data-mes]').forEach((i) => i.oninput = () => { orc.consumos[+i.dataset.mes] = i.value; atual(); });
    if ($('#f-kwp')) $('#f-kwp').onchange = (e) => {
      const v = Number(String(e.target.value).replace(',', '.')); orc.kwpDesejado = v > 0 ? Math.round(v * 100) / 100 : null;
      // sem consumo: estima pela geração da potência (economia e proposta precisam de uma conta)
      if (orc.kwpDesejado && !(C.consumoMedio(orc) > 0)) { const e0 = C.entrada({ ...orc, kwpDesejado: 0 }), pr = P().pr || 0.8; preencher(orc.kwpDesejado * (e0.hsp || 5) * 30 * pr); }
      $('#kwpInfo').textContent = orc.kwpDesejado ? `Usina fixa em ${String(orc.kwpDesejado).replace('.', ',')} kWp: o dimensionamento, o robô e a proposta usam esse tamanho.` : 'Potência calculada pelo consumo.';
      salvarR(); barra();
    };
    el.querySelectorAll('[data-modo]').forEach((b) => b.onclick = () => { orc.modo = b.dataset.modo; salvarR(); novo(); });
    el.querySelectorAll('[data-lig]').forEach((b) => b.onclick = () => {
      const dd = (l) => (P().descontarDisponibilidade ? (M.DISPONIBILIDADE[l] ?? 50) : 0), antes = dd(orc.ligacao); orc.ligacao = b.dataset.lig;
      if (modo === 'geracao' && unico) orc.consumos = orc.consumos.map((x) => +x - antes + dd(orc.ligacao));
      salvarR(); novo();
    });
    el.querySelectorAll('[data-orig]').forEach((b) => b.onclick = () => { orc.origem = b.dataset.orig; salvarR(); novo(); });
    el.querySelectorAll('[data-seg]').forEach((b) => b.onclick = () => { orc.segmento = b.dataset.seg; salvarR(); novo(); });
    const ind = $('#f-indicou'); if (ind) ind.oninput = (e) => { orc.indicadoPor = e.target.value; salvarR(); };
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

  /* ---------- projeto 3D: mesmo editor no passo 2 (telhado) e no passo 4 (com a placa e a quantidade do kit) ---------- */
  const resumo3d = () => { const p3 = orc.projeto3d; return p3 && p3.versao === 2 && p3.resultado ? p3 : null; };
  function abrir3D(aba, auto) {
    const p = P(), kits = (orc.kitsFechados || []).filter(Boolean), k = (orc.kitsFechados || [])[PRINCIPAL] || kits[0];
    let modulo = k && k.modulo ? k.modulo : null, qtd = modulo ? modulo.qtd : 0;
    if (!modulo) { const ops = C.opcoes(orc, p), op = ops[orc.opcaoEscolhida ?? 0] || ops[0]; if (op) { modulo = { nome: op.modulo.nome, potenciaW: op.modulo.potenciaW }; qtd = op.dim.placas; } }
    Telhado.abrir({ orc, modulo, qtd, aba, kits, auto: !!auto, tipoTelhado: orc.telhado, aoSalvar: (proj) => { orc.projeto3d = proj; salvarR(); novo(); toast(auto ? '⚡ 3D montado e salvo sozinho: confira na proposta' : 'Projeto 3D salvo no orçamento'); } });
  }
  function cartao3d(p3) {
    const r = p3.resultado, M = (p3.layout && p3.layout.modulo) || {};
    return `<div style="display:grid;grid-template-columns:minmax(0,180px) 1fr;gap:14px;align-items:center;margin-top:10px">
      ${p3.fotos && p3.fotos.d3 ? `<img src="${p3.fotos.d3}" alt="Projeto 3D" style="width:100%;border-radius:12px;aspect-ratio:4/3;object-fit:cover">` : '<span></span>'}
      <div><b>${r.placas} placas de ${M.potW || '?'} W · ${n(r.kwp, 2)} kWp</b><br>
        <span class="sutil">${n(r.geracaoAnual / 12)} kWh/mês (${/PVGIS/i.test(r.fonte || '') ? 'irradiação PVGIS do local' : 'irradiação da cidade'}) · sombra ${n(r.perdaSombra * 100, 1)}% · aproveitamento ${n(r.tsrfMedio * 100)}%</span><br>
        <span class="mini">${(p3.blocos || []).length} telhado(s) · ${p3.drone ? 'foto do drone' : p3.fonte === 'google' ? 'satélite Google' : 'desenho'}${p3.salvoEm ? ' · salvo em ' + new Date(p3.salvoEm).toLocaleDateString('pt-BR') : ''}</span>
        <div class="acoes-r" style="margin-top:8px"><button class="btn sol pequeno" data-abrir3d>Editar o 3D</button><button class="btn vidro pequeno" data-abrir3d="sol">☀️ Ver a sombra no dia</button><button class="link" data-tirar3d>tirar o 3D</button></div></div></div>`;
  }
  function ligar3d(el) {
    el.querySelectorAll('[data-abrir3d]').forEach((b) => b.onclick = () => abrir3D(b.dataset.abrir3d || undefined));
    el.querySelectorAll('[data-auto3d]').forEach((b) => b.onclick = () => abrir3D(undefined, true));
    el.querySelectorAll('[data-tirar3d]').forEach((b) => b.onclick = () => { if (!confirm('Tirar o projeto 3D deste orçamento? A geração volta a usar a perda de segurança.')) return; delete orc.projeto3d; salvarR(); novo(); });
  }

  function passo2(el) {
    const p = P(), hsp = (D.cidades[orc.cidade] || D.cidades['Ribeirão Preto']).hsp;
    const p3 = resumo3d(), antigo = orc.projeto3d && !p3, perda3 = orc.projeto3d && Number.isFinite(orc.projeto3d.perda) ? orc.projeto3d.perda : null; // a mesma que entra na geração (conversao.js)
    el.innerHTML = `<div class="painel" style="margin-bottom:14px">
        <div class="entre"><span class="rotulo">Telhado e projeto 3D</span></div>
        ${p3 ? cartao3d(p3)
        : `<p class="sutil" style="margin:6px 0 10px">${antigo ? '<b>Este 3D foi feito na versão anterior:</b> abra e salve de novo para medir com a placa real, as alturas e as platibandas. ' : ''}Pelo endereço, o Google traz a foto de satélite; com a foto do drone fica no detalhe. Você desenha cada parte do telhado com a altura e a platibanda, marca caixa d'água e árvores, e a sombra medida entra na geração. <b>Melhor fazer depois do kit (passo 4)</b>, com a placa e a quantidade certas.</p>
          <div class="acoes-r" style="justify-content:flex-start"><button class="btn sol" data-auto3d title="Busca o telhado pelo endereço, põe as placas e calcula a sombra sozinho">⚡ 3D automático</button><button class="btn vidro" data-abrir3d>🛰️ ${antigo ? 'Refazer' : 'Montar'} o telhado em 3D</button>${antigo ? '<button class="link" data-tirar3d>tirar o 3D antigo</button>' : ''}</div>`}
      </div>
      <div class="lado"><div class="painel grade">
      <div class="campo"><span>Tipo de telhado</span><div class="chips">${[['ceramico', 'Cerâmico'], ['fibrocimento', 'Fibrocimento'], ['metalico', 'Metálico'], ['laje', 'Laje'], ['solo', 'Solo']].map(([v, t]) => `<button class="chip ${orc.telhado === v ? 'sel' : ''}" data-tel="${v}">${t}<small>${brl(D.catalogo.estrutura[v])}/pl</small></button>`).join('')}</div></div>
      ${FIXACAO[orc.telhado] ? `<div class="campo"><span>${orc.telhado === 'fibrocimento' ? 'Fibrocimento sobre' : 'Fixação na telha metálica'} <small style="font-weight:400;opacity:.75">muda o kit e o preço</small></span><div class="chips">${FIXACAO[orc.telhado].map(([v, t]) => `<button class="chip ${(orc.fixacao || FIXACAO[orc.telhado][0][0]) === v ? 'sel' : ''}" data-fix="${v}">${t}</button>`).join('')}</div></div>` : ''}
      <div class="campo"><span>Orientação do telhado</span>
        <button class="chip ${!orc.orientacao || orc.orientacao === '?' ? 'sel' : ''}" data-ori="?" style="justify-self:start">A confirmar na visita técnica<small>perda de segurança ${n((p.perdaOrientacao ?? 0.07) * 100)}%</small></button>
        <details ${orc.orientacao && orc.orientacao !== '?' ? 'open' : ''}><summary class="mini" style="cursor:pointer">Já sei a orientação</summary>
          <div class="chips" style="margin-top:8px">${[['N', 'Norte', 'ideal'], ['NE', 'Nordeste', '−3%'], ['NO', 'Noroeste', '−3%'], ['L', 'Leste', '−12%'], ['O', 'Oeste', '−12%'], ['S', 'Sul', '−25%']].map(([v, t, d]) => `<button class="chip ${orc.orientacao === v ? 'sel' : ''}" data-ori="${v}">${t}<small>${d}</small></button>`).join('')}</div></details></div>
      <div class="grade g2"><label class="campo"><span>Área livre (m²)</span><input type="number" id="f-area" value="${esc(orc.areaDisponivel)}" placeholder="opcional"></label>
      <label class="campo"><span>Distância (km)</span><input type="number" id="f-km" value="${esc(orc.distanciaKm)}"></label></div>
      <label class="alternar"><span><b>Troca de padrão de entrada</b><br><span class="sutil">soma ${brl(p.trocaPadrao)}</span></span><input type="checkbox" id="f-pad" ${orc.trocaPadrao ? 'checked' : ''}></label></div>
      <div class="painel"><span class="rotulo">Sol no local</span><div class="numeros4" style="margin-top:12px">
        <div><span>${esc(orc.cidade || 'Ribeirão Preto')}</span><b>${n(hsp, 2)} HSP</b></div><div><span>${perda3 !== null ? 'Medido no 3D (direção + sombra)' : !orc.orientacao || orc.orientacao === '?' ? 'Com a perda de segurança' : 'Com a orientação'}</span><b>${n(hsp * (perda3 !== null ? 1 - perda3 : !orc.orientacao || orc.orientacao === '?' ? 1 - (p.perdaOrientacao ?? 0.07) : M.FATOR_ORIENTACAO[orc.orientacao]), 2)} HSP</b></div></div>
        <p class="mini" style="margin-top:10px">${perda3 !== null ? 'O 3D salvo manda na geração: a direção de cada água, a sombra placa a placa e a irradiação do local substituem a orientação e a perda de segurança.' : 'Irradiação da cidade. Com o projeto 3D, vem do PVGIS (satélite SARAH-3) pelo local exato. A perda de segurança cobre telhado leste/oeste até a visita técnica (ajustável em Parâmetros).'}</p></div></div>`;
    el.querySelectorAll('[data-tel]').forEach((b) => b.onclick = () => { orc.telhado = b.dataset.tel; orc.fixacao = null; salvarR(); novo(); });
    el.querySelectorAll('[data-fix]').forEach((b) => b.onclick = () => { orc.fixacao = b.dataset.fix; salvarR(); novo(); });
    ligar3d(el);
    el.querySelectorAll('[data-ori]').forEach((b) => b.onclick = () => { orc.orientacao = b.dataset.ori; salvarR(); novo(); });
    $('#f-area').oninput = (e) => { orc.areaDisponivel = e.target.value; salvarR(); };
    $('#f-km').oninput = (e) => { orc.distanciaKm = e.target.value; salvarR(); };
    $('#f-pad').onchange = (e) => { orc.trocaPadrao = e.target.checked; salvarR(); };
  }

  /* Grupo A: a potência do inversor não pode passar da demanda contratada sem falar com a CPFL */
  function avisoDemanda(op) {
    const l = op.limiteDemanda; if (!l || !l.demandaKw) return '';
    return l.ok ? `<div class="aviso ok">✓ Inversor de ${n(l.potInvKw, 1)} kW dentro da demanda contratada (${n(l.demandaKw)} kW).</div>`
      : `<div class="aviso ruim">O inversor (${n(l.potInvKw, 1)} kW) passa da demanda contratada (${n(l.demandaKw)} kW). Para ligar assim, a demanda precisa ser revista com a CPFL (aumentar a demanda ou contratar demanda de geração), o que pode mudar a conta. Confira com a engenharia ou marque "Limitar a usina à demanda contratada" no passo 1.</div>`;
  }
  /* fixação: escolhida no passo 2 e passada ao robô para achar o "Detalhe da estrutura" certo no portal */
  // nomes iguais aos do "Detalhes da Estrutura" da Belenergy
  /* nomes EXATOS do portal Belenergy (é "Telha Metálica", com A: com O o robô não achava e cotava colonial) */
  const TIPO_ESTR = { ceramico: 'Colonial', fibrocimento: 'Telha Fibrocimento', metalico: 'Telha Metálica', laje: 'Laje', solo: 'Solo' };
  /* Problemas de preço de um kit já cotado: preço de teste, estrutura errada, cotação velha e os avisos do robô */
  function alertasKit(o, k) {
    const out = []; if (!k || !(k.valorKit > 0)) return out;
    const lim = +P().validadeKitDias || 7, dias = k.cotadoEm ? (Date.now() - new Date(k.cotadoEm)) / 864e5 : null;
    if (k.origem === 'simulado') out.push({ grave: true, texto: 'Kit SIMULADO (valor de teste, não é preço da Belenergy): cote com o robô antes de enviar.' });
    const esperado = TIPO_ESTR[o.telhado], tipoKit = k.estrutura && !k.estrutura.semEstrutura ? k.estrutura.tipo : '';
    if (esperado && tipoKit && window.Cotador && Cotador.chaveTipo(tipoKit) !== Cotador.chaveTipo(esperado)) out.push({ grave: true, texto: `Estrutura do kit (${tipoKit}) não é a do telhado (${esperado}): o preço está errado. Refaça a cotação.` });
    if (dias != null && dias > lim && k.origem !== 'simulado') out.push({ grave: false, texto: `Kit cotado há ${Math.floor(dias)} dias (validade de ${lim}): recote antes de fechar.` });
    (k.avisos || []).forEach((t) => out.push({ grave: false, texto: t }));
    return out;
  }
  const ABERTOS = ['novo', 'proposta', 'visualizou', 'negociando'];
  function podeEnviar(o) {
    const graves = (o.kitsFechados || []).filter(Boolean).flatMap((k) => alertasKit(o, k)).filter((a) => a.grave);
    if (!graves.length) return true;
    return confirm('Atenção ao preço do kit:\n\n' + graves.map((a) => '• ' + a.texto).join('\n') + '\n\nRecomendo recotar antes. Continuar mesmo assim?');
  }
  function alertasPrecoHtml(o) {
    if (!ABERTOS.includes(o.status || 'novo')) return '';
    const itens = (o.kitsFechados || []).filter(Boolean).flatMap((k) => alertasKit(o, k).map((a) => ({ ...a, nivel: k.nivel })));
    if (!itens.length) return '';
    return `<div class="aviso ${itens.some((a) => a.grave) ? 'ruim' : ''}" style="margin-top:10px"><b>⚠ Preço do kit</b>${itens.map((a) => `<br>${esc(a.nivel || 'Kit')}: ${esc(a.texto)}`).join('')}</div>`;
  }
  /* guarda o preço de cada kit real cotado (histórico do Radar) */
  function registrarKit(k, o, origem) {
    if (!k || !(k.valorKit > 0) || k.origem === 'simulado' || !B.registrarPrecoKit) return;
    B.registrarPrecoKit(k, { origem: origem || 'sistema', orc: (o && o.id) || null, ligacao: o ? ({ mono: 'MONOFÁSICO', bi: 'BIFÁSICO', tri: 'TRIFÁSICO' }[o.ligacao] || o.ligacao || null) : null }).catch(() => {});
  }
  const FIXACAO = { ceramico: [['vertical', 'Gancho alumínio · ajuste vertical (padrão)'], ['horizontal', 'Gancho alumínio · ajuste horizontal (não serve em tégula/capa-canal)'], ['ssm', 'Gancho SSM · ajuste vertical'], ['galvanizado', 'Gancho aço galvanizado · ajuste horizontal']],
    fibrocimento: [['madeira200', 'Madeira · haste inox 200 mm'], ['madeira250', 'Madeira · haste inox 250 mm'], ['madeira300', 'Madeira · haste inox 300 mm'], ['madeiraSext', 'Madeira · sextavado interno'], ['metal', 'Estrutura metálica'], ['galv200', 'Madeira · haste galvanizada 200 mm'], ['galv250', 'Madeira · haste galvanizada 250 mm'], ['galv300', 'Madeira · haste galvanizada 300 mm']],
    metalico: [['minitrilho130', 'Mini trilho 130 mm'], ['minitrilho260', 'Mini trilho 260 mm'], ['minitrilho550', 'Mini trilho 550 mm'], ['minitrilhoAlto', 'Mini trilho alto'], ['suporteL', 'Suporte pé em L c/ perfil'], ['zipada', 'Mini trilho · telha zipada']] };
  /* todas as estruturas que a Belenergy cota (para as pré-propostas) */
  const ESTRUTURAS = [{ k: 'ceramico', telhado: 'ceramico', fixacao: 'vertical', r: 'Cerâmico' }]
    .concat(FIXACAO.fibrocimento.map(([f, t]) => ({ k: 'fibrocimento:' + f, telhado: 'fibrocimento', fixacao: f, r: 'Fibrocimento · ' + t })))
    .concat(FIXACAO.metalico.map(([f, t]) => ({ k: 'metalico:' + f, telhado: 'metalico', fixacao: f, r: 'Metálico · ' + t })))
    .concat([{ k: 'laje', telhado: 'laje', fixacao: null, r: 'Laje' }, { k: 'solo', telhado: 'solo', fixacao: null, r: 'Solo' }]);
  function passo3(el) {
    const p = P(), op = C.opcoes({ ...orc, kitsFechados: null }, p)[1], d = op.dim;
    el.innerHTML = `<div class="kpis">
        <div class="kpi destaque"><span class="rotulo">Potência</span><b>${n(d.kwpReal, 2)} kWp</b></div>
        <div class="kpi"><span class="rotulo">Módulos</span><b>${d.placas} × ${op.modulo.potenciaW} W</b></div>
        <div class="kpi"><span class="rotulo">Geração</span><b>${n(d.geracaoMes)} kWh</b><span class="sutil">por mês</span></div>
        <div class="kpi"><span class="rotulo">Área</span><b>${n(op.areaM2, 1)} m²</b></div></div>
      ${!op.cabeNoTelhado ? `<div class="aviso ruim">Área necessária passa da área livre informada (${orc.areaDisponivel} m²).</div>` : ''}
      ${C.ehGA(orc) ? avisoDemanda(op) : ''}
      <div class="painel"><span class="rotulo">Como foi calculado</span>
        ${C.cargaExtra(orc) > 0 ? `<p class="mini" style="margin:8px 0 0">Inclui <b>${n(C.cargaExtra(orc))} kWh/mês</b> dos aparelhos que o cliente vai instalar (${(orc.cargasFuturas || []).map((c) => (c.qtd > 1 ? c.qtd + '× ' : '') + (c.tipo === 'ar' ? 'ar ' + n(c.btu) + ' BTUs' : c.tipo === 'carro' ? 'carro elétrico' : 'aparelho de ' + n(c.watts) + ' W')).join(', ')}).</p>` : ''}
        ${C.ehGA(orc) ? `<p class="mini" style="margin:8px 0 0">Grupo A: dimensionado pelo ${orc.grupoA.alvo === 'total' ? `fora ponta + a ponta convertida em crédito (1 kWh de ponta = ${n(GA.fatorAjuste(orc.grupoA), 2)} kWh)` : 'consumo fora ponta'}${orc.grupoA.limitarDemanda ? `, limitado à demanda contratada (${n(GA.demandaLimite(orc.grupoA))} kW)` : ''}.</p>` : ''}
        ${orc.kwpDesejado > 0 ? `<p class="num" style="margin:10px 0">Potência fixa pedida: <b>${n(orc.kwpDesejado, 2)} kWp</b> → ${d.placas} placas = ${n(d.kwpReal, 2)} kWp (cobre ${n(d.cobertura * 100)}% do consumo)</p>` : `<p class="num" style="margin:10px 0">kWp = (${n(C.entrada(orc).consumoMedio)}${d.descontado ? ' − ' + d.descontado : ''}) ÷ (${n(d.hspEfetivo, 2)} × 30 × ${n(p.pr, 3)}) = <b>${n(d.kwpNecessario, 2)} kWp</b></p>`}
        <table><tr><td>Inversor (${esc(op.nivel)})</td><td class="v">${esc(op.inversor.nome)}</td></tr>
        <tr><td>DC/AC (ideal ${n(p.faixaDcAc.min, 2)}–${n(p.faixaDcAc.max, 2)})</td><td class="v">${n(op.relacaoDcAc, 2)} ${op.dcAcOk ? '✓' : '⚠'}</td></tr>
        <tr><td>Strings</td><td class="v">${op.strings.strings} × ${op.strings.porString}</td></tr>
        <tr><td>Tensão no frio (${p.tempMinima} °C)</td><td class="v">${n(op.strings.vocFrio)} V / ${op.inversor.vMaxDc} V</td></tr></table>
        ${op.strings.avisos.map((x) => `<div class="aviso ruim">${esc(x)}</div>`).join('') || '<div class="aviso ok">✓ Strings dentro dos limites do inversor.</div>'}</div>`;
  }

  /* ---------- Passo 4: KIT FECHADO na Belenergy (mesmo caminho do portal) ---------- */
  const NIVEIS_KIT = ['Inversor', 'Microinversor']; // Premium saiu: o vendedor cota só estas duas
  const PRINCIPAL = 0; // a opção Inversor (string) é a principal e aparece em destaque
  const TIPO_POR_OPCAO = ['INVERSOR STRING ON-GRID', 'MICROINVERSOR'];
  const DICA_OPCAO = ['String on-grid: melhor preço por Wp. É a opção principal que o cliente vê em destaque.', 'Para telhado com sombra ou águas diferentes. Desliga placa por placa (mais seguro).'];
  let cot = null, cotSlot = 0, cotModo = null, kitDig = null;
  /* kit cotado fora da Belenergy (usina grande, outro distribuidor): o vendedor digita o que veio no orçamento */
  function formKitDigitado(i, kwpSug) {
    const w = 610, qtd = Math.max(Math.ceil((kwpSug * 1000) / w - 0.05), 1), inv = i === 1 ? 'Micro' : 'Inversor';
    const c = (k, rot, tipo, val, ph, extra = '') => `<label class="campo"><span>${rot}</span><input type="${tipo}" data-kd-k="${k}" value="${val}" placeholder="${ph}" ${tipo === 'number' ? 'step="any" min="0"' : ''} ${extra}></label>`;
    return `<p class="sutil" style="margin:8px 0 10px">Digite o que veio no orçamento do outro fornecedor. Entra no preço e na proposta igual ao kit da Belenergy.</p>
      <div class="grade g2" style="gap:8px" data-kd="${i}">
        ${c('modNome', 'Módulo (marca e modelo)', 'text', '', 'ex.: JA Solar 610 W')}${c('modW', 'Potência da placa (W)', 'number', w, '610')}
        ${c('modQtd', `Quantidade de placas <small style="font-weight:400;opacity:.75">(${n(kwpSug, 1)} kWp sugeridos)</small>`, 'number', qtd, '')}${c('invNome', `${inv} (marca e modelo)`, 'text', '', i === 1 ? 'ex.: Hoymiles 2,25 kW' : 'ex.: Growatt 75 kW')}
        ${c('invKw', `Potência de cada ${inv.toLowerCase()} (kW)`, 'number', '', 'ex.: 75')}${c('invQtd', 'Quantidade', 'number', 1, '1')}
        ${c('valor', 'Valor final do kit (R$)', 'text', '', 'ex.: 412.500,00', 'inputmode="decimal"')}${c('forn', 'Fornecedor e nº do orçamento', 'text', '', 'ex.: Aldo 12345')}</div>
      <div class="acoes-r" style="justify-content:flex-start;margin-top:10px"><button class="btn sol pequeno" data-kd-salvar="${i}">Usar este kit</button><button class="link" data-kd-cancelar>cancelar</button></div>`;
  }
  /* listas de módulo e inversor: as que o portal mostrou na última cotação do robô (catálogo); sem ele, a lista fixa */
  let catRobo = null, catPedido = false;
  function carregarCatalogo() { if (catPedido || !B.roboStatus) return; catPedido = true; B.roboStatus().then((st) => { const c = st && st.info && st.info.catalogo; if (c && Array.isArray(c.modulos) && c.modulos.length) { catRobo = c; if ((location.hash || '') === '#novo' && etapa === 3) novo(); } }).catch(() => {}); }
  const tituloFab = (f) => String(f || '').toLowerCase().replace(/(^|\s)\S/g, (x) => x.toUpperCase()).replace('Trinasolar', 'Trina').replace(/^Ja /, 'JA ').replace(/^Osda/, 'OSDA');
  function seletores(i) {
    carregarCatalogo();
    const sel = (orc.selKits = orc.selKits || [{}, {}])[i];
    const P0 = Cotador.PORTAL, cm = catRobo && catRobo.modulos;
    const fabsMod = cm ? [...new Set(cm.map((m) => tituloFab(m.fab)))] : [...new Set(P0.modulos.map((m) => Cotador.fabModulo(m[1])))];
    const pots = cm ? [...new Set(cm.filter((m) => !sel.fabMod || tituloFab(m.fab) === sel.fabMod).map((m) => m.w))].sort((a, b) => a - b) : [...new Set(P0.modulos.filter((m) => !sel.fabMod || Cotador.fabModulo(m[1]) === sel.fabMod).map((m) => m[2]))].sort((a, b) => a - b);
    const tipo = TIPO_POR_OPCAO[i], ci = catRobo && catRobo.inversores && catRobo.inversores[tipo];
    const fabsInv = ci && ci.length ? [...new Set(ci.map((v) => v.fab).filter(Boolean))].sort() : tipo === 'MICROINVERSOR' ? P0.fabricantesMicro : P0.fabricantes;
    const op = (lista, atual, vazio, fmt = (x) => x) => `<option value="">${vazio}</option>` + lista.map((x) => `<option value="${esc(x)}" ${String(x) === String(atual) ? 'selected' : ''}>${esc(fmt(x))}</option>`).join('');
    return `<div class="grade g2" style="gap:8px">
      ${catRobo && catRobo.modEm ? `<p class="mini" style="grid-column:1/-1;margin:0">Lista do portal Belenergy de ${new Date(catRobo.modEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} (atualiza a cada cotação do robô)</p>` : ''}
      <label class="campo"><span>Módulo · fabricante</span><select data-sel="${i}" data-k="fabMod">${op(fabsMod, sel.fabMod, 'Mais barato')}</select></label>
      <label class="campo"><span>Módulo · potência</span><select data-sel="${i}" data-k="potMod">${op(pots, sel.potMod, 'Automática', (w) => w + ' W')}</select></label>
      <label class="campo"><span>${tipo === 'MICROINVERSOR' ? 'Micro' : 'Inversor'} · fabricante</span><select data-sel="${i}" data-k="fabInv">${op(fabsInv, sel.fabInv, 'Melhor custo-benefício')}</select></label>
      <label class="campo"><span>${tipo === 'MICROINVERSOR' ? 'Micro' : 'Inversor'} · potência</span><select data-sel="${i}" data-k="potInv">${op(ci && ci.length ? [...new Set(ci.filter((v) => !sel.fabInv || v.fab === sel.fabInv).map((v) => v.kw))].sort((x, y) => x - y) : P0.potInversor[tipo], sel.potInv, 'Automática', (k) => String(k).replace('.', ',') + ' kW')}</select></label></div>`;
  }
  /* passo 4: depois do kit, o 3D usa a placa e a quantidade certas (é o que vai para o contrato) */
  function painel3dKit() {
    const kits = orc.kitsFechados || [], k = kits[PRINCIPAL] || kits.find(Boolean);
    if (!k || !k.modulo) return '';
    const p3 = resumo3d(), r = p3 && p3.resultado, L = (p3 && p3.layout) || {}, qtd = k.modulo.qtd, med = window.Usina3D ? Usina3D.medidasModulo(`${k.modulo.sku || ''} ${k.modulo.nome || ''}`, k.modulo.potenciaW) : null;
    const outra = p3 && L.modulo && (L.modulo.potW !== k.modulo.potenciaW || L.qtd !== qtd);
    const ops = C.opcoes(orc, P()), alvo = ops[0] && ops[0].dim ? ops[0].dim.alvoKwh : 0, ger = r ? r.geracaoAnual / 12 : 0;
    const avisos = [];
    if (r && r.placas < qtd) avisos.push(`Só couberam <b>${r.placas} das ${qtd} placas</b> do kit no telhado. Reveja o layout no 3D ou cote um kit menor.`);
    if (outra) avisos.push(`O 3D foi feito com ${L.qtd} × ${L.modulo.potW} W e o kit tem ${qtd} × ${k.modulo.potenciaW} W: abra o 3D e salve de novo.`);
    if (r && !outra && alvo && ger < alvo * 0.97) avisos.push(`No 3D a geração fica em <b>${n(ger)} kWh/mês</b>, abaixo do consumo a cobrir (${n(alvo)} kWh/mês).`);
    return `<div class="painel" style="margin-top:14px">
      <div class="entre"><span class="rotulo">Projeto 3D com as placas do kit</span><span class="mini">${esc(k.nivel)}: ${qtd} × ${k.modulo.potenciaW} W</span></div>
      ${p3 ? cartao3d(p3) : `<p class="sutil" style="margin:6px 0 10px">Com o kit fechado, o 3D usa a medida real da placa${med ? ` (${n(med.c * 1000)} × ${n(med.l * 1000)} mm, confira na ficha)` : ''} e as ${qtd} placas: testa todas as posições no telhado, evita a sombra das platibandas, da caixa d'água e das árvores, e calcula a geração com a irradiação do local (PVGIS). É a base para a geração que vai no contrato.</p>
        <div class="acoes-r" style="justify-content:flex-start"><button class="btn sol" data-auto3d title="Busca o telhado pelo endereço, põe as placas e calcula a sombra sozinho">⚡ 3D automático</button><button class="btn vidro" data-abrir3d>🏠 Montar o 3D com as ${qtd} placas do kit</button></div>`}
      ${avisos.map((a) => `<div class="aviso ruim" style="margin-top:8px">${a}</div>`).join('')}
      ${r && r.cabos ? r.cabos.map((c) => c.tipo === 'string' ? (c.erro ? `<p class="mini" style="margin-top:6px">Cabos (${esc(c.nivel || 'inversor')}): marque onde fica o inversor no passo 6 do 3D.</p>` : `<p class="mini" style="margin-top:6px">Cabo solar (${esc(c.nivel || 'inversor')}, ${c.porString.join(' + ')} placas por string): frog ${n(c.frog.vermelho, 1)} + ${n(c.frog.preto, 1)} m · seguro ${n(c.seguro.vermelho, 1)} + ${n(c.seguro.preto, 1)} m (vermelho + preto)${c.conf && !c.conf.semDados ? ` · no kit ${n(c.conf.kitVermelho, 1)} + ${n(c.conf.kitPreto, 1)} m${c.conf.faltaVermelho || c.conf.faltaPreto ? ` · <b style="color:var(--laranja)">faltam ${n(c.conf.faltaVermelho, 1)} + ${n(c.conf.faltaPreto, 1)} m no cálculo ${c.modo === 'frog' ? 'frog' : 'seguro'}</b>` : ' · <b>basta</b>'}` : ''}.</p>`)
        : `<p class="mini" style="margin-top:6px">Micro (${esc(c.nivel || '')}): cabo tronco ≈ ${n(c.troncoM, 1)} m (${c.conexoes} conexões)${c.caM != null ? `, CA até o quadro ≈ ${n(c.caM, 1)} m por condutor` : ' · marque o quadro no passo 6 do 3D'}${c.conf && c.conf.faltaTronco ? ` · <b style="color:var(--laranja)">faltam ${c.conf.faltaTronco} cabo(s) tronco</b>` : ''}.</p>`).join('') : ''}
      ${r && r.mppt ? `<p class="mini" style="margin-top:6px">MPPTs: ${r.mppt.tipo === 'micro' ? 'micro com entradas independentes' : r.mppt.mppts.map((m) => `MPPT ${m.n}: ${m.strings} × ${m.porString} placas`).join(' · ')}${r.mppt.conferida ? '' : ' · <span style="color:var(--laranja)">ficha típica, confira no datasheet</span>'}</p>${r.mppt.avisos.map((x) => `<div class="aviso ruim" style="margin-top:6px">${esc(x)}</div>`).join('')}` : ''}
      ${r && !outra ? `<p class="mini" style="margin-top:8px">Geração no 3D: <b>${n(ger)} kWh/mês</b> (${n(r.geracaoAnual)} kWh/ano)${alvo ? ` · consumo a cobrir: ${n(alvo)} kWh/mês` : ''}.${r.placas >= qtd ? ' Já é a geração usada no preço e na proposta.' : ''}</p>` : ''}
    </div>`;
  }
  const QUAIS = [['ambos', 'Os dois'], ['inversor', 'Só inversor'], ['micro', 'Só micro']];
  function passo4(el) {
    const quais = orc.cotarQuais || 'ambos', vaiCotar = (i) => quais === 'ambos' || (quais === 'inversor' ? i === 0 : i === 1);
    const faltam = NIVEIS_KIT.filter((_, i) => vaiCotar(i) && !(orc.kitsFechados || [])[i]);
    const p = P();
    orc.kitsFechados = [0, 1].map((i) => (orc.kitsFechados || [])[i] || null);
    if (cot) return assistente(el);
    const est = C.opcoes({ ...orc, kitsFechados: null }, p)[1];
    const kwpSug = Math.max(est.dim.kwpNecessario, 0.5);
    el.innerHTML = `
      <div class="painel brilha"><span class="rotulo" style="color:var(--sol)">Kit fechado Belenergy</span>
        <p style="margin:8px 0 4px">Monte cada opção no <b>Personalize seu Gerador</b>. O valor final do kit é o que entra no preço.</p>
        <p class="mini" id="cot-status">Verificando o robô no seu computador…</p>
        <div class="grade g2" style="margin-top:12px;align-items:end">
          <label class="campo"><span>Frete (vale para as duas)</span><select id="a-frete">${Cotador.PORTAL.fretes.map((f) => `<option ${f === (orc.freteAuto || 'Belenus Entrega no Cliente') ? 'selected' : ''}>${esc(f)}</option>`).join('')}</select></label>
          <p class="mini" style="margin:0">Escolha em cada opção só o módulo e o inversor. Estrutura, componentes e confirmação seguem automáticos, como o portal sugere.</p></div>
        ${(() => { const ar = arranjoDoOrc(orc), m = orc.arranjoBel || {}; return `<div class="grade g2" style="margin-top:10px;align-items:end">
          <label class="campo"><span>Estrutura · nº de linhas (fileiras)</span><input type="number" min="1" max="20" id="a-lin" placeholder="${ar.fileiras && ar.fileiras.length ? ar.fileiras.length + ' (do 3D)' : 'automático'}" value="${m.linhas || ''}"></label>
          <label class="campo"><span>Orientação das placas</span><select id="a-ori">${[['', ar.fonte === '3d' && !m.ori ? 'Do 3D (' + ar.orientacao + ')' : 'Automática (retrato)'], ['retrato', 'Retrato'], ['paisagem', 'Paisagem']].map(([v, t]) => `<option value="${v}" ${(m.ori || '') === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label></div>
          <p class="mini sutil" style="margin:4px 0 0">${ar.fonte === '3d' ? `Puxado do 3D: ${ar.fileiras.length} fileira(s) (${ar.fileiras.join(' + ')} placas)${ar.aguas > 1 ? ' em ' + ar.aguas + ' águas' : ''}. O portal pede linhas iguais: o robô usa o nº de linhas que divide as placas e fica mais perto disso.` : ar.fonte === 'manual' ? 'Escolhido por você. O robô ajusta para linhas iguais (o portal exige).' : 'Sem 3D: até 12 placas em 1 linha, acima disso 2 linhas. Monte o 3D para puxar o arranjo do telhado.'}</p>`; })()}
        <div class="linha-h" style="margin-top:12px"><label class="alternar" style="margin:10px 0 0"><span><b>Salvar na Belenergy e anexar o WEB e o PDF</b><br><span class="sutil">fica em "Meus Orçamentos". O robô nunca clica em "Comprar agora".</span></span><input type="checkbox" id="a-salvar" ${orc.salvarBel === false ? '' : 'checked'}></label>
        <div class="chips" style="margin-top:10px">${QUAIS.map(([v, t]) => `<button class="chip ${quais === v ? 'sel' : ''}" data-quais="${v}">${t}</button>`).join('')}</div>
        <button class="btn sol" id="a-cotar" ${faltam.length ? '' : 'hidden'}>⚡ ${faltam.length === NIVEIS_KIT.length ? 'Cotar as duas de uma vez' : quais === 'ambos' ? 'Cotar a que falta' : `Cotar só o ${quais === 'micro' ? 'microinversor' : 'inversor'}`}</button><span class="mini" id="a-prog"></span></div></div>
      <div class="ops-v duas" style="margin-top:14px">${NIVEIS_KIT.map((nv, i) => { const k = orc.kitsFechados[i]; return `
        <div class="op-v ${k ? 'sel' : ''}" style="cursor:default;${!k && !vaiCotar(i) ? 'opacity:.55' : ''}">
          <span class="rotulo" style="color:var(--sol)">${i === PRINCIPAL ? 'Principal' : 'Opcional'}</span><h3 style="margin:4px 0">${nv}</h3>
          ${k ? `<div class="preco">${brl(k.valorKit, 2)}</div><span class="mini">valor do kit · ${k.origem === 'simulado' ? 'SIMULADO' : k.origem === 'manual' ? 'cotado por fora' + (k.numeroBelenergy ? ': ' + esc(k.numeroBelenergy) : '') : 'Belenergy ' + esc(k.numeroBelenergy)}</span>
            <ul><li><span>Módulos</span><span>${k.modulo.qtd} × ${esc(k.modulo.marca || k.modulo.nome)} ${k.modulo.potenciaW} W</span></li><li><span>${k.inversor.tipo === 'micro' ? 'Micro' : 'Inversor'}</span><span>${esc(C.equipamentos(M.opcaoKitFechado({ ...C.entrada(orc), kitsFechados: null }, k, p)).inversorCurto)}</span></li>
            <li><span>Estrutura</span><span title="${esc(k.estrutura.detalhe || '')}">${k.estrutura.semEstrutura ? 'sem estrutura' : esc(k.estrutura.tipo) + (k.estrutura.detalhe ? ' · ' + esc(String(k.estrutura.detalhe).slice(0, 34)) : '') + (+k.estrutura.linhas ? ` · ${k.estrutura.linhas}×${k.estrutura.modulosPorLinha} ${esc(String(k.estrutura.orientacao || '').toLowerCase())}` : '')}</span></li><li><span>Frete</span><span>${esc(k.frete)}</span></li>
            <li><span>R$/Wp do kit</span><span>R$ ${n(k.valorKit / (k.modulo.qtd * k.modulo.potenciaW), 2)}</span></li></ul>
            ${k.inversor && k.inversor.tipo !== 'micro' && Number.isFinite(k.inversor.overload) ? `<p class="mini" style="margin:6px 0 0">Sobrecarga do inversor: <b>${n(k.inversor.overload, 1)}%</b>${k.inversor.overloadMaxFabricante ? ` · o fabricante aceita até ${n(k.inversor.overloadMaxFabricante, 0)}% (datasheet)` : ''}${k.inversor.perdaClipping >= 0.005 ? ` · corta ~${n(k.inversor.perdaClipping * 100, 1)}% da geração no pico` : ' · sem corte de geração'}</p>` : ''}
            ${k.escolhaModulo ? `<p class="mini" style="margin:6px 0 0">Módulo: ${esc(k.escolhaModulo)}</p>` : ''}
            ${alertasKit(orc, k).map((a) => `<div class="aviso ${a.grave ? 'ruim' : ''}" style="margin-top:8px">${esc(a.texto)}</div>`).join('')}
            <div class="acoes-r" style="margin-top:10px"><button class="btn vidro pequeno" data-tirar="${i}">Refazer</button></div>`
          : kitDig === i ? formKitDigitado(i, kwpSug) : `<p class="sutil" style="margin:8px 0 12px">${DICA_OPCAO[i]}</p>${seletores(i)}
            <button class="link" data-montar="${i}" style="margin-top:10px">montar passo a passo</button> · <button class="link" data-digitar="${i}">digitar kit cotado por fora</button>`}
        </div>`; }).join('')}</div>
      <p class="mini" style="margin-top:12px">Potência sugerida pelo pré-dimensionamento: <b>${n(kwpSug, 2)} kWp</b> (${p.descontarDisponibilidade ? "consumo menos a taxa mínima" : "consumo total, sem descontar a taxa mínima"} + ${n((p.margemGeracao || 0) * 100)}% de margem${!orc.orientacao || orc.orientacao === '?' ? ` + perda de segurança de ${n((p.perdaOrientacao ?? 0.07) * 100)}% da orientação` : ''}).</p>
      ${painel3dKit()}`;
    ligar3d(el);
    Cotador.conectado().then((ok) => { cotModo = ok ? 'conectado' : 'simulado'; const st = $('#cot-status'); if (st) st.innerHTML = (ok ? '🟢 Robô conectado: a cotação é feita no site da Belenergy, com a sua sessão.' : (Cotador.motivoRobo() === 'sem-login' ? '🟡 O robô está aberto, mas ainda <b>sem login na Belenergy</b>. Entre no portal na janela do robô e clique em Tentar de novo.' : '🟡 Robô não encontrado neste computador. Modo <b>simulado</b> (mesmas telas, valores de teste).<br><small>Se o robô já está aberto: clique no ícone à esquerda do endereço do site → <b>Configurações do site</b> → <b>Acesso à rede local</b> (ou "Apps e dispositivos neste computador") → <b>Permitir</b>. Depois clique em Tentar de novo.</small>') + ' <a href="#" id="cot-retentar">↻ Tentar de novo</a>') + (Cotador.roboDesatualizado() ? `<br><b style="color:var(--laranja)">🟠 O robô deste computador está desatualizado (${esc(Cotador.versaoRobo())}). Baixe o novo (${Cotador.ROBO_ESPERADO}) e troque a pasta solar-belenergy.</b>` : ''); const rt = $('#cot-retentar'); if (rt) rt.onclick = (e) => { e.preventDefault(); rt.textContent = 'verificando…'; novo(); }; });
    el.querySelectorAll('[data-montar]').forEach((b) => b.onclick = async () => {
      cotSlot = +b.dataset.montar; cot = Cotador.novaSessao(cotModo || 'simulado'); cot.escolhas.kwp = +kwpSug.toFixed(2); cot.escolhas.tipoInversor = TIPO_POR_OPCAO[cotSlot];
      cot.escolhas.ligacao = { mono: 'MONOFÁSICO', bi: 'BIFÁSICO', tri: 'TRIFÁSICO' }[orc.ligacao];
      cot.escolhas.estruturaTipo = TIPO_ESTR[orc.telhado];
      cot.escolhas.nome = `${orc.id || 'NOVO'} ${orc.nome} ${NIVEIS_KIT[cotSlot]}`.trim();
      novo();
    });
    el.querySelectorAll('[data-tirar]').forEach((b) => b.onclick = () => { orc.kitsFechados[+b.dataset.tirar] = null; salvarR(); novo(); });
    el.querySelectorAll('[data-digitar]').forEach((b) => b.onclick = () => { kitDig = +b.dataset.digitar; novo(); });
    el.querySelectorAll('[data-kd-cancelar]').forEach((b) => b.onclick = () => { kitDig = null; novo(); });
    el.querySelectorAll('[data-kd-salvar]').forEach((b) => b.onclick = () => {
      const i = +b.dataset.kdSalvar, v = (k) => { const x = el.querySelector(`[data-kd="${i}"] [data-kd-k="${k}"]`); return x ? String(x.value).trim() : ''; }, numD = (k) => Number(v(k).replace(',', '.')) || 0;
      const modW = numD('modW'), modQtd = Math.round(numD('modQtd')), invKw = numD('invKw'), invQtd = Math.round(numD('invQtd')) || 1, valor = (() => { const t = v('valor').replace(/[R$\s]/g, ''); if (/,/.test(t)) return Number(t.replace(/\./g, '').replace(',', '.')) || 0; if (/^\d{1,3}(\.\d{3})+$/.test(t)) return Number(t.replace(/\./g, '')) || 0; return Number(t) || 0; })();
      if (!(modW > 0 && modQtd > 0 && invKw > 0 && valor > 0)) { toast('Preencha a placa (W e quantidade), o inversor (kW) e o valor do kit'); return; }
      const modNome = v('modNome') || `Módulo ${modW} W`, invNome = v('invNome') || `${i === 1 ? 'Microinversor' : 'Inversor'} ${String(invKw).replace('.', ',')} kW`;
      const ficha = window.Catalogo && Catalogo.fichaModulo ? Catalogo.fichaModulo(modW) : {};
      orc.kitsFechados[i] = { nivel: NIVEIS_KIT[i], origem: 'manual', numeroBelenergy: v('forn').slice(0, 60), frete: 'incluso no valor', cotadoEm: new Date().toISOString(), valorKit: valor, valorProdutos: valor,
        modulo: { sku: '', nome: modNome, marca: (modNome.match(/^(JA Solar|\S+)/) || [])[1] || '', potenciaW: modW, qtd: modQtd, ...ficha },
        inversor: { sku: '', qtd: invQtd, potenciaUnKw: invKw, potenciaKw: +(invKw * invQtd).toFixed(3), nome: invNome + (invQtd > 1 ? ` (${invQtd} un.)` : ''), tipo: i === 1 ? 'micro' : 'string', fabricante: (invNome.match(/^\S+/) || [''])[0].toUpperCase() },
        estrutura: { tipo: TIPO_ESTR[orc.telhado] || '', semEstrutura: false }, itens: { estrutura: [], cc: [], ca: [] }, descricao: 'Kit cotado com outro fornecedor.' };
      kitDig = null; salvarR(); novo(); toast('Kit digitado: já entra no preço e na proposta');
    });
    el.querySelectorAll('[data-sel]').forEach((x) => x.onchange = () => { const sk = orc.selKits[+x.dataset.sel]; sk[x.dataset.k] = x.value; if (x.dataset.k === 'fabMod') sk.potMod = ''; salvarR(); novo(); });
    $('#a-frete').onchange = (e) => { orc.freteAuto = e.target.value; salvarR(); };
    const salvaArr = () => { const l = +$('#a-lin').value, o2 = $('#a-ori').value; orc.arranjoBel = l > 0 || o2 ? { linhas: l > 0 ? Math.round(l) : null, ori: o2 || null } : null; if (!orc.arranjoBel) delete orc.arranjoBel; salvarR(); };
    $('#a-lin').onchange = () => { salvaArr(); novo(); }; $('#a-ori').onchange = () => { salvaArr(); novo(); };
    el.querySelectorAll('[data-quais]').forEach((b) => b.onclick = () => { orc.cotarQuais = b.dataset.quais; salvarR(); novo(); });
    $('#a-cotar').onclick = async (ev) => {
      const btn = ev.target; btn.disabled = true;
      const prog = $('#a-prog'), modo = cotModo || 'simulado', inicio = Date.now(), erros = [];
      orc.salvarBel = !!($('#a-salvar') && $('#a-salvar').checked);
      const base = { salvar: orc.salvarBel, kwp: +kwpSug.toFixed(2), ligacao: { mono: 'MONOFÁSICO', bi: 'BIFÁSICO', tri: 'TRIFÁSICO' }[orc.ligacao], cidade: orc.cidade, frete: $('#a-frete').value,
        estruturaTipo: TIPO_ESTR[orc.telhado], fixacao: FIXACAO[orc.telhado] ? orc.fixacao || FIXACAO[orc.telhado][0][0] : null, arranjo: arranjoDoOrc(orc), grupoA: orc.grupo === 'A' };
      for (let i = 0; i < NIVEIS_KIT.length; i++) {
        if (orc.kitsFechados[i] || !vaiCotar(i)) continue; // já cotada (use "Refazer") ou fora da escolha "só um"
        try {
          const pedido = { ...base, ...(orc.selKits || [])[i], tipoInversor: TIPO_POR_OPCAO[i] };
          // mesma potência, mesmas escolhas e mesmo frete nas últimas 24 h: usa a cotação guardada (instantâneo)
          const chave = 'k:' + modo + ':' + JSON.stringify([pedido.kwp, pedido.ligacao, pedido.frete, pedido.estruturaTipo, pedido.tipoInversor, pedido.fabMod || '', pedido.potMod || '', pedido.fabInv || '', pedido.potInv || '']);
          let cache = {}; try { cache = JSON.parse(localStorage.getItem('sol_cache_kits') || '{}'); } catch { /* */ }
          const guardado = cache[chave] && Date.now() - cache[chave].em < 24 * 3600e3 && cache[chave].kit && cache[chave].kit.valorKit > 0 ? cache[chave].kit : null;
          if (guardado) { orc.kitsFechados[i] = { ...guardado, nivel: NIVEIS_KIT[i] }; if (prog) prog.textContent = `${NIVEIS_KIT[i]}: cotação de hoje reaproveitada`; continue; }
          const s = await Cotador.cotarAuto(modo, { ...pedido, nome: `${orc.id || 'NOVO'} ${orc.nome} ${NIVEIS_KIT[i]}`.trim() },
            (etapa) => { if (prog) prog.textContent = `${NIVEIS_KIT[i]} (${i + 1}/${NIVEIS_KIT.length}): ${etapa}… ${Math.round((Date.now() - inicio) / 1000)} s`; });
          orc.kitsFechados[i] = Cotador.paraKit(s, NIVEIS_KIT[i]);
          if (!(orc.kitsFechados[i].valorKit > 0)) { orc.kitsFechados[i] = null; throw new Error('o portal devolveu valor R$ 0,00; tente de novo'); }
          if (modo === 'conectado') registrarKit(orc.kitsFechados[i], orc, 'sistema');
          if (s.final && s.final.pdf) PDFS_PENDENTES[NIVEIS_KIT[i]] = s.final.pdf;
          if (s.final && s.final.diagSalvar) B.registrarErroRobo({ orcamento: orc.id || null, opcao: NIVEIS_KIT[i], mensagem: 'Salvou na Belenergy, mas o robô não achou o número WEB na tela', diag: { etapa: 'salvar', nomeEtapa: 'número WEB', mensagem: 'sem número WEB', ...s.final.diagSalvar } }).catch(() => {});
          if (modo === 'conectado') { cache[chave] = { em: Date.now(), kit: orc.kitsFechados[i] }; Object.keys(cache).forEach((k) => { if (Date.now() - cache[k].em > 48 * 3600e3) delete cache[k]; }); try { localStorage.setItem('sol_cache_kits', JSON.stringify(cache)); } catch { /* */ } }
        } catch (e) {
          erros.push(`${NIVEIS_KIT[i]}: ${e.message}`);
          if (e.diag) B.registrarErroRobo({ orcamento: orc.id || null, opcao: NIVEIS_KIT[i], mensagem: e.message, diag: e.diag }).then(() => toast('Erro enviado para análise ✓')).catch(() => {});
          if (modo === 'conectado' && /etapa "(potência|módulo)"|sessão/.test(e.message)) { erros.push('A outra opção não foi tentada: o erro é no começo do portal e se repetiria.'); break; }
        }
      }
      orc.opcaoEscolhida = Math.max(0, orc.kitsFechados.filter(Boolean).findIndex((k) => k.nivel === NIVEIS_KIT[PRINCIPAL]));
      salvarR(); novo();
      const pedidas = NIVEIS_KIT.filter((_, i) => vaiCotar(i)).length;
      toast(erros.length ? `${orc.kitsFechados.filter(Boolean).length} de ${pedidas} cotada(s)` : `${orc.kitsFechados.filter(Boolean).length} kit(s) cotado(s) em ${Math.round((Date.now() - inicio) / 1000)} s`);
      if (erros.length) $('#corpo').insertAdjacentHTML('afterbegin', `<div class="aviso ruim" style="margin-bottom:12px">${erros.map(esc).join('<br>')}</div>`);
    };
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
      if (e.diag) B.registrarErroRobo({ orcamento: orc.id || null, opcao: 'passo a passo', mensagem: e.message, diag: e.diag }).catch(() => {});
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
        <label class="campo"><span>Dados de frete</span><select id="c-frete">${o.fretes.map((x) => `<option ${x === (e.frete || 'Belenus Entrega no Cliente') ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label>
        <label class="campo"><span>Forma de pagamento</span><select id="c-pg">${o.pagamentos.map((x) => `<option>${esc(x)}</option>`).join('')}</select></label></div></div>
        <label class="alternar" style="margin-top:12px"><span><b>Salvar a proposta na Belenergy</b><br><span class="sutil">fica em "Meus Orçamentos". O robô nunca clica em "Comprar agora".</span></span><input type="checkbox" id="c-salvar" ${cot.modo === 'conectado' ? 'checked' : 'disabled'}></label>
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
    if (usar) usar.onclick = () => { orc.kitsFechados[cotSlot] = Cotador.paraKit(cot, NIVEIS_KIT[cotSlot]); if (cot.modo === 'conectado') registrarKit(orc.kitsFechados[cotSlot], orc, 'sistema'); orc.opcaoEscolhida = orc.kitsFechados.filter(Boolean).findIndex((k) => k.nivel === NIVEIS_KIT[PRINCIPAL]); cot = null; salvarR(); toast('Kit fechado salvo na opção ' + NIVEIS_KIT[cotSlot]); novo(); };
  }

  function passo5(el) {
    const p = P(), ops5 = C.opcoes(orc, p), op = ops5[C.indiceOpcao(orc, ops5)], pr = op.preco, sem = p.semaforo, g = op.groner;
    const pos = (v) => Math.min(Math.max((v - 1.8) / 1.7, 0), 1) * 100;
    const modo = orc.precoModo || 'chama', extras = Array.isArray(orc.custosExtras) ? orc.custosExtras : [], aj = orc.custosAjustados || {};
    const mg = pr.percentuais.margem, corMg = mg < 0 ? 'var(--vermelho)' : mg < 0.05 ? 'var(--amarelo)' : 'inherit';
    // o que sobra para a empresa com o preço da Groner (mesmos custos e impostos nossos)
    const fNoKit = M.freteDentroDoKit ? M.freteDentroDoKit(op.kitFechado) : false;
    const comG = M.precificar({ ...C.entrada(orc), kit: op.kit, placas: op.dim.placas, kwp: op.dim.kwpReal, precoAlvo: g.preco, freteNoKit: fNoKit }, p);
    const nossa = modo === 'chama' ? pr : M.precificar({ ...C.entrada(orc), precoModo: 'chama', kit: op.kit, placas: op.dim.placas, kwp: op.dim.kwpReal, freteNoKit: fNoKit }, p); // a nossa fórmula, mesmo quando o preço foi fixado
    const AJUSTAVEIS = ['terceiro', 'projeto', 'art', 'materialCa', 'frete', 'deslocamento', 'padrao'];
    const linhasBase = pr.linhas.filter((l) => !l.extra);
    el.innerHTML = `<div class="lado"><div>
      <div class="painel grade">
        <div class="campo"><span>Forma de pagamento</span><div class="chips">${[['financiamento', 'Financiamento'], ['avista', 'À vista / Pix'], ['cartao', 'Cartão 12x']].map(([v, t]) => `<button class="chip ${orc.formaPagamento === v ? 'sel' : ''}" data-pg="${v}">${t}</button>`).join('')}</div></div>
        <div class="grade g2"><label class="campo"><span>Comissão de parceiro (%)</span><input type="number" id="f-com" step="0.5" value="${orc.comissaoParceria}"></label>
        ${modo === 'chama' ? `<label class="campo"><span>Desconto: ${n(orc.descontoPct, 1)}% de ${pct(p.reservaNegociacao, 0)}</span><input type="range" id="f-desc" min="0" max="${p.reservaNegociacao * 100}" step="0.5" value="${orc.descontoPct}"></label>` : '<span class="mini" style="align-self:end">Com o preço fixado, o desconto fica de fora: a margem é o que sobra.</span>'}</div>
        <label class="alternar"><span><b>Kit faturado direto pela Belenergy</b><br><span class="sutil">imposto só no serviço (validar com o contador)</span></span><input type="checkbox" id="f-dir" ${orc.kitFaturadoDireto ? 'checked' : ''}></label></div>
      <div class="painel grade" id="ajPreco"><span class="rotulo">Ajustar o preço · só você vê</span>
        <div class="chips">${[['chama', 'Nossa fórmula'], ['groner', 'Preço da Groner'], ['manual', 'Digitar o preço']].map(([v, t]) => `<button class="chip ${modo === v ? 'sel' : ''}" data-pmodo="${v}">${t}</button>`).join('')}</div>
        ${modo === 'chama' ? `<label class="campo"><span>Margem desta proposta (%)<small style="display:block;font-weight:400;opacity:.75">tabela: ${n(pr.margemTabela * 100, 1)}% para ${n(op.dim.kwpReal, 2)} kWp${pr.margemManual ? ' · <button class="link" id="f-mg-limpar">voltar à tabela</button>' : ''}</small></span><input type="number" id="f-margem" step="0.5" placeholder="${n(pr.margemTabela * 100, 1)}" value="${pr.margemManual ? +(orc.margemManual) : ''}"></label>` : ''}
        ${modo === 'manual' ? `<label class="campo"><span>Preço final da opção ${esc(op.nivel)} (R$)<small style="display:block;font-weight:400;opacity:.75">a margem passa a ser o que sobrar</small></span><input type="number" id="f-preco" step="10" min="0" value="${(orc.precoManual || {})[op.nivel] || ''}" placeholder="${Math.round(pr.precoFinal)}"></label>` : ''}
        ${modo === 'groner' ? `<p class="mini" style="margin:0">Usando o preço que a Groner daria: <b>${brl(g.preco)}</b>. Os custos e impostos continuam os nossos; a margem é o que sobra.</p>` : ''}
        <div class="campo"><span>Custos extras (opcional)<small style="display:block;font-weight:400;opacity:.75">somam no custo e entram nos impostos, taxas e margem</small></span>
          ${extras.map((x, i) => `<div class="linha-h" style="gap:8px;margin-top:6px"><input type="text" data-ex-nome="${i}" value="${esc(x.nome || '')}" placeholder="ex.: reforço da estrutura" style="flex:2"><input type="number" data-ex-valor="${i}" value="${x.valor || ''}" placeholder="R$" step="10" style="flex:1;min-width:90px"><button class="link" data-ex-tirar="${i}" aria-label="Tirar">✕</button></div>`).join('')}
          <button class="link" id="ex-add" style="margin-top:6px;justify-self:start">＋ adicionar custo extra</button></div>
        <details ${Object.keys(aj).length ? 'open' : ''}><summary class="mini" style="cursor:pointer">Editar os custos desta obra${Object.keys(aj).length ? ` (${Object.keys(aj).length} ajustado${Object.keys(aj).length > 1 ? 's' : ''})` : ''}</summary>
          <div class="grade g2" style="margin-top:8px">${linhasBase.filter((l) => AJUSTAVEIS.includes(l.id)).map((l) => `<label class="campo"><span>${esc(l.nome)}${l.ajustado ? ` <button class="link" data-aj-limpar="${l.id}">padrão ${brl(l.valorPadrao)}</button>` : ''}</span><input type="number" step="10" min="0" data-aj="${l.id}" value="${l.ajustado ? l.valor : ''}" placeholder="${Math.round(l.valorPadrao ?? l.valor)}"></label>`).join('')}</div></details>
      </div>
      <div class="painel"><span class="rotulo">Composição do preço · ${esc(op.nivel)} · só você vê</span><p style="margin:8px 0 0;font-weight:600">${esc(C.equipamentos(op).modulo)} · ${esc(C.equipamentos(op).inversor)}</p><table style="margin-top:8px">
        ${pr.linhas.filter((l) => l.valor).map((l) => `<tr><td>${esc(l.nome)}${l.ajustado ? ' <span class="mini" style="color:var(--sol)">ajustado</span>' : ''}${l.extra ? ' <span class="mini" style="color:var(--sol)">extra</span>' : ''}</td><td class="v">${brl(l.valor)}</td></tr>`).join('')}
        <tr class="sub"><td>Custos diretos</td><td class="v">${brl(pr.custosDiretos)}</td></tr>
        <tr><td>${p.kwpPrevistosMes > 0 ? `Custo fixo (${brl(p.custoFixoMes)} ÷ ${n(p.kwpPrevistosMes)} kWp/mês × ${n(op.dim.kwpReal, 2)} kWp)` : `Taxa fixa (${brl(p.custoFixoMes)} ÷ ${p.obrasPrevistasMes} obras)`}</td><td class="v">${brl(pr.taxaFixa)}</td></tr>
        <tr><td>Impostos (${pct(pr.percentuais.impostos)})</td><td class="v">${brl(pr.decomp.impostos)}</td></tr>
        ${pr.decomp.taxaPagamento ? `<tr><td>Taxa do cartão</td><td class="v">${brl(pr.decomp.taxaPagamento)}</td></tr>` : ''}${pr.decomp.comissao ? `<tr><td>Comissão parceiro</td><td class="v">${brl(pr.decomp.comissao)}</td></tr>` : ''}
        <tr><td>Margem (${n(mg * 100, 1)}%${pr.precoAlvo ? ', o que sobrou' : pr.margemManual ? ', digitada' : ''})</td><td class="v" style="color:${corMg}">${brl(pr.decomp.margem)}</td></tr>
        <tr><td>Reserva de negociação restante</td><td class="v">${brl(pr.decomp.reservaRestante)}</td></tr>
        <tr class="total"><td>Preço ao cliente${modo === 'groner' ? ' (Groner)' : modo === 'manual' && pr.precoAlvo ? ' (digitado)' : ''}</td><td class="v">${brl(pr.precoFinal)}</td></tr>
        ${orc.kitFaturadoDireto ? `<tr class="sub"><td>↳ Nota Belenergy (kit)</td><td class="v">${brl(pr.kitDireto)}</td></tr><tr class="sub"><td>↳ Nota Chama Solar</td><td class="v">${brl(pr.notaChamaSolar)}</td></tr>` : ''}
        <tr><td><b>Sobra para a empresa</b></td><td class="v"><b class="${pr.lucroLiquido < 0 ? '' : 'grad'}" style="${pr.lucroLiquido < 0 ? 'color:var(--vermelho)' : ''}">${brl(pr.lucroLiquido)}</b></td></tr></table>
        ${mg < 0 ? `<div class="aviso ruim" style="margin-top:8px">Este preço fica <b>abaixo do custo</b>: prejuízo de ${brl(-pr.decomp.margem)} antes da reserva.</div>` : mg < 0.05 ? '<div class="aviso" style="margin-top:8px">Margem abaixo de 5%: confira se vale fechar assim.</div>' : ''}</div></div>
      <div><div class="painel"><span class="rotulo">Preço × mercado</span><div style="margin-top:8px"><span class="semaforo ${pr.semaforo}">${NOME_SEMAFORO[pr.semaforo]}</span></div>
        <div class="regua" style="background:linear-gradient(90deg,var(--verde) 0 ${pos(sem.verdeAte)}%,var(--amarelo) ${pos(sem.verdeAte)}% ${pos(sem.amareloAte)}%,var(--vermelho) ${pos(sem.amareloAte)}%)">
          <span class="ponteiro" style="left:${Math.min(Math.max(pos(pr.rsPorWp), 8), 92)}%">R$ ${n(pr.rsPorWp, 2)}/Wp</span>
          <div class="marcas"><span style="left:0;transform:none">1,80</span><span style="left:${pos(sem.verdeAte)}%">${n(sem.verdeAte, 2)}</span><span style="left:${pos(sem.amareloAte)}%">${n(sem.amareloAte, 2)}</span><span style="left:100%;transform:translateX(-100%)">3,50</span></div></div>
        <p class="mini">Média nacional residencial: R$ ${n(sem.referencia, 2)}/Wp (1º tri 2026).</p></div>
      <div class="painel"><span class="rotulo">Nossa precificação × Groner · ${esc(op.nivel)}</span>
        <table style="margin-top:8px"><tr><th></th><th class="v">Nossa${modo !== 'chama' ? ' (fórmula)' : ''}</th><th class="v">Groner</th></tr>
          ${(() => { const val = (id) => (nossa.linhas.find((l) => l.id === id) || {}).valor || 0;
            const linhasG = [['Kit', val('kit'), g.linhas[0].valor], ['Engenharia / projeto', val('projeto') + val('art'), g.linhas[1].valor + g.linhas[3].valor], ['Mão de obra', val('terceiro'), g.linhas[2].valor], ['Deslocamento e frete', val('deslocamento') + val('frete'), g.linhas[4].valor], ['Material CA, garantia, padrão e extras', nossa.custosDiretos - val('kit') - val('projeto') - val('art') - val('terceiro') - val('deslocamento') - val('frete'), g.linhas[5].valor], ['Custo fixo da empresa', nossa.taxaFixa, 0]];
            return linhasG.map(([t, a, b]) => `<tr><td>${t}</td><td class="v">${brl(a)}</td><td class="v">${brl(b)}</td></tr>`).join('') +
              `<tr class="sub"><td>Percentual sobre o preço</td><td class="v">${n((nossa.percentuais.impostos + nossa.percentuais.pagamento + nossa.percentuais.comissao + nossa.percentuais.margem + nossa.percentuais.reserva) * 100, 1)}%</td><td class="v">${n(g.percentual * 100, 1)}%${g.fatorX ? ` <span class="mini">(com Fator X ${n(g.fatorX * 100)}%)</span>` : ''}</td></tr>
              <tr class="total"><td>Preço ao cliente</td><td class="v">${brl(nossa.precoFinal)}</td><td class="v">${brl(g.preco)}</td></tr>
              <tr><td>R$/Wp</td><td class="v">R$ ${n(nossa.rsPorWp, 2)}</td><td class="v">R$ ${n(g.rsPorWp, 2)}</td></tr>
              <tr><td><b>Sobra para a empresa</b> <span class="mini">(com os nossos impostos)</span></td><td class="v"><b>${brl(nossa.lucroLiquido)}</b></td><td class="v"><b style="${comG.lucroLiquido < 0 ? 'color:var(--vermelho)' : ''}">${brl(comG.lucroLiquido)}</b></td></tr>`; })()}
        </table>
        <p class="mini" style="margin-top:8px">Diferença: a Groner sai <b>${Math.abs(g.preco - nossa.precoFinal) < 1 ? 'igual' : g.preco > nossa.precoFinal ? brl(g.preco - nossa.precoFinal) + ' mais cara' : brl(nossa.precoFinal - g.preco) + ' mais barata'}</b> que a nossa fórmula (${n(Math.abs(g.preco / nossa.precoFinal - 1) * 100, 1)}%). Na Groner, os ${n((g.percentual - (g.fatorX || 0) - (op.preco.percentuais.comissao || 0)) * 100, 1)}% juntam imposto, lucro e comissão.</p>
        <div class="acoes-r" style="justify-content:flex-start">${modo === 'groner' ? '<button class="btn vidro pequeno" data-pmodo="chama">Voltar para a nossa fórmula</button>' : '<button class="btn sol pequeno" data-pmodo="groner">Usar o preço da Groner</button>'}</div></div></div></div>`;
    el.querySelectorAll('[data-pg]').forEach((b) => b.onclick = () => { orc.formaPagamento = b.dataset.pg; salvarR(); novo(); });
    el.querySelectorAll('[data-pmodo]').forEach((b) => b.onclick = () => { orc.precoModo = b.dataset.pmodo; if (orc.precoModo !== 'chama') orc.descontoPct = 0; salvarR(); novo(); });
    $('#f-com').onchange = (e) => { orc.comissaoParceria = +e.target.value || 0; salvarR(); novo(); };
    if ($('#f-desc')) $('#f-desc').onchange = (e) => { orc.descontoPct = +e.target.value; salvarR(); novo(); };
    $('#f-dir').onchange = (e) => { orc.kitFaturadoDireto = e.target.checked; salvarR(); novo(); };
    if ($('#f-margem')) $('#f-margem').onchange = (e) => { const v = String(e.target.value).replace(',', '.'); orc.margemManual = v === '' ? null : +v; salvarR(); novo(); };
    if ($('#f-mg-limpar')) $('#f-mg-limpar').onclick = () => { orc.margemManual = null; salvarR(); novo(); };
    if ($('#f-preco')) $('#f-preco').onchange = (e) => { orc.precoManual = { ...(orc.precoManual || {}), [op.nivel]: +e.target.value || 0 }; salvarR(); novo(); };
    $('#ex-add').onclick = () => { orc.custosExtras = [...extras, { nome: '', valor: '' }]; salvarR(); novo(); };
    el.querySelectorAll('[data-ex-nome]').forEach((x) => x.onchange = () => { extras[+x.dataset.exNome].nome = x.value; orc.custosExtras = extras; salvarR(); novo(); });
    el.querySelectorAll('[data-ex-valor]').forEach((x) => x.onchange = () => { extras[+x.dataset.exValor].valor = +x.value || 0; orc.custosExtras = extras; salvarR(); novo(); });
    el.querySelectorAll('[data-ex-tirar]').forEach((x) => x.onclick = () => { extras.splice(+x.dataset.exTirar, 1); orc.custosExtras = extras; salvarR(); novo(); });
    el.querySelectorAll('[data-aj]').forEach((x) => x.onchange = () => { const a2 = { ...(orc.custosAjustados || {}) }; if (x.value === '') delete a2[x.dataset.aj]; else a2[x.dataset.aj] = +x.value; orc.custosAjustados = a2; salvarR(); novo(); });
    el.querySelectorAll('[data-aj-limpar]').forEach((x) => x.onclick = () => { const a2 = { ...(orc.custosAjustados || {}) }; delete a2[x.dataset.ajLimpar]; orc.custosAjustados = a2; salvarR(); novo(); });
  }

  function passo6(el) {
    const p = P(), a = C.analisar(orc, p), diag = A.lista[0].fn({ o: orc, a });
    el.innerHTML = `<div class="lado"><div class="painel brilha">
        <span class="rotulo" style="color:var(--sol)">O que o cliente vai ver primeiro</span>
        <h2 style="font-size:26px;margin:10px 0">${orc.grupo === 'A' || /padaria|auto|peças|ltda|comércio|mercado|loja/i.test(orc.nome) ? 'Sua empresa pagou' : 'Você pagou'} <span class="grad">${brl(a.raioX.pago12)}</span> de ${orc.grupo === 'A' ? 'energia' : 'luz'} nos últimos 12 meses.</h2>
        <div class="numeros4"><div><span>Em 25 anos sem solar</span><b>${brl(a.raioX.total25)}</b></div><div><span>Custo da espera</span><b>${brl(a.espera.porMes)}/mês</b></div>
        <div><span>${a.boleto.prazo}x parcela + ${C.ehGA(orc) ? 'o que fica na conta' : 'conta mínima'}</span><b>${brl(a.boleto.totalMes)}</b></div><div><span>Conta hoje</span><b>${brl(a.boleto.contaAtual)}</b></div></div>
        <p class="sutil" style="margin-top:12px">Ao gerar, o sistema cria um link único. Cada vez que o cliente abrir, ler uma parte, simular parcela ou compartilhar, você fica sabendo na ficha dele.</p></div>
      <div class="painel">${blocos(diag, null)}</div></div>`;
  }

  /* ======================= PARÂMETROS ======================= */
  const CAMPOS = [
    ['Custo fixo', [['custoFixoMes', 'Custo fixo do mês (R$)', 1], ['kwpPrevistosMes', 'Meta de venda (kWp/mês)', 1], ['obrasPrevistasMes', 'Obras/mês (se meta = 0)', 1]]],
    ['Custos por obra', [['maoDeObraPorPlaca', 'Terceiro por placa (R$)', 1], ['art', 'ART (R$)', 1], ['materialCaBase', 'Material CA fixo (R$)', 1], ['materialCaPorKwp', 'Material CA/kWp (R$)', 1], ['custoKm', 'Custo por km (R$)', 1], ['visitasObra', 'Viagens por obra', 1], ['trocaPadrao', 'Troca de padrão (R$)', 1], ['reservaGarantia', 'Reserva garantia (% kit)', 100], ['fretePadrao', 'Frete quando não vem no kit (R$)', 1]]],
    ['Resposta rápida', [['kitRefWp', 'Kit de referência (R$/Wp)', 1], ['moduloRefW', 'Placa de referência (W)', 1]]],
    ['Regras técnicas', [['limiteMonoEmTriKw', 'Cliente trifásico: inversor mono 220 V até (kW)', 1]]],
    ['Robô de cotação', [['roboOverloadMin', 'Overload mínimo do inversor (%)', 1], ['roboOverloadMax', 'Overload máximo do inversor (%) · 0 = o do fabricante', 1], ['roboModMinW', 'Placa mínima (W) · 0 = qualquer', 1], ['validadeKitDias', 'Validade do preço do kit (dias)', 1]]],
    ['Meta', [['metaPropostasSemana', 'Propostas enviadas por semana (meta)', 1]]],
    ['Percentuais', [['impostoTotal', 'Imposto com kit (%)', 100], ['impostoServico', 'Imposto só serviço (%)', 100], ['reservaNegociacao', 'Reserva de negociação (%)', 100]]],
    ['Formas de pagamento', [['taxaPagamento.avista', 'Taxa à vista (%)', 100], ['taxaPagamento.financiamento', 'Taxa no financiamento (%)', 100], ['taxaPagamento.cartao', 'Taxa no cartão (%)', 100], ['cartao.parcelas', 'Parcelas no cartão', 1], ['financiamento.jurosMes', 'Juros do financiamento (% ao mês)', 100]]],
    ['Semáforo do preço (R$/Wp)', [['semaforo.verdeAte', 'Verde até (R$/Wp)', 1], ['semaforo.amareloAte', 'Amarelo até (R$/Wp)', 1], ['semaforo.referencia', 'Média do mercado (R$/Wp)', 1]]],
    ['Serviços avulsos', [['manutencaoPorPlaca', 'Manutenção por placa (R$)', 1], ['margemAvulso', 'Margem de ampliação e troca (%)', 100]]],
    ['Robô Belenergy', [['kwpMaxKit', 'kWp máximo por kit (acima disso cota kits iguais)', 1]]],
    ['Conversão e retorno', [['tarifaKwh', 'Tarifa padrão (R$/kWh)', 1], ['margemGeracao', 'Margem de geração (%)', 100], ['perdaOrientacao', 'Perda de segurança da orientação (%)', 100], ['reajusteAnual', 'Reajuste ao ano (%)', 100], ['simultaneidade', 'Simultaneidade (%)', 100], ['validadeDias', 'Validade da cotação (dias)', 1], ['manutencaoAnual', 'Manutenção/ano (R$)', 1], ['pr', 'PR (eficiência)', 1], ['degradacaoAnual', 'Degradação das placas ao ano (%)', 100], ['taxaDesconto', 'Taxa do VPL (%)', 100], ['fioB.valorKwh', 'Fio B (R$/kWh)', 1]]],
  ];
  const pegaP = (o, k) => k.split('.').reduce((a, x) => (a == null ? a : a[x]), o);
  let faixasMg = null, faixasEng = null; // faixas sendo editadas (sobrevivem ao redesenho até salvar)
  function tabFaixa(id, titulo, campo, un, m, lista) {
    return `<div class="painel"><span class="rotulo">${titulo}</span><table style="margin-top:8px">${lista.map((x, i) => { const ult = i === lista.length - 1; return `<tr><td>${ult ? 'acima disso' : `até <input type="number" step="any" data-fx="${id}" data-i="${i}" data-c="ate" value="${x.ate}" style="width:70px;padding:6px 8px;text-align:right"> kWp`}</td>
      <td class="v">${un === 'R$' ? 'R$ ' : ''}<input type="number" step="any" data-fx="${id}" data-i="${i}" data-c="${campo}" data-m="${m}" value="${+(x[campo] * m).toFixed(2)}" style="width:90px;padding:6px 8px;text-align:right">${un === '%' ? ' %' : ''}</td>
      <td>${lista.length > 1 ? `<button class="btn vidro pequeno" data-fxdel="${id}" data-i="${i}" title="Tirar esta faixa">✕</button>` : ''}</td></tr>`; }).join('')}</table>
      <button class="btn vidro pequeno" data-fxmais="${id}" style="margin-top:6px">+ faixa</button></div>`;
  }
  function lerFaixas() { // pega o que está digitado nas tabelas de faixa
    [['mg', faixasMg], ['eng', faixasEng]].forEach(([id, lista]) => app.querySelectorAll(`[data-fx="${id}"]`).forEach((inp) => { const x = lista[+inp.dataset.i]; if (!x) return; const v = +inp.value; if (inp.dataset.c === 'ate') x.ate = v; else x[inp.dataset.c] = v / +(inp.dataset.m || 1); }));
  }
  function parametrosPag() {
    const p = P();
    if (!faixasMg) faixasMg = JSON.parse(JSON.stringify(p.margens || []));
    if (!faixasEng) faixasEng = JSON.parse(JSON.stringify(p.engenharia || []));
    app.innerHTML = `${cabCelular()}<div class="cab"><div><h1>Parâmetros</h1><p class="sutil">${B.nuvem ? 'Valores usados em todos os orçamentos. Cada vez que salvar, a versão anterior fica guardada.' : 'Valores de teste. Troque pelos reais quando tiver custo fixo, alíquota e preço do terceiro.'}</p></div></div>
      <div class="lado"><div>${CAMPOS.map(([t, cs]) => `<div class="painel"><span class="rotulo">${t}</span><div class="grade g2" style="margin-top:12px">${cs.map(([k, r, m]) => `<label class="campo"><span>${r}</span><input type="number" step="any" data-par="${k}" data-m="${m}" value="${Number.isFinite(+pegaP(p, k)) ? +(pegaP(p, k) * m).toFixed(4) : ''}"></label>`).join('')}${t === 'Custos por obra' ? `<label class="alternar" style="grid-column:1/-1;margin:4px 0 0"><span>Frete já vem no valor do kit (Belenergy)</span><input type="checkbox" id="pFreteIncl" ${p.freteIncluso ? 'checked' : ''}></label>` : ''}${t === 'Formas de pagamento' ? `<label class="campo" style="grid-column:1/-1"><span>Prazos do financiamento (meses, separados por vírgula)</span><input type="text" id="pPrazos" value="${esc(((p.financiamento || {}).prazos || []).join(', '))}"></label>` : ''}</div></div>`).join('')}</div>
      <div><div class="painel" id="espBox"><span class="rotulo">💾 Espaço usado (Supabase)</span><p class="mini" style="margin:6px 0">carregando…</p></div><div class="painel"><span class="rotulo">Robô do escritório (fila do Jarvis)</span><p class="mini" style="margin:6px 0">O robô no computador do escritório pega na fila os pedidos do Jarvis, cota na Belenergy e devolve o preço real. Copie a chave para o arquivo <b>robo-config.json</b> da pasta do robô (uma vez).</p>
        <div id="rbSt" class="aviso" style="margin:6px 0">Conferindo o robô…</div><div class="acoes-r"><button class="btn sol pequeno" id="rbBaixar">⬇ Baixar robo-config.json</button><button class="btn vidro pequeno" id="rbChave">Mostrar a chave</button><span class="mini" id="rbFila"></span></div><div id="rbOut"></div>
        <div style="border-top:1px dashed var(--linha);margin-top:12px;padding-top:10px"><label class="entre mini"><span><b>Pré-propostas todo dia de manhã</b> (as mais vendidas, já cotadas na Belenergy)</span><span><input type="checkbox" id="ppAtivo" ${(p.prePropostas || {}).ativo ? 'checked' : ''}> ligado · às <input type="time" id="ppHora" value="${esc((p.prePropostas || {}).hora || '05:00')}" style="width:96px;padding:4px 6px"></span></label>
          <p class="mini" style="margin:6px 0">Se o computador estiver desligado nesse horário, o robô faz assim que ligar. Quando o Jarvis criar uma proposta de tamanho parecido (até 10%), o preço da pré-proposta entra na hora e o robô ainda cota o tamanho exato.</p>
          <div id="ppLista"></div>
          <div class="acoes-r" style="margin-top:6px"><button class="btn vidro pequeno" id="ppSugerir">Sugerir pelas mais vendidas</button><button class="btn vidro pequeno" id="ppMais">+ tamanho</button><button class="btn sol pequeno" id="ppSalvar">Salvar pré-propostas</button></div>
          <div id="ppHoje" class="mini" style="margin-top:8px"></div></div></div>
      ${tabFaixa('mg', 'Margem por tamanho', 'margem', '%', 100, faixasMg)}
      ${tabFaixa('eng', 'Projeto e homologação por tamanho', 'valor', 'R$', 1, faixasEng)}
        <div class="painel"><span class="rotulo">Comparação com a Groner</span><p class="sutil" style="margin:6px 0 8px">Como a Groner calcula: (kit + engenharia + mão de obra + ART + deslocamento + outros) ÷ (1 − (percentual + Fator X + comissão)). Fator X: 0% até R$ 100 mil, 5% até R$ 500 mil, 6% acima.</p>
          <div class="grade g2">${[['percentual', 'Percentual (imposto + lucro + comissão) %', 100], ['maoDeObraPorPlaca', 'Mão de obra por placa (R$)', 1], ['art', 'ART (R$)', 1], ['custoKm', 'Deslocamento (R$/km)', 1], ['eng0', 'Engenharia até 10 kWp (R$)', 1], ['eng1', 'Engenharia até 30 kWp (R$)', 1], ['eng2', 'Engenharia acima de 30 kWp (R$)', 1], ['kmIdaVolta', 'Contar o km ida e volta (1 = sim)', 1]].map(([k, r, m]) => { const G = { percentual: 0.365, maoDeObraPorPlaca: 100, art: 70, custoKm: 1, kmIdaVolta: 0, eng: [300, 500, 700], ...(p.groner || {}) }; const v = /^eng\d$/.test(k) ? G.eng[+k.slice(3)] : G[k]; return `<label class="campo"><span>${r}</span><input type="number" step="any" data-gr="${k}" data-m="${m}" value="${+(v * m).toFixed(3)}"></label>`; }).join('')}</div></div>
        ${p.kwpPrevistosMes > 0 ? `<div class="painel"><span class="rotulo">Ponto de equilíbrio</span><p style="margin:8px 0 4px">Para pagar ${brl(p.custoFixoMes)} de custo fixo, a meta é vender <b>${n(p.kwpPrevistosMes)} kWp por mês</b>.</p><p class="sutil" style="margin:0">≈ ${Math.ceil(p.kwpPrevistosMes / 4.3)} obras de 4,3 kWp ou ${Math.ceil(p.kwpPrevistosMes / 10)} de 10 kWp. Vendendo menos, o custo fixo não fecha; vendendo mais, a margem vira lucro.</p></div>` : ''}${B.nuvem ? `<div class="painel"><span class="rotulo">Acessos das plataformas de monitoramento</span>
          <p class="sutil" style="margin:8px 0">Fica guardado no cofre do banco. Depois de salvo, ninguém consegue ver a senha pelo site: só o robô de leitura diária usa.</p>
          <div class="grade g2"><label class="campo"><span>Marca</span><select id="crMarca">${['SolarZ', 'E-mail', ...Usinas.MARCAS.filter((m) => m !== 'Outra'), 'Google Maps'].map((m) => `<option>${m}</option>`).join('')}</select></label>
            <label class="campo"><span>Usuário / e-mail da plataforma</span><input id="crUser" type="text" autocomplete="off"></label>
            <label class="campo"><span>Senha</span><input id="crSenha" type="password" autocomplete="new-password"></label>
            <label class="campo"><span>Chave de API / App ID (se tiver)</span><input id="crChave" type="text" autocomplete="off"></label>
            <label class="campo"><span>Segredo da API / App Secret (se tiver)</span><input id="crSegredo" type="password" autocomplete="new-password"></label>
            <label class="campo"><span>Observação (ex.: servidor, empresa)</span><input id="crObs" type="text"></label></div>
          <div class="acoes-r" style="margin-top:8px"><button class="btn sol pequeno" id="crSalvar">Guardar acesso</button><span class="mini" id="crStatus">carregando…</span></div>
          <div class="acoes-r" style="margin-top:10px;border-top:1px dashed var(--linha);padding-top:10px"><span class="mini" style="flex:1">Relatório mensal por e-mail (clientes com plano): guarde o acesso em <b>E-mail</b> (usuário = seu e-mail, senha = senha da caixa na Hostinger).</span><input id="emTeste" type="email" placeholder="seu e-mail para o teste" style="max-width:230px"><button class="btn vidro pequeno" id="emEnviar">Enviar teste para mim</button></div></div>` : ''}<div class="painel"><span class="rotulo">Formulário de captação (bio do Instagram, Google, WhatsApp)</span><p class="sutil" style="margin:6px 0 8px">Quem preencher vira lead novo na hora, já com a conta estimada e o tipo de cliente, e aparece no Meu dia como "Primeira resposta".</p>
        <div class="entrada-ag"><input type="text" readonly id="capLink" value="${esc(new URL('captacao.html', location.href).href)}"></div>
        <div class="acoes-r" style="margin-top:8px"><button class="btn vidro pequeno" id="capCopiar">Copiar link</button><a class="btn vidro pequeno" target="_blank" rel="noopener" href="captacao.html">Ver como o cliente vê</a></div></div>
      <div class="painel" id="depPainel"><div class="entre"><span class="rotulo">Depoimentos e casos reais (Instagram)</span><button class="btn vidro pequeno" id="depNovo">＋ Adicionar</button></div>
        <p class="sutil" style="margin:6px 0 8px">Aparecem na Proposta Viva em "Quem já tem perto de você?" e nas mensagens de prova social. Só casos reais, com autorização do cliente.</p>
        ${(p.depoimentos || []).map((d, i) => `<div class="entre" style="padding:8px 0;border-top:1px dashed var(--linha)"><span><b>${esc(d.nome)}</b> <span class="mini">${esc(d.cidade || '')}${d.contaAntes ? ' · ' + brl(d.contaAntes) + ' → ' + brl(d.contaDepois) : ''}</span><br><span class="mini">${esc(String(d.texto || '').slice(0, 90))}</span></span><span><button class="link" data-dep-ed="${i}">editar</button> · <button class="link" data-dep-rm="${i}">tirar</button></span></div>`).join('') || '<p class="mini">Nenhum ainda. Comece pelos 3 melhores posts de cliente do Instagram.</p>'}</div>
      <div class="painel"><div class="entre"><span class="rotulo">Treino do robô Belenergy</span><a class="btn vidro pequeno" href="#treino">Abrir treino ›</a></div><p class="sutil" style="margin:6px 0 0">Cotações automáticas em todas as combinações para achar e corrigir erros antes do cliente.</p></div><div class="painel"><span class="rotulo">Dados da empresa para contrato e procuração</span><div class="grade g2" style="margin-top:10px">${[['razao', 'Razão social'], ['cnpj', 'CNPJ'], ['endereco', 'Endereço da sede'], ['cidadeForo', 'Foro (cidade/UF)'], ['respTecnico', 'Responsável técnico'], ['crea', 'CREA'], ['garantiaInstalacaoAnos', 'Garantia da instalação (anos)', 1], ['prazoInstalacaoDias', 'Prazo de instalação (dias)', 1], ['anosRegiao', 'Anos de empresa na região (selo da proposta)', 1], ['seloConfianca', 'Selo de confiança (ex.: nota no Google), só se for real'], ['linkAvaliacao', 'Link para avaliar no Google (Perfil da Empresa)']].map(([c, r, num]) => `<label class="campo"><span>${r}</span><input type="${num ? 'number' : 'text'}" data-emp="${c}" ${num ? 'data-num="1"' : ''} value="${esc(Documentos.empresaDe(p)[c] ?? '')}"></label>`).join('')}</div></div><div class="painel"><span class="rotulo">Fórmula</span><p class="sutil" style="margin-top:8px">Preço = (custos diretos + taxa fixa) ÷ (1 − (impostos + taxa de pagamento + comissão + margem + reserva))</p></div>
        <div class="acoes-r" style="margin-top:14px"><button class="btn sol" id="salvarP">Salvar</button>${B.nuvem ? '' : '<button class="btn vidro" id="resetP">Voltar ao teste</button>'}</div></div></div>`;
    $('#salvarP').onclick = () => {
      const novoP = {};
      app.querySelectorAll('[data-par]').forEach((i) => {
        if (i.value === '') return; const v = +i.value / +i.dataset.m, k = i.dataset.par;
        if (!k.includes('.')) { novoP[k] = v; return; }
        const [r, ...resto] = k.split('.'); novoP[r] = novoP[r] || JSON.parse(JSON.stringify(p[r] || {}));
        let o = novoP[r]; resto.slice(0, -1).forEach((x) => { o = o[x] = o[x] || {}; }); o[resto[resto.length - 1]] = v;
      });
      if ($('#pFreteIncl')) novoP.freteIncluso = $('#pFreteIncl').checked;
      if ($('#pPrazos')) { const pr = $('#pPrazos').value.split(/[,;\s]+/).map(Number).filter((x) => x > 0); if (pr.length) novoP.financiamento = { ...(novoP.financiamento || p.financiamento || {}), prazos: pr }; }
      lerFaixas();
      const ordena = (l) => { const o = l.filter((x) => Number.isFinite(x.ate)).map((x) => ({ ...x })); o.sort((a, b) => a.ate - b.ate); if (o.length) o[o.length - 1].ate = 1e9; return o; };
      novoP.margens = ordena(faixasMg); novoP.engenharia = ordena(faixasEng);
      const gr = { eng: [300, 500, 700] }; app.querySelectorAll('[data-gr]').forEach((i) => { const v = +i.value / +i.dataset.m; if (/^eng\d$/.test(i.dataset.gr)) gr.eng[+i.dataset.gr.slice(3)] = v; else gr[i.dataset.gr] = v; }); novoP.groner = gr;
      novoP.empresaDoc = { ...(p.empresaDoc || {}) }; app.querySelectorAll('[data-emp]').forEach((i) => { novoP.empresaDoc[i.dataset.emp] = i.dataset.num ? +i.value || 0 : i.value.trim(); });
      B.salvarParametros(novoP); faixasMg = null; faixasEng = null; toast('Parâmetros salvos'); parametrosPag();
    };
    app.querySelectorAll('[data-fxmais]').forEach((b) => b.onclick = () => { lerFaixas(); const l = b.dataset.fxmais === 'mg' ? faixasMg : faixasEng, ult = l[l.length - 1] || { ate: 1e9 }, pen = l[l.length - 2]; l.splice(l.length - 1, 0, { ...ult, ate: pen ? pen.ate + 10 : 10 }); parametrosPag(); toast('Faixa nova: ajuste o "até" e salve'); });
    app.querySelectorAll('[data-fxdel]').forEach((b) => b.onclick = () => { lerFaixas(); const l = b.dataset.fxdel === 'mg' ? faixasMg : faixasEng; l.splice(+b.dataset.i, 1); parametrosPag(); });
    if ($('#espBox')) espaco().then((e) => { const box = $('#espBox'); if (!box) return; if (!e) { box.innerHTML = '<span class="rotulo">💾 Espaço usado</span><p class="mini">Só aparece com o sistema aberto pelo Chamae.</p>'; return; }
      box.innerHTML = `<span class="rotulo">💾 Espaço usado (Supabase)</span>${barraEspaco('Arquivos (documentos e fotos)', e.arq, `${n(e.arq.solar / 1e6)} MB são da Chama Solar; o resto é do Chamae.`)}${barraEspaco('Banco de dados', e.banco, '')}
        <div class="grade g2" style="margin-top:10px"><label class="campo"><span>Limite de arquivos do plano (GB)</span><input type="number" step="0.5" min="0.5" id="espLA" value="${+P().limiteArquivosGB || 1}"></label><label class="campo"><span>Limite do banco do plano (GB)</span><input type="number" step="0.5" min="0.5" id="espLB" value="${+P().limiteBancoGB || 0.5}"></label></div>
        <p class="mini" style="margin:6px 0 0">Plano gratuito: 1 GB de arquivos e 0,5 GB de banco. Se mudar de plano, ajuste os limites. Acima de 80% aparece um aviso no Meu dia.</p>`;
      $('#espLA').onchange = (ev) => { B.salvarParametros({ limiteArquivosGB: +ev.target.value || 1 }); toast('Limite salvo'); parametrosPag(); };
      $('#espLB').onchange = (ev) => { B.salvarParametros({ limiteBancoGB: +ev.target.value || 0.5 }); toast('Limite salvo'); parametrosPag(); }; });
    if ($('#rbBaixar')) {
      $('#rbBaixar').onclick = async () => { try { const k = await B.roboChave(); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify({ chave: k || '' }, null, 2)], { type: 'application/json' })); a.download = 'robo-config.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); toast('Salve o arquivo dentro da pasta do robô (onde fica o INICIAR-COTADOR.bat)'); } catch (e) { toast(e.message); } };
      roboEstado().then((st) => { $('#rbSt').innerHTML = st.html; $('#rbSt').className = 'aviso' + (st.ok ? ' ok' : ''); });
    }
    if ($('#rbChave')) { $('#rbChave').onclick = async () => { try { const k = await B.roboChave(); $('#rbOut').innerHTML = `<pre class="mini" style="white-space:pre-wrap;user-select:all;background:var(--vidro);padding:8px;border-radius:8px;margin-top:6px">{ "chave": "${esc(k || '')}" }</pre><p class="mini">Cole isso num arquivo robo-config.json na pasta do robô. Não mande por mensagem.</p>`; } catch (e) { toast(e.message); } };
        B.filaRoboLer().then((f) => { const pend = (f || []).filter((x) => x.status === 'pendente' || x.status === 'rodando').length; $('#rbFila').textContent = pend ? `${pend} pedido(s) na fila` : 'fila vazia'; }).catch(() => {}); }
    if ($('#ppLista')) {
      const cfg0 = p.prePropostas || {}, LG = { mono: 'Mono', bi: 'Bi', tri: 'Tri' };
      let tam = cfg0.tamanhos || [...new Map((cfg0.itens || []).map((x) => [x.kwp + '|' + (x.ligacao || 'bi'), { kwp: x.kwp, ligacao: x.ligacao || 'bi' }])).values()];
      let est = cfg0.estruturas || ESTRUTURAS.map((e) => e.k);
      const desenhar = () => {
        $('#ppLista').innerHTML = `<p class="mini" style="margin:4px 0"><b>Tamanhos</b></p>${tam.length ? tam.map((x, i) => `<div class="entre mini" style="padding:3px 0;gap:6px"><span><input type="number" step="0.1" data-pp="kwp" data-i="${i}" value="${x.kwp}" style="width:76px;padding:4px 6px"> kWp</span><select data-pp="ligacao" data-i="${i}" style="padding:4px 6px;width:auto">${Object.entries(LG).map(([a, b]) => `<option value="${a}" ${a === x.ligacao ? 'selected' : ''}>${b}</option>`).join('')}</select><button class="link" data-ppx="${i}">tirar</button></div>`).join('') : '<p class="mini">Nenhum tamanho ainda. Toque em "Sugerir pelas mais vendidas".</p>'}
          <p class="mini" style="margin:10px 0 4px"><b>Estruturas</b> (cada tamanho é cotado em todas as marcadas, inversor e micro) <button class="link" id="ppTodas">${est.length === ESTRUTURAS.length ? 'desmarcar todas' : 'marcar todas'}</button></p>
          <div class="chips">${ESTRUTURAS.map((e) => `<button class="chip ${est.includes(e.k) ? 'sel' : ''}" data-ppe="${e.k}">${e.r}</button>`).join('')}</div>
          <p class="mini" id="ppConta" style="margin-top:6px"></p>`;
        const conta = () => { const n = tam.filter((x) => x.kwp > 0).length * est.length; $('#ppConta').innerHTML = `<b>${n} cotação(ões) por manhã</b> (${n * 2} kits). Leva por volta de ${Math.max(1, Math.round(n * 2.5 / 60 * 10) / 10).toLocaleString("pt-BR")} h no robô: escolha um horário cedo e deixe o computador ligado.`; };
        conta();
        app.querySelectorAll('[data-pp]').forEach((el) => { el.onchange = () => { const it = tam[+el.dataset.i]; it[el.dataset.pp] = el.dataset.pp === 'kwp' ? +el.value : el.value; conta(); }; });
        app.querySelectorAll('[data-ppx]').forEach((el) => { el.onclick = () => { tam.splice(+el.dataset.ppx, 1); desenhar(); }; });
        app.querySelectorAll('[data-ppe]').forEach((el) => { el.onclick = () => { const k = el.dataset.ppe; est = est.includes(k) ? est.filter((x) => x !== k) : [...est, k]; desenhar(); }; });
        $('#ppTodas').onclick = () => { est = est.length === ESTRUTURAS.length ? [] : ESTRUTURAS.map((e) => e.k); desenhar(); };
      };
      desenhar();
      $('#ppSugerir').onclick = () => { tam = maisVendidas(); desenhar(); toast('Tamanhos sugeridos pelas vendas. Revise e salve.'); };
      $('#ppMais').onclick = () => { tam.push({ kwp: 5, ligacao: 'bi' }); desenhar(); };
      $('#ppSalvar').onclick = () => {
        const itens = []; tam.filter((x) => x.kwp > 0).forEach((x) => ESTRUTURAS.filter((e) => est.includes(e.k)).forEach((e) => itens.push({ kwp: x.kwp, ligacao: x.ligacao, telhado: e.telhado, fixacao: e.fixacao, rotulo: `${x.kwp} kWp ${LG[x.ligacao]} · ${e.r}`, pedido: pedidoPre({ ...x, telhado: e.telhado, fixacao: e.fixacao }) })));
        const cfg = { ativo: $('#ppAtivo').checked, hora: $('#ppHora').value || '05:00', tamanhos: tam, estruturas: est, itens };
        B.salvarParametros({ prePropostas: cfg }); toast(cfg.ativo ? `Pré-propostas salvas: ${itens.length} cotações, todo dia às ${cfg.hora}` : 'Pré-propostas salvas (desligadas)');
      };
      B.filaRoboLer().then((f) => { const pre = prePropostasProntas(f); $('#ppHoje').innerHTML = pre.length ? `<details><summary><b>Últimas pré-propostas: ${pre.length} pronta(s)</b></summary>${pre.map((j) => `<div class="entre" style="padding:2px 0"><span>${esc(j.pedido.rotulo || j.pedido.base.kwp + ' kWp')}</span><span>${(j.resultado.kits || []).map((k) => k.nivel + ' ' + brl(k.valorKit)).join(' · ')}</span></div>`).join('')}</details>` : ''; }).catch(() => {});
    }
    if ($('#crSalvar')) {
      const status = () => B.credenciaisStatus().then((l) => { $('#crStatus').textContent = l.length ? 'Guardados: ' + l.map((x) => x.marca + ' (' + new Date(x.atualizado_em).toLocaleDateString('pt-BR') + ')').join(', ') : 'Nenhum acesso guardado ainda.'; }).catch(() => { $('#crStatus').textContent = ''; });
      status();
      $('#emEnviar').onclick = async () => {
        const para = $('#emTeste').value.trim(); if (!/@/.test(para)) { toast('Digite o e-mail para o teste'); return; }
        $('#emEnviar').disabled = true;
        try { const j = await B.relatorioMensal({ teste: para }); toast(j.enviados ? 'Teste enviado para ' + para : 'Não enviou: ' + ((j.erros || [])[0] || 'sem usina com plano')); } catch (e) { toast('Não enviou: ' + e.message.slice(0, 100)); }
        $('#emEnviar').disabled = false;
      };
      $('#crSalvar').onclick = async () => {
        const dados = { usuario: $('#crUser').value.trim(), senha: $('#crSenha').value, chave: $('#crChave').value.trim(), segredo: $('#crSegredo').value, obs: $('#crObs').value.trim() };
        if (!dados.usuario && !dados.chave) { toast('Preencha usuário ou chave de API'); return; }
        try { await B.guardarCredencial($('#crMarca').value, dados); ['#crUser', '#crSenha', '#crChave', '#crSegredo', '#crObs'].forEach((id) => { $(id).value = ''; }); toast('Acesso guardado'); status(); } catch (e) { toast('Não guardou: ' + e.message.slice(0, 80)); }
      };
    }
    const depForm = (i) => {
      const d = i >= 0 ? { ...p.depoimentos[i] } : {};
      const ov = document.createElement('div'); ov.style.cssText = 'position:fixed;inset:0;z-index:80;background:#0009;display:grid;place-items:center;padding:16px';
      const c = (k, r, t = 'text', ph = '') => `<label class="campo"><span>${r}</span><input data-dp="${k}" type="${t}" step="any" placeholder="${esc(ph)}" value="${esc(d[k] ?? '')}"></label>`;
      ov.innerHTML = `<div class="painel" style="max-width:560px;width:100%;max-height:92vh;overflow:auto"><div class="entre"><span class="rotulo" style="color:var(--sol)">Depoimento</span><button class="link" data-x>fechar</button></div>
        <div class="grade g2" style="margin-top:10px">${c('nome', 'Nome como vai aparecer', 'text', 'Ex.: Dona Rosa')}${c('cidade', 'Cidade', 'text', 'Ribeirão Preto')}${c('contaAntes', 'Conta antes (R$)', 'number')}${c('contaDepois', 'Conta depois (R$)', 'number')}${c('desde', 'Instalado em', 'text', 'mar/2025')}${c('link', 'Link do post no Instagram', 'url', 'https://www.instagram.com/p/...')}</div>
        <label class="campo" style="margin-top:8px"><span>Frase do cliente (curta, nas palavras dele)</span><textarea data-dp="texto" rows="3" style="width:100%">${esc(d.texto || '')}</textarea></label>
        <div class="acoes-r" style="margin-top:10px"><button class="btn sol" data-ok>Salvar</button></div></div>`;
      document.body.appendChild(ov);
      ov.onclick = (e) => {
        if (e.target === ov || e.target.closest('[data-x]')) return ov.remove();
        if (!e.target.closest('[data-ok]')) return;
        ov.querySelectorAll('[data-dp]').forEach((x) => { d[x.dataset.dp] = x.type === 'number' ? (x.value === '' ? null : +x.value) : x.value.trim(); });
        if (!d.nome || !(d.texto || d.contaAntes)) return toast('Coloque o nome e a frase ou as contas');
        const lista = [...(p.depoimentos || [])]; i >= 0 ? (lista[i] = d) : lista.push(d);
        B.salvarParametros({ depoimentos: lista }); ov.remove(); toast('Depoimento salvo'); parametrosPag();
      };
    };
    $('#depNovo').onclick = () => depForm(-1);
    $('#capCopiar').onclick = () => copiar($('#capLink').value);
    app.querySelectorAll('[data-dep-ed]').forEach((b) => b.onclick = () => depForm(+b.dataset.depEd));
    app.querySelectorAll('[data-dep-rm]').forEach((b) => b.onclick = () => { const lista = (p.depoimentos || []).filter((_, k) => k !== +b.dataset.depRm); B.salvarParametros({ depoimentos: lista }); parametrosPag(); });
    if ($('#resetP')) $('#resetP').onclick = () => { B.zerarParametros(); parametrosPag(); toast('Voltou aos valores de teste'); };
  }


  /* ======================= CATÁLOGO ======================= */
  let filtroCat = 'modulo';
  /* ======================= USINAS (monitoramento) ======================= */
  const usF = { filtro: 'todas', busca: '', ordem: 'atencao', ver: 30, aberta: null, marca: '' };
  function usinasPag() {
    const U = window.Usinas, lista = B.usinas().filter((u) => u.ativo !== false);
    const lei = (u) => (B.leitura ? B.leitura(u.id) : null);
    const info = lista.map((u) => { const g = B.geracao(u.id), s = U.situacao(u, g), l = lei(u);
      const est = s.diasSemDado === null ? 'semleitura' : s.diasSemDado >= 2 ? 'semcom' : s.alerta ? 'atencao' : 'bem', off = est === 'semcom'; return { u, g, s, l, off, est }; });
    const marcas = Object.entries(info.reduce((m, x) => { const k = String(x.u.marca || 'Sem marca'); m[k] = (m[k] || 0) + 1; return m; }, {})).sort((a, b2) => b2[1] - a[1]);
    if (usF.marca && !marcas.some(([m]) => m === usF.marca)) usF.marca = '';
    const daMarca = (x) => !usF.marca || String(x.u.marca || 'Sem marca') === usF.marca;
    const conta = (k) => info.filter((x) => daMarca(x) && (k === 'todas' ? true : k === 'semcom' ? x.off : x.est === k)).length;
    const totalMes = info.reduce((t, x) => t + x.s.total, 0);
    const COR = { atencao: 'var(--laranja)', semcom: '#ff5c5c', semleitura: 'var(--texto-3)', bem: 'var(--verde-claro)' };
    const ROT = { atencao: 'atenção', semcom: 'sem comunicação', semleitura: 'sem leitura no mês', bem: 'gerando bem' };
    const q = usF.busca.toLowerCase();
    let vis = info.filter((x) => daMarca(x) && (usF.filtro === 'todas' || (usF.filtro === 'semcom' ? x.off : x.est === usF.filtro)) && (!q || [x.u.cliente_nome, x.u.cidade, x.u.plataforma_id, x.u.marca].join(' ').toLowerCase().includes(q)));
    const peso = { atencao: 0, semcom: 1, semleitura: 2, bem: 3 };
    vis.sort(usF.ordem === 'nome' ? (a, b2) => String(a.u.cliente_nome).localeCompare(String(b2.u.cliente_nome)) : usF.ordem === 'kwp' ? (a, b2) => b2.u.kwp - a.u.kwp : usF.ordem === 'pct' ? (a, b2) => (a.s.pct ?? 9) - (b2.s.pct ?? 9) : (a, b2) => peso[a.est] - peso[b2.est] || String(a.u.cliente_nome).localeCompare(String(b2.u.cliente_nome)));
    const total = vis.length; vis = vis.slice(0, usF.ver);
    const kpi = (k, rot, val, sub, cor) => `<button class="kpi ${usF.filtro === k ? 'destaque' : ''}" data-usf="${k}" style="text-align:left;cursor:pointer;font:inherit;color:inherit"><span class="rotulo">${rot}</span><b style="${cor ? `color:${cor}` : ''}">${val}</b><span class="sutil">${sub}</span></button>`;
    const linha = ({ u, s, l, off, est }) => { const ab = usF.aberta === String(u.id);
      return `<div class="us-l ${ab ? 'aberta' : ''}"><button class="us-cab" data-usab="${u.id}"><i style="background:${COR[est]}" title="${ROT[est]}"></i>
          <span class="us-n"><b>${esc(u.cliente_nome)}</b><small><span class="us-app">${esc(appDe(u).nome)}</span>${u.cidade ? ' · ' + esc(u.cidade) : ''} · ${n(u.kwp, 2)} kWp</small></span>
          <span class="us-b"><span><em style="width:${Math.min((s.pct || 0) * 100, 100)}%;background:${s.pct !== null && s.pct < 0.75 ? 'var(--laranja)' : 'var(--verde-claro)'}"></em></span><small>${off ? `sem dados há ${s.diasSemDado} dias` : s.diasSemDado === null ? 'nunca leu geração' : s.pct === null ? `${n(s.total)} kWh no mês · conferir kWp` : `${n(s.pct * 100)}% do esperado · ${n(s.total)} kWh`}</small></span><span class="us-s">›</span></button>
        ${ab ? `<div class="us-d">${s.alerta ? `<p class="aviso" style="margin:0 0 8px">⚠️ ${esc(s.alerta)}</p>` : ''}
          <div class="numeros4"><div><span>Este mês</span><b>${s.diasSemDado === null ? '–' : n(s.total) + ' kWh'}</b></div><div><span>Esperado</span><b>${n(s.esperadoMes)} kWh/mês${Number(u.esperado_mes) > 0 ? '' : ' (estimado)'}</b></div><div><span>Economia no mês</span><b>${s.pct === null ? '–' : brl(s.economiaMes)}</b></div><div><span>Desde a instalação</span><b data-total="${u.id}">${l ? n(l.total_kwh) + ' kWh' : '–'}</b></div></div>
          <div class="us-graf" data-graf="${u.id}"><p class="sutil">carregando a geração…</p></div>
          <p class="mini" style="margin:8px 0"><b>App: ${esc(appDe(u).nome)}</b> · ${esc(appDe(u).via)}${u.plataforma_id ? ' · id ' + esc(String(u.plataforma_id).replace(/^sz:/, '')) : ''}${l ? ` · ${off ? '<b style="color:#ff5c5c">inversor sem comunicação</b>' : `comunicando${+l.potencia_w > 0 ? ' (' + n(l.potencia_w) + ' W na leitura)' : ''}`}` : ''}${s.ultimo ? ' · última leitura ' + s.ultimo.split('-').reverse().join('/') : ''}${u.whatsapp ? '' : ' · <b>sem WhatsApp cadastrado</b>'}</p>
          <div class="acoes-r" style="flex-wrap:wrap"><button class="btn sol pequeno" data-us="conta" data-id="${u.id}">💡 Relatório da conta</button><button class="btn vidro pequeno" data-us="rel" data-id="${u.id}">Relatório do mês</button><button class="btn vidro pequeno" data-us="app" data-id="${u.id}">📱 App do cliente</button><button class="btn vidro pequeno" data-us="rateio" data-id="${u.id}">🔀 Rateio de créditos</button>${u.whatsapp ? `<button class="btn zap pequeno" data-us="zap" data-id="${u.id}">WhatsApp</button>` : ''}<button class="btn vidro pequeno" data-us="imp" data-id="${u.id}">Importar planilha</button><button class="btn vidro pequeno" data-us="ed" data-id="${u.id}">Editar</button></div></div>` : ''}</div>`; };
    app.innerHTML = `${cabCelular()}<div class="cab entra"><div><h1>Usinas</h1><p class="sutil">${lista.length} usinas · ${n(lista.reduce((t, u) => t + Number(u.kwp), 0), 1)} kWp · ${n(totalMes)} kWh no mês</p></div>
        <div class="linha-h"><button class="btn vidro" id="usAtu">↻ Atualizar</button><button class="btn sol" id="usNova">＋ Usina</button></div></div>
      <div class="kpis entra us-kpis">${kpi('atencao', 'Precisam de atenção', conta('atencao'), 'gerando abaixo do esperado', conta('atencao') ? 'var(--laranja)' : '')}${kpi('semcom', 'Sem comunicação', conta('semcom'), 'inversor sem internet', conta('semcom') ? '#ff5c5c' : '')}${kpi('bem', 'Gerando bem', conta('bem'), 'dentro do esperado', '')}${kpi('todas', 'Todas', conta('todas'), usF.marca ? 'da marca ' + esc(usF.marca) : 'ver a lista inteira', '')}</div>
      <div class="painel entra us-barra"><input type="search" id="usBusca" placeholder="Buscar cliente, cidade ou id da plataforma" value="${esc(usF.busca)}">
        <select id="usMarca" aria-label="Marca"><option value="">Todas as marcas (${info.length})</option>${marcas.map(([m, q2]) => `<option value="${esc(m)}" ${usF.marca === m ? 'selected' : ''}>${esc(m)} (${q2})</option>`).join('')}</select>
        <select id="usOrdem"><option value="atencao" ${usF.ordem === 'atencao' ? 'selected' : ''}>Problemas primeiro</option><option value="pct" ${usF.ordem === 'pct' ? 'selected' : ''}>Pior desempenho</option><option value="kwp" ${usF.ordem === 'kwp' ? 'selected' : ''}>Maiores</option><option value="nome" ${usF.ordem === 'nome' ? 'selected' : ''}>Nome (A-Z)</option></select></div>
      <p class="mini" style="margin:4px 2px 8px">${usF.filtro === 'todas' ? 'Todas as usinas' : ROT[usF.filtro][0].toUpperCase() + ROT[usF.filtro].slice(1)}: ${total}${usF.marca ? ` · marca ${esc(usF.marca)}` : ''}${usF.busca ? ` com “${esc(usF.busca)}”` : ''} · toque numa usina para ver os detalhes e os relatórios</p>
      <div class="us-lista">${vis.map(linha).join('') || '<p class="sutil" style="padding:14px">Nada por aqui.</p>'}</div>
      ${total > vis.length ? `<button class="btn vidro" id="usMais" style="width:100%;margin-top:10px">Mostrar mais ${Math.min(30, total - vis.length)} de ${total - vis.length}</button>` : ''}
      <details class="painel" id="usStatus" style="margin-top:14px"><summary class="rotulo" style="cursor:pointer">Leitura das plataformas e importação</summary><div id="usStatusC"><p class="sutil" style="margin:6px 0 0">carregando…</p></div><div class="acoes-r" style="margin-top:8px"><button class="btn vidro pequeno" id="usImp">Importar planilha de uma usina</button><a class="btn vidro pequeno" href="#parametros">Editar acessos</a></div></details>
      <input type="file" id="usArq" accept=".csv,.txt,.tsv" hidden>`;
    app.querySelectorAll('[data-usf]').forEach((b2) => b2.onclick = () => { usF.filtro = usF.filtro === b2.dataset.usf && b2.dataset.usf !== 'todas' ? 'todas' : b2.dataset.usf; usF.ver = 30; usinasPag(); });
    app.querySelectorAll('[data-usab]').forEach((b2) => b2.onclick = () => { usF.aberta = usF.aberta === b2.dataset.usab ? null : b2.dataset.usab; graf.modo = 'dia'; graf.ref = null; const y = scrollY; usinasPag(); scrollTo(0, y); });
    const bx = $('#usBusca'); bx.oninput = () => { usF.busca = bx.value; usF.ver = 30; clearTimeout(avDeb); avDeb = setTimeout(() => { usinasPag(); const c = $('#usBusca'); c.focus(); c.setSelectionRange(c.value.length, c.value.length); }, 250); };
    $('#usOrdem').onchange = (e) => { usF.ordem = e.target.value; usinasPag(); };
    $('#usMarca').onchange = (e) => { usF.marca = e.target.value; usF.ver = 30; usinasPag(); };
    if ($('#usMais')) $('#usMais').onclick = () => { const y = scrollY; usF.ver += 30; usinasPag(); scrollTo(0, y); };
    let alvo = null;
    const arq = $('#usArq');
    arq.onchange = async () => { const f = arq.files[0]; arq.value = ''; if (!f || !alvo) return; const linhas = U.lerPlanilha(await f.text()); if (!linhas.length) { toast('Não achei datas e kWh nesse arquivo. Exporte em CSV com data e energia.'); return; } await B.gravarGeracao(alvo, linhas); toast(linhas.length + ' dia(s) importados'); usinasPag(); };
    B.execucoes().then((ex) => {
      const el = $('#usStatusC'); if (!el) return;
      const ult = {}; ex.forEach((x) => { if (!ult[x.marca]) ult[x.marca] = x; });
      const linhas = Object.values(ult).map((x) => `<tr><td><b>${esc(x.marca)}</b></td><td>${x.ok ? (x.resumo && x.resumo.usinas ? '✅ ' + x.resumo.usinas + ' usina(s), ' + x.resumo.dias + ' dia(s) lidos' : '⚠️ conectou, mas a plataforma não devolveu usinas') : '❌ ' + esc(x.erro || 'erro')}</td><td class="mini">${new Date(x.em).toLocaleString('pt-BR')}</td></tr>`).join('');
      el.innerHTML = `${linhas ? `<table style="margin-top:8px">${linhas}</table>` : '<p class="sutil" style="margin:6px 0 0">Nenhuma leitura ainda. Guarde o acesso em Parâmetros e toque em Atualizar agora.</p>'}<p class="mini" style="margin:6px 0 0">Lê sozinho todo dia às 6h30.</p>`;
    }).catch(() => { const el = $('#usStatusC'); if (el) el.innerHTML = ''; });
    app.querySelectorAll('[data-graf]').forEach((el) => graficoUsina(el, lista.find((x) => String(x.id) === el.dataset.graf)));
    $('#usNova').onclick = () => formUsina({});
    $('#usAtu').onclick = async (ev) => {
      const b = ev.target; b.disabled = true; b.textContent = 'Lendo as plataformas… (até 2 min)';
      try { const r = await B.atualizarMonitoramento(); toast(Object.entries(r).map(([m, x]) => m + ': ' + (x.erro ? 'erro — ' + x.erro : typeof x === 'string' ? x : x.usinas + ' usinas, ' + x.dias + ' dias')).join(' · ') || 'Nenhuma plataforma com acesso guardado'); usinasPag(); }
      catch (e) { toast('Não leu: ' + String(e.message).slice(0, 120)); b.disabled = false; b.textContent = '↻ Atualizar agora'; }
    };
    $('#usImp').onclick = () => { if (!lista.length) { toast('Cadastre a usina primeiro'); return; } escolher(lista, (u) => { alvo = u.id; arq.click(); }); };
    app.querySelectorAll('[data-us]').forEach((b) => b.onclick = () => {
      const u = lista.find((x) => String(x.id) === b.dataset.id), g = B.geracao(u.id);
      if (b.dataset.us === 'conta') formFatura(u);
      else if (b.dataset.us === 'rel') U.relatorio(u, histUs[u.id] || g, graf.ref && graf.ref.length === 7 && graf.modo === 'dia' ? new Date(graf.ref + '-15T12:00:00') : new Date());
      else if (b.dataset.us === 'app') appCliente(u);
      else if (b.dataset.us === 'rateio') formRateio(u);
      else if (b.dataset.us === 'zap') window.open('https://wa.me/55' + String(u.whatsapp || '').replace(/\D/g, '').replace(/^55/, '') + '?text=' + encodeURIComponent(U.mensagem(u, g)), '_blank', 'noopener');
      else if (b.dataset.us === 'imp') { alvo = u.id; arq.click(); }
      else formUsina(u);
    });
  }
  /* ======================= RELATÓRIO DE VENDAS (por período, mês a mês) ======================= */
  const vF = { de: null, ate: null, busca: '' };
  function vendaDe(o) {
    const c = (o.compras || [])[0] || {};
    let op = null; try { const ops = C.opcoes(o, P()); op = ops[o.opcaoEscolhida ?? 1] || ops[0]; } catch { /* sem consumo */ }
    const kwp = (o.compras || []).reduce((t, x) => t + (+x.kwp || 0), 0) || (op ? op.dim.kwpReal : 0);
    const valor = (o.compras || []).reduce((t, x) => t + (+x.valorTotal || 0), 0) || +o.valorFechado || (op ? op.preco.precoFinal : 0);
    const data = String(o.ganhoEm || (o.aceite && o.aceite.em) || c.data || o.atualizadoEm || o.criadoEm || '').slice(0, 10);
    return { o, data, semData: !o.ganhoEm, kwp, valor, placas: c.placas || (op ? op.dim.placas : 0), placaW: c.placaW || (op ? op.modulo.potenciaW : 0), inversor: c.inversor || (op && op.inversor ? op.inversor.nome : ''), pagamento: c.formaPagamento || o.formaPagamento || '' };
  }
  function vendasPag() {
    const hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
    if (!vF.ate) vF.ate = hoje.slice(0, 7);
    if (!vF.de) { const d = new Date(+hoje.slice(0, 4), +hoje.slice(5, 7) - 12, 1); vF.de = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
    const todos = (B.todos ? B.todos() : B.orcamentos()).filter((o) => !o.apagado && !AVULSO_V(o));
    const vendas = todos.filter((o) => o.status === 'ganho').map(vendaDe).filter((v) => v.data && v.data.slice(0, 7) >= vF.de && v.data.slice(0, 7) <= vF.ate)
      .filter((v) => !vF.busca || [v.o.nome, v.o.cidade, v.o.origem, v.inversor].join(' ').toLowerCase().includes(vF.busca.toLowerCase()))
      .sort((a, b) => b.data.localeCompare(a.data));
    const meses = {}; vendas.forEach((v) => { (meses[v.data.slice(0, 7)] = meses[v.data.slice(0, 7)] || []).push(v); });
    const MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    const nomeMes = (k) => { const t = `${MES[+k.slice(5, 7) - 1]} de ${k.slice(0, 4)}`; return t[0].toUpperCase() + t.slice(1); };
    const tot = (l) => ({ q: l.length, kwp: l.reduce((t, v) => t + v.kwp, 0), valor: l.reduce((t, v) => t + v.valor, 0) });
    const T = tot(vendas), chaves = Object.keys(meses).sort().reverse();
    const maxV = Math.max(...chaves.map((k) => tot(meses[k]).valor), 1);
    const todosMeses = []; for (let d = new Date(+vF.de.slice(0, 4), +vF.de.slice(5, 7) - 1, 1), fim = vF.ate; ; d.setMonth(d.getMonth() + 1)) { const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; if (k > fim || todosMeses.length > 120) break; todosMeses.push(k); }
    const PAG = { avista: 'À vista', financiamento: 'Financiamento', cartao: 'Cartão', entrada: 'Entrada + parcelas' };
    const linhaV = (v) => `<tr><td>${v.data.split('-').reverse().join('/')}${v.semData ? ' <span class="mini" title="Sem data de fechamento: usei a data do aceite ou da compra">≈</span>' : ''}</td><td><a href="#lead-${esc(v.o.id)}" style="color:inherit"><b>${esc(v.o.nome)}</b></a><br><span class="mini">${esc(v.o.cidade || '')}${v.o.origem ? ' · ' + esc(v.o.origem) : ''}</span></td>
      <td class="v">${n(v.kwp, 2)} kWp<br><span class="mini">${v.placas ? v.placas + '× ' + (v.placaW || '') + ' W' : ''}</span></td><td class="mini">${esc(String(v.inversor || '').replace(/INVERSOR( DE CORRENTE)?/i, '').trim().slice(0, 42))}</td><td class="mini">${esc(PAG[v.pagamento] || v.pagamento || '')}</td><td class="v"><b>${brl(v.valor)}</b></td></tr>`;
    app.innerHTML = `${cabCelular()}<div class="cab entra"><div><h1>Relatório de vendas</h1><p class="sutil">Clientes fechados por período, mês a mês</p></div>
        <div class="linha-h"><button class="btn vidro" id="vRetro">＋ Dar ganho com data antiga</button><button class="btn vidro" id="vCsv">⬇ Planilha (CSV)</button><button class="btn sol" id="vImp">🖨 Imprimir / PDF</button></div></div>
      <div class="painel entra us-barra" style="grid-template-columns:auto auto 1fr"><label class="campo"><span>De</span><input type="month" id="vDe" value="${vF.de}"></label><label class="campo"><span>Até</span><input type="month" id="vAte" value="${vF.ate}" max="${hoje.slice(0, 7)}"></label>
        <label class="campo"><span>Buscar</span><input type="search" id="vBusca" placeholder="cliente, cidade, origem, inversor" value="${esc(vF.busca)}"></label></div>
      <div class="chips" style="margin:8px 0">${[['Este mês', 0, 0], ['Mês passado', 1, 1], ['Últimos 3 meses', 2, 0], ['Últimos 12 meses', 11, 0], ['Este ano', 'ano', 0]].map(([r, a, b]) => `<button class="chip" data-vper="${a}|${b}">${r}</button>`).join('')}</div>
      <div class="kpis entra"><div class="kpi destaque"><span class="rotulo">Vendido no período</span><b>${brl(T.valor)}</b><span class="sutil">${T.q} contrato(s)</span></div>
        <div class="kpi"><span class="rotulo">kWp vendidos</span><b>${n(T.kwp, 1)}</b><span class="sutil">${T.q ? n(T.kwp / T.q, 1) + ' kWp por venda' : '–'}</span></div>
        <div class="kpi"><span class="rotulo">Ticket médio</span><b>${T.q ? brl(T.valor / T.q) : '–'}</b><span class="sutil">${T.kwp ? brl(T.valor / T.kwp / 1000, 2) + ' por Wp' : ''}</span></div>
        <div class="kpi"><span class="rotulo">Média por mês</span><b>${chaves.length ? brl(T.valor / chaves.length) : '–'}</b><span class="sutil">${chaves.length} mês(es) com venda</span></div></div>
      ${todosMeses.length > 1 ? `<div class="painel entra" style="margin-top:12px"><span class="rotulo">Vendas por mês (valor)</span><div class="vd-barras">${todosMeses.map((k) => { if (!meses[k]) return `<a title="${nomeMes(k)}: sem venda"><b>0</b><i style="height:2%;opacity:.3"></i><em>${MES[+k.slice(5, 7) - 1].slice(0, 3)}/${k.slice(2, 4)}</em></a>`; const t = tot(meses[k]); return `<a href="#vm-${k}" title="${nomeMes(k)}: ${brl(t.valor)} · ${t.q} venda(s) · ${n(t.kwp, 1)} kWp"><b>${t.q}</b><i style="height:${Math.max(t.valor / maxV * 100, 3)}%"></i><em>${MES[+k.slice(5, 7) - 1].slice(0, 3)}/${k.slice(2, 4)}</em></a>`; }).join('')}</div></div>` : ''}
      ${chaves.map((k) => { const t = tot(meses[k]); return `<div class="painel entra" id="vm-${k}" style="margin-top:12px"><div class="entre"><h2 style="margin:0">${nomeMes(k)}</h2><span><b>${brl(t.valor)}</b> <span class="mini">· ${t.q} venda(s) · ${n(t.kwp, 1)} kWp</span></span></div>
          <div style="overflow-x:auto"><table class="vd-tab" style="margin-top:8px"><tr><th>Fechou em</th><th>Cliente</th><th class="v">Sistema</th><th>Inversor</th><th>Pagamento</th><th class="v">Valor</th></tr>${meses[k].map(linhaV).join('')}</table></div></div>`; }).join('') || '<div class="painel" style="margin-top:12px"><p class="sutil">Nenhuma venda nesse período.</p></div>'}
      <p class="mini" style="margin:10px 2px">≈ = venda sem data de fechamento registrada (usei a data do aceite, da compra ou da última alteração). Abra o cliente e acerte em "fechado em".</p>`;
    const per = (de, ate) => { vF.de = de; vF.ate = ate; vendasPag(); };
    $('#vDe').onchange = (e) => per(e.target.value || vF.de, vF.ate); $('#vAte').onchange = (e) => per(vF.de, e.target.value || vF.ate);
    const bx = $('#vBusca'); bx.oninput = () => { vF.busca = bx.value; clearTimeout(avDeb); avDeb = setTimeout(() => { vendasPag(); const c = $('#vBusca'); c.focus(); c.setSelectionRange(c.value.length, c.value.length); }, 300); };
    app.querySelectorAll('[data-vper]').forEach((b) => b.onclick = () => { const [a, z] = b.dataset.vper.split('|'), ym = (k) => { const d = new Date(+hoje.slice(0, 4), +hoje.slice(5, 7) - 1 - k, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }; if (a === 'ano') per(hoje.slice(0, 4) + '-01', hoje.slice(0, 7)); else per(ym(+a), ym(+z)); });
    $('#vCsv').onclick = () => {
      const q = (x) => '"' + String(x ?? '').replace(/"/g, '""') + '"', num = (v, c = 2) => (Number(v) || 0).toFixed(c).replace('.', ',');
      const csv = ['Mês;Fechou em;Cliente;Cidade;Origem;kWp;Placas;Placa (W);Inversor;Pagamento;Valor (R$)', ...vendas.map((v) => [v.data.slice(0, 7), v.data.split('-').reverse().join('/'), q(v.o.nome), q(v.o.cidade), q(v.o.origem), num(v.kwp), v.placas || '', v.placaW || '', q(v.inversor), q(PAG[v.pagamento] || v.pagamento), num(v.valor)].join(';'))].join('\r\n');
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })); a.download = `vendas_${vF.de}_a_${vF.ate}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    };
    $('#vImp').onclick = () => {
      const corpo = `<h1>Relatório de vendas</h1><p class="mini">De ${nomeMes(vF.de)} a ${nomeMes(vF.ate)}${vF.busca ? ` · filtro “${esc(vF.busca)}”` : ''}</p>
        <table><tr><td>Vendido no período</td><td class="v"><b>${brl(T.valor)}</b></td></tr><tr><td>Contratos</td><td class="v">${T.q}</td></tr><tr><td>kWp vendidos</td><td class="v">${n(T.kwp, 1)} kWp</td></tr><tr><td>Ticket médio</td><td class="v">${T.q ? brl(T.valor / T.q) : '–'}</td></tr></table>
        ${chaves.map((k) => { const t = tot(meses[k]); return `<h2>${nomeMes(k)} · ${brl(t.valor)} · ${t.q} venda(s) · ${n(t.kwp, 1)} kWp</h2><table><tr><th>Data</th><th>Cliente</th><th>Cidade</th><th class="v">kWp</th><th>Pagamento</th><th class="v">Valor</th></tr>${meses[k].map((v) => `<tr><td>${v.data.split('-').reverse().join('/')}</td><td>${esc(v.o.nome)}</td><td>${esc(v.o.cidade || '')}</td><td class="v">${n(v.kwp, 2)}</td><td>${esc(PAG[v.pagamento] || v.pagamento || '')}</td><td class="v">${brl(v.valor)}</td></tr>`).join('')}</table>`; }).join('')}`;
      Documentos.abrir(Documentos.pagina('Relatório de vendas', corpo));
    };
    $('#vRetro').onclick = () => {
      const cand = todos.filter((o) => o.status !== 'ganho');
      const ov = modal(`<div class="entre"><span class="rotulo">Dar ganho com data antiga</span><button class="link" data-fechar>fechar</button></div>
        <p class="mini" style="margin:6px 0">Procure o cliente que você fechou e não marcou (inclui o Arquivo). Depois escolha a opção, o valor e a data real do fechamento.</p>
        <input type="search" id="rtB" placeholder="nome, cidade ou telefone" style="width:100%"><div id="rtL" style="margin-top:8px;max-height:52vh;overflow:auto"></div>`);
      const lista = () => { const q = ov.querySelector('#rtB').value.toLowerCase().replace(/\s+/g, ' ').trim(), qd = q.replace(/\D/g, '');
        const l = cand.filter((o) => !q || String(o.nome || '').toLowerCase().includes(q) || String(o.cidade || '').toLowerCase().includes(q) || (qd.length >= 4 && String(o.whatsapp || '').replace(/\D/g, '').includes(qd))).slice(0, 40);
        ov.querySelector('#rtL').innerHTML = l.map((o) => `<button class="entre" data-rt="${esc(o.id)}" style="width:100%;text-align:left;background:none;border:0;border-top:1px dashed var(--linha);padding:9px 2px;color:inherit;font:inherit;cursor:pointer"><span><b>${esc(o.nome)}</b> <span class="mini">${esc(o.cidade || '')} · ${esc(o.id)}</span></span><span class="mini">${o.arquivado ? 'arquivo · ' : ''}${esc((STATUS.find((x) => x[0] === o.status) || [, o.status])[1])}</span></button>`).join('') || '<p class="sutil">Ninguém encontrado.</p>';
        ov.querySelectorAll('[data-rt]').forEach((b) => b.onclick = () => { const o = cand.find((x) => x.id === b.dataset.rt); ov.remove(); if (o) { o.arquivado = false; fecharGanho(o, () => vendasPag()); } }); };
      ov.querySelector('#rtB').oninput = lista; lista(); ov.querySelector('#rtB').focus();
    };
  }
  const AVULSO_V = (o) => !!o && (o.tipo === 'servico' || o.tipo === 'manutencao' || o.tipo === 'ampliacao');

  /* ======================= ORDEM DE SERVIÇO para o instalador (sem nenhum preço) ======================= */
  async function ordemServico(o, p) {
    const c = (o.compras || [])[0] || compraDe(o) || {};
    const p3 = o.projeto3d || {}, r = p3.resultado || {}, M = (p3.layout && p3.layout.modulo) || {};
    const k = o.contrato || {}, e = Documentos.empresaDe(p);
    let op = null; try { const ops = C.opcoes(o, P()); op = ops[o.opcaoEscolhida ?? 1] || ops[0]; } catch { /* sem consumo */ }
    const end = [k.rua, k.numero ? 'nº ' + k.numero : '', k.bairro].filter(Boolean).join(', ');
    const cidade = k.cidade || o.cidade || '', cep = k.cep || o.cep || '';
    const enderecoTxt = [end, cidade, cep ? 'CEP ' + cep : ''].filter(Boolean).join(' · ') || p3.endereco || '';
    const temGeo = Number.isFinite(+p3.lat) && Number.isFinite(+p3.lng) && Math.abs(+p3.lat) > 0.01;
    const mapa = temGeo ? `https://www.google.com/maps/search/?api=1&query=${(+p3.lat).toFixed(6)},${(+p3.lng).toFixed(6)}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([end, cidade, cep].filter(Boolean).join(', '))}`;
    const fone = String(o.whatsapp || '').replace(/\D/g, '');
    const ar = arranjoDoOrc(o), num = 'OS-' + String(o.id || '').replace(/^ORC-?/i, '');
    const placaNome = c.placa || (op && op.modulo && op.modulo.nome) || M.nome || '', placas = c.placas || r.placas || (op && op.dim.placas) || '', placaW = c.placaW || (op && op.modulo.potenciaW) || '';
    const kwp = c.kwp || r.kwp || (op && op.dim.kwpReal) || 0, inv = c.inversor || (op && op.inversor && op.inversor.nome) || '';
    const fm = window.Fichas ? Fichas.buscar('modulos', placaNome) : null, fi = window.Fichas ? Fichas.buscar('inversores', inv) : null;
    // arquivos do cliente (projeto, visita técnica) com link válido por 7 dias
    let anexos = []; try { const l = (await B.arquivosCliente(o.id)) || []; for (const a of l.filter((x) => /Projeto|Visita/i.test(x.pasta))) { try { anexos.push({ nome: a.nome, pasta: a.pasta, url: await B.linkArquivo(a.caminho, 7 * 86400) }); } catch { /* sem link */ } } } catch { /* sem nuvem */ }
    const linhaF = (rot, v, un = '') => (v != null && v !== '' ? `<tr><td>${rot}</td><td class="v">${typeof v === 'number' ? n(v, v % 1 ? 2 : 0) : esc(v)}${un}</td></tr>` : '');
    const fichaMod = fm ? `<table>${linhaF('Potência', fm.potW || placaW, ' W')}${linhaF('Voc (circuito aberto)', fm.voc, ' V')}${linhaF('Vmp (máxima potência)', fm.vmp, ' V')}${linhaF('Isc (curto-circuito)', fm.isc, ' A')}${linhaF('Imp', fm.imp, ' A')}${linhaF('Coef. temperatura Voc', fm.coefVoc, ' %/°C')}${linhaF('Dimensões', fm.c && fm.l ? `${n(fm.c * (fm.c < 10 ? 1000 : 1))} × ${n(fm.l * (fm.l < 10 ? 1000 : 1))} mm` : null)}${linhaF('Peso', fm.peso, ' kg')}</table>` : M.c ? `<p class="mini">Dimensões usadas no projeto: ${n(M.c * 1000)} × ${n(M.l * 1000)} mm. Confira a ficha do fabricante.</p>` : '<p class="mini">Ficha da placa não cadastrada: confira o datasheet do fabricante.</p>';
    const fichaInv = fi ? `<table>${linhaF('Tipo', fi.tipo === 'micro' ? 'Microinversor' : 'Inversor string')}${linhaF('Entradas MPPT', fi.mppts)}${linhaF('Strings por MPPT', fi.strPorMppt)}${linhaF('Entradas (micro)', fi.entradas)}${linhaF('Tensão máxima CC', fi.vMax, ' V')}${linhaF('Faixa MPPT', fi.vMinMppt && fi.vMaxMppt ? `${n(fi.vMinMppt)} a ${n(fi.vMaxMppt)} V` : null)}${linhaF('Corrente máx. por MPPT', fi.iMax, ' A')}${linhaF('Isc máx. por MPPT', fi.iscMax, ' A')}</table>` : '<p class="mini">Ficha do inversor não cadastrada: confira o datasheet do fabricante.</p>';
    const mp = r.mppt, cab = Array.isArray(r.cabos) ? r.cabos : [];
    const ponto = (az) => { const d = ((+az % 360) + 360) % 360; return ['Norte', 'Nordeste', 'Leste', 'Sudeste', 'Sul', 'Sudoeste', 'Oeste', 'Noroeste'][Math.round(d / 45) % 8]; };
    const blocos = (r.porBloco || []).map((b) => `<tr><td>${esc(b.nome || 'Telhado')}</td><td>${ponto(b.az)} · ${n(Math.tan((b.incl || 0) * Math.PI / 180) * 100)}%</td><td class="v">${b.placas}</td></tr>`).join('');
    const TEL = { ceramico: 'Telha cerâmica / colonial', fibrocimento: 'Fibrocimento', metalico: 'Telha metálica', laje: 'Laje', solo: 'Solo' };
    const itens = (c.itens || []).filter((i) => i.nome);
    const corpo = `<div class="entre" style="display:flex;justify-content:space-between;align-items:baseline;gap:10px"><h1 style="margin:0">Ordem de serviço · instalação</h1><b style="font:800 16pt Exo,sans-serif;color:#ff6700">${esc(num)}</b></div>
      <p class="mini">Emitida em ${new Date().toLocaleDateString('pt-BR')}${o.ganhoEm ? ' · contrato de ' + new Date(o.ganhoEm).toLocaleDateString('pt-BR') : ''} · responsável: ${esc(D.empresa.vendedor || e.nome || 'Chama Solar')} (${esc(D.empresa.telefone || '')})</p>
      <h2>Cliente e local da obra</h2>
      <div style="display:grid;grid-template-columns:1fr auto;gap:14px;align-items:start"><table>
        <tr><td>Cliente</td><td><b>${esc(o.nome || '')}</b></td></tr>
        ${fone ? `<tr><td>Telefone / WhatsApp</td><td>${esc(o.whatsapp)}</td></tr>` : ''}
        <tr><td>Endereço</td><td>${enderecoTxt ? esc(enderecoTxt) : '<span class="lac">preencher em "Dados do cliente para contrato"</span>'}</td></tr>
        ${k.instalacao ? `<tr><td>Nº da instalação (CPFL)</td><td>${esc(k.instalacao)}</td></tr>` : ''}
        ${temGeo ? `<tr><td>Coordenadas</td><td>${(+p3.lat).toFixed(6)}, ${(+p3.lng).toFixed(6)}</td></tr>` : ''}
        <tr><td>Mapa</td><td><a href="${mapa}">Abrir no Google Maps</a></td></tr>
        <tr><td>Ligação</td><td>${esc({ mono: 'Monofásica', bi: 'Bifásica', tri: 'Trifásica' }[o.ligacao] || o.ligacao || '')}${o.trocaPadrao ? ' · <b>com troca do padrão de entrada</b>' : ''}</td></tr>
        <tr><td>Telhado / estrutura</td><td>${esc(TEL[o.telhado] || o.telhado || '')}${o.fixacao ? ' · fixação ' + esc(o.fixacao) : ''}</td></tr></table>
        <div class="qr" style="margin:0;flex-direction:column;text-align:center"><div id="qr"></div><span class="mini">Aponte a câmera<br>para abrir o mapa</span></div></div>
      <h2>Sistema a instalar</h2>
      <table><tr><td>Potência</td><td class="v"><b>${n(kwp, 2)} kWp</b></td></tr>
        <tr><td>Placas</td><td class="v"><b>${placas}×</b> ${esc(placaNome)}${placaW ? ` (${placaW} W)` : ''}</td></tr>
        <tr><td>Inversor</td><td class="v"><b>${esc(inv)}</b></td></tr>
        ${c.numeroBelenergy ? `<tr><td>Pedido do kit (Belenergy)</td><td class="v">${esc(c.numeroBelenergy)}</td></tr>` : ''}</table>
      ${itens.length ? `<h2>Lista de material do kit</h2><table><tr><th>Item</th><th class="v">Qtd</th></tr>${itens.map((i) => `<tr><td>${esc(i.nome)}${i.grupo ? ` <span class="mini">· ${esc(i.grupo)}</span>` : ''}</td><td class="v">${esc(String(i.qtd || ''))}</td></tr>`).join('')}</table><p class="mini">Confira o material na entrega e avise na hora se faltar algo.</p>` : ''}
      <h2>Ficha técnica</h2><div style="display:grid;grid-template-columns:1fr 1fr;gap:14px"><div><b class="mini">PLACA</b>${fichaMod}</div><div><b class="mini">INVERSOR</b>${fichaInv}</div></div>
      <h2>Layout das placas</h2>
      ${p3.fotos && (p3.fotos.topo || p3.fotos.d3) ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:8px 0">${p3.fotos.topo ? `<figure style="margin:0"><img src="${p3.fotos.topo}" alt="Vista de cima" style="width:100%;border-radius:6px"><figcaption class="mini">Vista de cima</figcaption></figure>` : ''}${p3.fotos.d3 ? `<figure style="margin:0"><img src="${p3.fotos.d3}" alt="Vista 3D" style="width:100%;border-radius:6px"><figcaption class="mini">Vista 3D</figcaption></figure>` : ''}</div>` : '<p class="mini">Sem projeto 3D salvo: combine a posição das placas com o responsável antes de começar.</p>'}
      ${blocos ? `<table><tr><th>Água / telhado</th><th>Direção · inclinação</th><th class="v">Placas</th></tr>${blocos}</table>` : ''}
      <p class="mini">Arranjo: ${ar.fileiras && ar.fileiras.length ? `${ar.fileiras.length} fileira(s) (${ar.fileiras.join(' + ')} placas)` : ar.linhas ? ar.linhas + ' linha(s)' : 'a definir no local'} · orientação ${esc(ar.orientacao || 'retrato')}${ar.aguas > 1 ? ' · ' + ar.aguas + ' águas' : ''}${M.c ? ` · placa ${n(M.c * 1000)} × ${n(M.l * 1000)} mm` : ''}</p>
      ${mp && mp.mppts && mp.mppts.length ? `<h2>Ligação elétrica (MPPT e strings)</h2><table><tr><th>MPPT</th><th>Água</th><th class="v">Placas</th><th class="v">Strings</th><th class="v">Placas por string</th><th class="v">Tensão no frio</th></tr>${mp.mppts.map((m) => `<tr><td>${m.n}</td><td>${esc(m.agua || '')}</td><td class="v">${m.placas}</td><td class="v">${m.strings}</td><td class="v">${esc(Array.isArray(m.porString) ? m.porString.join(' + ') : m.porString || '')}</td><td class="v">${m.vFrio ? n(m.vFrio) + ' V' : '—'}</td></tr>`).join('')}</table>${(mp.avisos || []).length ? `<p class="aviso">${mp.avisos.map(esc).join('; ')}</p>` : ''}` : ''}
      ${cab.length ? `<h2>Cabeamento estimado</h2><table><tr><th>Cabo</th><th class="v">Metros</th></tr>${(() => { const s = (cab.find((x) => x.nivel === (op && op.nivel)) || cab[0]); const z = s.seguro || s.frog || {}; return `${z.vermelho != null ? `<tr><td>CC vermelho</td><td class="v">${n(z.vermelho)} m</td></tr>` : ''}${z.preto != null ? `<tr><td>CC preto</td><td class="v">${n(z.preto)} m</td></tr>` : ''}${s.caM != null ? `<tr><td>CA</td><td class="v">${n(s.caM)} m</td></tr>` : ''}`; })()}</table><p class="mini">Estimativa do projeto: confira as distâncias no local.</p>` : ''}
      ${o.osObs || o.compraNota ? `<h2>Observações da obra</h2><p>${esc(o.osObs || o.compraNota).replace(/\n/g, '<br>')}</p>` : ''}
      ${anexos.length ? `<h2>Arquivos do projeto</h2><ul>${anexos.map((a) => `<li><a href="${a.url}">${esc(a.nome)}</a> <span class="mini">· ${esc(a.pasta)}</span></li>`).join('')}</ul><p class="mini">Links válidos por 7 dias.</p>` : ''}
      <h2>Checklist da instalação</h2>
      <table>${['Fotos do telhado e do padrão ANTES de começar', 'Material conferido com a lista do kit', 'Estrutura fixada e vedada (sem risco de goteira)', 'Placas no layout do projeto, com espaço de grampo e corredor', 'Strings ligadas como na tabela de MPPT, polaridade conferida', 'Tensão de cada string medida e anotada (V)', 'Aterramento das placas, da estrutura e do inversor', 'String box / proteções CC e CA instaladas e identificadas', 'Inversor ligado no Wi-Fi do cliente e aparecendo no app do fabricante', 'Placas de advertência e etiquetas colocadas', 'Fotos DEPOIS: placas, inversor, string box, padrão e quadro', 'Local limpo e cliente orientado (como ver a geração no app)'].map((t) => `<tr><td style="width:26px">☐</td><td>${t}</td></tr>`).join('')}</table>
      <table style="margin-top:10px"><tr><td>Tensões das strings</td><td>MPPT 1: ______ V &nbsp; MPPT 2: ______ V &nbsp; MPPT 3: ______ V &nbsp; MPPT 4: ______ V</td></tr><tr><td>Nº de série do inversor</td><td>____________________________</td></tr><tr><td>Início / fim da obra</td><td>____/____/______ &nbsp;a&nbsp; ____/____/______</td></tr></table>
      <div style="margin-top:44px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:26px"><div style="border-top:1px solid #333;padding-top:6px" class="mini">${esc(e.razao || 'Chama Solar')}<br>Responsável</div><div style="border-top:1px solid #333;padding-top:6px" class="mini">Instalador<br>Nome e documento</div><div style="border-top:1px solid #333;padding-top:6px" class="mini">Cliente<br>Obra recebida em ___/___/____</div></div>`;
    Documentos.abrir(Documentos.pagina('Ordem de serviço ' + num + ' · ' + (o.nome || ''), corpo, { qr: mapa }));
    B.interacao && B.interacao(o.id, 'nota', 'Gerou a ordem de serviço ' + num + ' para o instalador');
    // resumo para mandar no WhatsApp do instalador (sem preço)
    const txt = `🛠️ *${num} · ${o.nome || ''}*\n📍 ${enderecoTxt}\n🗺️ ${mapa}${fone ? `\n📞 Cliente: ${o.whatsapp}` : ''}\n\n⚡ ${n(kwp, 2)} kWp · ${placas}× ${placaNome}${placaW ? ` ${placaW} W` : ''}\n🔌 ${inv}\n🏠 ${TEL[o.telhado] || o.telhado || ''}${ar.fileiras && ar.fileiras.length ? ` · ${ar.fileiras.length} fileira(s) (${ar.fileiras.join(' + ')})` : ''}${o.trocaPadrao ? '\n⚠️ Com troca do padrão de entrada' : ''}\n\nA OS completa (layout, ficha técnica e checklist) vai em PDF.`;
    const ov = modal(`<div class="entre"><span class="rotulo">🛠️ Ordem de serviço ${esc(num)}</span><button class="link" data-fechar>fechar</button></div>
      <p class="mini" style="margin:8px 0">A OS abriu em outra aba: toque em <b>Salvar em PDF</b> e mande o arquivo para o instalador. <b>Não tem nenhum preço</b>.</p>
      <label class="campo"><span>Observações da obra (saem na OS)</span><textarea id="osObs" rows="3" placeholder="ex.: chave com o vizinho, cachorro no quintal, acesso pela lateral, instalar inversor na garagem">${esc(o.osObs || '')}</textarea></label>
      <label class="campo" style="margin-top:6px"><span>Resumo para o WhatsApp do instalador</span><textarea id="osTxt" rows="8">${esc(txt)}</textarea></label>
      <div class="acoes-r" style="margin-top:8px"><button class="btn vidro pequeno" id="osRe">Salvar observações e gerar de novo</button><button class="btn vidro pequeno" id="osCp">Copiar resumo</button><a class="btn zap pequeno" id="osZap" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(txt)}">Mandar no WhatsApp</a></div>`);
    ov.querySelector('#osTxt').oninput = (ev) => { ov.querySelector('#osZap').href = 'https://wa.me/?text=' + encodeURIComponent(ev.target.value); };
    ov.querySelector('#osCp').onclick = () => { navigator.clipboard.writeText(ov.querySelector('#osTxt').value).then(() => toast('Resumo copiado')); };
    ov.querySelector('#osRe').onclick = () => { o.osObs = ov.querySelector('#osObs').value.trim(); B.salvar(o); ov.remove(); ordemServico(o, p); };
  }
  /* de qual aplicativo é a usina e por onde o sistema lê */
  const APPS = { Growatt: 'Growatt (ShinePhone / OSS)', Hoymiles: 'Hoymiles (S-Miles Cloud)', Huawei: 'Huawei (FusionSolar)', Deye: 'Deye (Solarman)', Sungrow: 'Sungrow (iSolarCloud)', Solis: 'Solis (SolisCloud)', Auxsol: 'Auxsol (Auxsol Cloud)', Chint: 'Chint (Chint Power)', Sunweg: 'Sunweg', Solplanet: 'Solplanet', GoodWe: 'GoodWe (SEMS)', TSuness: 'TSuness' };
  function appDe(u) {
    const pid = String(u.plataforma_id || ''), m = String(u.marca || '');
    const nome = APPS[m] || (m && m !== 'Outra' ? m : 'App não identificado');
    return { nome, via: pid.startsWith('sz:') ? 'lida pelo SolarZ' : pid ? 'lida direto do fabricante' : 'lançada à mão / planilha' };
  }
  /* gráficos da usina: dia a dia do mês, mês a mês do ano e ano a ano, com o esperado */
  const histUs = {}, graf = { modo: 'dia', ref: null };
  async function graficoUsina(el, u) {
    if (!el || !u) return;
    const U = window.Usinas;
    if (!histUs[u.id]) { try { histUs[u.id] = await B.geracaoTudo(u.id); } catch { histUs[u.id] = B.geracao(u.id); } }
    const g = histUs[u.id], soma = (pref) => g.filter((x) => x.dia.startsWith(pref)).reduce((t, x) => t + x.kwh, 0);
    const tot = $('[data-total="' + u.id + '"]'); if (tot && g.length) tot.textContent = n(g.reduce((t, x) => t + x.kwh, 0)) + ' kWh';
    const hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
    const espMes = U.esperadoDe(u), MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    const primeiro = g.length ? g[0].dia : hoje;
    let ref = graf.ref || hoje.slice(0, 7);
    if (graf.modo === 'dia' && ref.length !== 7) ref = hoje.slice(0, 7);
    if (graf.modo === 'mes') ref = ref.slice(0, 4);
    let barras = [], titulo = '', esp = 0, tarifa = Number(u.tarifa_kwh) || (D.parametros && D.parametros.tarifaKwh) || 1;
    if (graf.modo === 'dia') {
      const [a, m] = ref.split('-').map(Number), nd = new Date(a, m, 0).getDate();
      barras = Array.from({ length: nd }, (_, i) => { const d = `${ref}-${String(i + 1).padStart(2, '0')}`, x = g.find((y) => y.dia === d); return { rot: i === 0 || (i + 1) % 5 === 0 ? String(i + 1) : '', kwh: x ? x.kwh : 0, tem: !!x, dica: `${String(i + 1).padStart(2, '0')}/${String(m).padStart(2, '0')}: ${x ? n(x.kwh, 1) + ' kWh' : 'sem leitura'}` }; });
      titulo = `${MESES[m - 1]}/${a}`; esp = espMes / 30;
    } else if (graf.modo === 'mes') {
      barras = MESES.map((r, i) => { const k = `${ref}-${String(i + 1).padStart(2, '0')}`, v = soma(k); return { rot: r, kwh: v, tem: v > 0, dica: `${r}/${ref}: ${n(v)} kWh`, ir: k, parcial: k >= hoje.slice(0, 7) }; });
      titulo = ref; esp = espMes;
    } else {
      const a0 = +primeiro.slice(0, 4), a1 = +hoje.slice(0, 4);
      for (let a = a0; a <= a1; a++) { const v = soma(String(a)); barras.push({ rot: String(a), kwh: v, tem: v > 0, dica: `${a}: ${n(v)} kWh`, ir: String(a), parcial: a >= +hoje.slice(0, 4) || String(a) === primeiro.slice(0, 4) }); }
      titulo = 'desde ' + primeiro.split('-').reverse().join('/'); esp = espMes * 12;
    }
    const total = barras.reduce((t, x) => t + x.kwh, 0), max = Math.max(...barras.map((x) => x.kwh), esp, 1), comDado = barras.filter((x) => x.tem);
    const melhor = comDado.reduce((a, x) => (x.kwh > (a ? a.kwh : -1) ? x : a), null);
    const espPeriodo = graf.modo === 'dia' ? esp * comDado.length : graf.modo === 'mes' ? espMes * comDado.length : 0;
    el.innerHTML = `<div class="us-g-cab"><div class="us-g-tabs">${[['dia', 'Dia a dia'], ['mes', 'Mês a mês'], ['ano', 'Ano a ano']].map(([k, r]) => `<button type="button" data-gm="${k}" class="${graf.modo === k ? 'sel' : ''}">${r}</button>`).join('')}</div>
        ${graf.modo !== 'ano' ? `<div class="us-g-nav"><button type="button" data-gn="-1" aria-label="Anterior">‹</button><b>${titulo}</b><button type="button" data-gn="1" aria-label="Próximo">›</button></div>` : `<div class="us-g-nav"><b>${titulo}</b></div>`}</div>
      <div class="us-g-barras" style="--n:${barras.length}">${esp ? `<i class="us-g-esp" style="bottom:calc(18px + ${(esp / max).toFixed(3)} * (100% - 18px))" title="Esperado: ${n(esp, graf.modo === 'dia' ? 1 : 0)} kWh"></i>` : ''}
        ${barras.map((x) => `<button type="button" title="${x.dica}" ${x.ir ? `data-gi="${x.ir}"` : ''} class="${x.tem ? (esp && !x.parcial && x.kwh < esp * 0.6 ? 'baixo' : '') : 'vazio'}"><i style="height:${x.tem ? Math.max((x.kwh / max) * 100, 2) : 1}%"></i><em>${x.rot}</em></button>`).join('')}</div>
      ${graf.modo !== 'dia' ? '<p class="mini" style="margin:8px 0 0">Toque numa barra para abrir.</p>' : ''}`;
    const pctP = espPeriodo ? total / espPeriodo : null, rotP = graf.modo === 'dia' ? 'no mês' : graf.modo === 'mes' ? 'no ano' : 'desde a instalação';
    el.querySelector('.us-g-cab').insertAdjacentHTML('afterend', `<div class="us-g-res">
        <div><span>Gerou ${rotP}</span><b>${n(total)} kWh</b></div>
        <div><span>Economia ${rotP}</span><b>${brl(total * tarifa)}</b></div>
        <div class="${pctP === null ? '' : pctP >= 0.9 ? 'ok' : pctP >= 0.75 ? 'meio' : 'ruim'}"><span>Do esperado</span><b>${pctP === null ? '–' : n(pctP * 100) + '%'}</b></div>
        <div><span>${graf.modo === 'dia' ? 'Melhor dia' : graf.modo === 'mes' ? 'Melhor mês' : 'Melhor ano'}</span><b>${melhor ? n(melhor.kwh, graf.modo === 'dia' ? 1 : 0) + ' kWh' : '–'}</b><small>${melhor ? melhor.dica.split(':')[0] : ''}</small></div></div>`);
    const mudarRef = (passo) => {
      if (graf.modo === 'dia') { const [a, m] = ref.split('-').map(Number), d = new Date(a, m - 1 + passo, 1); graf.ref = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
      else graf.ref = String(+ref + passo);
      graficoUsina(el, u);
    };
    el.querySelectorAll('[data-gm]').forEach((b) => b.onclick = () => { graf.modo = b.dataset.gm; if (graf.modo === 'dia') graf.ref = (graf.ref || hoje).length === 4 ? graf.ref + '-' + (graf.ref === hoje.slice(0, 4) ? hoje.slice(5, 7) : '12') : graf.ref; graficoUsina(el, u); });
    el.querySelectorAll('[data-gn]').forEach((b) => b.onclick = () => mudarRef(+b.dataset.gn));
    el.querySelectorAll('[data-gi]').forEach((b) => b.onclick = () => { graf.ref = b.dataset.gi; graf.modo = b.dataset.gi.length === 4 ? 'mes' : 'dia'; graficoUsina(el, u); });
    const rel = el.parentElement && el.parentElement.querySelector('[data-us="rel"]'); if (rel) rel.textContent = graf.modo === 'dia' ? `Relatório de ${titulo}` : 'Relatório do mês';
  }
  function escolher(lista, fn) {
    const ov = document.createElement('div'); ov.style.cssText = 'position:fixed;inset:0;z-index:80;background:#0009;display:grid;place-items:center;padding:16px';
    ov.innerHTML = `<div class="painel" style="max-width:420px;width:100%"><span class="rotulo">De qual usina é a planilha?</span><div style="display:grid;gap:8px;margin-top:10px">${lista.map((u) => `<button class="btn vidro" data-u="${u.id}">${esc(u.cliente_nome)} · ${esc(u.marca)}</button>`).join('')}</div></div>`;
    ov.onclick = (e) => { const b = e.target.closest('[data-u]'); if (b) fn(lista.find((u) => String(u.id) === b.dataset.u)); ov.remove(); };
    document.body.appendChild(ov);
  }
  /* ======================= MEU DIA =======================
     O que fazer hoje, em 3 blocos curtos (para caber junto com a Chamae):
     manhã = responder novos e mensagens · almoço = usinas · fim da tarde = ligações.
     Cada item tem o botão de fazer (WhatsApp/ligar) e some quando feito. Vai também para o Google Agenda. */
  const gcal = (titulo, ini, fim, det) => 'https://calendar.google.com/calendar/render?action=TEMPLATE&ctz=America/Sao_Paulo&text=' + encodeURIComponent(titulo) + '&dates=' + ini + '/' + fim + '&details=' + encodeURIComponent(det || '');
  const hojeStr = (hh, mm) => { const d = new Date(); return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}T${String(hh).padStart(2, '0')}${String(mm).padStart(2, '0')}00`; };
  /* espaço no Supabase: arquivos (documentos e fotos) e banco de dados, contra o limite do plano */
  async function espaco() {
    let a = null; try { a = await B.armazenamento(); } catch { return null; } if (!a) return null;
    const p = P(), limA = (+p.limiteArquivosGB || 1) * 1e9, limB = (+p.limiteBancoGB || 0.5) * 1e9;
    return { arq: { usado: +a.arquivos, lim: limA, pct: +a.arquivos / limA, solar: +a.arquivosSolar }, banco: { usado: +a.banco, lim: limB, pct: +a.banco / limB } };
  }
  const barraEspaco = (rot, x, sub) => { const cor = x.pct >= 0.9 ? '#ff5c5c' : x.pct >= 0.75 ? 'var(--laranja)' : 'var(--verde-claro)';
    return `<div style="margin-top:10px"><div class="entre mini"><b>${rot}</b><span><b style="color:${cor}">${n(x.pct * 100)}%</b> · ${n(x.usado / 1e6)} MB de ${n(x.lim / 1e9, 1)} GB</span></div><div style="height:10px;border-radius:99px;background:var(--linha);overflow:hidden;margin-top:4px"><div style="height:100%;width:${Math.min(100, x.pct * 100)}%;background:${cor}"></div></div>${sub ? `<p class="mini" style="margin:4px 0 0">${sub}</p>` : ''}</div>`; };
  async function avisoEspaco() {
    const e = await espaco(); if (!e || location.hash.replace('#', '') !== 'dia' || $('#avEsp')) return;
    const pior = e.arq.pct >= e.banco.pct ? ['arquivos', e.arq] : ['banco de dados', e.banco]; if (pior[1].pct < 0.8) return;
    const d = document.createElement('div'); d.id = 'avEsp'; d.className = 'aviso entra'; d.style.margin = '0 0 12px';
    d.innerHTML = `💾 <b>O espaço de ${pior[0]} está em ${n(pior[1].pct * 100)}%</b> (${n(pior[1].usado / 1e6)} MB de ${n(pior[1].lim / 1e9, 1)} GB). Hora de apagar fotos repetidas ou subir o plano do Supabase. <a class="link" href="#parametros">ver detalhes</a>`;
    const cab = app.querySelector('.cab'); if (cab) cab.after(d);
  }
  async function diaPag() {
    const lista = B.orcamentos(), p = P(), evDe = (t) => B.eventos(t);
    const ag = Cadencia.agenda(lista, evDe, (id) => B.interacoes(id));
    const hoje = new Date().toISOString().slice(0, 10);
    const feitosHoje = lista.flatMap((o) => B.interacoes(o.id).filter((i) => String(i.em).slice(0, 10) === hoje && /^Cadência/.test(i.texto || '')).map((i) => ({ o, i })));
    const usAlerta = (B.usinas() || []).filter((u) => u.ativo !== false).map((u) => ({ u, s: window.Usinas.situacao(u, B.geracao(u.id)) })).filter((x) => x.s.alerta && x.s.alerta !== 'Sem leitura ainda');
    const amanha = lista.map((o) => Cadencia.proximo(o, evDe(o.token), B.interacoes(o.id), Date.now() + 864e5)).filter((x) => x && x.hoje).length - ag.length;
    const manha = ag.filter((x) => x.passo.quente || x.passo.canal !== 'ligacao'), tarde = ag.filter((x) => !x.passo.quente && x.passo.canal === 'ligacao');
    const total = ag.length + usAlerta.length + feitosHoje.length, feitos = feitosHoje.length;
    const min = manha.length * 3 + tarde.length * 7 + usAlerta.length * 5;
    const semana = lista.flatMap((o) => B.interacoes(o.id)).filter((i) => Date.now() - new Date(i.em) < 7 * 864e5);
    const enviadasSem = lista.filter((o) => o.enviadoEm && Date.now() - new Date(o.enviadoEm) < 7 * 864e5).length;
    const metaSem = Number(p.metaPropostasSemana) || 3;
    const item = ({ o, passo }) => `<div class="dia-item"><div class="ic">${passo.quente ? '🔥' : passo.canal === 'ligacao' ? '📞' : passo.grupo === 'novo' ? '⚡' : '💬'}</div><div>
        <b><a href="#lead-${o.id}" style="color:inherit">${esc(o.nome)}</a></b> <span class="mini">${esc(passo.titulo)}${passo.atrasoDias > 0 ? ` · <span style="color:var(--laranja)">${passo.atrasoDias} dia(s) atrasado</span>` : ''}</span>
        <p class="mini" style="margin:2px 0 6px">${passo.quente ? '<b>Está com a proposta aberta agora: ligue já.</b> ' : ''}${esc(passo.porque)}</p>
        <div class="acoes-r">${passo.canal === 'ligacao' && !passo.quente ? `<a class="btn sol pequeno" href="tel:${esc(String(o.whatsapp || '').replace(/\D/g, ''))}">Ligar</a><button class="btn vidro pequeno" data-cad="lig" data-id="${o.id}" data-passo="${passo.id}">Liguei ✓</button>` : `<button class="btn zap pequeno" data-cad="zap" data-id="${o.id}" data-passo="${passo.id}">Mandar WhatsApp</button>`}
          <a class="link" href="#lead-${o.id}">outras abordagens</a><button class="link" data-cad="ok" data-id="${o.id}" data-passo="${passo.id}">pular</button></div></div></div>`;
    const bloco = (ic, titulo, hora, dur, desc, itens, chave) => `<div class="dia-bloco"><div class="entre"><h3>${ic} ${titulo}</h3><span class="mini">${hora} · ~${dur} min</span></div><p class="mini" style="margin:4px 0 6px">${desc}</p>
        ${itens || '<p class="sutil" style="margin:6px 0">Nada para este bloco hoje 🎉</p>'}
        ${itens ? `<a class="link mini" target="_blank" rel="noopener" href="${gcal('☀️ Chama Solar · ' + titulo, hojeStr(...chave[0]), hojeStr(...chave[1]), 'Abrir: ' + location.href.split('#')[0] + '#dia')}">📅 pôr este bloco no Google Agenda</a>` : ''}</div>`;
    app.innerHTML = `${cabCelular()}<div class="cab entra"><div><h1>Seu dia na Chama Solar</h1><p class="sutil">${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })} · ${ag.length + usAlerta.length ? `${ag.length + usAlerta.length} tarefa(s), cerca de ${Math.max(min, 5)} min no total` : 'tudo em dia'}</p></div>
        <div class="linha-h"><button class="btn vidro" id="rapida">⚡ Resposta rápida</button><a class="btn sol" href="#novo">＋ Novo orçamento</a></div></div>
      <div class="painel"><div class="entre"><span class="rotulo">Progresso de hoje</span><b>${feitos} de ${total || 0}</b></div><div class="progresso"><i style="width:${total ? Math.round(feitos / total * 100) : 100}%"></i></div>
        <p class="mini" style="margin:8px 0 0">${!total ? 'Sem contatos vencidos. Bom dia para pedir indicação a um cliente feliz ou postar um depoimento.' : feitos >= total ? 'Dia concluído. 👏' : 'Faça na ordem: os de cima são os que mais dão resultado.'}</p></div>
      ${(() => { const ls = lembretes().filter((l) => !l.quando || new Date(l.quando) <= new Date(new Date().setHours(23, 59, 59))).sort((x, y) => String(x.quando || '').localeCompare(String(y.quando || ''))); const fut = lembretes().length - ls.length;
        return ls.length || fut ? `<div class="dia-bloco lembretes"><div class="entre"><h3>📌 Lembretes</h3><span class="mini">${ls.length} para hoje${fut ? ` · ${fut} para depois` : ''}</span></div>
          ${ls.map((l) => `<div class="dia-item"><div class="ic">📌</div><div><b>${esc(l.texto)}</b> <span class="mini">${l.quando ? new Date(l.quando).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}</span>
            <div class="acoes-r" style="margin-top:6px">${l.ref ? `<button class="btn sol pequeno" data-labrir="${esc(l.ref)}">Completar agora</button>` : ''}<button class="btn vidro pequeno" data-lfeito="${esc(l.id)}">✓ Feito</button></div></div></div>`).join('') || '<p class="sutil" style="margin:6px 0">Nada para hoje.</p>'}</div>` : ''; })()}
      ${bloco('🌅', 'Bloco da manhã', '8h00', Math.max(manha.length * 3, 5), 'Leads novos e mensagens: responder rápido é o que mais fecha venda.', manha.map(item).join(''), [[8, 0], [8, 15]])}
      ${bloco('☀️', 'Bloco do almoço', '12h30', Math.max(usAlerta.length * 5, 5), 'Usinas com alerta: ligue antes do cliente perceber.', usAlerta.map(({ u, s }) => `<div class="dia-item"><div class="ic">⚠️</div><div><b>${esc(u.cliente_nome)}</b> <span class="mini">${esc(u.marca)} · ${n(u.kwp, 2)} kWp</span><p class="mini" style="margin:2px 0 6px">${esc(s.alerta)}</p><div class="acoes-r"><a class="btn vidro pequeno" href="#usinas">Ver usina</a>${u.whatsapp ? `<a class="btn zap pequeno" target="_blank" rel="noopener" href="https://wa.me/55${String(u.whatsapp).replace(/\D/g, '').replace(/^55/, '')}">WhatsApp</a>` : ''}</div></div></div>`).join(''), [[12, 30], [12, 40]])}
      ${bloco('🌇', 'Bloco do fim do dia', '17h30', Math.max(tarde.length * 7, 5), 'Ligações: no fim da tarde o cliente atende mais.', tarde.map(item).join(''), [[17, 30], [17, 50]])}
      ${feitosHoje.length ? `<div class="dia-bloco"><div class="entre"><h3>✅ Feito hoje</h3><span class="mini">${feitosHoje.length}</span></div>${feitosHoje.map(({ o, i }) => `<div class="dia-item feito"><div class="ic">✓</div><div><b>${esc(o.nome)}</b> <span class="mini">${esc(String(i.texto).replace(/^Cadência \w\d · /, ''))} · ${new Date(i.em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span></div></div>`).join('')}</div>` : ''}
      <div class="kpis" style="margin-top:14px"><div class="kpi"><span class="rotulo">Amanhã</span><b>${Math.max(amanha, 0)}</b><span class="sutil">contato(s) novos na fila</span></div>
        <div class="kpi"><span class="rotulo">Contatos na semana</span><b>${semana.length}</b><span class="sutil">mensagens e ligações</span></div>
        <div class="kpi ${enviadasSem >= metaSem ? 'destaque' : ''}"><span class="rotulo">Propostas na semana</span><b>${enviadasSem} / ${metaSem}</b><span class="sutil">meta da semana</span></div></div>
      <div class="painel" id="gAgenda"><span class="rotulo">Google Agenda</span><p class="sutil" style="margin:6px 0 0">carregando…</p></div>`;
    const el = $('#gAgenda');
    const link = await B.agendaLink().catch(() => null);
    if (!el) return;
    el.innerHTML = link ? `<span class="rotulo">Google Agenda</span>
        <p class="sutil" style="margin:6px 0">Assine a agenda da Chama Solar uma vez: os contatos de cada dia aparecem sozinhos no seu Google Agenda (mensagens às 8h, ligações às 17h30, com aviso 5 min antes). O Google atualiza algumas vezes por dia; para o que é urgente, use os botões acima.</p>
        <div class="entrada-ag"><input type="text" readonly value="${esc(link)}" id="gLink"></div>
        <div class="acoes-r" style="margin-top:8px"><button class="btn sol pequeno" id="gCopiar">Copiar o link</button><a class="btn vidro pequeno" target="_blank" rel="noopener" href="https://calendar.google.com/calendar/u/0/r/settings/addbyurl">Abrir o Google Agenda › Adicionar por URL</a></div>
        <p class="mini" style="margin-top:8px">No computador: copie o link, abra "Adicionar por URL", cole e toque em "Adicionar agenda". Depois ela aparece também no celular. Não compartilhe este link: ele mostra os nomes dos clientes.</p>`
      : '<span class="rotulo">Google Agenda</span><p class="sutil" style="margin:6px 0 0">Disponível na versão dentro do Chamae (precisa do login). Use os botões "pôr no Google Agenda" de cada bloco.</p>';
    const gc = $('#gCopiar'); if (gc) gc.onclick = () => copiar(link);
  }

  /* ======================= TREINO DO ROBÔ =======================
     Roda cotações de teste em todas as combinações (potência × ligação × telhado × inversor/micro),
     sem salvar na Belenergy. Cada resultado fica gravado: o que falhou chega para correção com
     print e tela; o que deu certo vira tabela de R$/Wp para resposta rápida. */
  const TREINO = { rodando: false, parar: false };
  async function treinoPag() {
    const hist = await B.treino(400).catch(() => []);
    const ok = hist.filter((h) => h.ok), falhas = hist.filter((h) => !h.ok);
    const porEtapa = {}; falhas.forEach((f) => { const k = f.etapa || 'outro'; porEtapa[k] = (porEtapa[k] || 0) + 1; });
    const tab = {}; ok.forEach((h) => { const c = h.cenario || {}; const k = (c.tipo || '') + '|' + c.kwp; (tab[k] = tab[k] || []).push(+h.rs_wp); });
    const linhasTab = Object.entries(tab).sort((a, b) => a[0].localeCompare(b[0], 'pt', { numeric: true })).map(([k, v]) => { const [t, kwp] = k.split('|'); const m = v.reduce((s, x) => s + x, 0) / v.length; return `<tr><td>${esc(t)}</td><td class="v">${n(+kwp, 1)} kWp</td><td class="v">R$ ${n(m, 2)}/Wp</td><td class="v">${v.length}</td></tr>`; }).join('');
    const tempo = ok.length ? ok.reduce((s, h) => s + (+h.segundos || 0), 0) / ok.length : 0;
    // onde o tempo vai: média de cada etapa do portal (só nos treinos com o robô novo, que mede)
    const porEt = {}; ok.forEach((h) => ((h.kit && h.kit.tempos) || []).forEach((t) => { (porEt[t.etapa] = porEt[t.etapa] || []).push(t.ms / 1000); }));
    const tempoEtapas = Object.entries(porEt).map(([e, v]) => [((Cotador.ETAPAS || [])[+e] || 'etapa ' + e), v.reduce((a, b) => a + b, 0) / v.length]).filter((x) => x[1] > 0);
    app.innerHTML = `${cabCelular()}<div class="cab entra"><div><h1>Treino do robô</h1><p class="sutil">O robô cota sozinho todas as combinações, sem salvar na Belenergy. Cada erro vem com print para correção; cada acerto vira preço de referência.</p></div></div>
      <div class="kpis"><div class="kpi destaque"><span class="rotulo">Acertos</span><b>${hist.length ? n(ok.length / hist.length * 100) + '%' : '—'}</b><span class="sutil">${ok.length} de ${hist.length} cotações</span></div>
        <div class="kpi"><span class="rotulo">Tempo médio</span><b>${tempo ? n(tempo) + ' s' : '—'}</b><span class="sutil">por kit</span></div>
        <div class="kpi"><span class="rotulo">Falhas</span><b>${falhas.length}</b><span class="sutil">${Object.entries(porEtapa).map(([k, v]) => esc(k) + ': ' + v).join(' · ') || 'nenhuma'}</span></div></div>
      ${tempoEtapas.length ? `<div class="painel"><span class="rotulo">Onde o tempo vai (média por etapa do portal)</span><div class="progresso-lista" style="margin-top:8px">${tempoEtapas.map(([t, sg]) => `<div class="entre" style="padding:4px 0"><span>${esc(t)}</span><b>${n(sg, 1)} s</b></div>`).join('')}</div><p class="mini">A maior parte é o portal carregando. Etapa com tempo alto e sem erro: dá para o robô esperar menos nela.</p></div>` : ''}
      <div class="painel"><span class="rotulo">Rodar treino</span>
        <div class="grade g2" style="margin-top:10px">
          <label class="campo"><span>Potências (kWp)</span><input id="trKwp" value="3, 5, 8, 12, 18, 25"></label>
          <label class="campo"><span>Ligações</span><input id="trLig" value="mono, bi, tri"></label>
          <label class="campo"><span>Telhados</span><input id="trTel" value="ceramico, metalico, fibrocimento, laje"></label>
          <label class="campo"><span>Tipos</span><input id="trTipo" value="Inversor, Microinversor"></label>
          <label class="campo"><span>Pausa entre cotações (s)</span><input id="trPausa" type="number" value="20"></label></div>
        <p class="mini" id="trConta"></p>
        <div class="acoes-r"><button class="btn sol" id="trIr" ${TREINO.rodando ? 'hidden' : ''}>▶ Começar treino</button><button class="btn vidro" id="trFalhas" ${TREINO.rodando || !falhas.length ? 'hidden' : ''}>↻ Repetir só o que falhou</button><button class="btn vidro" id="trParar" ${TREINO.rodando ? '' : 'hidden'}>■ Parar</button><span class="mini" id="trProg">${TREINO.rodando ? 'rodando…' : ''}</span></div>
        <p class="mini" style="margin-top:8px">Deixe esta aba aberta e o robô ligado. Pode rodar à noite. Não salva nada na Belenergy e nunca compra.</p></div>
      ${linhasTab ? `<div class="painel"><span class="rotulo">Preço de referência aprendido (média dos acertos)</span><table style="margin-top:8px"><tr><th>Tipo</th><th class="v">Potência</th><th class="v">Kit</th><th class="v">Cotações</th></tr>${linhasTab}</table></div>` : ''}
      <div class="painel"><span class="rotulo">Últimas cotações de treino</span><table style="margin-top:8px">${hist.slice(0, 40).map((h) => { const c = h.cenario || {}; return `<tr><td>${h.ok ? '✅' : '❌'}</td><td>${esc(c.tipo)} · ${n(c.kwp, 1)} kWp · ${esc(c.ligacao)} · ${esc(c.telhado)}</td><td class="mini">${h.ok ? 'R$ ' + n(h.rs_wp, 2) + '/Wp · ' + n(h.segundos) + ' s' : esc(String(h.erro || '').slice(0, 140))}</td></tr>`; }).join('') || '<tr><td class="sutil">Nenhum treino ainda.</td></tr>'}</table></div>`;
    const lista = (id) => $(id).value.split(',').map((x) => x.trim()).filter(Boolean);
    const cenarios = () => { const out = []; lista('#trTipo').forEach((tipo) => lista('#trKwp').forEach((kwp) => lista('#trLig').forEach((lig) => lista('#trTel').forEach((tel) => out.push({ tipo, kwp: +kwp.replace(',', '.'), ligacao: lig, telhado: tel }))))); return out; };
    const contar = () => { const c = cenarios(); $('#trConta').textContent = `${c.length} combinações · cerca de ${n(c.length * (Number($('#trPausa').value) + 90) / 60)} min`; };
    app.querySelectorAll('#trKwp,#trLig,#trTel,#trTipo,#trPausa').forEach((i) => i.oninput = contar); contar();
    $('#trParar').onclick = () => { TREINO.parar = true; $('#trProg').textContent = 'parando depois desta cotação…'; };
    let soFalhas = null;
    $('#trFalhas').onclick = () => { const vistos = new Set(), okK = new Set(ok.map((h) => JSON.stringify(h.cenario))); soFalhas = falhas.map((f) => f.cenario).filter((c) => { const k = JSON.stringify(c); if (vistos.has(k) || okK.has(k)) return false; vistos.add(k); return true; }); if (!soFalhas.length) { soFalhas = falhas.map((f) => f.cenario).filter((c) => { const k = JSON.stringify(c); if (vistos.has(k)) return false; vistos.add(k); return true; }); } $('#trIr').click(); };
    $('#trIr').onclick = async () => {
      if (!(await Cotador.conectado())) return toast('Ligue o robô e faça login na Belenergy antes do treino');
      const lote = new Date().toISOString().slice(0, 16), lst = (soFalhas || cenarios()).sort(() => Math.random() - 0.5); soFalhas = null; const pausa = Math.max(Number($('#trPausa').value) || 0, 5) * 1000;
      TREINO.rodando = true; TREINO.parar = false; $('#trIr').hidden = true; $('#trFalhas').hidden = true; $('#trParar').hidden = false;
      const LIG = { mono: 'MONOFÁSICO', bi: 'BIFÁSICO', tri: 'TRIFÁSICO' }, TEL = TIPO_ESTR;
      let feitos = 0, acertos = 0;
      for (const c of lst) {
        if (TREINO.parar) break;
        const ini = Date.now(), prog = (t) => { const el = $('#trProg'); if (el) el.textContent = `${feitos + 1}/${lst.length} · ${c.tipo} ${c.kwp} kWp ${c.ligacao} ${c.telhado}: ${t}… ${acertos} acertos`; };
        try {
          const s = await Cotador.cotarAuto('conectado', { kwp: c.kwp, ligacao: LIG[c.ligacao] || c.ligacao, cidade: 'Ribeirão Preto', frete: 'Belenus Entrega no Cliente', estruturaTipo: TEL[c.telhado] || c.telhado, tipoInversor: c.tipo === 'Microinversor' ? 'MICROINVERSOR' : 'INVERSOR STRING ON-GRID', nome: 'TREINO ' + c.tipo + ' ' + c.kwp, salvar: false }, prog);
          const k = Cotador.paraKit(s, c.tipo), wp = k.modulo.qtd * k.modulo.potenciaW; registrarKit(k, { ligacao: c.ligacao }, 'treino');
          if (!(k.valorKit > 0)) throw new Error('valor R$ 0,00');
          await B.treinoGravar({ lote, cenario: c, ok: true, segundos: Math.round((Date.now() - ini) / 1000), valor_kit: k.valorKit, rs_wp: Math.round(k.valorKit / wp * 1000) / 1000, kit: { modulo: k.modulo, inversor: k.inversor, estrutura: k.estrutura, tempos: s.tempos || [] } }).catch(() => {});
          acertos++;
        } catch (e) {
          const etapa = (String(e.message).match(/etapa "([^"]+)"/) || [])[1] || 'regra do sistema';
          await B.treinoGravar({ lote, cenario: c, ok: false, segundos: Math.round((Date.now() - ini) / 1000), etapa, erro: String(e.message).slice(0, 500) }).catch(() => {});
          if (e.diag) await B.registrarErroRobo({ orcamento: 'TREINO', opcao: c.tipo, mensagem: e.message, diag: e.diag }).catch(() => {});
          if (/sessão/.test(e.message)) { toast('A sessão da Belenergy expirou: treino parado'); break; }
        }
        feitos++;
        await new Promise((r) => setTimeout(r, pausa));
      }
      TREINO.rodando = false; toast(`Treino: ${acertos} de ${feitos} deram certo`); if (location.hash === '#treino') treinoPag();
    };
  }

  /* Relatório da conta: dados da fatura (lidos do PDF ou digitados) × geração da plataforma no período de leitura */
  async function formFatura(u) {
    const U = window.Usinas, g = B.geracao(u.id);
    const hist = await B.faturas(u.id).catch(() => []);
    const unids = (await B.unidades(u.id).catch(() => [])).filter((x) => !x.geradora);
    const nomeUn = (id) => { const x = unids.find((y) => y.id === +id); return x ? (x.apelido || 'UC ' + x.uc) : 'Usina'; };
    const ov = document.createElement('div'); ov.style.cssText = 'position:fixed;inset:0;z-index:80;background:#0009;display:grid;place-items:center;padding:16px';
    let f = { usina_id: u.id, tarifa: u.tarifa_kwh || '', dados: {} };
    const campos = [['leitura_ini', 'Leitura anterior', 'date'], ['leitura_fim', 'Leitura atual', 'date'], ['consumo_rede', 'Consumo da rede (kWh)', 'number'], ['injetada', 'Energia injetada (kWh)', 'number'],
      ['saldo_creditos', 'Saldo de créditos (kWh)', 'number'], ['valor_pago', 'Valor da conta (R$)', 'number'], ['tarifa', 'Tarifa (R$/kWh)', 'number'], ['iluminacao', 'Iluminação pública (R$)', 'number'], ['geracao_manual', 'Geração no período (kWh) · só se a plataforma não tiver', 'number'], ['referencia', 'Mês da conta (ex.: OUT/2026)', 'text']];
    const desenhar = () => {
      ov.innerHTML = `<div class="painel" style="max-width:640px;width:100%;max-height:92vh;overflow:auto"><div class="entre"><span class="rotulo" style="color:var(--sol)">Relatório da conta · ${esc(u.cliente_nome)}</span><button class="link" data-x>fechar</button></div>
        <div class="linha-h" style="margin-top:10px"><button class="btn vidro" data-ler>📄 Ler a conta (PDF da CPFL)</button><span class="mini" id="ftAviso">ou digite os campos da conta</span></div>
        <input type="file" id="ftArq" accept="application/pdf" hidden>
        ${unids.length ? `<label class="campo" style="margin-top:10px"><span>Conta de qual unidade</span><select id="ftUn"><option value="0">Usina (unidade geradora)</option>${unids.map((x) => `<option value="${x.id}" ${+f.unidade_id === x.id ? 'selected' : ''}>${esc(x.apelido || 'UC ' + x.uc)}${x.percentual != null ? ' · ' + n(x.percentual) + '%' : ''}</option>`).join('')}</select></label>` : ''}
        <div class="grade g2" style="margin-top:10px">${campos.filter(([k]) => !(+f.unidade_id > 0 && k === 'geracao_manual')).map(([k, r, t]) => `<label class="campo"><span>${+f.unidade_id > 0 && k === 'injetada' ? 'Créditos recebidos da usina (kWh)' : r}</span><input data-ft="${k}" type="${t}" step="any" value="${esc(k === 'iluminacao' ? (f.dados.iluminacao ?? '') : (f[k] ?? ''))}"></label>`).join('')}</div>
        <div id="ftPrev" style="margin-top:10px"></div>
        <div class="acoes-r" style="margin-top:12px"><button class="btn sol" data-gerar>Salvar e abrir o relatório</button><button class="btn zap" data-zap>WhatsApp</button></div>
        ${hist.length ? `<div class="secao-t" style="margin-top:16px"><h2 style="font-size:16px">Contas anteriores</h2></div><table>${hist.map((h) => { const r = U.periodoFatura(u, g, h); return `<tr><td>${unids.length ? esc(nomeUn(h.unidade_id)) + ' · ' : ''}${esc(h.referencia || h.leitura_fim)}</td><td>${brl(r.economia)} de economia</td><td><button class="link" data-abrir="${h.id}">abrir</button> · <button class="link" data-editar="${h.id}">editar</button></td></tr>`; }).join('')}</table>` : ''}</div>`;
      prever();
    };
    const ler = () => { const un = ov.querySelector('#ftUn'); if (un) f.unidade_id = +un.value || 0; ov.querySelectorAll('[data-ft]').forEach((i) => { const v = i.type === 'number' ? (i.value === '' ? null : +i.value) : i.value.trim(); if (i.dataset.ft === 'iluminacao') f.dados = { ...(f.dados || {}), iluminacao: v }; else f[i.dataset.ft] = v; }); };
    const prever = () => {
      ler(); const el = ov.querySelector('#ftPrev'); if (!el) return;
      if (!f.leitura_ini || !f.leitura_fim || f.leitura_fim <= f.leitura_ini) { el.innerHTML = '<p class="mini">Coloque as duas datas de leitura para ver a economia.</p>'; return; }
      const r = U.periodoFatura(u, g, f);
      el.innerHTML = `<div class="kpis"><div class="kpi destaque"><span class="rotulo">Economia na conta</span><b>${brl(r.economia)}</b><span class="sutil">sem solar seria ${brl(r.semSolar)}</span></div>
        <div class="kpi"><span class="rotulo">Gerou no período</span><b>${n(r.geracao)} kWh</b><span class="sutil">${r.origem === 'plataforma' ? r.diasComDado + ' dias da plataforma' : r.origem === 'estimada' ? 'estimado: só ' + r.diasComDado + ' de ' + r.dias + ' dias' : r.geracao ? 'digitado' : 'sem dado: digite a geração'}</span></div>
        <div class="kpi"><span class="rotulo">Veio do sol</span><b>${n(r.pctSol * 100)}%</b><span class="sutil">da energia da casa</span></div></div>`;
    };
    desenhar(); document.body.appendChild(ov);
    ov.oninput = prever;
    ov.onchange = async (e) => {
      if (e.target.id === 'ftUn') { ler(); desenhar(); return; }
      if (e.target.id !== 'ftArq') return; const arq = e.target.files[0]; if (!arq) return;
      const av = ov.querySelector('#ftAviso'); av.textContent = 'lendo a conta…';
      try {
        const c = await window.LeitorConta.lerArquivo(arq);
        const mapa = { leitura_ini: c.leituraAnterior, leitura_fim: c.leituraAtual, consumo_rede: c.consumoRede, injetada: c.injetada, saldo_creditos: c.saldoCreditos, valor_pago: c.valorTotal, tarifa: c.tarifaKwh, referencia: c.referencia };
        let achou = 0; Object.entries(mapa).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') { f[k] = v; achou++; } });
        if (c.iluminacao) { f.dados = { ...(f.dados || {}), iluminacao: c.iluminacao }; achou++; }
        desenhar(); ov.querySelector('#ftAviso').textContent = `li ${achou} de 9 campos: confira os que ficaram em branco`;
      } catch (err) { av.textContent = 'Não consegui ler: ' + err.message; }
    };
    ov.onclick = async (e) => {
      if (e.target === ov || e.target.closest('[data-x]')) return ov.remove();
      if (e.target.closest('[data-ler]')) return ov.querySelector('#ftArq').click();
      const ab = e.target.closest('[data-abrir]'); if (ab) { const fx = hist.find((h) => String(h.id) === ab.dataset.abrir); return U.relatorioFatura(u, g, fx, hist.filter((h) => (h.unidade_id || 0) === (fx.unidade_id || 0))); }
      const ed = e.target.closest('[data-editar]'); if (ed) { f = { ...hist.find((h) => String(h.id) === ed.dataset.editar) }; f.dados = f.dados || {}; return desenhar(); }
      const gerar = e.target.closest('[data-gerar]'), zap = e.target.closest('[data-zap]');
      if (!gerar && !zap) return;
      ler();
      if (!f.leitura_ini || !f.leitura_fim || f.leitura_fim <= f.leitura_ini) return toast('Coloque as datas de leitura da conta');
      if (!f.valor_pago && f.valor_pago !== 0) return toast('Coloque o valor da conta');
      if (!(+f.unidade_id > 0) && !U.periodoFatura(u, g, f).geracao) return toast('Sem geração da plataforma nesse período: digite a geração do app do inversor');
      let salvo = f;
      try { salvo = await B.salvarFatura(f); } catch (err) { toast('Não salvou: ' + String(err.message).slice(0, 80)); }
      const todas = [salvo, ...hist.filter((h) => (h.unidade_id || 0) === (salvo.unidade_id || 0) && h.leitura_fim !== salvo.leitura_fim)];
      if (gerar) U.relatorioFatura(u, g, salvo, todas);
      else window.open('https://wa.me/55' + String(u.whatsapp || '').replace(/\D/g, '').replace(/^55/, '') + '?text=' + encodeURIComponent(U.mensagemFatura(u, g, salvo)), '_blank', 'noopener');
      ov.remove(); formFatura(u);
    };
  }
  /* link do app do cliente: a usina, a geração, as contas e o rateio, sem login */
  function appCliente(u) {
    const url = new URL('cliente.html?t=' + encodeURIComponent(u.token || u.id), location.href).href;
    const msg = `Olá ${String(u.cliente_nome).split(' ')[0]}! Aqui você acompanha a sua usina solar a qualquer hora: geração do dia, do mês, as contas de luz e a economia ☀️\n${url}`;
    const ov = document.createElement('div'); ov.style.cssText = 'position:fixed;inset:0;z-index:80;background:#0009;display:grid;place-items:center;padding:16px';
    ov.innerHTML = `<div class="painel" style="max-width:520px;width:100%"><div class="entre"><span class="rotulo" style="color:var(--sol)">App do cliente · ${esc(u.cliente_nome)}</span><button class="link" data-x>fechar</button></div>
      <p class="mini" style="margin:10px 0">Link só desta usina. O cliente vê a geração, as contas lançadas e o rateio, sem precisar de senha.</p>
      <input type="text" readonly value="${esc(url)}" style="width:100%" id="acLink">
      <div class="acoes-r" style="margin-top:10px;flex-wrap:wrap"><button class="btn vidro" data-copiar>Copiar link</button><a class="btn vidro" href="${esc(url)}" target="_blank" rel="noopener">Abrir</a>${u.whatsapp ? `<a class="btn zap" href="https://wa.me/55${String(u.whatsapp).replace(/\D/g, '').replace(/^55/, '')}?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">Mandar no WhatsApp</a>` : ''}</div></div>`;
    document.body.appendChild(ov);
    ov.onclick = (e) => { if (e.target === ov || e.target.closest('[data-x]')) return ov.remove(); if (e.target.closest('[data-copiar]')) { navigator.clipboard.writeText(url).then(() => toast('Link copiado')).catch(() => { $('#acLink').select(); }); } };
  }
  /* rateio: unidades consumidoras que recebem os créditos da usina (% de cada uma, como no cadastro da CPFL) */
  async function formRateio(u) {
    let lista = await B.unidades(u.id).catch(() => []);
    const ov = document.createElement('div'); ov.style.cssText = 'position:fixed;inset:0;z-index:80;background:#0009;display:grid;place-items:center;padding:16px';
    const desenhar = () => {
      const soma = lista.reduce((t, x) => t + (+x.percentual || 0), 0);
      ov.innerHTML = `<div class="painel" style="max-width:720px;width:100%;max-height:92vh;overflow:auto"><div class="entre"><span class="rotulo" style="color:var(--sol)">Rateio de créditos · ${esc(u.cliente_nome)}</span><button class="link" data-x>fechar</button></div>
        <p class="mini" style="margin:8px 0">Cadastre as unidades (UC) que recebem créditos da usina e o % de cada uma, igual à lista de rateio da CPFL. Marque a geradora (onde a usina está).</p>
        <table><tr><th>UC (instalação)</th><th>Nome</th><th>Titular</th><th class="v">%</th><th>Geradora</th><th></th></tr>
          ${lista.map((x, i) => `<tr><td><input data-r="${i}" data-k="uc" value="${esc(x.uc || '')}" style="width:120px"></td><td><input data-r="${i}" data-k="apelido" value="${esc(x.apelido || '')}" placeholder="ex.: Loja centro" style="width:140px"></td><td><input data-r="${i}" data-k="titular" value="${esc(x.titular || '')}" style="width:140px"></td>
            <td class="v"><input data-r="${i}" data-k="percentual" type="number" step="0.01" min="0" max="100" value="${x.percentual ?? ''}" style="width:70px"></td><td><input type="checkbox" data-r="${i}" data-k="geradora" ${x.geradora ? 'checked' : ''}></td><td><button class="link" data-del="${i}">tirar</button></td></tr>`).join('')}</table>
        <p class="mini" style="margin:8px 0;${Math.abs(soma - 100) > 0.01 && lista.length ? 'color:var(--laranja)' : ''}">Soma: ${n(soma, 2)}%${lista.length && Math.abs(soma - 100) > 0.01 ? ' (a CPFL exige 100%)' : ''}</p>
        <div class="acoes-r"><button class="btn vidro" data-mais>＋ Unidade</button><button class="btn sol" data-salvar>Salvar rateio</button></div></div>`;
    };
    const ler = () => ov.querySelectorAll('[data-r]').forEach((i) => { const x = lista[+i.dataset.r]; x[i.dataset.k] = i.type === 'checkbox' ? i.checked : i.type === 'number' ? (i.value === '' ? null : +i.value) : i.value.trim(); });
    desenhar(); document.body.appendChild(ov);
    ov.oninput = () => { ler(); const soma = lista.reduce((t, x) => t + (+x.percentual || 0), 0); const p = ov.querySelector('p.mini:last-of-type'); if (p) p.textContent = 'Soma: ' + n(soma, 2) + '%' + (Math.abs(soma - 100) > 0.01 ? ' (a CPFL exige 100%)' : ''); };
    ov.onclick = async (e) => {
      if (e.target === ov || e.target.closest('[data-x]')) return ov.remove();
      if (e.target.closest('[data-mais]')) { ler(); lista.push({ usina_id: u.id, uc: '', apelido: '', titular: '', percentual: null, geradora: !lista.length }); return desenhar(); }
      const del = e.target.closest('[data-del]'); if (del) { ler(); const x = lista.splice(+del.dataset.del, 1)[0]; if (x && x.id) await B.apagarUnidade(x.id).catch(() => {}); return desenhar(); }
      if (e.target.closest('[data-salvar]')) {
        ler(); if (lista.some((x) => !x.uc)) return toast('Preencha o número da UC de todas as unidades');
        try { lista = await Promise.all(lista.map((x) => B.salvarUnidade({ ...x, usina_id: u.id }))); toast('Rateio salvo'); ov.remove(); } catch (err) { toast('Não salvou: ' + String(err.message).slice(0, 80)); }
      }
    };
  }
  function formUsina(u) {
    const ov = document.createElement('div'); ov.style.cssText = 'position:fixed;inset:0;z-index:80;background:#0009;display:grid;place-items:center;padding:16px';
    const campo = (k, r, t = 'text', extra = '') => `<label class="campo"><span>${r}</span><input data-f="${k}" type="${t}" step="any" value="${esc(u[k] ?? '')}" ${extra}></label>`;
    ov.innerHTML = `<div class="painel" style="max-width:560px;width:100%;max-height:92vh;overflow:auto"><div class="entre"><span class="rotulo" style="color:var(--sol)">${u.id ? 'Editar usina' : 'Cadastrar usina'}</span><button class="link" data-x>fechar</button></div>
      <div class="grade g2" style="margin-top:10px">${campo('cliente_nome', 'Cliente')}${campo('whatsapp', 'WhatsApp')}${campo('cidade', 'Cidade')}${campo('kwp', 'Potência (kWp)', 'number')}
        <label class="campo"><span>Marca do inversor</span><select data-f="marca">${window.Usinas.MARCAS.map((m) => `<option ${m === u.marca ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
        ${campo('plataforma_id', 'ID da usina na plataforma')}${campo('ligada_em', 'Ligada em', 'date')}${campo('esperado_mes', 'Geração prometida (kWh/mês)', 'number')}${campo('tarifa_kwh', 'Tarifa (R$/kWh)', 'number')}${campo('email', 'E-mail do cliente', 'email')}</div>
      <label class="alternar" style="margin-top:8px"><span><b>Plano de monitoramento</b><br><span class="sutil">recebe o relatório da conta por e-mail todo mês</span></span><input type="checkbox" id="usPlano" ${u.plano ? 'checked' : ''}></label>
      <div class="acoes-r" style="margin-top:12px"><button class="btn sol" data-salvar>Salvar</button></div></div>`;
    document.body.appendChild(ov);
    ov.onclick = async (e) => {
      if (e.target === ov || e.target.closest('[data-x]')) return ov.remove();
      if (!e.target.closest('[data-salvar]')) return;
      const novoU = { ...u }; ov.querySelectorAll('[data-f]').forEach((i) => { novoU[i.dataset.f] = i.type === 'number' ? (i.value === '' ? null : +i.value) : i.value.trim(); });
      novoU.plano = ov.querySelector('#usPlano').checked ? 'mensal' : null;
      if (!novoU.cliente_nome || !novoU.kwp) { toast('Preencha cliente e potência'); return; }
      if (!novoU.esperado_mes) novoU.esperado_mes = Math.round(novoU.kwp * ((D.cidades[novoU.cidade] || D.cidades['Ribeirão Preto']).hsp) * 30 * P().pr);
      try { await B.salvarUsina(novoU); ov.remove(); toast('Usina salva'); usinasPag(); } catch (err) { toast('Não salvou: ' + err.message.slice(0, 80)); }
    };
  }

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

  /* ======================= SERVIÇOS E MANUTENÇÃO (orçamentos avulsos) ======================= */
  const AV = () => window.Avulso;
  const linkServico = (o, vendedor) => new URL(`proposta-servico.html?t=${o.token}${vendedor ? '&v=1' : ''}`, location.href).href;
  const ST_AV = { novo: ['Rascunho', 'var(--texto-3)'], proposta: ['Enviada', 'var(--azul, #3db4ff)'], ganho: ['Aceita ✓', 'var(--verde, #3ddc97)'], perdido: ['Perdida', 'var(--laranja)'] };
  function servicosPag() {
    const lista = B.avulsos().filter((o) => !o.apagado).sort((x, y) => String(y.atualizadoEm || '').localeCompare(String(x.atualizadoEm || '')));
    const tot = (o) => AV().calcular(o, P()).total, abertos = lista.filter((o) => o.status === 'proposta'), aceitos = lista.filter((o) => o.status === 'ganho');
    app.innerHTML = `${cabCelular()}<div class="cab entra"><div><h1>Serviços e manutenção</h1><p class="sutil">Orçamentos fora do kit solar: manutenção por placa, inversor híbrido, materiais e mão de obra. Cada um vira uma proposta com link.</p></div>
        <div class="linha-h"><a class="btn vidro" href="#servico-novo-manutencao">🧽 Nova manutenção</a><a class="btn vidro" href="#servico-novo-ampliacao">⚡ Ampliação / retrofit</a><a class="btn sol" href="#servico-novo-servico">🔧 Novo serviço / itens</a></div></div>
      <div class="kpis entra"><div class="kpi destaque"><span class="rotulo">Em aberto</span><b>${abertos.length}</b><span class="sutil">${brl(abertos.reduce((t, o) => t + tot(o), 0))} em propostas</span></div>
        <div class="kpi"><span class="rotulo">Aceitas</span><b>${aceitos.length}</b><span class="sutil">${brl(aceitos.reduce((t, o) => t + tot(o), 0))}</span></div>
        <div class="kpi"><span class="rotulo">Manutenções</span><b>${lista.filter((o) => o.tipo === 'manutencao').length}</b><span class="sutil">R$ ${n(P().manutencaoPorPlaca || 25)} por placa</span></div>
        <div class="kpi"><span class="rotulo">Serviços</span><b>${lista.filter((o) => o.tipo === 'servico').length}</b><span class="sutil">itens fora do kit</span></div></div>
      <div class="ops-v duas">${lista.map((o) => { const c = AV().calcular(o, P()), [stt, cor] = ST_AV[o.status] || ST_AV.novo, ev = B.eventos(o.token), viu = ev.filter((e) => e.tipo === 'abriu').length;
        return `<a class="op-v" href="#servico-${o.id}" style="text-decoration:none;color:inherit"><div class="entre"><b style="font-size:17px">${o.tipo === 'manutencao' ? '🧽' : o.tipo === 'ampliacao' ? '⚡' : '🔧'} ${esc(o.nome || 'Sem nome')}</b><span class="mini" style="color:${cor};font-weight:700">${stt}</span></div>
          <span class="mini">${esc(o.id)} · ${esc(o.titulo || '')} · ${esc(o.cidade || '')}</span><div class="preco" style="margin-top:8px">${brl(c.total, 2)}</div>
          <span class="mini">${o.tipo === 'manutencao' ? `${c.placas} placas${c.plano ? ` · plano a cada ${c.plano.meses} meses` : ''}` : `margem real ${n(c.margemReal * 100, 1)}% · lucro ${brl(c.lucro)}`}${viu ? ` · cliente abriu ${viu}×` : ''}</span></a>`; }).join('') || '<p class="sutil">Nenhum ainda. Comece por uma manutenção ou um serviço.</p>'}</div>`;
  }
  let avDeb = null;
  /* =====================================================================
     PARCEIROS: quem indica cliente. Eles entram por link + senha
     (parceiro.html), sem login do Chamae. Nível 1 indica; 2 também simula e
     tem os roteiros; 3 também vê e manda o link da proposta. Comissão
     sobre o valor do sistema (3% padrão, editável por parceiro).
     ===================================================================== */
  const ST_IND = { nova: ['Nova', 'var(--sol)'], em_contato: ['Em contato', 'var(--amarelo)'], proposta: ['Proposta enviada', '#7a9dff'], ganho: ['Fechou', 'var(--verde-claro)'], perdido: ['Não fechou', 'var(--texto-3)'] };
  function faixaParceiro() {
    const a = estimativaRapida({ kwh: 350, cidade: 'Ribeirão Preto', ligacao: 'bi' }), b = estimativaRapida({ kwh: 1200, cidade: 'Ribeirão Preto', ligacao: 'bi' }), p = P();
    const pk = [a.min / a.kwp, a.max / a.kwp, b.min / b.kwp, b.max / b.kwp];
    return { porKwpMin: Math.round(Math.min(...pk)), porKwpMax: Math.round(Math.max(...pk)), hsp: (C.entrada({ cidade: 'Ribeirão Preto', consumos: [500], ligacao: 'bi' }).hsp) || 5.3, pr: p.pr || 0.8, tarifaKwh: p.tarifaKwh || 0.98, em: new Date().toISOString() };
  }
  const statusDeOrc = (o) => (!o ? null : o.status === 'ganho' ? 'ganho' : o.status === 'perdido' ? 'perdido' : o.status === 'novo' ? 'em_contato' : 'proposta');
  async function sincIndicacoes(inds) {
    for (const i of inds) { if (!i.orc_codigo) continue; const o = B.obter(i.orc_codigo); if (!o) continue;
      const st = statusDeOrc(o), mud = {};
      if (st && st !== i.status) mud.status = st;
      if (o.status !== 'novo' && o.token) { const l = linkProposta(o); if (l !== i.link_proposta) mud.link_proposta = l; }
      if (st === 'ganho') { let v = 0; try { const ops = C.opcoes(o, P()); const op = ops[o.opcaoEscolhida ?? 1] || ops[0]; v = Math.round(op.preco.precoFinal); } catch { v = Math.round(+((o.aceite || {}).valor) || 0); } const pct = +i.comissao_pct || 0.03;
        if (v && v !== +i.valor_sistema) { mud.valor_sistema = v; mud.comissao_valor = Math.round(v * pct * 100) / 100; } }
      if (Object.keys(mud).length) { Object.assign(i, mud); try { await B.salvarIndicacao(i.id, mud); } catch { /* segue */ } } }
  }
  /* ======================= RADAR DE OPORTUNIDADES =======================
     Tudo sai do histórico de preço (cada cotação real do robô vira uma linha em sol_kit_precos):
     propostas com preço velho/errado, kit que caiu ou subiu, equipamento mais barato e cupons da Belenergy. */
  const FAIXAS_KWP = [[0, 3], [3, 5], [5, 8], [8, 12], [12, 20], [20, 1e9]];
  const faixaDe = (kwp) => FAIXAS_KWP.find(([a, b]) => kwp > a && kwp <= b) || FAIXAS_KWP[FAIXAS_KWP.length - 1];
  const nomeFaixa = ([a, b]) => (b >= 1e9 ? `acima de ${a} kWp` : a ? `${a} a ${b} kWp` : `até ${b} kWp`);
  const mediana = (l) => { const v = l.filter((x) => x > 0).sort((a, b) => a - b); if (!v.length) return null; const m = Math.floor(v.length / 2); return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };
  const chaveT = (t) => (window.Cotador ? Cotador.chaveTipo(t) : String(t || '').toLowerCase());
  async function radarPag() {
    app.innerHTML = `${cabCelular()}<div class="cab"><div><h1>Radar de oportunidades</h1><p class="sutil">Preço do kit em tempo real, propostas que precisam de atenção e o que dá para ganhar agora.</p></div></div><p class="sutil">Carregando o histórico de preços…</p>`;
    let precos = [], st = null;
    try { [precos, st] = await Promise.all([B.kitPrecos(90), B.roboStatus().catch(() => null)]); } catch (e) { app.querySelector('p.sutil:last-child').textContent = 'Não consegui ler o histórico: ' + e.message; return; }
    precos = (precos || []).filter((x) => +x.rs_wp > 0 && +x.kwp > 0).map((x) => ({ ...x, t: new Date(x.cotado_em).getTime(), kwp: +x.kwp, rs: +x.rs_wp }));
    const agora = Date.now(), D7 = agora - 7 * 864e5, D37 = agora - 37 * 864e5;
    const lim = +P().validadeKitDias || 7;
    // referência de hoje: mediana do R$/Wp de kits parecidos (mesma faixa, estrutura e opção) nos últimos 7 dias
    const referencia = (kwp, estrutura, nivel) => {
      const f = faixaDe(kwp), base = precos.filter((x) => faixaDe(x.kwp) === f && (!estrutura || chaveT(x.estrutura) === chaveT(estrutura)) && (!nivel || x.nivel === nivel));
      const r7 = base.filter((x) => x.t >= D7); return r7.length ? { rs: mediana(r7.map((x) => x.rs)), n: r7.length } : null;
    };
    // 1) propostas abertas que precisam de atenção no preço
    const aten = [];
    for (const o of B.orcamentos().filter((x) => ABERTOS.includes(x.status || 'novo'))) {
      for (const k of (o.kitsFechados || []).filter(Boolean)) {
        const al = alertasKit(o, k), kwp = k.modulo ? (k.modulo.qtd * k.modulo.potenciaW) / 1000 : 0;
        const r = kwp && k.origem !== 'simulado' && k.valorKit > 0 ? referencia(kwp, k.estrutura && !k.estrutura.semEstrutura ? k.estrutura.tipo : '', k.nivel) : null;
        if (r && k.cotadoEm && new Date(k.cotadoEm).getTime() < D7) {
          const rsK = k.valorKit / (kwp * 1000), dif = (r.rs - rsK) / rsK;
          if (dif <= -0.03) al.push({ oport: true, texto: `O kit está ${Math.round(-dif * 100)}% mais barato hoje (R$ ${n(r.rs, 2)}/Wp; na proposta R$ ${n(rsK, 2)}/Wp): recote e baixe o preço, ou ganhe margem.` });
          if (dif >= 0.03) al.push({ grave: true, texto: `O kit subiu ${Math.round(dif * 100)}% desde a cotação (R$ ${n(rsK, 2)} → ${n(r.rs, 2)}/Wp): recote antes de fechar para não perder margem.` });
        }
        if (al.length) aten.push({ o, k, al });
      }
    }
    // 2) preço do kit por tamanho e estrutura (opção Inversor): hoje × 8 a 37 dias atrás
    const grupos = {};
    precos.filter((x) => (x.nivel || 'Inversor') === 'Inversor').forEach((x) => { const f = faixaDe(x.kwp), k = nomeFaixa(f) + '|' + (x.estrutura || '—'); (grupos[k] = grupos[k] || { f, estrutura: x.estrutura || '—', hoje: [], antes: [] }); if (x.t >= D7) grupos[k].hoje.push(x.rs); else if (x.t >= D37) grupos[k].antes.push(x.rs); });
    const linhasTab = Object.values(grupos).filter((g) => g.hoje.length || g.antes.length).sort((a, b) => a.f[0] - b.f[0] || String(a.estrutura).localeCompare(b.estrutura));
    // 3) equipamentos: último preço de cada módulo (R$/W, com o desconto do kit) e de cada inversor
    const ultimo = {}; precos.forEach((x) => { if (x.modulo_sku && +x.modulo_preco > 0 && +x.modulo_w > 0 && (!ultimo[x.modulo_sku] || ultimo[x.modulo_sku].t < x.t)) ultimo[x.modulo_sku] = x; });
    const mods = Object.values(ultimo).map((x) => ({ x, rw: (+x.modulo_preco * (1 - (+x.desconto || 0))) / +x.modulo_w })).sort((a, b) => a.rw - b.rw).slice(0, 8);
    const ultInv = {}; precos.forEach((x) => { if (x.inversor_sku && +x.inversor_preco > 0 && (!ultInv[x.inversor_sku] || ultInv[x.inversor_sku].t < x.t)) ultInv[x.inversor_sku] = x; });
    const invs = Object.values(ultInv).map((x) => ({ x, un: (+x.inversor_preco * (1 - (+x.desconto || 0))) / (+x.inversor_qtd || 1), kw: (+x.inversor_kw || 0) / (+x.inversor_qtd || 1) })).sort((a, b) => a.kw - b.kw || a.un - b.un).slice(0, 10);
    // 4) cupons da Belenergy (o robô confere 2× por dia)
    const info = (st && st.info) || {}, hoje0 = new Date(new Date().toDateString());
    const cup = Array.isArray(info.cupons) ? info.cupons : null;
    const cupOk = (cup || []).filter((c) => !c.usado && c.habilitado !== false && (!c.validade || new Date(c.validade) >= hoje0));
    const cupPerdidos = (cup || []).filter((c) => !c.usado && c.validade && new Date(c.validade) < hoje0 && new Date(c.validade) > new Date(agora - 120 * 864e5));
    const graves = aten.filter((a) => a.al.some((x) => x.grave)).length, oport = aten.filter((a) => a.al.some((x) => x.oport)).length;
    const inv = precos.filter((x) => (x.nivel || 'Inversor') === 'Inversor'); // o micro é mais caro: a referência é a opção inversor
    const r7 = inv.filter((x) => x.t >= D7), rsHoje = mediana(r7.map((x) => x.rs)), rsAntes = mediana(inv.filter((x) => x.t < D7 && x.t >= D37).map((x) => x.rs));
    const varTxt = rsHoje && rsAntes ? `${rsHoje < rsAntes ? '▼' : '▲'} ${n(Math.abs((rsHoje - rsAntes) / rsAntes) * 100, 1)}% no mês` : 'sem base para comparar ainda';
    const dataBR = (d) => (d ? new Date(d).toLocaleDateString('pt-BR') : '—');
    app.innerHTML = `${cabCelular()}<div class="cab"><div><h1>Radar de oportunidades</h1><p class="sutil">Preço do kit em tempo real, propostas que precisam de atenção e o que dá para ganhar agora. Cada cotação do robô alimenta este painel.</p></div></div>
      <div class="kpis"><div class="kpi ${graves ? '' : 'destaque'}"><span class="rotulo">Propostas com preço a revisar</span><b>${aten.length}</b><span class="sutil">${graves} urgente(s) · ${oport} oportunidade(s)</span></div>
        <div class="kpi"><span class="rotulo">Kit hoje · opção inversor (7 dias)</span><b>${rsHoje ? 'R$ ' + n(rsHoje, 2) + '/Wp' : '—'}</b><span class="sutil">${r7.length} cotação(ões) · ${varTxt}</span>${rsHoje && r7.length >= 3 && Math.abs(rsHoje - (+P().kitRefWp || 0)) >= 0.02 ? `<button class="btn vidro pequeno" id="rdRef" style="margin-top:6px">Usar como kit de referência (hoje R$ ${n(+P().kitRefWp || 0, 2)})</button>` : ''}</div>
        <div class="kpi"><span class="rotulo">Cupons válidos na Belenergy</span><b>${cup ? cupOk.length : '—'}</b><span class="sutil">${cup ? (cupOk.length ? brl(cupOk.reduce((t, c) => t + c.valor, 0), 2) + ' para usar' : 'nenhum agora') : 'o robô novo confere 2× por dia'}</span></div>
        <div class="kpi"><span class="rotulo">Cotações guardadas (90 dias)</span><b>${precos.length}</b><span class="sutil">robô, Jarvis e pré-propostas</span></div></div>
      <div class="painel" style="margin-top:14px"><div class="entre"><span class="rotulo">⚠ Propostas abertas que precisam de atenção no preço</span>${aten.length ? '<button class="btn sol pequeno" id="rdTodas">Recotar todas pelo robô</button>' : ''}</div>
        ${aten.length ? `<table style="margin-top:8px">${aten.map(({ o, k, al }) => `<tr><td><a class="link" href="#lead-${o.id}"><b>${esc(o.nome)}</b></a><div class="mini">${esc(o.id)} · ${esc(k.nivel || '')} · ${brl(k.valorKit, 2)} · cotado ${k.cotadoEm ? tempoRel(k.cotadoEm) : '—'}</div></td>
          <td>${al.map((a) => `<div class="mini" style="color:${a.grave ? 'var(--laranja)' : a.oport ? 'var(--verde-claro)' : 'inherit'}">${a.grave ? '⛔' : a.oport ? '💰' : 'ℹ️'} ${esc(a.texto)}</div>`).join('')}</td>
          <td class="v"><button class="btn vidro pequeno" data-recotar="${esc(o.id)}">Recotar</button></td></tr>`).join('')}</table>`
          : '<p class="sutil" style="margin:8px 0 0">Nenhuma proposta aberta com preço velho, simulado ou com estrutura trocada. 👍</p>'}</div>
      <div class="lado" style="margin-top:14px"><div class="painel"><span class="rotulo">📈 Preço do kit por tamanho (opção inversor)</span>
        ${linhasTab.length ? `<table style="margin-top:8px"><tr><td class="mini">Tamanho · estrutura</td><td class="v mini">Últimos 7 dias</td><td class="v mini">8 a 37 dias</td><td class="v mini">Variação</td></tr>${linhasTab.map((g) => { const h = mediana(g.hoje), a = mediana(g.antes), d = h && a ? (h - a) / a : null; return `<tr><td>${nomeFaixa(g.f)} · ${esc(g.estrutura)}</td><td class="v">${h ? 'R$ ' + n(h, 2) : '—'} <span class="mini">(${g.hoje.length})</span></td><td class="v">${a ? 'R$ ' + n(a, 2) : '—'} <span class="mini">(${g.antes.length})</span></td><td class="v" style="color:${d == null ? 'inherit' : d < 0 ? 'var(--verde-claro)' : 'var(--laranja)'}">${d == null ? '—' : (d < 0 ? '▼ ' : '▲ ') + n(Math.abs(d) * 100, 1) + '%'}</td></tr>`; }).join('')}</table><p class="mini" style="margin:8px 0 0">R$ por Wp do kit da Belenergy (mediana). ▼ verde = ficou mais barato: hora de prospectar e de recotar propostas paradas.</p>`
          : '<p class="sutil" style="margin:8px 0 0">Ainda sem cotações suficientes. O Radar enche sozinho a cada cotação do robô; com as <b>pré-propostas da manhã</b> (Parâmetros → Robô) ele ganha preço novo todo dia.</p>'}</div>
        <div class="painel"><span class="rotulo">🎟 Cupons da Belenergy</span>
          ${cup ? (cupOk.length ? cupOk.map((c) => `<div class="aviso" style="margin-top:8px"><b>${brl(c.valor, 2)}</b> · ${esc(c.nome)} · vence ${dataBR(c.validade)}${c.limitePct ? ` · até ${c.limitePct}% do pedido` : ''}</div>`).join('') : '<p class="sutil" style="margin:8px 0 0">Nenhum cupom válido agora.</p>')
            + (cupPerdidos.length ? `<p class="mini" style="margin:10px 0 0;color:var(--laranja)">Venceram sem usar: ${cupPerdidos.map((c) => `${brl(c.valor, 2)} (${esc(c.nome)}, ${dataBR(c.validade)})`).join(' · ')}. Financiar pelos parceiros da Belenergy gera cupom para a próxima compra: vale usar antes de vencer.</p>` : '')
            + `<p class="mini" style="margin:8px 0 0">Conferido pelo robô em ${info.cuponsEm ? new Date(info.cuponsEm).toLocaleString('pt-BR') : '—'}.</p>`
            : '<p class="sutil" style="margin:8px 0 0">Com o robô novo ligado, ele confere os cupons da sua conta Belenergy duas vezes por dia e mostra aqui antes de vencer.</p>'}</div></div>
      <div class="lado" style="margin-top:14px"><div class="painel"><span class="rotulo">🔆 Módulos mais baratos nas últimas cotações</span>
        ${mods.length ? `<table style="margin-top:8px">${mods.map(({ x, rw }) => `<tr><td>${esc(x.modulo_marca || '')} ${esc(String(x.modulo_w))} W<div class="mini">${esc(x.modulo_sku)}</div></td><td class="v">R$ ${n(rw, 3)}/W<div class="mini">${dataBR(x.cotado_em)}</div></td></tr>`).join('')}</table><p class="mini" style="margin:8px 0 0">Preço do módulo dentro do kit (com o desconto de kit do portal).</p>` : '<p class="sutil" style="margin:8px 0 0">Aparece com as cotações do robô novo (ele traz o preço de cada item).</p>'}</div>
        <div class="painel"><span class="rotulo">⚡ Inversores cotados</span>
          ${invs.length ? `<table style="margin-top:8px">${invs.map(({ x, un, kw }) => `<tr><td>${esc(x.inversor_marca || '')} ${kw ? n(kw, 1) + ' kW' : ''}<div class="mini">${esc(x.inversor_sku)}</div></td><td class="v">${brl(un, 0)}<div class="mini">${dataBR(x.cotado_em)}</div></td></tr>`).join('')}</table>` : '<p class="sutil" style="margin:8px 0 0">Aparece com as cotações do robô novo.</p>'}</div></div>`;
    const recotar = async (o) => { const ped = pedidoRobo(o); ped.base.salvar = false; try { await B.filaRobo({ orc_codigo: o.id, tipo: 'cotar', pedido: ped }); o.aguardandoRobo = new Date().toISOString(); B.salvar(o); return true; } catch (e) { toast('Não consegui mandar para o robô: ' + e.message); return false; } };
    app.querySelectorAll('[data-recotar]').forEach((b) => b.onclick = async () => { const o = B.obter(b.dataset.recotar); if (!o) return; b.disabled = true; if (await recotar(o)) { b.textContent = 'Na fila ✓'; toast('Pedido no robô: o preço novo entra sozinho na proposta.'); } else b.disabled = false; });
    const ref = $('#rdRef'); if (ref) ref.onclick = () => { B.salvarParametros({ kitRefWp: Math.round(rsHoje * 100) / 100 }); toast(`Kit de referência agora é R$ ${n(rsHoje, 2)}/Wp (resposta rápida e estimativas)`); ref.remove(); };
    const todas = $('#rdTodas'); if (todas) todas.onclick = async () => { todas.disabled = true; let k = 0; const vistos = new Set(); for (const { o } of aten) { if (vistos.has(o.id)) continue; vistos.add(o.id); if (await recotar(o)) k++; } toast(`${k} proposta(s) na fila do robô`); todas.textContent = 'Na fila ✓'; };
  }

  async function parceirosPag() {
    app.innerHTML = `${cabCelular()}<p class="sutil">Carregando parceiros…</p>`;
    let ps = [], inds = []; try { [ps, inds] = await Promise.all([B.parceiros(), B.indicacoes()]); } catch (e) { app.innerHTML = `${cabCelular()}<p class="sutil">Não consegui abrir os parceiros: ${esc(e.message)}</p>`; return; }
    await sincIndicacoes(inds);
    if (!P().parceiroFaixa) { try { B.salvarParametros({ parceiroFaixa: faixaParceiro() }); } catch { /* */ } }
    const nomeP = Object.fromEntries(ps.map((x) => [x.id, x.nome])), linkP = (x) => new URL('parceiro.html?t=' + x.token, location.href).href, cad = new URL('parceiro.html', location.href).href;
    const aPagar = inds.filter((i) => i.status === 'ganho' && !i.paga_em).reduce((t, i) => t + (+i.comissao_valor || 0), 0);
    app.innerHTML = `${cabCelular()}<div class="cab entra"><div><h1>Parceiros</h1><p class="sutil">Quem indica cliente para a Chama Solar. Eles entram por um link com senha, sem acesso ao Chamae.</p></div>
        <div class="linha-h"><button class="btn vidro" id="pcCad">🔗 Link de cadastro</button><button class="btn vidro" id="pcFaixa">↻ Faixa do simulador</button></div></div>
      <div class="kpis entra"><div class="kpi destaque"><span class="rotulo">Parceiros ativos</span><b>${ps.filter((x) => x.ativo).length}</b><span class="sutil">${ps.filter((x) => !x.ativo).length} aguardando aprovação</span></div>
        <div class="kpi"><span class="rotulo">Indicações novas</span><b>${inds.filter((i) => i.status === 'nova').length}</b><span class="sutil">${inds.length} no total</span></div>
        <div class="kpi"><span class="rotulo">Fechadas</span><b>${inds.filter((i) => i.status === 'ganho').length}</b><span class="sutil">${brl(inds.filter((i) => i.status === 'ganho').reduce((t, i) => t + (+i.valor_sistema || 0), 0))} em sistemas</span></div>
        <div class="kpi"><span class="rotulo">Comissão a pagar</span><b>${brl(aPagar)}</b><span class="sutil">já descontada do preço</span></div></div>
      <div class="secao-t"><h2>Indicações</h2><span class="sutil">crie o orçamento e o status volta sozinho para o parceiro</span></div>
      <div class="ops-v duas">${inds.map((i) => { const [t, cor] = ST_IND[i.status] || ST_IND.nova; return `<div class="op-v"><div class="entre"><b>${esc(i.nome)}</b><span class="mini" style="color:${cor};font-weight:700">${t}</span></div>
          <span class="mini">por <b>${esc(nomeP[i.parceiro_id] || '?')}</b> · ${esc(i.cidade || '')} · ${new Date(i.criado).toLocaleDateString('pt-BR')}${i.consumo_kwh ? ` · ${n(i.consumo_kwh)} kWh` : ''}</span>
          ${i.obs ? `<span class="mini">“${esc(i.obs)}”</span>` : ''}${i.status === 'ganho' ? `<span class="mini">sistema ${brl(i.valor_sistema)} · comissão ${n((+i.comissao_pct || 0) * 100, 1)}% = <b>${brl(i.comissao_valor)}</b>${i.paga_em ? ` · paga em ${new Date(i.paga_em).toLocaleDateString('pt-BR')}` : ''}</span>` : ''}
          <div class="acoes-r" style="margin-top:8px;flex-wrap:wrap">${i.orc_codigo ? `<a class="btn vidro pequeno" href="#lead-${esc(i.orc_codigo)}">Abrir ${esc(i.orc_codigo)}</a>` : `<button class="btn sol pequeno" data-indorc="${i.id}">Criar orçamento</button>`}
            ${i.status === 'ganho' && !+i.valor_sistema ? `<input type="number" min="0" step="100" placeholder="valor do sistema R$" data-indval="${i.id}" style="width:170px;padding:6px 8px">` : ''}${i.status === 'ganho' && !i.paga_em ? `<button class="btn vidro pequeno" data-indpaga="${i.id}">Marcar comissão paga</button>` : ''}${!i.orc_codigo && i.status !== 'perdido' ? `<button class="link" data-indperd="${i.id}">não fechou</button>` : ''}</div></div>`; }).join('') || '<p class="sutil">Nenhuma indicação ainda. Mande o link de cadastro para corretores, eletricistas, arquitetos e clientes satisfeitos.</p>'}</div>
      <div class="secao-t"><h2>Parceiros</h2><span class="sutil">nível 1 indica · 2 também simula e tem roteiros · 3 também vê e manda o link da proposta</span></div>
      <div class="ops-v duas">${ps.map((x) => `<div class="op-v" style="cursor:default"><div class="entre"><b>${esc(x.nome)}</b><span class="mini" style="font-weight:700;color:${x.ativo ? 'var(--verde-claro)' : 'var(--laranja)'}">${x.ativo ? 'ativo' : 'aguardando aprovação'}</span></div>
          <span class="mini">${esc(x.profissao || '')}${x.profissao ? ' · ' : ''}${esc(x.cidade || '')} · ${esc(x.whatsapp || '')}${x.pix ? ' · PIX ' + esc(x.pix) : ''}</span>
          <span class="mini">${inds.filter((i) => i.parceiro_id === x.id).length} indicação(ões)${x.ultimo_acesso ? ' · entrou ' + tempoRel(x.ultimo_acesso) : ''}</span>
          <div class="grade g2" style="margin-top:8px"><label class="campo"><span>Nível</span><select data-pnivel="${x.id}">${[1, 2, 3].map((v) => `<option value="${v}" ${+x.nivel === v ? 'selected' : ''}>${v}: ${['indica', 'indica + simula', 'indica + simula + proposta'][v - 1]}</option>`).join('')}</select></label>
            <label class="campo"><span>Comissão (%)</span><input type="number" step="0.5" min="0" max="20" data-pcom="${x.id}" value="${n((+x.comissao || 0) * 100, 1).replace(',', '.')}"></label></div>
          <div class="acoes-r" style="margin-top:8px;flex-wrap:wrap">${x.ativo ? `<button class="btn vidro pequeno" data-pativo="${x.id}" data-v="0">Desativar</button>` : `<button class="btn sol pequeno" data-pativo="${x.id}" data-v="1">✓ Aprovar</button>`}
            <button class="btn vidro pequeno" data-plink="${x.id}">Copiar link</button><button class="btn vidro pequeno" data-pzap="${x.id}">📲 Mandar o link</button></div></div>`).join('') || '<p class="sutil">Nenhum parceiro ainda.</p>'}</div>`;
    const recarregar = () => parceirosPag();
    $('#pcCad').onclick = async () => { try { await navigator.clipboard.writeText(cad); toast('Link de cadastro copiado: ' + cad); } catch { toast(cad); } };
    $('#pcFaixa').onclick = () => { const f = faixaParceiro(); B.salvarParametros({ parceiroFaixa: f }); toast(`Faixa do simulador: ${brl(f.porKwpMin)} a ${brl(f.porKwpMax)} por kWp`); };
    app.querySelectorAll('[data-pativo]').forEach((b) => b.onclick = async () => { await B.salvarParceiro(b.dataset.pativo, { ativo: b.dataset.v === '1' }); toast(b.dataset.v === '1' ? 'Parceiro aprovado: mande o link para ele' : 'Parceiro desativado'); recarregar(); });
    app.querySelectorAll('[data-pnivel]').forEach((sl) => sl.onchange = async () => { await B.salvarParceiro(sl.dataset.pnivel, { nivel: +sl.value }); toast('Nível ' + sl.value + ' salvo'); });
    app.querySelectorAll('[data-pcom]').forEach((ip) => ip.onchange = async () => { const v = Math.min(20, Math.max(0, +ip.value || 0)) / 100; await B.salvarParceiro(ip.dataset.pcom, { comissao: v }); toast(`Comissão de ${n(v * 100, 1)}% salva (vale para as próximas indicações)`); });
    app.querySelectorAll('[data-plink]').forEach((b) => b.onclick = async () => { const x = ps.find((y) => y.id === b.dataset.plink); try { await navigator.clipboard.writeText(linkP(x)); toast('Link do parceiro copiado'); } catch { toast(linkP(x)); } });
    app.querySelectorAll('[data-pzap]').forEach((b) => b.onclick = () => { const x = ps.find((y) => y.id === b.dataset.pzap), tel = String(x.whatsapp || '').replace(/\D/g, '').replace(/^55/, '');
      window.open('https://wa.me/' + (tel ? '55' + tel : '') + '?text=' + encodeURIComponent(`Olá, ${String(x.nome).split(' ')[0]}! Seu cadastro de parceiro da Chama Solar está aprovado. Por este link (com a senha que você criou) você indica clientes e acompanha as suas comissões: ${linkP(x)}`), '_blank', 'noopener'); });
    app.querySelectorAll('[data-indorc]').forEach((b) => b.onclick = async () => { const i = inds.find((y) => y.id === b.dataset.indorc), x = ps.find((y) => y.id === i.parceiro_id) || {};
      const o = { ...novoOrc(), nome: i.nome, whatsapp: i.whatsapp || '', cidade: i.cidade || 'Ribeirão Preto', distanciaKm: ((D.cidades || {})[i.cidade] || {}).km || 0, consumos: i.consumo_kwh ? Array(12).fill(+i.consumo_kwh) : Array(12).fill(''), origem: 'Indicação', indicadoPor: x.nome || '', parceiro: { id: x.id, nome: x.nome, indicacao: i.id }, comissaoParceria: Math.round((+i.comissao_pct || 0.03) * 1000) / 10, nota: i.obs || '' };
      B.salvar(o); await B.salvarIndicacao(i.id, { orc_codigo: o.id, status: 'em_contato' }); toast(`Orçamento ${o.id} criado com ${n(o.comissaoParceria, 1)}% de comissão embutida no preço`); location.hash = '#lead-' + o.id; });
    app.querySelectorAll('[data-indpaga]').forEach((b) => b.onclick = async () => { if (!confirm('Marcar a comissão como paga?')) return; await B.salvarIndicacao(b.dataset.indpaga, { paga_em: new Date().toISOString() }); toast('Comissão marcada como paga'); recarregar(); });
    app.querySelectorAll('[data-indval]').forEach((ip) => ip.onchange = async () => { const i = inds.find((y) => y.id === ip.dataset.indval), v = +ip.value || 0; if (!v) return; await B.salvarIndicacao(i.id, { valor_sistema: v, comissao_valor: Math.round(v * (+i.comissao_pct || 0.03) * 100) / 100 }); toast('Valor salvo'); recarregar(); });
    app.querySelectorAll('[data-indperd]').forEach((b) => b.onclick = async () => { await B.salvarIndicacao(b.dataset.indperd, { status: 'perdido' }); recarregar(); });
  }
  /* =====================================================================
     CLIENTES (quem já comprou) e ARQUIVO (o que não está em negociação).
     O funil fica só com quem está negociando agora.
     ===================================================================== */
  const ultimoMov = (o) => { let t = new Date(o.atualizadoEm || o.enviadoEm || o.criadoEm || 0).getTime();
    try { (B.eventos(o.token) || []).forEach((e) => { t = Math.max(t, new Date(e.em).getTime()); }); (B.interacoes(o.id) || []).forEach((i) => { t = Math.max(t, new Date(i.em).getTime()); }); } catch { /* sem histórico */ }
    return t; };
  const diasDesde = (t) => Math.floor((Date.now() - t) / 864e5);
  const fone = (o) => String(o.whatsapp || o.telefone || '').replace(/\D/g, '').slice(-9);
  const kwpDe = (o) => { if (+o.kwpInstalado) return +o.kwpInstalado; try { const op = C.opcoes(o, P())[0]; return op ? op.dim.kwpReal : 0; } catch { return 0; } };
  /* uma vez por dia: proposta parada há X dias (padrão 45) e perdida há 7 dias saem do funil para o Arquivo */
  function arquivarParados() {
    const p = P(), dias = +p.diasArquivar || 45, hoje = new Date().toISOString().slice(0, 10);
    try { if (localStorage.getItem('sol_arquivou') === hoje) return; localStorage.setItem('sol_arquivou', hoje); } catch { /* sem armazenamento */ }
    const futuros = new Set((p.lembretes || []).filter((l) => !l.feito && new Date(l.quando) > new Date()).map((l) => l.ref));
    let n = 0;
    B.orcamentos().forEach((o) => { const parado = diasDesde(ultimoMov(o));
      const sai = (['proposta', 'visualizou', 'negociando'].includes(o.status) && parado >= dias && !futuros.has(o.id)) || (o.status === 'perdido' && parado >= 7);
      if (!sai) return; o.arquivado = true; o.arquivadoEm = new Date().toISOString(); o.arquivadoMotivo = o.status === 'perdido' ? 'perdido' + (o.motivoPerda ? ': ' + o.motivoPerda : '') : `sem resposta há ${parado} dias`; B.salvar(o); n++; });
    if (n) novoLembrete({ texto: `${n} proposta(s) parada(s) saíram do funil e foram para o Arquivo. Veja as sugestões de retomada da semana.`, ref: 'arquivo', quando: new Date().toISOString(), topo: false });
  }
  setTimeout(() => { try { arquivarParados(); } catch { /* segue */ } }, 4000);
  function repetidos(lista) {
    const grupos = {}; lista.forEach((o) => { const k = (o.cpf || o.documento || '').replace(/\D/g, '') || fone(o); if (k && k.length >= 8) (grupos[k] = grupos[k] || []).push(o); });
    return Object.values(grupos).filter((g) => g.length > 1);
  }
  function juntar(grupo) {
    const [fica, ...saem] = grupo.slice().sort((a, b) => ultimoMov(b) - ultimoMov(a));
    saem.forEach((o) => { ['whatsapp', 'email', 'endereco', 'cpf'].forEach((k) => { if (!fica[k] && o[k]) fica[k] = o[k]; }); fica.historico = [...(fica.historico || []), { id: o.id, nome: o.nome, status: o.status, em: o.criadoEm }];
      o.juntadoEm = fica.id; o.arquivado = true; o.arquivadoMotivo = 'repetido de ' + fica.id; B.salvar(o); });
    B.salvar(fica); return fica;
  }
  /* 🗑 em qualquer lista: primeiro toque pede confirmação, o segundo manda para a lixeira */
  function ligarLixo(redesenhar) {
    app.querySelectorAll('[data-del]').forEach((b) => b.onclick = () => { if (!b.dataset.c) { b.dataset.c = 1; b.textContent = 'excluir?'; setTimeout(() => { if (b.isConnected) { b.textContent = '🗑'; delete b.dataset.c; } }, 4000); return; }
      const o = B.obter(b.dataset.del); if (!o) return; o.apagado = true; o.apagadoEm = new Date().toISOString(); B.salvar(o); toast(`${o.nome || o.id} foi para a lixeira (no Arquivo)`); redesenhar(); });
  }
  function clientesPag() {
    const todos = B.clientes(), busca = (sessionStorage.getItem('cliBusca') || '').toLowerCase();
    const lista = todos.filter((o) => !busca || [o.nome, o.cidade, o.whatsapp, o.id].join(' ').toLowerCase().includes(busca)).sort((a, b) => ultimoMov(b) - ultimoMov(a));
    const rep = repetidos(todos), manutAntiga = (o) => { const ult = B.avulsos().filter((x) => x.clienteDe === o.id && x.tipo === 'manutencao').map((x) => new Date(x.criadoEm).getTime()); const base = Math.max(new Date(o.instaladoEm || o.criadoEm || 0).getTime(), ...ult); return diasDesde(base) > 180; };
    app.innerHTML = `${cabCelular()}<div class="cab entra"><div><h1>Clientes</h1><p class="sutil">Quem já comprou: sistema, documentos e histórico. Daqui saem manutenção, ampliação e indicação, sem lotar o funil.</p></div>
        <div class="linha-h"><a class="btn vidro" href="#arquivo">🗂 Arquivo</a></div></div>
      <div class="kpis entra"><div class="kpi destaque"><span class="rotulo">Clientes</span><b>${todos.length}</b><span class="sutil">${todos.filter((o) => o.origem === 'groner').length} vieram da Groner</span></div>
        <div class="kpi"><span class="rotulo">Manutenção vencida</span><b>${todos.filter(manutAntiga).length}</b><span class="sutil">mais de 6 meses sem visita</span></div>
        <div class="kpi"><span class="rotulo">Repetidos</span><b>${rep.length}</b><span class="sutil">mesmo telefone ou CPF</span></div></div>
      ${rep.length ? `<div class="painel entra"><div class="entre"><span class="rotulo">Possíveis repetidos</span><button class="btn vidro pequeno" id="cliJuntarTodos">Juntar todos</button></div>${rep.slice(0, 8).map((g, i) => `<div class="entre mini" style="padding:6px 0;border-top:1px dashed var(--linha)"><span>${g.map((o) => `<b>${esc(o.nome || '?')}</b> (${esc(o.id)})`).join(' · ')}</span><button class="link" data-junta="${i}">juntar</button></div>`).join('')}<p class="mini">Fica a ficha mais recente; as outras viram histórico dela.</p></div>` : ''}
      <div class="painel entra"><input type="search" id="cliBusca" placeholder="Buscar por nome, cidade, telefone ou código" value="${esc(busca)}" style="width:100%"></div>
      <div class="ops-v duas">${lista.slice(0, 200).map((o) => { const kwp = kwpDe(o), velha = manutAntiga(o);
        return `<div class="op-v"><div class="entre"><b style="font-size:17px">${esc(o.nome || 'Sem nome')}</b>${o.origem === 'groner' ? '<span class="mini" style="opacity:.75">Groner</span>' : ''}</div>
          <span class="mini">${esc(o.id)} · ${esc(o.cidade || '')}${kwp ? ` · ${n(kwp, 2)} kWp` : ''}${o.instaladoEm || o.criadoEm ? ` · desde ${new Date(o.instaladoEm || o.criadoEm).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}` : ''}</span>
          ${resumoCompra(o) ? `<span class="mini" style="color:var(--texto)">🛒 ${esc(resumoCompra(o))}${o.valorFechado ? ' · ' + brl(o.valorFechado) : ''}</span>` : ''}
          ${velha ? '<span class="mini" style="color:var(--laranja)">🧽 manutenção vencida: boa hora de oferecer</span>' : ''}
          ${o.status === 'ganho' && posVendaEtapa(o) ? `<span class="mini" style="color:var(--amarelo)">🏗️ pós-venda: ${esc(posVendaEtapa(o).e[1].toLowerCase())}</span>` : ''}
          <div class="acoes-r" style="margin-top:8px;flex-wrap:wrap"><a class="btn vidro pequeno" href="#lead-${o.id}">Ficha</a><a class="btn vidro pequeno" href="#servico-novo-manutencao-de-${o.id}">🧽 Manutenção</a><a class="btn vidro pequeno" href="#servico-novo-ampliacao-de-${o.id}">⚡ Ampliação</a><button class="btn vidro pequeno" data-novap="${o.id}">＋ Proposta</button><button class="link" data-del="${o.id}" title="mandar para a lixeira">🗑</button></div></div>`; }).join('') || '<p class="sutil">Nenhum cliente ainda. Quem fechar (status Ganho) aparece aqui, e os clientes da Groner entram aqui na importação.</p>'}</div>
      ${lista.length > 200 ? `<p class="mini">Mostrando 200 de ${lista.length}. Use a busca.</p>` : ''}`;
    const bx = $('#cliBusca'); bx.oninput = () => { try { sessionStorage.setItem('cliBusca', bx.value); } catch { /* */ } clearTimeout(avDeb); avDeb = setTimeout(() => { clientesPag(); const b = $('#cliBusca'); b.focus(); b.setSelectionRange(b.value.length, b.value.length); }, 300); };
    app.querySelectorAll('[data-junta]').forEach((b) => b.onclick = () => { const f = juntar(rep[+b.dataset.junta]); toast('Juntado em ' + f.id); clientesPag(); });
    app.querySelectorAll('[data-novap]').forEach((b) => b.onclick = () => { const o = B.obter(b.dataset.novap); if (!o) return; novaPropostaDe(o); toast(`Nova proposta para ${o.nome}`); location.hash = '#novo'; });
    ligarLixo(clientesPag);
    if ($('#cliJuntarTodos')) $('#cliJuntarTodos').onclick = () => { if (!confirm(`Juntar ${rep.length} grupo(s) de repetidos?`)) return; rep.forEach(juntar); toast('Repetidos juntados'); clientesPag(); };
  }
  /* sugestão da semana: as que mais valem retomar (recentes, maiores, com WhatsApp e que já abriram a proposta) */
  function notaRetomada(o) {
    const dias = diasDesde(new Date(o.criadoEm || 0).getTime()), kwp = kwpDe(o), abriu = (B.eventos(o.token) || []).some((e) => e.tipo === 'abriu');
    if (o.juntadoEm || /concorr/.test(o.arquivadoMotivo || '') && dias < 180) return -1;
    return (dias < 90 ? 3 : dias < 365 ? 2 : dias < 730 ? 1 : 0) + Math.min(3, kwp / 4) + (fone(o) ? 1 : -5) + (abriu ? 1.5 : 0) - (o.retomadoEm && diasDesde(new Date(o.retomadoEm).getTime()) < 90 ? 10 : 0);
  }
  function arquivoPag() {
    const todos = B.arquivados().filter((o) => !o.juntadoEm), busca = (sessionStorage.getItem('arqBusca') || '').toLowerCase(), orig = sessionStorage.getItem('arqOrig') || '';
    const lista = todos.filter((o) => (!busca || [o.nome, o.cidade, o.whatsapp, o.id, o.arquivadoMotivo].join(' ').toLowerCase().includes(busca)) && (!orig || (orig === 'groner' ? o.origem === 'groner' : o.origem !== 'groner'))).sort((a, b) => ultimoMov(b) - ultimoMov(a));
    const semana = todos.map((o) => ({ o, s: notaRetomada(o) })).filter((x) => x.s >= 2).sort((a, b) => b.s - a.s).slice(0, 10).map((x) => x.o);
    const cartao = (o) => `<div class="op-v"><div class="entre"><b>${esc(o.nome || 'Sem nome')}</b>${o.origem === 'groner' ? '<span class="mini" style="opacity:.75">Groner</span>' : ''}</div>
      <span class="mini">${esc(o.id)} · ${esc(o.cidade || '')}${kwpDe(o) ? ` · ${n(kwpDe(o), 2)} kWp` : ''} · ${esc(o.arquivadoMotivo || 'arquivado')}</span>
      <div class="acoes-r" style="margin-top:8px"><a class="btn vidro pequeno" href="#lead-${o.id}">Ver</a><button class="btn sol pequeno" data-reativar="${o.id}">↩ Reativar no funil</button><button class="link" data-del="${o.id}" title="mandar para a lixeira">🗑</button></div></div>`;
    app.innerHTML = `${cabCelular()}<div class="cab entra"><div><h1>Arquivo</h1><p class="sutil">Propostas que não estão em negociação: paradas, perdidas e as antigas da Groner. Ficam guardadas e pesquisáveis, fora do funil.</p></div>
        <div class="linha-h"><label class="mini">sai do funil depois de <input type="number" id="arqDias" min="15" value="${+P().diasArquivar || 45}" style="width:64px;padding:4px 6px"> dias sem resposta</label></div></div>
      ${semana.length ? `<div class="painel entra"><span class="rotulo">Para retomar esta semana (${semana.length})</span><p class="mini" style="margin:4px 0 8px">As que mais valem uma nova conversa: recentes, maiores, com WhatsApp e que abriram a proposta. Reativar leva para o funil com um lembrete para hoje.</p><div class="ops-v duas">${semana.map(cartao).join('')}</div></div>` : ''}
      <div class="painel entra"><div class="grade g2"><input type="search" id="arqBusca" placeholder="Buscar por nome, cidade, telefone, código ou motivo" value="${esc(busca)}"><div class="chips">${[['', 'Todos'], ['groner', 'Groner'], ['sistema', 'Deste sistema']].map(([v, t]) => `<button class="chip ${orig === v ? 'sel' : ''}" data-arqo="${v}">${t}</button>`).join('')}</div></div></div>
      ${orig !== 'sistema' ? '<div id="arqGroner"></div>' : ''}
      <p class="mini">${lista.length} no arquivo${orig === 'groner' ? ' já abertos aqui' : ''}${lista.length > 100 ? ' · mostrando 100, use a busca' : ''}</p>
      <div class="ops-v duas">${lista.slice(0, 100).map(cartao).join('') || '<p class="sutil">Arquivo vazio.</p>'}</div>
      ${(() => { const lx = B.lixeira().filter((o) => !['servico', 'manutencao', 'ampliacao'].includes(o.tipo)); return lx.length ? `<div class="painel entra" style="margin-top:14px"><div class="entre"><span class="rotulo">🗑 Lixeira (${lx.length})</span><button class="btn vidro pequeno" id="lxTudo">Excluir tudo de vez</button></div><p class="mini" style="margin:4px 0 8px">Fora de todas as listas. Restaure se excluiu sem querer, ou exclua de vez (some do banco, junto com o histórico de visitas da proposta, e não dá para desfazer).</p>
        ${lx.map((o) => `<div class="entre mini" style="padding:6px 0;border-top:1px dashed var(--linha)"><span><b>${esc(o.nome || 'Sem nome')}</b> · ${esc(o.id)} · ${esc(o.cidade || '')}</span><span><button class="link" data-rest="${o.id}">restaurar</button> · <button class="link" data-devez="${o.id}">excluir de vez</button></span></div>`).join('')}</div>` : ''; })()}`;
    const bx = $('#arqBusca'); bx.oninput = () => { try { sessionStorage.setItem('arqBusca', bx.value); } catch { /* */ } clearTimeout(avDeb); avDeb = setTimeout(() => { arquivoPag(); const b = $('#arqBusca'); b.focus(); b.setSelectionRange(b.value.length, b.value.length); }, 300); };
    app.querySelectorAll('[data-arqo]').forEach((b) => b.onclick = () => { try { sessionStorage.setItem('arqOrig', b.dataset.arqo); } catch { /* */ } arquivoPag(); });
    $('#arqDias').onchange = (e) => { B.salvarParametros({ diasArquivar: Math.max(15, +e.target.value || 45) }); toast('Prazo salvo'); };
    ligarLixo(arquivoPag);
    if ($('#arqGroner') && B.arquivoGroner) {
      const caixa = $('#arqGroner');
      Promise.all([B.contarGroner(), B.arquivoGroner(busca)]).then(([tot, gr]) => {
        if (!tot) { caixa.remove(); return; }
        caixa.innerHTML = `<div class="painel entra"><div class="entre"><span class="rotulo">Propostas antigas da Groner (${tot})</span><span class="mini">ficam no banco e aparecem quando você busca</span></div>
          <div class="ops-v duas" style="margin-top:8px">${gr.map(cartao).join('') || '<p class="sutil">Nenhuma com essa busca.</p>'}</div></div>`;
        caixa.querySelectorAll('[data-reativar]').forEach((b) => { const o = gr.find((x) => x.id === b.dataset.reativar); b.onclick = () => { B.trazer(o); o.arquivado = false; o.retomadoEm = new Date().toISOString(); o.atualizadoEm = o.retomadoEm; if (o.status === 'perdido' || o.status === 'novo') o.status = 'negociando'; B.salvar(o); novoLembrete({ texto: `Retomar ${o.nome} (cliente antigo da Groner): atualizar a proposta e chamar no WhatsApp`, ref: o.id, quando: new Date().toISOString(), topo: true }); toast(`${o.nome} voltou para o funil`); arquivoPag(); }; });
        caixa.querySelectorAll('a[href^="#lead-"]').forEach((a) => { const o = gr.find((x) => a.getAttribute('href') === '#lead-' + x.id); if (o) a.onclick = () => { B.trazer(o); }; });
        caixa.querySelectorAll('[data-del]').forEach((b) => b.remove());
      }).catch(() => caixa.remove());
    }
    app.querySelectorAll('[data-rest]').forEach((b) => b.onclick = () => { const o = B.obter(b.dataset.rest); if (!o) return; delete o.apagado; delete o.apagadoEm; B.salvar(o); toast(`${o.nome} restaurado`); arquivoPag(); });
    app.querySelectorAll('[data-devez]').forEach((b) => b.onclick = async () => { const o = B.obter(b.dataset.devez); if (!o || !confirm(`Excluir de vez ${o.nome} (${o.id})? Não dá para desfazer.`)) return; try { await B.excluirDeVez(o.id); toast('Excluído de vez'); } catch (e) { toast('Não consegui excluir: ' + e.message); } arquivoPag(); });
    if ($('#lxTudo')) $('#lxTudo').onclick = async () => { const lx = B.lixeira().filter((o) => !['servico', 'manutencao', 'ampliacao'].includes(o.tipo)); if (!confirm(`Excluir de vez ${lx.length} proposta(s) da lixeira? Não dá para desfazer.`)) return; for (const o of lx) { try { await B.excluirDeVez(o.id); } catch { /* segue */ } } toast('Lixeira esvaziada'); arquivoPag(); };
    app.querySelectorAll('[data-reativar]').forEach((b) => b.onclick = () => { const o = B.obter(b.dataset.reativar); if (!o) return;
      o.arquivado = false; o.retomadoEm = new Date().toISOString(); o.atualizadoEm = o.retomadoEm; if (o.status === 'perdido' || o.status === 'novo') o.status = 'negociando'; B.salvar(o);
      novoLembrete({ texto: `Retomar ${o.nome}: atualizar o preço e chamar no WhatsApp`, ref: o.id, quando: new Date().toISOString(), topo: true }); toast(`${o.nome} voltou para o funil`); arquivoPag(); });
  }
  /* ampliação a partir de um cliente: puxa o sistema que ele já tem */
  function ampDe(o, de) {
    let op = null; try { op = C.opcoes(de, P())[0]; } catch { /* sem dados */ }
    const k = (de.kitsFechados || []).find(Boolean), d = op && op.dim;
    Object.assign(o, { nome: de.nome || '', whatsapp: de.whatsapp || de.telefone || '', cidade: de.cidade || o.cidade, distanciaKm: ((D.cidades || {})[de.cidade] || {}).km || o.distanciaKm, clienteDe: de.id });
    Object.assign(o.amp, { placasAtuais: (d && d.placas) || 0, potPlacaAtualW: (op && op.modulo && op.modulo.potenciaW) || 550, kwpAtual: (d && d.kwpReal) || 0, kwInversor: (op && op.inversor && op.inversor.potenciaKw * (op.inversor.qtd || 1)) || 0, marcaInversor: (k && typeof k.inversor === 'string' && k.inversor) || (op && op.inversor && op.inversor.nome) || '', consumoAtual: (d && d.consumoMedio) || Math.round(((de.consumos || []).map(Number).filter((v) => v > 0).reduce((a, b, _, l) => a + b / l.length, 0))) || 0, antes2023: new Date(de.criadoEm || Date.now()) < new Date('2023-01-07') });
  }
  function servicoEd(arg) {
    let o;
    if (arg.startsWith('novo-')) { const tp = arg.slice(5).split('-')[0]; o = AV().novo(['manutencao', 'ampliacao'].includes(tp) ? tp : 'servico', P()); const de = arg.split('-de-')[1] && B.obter(arg.split('-de-')[1]); if (de && o.tipo === 'ampliacao') ampDe(o, de); if (de && o.tipo === 'manutencao') { let op = null; try { op = C.opcoes(de, P())[0]; } catch { /* */ } Object.assign(o, { nome: de.nome || '', whatsapp: de.whatsapp || '', cidade: de.cidade || o.cidade, distanciaKm: ((D.cidades || {})[de.cidade] || {}).km || o.distanciaKm, clienteDe: de.id, placas: (op && op.dim.placas) || o.placas, kwp: (op && op.dim.kwpReal) || 0 }); } B.salvar(o); history.replaceState(null, '', '#servico-' + o.id); }
    else o = B.obter(arg);
    if (!o) { app.innerHTML = '<p class="sutil">Orçamento não encontrado.</p>'; return; }
    const M = o.tipo === 'manutencao', AMP = o.tipo === 'ampliacao', cid = Object.keys(D.cidades || {});
    const hspDe = () => ((D.cidades || {})[o.cidade] || {}).hsp || 5.3;
    const ampSinc = () => { if (!AMP) return; const a = AV().ampliar(o, hspDe()); o.ampCalc = a;
      (o.itens || []).forEach((i) => { if (i.auto === 'placas') i.qtd = a.placasNovas; });
      if (a.precisaInversor && !(o.itens || []).some((i) => i.auto === 'inversor')) o.itens.splice(1, 0, { desc: `Inversor de ${a.kwInversorSugerido} kW (troca ou segundo inversor)`, cat: 'equipamento', qtd: 1, un: 'un', custo: 0, auto: 'inversor' });
      return a; };
    const ampHtml = () => { if (!AMP) return ''; const a = ampSinc(), x = o.amp, R = x.modo === 'retrofit';
      const ca = (k, rot, extra = '') => `<label class="campo"><span>${rot}</span><input type="number" step="any" min="0" data-amp="${k}" value="${x[k] || ''}" ${extra}></label>`;
      return `<div class="painel"><div class="entre"><span class="rotulo">${R ? 'Retrofit (troca de equipamento)' : 'Ampliação'}: sistema de hoje</span>
          <div class="chips"><button class="chip ${!R ? 'sel' : ''}" data-ampmodo="ampliacao">Ampliação</button><button class="chip ${R ? 'sel' : ''}" data-ampmodo="retrofit">Retrofit</button></div></div>
        <div class="grade g2" style="margin-top:8px">${ca('placasAtuais', 'Placas instaladas hoje')}${ca('potPlacaAtualW', 'Potência de cada placa (W)')}${ca('kwpAtual', `Potência total (kWp) <small style="font-weight:400;opacity:.75">vazio = placas × W</small>`)}${ca('kwInversor', 'Inversor atual (kW)')}
          <label class="campo"><span>Marca/modelo do inversor</span><input type="text" data-ampt="marcaInversor" value="${esc(x.marcaInversor || '')}"></label>${ca('geracaoAtual', `Geração atual (kWh/mês) <small style="font-weight:400;opacity:.75">vazio = estimada</small>`)}
          ${R ? `<label class="campo"><span>Motivo do retrofit</span><input type="text" data-ampt="motivo" value="${esc(x.motivo || '')}" placeholder="ex.: inversor queimado, fora da garantia, sem monitoramento"></label>` : `${ca('consumoAtual', 'Consumo antes (kWh/mês)')}${ca('consumoNovo', 'Consumo novo (kWh/mês)', 'placeholder="ex.: com ar-condicionado, carro elétrico"')}${ca('novaPlacaW', 'Placa nova (W)')}${ca('placasNovas', `Placas novas <small style="font-weight:400;opacity:.75">vazio = calcula pelo consumo</small>`)}`}
          <label class="alternar"><span><b>Sistema ligado antes de 07/01/2023</b><br><span class="sutil">regra antiga até 2045 (Lei 14.300)</span></span><input type="checkbox" id="ampAntes" ${x.antes2023 ? 'checked' : ''}></label></div>
        <div class="numeros4" style="margin-top:10px"><div><span>Hoje</span><b>${n(a.kwpAtual, 2)} kWp</b></div><div><span>Depois</span><b>${n(a.kwpNovo, 2)} kWp</b></div><div><span>Geração</span><b>${n(a.geracaoAtual)} → ${n(a.geracaoNova)} kWh</b></div><div><span>${R ? 'Inversor/placas' : 'Placas novas'}</span><b>${R ? n(a.ratio, 2) + '×' : a.placasNovas + ' × ' + a.novaPlacaW + ' W'}</b></div></div>
        ${!R && a.precisaInversor ? `<div class="aviso" style="margin-top:8px">⚠️ Com ${n(a.kwpNovo, 2)} kWp o inversor de ${n(x.kwInversor, 1)} kW fica com ${n(a.ratio, 2)}× de carregamento (passa de 1,35×). Entrou um item de inversor de ${a.kwInversorSugerido} kW: troque ou some um segundo inversor (ou micro só nas placas novas).</div>` : ''}
        ${!R && !x.kwInversor ? '<p class="mini" style="margin-top:6px">Informe o inversor atual para conferir se ele aguenta as placas novas.</p>' : ''}
        <p class="mini" style="margin-top:8px">${R ? 'Troca com a mesma potência: comunicar a troca à distribuidora. Se aumentar a potência, vira ampliação.' : x.antes2023 ? `Regra: os ${n(a.kwpAtual, 2)} kWp de hoje seguem na regra antiga; os ${n(a.kwpExtra, 2)} kWp novos entram na regra da Lei 14.300 (paga parte do Fio B). Isso aparece na proposta.` : 'Sistema já na Lei 14.300: a ampliação segue a mesma regra.'} Precisa de projeto e pedido de aumento de potência na distribuidora.</p></div>`; };
    const campo = (k, rot, tipo = 'text', extra = '') => `<label class="campo"><span>${rot}</span><input type="${tipo}" data-av="${k}" value="${esc(o[k] ?? '')}" ${tipo === 'number' ? 'step="any" min="0"' : ''} ${extra}></label>`;
    const itensHtml = () => M ? '' : `<div class="painel"><div class="entre"><span class="rotulo">Itens (digite o custo; o preço sai com margem e imposto)</span><button class="link" data-av-add="item">＋ item</button></div>
        <div class="av-itens">${(o.itens || []).map((i, k) => `<div class="av-item"><input type="text" data-it="${k}" data-k="desc" value="${esc(i.desc)}" placeholder="Descrição (ex.: Inversor híbrido Deye 5 kW)">
          <select data-it="${k}" data-k="cat">${Object.entries(AV().CATS).map(([v, t]) => `<option value="${v}" ${i.cat === v ? 'selected' : ''}>${t}</option>`).join('')}</select>
          <input type="number" step="any" min="0" data-it="${k}" data-k="qtd" value="${i.qtd}" title="quantidade"><input type="text" data-it="${k}" data-k="un" value="${esc(i.un || '')}" placeholder="un" title="unidade">
          <input type="number" step="any" min="0" data-it="${k}" data-k="custo" value="${i.custo || ''}" placeholder="custo unit. R$"><button class="link" data-av-del="${k}" title="tirar">✕</button></div>`).join('')}</div>
        <div class="grade g2" style="margin-top:10px"><label class="campo"><span>Margem (%)<small style="display:block;font-weight:400;opacity:.75">imposto de venda ${n((P().impostoTotal ?? 0.1) * 100, 1)}% · de serviço ${n((P().impostoServico ?? 0.06) * 100, 1)}%</small></span><input type="number" step="any" min="0" data-av="margem" data-pct="1" value="${Math.round((o.margem ?? 0.2) * 1000) / 10}"></label><label class="campo"><span>O que está incluso (um por linha)</span><textarea data-av="inclui" rows="3">${esc((o.inclui || []).join('\n'))}</textarea></label></div></div>`;
    const manutHtml = () => !M ? '' : `<div class="painel"><span class="rotulo">Manutenção</span>
        <div class="grade g2" style="margin-top:8px">${campo('placas', 'Quantas placas o sistema tem', 'number')}${campo('porPlaca', 'Preço por placa (R$)', 'number')}${campo('kwp', 'Potência do sistema (kWp, opcional)', 'number')}${campo('marcaInversor', 'Inversor (marca, opcional)')}</div>
        <div class="entre" style="margin-top:10px"><span class="rotulo">O que você observou (custos extras)</span><button class="link" data-av-add="extra">＋ extra</button></div>
        <div class="av-itens">${(o.extras || []).map((x, k) => `<div class="av-item av-extra"><input type="text" data-ex="${k}" data-k="desc" value="${esc(x.desc)}" placeholder="ex.: telhado alto, precisa de andaime / troca de 2 conectores MC4"><input type="number" step="any" min="0" data-ex="${k}" data-k="valor" value="${x.valor || ''}" placeholder="R$"><button class="link" data-av-delx="${k}">✕</button></div>`).join('') || '<p class="mini">Nada a mais? Deixe vazio.</p>'}</div>
        <div class="grade g2" style="margin-top:10px"><label class="campo"><span>O que a manutenção inclui (um por linha)</span><textarea data-av="checklist" rows="5">${esc((o.checklist || []).join('\n'))}</textarea></label>
          <div><label class="alternar"><span><b>Oferecer plano recorrente</b><br><span class="sutil">limpeza periódica com desconto</span></span><input type="checkbox" id="avPlano" ${o.plano && o.plano.ativo ? 'checked' : ''}></label>
          ${o.plano && o.plano.ativo ? `<div class="grade g2" style="margin-top:8px"><label class="campo"><span>A cada (meses)</span><input type="number" min="1" data-pl="meses" value="${o.plano.meses}"></label><label class="campo"><span>Desconto (%)</span><input type="number" min="0" data-pl="desconto" value="${Math.round((o.plano.desconto || 0) * 100)}"></label></div>` : ''}</div></div></div>`;
    const resumo = () => { const c = AV().calcular(o, P());
      return `<div class="painel av-resumo"><span class="rotulo">Valor da proposta</span><div class="preco" style="font-size:34px;margin:6px 0">${brl(c.total, 2)}</div>
        ${c.linhas.map((l) => `<div class="entre mini"><span>${esc(l.desc)}${l.qtd > 1 && !M ? ` × ${n(l.qtd)}` : ''}</span><b>${brl(l.total, 2)}</b></div>`).join('')}
        ${M ? (c.plano ? `<p class="mini" style="margin-top:8px">Plano: ${brl(c.plano.porVisita, 2)} por visita, ${c.plano.visitasAno}× por ano = ${brl(c.plano.porAno, 2)}/ano</p>` : '') : `<div class="numeros4" style="margin-top:10px"><div><span>Custo</span><b>${brl(c.custo)}</b></div><div><span>Impostos</span><b>${brl(c.imposto)}</b></div><div><span>Lucro</span><b style="color:${c.lucro < 0 ? 'var(--laranja)' : 'inherit'}">${brl(c.lucro)}</b></div><div><span>Margem real</span><b>${n(c.margemReal * 100, 1)}%</b></div></div>`}
        <label class="campo" style="margin-top:10px"><span>Ajustar o preço final (opcional)</span><input type="number" step="any" min="0" data-av="precoManual" value="${o.precoManual || ''}" placeholder="${n(c.calculado, 2)}"></label>
        <p class="mini">Cartão: ${c.pagamento.parcelas}× de ${brl(c.pagamento.parcela, 2)} (${brl(c.pagamento.cartaoTotal, 2)}) · PIX ${brl(c.pagamento.pix, 2)}</p>
        <div class="acoes-r" style="margin-top:12px;flex-wrap:wrap"><button class="btn sol" id="avEnviar">📲 Enviar no WhatsApp</button><a class="btn vidro" href="${linkServico(o, true)}" target="_blank" id="avVer">👁 Ver a proposta</a><button class="btn vidro" id="avCopiar">🔗 Copiar link</button><a class="btn vidro" href="${linkServico(o, true)}&pdf=1" target="_blank">📄 PDF</a></div>
        <div class="chips" style="margin-top:10px">${Object.entries(ST_AV).map(([v, [t]]) => `<button class="chip ${o.status === v ? 'sel' : ''}" data-avst="${v}">${t}</button>`).join('')}</div>
        ${(() => { const ac = B.eventos(o.token).find((e) => e.tipo === 'aceite'); return ac ? `<div class="aviso ok" style="margin-top:8px">✓ O cliente aceitou em ${new Date(ac.em).toLocaleString('pt-BR')}: ${(ac.dados || {}).pagamento === 'cartao' ? 'cartão' : 'PIX'}${(ac.dados || {}).plano ? ', com plano' : ''}, ${brl((ac.dados || {}).valor || 0, 2)}.${o.status !== 'ganho' ? ' Toque em "Aceita ✓" abaixo para fechar.' : ''}</div>` : ''; })()}
        <p class="mini" style="margin-top:8px">${B.eventos(o.token).filter((e) => e.tipo === 'abriu').length ? `O cliente abriu a proposta ${B.eventos(o.token).filter((e) => e.tipo === 'abriu').length}×.` : 'O cliente ainda não abriu.'}</p></div>`; };
    const tela = () => {
      app.innerHTML = `${cabCelular()}<div class="cab entra"><div><a class="link" href="#servicos">← Serviços</a><h1>${M ? '🧽 Manutenção' : AMP ? '⚡ Ampliação / retrofit' : '🔧 Serviço / itens avulsos'} <span class="sutil" style="font-size:16px">${esc(o.id)}</span></h1></div>
          <div class="linha-h"><button class="btn vidro pequeno" id="avApagar">Apagar</button></div></div>
        <div class="av-grade"><div>
          <div class="painel"><span class="rotulo">Cliente</span><div class="grade g2" style="margin-top:8px">${campo('nome', 'Nome')}${campo('whatsapp', 'WhatsApp', 'tel')}
            <label class="campo"><span>Cidade</span><input type="text" data-av="cidade" list="avCid" value="${esc(o.cidade || '')}"><datalist id="avCid">${cid.map((c) => `<option value="${esc(c)}">`).join('')}</datalist></label>
            ${campo('distanciaKm', 'Distância da Chama Solar (km)', 'number')}${campo('deslocamento', `Deslocamento (R$) <small style="font-weight:400;opacity:.75">vazio = km × 2 × R$ ${n(P().custoKm || 1, 2)}</small>`, 'number')}${campo('titulo', 'Título da proposta')}</div></div>
          ${manutHtml()}${ampHtml()}${itensHtml()}
          <div class="painel"><span class="rotulo">Condições</span><div class="grade g2" style="margin-top:8px">${campo('prazo', 'Prazo')}${campo('validadeDias', 'Validade (dias)', 'number')}${campo('parcelasCartao', 'Parcelas no cartão', 'number')}
            <label class="campo"><span>Observações para o cliente</span><textarea data-av="observacoes" rows="3">${esc(o.observacoes || '')}</textarea></label></div></div>
        </div><div class="av-lado" id="avResumo">${resumo()}</div></div>`;
      ligar();
    };
    const salvar = (redesenhar) => { if (AMP) ampSinc(); B.salvar(o); clearTimeout(avDeb); if (redesenhar) tela(); else avDeb = setTimeout(() => { const r = $('#avResumo'); if (r) { r.innerHTML = resumo(); ligarResumo(); } }, 250); };
    const ligarResumo = () => {
      app.querySelectorAll('#avResumo [data-av]').forEach((x) => x.oninput = () => { o.precoManual = +x.value || null; B.salvar(o); clearTimeout(avDeb); avDeb = setTimeout(() => { const foco = document.activeElement === x; const r = $('#avResumo'); r.innerHTML = resumo(); ligarResumo(); if (foco) { const y = r.querySelector('[data-av="precoManual"]'); y.focus(); y.setSelectionRange(y.value.length, y.value.length); } }, 700); });
      $('#avCopiar').onclick = async () => { if (o.status === 'novo') { o.status = 'proposta'; o.enviadoEm = new Date().toISOString(); B.salvar(o); } try { await navigator.clipboard.writeText(linkServico(o)); toast('Link copiado'); } catch { toast(linkServico(o)); } };
      $('#avEnviar').onclick = () => { const c = AV().calcular(o, P()); if (o.status === 'novo') { o.status = 'proposta'; o.enviadoEm = new Date().toISOString(); } B.salvar(o);
        const txt = `Olá, ${(o.nome || '').split(' ')[0] || 'tudo bem'}! Aqui é o Victor, da Chama Solar. Preparei a proposta de ${M ? 'manutenção do seu sistema solar' : (o.titulo || 'serviço').toLowerCase()}: ${brl(c.total, 2)}. Está tudo explicado neste link, é só abrir: ${linkServico(o)}`;
        const tel = String(o.whatsapp || '').replace(/\D/g, '').replace(/^55/, ''); window.open('https://wa.me/' + (tel ? '55' + tel : '') + '?text=' + encodeURIComponent(txt), '_blank', 'noopener'); B.interacao && B.interacao(o.id, 'whatsapp', 'Proposta de serviço enviada'); };
      app.querySelectorAll('[data-avst]').forEach((b) => b.onclick = () => { o.status = b.dataset.avst; if (o.status === 'proposta' && !o.enviadoEm) o.enviadoEm = new Date().toISOString(); salvar(true); });
    };
    const ligar = () => {
      app.querySelectorAll('[data-amp]').forEach((x) => x.onchange = () => { o.amp[x.dataset.amp] = x.value === '' ? 0 : +x.value; ampSinc(); salvar(true); });
      app.querySelectorAll('[data-ampt]').forEach((x) => x.oninput = () => { o.amp[x.dataset.ampt] = x.value; salvar(); });
      if ($('#ampAntes')) $('#ampAntes').onchange = (e) => { o.amp.antes2023 = e.target.checked; salvar(true); };
      app.querySelectorAll('[data-ampmodo]').forEach((b) => b.onclick = () => { const m = b.dataset.ampmodo; if (o.amp.modo === m) return; o.amp.modo = m;
        if ((o.itens || []).every((i) => !+i.custo)) { const nv = AV().novo('ampliacao', P()); o.itens = m === 'retrofit' ? [{ desc: 'Inversor novo', cat: 'equipamento', qtd: 1, un: 'un', custo: 0 }, { desc: 'Materiais CA/CC e proteções', cat: 'material', qtd: 1, un: 'kit', custo: 0 }, { desc: 'Mão de obra: retirada, troca e configuração', cat: 'mao', qtd: 1, un: '', custo: 0 }, { desc: 'Comunicação da troca à distribuidora', cat: 'mao', qtd: 1, un: '', custo: 0 }] : nv.itens;
          o.inclui = m === 'retrofit' ? ['Retirada do equipamento antigo', 'Instalação e configuração do equipamento novo', 'Monitoramento no celular', 'Comunicação da troca à distribuidora', 'Garantia do serviço de 12 meses'] : nv.inclui; }
        o.titulo = m === 'retrofit' ? 'Retrofit do sistema solar' : 'Ampliação do sistema solar'; ampSinc(); salvar(true); });
      app.querySelectorAll('.av-grade > div:first-child [data-av]').forEach((x) => x.oninput = () => { const k = x.dataset.av; let v = x.value;
        if (k === 'inclui' || k === 'checklist') v = v.split('\n').map((t) => t.trim()).filter(Boolean);
        else if (x.type === 'number') v = x.value === '' ? (k === 'deslocamento' ? null : 0) : +x.value;
        if (x.dataset.pct) v = (+x.value || 0) / 100;
        if (k === 'cidade' && D.cidades && D.cidades[x.value]) { o.distanciaKm = D.cidades[x.value].km; const dk = app.querySelector('[data-av="distanciaKm"]'); if (dk) dk.value = o.distanciaKm; }
        o[k] = v; salvar(); });
      app.querySelectorAll('[data-it]').forEach((x) => { const ev = x.tagName === 'SELECT' ? 'onchange' : 'oninput'; x[ev] = () => { const i = o.itens[+x.dataset.it]; i[x.dataset.k] = x.type === 'number' ? +x.value || 0 : x.value; salvar(); }; });
      app.querySelectorAll('[data-ex]').forEach((x) => x.oninput = () => { const e = o.extras[+x.dataset.ex]; e[x.dataset.k] = x.type === 'number' ? +x.value || 0 : x.value; salvar(); });
      app.querySelectorAll('[data-av-add]').forEach((b) => b.onclick = () => { if (b.dataset.avAdd === 'item') o.itens.push({ desc: '', cat: 'material', qtd: 1, un: 'un', custo: 0 }); else (o.extras = o.extras || []).push({ desc: '', valor: 0 }); salvar(true); });
      app.querySelectorAll('[data-av-del]').forEach((b) => b.onclick = () => { o.itens.splice(+b.dataset.avDel, 1); salvar(true); });
      app.querySelectorAll('[data-av-delx]').forEach((b) => b.onclick = () => { o.extras.splice(+b.dataset.avDelx, 1); salvar(true); });
      const pl = $('#avPlano'); if (pl) pl.onchange = () => { o.plano = { ...(o.plano || { meses: 6, desconto: 0.1 }), ativo: pl.checked }; salvar(true); };
      app.querySelectorAll('[data-pl]').forEach((x) => x.oninput = () => { o.plano[x.dataset.pl] = x.dataset.pl === 'desconto' ? (+x.value || 0) / 100 : +x.value || 6; salvar(); });
      $('#avApagar').onclick = (ev) => { const b = ev.currentTarget; if (!b.dataset.c) { b.dataset.c = 1; b.textContent = 'Tocar de novo para apagar'; return; } o.status = 'perdido'; o.apagado = true; B.salvar(o); location.hash = '#servicos'; };
      ligarResumo();
    };
    tela();
  }

  /* ======================= JARVIS (voz) E LEMBRETES ======================= */
  const lembretes = () => (P().lembretes || []).filter((l) => l && !l.feito);
  function novoLembrete(l) { const lista = P().lembretes || []; lista.push({ id: 'L' + Date.now().toString(36), criado: new Date().toISOString(), ...l }); B.salvarParametros({ lembretes: lista.slice(-200) }); }
  function lembreteFeito(id) { const lista = (P().lembretes || []).map((l) => (l.id === id ? { ...l, feito: new Date().toISOString() } : l)); B.salvarParametros({ lembretes: lista.filter((l) => !l.feito || Date.now() - new Date(l.feito) < 30 * 864e5) }); }
  function jarvis() {
    const J = window.Jarvis, ov = document.createElement('div'); ov.className = 'modal-rapida jarvis-ov';
    ov.innerHTML = `<div class="painel jarvis"><div class="entre"><span class="rotulo" style="color:var(--sol)">🎙 Jarvis</span><button class="link" data-fechar>fechar</button></div>
      <p class="sutil" style="margin:6px 0 10px">Fale ou digite. Ex.: "crie uma proposta de 500 kWh para o cliente João Silva, telhado cerâmico em Ribeirão Preto, as 2 opções, e me deixa um lembrete para completar os dados".</p>
      <div class="jarvis-mic"><button class="btn sol" id="jvFalar">🎙 Falar</button><span class="mini" id="jvSt">${'webkitSpeechRecognition' in window || 'SpeechRecognition' in window ? 'toque e fale' : 'este navegador não tem voz: digite abaixo'}</span></div>
      <textarea id="jvTxt" rows="3" placeholder="ou digite o pedido aqui"></textarea>
      <div class="acoes-r" style="margin-top:8px"><button class="btn vidro" id="jvEnt">Entender</button></div><div id="jvRes"></div></div>`;
    document.body.appendChild(ov);
    const fechar = () => ov.remove(); ov.onclick = (e) => { if (e.target === ov || e.target.closest('[data-fechar]')) fechar(); };
    const R = window.SpeechRecognition || window.webkitSpeechRecognition; let rec = null;
    $('#jvFalar', ov).onclick = () => {
      if (!R) { toast('Digite o pedido: a voz funciona no Chrome e no Edge'); return; }
      if (rec) { rec.stop(); return; }
      rec = new R(); rec.lang = 'pt-BR'; rec.interimResults = true; rec.continuous = true; let final = '';
      rec.onresult = (e) => { let parcial = ''; for (let i = e.resultIndex; i < e.results.length; i++) { if (e.results[i].isFinal) final += e.results[i][0].transcript + ' '; else parcial += e.results[i][0].transcript; } $('#jvTxt', ov).value = (final + parcial).trim(); };
      rec.onend = () => { rec = null; $('#jvFalar', ov).textContent = '🎙 Falar'; $('#jvSt', ov).textContent = 'toque e fale'; if ($('#jvTxt', ov).value.trim()) entender(); };
      rec.onerror = (e) => { $('#jvSt', ov).textContent = e.error === 'not-allowed' ? 'libere o microfone no navegador' : 'não ouvi: tente de novo'; };
      rec.start(); $('#jvFalar', ov).textContent = '⏹ Parar'; $('#jvSt', ov).textContent = 'ouvindo… toque em Parar quando terminar';
    };
    const entender = () => {
      const r = J.entender($('#jvTxt', ov).value, { cidades: D.cidades }), linha = (k, v) => `<div class="entre mini"><span>${k}</span><b>${v ? esc(String(v)) : '<span style="color:var(--laranja)">não entendi</span>'}</b></div>`;
      const box = $('#jvRes', ov); if (r.acao === 'nada') { box.innerHTML = '<div class="aviso ruim" style="margin-top:10px">Não entendi o pedido. Comece com "crie uma proposta…", "manutenção de…" ou "me lembra…".</div>'; return; }
      const TEL = { ceramico: 'Cerâmico', fibrocimento: 'Fibrocimento', metalico: 'Metálico', laje: 'Laje', solo: 'Solo' };
      box.innerHTML = `<div class="painel" style="margin-top:10px"><span class="rotulo">Entendi assim (confira)</span>
        ${r.acao === 'proposta' ? linha('Criar', r.grupoA ? 'orçamento Grupo A' : 'orçamento solar') + linha('Cliente', r.nome) + linha('Geração / consumo', r.kwh ? n(r.kwh) + ' kWh por mês' : '') + linha('Telhado', TEL[r.telhado] || '') + linha('Cidade', r.cidade) + linha('Opções', { ambos: 'inversor e micro', inversor: 'só inversor', micro: 'só micro' }[r.opcoes]) : ''}
        ${r.acao === 'manutencao' ? linha('Criar', 'proposta de manutenção') + linha('Cliente', r.nome) + linha('Placas', r.placas) + linha('Cidade', r.cidade) : ''}
        ${r.lembrete ? linha('Lembrete no Meu dia', r.lembrete + (r.quando ? ' · ' + new Date(r.quando).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '')) : ''}
        <div class="acoes-r" style="margin-top:10px"><button class="btn sol" id="jvOk">✓ Confirmar</button><button class="link" id="jvNao">corrigir o texto</button></div></div>`;
      $('#jvNao', ov).onclick = () => { box.innerHTML = ''; $('#jvTxt', ov).focus(); };
      $('#jvOk', ov).onclick = () => { const fim = executar(r); fechar(); if (fim) location.hash = fim; };
    };
    $('#jvEnt', ov).onclick = entender;
    $('#jvTxt', ov).onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); entender(); } };
  }
  /* como separar a estrutura no portal: o que o vendedor escolheu, senão as fileiras do 3D, senão automático */
  function arranjoDoOrc(o) {
    const p3 = o.projeto3d && o.projeto3d.versao === 2 && o.projeto3d.resultado && Array.isArray(o.projeto3d.resultado.arranjo) ? o.projeto3d.resultado.arranjo : null;
    const fil = p3 ? p3.flatMap((a) => a.fileiras || []) : [], tot = fil.reduce((x, y) => x + y, 0);
    const pais = p3 ? p3.filter((a) => a.ori === 'paisagem').reduce((t, a) => t + (a.fileiras || []).reduce((x, y) => x + y, 0), 0) : 0;
    const m = o.arranjoBel || {};
    return { linhas: +m.linhas || null, orientacao: m.ori || (tot && pais * 2 > tot ? 'paisagem' : 'retrato'), fileiras: m.linhas ? null : fil, aguas: p3 ? new Set(p3.map((a) => a.agua)).size : 0, fonte: m.linhas ? 'manual' : fil.length ? '3d' : 'auto' };
  }
  /* pedido para o robô do escritório (mesmo do passo 4): potência pela estimativa, uma linha por opção */
  function pedidoRobo(o) {
    let est = null; try { est = C.opcoes(o, P())[0]; } catch { /* sem consumo */ } const kwp = +o.kwpAlvo > 0 ? +(+o.kwpAlvo).toFixed(2) : est ? +est.dim.kwpNecessario.toFixed(2) : 0, quais = o.cotarQuais || 'ambos';
    const base = { salvar: true, kwp, ligacao: { mono: 'MONOFÁSICO', bi: 'BIFÁSICO', tri: 'TRIFÁSICO' }[o.ligacao] || 'BIFÁSICO', cidade: o.cidade || 'Ribeirão Preto', frete: P().freteRobo || 'Belenus Entrega no Cliente',
      estruturaTipo: TIPO_ESTR[o.telhado], fixacao: FIXACAO[o.telhado] ? o.fixacao || FIXACAO[o.telhado][0][0] : null, arranjo: arranjoDoOrc(o), grupoA: o.grupo === 'A',
      // o robô do escritório não lê os Parâmetros: vão junto no pedido (escolha do módulo e do inversor)
      custoPorPlaca: +P().maoDeObraPorPlaca || 0, regras: { overloadMin: P().roboOverloadMin, overloadMax: P().roboOverloadMax, modMinW: P().roboModMinW } };
    return { base, opcoes: NIVEIS_KIT.map((nivel, i) => ({ nivel, tipoInversor: TIPO_POR_OPCAO[i], nome: `${o.id} ${o.nome} ${nivel}` })).filter((x, i) => quais === 'ambos' || (quais === 'inversor' ? i === 0 : i === 1)) };
  }
  /* pré-proposta: o mesmo pedido, com o tamanho fixo */
  function pedidoPre(x) {
    const o = { id: 'PRE', nome: `${x.kwp} kWp`, telhado: x.telhado, fixacao: x.fixacao || undefined, ligacao: x.ligacao, cidade: 'Ribeirão Preto', cotarQuais: 'ambos' };
    const ped = pedidoRobo(Object.assign(o, { _kwp: x.kwp })); ped.base.kwp = +x.kwp; ped.base.salvar = false; ped.opcoes.forEach((op) => { op.nome = `PRE ${x.kwp} kWp ${x.telhado}${x.fixacao ? ' ' + x.fixacao : ''} ${op.nivel}`; }); return ped;
  }
  /* tamanhos mais vendidos (orçamentos ganhos), arredondados de 0,5 em 0,5 kWp */
  function maisVendidas() {
    const cont = {};
    B.orcamentos().filter((o) => o.status === 'ganho').forEach((o) => { let kwp = 0; try { kwp = C.opcoes(o, P())[0].dim.kwpNecessario; } catch { /* sem consumo */ } if (!(kwp > 0)) return;
      const k = `${Math.round(kwp * 2) / 2}|${o.ligacao || 'bi'}`; cont[k] = (cont[k] || 0) + 1; });
    const top = Object.entries(cont).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k]) => { const [kwp, ligacao] = k.split('|'); return { kwp: +kwp, ligacao }; });
    return top.length >= 3 ? top.sort((a, b) => a.kwp - b.kwp) : [3, 4.5, 6, 8, 10].map((kwp) => ({ kwp, ligacao: 'bi' }));
  }
  /* a pré-proposta mais recente de cada tamanho (até 3 dias) */
  function prePropostasProntas(fila) {
    const vistos = new Set();
    return (fila || []).filter((j) => j.tipo === 'pre' && j.status === 'feito' && j.resultado && (j.resultado.kits || []).length && Date.now() - new Date(j.atualizado || j.criado) < 3 * 864e5)
      .sort((a, b) => new Date(b.atualizado || b.criado) - new Date(a.atualizado || a.criado)).filter((j) => { const k = j.pedido.rotulo || j.pedido.base.kwp; if (vistos.has(k)) return false; vistos.add(k); return true; });
  }
  /* proposta do Jarvis: se houver pré-proposta parecida, o preço entra já (o robô ainda cota o exato) */
  async function usarPre(o) {
    let fila = []; try { fila = (await B.filaRoboLer()) || []; } catch { return null; }
    const alvo = pedidoRobo(o).base; if (!(alvo.kwp > 0)) return null;
    const cand = prePropostasProntas(fila).filter((j) => j.pedido.base.estruturaTipo === alvo.estruturaTipo && (j.pedido.base.fixacao || null) === (alvo.fixacao || null)).map((j) => ({ j, d: Math.abs(j.pedido.base.kwp - alvo.kwp) / alvo.kwp + (j.pedido.base.ligacao === alvo.ligacao ? 0 : 0.03) })).filter((x) => x.d <= 0.1).sort((a, b) => a.d - b.d)[0];
    if (!cand) return null;
    o.kitsFechados = o.kitsFechados || [null, null];
    (cand.j.resultado.kits || []).forEach((k) => { const i = NIVEIS_KIT.indexOf(k.nivel); if (i >= 0 && k.valorKit > 0 && !(o.kitsFechados[i] && !o.kitsFechados[i].pre)) o.kitsFechados[i] = { ...k, pre: true, preKwp: cand.j.pedido.base.kwp }; });
    B.salvar(o); return cand.j.pedido.base.kwp;
  }
  /* o robô do escritório avisa o sistema a cada minuto; daqui sai o "ligado / desligado" */
  async function roboEstado() {
    let st = null, fila = []; try { st = await B.roboStatus(); } catch { /* sem acesso */ } try { fila = (await B.filaRoboLer()) || []; } catch { /* */ }
    const pend = fila.filter((x) => x.status === 'pendente'), velho = pend.length ? Math.round((Date.now() - new Date(pend[pend.length - 1].criado)) / 60000) : 0;
    if (!st || !st.visto) return { ok: false, html: `⚠️ <b>O robô nunca se conectou à fila.</b> Na pasta do robô precisa ter o arquivo robo-config.json (botão abaixo) e a versão ${esc((window.Cotador && Cotador.ROBO_ESPERADO) || 'nova')} aberta pelo INICIAR-COTADOR.bat.${pend.length ? ` ${pend.length} pedido(s) esperando.` : ''}` };
    const min = Math.round((Date.now() - new Date(st.visto)) / 60000), atual = !(window.Cotador && Cotador.ROBO_ESPERADO) || st.versao === Cotador.ROBO_ESPERADO;
    if (min > 5) return { ok: false, pend: pend.length, html: `⚠️ <b>Robô desligado</b>: visto pela última vez ${min < 120 ? `há ${min} min` : new Date(st.visto).toLocaleString('pt-BR')} em ${esc(st.maquina || 'computador')}.${pend.length ? ` ${pend.length} pedido(s) esperando há ${velho} min.` : ''} Abra o INICIAR-COTADOR.bat.` };
    return { ok: atual && st.logado !== false, pend: pend.length, html: `${atual && st.logado !== false ? '✓' : '⚠️'} <b>Robô ligado</b> em ${esc(st.maquina || 'computador')} · versão ${esc(st.versao || '?')}${atual ? '' : ` (a atual é ${esc(Cotador.ROBO_ESPERADO)}: baixe a nova)`} · ${st.logado ? 'Belenergy conectada' : st.logado === false ? '<b>faça login na Belenergy na janela do robô</b>' : 'navegador ainda abrindo'}${pend.length ? ` · ${pend.length} na fila` : ''}` };
  }
  async function mandarParaRobo(o) {
    try { await B.filaRobo({ orc_codigo: o.id, tipo: 'cotar', pedido: pedidoRobo(o) }); o.aguardandoRobo = new Date().toISOString(); B.salvar(o); return true; }
    catch (e) { toast('Não consegui mandar para o robô: ' + e.message); return false; }
  }
  /* o que o robô devolveu entra no orçamento sozinho (preço real, WEB) e vira lembrete para revisar e enviar */
  let filaLida = 0;
  let avisouRobo = false;
  async function recotarVencidas() {
    const hoje = new Date().toISOString().slice(0, 10); let ult = ''; try { ult = localStorage.getItem('sol_recotou') || ''; } catch { /* */ }
    if (ult === hoje || !B.nuvem) return; try { localStorage.setItem('sol_recotou', hoje); } catch { /* */ }
    let st = null; try { st = await B.roboStatus(); } catch { return; } if (!st || !st.visto || Date.now() - new Date(st.visto) > 3 * 864e5) return; // robô parado há dias: não enche a fila
    const lim = +P().validadeKitDias || 7; let n0 = 0;
    for (const o of B.orcamentos().filter((x) => ABERTOS.includes(x.status || 'novo') && !x.aguardandoRobo)) {
      const ks = (o.kitsFechados || []).filter(Boolean); if (!ks.length || n0 >= 10) continue;
      if (!ks.some((k) => k.origem === 'conectado' && k.cotadoEm && (Date.now() - new Date(k.cotadoEm)) / 864e5 > lim)) continue;
      const ped = pedidoRobo(o); if (!(ped.base.kwp > 0)) continue; ped.base.salvar = false;
      try { await B.filaRobo({ orc_codigo: o.id, tipo: 'cotar', pedido: ped }); o.aguardandoRobo = new Date().toISOString(); B.salvar(o); n0++; } catch { break; }
    }
    if (n0) toast(`${n0} proposta(s) com preço vencido foram para o robô recotar`);
  }
  async function aplicarFila(forcar) {
    if (!forcar && Date.now() - filaLida < 60000) return; filaLida = Date.now();
    recotarVencidas().catch(() => {});
    let fila = []; try { fila = (await B.filaRoboLer()) || []; } catch { return; }
    if (!avisouRobo && fila.some((x) => x.status === 'pendente' && x.tipo !== 'pre' && Date.now() - new Date(x.criado) > 15 * 60000)) roboEstado().then((st) => { if (!st.ok && /desligado|nunca/.test(st.html)) { avisouRobo = true; toast('O robô do escritório está desligado: tem pedido do Jarvis esperando. Veja em Parâmetros → Robô do escritório.'); } });
    let mudou = 0;
    for (const j of fila.filter((x) => x.status === 'feito' && x.resultado && !x.resultado.aplicado && x.orc_codigo)) {
      const o = B.obter(j.orc_codigo); if (!o) continue;
      o.kitsFechados = o.kitsFechados || [null, null];
      (j.resultado.kits || []).forEach((k) => { const i = NIVEIS_KIT.indexOf(k.nivel); if (i >= 0 && k.valorKit > 0) o.kitsFechados[i] = k; });
      o.aguardandoRobo = null; B.salvar(o); mudou++;
      novoLembrete({ texto: `Preço real chegou (Belenergy${(j.resultado.kits || []).map((k) => ' ' + (k.numeroBelenergy || '')).join(',')}): revisar e enviar a proposta de ${o.nome}`, ref: o.id, quando: new Date().toISOString(), topo: true });
      await B.filaRoboMarcar(j.id, { resultado: { ...j.resultado, aplicado: new Date().toISOString() } }).catch(() => {});
    }
    for (const j of fila.filter((x) => x.status === 'erro' && !(x.resultado && x.resultado.avisado) && x.orc_codigo)) {
      const o = B.obter(j.orc_codigo); if (o) { o.aguardandoRobo = null; B.salvar(o); }
      novoLembrete({ texto: `O robô não conseguiu cotar ${o ? o.nome : j.orc_codigo}: ${String(j.erro || '').slice(0, 120)}. Cote pelo passo 4.`, ref: j.orc_codigo, quando: new Date().toISOString(), topo: true });
      await B.filaRoboMarcar(j.id, { resultado: { ...(j.resultado || {}), avisado: true } }).catch(() => {});
    }
    if (mudou) toast(`O robô trouxe o preço real de ${mudou} orçamento(s)`);
  }
  setInterval(() => aplicarFila(), 120000); setTimeout(() => aplicarFila(true), 3000);
  function executar(r) {
    const cid = r.cidade && D.cidades[r.cidade] ? D.cidades[r.cidade] : null;
    if (r.acao === 'proposta') {
      const o = { ...novoOrc(), nome: r.nome || 'Cliente (Jarvis)', cidade: r.cidade || '', distanciaKm: cid ? cid.km : 0, telhado: r.telhado || 'ceramico', consumos: Array(12).fill(r.kwh || ''), origem: 'Jarvis', cotarQuais: r.opcoes || 'ambos', modo: 'media', criadoPorVoz: r.texto };
      if (r.grupoA && window.GrupoA) { o.grupo = 'A'; o.segmento = 'grandes'; o.ligacao = 'tri'; o.grupoA = GrupoA.novo(); o.grupoA.consumoFP = Array(12).fill(r.kwh || ''); }
      B.salvar(o); novoLembrete({ texto: (r.lembrete || 'Completar o orçamento') + ` · ${o.nome}`, ref: o.id, quando: new Date().toISOString(), topo: true });
      if (r.kwh) usarPre(o).then((pk) => mandarParaRobo(o).then((ok) => { if (ok) toast(pk ? `Orçamento ${o.id} criado com o preço da pré-proposta de ${pk} kWp. O robô vai cotar o tamanho exato.` : `Orçamento ${o.id} criado. O robô do escritório vai cotar na Belenergy e o preço real entra sozinho.`); }));
      else toast(`Orçamento ${o.id} criado para ${o.nome}. Lembrete no topo do Meu dia.`);
      return '#dia';
    }
    if (r.acao === 'manutencao') {
      const o = { ...AV().novo('manutencao', P()), nome: r.nome || '', cidade: r.cidade || 'Ribeirão Preto', distanciaKm: cid ? cid.km : 12, placas: r.placas || 0, criadoPorVoz: r.texto }; B.salvar(o);
      if (r.lembrete) novoLembrete({ texto: r.lembrete + ` · ${o.nome}`, ref: o.id, quando: new Date().toISOString(), topo: true });
      toast(`Manutenção ${o.id} criada`); return '#servico-' + o.id;
    }
    if (r.acao === 'lembrete') { novoLembrete({ texto: r.lembrete, quando: r.quando }); toast('Lembrete guardado no Meu dia'); return '#dia'; }
    return null;
  }
  /* abre um orçamento criado por voz para completar */
  function abrirParaCompletar(id) { const o = B.obter(id); if (!o) return; if (/^SRV-/.test(id)) { location.hash = '#servico-' + id; return; } B.rascunho.gravar(o); B.rascunho.gravarEtapa(0); location.hash = '#novo'; }
  document.addEventListener('click', (e) => {
    if (e.target.closest('#jarvisBt')) { jarvis(); return; }
    const f = e.target.closest('[data-lfeito]'); if (f) { lembreteFeito(f.dataset.lfeito); toast('Feito ✓'); render(); return; }
    const ab = e.target.closest('[data-labrir]'); if (ab) abrirParaCompletar(ab.dataset.labrir);
  });
  if (!$('#jarvisBt')) { const bt = document.createElement('button'); bt.id = 'jarvisBt'; bt.className = 'jarvis-bt'; bt.title = 'Jarvis: peça por voz'; bt.setAttribute('aria-label', 'Jarvis, comando de voz'); bt.textContent = '🎙'; document.body.appendChild(bt); }

  /* ======================= ROTAS ======================= */
  function render() {
    const h = location.hash.slice(1) || 'dia';
    const [rota, arg] = h.startsWith('lead-') ? ['lead', h.slice(5)] : h.startsWith('servico-') ? ['servico', h.slice(8)] : [h, null];
    document.querySelectorAll('[data-rota]').forEach((a) => a.classList.toggle('ativo', a.dataset.rota === (rota === 'lead' ? 'painel' : rota === 'servico' ? 'servicos' : rota)));
    try { const at = document.querySelector('.nav a.ativo'); if (at && innerWidth < 900) at.scrollIntoView({ block: 'nearest', inline: 'center' }); } catch { /* */ }
    if (rota !== 'novo') { document.body.classList.remove('com-barra'); $('#barra').hidden = true; }
    const ir = () => { if (rota === 'novo') { orc = B.rascunho.ler() || novoOrc(); etapa = B.rascunho.etapa(); novo(); } else if (rota === 'lead') ficha(arg); else if (rota === 'agentes') agentesPag(); else if (rota === 'catalogo') catalogoPag(); else if (rota === 'usinas') usinasPag(); else if (rota === 'treino') treinoPag(); else if (rota === 'dia') { diaPag(); setTimeout(avisoEspaco, 1200); } else if (rota === 'servicos') servicosPag(); else if (rota === 'clientes') clientesPag(); else if (rota === 'parceiros') parceirosPag(); else if (rota === 'radar') radarPag(); else if (rota === 'arquivo') arquivoPag(); else if (rota === 'vendas') vendasPag(); else if (rota === 'servico') servicoEd(arg); else if (rota === 'parametros') { faixasMg = null; faixasEng = null; parametrosPag(); } else painel(); };
    if (document.startViewTransition) {
      // erro dentro da animação some calado: mostra para o vendedor e deixa no console
      const t = document.startViewTransition(() => { try { ir(); } catch (e) { console.error(e); toast('Algo falhou nesta tela: ' + e.message); } });
      [t.ready, t.finished, t.updateCallbackDone].forEach((pr) => pr && pr.catch(() => {})); // navegação rápida cancela a animação, sem problema
    } else ir();
    scrollTo(0, 0);
  }
  $('#resetar').onclick = () => { B.zerarTudo(); B.semear(true); toast('Dados de teste recriados'); render(); };
  addEventListener('hashchange', render);
  document.addEventListener('click', (e) => { if (e.target.closest('#rapida')) respostaRapida(); });
  document.addEventListener('click', (e) => {
    if (e.target.closest('#ativarAvisos')) { Notification.requestPermission().then(() => render()); return; }
    const bt = e.target.closest('[data-cad]'); if (!bt) return;
    const o = B.obter(bt.dataset.id); if (!o) return;
    const passo = Object.values(Cadencia.PASSOS).flat().find((x) => x.id === bt.dataset.passo);
    if (bt.dataset.cad === 'zap') {
      const a = C.analisar(o, P()), ab = window.Abordagens ? Abordagens.variantes(passo.id, o, { a, link: linkProposta(o) })[0] : null;
      const txt = (ab && ab.texto.replace(/^\[ÁUDIO[^\]]*\]\s*/, '')) || Cadencia.mensagem(passo, o, { a, link: linkProposta(o) });
      window.open('https://wa.me/55' + String(o.whatsapp).replace(/\D/g, '').replace(/^55/, '') + '?text=' + encodeURIComponent(txt), '_blank', 'noopener');
      B.interacao(o.id, 'whatsapp', `Cadência ${passo.id} · ${passo.titulo}`);
      if (passo.id === 'P0' && o.status === 'novo') { o.status = 'proposta'; o.enviadoEm = new Date().toISOString(); B.salvar(o); }
    } else B.interacao(o.id, bt.dataset.cad === 'lig' ? 'ligacao' : 'nota', `Cadência ${passo.id} · ${bt.dataset.cad === 'lig' ? passo.titulo : 'pulado'}`);
    toast(bt.dataset.cad === 'ok' ? 'Passo pulado' : 'Registrado. Próximo passo agendado.'); render();
  });
  // atualiza o painel/ficha quando o cliente mexe na proposta em outra aba
  addEventListener('storage', (e) => { if (e.key === 'sol2_eventos' && /^#(painel|lead)|^$/.test(location.hash)) render(); });
  render();
})();
