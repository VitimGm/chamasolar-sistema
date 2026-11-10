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

// ---------- Growatt OpenAPI v1 (token de instalador / OSS) ----------
async function growattV1(cred: Record<string, string>, amostra: Record<string, unknown>) {
  const token = (cred.chave || "").trim();
  const v1 = async (pagina: string, params: Record<string, string>) => {
    const r = await fetch("https://openapi.growatt.com/v1/" + pagina + "?" + new URLSearchParams(params), { headers: { token } });
    const j = await r.json().catch(() => ({ error_code: -1, error_msg: "HTTP " + r.status }));
    if (j.error_code !== 0) throw new Error(`Growatt ${pagina}: ${j.error_msg || j.error_code}`);
    return j.data;
  };
  const plantas: { id: string; nome: string; kwp: number; total?: number; pot?: number; status?: string; dias: { dia: string; kwh: number }[] }[] = [];
  for (let pag = 1; pag <= 30; pag++) {
    const d = await v1("plant/list", { page: String(pag), perpage: "100" });
    const lista = (d && (d.plants || d.plant_list || d.list)) || [];
    if (pag === 1) amostra.lista = { chaves: Object.keys(d || {}), exemplo: lista[0] ? Object.keys(lista[0]) : null, total: d && d.count };
    lista.forEach((p: any) => plantas.push({ id: String(p.plant_id ?? p.id), nome: p.name || p.plant_name || "", kwp: Number(p.peak_power ?? p.nominal_power ?? 0), total: Number(p.total_energy), pot: Number(p.current_power), status: String(p.status ?? ""), dias: [] }));
    if (lista.length < 100) break;
  }
  const hoje = new Date(Date.now() - 3 * 3600e3), iso = (d: Date) => d.toISOString().slice(0, 10);
  const janelas = Number(cred.dias_historico || 0) > 7 ? Math.ceil(Number(cred.dias_historico) / 7) : 2; // padrão: últimos 14 dias
  for (const p of plantas) {
    for (let j = 0; j < janelas; j++) {
      const fim = new Date(hoje.getTime() - j * 7 * 864e5), ini = new Date(fim.getTime() - 6 * 864e5);
      let d: any;
      try { d = await v1("plant/energy", { plant_id: p.id, start_date: iso(ini), end_date: iso(fim), time_unit: "day", page: "1", perpage: "100" }); }
      catch (e) { amostra["erro_" + p.id] = String(e).slice(0, 120); break; }
      if (!amostra.energia) amostra.energia = { chaves: Object.keys(d || {}), exemplo: JSON.stringify(d).slice(0, 200) };
      const lista = (d && (d.energys || d.energy || d.datas || d.list)) || (Array.isArray(d) ? d : []);
      for (const x of lista) {
        const dia = String(x.date || x.time || x.day || "").slice(0, 10), kwh = Number(x.energy ?? x.value ?? x.eday);
        if (/^\d{4}-\d{2}-\d{2}$/.test(dia) && !isNaN(kwh)) p.dias.push({ dia, kwh });
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    if (Object.keys(amostra).filter((k) => k.startsWith("erro_")).length >= 3 && !p.dias.length) break;
  }
  return plantas;
}
async function growattAuto(cred: Record<string, string>, amostra: Record<string, unknown>) {
  if (!(cred.chave || "").trim()) return growatt(cred, amostra);
  const plantas = await growattV1(cred, amostra);
  // token sem permissão de "energia por dia": tenta o histórico pelo login do app (usuário e senha), se houver
  if (plantas.length && !plantas.some((p) => p.dias.length) && cred.usuario && cred.senha) {
    try {
      const a2: Record<string, unknown> = {};
      const app = await growatt(cred, a2);
      const porId = Object.fromEntries(app.map((p) => [p.id, p.dias]));
      let n = 0; plantas.forEach((p) => { if (porId[p.id] && porId[p.id].length) { p.dias = porId[p.id]; n++; } });
      amostra.historicoApp = { usinas: app.length, comDias: n };
    } catch (e) { amostra.historicoApp = String((e as Error).message || e).slice(0, 160); }
  }
  return plantas;
}

// ---------- utilidades ----------
type Planta = { id: string; nome: string; kwp: number; total?: number; pot?: number; status?: string; dias: { dia: string; kwh: number }[] };
const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, "0")).join("");
const md5 = async (t: string) => hex(await stdCrypto.subtle.digest("MD5", new TextEncoder().encode(t)));
const sha256 = async (t: string) => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t)));
const b64 = (b: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(b)));
const hojeSPd = () => new Date(Date.now() - 3 * 3600e3);
const isoD = (d: Date) => d.toISOString().slice(0, 10);
const kwhDe = (v: unknown, un?: unknown) => { const n = Number(v); if (!Number.isFinite(n)) return NaN; const u = String(un || "kWh").toLowerCase(); return u.startsWith("g") ? n * 1e6 : u.startsWith("m") ? n * 1000 : u === "wh" ? n / 1000 : n; };
async function jfetch(url: string, opt: RequestInit, amostra: Record<string, unknown>, rotulo: string) {
  const r = await fetch(url, opt); const t = await r.text(); let j: any = null; try { j = JSON.parse(t); } catch { /* */ }
  if (!amostra[rotulo]) amostra[rotulo] = { status: r.status, chaves: j && typeof j === "object" ? Object.keys(j).slice(0, 12) : null, inicio: j ? null : t.slice(0, 120), msg: j && (j.msg || j.message || j.result_msg || j.error_msg || j.failCode) };
  return { r, j };
}

