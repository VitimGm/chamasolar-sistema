// =====================================================================
// Telhados a partir do relevo (DSM) do Google Solar — roda no servidor (Deno)
// e nos testes (Node). Tudo em uma grade local "norte para cima":
//   célula (i, j) → x = -L/2 + (i + 0,5)·r (leste), z = -L/2 + (j + 0,5)·r (sul)
//   H = altura (m) e M = máscara de edificação (1 = construção), n × n células.
// Passos: suaviza, acha regiões lisas (sem degrau e com a mesma direção de
// caimento), separa as muretas (platibandas), ajusta um plano em cada telhado
// e devolve o contorno em retas (ângulos de 90°), a inclinação, o caimento,
// a altura do beiral e a da platibanda.
// =====================================================================

const DEG = 180 / Math.PI;

function mediana3(H, M, n) { // filtro de mediana 3×3 só dentro da máscara
  const out = new Float32Array(H), v = new Float32Array(9);
  for (let j = 1; j < n - 1; j++) for (let i = 1; i < n - 1; i++) {
    const p = j * n + i; if (!M[p]) continue;
    let k = 0; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const q = p + dj * n + di; if (M[q]) v[k++] = H[q]; }
    if (k >= 5) { const s = Array.from(v.subarray(0, k)).sort((a, b) => a - b); out[p] = s[k >> 1]; }
  }
  return out;
}
function media3(H, M, n) {
  const out = new Float32Array(H);
  for (let j = 1; j < n - 1; j++) for (let i = 1; i < n - 1; i++) {
    const p = j * n + i; if (!M[p]) continue;
    let s = 0, k = 0; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const q = p + dj * n + di; if (M[q] && Math.abs(H[q] - H[p]) < 0.3) { s += H[q]; k++; } }
    out[p] = s / k;
  }
  return out;
}
export function percentil(lista, f) { if (!lista.length) return 0; const s = Float64Array.from(lista).sort(); return s[Math.min(s.length - 1, Math.max(0, Math.floor(f * (s.length - 1))))]; }

/* plano H = a·x + b·z + c por mínimos quadrados, com 2 rodadas tirando os pontos fora */
export function ajustarPlano(xs, zs, hs) {
  let usa = xs.map(() => true), pl = null;
  for (let it = 0; it < 3; it++) {
    let Sxx = 0, Sxz = 0, Szz = 0, Sx = 0, Sz = 0, Sh = 0, Sxh = 0, Szh = 0, N = 0;
    for (let k = 0; k < xs.length; k++) if (usa[k]) { const x = xs[k], z = zs[k], h = hs[k]; Sxx += x * x; Sxz += x * z; Szz += z * z; Sx += x; Sz += z; Sh += h; Sxh += x * h; Szh += z * h; N++; }
    if (N < 6) break;
    // resolve [Sxx Sxz Sx; Sxz Szz Sz; Sx Sz N] [a b c] = [Sxh Szh Sh]
    const A = [[Sxx, Sxz, Sx, Sxh], [Sxz, Szz, Sz, Szh], [Sx, Sz, N, Sh]];
    for (let c = 0; c < 3; c++) { let m = c; for (let r = c + 1; r < 3; r++) if (Math.abs(A[r][c]) > Math.abs(A[m][c])) m = r; [A[c], A[m]] = [A[m], A[c]]; if (Math.abs(A[c][c]) < 1e-9) return pl; for (let r = 0; r < 3; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let k = c; k < 4; k++) A[r][k] -= f * A[c][k]; } }
    const a = A[0][3] / A[0][0], b = A[1][3] / A[1][1], c0 = A[2][3] / A[2][2];
    let s2 = 0; for (let k = 0; k < xs.length; k++) if (usa[k]) { const e = hs[k] - (a * xs[k] + b * zs[k] + c0); s2 += e * e; }
    const sd = Math.sqrt(s2 / N); pl = { a, b, c: c0, sd, n: N };
    for (let k = 0; k < xs.length; k++) usa[k] = Math.abs(hs[k] - (a * xs[k] + b * zs[k] + c0)) <= Math.max(2.5 * sd, 0.08);
  }
  return pl;
}
/* inclinação (graus) e caimento (para onde a água escorre, graus a partir do norte, horário) de um plano */
export function inclAz(pl) {
  const g = Math.hypot(pl.a, pl.b), incl = Math.atan(g) * DEG;
  // descer = -gradiente; em (leste, sul) = (-a, -b); norte = -sul → az = atan2(leste, norte) = atan2(-a, b)
  const az = ((Math.atan2(-pl.a, pl.b) * DEG) + 360) % 360;
  return { incl, az };
}

