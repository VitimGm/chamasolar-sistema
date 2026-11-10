// =====================================================================
// Chama Solar · migração do SolarZ (uma vez, antes de cancelar o SolarZ)
// Supabase Edge Function "sol-solarz-migrar" — mesmo controle de acesso do monitoramento
// (agendamento com segredo do cofre ou administrador do solar logado).
// Corpo: { etapa: "clientes" }                    → dados do cliente, kWp, instalação, unidades e rateio
//        { etapa: "historico", de: 0, ate: 60 }  → geração dia a dia desde a instalação (lote de usinas)
// Lê o Usuário de API do SolarZ guardado no cofre (sol_cred_solarz). Só grava em tabelas sol_.
// =====================================================================
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
const MARCA_SZ: [RegExp, string][] = [[/hoymiles/i, "Hoymiles"], [/auxsol/i, "Auxsol"], [/solis/i, "Solis"], [/sungrow|isolar/i, "Sungrow"], [/fusion|huawei/i, "Huawei"], [/deye|solarman/i, "Deye"], [/growatt|shine/i, "Growatt"], [/goodwe|sems/i, "GoodWe"], [/sunweg/i, "Sunweg"], [/tsun/i, "TSuness"], [/chint/i, "Chint"], [/solplanet/i, "Solplanet"], [/abb|aurora/i, "ABB"]];
const marcaSZ = (api: string) => (MARCA_SZ.find(([r]) => r.test(api || "")) || [null, "Outra"])[1];
const norm = (t: string) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const iso = (d: Date) => d.toISOString().slice(0, 10);

function cliente(cred: Record<string, string>) {
  const base = "https://app.solarz.com.br/openApi/seller", H = { Authorization: "Basic " + btoa(`${(cred.usuario || "").trim()}:${(cred.senha || "").trim()}`), "Content-Type": "application/json", Accept: "application/json" };
  const chamar = async (metodo: string, rota: string, corpo?: Record<string, unknown>, q?: Record<string, string>) => {
    const url = base + rota + (q ? "?" + new URLSearchParams(q) : "");
    const r = await fetch(url, { method: metodo, headers: H, body: corpo ? JSON.stringify(corpo) : undefined });
    const t = await r.text(); let j: any = null; try { j = JSON.parse(t); } catch { /* */ }
    if (r.status === 401 || r.status === 403) throw new Error("SolarZ recusou o Usuário de API");
    if (!r.ok) throw new Error(`SolarZ ${rota}: HTTP ${r.status} ${t.slice(0, 160)}`);
    return j;
  };
  return { post: (rota: string, corpo: Record<string, unknown>) => chamar("POST", rota, corpo), get: (rota: string, q?: Record<string, string>) => chamar("GET", rota, undefined, q) };
}

// todas as usinas do SolarZ, com a marca e o nome no portal do fabricante
async function listar(sz: ReturnType<typeof cliente>) {
  const marca: Record<string, { marca: string; nome: string }> = {};
  for (let pag = 1; pag <= 40; pag++) {
    const d = await sz.post("/plant/list/simple", { page: String(pag), pageSize: "100" });
    for (const x of (d && d.content) || []) { const c = Array.isArray(x.coletas) ? x.coletas[0] : x.coletas; marca[String(x.id)] = { marca: marcaSZ(c && c.apiNome), nome: (c && c.nomeUsinaPortal) || x.denominacao || "" }; }
    if (!d || d.last || !(d.content || []).length) break;
  }
  // unidades consumidoras (só vêm as usinas que têm lista de compensação)
  const unid: Record<string, any[]> = {};
  for (let pag = 1; pag <= 40; pag++) {
    const d = await sz.post("/plants/units-with-credits", { page: String(pag), pageSize: "100" });
    const c = Array.isArray(d) ? d : (d && d.content) || [];
    for (const x of c) unid[String(x.id)] = x.unidades || [];
    if (!c.length || c.length < 100) break;
  }
  // todas as usinas, com cliente, endereço, kWp e data de instalação
  const lista: any[] = [];
  for (let pag = 1; pag <= 40; pag++) {
    const d = await sz.post("/plant/list", { page: String(pag), pageSize: "100" });
    const c = (d && d.content) || [];
    lista.push(...c);
    if (!d || d.last || !c.length) break;
  }
  return lista.map((p) => ({ ...p, unidades: unid[String(p.id)] || [], sz: String(p.id), marcaReal: (marca[String(p.id)] || {}).marca || "Outra", nomePortal: (marca[String(p.id)] || {}).nome || p.name }));
}