// ---------- Solis (SolisCloud API: KeyID + KeySecret em Parâmetros → chave e segredo) ----------
async function solis(cred: Record<string, string>, amostra: Record<string, unknown>): Promise<Planta[]> {
  const id = (cred.chave || "").trim(), seg = (cred.segredo || "").trim();
  if (!id || !seg) throw new Error("Solis só libera os dados pela API: peça KeyID e KeySecret no SolisCloud (Serviço → Gerenciamento de API) e guarde em Chave e Segredo.");
  const base = "https://www.soliscloud.com:13333";
  const chamar = async (rota: string, corpo: Record<string, unknown>) => {
    const body = JSON.stringify(corpo), cmd5 = b64(await stdCrypto.subtle.digest("MD5", new TextEncoder().encode(body))), data = new Date().toUTCString();
    const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(seg), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
    const assin = b64(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(`POST\n${cmd5}\napplication/json\n${data}\n${rota}`)));
    const { j } = await jfetch(base + rota, { method: "POST", headers: { "Content-Type": "application/json", "Content-MD5": cmd5, Date: data, Authorization: `API ${id}:${assin}` }, body }, amostra, "solis_" + rota.split("/").pop());
    if (!j || !(j.success === true || j.code === "0")) throw new Error("Solis " + rota + ": " + ((j && (j.msg || j.code)) || "sem resposta"));
    return j.data;
  };
  const plantas: Planta[] = [];
  for (let pag = 1; pag <= 20; pag++) {
    const d = await chamar("/v1/api/userStationList", { pageNo: pag, pageSize: 100 });
    const lista = (d && d.page && d.page.records) || [];
    lista.forEach((p: any) => plantas.push({ id: String(p.id), nome: p.stationName || p.sno || "", kwp: Number(p.capacity) * (String(p.capacityStr || "kWp").toLowerCase().startsWith("m") ? 1000 : 1) || 0, total: kwhDe(p.allEnergy, p.allEnergyStr), pot: kwhDe(p.power, p.powerStr) * 1000, status: String(p.state ?? ""), dias: [] }));
    if (lista.length < 100) break;
  }
  const h = hojeSPd(), meses = [isoD(h).slice(0, 7), isoD(new Date(h.getFullYear(), h.getMonth() - 1, 15)).slice(0, 7)];
  for (const p of plantas) for (const mes of meses) {
    try {
      const d = await chamar("/v1/api/stationMonth", { id: p.id, money: "BRL", month: mes, timeZone: -3 });
      for (const x of (Array.isArray(d) ? d : [])) { const dia = String(x.dateStr || "").slice(0, 10); const kwh = kwhDe(x.energy, x.energyStr); if (/^\d{4}-\d{2}-\d{2}$/.test(dia) && Number.isFinite(kwh)) p.dias.push({ dia, kwh }); }
    } catch (e) { amostra["erro_" + p.id] = String(e).slice(0, 120); }
    await new Promise((r) => setTimeout(r, 400)); // limite da API: 2 por segundo
  }
  return plantas;
}

