// =====================================================================
// Chama Solar · leitura diária das plataformas dos fabricantes
// Supabase Edge Function "sol-monitoramento"
// - Quem chama: o agendamento diário (pg_cron, cabeçalho x-sol-cron) ou o
//   administrador pelo botão "Atualizar agora" (login do Chamae).
// - Acessos: lidos do cofre (Vault) pela função sol_ler_credencial, só com
//   a chave de serviço. Nada de senha no código nem na resposta.
// - Grava: sol_usinas (usinas novas) e sol_geracao (kWh por dia).
// =====================================================================
import { crypto as stdCrypto } from "jsr:@std/crypto@1.0.3";
const SB = Deno.env.get("SUPABASE_URL")!;
const SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-sol-cron" };

async function rest(caminho: string, opt: RequestInit = {}, token = SR) {
  const r = await fetch(`${SB}/rest/v1/${caminho}`, { ...opt, headers: { apikey: token === SR ? SR : ANON, Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(opt.headers || {}) } });
  const t = await r.text();
  if (!r.ok) throw new Error(`${caminho.split("?")[0]}: ${t.slice(0, 200)}`);
  return t ? JSON.parse(t) : null;
}

// ---------- Growatt (mesma API do app ShinePhone) ----------
function md5Growatt(senha: string): Promise<string> {
  return stdCrypto.subtle.digest("MD5", new TextEncoder().encode(senha)).then((b) => {
    let h = Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, "0")).join("");
    for (let i = 0; i < h.length; i += 2) if (h[i] === "0") h = h.slice(0, i) + "c" + h.slice(i + 1);
    return h;
  });
}
async function growatt(cred: Record<string, string>, amostra: Record<string, unknown>) {
  const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36"; // o UA do app leva 403 a partir do servidor
  const senha = await md5Growatt(cred.senha || "");
  let base = "", cookie = "", login: any = null;
  for (const b of ["https://openapi.growatt.com/", "https://server.growatt.com/", "https://server-api.growatt.com/"]) {
    try {
      const r = await fetch(b + "newTwoLoginAPI.do", { method: "POST", headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ userName: cred.usuario, password: senha }) });
      const j = await r.json().catch(() => null);
      amostra["login_" + b] = j && j.back ? { success: j.back.success, msg: j.back.msg, error: j.back.error, chaves: Object.keys(j.back) } : r.status;
      if (j && j.back && j.back.success) { base = b; login = j.back; cookie = (r.headers.getSetCookie?.() || []).map((c) => c.split(";")[0]).join("; "); break; }
    } catch (e) { amostra["login_" + b] = String(e).slice(0, 120); }
  }
  if (!login) {
    for (const u of ["https://openapi.growatt.com/v1/plant/list", "https://server.growatt.com/login"]) { try { const r = await fetch(u, { headers: { "User-Agent": UA, token: cred.chave || "" } }); amostra["teste_" + u] = r.status + " " + (await r.text()).slice(0, 80); } catch (e) { amostra["teste_" + u] = String(e).slice(0, 80); } }
    throw new Error("Growatt recusou o login (confira usuário e senha em Parâmetros).");
  }
  const get = async (pagina: string, params: Record<string, string>, metodo = "GET", corpo?: Record<string, string>) => {
    const url = base + pagina + "?" + new URLSearchParams(params);
    const r = await fetch(url, { method: metodo, headers: { "User-Agent": UA, Cookie: cookie, ...(corpo ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) }, body: corpo ? new URLSearchParams(corpo) : undefined });
    return r.json().catch(() => ({}));
  };
  // usinas: as que vêm no login, a lista do usuário e (conta de instalador) a lista geral
  let plantas: { id: string; nome: string; kwp: number }[] = (login.data || []).map((p: any) => ({ id: String(p.plantId), nome: p.plantName, kwp: 0 }));
  const uid = login.user && (login.user.id || login.user.userId);
  if (uid) {
    const pl = await get("PlantListAPI.do", { userId: String(uid) });
    amostra.plantList = pl && pl.back ? Object.keys(pl.back) : Object.keys(pl || {});
    ((pl.back && pl.back.data) || []).forEach((p: any) => { if (!plantas.find((x) => x.id === String(p.plantId))) plantas.push({ id: String(p.plantId), nome: p.plantName, kwp: 0 }); });
  }
  for (let pag = 1; pag <= 20; pag++) {
    const l2 = await get("newTwoPlantAPI.do", { op: "getAllPlantListTwo" }, "POST", { language: "1", nominalPower: "", order: "1", pageSize: "50", plantName: "", plantStatus: "", toPageNum: String(pag) });
    const lista = l2.PlantList || [];
    if (pag === 1) amostra.plantListTwo = { chaves: Object.keys(l2 || {}), exemplo: lista[0] ? Object.keys(lista[0]) : null, total: lista.length };
    lista.forEach((p: any) => {
      const id = String(p.id || p.plantId); const w = Number(p.nominalPower || p.nominal_power || 0);
      const x = plantas.find((y) => y.id === id);
      if (x) x.kwp = x.kwp || (w > 500 ? w / 1000 : w); else plantas.push({ id, nome: p.plantName, kwp: w > 500 ? w / 1000 : w });
    });
    if (lista.length < 50) break;
  }
  // geração por dia: mês atual e anterior
  const hoje = new Date(Date.now() - 3 * 3600e3), meses = [hoje.toISOString().slice(0, 7), new Date(hoje.getFullYear(), hoje.getMonth() - 1, 15).toISOString().slice(0, 7)];
  const saida: { id: string; nome: string; kwp: number; dias: { dia: string; kwh: number }[] }[] = [];
  for (const p of plantas) {
    const dias: { dia: string; kwh: number }[] = [];
    for (const mes of meses) {
      const d = await get("PlantDetailAPI.do", { plantId: p.id, type: "2", date: mes });
      const dados = (d.back && d.back.data) || {};
      if (!amostra.detalhe) amostra.detalhe = { chaves: d.back ? Object.keys(d.back) : Object.keys(d), exemplo: Object.entries(dados).slice(0, 3) };
      for (const [k, v] of Object.entries(dados)) {
        const dia = /^\d{1,2}$/.test(k) ? `${mes}-${k.padStart(2, "0")}` : /^\d{4}-\d{2}-\d{2}$/.test(k) ? k : null;
        const kwh = Number(v);
        if (dia && !isNaN(kwh) && dia <= hoje.toISOString().slice(0, 10)) dias.push({ dia, kwh });
      }
      if (!p.kwp && d.back && d.back.plantData) { const w = Number(d.back.plantData.nominalPower || 0); p.kwp = w > 500 ? w / 1000 : w; }
    }
    saida.push({ ...p, dias });
  }
  return saida;
}