// acha (ou cria) a usina no nosso cadastro: pelo id do SolarZ, depois pelo nome na mesma marca
async function mapear(lista: any[]) {
  const todas = await rest("sol_usinas?select=id,marca,plataforma_id,cliente_nome,kwp,whatsapp,email,cidade,ligada_em,obs");
  const porSz: Record<string, any> = {}, porNome: Record<string, any> = {};
  for (const u of todas) { if (String(u.plataforma_id || "").startsWith("sz:")) porSz[u.plataforma_id.slice(3)] = u; const k = u.marca + "|" + norm(u.cliente_nome); porNome[k] = porNome[k] || u; }
  const achar = (p: any) => porSz[p.sz] || porNome[p.marcaReal + "|" + norm(p.nomePortal)] || porNome[p.marcaReal + "|" + norm(p.name)];
  const novas = lista.filter((p) => !achar(p));
  if (novas.length) {
    const criadas = await rest("sol_usinas?on_conflict=marca,plataforma_id", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
      body: JSON.stringify(novas.map((p) => ({ marca: p.marcaReal, plataforma_id: "sz:" + p.sz, cliente_nome: p.name || "Usina " + p.sz, kwp: Number(p.installedPower) > 0 ? Number(p.installedPower) : 1, obs: "importada do SolarZ" }))) });
    for (const u of criadas || []) porSz[String(u.plataforma_id).slice(3)] = u;
  }
  return lista.map((p) => ({ p, u: achar(p) })).filter((x) => x.u);
}

async function etapaClientes(sz: ReturnType<typeof cliente>) {
  const lista = await listar(sz), pares = await mapear(lista);
  let atualizadas = 0, unidades = 0, rateios = 0; const erros: string[] = [];
  for (const { p, u } of pares) {
    const c = p.cliente || {}, e = p.endereco || {}, mud: Record<string, unknown> = {};
    const kwp = Number(p.installedPower);
    if (kwp > 0 && (!(+u.kwp > 0.5) || /importada/.test(u.obs || ""))) mud.kwp = kwp; // kWp do SolarZ corrige o que veio errado da plataforma
    if (!u.whatsapp && c.telefone) mud.whatsapp = String(c.telefone);
    if (!u.email && c.email) mud.email = String(c.email).trim();
    if (!u.cidade && e.cidade) mud.cidade = e.cidade;
    if (!u.ligada_em && p.dataInstalacao) mud.ligada_em = String(p.dataInstalacao).slice(0, 10);
    if (c.nome && /importada/.test(u.obs || "") && norm(c.nome) !== norm(u.cliente_nome)) mud.obs = `importada · cliente no SolarZ: ${c.nome}`;
    if (Object.keys(mud).length) { await rest("sol_usinas?id=eq." + u.id, { method: "PATCH", body: JSON.stringify(mud) }); atualizadas++; }
    // unidades e rateio (percentual de créditos de cada UC)
    let rat: any = null; if ((p.unidades || []).length) try { rat = await sz.get(`/plant/${p.sz}/rateio`); } catch (err) { if (erros.length < 3) erros.push(String(err).slice(0, 120)); }
    const pct: Record<string, any> = {}; for (const r of (rat && rat.unidades) || []) pct[String(r.unitId)] = r;
    const uns = (p.unidades || []).map((x: any) => { const r = pct[String(x.id)] || {}; return { usina_id: u.id, uc: String(x.contrato || x.denominacao || x.id), apelido: x.denominacao || null, percentual: r.percentual ?? null, geradora: /gerad/i.test(String(r.tipo || "")) }; }).filter((x: any) => x.uc);
    if (uns.length) { await rest("sol_unidades?on_conflict=usina_id,uc", { method: "POST", headers: { Prefer: "resolution=merge-duplicates" }, body: JSON.stringify(uns) }); unidades += uns.length; if (rat) rateios++; }
  }
  return { usinasSolarZ: lista.length, ligadas: pares.length, atualizadas, unidades, rateios, erros };
}

