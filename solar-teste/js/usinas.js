/* =====================================================================
   USINAS — monitoramento direto das plataformas dos fabricantes.
   Geração diária por usina (API do fabricante ou planilha exportada),
   comparada com o que a proposta prometeu. Alerta quando cai, relatório
   mensal em PDF e mensagem pronta (com pedido de indicação).
   ===================================================================== */
(function (raiz) {
  'use strict';
  const D = raiz.DadosTeste;
  const MARCAS = ['Auxsol', 'Huawei', 'Deye', 'Growatt', 'Solis', 'Sungrow', 'GoodWe', 'Hoymiles', 'Outra'];
  const n = (v, c = 0) => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c });
  const brl = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const iso = (d) => d.toISOString().slice(0, 10);

  /* ---------- situação da usina no mês ---------- */
  function situacao(u, linhas, ref = new Date()) {
    const mes = iso(ref).slice(0, 7);
    const doMes = linhas.filter((l) => l.dia.startsWith(mes));
    const total = doMes.reduce((s, l) => s + Number(l.kwh), 0);
    const diasComDado = new Set(doMes.map((l) => l.dia)).size;
    const esperadoDia = (Number(u.esperado_mes) || 0) / 30;
    const esperadoAteAgora = esperadoDia * diasComDado;
    const pct = esperadoAteAgora ? total / esperadoAteAgora : null;
    const ultimo = linhas.reduce((m, l) => (l.dia > m ? l.dia : m), '');
    const diasSemDado = ultimo ? Math.floor((ref - new Date(ultimo + 'T12:00:00')) / 864e5) : null;
    const acumulado = linhas.reduce((s, l) => s + Number(l.kwh), 0);
    const tarifa = Number(u.tarifa_kwh) || D.parametros.tarifaKwh;
    let alerta = null;
    if (diasSemDado === null) alerta = 'Sem leitura ainda';
    else if (diasSemDado >= 3) alerta = `Sem dados há ${diasSemDado} dias: inversor desligado ou sem internet?`;
    else if (pct !== null && diasComDado >= 5 && pct < 0.75) alerta = `Gerando ${n(pct * 100)}% do esperado: sujeira, sombra ou defeito?`;
    return { mes, total, diasComDado, esperadoMes: Number(u.esperado_mes) || 0, pct, ultimo, diasSemDado, acumulado, economiaMes: total * tarifa, economiaTotal: acumulado * tarifa, alerta };
  }

  /* ---------- leitura de planilha exportada da plataforma ---------- */
  function lerPlanilha(texto) {
    const linhas = texto.replace(/\r/g, '').split('\n').filter((l) => l.trim());
    const sep = [';', '\t', ','].sort((a, b) => (linhas[0].split(b).length - linhas[0].split(a).length))[0];
    const cel = (l) => l.split(sep).map((c) => c.replace(/^"|"$/g, '').trim());
    const dataDe = (s) => {
      let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
      m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/); if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
      m = s.match(/^(\d{1,2})[/.-](\d{4})$/); if (m) return `${m[2]}-${m[1].padStart(2, '0')}-01`;
      return null;
    };
    const num = (s) => { const t = String(s).replace(/[^\d,.-]/g, ''); if (!t) return NaN; return +(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t); };
    // coluna da energia: pelo cabeçalho, senão a última numérica
    const cab = cel(linhas[0]); let colE = cab.findIndex((c) => /kwh|energ|gera|yield|produ/i.test(c));
    const saida = [];
    for (const l of linhas) {
      const c = cel(l); const iD = c.findIndex((x) => dataDe(x)); if (iD < 0) continue;
      let v = colE >= 0 && colE !== iD ? num(c[colE]) : NaN;
      if (isNaN(v)) { for (let k = c.length - 1; k >= 0; k--) if (k !== iD && !isNaN(num(c[k]))) { v = num(c[k]); break; } }
      if (!isNaN(v) && v >= 0) saida.push({ dia: dataDe(c[iD]), kwh: v });
    }
    return saida;
  }

  /* ---------- relatório mensal em PDF ---------- */
  function relatorio(u, linhas, ref = new Date()) {
    const s = situacao(u, linhas, ref), [ano, mm] = s.mes.split('-');
    const doMes = linhas.filter((l) => l.dia.startsWith(s.mes)).sort((a, b) => a.dia.localeCompare(b.dia));
    const max = Math.max(...doMes.map((l) => Number(l.kwh)), 1);
    const barras = doMes.map((l) => `<div title="${l.dia.slice(8)}: ${n(l.kwh, 1)} kWh" style="flex:1;background:#ff6700;border-radius:3px 3px 0 0;height:${Math.max(4, (Number(l.kwh) / max) * 120)}px"></div>`).join('');
    const corpo = `
      <h1>Sua usina em ${MESES[+mm - 1]} de ${ano}</h1>
      <p class="mini">${esc(u.cliente_nome)} · ${n(u.kwp, 2)} kWp · ${esc(u.marca)}${u.ligada_em ? ' · ligada em ' + new Date(u.ligada_em + 'T12:00:00').toLocaleDateString('pt-BR') : ''}</p>
      <div class="tres"><div><span>Gerou no mês</span><b>${n(s.total)} kWh</b></div><div><span>Economia no mês</span><b>${brl(s.economiaMes)}</b></div><div><span>Economia desde a ligação</span><b>${brl(s.economiaTotal)}</b></div></div>
      <h2>Geração dia a dia</h2>
      <div style="display:flex;align-items:flex-end;gap:3px;height:130px;border-bottom:1px solid #e3e6ec;padding:0 2px">${barras || '<p class="mini">Sem leituras neste mês.</p>'}</div>
      <p class="mini">${s.diasComDado} dia(s) com leitura. ${s.pct !== null ? `A usina entregou ${n(s.pct * 100)}% do esperado para esses dias.` : ''} A geração varia com o clima: dias nublados geram menos.</p>
      <h2>Tudo certo com a sua usina?</h2>
      <p>${s.alerta ? `Vimos um ponto de atenção: <b>${esc(s.alerta)}</b> Já estamos olhando e vamos falar com você.` : 'Sim. A geração está dentro do esperado. Seguimos acompanhando todo dia.'}</p>
      <div class="qr" style="border-style:solid;border-color:#ff6700"><div style="font-size:30px">🎁</div><div><b>Conhece alguém que paga caro de luz?</b><br><span class="mini">Indique para a Chama Solar. Se fechar, você ganha um presente de agradecimento.</span></div></div>
      <p style="margin-top:18px" class="mini">Chama Solar · ${esc(D.empresa.endereco)} · ${esc(D.empresa.telefone)}</p>`;
    raiz.Documentos.abrir(raiz.Documentos.pagina(`Relatório ${s.mes} · ${u.cliente_nome}`, corpo));
  }

  function mensagem(u, linhas, ref = new Date()) {
    const s = situacao(u, linhas, ref), nome = String(u.cliente_nome).split(' ')[0], mes = MESES[+s.mes.slice(5) - 1];
    return `Oi ${nome}! Aqui é o ${D.empresa.vendedor}, da Chama Solar ☀️\n\nSua usina em ${mes}: gerou ${n(s.total)} kWh, uma economia de cerca de ${brl(s.economiaMes)}. Desde a ligação já foram ${brl(s.economiaTotal)} que ficaram no seu bolso.\n\n${s.alerta ? 'Vi um ponto de atenção e já estou olhando. Te aviso.' : 'Está tudo funcionando certinho.'}\n\nSe conhecer alguém pagando caro de luz, me indica? Tem um presente de agradecimento para você 🎁`;
  }

  /* =================== RELATÓRIO DA CONTA DE LUZ ===================
     Período = entre as datas de leitura da fatura. Geração da plataforma nesse período.
     Autoconsumo = gerado − injetado. Consumo real da casa = da rede + autoconsumo.
     Sem solar a conta seria: consumo real × tarifa + iluminação pública. Economia = isso − valor pago. */
  const dataBR = (d) => d ? d.split('-').reverse().join('/') : '';
  function periodoFatura(u, linhas, f) {
    const ini = f.leitura_ini, fim = f.leitura_fim;
    const dias = Math.max(Math.round((new Date(fim + 'T12:00:00') - new Date(ini + 'T12:00:00')) / 864e5), 1);
    const doP = linhas.filter((l) => l.dia > ini && l.dia <= fim).sort((a, b) => a.dia.localeCompare(b.dia));
    const diasComDado = new Set(doP.map((l) => l.dia)).size;
    const daPlataforma = doP.reduce((t, l) => t + Number(l.kwh), 0);
    let geracao = Number(f.geracao_manual) || 0, origem = 'informada';
    if (!geracao && diasComDado) { geracao = diasComDado >= dias * 0.9 ? daPlataforma : (daPlataforma / diasComDado) * dias; origem = diasComDado >= dias * 0.9 ? 'plataforma' : 'estimada'; }
    const injetada = Number(f.injetada) || 0, rede = Number(f.consumo_rede) || 0;
    const tarifa = Number(f.tarifa) || Number(u.tarifa_kwh) || D.parametros.tarifaKwh;
    const ilum = Number((f.dados || {}).iluminacao) || 0, pago = Number(f.valor_pago) || 0;
    const autoconsumo = Math.max(geracao - injetada, 0);
    const consumoCasa = rede + autoconsumo;
    const semSolar = consumoCasa * tarifa + ilum;
    const economia = Math.max(semSolar - pago, 0);
    const esperado = (Number(u.esperado_mes) || 0) / 30 * dias;
    return { ini, fim, dias, doP, diasComDado, daPlataforma, geracao, origem, injetada, rede, tarifa, ilum, pago, autoconsumo, consumoCasa, semSolar, economia,
      pctSol: consumoCasa ? Math.min(geracao / consumoCasa, 1) : 0, pctConta: semSolar ? economia / semSolar : 0,
      saldo: Number(f.saldo_creditos) || 0, saldoR: (Number(f.saldo_creditos) || 0) * tarifa, ano: economia * 365 / dias,
      desempenho: esperado && geracao ? geracao / esperado : null, melhor: doP.reduce((m, l) => (Number(l.kwh) > (m ? Number(m.kwh) : -1) ? l : m), null) };
  }
  const CSS_REL = `
    .heroi{background:linear-gradient(135deg,#ff6700,#ffb000);color:#fff;border-radius:22px;padding:26px 26px 22px;margin:6px 0 18px}
    .heroi small{font-weight:600;opacity:.9;letter-spacing:.04em;text-transform:uppercase;font-size:11px}
    .heroi .grande{font:800 46px/1.05 Exo,sans-serif;margin:6px 0 4px}
    .heroi p{margin:0;opacity:.95}
    .cmp{display:grid;gap:10px;margin:8px 0 4px}
    .cmp .l{display:grid;grid-template-columns:150px 1fr;align-items:center;gap:10px;font-size:13px}
    .cmp .b{height:30px;border-radius:10px;display:flex;align-items:center;padding:0 12px;color:#fff;font-weight:800;white-space:nowrap;min-width:80px;box-sizing:border-box}
    .fluxo{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:8px 0}
    .fluxo>div{border:1px solid #e3e6ec;border-radius:16px;padding:14px;text-align:center}
    .fluxo .ic{font-size:28px}.fluxo b{display:block;font:800 22px Exo,sans-serif;color:#1d283e;margin-top:4px}.fluxo span{font-size:12px;color:#5b6478}
    .anel{display:flex;gap:18px;align-items:center;margin:8px 0}
    .anel .d{width:118px;height:118px;border-radius:50%;display:grid;place-items:center;flex:none}
    .anel .d i{width:84px;height:84px;border-radius:50%;background:#fff;display:grid;place-items:center;font:800 24px Exo,sans-serif;color:#1d283e;font-style:normal}
    .hist{display:flex;align-items:flex-end;gap:8px;height:120px;border-bottom:1px solid #e3e6ec;margin-top:8px}
    .hist div{flex:1;background:#1d6b3a;border-radius:6px 6px 0 0;position:relative;min-height:4px}
    .hist div span{position:absolute;top:-17px;left:50%;transform:translateX(-50%);font-size:10px;font-weight:700;white-space:nowrap}
    .hist-r{display:flex;gap:8px}.hist-r span{flex:1;text-align:center;font-size:10px;color:#5b6478}
    @media(max-width:560px){.fluxo,.tres{grid-template-columns:1fr!important}.anel{flex-wrap:wrap}.cmp .l{grid-template-columns:1fr}.heroi .grande{font-size:36px}}`;
  function relatorioFatura(u, linhas, f, historico = []) {
    const r = periodoFatura(u, linhas, f);
    const max = Math.max(r.semSolar, r.pago, 1);
    const maxDia = Math.max(...r.doP.map((l) => Number(l.kwh)), 1);
    const barras = r.doP.map((l) => `<div title="${dataBR(l.dia)}: ${n(l.kwh, 1)} kWh" style="flex:1;background:${l === r.melhor ? '#ff6700' : '#ffb000'};border-radius:3px 3px 0 0;height:${Math.max(4, (Number(l.kwh) / maxDia) * 110)}px"></div>`).join('');
    const hs = [...historico].sort((a, b) => a.leitura_fim.localeCompare(b.leitura_fim)).slice(-12).map((h) => ({ h, e: periodoFatura(u, linhas, h).economia }));
    const maxH = Math.max(...hs.map((x) => x.e), 1), totalH = hs.reduce((t, x) => t + x.e, 0);
    const mesRef = f.referencia || MESES[+r.fim.slice(5, 7) - 1] + '/' + r.fim.slice(0, 4);
    const pctSolGraus = Math.round(r.pctSol * 360);
    const corpo = `<style>${CSS_REL}</style>
      <div class="heroi"><small>Conta de ${esc(mesRef)} · ${dataBR(r.ini)} a ${dataBR(r.fim)} (${r.dias} dias)</small>
        <div class="grande">${brl(r.economia)}</div><p>foi o que a sua usina solar economizou nesta conta, ${esc(String(u.cliente_nome).split(' ')[0])}. Isso é <b>${n(r.pctConta * 100)}%</b> da conta que você pagaria sem ela.</p></div>
      <h2>Sem a usina × com a usina</h2>
      <div class="cmp">
        <div class="l"><span>Sem energia solar, a conta seria</span><div class="b" style="width:${(r.semSolar / max) * 100}%;background:#9aa3b5">${brl(r.semSolar)}</div></div>
        <div class="l"><span>Com a usina, você pagou</span><div class="b" style="width:${Math.max((r.pago / max) * 100, 18)}%;background:#1d6b3a">${brl(r.pago)}</div></div>
      </div>
      <p class="mini">Mesmo com a usina sempre fica um valor mínimo na conta: a taxa de disponibilidade da CPFL e a iluminação pública.</p>
      <h2>O caminho da sua energia</h2>
      <div class="fluxo">
        <div><div class="ic">☀️</div><b>${n(r.geracao)} kWh</b><span>o sol gerou no período${r.origem === 'estimada' ? ' (estimado: faltaram dias na plataforma)' : ''}</span></div>
        <div><div class="ic">🏠</div><b>${n(r.autoconsumo)} kWh</b><span>sua casa usou na hora, direto do telhado</span></div>
        <div><div class="ic">🔌</div><b>${n(r.injetada)} kWh</b><span>sobrou e foi para a rede, virando crédito</span></div>
      </div>
      <div class="anel"><div class="d" style="background:conic-gradient(#ff6700 0 ${pctSolGraus}deg,#e3e6ec ${pctSolGraus}deg 360deg)"><i>${n(r.pctSol * 100)}%</i></div>
        <div><b>O sol produziu o equivalente a ${n(r.pctSol * 100)}% da energia que a sua casa usou.</b><br><span class="mini">A casa consumiu ${n(r.consumoCasa)} kWh no período: ${n(r.autoconsumo)} do telhado na hora e ${n(r.rede)} da rede, pagos com os créditos.</span>
        ${r.saldo ? `<br><span class="mini">Você ainda tem <b>${n(r.saldo)} kWh</b> guardados em créditos (cerca de ${brl(r.saldoR)}), que abatem as próximas contas.</span>` : ''}</div></div>
      <h2>Geração dia a dia</h2>
      <div style="display:flex;align-items:flex-end;gap:2px;height:120px;border-bottom:1px solid #e3e6ec">${barras || '<p class="mini">Sem leitura diária da plataforma neste período.</p>'}</div>
      <p class="mini">${r.melhor ? `Melhor dia: ${dataBR(r.melhor.dia)}, com ${n(r.melhor.kwh, 1)} kWh. ` : ''}Dias nublados geram menos, e os créditos equilibram ao longo do ano.</p>
      ${hs.length > 1 ? `<h2>Sua economia conta a conta</h2><div class="hist">${hs.map((x) => `<div style="height:${Math.max((x.e / maxH) * 100, 4)}%"><span>${brl(x.e)}</span></div>`).join('')}</div>
        <div class="hist-r">${hs.map((x) => `<span>${esc(x.h.referencia || MESES[+x.h.leitura_fim.slice(5, 7) - 1].slice(0, 3) + '/' + x.h.leitura_fim.slice(2, 4))}</span>`).join('')}</div>
        <p class="mini">Somando estas ${hs.length} contas: <b>${brl(totalH)}</b> que ficaram no seu bolso.</p>` : ''}
      <div class="tres"><div><span>Economia nesta conta</span><b>${brl(r.economia)}</b></div><div><span>No ritmo de 12 meses</span><b>${brl(r.ano)}</b></div><div><span>Desempenho da usina</span><b>${r.desempenho === null ? '—' : n(r.desempenho * 100) + '%'}</b></div></div>
      <h2>Tudo certo com a sua usina?</h2>
      <p>${r.desempenho !== null && r.desempenho < 0.8 ? 'A usina gerou abaixo do esperado neste período. Pode ser clima, sujeira ou sombra: vamos verificar e falar com você.' : 'Sim. A usina está gerando o esperado, e seguimos acompanhando todos os dias.'}</p>
      <div class="qr" style="border-style:solid;border-color:#ff6700"><div style="font-size:30px">🎁</div><div><b>Conhece alguém que paga caro de luz?</b><br><span class="mini">Indique para a Chama Solar. Se fechar, você ganha um presente de agradecimento.</span></div></div>
      <p class="mini" style="margin-top:14px">Como calculamos: geração lida da plataforma do inversor entre as datas de leitura da conta; consumo da casa = energia da rede + o que a casa usou direto do sol; conta sem solar = consumo da casa × tarifa de R$ ${n(r.tarifa, 2)}/kWh + iluminação pública.</p>
      <p class="mini">Chama Solar · ${esc(D.empresa.endereco)} · ${esc(D.empresa.telefone)}</p>`;
    raiz.Documentos.abrir(raiz.Documentos.pagina(`Sua economia · ${mesRef} · ${u.cliente_nome}`, corpo));
  }
  function mensagemFatura(u, linhas, f) {
    const r = periodoFatura(u, linhas, f), nome = String(u.cliente_nome).split(' ')[0];
    return `Oi ${nome}! Aqui é o ${D.empresa.vendedor}, da Chama Solar ☀️\n\nFiz o raio-x da sua conta de ${f.referencia || MESES[+r.fim.slice(5, 7) - 1]}:\n☀️ Sua usina gerou ${n(r.geracao)} kWh\n🏠 O sol produziu o equivalente a ${n(r.pctSol * 100)}% do que a casa usou\n💰 Sem a usina a conta seria ${brl(r.semSolar)}. Você pagou ${brl(r.pago)}: economia de ${brl(r.economia)}!\n${r.saldo ? `🔋 Ainda tem ${n(r.saldo)} kWh de crédito guardado.\n` : ''}\nTe mando o relatório completo em PDF. Conhece alguém pagando caro de luz? Me indica, tem presente de agradecimento 🎁`;
  }

  raiz.Usinas = { MARCAS, situacao, lerPlanilha, relatorio, mensagem, iso, periodoFatura, relatorioFatura, mensagemFatura };
})(window);
