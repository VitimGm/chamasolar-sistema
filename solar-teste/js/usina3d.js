/* =====================================================================
   USINA 3D — monta a casa e as placas em 3D a partir das águas do telhado
   (desenhadas na foto de satélite/drone ou vindas do Google Solar API),
   calcula a sombra placa a placa no ano e a geração. Usado no editor do
   orçamento e na Proposta Viva (só visualização).
   Coordenadas no chão em metros: x = leste, z = sul (para baixo na foto).
   ===================================================================== */
(function (raiz) {
  'use strict';
  const PL = 2.38, PW = 1.134; // placa 615 W (retrato: comprimento sobe a água)
  const MESES_DIAS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const DIA_MES = [17, 47, 75, 105, 135, 162, 198, 228, 258, 288, 318, 344];
  const rad = (g) => g * Math.PI / 180;

  /* ---------- carregar o three.js só quando precisa ---------- */
  let carregando = null;
  function carregarThree() {
    if (raiz.THREE && raiz.THREE.OrbitControls) return Promise.resolve();
    if (carregando) return carregando;
    const s = (src) => new Promise((ok, erro) => { const e = document.createElement('script'); e.src = src; e.onload = ok; e.onerror = () => erro(new Error('não carregou o 3D')); document.head.appendChild(e); });
    carregando = (raiz.THREE ? Promise.resolve() : s('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'))
      .then(() => s('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js'));
    return carregando;
  }

  /* ---------- geo: Web Mercator ---------- */
  const resolucao = (lat, z) => 156543.03392 * Math.cos(rad(lat)) / Math.pow(2, z); // m por pixel lógico
  const px = (lat, lng, z) => { const n = 256 * Math.pow(2, z), s = Math.sin(rad(lat)); return { x: (lng + 180) / 360 * n, y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n }; };
  /* lat/lng → metros no chão em relação ao centro do projeto */
  const paraMetros = (proj, lat, lng) => { const a = px(proj.lat, proj.lng, 20), b = px(lat, lng, 20), r = resolucao(proj.lat, 20); return [(b.x - a.x) * r, (b.y - a.y) * r]; };

  /* monta a foto de satélite (tiles do Google pelo nosso servidor) centrada no imóvel */
  async function fotoSatelite(proj, buscarTile, ladoM = 100) {
    const z = ladoM > 140 ? 19 : 20, r = resolucao(proj.lat, z), meioPx = ladoM / r / 2, c = px(proj.lat, proj.lng, z);
    const x0 = Math.floor((c.x - meioPx) / 256), x1 = Math.floor((c.x + meioPx) / 256), y0 = Math.floor((c.y - meioPx) / 256), y1 = Math.floor((c.y + meioPx) / 256);
    const lado = 1536, esc = lado / (2 * meioPx);
    const cv = document.createElement('canvas'); cv.width = cv.height = lado; const g = cv.getContext('2d'); g.fillStyle = '#3a4a3a'; g.fillRect(0, 0, lado, lado);
    const tarefas = [];
    for (let tx = x0; tx <= x1; tx++) for (let ty = y0; ty <= y1; ty++) tarefas.push(buscarTile(z, tx, ty).then((blob) => createImageBitmap(blob)).then((img) => {
      g.drawImage(img, (tx * 256 - (c.x - meioPx)) * esc, (ty * 256 - (c.y - meioPx)) * esc, 256 * esc, 256 * esc);
    }).catch(() => null));
    await Promise.all(tarefas);
    const saida = document.createElement('canvas'); saida.width = saida.height = 1024; saida.getContext('2d').drawImage(cv, 0, 0, 1024, 1024);
    return { img: saida.toDataURL('image/jpeg', 0.82), ladoM };
  }

  /* águas do Google → polígonos no chão (pela posição das placas que o Google encaixou; senão pela caixa da água) */
  function aguasDoGoogle(proj, g) {
    const pg = g.placaGoogle || {}, alt = pg.alturaM || 1.879, larg = pg.larguraM || 1.045;
    return (g.aguas || []).map((s) => {
      const az = rad(s.az), d = [Math.sin(az), -Math.cos(az)], a = [Math.cos(az), Math.sin(az)];
      const pls = (g.placas || []).filter((p) => p.s === s.i).map((p) => ({ m: paraMetros(proj, p.c.latitude, p.c.longitude), o: p.o }));
      let pts;
      if (pls.length >= 2) {
        let uMin = 1e9, uMax = -1e9, vMin = 1e9, vMax = -1e9;
        pls.forEach(({ m, o }) => { const u = m[0] * a[0] + m[1] * a[1], v = m[0] * d[0] + m[1] * d[1], hu = (o === 'LANDSCAPE' ? alt : larg) / 2 + 0.3, hv = (o === 'LANDSCAPE' ? larg : alt) / 2 * Math.cos(rad(s.incl)) + 0.3; uMin = Math.min(uMin, u - hu); uMax = Math.max(uMax, u + hu); vMin = Math.min(vMin, v - hv); vMax = Math.max(vMax, v + hv); });
        pts = [[uMin, vMin], [uMax, vMin], [uMax, vMax], [uMin, vMax]].map(([u, v]) => [u * a[0] + v * d[0], u * a[1] + v * d[1]]);
      } else if (s.caixa) {
        const sw = paraMetros(proj, s.caixa.sw.latitude, s.caixa.sw.longitude), ne = paraMetros(proj, s.caixa.ne.latitude, s.caixa.ne.longitude);
        pts = [[sw[0], ne[1]], [ne[0], ne[1]], [ne[0], sw[1]], [sw[0], sw[1]]];
      } else return null;
      return { pts: pts.map((p) => [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100]), incl: Math.round(s.incl), az: Math.round(s.az), usar: s.incl < 40, fonte: 'google' }; // (a altura do Google é acima do nível do mar: não serve para o pé-direito)
    }).filter(Boolean);
  }

  /* ---------- geometria das águas ---------- */
  const desce = (az) => [Math.sin(rad(az)), -Math.cos(rad(az))]; // direção para onde a água cai (no chão)
  function planoDe(agua, hw) {
    const d = desce(agua.az), t = Math.tan(rad(agua.incl));
    const subida = (p) => -(p[0] * d[0] + p[1] * d[1]); // cresce para cima da água
    const sMin = Math.min(...agua.pts.map(subida));
    let base = hw;
    if (agua.altura) { const c = centroide(agua.pts); base = Math.max(agua.altura - (subida(c) - sMin) * t, 2.4); }
    return (p) => base + (subida(p) - sMin) * t;
  }
  const centroide = (pts) => pts.reduce((s, p) => [s[0] + p[0] / pts.length, s[1] + p[1] / pts.length], [0, 0]);
  function dentro(p, pol) { let d = false; for (let i = 0, j = pol.length - 1; i < pol.length; j = i++) { const a = pol[i], b = pol[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) d = !d; } return d; }
  function distBorda(p, pol) { let m = 1e9; for (let i = 0; i < pol.length; i++) { const a = pol[i], b = pol[(i + 1) % pol.length], dx = b[0] - a[0], dz = b[1] - a[1], L = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / L)); m = Math.min(m, Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz)); } return m; }
  const areaPol = (pts) => Math.abs(pts.reduce((s, p, i) => { const q = pts[(i + 1) % pts.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2);

  /* vagas de placa em uma água (retrato, fileiras na horizontal da água, 30 cm de borda) */
  function vagas(agua) {
    if (agua.incl > 45 || agua.pts.length < 3) return [];
    const d = desce(agua.az), a = [-d[1], d[0]], cosI = Math.cos(rad(agua.incl));
    const us = agua.pts.map((p) => p[0] * a[0] + p[1] * a[1]), vs = agua.pts.map((p) => p[0] * d[0] + p[1] * d[1]);
    const stepU = PW + 0.02, stepV = (PL + 0.03) * cosI, out = [];
    for (let v = Math.min(...vs) + 0.3 + PL * cosI / 2; v <= Math.max(...vs) - 0.3 - PL * cosI / 2 + 1e-6; v += stepV) {
      for (let u = Math.min(...us) + 0.3 + PW / 2; u <= Math.max(...us) - 0.3 - PW / 2 + 1e-6; u += stepU) {
        const c = [u * a[0] + v * d[0], u * a[1] + v * d[1]];
        const cantos = [[-PW / 2, -PL * cosI / 2], [PW / 2, -PL * cosI / 2], [PW / 2, PL * cosI / 2], [-PW / 2, PL * cosI / 2]].map(([du, dv]) => [c[0] + du * a[0] + dv * d[0], c[1] + du * a[1] + dv * d[1]]);
        if (cantos.every((q) => dentro(q, agua.pts)) && distBorda(c, agua.pts) > 0.25) out.push(c);
      }
    }
    return out;
  }

  /* ---------- sol e irradiação (modelo de céu claro calibrado pela irradiação da cidade) ---------- */
  function sol(lat, mes, hora) {
    const dec = rad(23.45) * Math.sin(2 * Math.PI * (284 + DIA_MES[mes]) / 365), H = rad((hora - 12) * 15), L = rad(lat);
    const alt = Math.asin(Math.sin(L) * Math.sin(dec) + Math.cos(L) * Math.cos(dec) * Math.cos(H));
    const az = Math.atan2(-Math.sin(H), Math.tan(dec) * Math.cos(L) - Math.sin(L) * Math.cos(H));
    return { alt, dir: [Math.cos(alt) * Math.sin(az), Math.sin(alt), Math.cos(alt) * Math.cos(az) * -1] }; // [leste, cima, sul]
  }
  const irr = (alt, ci, tilt, somb) => { if (alt <= 0) return 0; const am = 1 / Math.max(Math.sin(alt), 0.05), dni = 1000 * Math.pow(0.7, Math.pow(am, 0.678)), dif = 0.14 * dni * Math.sin(alt) + 60 * Math.sin(alt); return (somb ? 0 : dni * Math.max(ci, 0)) + dif * (1 + Math.cos(tilt)) / 2; };
  const normalAgua = (incl, az) => { const t = rad(incl), d = desce(az); return [Math.sin(t) * d[0], Math.cos(t), Math.sin(t) * d[1]]; };
  const amostras = (lat) => { const out = []; for (let m = 0; m < 12; m++) for (let h = 5.5; h <= 18.5; h += 0.5) { const s = sol(lat, m, h); if (s.alt > 0) out.push({ ...s, peso: 0.5 * MESES_DIAS[m] }); } return out; };
  function fatorAgua(lat, incl, az) { // energia relativa ao telhado ideal (norte, ~|lat|°)
    const am = amostras(lat), n = normalAgua(incl, az), nr = normalAgua(Math.abs(lat), 0);
    const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
    const e = am.reduce((s, x) => s + irr(x.alt, dot(x.dir, n), rad(incl), false) * x.peso, 0), r = am.reduce((s, x) => s + irr(x.alt, dot(x.dir, nr), rad(Math.abs(lat)), false) * x.peso, 0);
    return e / r;
  }

  /* distribui as placas do kit nas melhores águas */
  function distribuir(proj, qtd) {
    const lista = proj.aguas.map((a, i) => ({ i, a, fator: a.usar ? fatorAgua(proj.lat, a.incl, a.az) : 0, vagas: a.usar ? vagas(a) : [] })).filter((x) => x.vagas.length).sort((x, y) => y.fator - x.fator);
    let resta = qtd; const por = {};
    lista.forEach((x) => { const n = Math.min(resta, x.vagas.length); por[x.i] = x.vagas.slice(0, n); resta -= n; });
    return { por, cabem: lista.reduce((s, x) => s + x.vagas.length, 0), faltam: Math.max(resta, 0) };
  }

  /* ---------- cena 3D ---------- */
  function criar(container, proj, opc = {}) {
    const T = raiz.THREE, hw = proj.hw || 3;
    const cena = new T.Scene(); cena.fog = new T.Fog(0xdfe9f3, 90, 220);
    const ren = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    ren.setPixelRatio(Math.min(raiz.devicePixelRatio || 1, 2)); ren.shadowMap.enabled = true; ren.shadowMap.type = T.PCFSoftShadowMap;
    ren.outputEncoding = T.sRGBEncoding; ren.toneMapping = T.ACESFilmicToneMapping; ren.toneMappingExposure = 1.05;
    container.appendChild(ren.domElement); ren.domElement.style.display = 'block'; ren.domElement.style.width = '100%'; ren.domElement.style.height = '100%';
    const cam = new T.PerspectiveCamera(40, 1, 0.1, 600); const camTopo = new T.OrthographicCamera(-10, 10, 10, -10, 0.1, 300); camTopo.position.set(0, 120, 0.001); camTopo.lookAt(0, 0, 0);
    const ctl = new T.OrbitControls(cam, ren.domElement); ctl.enableDamping = true; ctl.maxPolarAngle = Math.PI / 2.08; ctl.minDistance = 6; ctl.maxDistance = 120;
    cena.add(new T.HemisphereLight(0xdbe8ff, 0x5d5444, 0.75));
    const luz = new T.DirectionalLight(0xfff0d8, 2.1); luz.castShadow = true; luz.shadow.mapSize.set(2048, 2048); luz.shadow.bias = -0.0004; luz.shadow.normalBias = 0.02;
    Object.assign(luz.shadow.camera, { left: -35, right: 35, top: 35, bottom: -35, near: 1, far: 200 }); cena.add(luz, luz.target);
    const tex = (w, h, fn, rep) => { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = 8; if (rep) t.wrapS = t.wrapT = T.RepeatWrapping; return t; };
    const tPlaca = tex(256, 512, (g, w, h) => { g.fillStyle = '#c8ccd2'; g.fillRect(0, 0, w, h); g.fillStyle = '#0f1d3d'; g.fillRect(8, 8, w - 16, h - 16); const cw = (w - 16) / 6, ch = (h - 16) / 12; for (let i = 0; i < 6; i++) for (let j = 0; j < 12; j++) { const gr = g.createLinearGradient(0, 8 + j * ch, 0, 8 + (j + 1) * ch); gr.addColorStop(0, '#1c3368'); gr.addColorStop(1, '#122454'); g.fillStyle = gr; g.fillRect(8 + i * cw + 1.5, 8 + j * ch + 1.5, cw - 3, ch - 3); } g.fillStyle = '#ffffff22'; g.fillRect(8, h / 2 - 1, w - 16, 2); });
    const corTelhado = { ceramico: 0xb4532d, fibrocimento: 0x9c9a94, metalico: 0xa9b2bd, laje: 0xbdb8ad, solo: 0x8f9a6a }[proj.tipoTelhado || 'ceramico'] || 0xb4532d;
    const M = {
      parede: new T.MeshStandardMaterial({ color: 0xefe6d6, roughness: 0.95, side: T.DoubleSide }),
      telhado: new T.MeshStandardMaterial({ color: corTelhado, roughness: 0.75, metalness: proj.tipoTelhado === 'metalico' ? 0.5 : 0, side: T.DoubleSide, transparent: true, opacity: 0.93 }),
      placa: new T.MeshStandardMaterial({ map: tPlaca, roughness: 0.25, metalness: 0.35 }),
      placaSombra: new T.MeshStandardMaterial({ map: tPlaca, color: 0xff5a4a, roughness: 0.4, emissive: 0x3a0000 }),
      moldura: new T.MeshStandardMaterial({ color: 0xa7adb5, metalness: 0.7, roughness: 0.4 }),
      caixa: new T.MeshStandardMaterial({ color: 0x2f6fb0, roughness: 0.6 }), tronco: new T.MeshStandardMaterial({ color: 0x5e4129, roughness: 1 }), copa: new T.MeshStandardMaterial({ color: 0x3b7a35, roughness: 1 }),
    };
    let chao = null, grupo = null, placas = [], obst = [], resultado = null, aoCalcular = opc.aoCalcular || (() => {});
    const est = { mes: 5, hora: 9.5 };
    function montarChao() {
      if (chao) cena.remove(chao);
      const lado = proj.ladoM || 100;
      const mat = new T.MeshStandardMaterial({ color: 0x7d9460, roughness: 1 });
      chao = new T.Mesh(new T.PlaneGeometry(lado, lado), mat); chao.rotation.x = -Math.PI / 2; chao.receiveShadow = true; cena.add(chao);
      if (proj.img) { const im = new Image(); im.onload = () => { const t = new T.Texture(im); t.encoding = T.sRGBEncoding; t.anisotropy = 8; t.needsUpdate = true; mat.map = t; mat.color.set(0xffffff); mat.needsUpdate = true; }; im.src = proj.img; }
      const borda = new T.Mesh(new T.CircleGeometry(lado * 2.5, 48), new T.MeshStandardMaterial({ color: 0x7d9460, roughness: 1 })); borda.position.z = -0.03; chao.add(borda);
    }
    function montar() {
      if (grupo) cena.remove(grupo); grupo = new T.Group(); cena.add(grupo); placas = []; obst = [];
      const dist = distribuir(proj, opc.placas ? opc.placas() : proj.placasKit || 0);
      proj.aguas.forEach((ag, i) => {
        if (ag.pts.length < 3) return;
        const h = planoDe(ag, hw);
        // telhado (triangulado)
        const v2 = ag.pts.map((p) => new T.Vector2(p[0], p[1])), tri = T.ShapeUtils.triangulateShape(v2, []);
        const pos = []; tri.forEach((t) => t.forEach((k) => { const p = ag.pts[k]; pos.push(p[0], h(p) + 0.02, p[1]); }));
        const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals();
        const telha = new T.Mesh(geo, M.telhado); telha.castShadow = telha.receiveShadow = true; grupo.add(telha); obst.push(telha);
        // paredes até a borda da água
        const pw = []; ag.pts.forEach((p, k) => { const q = ag.pts[(k + 1) % ag.pts.length], hp = h(p), hq = h(q); pw.push(p[0], 0, p[1], q[0], 0, q[1], q[0], hq, q[1], p[0], 0, p[1], q[0], hq, q[1], p[0], hp, p[1]); });
        const gp = new T.BufferGeometry(); gp.setAttribute('position', new T.Float32BufferAttribute(pw, 3)); gp.computeVertexNormals();
        const par = new T.Mesh(gp, M.parede); par.castShadow = par.receiveShadow = true; grupo.add(par); obst.push(par);
        // placas
        (dist.por[i] || []).forEach((c) => {
          const g1 = new T.Group(); g1.position.set(c[0], h(c) + 0.12, c[1]); g1.rotation.y = -rad(ag.az); grupo.add(g1);
          const g2 = new T.Group(); g2.rotation.x = -rad(ag.incl); g1.add(g2);
          const pl = new T.Mesh(new T.BoxGeometry(PW, 0.04, PL), [M.moldura, M.moldura, M.placa, M.moldura, M.moldura, M.moldura]); pl.castShadow = pl.receiveShadow = true; pl.userData = { agua: i, incl: ag.incl, az: ag.az }; g2.add(pl);
          placas.push(pl); obst.push(pl);
        });
      });
      (proj.obst || []).forEach((o) => {
        if (o.tipo === 'caixa') { const ag = proj.aguas.find((a) => dentro([o.x, o.z], a.pts)); const y = ag ? planoDe(ag, hw)([o.x, o.z]) : hw; const m = new T.Mesh(new T.CylinderGeometry(0.75, 0.8, 1.4, 28), M.caixa); m.position.set(o.x, y + 0.6, o.z); m.castShadow = true; grupo.add(m); obst.push(m); }
        else { const hh = o.h || 8, g = new T.Group(); g.position.set(o.x, 0, o.z); const tr = new T.Mesh(new T.CylinderGeometry(0.25, 0.4, hh * 0.45, 10), M.tronco); tr.position.y = hh * 0.22; tr.castShadow = true; const co = new T.Mesh(new T.IcosahedronGeometry(Math.max(hh * 0.33, 1), 1), M.copa); co.position.y = hh * 0.68; co.scale.set(1, 0.85, 1); co.castShadow = true; g.add(tr, co); grupo.add(g); obst.push(tr, co); }
      });
      const todos = proj.aguas.flatMap((a) => a.pts); const c = todos.length ? centroide(todos) : [0, 0];
      const raio = todos.length ? Math.max(...todos.map((p) => Math.hypot(p[0] - c[0], p[1] - c[1]))) : 10;
      ctl.target.set(c[0], hw, c[1]); if (!opc.manterCamera || !montar.ja) { cam.position.set(c[0] + raio * 1.4 + 6, raio * 1.3 + 8, c[1] + raio * 1.7 + 8); montar.ja = true; }
      camTopo.position.set(c[0], 120, c[1] + 0.001); camTopo.lookAt(c[0], 0, c[1]); camTopo.userData.raio = raio + 4;
      resultado = { ...calcular(), cabem: dist.cabem, faltam: dist.faltam }; aoCalcular(resultado); posicionarSol();
      return resultado;
    }
    const ray = new T.Raycaster();
    function sombreada(p, dir) { const o = p.getWorldPosition(new T.Vector3()), d = new T.Vector3(dir[0], dir[1], dir[2]); ray.set(o.addScaledVector(d, 0.08), d); ray.far = 120; return ray.intersectObjects(obst.filter((x) => x !== p), false).length > 0; }
    function calcular() {
      cena.updateMatrixWorld(true);
      const am = amostras(proj.lat), nr = normalAgua(Math.abs(proj.lat), 0), dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
      const ref = am.reduce((s, x) => s + irr(x.alt, dot(x.dir, nr), rad(Math.abs(proj.lat)), false) * x.peso, 0);
      let sem = 0, com = 0; const porAgua = {};
      placas.forEach((p) => {
        const n = normalAgua(p.userData.incl, p.userData.az), t = rad(p.userData.incl); let s1 = 0, c1 = 0;
        am.forEach((x) => { const ci = dot(x.dir, n), b = irr(x.alt, ci, t, false) * x.peso; s1 += b; c1 += ci > 0 && sombreada(p, x.dir) ? irr(x.alt, ci, t, true) * x.peso : b; });
        sem += s1; com += c1; porAgua[p.userData.agua] = (porAgua[p.userData.agua] || 0) + 1;
      });
      const n = placas.length || 1, perdaOri = placas.length ? Math.max(0, 1 - sem / (ref * n)) : 0, perdaSom = sem ? 1 - com / sem : 0;
      return { placas: placas.length, porAgua, perdaOri, perdaSom, perda: 1 - (1 - perdaOri) * (1 - perdaSom) };
    }
    function posicionarSol() {
      const s = sol(proj.lat, est.mes, est.hora), c = ctl.target;
      luz.position.set(c.x + s.dir[0] * 70, s.dir[1] * 70, c.z + s.dir[2] * 70); luz.target.position.set(c.x, 0, c.z); luz.intensity = s.alt > 0 ? 2.1 : 0;
      let k = 0; placas.forEach((p) => { const n = normalAgua(p.userData.incl, p.userData.az), so = s.alt > 0 && (s.dir[0] * n[0] + s.dir[1] * n[1] + s.dir[2] * n[2]) > 0 && sombreada(p, s.dir); p.material[2] = so ? M.placaSombra : M.placa; if (so) k++; });
      if (opc.aoSol) opc.aoSol(k, s.alt > 0);
    }
    let usarTopo = false, vivo = true;
    function tamanho() { const w = container.clientWidth || 600, h = container.clientHeight || 400; ren.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); const r = camTopo.userData.raio || 14; camTopo.left = -r * w / h; camTopo.right = r * w / h; camTopo.top = r; camTopo.bottom = -r; camTopo.updateProjectionMatrix(); }
    const ro = new ResizeObserver(tamanho); ro.observe(container);
    function quadro() { if (!vivo) return; ctl.update(); ren.render(cena, usarTopo ? camTopo : cam); requestAnimationFrame(quadro); }
    montarChao(); montar(); tamanho(); quadro();
    function foto(topo) { // imagem 4:3 para a proposta
      const w0 = container.clientWidth, h0 = container.clientHeight; ren.setSize(1200, 900, false); cam.aspect = 4 / 3; cam.updateProjectionMatrix();
      const r = camTopo.userData.raio || 14; camTopo.left = -r * 4 / 3; camTopo.right = r * 4 / 3; camTopo.top = r; camTopo.bottom = -r; camTopo.updateProjectionMatrix();
      ren.render(cena, topo ? camTopo : cam); const url = ren.domElement.toDataURL('image/jpeg', 0.85); void w0; void h0; tamanho(); return url;
    }
    return {
      montar, foto, get resultado() { return resultado; },
      sol(mes, hora) { est.mes = mes; est.hora = hora; posicionarSol(); },
      topo(v) { usarTopo = v; ctl.enabled = !v; },
      chao: montarChao,
      destruir() { vivo = false; ro.disconnect(); ren.dispose(); container.innerHTML = ''; },
    };
  }

  raiz.Usina3D = { carregarThree, fotoSatelite, aguasDoGoogle, paraMetros, resolucao, vagas, distribuir, fatorAgua, areaPol, centroide, dentro, criar, PL, PW };
})(window);
