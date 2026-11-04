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

  raiz.Usinas = { MARCAS, situacao, lerPlanilha, relatorio, mensagem, iso };
})(window);
