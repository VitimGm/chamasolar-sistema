// =====================================================================
// Chama Solar · relatório mensal por e-mail (clientes com plano de monitoramento)
// Supabase Edge Function "sol-relatorio-mensal"
// - Quem chama: agendamento mensal (segredo do cofre) ou administrador do solar logado.
// - Envia pelo e-mail da empresa (SMTP Hostinger), com o acesso guardado no cofre (sol_cred_email).
// - Corpo: {} → todos os clientes com plano que ainda não receberam o do mês
//          { teste: "email@..." } → manda só um exemplo para esse endereço (não marca nada)
//          { usina_id: 123 } → manda só para essa usina
// =====================================================================
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
const SB = Deno.env.get("SUPABASE_URL")!;
const SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-sol-cron" };
const PORTAL = "https://chamaeescritorio1-boop.github.io/medix-luvas/solar-teste/cliente.html";
const MES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
async function rest(caminho: string, opt: RequestInit = {}, token = SR) {
  const r = await fetch(`${SB}/rest/v1/${caminho}`, { ...opt, headers: { apikey: token === SR ? SR : ANON, Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(opt.headers || {}) } });
  const t = await r.text();
  if (!r.ok) throw new Error(`${caminho.split("?")[0]}: ${t.slice(0, 200)}`);
  return t ? JSON.parse(t) : null;
}
const n = (v: number, c = 0) => (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: c, maximumFractionDigits: c });
const brl = (v: number) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

