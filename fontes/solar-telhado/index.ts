// Edge Function sol-telhado: acha o imóvel pelo endereço, traz as águas do telhado (Google Solar API)
// e serve a foto de satélite (Google Map Tiles) sem expor a chave no navegador.
// Só para usuários do Chama Solar (eh_solar). A chave fica no cofre (sol_cred_googlemaps).
const SB = Deno.env.get("SUPABASE_URL")!;
const SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
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
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    if (!(await autorizado(req))) return json({ erro: "Entre com o login do Chamae." }, 401);
    const k = await lerChave(); if (!k) return json({ erro: "Guarde a chave do Google Maps em Parâmetros → Acessos." }, 400);
    const u = new URL(req.url);
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
    const corpo = await req.json().catch(() => ({}));
    let lat = Number(corpo.lat), lng = Number(corpo.lng), endereco = "", precisao = "ponto";
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      const g = await (await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(String(corpo.endereco || ""))}&region=br&language=pt-BR&key=${k}`)).json();
      if (g.status !== "OK") return json({ erro: "Não achei o endereço (" + g.status + "). Confira rua, número e cidade." }, 404);
      const r0 = g.results[0]; lat = r0.geometry.location.lat; lng = r0.geometry.location.lng; endereco = r0.formatted_address; precisao = r0.geometry.location_type;
    }
    const s = await fetch(`https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${lat}&location.longitude=${lng}&requiredQuality=BASE&key=${k}`);
    const b = await s.json();
    if (!s.ok) return json({ lat, lng, endereco, precisao, aguas: [], aviso: "O Google não tem o telhado deste ponto: desenhe as águas na foto." });
    const sp = b.solarPotential || {};
    return json({
      lat, lng, endereco, precisao, qualidade: b.imageryQuality, data: b.imageryDate, centro: b.center, caixa: b.boundingBox,
      placaGoogle: { alturaM: sp.panelHeightMeters, larguraM: sp.panelWidthMeters, w: sp.panelCapacityWatts },
      aguas: (sp.roofSegmentStats || []).map((x: any, i: number) => ({ i, incl: x.pitchDegrees || 0, az: x.azimuthDegrees || 0, areaM2: (x.stats || {}).areaMeters2 || 0, areaChaoM2: (x.stats || {}).groundAreaMeters2 || 0, centro: x.center, caixa: x.boundingBox, alturaM: x.planeHeightAtCenterMeters })),
      placas: (sp.solarPanels || []).slice(0, 400).map((p: any) => ({ c: p.center, o: p.orientation, s: p.segmentIndex })),
    });
  } catch (e) { return json({ erro: String((e as Error).message || e).slice(0, 200) }, 500); }
});
