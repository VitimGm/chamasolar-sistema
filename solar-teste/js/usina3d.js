/* =====================================================================
   USINA 3D (v2) — motor do projeto do telhado
   - Blocos: cada parte do telhado com altura, inclinação, caimento,
     platibanda e tipo de telha (casas em Ribeirão: vários "caixotes"
     com telha metálica escondida atrás da platibanda).
   - Obstáculos: caixa d'água, condensadora, respiro, árvore, prédio.
   - Placas com a medida real do kit, espaço do grampo entre placas,
     afastamento da borda e corredor de manutenção.
   - Sombra: traçado de raios placa a placa, hora a hora em 7 dias que
     representam o ano + céu visível (difusa). Como Aurora/Scanifly:
     acesso ao sol (sombra), TOF (direção/inclinação) e TSRF (os dois).
   - Geração: PVGIS (SARAH-3) por água × perda de sombra de cada placa.
   Coordenadas no chão em metros: x = leste, z = sul, y = para cima.
   ===================================================================== */
(function (raiz) {
  'use strict';
  const rad = (g) => g * Math.PI / 180, deg = (r) => r * 180 / Math.PI;

  /* ---------- three.js sob demanda ---------- */
  let carregando = null;
  function carregarThree() {
    if (raiz.THREE && raiz.THREE.OrbitControls) return Promise.resolve();
    if (carregando) return carregando;
    const s = (src) => new Promise((ok, erro) => { const e = document.createElement('script'); e.src = src; e.onload = ok; e.onerror = () => erro(new Error('não carregou o 3D')); document.head.appendChild(e); });
    carregando = (raiz.THREE ? Promise.resolve() : s('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'))
      .then(() => s('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js'));
    return carregando;
  }

  /* ---------- geo (Web Mercator) ---------- */
  const resolucao = (lat, z) => 156543.03392 * Math.cos(rad(lat)) / Math.pow(2, z);
  const pxGlobal = (lat, lng, z) => { const n = 256 * Math.pow(2, z), s = Math.sin(rad(lat)); return { x: (lng + 180) / 360 * n, y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n }; };
  const paraMetros = (proj, lat, lng) => { const a = pxGlobal(proj.lat, proj.lng, 20), b = pxGlobal(lat, lng, 20), r = resolucao(proj.lat, 20); return [(b.x - a.x) * r, (b.y - a.y) * r]; };
  function paraLatLng(proj, m) { const r = resolucao(proj.lat, 20), N = 256 * Math.pow(2, 20), c = pxGlobal(proj.lat, proj.lng, 20), X = c.x + m[0] / r, Y = c.y + m[1] / r; return { lng: X / N * 360 - 180, lat: deg(Math.atan(Math.sinh(Math.PI * (1 - 2 * Y / N)))) }; }

  /* foto de satélite (tiles do Google pelo nosso servidor), centrada no imóvel */
  async function fotoSatelite(proj, buscarTile, ladoM = 60) {
    const z = ladoM > 140 ? 19 : 20, r = resolucao(proj.lat, z), meio = ladoM / r / 2, c = pxGlobal(proj.lat, proj.lng, z);
    const x0 = Math.floor((c.x - meio) / 256), x1 = Math.floor((c.x + meio) / 256), y0 = Math.floor((c.y - meio) / 256), y1 = Math.floor((c.y + meio) / 256);
    const lado = 2048, esc = lado / (2 * meio), cv = document.createElement('canvas'); cv.width = cv.height = lado;
    const g = cv.getContext('2d'); g.fillStyle = '#3a4a3a'; g.fillRect(0, 0, lado, lado);
    const tarefas = [];
    for (let tx = x0; tx <= x1; tx++) for (let ty = y0; ty <= y1; ty++) tarefas.push(buscarTile(z, tx, ty).then((b) => createImageBitmap(b)).then((im) => g.drawImage(im, (tx * 256 - (c.x - meio)) * esc, (ty * 256 - (c.y - meio)) * esc, 256 * esc, 256 * esc)).catch(() => null));
    await Promise.all(tarefas);
    return { cheia: reduzir(cv, 1600, 0.82), mini: reduzir(cv, 640, 0.7), ladoM };
  }
  function reduzir(fonte, max, q) { const w = fonte.width || fonte.naturalWidth, h = fonte.height || fonte.naturalHeight, e = Math.min(1, max / Math.max(w, h)); const c = document.createElement('canvas'); c.width = Math.round(w * e); c.height = Math.round(h * e); c.getContext('2d').drawImage(fonte, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', q); }

  /* ---------- dados do voo gravados na foto do drone (EXIF + XMP da DJI) ----------
     altura do voo, direção da câmera (norte), inclinação do gimbal, GPS e lente.
     Some quando a foto passa pelo WhatsApp: por isso pedimos o arquivo original. */
  function lerMetadados(buf) {
    const v = new DataView(buf), out = {};
    try {
      if (v.getUint16(0) !== 0xFFD8) return out;
      let p = 2;
      while (p + 4 <= v.byteLength && v.getUint8(p) === 0xFF) {
        const m = v.getUint8(p + 1), len = v.getUint16(p + 2), ini = p + 4;
        if (m === 0xDA || m === 0xD9) break;
        if (m === 0xE1 && ini + 6 <= v.byteLength) {
          if (v.getUint32(ini) === 0x45786966 && v.getUint16(ini + 4) === 0) exif(v, ini + 6, out);
          else { const txt = new TextDecoder('latin1').decode(new Uint8Array(buf, ini, Math.max(0, Math.min(len - 2, v.byteLength - ini)))); if (txt.startsWith('http://ns.adobe.com/xap/1.0/')) xmp(txt, out); }
        }
        p += 2 + len;
      }
    } catch { /* foto sem dados legíveis */ }
    return out;
  }
  function exif(v, t, out) {
    const le = v.getUint16(t) === 0x4949, u16 = (o) => v.getUint16(t + o, le), u32 = (o) => v.getUint32(t + o, le), rat = (o) => { const b = u32(o + 4); return b ? u32(o) / b : 0; };
    const TAM = [0, 1, 1, 2, 4, 8, 1, 1, 2, 4, 8, 4, 8];
    const ifd = (o, cb) => { if (!o || t + o + 2 > v.byteLength) return; const n = u16(o); for (let i = 0; i < n && t + o + 14 + i * 12 <= v.byteLength; i++) { const e = o + 2 + i * 12, tipo = u16(e + 2), cnt = u32(e + 4); cb(u16(e), tipo, cnt, (TAM[tipo] || 1) * cnt > 4 ? u32(e + 8) : e + 8); } };
    let pE = 0, pG = 0, latR = 'N', lngR = 'E';
    ifd(u32(4), (tag, tipo, cnt, o) => { if (tag === 0x8769) pE = u32(o); else if (tag === 0x8825) pG = u32(o); else if (tag === 0x0110) { let s = ''; for (let i = 0; i < cnt - 1 && t + o + i < v.byteLength; i++) s += String.fromCharCode(v.getUint8(t + o + i)); out.modelo = s.trim(); } });
    ifd(pE, (tag, tipo, cnt, o) => { if (tag === 0xA405) out.f35 = u16(o); else if (tag === 0x920A) out.focal = rat(o); });
    ifd(pG, (tag, tipo, cnt, o) => { if (tag === 1) latR = String.fromCharCode(v.getUint8(t + o)); else if (tag === 3) lngR = String.fromCharCode(v.getUint8(t + o)); else if (tag === 2) out.lat = rat(o) + rat(o + 8) / 60 + rat(o + 16) / 3600; else if (tag === 4) out.lng = rat(o) + rat(o + 8) / 60 + rat(o + 16) / 3600; });
    if (out.lat != null && latR === 'S') out.lat = -out.lat;
    if (out.lng != null && lngR === 'W') out.lng = -out.lng;
  }
  function xmp(txt, out) {
    const num = (...nomes) => { for (const nm of nomes) { const m = txt.match(new RegExp('drone-dji:' + nm + '\\s*(?:=\\s*"|>)\\s*([+-]?\\d+(?:\\.\\d+)?)')); if (m) return +m[1]; } return null; };
    out.altRel = num('RelativeAltitude'); out.yaw = num('GimbalYawDegree', 'FlightYawDegree'); out.pitch = num('GimbalPitchDegree');
    if (out.lat == null) { const la = num('GpsLatitude', 'Latitude'), lo = num('GpsLongitude', 'GpsLongtitude', 'Longitude'); if (la != null && lo != null) { out.lat = la; out.lng = lo; } }
  }
  /* posição, escala (m por ponto, no plano do telhado) e norte da foto a partir dos dados do voo */
  function colocarDrone(md, w, h, proj, alturaTelhado = 4) {
    const r = {};
    if (md.altRel > alturaTelhado + 5 && md.f35 > 0) r.escala = (md.altRel - alturaTelhado) * 43.27 / (md.f35 * Math.hypot(w, h)); // lente equivalente de 35 mm (diagonal 43,27 mm)
    if (Number.isFinite(md.yaw)) r.rot = Math.round(md.yaw * 10) / 10; // topo da foto aponta para o yaw da câmera
    if (Number.isFinite(md.lat) && Number.isFinite(md.lng) && Math.abs(md.lat) > 0.01) {
      if (proj && Number.isFinite(proj.lat) && proj.fonte === 'google') { const m = paraMetros(proj, md.lat, md.lng); if (Math.hypot(m[0], m[1]) < 150) { r.cx = m[0]; r.cz = m[1]; } }
      else r.latLng = { lat: md.lat, lng: md.lng };
    }
    r.inclinada = Number.isFinite(md.pitch) && md.pitch > -80; // foto não está "bem de cima"
    return r;
  }

  /* ---------- placa: medida pela ficha (célula/potência no nome do portal) ---------- */
  function medidasModulo(nome, w) { // pela potência (o nome do portal nem sempre traz as células); o vendedor confere na ficha
    const cel = +((String(nome || '').match(/-(108|120|132|144)-/) || [])[1] || 0);
    if (w >= 650) return { c: 2.384, l: 1.303 };                                   // 210 mm, 132 meias-células
    if (w >= 595) return cel === 120 ? { c: 2.172, l: 1.303 } : { c: 2.382, l: 1.134 }; // 182 mm, 132 meias-células
    if (w >= 535) return { c: 2.278, l: 1.134 };                                   // 144 meias-células
    if (w >= 440) return { c: 1.903, l: 1.134 };                                   // 120 meias-células
    if (w > 0) return { c: 1.722, l: 1.134 };                                      // 108 meias-células
    return { c: 2.278, l: 1.134 };
  }

  /* ---------- geometria plana ---------- */
  const centroide = (pts) => pts.reduce((s, p) => [s[0] + p[0] / pts.length, s[1] + p[1] / pts.length], [0, 0]);
  function dentro(p, pol) { let d = false; for (let i = 0, j = pol.length - 1; i < pol.length; j = i++) { const a = pol[i], b = pol[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) d = !d; } return d; }
  const areaSinal = (pts) => pts.reduce((s, p, i) => { const q = pts[(i + 1) % pts.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
  const areaPol = (pts) => Math.abs(areaSinal(pts));
  /* recuo para dentro (d > 0) por deslocamento das arestas; serve para polígonos simples */
  function recuar(pts, d) {
    if (!d || pts.length < 3) return pts.map((p) => [...p]);
    const s = areaSinal(pts) > 0 ? 1 : -1, n = pts.length, linhas = [];
    for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1, nx = -dz / L * s, nz = dx / L * s; linhas.push([[a[0] + nx * d, a[1] + nz * d], [dx, dz]]); }
    return linhas.map((l1, i) => { const l0 = linhas[(i - 1 + n) % n], [p0, v0] = l0, [p1, v1] = l1, den = v0[0] * v1[1] - v0[1] * v1[0]; if (Math.abs(den) < 1e-9) return [...p1]; const t = ((p1[0] - p0[0]) * v1[1] - (p1[1] - p0[1]) * v1[0]) / den; return [p0[0] + v0[0] * t, p0[1] + v0[1] * t]; });
  }
  /* retângulo por 3 toques: A e B fazem um lado; C dá a profundidade */
  function retangulo3(a, b, c) { const ux = b[0] - a[0], uz = b[1] - a[1], L = Math.hypot(ux, uz) || 1, nx = -uz / L, nz = ux / L, prof = (c[0] - b[0]) * nx + (c[1] - b[1]) * nz; return [a, b, [b[0] + nx * prof, b[1] + nz * prof], [a[0] + nx * prof, a[1] + nz * prof]]; }

  /* ---------- blocos do telhado ---------- */
  const desce = (az) => [Math.sin(rad(az)), -Math.cos(rad(az))]; // para onde a água escorre (no chão)
  function alturaEm(b, p) { const d = desce(b.az), t = Math.tan(rad(b.incl)), sMax = Math.max(...b.pts.map((q) => q[0] * d[0] + q[1] * d[1])); return (b.alturaBeiral || 3) + (sMax - (p[0] * d[0] + p[1] * d[1])) * t; }
  const topoTelhado = (b) => Math.max(...b.pts.map((p) => alturaEm(b, p)));
  const topoParede = (b) => (b.platibanda > 0 ? Math.max((b.alturaBeiral || 3) + b.platibanda, topoTelhado(b) + 0.05) : null);
  const ESP_PLATIBANDA = 0.15;
  const internoDe = (b) => (b.platibanda > 0 ? recuar(b.pts, ESP_PLATIBANDA) : b.pts);
  const normalPlano = (incl, az) => { const t = rad(incl), d = desce(az); return [Math.sin(t) * d[0], Math.cos(t), Math.sin(t) * d[1]]; };
  let seq = 0; const novoId = (p) => p + Date.now().toString(36) + (seq++).toString(36);

  /* águas do Google → blocos (com altura relativa entre elas) */
  function blocosDoGoogle(proj, g) {
    const pg = g.placaGoogle || {}, alt = pg.alturaM || 1.879, larg = pg.larguraM || 1.045;
    const alturas = (g.aguas || []).map((s) => s.alturaM).filter(Number.isFinite), hMin = alturas.length ? Math.min(...alturas) : 0;
    return (g.aguas || []).map((s, k) => {
      const az = rad(s.az), d = [Math.sin(az), -Math.cos(az)], a = [Math.cos(az), Math.sin(az)];
      const pls = (g.placas || []).filter((p) => p.s === s.i).map((p) => ({ m: paraMetros(proj, p.c.latitude, p.c.longitude), o: p.o }));
      let pts;
      if (pls.length >= 2) {
        let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
        pls.forEach(({ m, o }) => { const u = m[0] * a[0] + m[1] * a[1], v = m[0] * d[0] + m[1] * d[1], hu = (o === 'LANDSCAPE' ? alt : larg) / 2 + 0.35, hv = (o === 'LANDSCAPE' ? larg : alt) / 2 * Math.cos(rad(s.incl)) + 0.35; u0 = Math.min(u0, u - hu); u1 = Math.max(u1, u + hu); v0 = Math.min(v0, v - hv); v1 = Math.max(v1, v + hv); });
        pts = [[u0, v1], [u1, v1], [u1, v0], [u0, v0]].map(([u, v]) => [u * a[0] + v * d[0], u * a[1] + v * d[1]]);
      } else if (s.caixa) {
        const sw = paraMetros(proj, s.caixa.sw.latitude, s.caixa.sw.longitude), ne = paraMetros(proj, s.caixa.ne.latitude, s.caixa.ne.longitude);
        pts = [[sw[0], ne[1]], [ne[0], ne[1]], [ne[0], sw[1]], [sw[0], sw[1]]];
      } else return null;
      const centro = Number.isFinite(s.alturaM) ? 3 + (s.alturaM - hMin) : 3;
      const b = { id: novoId('b'), nome: 'Telhado ' + (k + 1), pts: pts.map((p) => [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100]), incl: Math.max(0, Math.round(s.incl)), az: Math.round(s.az / 5) * 5 % 360, alturaBeiral: 3, platibanda: 0, telha: proj.tipoTelhado || 'metalico', usar: s.incl < 40, orientacao: 'retrato', fonte: 'google' };
      b.alturaBeiral = Math.max(2.4, Math.round((centro - (alturaEm({ ...b, alturaBeiral: 0 }, centroide(b.pts)))) * 10) / 10);
      return b;
    }).filter(Boolean);
  }
  /* projeto da versão 1 (águas) → blocos */
  function migrar(p) {
    if (!p || p.versao === 2) return p;
    const blocos = (p.aguas || []).map((a, k) => ({ id: novoId('b'), nome: 'Telhado ' + (k + 1), pts: a.pts, incl: a.incl, az: a.az, alturaBeiral: p.hw || 3, platibanda: 0, telha: p.tipoTelhado || 'ceramico', usar: a.usar !== false, orientacao: 'retrato' }));
    const obst = (p.obst || []).map((o) => (o.tipo === 'caixa' ? { id: novoId('o'), tipo: 'caixa', x: o.x, z: o.z, r: 0.75, h: 1.3 } : { id: novoId('o'), tipo: 'arvore', x: o.x, z: o.z, r: Math.max((o.h || 8) * 0.3, 1.5), h: o.h || 8 }));
    return { versao: 2, lat: p.lat, lng: p.lng, endereco: p.endereco, fonte: p.fonte, qualidade: p.qualidade, data: p.data, fundo: p.img ? { mini: p.img, ladoM: p.ladoM || 60 } : null, blocos, obst, layout: { qtd: p.placasKit || 12 } };
  }

  /* ---------- obstáculos ---------- */
  const OBST = {
    caixa: { nome: "Caixa d'água", r: 0.75, h: 1.3, redondo: true, base: 'auto' },
    ar: { nome: 'Condensadora (ar)', w: 0.9, d: 0.4, h: 0.7, base: 'auto' },
    respiro: { nome: 'Respiro/chaminé', r: 0.15, h: 1.0, redondo: true, base: 'auto' },
    arvore: { nome: 'Árvore', r: 2.5, h: 8, redondo: true, base: 'chao' },
    predio: { nome: 'Prédio/muro vizinho', w: 6, d: 4, h: 6, base: 'chao' },
  };
  function baseObst(proj, o) {
    if ((o.base || OBST[o.tipo].base) === 'chao') return 0;
    let y = 0; (proj.blocos || []).forEach((b) => { if (dentro([o.x, o.z], b.pts)) y = Math.max(y, alturaEm(b, [o.x, o.z])); });
    return y;
  }
  function pegadaObst(o, folga = 0) { // polígono no chão (para tirar placas de cima)
    const T = OBST[o.tipo] || {};
    if (T.redondo || o.r) { const r = (o.r || T.r) + folga; return Array.from({ length: 12 }, (_, i) => [o.x + r * Math.cos(i * Math.PI / 6), o.z + r * Math.sin(i * Math.PI / 6)]); }
    const w = (o.w || T.w) / 2 + folga, d = (o.d || T.d) / 2 + folga, c = Math.cos(rad(o.rot || 0)), s = Math.sin(rad(o.rot || 0));
    return [[-w, -d], [w, -d], [w, d], [-w, d]].map(([u, v]) => [o.x + u * c - v * s, o.z + u * s + v * c]);
  }

  /* ---------- vagas de placa (grade alinhada ao caimento) ---------- */
  function vagas(proj) {
    const L = proj.layout || {}, mod = L.modulo || { c: 2.382, l: 1.134 }, out = [];
    const gU = (L.entrePlacasMm ?? 20) / 1000, gV = (L.entreFileirasMm ?? 20) / 1000, borda = L.bordaM ?? 0.3, corr = L.corredorM ?? 0.6, cada = L.corredorCada || 0;
    const kps = (proj.obst || []).map((o) => pegadaObst(o, 0.25));
    const todos = proj.blocos || [];
    // vaga coberta por outro telhado mais alto (ex.: um caixote em cima da laje) não vale
    const coberta = (b, cantos) => todos.some((o) => o !== b && cantos.some((q) => dentro(q, o.pts) && alturaEm(o, q) > alturaEm(b, q) + 0.05));
    (proj.blocos || []).forEach((b, bi) => {
      if (!b.usar || b.incl > 45 || b.pts.length < 3) return;
      const util = recuar(internoDe(b), borda); if (areaPol(util) < 1) return;
      const d = desce(b.az), a = [-d[1], d[0]], cosI = Math.cos(rad(b.incl));
      const retr = (b.orientacao || 'retrato') === 'retrato', w = retr ? mod.l : mod.c, hs = retr ? mod.c : mod.l, hg = hs * cosI;
      const us = util.map((p) => p[0] * a[0] + p[1] * a[1]), vs = util.map((p) => p[0] * d[0] + p[1] * d[1]);
      const u0 = Math.min(...us), u1 = Math.max(...us), v0 = Math.min(...vs), v1 = Math.max(...vs);
      let melhor = [];
      for (const [au, av] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        const lista = [], passoU = w + gU;
        const nU = Math.floor((u1 - u0 + gU) / passoU);
        const sobraU = (u1 - u0) - (nU * passoU - gU);
        const iniU = au ? u0 + sobraU : u0;
        let v = av ? v1 - hg / 2 : v0 + hg / 2, linha = 0;
        while (av ? v - hg / 2 >= v0 - 1e-6 : v + hg / 2 <= v1 + 1e-6) {
          for (let i = 0; i < nU; i++) {
            const u = iniU + w / 2 + i * passoU, c = [u * a[0] + v * d[0], u * a[1] + v * d[1]];
            const cantos = [[-w / 2, -hg / 2], [w / 2, -hg / 2], [w / 2, hg / 2], [-w / 2, hg / 2]].map(([du, dv]) => [c[0] + du * a[0] + dv * d[0], c[1] + du * a[1] + dv * d[1]]);
            if (!cantos.every((q) => dentro(q, util))) continue;
            if (kps.some((k) => cantos.some((q) => dentro(q, k)) || k.some((q) => dentro(q, cantos)) || dentro(c, k))) continue;
            if (coberta(b, cantos)) continue;
            lista.push({ k: `${b.id}:${i}:${linha}`, bi, b: b.id, c, cantos, i, linha, w, hs, a, d, incl: b.incl, az: b.az });
          }
          linha++;
          const extra = cada && linha % cada === 0 ? corr * cosI : 0;
          v += (av ? -1 : 1) * (hg + gV * cosI + extra);
        }
        if (lista.length > melhor.length) melhor = lista;
      }
      melhor.forEach((s) => { s.y = alturaEm(b, s.c) + 0.1; s.n = normalPlano(b.incl, b.az); });
      out.push(...melhor);
    });
    return out;
  }

  /* ---------- sol: 7 dias que representam o ano (simetria da declinação) ---------- */
  const DIAS = [
    { doy: 355, peso: 30.4, meses: [11], nome: 'Dezembro' }, { doy: 20, peso: 60.8, meses: [0, 10], nome: 'Jan/Nov' }, { doy: 51, peso: 60.8, meses: [1, 9], nome: 'Fev/Out' },
    { doy: 79, peso: 60.8, meses: [2, 8], nome: 'Mar/Set' }, { doy: 110, peso: 60.8, meses: [3, 7], nome: 'Abr/Ago' }, { doy: 141, peso: 60.8, meses: [4, 6], nome: 'Mai/Jul' }, { doy: 172, peso: 30.4, meses: [5], nome: 'Junho' },
  ];
  // PVGIS-SARAH3, Ribeirão Preto (2015–2020): fração difusa e sol no plano horizontal (kWh/m² por dia) de cada mês
  const KD_PADRAO = [0.43, 0.422, 0.368, 0.29, 0.312, 0.263, 0.252, 0.292, 0.357, 0.398, 0.427, 0.437];
  const H_PADRAO = [5.998, 5.907, 5.643, 5.367, 4.285, 4.152, 4.477, 4.952, 5.513, 5.838, 6.0, 6.016];
  const ALBEDO = 0.2;
  const ASSIM = 0.16; // calibrado contra o PVGIS em Ribeirão: oeste perde ~2,5% para leste
  function posSol(lat, doy, hora) {
    const dec = rad(23.45) * Math.sin(2 * Math.PI * (284 + doy) / 365), H = rad((hora - 12) * 15), L = rad(lat);
    const alt = Math.asin(Math.sin(L) * Math.sin(dec) + Math.cos(L) * Math.cos(dec) * Math.cos(H));
    const az = Math.atan2(-Math.sin(H), Math.tan(dec) * Math.cos(L) - Math.sin(L) * Math.cos(H));
    return { alt, az, dir: [Math.cos(alt) * Math.sin(az), Math.sin(alt), -Math.cos(alt) * Math.cos(az)] };
  }
  /* amostras de meia em meia hora nos 7 dias. A forma do dia vem do céu limpo; a quantidade de sol
     direto e difuso é ajustada à média real de cada mês (PVGIS): verão com nuvem, inverno seco. */
  function amostras(lat, kd = KD_PADRAO, H = H_PADRAO) {
    const out = [], media = (v, D) => D.meses.reduce((s, m) => s + v[m], 0) / D.meses.length;
    DIAS.forEach((D, di) => {
      const k = media(kd, D), lista = [];
      for (let h = 5.5; h <= 18.5; h += 0.5) {
        const s = posSol(lat, D.doy, h); if (s.alt <= rad(1)) continue;
        const am = 1 / Math.max(Math.sin(s.alt), 0.05), dni = 1000 * Math.pow(0.7, Math.pow(am, 0.678));
        lista.push({ di, h, dir: s.dir, alt: s.alt, dni, dhi: k / (1 - k) * dni * Math.sin(s.alt), peso: D.peso * 0.5 });
      }
      if (H && lista.length) {
        // nas chuvas (outubro a março) a nuvem chega à tarde: um pouco mais de sol direto de manhã do que à tarde
        const tarde = k >= 0.35 ? ASSIM : 0; lista.forEach((x) => { x.dni *= 1 + tarde * Math.max(-1, Math.min(1, (12 - x.h) / 3)); });
        const Hd = media(H, D) * 1000, bh = lista.reduce((t, x) => t + x.dni * Math.sin(x.alt) * 0.5, 0), sh = lista.reduce((t, x) => t + Math.sin(x.alt) * 0.5, 0);
        const fb = bh ? (1 - k) * Hd / bh : 1; lista.forEach((x) => { x.dni *= fb; x.dhi = k * Hd * Math.sin(x.alt) / sh; });
      }
      // difusa anisotrópica (Hay-Davies): a parte do céu em volta do sol vem da direção do sol e leva a mesma sombra
      lista.forEach((x) => { const Ai = Math.min(x.dni / 1361, 0.75), sa = Math.max(Math.sin(x.alt), 0.087); x.ghi = x.dni * Math.sin(x.alt) + x.dhi; x.dni += x.dhi * Ai / sa; x.dhi *= 1 - Ai; });
      out.push(...lista);
    });
    return out;
  }
  const dot3 = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];

  /* ---------- oclusores: triângulos (paredes, platibandas, telhados, obstáculos) ---------- */
  function oclusores(proj) {
    const objs = [];
    const add = (tris) => { if (!tris.length) return; const t = new Float32Array(tris), mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; for (let i = 0; i < t.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], t[i + k]); mx[k] = Math.max(mx[k], t[i + k]); } objs.push({ t, mn, mx }); };
    const quad = (T, a, b, c, d) => T.push(...a, ...b, ...c, ...a, ...c, ...d);
    (proj.blocos || []).forEach((b) => {
      const T = [], topo = topoParede(b), P = b.pts;
      P.forEach((p, i) => { const q = P[(i + 1) % P.length], hp = topo ?? alturaEm(b, p), hq = topo ?? alturaEm(b, q); quad(T, [p[0], 0, p[1]], [q[0], 0, q[1]], [q[0], hq, q[1]], [p[0], hp, p[1]]); });
      const I = internoDe(b), tri = triangular(I); tri.forEach(([i, j, k]) => T.push(I[i][0], alturaEm(b, I[i]), I[i][1], I[j][0], alturaEm(b, I[j]), I[j][1], I[k][0], alturaEm(b, I[k]), I[k][1]));
      add(T);
    });
    (proj.obst || []).forEach((o) => {
      const T = [], y0 = baseObst(proj, o), Tp = OBST[o.tipo] || {}, h = o.h ?? Tp.h;
      if (o.tipo === 'arvore') {
        const r = o.r ?? Tp.r, cy = y0 + h - r, n = 10;
        for (let i = 0; i < n; i++) for (let j = 0; j < 5; j++) { // esfera grosseira
          const f = (a, e) => [o.x + r * Math.cos(e) * Math.cos(a), cy + r * Math.sin(e), o.z + r * Math.cos(e) * Math.sin(a)];
          const a0 = i / n * 2 * Math.PI, a1 = (i + 1) / n * 2 * Math.PI, e0 = -Math.PI / 2 + j / 5 * Math.PI, e1 = -Math.PI / 2 + (j + 1) / 5 * Math.PI;
          quad(T, f(a0, e0), f(a1, e0), f(a1, e1), f(a0, e1));
        }
        const rt = 0.25; for (let i = 0; i < 6; i++) { const a0 = i / 6 * 2 * Math.PI, a1 = (i + 1) / 6 * 2 * Math.PI; quad(T, [o.x + rt * Math.cos(a0), y0, o.z + rt * Math.sin(a0)], [o.x + rt * Math.cos(a1), y0, o.z + rt * Math.sin(a1)], [o.x + rt * Math.cos(a1), cy, o.z + rt * Math.sin(a1)], [o.x + rt * Math.cos(a0), cy, o.z + rt * Math.sin(a0)]); }
      } else {
        const pg = pegadaObst(o), y1 = y0 + h;
        pg.forEach((p, i) => { const q = pg[(i + 1) % pg.length]; quad(T, [p[0], y0, p[1]], [q[0], y0, q[1]], [q[0], y1, q[1]], [p[0], y1, p[1]]); });
        for (let i = 1; i < pg.length - 1; i++) T.push(pg[0][0], y1, pg[0][1], pg[i][0], y1, pg[i][1], pg[i + 1][0], y1, pg[i + 1][1]);
      }
      add(T);
    });
    return objs;
  }
  /* triangulação de polígono simples (orelhas) */
  function triangular(P) {
    const n = P.length; if (n < 3) return [];
    const idx = [...Array(n).keys()]; if (areaSinal(P) < 0) idx.reverse();
    const out = []; let guarda = 0;
    const conv = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) > 0;
    const noTri = (p, a, b, c) => { const s1 = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]), s2 = (c[0] - b[0]) * (p[1] - b[1]) - (c[1] - b[1]) * (p[0] - b[0]), s3 = (a[0] - c[0]) * (p[1] - c[1]) - (a[1] - c[1]) * (p[0] - c[0]); return s1 > 0 && s2 > 0 && s3 > 0; };
    while (idx.length > 3 && guarda++ < 500) {
      let achou = false;
      for (let i = 0; i < idx.length; i++) {
        const ia = idx[(i - 1 + idx.length) % idx.length], ib = idx[i], ic = idx[(i + 1) % idx.length];
        if (!conv(P[ia], P[ib], P[ic])) continue;
        if (idx.some((j) => j !== ia && j !== ib && j !== ic && noTri(P[j], P[ia], P[ib], P[ic]))) continue;
        out.push([ia, ib, ic]); idx.splice(i, 1); achou = true; break;
      }
      if (!achou) break;
    }
    if (idx.length === 3) out.push([idx[0], idx[1], idx[2]]);
    return out;
  }
  /* raio contra os oclusores (Möller–Trumbore com caixa envolvente) */
  function bate(objs, o, d) {
    const inv = [1 / d[0], 1 / d[1], 1 / d[2]];
    for (const ob of objs) {
      let tmin = 0, tmax = 200;
      for (let k = 0; k < 3; k++) { let t1 = (ob.mn[k] - o[k]) * inv[k], t2 = (ob.mx[k] - o[k]) * inv[k]; if (t1 > t2) { const x = t1; t1 = t2; t2 = x; } tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2); if (tmin > tmax) break; }
      if (tmin > tmax) continue;
      const t = ob.t;
      for (let i = 0; i < t.length; i += 9) {
        const e1x = t[i + 3] - t[i], e1y = t[i + 4] - t[i + 1], e1z = t[i + 5] - t[i + 2], e2x = t[i + 6] - t[i], e2y = t[i + 7] - t[i + 1], e2z = t[i + 8] - t[i + 2];
        const px = d[1] * e2z - d[2] * e2y, py = d[2] * e2x - d[0] * e2z, pz = d[0] * e2y - d[1] * e2x, det = e1x * px + e1y * py + e1z * pz;
        if (det > -1e-9 && det < 1e-9) continue;
        const id = 1 / det, sx = o[0] - t[i], sy = o[1] - t[i + 1], sz = o[2] - t[i + 2], u = (sx * px + sy * py + sz * pz) * id; if (u < 0 || u > 1) continue;
        const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x, v = (d[0] * qx + d[1] * qy + d[2] * qz) * id; if (v < 0 || u + v > 1) continue;
        if ((e2x * qx + e2y * qy + e2z * qz) * id > 1e-3) return true;
      }
    }
    return false;
  }
  /* pontos de amostra de uma placa (2 × 3 sobre a superfície: pega a sombra que entra pela borda de baixo) */
  function pontosPlaca(s, h) {
    const cosI = Math.cos(rad(s.incl)), sinI = Math.sin(rad(s.incl)), pts = [];
    for (const fu of [-0.33, 0.33]) for (const fv of [-0.4, 0, 0.4]) {
      const du = fu * s.w, dvIn = fv * s.hs, x = s.c[0] + du * s.a[0] + dvIn * cosI * s.d[0], z = s.c[1] + du * s.a[1] + dvIn * cosI * s.d[1];
      pts.push([x + s.n[0] * 0.06, (h ?? s.y) - dvIn * sinI + s.n[1] * 0.06, z + s.n[2] * 0.06]);
    }
    return pts;
  }
  const CEU = (() => { const out = []; for (const e of [10, 30, 55, 80]) for (let a = 0; a < 360; a += (e > 70 ? 120 : 30)) { const E = rad(e), A = rad(a); out.push({ v: [Math.cos(E) * Math.sin(A), Math.sin(E), -Math.cos(E) * Math.cos(A)], w: Math.cos(E) * (e > 70 ? 4 : 1) }); } return out; })();

  /* ---------- análise anual de sombra (assíncrona, com progresso) ---------- */
  async function analisar(proj, lista, { progresso, kd } = {}) {
    const objs = oclusores(proj), am = amostras(proj.lat || -21.18, kd || proj.kd || KD_PADRAO, proj.H || H_PADRAO);
    const latA = Math.abs(proj.lat || 21.18), nIdeal = normalPlano(latA, 0), refl = (incl) => ALBEDO * (1 - Math.cos(rad(incl))) / 2; // chão/telhados em volta refletem um pouco
    const Eideal = am.reduce((s, x) => s + x.peso * (x.dni * Math.max(dot3(x.dir, nIdeal), 0) + x.dhi * (1 + Math.cos(rad(latA))) / 2 + x.ghi * refl(latA)), 0);
    let t0 = performance.now();
    for (let i = 0; i < lista.length; i++) {
      const s = lista[i], P = pontosPlaca(s), n = s.n, viewF = (1 + Math.cos(rad(s.incl))) / 2, gf = refl(s.incl);
      // céu visível (difusa)
      let sv = 0, sw = 0; CEU.forEach((c) => { const ci = dot3(c.v, n); if (ci <= 0) return; const w = c.w * ci; sw += w; let vis = 0; P.forEach((p) => { if (!bate(objs, p, c.v)) vis++; }); sv += w * vis / P.length; });
      const svf = sw ? sv / sw : 1;
      const sombra = new Float32Array(am.length); // fração da placa no sol em cada amostra
      let E = 0, Eref = 0;
      am.forEach((x, k) => {
        const ci = dot3(x.dir, n), beam = ci > 0 ? x.dni * ci : 0; let sol = 1;
        if (beam > 0) { let lit = 0; P.forEach((p) => { if (!bate(objs, p, x.dir)) lit++; }); sol = lit / P.length; }
        sombra[k] = sol;
        E += x.peso * (beam * sol + x.dhi * viewF * svf + x.ghi * gf); Eref += x.peso * (beam + x.dhi * viewF + x.ghi * gf);
      });
      s.analise = { sol: sombra, svf, acesso: Eref ? E / Eref : 1, tof: Eref / Eideal, tsrf: E / Eideal };
      if (performance.now() - t0 > 30) { if (progresso) progresso((i + 1) / lista.length); await new Promise((r) => setTimeout(r, 0)); t0 = performance.now(); }
    }
    if (progresso) progresso(1);
    return { amostras: am, Eideal };
  }

  /* escolhe as N vagas (as manuais primeiro), do jeito que um instalador faria:
     1) só as boas (até 6% abaixo da melhor posição do telhado todo) entram primeiro;
     2) entre as boas, enche um telhado de cada vez, começando pelo de melhor sol
        (empate: o que cabe mais placas), para sair um arranjo junto e montável;
     3) dentro do telhado, o sol em faixas de 2,5% e depois a ordem das fileiras. */
  function escolher(lista, qtd, L = {}) {
    const on = new Set(L.forcarOn || []), off = new Set(L.forcarOff || []);
    const ok = lista.filter((s) => !off.has(s.k)), fixas = ok.filter((s) => on.has(s.k)), livres = ok.filter((s) => !on.has(s.k));
    const t = (s) => (s.analise ? s.analise.tsrf : 1), faixa = (s) => Math.round(t(s) * 40);
    const melhor = livres.reduce((m, s) => Math.max(m, t(s)), 0), boa = (s) => t(s) >= melhor - 0.06;
    const nota = {};
    livres.filter(boa).forEach((s) => { (nota[s.b] = nota[s.b] || []).push(t(s)); });
    const rank = Object.keys(nota).map((b) => { const ts = nota[b].sort((x, y) => y - x), k = Math.max(1, Math.min(ts.length, qtd)); return { b, media: ts.slice(0, k).reduce((a, c) => a + c, 0) / k, cap: ts.length }; })
      .sort((x, y) => Math.round(y.media * 50) - Math.round(x.media * 50) || y.cap - x.cap);
    const pos = Object.fromEntries(rank.map((r, i) => [r.b, i])), ordem = (s) => pos[s.b] ?? 99;
    const ordemFila = (x, y) => x.linha - y.linha || x.i - y.i;
    const boas = livres.filter(boa).sort((x, y) => ordem(x) - ordem(y) || faixa(y) - faixa(x) || ordemFila(x, y));
    const fracas = livres.filter((s) => !boa(s)).sort((x, y) => faixa(y) - faixa(x) || ordem(x) - ordem(y) || x.bi - y.bi || ordemFila(x, y));
    return [...fixas, ...boas, ...fracas].slice(0, Math.max(qtd, fixas.length));
  }

  /* geração: PVGIS por água × (1 − sombra de cada placa) */
  const chaveFace = (incl, az) => `${Math.round(incl)}|${(Math.round(az / 5) * 5) % 360}`;
  function gerar(proj, escolhidas, { pvgis, hsp = 5.4, pr = 0.776 } = {}) {
    const potKw = ((proj.layout && proj.layout.modulo && proj.layout.modulo.potW) || 615) / 1000;
    const faces = (pvgis && pvgis.faces) || {};
    const mes = new Array(12).fill(0); let ano = 0, semSombra = 0;
    const porBloco = {};
    escolhidas.forEach((s) => {
      const f = faces[chaveFace(s.incl, s.az)], a = s.analise || { acesso: 1, tof: 1, tsrf: 1 };
      const ey = f ? f.ey : hsp * 360 * pr * a.tof;
      ano += potKw * ey * a.acesso; semSombra += potKw * ey;
      (f ? f.em : new Array(12).fill(ey / 12)).forEach((v, m) => { mes[m] += potKw * v * a.acesso; });
      const pb = porBloco[s.b] = porBloco[s.b] || { placas: 0, ger: 0, tsrf: 0 }; pb.placas++; pb.ger += potKw * ey * a.acesso; pb.tsrf += a.tsrf;
    });
    const kwp = escolhidas.length * potKw;
    return {
      placas: escolhidas.length, kwp, geracaoAnual: ano, geracaoMes: mes, perdaSombra: semSombra ? 1 - ano / semSombra : 0,
      tsrfMedio: escolhidas.length ? escolhidas.reduce((t, s) => t + (s.analise ? s.analise.tsrf : 1), 0) / escolhidas.length : 0,
      porBloco: Object.entries(porBloco).map(([id, v]) => { const b = (proj.blocos || []).find((x) => x.id === id) || {}; return { id, nome: b.nome, incl: b.incl, az: b.az, placas: v.placas, geracao: v.ger, tsrf: v.tsrf / v.placas }; }),
      fonte: pvgis && pvgis.db ? pvgis.db : 'estimativa pela irradiação da cidade',
      // perda equivalente para o motor de preço (que usa a irradiação da cidade × PR)
      perda: kwp ? Math.max(-0.25, Math.min(0.6, 1 - ano / (kwp * hsp * 360 * pr))) : 0,
    };
  }
  const corTsrf = (t) => (t >= 0.9 ? '#22a35a' : t >= 0.8 ? '#ffb000' : t >= 0.7 ? '#ff7a1a' : '#e5483b');

  /* mapa de sombra anual de um bloco (grade de 0,5 m) → canvas para sobrepor */
  async function mapaSombra(proj, b, { kd } = {}) {
    const objs = oclusores(proj), am = amostras(proj.lat || -21.18, kd || proj.kd || KD_PADRAO, proj.H || H_PADRAO).filter((_, i) => i % 2 === 0);
    const I = internoDe(b), xs = I.map((p) => p[0]), zs = I.map((p) => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
    const passo = 0.5, nx = Math.max(1, Math.ceil((x1 - x0) / passo)), nz = Math.max(1, Math.ceil((z1 - z0) / passo)), n = normalPlano(b.incl, b.az);
    const cv = document.createElement('canvas'); cv.width = nx * 8; cv.height = nz * 8; const g = cv.getContext('2d');
    let t0 = performance.now();
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        const p = [x0 + (i + 0.5) * passo, z0 + (j + 0.5) * passo]; if (!dentro(p, I)) continue;
        const o = [p[0] + n[0] * 0.05, alturaEm(b, p) + n[1] * 0.05, p[1] + n[2] * 0.05];
        let E = 0, R = 0; am.forEach((x) => { const ci = dot3(x.dir, n); if (ci <= 0) return; const v = x.dni * ci * x.peso; R += v; if (!bate(objs, o, x.dir)) E += v; });
        const ac = R ? E / R : 1; g.fillStyle = corTsrf(ac); g.globalAlpha = ac >= 0.9 ? 0.35 : 0.75; g.fillRect(i * 8, j * 8, 8, 8);
      }
      if (performance.now() - t0 > 30) { await new Promise((r) => setTimeout(r, 0)); t0 = performance.now(); }
    }
    return { canvas: cv, x0, z0, x1: x0 + nx * passo, z1: z0 + nz * passo };
  }

  /* ---------- cena 3D ---------- */
  function criar(container, proj, opc = {}) {
    const T = raiz.THREE;
    const cena = new T.Scene(); cena.fog = new T.Fog(0xdfe9f3, 120, 300);
    const ren = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    ren.setPixelRatio(Math.min(raiz.devicePixelRatio || 1, 2)); ren.shadowMap.enabled = true; ren.shadowMap.type = T.PCFSoftShadowMap;
    ren.outputEncoding = T.sRGBEncoding; ren.toneMapping = T.ACESFilmicToneMapping; ren.toneMappingExposure = 1.0;
    container.appendChild(ren.domElement); Object.assign(ren.domElement.style, { display: 'block', width: '100%', height: '100%', touchAction: 'none' });
    const cam = new T.PerspectiveCamera(38, 1, 0.1, 800), camTopo = new T.OrthographicCamera(-10, 10, 10, -10, 0.1, 400); camTopo.position.set(0, 150, 0.001); camTopo.lookAt(0, 0, 0);
    const ctl = new T.OrbitControls(cam, ren.domElement); ctl.enableDamping = true; ctl.maxPolarAngle = Math.PI / 2.05; ctl.minDistance = 5; ctl.maxDistance = 160;
    cena.add(new T.HemisphereLight(0xdbe8ff, 0x5d5444, 0.7));
    const luz = new T.DirectionalLight(0xfff1dc, 2.2); luz.castShadow = true; luz.shadow.mapSize.set(4096, 4096); luz.shadow.bias = -0.0003; luz.shadow.normalBias = 0.03;
    Object.assign(luz.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 220 }); cena.add(luz, luz.target);
    const solBola = new T.Mesh(new T.SphereGeometry(1.4, 16, 12), new T.MeshBasicMaterial({ color: 0xffc24a })); cena.add(solBola);
    let arco = null;
    const texCanvas = (w, h, fn, rep) => { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = 8; if (rep) t.wrapS = t.wrapT = T.RepeatWrapping; return t; };
    const tPlaca = texCanvas(256, 512, (g, w, h) => { g.fillStyle = '#c9cdd3'; g.fillRect(0, 0, w, h); g.fillStyle = '#0d1a38'; g.fillRect(6, 6, w - 12, h - 12); const cw = (w - 12) / 6, ch = (h - 12) / 22; for (let i = 0; i < 6; i++) for (let j = 0; j < 22; j++) { g.fillStyle = (i + j) % 2 ? '#162c5e' : '#13285a'; g.fillRect(6 + i * cw + 1, 6 + j * ch + 1, cw - 2, ch - 2); } g.fillStyle = '#ffffff30'; g.fillRect(6, h / 2 - 1, w - 12, 2); });
    const tOndas = texCanvas(64, 64, (g, w, h) => { for (let x = 0; x < w; x++) { const v = 150 + 55 * Math.sin(x / w * Math.PI * 4); g.fillStyle = `rgb(${v},${v + 4},${v + 10})`; g.fillRect(x, 0, 1, h); } }, true);
    const M = {
      parede: new T.MeshStandardMaterial({ color: 0xeeeae3, roughness: 0.95, side: T.DoubleSide }),
      rufo: new T.MeshStandardMaterial({ color: 0xb9c0c8, roughness: 0.5, metalness: 0.4 }),
      placa: new T.MeshStandardMaterial({ map: tPlaca, roughness: 0.22, metalness: 0.4 }),
      moldura: new T.MeshStandardMaterial({ color: 0xaab1b9, metalness: 0.7, roughness: 0.4 }),
      caixa: new T.MeshStandardMaterial({ color: 0x2f6fb0, roughness: 0.6 }), ar: new T.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.5 }), respiro: new T.MeshStandardMaterial({ color: 0x8a9098, metalness: 0.6, roughness: 0.4 }),
      tronco: new T.MeshStandardMaterial({ color: 0x5e4129, roughness: 1 }), copa: new T.MeshStandardMaterial({ color: 0x3b7a35, roughness: 1 }), predio: new T.MeshStandardMaterial({ color: 0xd9d4cc, roughness: 0.9 }),
    };
    const matPlaca = {}; const materialPlaca = (cor) => { if (!cor) return M.placa; if (!matPlaca[cor]) matPlaca[cor] = new T.MeshStandardMaterial({ map: tPlaca, color: new T.Color(cor).lerp(new T.Color(0xffffff), 0.35), roughness: 0.3, metalness: 0.3, emissive: new T.Color(cor).multiplyScalar(0.25) }); return matPlaca[cor]; };
    const sombraMat = new T.MeshStandardMaterial({ map: tPlaca, color: 0xff6a55, roughness: 0.4, emissive: 0x4a0a00 });
    let imgFundo = null, imgDrone = null; const texCache = {};
    const carregarTex = (url) => new Promise((ok) => { if (!url) return ok(null); if (texCache[url]) return ok(texCache[url]); const im = new Image(); im.onload = () => { const t = new T.Texture(im); t.encoding = T.sRGBEncoding; t.anisotropy = 8; t.needsUpdate = true; texCache[url] = t; ok(t); }; im.onerror = () => ok(null); im.src = url; });
    let grupo = null, chao = null, placasMesh = [], escolhidas = [], estado = { di: 6, hora: 9.5, cor: 'normal' }, objs = [], mapas = [];
    /* projeção de cima da foto (drone > satélite) para pintar o telhado com a telha de verdade */
    function uvDe(x, z) {
      const dr = proj.drone;
      if (dr && imgDrone) { const c = Math.cos(rad(-(dr.rot || 0))), s = Math.sin(rad(-(dr.rot || 0))), dx = x - (dr.cx || 0), dz = z - (dr.cz || 0), u = (dx * c - dz * s) / dr.escala + dr.w / 2, v = (dx * s + dz * c) / dr.escala + dr.h / 2; return [u / dr.w, 1 - v / dr.h]; }
      const L = (proj.fundo && proj.fundo.ladoM) || 60; return [x / L + 0.5, 1 - (z / L + 0.5)];
    }
    async function montarChao() {
      imgFundo = proj.fundo ? await carregarTex(proj.fundo.img || proj.fundo.mini) : null;
      imgDrone = proj.drone ? await carregarTex(proj.drone.img || proj.drone.mini) : null;
      if (chao) cena.remove(chao); chao = new T.Group(); cena.add(chao);
      const L = (proj.fundo && proj.fundo.ladoM) || 60;
      const base = new T.Mesh(new T.CircleGeometry(L * 3, 48), new T.MeshStandardMaterial({ color: 0x80965f, roughness: 1 })); base.rotation.x = -Math.PI / 2; base.position.y = -0.03; base.receiveShadow = true; chao.add(base);
      if (imgFundo) { const m = new T.Mesh(new T.PlaneGeometry(L, L), new T.MeshStandardMaterial({ map: imgFundo, roughness: 1 })); m.rotation.x = -Math.PI / 2; m.receiveShadow = true; chao.add(m); }
      if (imgDrone && proj.drone) { const dr = proj.drone, m = new T.Mesh(new T.PlaneGeometry(dr.w * dr.escala, dr.h * dr.escala), new T.MeshStandardMaterial({ map: imgDrone, roughness: 1 })); m.rotation.order = 'YXZ'; m.rotation.x = -Math.PI / 2; m.rotation.y = -rad(dr.rot || 0); m.position.set(dr.cx || 0, 0.02, dr.cz || 0); m.receiveShadow = true; chao.add(m); }
      montar();
    }
    function montar() {
      if (grupo) cena.remove(grupo); grupo = new T.Group(); cena.add(grupo); placasMesh = [];
      const texTelhado = imgDrone || imgFundo;
      (proj.blocos || []).forEach((b) => {
        if (b.pts.length < 3) return;
        const topo = topoParede(b), P = b.pts, I = internoDe(b);
        // paredes de fora
        const pw = []; P.forEach((p, i) => { const q = P[(i + 1) % P.length], hp = topo ?? alturaEm(b, p), hq = topo ?? alturaEm(b, q); pw.push(p[0], 0, p[1], q[0], 0, q[1], q[0], hq, q[1], p[0], 0, p[1], q[0], hq, q[1], p[0], hp, p[1]); });
        const gp = new T.BufferGeometry(); gp.setAttribute('position', new T.Float32BufferAttribute(pw, 3)); gp.computeVertexNormals();
        const par = new T.Mesh(gp, M.parede); par.castShadow = par.receiveShadow = true; grupo.add(par);
        // platibanda: parede de dentro + rufo no topo
        if (topo) {
          const pi = []; I.forEach((p, i) => { const q = I[(i + 1) % I.length]; pi.push(p[0], alturaEm(b, p), p[1], q[0], alturaEm(b, q), q[1], q[0], topo, q[1], p[0], alturaEm(b, p), p[1], q[0], topo, q[1], p[0], topo, p[1]); });
          const gi = new T.BufferGeometry(); gi.setAttribute('position', new T.Float32BufferAttribute(pi, 3)); gi.computeVertexNormals();
          const pin = new T.Mesh(gi, M.parede); pin.castShadow = pin.receiveShadow = true; grupo.add(pin);
          const cap = []; P.forEach((p, i) => { const q = P[(i + 1) % P.length], pi2 = I[i], qi = I[(i + 1) % I.length]; cap.push(p[0], topo, p[1], q[0], topo, q[1], qi[0], topo, qi[1], p[0], topo, p[1], qi[0], topo, qi[1], pi2[0], topo, pi2[1]); });
          const gc = new T.BufferGeometry(); gc.setAttribute('position', new T.Float32BufferAttribute(cap, 3)); gc.computeVertexNormals();
          const rufo = new T.Mesh(gc, M.rufo); rufo.material.side = T.DoubleSide; rufo.castShadow = true; grupo.add(rufo);
        }
        // telhado (com a foto projetada de cima, ou ondas da telha)
        const tri = triangular(I), pos = [], uv = [], d = desce(b.az), a = [-d[1], d[0]];
        tri.forEach((t) => t.forEach((k) => { const p = I[k]; pos.push(p[0], alturaEm(b, p) + 0.01, p[1]); if (texTelhado) uv.push(...uvDe(p[0], p[1])); else uv.push((p[0] * a[0] + p[1] * a[1]) / 0.25, (p[0] * d[0] + p[1] * d[1]) / 4); }));
        const gt = new T.BufferGeometry(); gt.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); gt.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); gt.computeVertexNormals();
        const mt = texTelhado ? new T.MeshStandardMaterial({ map: texTelhado, roughness: 0.8, side: T.DoubleSide }) : new T.MeshStandardMaterial({ map: b.telha === 'ceramico' ? null : tOndas, color: { ceramico: 0xb4532d, fibrocimento: 0xb8b5ad, metalico: 0xc4cad2, laje: 0xbdb8ad }[b.telha] || 0xc4cad2, roughness: 0.7, metalness: b.telha === 'metalico' ? 0.45 : 0, side: T.DoubleSide });
        const tm = new T.Mesh(gt, mt); tm.castShadow = tm.receiveShadow = true; grupo.add(tm);
      });
      (proj.obst || []).forEach((o) => {
        const y0 = baseObst(proj, o), Tp = OBST[o.tipo] || {}, h = o.h ?? Tp.h;
        let m;
        if (o.tipo === 'arvore') { const r = o.r ?? Tp.r, g = new T.Group(); g.position.set(o.x, y0, o.z); const tr = new T.Mesh(new T.CylinderGeometry(0.22, 0.35, h - r, 10), M.tronco); tr.position.y = (h - r) / 2; const co = new T.Mesh(new T.IcosahedronGeometry(r, 1), M.copa); co.position.y = h - r; [tr, co].forEach((x) => { x.castShadow = true; }); g.add(tr, co); m = g; }
        else if (Tp.redondo) { m = new T.Mesh(new T.CylinderGeometry(o.r ?? Tp.r, o.r ?? Tp.r, h, 24), M[o.tipo] || M.caixa); m.position.set(o.x, y0 + h / 2, o.z); m.castShadow = true; }
        else { m = new T.Mesh(new T.BoxGeometry(o.w ?? Tp.w, h, o.d ?? Tp.d), M[o.tipo] || M.predio); m.position.set(o.x, y0 + h / 2, o.z); m.rotation.y = -rad(o.rot || 0); m.castShadow = m.receiveShadow = true; }
        grupo.add(m);
      });
      escolhidas.forEach((s) => {
        const g1 = new T.Group(); g1.position.set(s.c[0], s.y + 0.02, s.c[1]); g1.rotation.y = -rad(s.az); grupo.add(g1);
        const g2 = new T.Group(); g2.rotation.x = -rad(s.incl); g1.add(g2);
        const geo = new T.BoxGeometry(s.w, 0.035, s.hs), mats = [M.moldura, M.moldura, materialPlaca(estado.cor === 'tsrf' && s.analise ? corTsrf(s.analise.tsrf) : null), M.moldura, M.moldura, M.moldura];
        const pl = new T.Mesh(geo, mats); pl.castShadow = pl.receiveShadow = true; pl.userData.s = s; g2.add(pl); placasMesh.push(pl);
      });
      mapas.forEach((mp) => grupo.add(mp));
      objs = oclusores(proj);
      enquadrar(); posicionarSol();
    }
    function enquadrar() {
      const pts = (proj.blocos || []).flatMap((b) => b.pts); const c = pts.length ? centroide(pts) : [0, 0];
      const r = pts.length ? Math.max(8, ...pts.map((p) => Math.hypot(p[0] - c[0], p[1] - c[1]))) : 12;
      ctl.target.set(c[0], 3, c[1]);
      if (!enquadrar.feito || opc.reenquadrar) { cam.position.set(c[0] + r * 1.3 + 5, r * 1.35 + 9, c[1] + r * 1.6 + 7); enquadrar.feito = true; }
      camTopo.position.set(c[0], 150, c[1] + 0.001); camTopo.lookAt(c[0], 0, c[1]); camTopo.userData.r = r + 3;
      tamanho();
    }
    function posicionarSol() {
      const D = DIAS[estado.di], s = posSol(proj.lat || -21.18, D.doy, estado.hora), c = ctl.target, R = 55;
      luz.position.set(c.x + s.dir[0] * 80, s.dir[1] * 80, c.z + s.dir[2] * 80); luz.target.position.set(c.x, 0, c.z); luz.intensity = s.alt > 0 ? 2.2 : 0;
      solBola.position.set(c.x + s.dir[0] * R, Math.max(s.dir[1] * R, -2), c.z + s.dir[2] * R); solBola.visible = s.alt > 0;
      if (arco) cena.remove(arco);
      const pts = []; for (let h = 5; h <= 19; h += 0.25) { const q = posSol(proj.lat || -21.18, D.doy, h); if (q.alt > 0) pts.push(new T.Vector3(c.x + q.dir[0] * R, q.dir[1] * R, c.z + q.dir[2] * R)); }
      arco = new T.Line(new T.BufferGeometry().setFromPoints(pts), new T.LineDashedMaterial({ color: 0xffb000, dashSize: 1.2, gapSize: 0.8 })); arco.computeLineDistances(); cena.add(arco);
      let somb = 0, pot = 0;
      placasMesh.forEach((m) => {
        const sv = m.userData.s, ci = dot3(s.dir, sv.n); let frac = 1;
        if (s.alt > 0 && ci > 0) { const P = pontosPlaca(sv); let lit = 0; P.forEach((p) => { if (!bate(objs, p, s.dir)) lit++; }); frac = lit / P.length; } else frac = 0;
        if (estado.cor === 'agora') m.material[2] = s.alt > 0 && ci > 0 && frac < 0.99 ? sombraMat : M.placa;
        if (s.alt > 0 && frac < 0.99 && ci > 0) somb++;
        pot += Math.max(ci, 0) * frac;
      });
      if (opc.aoSol) opc.aoSol({ sombreadas: somb, dia: s.alt > 0, hora: estado.hora, nomeDia: D.nome, fator: pot });
    }
    function tamanho() { const w = container.clientWidth || 600, h = container.clientHeight || 400; ren.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); const r = camTopo.userData.r || 14; camTopo.left = -r * w / h; camTopo.right = r * w / h; camTopo.top = r; camTopo.bottom = -r; camTopo.updateProjectionMatrix(); }
    const ro = new ResizeObserver(tamanho); ro.observe(container);
    let usarTopo = false, vivo = true;
    (function quadro() { if (!vivo) return; ctl.update(); ren.render(cena, usarTopo ? camTopo : cam); requestAnimationFrame(quadro); })();
    montarChao();
    return {
      async recarregarFundo() { await montarChao(); },
      atualizar(lista) { escolhidas = lista || escolhidas; montar(); },
      sol(di, hora) { estado.di = di; estado.hora = hora; posicionarSol(); },
      cor(modo) { estado.cor = modo; montar(); },
      mostrarMapas(lista) { mapas.forEach((m) => grupo && grupo.remove(m)); mapas = (lista || []).map((mp) => { const t = new T.CanvasTexture(mp.canvas); t.encoding = T.sRGBEncoding; const b = mp.bloco, I = internoDe(b), tri = triangular(I), pos = [], uv = []; tri.forEach((tt) => tt.forEach((k) => { const p = I[k]; pos.push(p[0], alturaEm(b, p) + 0.05, p[1]); uv.push((p[0] - mp.x0) / (mp.x1 - mp.x0), 1 - (p[1] - mp.z0) / (mp.z1 - mp.z0)); })); const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.computeVertexNormals(); return new T.Mesh(g, new T.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, side: T.DoubleSide })); }); montar(); },
      topo(v) { usarTopo = v; ctl.enabled = !v; },
      /* foto para a proposta: enquadramento padrão e sol de meia manhã no equinócio (sombra bonita e honesta) */
      foto(topo, w = 1200, h = 900, { padrao = true, cor = null } = {}) {
        const guarda = { pos: cam.position.clone(), alvo: ctl.target.clone(), di: estado.di, hora: estado.hora, cor: estado.cor };
        if (cor && cor !== estado.cor) { estado.cor = cor; montar(); }
        if (padrao) { const pts = (proj.blocos || []).flatMap((b) => b.pts), c = pts.length ? centroide(pts) : [0, 0], r = pts.length ? Math.max(8, ...pts.map((p) => Math.hypot(p[0] - c[0], p[1] - c[1]))) : 12; ctl.target.set(c[0], 3, c[1]); cam.position.set(c[0] + r * 1.15 + 4, r * 1.25 + 8, c[1] + r * 1.45 + 6); cam.lookAt(ctl.target); estado.di = 3; estado.hora = 10; posicionarSol(); }
        ren.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); const r = camTopo.userData.r || 14; camTopo.left = -r * w / h; camTopo.right = r * w / h; camTopo.top = r; camTopo.bottom = -r; camTopo.updateProjectionMatrix();
        solBola.visible = false; if (arco) arco.visible = false; mapas.forEach((m) => { m.visible = false; }); // a foto da proposta sai limpa, sem o mapa de sombra
        ren.render(cena, topo ? camTopo : cam); const url = ren.domElement.toDataURL('image/jpeg', 0.8); if (arco) arco.visible = true; mapas.forEach((m) => { m.visible = true; });
        cam.position.copy(guarda.pos); ctl.target.copy(guarda.alvo); estado.di = guarda.di; estado.hora = guarda.hora;
        if (estado.cor !== guarda.cor) { estado.cor = guarda.cor; montar(); } else posicionarSol();
        tamanho(); return url;
      },
      destruir() { vivo = false; ro.disconnect(); ren.dispose(); container.innerHTML = ''; },
    };
  }

  raiz.Usina3D = { carregarThree, fotoSatelite, reduzir, lerMetadados, colocarDrone, resolucao, paraMetros, paraLatLng, medidasModulo, centroide, dentro, areaPol, recuar, retangulo3, desce, alturaEm, topoTelhado, topoParede, normalPlano, novoId, blocosDoGoogle, migrar, OBST, baseObst, pegadaObst, vagas, DIAS, KD_PADRAO, H_PADRAO, posSol, amostras, oclusores, bate, pontosPlaca, analisar, escolher, gerar, chaveFace, corTsrf, mapaSombra, criar };
})(window);
