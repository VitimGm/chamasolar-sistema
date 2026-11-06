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
  const ICONE = { caixa: '💧', ar: '❄️', respiro: '🔩', antena: '📡', boiler: '🛢️', coletor: '♨️', arvore: '🌳', predio: '🏢', area: '🚫' };
  const hhmm = (h) => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;

  function abrir({ orc, modulo, qtd, tipoTelhado, aba, aoSalvar, kits = [] }) {
    const U = raiz.Usina3D, B = raiz.Banco, P = (B.parametros && B.parametros()) || {};
    const proj = U.migrar(orc.projeto3d ? JSON.parse(JSON.stringify(orc.projeto3d)) : null) || { versao: 2, lat: -21.1775, lng: -47.8103, blocos: [], obst: [] };
    proj.versao = 2; proj.blocos = proj.blocos || []; proj.obst = proj.obst || []; proj.tipoTelhado = tipoTelhado || proj.tipoTelhado || 'metalico';
    proj.layout = Object.assign({ entrePlacasMm: 20, entreFileirasMm: 20, bordaM: 0.3, corredorM: 0.6, corredorCada: 0, forcarOn: [], forcarOff: [] }, proj.layout || {});
    // placa: a do kit (medida pela ficha), ou a que já estava no projeto (com as medidas que o vendedor conferiu)
    const modAnt = proj.layout.modulo, nomeKit = modulo ? (((modulo.marca && !String(modulo.nome || '').toLowerCase().includes(String(modulo.marca).toLowerCase())) ? modulo.marca + ' ' : '') + (modulo.nome || '')).trim() || `Placa ${modulo.potenciaW} W` : null;
    if (modAnt && modAnt.c && (!modulo || (modAnt.nome === nomeKit && modAnt.potW === modulo.potenciaW))) proj.layout.modulo = modAnt;
    else { const w = (modulo && modulo.potenciaW) || (modAnt && modAnt.potW) || 615, med = U.medidasModulo(modulo ? `${modulo.sku || ''} ${modulo.nome || ''}` : modAnt && modAnt.nome, w); proj.layout.modulo = { nome: nomeKit || (modAnt && modAnt.nome) || `Placa ${w} W`, potW: w, c: med.c, l: med.l, estimada: true }; }
    if (qtd) proj.layout.qtd = qtd; else proj.layout.qtd = proj.layout.qtd || 12;
    proj.layout.arranjo = proj.layout.arranjo || 'fileiras'; proj.layout.manuais = proj.layout.manuais || []; proj.layout.oriFace = proj.layout.oriFace || {};
    const cid = (raiz.DadosTeste && raiz.DadosTeste.cidades) || {}, hsp = (cid[orc.cidade] || cid['Ribeirão Preto'] || { hsp: 5.4 }).hsp, pr = P.pr || 0.776;
    proj.cabos = Object.assign({ modo: 'seguro', nStrings: 0, inv: null, quadro: null }, proj.cabos || {});
    /* MPPT: ficha do inversor (datasheet ou típica, corrigível) e a placa (tensão e corrente) */
    const kitDe = (t) => kits.find((k) => k && k.inversor && (k.inversor.tipo === 'micro' ? 'micro' : 'string') === t);
    proj.mppt = proj.mppt || {}; if (!proj.mppt.kit || !kitDe(proj.mppt.kit)) proj.mppt.kit = kitDe('string') ? 'string' : kitDe('micro') ? 'micro' : null;
    const fichaPadrao = () => { const k = kitDe(proj.mppt.kit); if (!k || !raiz.Mppt) return null; const base = raiz.Mppt.fichaDe(k.inversor), cad = raiz.Fichas && raiz.Fichas.buscar('inversores', k.inversor.nome);
      if (!cad) return base; const lim = Object.fromEntries(Object.entries(cad).filter(([c, v]) => v != null && !['em', 'lidos', 'coluna'].includes(c))); return { ...base, ...lim, conferida: true, fonte: 'ficha cadastrada (PDF)' }; };
    const chaveKit = () => { const k = kitDe(proj.mppt.kit); return k ? `${k.inversor.nome}|${k.inversor.qtd || 1}` : ''; };
    if (!proj.mppt.ficha || proj.mppt.chave !== chaveKit()) { proj.mppt.ficha = fichaPadrao(); proj.mppt.chave = chaveKit(); }
    { const cadM = raiz.Fichas && raiz.Fichas.buscar('modulos', proj.layout.modulo.nome); if (cadM && (!proj.mppt.mod || proj.mppt.mod.estimada)) { proj.mppt.mod = { potW: proj.layout.modulo.potW, voc: cadM.voc, vmp: cadM.vmp, isc: cadM.isc, imp: cadM.imp, estimada: false, cadastro: true }; if (cadM.c && proj.layout.modulo.estimada) Object.assign(proj.layout.modulo, { c: cadM.c, l: cadM.l, estimada: false }); } }
    if (!proj.mppt.mod || proj.mppt.mod.potW !== proj.layout.modulo.potW) { const fm = raiz.Catalogo && raiz.Catalogo.fichaModulo ? raiz.Catalogo.fichaModulo(proj.layout.modulo.potW) : { voc: 45, vmp: 37.5, isc: 14 }; proj.mppt.mod = { potW: proj.layout.modulo.potW, voc: fm.voc, vmp: fm.vmp, isc: fm.isc, estimada: true }; }
    const limiteAguas = () => { const f = proj.mppt.ficha; proj.layout.maxAguas = f && f.tipo === 'string' && raiz.Mppt ? raiz.Mppt.totalEntradas(f) : 0; };
    limiteAguas();
    const st = { aba: aba || (proj.blocos.length ? 'telhados' : 'foto'), ferr: null, sel: null, des: [], ponteiro: null, view: { esc: 14, ox: 0, oz: 0 }, vagas: [], escolhidas: [], analisado: false, ocupado: false, ver: 0, di: 6, hora: 9.5, play: false, regua: [], alfaDrone: 1, corPlacas: 'tsrf', mapas: false, imgsNovas: {}, oriMao: 'retrato' };

    const ov = document.createElement('div'); ov.className = 't3-ov';
    ov.innerHTML = `<div class="t3-caixa" role="dialog" aria-label="Projeto 3D do telhado">
      <div class="entre t3-cab"><div><b style="font-size:18px">Projeto 3D do telhado</b> <span class="mini">${esc(orc.nome || '')}</span></div><button class="link" data-x>fechar sem salvar</button></div>
      <nav class="t3-passos" id="t3Abas">${[['foto', '1 Foto'], ['telhados', '2 Telhados'], ['obst', '3 Obstáculos'], ['placas', '4 Placas'], ['sol', '5 Sol e sombra'], ['cabos', '6 Cabos']].map(([k, t]) => `<button data-aba="${k}">${t}</button>`).join('')}</nav>
      <p class="t3-aviso" id="t3Msg"></p>
      <div class="t3-corpo">
        <div class="t3-esq">
          <div class="t3-foto" id="t3Tela"><canvas id="t3Cv"></canvas>
            <div class="t3-zoom"><button data-zoom="1" aria-label="Aproximar">＋</button><button data-zoom="-1" aria-label="Afastar">－</button><button data-zoom="0" aria-label="Centralizar">⌖</button></div>
            <div class="t3-flut" id="t3Flut" hidden></div></div>
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
      const encaixe = st.ferr === 'encaixar', soDrone = encaixe && st.enc.length % 2 === 0, soSat = encaixe && st.enc.length % 2 === 1;
      if (imgFundo && proj.fundo && !soDrone) { const L = proj.fundo.ladoM, a = m2tela([-L / 2, -L / 2]); g.drawImage(imgFundo, a[0], a[1], L * st.view.esc, L * st.view.esc); }
      if (imgDrone && proj.drone && !soSat) { const d = proj.drone, c = m2tela([d.cx || 0, d.cz || 0]); g.save(); g.globalAlpha = st.aba === 'foto' ? st.alfaDrone : 1; g.translate(c[0], c[1]); g.rotate((d.rot || 0) * Math.PI / 180); const e = d.escala * st.view.esc; g.drawImage(imgDrone, -d.w / 2 * e, -d.h / 2 * e, d.w * e, d.h * e); g.restore(); }
      if (!imgFundo && !imgDrone) { g.fillStyle = '#fff8'; g.font = '15px system-ui'; g.textAlign = 'center'; g.fillText('Busque o satélite ou envie a foto do drone (passo 1)', w / 2, h / 2); }
      const escurecer = st.aba === 'placas' || st.aba === 'sol' || st.aba === 'cabos'; if (escurecer) { g.fillStyle = '#0006'; g.fillRect(0, 0, w, h); }
      // blocos
      const todasFaces = U.faces(proj);
      proj.blocos.forEach((b, i) => {
        const cor = CORES[i % CORES.length], sel = st.sel && st.sel.t === 'b' && st.sel.id === b.id, pronto = (b.forma || '1') !== '1';
        caminho(b.pts); g.fillStyle = cor + (escurecer ? '30' : sel ? '55' : '33'); g.fill(); g.lineWidth = sel ? 3 : 2; g.strokeStyle = cor; g.stroke();
        if (b.platibanda > 0 && !pronto) { caminho(U.recuar(b.pts, 0.15)); g.lineWidth = 1; g.setLineDash([4, 3]); g.stroke(); g.setLineDash([]); }
        const c = m2tela(U.centroide(b.pts)), d = U.desce(b.az), L = 26;
        if (pronto) { // cumeeira e espigões + seta de cada água
          todasFaces.filter((f) => f.pai === b.id).forEach((f) => {
            g.strokeStyle = cor; g.lineWidth = 1.5; g.setLineDash([5, 4]); f.pts.forEach((p2, k) => { if (!f.paredes || f.paredes[k] !== false) return; const q2 = f.pts[(k + 1) % f.pts.length], a2 = m2tela(p2), z2 = m2tela(q2); g.beginPath(); g.moveTo(a2[0], a2[1]); g.lineTo(z2[0], z2[1]); g.stroke(); }); g.setLineDash([]);
            if (!escurecer) { const cf = m2tela(U.centroide(f.pts)), df = U.desce(f.az); seta(cf, df, 14, '#fff'); }
          });
        } else if (!escurecer) seta(c, [d[0], d[1]], L, '#fff');
        if (sel && st.aba === 'telhados') rotulo(`${b.nome} · ${pronto ? b.forma + ' águas · ' : ''}${n(b.alturaBeiral, 1)} m · ${pct(b.incl)}%${b.platibanda > 0 && !pronto ? ' · plat. ' + n(b.platibanda, 2) : ''}${b.usar ? '' : ' · sem placas'}`, c[0], c[1] - L - 8);
        else if (!escurecer || st.view.esc > 18) rotulo(`${b.nome} ${n(b.alturaBeiral, 1)} m`, c[0], c[1] + (escurecer ? 4 : -L - 8));
        if (sel && st.aba === 'telhados') {
          b.pts.forEach((p, k) => { const q = b.pts[(k + 1) % b.pts.length], a = m2tela(p), z = m2tela(q), mid = [(a[0] + z[0]) / 2, (a[1] + z[1]) / 2], len = Math.hypot(q[0] - p[0], q[1] - p[1]);
            rotulo(n(len, 2) + ' m', mid[0], mid[1] + 14, '#ffd23d');
            if (!pronto) { const nr = normalFora(b, k); g.fillStyle = '#ffb000'; g.beginPath(); g.arc(mid[0] + nr[0] * 16, mid[1] + nr[1] * 16, 9, 0, 7); g.fill(); seta([mid[0] + nr[0] * 10, mid[1] + nr[1] * 10], nr, 12, '#1a1205'); }
            g.fillStyle = '#fff'; g.beginPath(); g.arc(a[0], a[1], 7, 0, 7); g.fill(); g.strokeStyle = cor; g.lineWidth = 3; g.stroke(); });
        }
      });
      if (st.aba === 'telhados' && proj.pistas && proj.pistas.length) proj.pistas.forEach((pi) => { const c2 = m2tela(pi.c), d2 = U.desce(pi.az); g.globalAlpha = 0.8; seta(c2, d2, 11, '#5cf0ff'); g.globalAlpha = 1; rotulo(`${pct(pi.incl)}%`, c2[0], c2[1] + 18, '#5cf0ff'); });
      // obstáculos
      proj.obst.forEach((o) => { const pg = U.pegadaObst(o), sel = st.sel && st.sel.t === 'o' && st.sel.id === o.id, area = o.tipo === 'area'; caminho(pg); g.fillStyle = area ? '#ff3d3d40' : o.tipo === 'arvore' ? '#2f7d3a99' : '#ffffffaa'; g.fill(); g.strokeStyle = sel ? '#ffb000' : area ? '#ff3d3d' : '#222'; g.lineWidth = sel ? 3 : area ? 2 : 1.5; if (area) g.setLineDash([6, 4]); g.stroke(); g.setLineDash([]); if (escurecer && !sel && !area) return; const c = m2tela(area ? U.centroide(o.pts) : [o.x, o.z]); rotulo(area ? '🚫 sem placa' : `${ICONE[o.tipo] || ''} ${n(o.h ?? U.OBST[o.tipo].h, 1)} m`, c[0], c[1] - (area ? 0 : 12), area ? '#ff8a8a' : '#fff'); });
      // placas
      if (st.aba === 'placas' || st.aba === 'sol' || st.aba === 'cabos') {
        const esc2 = new Set(st.escolhidas.map((s) => s.k));
        const mans = st.escolhidas.filter((v) => v.manual), bate = new Set(); mans.forEach((x, i) => mans.slice(i + 1).forEach((y) => { if (U.cruzam(x.cantos, y.cantos)) { bate.add(x.k); bate.add(y.k); } }));
        const pm = st.aba === 'placas' ? planoMppt() : null, corM = {}; if (pm && pm.mppts) pm.mppts.forEach((m) => m.slots.forEach((x) => { corM[x.k] = CORES_MPPT[(m.n - 1) % 8]; }));
        st.vagas.forEach((s) => { if (bate.has(s.k)) s.fora = true; caminho(s.cantos); if (esc2.has(s.k) && corM[s.k] && !s.fora) { g.fillStyle = st.analisado && s.analise ? U.corTsrf(s.analise.tsrf) : '#1c3a7a'; g.globalAlpha = 0.9; g.fill(); g.globalAlpha = 1; g.strokeStyle = corM[s.k]; g.lineWidth = 2.5; g.stroke(); return; } if (esc2.has(s.k)) { g.fillStyle = st.analisado && s.analise ? U.corTsrf(s.analise.tsrf) : '#1c3a7a'; g.globalAlpha = 0.9; g.fill(); g.globalAlpha = 1; g.strokeStyle = s.manual ? (s.fora ? '#ff3d3d' : '#ffffff') : '#0d1a38'; g.lineWidth = s.manual ? 2 : 1; g.stroke(); } else if (st.ferr !== 'mao') { g.strokeStyle = '#ffffff55'; g.lineWidth = 1; g.stroke(); } });
        if (st.aba === 'placas') U.notaFaces(proj, st.vagas).filter((f) => f.incl <= 45).forEach((f, i) => { const fc = U.faces(proj).find((x) => x.id === f.id); if (!fc) return; const c = m2tela(U.centroide(fc.pts)); rotulo(`${i === 0 ? '★ ' : ''}${n(f.nota * 100)}%`, c[0], c[1] - 6, i === 0 ? '#ffd23d' : '#fff'); });
      }
      // desenho em andamento
      if (st.des.length) {
        let pts = [...st.des]; if (st.ponteiro) pts.push(st.ponteiro);
        if (st.ferr === 'ret' && pts.length === 3) pts = U.retangulo3(pts[0], pts[1], pts[2]);
        g.strokeStyle = '#ffb000'; g.lineWidth = 2; g.setLineDash([6, 4]); caminho(pts, st.ferr === 'ret' && pts.length === 4); g.stroke(); g.setLineDash([]);
        st.des.forEach((p, k) => { const q = m2tela(p); g.fillStyle = k ? '#ffb000' : '#ff6700'; g.beginPath(); g.arc(q[0], q[1], 6, 0, 7); g.fill(); });
        if (pts.length >= 2) { const a = pts[pts.length - 2], z = pts[pts.length - 1], m = m2tela([(a[0] + z[0]) / 2, (a[1] + z[1]) / 2]); rotulo(n(Math.hypot(z[0] - a[0], z[1] - a[1]), 2) + ' m', m[0], m[1] - 10, '#ffd23d'); }
      }
      if (st.aba === 'cabos') desenharCabos();
      if (st.enc && st.enc.length) st.enc.forEach((p, k) => { const q = m2tela(p); g.fillStyle = k % 2 ? '#5cf0ff' : '#ff3df0'; g.beginPath(); g.arc(q[0], q[1], 7, 0, 7); g.fill(); rotulo(String(Math.floor(k / 2) + 1), q[0], q[1] - 12, k % 2 ? '#5cf0ff' : '#ff3df0'); });
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
      else if (A && A.tipo === 'obst') { const o = obst(A.id); o.x += dm[0]; o.z += dm[1]; if (o.pts) o.pts = o.pts.map((p) => [p[0] + dm[0], p[1] + dm[1]]); sujar(); }
      else if (A && A.tipo === 'drone') { proj.drone.cx += dm[0]; proj.drone.cz += dm[1]; sujar(true); }
      else if (A && A.tipo === 'placa') { const mm = proj.layout.manuais.find((x) => x.id === A.id); if (mm) { mm.x += dm[0]; mm.z += dm[1]; st.vagas = U.vagas(proj); st.escolhidas = U.escolher(st.vagas, proj.layout.qtd, proj.layout); } }
      else { st.view.ox -= dm[0]; st.view.oz -= dm[1]; }
      desenhar();
    });
    const fim = (e) => {
      toques.delete(e.pointerId); if (toques.size < 2) pinca = null;
      if (!arrasto) return; const a = arrasto; arrasto = null;
      if (!a.moveu) tocar(tela2m(...a.ini), a.ini, a.alvo);
      else if (a.alvo && a.alvo.tipo === 'placa') { const L = proj.layout, mm = L.manuais.find((x) => x.id === a.alvo.id); if (mm) { const outras = st.escolhidas.filter((v) => v.mid !== mm.id), nv = U.alinharManual(proj, outras, mm); Object.assign(mm, { x: nv.x, z: nv.z, b: nv.b }); const plN = U.placaManual(proj, mm), bl = plN && aguaBloqueada(plN, mm.id); if (bl) { mm.x = a.alvo.x0; mm.z = a.alvo.z0; mm.b = a.alvo.b0; msg(bl, true); } else if (!U.faceEm(proj, [mm.x, mm.z])) { L.manuais = L.manuais.filter((x) => x !== mm); msg('A placa saiu do telhado e foi tirada.', true); } } sujar(); painel(); }
      else if (a.alvo) { if (a.alvo.tipo === 'vertice') { const b = bloco(a.alvo.id); if (b && (b.forma || '1') !== '1') { b.pts = U.retanguloDe(b.pts).cantos; sujar(); desenhar(); } } painel(); refazer(); }
    };
    cv.addEventListener('pointerup', fim); cv.addEventListener('pointercancel', fim);
    cv.addEventListener('wheel', (e) => { e.preventDefault(); const sp = pos(e), m0 = tela2m(...sp); st.view.esc = Math.max(2, Math.min(200, st.view.esc * (e.deltaY < 0 ? 1.15 : 1 / 1.15))); const m1 = tela2m(...sp); st.view.ox += m0[0] - m1[0]; st.view.oz += m0[1] - m1[1]; desenhar(); }, { passive: false });
    ov.addEventListener('click', (e) => { const z = e.target.closest('[data-zoom]'); if (!z) return; const v = +z.dataset.zoom; if (!v) centralizar(); else { st.view.esc = Math.max(2, Math.min(200, st.view.esc * (v > 0 ? 1.3 : 1 / 1.3))); desenhar(); } });
    const bloco = (id) => proj.blocos.find((b) => b.id === id), obst = (id) => proj.obst.find((o) => o.id === id);
    function pegarAlvo(sp, m) {
      if (st.aba === 'telhados' && (!st.ferr || st.ferr === 'ajustar') && st.sel && st.sel.t === 'b') {
        const b = bloco(st.sel.id); if (b) { const k = b.pts.findIndex((p) => { const q = m2tela(p); return Math.hypot(q[0] - sp[0], q[1] - sp[1]) < 13; }); if (k >= 0) return { tipo: 'vertice', id: b.id, k };
          if ((b.forma || '1') === '1') for (let i = 0; i < b.pts.length; i++) { const p = b.pts[i], q = b.pts[(i + 1) % b.pts.length], a = m2tela(p), z = m2tela(q), nr = normalFora(b, i), c = [(a[0] + z[0]) / 2 + nr[0] * 16, (a[1] + z[1]) / 2 + nr[1] * 16]; if (Math.hypot(c[0] - sp[0], c[1] - sp[1]) < 12) return { tipo: 'caimento', id: b.id, k: i }; }
          if (U.dentro(m, b.pts)) return { tipo: 'bloco', id: b.id }; }
      }
      if (st.aba === 'obst' && st.ferr === 'ajustar') { const o = proj.obst.find((x) => U.dentro(m, U.pegadaObst(x, 0.3))); if (o) return { tipo: 'obst', id: o.id }; }
      if (st.aba === 'foto' && st.ferr === 'moverDrone' && proj.drone) return { tipo: 'drone' };
      if (st.aba === 'placas' && st.ferr === 'mao') { const s = st.vagas.find((v) => v.manual && U.dentro(m, v.cantos)); if (s) { const mm = proj.layout.manuais.find((x) => x.id === s.mid); return { tipo: 'placa', id: s.mid, x0: mm.x, z0: mm.z, b0: mm.b }; } }
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
      if (st.aba === 'cabos' && (st.ferr === 'posInv' || st.ferr === 'posQuadro')) { const C2 = proj.cabos, k = st.ferr === 'posInv' ? 'inv' : 'quadro'; C2[k] = { x: Math.round(m[0] * 100) / 100, z: Math.round(m[1] * 100) / 100, h: (C2[k] && C2[k].h) || 1.5 }; st.ferr = null; painel(); desenhar(); return; }
      if (st.aba === 'foto' && st.ferr === 'encaixar') { st.enc.push(m); if (st.enc.length === 4) encaixar2(); desenhar(); painel(); return; }
      if (st.aba === 'foto' && st.ferr === 'regua') { st.regua.push(m); if (st.regua.length > 2) st.regua = [m]; desenhar(); painel(); return; }
      if (st.aba === 'telhados') {
        if (alvo && alvo.tipo === 'caimento') { const b = bloco(alvo.id); if ((b.forma || '1') !== '1') return; b.az = azDe(normalFora(b, alvo.k)); sujar(); painel(); desenhar(); return; }
        if (st.ferr === 'magica') { varinha(m); return; }
        if (st.ferr === 'ret' || st.ferr === 'pol') {
          const p = encaixar(m, sp);
          if (st.ferr === 'pol' && st.des.length >= 3) { const q = m2tela(st.des[0]); if (Math.hypot(q[0] - sp[0], q[1] - sp[1]) < 14) { fecharDesenho(st.des); return; } }
          st.des.push(p); if (st.ferr === 'ret' && st.des.length === 3) { fecharDesenho(U.retangulo3(...st.des)); return; } desenhar(); painel(); return;
        }
        const b = [...proj.blocos].reverse().find((x) => U.dentro(m, x.pts)); st.sel = b ? { t: 'b', id: b.id } : null; painel(); desenhar(); return;
      }
      if (st.aba === 'obst') {
        if (st.ferr === 'area') {
          if (st.des.length >= 3) { const q = m2tela(st.des[0]); if (Math.hypot(q[0] - sp[0], q[1] - sp[1]) < 14) { fecharArea(); return; } }
          st.des.push(m); desenhar(); painel(); return;
        }
        if (st.ferr && st.ferr !== 'ajustar') { const T = U.OBST[st.ferr], o = { id: U.novoId('o'), tipo: st.ferr, x: m[0], z: m[1], h: T.h }; if (T.redondo) o.r = T.r; else { o.w = T.w; o.d = T.d; o.rot = 0; } proj.obst.push(o); st.sel = { t: 'o', id: o.id }; st.ferr = 'ajustar'; sujar(); painel(); desenhar(); return; }
        const o = proj.obst.find((x) => U.dentro(m, U.pegadaObst(x, 0.3))); st.sel = o ? { t: 'o', id: o.id } : null; painel(); desenhar(); return;
      }
      if (st.aba === 'placas' && (st.ferr === 'mao' || st.ferr === 'girar')) { tocarMao(m); return; }
      if (st.aba === 'placas') {
        const s = st.vagas.find((v) => U.dentro(m, v.cantos)); if (!s) return;
        const L = proj.layout, esta = st.escolhidas.some((x) => x.k === s.k), aqui = { b: s.b, x: Math.round(s.c[0] * 100) / 100, z: Math.round(s.c[1] * 100) / 100 };
        const longe = (e) => typeof e === 'string' ? e !== s.k : (String(e.b).split('~')[0] !== String(s.b).split('~')[0] || Math.hypot(e.x - s.c[0], e.z - s.c[1]) > 0.5);
        L.forcarOn = (L.forcarOn || []).filter(longe); L.forcarOff = (L.forcarOff || []).filter(longe);
        (esta ? L.forcarOff : L.forcarOn).push(aqui); recompor(); painel(); return;
      }
    }
    /* placas à mão: tocar no telhado põe (encosta na vizinha), tocar na placa tira, arrastar move; "girar" troca retrato/paisagem */
    /* inversor com poucas MPPTs: uma água a mais não pode (cada MPPT só recebe placas de uma água) */
    function aguaBloqueada(pl, ignorar) {
      const max = proj.layout.maxAguas; if (!max) return null;
      // valem as placas que vão ficar: com "só as que eu colocar", só as à mão
      const ficam = st.escolhidas.filter((v) => (proj.layout.soMao === false || v.manual) && (ignorar == null || v.mid !== ignorar));
      const ch = new Set(ficam.map((v) => U.chaveFace(v.incl, v.az)));
      if (ch.has(U.chaveFace(pl.incl, pl.az)) || ch.size < max) return null;
      return `O inversor tem <b>${max} MPPT${max > 1 ? 's' : ''}</b> e as placas já estão em ${ch.size} água${ch.size > 1 ? 's' : ''}: cada MPPT só recebe placas de uma água (mesma inclinação e direção). Ponha esta placa numa água já usada, ou escolha um inversor com mais MPPTs ou micro.`;
    }
    function tocarMao(m) {
      const L = proj.layout, noVaga = st.escolhidas.find((v) => U.dentro(m, v.cantos));
      if (st.ferr === 'girar') {
        if (!noVaga) return msg('Toque numa placa para girar.', true);
        const ori = (noVaga.ori || (noVaga.w > noVaga.hs ? 'paisagem' : 'retrato')) === 'paisagem' ? 'retrato' : 'paisagem';
        let mm = noVaga.manual ? L.manuais.find((x) => x.id === noVaga.mid) : null;
        if (mm) mm.ori = ori; else { mm = { id: U.novoId('p'), b: noVaga.b, x: noVaga.c[0], z: noVaga.c[1], ori }; L.manuais.push(mm); }
        if (L.soMao === undefined) L.soMao = true;
        const pl = U.placaManual(proj, mm), bate = pl && st.escolhidas.some((v) => v.manual && v.mid !== mm.id && U.cruzam(v.cantos, pl.cantos));
        sujar(); painel(); msg(`Placa ${ori === 'paisagem' ? 'deitada (paisagem)' : 'em pé (retrato)'}.${bate ? ' <b>Ficou encostando noutra placa</b> (borda vermelha): arraste para um espaço livre.' : ''}`, bate); return;
      }
      if (noVaga && noVaga.manual) { L.manuais = L.manuais.filter((x) => x.id !== noVaga.mid); sujar(); painel(); return; }
      if (noVaga && !noVaga.manual) { // placa automática: vira placa à mão no mesmo lugar (aí dá para arrastar)
        L.manuais.push({ id: U.novoId('p'), b: noVaga.b, x: noVaga.c[0], z: noVaga.c[1], ori: noVaga.w > noVaga.hs ? 'paisagem' : 'retrato' }); if (L.soMao === undefined) L.soMao = true; sujar(); painel(); return;
      }
      const f = U.faceEm(proj, m); if (!f) return msg('Toque em cima de um telhado para pôr a placa.', true);
      const nova = U.alinharManual(proj, st.escolhidas, { id: U.novoId('p'), x: m[0], z: m[1], ori: st.oriMao }), pl = U.placaManual(proj, nova);
      if (!pl) return;
      if (st.escolhidas.some((v) => v.manual && U.cruzam(v.cantos, pl.cantos))) return msg('Ali já tem placa. Toque num espaço livre ou arraste a placa.', true);
      const bloq = aguaBloqueada(pl); if (bloq) return msg(bloq, true);
      if (proj.obst.some((o) => o.tipo === 'area' && U.cruzam(o.pts, pl.cantos))) return msg('Ali é uma <b>área sem placa</b> (passo 3). Escolha outro lugar ou apague a área.', true);
      if (L.soMao === undefined) L.soMao = true;
      L.manuais.push(nova); sujar(); painel();
      msg(`${L.manuais.length} placa(s) à mão${L.manuais.length > L.qtd ? ` · <b>o kit tem ${L.qtd}</b>` : ` de ${L.qtd} do kit`}. ${pl.fora ? '<b>Esta passou da borda do telhado</b>: arraste para dentro. ' : ''}Toque para pôr a próxima (ela encosta na vizinha), na placa para tirar, ou arraste para mover.`, pl.fora);
    }
    /* ---------- 🪄 tocar no telhado: o sistema acha o contorno daquele telhado na foto ----------
       Cresce a área a partir do toque pela cor (tom da telha, aceitando a água no sol e a água na sombra),
       ajusta o menor retângulo que cobre e chuta a forma: cerâmica com fiadas em duas direções = 4 águas;
       cerâmica com fiadas numa direção = 2 águas; fibrocimento/metal = 1 água. O vendedor confere. */
    let fotoPx = null;
    function pixelsDaFoto() {
      const usaDrone = !!(imgDrone && proj.drone), im = usaDrone ? imgDrone : imgFundo; if (!im) return null;
      const chave = (usaDrone ? 'd' : 'f') + im.src.length + ':' + (usaDrone ? [proj.drone.escala, proj.drone.rot, proj.drone.cx, proj.drone.cz].join(',') : proj.fundo.ladoM);
      if (fotoPx && fotoPx.chave === chave) return fotoPx;
      const W0 = im.naturalWidth || im.width, H0 = im.naturalHeight || im.height, f = Math.min(1, 1000 / Math.max(W0, H0)), w = Math.round(W0 * f), h = Math.round(H0 * f);
      const c = document.createElement('canvas'); c.width = w; c.height = h; const cx = c.getContext('2d', { willReadFrequently: true }); cx.drawImage(im, 0, 0, w, h);
      let dados; try { dados = cx.getImageData(0, 0, w, h).data; } catch { return null; }
      let paraPx, paraM;
      if (usaDrone) { const d = proj.drone, k = d.w / w, r = (d.rot || 0) * Math.PI / 180, co = Math.cos(r), si = Math.sin(r);
        paraM = (px, py) => { const u = (px * k - d.w / 2) * d.escala, v = (py * k - d.h / 2) * d.escala; return [(d.cx || 0) + u * co - v * si, (d.cz || 0) + u * si + v * co]; };
        paraPx = (m) => { const dx = m[0] - (d.cx || 0), dz = m[1] - (d.cz || 0); return [((dx * co + dz * si) / d.escala + d.w / 2) / k, ((-dx * si + dz * co) / d.escala + d.h / 2) / k]; };
      } else { const L = proj.fundo.ladoM; paraM = (px, py) => [px / w * L - L / 2, py / h * L - L / 2]; paraPx = (m) => [(m[0] + L / 2) / L * w, (m[1] + L / 2) / L * h]; }
      fotoPx = { chave, w, h, dados, paraM, paraPx, mPorPx: usaDrone ? proj.drone.escala * proj.drone.w / w : proj.fundo.ladoM / w }; return fotoPx;
    }
    function varinha(m) {
      const F = pixelsDaFoto(); if (!F) return msg('Envie a foto do drone ou busque o satélite (passo 1).', true);
      const { w, h, dados } = F, s0 = F.paraPx(m).map(Math.round); if (s0[0] < 2 || s0[1] < 2 || s0[0] >= w - 2 || s0[1] >= h - 2) return msg('Toque dentro da foto.', true);
      const cor = (i) => { const r = dados[i * 4], g2 = dados[i * 4 + 1], b2 = dados[i * 4 + 2], sm = r + g2 + b2 + 1; return [r / sm, g2 / sm, sm / 3]; };
      let ref = [0, 0, 0], nr = 0; for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const c = cor((s0[1] + dy) * w + s0[0] + dx); ref = ref.map((v, k) => v + c[k]); nr++; } ref = ref.map((v) => v / nr);
      const ceram = ref[0] - ref[2] * 0 > 0.4 && ref[0] > ref[1] * 1.25; // tom alaranjado
      const T = ceram ? 1 : 0.62, dist = (c) => Math.hypot((c[0] - ref[0]) * 330, (c[1] - ref[1]) * 330, (c[2] - ref[2]) * (ceram ? 0.22 : 0.5));
      // brilho suavizado (5×5): a ondulação da telha some, a borda da parede/calha fica
      let lb = F.lb; if (!lb) { const I = new Float64Array((w + 1) * (h + 1)); for (let y = 0; y < h; y++) { let lin = 0; for (let x = 0; x < w; x++) { const k = (y * w + x) * 4; lin += (dados[k] + dados[k + 1] + dados[k + 2]) / 3; I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + lin; } }
        lb = F.lb = new Float32Array(w * h); const R2 = 2; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const x0 = Math.max(0, x - R2), x1 = Math.min(w, x + R2 + 1), y0 = Math.max(0, y - R2), y1 = Math.min(h, y + R2 + 1); lb[y * w + x] = (I[y1 * (w + 1) + x1] - I[y0 * (w + 1) + x1] - I[y1 * (w + 1) + x0] + I[y0 * (w + 1) + x0]) / ((x1 - x0) * (y1 - y0)); } }
      const ok = new Uint8Array(w * h), fila = [s0[1] * w + s0[0]], max = w * h * 0.35; ok[fila[0]] = 1; let cont = 0;
      while (fila.length && cont < max) { const i = fila.pop(); cont++; const x = i % w, y = (i / w) | 0;
        for (const j of [i - 1, i + 1, i - w, i + w]) { if (j < 0 || j >= w * h || ok[j] || (j % w === 0 && x === w - 1) || (x === 0 && j === i - 1)) continue; if (dist(cor(j)) < 30 * T && (ceram || Math.abs(lb[j] - lb[i]) < 6)) { ok[j] = 1; fila.push(j); } } }
      if (cont < 150) return msg('Não achei o telhado nesse ponto: toque no meio da telha, longe de placa, antena ou sombra forte. Ou desenhe com ▭ Retângulo.', true);
      if (cont >= max) return msg('A área vazou para fora do telhado (a cor parece com o chão ou a parede). Desenhe este com ▭ Retângulo.', true);
      // contorno → casco convexo → menor retângulo
      const pts = []; for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x; if (ok[i] && (!ok[i - 1] || !ok[i + 1] || !ok[i - w] || !ok[i + w])) pts.push([x, y]); }
      pts.sort((a2, b2) => a2[0] - b2[0] || a2[1] - b2[1]); const cr = (o, a2, b2) => (a2[0] - o[0]) * (b2[1] - o[1]) - (a2[1] - o[1]) * (b2[0] - o[0]);
      const lo = [], hi = []; pts.forEach((p) => { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }); [...pts].reverse().forEach((p) => { while (hi.length >= 2 && cr(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p); });
      const casco = [...lo.slice(0, -1), ...hi.slice(0, -1)]; let melhor = null;
      casco.forEach((p, k) => { const q = casco[(k + 1) % casco.length], L = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1, u = [(q[0] - p[0]) / L, (q[1] - p[1]) / L], v = [-u[1], u[0]];
        const us = casco.map((c) => c[0] * u[0] + c[1] * u[1]), vs = casco.map((c) => c[0] * v[0] + c[1] * v[1]), a0 = Math.min(...us), a1 = Math.max(...us), b0 = Math.min(...vs), b1 = Math.max(...vs), ar = (a1 - a0) * (b1 - b0);
        if (!melhor || ar < melhor.ar) melhor = { ar, u, v, a0, a1, b0, b1 }; });
      const R = melhor, P = (a2, b2) => [R.u[0] * a2 + R.v[0] * b2, R.u[1] * a2 + R.v[1] * b2];
      { const la = (R.a1 - R.a0) * F.mPorPx, lb2 = (R.b1 - R.b0) * F.mPorPx, prop = Math.max(la, lb2) / Math.max(Math.min(la, lb2), 0.1);
        if (Math.min(la, lb2) < 1.5 || prop > 5 || la * lb2 > (ceram ? 400 : 220)) return msg(ceram ? 'O contorno saiu estranho neste telhado. Desenhe com ▭ Retângulo (3 toques).' : 'Telha cinza (fibrocimento/metal) se confunde com a calçada e a laje: neste não consegui o contorno. Desenhe com <b>▭ Retângulo</b> (3 toques).', true); }
      if (cont / R.ar < 0.55) msg('O formato achado não é bem um retângulo (telhado em L ou com recortes): confira os cantos.', true);
      // forma pela textura: direção das fiadas em blocos de 8×8 pixels
      let par = 0, per = 0; const lum = (x, y) => { const i = (y * w + x) * 4; return dados[i] * 0.3 + dados[i + 1] * 0.59 + dados[i + 2] * 0.11; };
      for (let by = 1; by < h - 9; by += 8) for (let bx = 1; bx < w - 9; bx += 8) { if (!ok[(by + 4) * w + bx + 4]) continue; let xx = 0, yy = 0, xy = 0;
        for (let y = by; y < by + 8; y++) for (let x = bx; x < bx + 8; x++) { const gx = lum(x + 1, y) - lum(x - 1, y), gy = lum(x, y + 1) - lum(x, y - 1); xx += gx * gx; yy += gy * gy; xy += gx * gy; }
        const coer = Math.hypot(xx - yy, 2 * xy) / (xx + yy + 1e-6); if (coer < 0.3) continue; const ang = 0.5 * Math.atan2(2 * xy, xx - yy), eixo = Math.atan2(R.u[1], R.u[0]), rel = ((ang - eixo) % Math.PI + Math.PI) % Math.PI;
        if (Math.abs(rel - Math.PI / 2) < Math.PI / 6) per++; else if (rel < Math.PI / 6 || rel > 5 * Math.PI / 6) par++; }
      const frac = Math.min(par, per) / Math.max(par + per, 1), forma = !ceram ? '1' : frac > 0.18 ? '4' : '2';
      const cantos = [P(R.a0, R.b0), P(R.a1, R.b0), P(R.a1, R.b1), P(R.a0, R.b1)].map((c) => F.paraM(c[0], c[1]).map((v) => Math.round(v * 100) / 100));
      const ref2 = proj.blocos[proj.blocos.length - 1], telha = ceram ? 'ceramico' : (ref2 && ref2.telha !== 'ceramico' ? ref2.telha : 'fibrocimento');
      const b = { id: U.novoId('b'), nome: 'Telhado ' + (proj.blocos.length + 1), pts: cantos, forma, cumeeira: 'longo', incl: grausDe(ceram ? 35 : 10), az: 0, alturaBeiral: ref2 ? ref2.alturaBeiral : 3, platibanda: 0, telha, usar: true, orientacao: 'retrato', fonte: 'varinha' };
      b.az = azDe(normalFora(b, 0)); proj.blocos.push(b); st.sel = { t: 'b', id: b.id }; sujar(); painel(); desenhar();
      msg(`Achei um telhado de <b>${telha === 'ceramico' ? 'cerâmica' : 'fibrocimento/metal'}</b> de ${n(Math.hypot(cantos[1][0] - cantos[0][0], cantos[1][1] - cantos[0][1]), 1)} × ${n(Math.hypot(cantos[2][0] - cantos[1][0], cantos[2][1] - cantos[1][1]), 1)} m e marquei <b>${forma} água${forma === '1' ? '' : 's'}</b>. Confira a forma, a <b>altura do beiral</b> e a <b>inclinação</b> ao lado${forma === '1' ? ' e o lado por onde a água sai (bolinha laranja)' : ''}. Toque no próximo telhado.`);
    }
    function fecharArea() {
      if (st.des.length < 3) return; const pts = st.des.map((p) => [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100]), c = U.centroide(pts);
      const o = { id: U.novoId('o'), tipo: 'area', pts, x: c[0], z: c[1], h: 0 }; proj.obst.push(o); st.des = []; st.ponteiro = null; st.sel = { t: 'o', id: o.id }; st.ferr = 'ajustar'; sujar(); painel(); desenhar();
      msg('Área sem placa criada: nenhuma placa vai para dentro dela (nem no automático, nem à mão).');
    }
    function fecharDesenho(pts) {
      const T = proj.tipoTelhado, ref = st.sel && st.sel.t === 'b' ? bloco(st.sel.id) : proj.blocos[proj.blocos.length - 1];
      const telha = ref ? ref.telha : T, forma = pts.length === 4 && st.ferr === 'ret' ? (ref && ref.forma) || (telha === 'ceramico' ? '4' : '1') : '1';
      const b = { id: U.novoId('b'), nome: 'Telhado ' + (proj.blocos.length + 1), pts, forma, cumeeira: 'longo', incl: ref ? ref.incl : grausDe(telha === 'ceramico' ? 35 : telha === 'laje' ? 0 : 10), az: 0, alturaBeiral: ref ? ref.alturaBeiral : 3, platibanda: forma !== '1' ? 0 : ref ? ref.platibanda : (telha === 'ceramico' ? 0 : 0.5), telha, usar: true, orientacao: 'retrato' };
      b.az = azDe(normalFora(b, 0)); // caimento inicial para a primeira borda desenhada
      proj.blocos.push(b); st.des = []; st.ponteiro = null; st.sel = { t: 'b', id: b.id }; st.ferr = 'ajustar'; sujar(); painel(); desenhar();
      msg(b.forma === '1' ? 'Telhado criado. Ajuste <b>altura</b>, <b>inclinação</b> e <b>platibanda</b> ao lado e toque na <b>bolinha laranja</b> da borda por onde a água sai.' : `Telhado de <b>${b.forma} águas</b> criado: as águas, a cumeeira e os espigões saem sozinhos. Confira a <b>forma</b>, a <b>altura do beiral</b> e a <b>inclinação</b> ao lado.`);
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
        if (viewer) viewer.atualizar(st.aba === 'placas' || st.aba === 'sol' || st.aba === 'cabos' ? st.escolhidas : []); desenhar(); lado();
        if (st.aba === 'cabos') { const el = $('#t3Cabos', ov); if (el) el.innerHTML = relatorioCabos(); }
        if ((st.aba === 'placas' || st.aba === 'sol' || st.aba === 'cabos') && !st.analisado && !st.ocupado) { clearTimeout(refazer.a); refazer.a = setTimeout(analisar, 700); } // recalcula sozinho depois de parar de mexer
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
      if (proj.layout.soMao) { msg(`${st.escolhidas.length} placa(s) colocadas à mão${st.escolhidas.length !== proj.layout.qtd ? ` · <b>o kit tem ${proj.layout.qtd}</b>` : ' · igual ao kit ✓'}. ${fracas ? `<b>${fracas} com aproveitamento abaixo de 80%</b> (laranja/vermelho). ` : ''}`, st.escolhidas.length !== proj.layout.qtd); return; }
      msg(`${falta > 0 ? `<b>Só couberam ${st.escolhidas.length} das ${proj.layout.qtd} placas.</b> Use <b>✋ Colocar à mão</b> para pôr onde quiser. ` : `Pronto: as ${st.escolhidas.length} placas estão nas melhores posições pelo sol do ano inteiro. `}${fracas ? `<b>${fracas} com aproveitamento abaixo de 80%</b> (laranja/vermelho). ` : ''}Toque numa placa para tirar ou num espaço vazio para pôr.`, falta > 0);
    }

    /* ---------- abas ---------- */
    function irAba(a) {
      st.aba = a; st.ferr = a === 'telhados' ? (proj.blocos.length ? 'ajustar' : 'ret') : a === 'obst' ? 'ajustar' : null; st.des = []; st.regua = [];
      ov.querySelectorAll('[data-aba]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.aba === a)));
      const dica = { cabos: temKit('micro') && !temKit('string') ? 'Toque em <b>Onde fica o quadro</b> e marque no desenho o quadro de ligação: o sistema mede o cabo tronco e o CA dos micros.' : 'Toque em <b>Onde fica o inversor</b> e marque no desenho: o sistema mede o cabo de cada string pelo caminho da estrutura e das paredes.', foto: proj.drone ? 'Ajuste a escala com a <b>régua</b> (toque nas 2 pontas de uma medida conhecida) e gire até o <b>norte</b> ficar para cima.' : 'Busque o satélite pelo endereço e, se tiver, envie a <b>foto de cima do drone</b> (câmera a 90°, 40 a 60 m de altura).', telhados: 'Desenhe cada parte do telhado com <b>3 toques</b>: 2 cantos de uma parede e o terceiro para a profundidade. Os cantos grudam nos telhados vizinhos.', obst: "Toque no tipo e depois no lugar: caixa d'água, condensadora, antena, boiler, coletor de aquecimento, árvore ou prédio vizinho (a altura faz a sombra). Para um lugar onde não pode ter placa, use <b>🚫 Área sem placa</b> e desenhe.", placas: 'As placas usam a medida da placa do kit. Toque em <b>Calcular o melhor sol</b>: o sistema testa todas as posições e escolhe as melhores.', sol: 'Veja o sol passar no dia escolhido. Placa vermelha = na sombra naquele horário.' }[a];
      if ((a === 'placas' || a === 'sol' || a === 'cabos') && proj.blocos.length && !st.enquadrado) { st.enquadrado = true; centralizar(); }
      st.enc = [];
      msg(dica); painel(); refazer();
      if ((a === 'placas' || a === 'sol' || a === 'cabos') && !st.analisado && !st.ocupado) analisar();
      if (viewer) { viewer.cor(a === 'sol' ? (st.corPlacas === 'agora' ? 'agora' : 'tsrf') : 'tsrf'); if (a !== 'sol' && st.play) parar(); }
    }
    ov.addEventListener('click', (e) => {
      if (e.target.closest('[data-x]')) { fechar(); return; }
      const ab = e.target.closest('[data-aba]'); if (ab) { irAba(ab.dataset.aba); return; }
      const f = e.target.closest('[data-ferr]'); if (f) { st.ferr = f.dataset.ferr || null; st.des = []; st.regua = []; st.enc = []; painel(); desenhar(); if (/^(posInv|posQuadro|regua|encaixar|ret|pol|mao|girar|area|magica)$/.test(st.ferr)) { const r = tela.getBoundingClientRect(); if (r.top < 0 || r.bottom > innerHeight) tela.scrollIntoView({ block: 'center', behavior: 'smooth' }); } return; }
      const ac = e.target.closest('[data-acao]'); if (ac) acao(ac.dataset.acao, ac);
    });
    const ehEscolha = (t) => t.type === 'checkbox' || t.type === 'radio' || t.type === 'file' || t.tagName === 'SELECT';
    ov.addEventListener('input', (e) => { if (!ehEscolha(e.target)) campo(e.target); });
    ov.addEventListener('change', (e) => { const t = e.target; if (t.dataset.ficha) { lerFicha(t.dataset.ficha, t.files[0]); return; } if (t.id === 't3Arq') enviarFoto(t.files[0]); else if (ehEscolha(t) || t.dataset.mp) campo(t, true); });
    ov.addEventListener('keydown', (e) => {
      if (e.target.closest('input,select,textarea')) return;
      if (e.key === 'Escape' && (st.des.length || st.regua.length)) { st.des = []; st.regua = []; st.ponteiro = null; desenhar(); painel(); e.preventDefault(); }
      else if (e.key === 'Backspace' && st.des.length) { st.des.pop(); desenhar(); painel(); e.preventDefault(); }
      else if (e.key === 'Enter' && st.ferr === 'pol' && st.des.length >= 3) { fecharDesenho(st.des); e.preventDefault(); }
      else if (e.key === 'Enter' && st.ferr === 'area' && st.des.length >= 3) { fecharArea(); e.preventDefault(); }
    });

    function barraMao() {
      const fl = $('#t3Flut', ov); if (!fl) return; const on = st.aba === 'placas' && (st.ferr === 'mao' || st.ferr === 'girar'); fl.hidden = !on; if (!on) return;
      const L = proj.layout;
      fl.innerHTML = `<button data-acao="oriMao" data-v="retrato" aria-pressed="${st.ferr === 'mao' && st.oriMao === 'retrato'}">▯ Retrato</button><button data-acao="oriMao" data-v="paisagem" aria-pressed="${st.ferr === 'mao' && st.oriMao === 'paisagem'}">▭ Paisagem</button><button data-ferr="girar" aria-pressed="${st.ferr === 'girar'}">🔄 Girar</button><button data-acao="ima" aria-pressed="${L.ima !== false}" title="encostar na placa vizinha quando soltar perto dela">🧲 Imã</button><span>${L.manuais.length}/${L.qtd}</span><button data-ferr="">✓ Pronto</button>`;
    }
    function painel() {
      barraMao();
      const el = $('#t3Painel', ov), A = st.aba;
      if (A === 'foto') {
        const d = proj.drone;
        el.innerHTML = `<div class="t3-linha"><input type="text" id="t3End" placeholder="Rua, número, bairro, cidade" value="${esc(proj.endereco || enderecoOrc())}"><button class="btn sol pequeno" data-acao="buscar">🛰️ Satélite</button></div>
          <div class="t3-linha"><label class="btn vidro pequeno" style="cursor:pointer">📷 ${d ? 'Trocar' : 'Enviar'} foto do drone<input type="file" id="t3Arq" accept="image/*" hidden></label>${d ? '<button class="link" data-acao="tirarDrone">tirar a foto do drone</button>' : ''}</div>
          ${d ? `<div class="t3-ferr"><button data-ferr="regua" aria-pressed="${st.ferr === 'regua'}">📏 Régua (escala)</button><button data-ferr="moverDrone" aria-pressed="${st.ferr === 'moverDrone'}">✋ Mover a foto</button>${proj.fundo ? `<button data-ferr="encaixar" aria-pressed="${st.ferr === 'encaixar'}">📍 Encaixar no satélite (2 pontos)</button>` : ''}</div>
            ${st.ferr === 'encaixar' ? `<p class="mini"><b>${['1º canto na FOTO DO DRONE', 'o mesmo 1º canto no SATÉLITE', '2º canto na FOTO DO DRONE (longe do 1º)', 'o mesmo 2º canto no SATÉLITE'][st.enc.length] || ''}</b>: toque num canto bem visível (quina da casa, do muro ou da piscina). A escala e o norte saem do satélite, sem trena.</p>` : ''}
            ${st.ferr === 'regua' ? `<div class="t3-linha"><span class="mini">${st.regua.length < 2 ? 'Toque nas 2 pontas de uma medida que você conhece (uma parede medida na trena, a piscina, a frente do lote).' : `Medida tocada: ${n(Math.hypot(st.regua[1][0] - st.regua[0][0], st.regua[1][1] - st.regua[0][1]), 2)} m na foto. Quanto mede de verdade?`}</span>${st.regua.length === 2 ? '<input type="text" inputmode="decimal" id="t3Real" placeholder="metros" style="width:90px" autocomplete="off"><button class="btn sol pequeno" data-acao="aplicarRegua">Aplicar</button>' : ''}</div>` : ''}
            <label class="campo"><span>Norte da foto: girar <b id="t3RotO">${n(d.rot || 0, 1)}°</b>${d.auto && d.auto.rot ? '<small>veio da bússola do drone</small>' : '<small>deixe a frente da casa como ela é na rua: norte para cima</small>'}</span><input type="range" id="t3Rot" min="-180" max="180" step="0.5" value="${d.rot || 0}"></label>
            <div class="t3-linha"><button class="link" data-acao="rot-90">↺ 90°</button><button class="link" data-acao="rot90">↻ 90°</button><span class="mini">escala: ${n(d.escala * 100, 2)} cm por ponto · a foto cobre ${n(d.w * d.escala, 1)} × ${n(d.h * d.escala, 1)} m${d.escalaConferida ? ' · <b style="color:var(--verde,#3ddc97)">conferida na régua</b>' : d.auto && d.auto.escala ? ' · pela altura do voo' : ' · <b style="color:var(--laranja)">confira na régua</b>'}</span></div>
            ${proj.fundo ? `<label class="campo"><span>Transparência para encaixar no satélite</span><input type="range" id="t3Alfa" min="0.2" max="1" step="0.05" value="${st.alfaDrone}"></label>` : ''}` : ''}
          <p class="mini">Dica: foto do drone bem de cima (câmera a 90°) e o norte para cima. Com o satélite junto, deixe a foto meio transparente e encaixe as bordas da casa.</p>`;
      } else if (A === 'telhados') {
        const b = st.sel && st.sel.t === 'b' ? bloco(st.sel.id) : null;
        const desenhando = (st.ferr === 'ret' || st.ferr === 'pol') && st.des.length;
        el.innerHTML = `<div class="t3-ferr">${imgDrone || imgFundo ? `<button data-ferr="magica" aria-pressed="${st.ferr === 'magica'}">🪄 Tocar no telhado</button>` : ''}<button data-ferr="ret" aria-pressed="${st.ferr === 'ret'}">▭ Retângulo (3 toques)</button><button data-ferr="pol" aria-pressed="${st.ferr === 'pol'}">⬠ Formato livre</button><button data-ferr="ajustar" aria-pressed="${st.ferr === 'ajustar'}">✋ Ajustar</button></div>
          ${desenhando ? `<div class="t3-linha"><span class="mini">${st.ferr === 'ret' ? ['', 'Toque no outro canto da mesma parede.', 'Agora toque do outro lado, para dar a profundidade.'][st.des.length] : `${st.des.length} ponto(s). Toque no primeiro ponto para fechar.`}</span><button class="link" data-acao="desfazerPonto">desfazer ponto</button>${st.ferr === 'pol' && st.des.length >= 3 ? '<button class="btn sol pequeno" data-acao="fecharPol">Fechar o telhado</button>' : ''}<button class="link" data-acao="cancelarDes">cancelar</button></div>` : ''}
          <div class="t3-chips">${proj.blocos.map((x, i) => `<button class="t3-chip" data-acao="sel-b" data-id="${x.id}" style="border-color:${CORES[i % CORES.length]}" aria-pressed="${!!(b && b.id === x.id)}">${esc(x.nome)}</button>`).join('')}</div>
          ${b ? `${b.pts.length === 4 ? `<div class="t3-linha"><span class="mini">Forma:</span><div class="t3-chips">${[['1', '1 água / laje'], ['2', '2 águas'], ['4', '4 águas']].map(([v, t]) => `<button class="t3-chip" data-acao="forma" data-v="${v}" aria-pressed="${(b.forma || '1') === v}">${t}</button>`).join('')}</div>${b.forma === '2' ? `<select data-b="cumeeira" style="width:auto"><option value="longo" ${b.cumeeira !== 'curto' ? 'selected' : ''}>cumeeira no lado maior</option><option value="curto" ${b.cumeeira === 'curto' ? 'selected' : ''}>cumeeira no lado menor</option></select>` : ''}</div>` : ''}
            <div class="grade g2 t3-form">
            <label class="campo"><span>Nome</span><input data-b="nome" value="${esc(b.nome)}"></label>
            <label class="campo"><span>Altura do beiral (m)<small>do chão até a telha, no lado mais baixo</small></span><input type="number" step="0.1" min="0" data-b="alturaBeiral" value="${b.alturaBeiral}"></label>
            <label class="campo"><span>Inclinação (%)<small data-dica="incl">${n(b.incl, 1)}° · metálica 5–10%, cerâmica 30–40%</small></span><input type="number" step="1" min="0" max="100" data-b="inclPct" value="${pct(b.incl)}"></label>
            ${(b.forma || '1') === '1' ? `<label class="campo"><span>Platibanda (m acima da telha)<small>0 se não tiver mureta</small></span><input type="number" step="0.05" data-b="platibanda" value="${b.platibanda}"></label>` : '<span></span>'}
            <label class="campo"><span>Telha</span><select data-b="telha">${[['metalico', 'Metálica'], ['fibrocimento', 'Fibrocimento'], ['ceramico', 'Cerâmica'], ['laje', 'Laje']].map(([v, t]) => `<option value="${v}" ${b.telha === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
            <label class="campo"><span>Placas neste telhado</span><select data-b="orientacao"><option value="retrato" ${b.orientacao !== 'paisagem' ? 'selected' : ''}>em pé (retrato)</option><option value="paisagem" ${b.orientacao === 'paisagem' ? 'selected' : ''}>deitadas (paisagem)</option></select></label></div>
            ${(b.forma || '1') === '1' ? `<p class="mini">A água escorre para o <b>${ponto(b.az)}</b> (${b.az}°): as placas ficam viradas para lá. Para mudar, toque na <b>bolinha laranja</b> da borda por onde a água sai. <button class="link" data-acao="inverter">inverter</button></p>` : `<p class="mini">Águas: ${U.faces({ blocos: [b] }).map((f) => `<b>${ponto(f.az)}</b>`).join(', ')}. As placas vão para as que pegam mais sol.</p>`}
            <div class="t3-linha"><label class="chk"><input type="checkbox" data-b="usar" ${b.usar ? 'checked' : ''}> pode receber placas</label><button class="link" data-acao="dup">duplicar</button><button class="link" data-acao="apagarB">apagar</button></div>` : `<p class="mini">${proj.blocos.length ? 'Toque num telhado para editar.' : 'Nenhum telhado ainda.'} Comece pelo maior.</p>`}`;
      } else if (A === 'obst') {
        const o = st.sel && st.sel.t === 'o' ? obst(st.sel.id) : null, T = o ? U.OBST[o.tipo] : null;
        el.innerHTML = `<div class="t3-ferr">${Object.entries(U.OBST).map(([k, t]) => `<button data-ferr="${k}" aria-pressed="${st.ferr === k}">${ICONE[k]} ${t.nome}</button>`).join('')}<button data-ferr="ajustar" aria-pressed="${st.ferr === 'ajustar'}">✋ Mover</button></div>
          ${st.ferr === 'area' ? `<div class="t3-linha"><span class="mini">${st.des.length < 3 ? `Toque nos cantos da área onde não pode ter placa (claraboia, passagem, telha quebrada, parte que fica para depois). ${st.des.length} ponto(s).` : `${st.des.length} pontos. Toque no primeiro ponto para fechar.`}</span>${st.des.length ? '<button class="link" data-acao="desfazerPonto">desfazer ponto</button>' : ''}${st.des.length >= 3 ? '<button class="btn sol pequeno" data-acao="fecharArea">Fechar a área</button>' : ''}</div>` : ''}
          ${o && o.tipo === 'area' ? `<div class="t3-linha"><span class="mini">🚫 Área sem placa · ${n(U.areaPol(o.pts), 1)} m² · arraste com "Mover"</span><button class="link" data-acao="apagarO">apagar</button></div>` : o ? `<div class="grade g2 t3-form"><label class="campo"><span>Altura (m)<small>${T.base === 'chao' ? 'do chão' : 'acima de onde está apoiado'}</small></span><input type="number" step="0.1" data-o="h" value="${o.h ?? T.h}"></label>
            ${o.tipo === 'arvore' ? `<label class="campo"><span>Tronco até a copa (m)<small>onde começam as folhas</small></span><input type="number" step="0.1" data-o="hc" value="${o.hc ?? Math.max(1.5, Math.round((o.h ?? T.h) * 3) / 10)}"></label>` : ''}
            ${T.redondo ? `<label class="campo"><span>${o.tipo === 'arvore' ? 'Raio da copa' : o.tipo === 'antena' ? 'Raio da antena' : 'Raio'} (m)</span><input type="number" step="0.05" data-o="r" value="${o.r ?? T.r}"></label>` : `<label class="campo"><span>Largura (m)</span><input type="number" step="0.1" data-o="w" value="${o.w ?? T.w}"></label><label class="campo"><span>Profundidade (m)</span><input type="number" step="0.1" data-o="d" value="${o.d ?? T.d}"></label><label class="campo"><span>Girar (°)</span><input type="number" step="5" data-o="rot" value="${o.rot || 0}"></label>`}</div>
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
          <div class="t3-ferr" style="margin-top:4px"><button data-ferr="mao" aria-pressed="${st.ferr === 'mao'}">✋ Colocar à mão</button><button data-ferr="girar" aria-pressed="${st.ferr === 'girar'}">🔄 Girar placa</button>${st.ferr === 'mao' || st.ferr === 'girar' ? '<button data-ferr="" aria-pressed="false">✓ Pronto</button>' : ''}</div>
          ${st.ferr === 'mao' ? `<div class="t3-linha"><span class="mini">Placa nova:</span><div class="t3-chips">${[['retrato', '▯ Retrato (em pé)'], ['paisagem', '▭ Paisagem (deitada)']].map(([v, t]) => `<button class="t3-chip" data-acao="oriMao" data-v="${v}" aria-pressed="${st.oriMao === v}">${t}</button>`).join('')}</div></div>
            <p class="mini">Toque no telhado para pôr: a placa segue a inclinação e o caimento daquela água. Solta longe das outras, ela fica onde você tocou; perto (até 35 cm), encosta na vizinha (🧲 Imã). Toque numa placa para tirar; arraste para mover.</p>` : ''}
          ${st.ferr === 'girar' ? '<p class="mini">Toque numa placa para trocar entre retrato e paisagem.</p>' : ''}
          ${L.manuais.length ? `<div class="t3-linha"><label class="chk"><input type="checkbox" id="t3SoMao" ${L.soMao ? 'checked' : ''}> só as placas que eu colocar (não completar sozinho)</label><span class="mini">${L.manuais.length} à mão${L.manuais.length !== L.qtd ? ` · kit: ${L.qtd}` : ' ✓'}</span><button class="link" data-acao="limparMao">tirar as placas à mão</button></div>` : ''}
          ${rankingAguas()}
          ${cartaoMppt()}
          <div class="t3-linha"><span class="mini">Arranjo automático:</span><div class="t3-chips">${[['fileiras', 'Em fileiras (como se monta)'], ['sol', 'Placa a placa pelo sol']].map(([v, t]) => `<button class="t3-chip" data-acao="arranjo" data-v="${v}" aria-pressed="${(L.arranjo || 'fileiras') === v}">${t}</button>`).join('')}</div></div>
          <div class="t3-linha"><button class="btn sol pequeno" data-acao="calcular">☀️ Calcular o melhor sol</button>${(L.forcarOn || []).length + (L.forcarOff || []).length ? `<span class="mini">${(L.forcarOn || []).length + (L.forcarOff || []).length} ajuste(s) à mão</span><button class="link" data-acao="limparManual">desfazer ajustes à mão</button>` : '<span class="mini">Toque numa placa para tirar, ou num espaço vazio para pôr: o ajuste fica mesmo se você mexer no desenho.</span>'}</div>`;
      } else if (A === 'cabos') {
        const C2 = proj.cabos, str = temKit('string') || !kits.length, mic = temKit('micro');
        el.innerHTML = `<div class="t3-ferr">${str ? `<button data-ferr="posInv" aria-pressed="${st.ferr === 'posInv'}">📍 Onde fica o inversor${C2.inv ? ' ✓' : ''}</button>` : ''}${mic ? `<button data-ferr="posQuadro" aria-pressed="${st.ferr === 'posQuadro'}">📍 Onde fica o quadro${C2.quadro ? ' ✓' : ''}</button>` : ''}</div>
          ${st.ferr === 'posInv' || st.ferr === 'posQuadro' ? '<p class="mini">Agora toque no desenho, na parede onde ele vai ficar.</p>' : ''}
          <div class="grade g2 t3-form">${str ? `<label class="campo"><span>Altura do inversor (m)<small>do chão, na parede</small></span><input type="number" step="0.1" min="0" data-cb="inv" value="${C2.inv ? C2.inv.h : 1.5}"></label>
            <label class="campo"><span>Strings<small>0 = automático pela tensão</small></span><input type="number" step="1" min="0" data-cb="nStrings" value="${C2.nStrings || 0}"></label>` : ''}
            ${mic ? `<label class="campo"><span>Altura do quadro (m)</span><input type="number" step="0.1" min="0" data-cb="quadro" value="${C2.quadro ? C2.quadro.h : 1.5}"></label>` : ''}</div>
          ${str ? `<div class="t3-linha"><span class="mini">Ligação das strings:</span><div class="t3-chips">${[['frog', 'Frog (economiza cabo)'], ['seguro', 'Em sequência + 15% (seguro)']].map(([v, t]) => `<button class="t3-chip" data-acao="modoCabo" data-v="${v}" aria-pressed="${C2.modo === v}">${t}</button>`).join('')}</div></div>` : ''}
          <div id="t3Cabos">${relatorioCabos()}</div>`;
      } else {
        el.innerHTML = `<div class="t3-chips">${U.DIAS.map((D, i) => `<button class="t3-chip" data-acao="dia" data-i="${i}" aria-pressed="${st.di === i}">${D.nome}</button>`).join('')}</div>
          <div class="t3-linha"><button class="btn sol pequeno" data-acao="play">${st.play ? '❚❚ Pausar' : '▶ Ver o dia passar'}</button><input type="range" id="t3Hora" min="5.5" max="18.5" step="0.05" value="${st.hora}" style="flex:1"><b id="t3HoraO">${hhmm(st.hora)}</b></div>
          <div class="t3-linha"><label class="chk"><input type="radio" name="t3Cor" value="tsrf" ${st.corPlacas === 'tsrf' ? 'checked' : ''}> cor pelo sol do ano</label><label class="chk"><input type="radio" name="t3Cor" value="agora" ${st.corPlacas === 'agora' ? 'checked' : ''}> sombra neste horário</label><label class="chk"><input type="checkbox" id="t3Mapa" ${st.mapas ? 'checked' : ''}> mapa de sombra do telhado</label></div>
          <canvas id="t3Graf" height="120" style="width:100%;height:120px"></canvas>
          <p class="mini" id="t3GrafTxt">Curva do dia médio do mês: área clara = sem sombra, laranja = com a sombra medida.</p>`;
        grafico();
      }
    }
    const CORES_MPPT = ['#ffd23d', '#3db4ff', '#ff5c8a', '#3ddc97', '#b48cff', '#ff8a3d', '#5cf0ff', '#c0ff5c'];
    function planoMppt() { const f = proj.mppt.ficha; return f && raiz.Mppt && st.escolhidas.length ? raiz.Mppt.planejar(st.escolhidas, f, proj.mppt.mod) : null; }
    function cartaoMppt() {
      const f = proj.mppt.ficha, k = kitDe(proj.mppt.kit); if (!f || !k) return '<p class="mini">Cote o kit (passo 4 do orçamento) para conferir as MPPTs do inversor aqui.</p>';
      const pl = planoMppt(), M = proj.mppt.mod, num = (cp, rot, v, st2 = 'any') => `<label class="campo"><span>${rot}</span><input type="number" step="${st2}" min="0" data-mp="${cp}" value="${v ?? ''}"></label>`;
      const dois = kitDe('string') && kitDe('micro');
      return `<div class="t3-mppt"><div class="entre"><b>${f.tipo === 'micro' ? 'Microinversor' : 'Inversor'} e MPPTs</b>${dois ? `<div class="t3-chips">${[['string', 'Inversor'], ['micro', 'Micro']].map(([v, t]) => `<button class="t3-chip" data-acao="mpptKit" data-v="${v}" aria-pressed="${proj.mppt.kit === v}">${t}</button>`).join('')}</div>` : ''}</div>
        <p class="mini" style="margin:4px 0">${esc(k.inversor.nome)}${(f.qtd || 1) > 1 ? ` × ${f.qtd}` : ''} · ${f.conferida ? `<b style="color:var(--verde,#3ddc97)">${esc(f.fonte)}</b>` : `<b style="color:var(--laranja)">${esc(f.fonte)}: confira no datasheet e corrija</b>`}${f.tipo === 'string' ? ` · <b>${raiz.Mppt.totalEntradas(f)} MPPT${raiz.Mppt.totalEntradas(f) > 1 ? 's' : ''}</b>: as placas podem ficar em até ${raiz.Mppt.totalEntradas(f)} água${raiz.Mppt.totalEntradas(f) > 1 ? 's' : ''}` : ` · ${f.entradas} entradas independentes por micro: pode misturar águas`}</p>
        <div class="t3-linha">${raiz.Fichas ? `<label class="btn vidro pequeno" style="cursor:pointer">📄 Ficha da placa (PDF)<input type="file" accept="application/pdf,.pdf" data-ficha="placa" hidden></label><label class="btn vidro pequeno" style="cursor:pointer">📄 Ficha do ${f.tipo === 'micro' ? 'micro' : 'inversor'} (PDF)<input type="file" accept="application/pdf,.pdf" data-ficha="inversor" hidden></label>` : ''}<span class="mini">${M.cadastro ? 'placa: ficha cadastrada ✓' : M.estimada ? 'placa: valores estimados' : 'placa: conferida'}</span></div>
        <details ${f.conferida ? '' : 'open'}><summary class="mini" style="cursor:pointer">Ficha do datasheet${f.editada ? ' (corrigida por você)' : ''}</summary>
          <div class="grade g2 t3-form" style="margin-top:6px">${f.tipo === 'micro' ? num('entradas', 'Entradas por micro', f.entradas, 1) : num('mppts', 'MPPTs por inversor', f.mppts, 1) + num('strPorMppt', 'Strings por MPPT', f.strPorMppt, 1)}
            ${num('vMax', 'Tensão máx. de entrada (V)', f.vMax)}${num('vMinMppt', 'MPPT mínimo (V)', f.vMinMppt)}${num('iMax', 'Corrente máx. por entrada (A)', f.iMax)}${num('iscMax', 'Curto máx. por entrada (A)', f.iscMax)}
            ${num('m.voc', `Placa: Voc (V)${M.estimada ? ' · estimada' : ''}`, M.voc)}${num('m.vmp', 'Placa: Vmp (V)', M.vmp)}${num('m.isc', 'Placa: Isc (A)', M.isc)}</div>
          ${f.editada ? '<button class="link" data-acao="mpptPadrao">voltar à ficha padrão</button>' : ''}</details>
        ${pl ? (pl.tipo === 'micro' ? `<p class="mini" style="margin:6px 0 0">${st.escolhidas.length} placas em ${pl.grupos.length} água(s) · ${pl.usadas} de ${pl.entradas} entradas.</p>`
          : `<table style="margin-top:6px"><tr><th>MPPT</th><th>Placas</th><th class="v">Strings</th><th class="v">Frio / calor</th></tr>${pl.mppts.map((m) => `<tr><td><i class="t3-bola" style="background:${CORES_MPPT[(m.n - 1) % 8]}"></i> ${m.n}</td><td>${m.placas} · ${m.agua.split('|')[0]}° ${ponto(+m.agua.split('|')[1])}</td><td class="v">${m.strings} × ${m.porString}</td><td class="v">${m.vFrio} V / ${m.vCalor} V ${m.ok ? '✓' : '⚠'}</td></tr>`).join('')}</table>
            <p class="mini">Por string: de ${pl.nMin} a ${pl.nMax} placas.${pl.livres ? ` ${pl.livres} MPPT livre(s).` : ''}</p>`) : ''}
        ${pl ? [...pl.avisos, ...(pl.mppts || []).flatMap((m) => m.avisos.map((x) => `MPPT ${m.n}: ${x}`))].map((x) => `<div class="aviso ruim" style="margin-top:6px">${esc(x)}</div>`).join('') || (st.escolhidas.length ? '<div class="aviso ok" style="margin-top:6px">✓ Ligação dentro dos limites do inversor.</div>' : '') : ''}</div>`;
    }
    /* ficha técnica em PDF: lê, mostra para conferir e cadastra o modelo (a próxima vez já vem certo) */
    async function lerFicha(tipo, arq) {
      if (!arq) return; if (!raiz.LeitorConta || !raiz.LeitorConta.textoPdf) return msg('Leitor de PDF indisponível.', true);
      msg('Lendo a ficha técnica…');
      try {
        const txt = await raiz.LeitorConta.textoPdf(arq); if (txt.replace(/\s/g, '').length < 200) return msg('Este PDF não tem texto (é imagem): digite os números da ficha ao lado.', true);
        if (tipo === 'placa') {
          const r = raiz.Fichas.placa(txt, proj.layout.modulo.potW); if (!r.voc && !r.isc) return msg('Não achei Voc e Isc nesta ficha: confira se é a ficha da placa e digite ao lado.', true);
          Object.assign(proj.mppt.mod, Object.fromEntries(Object.entries({ voc: r.voc, vmp: r.vmp, isc: r.isc, imp: r.imp }).filter(([, v]) => v != null)), { estimada: false, cadastro: true });
          if (r.c && r.l) Object.assign(proj.layout.modulo, { c: r.c, l: r.l, estimada: false });
          raiz.Fichas.guardar('modulos', proj.layout.modulo.nome, r);
          sujar(); painel(); msg(`Ficha da placa lida (${r.potW} W): Voc ${r.voc ?? '?'} V · Vmp ${r.vmp ?? '?'} V · Isc ${r.isc ?? '?'} A${r.c ? ` · ${Math.round(r.c * 1000)} × ${Math.round(r.l * 1000)} mm` : ''}. <b>Confira</b> e corrija ao lado se precisar. Cadastrada para os próximos orçamentos.`);
        } else {
          const k = kitDe(proj.mppt.kit), kw = k ? (k.inversor.potenciaUnKw || k.inversor.potenciaKw / (k.inversor.qtd || 1)) : 5, r = raiz.Fichas.inversor(txt, kw);
          if (r.lidos < 2) return msg('Não consegui ler os limites desta ficha: digite ao lado (MPPTs, tensão e corrente).', true);
          const lim = Object.fromEntries(Object.entries(r).filter(([c, v]) => v != null && !['lidos', 'coluna'].includes(c)));
          proj.mppt.ficha = { ...proj.mppt.ficha, ...lim, conferida: true, editada: false, fonte: 'ficha em PDF (lida)' }; limiteAguas();
          if (k) raiz.Fichas.guardar('inversores', k.inversor.nome, lim);
          recompor(); painel(); msg(`Ficha do ${r.tipo === 'micro' ? 'micro' : 'inversor'} lida${r.coluna ? ` (coluna ${esc(r.coluna)})` : ''}: ${r.tipo === 'micro' ? `${r.entradas ?? '?'} entradas` : `${r.mppts ?? '?'} MPPT · ${r.strPorMppt ?? '?'} string(s) por MPPT`} · até ${r.vMax ?? '?'} V · MPPT ${r.vMinMppt ?? '?'}–${r.vMaxMppt ?? '?'} V · ${r.iMax ?? '?'} A. <b>Confira</b> ao lado. Cadastrada para os próximos orçamentos.`);
        }
      } catch (e) { msg('Não consegui ler o PDF: ' + esc(e.message), true); }
    }
    /* qual telhado é melhor: sol do ano pela direção e inclinação (e a sombra, depois do cálculo) */
    function rankingAguas() {
      const ls = U.notaFaces(proj, st.vagas).filter((f) => f.incl <= 45); if (!ls.length) return '';
      const L = proj.layout, melhor = ls[0].nota, cor = (t) => U.corTsrf(t);
      return `<div class="t3-rank"><span class="mini"><b>Melhores telhados</b> (${ls.some((f) => f.comSombra) ? 'sol do ano com a sombra medida' : 'pela direção e inclinação; a sombra entra depois do cálculo'}):</span>
        ${ls.map((f, i) => { const ori = (L.oriFace[f.id] || (bloco(f.pai) || {}).orientacao || 'retrato');
          return `<div class="t3-rank-l"><i style="background:${cor(f.nota)}"></i><span class="t3-rank-n">${i === 0 ? '★ ' : ''}${esc(f.nome)}<small>${ponto(f.az)} · ${pct(f.incl)}% · ${n(f.nota * 100)}%${!f.usar ? ' · marcado sem placas' : ''}${f.cabem ? ` · cabem ${f.cabem}` : f.manuais ? '' : ' · não coube na grade: use "Colocar à mão"'}${f.manuais ? ` · ${f.manuais} à mão` : ''}</small></span>
            <button class="t3-chip" data-acao="oriFace" data-id="${esc(f.id)}" title="placas desta água em retrato ou paisagem">${ori === 'paisagem' ? '▭ paisagem' : '▯ retrato'}</button>
            <button class="t3-chip" data-acao="preferir" data-id="${esc(f.id)}" aria-pressed="${L.preferir === f.id}">${L.preferir === f.id ? '✓ começa aqui' : 'começar aqui'}</button></div>`; }).join('')}
        ${melhor < 0.8 ? '<p class="mini" style="color:var(--laranja)">Nenhuma água pega mais de 80% do sol ideal: confira o caimento (passo 2).</p>' : ''}</div>`;
    }
    function lado() {
      const el = $('#t3Lado', ov); if (!el) return;
      const r = st.analisado ? U.gerar(proj, st.escolhidas, { pvgis: proj.pvgis, hsp, pr }) : null, L = proj.layout;
      const cabem = st.vagas.length;
      el.innerHTML = `<div class="kpis" style="margin:8px 0">
        <div class="kpi"><span class="rotulo">Placas</span><b>${st.escolhidas.length}${st.escolhidas.length < L.qtd ? ' / ' + L.qtd : ''}</b><span class="sutil">${st.escolhidas.length < L.qtd ? `<span style="color:var(--laranja)">${L.soMao ? 'kit: ' + L.qtd : 'faltou lugar para ' + (L.qtd - st.escolhidas.length)}</span>` : `cabem até ${cabem}`}</span></div>
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
        if (k === 'usar') b.usar = t.checked; else if (k === 'nome') b.nome = t.value; else if (k === 'telha' || k === 'orientacao' || k === 'cumeeira') b[k] = t.value;
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
        sujar(); return; // os ajustes à mão são guardados pela posição: continuam valendo
      }
      if (t.id === 't3Rot' && proj.drone) { girarFoto(+t.value - (proj.drone.rot || 0)); const r = $('#t3RotO', ov); if (r) r.textContent = n(proj.drone.rot, 1) + '°'; return; }
      if (t.dataset.cb) { const C2 = proj.cabos, k = t.dataset.cb, v = Math.max(0, Number(t.value) || 0); if (k === 'nStrings') C2.nStrings = Math.round(v); else if (C2[k]) C2[k].h = v; else C2[k] = null; const el = $('#t3Cabos', ov); if (el) el.innerHTML = relatorioCabos(); desenhar(); return; }
      if (t.id === 't3Alfa') { st.alfaDrone = +t.value; desenhar(); return; }
      if (t.id === 't3Hora') { st.hora = +t.value; $('#t3HoraO', ov).textContent = hhmm(st.hora); if (viewer) viewer.sol(st.di, st.hora); grafico(); return; }
      if (t.name === 't3Cor') { st.corPlacas = t.value; if (viewer) viewer.cor(t.value); return; }
      if (t.id === 't3Mapa') { st.mapas = t.checked; mapasSombra(); }
      if (t.dataset.mp && mudou) { const k = t.dataset.mp, v = Number(String(t.value).replace(',', '.')) || 0; if (k.startsWith('m.')) { proj.mppt.mod[k.slice(2)] = v; proj.mppt.mod.estimada = false; } else { proj.mppt.ficha[k] = v; proj.mppt.ficha.editada = true; } limiteAguas(); recompor(); painel(); return; }
      if (t.dataset.mp) return;
      if (t.id === 't3SoMao') { proj.layout.soMao = t.checked; recompor(); painel(); }
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
      if (a === 'fecharArea') { fecharArea(); return; }
      if (a === 'fecharPol') { if (st.des.length >= 3) fecharDesenho(st.des); return; }
      if (a === 'forma') { const b = bloco(st.sel.id); b.forma = el.dataset.v; if (b.forma !== '1') { b.pts = U.retanguloDe(b.pts).cantos; b.platibanda = 0; if (b.incl < 10) b.incl = grausDe(35); } sujar(); painel(); desenhar(); return; }
      if (a === 'inverter') { const b = bloco(st.sel.id); b.az = (b.az + 180) % 360; sujar(); painel(); desenhar(); return; }
      if (a === 'dup') { const b = bloco(st.sel.id), c = JSON.parse(JSON.stringify(b)); c.id = U.novoId('b'); c.nome = b.nome + ' (cópia)'; c.pts = c.pts.map((p) => [p[0] + 1, p[1] + 1]); proj.blocos.push(c); st.sel = { t: 'b', id: c.id }; sujar(); painel(); desenhar(); return; }
      if (a === 'apagarB') { proj.blocos = proj.blocos.filter((b) => b.id !== st.sel.id); st.sel = null; sujar(); painel(); desenhar(); return; }
      if (a === 'apagarO') { proj.obst = proj.obst.filter((o) => o.id !== st.sel.id); st.sel = null; sujar(); painel(); desenhar(); return; }
      if (a === 'calcular') { st.analisado = false; return analisar(); }
      if (a === 'mpptKit') { proj.mppt.kit = el.dataset.v; proj.mppt.ficha = fichaPadrao(); proj.mppt.chave = chaveKit(); limiteAguas(); recompor(); painel(); return; }
      if (a === 'mpptPadrao') { proj.mppt.ficha = fichaPadrao(); limiteAguas(); recompor(); painel(); return; }
      if (a === 'ima') { proj.layout.ima = proj.layout.ima === false; painel(); msg(proj.layout.ima === false ? 'Imã desligado: a placa fica exatamente onde você tocar.' : 'Imã ligado: solte a placa perto da vizinha e ela encosta com o espaço do grampo.'); return; }
      if (a === 'oriMao') { st.oriMao = el.dataset.v; st.ferr = 'mao'; painel(); return; }
      if (a === 'limparMao') { proj.layout.manuais = []; proj.layout.soMao = undefined; sujar(); painel(); return; }
      if (a === 'oriFace') { const L = proj.layout, id = el.dataset.id, f = U.faces(proj).find((x) => x.id === id), atual = L.oriFace[id] || (f && f.orientacao) || 'retrato'; L.oriFace[id] = atual === 'paisagem' ? 'retrato' : 'paisagem'; sujar(); painel(); return; }
      if (a === 'preferir') { const L = proj.layout; L.preferir = L.preferir === el.dataset.id ? null : el.dataset.id; if (L.soMao) L.soMao = false; recompor(); painel(); return; }
      if (a === 'limparManual') { proj.layout.forcarOn = []; proj.layout.forcarOff = []; recompor(); painel(); return; }
      if (a === 'modoCabo') { proj.cabos.modo = el.dataset.v; painel(); desenhar(); return; }
      if (a === 'arranjo') { proj.layout.arranjo = el.dataset.v; recompor(); painel(); return; }
      if (a === 'dia') { st.di = +el.dataset.i; if (viewer) viewer.sol(st.di, st.hora); painel(); return; }
      if (a === 'play') { if (st.play) parar(); else tocarDia(); painel(); }
    }
    /* ---------- cabos ---------- */
    const tipoKit = (k) => (k && k.inversor && k.inversor.tipo === 'micro' ? 'micro' : 'string');
    const temKit = (t) => kits.some((k) => tipoKit(k) === t);
    function calcCabos() {
      const C2 = proj.cabos, out = [], ls = kits.length ? kits : [null];
      ls.forEach((k) => {
        if (tipoKit(k) === 'micro') { const r = Cabos.micros(st.escolhidas, { kit: k, pos: C2.quadro }); out.push({ k, tipo: 'micro', r, conf: k ? Cabos.conferir(k, r) : null }); }
        else { const r = Cabos.strings(st.escolhidas, { inversor: k && k.inversor, modulo: proj.layout.modulo, pos: C2.inv, nStrings: C2.nStrings, modo: C2.modo }); out.push({ k, tipo: 'string', r, conf: k && r.escolhido ? Cabos.conferir(k, r) : null }); }
      });
      return out;
    }
    function relatorioCabos() {
      if (!st.escolhidas.length) return '<p class="mini">Primeiro escolha as placas (passo 4).</p>';
      return calcCabos().map(({ k, tipo, r, conf }) => {
        const nome = k ? `${esc(k.nivel)}: ${esc(k.inversor.nome || '')}` : 'Inversor (cote o kit para comparar com o cabo que vem nele)';
        if (tipo === 'micro') return `<div class="painel" style="margin-top:8px"><b>${nome}</b><p class="mini" style="margin:4px 0">${r.micros} micro(s) com ${r.porMicro} placa(s) cada · cabo tronco ≈ <b>${n(r.troncoM, 1)} m</b> (${r.conexoes} conexões)${r.caM != null ? ` · cabo CA até o quadro ≈ <b>${n(r.caM, 1)} m</b> por condutor` : ''}</p>
          ${r.erro ? `<p class="mini" style="color:var(--laranja)">${esc(r.erro)}</p>` : ''}${conf && !conf.semDados ? `<p class="mini">No kit: ${conf.kit.troncoUn ? conf.kit.troncoUn + ' cabo(s) tronco' : 'sem cabo tronco listado'}${conf.kit.ca ? ` · ${n(conf.kit.ca)} m de cabo CA` : ''}. ${conf.faltaTronco ? `<b style="color:var(--laranja)">Faltam ${conf.faltaTronco} cabo(s) tronco.</b>` : ''}${conf.faltaCa ? ` <b style="color:var(--laranja)">Faltam ${n(conf.faltaCa, 1)} m de cabo CA.</b>` : ''}</p>` : conf && conf.semDados ? '<p class="mini">O kit não listou os itens elétricos: confira no PDF da Belenergy.</p>' : ''}</div>`;
        if (r.erro) return `<div class="painel" style="margin-top:8px"><b>${nome}</b><p class="mini" style="margin:4px 0">${r.porString.length} string(s): ${r.porString.join(' + ')} placas (até ${r.maxPorString} por string)</p><p class="mini" style="color:var(--laranja)">${esc(r.erro)}</p></div>`;
        const linha = (x, i) => `<tr><td>String ${i + 1} · ${x.placas} placas</td><td class="v">${n(r.frog.lista[i].mais, 1)} + ${n(r.frog.lista[i].menos, 1)} m</td><td class="v">${n(r.seguro.lista[i].mais, 1)} + ${n(r.seguro.lista[i].menos, 1)} m</td></tr>`;
        const falta = conf && !conf.semDados ? (conf.faltaVermelho || conf.faltaPreto ? `<b style="color:var(--laranja)">Faltam ${n(conf.faltaVermelho, 1)} m de vermelho e ${n(conf.faltaPreto, 1)} m de preto</b> no cálculo ${proj.cabos.modo === 'frog' ? 'frog' : 'seguro'}.` : `<b style="color:var(--verde,#3ddc97)">O cabo do kit basta</b> no cálculo ${proj.cabos.modo === 'frog' ? 'frog' : 'seguro'} (sobram ${n(conf.sobraVermelho, 1)} m vermelho e ${n(conf.sobraPreto, 1)} m preto).`) : '';
        return `<div class="painel" style="margin-top:8px"><b>${nome}</b>
          <p class="mini" style="margin:4px 0">${r.porString.length} string(s): ${r.porString.join(' + ')} placas (até ${r.maxPorString} por string) · cabo da placa ${n(r.lead, 1)} m por polo</p>
          <table><tr><th></th><th class="v">Frog</th><th class="v">Seguro</th></tr>${r.frog.lista.map(linha).join('')}
            <tr class="total"><td>Total vermelho + preto</td><td class="v">${n(r.frog.vermelho, 1)} + ${n(r.frog.preto, 1)} m</td><td class="v">${n(r.seguro.vermelho, 1)} + ${n(r.seguro.preto, 1)} m</td></tr></table>
          ${conf && !conf.semDados ? `<p class="mini" style="margin-top:6px">No kit: ${n(conf.kit.vermelho + conf.kit.semCor / 2, 1)} m vermelho + ${n(conf.kit.preto + conf.kit.semCor / 2, 1)} m preto. ${falta}</p>` : conf && conf.semDados ? '<p class="mini">O kit não listou os itens elétricos: confira no PDF da Belenergy.</p>' : ''}
          ${r.frog.lista.reduce((t, x) => t + x.extensoes, 0) > 1 ? `<p class="mini">No frog, ${n(r.frog.lista.reduce((t, x) => t + x.extensoes, 0), 1)} m de extensão entre placas (placa deitada ou fileiras separadas): já está somado.</p>` : ''}</div>`;
      }).join('') + '<p class="mini" style="margin-top:6px">Caminho em L pela estrutura e pelas paredes, descendo até o equipamento. Frog: sem margem, as duas pontas da string saem juntas. Seguro: ligação em sequência, 15% de margem e 2 m a mais em cada ponta.</p>';
    }
    function desenharCabos() {
      const C2 = proj.cabos, CS = ['#ff3d6e', '#3db4ff', '#ffd23d', '#3ddc97', '#b48cff', '#ff8a3d'];
      calcCabos().forEach(({ tipo, r }) => {
        if (tipo === 'string' && r.grupos) r.grupos.forEach((gr, i) => {
          const cor = CS[i % CS.length]; g.strokeStyle = cor; g.lineWidth = 3; g.beginPath(); gr.forEach((sl, k) => { const q = m2tela(sl.c); k ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }); g.stroke();
          if (C2.inv) { const fim = C2.modo === 'frog' ? (gr[1] || gr[0]) : gr[gr.length - 1], alvo = m2tela([C2.inv.x, C2.inv.z]); g.setLineDash([6, 4]); g.lineWidth = 2; [gr[0], fim].forEach((sl) => { const q = m2tela(sl.c); g.beginPath(); g.moveTo(q[0], q[1]); g.lineTo(alvo[0], q[1]); g.lineTo(alvo[0], alvo[1]); g.stroke(); }); g.setLineDash([]); }
          const q0 = m2tela(gr[0].c); rotulo('S' + (i + 1), q0[0], q0[1] - 10, cor);
        });
        if (tipo === 'micro' && r.pontos) { g.strokeStyle = '#ffd23d'; g.lineWidth = 3; g.beginPath(); r.pontos.forEach((pt, k) => { const q = m2tela(pt.c); k ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }); g.stroke(); r.pontos.forEach((pt) => { const q = m2tela(pt.c); g.fillStyle = '#ffd23d'; g.fillRect(q[0] - 5, q[1] - 5, 10, 10); }); }
      });
      [['inv', 'INV', '#ff8a3d'], ['quadro', 'QD', '#5cf0ff']].forEach(([k, t, cor]) => { const P2 = C2[k]; if (!P2) return; const q = m2tela([P2.x, P2.z]); g.fillStyle = cor; g.fillRect(q[0] - 14, q[1] - 10, 28, 20); g.fillStyle = '#10141f'; g.font = 'bold 11px system-ui'; g.textAlign = 'center'; g.fillText(t, q[0], q[1] + 4); });
    }
    /* encaixa a foto do drone no satélite por 2 pontos: escala, norte e posição de uma vez */
    function encaixar2() {
      const d = proj.drone, [p1, q1, p2, q2] = st.enc; st.enc = []; st.ferr = null;
      const toPix = (p) => { const c = Math.cos(-(d.rot || 0) * Math.PI / 180), s2 = Math.sin(-(d.rot || 0) * Math.PI / 180), dx = p[0] - (d.cx || 0), dz = p[1] - (d.cz || 0); return [(dx * c - dz * s2) / d.escala + d.w / 2, (dx * s2 + dz * c) / d.escala + d.h / 2]; };
      const a1 = toPix(p1), a2 = toPix(p2), va = [a2[0] - a1[0], a2[1] - a1[1]], vb = [q2[0] - q1[0], q2[1] - q1[1]], la = Math.hypot(va[0], va[1]), lb = Math.hypot(vb[0], vb[1]);
      if (la < 30 || lb < 3) { msg('Os dois cantos ficaram perto demais: escolha cantos mais longe um do outro (de preferência em lados opostos da casa).', true); return; }
      const rot = (Math.atan2(vb[1], vb[0]) - Math.atan2(va[1], va[0])) * 180 / Math.PI, rr = rot * Math.PI / 180, c = Math.cos(rr), s2 = Math.sin(rr), esc2 = lb / la;
      const ux = (a1[0] - d.w / 2) * esc2, uy = (a1[1] - d.h / 2) * esc2;
      Object.assign(d, { escala: esc2, rot: Math.round(((((rot % 360) + 540) % 360) - 180) * 10) / 10, cx: q1[0] - (ux * c - uy * s2), cz: q1[1] - (ux * s2 + uy * c), escalaConferida: true, rotConferida: true, encaixada: true });
      st.alfaDrone = 0.6; sujar(true); desenhar(); painel();
      msg(`Foto encaixada no satélite: ${n(d.escala * 100, 2)} cm por ponto, norte corrigido (${n(d.rot, 1)}°). Com a transparência, confira se as bordas da casa batem; se não, refaça com cantos mais afastados.`);
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
      const lista = []; const usar = U.faces(proj).filter((b) => b.usar && b.incl <= 45);
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
        proj.pistas = U.pistasGoogle(proj, r);
        if (!proj.blocos.length) proj.blocos = U.blocosDoGoogle(proj, r);
        sujar(true); centralizar(); painel();
        const dt = r.data ? `${String(r.data.month).padStart(2, '0')}/${r.data.year}` : '';
        msg(`${proj.blocos.length ? `O Google achou ${proj.pistas.length} água(s) (foto de ${dt}, precisão básica) e eu montei ${proj.blocos.length > 1 ? proj.blocos.length + ' contornos' : 'o contorno'} com ${proj.blocos.map((b) => (b.forma || '1') + (b.forma === '1' ? ' água' : ' águas')).join(', ')}. <b>Confira os cantos no passo 2</b>: as setas azuis são as águas que o Google viu.` : 'O Google não tem o desenho deste telhado: desenhe no passo 2.'} ${r.precisao && r.precisao !== 'ROOFTOP' ? '<b>O endereço foi achado por aproximação: confira se é esta casa.</b> ' : ''}Se tiver a foto do drone, envie para ganhar detalhe.`);
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
      try { fim.resultado_cabos = calcCabos().map(({ k, tipo, r, conf }) => ({ nivel: k ? k.nivel : null, tipo, porString: r.porString, modo: proj.cabos.modo, frog: r.frog ? { vermelho: r.frog.vermelho, preto: r.frog.preto } : null, seguro: r.seguro ? { vermelho: r.seguro.vermelho, preto: r.seguro.preto } : null, troncoM: r.troncoM, conexoes: r.conexoes, caM: r.caM, erro: r.erro || null, conf: conf ? { faltaVermelho: conf.faltaVermelho, faltaPreto: conf.faltaPreto, faltaTronco: conf.faltaTronco, faltaCa: conf.faltaCa, semDados: !!conf.semDados, kitVermelho: conf.kit ? conf.kit.vermelho + conf.kit.semCor / 2 : null, kitPreto: conf.kit ? conf.kit.preto + conf.kit.semCor / 2 : null } : null })); } catch { /* cabos são extra */ }
      fim.resultado = { ...res, escolhidas: st.escolhidas.map((s) => s.k), placasPos: st.escolhidas.map((s) => ({ k: s.k, tsrf: s.analise ? Math.round(s.analise.tsrf * 1000) / 1000 : null })) };
      if (fim.resultado_cabos) { fim.resultado.cabos = fim.resultado_cabos; delete fim.resultado_cabos; }
      try { const pm = planoMppt(); if (pm) fim.resultado.mppt = { tipo: pm.tipo, ok: pm.ok, avisos: [...pm.avisos, ...(pm.mppts || []).flatMap((m) => m.avisos.map((x) => `MPPT ${m.n}: ${x}`))], mppts: (pm.mppts || []).map((m) => ({ n: m.n, agua: m.agua, placas: m.placas, strings: m.strings, porString: m.porString, vFrio: m.vFrio })), fonte: proj.mppt.ficha.fonte, conferida: !!proj.mppt.ficha.conferida && !proj.mppt.ficha.editada }; } catch { /* extra */ }
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
