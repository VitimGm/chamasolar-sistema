/* =====================================================================
   EDITOR DO TELHADO — foto de satélite (Google) ou do drone, águas
   desenhadas/ajustadas por cima e o 3D ao lado, ao vivo.
   Resultado fica em orc.projeto3d: águas, obstáculos, foto, perdas
   medidas (orientação e sombra) e as imagens para a proposta.
   ===================================================================== */
(function (raiz) {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const n = (v, c = 0) => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c });
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const PONTOS = ['norte', 'nordeste', 'leste', 'sudeste', 'sul', 'sudoeste', 'oeste', 'noroeste'];
  const ponto = (a) => PONTOS[Math.round((((a % 360) + 360) % 360) / 45) % 8];
  const INCL_PADRAO = { ceramico: 20, fibrocimento: 10, metalico: 8, laje: 0, solo: 0 };

  function abrir({ orc, placasKit, tipoTelhado, aoSalvar }) {
    const U = raiz.Usina3D, B = raiz.Banco;
    const proj = orc.projeto3d ? JSON.parse(JSON.stringify(orc.projeto3d)) : { lat: -21.1775, lng: -47.8103, ladoM: 60, aguas: [], obst: [], hw: 3 };
    proj.tipoTelhado = tipoTelhado || orc.telhado || 'ceramico';
    const est = { modo: 'mover', sel: proj.aguas.length ? 0 : -1, nova: [], placas: proj.placasKit || placasKit || 12, arrasto: null, apontar: false, mes: 5, hora: 9.5 };
    proj.placasKit = est.placas;
    const end0 = proj.endereco || [orc.contrato && orc.contrato.rua, orc.contrato && orc.contrato.numero, orc.contrato && orc.contrato.bairro, orc.cidade].filter(Boolean).join(', ');
    const ov = document.createElement('div'); ov.className = 't3-ov';
    ov.innerHTML = `<div class="t3-caixa" role="dialog" aria-label="Telhado e projeto 3D">
      <div class="entre t3-cab"><div><b style="font-size:18px">Telhado e projeto 3D</b><br><span class="mini">${esc(orc.nome || '')}</span></div><button class="link" data-x>fechar</button></div>
      <div class="t3-barra">
        <input type="text" id="t3End" placeholder="Rua, número, bairro, cidade" value="${esc(end0)}">
        <button class="btn sol pequeno" id="t3Buscar">🛰️ Buscar pelo endereço</button>
        <label class="btn vidro pequeno" style="cursor:pointer">📷 Foto do drone<input type="file" id="t3Arq" accept="image/*" hidden></label>
        <label class="mini" id="t3LadoW" ${proj.fonte === 'foto' ? '' : 'hidden'}>largura da foto (m) <input type="number" id="t3Lado" value="${proj.ladoM}" style="width:70px"></label>
      </div>
      <p class="mini t3-aviso" id="t3Msg">${proj.aguas.length ? 'Ajuste as águas na foto. O 3D e a geração acompanham na hora.' : 'Busque pelo endereço (as águas vêm prontas do Google) ou envie a foto de cima do drone e desenhe as águas.'}</p>
      <div class="t3-corpo">
        <div class="t3-esq">
          <div class="t3-ferr" role="group" aria-label="Ferramenta">
            <button data-modo="mover">✋ Ajustar</button><button data-modo="nova">➕ Nova água</button><button data-modo="arvore">🌳 Árvore/prédio</button><button data-modo="caixa">💧 Caixa d'água</button><button id="t3Apontar" title="Quando o Google pegou a casa errada">📍 Casa errada?</button>
          </div>
          <div class="t3-foto"><canvas id="t3Cv" width="1024" height="1024"></canvas></div>
          <div class="t3-agua" id="t3Agua"></div>
        </div>
        <div class="t3-dir">
          <div class="t3-3d" id="t3Cena"><span class="mini t3-carr">carregando o 3D…</span></div>
          <div class="grade g2" style="gap:8px">
            <label class="campo"><span>Mês <b id="t3MesO">junho</b></span><input type="range" id="t3Mes" min="0" max="11" value="5"></label>
            <label class="campo"><span>Hora <b id="t3HoraO">09:30</b></span><input type="range" id="t3Hora" min="6" max="18" step="0.25" value="9.5"></label>
          </div>
          <label class="campo"><span>Placas do kit <b id="t3PlO">${est.placas}</b></span><input type="range" id="t3Pl" min="1" max="${Math.max(80, est.placas * 2)}" value="${est.placas}"></label>
          <div class="t3-res" id="t3Res"></div>
          <div class="acoes-r"><button class="btn vidro pequeno" id="t3Topo">Vista de cima</button><button class="btn sol" id="t3Salvar">Salvar no orçamento</button></div>
        </div>
      </div></div>`;
    document.body.appendChild(ov);
    const cv = $('#t3Cv', ov), g = cv.getContext('2d'); let img = null, viewer = null, temporizador = null;
    const msg = (t, ruim) => { const el = $('#t3Msg', ov); el.textContent = t; el.classList.toggle('ruim', !!ruim); };
    const m2px = (p) => [(p[0] / proj.ladoM + 0.5) * 1024, (p[1] / proj.ladoM + 0.5) * 1024];
    const px2m = (x, y) => [(x / 1024 - 0.5) * proj.ladoM, (y / 1024 - 0.5) * proj.ladoM];
    function carregarImg() { img = null; if (!proj.img) { desenhar(); return; } const im = new Image(); im.onload = () => { img = im; desenhar(); }; im.src = proj.img; }

    /* ---------- 2D ---------- */
    function desenhar() {
      g.clearRect(0, 0, 1024, 1024);
      if (img) g.drawImage(img, 0, 0, 1024, 1024); else { g.fillStyle = '#2b3a2a'; g.fillRect(0, 0, 1024, 1024); g.fillStyle = '#fff8'; g.font = '28px sans-serif'; g.textAlign = 'center'; g.fillText('Busque o endereço ou envie a foto do drone', 512, 512); }
      const dist = proj.aguas.length ? U.distribuir(proj, est.placas) : { por: {} };
      proj.aguas.forEach((a, i) => {
        const f = a.usar ? U.fatorAgua(proj.lat, a.incl, a.az) : 0, cor = !a.usar ? '150,150,150' : f > 0.95 ? '40,170,90' : f > 0.85 ? '255,176,0' : '230,80,60';
        g.beginPath(); a.pts.forEach((p, k) => { const q = m2px(p); k ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }); g.closePath();
        g.fillStyle = `rgba(${cor},${i === est.sel ? 0.35 : 0.22})`; g.fill(); g.lineWidth = i === est.sel ? 5 : 3; g.strokeStyle = `rgb(${cor})`; g.stroke();
        // seta para onde a água cai
        const c = m2px(U.centroide(a.pts)), d = [Math.sin(a.az * Math.PI / 180), -Math.cos(a.az * Math.PI / 180)], L = 40;
        g.strokeStyle = '#fff'; g.lineWidth = 4; g.beginPath(); g.moveTo(c[0] - d[0] * L, c[1] - d[1] * L); g.lineTo(c[0] + d[0] * L, c[1] + d[1] * L); g.stroke();
        g.beginPath(); g.moveTo(c[0] + d[0] * L, c[1] + d[1] * L); g.lineTo(c[0] + d[0] * (L - 14) - d[1] * 10, c[1] + d[1] * (L - 14) + d[0] * 10); g.lineTo(c[0] + d[0] * (L - 14) + d[1] * 10, c[1] + d[1] * (L - 14) - d[0] * 10); g.closePath(); g.fillStyle = '#fff'; g.fill();
        g.font = 'bold 18px sans-serif'; g.textAlign = 'center'; g.lineWidth = 4; g.strokeStyle = '#000a'; const tx = `${a.incl}° · ${ponto(a.az)}`; g.strokeText(tx, c[0], c[1] - L - 10); g.fillText(tx, c[0], c[1] - L - 10);
        (dist.por[i] || []).forEach((q) => { const z = m2px(q); g.fillStyle = '#132a5ccc'; g.fillRect(z[0] - 5, z[1] - 5, 10, 10); });
        if (i === est.sel && est.modo === 'mover') a.pts.forEach((p) => { const q = m2px(p); g.fillStyle = '#fff'; g.beginPath(); g.arc(q[0], q[1], 9, 0, 7); g.fill(); g.strokeStyle = '#ff6700'; g.lineWidth = 3; g.stroke(); });
      });
      if (est.nova.length) { g.strokeStyle = '#ffb000'; g.lineWidth = 4; g.beginPath(); est.nova.forEach((p, k) => { const q = m2px(p); k ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }); g.stroke(); est.nova.forEach((p, k) => { const q = m2px(p); g.fillStyle = k ? '#ffb000' : '#ff6700'; g.beginPath(); g.arc(q[0], q[1], k ? 7 : 11, 0, 7); g.fill(); }); }
      (proj.obst || []).forEach((o) => { const q = m2px([o.x, o.z]); g.strokeStyle = '#fff'; g.lineWidth = 4; g.beginPath(); g.arc(q[0], q[1], 18, 0, 7); g.stroke(); g.fillStyle = '#fff'; g.font = 'bold 16px sans-serif'; g.textAlign = 'center'; g.fillText(o.tipo === 'caixa' ? '💧' : o.h + ' m', q[0], q[1] - 24); });
      g.fillStyle = '#fff'; g.font = 'bold 22px sans-serif'; g.textAlign = 'right'; g.fillText('N ↑', 1004, 34);
      if (proj.fonte === 'google') { g.font = '14px sans-serif'; g.fillStyle = '#fffd'; g.textAlign = 'left'; g.fillText('Imagens © Google', 10, 1014); }
      painelAgua();
    }
    function painelAgua() {
      const el = $('#t3Agua', ov), a = proj.aguas[est.sel];
      if (est.modo === 'nova') { el.innerHTML = '<p class="mini">Toque nos cantos da água. Comece pelos 2 cantos da parte de baixo (o beiral). Toque no primeiro ponto para fechar.</p>'; return; }
      if (!a) { el.innerHTML = `<p class="mini">${proj.aguas.length ? 'Toque numa água para ajustar.' : 'Nenhuma água ainda.'} Verde: ótima para placas · amarelo: boa · vermelho: fraca.</p>`; return; }
      el.innerHTML = `<div class="entre"><b>Água ${est.sel + 1}${a.fonte === 'google' ? ' <span class="mini">(veio do Google)</span>' : ''}</b><span class="mini">${n(U.areaPol(a.pts) / Math.cos(a.incl * Math.PI / 180), 0)} m² de telhado</span></div>
        <div class="grade g2" style="gap:8px;margin-top:6px">
          <label class="campo"><span>Inclinação <b>${a.incl}°</b></span><input type="range" min="0" max="45" value="${a.incl}" data-ag="incl"></label>
          <label class="campo"><span>Cai para o <b>${ponto(a.az)} (${a.az}°)</b></span><input type="range" min="0" max="355" step="5" value="${a.az}" data-ag="az"></label></div>
        <div class="acoes-r" style="margin-top:6px"><label class="chk"><input type="checkbox" data-ag="usar" ${a.usar ? 'checked' : ''}> usar para placas</label><button class="link" data-ag="inverter">inverter caimento</button><button class="link" data-ag="apagar">apagar água</button></div>`;
    }
    ov.addEventListener('input', (e) => {
      const k = e.target.dataset.ag, a = proj.aguas[est.sel];
      if (k && a) { if (k === 'incl' || k === 'az') { a[k] = +e.target.value; desenhar(); refazer(); } return; }
      if (e.target.id === 't3Mes' || e.target.id === 't3Hora') { est.mes = +$('#t3Mes', ov).value; est.hora = +$('#t3Hora', ov).value; $('#t3MesO', ov).textContent = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'][est.mes]; $('#t3HoraO', ov).textContent = `${String(Math.floor(est.hora)).padStart(2, '0')}:${String(Math.round((est.hora % 1) * 60)).padStart(2, '0')}`; if (viewer) viewer.sol(est.mes, est.hora); }
      if (e.target.id === 't3Pl') { est.placas = +e.target.value; proj.placasKit = est.placas; $('#t3PlO', ov).textContent = est.placas; desenhar(); refazer(); }
      if (e.target.id === 't3Lado') { const v = +e.target.value; if (v >= 10) { proj.ladoM = v; desenhar(); if (viewer) viewer.chao(); refazer(); } }
    });
    ov.addEventListener('change', async (e) => {
      const k = e.target.dataset.ag, a = proj.aguas[est.sel];
      if (k === 'usar' && a) { a.usar = e.target.checked; desenhar(); refazer(); }
      if (e.target.id === 't3Arq') {
        const f = e.target.files[0]; if (!f) return;
        const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = c.height = 1024; const lado = Math.min(im.width, im.height); c.getContext('2d').drawImage(im, (im.width - lado) / 2, (im.height - lado) / 2, lado, lado, 0, 0, 1024, 1024); URL.revokeObjectURL(im.src);
          proj.img = c.toDataURL('image/jpeg', 0.82); proj.fonte = 'foto'; proj.aguas = []; proj.obst = []; est.sel = -1; $('#t3LadoW', ov).hidden = false; carregarImg(); if (viewer) viewer.chao(); modo('nova'); refazer();
          msg('Foto carregada. Coloque a largura que a foto mostra, em metros, e desenhe cada água. A foto precisa estar com o norte para cima.'); };
        im.src = URL.createObjectURL(f);
      }
    });
    ov.addEventListener('click', async (e) => {
      if (e.target === ov || e.target.closest('[data-x]')) { fechar(); return; }
      const m = e.target.closest('[data-modo]'); if (m) { modo(m.dataset.modo); return; }
      const k = e.target.closest('[data-ag]'); const a = proj.aguas[est.sel];
      if (k && a && k.dataset.ag === 'inverter') { a.az = (a.az + 180) % 360; desenhar(); refazer(); }
      if (k && a && k.dataset.ag === 'apagar') { proj.aguas.splice(est.sel, 1); est.sel = -1; desenhar(); refazer(); }
      if (e.target.id === 't3Buscar') buscar({ endereco: $('#t3End', ov).value });
      if (e.target.id === 't3Apontar') { est.apontar = true; msg('Toque no telhado certo na foto.'); }
      if (e.target.id === 't3Topo') { const t = e.target.dataset.on !== '1'; e.target.dataset.on = t ? '1' : ''; e.target.textContent = t ? 'Vista 3D' : 'Vista de cima'; if (viewer) viewer.topo(t); }
      if (e.target.id === 't3Salvar') salvar();
    });
    function modo(mm) { est.modo = mm; est.nova = []; ov.querySelectorAll('[data-modo]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.modo === mm))); desenhar(); }

    /* ponteiro no 2D */
    const ponto2 = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * 1024, (e.clientY - r.top) / r.height * 1024]; };
    cv.addEventListener('pointerdown', (e) => {
      const [x, y] = ponto2(e), pm = px2m(x, y);
      if (est.apontar) { est.apontar = false; const c = inverso(pm); buscar({ lat: c.lat, lng: c.lng }); return; }
      if (est.modo === 'nova') {
        if (est.nova.length >= 3) { const q = m2px(est.nova[0]); if (Math.hypot(q[0] - x, q[1] - y) < 22) { fecharNova(); return; } }
        est.nova.push(pm); desenhar(); return;
      }
      if (est.modo === 'arvore' || est.modo === 'caixa') {
        const i = (proj.obst || []).findIndex((o) => { const q = m2px([o.x, o.z]); return Math.hypot(q[0] - x, q[1] - y) < 22; });
        if (i >= 0) proj.obst.splice(i, 1); else (proj.obst = proj.obst || []).push({ x: pm[0], z: pm[1], h: est.modo === 'arvore' ? 8 : 0, tipo: est.modo });
        desenhar(); refazer(); return;
      }
      // ajustar: canto da água selecionada, ou selecionar/mover água
      const a = proj.aguas[est.sel];
      if (a) { const k = a.pts.findIndex((p) => { const q = m2px(p); return Math.hypot(q[0] - x, q[1] - y) < 20; }); if (k >= 0) { est.arrasto = { tipo: 'canto', k }; cv.setPointerCapture(e.pointerId); return; } }
      const i = proj.aguas.findIndex((ag) => U.dentro(pm, ag.pts));
      est.sel = i; if (i >= 0) { est.arrasto = { tipo: 'agua', de: pm }; cv.setPointerCapture(e.pointerId); } desenhar();
    });
    cv.addEventListener('pointermove', (e) => {
      if (!est.arrasto) return; const pm = px2m(...ponto2(e)), a = proj.aguas[est.sel]; if (!a) return;
      if (est.arrasto.tipo === 'canto') a.pts[est.arrasto.k] = pm;
      else { const dx = pm[0] - est.arrasto.de[0], dz = pm[1] - est.arrasto.de[1]; a.pts = a.pts.map((p) => [p[0] + dx, p[1] + dz]); est.arrasto.de = pm; }
      a.fonte = 'ajustada'; desenhar();
    });
    cv.addEventListener('pointerup', () => { if (est.arrasto) { est.arrasto = null; refazer(); } });
    cv.addEventListener('dblclick', () => { if (est.modo === 'nova' && est.nova.length >= 3) fecharNova(); });
    function fecharNova() {
      const pts = est.nova; est.nova = [];
      const c = U.centroide(pts), meio = [(pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2], ed = [pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]];
      let nrm = [ed[1], -ed[0]]; if (nrm[0] * (meio[0] - c[0]) + nrm[1] * (meio[1] - c[1]) < 0) nrm = [-nrm[0], -nrm[1]]; // aponta para fora pelo beiral
      const az = Math.round(((Math.atan2(nrm[0], -nrm[1]) * 180 / Math.PI) + 360) % 360 / 5) * 5;
      proj.aguas.push({ pts, incl: INCL_PADRAO[proj.tipoTelhado] ?? 20, az, usar: true, fonte: 'desenhada' });
      est.sel = proj.aguas.length - 1; modo('mover'); refazer();
    }
    function inverso(pm) { // metros na foto → lat/lng
      const r = U.resolucao(proj.lat, 20), N = 256 * Math.pow(2, 20), s = Math.sin(proj.lat * Math.PI / 180);
      const cx = (proj.lng + 180) / 360 * N, cy = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * N, X = cx + pm[0] / r, Y = cy + pm[1] / r;
      return { lng: X / N * 360 - 180, lat: Math.atan(Math.sinh(Math.PI * (1 - 2 * Y / N))) * 180 / Math.PI };
    }

    /* ---------- Google ---------- */
    async function buscar(q) {
      if (!B.telhado) { msg('A busca por satélite funciona na versão dentro do Chamae. Aqui no teste, use a foto do drone.', true); return; }
      msg('Buscando o imóvel e o telhado no Google…');
      try {
        const r = await B.telhado(q); if (r.erro) throw new Error(r.erro);
        Object.assign(proj, { lat: r.lat, lng: r.lng, endereco: r.endereco || proj.endereco, precisao: r.precisao, qualidade: r.qualidade, data: r.data, fonte: 'google', ladoM: 60 });
        $('#t3LadoW', ov).hidden = true;
        msg('Baixando a foto de satélite…');
        const f = await U.fotoSatelite(proj, (z, x, y) => B.tile(z, x, y), proj.ladoM); proj.img = f.img;
        proj.aguas = U.aguasDoGoogle(proj, r); proj.obst = []; est.sel = proj.aguas.length ? 0 : -1;
        carregarImg(); if (viewer) viewer.chao(); refazer();
        const dt = r.data ? `${String(r.data.month).padStart(2, '0')}/${r.data.year}` : '';
        msg(proj.aguas.length ? `${proj.aguas.length} água(s) achadas pelo Google (foto de ${dt}, precisão ${r.qualidade === 'HIGH' ? 'alta' : r.qualidade === 'MEDIUM' ? 'média' : 'básica'}). Confira os cantos, a inclinação e marque árvores e caixa d'água.${r.precisao && r.precisao !== 'ROOFTOP' ? ' Atenção: o endereço foi achado por aproximação. Se não for esta casa, use "Casa errada?".' : ''}` : (r.aviso || 'O Google não tem as águas deste telhado: desenhe na foto com "Nova água".'));
        if (!proj.aguas.length) modo('nova');
      } catch (err) { msg('Não consegui buscar: ' + err.message, true); }
    }

    /* ---------- 3D ---------- */
    function refazer() { clearTimeout(temporizador); temporizador = setTimeout(() => { if (viewer) viewer.montar(); }, 250); }
    function mostrarRes(r) {
      const p = raiz.Banco && raiz.Banco.parametros ? raiz.Banco.parametros() : {}; void p;
      $('#t3Res', ov).innerHTML = `<div class="kpis" style="margin:8px 0">
        <div class="kpi"><span class="rotulo">Placas no telhado</span><b>${r.placas}${r.faltam ? ' / ' + est.placas : ''}</b><span class="sutil">${r.faltam ? `<span style="color:var(--laranja)">faltou espaço para ${r.faltam}</span>` : `cabem até ${r.cabem}`}</span></div>
        <div class="kpi"><span class="rotulo">Perda pela direção</span><b>${n(r.perdaOri * 100, 1)}%</b><span class="sutil">contra o ideal (norte)</span></div>
        <div class="kpi"><span class="rotulo">Perda por sombra</span><b>${n(r.perdaSom * 100, 1)}%</b><span class="sutil" id="t3SolTxt">medida no ano todo</span></div></div>
        <p class="mini">A perda total (${n(r.perda * 100, 1)}%) substitui a perda de segurança de ${n(((raiz.Banco && raiz.Banco.parametros().perdaOrientacao) ?? 0.07) * 100)}% no dimensionamento e na geração do contrato.</p>`;
    }
    U.carregarThree().then(() => {
      const box = $('#t3Cena', ov); box.innerHTML = '';
      viewer = U.criar(box, proj, { placas: () => est.placas, aoCalcular: mostrarRes, manterCamera: true, aoSol: (k, dia) => { const el = $('#t3SolTxt', ov); if (el) el.textContent = !dia ? 'noite' : k ? `${k} placa(s) na sombra agora` : 'medida no ano todo'; } });
      viewer.sol(est.mes, est.hora);
    }).catch((e) => { $('#t3Cena', ov).innerHTML = `<p class="mini" style="padding:20px">${esc(e.message)}. Confira a internet.</p>`; });
    carregarImg(); modo(proj.aguas.length ? 'mover' : 'nova');
    if (!proj.aguas.length && end0 && B.telhado) buscar({ endereco: end0 });

    function salvar() {
      if (!viewer) return;
      const r = viewer.montar();
      if (!r.placas) { msg('Nenhuma placa coube nas águas marcadas como "usar". Ajuste antes de salvar.', true); return; }
      const fotos = { d3: viewer.foto(false), topo: viewer.foto(true) };
      const fim = { ...proj, placasKit: est.placas, resultado: { placas: r.placas, porAgua: r.porAgua, perdaOri: r.perdaOri, perdaSom: r.perdaSom, perda: r.perda, cabem: r.cabem }, perda: r.perda, fotos, salvoEm: new Date().toISOString() };
      aoSalvar(fim); fechar();
    }
    function fechar() { if (viewer) viewer.destruir(); ov.remove(); }
  }

  raiz.Telhado = { abrir };
})(window);