/* ---------- contorno de uma região (grade) em polígono reto ---------- */
function contorno(R, n) { // bordas entre células dentro/fora, encadeadas; devolve o laço mais comprido (cantos da grade)
  const ar = new Map(), add = (x0, y0, x1, y1) => { const k = x0 + ',' + y0; (ar.get(k) || ar.set(k, []).get(k)).push([x1, y1]); };
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    if (!R[j * n + i]) continue;
    if (j === 0 || !R[(j - 1) * n + i]) add(i, j, i + 1, j);          // em cima (sentido horário com y para baixo)
    if (i === n - 1 || !R[j * n + i + 1]) add(i + 1, j, i + 1, j + 1); // direita
    if (j === n - 1 || !R[(j + 1) * n + i]) add(i + 1, j + 1, i, j + 1); // embaixo
    if (i === 0 || !R[j * n + i - 1]) add(i, j + 1, i, j);            // esquerda
  }
  let melhor = [];
  while (ar.size) {
    const [k0] = ar.keys(); let [x, y] = k0.split(',').map(Number); const laco = [[x, y]];
    for (let g = 0; g < 200000; g++) {
      const k = x + ',' + y, l = ar.get(k); if (!l || !l.length) { ar.delete(k); break; }
      const [nx, ny] = l.pop(); if (!l.length) ar.delete(k);
      x = nx; y = ny; if (x + ',' + y === k0) break; laco.push([x, y]);
    }
    if (laco.length > melhor.length) melhor = laco;
  }
  return melhor;
}
function douglas(pts, eps) {
  if (pts.length < 4) return pts;
  // fechado: começa pelo par mais distante
  let ia = 0, ib = 0, dm = -1; for (let k = 0; k < pts.length; k++) { const d = Math.hypot(pts[k][0] - pts[0][0], pts[k][1] - pts[0][1]); if (d > dm) { dm = d; ib = k; } }
  const dp = (a, b) => { // pontos de a até b (índices circulares), simplificados
    const seg = []; for (let k = a; ; k = (k + 1) % pts.length) { seg.push(pts[k]); if (k === b) break; }
    const rec = (s, e) => { const A = seg[s], B = seg[e]; let mx = -1, mi = -1; const L = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1e-9;
      for (let k = s + 1; k < e; k++) { const d = Math.abs((B[0] - A[0]) * (A[1] - seg[k][1]) - (A[0] - seg[k][0]) * (B[1] - A[1])) / L; if (d > mx) { mx = d; mi = k; } }
      return mx > eps ? [...rec(s, mi).slice(0, -1), ...rec(mi, e)] : [A, B]; };
    return rec(0, seg.length - 1);
  };
  const p1 = dp(ia, ib), p2 = dp(ib, ia);
  return [...p1.slice(0, -1), ...p2.slice(0, -1)];
}
function ortogonalizar(pts, tolGraus = 20) {
  if (pts.length < 4) return pts;
  const ed = pts.map((p, k) => { const q = pts[(k + 1) % pts.length]; return { p, q, L: Math.hypot(q[0] - p[0], q[1] - p[1]), t: Math.atan2(q[1] - p[1], q[0] - p[0]) }; });
  let C = 0, S = 0; ed.forEach((e) => { C += e.L * Math.cos(4 * e.t); S += e.L * Math.sin(4 * e.t); });
  const dom = Math.atan2(S, C) / 4;
  const dirs = ed.map((e) => { let best = e.t, dif = 1e9; for (let k = -4; k <= 4; k++) { const a = dom + k * Math.PI / 2, d = Math.abs(Math.atan2(Math.sin(e.t - a), Math.cos(e.t - a))); if (d < dif) { dif = d; best = a; } } return dif < tolGraus / DEG ? best : e.t; });
  // retas pelo meio de cada aresta com a direção nova; junta as paralelas seguidas
  let linhas = ed.map((e, k) => ({ m: [(e.p[0] + e.q[0]) / 2, (e.p[1] + e.q[1]) / 2], u: [Math.cos(dirs[k]), Math.sin(dirs[k])], L: e.L }));
  const fundir = () => { const out = []; for (const l of linhas) { const u = out[out.length - 1]; if (u && Math.abs(u.u[0] * l.u[1] - u.u[1] * l.u[0]) < 0.05 && u.u[0] * l.u[0] + u.u[1] * l.u[1] > 0) { const w = u.L + l.L; u.m = [(u.m[0] * u.L + l.m[0] * l.L) / w, (u.m[1] * u.L + l.m[1] * l.L) / w]; u.L = w; } else out.push({ ...l }); }
    if (out.length > 2) { const a = out[0], b = out[out.length - 1]; if (Math.abs(a.u[0] * b.u[1] - a.u[1] * b.u[0]) < 0.05 && a.u[0] * b.u[0] + a.u[1] * b.u[1] > 0) { const w = a.L + b.L; a.m = [(a.m[0] * a.L + b.m[0] * b.L) / w, (a.m[1] * a.L + b.m[1] * b.L) / w]; a.L = w; out.pop(); } } return out; };
  linhas = fundir();
  const cruz = (l1, l2) => { const d = l1.u[0] * l2.u[1] - l1.u[1] * l2.u[0]; if (Math.abs(d) < 1e-6) return null; const t = ((l2.m[0] - l1.m[0]) * l2.u[1] - (l2.m[1] - l1.m[1]) * l2.u[0]) / d; return [l1.m[0] + t * l1.u[0], l1.m[1] + t * l1.u[1]]; };
  const out = []; for (let k = 0; k < linhas.length; k++) { const v = cruz(linhas[(k - 1 + linhas.length) % linhas.length], linhas[k]); if (v) out.push(v); }
  return out.length >= 3 ? out : pts;
}
const areaPol = (P) => Math.abs(P.reduce((s, p, i) => { const q = P[(i + 1) % P.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2);
const dentro = (p, pol) => { let d = false; for (let i = 0, j = pol.length - 1; i < pol.length; j = i++) { const a = pol[i], b = pol[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) d = !d; } return d; };

/* ---------- regiões lisas → telhados ---------- */
export function telhadosDoRelevo(Hbruto, M, n, r, { degrau = 0.22, difGrad = 0.2, areaMin = 3 } = {}) {
  const L = n * r, X = (i) => -L / 2 + (i + 0.5) * r, Z = (j) => -L / 2 + (j + 0.5) * r;
  let H = mediana3(Hbruto, M, n); H = mediana3(H, M, n); H = media3(H, M, n);
  const gx = new Float32Array(n * n), gz = new Float32Array(n * n);
  for (let j = 1; j < n - 1; j++) for (let i = 1; i < n - 1; i++) {
    const p = j * n + i; if (!M[p]) continue;
    const h = (di, dj) => { const q = p + dj * n + di; return M[q] && Math.abs(H[q] - H[p]) < degrau * 1.5 ? H[q] : H[p]; };
    gx[p] = ((h(1, -1) + 2 * h(1, 0) + h(1, 1)) - (h(-1, -1) + 2 * h(-1, 0) + h(-1, 1))) / (8 * r);
    gz[p] = ((h(-1, 1) + 2 * h(0, 1) + h(1, 1)) - (h(-1, -1) + 2 * h(0, -1) + h(1, -1))) / (8 * r);
  }
  // crescimento de regiões: sem degrau entre vizinhos e com o gradiente parecido com o da região
  const lab = new Int32Array(n * n).fill(-1), regs = [];
  const fila = new Int32Array(n * n);
  for (let p0 = 0; p0 < n * n; p0++) {
    if (!M[p0] || lab[p0] >= 0) continue;
    const id = regs.length, R = { id, n: 0, sgx: 0, sgz: 0, px: [] }; regs.push(R);
    let ini = 0, fim = 0; fila[fim++] = p0; lab[p0] = id;
    while (ini < fim) {
      const p = fila[ini++], i = p % n, j = (p / n) | 0; R.n++; R.sgx += gx[p]; R.sgz += gz[p]; R.px.push(p);
      const mgx = R.sgx / R.n, mgz = R.sgz / R.n;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= n || jj >= n) continue;
        const q = jj * n + ii; if (!M[q] || lab[q] >= 0) continue;
        if (Math.abs(H[q] - H[p]) > degrau) continue;
        if (R.n > 25 && Math.hypot(gx[q] - mgx, gz[q] - mgz) > difGrad) continue;
        lab[q] = id; fila[fim++] = q;
      }
    }
  }
  // espessura de cada região (distância ao fundo): muretas são finas
  const borda = new Float32Array(n * n).fill(1e9);
  const q2 = []; for (let p = 0; p < n * n; p++) if (lab[p] >= 0) { const i = p % n, j = (p / n) | 0; if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([di, dj]) => { const ii = i + di, jj = j + dj; return ii < 0 || jj < 0 || ii >= n || jj >= n || lab[jj * n + ii] !== lab[p]; })) { borda[p] = 0; q2.push(p); } }
  for (let k = 0; k < q2.length; k++) { const p = q2[k], i = p % n, j = (p / n) | 0; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= n || jj >= n) continue; const q = jj * n + ii; if (lab[q] === lab[p] && borda[q] > borda[p] + 1) { borda[q] = borda[p] + 1; q2.push(q); } } }
  regs.forEach((R) => { R.esp = Math.max(...R.px.map((p) => borda[p])) * r * 2; R.area = R.n * r * r; R.h = percentil(R.px.map((p) => H[p]), 0.5); });
  const muretas = new Set(regs.filter((R) => R.esp < 1.0 && R.area >= 0.3).map((R) => R.id));
  const telh = regs.filter((R) => !muretas.has(R.id) && R.area >= areaMin);
  const out = [];
  for (const R of telh) {
    // mureta encostada (mais alta que o telhado): entra no contorno e dá a altura da platibanda
    const meu = new Uint8Array(n * n); R.px.forEach((p) => { meu[p] = 1; });
    const anel = [];
    for (const p of R.px) { const i = p % n, j = (p / n) | 0; for (let dj = -3; dj <= 3; dj++) for (let di = -3; di <= 3; di++) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= n || jj >= n) continue; const q = jj * n + ii; if (!meu[q] && lab[q] >= 0 && muretas.has(lab[q]) && H[q] > R.h + 0.1) { meu[q] = 2; anel.push(q); } } }
    const xs = R.px.map((p) => X(p % n)), zs = R.px.map((p) => Z((p / n) | 0)), hs = R.px.map((p) => Hbruto[p]);
    const pl = ajustarPlano(xs, zs, hs); if (!pl) continue;
    const { incl, az } = inclAz(pl);
    const cont = contorno(meu, n).map(([i, j]) => [-L / 2 + i * r, -L / 2 + j * r]);
    let pts = ortogonalizar(douglas(cont, Math.max(0.3, r * 1.5)));
    if (pts.length < 3 || areaPol(pts) < areaMin * 0.7) continue;
    const hAt = (p) => pl.a * p[0] + pl.b * p[1] + pl.c;
    const beiral = Math.min(...pts.map(hAt)), topo = Math.max(...pts.map(hAt));
    const plat = anel.length >= 8 ? Math.max(0, percentil(anel.map((q) => H[q]), 0.6) - beiral) : 0;
    out.push({ pts: pts.map((p) => [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100]), area: Math.round(areaPol(pts) * 10) / 10, incl: Math.round(incl * 2) / 2, az: Math.round(az / 5) * 5 % 360, beiral: Math.round(beiral * 100) / 100, topo: Math.round(topo * 100) / 100, platibanda: Math.round(Math.min(plat, 2.5) * 100) / 100, residuo: Math.round(pl.sd * 100) / 100, pontos: R.n });
  }
  return out.sort((a, b) => b.area - a.area);
}

