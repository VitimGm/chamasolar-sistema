/* =====================================================================
   EDITOR DO PROJETO 3D (v2) — em 5 passos curtos:
   1 Foto      satélite pelo endereço e/ou foto do drone (escala e norte)
   2 Telhados  cada parte do telhado: altura, inclinação, caimento, platibanda
   3 Obstáculos caixa d'água, condensadora, respiro, árvore, prédio
   4 Placas    medida real da placa do kit, espaços, borda e corredor
   5 Sol       o dia passando, sombra placa a placa e geração (PVGIS)
   ===================================================================== */
(function (raiz) {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const n = (v, c = 0) => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c });
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const PONTOS = ['norte', 'nordeste', 'leste', 'sudeste', 'sul', 'sudoeste', 'oeste', 'noroeste'];
  const ponto = (a) => PONTOS[Math.round((((a % 360) + 360) % 360) / 45) % 8];
  const CORES = ['#ff8a3d', '#3db4ff', '#b48cff', '#3ddc97', '#ffd23d', '#ff5c8a', '#5cf0ff', '#c0ff5c'];
  const pct = (graus) => Math.round(Math.tan(graus * Math.PI / 180) * 100);
  const grausDe = (p) => Math.round(Math.atan((Number(p) || 0) / 100) * 180 / Math.PI * 10) / 10;
  const ICONE = { caixa: '💧', ar: '❄️', respiro: '🔩', arvore: '🌳', predio: '🏢' };
  const hhmm = (h) => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;

  function abrir({ orc, modulo, qtd, tipoTelhado, aba, aoSalvar }) {
    const U = raiz.Usina3D, B = raiz.Banco, P = (B.parametros && B.parametros()) || {};
    const proj = U.migrar(orc.projeto3d ? JSON.parse(JSON.stringify(orc.projeto3d)) : null) || { versao: 2, lat: -21.1775, lng: -47.8103, blocos: [], obst: [] };
    proj.versao = 2; proj.blocos = proj.blocos || []; proj.obst = proj.obst || []; proj.tipoTelhado = tipoTelhado || proj.tipoTelhado || 'metalico';
    proj.layout = Object.assign({ entrePlacasMm: 20, entreFileirasMm: 20, bordaM: 0.3, corredorM: 0.6, corredorCada: 0, forcarOn: [], forcarOff: [] }, proj.layout || {});
    // placa: a do kit (medida pela ficha), ou a que já estava no projeto (com as medidas que o vendedor conferiu)
    const modAnt = proj.layout.modulo, nomeKit = modulo ? (((modulo.marca && !String(modulo.nome || '').toLowerCase().includes(String(modulo.marca).toLowerCase())) ? modulo.marca + ' ' : '') + (modulo.nome || '')).trim() || `Placa ${modulo.potenciaW} W` : null;
    if (modAnt && modAnt.c && (!modulo || (modAnt.nome === nomeKit && modAnt.potW === modulo.potenciaW))) proj.layout.modulo = modAnt;
    else { const w = (modulo && modulo.potenciaW) || (modAnt && modAnt.potW) || 615, med = U.medidasModulo(modulo ? `${modulo.sku || ''} ${modulo.nome || ''}` : modAnt && modAnt.nome, w); proj.layout.modulo = { nome: nomeKit || (modAnt && modAnt.nome) || `Placa ${w} W`, potW: w, c: med.c, l: med.l, estimada: true }; }
    if (qtd) { if (proj.layout.qtd !== qtd) { proj.layout.forcarOn = []; proj.layout.forcarOff = []; } proj.layout.qtd = qtd; } else proj.layout.qtd = proj.layout.qtd || 12;
    const cid = (raiz.DadosTeste && raiz.DadosTeste.cidades) || {}, hsp = (cid[orc.cidade] || cid['Ribeirão Preto'] || { hsp: 5.4 }).hsp, pr = P.pr || 0.776;
    const st = { aba: aba || (proj.blocos.length ? 'telhados' : 'foto'), ferr: null, sel: null, des: [], ponteiro: null, view: { esc: 14, ox: 0, oz: 0 }, vagas: [], escolhidas: [], analisado: false, ocupado: false, ver: 0, di: 6, hora: 9.5, play: false, regua: [], alfaDrone: 1, corPlacas: 'tsrf', mapas: false, imgsNovas: {} };

    const ov = document.createElement('div'); ov.className = 't3-ov';
    ov.innerHTML = `<div class="t3-caixa" role="dialog" aria-label="Projeto 3D do telhado">
      <div class="entre t3-cab"><div><b style="font-size:18px">Projeto 3D do telhado</b> <span class="mini">${esc(orc.nome || '')}</span></div><button class="link" data-x>fechar sem salvar</button></div>
      <nav class="t3-passos" id="t3Abas">${[['foto', '1 Foto'], ['telhados', '2 Telhados'], ['obst', '3 Obstáculos'], ['placas', '4 Placas'], ['sol', '5 Sol e sombra']].map(([k, t]) => `<button data-aba="${k}">${t}</button>`).join('')}</nav>
      <p class="t3-aviso" id="t3Msg"></p>
      <div class="t3-corpo">
        <div class="t3-esq">
          <div class="t3-foto" id="t3Tela"><canvas id="t3Cv"></canvas>
            <div class="t3-zoom"><button data-zoom="1" aria-label="Aproximar">＋</button><button data-zoom="-1" aria-label="Afastar">－</button><button data-zoom="0" aria-label="Centralizar">⌖</button></div></div>
          <div class="t3-painel" id="t3Painel"></div>
        </div>
        <div class="t3-dir">
          <div class="t3-3d" id="t3Cena"><span class="mini t3-carr">carregando o 3D…</span></div>
          <div id="t3Lado"></div>
          <div class="acoes-r"><button class="btn vidro pequeno" id="t3Topo">Vista de cima</button><button class="btn sol" id="t3Salvar">Salvar no orçamento</button></div>
        </div>
      </div></div>`;
    document.body.appendChild(ov);
    const cv = $('#t3Cv', ov), g = cv.getContext('2d'), tela = $('#t3Tela', ov);
    let viewer = null, imgFundo = null, imgDrone = null, refazerT = null;
    const msg = (t, ruim) => { const el = $('#t3Msg', ov); el.innerHTML = t; el.classList.toggle('ruim', !!ruim); };

    function enderecoOrc() { const k = orc.contrato || {}; return [[k.rua, k.numero].filter(Boolean).join(', '), k.bairro, k.cidade || orc.cidade, k.cep || orc.cep].filter(Boolean).join(' - '); }

    /* ---------- imagens ---------- */
    const carregarImg = (url) => new Promise((ok) => { if (!url) return ok(null); const im = new Image(); im.onload = () => ok(im); im.onerror = () => ok(null); im.src = url; });
    async function prepararImagens() {
      if (proj.fundo && !proj.fundo.img && proj.fundo.id && B.lerImagem) proj.fundo.img = await B.lerImagem(proj.fundo.id).catch(() => null);
      if (proj.drone && !proj.drone.img && proj.drone.id && B.lerImagem) proj.drone.img = await B.lerImagem(proj.drone.id).catch(() => null);
      imgFundo = proj.fundo ? await carregarImg(proj.fundo.img || proj.fundo.mini) : null;
      imgDrone = proj.drone ? await carregarImg(proj.drone.img || proj.drone.mini) : null;
      desenhar(); if (viewer) viewer.recarregarFundo();
    }

    /* ---------- vista 2D ---------- */
    const W = () => cv.width / (raiz.devicePixelRatio || 1), H = () => cv.height / (raiz.devicePixelRatio || 1);
    const tela2m = (sx, sy) => [(sx - W() / 2) / st.view.esc + st.view.ox, (sy - H() / 2) / st.view.esc + st.view.oz];
    const m2tela = (p) => [(p[0] - st.view.ox) * st.view.esc + W() / 2, (p[1] - st.view.oz) * st.view.esc + H() / 2];
    ov._t3 = { st, proj, m2tela, tela2m }; // para os testes automáticos e para diagnosticar um erro na tela
    function tamanhoCv() { const r = tela.getBoundingClientRect(), dpr = raiz.devicePixelRatio || 1; cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); cv.style.width = r.width + 'px'; cv.style.height = r.height + 'px'; g.setTransform(dpr, 0, 0, dpr, 0, 0); desenhar(); }
    function centralizar() {
      const pts = proj.blocos.flatMap((b) => b.pts); let c = [0, 0], r = 20;
      if (pts.length) { c = U.centroide(pts); r = Math.max(6, ...pts.map((p) => Math.hypot(p[0] - c[0], p[1] - c[1]))) + 3; }
      else if (proj.drone) { c = [proj.drone.cx || 0, proj.drone.cz || 0]; r = Math.max(proj.drone.w, proj.drone.h) * proj.drone.escala / 2; }
      else if (proj.fundo) r = proj.fundo.ladoM / 2;
      st.view.ox = c[0]; st.view.oz = c[1]; st.view.esc = Math.min(W(), H()) / (2 * r); desenhar();
    }
    function desenhar() {
      const w = W(), h = H(); g.clearRect(0, 0, w, h); g.fillStyle = '#26332a'; g.fillRect(0, 0, w, h);
      if (imgFundo && proj.fundo) { const L = proj.fundo.ladoM, a = m2tela([-L / 2, -L / 2]); g.drawImage(imgFundo, a[0], a[1], L * st.view.esc, L * st.view.esc); }
      if (imgDrone && proj.drone) { const d = proj.drone, c = m2tela([d.cx || 0, d.cz || 0]); g.save(); g.globalAlpha = st.aba === 'foto' ? st.alfaDrone : 1; g.translate(c[0], c[1]); g.rotate((d.rot || 0) * Math.PI / 180); const e = d.escala * st.view.esc; g.drawImage(imgDrone, -d.w / 2 * e, -d.h / 2 * e, d.w * e, d.h * e); g.restore(); }
      if (!imgFundo && !imgDrone) { g.fillStyle = '#fff8'; g.font = '15px system-ui'; g.textAlign = 'center'; g.fillText('Busque o satélite ou envie a foto do drone (passo 1)', w / 2, h / 2); }
      const escurecer = st.aba === 'placas' || st.aba === 'sol'; if (escurecer) { g.fillStyle = '#0006'; g.fillRect(0, 0, w, h); }
      // blocos
      proj.blocos.forEach((b, i) => {
        const cor = CORES[i % CORES.length], sel = st.sel && st.sel.t === 'b' && st.sel.id === b.id;
        caminho(b.pts); g.fillStyle = cor + (escurecer ? '30' : sel ? '55' : '33'); g.fill(); g.lineWidth = sel ? 3 : 2; g.strokeStyle = cor; g.stroke();
        if (b.platibanda > 0) { caminho(U.recuar(b.pts, 0.15)); g.lineWidth = 1; g.setLineDash([4, 3]); g.stroke(); g.setLineDash([]); }
        const c = m2tela(U.centroide(b.pts)), d = U.desce(b.az), L = 26;
        if (!escurecer) seta(c, [d[0], d[1]], L, '#fff');
        if (sel && st.aba === 'telhados') rotulo(`${b.nome} · ${n(b.alturaBeiral, 1)} m · ${pct(b.incl)}%${b.platibanda > 0 ? ' · plat. ' + n(b.platibanda, 2) : ''}${b.usar ? '' : ' · sem placas'}`, c[0], c[1] - L - 8);
        else if (!escurecer || st.view.esc > 18) rotulo(`${b.nome} ${n(b.alturaBeiral, 1)} m`, c[0], c[1] + (escurecer ? 4 : -L - 8));
        if (sel && st.aba === 'telhados') {
          b.pts.forEach((p, k) => { const q = b.pts[(k + 1) % b.pts.length], a = m2tela(p), z = m2tela(q), mid = [(a[0] + z[0]) / 2, (a[1] + z[1]) / 2], len = Math.hypot(q[0] - p[0], q[1] - p[1]);
            rotulo(n(len, 2) + ' m', mid[0], mid[1] + 14, '#ffd23d');
            const nr = normalFora(b, k); g.fillStyle = '#ffb000'; g.beginPath(); g.arc(mid[0] + nr[0] * 16, mid[1] + nr[1] * 16, 9, 0, 7); g.fill(); seta([mid[0] + nr[0] * 10, mid[1] + nr[1] * 10], nr, 12, '#1a1205');
            g.fillStyle = '#fff'; g.beginPath(); g.arc(a[0], a[1], 7, 0, 7); g.fill(); g.strokeStyle = cor; g.lineWidth = 3; g.stroke(); });
        }
      });
      // obstáculos
      proj.obst.forEach((o) => { const pg = U.pegadaObst(o), sel = st.sel && st.sel.t === 'o' && st.sel.id === o.id; caminho(pg); g.fillStyle = o.tipo === 'arvore' ? '#2f7d3a99' : '#ffffffaa'; g.fill(); g.strokeStyle = sel ? '#ffb000' : '#222'; g.lineWidth = sel ? 3 : 1.5; g.stroke(); if (escurecer && !sel) return; const c = m2tela([o.x, o.z]); rotulo(`${ICONE[o.tipo] || ''} ${n(o.h ?? U.OBST[o.tipo].h, 1)} m`, c[0], c[1] - 12); });
      // placas
      if (st.aba === 'placas' || st.aba === 'sol') {
        const esc2 = new Set(st.escolhidas.map((s) => s.k));
        st.vagas.forEach((s) => { caminho(s.cantos); if (esc2.has(s.k)) { g.fillStyle = st.analisado && s.analise ? U.corTsrf(s.analise.tsrf) : '#1c3a7a'; g.globalAlpha = 0.9; g.fill(); g.globalAlpha = 1; g.strokeStyle = '#0d1a38'; g.lineWidth = 1; g.stroke(); } else { g.strokeStyle = '#ffffff55'; g.lineWidth = 1; g.stroke(); } });
      }
      // desenho em andamento
      if (st.des.length) {
        let pts = [...st.des]; if (st.ponteiro) pts.push(st.ponteiro);
        if (st.ferr === 'ret' && pts.length === 3) pts = U.retangulo3(pts[0], pts[1], pts[2]);
        g.strokeStyle = '#ffb000'; g.lineWidth = 2; g.setLineDash([6, 4]); caminho(pts, st.ferr === 'ret' && pts.length === 4); g.stroke(); g.setLineDash([]);
        st.des.forEach((p, k) => { const q = m2tela(p); g.fillStyle = k ? '#ffb000' : '#ff6700'; g.beginPath(); g.arc(q[0], q[1], 6, 0, 7); g.fill(); });
        if (pts.length >= 2) { const a = pts[pts.length - 2], z = pts[pts.length - 1], m = m2tela([(a[0] + z[0]) / 2, (a[1] + z[1]) / 2]); rotulo(n(Math.hypot(z[0] - a[0], z[1] - a[1]), 2) + ' m', m[0], m[1] - 10, '#ffd23d'); }
      }
      if (st.regua.length) { g.strokeStyle = '#ff3df0'; g.lineWidth = 3; caminho(st.regua, false); g.stroke(); st.regua.forEach((p) => { const q = m2tela(p); g.fillStyle = '#ff3df0'; g.beginPath(); g.arc(q[0], q[1], 6, 0, 7); g.fill(); }); }
      // escala e norte
      const alvo = 80 / st.view.esc, pass = [0.5, 1, 2, 5, 10, 20, 50].find((v) => v >= alvo) || 50, bw = pass * st.view.esc;
      g.fillStyle = '#000a'; g.fillRect(10, h - 30, bw + 56, 22); g.fillStyle = '#fff'; g.fillRect(16, h - 22, bw, 5); g.font = '12px system-ui'; g.textAlign = 'left'; g.fillText(n(pass, pass < 1 ? 1 : 0) + ' m', 22 + bw, h - 15);
      g.font = 'bold 15px system-ui'; g.textAlign = 'right'; g.fillStyle = '#fff'; g.fillText('N ↑', w - 12, 22);
      if (proj.fonte === 'google' && imgFundo) { g.font = '11px system-ui'; g.fillStyle = '#fffc'; g.fillText('Imagens © Google', w - 12, h - 10); }
    }
    function caminho(pts, fechar = true) { g.beginPath(); pts.forEach((p, k) => { const q = m2tela(p); k ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }); if (fechar) g.closePath(); }
    function seta(c, d, L, cor) { const L2 = Math.hypot(d[0], d[1]) || 1, ux = d[0] / L2, uy = d[1] / L2; g.strokeStyle = cor; g.fillStyle = cor; g.lineWidth = 3; g.beginPath(); g.moveTo(c[0] - ux * L, c[1] - uy * L); g.lineTo(c[0] + ux * L, c[1] + uy * L); g.stroke(); g.beginPath(); g.moveTo(c[0] + ux * L, c[1] + uy * L); g.lineTo(c[0] + ux * (L - 9) - uy * 6, c[1] + uy * (L - 9) + ux * 6); g.lineTo(c[0] + ux * (L - 9) + uy * 6, c[1] + uy * (L - 9) - ux * 6); g.closePath(); g.fill(); }
    function rotulo(t, x, y, cor = '#fff') { g.font = 'bold 12px system-ui'; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = '#000c'; g.strokeText(t, x, y); g.fillStyle = cor; g.fillText(t, x, y); }
    function normalFora(b, k) { const p = b.pts[k], q = b.pts[(k + 1) % b.pts.length], c = U.centroide(b.pts), dx = q[0] - p[0], dz = q[1] - p[1], L = Math.hypot(dx, dz) || 1; let nr = [dz / L, -dx / L]; const mid = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; if (nr[0] * (mid[0] - c[0]) + nr[1] * (mid[1] - c[1]) < 0) nr = [-nr[0], -nr[1]]; return nr; }
    const azDe = (nr) => Math.round(((Math.atan2(nr[0], -nr[1]) * 180 / Math.PI) + 360) % 360);

    /* ---------- ponteiro: tocar, arrastar, pinçar, rolar ---------- */
    const toques = new Map(); let arrasto = null, pinca = null;
    const pos = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    cv.addEventListener('pointerdown', (e) => {
      cv.setPointerCapture(e.pointerId); toques.set(e.pointerId, pos(e));
      if (toques.size === 2) { const [a, b] = [...toques.values()]; pinca = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), esc: st.view.esc }; arrasto = null; return; }
      const sp = pos(e), m = tela2m(...sp);
      arrasto = { ini: sp, ult: sp, moveu: false, alvo: pegarAlvo(sp, m) };
    });
    cv.addEventListener('pointermove', (e) => {
      const sp = pos(e); if (toques.has(e.pointerId)) toques.set(e.pointerId, sp);
      if (pinca && toques.size === 2) { const [a, b] = [...toques.values()]; st.view.esc = Math.max(2, Math.min(200, pinca.esc * Math.hypot(a[0] - b[0], a[1] - b[1]) / pinca.d)); desenhar(); return; }
      st.ponteiro = st.des.length ? encaixar(tela2m(...sp), sp) : null;
      if (!arrasto) { if (st.des.length) desenhar(); return; }
      const dx = sp[0] - arrasto.ult[0], dy = sp[1] - arrasto.ult[1]; if (Math.hypot(sp[0] - arrasto.ini[0], sp[1] - arrasto.ini[1]) > 5) arrasto.moveu = true; arrasto.ult = sp;
      if (!arrasto.moveu) return;
      const A = arrasto.alvo, dm = [dx / st.view.esc, dy / st.view.esc];
      if (A && A.tipo === 'vertice') { const b = bloco(A.id); b.pts[A.k] = encaixar(tela2m(...sp), sp, b.id, A.k); sujar(); }
      else if (A && A.tipo === 'bloco') { const b = bloco(A.id); b.pts = b.pts.map((p) => [p[0] + dm[0], p[1] + dm[1]]); sujar(); }
      else if (A && A.tipo === 'obst') { const o = obst(A.id); o.x += dm[0]; o.z += dm[1]; sujar(); }
      else if (A && A.tipo === 'drone') { proj.drone.cx += dm[0]; proj.drone.cz += dm[1]; sujar(true); }
      else { st.view.ox -= dm[0]; st.view.oz -= dm[1]; }
      desenhar();
    });
    const fim = (e) => {
      toques.delete(e.pointerId); if (toques.size < 2) pinca = null;
      if (!arrasto) return; const a = arrasto; arrasto = null;
      if (!a.moveu) tocar(tela2m(...a.ini), a.ini, a.alvo); else if (a.alvo) { painel(); refazer(); }
    };
    cv.addEventListener('pointerup', fim); cv.addEventListener('pointercancel', fim);
    cv.addEventListener('wheel', (e) => { e.preventDefault(); const sp = pos(e), m0 = tela2m(...sp); st.view.esc = Math.max(2, Math.min(200, st.view.esc * (e.deltaY < 0 ? 1.15 : 1 / 1.15))); const m1 = tela2m(...sp); st.view.ox += m0[0] - m1[0]; st.view.oz += m0[1] - m1[1]; desenhar(); }, { passive: false });
    ov.addEventListener('click', (e) => { const z = e.target.closest('[data-zoom]'); if (!z) return; const v = +z.dataset.zoom; if (!v) centralizar(); else { st.view.esc = Math.max(2, Math.min(200, st.view.esc * (v > 0 ? 1.3 : 1 / 1.3))); desenhar(); } });
    const bloco = (id) => proj.blocos.find((b) => b.id === id), obst = (id) => proj.obst.find((o) => o.id === id);
    function pegarAlvo(sp, m) {
      if (st.aba === 'telhados' && (!st.ferr || st.ferr === 'ajustar') && st.sel && st.sel.t === 'b') {
        const b = bloco(st.sel.id); if (b) { const k = b.pts.findIndex((p) => { const q = m2tela(p); return Math.hypot(q[0] - sp[0], q[1] - sp[1]) < 13; }); if (k >= 0) return { tipo: 'vertice', id: b.id, k };
          for (let i = 0; i < b.pts.length; i++) { const p = b.pts[i], q = b.pts[(i + 1) % b.pts.length], a = m2tela(p), z = m2tela(q), nr = normalFora(b, i), c = [(a[0] + z[0]) / 2 + nr[0] * 16, (a[1] + z[1]) / 2 + nr[1] * 16]; if (Math.hypot(c[0] - sp[0], c[1] - sp[1]) < 12) return { tipo: 'caimento', id: b.id, k: i }; }
          if (U.dentro(m, b.pts)) return { tipo: 'bloco', id: b.id }; }
      }
      if (st.aba === 'obst' && st.ferr === 'ajustar') { const o = proj.obst.find((x) => U.dentro(m, U.pegadaObst(x, 0.3))); if (o) return { tipo: 'obst', id: o.id }; }
      if (st.aba === 'foto' && st.ferr === 'moverDrone' && proj.drone) return { tipo: 'drone' };
      return null;
    }
    function encaixar(m, sp, ignorarBloco, ignorarK) { // imã nos cantos dos outros telhados e no ângulo da casa
      let melhor = null, dm = 12;
      proj.blocos.forEach((b) => b.pts.forEach((p, k) => { if (b.id === ignorarBloco && k === ignorarK) return; const q = m2tela(p), d = Math.hypot(q[0] - sp[0], q[1] - sp[1]); if (d < dm) { dm = d; melhor = [...p]; } }));
      if (melhor) return melhor;
      if (st.des.length === 1 && proj.blocos.length) { // segundo ponto do retângulo: alinha ao ângulo da casa
        const ref = proj.blocos[0].pts, ang = Math.atan2(ref[1][1] - ref[0][1], ref[1][0] - ref[0][0]), a = st.des[0], L = Math.hypot(m[0] - a[0], m[1] - a[1]), angM = Math.atan2(m[1] - a[1], m[0] - a[0]);
        for (let k = 0; k < 4; k++) { const alvo = ang + k * Math.PI / 2, dif = Math.atan2(Math.sin(angM - alvo), Math.cos(angM - alvo)); if (Math.abs(dif) < 0.07) return [a[0] + L * Math.cos(alvo), a[1] + L * Math.sin(alvo)]; }
      }
      return m;
    }
    function tocar(m, sp, alvo) {
      if (st.aba === 'foto' && st.ferr === 'regua') { st.regua.push(m); if (st.regua.length > 2) st.regua = [m]; desenhar(); painel(); return; }
      if (st.aba === 'telhados') {
        if (alvo && alvo.tipo === 'caimento') { const b = bloco(alvo.id); b.az = azDe(normalFora(b, alvo.k)); sujar(); painel(); desenhar(); return; }
        if (st.ferr === 'ret' || st.ferr === 'pol') {
          const p = encaixar(m, sp);
          if (st.ferr === 'pol' && st.des.length >= 3) { const q = m2tela(st.des[0]); if (Math.hypot(q[0] - sp[0], q[1] - sp[1]) < 14) { fecharDesenho(st.des); return; } }
          st.des.push(p); if (st.ferr === 'ret' && st.des.length === 3) { fecharDesenho(U.retangulo3(...st.des)); return; } desenhar(); painel(); return;
        }
        const b = [...proj.blocos].reverse().find((x) => U.dentro(m, x.pts)); st.sel = b ? { t: 'b', id: b.id } : null; painel(); desenhar(); return;
      }
      if (st.aba === 'obst') {
        if (st.ferr && st.ferr !== 'ajustar') { const T = U.OBST[st.ferr], o = { id: U.novoId('o'), tipo: st.ferr, x: m[0], z: m[1], h: T.h }; if (T.redondo) o.r = T.r; else { o.w = T.w; o.d = T.d; o.rot = 0; } proj.obst.push(o); st.sel = { t: 'o', id: o.id }; st.ferr = 'ajustar'; sujar(); painel(); desenhar(); return; }
        const o = proj.obst.find((x) => U.dentro(m, U.pegadaObst(x, 0.3))); st.sel = o ? { t: 'o', id: o.id } : null; painel(); desenhar(); return;
      }
      if (st.aba === 'placas') {
        const s = st.vagas.find((v) => U.dentro(m, v.cantos)); if (!s) return;
        const L = proj.layout, on = new Set(L.forcarOn), off = new Set(L.forcarOff), esta = st.escolhidas.some((x) => x.k === s.k);
        if (esta) { on.delete(s.k); off.add(s.k); } else { off.delete(s.k); on.add(s.k); }
        L.forcarOn = [...on]; L.forcarOff = [...off]; recompor(); return;
      }
    }
    function fecharDesenho(pts) {
      const T = proj.tipoTelhado, ref = st.sel && st.sel.t === 'b' ? bloco(st.sel.id) : proj.blocos[proj.blocos.length - 1];
      const b = { id: U.novoId('b'), nome: 'Telhado ' + (proj.blocos.length + 1), pts, incl: ref ? ref.incl : grausDe(T === 'ceramico' ? 36 : T === 'laje' ? 0 : 10), az: 0, alturaBeiral: ref ? ref.alturaBeiral : 3, platibanda: ref ? ref.platibanda : (T === 'ceramico' ? 0 : 0.5), telha: ref ? ref.telha : T, usar: true, orientacao: 'retrato' };
      b.az = azDe(normalFora(b, 0)); // caimento inicial para a primeira borda desenhada
      proj.blocos.push(b); st.des = []; st.ponteiro = null; st.sel = { t: 'b', id: b.id }; st.ferr = 'ajustar'; sujar(); painel(); desenhar();
      msg(`Telhado criado. Agora ajuste <b>altura</b>, <b>inclinação</b> e <b>platibanda</b> ao lado, e toque na <b>bolinha laranja</b> da borda para onde a água escorre.`);
    }

    /* ---------- mudanças → recalcular ---------- */
    function sujar(fundo) {
      st.analisado = false; st.ver++; proj.resultado = null;
      if (st.mapas) { st.mapas = false; if (viewer) viewer.mostrarMapas([]); }
      if (fundo && viewer) { clearTimeout(refazerT); refazerT = setTimeout(() => viewer.recarregarFundo(), 300); }
      refazer();
    }
    function refazer() {
      clearTimeout(refazer.t);
      refazer.t = setTimeout(() => {
        if (!st.analisado) { st.vagas = U.vagas(proj); st.escolhidas = U.escolher(st.vagas, proj.layout.qtd, proj.layout); } // analisado = desenho não mudou desde a conta
        if (viewer) viewer.atualizar(st.aba === 'placas' || st.aba === 'sol' ? st.escolhidas : []); desenhar(); lado();
        if ((st.aba === 'placas' || st.aba === 'sol') && !st.analisado && !st.ocupado) { clearTimeout(refazer.a); refazer.a = setTimeout(analisar, 700); } // recalcula sozinho depois de parar de mexer
      }, 200);
    }
    function recompor() { st.escolhidas = U.escolher(st.vagas, proj.layout.qtd, proj.layout); proj.resultado = null; if (viewer) viewer.atualizar(st.escolhidas); desenhar(); lado(); }
    async function analisar() {
      if (st.ocupado) { st.refazerDepois = true; return; }
      st.ocupado = true; st.refazerDepois = false; const ver = st.ver;
      const lista = U.vagas(proj);
      if (!lista.length) { st.ocupado = false; st.vagas = []; st.escolhidas = []; if (viewer) viewer.atualizar([]); desenhar(); lado(); msg(proj.blocos.length ? 'Não coube nenhuma placa: confira se os telhados estão com "pode receber placas" e se o afastamento da borda não está grande demais.' : 'Desenhe os telhados primeiro (passo 2).', true); return; }
      const barra = (f) => msg(`Calculando o sol do ano inteiro em ${lista.length} posições possíveis… ${Math.round(f * 100)}%`);
      if ((!proj.kd || !proj.H) && B.pvgis) { try { const r = await B.pvgis(proj.lat, proj.lng, []); if (r && r.kd) proj.kd = r.kd; if (r && r.H) proj.H = r.H; } catch { /* usa o padrão de Ribeirão */ } }
      await U.analisar(proj, lista, { progresso: barra, kd: proj.kd });
      st.ocupado = false;
      if (ver !== st.ver || st.refazerDepois) { analisar(); return; } // mexeram durante a conta: refaz com o desenho novo
      st.vagas = lista; st.analisado = true; st.escolhidas = U.escolher(st.vagas, proj.layout.qtd, proj.layout);
      if (viewer) { viewer.cor(st.aba === 'sol' && st.corPlacas === 'agora' ? 'agora' : 'tsrf'); viewer.atualizar(st.escolhidas); }
      desenhar(); lado(); grafico();
      const fracas = st.escolhidas.filter((s) => s.analise && s.analise.tsrf < 0.8).length, falta = proj.layout.qtd - st.escolhidas.length;
      msg(`${falta > 0 ? `<b>Só couberam ${st.escolhidas.length} das ${proj.layout.qtd} placas.</b> ` : `Pronto: as ${st.escolhidas.length} placas estão nas melhores posições pelo sol do ano inteiro. `}${fracas ? `<b>${fracas} com aproveitamento abaixo de 80%</b> (laranja/vermelho). ` : ''}Toque numa placa para tirar ou num espaço vazio para pôr.`, falta > 0);
    }

    /* ---------- abas ---------- */
    function irAba(a) {
      st.aba = a; st.ferr = a === 'telhados' ? (proj.blocos.length ? 'ajustar' : 'ret') : a === 'obst' ? 'ajustar' : null; st.des = []; st.regua = [];
      ov.querySelectorAll('[data-aba]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.aba === a)));
      const dica = { foto: proj.drone ? 'Ajuste a escala com a <b>régua</b> (toque nas 2 pontas de uma medida conhecida) e gire até o <b>norte</b> ficar para cima.' : 'Busque o satélite pelo endereço e, se tiver, envie a <b>foto de cima do drone</b> (câmera a 90°, 40 a 60 m de altura).', telhados: 'Desenhe cada parte do telhado com <b>3 toques</b>: 2 cantos de uma parede e o terceiro para a profundidade. Os cantos grudam nos telhados vizinhos.', obst: "Toque no tipo e depois no lugar: caixa d'água, condensadora, respiro, árvore ou prédio vizinho. A altura faz a sombra.", placas: 'As placas usam a medida da placa do kit. Toque em <b>Calcular o melhor sol</b>: o sistema testa todas as posições e escolhe as melhores.', sol: 'Veja o sol passar no dia escolhido. Placa vermelha = na sombra naquele horário.' }[a];
      if ((a === 'placas' || a === 'sol') && proj.blocos.length && !st.enquadrado) { st.enquadrado = true; centralizar(); }
      msg(dica); painel(); refazer();
      if ((a === 'placas' || a === 'sol') && !st.analisado && !st.ocupado) analisar();
      if (viewer) { viewer.cor(a === 'sol' ? (st.corPlacas === 'agora' ? 'agora' : 'tsrf') : 'tsrf'); if (a !== 'sol' && st.play) parar(); }
    }
    ov.addEventListener('click', (e) => {
      if (e.target.closest('[data-x]')) { fechar(); return; }
      const ab = e.target.closest('[data-aba]'); if (ab) { irAba(ab.dataset.aba); return; }
      const f = e.target.closest('[data-ferr]'); if (f) { st.ferr = f.dataset.ferr; st.des = []; st.regua = []; painel(); desenhar(); return; }
      const ac = e.target.closest('[data-acao]'); if (ac) acao(ac.dataset.acao, ac);
    });
    const ehEscolha = (t) => t.type === 'checkbox' || t.type === 'radio' || t.type === 'file' || t.tagName === 'SELECT';
    ov.addEventListener('input', (e) => { if (!ehEscolha(e.target)) campo(e.target); });
    ov.addEventListener('change', (e) => { const t = e.target; if (t.id === 't3Arq') enviarFoto(t.files[0]); else if (ehEscolha(t)) campo(t, true); });
    ov.addEventListener('keydown', (e) => {
      if (e.target.closest('input,select,textarea')) return;
      if (e.key === 'Escape' && (st.des.length || st.regua.length)) { st.des = []; st.regua = []; st.ponteiro = null; desenhar(); painel(); e.preventDefault(); }
      else if (e.key === 'Backspace' && st.des.length) { st.des.pop(); desenhar(); painel(); e.preventDefault(); }
      else if (e.key === 'Enter' && st.ferr === 'pol' && st.des.length >= 3) { fecharDesenho(st.des); e.preventDefault(); }
    });

    function painel() {
      const el = $('#t3Painel', ov), A = st.aba;
      if (A === 'foto') {
        const d = proj.drone;
        el.innerHTML = `<div class="t3-linha"><input type="text" id="t3End" placeholder="Rua, número, bairro, cidade" value="${esc(proj.endereco || enderecoOrc())}"><button class="btn sol pequeno" data-acao="buscar">🛰️ Satélite</button></div>
          <div class="t3-linha"><label class="btn vidro pequeno" style="cursor:pointer">📷 ${d ? 'Trocar' : 'Enviar'} foto do drone<input type="file" id="t3Arq" accept="image/*" hidden></label>${d ? '<button class="link" data-acao="tirarDrone">tirar a foto do drone</button>' : ''}</div>
          ${d ? `<div class="t3-ferr"><button data-ferr="regua" aria-pressed="${st.ferr === 'regua'}">📏 Régua (escala)</button><button data-ferr="moverDrone" aria-pressed="${st.ferr === 'moverDrone'}">✋ Mover a foto</button></div>
            ${st.ferr === 'regua' ? `<div class="t3-linha"><span class="mini">${st.regua.length < 2 ? 'Toque nas 2 pontas de uma medida que você conhece (uma parede medida na trena, a piscina, a frente do lote).' : `Medida tocada: ${n(Math.hypot(st.regua[1][0] - st.regua[0][0], st.regua[1][1] - st.regua[0][1]), 2)} m na foto. Quanto mede de verdade?`}</span>${st.regua.length === 2 ? '<input type="text" inputmode="decimal" id="t3Real" placeholder="metros" style="width:90px" autocomplete="off"><button class="btn sol pequeno" data-acao="aplicarRegua">Aplicar</button>' : ''}</div>` : ''}
            <label class="campo"><span>Norte da foto: girar <b id="t3RotO">${n(d.rot || 0, 1)}°</b>${d.auto && d.auto.rot ? '<small>veio da bússola do drone</small>' : '<small>deixe a frente da casa como ela é na rua: norte para cima</small>'}</span><input type="range" id="t3Rot" min="-180" max="180" step="0.5" value="${d.rot || 0}"></label>
            <div class="t3-linha"><button class="link" data-acao="rot-90">↺ 90°</button><button class="link" data-acao="rot90">↻ 90°</button><span class="mini">escala: ${n(d.escala * 100, 2)} cm por ponto · a foto cobre ${n(d.w * d.escala, 1)} × ${n(d.h * d.escala, 1)} m${d.escalaConferida ? ' · <b style="color:var(--verde,#3ddc97)">conferida na régua</b>' : d.auto && d.auto.escala ? ' · pela altura do voo' : ' · <b style="color:var(--laranja)">confira na régua</b>'}</span></div>
            ${proj.fundo ? `<label class="campo"><span>Transparência para encaixar no satélite</span><input type="range" id="t3Alfa" min="0.2" max="1" step="0.05" value="${st.alfaDrone}"></label>` : ''}` : ''}
          <p class="mini">Dica: foto do drone bem de cima (câmera a 90°) e o norte para cima. Com o satélite junto, deixe a foto meio transparente e encaixe as bordas da casa.</p>`;
      } else if (A === 'telhados') {
        const b = st.sel && st.sel.t === 'b' ? bloco(st.sel.id) : null;
        const desenhando = (st.ferr === 'ret' || st.ferr === 'pol') && st.des.length;
        el.innerHTML = `<div class="t3-ferr"><button data-ferr="ret" aria-pressed="${st.ferr === 'ret'}">▭ Retângulo (3 toques)</button><button data-ferr="pol" aria-pressed="${st.ferr === 'pol'}">⬠ Formato livre</button><button data-ferr="ajustar" aria-pressed="${st.ferr === 'ajustar'}">✋ Ajustar</button></div>
          ${desenhando ? `<div class="t3-linha"><span class="mini">${st.ferr === 'ret' ? ['', 'Toque no outro canto da mesma parede.', 'Agora toque do outro lado, para dar a profundidade.'][st.des.length] : `${st.des.length} ponto(s). Toque no primeiro ponto para fechar.`}</span><button class="link" data-acao="desfazerPonto">desfazer ponto</button>${st.ferr === 'pol' && st.des.length >= 3 ? '<button class="btn sol pequeno" data-acao="fecharPol">Fechar o telhado</button>' : ''}<button class="link" data-acao="cancelarDes">cancelar</button></div>` : ''}
          <div class="t3-chips">${proj.blocos.map((x, i) => `<button class="t3-chip" data-acao="sel-b" data-id="${x.id}" style="border-color:${CORES[i % CORES.length]}" aria-pressed="${!!(b && b.id === x.id)}">${esc(x.nome)}</button>`).join('')}</div>
          ${b ? `<div class="grade g2 t3-form">
            <label class="campo"><span>Nome</span><input data-b="nome" value="${esc(b.nome)}"></label>
            <label class="campo"><span>Altura do beiral (m)<small>do chão até a telha, no lado mais baixo</small></span><input type="number" step="0.1" min="0" data-b="alturaBeiral" value="${b.alturaBeiral}"></label>
            <label class="campo"><span>Inclinação (%)<small data-dica="incl">${n(b.incl, 1)}° · metálica 5–10%, cerâmica 30–40%</small></span><input type="number" step="1" min="0" max="100" data-b="inclPct" value="${pct(b.incl)}"></label>
            <label class="campo"><span>Platibanda (m acima da telha)<small>0 se não tiver mureta</small></span><input type="number" step="0.05" data-b="platibanda" value="${b.platibanda}"></label>
            <label class="campo"><span>Telha</span><select data-b="telha">${[['metalico', 'Metálica'], ['fibrocimento', 'Fibrocimento'], ['ceramico', 'Cerâmica'], ['laje', 'Laje']].map(([v, t]) => `<option value="${v}" ${b.telha === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
            <label class="campo"><span>Placas neste telhado</span><select data-b="orientacao"><option value="retrato" ${b.orientacao !== 'paisagem' ? 'selected' : ''}>em pé (retrato)</option><option value="paisagem" ${b.orientacao === 'paisagem' ? 'selected' : ''}>deitadas (paisagem)</option></select></label></div>
            <p class="mini">A água escorre para o <b>${ponto(b.az)}</b> (${b.az}°): as placas ficam viradas para lá. Para mudar, toque na <b>bolinha laranja</b> da borda por onde a água sai. <button class="link" data-acao="inverter">inverter</button></p>
            <div class="t3-linha"><label class="chk"><input type="checkbox" data-b="usar" ${b.usar ? 'checked' : ''}> pode receber placas</label><button class="link" data-acao="dup">duplicar</button><button class="link" data-acao="apagarB">apagar</button></div>` : `<p class="mini">${proj.blocos.length ? 'Toque num telhado para editar.' : 'Nenhum telhado ainda.'} Comece pelo maior.</p>`}`;
      } else if (A === 'obst') {
        const o = st.sel && st.sel.t === 'o' ? obst(st.sel.id) : null, T = o ? U.OBST[o.tipo] : null;
        el.innerHTML = `<div class="t3-ferr">${Object.entries(U.OBST).map(([k, t]) => `<button data-ferr="${k}" aria-pressed="${st.ferr === k}">${ICONE[k]} ${t.nome}</button>`).join('')}<button data-ferr="ajustar" aria-pressed="${st.ferr === 'ajustar'}">✋ Mover</button></div>
          ${o ? `<div class="grade g2 t3-form"><label class="campo"><span>Altura (m)<small>${T.base === 'chao' ? 'do chão' : 'acima de onde está apoiado'}</small></span><input type="number" step="0.1" data-o="h" value="${o.h ?? T.h}"></label>
            ${T.redondo ? `<label class="campo"><span>${o.tipo === 'arvore' ? 'Raio da copa' : 'Raio'} (m)</span><input type="number" step="0.05" data-o="r" value="${o.r ?? T.r}"></label>` : `<label class="campo"><span>Largura (m)</span><input type="number" step="0.1" data-o="w" value="${o.w ?? T.w}"></label><label class="campo"><span>Profundidade (m)</span><input type="number" step="0.1" data-o="d" value="${o.d ?? T.d}"></label><label class="campo"><span>Girar (°)</span><input type="number" step="5" data-o="rot" value="${o.rot || 0}"></label>`}</div>
            <div class="t3-linha"><span class="mini">${T.nome} · ${T.base === 'chao' ? 'no chão' : 'em cima do telhado'}</span><button class="link" data-acao="apagarO">apagar</button></div>` : '<p class="mini">Escolha o tipo e toque no lugar. Para mexer num obstáculo, use "Mover".</p>'}`;
      } else if (A === 'placas') {
        const L = proj.layout, M = L.modulo;
        el.innerHTML = `<div class="grade g2 t3-form">
            <label class="campo" style="grid-column:1/-1"><span>Placa do kit</span><input value="${esc(M.nome)} · ${M.potW} W" disabled></label>
            <label class="campo"><span>Comprimento (mm)<small>confira na ficha técnica</small></span><input type="number" step="1" data-l="mc" value="${Math.round(M.c * 1000)}"></label>
            <label class="campo"><span>Largura (mm)</span><input type="number" step="1" data-l="ml" value="${Math.round(M.l * 1000)}"></label>
            <label class="campo"><span>Quantidade de placas</span><input type="number" step="1" data-l="qtd" value="${L.qtd}"></label>
            <label class="campo"><span>Entre placas (mm)<small>espaço do grampo intermediário</small></span><input type="number" step="1" data-l="entrePlacasMm" value="${L.entrePlacasMm}"></label>
            <label class="campo"><span>Entre fileiras (mm)</span><input type="number" step="1" data-l="entreFileirasMm" value="${L.entreFileirasMm}"></label>
            <label class="campo"><span>Afastamento da borda/platibanda (m)</span><input type="number" step="0.05" data-l="bordaM" value="${L.bordaM}"></label>
            <label class="campo"><span>Corredor de manutenção (m)</span><input type="number" step="0.05" data-l="corredorM" value="${L.corredorM}"></label>
            <label class="campo"><span>Corredor a cada (fileiras)<small>0 = sem corredor</small></span><input type="number" step="1" min="0" data-l="corredorCada" value="${L.corredorCada}"></label></div>
          <div class="t3-linha"><button class="btn sol pequeno" data-acao="calcular">☀️ Calcular o melhor sol</button><button class="link" data-acao="limparManual">desfazer ajustes manuais</button></div>`;
      } else {
        el.innerHTML = `<div class="t3-chips">${U.DIAS.map((D, i) => `<button class="t3-chip" data-acao="dia" data-i="${i}" aria-pressed="${st.di === i}">${D.nome}</button>`).join('')}</div>
          <div class="t3-linha"><button class="btn sol pequeno" data-acao="play">${st.play ? '❚❚ Pausar' : '▶ Ver o dia passar'}</button><input type="range" id="t3Hora" min="5.5" max="18.5" step="0.05" value="${st.hora}" style="flex:1"><b id="t3HoraO">${hhmm(st.hora)}</b></div>
          <div class="t3-linha"><label class="chk"><input type="radio" name="t3Cor" value="tsrf" ${st.corPlacas === 'tsrf' ? 'checked' : ''}> cor pelo sol do ano</label><label class="chk"><input type="radio" name="t3Cor" value="agora" ${st.corPlacas === 'agora' ? 'checked' : ''}> sombra neste horário</label><label class="chk"><input type="checkbox" id="t3Mapa" ${st.mapas ? 'checked' : ''}> mapa de sombra do telhado</label></div>
          <canvas id="t3Graf" height="120" style="width:100%;height:120px"></canvas>
          <p class="mini" id="t3GrafTxt">Curva do dia médio do mês: área clara = sem sombra, laranja = com a sombra medida.</p>`;
        grafico();
      }
    }
    function lado() {
      const el = $('#t3Lado', ov); if (!el) return;
      const r = st.analisado ? U.gerar(proj, st.escolhidas, { pvgis: proj.pvgis, hsp, pr }) : null, L = proj.layout;
      const cabem = st.vagas.length;
      el.innerHTML = `<div class="kpis" style="margin:8px 0">
        <div class="kpi"><span class="rotulo">Placas</span><b>${st.escolhidas.length}${st.escolhidas.length < L.qtd ? ' / ' + L.qtd : ''}</b><span class="sutil">${st.escolhidas.length < L.qtd ? `<span style="color:var(--laranja)">faltou lugar para ${L.qtd - st.escolhidas.length}</span>` : `cabem até ${cabem}`}</span></div>
        <div class="kpi"><span class="rotulo">Sombra</span><b>${r ? n(r.perdaSombra * 100, 1) + '%' : '—'}</b><span class="sutil">perda no ano</span></div>
        <div class="kpi"><span class="rotulo">Aproveitamento</span><b>${r ? n(r.tsrfMedio * 100) + '%' : '—'}</b><span class="sutil">sol + direção (TSRF)</span></div>
        <div class="kpi"><span class="rotulo">Geração</span><b>${r ? n(r.geracaoAnual / 12) + ' kWh' : '—'}</b><span class="sutil">${r ? 'por mês · ' + (proj.pvgis ? 'PVGIS' : 'estimada') : 'calcule no passo 4'}</span></div></div>
        ${r && (r.perdaSombra > 0.03 || st.escolhidas.some((s) => s.analise && s.analise.tsrf < 0.8)) ? '<p class="mini" style="color:var(--laranja)">Tem sombra em parte das placas: com <b>microinversor</b> cada placa trabalha sozinha e a sombra de uma não derruba as outras da mesma série.</p>' : ''}
        <div class="t3-sol" id="t3SolTxt">${st.solTxt || ''}</div>`;
    }
    function campo(t, mudou) {
      const b = st.sel && st.sel.t === 'b' ? bloco(st.sel.id) : null, o = st.sel && st.sel.t === 'o' ? obst(st.sel.id) : null;
      if (t.dataset.b && b) {
        const k = t.dataset.b;
        if (k === 'usar') b.usar = t.checked; else if (k === 'nome') b.nome = t.value; else if (k === 'telha' || k === 'orientacao') b[k] = t.value;
        else if (k === 'inclPct') { b.incl = Math.min(45, grausDe(t.value)); const d = $('[data-dica=incl]', ov); if (d) d.textContent = `${n(b.incl, 1)}° · metálica 5–10%, cerâmica 30–40%`; }
        else if (t.value !== '') b[k] = Math.max(0, Number(t.value) || 0);
        if (k === 'nome') { const c = $(`[data-acao="sel-b"][data-id="${b.id}"]`, ov); if (c) c.textContent = b.nome; desenhar(); lado(); return; }
        sujar(); desenhar(); if (mudou) painel(); return;
      }
      if (t.dataset.o && o) { if (t.value !== '') o[t.dataset.o] = Number(t.value) || 0; sujar(); desenhar(); return; }
      if (t.dataset.l) {
        const L = proj.layout, k = t.dataset.l, v = Number(t.value) || 0; if (t.value === '') return;
        if (k === 'qtd') { L.qtd = Math.max(1, Math.round(v)); if (st.analisado) recompor(); else refazer(); return; } // quantidade só re-escolhe as melhores vagas
        if (k === 'mc') { L.modulo.c = v / 1000; L.modulo.estimada = false; } else if (k === 'ml') { L.modulo.l = v / 1000; L.modulo.estimada = false; } else L[k] = v;
        L.forcarOn = []; L.forcarOff = []; sujar(); return;
      }
      if (t.id === 't3Rot' && proj.drone) { girarFoto(+t.value - (proj.drone.rot || 0)); const r = $('#t3RotO', ov); if (r) r.textContent = n(proj.drone.rot, 1) + '°'; return; }
      if (t.id === 't3Alfa') { st.alfaDrone = +t.value; desenhar(); return; }
      if (t.id === 't3Hora') { st.hora = +t.value; $('#t3HoraO', ov).textContent = hhmm(st.hora); if (viewer) viewer.sol(st.di, st.hora); grafico(); return; }
      if (t.name === 't3Cor') { st.corPlacas = t.value; if (viewer) viewer.cor(t.value); return; }
      if (t.id === 't3Mapa') { st.mapas = t.checked; mapasSombra(); }
    }
    async function acao(a, el) {
      if (a === 'buscar') return buscar({ endereco: $('#t3End', ov).value });
      if (a === 'tirarDrone') { proj.drone = null; imgDrone = null; sujar(true); painel(); desenhar(); return; }
      if (a === 'aplicarRegua') {
        const real = Number(String($('#t3Real', ov).value).replace(',', '.')), med = Math.hypot(st.regua[1][0] - st.regua[0][0], st.regua[1][1] - st.regua[0][1]);
        if (!(real > 0) || !med) return msg('Digite a medida real em metros (ex.: 4,20).', true);
        const f = real / med, d = proj.drone, cx = d.cx || 0, cz = d.cz || 0; d.escala *= f; d.escalaConferida = true;
        // sem satélite, o que foi desenhado em cima da foto cresce junto com ela; com satélite, a escala certa já é a do satélite
        if (!proj.fundo) { const esc2 = (p) => [cx + (p[0] - cx) * f, cz + (p[1] - cz) * f]; proj.blocos.forEach((b) => { b.pts = b.pts.map(esc2); }); proj.obst.forEach((o) => { [o.x, o.z] = esc2([o.x, o.z]); }); }
        st.regua = []; st.ferr = null; sujar(true); centralizar(); painel();
        msg(`Escala ajustada: a foto cobre ${n(d.w * d.escala, 1)} × ${n(d.h * d.escala, 1)} m. ${d.rotConferida ? '' : 'Agora gire até o norte ficar para cima.'}`); return;
      }
      if (a === 'rot90' || a === 'rot-90') { girarFoto(a === 'rot90' ? 90 : -90); painel(); return; }
      if (a === 'sel-b') { st.sel = { t: 'b', id: el.dataset.id }; st.ferr = 'ajustar'; painel(); desenhar(); return; }
      if (a === 'desfazerPonto') { st.des.pop(); desenhar(); painel(); return; }
      if (a === 'cancelarDes') { st.des = []; st.ponteiro = null; desenhar(); painel(); return; }
      if (a === 'fecharPol') { if (st.des.length >= 3) fecharDesenho(st.des); return; }
      if (a === 'inverter') { const b = bloco(st.sel.id); b.az = (b.az + 180) % 360; sujar(); painel(); desenhar(); return; }
      if (a === 'dup') { const b = bloco(st.sel.id), c = JSON.parse(JSON.stringify(b)); c.id = U.novoId('b'); c.nome = b.nome + ' (cópia)'; c.pts = c.pts.map((p) => [p[0] + 1, p[1] + 1]); proj.blocos.push(c); st.sel = { t: 'b', id: c.id }; sujar(); painel(); desenhar(); return; }
      if (a === 'apagarB') { proj.blocos = proj.blocos.filter((b) => b.id !== st.sel.id); st.sel = null; sujar(); painel(); desenhar(); return; }
      if (a === 'apagarO') { proj.obst = proj.obst.filter((o) => o.id !== st.sel.id); st.sel = null; sujar(); painel(); desenhar(); return; }
      if (a === 'calcular') { st.analisado = false; return analisar(); }
      if (a === 'limparManual') { proj.layout.forcarOn = []; proj.layout.forcarOff = []; recompor(); return; }
      if (a === 'dia') { st.di = +el.dataset.i; if (viewer) viewer.sol(st.di, st.hora); painel(); return; }
      if (a === 'play') { if (st.play) parar(); else tocarDia(); painel(); }
    }
    /* girar a foto do drone (norte para cima). Sem satélite, o que já foi desenhado gira junto. */
    function girarFoto(delta) {
      const d = proj.drone; if (!d || !delta) return;
      d.rot = ((((d.rot || 0) + delta) + 540) % 360) - 180; d.rotConferida = true;
      if (!proj.fundo) {
        const c = Math.cos(delta * Math.PI / 180), s = Math.sin(delta * Math.PI / 180), cx = d.cx || 0, cz = d.cz || 0;
        const gira = (p) => [cx + (p[0] - cx) * c - (p[1] - cz) * s, cz + (p[0] - cx) * s + (p[1] - cz) * c];
        proj.blocos.forEach((b) => { b.pts = b.pts.map(gira); b.az = Math.round((((b.az + delta) % 360) + 360) % 360); });
        proj.obst.forEach((o) => { [o.x, o.z] = gira([o.x, o.z]); if (o.rot != null) o.rot = (o.rot || 0) + delta; });
      }
      desenhar(); sujar(true);
    }
    let anim = null;
    function tocarDia() { st.play = true; if (st.hora >= 18.4) st.hora = 5.6; let ult = performance.now(); const passo = (t) => { if (!st.play) return; const dt = (t - ult) / 1000; ult = t; st.hora += dt * 1.6; if (st.hora > 18.5) st.hora = 5.6; const r = $('#t3Hora', ov); if (r) { r.value = st.hora; $('#t3HoraO', ov).textContent = hhmm(st.hora); } if (viewer) viewer.sol(st.di, st.hora); grafico(); anim = requestAnimationFrame(passo); }; anim = requestAnimationFrame(passo); }
    function parar() { st.play = false; cancelAnimationFrame(anim); }
    function grafico() {
      const c = $('#t3Graf', ov); if (!c || !st.analisado) return; const dpr = raiz.devicePixelRatio || 1, w = c.clientWidth || 300, h = 120; c.width = w * dpr; c.height = h * dpr; const q = c.getContext('2d'); q.setTransform(dpr, 0, 0, dpr, 0, 0);
      const am = U.amostras(proj.lat || -21.18, proj.kd || U.KD_PADRAO, proj.H || U.H_PADRAO), idx = am.map((x, k) => [x, k]).filter(([x]) => x.di === st.di), pot = (proj.layout.modulo.potW || 615) / 1000;
      const pts = idx.map(([x, k]) => { let sem = 0, com = 0; st.escolhidas.forEach((s) => { const ci = Math.max(0, x.dir[0] * s.n[0] + x.dir[1] * s.n[1] + x.dir[2] * s.n[2]), cb = Math.cos(s.incl * Math.PI / 180), vf = (1 + cb) / 2, gr = x.ghi * 0.2 * (1 - cb) / 2, a = s.analise; sem += pot * (x.dni * ci + x.dhi * vf + gr) / 1000 * 0.82; com += pot * (x.dni * ci * (a ? a.sol[k] : 1) + x.dhi * vf * (a ? a.svf : 1) + gr) / 1000 * 0.82; }); return { h: x.h, sem, com }; });
      const max = Math.max(...pts.map((p) => p.sem), 0.1), X = (hh) => 30 + (hh - 5.5) / 13 * (w - 40), Y = (v) => h - 18 - v / max * (h - 30);
      q.clearRect(0, 0, w, h); q.font = '10px system-ui'; q.fillStyle = '#9aa6c2'; q.textAlign = 'center'; [6, 9, 12, 15, 18].forEach((hh) => q.fillText(hh + 'h', X(hh), h - 4)); q.textAlign = 'left'; q.fillText(n(max, 1) + ' kW', 2, 12);
      const area = (k, cor) => { q.beginPath(); q.moveTo(X(pts[0].h), Y(0)); pts.forEach((p) => q.lineTo(X(p.h), Y(p[k]))); q.lineTo(X(pts[pts.length - 1].h), Y(0)); q.closePath(); q.fillStyle = cor; q.fill(); };
      if (pts.length) { area('sem', '#ffffff22'); area('com', '#ff8a3dcc'); }
      q.strokeStyle = '#ffd23d'; q.lineWidth = 2; q.beginPath(); q.moveTo(X(st.hora), 8); q.lineTo(X(st.hora), h - 18); q.stroke();
      const somaSem = pts.reduce((s, p) => s + p.sem, 0), perdaDia = pts.length ? 1 - pts.reduce((s, p) => s + p.com, 0) / Math.max(somaSem, 1e-6) : 0;
      const tx = $('#t3GrafTxt', ov); if (tx) tx.innerHTML = `${U.DIAS[st.di].nome}, dia médio: <b>${n(somaSem * 0.5, 1)} kWh</b> sem sombra · a sombra tira <b style="color:${perdaDia > 0.05 ? 'var(--laranja)' : 'inherit'}">${n(perdaDia * 100, 1)}%</b> neste dia. Área clara = sem sombra, laranja = com a sombra medida.`;
    }
    async function mapasSombra() {
      if (!viewer) return; if (!st.mapas) { viewer.mostrarMapas([]); return; }
      const lista = []; const usar = proj.blocos.filter((b) => b.usar);
      for (let i = 0; i < usar.length; i++) { msg(`Desenhando o mapa de sombra do ano no telhado ${i + 1} de ${usar.length}…`); const mp = await U.mapaSombra(proj, usar[i], { kd: proj.kd }); mp.bloco = usar[i]; lista.push(mp); }
      viewer.mostrarMapas(lista); msg('Mapa de sombra: <b style="color:#22a35a">verde</b> pega sol o ano todo, <b style="color:#ffb000">amarelo</b> perde até 20%, <b style="color:#e5483b">vermelho</b> é sombra forte.');
    }

    /* ---------- fotos e satélite ---------- */
    async function enviarFoto(arq) {
      if (!arq) return;
      const md = U.lerMetadados(await arq.arrayBuffer().catch(() => new ArrayBuffer(0)));
      const url = URL.createObjectURL(arq), im = await carregarImg(url); URL.revokeObjectURL(url); if (!im) return msg('Não consegui abrir a foto.', true);
      const cheia = U.reduzir(im, 2400, 0.85), mini = U.reduzir(im, 900, 0.7), e = Math.min(1, 2400 / Math.max(im.width, im.height));
      const w = Math.round(im.width * e), h = Math.round(im.height * e), meio = proj.blocos.length ? U.centroide(proj.blocos.flatMap((b) => b.pts)) : [0, 0];
      const alturaTel = proj.blocos.length ? Math.max(...proj.blocos.map((b) => U.topoTelhado(b))) : 4, auto = U.colocarDrone(md, w, h, proj, alturaTel);
      if (auto.latLng && proj.fonte !== 'google') { proj.lat = auto.latLng.lat; proj.lng = auto.latLng.lng; proj.fonte = 'drone'; proj.kd = null; proj.H = null; }
      proj.drone = { img: cheia, mini, w, h, escala: auto.escala || 45 / w, rot: auto.rot ?? 0, cx: auto.cx ?? meio[0], cz: auto.cz ?? meio[1], auto: { escala: !!auto.escala, rot: Number.isFinite(auto.rot), gps: auto.cx != null || !!auto.latLng, modelo: md.modelo || null, alturaVoo: md.altRel || null } };
      st.imgsNovas.drone = true; imgDrone = await carregarImg(cheia); st.ferr = 'regua'; st.alfaDrone = proj.fundo ? 0.6 : 1; sujar(true); centralizar(); painel();
      const A = proj.drone.auto, achou = [A.escala && `escala pela altura do voo (${n(md.altRel, 0)} m)`, A.rot && 'norte pela bússola do drone', A.gps && 'posição pelo GPS'].filter(Boolean);
      msg(`${auto.inclinada ? '<b>Esta foto não está bem de cima (câmera a menos de 80°): as medidas saem tortas. Prefira uma foto com a câmera a 90°.</b> ' : ''}${achou.length ? `Foto do drone lida: ${achou.join(', ')}. <b>Confira com a régua</b> numa medida que você tem (uma parede, a piscina).` : 'Foto carregada (sem os dados do voo — mande o arquivo original do drone, não pelo WhatsApp, que apaga esses dados). <b>1)</b> <b>Régua</b>: toque nas 2 pontas de algo que você mediu (uma parede, a piscina) e digite a medida. <b>2)</b> Gire até o <b>norte</b> ficar para cima.'}`, !!auto.inclinada);
    }
    async function buscar(q) {
      if (!B.telhado) { msg('A busca por satélite funciona na versão dentro do Chamae. Aqui no teste, use a foto do drone.', true); return; }
      msg('Buscando o imóvel e o telhado no Google…');
      try {
        const r = await B.telhado(q); if (r.erro) throw new Error(r.erro);
        Object.assign(proj, { lat: r.lat, lng: r.lng, endereco: r.endereco || proj.endereco, qualidade: r.qualidade, data: r.data, precisao: r.precisao, fonte: 'google', kd: null, H: null });
        msg('Baixando a foto de satélite…');
        const f = await U.fotoSatelite(proj, (z, x, y) => B.tile(z, x, y), 60);
        proj.fundo = { img: f.cheia, mini: f.mini, ladoM: 60 }; st.imgsNovas.fundo = true; imgFundo = await carregarImg(f.cheia);
        if (!proj.blocos.length) proj.blocos = U.blocosDoGoogle(proj, r);
        sujar(true); centralizar(); painel();
        const dt = r.data ? `${String(r.data.month).padStart(2, '0')}/${r.data.year}` : '';
        msg(`${proj.blocos.length ? `O Google achou ${proj.blocos.length} parte(s) do telhado (foto de ${dt}, precisão básica).` : 'O Google não tem o desenho deste telhado: desenhe no passo 2.'} ${r.precisao && r.precisao !== 'ROOFTOP' ? '<b>O endereço foi achado por aproximação: confira se é esta casa.</b> ' : ''}Se tiver a foto do drone, envie para ganhar detalhe.`);
      } catch (err) { msg('Não consegui buscar: ' + esc(err.message), true); }
    }

    /* ---------- salvar ---------- */
    async function salvar() {
      if (!proj.blocos.length) return msg('Desenhe pelo menos um telhado.', true);
      const bt = $('#t3Salvar', ov); if (bt.disabled) return; bt.disabled = true; bt.textContent = 'Salvando…';
      try {
        for (let i = 0; i < 3 && !st.analisado; i++) { if (!st.ocupado) await analisar(); while (st.ocupado) await new Promise((r) => setTimeout(r, 120)); }
        if (!st.analisado || !st.escolhidas.length) { msg('Não consegui calcular as placas: confira os telhados.', true); return; }
        const faces = [...new Set(st.escolhidas.map((s) => U.chaveFace(s.incl, s.az)))];
        const aqui = [Math.round(proj.lat * 100) / 100, Math.round(proj.lng * 100) / 100];
        const pv = proj.pvgis && proj.pvgis.faces && proj.pvgis.local && proj.pvgis.local[0] === aqui[0] && proj.pvgis.local[1] === aqui[1] ? proj.pvgis : null;
        if (!pv) proj.pvgis = null; // mudou o local: não reaproveita a irradiação de outro ponto
        const falta = faces.filter((k) => !(pv && pv.faces[k]));
        if (B.pvgis && falta.length) {
          msg('Buscando a irradiação do local no PVGIS (base europeia de satélite, SARAH-3)…');
          try { const r = await B.pvgis(proj.lat, proj.lng, falta); if (r && r.faces) proj.pvgis = { db: r.db, local: aqui, faces: { ...(pv ? pv.faces : {}), ...r.faces } }; if (r && r.kd) proj.kd = r.kd; if (r && r.H) proj.H = r.H; }
          catch (e) { msg('O PVGIS não respondeu agora: usei a irradiação da cidade (' + esc(e.message) + ').', true); }
        }
        const res = U.gerar(proj, st.escolhidas, { pvgis: proj.pvgis, hsp, pr });
        const fotos = viewer ? { d3: viewer.foto(false, 960, 720, { cor: 'normal' }), topo: viewer.foto(true, 960, 720, { cor: 'tsrf' }) } : {};
        await guardar(res, fotos);
      } finally { bt.disabled = false; bt.textContent = 'Salvar no orçamento'; }
    }
    async function guardar(res, fotos) {
      // imagens grandes vão para os anexos (o orçamento guarda só a versão leve)
      const fim = JSON.parse(JSON.stringify(proj));
      for (const k of ['fundo', 'drone']) {
        if (!fim[k]) continue;
        if (st.imgsNovas[k] && B.guardarImagem && proj[k].img) { try { fim[k].id = await B.guardarImagem('P3D-' + (orc.id || 'rascunho'), k + '.jpg', proj[k].img); } catch { /* fica só a leve */ } }
        delete fim[k].img;
      }
      fim.resultado = { ...res, escolhidas: st.escolhidas.map((s) => s.k), placasPos: st.escolhidas.map((s) => ({ k: s.k, tsrf: s.analise ? Math.round(s.analise.tsrf * 1000) / 1000 : null })) };
      fim.perda = res.perda; fim.fotos = fotos; fim.salvoEm = new Date().toISOString();
      delete fim.tipoTelhado;
      aoSalvar(fim); fechar();
    }
    $('#t3Salvar', ov).onclick = () => salvar();
    $('#t3Topo', ov).onclick = (e) => { const t = e.target.dataset.on !== '1'; e.target.dataset.on = t ? '1' : ''; e.target.textContent = t ? 'Vista 3D' : 'Vista de cima'; if (viewer) viewer.topo(t); };
    function fechar() { parar(); if (viewer) viewer.destruir(); ro.disconnect(); ov.remove(); }

    /* ---------- iniciar ---------- */
    const ro = new ResizeObserver(tamanhoCv); ro.observe(tela);
    tamanhoCv(); prepararImagens().then(() => centralizar());
    U.carregarThree().then(() => {
      const box = $('#t3Cena', ov); box.innerHTML = '';
      viewer = U.criar(box, proj, { aoSol: (i) => { st.solTxt = !i.dia ? `<b>${i.nomeDia} · ${hhmm(i.hora)}</b>: noite` : `<b>${i.nomeDia} · ${hhmm(i.hora)}</b>: ${st.escolhidas.length ? (i.sombreadas ? `<span style="color:var(--laranja)">${i.sombreadas} placa(s) com sombra agora</span>` : 'todas as placas no sol') : 'sol nesta posição'}`; const el = $('#t3SolTxt', ov); if (el) el.innerHTML = st.solTxt; } });
      viewer.sol(st.di, st.hora); refazer();
    }).catch((e) => { $('#t3Cena', ov).innerHTML = `<p class="mini" style="padding:20px">${esc(e.message)}. Confira a internet.</p>`; });
    irAba(st.aba);
    if (!proj.blocos.length && !proj.fundo && !proj.drone && B.telhado && orc.contrato && orc.contrato.rua && orc.contrato.numero) buscar({ endereco: enderecoOrc() }); // já tem o endereço: busca sozinho
  }

  raiz.Telhado = { abrir };
})(window);