const LEITORES: Record<string, (c: Record<string, string>, a: Record<string, unknown>) => Promise<{ id: string; nome: string; kwp: number; dias: { dia: string; kwh: number }[] }[]>> = { Growatt: growatt };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const resp = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
  try {
    // quem pode chamar: agendamento (segredo no cofre) ou administrador do solar logado
    const cron = req.headers.get("x-sol-cron");
    if (cron) {
      const seg = await rest("rpc/sol_ler_credencial", { method: "POST", body: JSON.stringify({ p_marca: "cron" }) });
      if (!seg || seg.segredo !== cron) return resp({ erro: "não autorizado" }, 401);
    } else {
      const tok = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
      const ok = tok && (await rest("rpc/eh_solar_admin", { method: "POST", body: "{}" }, tok).catch(() => false));
      if (!ok) return resp({ erro: "não autorizado" }, 401);
    }
    const corpo = await req.json().catch(() => ({}));
    const marcas: string[] = corpo.marca ? [corpo.marca] : Object.keys(LEITORES);
    const resultado: Record<string, unknown> = {};
    for (const marca of marcas) {
      const amostra: Record<string, unknown> = {};
      const inicio = Date.now();
      try {
        const cred = await rest("rpc/sol_ler_credencial", { method: "POST", body: JSON.stringify({ p_marca: marca }) });
        if (!cred) { resultado[marca] = "sem acesso guardado"; continue; }
        const plantas = await LEITORES[marca](cred, amostra);
        // usinas novas entram com o nome da plataforma; as já cadastradas não são alteradas
        if (plantas.length) await rest("sol_usinas?on_conflict=marca,plataforma_id", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates" },
          body: JSON.stringify(plantas.map((p) => ({ marca, plataforma_id: p.id, cliente_nome: p.nome || "Usina " + p.id, kwp: p.kwp > 0 ? Math.round(p.kwp * 1000) / 1000 : 1, obs: p.kwp > 0 ? "importada da plataforma" : "importada da plataforma · conferir kWp" }))) });
        const us = await rest(`sol_usinas?select=id,plataforma_id&marca=eq.${encodeURIComponent(marca)}`);
        const idDe = Object.fromEntries(us.map((u: any) => [u.plataforma_id, u.id]));
        const linhas = plantas.flatMap((p) => p.dias.map((d) => ({ usina_id: idDe[p.id], dia: d.dia, kwh: d.kwh, origem: "api" }))).filter((l) => l.usina_id);
        for (let i = 0; i < linhas.length; i += 500) await rest("sol_geracao?on_conflict=usina_id,dia", { method: "POST", headers: { Prefer: "resolution=merge-duplicates" }, body: JSON.stringify(linhas.slice(i, i + 500)) });
        resultado[marca] = { usinas: plantas.length, dias: linhas.length };
        await rest("sol_monitoramento_execucoes", { method: "POST", body: JSON.stringify({ marca, ok: true, resumo: { usinas: plantas.length, dias: linhas.length, ms: Date.now() - inicio, amostra } }) });
      } catch (e) {
        resultado[marca] = { erro: String((e as Error).message || e).slice(0, 200) };
        await rest("sol_monitoramento_execucoes", { method: "POST", body: JSON.stringify({ marca, ok: false, erro: String((e as Error).message || e).slice(0, 500), resumo: { amostra } }) }).catch(() => {});
      }
    }
    return resp({ ok: true, resultado });
  } catch (e) {
    return resp({ erro: String((e as Error).message || e).slice(0, 300) }, 500);
  }
});
