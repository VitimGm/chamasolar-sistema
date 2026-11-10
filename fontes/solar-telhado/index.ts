// Edge Function sol-telhado: acha o imóvel pelo endereço, traz as águas do telhado (Google Solar API),
// serve a foto de satélite (Google Map Tiles) sem expor a chave no navegador e busca a irradiação
// do local no PVGIS (Comissão Europeia, base SARAH-3), que não aceita chamada direta do navegador.
// Só para usuários do Chama Solar (eh_solar). A chave do Google fica no cofre (sol_cred_googlemaps).
const SB = Deno.env.get("SUPABASE_URL")!;
const SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Expose-Headers": "x-cache-status" };
const json = (d: unknown, s = 200, extra: Record<string, string> = {}) => new Response(JSON.stringify(d), { status: s, headers: { ...CORS, "Content-Type": "application/json", ...extra } });
/* ---------- cache das chamadas pagas (Google) e lentas (PVGIS) ----------
   Chave versionada ("solar:building:v1:lat,lng") + validade (TTL). A 2ª chamada igual sai do banco: custo zero
   e na hora. A resposta diz se veio do cache: cabeçalho x-cache-status = MISS (foi buscar) ou HIT (estava guardada). */
const TTL = { geo: 180 * 864e2, building: 90 * 864e2, pvgis: 365 * 864e2 }; // segundos
const sr = { apikey: SR, Authorization: `Bearer ${SR}` };
async function cacheLer(chave: string) {
  try {
    const r = await fetch(`${SB}/rest/v1/sol_api_cache?chave=eq.${encodeURIComponent(chave)}&expira=gt.${encodeURIComponent(new Date().toISOString())}&select=valor`, { headers: sr });
    if (!r.ok) return null; const l = await r.json(); if (!Array.isArray(l) || !l.length) return null;
    fetch(`${SB}/rest/v1/rpc/sol_api_cache_acerto`, { method: "POST", headers: { ...sr, "Content-Type": "application/json" }, body: JSON.stringify({ p_chave: chave }) }).catch(() => {});
    return l[0].valor;
  } catch { return null; }
}
async function cacheGravar(chave: string, valor: unknown, ttlSeg: number) {
  try { await fetch(`${SB}/rest/v1/sol_api_cache?on_conflict=chave`, { method: "POST", headers: { ...sr, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ chave, valor, criado: new Date().toISOString(), expira: new Date(Date.now() + ttlSeg * 1000).toISOString(), acertos: 0 }) }); } catch { /* sem cache: segue */ }
}
const normEnd = (t: string) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
let chave = "", sessao = "", sessaoAte = 0;
async function lerChave() {
  if (chave) return chave;
  const r = await fetch(`${SB}/rest/v1/rpc/sol_ler_credencial`, { method: "POST", headers: { apikey: SR, Authorization: `Bearer ${SR}`, "Content-Type": "application/json" }, body: JSON.stringify({ p_marca: "Google Maps" }) });
  const c = await r.json(); chave = (c && (c.chave || c.token)) || ""; return chave;
}
async function autorizado(req: Request) {
  const tok = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!tok) return false;
  const r = await fetch(`${SB}/rest/v1/rpc/eh_solar`, { method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${tok}`, "Content-Type": "application/json" }, body: "{}" });
  return r.ok && (await r.json()) === true;
}
async function novaSessao(k: string) {
  if (sessao && Date.now() < sessaoAte) return sessao;
  const r = await fetch(`https://tile.googleapis.com/v1/createSession?key=${k}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mapType: "satellite", language: "pt-BR", region: "BR", scale: "scaleFactor2x", highDpi: true }) });
  const j = await r.json(); if (!r.ok) throw new Error("tiles: " + JSON.stringify(j).slice(0, 160));
  sessao = j.session; sessaoAte = Math.min(Number(j.expiry) * 1000, Date.now() + 6 * 3600e3); return sessao;
}
/* ---------- PVGIS: geração por kWp de cada água (inclinação + direção) e fração difusa do mês ---------- */
const PV = "https://re.jrc.ec.europa.eu/api/v5_3";
const cachePv = new Map<string, any>();
let contaHit = 0, contaMiss = 0; // da chamada atual (PVGIS)
async function pvFace(lat: number, lng: number, chave: string) {
  const [i, a] = chave.split("|").map(Number);
  const ang = Math.max(0, Math.min(90, Math.round(i))), asp = ((Math.round(a) - 180 + 540) % 360) - 180; // PVGIS: 0 = sul, 90 = oeste, -90 = leste, ±180 = norte
  const ck = `${lat.toFixed(3)},${lng.toFixed(3)},${ang},${asp}`;
  if (cachePv.has(ck)) return cachePv.get(ck);
  const guardado = await cacheLer("pvgis:face:v1:" + ck); if (guardado) { cachePv.set(ck, guardado); contaHit++; return guardado; }
  contaMiss++;
  const r = await fetch(`${PV}/PVcalc?lat=${lat}&lon=${lng}&peakpower=1&loss=14&angle=${ang}&aspect=${asp}&mountingplace=building&outputformat=json`, { signal: AbortSignal.timeout(25000) });
  const t = await r.text(); if (!r.ok) throw new Error("PVGIS " + r.status + ": " + t.slice(0, 120));
  const j = JSON.parse(t), v = { ey: j.outputs.totals.fixed.E_y, em: j.outputs.monthly.fixed.map((m: any) => m.E_m), db: j.inputs.meteo_data.radiation_db };
  cachePv.set(ck, v); await cacheGravar("pvgis:face:v1:" + ck, v, TTL.pvgis); return v;
}
// clima do mês no local: fração difusa (Kd) e sol no plano horizontal por dia (kWh/m²)
async function pvClima(lat: number, lng: number) {
  const ck = `cl${lat.toFixed(2)},${lng.toFixed(2)}`;
  if (cachePv.has(ck)) return cachePv.get(ck);
  const guardado = await cacheLer("pvgis:clima:v1:" + ck); if (guardado) { cachePv.set(ck, guardado); return guardado; }
  const r = await fetch(`${PV}/MRcalc?lat=${lat}&lon=${lng}&horirrad=1&d2g=1&startyear=2015&endyear=2020&outputformat=json`, { signal: AbortSignal.timeout(25000) });
  if (!r.ok) return null;
  const j = await r.json(), kd: number[][] = Array.from({ length: 12 }, () => []), H: number[][] = Array.from({ length: 12 }, () => []);
  const dias = [31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31], med = (l: number[], p: number) => (l.length ? Math.round((l.reduce((a, b) => a + b, 0) / l.length) * 1000) / 1000 : p);
  (j.outputs.monthly || []).forEach((x: any) => { if (Number.isFinite(x.Kd)) kd[x.month - 1].push(x.Kd); if (Number.isFinite(x["H(h)_m"])) H[x.month - 1].push(x["H(h)_m"] / dias[x.month - 1]); });
  const v = { kd: kd.map((l) => med(l, 0.35)), H: H.map((l) => med(l, 5)) };
  cachePv.set(ck, v); await cacheGravar("pvgis:clima:v1:" + ck, v, TTL.pvgis); return v;
}
async function pvgis(lat: number, lng: number, faces: string[]) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 60) throw new Error("local inválido");
  const lista = [...new Set((faces || []).map(String).filter((f) => /^\d{1,2}\|\d{1,3}$/.test(f)))].slice(0, 12);
  const out: Record<string, unknown> = {}; let db = "";
  for (const f of lista) { const v = await pvFace(lat, lng, f); out[f] = { ey: v.ey, em: v.em }; db = v.db; } // em série: o PVGIS limita 30 por segundo
  const cl = await pvClima(lat, lng).catch(() => null);
  return { db: db || "PVGIS-SARAH3", faces: out, kd: cl ? cl.kd : null, H: cl ? cl.H : null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    if (!(await autorizado(req))) return json({ erro: "Entre com o login do Chamae." }, 401);
    const u = new URL(req.url);
    const corpo = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    if (corpo.acao === "pvgis") { contaHit = 0; contaMiss = 0; const out = await pvgis(Number(corpo.lat), Number(corpo.lng), corpo.faces); const st = contaMiss ? (contaHit ? "PARCIAL" : "MISS") : "HIT"; return json({ ...out, cache: st }, 200, { "x-cache-status": st }); }
    const k = await lerChave(); if (!k) return json({ erro: "Guarde a chave do Google Maps em Parâmetros → Acessos." }, 400);
    const tile = u.searchParams.get("tile");
    if (tile) { // z/x/y
      const [z, x, y] = tile.split("/").map(Number);
      if (![z, x, y].every(Number.isFinite) || z < 15 || z > 21) return json({ erro: "tile inválido" }, 400);
      const s = await novaSessao(k);
      const r = await fetch(`https://tile.googleapis.com/v1/2dtiles/${z}/${x}/${y}?session=${s}&key=${k}`);
      if (!r.ok) { sessao = ""; return json({ erro: "tile " + r.status }, 502); }
      return new Response(r.body, { headers: { ...CORS, "Content-Type": r.headers.get("content-type") || "image/jpeg", "Cache-Control": "private, max-age=86400" } });
    }
    if (u.searchParams.get("atribuicao")) { const s = await novaSessao(k); const r = await fetch(`https://tile.googleapis.com/tile/v1/viewport?session=${s}&key=${k}&zoom=20&north=${u.searchParams.get("n")}&south=${u.searchParams.get("s")}&east=${u.searchParams.get("e")}&west=${u.searchParams.get("w")}`); return json(await r.json()); }
    let lat = Number(corpo.lat), lng = Number(corpo.lng), endereco = "", precisao = "ponto", hits = 0, misses = 0;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      const chG = "geo:v1:" + normEnd(String(corpo.endereco || "")).slice(0, 200);
      let geo = await cacheLer(chG);
      if (geo) hits++;
      else {
        misses++;
        const g = await (await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(String(corpo.endereco || ""))}&region=br&language=pt-BR&key=${k}`)).json();
        if (g.status !== "OK") return json({ erro: "Não achei o endereço (" + g.status + "). Confira rua, número e cidade." }, 404);
        const r0 = g.results[0]; geo = { lat: r0.geometry.location.lat, lng: r0.geometry.location.lng, endereco: r0.formatted_address, precisao: r0.geometry.location_type };
        await cacheGravar(chG, geo, TTL.geo);
      }
      lat = geo.lat; lng = geo.lng; endereco = geo.endereco; precisao = geo.precisao;
    }
    const chB = `solar:building:v1:${lat.toFixed(5)},${lng.toFixed(5)}`;
    let telhado = await cacheLer(chB);
    if (telhado) hits++;
    else {
      misses++;
      const s = await fetch(`https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${lat}&location.longitude=${lng}&requiredQuality=BASE&key=${k}`);
      const b = await s.json();
      if (!s.ok) { const st0 = hits ? "PARCIAL" : "MISS"; return json({ lat, lng, endereco, precisao, aguas: [], aviso: "O Google não tem o telhado deste ponto: desenhe as águas na foto.", cache: st0 }, 200, { "x-cache-status": st0 }); }
      const sp = b.solarPotential || {};
      telhado = {
        qualidade: b.imageryQuality, data: b.imageryDate, centro: b.center, caixa: b.boundingBox,
        placaGoogle: { alturaM: sp.panelHeightMeters, larguraM: sp.panelWidthMeters, w: sp.panelCapacityWatts },
        aguas: (sp.roofSegmentStats || []).map((x: any, i: number) => ({ i, incl: x.pitchDegrees || 0, az: x.azimuthDegrees || 0, areaM2: (x.stats || {}).areaMeters2 || 0, areaChaoM2: (x.stats || {}).groundAreaMeters2 || 0, centro: x.center, caixa: x.boundingBox, alturaM: x.planeHeightAtCenterMeters })),
        placas: (sp.solarPanels || []).slice(0, 400).map((p: any) => ({ c: p.center, o: p.orientation, s: p.segmentIndex })),
      };
      await cacheGravar(chB, telhado, TTL.building);
    }
    const st = misses ? (hits ? "PARCIAL" : "MISS") : "HIT";
    return json({ lat, lng, endereco, precisao, ...telhado, cache: st }, 200, { "x-cache-status": st });
  } catch (e) { return json({ erro: String((e as Error).message || e).slice(0, 200) }, 500); }
});