async function etapaHistorico(sz: ReturnType<typeof cliente>, de: number, ate: number) {
  const lista = await listar(sz), pares = (await mapear(lista)).slice(de, ate);
  const hoje = new Date(Date.now() - 3 * 3600e3); let dias = 0; const erros: string[] = [];
  let i = 0;
  const trab = async () => {
    while (i < pares.length) {
      const { p, u } = pares[i++];
      const inicio = new Date(String(p.dataInstalacao || "2019-01-01").slice(0, 10) + "T12:00:00");
      const linhas: any[] = [];
      for (let ano = Math.max(inicio.getFullYear(), 2015); ano <= hoje.getFullYear(); ano++) {
        const ini = ano === inicio.getFullYear() ? iso(inicio) : `${ano}-01-01`, fim = ano === hoje.getFullYear() ? iso(hoje) : `${ano}-12-31`;
        try {
          const d = await sz.post("/plant/energy/dayRange", { plantId: p.sz, fromLocalDate: ini, toLocalDate: fim });
          for (const x of Array.isArray(d) ? d : []) { const dia = String(x.date || "").slice(0, 10), kwh = Number(x.total); if (/^\d{4}-\d{2}-\d{2}$/.test(dia) && Number.isFinite(kwh) && kwh >= 0) linhas.push({ usina_id: u.id, dia, kwh, origem: "solarz" }); }
        } catch (err) { if (erros.length < 5) erros.push(p.sz + " " + ano + ": " + String(err).slice(0, 120)); }
      }
      for (let k = 0; k < linhas.length; k += 1000) await rest("sol_geracao?on_conflict=usina_id,dia", { method: "POST", headers: { Prefer: "resolution=merge-duplicates" }, body: JSON.stringify(linhas.slice(k, k + 1000)) });
      dias += linhas.length;
    }
  };
  await Promise.all(Array.from({ length: 5 }, trab));
  return { total: lista.length, lote: [de, ate], usinas: pares.length, dias, erros };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const resp = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
  try {
    const cron = req.headers.get("x-sol-cron");
    if (cron) { const seg = await rest("rpc/sol_ler_credencial", { method: "POST", body: JSON.stringify({ p_marca: "cron" }) }); if (!seg || seg.segredo !== cron) return resp({ erro: "não autorizado" }, 401); }
    else { const tok = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, ""); const ok = tok && (await rest("rpc/eh_solar_admin", { method: "POST", body: "{}" }, tok).catch(() => false)); if (!ok) return resp({ erro: "não autorizado" }, 401); }
    const corpo = await req.json().catch(() => ({}));
    const cred = await rest("rpc/sol_ler_credencial", { method: "POST", body: JSON.stringify({ p_marca: "SolarZ" }) });
    if (!cred) return resp({ erro: "Guarde o Usuário de API do SolarZ em Parâmetros → Acessos" }, 400);
    const sz = cliente(cred), ini = Date.now();
    const r = corpo.etapa === "historico" ? await etapaHistorico(sz, Number(corpo.de) || 0, Number(corpo.ate) || 60) : await etapaClientes(sz);
    await rest("sol_monitoramento_execucoes", { method: "POST", body: JSON.stringify({ marca: "SolarZ migração", ok: true, resumo: { etapa: corpo.etapa || "clientes", ...r, ms: Date.now() - ini } }) }).catch(() => {});
    return resp({ ok: true, ...r });
  } catch (e) {
    await rest("sol_monitoramento_execucoes", { method: "POST", body: JSON.stringify({ marca: "SolarZ migração", ok: false, erro: String((e as Error).message || e).slice(0, 500) }) }).catch(() => {});
    return resp({ erro: String((e as Error).message || e).slice(0, 300) }, 500);
  }
});