// ---------- Deye Cloud (API de desenvolvedor: App ID e App Secret em Chave e Segredo; e-mail e senha da conta) ----------
async function deye(cred: Record<string, string>, amostra: Record<string, unknown>): Promise<Planta[]> {
  const appId = (cred.chave || "").trim(), appSecret = (cred.segredo || "").trim();
  if (!appId || !appSecret) throw new Error("Deye Cloud só libera pela API de desenvolvedor: crie um app em developer.deyecloud.com e guarde o App ID em Chave e o App Secret em Segredo (o e-mail e a senha continuam).");
  const senha = await sha256(cred.senha || "");
  let base = "", token = "";
  for (const b of ["https://us1-developer.deyecloud.com", "https://eu1-developer.deyecloud.com"]) {
    const corpo: Record<string, string> = { appSecret, password: senha }; if (/@/.test(cred.usuario || "")) corpo.email = cred.usuario; else corpo.username = cred.usuario;
    const { j } = await jfetch(`${b}/v1.0/account/token?appId=${encodeURIComponent(appId)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) }, amostra, "deye_login_" + b.slice(8, 11));
    if (j && j.success && j.accessToken) { base = b; token = j.accessToken; break; }
  }
  if (!token) throw new Error("Deye recusou o login (confira e-mail, senha, App ID e App Secret).");
  const post = async (rota: string, corpo: unknown) => { const { j } = await jfetch(base + rota, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "bearer " + token }, body: JSON.stringify(corpo) }, amostra, "deye_" + rota.split("/").pop()); if (!j || j.success === false) throw new Error("Deye " + rota + ": " + ((j && j.msg) || "sem resposta")); return j; };
  const plantas: Planta[] = [];
  for (let pag = 1; pag <= 20; pag++) {
    const j = await post("/v1.0/station/list", { page: pag, size: 100 });
    const lista = j.stationList || [];
    lista.forEach((p: any) => plantas.push({ id: String(p.id), nome: p.name || "", kwp: Number(p.installedCapacity) || 0, pot: Number(p.generationPower), status: String(p.connectionStatus ?? ""), dias: [] }));
    if (lista.length < 100) break;
  }
  const h = hojeSPd(), ini = isoD(new Date(h.getTime() - 30 * 864e5)), fim = isoD(h);
  for (const p of plantas) {
    try {
      const j = await post("/v1.0/station/history", { stationId: Number(p.id), granularity: 2, startAt: ini, endAt: fim });
      for (const x of (j.stationDataItems || [])) { const dia = `${x.year}-${String(x.month).padStart(2, "0")}-${String(x.day).padStart(2, "0")}`; const kwh = Number(x.generationValue); if (Number.isFinite(kwh)) p.dias.push({ dia, kwh }); }
    } catch (e) { amostra["erro_" + p.id] = String(e).slice(0, 120); }
  }
  return plantas;
}

// ---------- Huawei FusionSolar (usuário de API "Northbound" criado no FusionSolar) ----------
async function huawei(cred: Record<string, string>, amostra: Record<string, unknown>): Promise<Planta[]> {
  let base = "", tok = "", cookie = "";
  const hosts = cred.obs && /^https?:\/\//.test(cred.obs.trim()) ? [cred.obs.trim().replace(/\/$/, "")] : ["https://la5.fusionsolar.huawei.com", "https://eu5.fusionsolar.huawei.com", "https://sg5.fusionsolar.huawei.com"];
  for (const b of hosts) {
    let r: Response, j: any;
    try { ({ r, j } = await jfetch(b + "/thirdData/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userName: cred.usuario, systemCode: cred.senha }) }, amostra, "huawei_login_" + b.slice(8, 20))); } catch (e) { amostra["huawei_" + b.slice(8, 20)] = String(e).slice(0, 80); continue; } // servidor que não existe: tenta o próximo
    if (j && j.success) { base = b; tok = r.headers.get("xsrf-token") || ""; cookie = (r.headers.getSetCookie?.() || []).map((c) => c.split(";")[0]).join("; "); break; }
    if (j) break; // respondeu e recusou: não tenta de novo (a Huawei bloqueia a conta depois de várias tentativas)
  }
  if (!base) throw new Error("Huawei recusou o login. O FusionSolar só libera os dados para um usuário de API: no FusionSolar, Sistema → Gerenciamento da empresa → Northbound → criar usuário (com senha) e guardar esse usuário aqui.");
  const post = async (rota: string, corpo: unknown) => { const { j } = await jfetch(base + rota, { method: "POST", headers: { "Content-Type": "application/json", "XSRF-TOKEN": tok, Cookie: cookie }, body: JSON.stringify(corpo) }, amostra, "huawei_" + rota.split("/").pop()); if (!j || !j.success) throw new Error("Huawei " + rota + ": " + ((j && (j.message || j.failCode)) || "sem resposta")); return j.data; };
  const plantas: Planta[] = [];
  for (let pag = 1; pag <= 20; pag++) {
    const d = await post("/thirdData/stations", { pageNo: pag });
    const lista = (d && d.list) || [];
    lista.forEach((p: any) => plantas.push({ id: String(p.plantCode), nome: p.plantName || "", kwp: Number(p.capacity) > 1000 ? Number(p.capacity) / 1000 : Number(p.capacity) || 0, dias: [] }));
    if (!d || pag >= (d.pageCount || 1)) break;
  }
  const h = hojeSPd(), quando = [h.getTime(), new Date(h.getFullYear(), h.getMonth() - 1, 15).getTime()];
  for (let i = 0; i < plantas.length; i += 100) {
    const grupo = plantas.slice(i, i + 100), cod = grupo.map((p) => p.id).join(",");
    for (const ms of quando) {
      try {
        const d = await post("/thirdData/getKpiStationDay", { stationCodes: cod, collectTime: ms });
        for (const x of (d || [])) { const p = grupo.find((y) => y.id === x.stationCode); const m = x.dataItemMap || {}; const kwh = Number(m.PVYield ?? m.inverter_power ?? m.inverterYield); if (p && Number.isFinite(kwh)) p.dias.push({ dia: isoD(new Date(Number(x.collectTime) - 3 * 3600e3 + 12 * 3600e3)), kwh }); }
      } catch (e) { amostra["erro_kpi_" + i] = String(e).slice(0, 160); }
      await new Promise((r) => setTimeout(r, 1500)); // a Huawei limita chamadas por minuto
    }
  }
  return plantas;
}

// ---------- Sungrow iSolarCloud (login do app com usuário e senha) ----------
async function sungrow(cred: Record<string, string>, amostra: Record<string, unknown>): Promise<Planta[]> {
  const APPKEY = (cred.chave || "").trim() || "93D72E60331ABDCDC7B39ADC2D1F32B3", AK = (cred.segredo || "").trim() || "9grzgbmxdsp3arfmmgq347xjbza4ysps";
  const H = { "Content-Type": "application/json", "x-access-key": AK, sys_code: "901", lang: "_pt_BR" };
  const OPEN = !!(cred.chave || "").trim(); // app próprio do Open API (developer-api.isolarcloud.com)
  const R_LOGIN = OPEN ? "/openapi/login" : "/v1/userService/login", R_LISTA = OPEN ? "/openapi/getPowerStationList" : "/v1/powerStationService/getPsList";
  let base = "", token = "", uid = "";
  for (const b of ["https://gateway.isolarcloud.com.hk", "https://gateway.isolarcloud.eu", "https://augateway.isolarcloud.com", "https://gateway.isolarcloud.com"]) {
    try {
      const { j } = await jfetch(b + R_LOGIN, { method: "POST", headers: H, body: JSON.stringify({ appkey: APPKEY, sys_code: "900", user_account: cred.usuario, user_password: cred.senha, login_type: "1", lang: "_pt_BR" }) }, amostra, "sungrow_login_" + b.slice(8, 24));
      const rd = j && j.result_data;
      if (rd && rd.token) { base = b; token = rd.token; uid = String(rd.user_id || ""); break; }
      if (j && j.result_code) break; // servidor respondeu e recusou: não insiste (evita bloquear a conta)
    } catch (e) { amostra["sungrow_login_" + b.slice(8, 24)] = String(e).slice(0, 100); }
  }
  if (!token) throw new Error(JSON.stringify(amostra).includes("invalid_appkey") ? "Sungrow não aceita mais o acesso só com usuário e senha: crie um app em developer-api.isolarcloud.com (Open API) e guarde o Appkey em Chave e o Secret Key em Segredo." : "Sungrow recusou o login (confira usuário e senha do iSolarCloud).");
  const post = async (rota: string, corpo: Record<string, unknown>) => { const { j } = await jfetch(base + rota, { method: "POST", headers: H, body: JSON.stringify({ appkey: APPKEY, token, user_id: uid, sys_code: "901", lang: "_pt_BR", ...corpo }) }, amostra, "sungrow_" + rota.split("/").pop()); if (!j || j.result_code !== "1") throw new Error("Sungrow " + rota + ": " + ((j && j.result_msg) || "sem resposta")); return j.result_data; };
  const plantas: Planta[] = [];
  for (let pag = 1; pag <= 20; pag++) {
    const d = await post(R_LISTA, { curPage: pag, size: 100 });
    const lista = (d && d.pageList) || [];
    lista.forEach((p: any) => {
      const cap = p.design_capacity && typeof p.design_capacity === "object" ? kwhDe(p.design_capacity.value, p.design_capacity.unit) : Number(p.design_capacity) / (Number(p.design_capacity) > 1000 ? 1000 : 1);
      const tot = p.total_energy && typeof p.total_energy === "object" ? kwhDe(p.total_energy.value, p.total_energy.unit) : NaN;
      plantas.push({ id: String(p.ps_id), nome: p.ps_name || "", kwp: Number.isFinite(cap) ? cap : 0, total: tot, status: String(p.ps_status ?? ""), dias: [] });
    });
    if (lista.length < 100) break;
  }
  return plantas; // geração do dia sai da diferença do total acumulado (como na Growatt)
}

// ---------- Hoymiles S-Miles Cloud (usuário e senha) ----------
async function hoymiles(cred: Record<string, string>, amostra: Record<string, unknown>): Promise<Planta[]> {
  let base = "", token = "";
  const senha = await md5(cred.senha || "");
  for (const b of ["https://neapi.hoymiles.com", "https://euapi.hoymiles.com", "https://global.hoymiles.com/platform/api/gateway"]) {
    try {
      const { j } = await jfetch(b + "/iam/pub/0/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_name: cred.usuario, password: senha }) }, amostra, "hoymiles_login_" + b.slice(8, 20));
      if (j && String(j.status) === "0" && j.data && j.data.token) { base = b; token = j.data.token; break; }
      if (j && j.status != null) break; // respondeu e recusou: não insiste
    } catch (e) { amostra["hoymiles_login_" + b.slice(8, 20)] = String(e).slice(0, 100); }
  }
  if (!token) throw new Error("Hoymiles recusou o login (confira usuário e senha do S-Miles Cloud).");
  const post = async (rota: string, corpo: unknown) => { const { j } = await jfetch(base + rota, { method: "POST", headers: { "Content-Type": "application/json", Authorization: token }, body: JSON.stringify(corpo) }, amostra, "hoymiles_" + rota.split("/").pop()); if (!j || String(j.status) !== "0") throw new Error("Hoymiles " + rota + ": " + ((j && j.message) || "sem resposta")); return j.data; };
  const plantas: Planta[] = [];
  for (let pag = 1; pag <= 20; pag++) {
    const d = await post("/pvm/api/0/station/select_by_page", { page: pag, page_size: 100 });
    const lista = (d && d.list) || [];
    lista.forEach((p: any) => plantas.push({ id: String(p.id), nome: p.name || "", kwp: Number(p.capacitor) || 0, dias: [] }));
    if (lista.length < 100) break;
  }
  for (const p of plantas) {
    try { const d = await post("/pvm-data/api/0/station/data/count_station_real_data", { sid: Number(p.id) }); p.total = Number(d && d.total_eq) / 1000; p.pot = Number(d && d.real_power); const hj = Number(d && d.today_eq); if (Number.isFinite(hj) && hj > 0) p.dias.push({ dia: new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10), kwh: Math.round(hj / 10) / 100 }); if (!amostra.hoymiles_campos && d) amostra.hoymiles_campos = Object.keys(d).slice(0, 20); }
    catch (e) { amostra["erro_" + p.id] = String(e).slice(0, 120); }
  }
  return plantas; // total_eq vem em Wh: a geração do dia sai da diferença do total
}

// ---------- SolarZ Open API (todas as marcas que a Chama Solar monitora no SolarZ) ----------
// Usuário de API gerado em SolarZ → Configurações → Usuário de API (HTTP Basic). Documentação: app.solarz.com.br/v3/api-docs/seller-open-api
const MARCA_SZ: [RegExp, string][] = [[/hoymiles/i, "Hoymiles"], [/auxsol/i, "Auxsol"], [/solis/i, "Solis"], [/sungrow|isolar/i, "Sungrow"], [/fusion|huawei/i, "Huawei"], [/deye|solarman/i, "Deye"], [/growatt|shine/i, "Growatt"], [/goodwe|sems/i, "GoodWe"]];
const marcaSZ = (api: string) => (MARCA_SZ.find(([r]) => r.test(api || "")) || [null, "Outra"])[1];
async function solarz(cred: Record<string, string>, amostra: Record<string, unknown>): Promise<(Planta & { marcaReal: string; nomePortal: string })[]> {
  const base = "https://app.solarz.com.br/openApi/seller", auth = "Basic " + btoa(`${(cred.usuario || "").trim()}:${(cred.senha || "").trim()}`);
  const H = { Authorization: auth, "Content-Type": "application/json", Accept: "application/json" };
  // os POST de lista aceitam os filtros no corpo (JSON); se o servidor pedir na URL, tenta assim
  const post = async (rota: string, corpo: Record<string, unknown>, rotulo: string) => {
    let { r, j } = await jfetch(base + rota, { method: "POST", headers: H, body: JSON.stringify(corpo) }, amostra, rotulo);
    if (r.status === 400 || r.status === 415) { amostra[rotulo + "_erro"] = JSON.stringify(j).slice(0, 300); ({ r, j } = await jfetch(base + rota + "?" + new URLSearchParams(Object.entries(corpo).map(([k, v]) => [k, String(v)])), { method: "POST", headers: H }, amostra, rotulo + "_q")); }
    if (r.status === 401 || r.status === 403) throw new Error("SolarZ recusou o Usuário de API (confira usuário e senha em Parâmetros → Acessos → SolarZ).");
    if (!r.ok) throw new Error(`SolarZ ${rota}: HTTP ${r.status} ${JSON.stringify(j || {}).slice(0, 200)}`);
    return j;
  };
  const marcaDe: Record<string, { marca: string; nome: string }> = {};
  for (let pag = 1; pag <= 40; pag++) { // páginas começam em 1 (e os números vão como texto)
    const d = await post("/plant/list/simple", { page: String(pag), pageSize: "100" }, "sz_simples");
    for (const x of (d && d.content) || []) { const c = Array.isArray(x.coletas) ? x.coletas[0] : x.coletas; marcaDe[String(x.id)] = { marca: marcaSZ(c && c.apiNome), nome: (c && c.nomeUsinaPortal) || x.denominacao || "" }; }
    if (!d || d.last || !(d.content || []).length) break;
  }
  const plantas: (Planta & { marcaReal: string; nomePortal: string })[] = [];
  for (let pag = 1; pag <= 40; pag++) {
    const d = await post("/plant/list", { page: String(pag), pageSize: "100" }, "sz_lista");
    for (const x of (d && d.content) || []) {
      const id = String(x.id), m = marcaDe[id] || { marca: "Outra", nome: x.name };
      plantas.push({ id, nome: x.name || m.nome, kwp: Number(x.installedPower) || 0, status: x.status && x.status.status ? String(x.status.status) : "", dias: [], marcaReal: m.marca, nomePortal: m.nome || x.name });
    }
    if (!d || d.last || !(d.content || []).length) break;
  }
  // geração por dia dos últimos 35 dias, 6 usinas por vez
  const h = hojeSPd(), de = isoD(new Date(h.getTime() - 35 * 864e5)), ate = isoD(h);
  let i = 0, erros = 0;
  const trabalhador = async () => {
    while (i < plantas.length) {
      const p = plantas[i++];
      try {
        const d = await post("/plant/energy/dayRange", { plantId: p.id, fromLocalDate: de, toLocalDate: ate }, "sz_dias");
        for (const x of Array.isArray(d) ? d : []) { const dia = String(x.date || "").slice(0, 10), kwh = Number(x.total); if (/^\d{4}-\d{2}-\d{2}$/.test(dia) && Number.isFinite(kwh) && dia <= ate) p.dias.push({ dia, kwh }); }
      } catch (e) { if (++erros <= 3) amostra["erro_" + p.id] = String(e).slice(0, 120); }
    }
  };
  await Promise.all(Array.from({ length: 6 }, trabalhador));
  amostra.marcas = plantas.reduce((t: Record<string, number>, p) => { t[p.marcaReal] = (t[p.marcaReal] || 0) + 1; return t; }, {});
  return plantas;
}

// ---------- Auxsol: sem API pública conhecida ----------
async function auxsol(_c: Record<string, string>, _a: Record<string, unknown>): Promise<Planta[]> {
  throw new Error("Auxsol ainda não tem leitura automática: a plataforma não tem API aberta. Dá para fazer pelo robô do escritório (como o da Belenergy) se precisar.");
}

const LEITORES: Record<string, (c: Record<string, string>, a: Record<string, unknown>) => Promise<Planta[]>> = { Growatt: growattAuto, Solis: solis, Deye: deye, Huawei: huawei, Sungrow: sungrow, Hoymiles: hoymiles, Auxsol: auxsol, SolarZ: solarz };

// descarta dias impossíveis (ex.: o total acumulado lido como se fosse do dia): no máximo 15 kWh por kWp por dia
async function plausiveis(linhas: { usina_id: number; dia: string; kwh: number; origem: string }[]) {
  const ids = [...new Set(linhas.map((l) => l.usina_id))]; if (!ids.length) return linhas;
  const kwp: Record<number, number> = {};
  for (let i = 0; i < ids.length; i += 150) (await rest(`sol_usinas?select=id,kwp&id=in.(${ids.slice(i, i + 150).join(",")})`)).forEach((u: any) => { kwp[u.id] = Number(u.kwp) || 0; });
  return linhas.filter((l) => { const k = kwp[l.usina_id] || 0, teto = k >= 2 && k < 5000 ? Math.max(k * 15, 100) : 20000; return Number.isFinite(l.kwh) && l.kwh >= 0 && l.kwh <= teto; });
}

// SolarZ: cada usina entra com a marca real; se já existe (importada direto da marca, mesmo nome), usa a mesma
async function gravarSolarZ(plantas: (Planta & { marcaReal: string; nomePortal: string })[], amostra: Record<string, unknown>) {
  const norm = (t: string) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  const todas = await rest("sol_usinas?select=id,marca,plataforma_id,cliente_nome");
  const porSz: Record<string, number> = {}, porNome: Record<string, number> = {};
  for (const u of todas) { if (String(u.plataforma_id || "").startsWith("sz:")) porSz[u.plataforma_id.slice(3)] = u.id; porNome[u.marca + "|" + norm(u.cliente_nome)] = porNome[u.marca + "|" + norm(u.cliente_nome)] || u.id; }
  const novas = plantas.filter((p) => !porSz[p.id] && !porNome[p.marcaReal + "|" + norm(p.nomePortal)] && !porNome[p.marcaReal + "|" + norm(p.nome)]);
  if (novas.length) await rest("sol_usinas?on_conflict=marca,plataforma_id", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates" },
    body: JSON.stringify(novas.map((p) => ({ marca: p.marcaReal, plataforma_id: "sz:" + p.id, cliente_nome: p.nome || "Usina " + p.id, kwp: p.kwp > 0 ? Math.round(p.kwp * 1000) / 1000 : 1, obs: "importada do SolarZ" + (p.kwp > 0 ? "" : " · conferir kWp") }))) });
  const depois = novas.length ? await rest("sol_usinas?select=id,plataforma_id&plataforma_id=like.sz:*") : [];
  for (const u of depois) porSz[u.plataforma_id.slice(3)] = u.id;
  const idDe = (p: Planta & { marcaReal: string; nomePortal: string }) => porSz[p.id] || porNome[p.marcaReal + "|" + norm(p.nomePortal)] || porNome[p.marcaReal + "|" + norm(p.nome)];
  const linhas0 = plantas.flatMap((p) => { const uid = idDe(p); return uid ? p.dias.map((d) => ({ usina_id: uid, dia: d.dia, kwh: d.kwh, origem: "api" })) : []; });
  const linhas = await plausiveis(linhas0);
  for (let i = 0; i < linhas.length; i += 500) await rest("sol_geracao?on_conflict=usina_id,dia", { method: "POST", headers: { Prefer: "resolution=merge-duplicates" }, body: JSON.stringify(linhas.slice(i, i + 500)) });
  amostra.ligadasPeloNome = plantas.filter((p) => !porSz[p.id] && idDe(p)).length;
  return { usinas: plantas.length, novas: novas.length, dias: linhas.length };
}

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
    // todas as plataformas com acesso guardado (o SolarZ, enquanto existir, completa as que ainda não têm leitura direta)
    const marcas: string[] = corpo.marca ? [corpo.marca] : Object.keys(LEITORES);
    const resultado: Record<string, unknown> = {};
    for (const marca of marcas) {
      const amostra: Record<string, unknown> = {};
      const inicio = Date.now();
      try {
        const cred = await rest("rpc/sol_ler_credencial", { method: "POST", body: JSON.stringify({ p_marca: marca }) });
        if (!cred) { resultado[marca] = "sem acesso guardado"; continue; }
        const plantas = await LEITORES[marca](cred, amostra);
        if (marca === "SolarZ") { const r = await gravarSolarZ(plantas as any, amostra); resultado[marca] = r; await rest("sol_monitoramento_execucoes", { method: "POST", body: JSON.stringify({ marca, ok: true, resumo: { ...r, ms: Date.now() - inicio, amostra } }) }); continue; }
        // usinas novas entram com o nome da plataforma; as já cadastradas não são alteradas
        if (plantas.length) await rest("sol_usinas?on_conflict=marca,plataforma_id", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates" },
          body: JSON.stringify(plantas.map((p) => ({ marca, plataforma_id: p.id, cliente_nome: p.nome || "Usina " + p.id, kwp: p.kwp > 0 ? Math.round(p.kwp * 1000) / 1000 : 1, obs: p.kwp > 0 ? "importada da plataforma" : "importada da plataforma · conferir kWp" }))) });
        const us = await rest(`sol_usinas?select=id,plataforma_id&marca=eq.${encodeURIComponent(marca)}`);
        const idDe = Object.fromEntries(us.map((u: any) => [u.plataforma_id, u.id]));
        const linhas = plantas.flatMap((p) => p.dias.map((d) => ({ usina_id: idDe[p.id], dia: d.dia, kwh: d.kwh, origem: "api" }))).filter((l) => l.usina_id);
        // sem permissão de geração por dia: a lista traz o total acumulado; a diferença entre um dia e o anterior é a geração do dia
        const hojeSP = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
        const leit = plantas.filter((p) => idDe[p.id] && Number.isFinite(p.total as number) && (p.total as number) > 0).map((p) => ({ usina_id: idDe[p.id], dia: hojeSP, total_kwh: p.total, potencia_w: Number.isFinite(p.pot as number) ? p.pot : null, status: p.status || null, em: new Date().toISOString() }));
        if (leit.length) {
          const antes = await rest(`sol_usina_leituras?select=usina_id,dia,total_kwh&dia=lt.${hojeSP}&dia=gte.${new Date(Date.now() - 40 * 864e5).toISOString().slice(0, 10)}&order=dia.desc`);
          const ult: Record<string, { dia: string; total_kwh: number }> = {}; for (const a of antes) if (!ult[a.usina_id]) ult[a.usina_id] = a;
          for (const l of leit) {
            if (linhas.some((x) => x.usina_id === l.usina_id && x.dia === hojeSP)) continue; // já veio por dia
            const a = ult[l.usina_id]; if (!a) continue;
            const n = Math.round((Date.parse(hojeSP) - Date.parse(a.dia)) / 864e5), delta = Number(l.total_kwh) - Number(a.total_kwh);
            if (n < 1 || n > 31 || !(delta >= 0) || delta > Number(l.total_kwh)) continue;
            for (let k = 0; k < n; k++) linhas.push({ usina_id: l.usina_id, dia: new Date(Date.parse(hojeSP) - k * 864e5).toISOString().slice(0, 10), kwh: Math.round((delta / n) * 100) / 100, origem: "api" });
          }
          await rest("sol_usina_leituras?on_conflict=usina_id,dia", { method: "POST", headers: { Prefer: "resolution=merge-duplicates" }, body: JSON.stringify(leit) });
          amostra.leituras = leit.length;
        }
        const boas = await plausiveis(linhas as any); amostra.descartados = linhas.length - boas.length;
        for (let i = 0; i < boas.length; i += 500) await rest("sol_geracao?on_conflict=usina_id,dia", { method: "POST", headers: { Prefer: "resolution=merge-duplicates" }, body: JSON.stringify(boas.slice(i, i + 500)) });
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
