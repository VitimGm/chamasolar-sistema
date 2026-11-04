/* =====================================================================
   Chama Solar — telas do orçamento (TESTE, banco simulado no navegador)
   ===================================================================== */
(function () {
  'use strict';
  const D = window.DadosTeste, M = window.Motor;
  const $ = (s, r = document) => r.querySelector(s);
  const app = $('#app');

  /* ---------- Banco simulado (localStorage) ---------- */
  const Banco = {
    ler(chave, padrao) { try { const v = localStorage.getItem('sol_' + chave); return v ? JSON.parse(v) : padrao; } catch { return padrao; } },
    gravar(chave, valor) { try { localStorage.setItem('sol_' + chave, JSON.stringify(valor)); } catch { /* sem armazenamento */ } },
  };
  const clonar = (o) => JSON.parse(JSON.stringify(o, (k, v) => (v === Infinity ? 'Inf' : v)), (k, v) => (v === 'Inf' ? Infinity : v));
  const parametros = () => Object.assign(clonar(D.parametros), Banco.ler('parametros', {}));

  /* ---------- Formatação ---------- */
  const brl = (v, c = 0) => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: c, maximumFractionDigits: c });
  const num = (v, c = 0) => (v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c });
  const pct = (v, c = 1) => num(v * 100, c) + '%';
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const NOME_SEMAFORO = { verde: 'Dentro do mercado', amarelo: 'Acima da média', vermelho: 'Caro para o mercado', neutro: 'Com bateria (não comparável)' };

  /* ---------- Estado do orçamento ---------- */
  const novoOrcamento = () => ({
    id: null, nome: '', whatsapp: '', cep: '', cidade: '', distanciaKm: 0, ligacao: 'bi',
    consumos: Array(12).fill(''), tarifaKwh: parametros().tarifaKwh, lidoPorIA: false,
    telhado: 'ceramico', orientacao: 'N', areaDisponivel: '', trocaPadrao: false,
    opcaoEscolhida: 1, formaPagamento: 'financiamento', comissaoParceria: 0, kitFaturadoDireto: false, descontoPct: 0,
  });
  let orc = Banco.ler('rascunho', null) || novoOrcamento();
  let etapa = Banco.ler('etapa', 0);
  const salvarRascunho = () => { Banco.gravar('rascunho', orc); Banco.gravar('etapa', etapa); };

  const consumoMedio = () => {
    const v = orc.consumos.map(Number).filter((x) => x > 0);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
  };
  const hsp = () => (D.cidades[orc.cidade] || D.cidades['Ribeirão Preto']).hsp;
  const entradaMotor = () => ({
    consumoMedio: consumoMedio(), ligacao: orc.ligacao, hsp: hsp(), orientacao: orc.orientacao, telhado: orc.telhado,
    distanciaKm: Number(orc.distanciaKm) || 0, trocaPadrao: orc.trocaPadrao, areaDisponivel: Number(orc.areaDisponivel) || 0,
    formaPagamento: orc.formaPagamento, comissaoParceria: Number(orc.comissaoParceria) / 100 || 0,
    kitFaturadoDireto: orc.kitFaturadoDireto, descontoPct: Number(orc.descontoPct) / 100 || 0,
  });
  const opcoes = () => {
    const p = parametros();
    const o = M.montarOpcoes({ ...entradaMotor() }, D.catalogo, { ...p, tarifaKwh: Number(orc.tarifaKwh) || p.tarifaKwh });
    o.forEach((x) => { if (x.bateria) x.preco.semaforo = 'neutro'; });
    return o;
  };

  function buscarCep(cep) {
    const d = String(cep).replace(/\D/g, '');
    if (d.length < 5) return null;
    return D.ceps.find((c) => d.startsWith(c.prefixo)) || null;
  }

  /* ---------- Etapas ---------- */
  const ETAPAS = [
    { t: 'Cliente e conta', render: etapaCliente, valida: () => orc.nome.trim() && consumoMedio() > 0 && orc.cidade ? '' : 'Preencha nome, CEP e o consumo.' },
    { t: 'Local e telhado', render: etapaLocal, valida: () => '' },
    { t: 'Dimensionamento', render: etapaDimensionamento, valida: () => '' },
    { t: 'Kits e preços', render: etapaKits, valida: () => '' },
    { t: 'Preço e pagamento', render: etapaPreco, valida: () => '' },
    { t: 'Conferir e enviar', render: etapaEnviar, valida: () => '' },
  ];

  function telaOrcamento() {
    $('#barra').hidden = false;
    const passos = ETAPAS.map((e, i) => `<button class="etapa ${i < etapa ? 'feita' : ''} ${i === etapa ? 'atual' : ''}" data-ir="${i}" ${i > etapa ? 'disabled' : ''} type="button"><span class="n">${i < etapa ? '✓' : i + 1}</span><span class="t">${e.t}</span></button>`).join('');
    app.innerHTML = `<div class="etapas">${passos}</div><div class="trilho"><i style="width:${((etapa + 1) / 6) * 100}%"></i></div>
      <div class="cab-etapa"><div class="num">PASSO ${etapa + 1} DE 6</div><h1>${ETAPAS[etapa].t}</h1></div>
      <div id="corpo"></div>`;
    app.querySelectorAll('[data-ir]').forEach((b) => b.onclick = () => { etapa = +b.dataset.ir; salvarRascunho(); render(); });
    ETAPAS[etapa].render($('#corpo'));
    atualizarBarra();
  }

  function atualizarBarra() {
    $('#btnVoltar').style.visibility = etapa === 0 ? 'hidden' : 'visible';
    $('#btnAvancar').textContent = etapa === 5 ? 'Salvar orçamento' : 'Continuar';
    const r = $('#barraResumo');
    if (etapa >= 3 && consumoMedio() > 0) {
      const o = opcoes()[orc.opcaoEscolhida];
      r.innerHTML = `<b>${brl(o.preco.precoFinal)}</b>${o.nivel} · ${num(o.dim.kwpReal, 2)} kWp`;
    } else if (consumoMedio() > 0) {
      r.innerHTML = `<b>${num(consumoMedio())} kWh/mês</b>${esc(orc.nome || 'Cliente')}`;
    } else r.innerHTML = '';
  }

  $('#btnVoltar').onclick = () => { if (etapa > 0) { etapa--; salvarRascunho(); render(); window.scrollTo(0, 0); } };
  $('#btnAvancar').onclick = () => {
    const erro = ETAPAS[etapa].valida();
    if (erro) return toast(erro);
    if (etapa === 5) return salvarOrcamento();
    etapa++; salvarRascunho(); render(); window.scrollTo(0, 0);
  };

  /* ---------- Passo 1: cliente e conta de luz ---------- */
  function etapaCliente(el) {
    const media = consumoMedio();
    el.innerHTML = `
      <div class="lado">
        <div>
          <section class="cartao ia">
            <h2>Ler a conta de luz com IA</h2>
            <p>No sistema oficial você tira foto ou envia o PDF da CPFL e a IA preenche tudo. Aqui no teste, escolha uma conta de exemplo:</p>
            <div class="soltar">📄 Arraste o PDF ou toque para fotografar <br><small>(desligado no modo teste)</small></div>
            <div class="chips">${D.contasExemplo.map((c, i) => `<button class="chip" data-conta="${i}" type="button">${esc(c.nome)}</button>`).join('')}</div>
          </section>
          <section class="cartao grade">
            <label class="campo"><span>Nome do cliente</span><input type="text" id="f-nome" value="${esc(orc.nome)}" autocomplete="name"></label>
            <div class="grade g2">
              <label class="campo"><span>WhatsApp</span><input type="tel" id="f-whatsapp" value="${esc(orc.whatsapp)}" inputmode="tel"></label>
              <label class="campo"><span>CEP da obra</span><input type="text" id="f-cep" value="${esc(orc.cep)}" inputmode="numeric"></label>
            </div>
            <div class="dica" id="cep-info">${orc.cidade ? `📍 ${esc(orc.cidade)} · ${orc.distanciaKm} km da base` : 'Teste: CEPs começando com 140/141 (Ribeirão), 1416 (Sertãozinho), 144 (Franca)…'}</div>
            <div class="campo"><span>Tipo de ligação</span>
              <div class="chips">${[['mono', 'Monofásica', '30 kWh'], ['bi', 'Bifásica', '50 kWh'], ['tri', 'Trifásica', '100 kWh']].map(([v, t, d]) => `<button type="button" class="chip ${orc.ligacao === v ? 'sel' : ''}" data-lig="${v}">${t}<small>${d}</small></button>`).join('')}</div>
            </div>
          </section>
        </div>
        <section class="cartao">
          <h3>Consumo dos últimos 12 meses (kWh)</h3>
          <div class="meses">${MESES.map((m, i) => `<label>${m}<input type="number" min="0" data-mes="${i}" value="${orc.consumos[i]}" inputmode="numeric"></label>`).join('')}</div>
          <div class="numeros" style="margin-top:12px">
            <div class="numero destaque"><span>Média mensal</span><b id="media">${num(media)}<small>kWh</small></b></div>
            <div class="numero"><span>Tarifa com impostos</span><b><input type="number" step="0.01" id="f-tarifa" value="${orc.tarifaKwh}" style="font-size:20px;font-weight:800;padding:2px 6px;width:100%"></b></div>
          </div>
          <div class="numeros" style="margin-top:10px">
            <div class="numero" style="grid-column:1/-1"><span>Conta atual estimada</span><b id="conta">${brl(media * orc.tarifaKwh)}<small>/mês</small></b></div>
          </div>
          ${orc.lidoPorIA ? '<div class="aviso ok">✓ Dados lidos da conta (simulado). Confira antes de seguir.</div>' : ''}
        </section>
      </div>`;

    const atualizarMedia = () => {
      const m = consumoMedio();
      $('#media').innerHTML = `${num(m)}<small>kWh</small>`;
      $('#conta').innerHTML = `${brl(m * orc.tarifaKwh)}<small>/mês</small>`;
      salvarRascunho(); atualizarBarra();
    };
    $('#f-nome').oninput = (e) => { orc.nome = e.target.value; salvarRascunho(); atualizarBarra(); };
    $('#f-whatsapp').oninput = (e) => { orc.whatsapp = e.target.value; salvarRascunho(); };
    $('#f-cep').oninput = (e) => {
      orc.cep = e.target.value;
      const c = buscarCep(orc.cep);
      orc.cidade = c ? c.cidade : ''; orc.distanciaKm = c ? c.km : 0;
      $('#cep-info').innerHTML = c ? `📍 ${c.cidade} · ${c.km} km da base` : 'CEP fora da tabela de teste.';
      salvarRascunho();
    };
    $('#f-tarifa').oninput = (e) => { orc.tarifaKwh = Number(e.target.value) || 0; atualizarMedia(); };
    el.querySelectorAll('[data-mes]').forEach((i) => i.oninput = () => { orc.consumos[+i.dataset.mes] = i.value; atualizarMedia(); });
    el.querySelectorAll('[data-lig]').forEach((b) => b.onclick = () => { orc.ligacao = b.dataset.lig; salvarRascunho(); render(); });
    el.querySelectorAll('[data-conta]').forEach((b) => b.onclick = () => {
      const c = D.contasExemplo[+b.dataset.conta], cep = buscarCep(c.cep);
      Object.assign(orc, { nome: c.nome, whatsapp: c.whatsapp, cep: c.cep, ligacao: c.ligacao, consumos: [...c.consumos], tarifaKwh: c.tarifaKwh, cidade: cep.cidade, distanciaKm: cep.km, lidoPorIA: true });
      salvarRascunho(); render(); toast('Conta lida (simulação)');
    });
  }

  /* ---------- Passo 2: local e telhado ---------- */
  function etapaLocal(el) {
    const p = parametros();
    const telhados = [['ceramico', 'Cerâmico'], ['fibrocimento', 'Fibrocimento'], ['metalico', 'Metálico'], ['laje', 'Laje'], ['solo', 'Solo']];
    const orient = [['N', 'Norte', 'ideal'], ['NE', 'Nordeste', '−3%'], ['NO', 'Noroeste', '−3%'], ['L', 'Leste', '−12%'], ['O', 'Oeste', '−12%'], ['S', 'Sul', '−25%']];
    el.innerHTML = `
      <div class="lado">
        <section class="cartao grade">
          <div class="campo"><span>Tipo de telhado</span><div class="chips">${telhados.map(([v, t]) => `<button type="button" class="chip ${orc.telhado === v ? 'sel' : ''}" data-tel="${v}">${t}<small>${brl(D.catalogo.estrutura[v])}/pl</small></button>`).join('')}</div></div>
          <div class="campo"><span>Para onde a água do telhado está virada</span><div class="chips">${orient.map(([v, t, d]) => `<button type="button" class="chip ${orc.orientacao === v ? 'sel' : ''}" data-ori="${v}">${t}<small>${d}</small></button>`).join('')}</div></div>
          <div class="grade g2">
            <label class="campo"><span>Área livre no telhado (m²)</span><input type="number" id="f-area" value="${esc(orc.areaDisponivel)}" placeholder="opcional" inputmode="decimal"></label>
            <label class="campo"><span>Distância da base (km)</span><input type="number" id="f-km" value="${esc(orc.distanciaKm)}" inputmode="numeric"></label>
          </div>
          <label class="alternar"><span><b>Precisa trocar o padrão de entrada?</b><br><span class="sutil">Soma ${brl(p.trocaPadrao)} ao orçamento</span></span><input type="checkbox" id="f-padrao" ${orc.trocaPadrao ? 'checked' : ''}></label>
        </section>
        <section class="cartao">
          <h3>Sol no local</h3>
          <div class="numeros">
            <div class="numero destaque"><span>${esc(orc.cidade || 'Ribeirão Preto')}</span><b>${num(hsp(), 2)}<small>kWh/m²·dia</small></b></div>
            <div class="numero"><span>Com a orientação</span><b>${num(hsp() * M.FATOR_ORIENTACAO[orc.orientacao], 2)}<small>HSP</small></b></div>
          </div>
          <p class="dica" style="margin-top:10px">Irradiação de teste. No oficial vem da base pública pelo endereço (no Groner era fixo 4,41).</p>
        </section>
      </div>`;
    el.querySelectorAll('[data-tel]').forEach((b) => b.onclick = () => { orc.telhado = b.dataset.tel; salvarRascunho(); render(); });
    el.querySelectorAll('[data-ori]').forEach((b) => b.onclick = () => { orc.orientacao = b.dataset.ori; salvarRascunho(); render(); });
    $('#f-area').oninput = (e) => { orc.areaDisponivel = e.target.value; salvarRascunho(); };
    $('#f-km').oninput = (e) => { orc.distanciaKm = e.target.value; salvarRascunho(); };
    $('#f-padrao').onchange = (e) => { orc.trocaPadrao = e.target.checked; salvarRascunho(); };
  }

  /* ---------- Passo 3: dimensionamento ---------- */
  function etapaDimensionamento(el) {
    const p = parametros();
    const o = opcoes()[orc.opcaoEscolhida];
    const d = o.dim, media = consumoMedio();
    const cons = orc.consumos.map(Number);
    const maxV = Math.max(...cons, d.geracaoMes) * 1.1;
    el.innerHTML = `
      <section class="cartao">
        <div class="numeros">
          <div class="numero destaque"><span>Potência do sistema</span><b>${num(d.kwpReal, 2)}<small>kWp</small></b></div>
          <div class="numero"><span>Módulos</span><b>${d.placas}<small>× ${o.modulo.potenciaW} W</small></b></div>
          <div class="numero"><span>Geração estimada</span><b>${num(d.geracaoMes)}<small>kWh/mês</small></b></div>
          <div class="numero"><span>Área ocupada</span><b>${num(o.areaM2, 1)}<small>m²</small></b></div>
        </div>
        ${!o.cabeNoTelhado ? `<div class="aviso ruim">A área necessária (${num(o.areaM2, 1)} m²) passa da área livre informada (${orc.areaDisponivel} m²).</div>` : ''}
      </section>
      <div class="lado">
        <section class="cartao">
          <h3>Consumo × geração</h3>
          <div class="grafico">
            ${cons.map((c, i) => `<div class="col"><div class="barra-c" style="height:${(c / maxV) * 100}%"></div><span class="rot">${MESES[i][0]}</span></div>`).join('')}
            <div class="linha-g" style="bottom:${(d.geracaoMes / maxV) * 100 * 0.86 + 14}%"><span>${num(d.geracaoMes)} kWh</span></div>
          </div>
          <div class="legenda"><span><i style="background:#e9dfd5"></i>Consumo do cliente</span><span><i style="background:var(--brasa)"></i>Geração média</span></div>
          <p class="dica" style="margin-top:8px">A geração cobre ${pct(Math.min(d.cobertura, 9.99), 0)} do que pode ser compensado (consumo − ${d.disponibilidade} kWh de disponibilidade).</p>
        </section>
        <section class="cartao">
          <h3>Como foi calculado</h3>
          <div class="formula">kWp = (consumo − disponibilidade) ÷ (HSP × 30 × PR)</div>
          <div class="formula" style="margin-top:6px">= (${num(media)} − ${d.disponibilidade}) ÷ (${num(d.hspEfetivo, 2)} × 30 × ${num(p.pr, 3)}) = ${num(d.kwpNecessario, 2)} kWp</div>
          <table style="margin-top:10px">
            <tr><td>Arredondado para módulos inteiros</td><td class="v">${d.placas} × ${o.modulo.potenciaW} W</td></tr>
            <tr><td>Inversor (${esc(o.nivel)})</td><td class="v">${num(o.inversor.potenciaKw, 1)} kW</td></tr>
            <tr><td>Relação DC/AC (ideal ${num(p.faixaDcAc.min, 2)}–${num(p.faixaDcAc.max, 2)})</td><td class="v">${num(o.relacaoDcAc, 2)} ${o.dcAcOk ? '✓' : '⚠'}</td></tr>
            <tr><td>Strings</td><td class="v">${o.strings.strings} × ${o.strings.porString} módulos</td></tr>
            <tr><td>Tensão no frio (${p.tempMinima} °C)</td><td class="v">${num(o.strings.vocFrio)} V / ${o.inversor.vMaxDc} V</td></tr>
          </table>
          ${o.strings.avisos.map((a) => `<div class="aviso ruim">${esc(a)}</div>`).join('') || '<div class="aviso ok">✓ Strings dentro dos limites do inversor.</div>'}
        </section>
      </div>`;
  }

  /* ---------- Passo 4: kits e preços ---------- */
  function etapaKits(el) {
    const ops = opcoes();
    el.innerHTML = `<p class="sutil">Três opções com o mesmo dimensionamento. Preços de kit simulados (planilha Belenergy entra aqui).</p>
      <div class="kits">${ops.map((o, i) => `
        <button type="button" class="kit ${orc.opcaoEscolhida === i ? 'sel' : ''}" data-op="${i}">
          ${o.destaque ? '<span class="fita">RECOMENDADA</span>' : ''}
          <div class="nivel">${esc(o.nivel)}</div>
          <div class="sutil">${esc(o.descricao)}</div>
          <div class="preco">${brl(o.preco.precoFinal)}</div>
          <span class="semaforo ${o.preco.semaforo}">R$ ${num(o.preco.rsPorWp, 2)}/Wp · ${NOME_SEMAFORO[o.preco.semaforo]}</span>
          <ul>
            <li><span>Potência</span><span>${num(o.dim.kwpReal, 2)} kWp</span></li>
            <li><span>Módulos</span><span>${o.dim.placas} × ${o.modulo.potenciaW} W</span></li>
            <li><span>Inversor</span><span>${esc(o.inversor.nome)}</span></li>
            ${o.bateria ? `<li><span>Bateria</span><span>${esc(o.bateria.nome)}</span></li>` : ''}
            <li><span>Geração</span><span>${num(o.dim.geracaoMes)} kWh/mês</span></li>
            <li><span>Retorno</span><span>${o.eco.paybackAnos ? num(o.eco.paybackAnos, 1) + ' anos' : '—'}</span></li>
            <li><span>Kit (custo)</span><span>${brl(o.kit)}</span></li>
          </ul>
          ${!o.dcAcOk ? `<div class="aviso">DC/AC ${num(o.relacaoDcAc, 2)} fora da faixa ideal — sem inversor adequado no catálogo.</div>` : ''}
          ${o.strings.avisos.length ? `<div class="aviso ruim">${esc(o.strings.avisos[0])}</div>` : ''}
        </button>`).join('')}</div>`;
    el.querySelectorAll('[data-op]').forEach((b) => b.onclick = () => { orc.opcaoEscolhida = +b.dataset.op; salvarRascunho(); render(); });
  }

  /* ---------- Passo 5: preço e pagamento ---------- */
  function etapaPreco(el) {
    const p = parametros();
    const o = opcoes()[orc.opcaoEscolhida], pr = o.preco, eco = o.eco;
    const sem = p.semaforo, ini = 1.8, fim = 3.5;
    const posicao = (v) => Math.min(Math.max((v - ini) / (fim - ini), 0), 1) * 100;
    const posPonteiro = Math.min(Math.max(posicao(pr.rsPorWp), 8), 92); // não deixar o rótulo sair do cartão
    const parcelas = p.financiamento.prazos.map((n) => ({ n, v: M.parcelaPrice(pr.precoFinal, p.financiamento.jurosMes, n) }));
    const contaDepois = eco.contaDepois;
    el.innerHTML = `
      <div class="lado">
        <div>
          <section class="cartao grade">
            <div class="campo"><span>Forma de pagamento</span><div class="chips">${[['financiamento', 'Financiamento'], ['avista', 'À vista / Pix'], ['cartao', 'Cartão 12x']].map(([v, t]) => `<button type="button" class="chip ${orc.formaPagamento === v ? 'sel' : ''}" data-pg="${v}">${t}</button>`).join('')}</div></div>
            <div class="grade g2">
              <label class="campo"><span>Comissão de parceiro (%)</span><input type="number" id="f-com" min="0" max="15" step="0.5" value="${orc.comissaoParceria}" inputmode="decimal"></label>
              <label class="campo"><span>Desconto: ${num(orc.descontoPct, 1)}% de ${pct(p.reservaNegociacao, 0)}</span><input type="range" id="f-desc" min="0" max="${p.reservaNegociacao * 100}" step="0.5" value="${orc.descontoPct}"></label>
            </div>
            <label class="alternar"><span><b>Kit faturado direto pela Belenergy</b><br><span class="sutil">Imposto só sobre o serviço (validar com o contador)</span></span><input type="checkbox" id="f-direto" ${orc.kitFaturadoDireto ? 'checked' : ''}></label>
          </section>

          <section class="cartao">
            <h3>Composição do preço · ${esc(o.nivel)}</h3>
            <table>
              ${pr.linhas.filter((l) => l.valor).map((l) => `<tr><td>${esc(l.nome)}</td><td class="v">${brl(l.valor)}</td></tr>`).join('')}
              <tr class="sub"><td>Custos diretos</td><td class="v">${brl(pr.custosDiretos)}</td></tr>
              <tr><td>Taxa fixa do projeto <span class="sutil">(${brl(p.custoFixoMes)} ÷ ${p.obrasPrevistasMes} obras)</span></td><td class="v">${brl(pr.taxaFixa)}</td></tr>
              <tr><td>Impostos (${pct(pr.percentuais.impostos)})</td><td class="v">${brl(pr.decomp.impostos)}</td></tr>
              ${pr.decomp.taxaPagamento ? `<tr><td>Taxa do cartão (${pct(pr.percentuais.pagamento)})</td><td class="v">${brl(pr.decomp.taxaPagamento)}</td></tr>` : ''}
              ${pr.decomp.comissao ? `<tr><td>Comissão parceiro (${pct(pr.percentuais.comissao)})</td><td class="v">${brl(pr.decomp.comissao)}</td></tr>` : ''}
              <tr><td>Margem (${pct(pr.percentuais.margem, 0)} para ${num(o.dim.kwpReal, 1)} kWp)</td><td class="v">${brl(pr.decomp.margem)}</td></tr>
              <tr><td>Reserva de negociação restante</td><td class="v">${brl(pr.decomp.reservaRestante)}</td></tr>
              <tr class="total"><td>Preço ao cliente</td><td class="v">${brl(pr.precoFinal)}</td></tr>
              ${orc.kitFaturadoDireto ? `<tr class="sub"><td>↳ Nota Belenergy (kit)</td><td class="v">${brl(pr.kitDireto)}</td></tr><tr class="sub"><td>↳ Nota Chama Solar (serviço)</td><td class="v">${brl(pr.notaChamaSolar)}</td></tr>` : ''}
              <tr><td><b>Sobra para a empresa</b> <span class="sutil">(margem + reserva)</span></td><td class="v"><b>${brl(pr.lucroLiquido)}</b></td></tr>
            </table>
          </section>
        </div>

        <div>
          <section class="cartao">
            <h3>Preço × mercado</h3>
            <span class="semaforo ${pr.semaforo}">${NOME_SEMAFORO[pr.semaforo]}</span>
            <div class="regua" style="background:linear-gradient(90deg,var(--verde) 0 ${posicao(sem.verdeAte)}%,var(--amarelo) ${posicao(sem.verdeAte)}% ${posicao(sem.amareloAte)}%,var(--vermelho) ${posicao(sem.amareloAte)}%)"><span class="ponteiro" style="left:${posPonteiro}%">R$ ${num(pr.rsPorWp, 2)}/Wp</span>
              <div class="marcas"><span style="left:0%;transform:none">1,80</span><span style="left:${posicao(sem.verdeAte)}%">${num(sem.verdeAte, 2)}</span><span style="left:${posicao(sem.amareloAte)}%">${num(sem.amareloAte, 2)}</span><span style="left:100%;transform:translateX(-100%)">3,50</span></div>
            </div>
            <p class="dica">Média nacional residencial: R$ ${num(sem.referencia, 2)}/Wp (1º tri 2026). Faixas ajustáveis em Parâmetros.</p>
          </section>

          <section class="cartao">
            <h3>Parcela × conta de luz</h3>
            <p class="sutil">Conta hoje <b>${brl(eco.contaAtual)}</b> · depois do solar ≈ <b>${brl(contaDepois)}</b></p>
            <div class="parcelas">${parcelas.map((x) => { const tot = x.v + contaDepois, dif = eco.contaAtual - tot; return `
              <div class="parcela"><div><b>${x.n}× ${brl(x.v)}</b><div class="sutil">+ conta ${brl(contaDepois)} = ${brl(tot)}</div></div>
              <span class="comp ${dif >= 0 ? 'bom' : 'ruim'}">${dif >= 0 ? 'economiza ' + brl(dif) : 'paga ' + brl(-dif) + ' a mais'}/mês</span></div>`; }).join('')}
            </div>
            <p class="dica" style="margin-top:8px">Juros de teste: ${pct(p.financiamento.jurosMes, 2)} ao mês.</p>
          </section>

          <section class="cartao">
            <h3>Retorno em 25 anos</h3>
            <div class="numeros">
              <div class="numero destaque"><span>Retorno</span><b>${eco.paybackAnos ? num(eco.paybackAnos, 1) : '—'}<small>anos</small></b></div>
              <div class="numero"><span>TIR</span><b>${pct(eco.tir, 0)}<small>a.a.</small></b></div>
              <div class="numero"><span>VPL (${pct(p.taxaDesconto, 0)})</span><b style="font-size:18px">${brl(eco.vpl)}</b></div>
              <div class="numero"><span>Economia total</span><b style="font-size:18px">${brl(eco.economia25)}</b></div>
            </div>
            <p class="dica" style="margin-top:8px">Considera Fio B (Lei 14.300: ${pct(p.fioB.cronograma[2026], 0)} em 2026 → ${pct(p.fioB.depois, 0)}), simultaneidade ${pct(p.simultaneidade, 0)}, reajuste ${pct(p.reajusteAnual, 0)}/ano e perda de ${pct(p.degradacaoAnual, 1)}/ano dos módulos.</p>
          </section>
        </div>
      </div>`;
    el.querySelectorAll('[data-pg]').forEach((b) => b.onclick = () => { orc.formaPagamento = b.dataset.pg; salvarRascunho(); render(); });
    $('#f-com').onchange = (e) => { orc.comissaoParceria = Number(e.target.value) || 0; salvarRascunho(); render(); };
    $('#f-desc').onchange = (e) => { orc.descontoPct = Number(e.target.value); salvarRascunho(); render(); };
    $('#f-direto').onchange = (e) => { orc.kitFaturadoDireto = e.target.checked; salvarRascunho(); render(); };
  }

  /* ---------- Passo 6: conferir e enviar ---------- */
  function etapaEnviar(el) {
    const p = parametros();
    const o = opcoes()[orc.opcaoEscolhida], eco = o.eco;
    const parcela = M.parcelaPrice(o.preco.precoFinal, p.financiamento.jurosMes, p.financiamento.prazos[1]);
    const primeiroNome = (orc.nome || '').split(' ')[0];
    const msg = `Olá ${primeiroNome}! Aqui é o Victor da Chama Solar ☀️\n\nSegue sua proposta de energia solar:\n• Sistema de ${num(o.dim.kwpReal, 2)} kWp (${o.dim.placas} módulos)\n• Geração média de ${num(o.dim.geracaoMes)} kWh/mês\n• Investimento: ${brl(o.preco.precoFinal)} ou ${p.financiamento.prazos[1]}× de ${brl(parcela)}\n• Sua conta cai de ${brl(eco.contaAtual)} para cerca de ${brl(eco.contaDepois)}\n• Retorno em ${num(eco.paybackAnos, 1)} anos\n\nO PDF completo vai em anexo. Posso te ligar para tirar dúvidas?`;
    const tel = (orc.whatsapp || '').replace(/\D/g, '');
    el.innerHTML = `
      <div class="proposta">
        <div class="capa">
          <span class="marca"><svg viewBox="0 0 32 32" style="width:22px;height:22px;color:var(--brasa-2)"><path d="M16 3c1.6 4.2 6.5 6.8 6.5 13.1A6.5 6.5 0 0 1 16 23a6.5 6.5 0 0 1-6.5-6.9c.2-2.6 1.6-4.2 2.9-5.6.2 1.8 1 3 2.3 3.6C14.2 9.8 15 6.4 16 3Z" fill="currentColor"/></svg><span>Chama<b>Solar</b></span></span>
          <h1>Proposta de energia solar</h1>
          <p>${esc(orc.nome)} · ${esc(orc.cidade)} · ${new Date().toLocaleDateString('pt-BR')}</p>
        </div>
        <div class="corpo">
          <div class="numeros">
            <div class="numero"><span>Sistema</span><b>${num(o.dim.kwpReal, 2)}<small>kWp</small></b></div>
            <div class="numero"><span>Geração</span><b>${num(o.dim.geracaoMes)}<small>kWh/mês</small></b></div>
            <div class="numero"><span>Conta hoje → depois</span><b style="font-size:18px">${brl(eco.contaAtual)} → ${brl(eco.contaDepois)}</b></div>
            <div class="numero"><span>Retorno</span><b>${num(eco.paybackAnos, 1)}<small>anos</small></b></div>
          </div>
          <h3 style="margin-top:18px">Equipamentos · opção ${esc(o.nivel)}</h3>
          <table>
            <tr><td>${o.dim.placas} × ${esc(o.modulo.nome)}</td><td class="v">${num(o.areaM2, 1)} m²</td></tr>
            <tr><td>1 × ${esc(o.inversor.nome)}</td><td class="v">${num(o.inversor.potenciaKw, 1)} kW</td></tr>
            ${o.bateria ? `<tr><td>1 × ${esc(o.bateria.nome)}</td><td class="v"></td></tr>` : ''}
            <tr><td>Estrutura para ${{ ceramico: 'telhado cerâmico', fibrocimento: 'telhado de fibrocimento', metalico: 'telhado metálico', laje: 'laje', solo: 'solo' }[orc.telhado]}, cabos e proteções</td><td class="v"></td></tr>
            <tr><td>Projeto, homologação na CPFL e ART</td><td class="v"></td></tr>
            <tr><td>Instalação</td><td class="v"></td></tr>
          </table>
          <h3 style="margin-top:18px">Investimento</h3>
          <div class="grande">${brl(o.preco.precoFinal)}</div>
          <p class="sutil">ou ${p.financiamento.prazos.map((n) => `${n}× de ${brl(M.parcelaPrice(o.preco.precoFinal, p.financiamento.jurosMes, n))}`).join(' · ')} (simulação, sujeito a análise de crédito)</p>
          <p class="sutil">Economia estimada em 25 anos: <b>${brl(eco.economia25)}</b>. Estimativas com base no consumo informado e na irradiação média do local; a geração real varia com o clima.</p>
        </div>
      </div>
      <div class="acoes nao-imprimir" style="margin-top:14px">
        <button class="btn escuro" id="btnPdf" type="button">Gerar PDF</button>
        <a class="btn zap" id="btnZap" style="text-align:center;text-decoration:none" target="_blank" rel="noopener" href="https://wa.me/${tel ? '55' + tel : ''}?text=${encodeURIComponent(msg)}">Enviar no WhatsApp</a>
        <button class="btn fantasma" id="btnNovo" type="button">Começar outro</button>
      </div>
      <details class="cartao nao-imprimir" style="margin-top:14px"><summary><b>Texto da mensagem</b></summary><pre style="white-space:pre-wrap;font:13px/1.5 Manrope,sans-serif;margin:10px 0 0">${esc(msg)}</pre></details>`;
    $('#btnPdf').onclick = () => window.print();
    $('#btnNovo').onclick = () => { orc = novoOrcamento(); etapa = 0; salvarRascunho(); render(); };
  }

  function salvarOrcamento() {
    const lista = Banco.ler('orcamentos', []);
    const o = opcoes()[orc.opcaoEscolhida];
    if (!orc.id) orc.id = 'ORC-' + String(lista.length + 1).padStart(4, '0');
    const registro = { ...clonar(orc), resumo: { nivel: o.nivel, kwp: o.dim.kwpReal, preco: o.preco.precoFinal, rsPorWp: o.preco.rsPorWp, semaforo: o.preco.semaforo }, atualizado: new Date().toISOString(), status: 'enviado' };
    const i = lista.findIndex((x) => x.id === orc.id);
    i >= 0 ? (lista[i] = registro) : lista.unshift(registro);
    Banco.gravar('orcamentos', lista);
    salvarRascunho();
    toast(`${orc.id} salvo no banco de teste`);
  }

  /* ---------- Lista ---------- */
  function telaLista() {
    $('#barra').hidden = true;
    const lista = Banco.ler('orcamentos', []);
    app.innerHTML = `<div class="cab-etapa"><h1>Orçamentos</h1><p class="sutil">Banco de teste no seu navegador.</p></div>
      ${lista.length ? lista.map((x) => `
        <section class="cartao item-lista">
          <div><b>${esc(x.nome)}</b> <span class="sutil mono">${x.id}</span><br>
          <span class="sutil">${esc(x.resumo.nivel)} · ${num(x.resumo.kwp, 2)} kWp · ${new Date(x.atualizado).toLocaleDateString('pt-BR')}</span></div>
          <div style="text-align:right"><b>${brl(x.resumo.preco)}</b><br><span class="semaforo ${x.resumo.semaforo}">R$ ${num(x.resumo.rsPorWp, 2)}/Wp</span></div>
          <button class="btn fantasma" data-abrir="${x.id}" type="button">Abrir</button>
        </section>`).join('') : '<div class="vazio cartao">Nenhum orçamento salvo ainda.<br><br><a class="btn primario" href="#novo" style="display:inline-block;text-decoration:none">Fazer o primeiro</a></div>'}`;
    app.querySelectorAll('[data-abrir]').forEach((b) => b.onclick = () => {
      const x = lista.find((y) => y.id === b.dataset.abrir);
      orc = Object.assign(novoOrcamento(), x); etapa = 5; salvarRascunho(); location.hash = '#novo';
    });
  }

  /* ---------- Parâmetros ---------- */
  const CAMPOS_PARAM = [
    ['Custo fixo', [['custoFixoMes', 'Custo fixo do mês (R$)', 1], ['obrasPrevistasMes', 'Obras previstas no mês', 1]]],
    ['Custos por obra', [['maoDeObraPorPlaca', 'Terceiro por placa (R$)', 1], ['art', 'ART (R$)', 1], ['materialCaBase', 'Material CA fixo (R$)', 1], ['materialCaPorKwp', 'Material CA por kWp (R$)', 1], ['custoKm', 'Custo por km (R$)', 1], ['visitasObra', 'Viagens por obra', 1], ['trocaPadrao', 'Troca de padrão (R$)', 1], ['reservaGarantia', 'Reserva de garantia (% do kit)', 100]]],
    ['Percentuais', [['impostoTotal', 'Imposto com kit na nota (%)', 100], ['impostoServico', 'Imposto só serviço (%)', 100], ['reservaNegociacao', 'Reserva de negociação (%)', 100]]],
    ['Conta e retorno', [['tarifaKwh', 'Tarifa padrão (R$/kWh)', 1], ['reajusteAnual', 'Reajuste ao ano (%)', 100], ['simultaneidade', 'Simultaneidade (%)', 100], ['pr', 'PR (eficiência do sistema)', 1]]],
  ];
  function telaParametros() {
    $('#barra').hidden = true;
    const p = parametros();
    app.innerHTML = `<div class="cab-etapa"><h1>Parâmetros de preço</h1><p class="sutil">Valores de teste. Troque pelos reais quando tiver custos fixos, alíquota e preço do terceiro.</p></div>
      <div class="lado"><div>${CAMPOS_PARAM.map(([titulo, campos]) => `
        <section class="cartao"><h3>${titulo}</h3><div class="grade g2">${campos.map(([k, rot, mult]) => `
          <label class="campo"><span>${rot}</span><input type="number" step="any" data-par="${k}" data-mult="${mult}" value="${+(p[k] * mult).toFixed(4)}"></label>`).join('')}</div></section>`).join('')}</div>
        <div>
          <section class="cartao"><h3>Margem por tamanho</h3><table>${p.margens.map((m, i) => `<tr><td>até ${m.ate === Infinity ? '∞' : m.ate} kWp</td><td class="v"><input type="number" step="0.5" data-margem="${i}" value="${+(m.margem * 100).toFixed(2)}" style="width:90px;padding:6px 8px;text-align:right"> %</td></tr>`).join('')}</table></section>
          <section class="cartao"><h3>Fórmula</h3><div class="formula" style="white-space:normal">Preço = (custos diretos + taxa fixa) ÷ (1 − (impostos + taxa de pagamento + comissão + margem + reserva))</div>
          <p class="dica" style="margin-top:8px">Fator X do Groner removido. A reserva de negociação é o desconto máximo do vendedor.</p></section>
          <div class="acoes" style="grid-template-columns:1fr 1fr"><button class="btn primario" id="btnSalvarPar" type="button">Salvar</button><button class="btn fantasma" id="btnResetPar" type="button">Voltar ao teste</button></div>
        </div></div>`;
    $('#btnSalvarPar').onclick = () => {
      const novo = {};
      app.querySelectorAll('[data-par]').forEach((i) => { novo[i.dataset.par] = Number(i.value) / Number(i.dataset.mult); });
      novo.margens = p.margens.map((m, i) => ({ ate: m.ate, margem: Number(app.querySelector(`[data-margem="${i}"]`).value) / 100 }));
      Banco.gravar('parametros', JSON.parse(JSON.stringify(novo, (k, v) => (v === Infinity ? 1e9 : v))));
      toast('Parâmetros salvos');
    };
    $('#btnResetPar').onclick = () => { Banco.gravar('parametros', {}); telaParametros(); toast('Voltou aos valores de teste'); };
  }

  /* ---------- Rotas ---------- */
  function render() {
    const rota = (location.hash || '#novo').slice(1);
    document.querySelectorAll('[data-rota]').forEach((a) => a.classList.toggle('ativo', a.dataset.rota === rota));
    if (rota === 'lista') return telaLista();
    if (rota === 'parametros') return telaParametros();
    telaOrcamento();
  }
  function toast(t) {
    const d = document.createElement('div'); d.className = 'toast'; d.textContent = t;
    document.body.appendChild(d); setTimeout(() => d.remove(), 2200);
  }
  window.addEventListener('hashchange', render);
  render();
})();
