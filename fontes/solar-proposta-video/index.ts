// Edge Function sol-proposta-video: o cliente (sem login) abre a proposta pelo link com token e pede o vídeo
// de apresentação. O vídeo fica no Storage PRIVADO (sol-arquivos); aqui sai só um link temporário (2 h)
// e só para a proposta daquele token. Nada fica público.
const SB = Deno.env.get("SUPABASE_URL")!;
const SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const sr = { apikey: SR, Authorization: `Bearer ${SR}` };
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { token } = await req.json().catch(() => ({}));
    if (!/^[A-Za-z0-9_-]{6,80}$/.test(String(token || ""))) return json({ erro: "link inválido" }, 400);
    const r = await fetch(`${SB}/rest/v1/sol_orcamentos?token_publico=eq.${encodeURIComponent(token)}&select=status,video:dados->videoApresentacao,apagado:dados->>apagado&limit=1`, { headers: sr });
    const l = await r.json(); const v = Array.isArray(l) && l[0] ? l[0] : null;
    if (!v || v.apagado === "true" || !v.video || !v.video.caminho) return json({ erro: "sem vídeo" }, 404);
    const caminho = String(v.video.caminho);
    if (caminho.includes("..") || !/\/V[ií]deo/i.test(caminho.normalize("NFC"))) return json({ erro: "sem vídeo" }, 404);
    const s = await fetch(`${SB}/storage/v1/object/sign/sol-arquivos/${caminho.split("/").map(encodeURIComponent).join("/")}`, { method: "POST", headers: { ...sr, "Content-Type": "application/json" }, body: JSON.stringify({ expiresIn: 7200 }) });
    const j = await s.json(); if (!s.ok || !j.signedURL) return json({ erro: "sem vídeo" }, 404);
    return json({ url: `${SB}/storage/v1${j.signedURL}`, tipo: v.video.tipo || "video/mp4" });
  } catch (e) { return json({ erro: String((e as Error).message || e).slice(0, 120) }, 500); }
});