/* plano de um polígono desenhado pelo vendedor (para medir altura e caimento pelo relevo) */
export function medirPoligono(H, M, n, r, pts, recuo = 0.4) {
  const L = n * r, xs = [], zs = [], hs = [], fora = [];
  const xMin = Math.min(...pts.map((p) => p[0])), xMax = Math.max(...pts.map((p) => p[0])), zMin = Math.min(...pts.map((p) => p[1])), zMax = Math.max(...pts.map((p) => p[1]));
  const i0 = Math.max(0, Math.floor((xMin + L / 2) / r) - 4), i1 = Math.min(n - 1, Math.ceil((xMax + L / 2) / r) + 4), j0 = Math.max(0, Math.floor((zMin + L / 2) / r) - 4), j1 = Math.min(n - 1, Math.ceil((zMax + L / 2) / r) + 4);
  const distBorda = (p) => { let d = 1e9; for (let k = 0; k < pts.length; k++) { const a = pts[k], b = pts[(k + 1) % pts.length], vx = b[0] - a[0], vz = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vz) / (vx * vx + vz * vz || 1))); d = Math.min(d, Math.hypot(p[0] - a[0] - t * vx, p[1] - a[1] - t * vz)); } return d; };
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const p = [-L / 2 + (i + 0.5) * r, -L / 2 + (j + 0.5) * r], k = j * n + i; if (!Number.isFinite(H[k])) continue;
    const den = dentro(p, pts), d = distBorda(p);
    if (den && d >= recuo) { xs.push(p[0]); zs.push(p[1]); hs.push(H[k]); }
    else if (d < 0.45) fora.push(H[k]); // faixa da borda: mureta, se houver
  }
  if (xs.length < 12) return null;
  const pl = ajustarPlano(xs, zs, hs); if (!pl) return null;
  const { incl, az } = inclAz(pl), hAt = (p) => pl.a * p[0] + pl.b * p[1] + pl.c;
  const beiral = Math.min(...pts.map(hAt)), bordaAlta = percentil(fora, 0.75);
  return { incl: Math.round(incl * 2) / 2, az: Math.round(az / 5) * 5 % 360, beiral: Math.round(beiral * 100) / 100, platibanda: Math.round(Math.max(0, Math.min(2.5, bordaAlta - beiral - 0.05)) * 100) / 100, residuo: Math.round(pl.sd * 100) / 100, pontos: xs.length };
}
