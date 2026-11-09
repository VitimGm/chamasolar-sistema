/* =====================================================================
   APP DO CLIENTE — a usina do cliente pelo link (cliente.html?t=TOKEN)
   Mostra geração (hoje, mês, ano, total), mês a mês, dia a dia, as contas
   de luz com o relatório de economia e o rateio de créditos entre as
   unidades. Lê só a função pública sol_portal_cliente (dados desta usina).
   ===================================================================== */
(function () {
  'use strict';
  const B = window.Banco, D = window.DadosTeste, U = window.Usinas;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const n = (v, c = 0) => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c });
  const brl = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const raiz = $('#cliente');
  const token = new URLSearchParams(location.search).get('t');
  const est = { mes: null };

  async function iniciar() {
    if (B.semear) B.semear();
    const d = token ? await B.portalCliente(token).catch(() => null) : null;
    if (!d) { raiz.innerHTML = '<div class="pv"><div class="bloco" style="margin-top:40px"><h2>Link não encontrado</h2><p class="apoio">Peça um novo link para a Chama Solar.</p></div></div>'; return; }
    desenhar(d);
  }

  function desenhar(d) {
    const u = d.usina, g = (d.geracao || []).map((x) => ({ dia: x.dia, kwh: Number(x.kwh) || 0 }));
    const tarifa = Number(u.tarifa_kwh) || (D.parametros && D.parametros.tarifaKwh) || 1;
    const hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10), mesAt = hoje.slice(0, 7), anoAt = hoje.slice(0, 4);
    const soma = (f) => g.filter(f).reduce((t, x) => t + x.kwh, 0);
    const kHoje = soma((x) => x.dia === hoje), kMes = soma((x) => x.dia.startsWith(mesAt)), kAno = soma((x) => x.dia.startsWith(anoAt));
    const total = d.leitura && +d.leitura.total_kwh > 0 ? +d.leitura.total_kwh : g.reduce((t, x) => t + x.kwh, 0);
    // 12 meses
    const meses = []; const ref = new Date(hoje + 'T12:00:00');
    for (let i = 11; i >= 0; i--) { const dt = new Date(ref.getFullYear(), ref.getMonth() - i, 1); const k = dt.toISOString().slice(0, 7); meses.push({ k, rot: MES[dt.getMonth()], kwh: soma((x) => x.dia.startsWith(k)) }); }
    const esp = Number(u.esperado_mes) || 0, maxM = Math.max(...meses.map((m) => m.kwh), esp, 1);
    const mesSel = est.mes || mesAt, dias = g.filter((x) => x.dia.startsWith(mesSel)), maxD = Math.max(...dias.map((x) => x.kwh), 1);
    const nome = String(u.nome || '').split(' ')[0];
    const unid = d.unidades || [], fat = d.faturas || [];
    const ultimaDe = (id) => fat.filter((f) => (f.unidade_id || 0) === id).sort((a, b) => b.leitura_fim.localeCompare(a.leitura_fim))[0];
    const uObj = { cliente_nome: u.nome, tarifa_kwh: u.tarifa_kwh, esperado_mes: u.esperado_mes, kwp: u.kwp };
    const ecoDe = (f) => (f ? U.periodoFatura(uObj, g, f) : null);
    const linhasUnid = [{ id: 0, apelido: 'Usina (unidade geradora)', geradora: true, percentual: null }, ...unid.filter((x) => !x.geradora)];
    const zap = `https://wa.me/${D.empresa.whatsapp}?text=${encodeURIComponent('Olá! Sou ' + (u.nome || '') + ' e quero falar sobre a minha usina.')}`;

    raiz.innerHTML = `
      <header class="topo"><div class="pv"><img src="marca/logo-cor.webp" alt="Chama Solar" width="123" height="52"></div></header>
      <main class="pv">
        <section class="cl-capa">
          <span class="selo">Minha usina solar</span>
          <h1>Olá, ${esc(nome)}!</h1>
          <p>${n(u.kwp, 2)} kWp${u.cidade ? ' · ' + esc(u.cidade) : ''}${u.ligada_em ? ' · ligada em ' + esc(String(u.ligada_em).split('-').reverse().join('/')) : ''}</p>
          <div class="cl-hoje"><span>Hoje</span><b>${n(kHoje, 1)} kWh</b></div>
        </section>
        <section class="cl-nums">
          <div><span>Este mês</span><b>${n(kMes)} kWh</b><small>${brl(kMes * tarifa)} de economia</small></div>
          <div><span>Este ano</span><b>${n(kAno)} kWh</b><small>${brl(kAno * tarifa)} de economia</small></div>
          <div><span>Desde a instalação</span><b>${n(total)} kWh</b><small>${brl(total * tarifa)} de economia</small></div>
        </section>

        <section class="bloco">
          <h2>Geração mês a mês</h2>
          ${esp ? `<p class="apoio">A linha mostra o esperado: ${n(esp)} kWh por mês.</p>` : ''}
          <div class="cl-barras" role="group" aria-label="Meses">
            ${esp ? `<i class="cl-esp" style="bottom:calc(22px + ${(esp / maxM).toFixed(3)} * (100% - 22px))"></i>` : ''}
            ${meses.map((m) => `<button type="button" data-mes="${m.k}" class="${m.k === mesSel ? 'sel' : ''}" title="${n(m.kwh)} kWh"><i style="height:${Math.max((m.kwh / maxM) * 100, 2)}%"></i><em>${m.rot}</em></button>`).join('')}
          </div>
          <h3 class="cl-sub">Dia a dia · ${MES[+mesSel.slice(5, 7) - 1]}/${mesSel.slice(0, 4)}</h3>
          ${dias.length ? `<div class="cl-dias">${dias.map((x) => `<i title="${x.dia.split('-').reverse().join('/')}: ${n(x.kwh, 1)} kWh" style="height:${Math.max((x.kwh / maxD) * 100, 3)}%"></i>`).join('')}</div>
            <p class="apoio" style="margin:6px 0 0">${n(dias.reduce((t, x) => t + x.kwh, 0))} kWh no mês · melhor dia: ${n(Math.max(...dias.map((x) => x.kwh)), 1)} kWh</p>` : '<p class="apoio">Sem leitura neste mês.</p>'}
        </section>

        ${fat.length || unid.length ? `<section class="bloco">
          <h2>Contas de luz e créditos</h2>
          ${unid.filter((x) => !x.geradora).length ? `<p class="apoio">Os créditos da usina são divididos entre ${unid.filter((x) => !x.geradora).length + 1} unidades:</p>` : ''}
          <div class="cl-unid">${linhasUnid.map((x) => { const f = ultimaDe(x.id), r = ecoDe(f); return `<div>
            <div class="cl-u-cab"><b>${esc(x.apelido || 'Unidade ' + x.uc)}</b>${x.percentual != null ? `<span>${n(x.percentual)}% dos créditos</span>` : ''}</div>
            ${x.uc ? `<small>UC ${esc(x.uc)}${x.titular ? ' · ' + esc(x.titular) : ''}</small>` : ''}
            ${f ? `<div class="cl-u-num"><span>Última conta (${esc(f.referencia || f.leitura_fim.split('-').reverse().join('/'))})</span><b>${brl(f.valor_pago)}</b><em>economia de ${brl(r.economia)}</em></div>
              ${+f.saldo_creditos ? `<small>Saldo de créditos: ${n(f.saldo_creditos)} kWh</small>` : ''}
              <button type="button" class="btn-g contorno" data-rel="${f.id}">Ver o relatório desta conta</button>` : '<small>Ainda sem conta lançada.</small>'}
          </div>`; }).join('')}</div>
          ${fat.length > 1 ? `<details class="outras"><summary>Todas as contas (${fat.length})</summary>${fat.map((f) => { const un = linhasUnid.find((x) => x.id === (f.unidade_id || 0)); return `<div class="op-mini"><span>${esc(f.referencia || f.leitura_fim.split('-').reverse().join('/'))} · ${esc(un ? un.apelido || 'UC ' + un.uc : 'Usina')}</span><b>${brl(f.valor_pago)}</b><button type="button" data-rel="${f.id}">Ver relatório</button></div>`; }).join('')}</details>` : ''}
        </section>` : ''}

        <section class="bloco">
          <h2>Precisa de ajuda?</h2>
          <p class="apoio">A Chama Solar acompanha a sua usina todos os dias.</p>
          <a class="btn-g verde" href="${zap}" target="_blank" rel="noopener">${window.Icone ? Icone('conversa') : ''} Falar com a Chama Solar</a>
        </section>
        <footer class="rodape"><img src="marca/logo-cor.webp" alt="Chama Solar" width="104" height="44">${esc(D.empresa.endereco)}<br>Economia estimada pela tarifa de R$ ${n(tarifa, 2)}/kWh.</footer>
      </main>`;

    raiz.onclick = (e) => {
      const m = e.target.closest('[data-mes]'); if (m) { est.mes = m.dataset.mes; desenhar(d); return; }
      const r = e.target.closest('[data-rel]'); if (r) { const f = fat.find((x) => String(x.id) === r.dataset.rel); if (f) U.relatorioFatura(uObj, g, f, fat.filter((x) => (x.unidade_id || 0) === (f.unidade_id || 0))); }
    };
  }

  iniciar();
})();