function corpoEmail(u: any, g: { dia: string; kwh: number }[], ref: Date, tarifaPadrao: number) {
  const ano = ref.getFullYear(), m = ref.getMonth(), chave = `${ano}-${String(m + 1).padStart(2, "0")}`;
  const tarifa = Number(u.tarifa_kwh) || tarifaPadrao;
  const doMes = g.filter((x) => x.dia.startsWith(chave)), kwh = doMes.reduce((t, x) => t + x.kwh, 0);
  const esp = Number(u.esperado_mes) || 0, pct = esp ? kwh / esp : null;
  const melhor = doMes.reduce((a, x) => (x.kwh > (a ? a.kwh : -1) ? x : a), null as any);
  const meses = Array.from({ length: 12 }, (_, i) => { const d = new Date(ano, m - 11 + i, 1); const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; return { rot: MES[d.getMonth()].slice(0, 3), kwh: g.filter((x) => x.dia.startsWith(k)).reduce((t, x) => t + x.kwh, 0) }; });
  const max = Math.max(...meses.map((x) => x.kwh), esp, 1), anoKwh = meses.reduce((t, x) => t + x.kwh, 0);
  const nome = String(u.cliente_nome || "").split(" ")[0];
  const link = `${PORTAL}?t=${encodeURIComponent(u.token)}`;
  const barras = meses.map((x, i) => `<td style="vertical-align:bottom;padding:0 2px;text-align:center"><div style="height:${Math.max(Math.round((x.kwh / max) * 90), 3)}px;background:${i === 11 ? "#ff6700" : "#f6b37a"};border-radius:4px 4px 0 0"></div><div style="font-size:10px;color:#6a7590;margin-top:3px">${x.rot}</div></td>`).join("");
  const html = `<!doctype html><html><body style="margin:0;background:#f3f5f9;font-family:Arial,Helvetica,sans-serif;color:#1d283e">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f5f9;padding:20px 0"><tr><td align="center">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fff;border-radius:16px;overflow:hidden">
    <tr><td style="background:#1d283e;color:#fff;padding:22px 24px"><div style="font-size:12px;letter-spacing:.1em;text-transform:uppercase;opacity:.8">Relatório de ${MES[m]} de ${ano}</div>
      <div style="font-size:24px;font-weight:bold;margin-top:6px">Olá, ${esc(nome)}!</div><div style="opacity:.85;margin-top:4px">Sua usina solar de ${n(u.kwp, 2)} kWp${u.cidade ? " · " + esc(u.cidade) : ""}</div></td></tr>
    <tr><td style="padding:22px 24px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="background:#e7f5ea;border-radius:12px;padding:14px;width:50%"><div style="font-size:12px;color:#1e7a34;font-weight:bold">GEROU NO MÊS</div><div style="font-size:26px;font-weight:bold;color:#1e7a34">${n(kwh)} kWh</div></td>
        <td style="width:10px"></td>
        <td style="background:#fff4ec;border-radius:12px;padding:14px;width:50%"><div style="font-size:12px;color:#c44d00;font-weight:bold">ECONOMIA ESTIMADA</div><div style="font-size:26px;font-weight:bold;color:#c44d00">${brl(kwh * tarifa)}</div></td></tr></table>
      <p style="margin:16px 0 0;font-size:15px">${pct === null ? "" : pct >= 0.9 ? `✅ A usina gerou <b>${n(pct * 100)}%</b> do esperado para o mês. Está tudo certo.` : `⚠️ A usina gerou <b>${n(pct * 100)}%</b> do esperado. Pode ser clima ou sujeira: a nossa equipe já está acompanhando.`}${melhor ? ` Melhor dia: ${melhor.dia.split("-").reverse().join("/")}, com ${n(melhor.kwh, 1)} kWh.` : ""}</p>
      <div style="font-weight:bold;margin:20px 0 8px">Últimos 12 meses · ${n(anoKwh)} kWh (${brl(anoKwh * tarifa)})</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="height:110px"><tr>${barras}</tr></table>
      <div style="text-align:center;margin:24px 0 6px"><a href="${link}" style="display:inline-block;background:#ff6700;color:#fff;text-decoration:none;font-weight:bold;padding:14px 26px;border-radius:999px">Ver minha usina e as contas de luz</a></div>
      <p style="font-size:12px;color:#6a7590;text-align:center;margin:6px 0 0">Geração do dia, do mês, contas e créditos, a qualquer hora.</p>
    </td></tr>
    <tr><td style="background:#f8f9fb;padding:16px 24px;font-size:12px;color:#6a7590">Chama Solar · R. Otto Benz, 510 — Nova Ribeirânia, Ribeirão Preto/SP<br>Economia estimada pela tarifa de R$ ${n(tarifa, 2)}/kWh. Dúvidas? Responda este e-mail.</td></tr>
  </table></td></tr></table></body></html>`;
  const texto = `Olá, ${nome}! Em ${MES[m]} de ${ano} a sua usina gerou ${n(kwh)} kWh, cerca de ${brl(kwh * tarifa)} de economia. Veja a sua usina: ${link}`;
  return { assunto: `☀️ Sua usina gerou ${n(kwh)} kWh em ${MES[m]}`, html, texto, kwh };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const resp = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
  try {
    const cron = req.headers.get("x-sol-cron");
    if (cron) { const seg = await rest("rpc/sol_ler_credencial", { method: "POST", body: JSON.stringify({ p_marca: "cron" }) }); if (!seg || seg.segredo !== cron) return resp({ erro: "não autorizado" }, 401); }
    else { const tok = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, ""); const ok = tok && (await rest("rpc/eh_solar_admin", { method: "POST", body: "{}" }, tok).catch(() => false)); if (!ok) return resp({ erro: "não autorizado" }, 401); }
    const corpo = await req.json().catch(() => ({}));
    const cred = await rest("rpc/sol_ler_credencial", { method: "POST", body: JSON.stringify({ p_marca: "Email" }) });
    if (!cred || !cred.usuario || !cred.senha) return resp({ erro: "Guarde o e-mail e a senha em Parâmetros → Acessos → E-mail" }, 400);
    const hoje = new Date(Date.now() - 3 * 3600e3), ref = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 15), inicioMes = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-01`;
    let filtro = "sol_usinas?select=*&plano=eq.mensal&email=not.is.null&ativo=not.is.false";
    if (corpo.usina_id) filtro = `sol_usinas?select=*&id=eq.${Number(corpo.usina_id)}`;
    else if (!corpo.teste) filtro += `&or=(relatorio_enviado_em.is.null,relatorio_enviado_em.lt.${inicioMes})`;
    let usinas = await rest(filtro + "&order=id.asc");
    if (corpo.teste) usinas = usinas.slice(0, 1);
    const smtp = new SMTPClient({ connection: { hostname: cred.obs && /\./.test(cred.obs) ? cred.obs.trim() : "smtp.hostinger.com", port: 465, tls: true, auth: { username: cred.usuario.trim(), password: cred.senha } } });
    const desde = new Date(ref.getFullYear(), ref.getMonth() - 11, 1).toISOString().slice(0, 10);
    let enviados = 0; const erros: string[] = [];
    const t0 = Date.now(); let pendentes = 0;
    for (const u of usinas) {
      if (Date.now() - t0 > 110e3) { pendentes++; continue; } // o resto vai no dia seguinte
      try {
        const g = (await rest(`sol_geracao?select=dia,kwh&usina_id=eq.${u.id}&dia=gte.${desde}&order=dia.asc&limit=1000`)).map((x: any) => ({ dia: x.dia, kwh: Number(x.kwh) || 0 }));
        const e = corpoEmail(u, g, ref, 0.98);
        const para = corpo.teste ? String(corpo.teste) : String(u.email).split(/[;,]/)[0].trim();
        await smtp.send({ from: `Chama Solar <${cred.usuario.trim()}>`, to: para, replyTo: cred.usuario.trim(), subject: e.assunto, content: e.texto, html: e.html });
        enviados++;
        if (!corpo.teste) await rest("sol_usinas?id=eq." + u.id, { method: "PATCH", body: JSON.stringify({ relatorio_enviado_em: hoje.toISOString().slice(0, 10) }) });
        await new Promise((r) => setTimeout(r, 1200)); // devagar, para o provedor não barrar
      } catch (err) { erros.push(`${u.id}: ${String((err as Error).message || err).slice(0, 140)}`); }
    }
    await smtp.close().catch(() => {});
    await rest("sol_monitoramento_execucoes", { method: "POST", body: JSON.stringify({ marca: "E-mail mensal", ok: !erros.length || enviados > 0, erro: erros.length ? erros.slice(0, 5).join(" | ") : null, resumo: { enviados, pendentes, total: usinas.length, teste: !!corpo.teste } }) }).catch(() => {});
    return resp({ ok: true, enviados, pendentes, total: usinas.length, erros: erros.slice(0, 10) });
  } catch (e) {
    return resp({ erro: String((e as Error).message || e).slice(0, 300) }, 500);
  }
});
