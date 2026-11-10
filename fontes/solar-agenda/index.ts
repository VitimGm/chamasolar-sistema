// Edge Function sol-agenda: agenda do dia da Chama Solar em formato iCalendar (.ics)
// O Google Agenda assina este endereço (link com chave secreta, guardada no cofre).
// Só leitura. Mostra os próximos contatos da cadência e os alertas das usinas.
const SB = Deno.env.get("SUPABASE_URL")!;
const SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
async function rest(c: string, opt: RequestInit = {}) {
  const r = await fetch(`${SB}/rest/v1/${c}`, { ...opt, headers: { apikey: SR, Authorization: `Bearer ${SR}`, "Content-Type": "application/json" } });
  const t = await r.text(); if (!r.ok) throw new Error(t.slice(0, 200)); return t ? JSON.parse(t) : null;
}
// ---- mesma regra de cadência do app (js/cadencia.js, copiado ao publicar) ----
import "./janela.js";
import "./cadencia.js";
const g: any = globalThis as any;
const Cad = g.Cadencia;

const esc = (s: string) => String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
const dobra = (l: string) => l.length <= 74 ? l : l.match(/.{1,74}/g)!.join("\r\n ");
// horário de Brasília (UTC-3, sem horário de verão)
const quando = (d: Date, hh: number, mm: number) => { const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hh + 3, mm)); return x.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z"; };
const diaBR = (ms: number) => { const d = new Date(ms - 3 * 3600e3); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); };

Deno.serve(async (req) => {
  const k = new URL(req.url).searchParams.get("k") || "";
  const seg = await rest("rpc/sol_ler_credencial", { method: "POST", body: JSON.stringify({ p_marca: "ics" }) });
  if (!seg || !seg.segredo || seg.segredo !== k) return new Response("não autorizado", { status: 401 });
  const [o, ev, it, us] = await Promise.all([
    rest("sol_orcamentos?select=id,codigo,token_publico,status,dados,enviado_em&limit=2000"),
    rest("sol_proposta_eventos?select=orcamento_id,tipo,em&order=em.asc&limit=20000"),
    rest("sol_interacoes?select=orcamento_id,texto,em&limit=5000"),
    rest("sol_usinas?select=id,cliente_nome,ativo&ativo=is.true"),
  ]);
  const agora = Date.now(), hoje = diaBR(agora);
  const linhas = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Chama Solar//Agenda//PT-BR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:Chama Solar · contatos", "X-WR-TIMEZONE:America/Sao_Paulo", "REFRESH-INTERVAL;VALUE=DURATION:PT4H", "X-PUBLISHED-TTL:PT4H"];
  const app = "https://chamaeescritorio1-boop.github.io/medix-luvas/solar-teste/";
  let n = 0;
  for (const r of o) {
    const d = r.dados || {};
    const orc = { ...d, id: r.codigo, status: r.status, enviadoEm: r.enviado_em || d.enviadoEm || null };
    const evs = ev.filter((e: any) => e.orcamento_id === r.id);
    const ints = it.filter((i: any) => i.orcamento_id === r.id);
    const p = Cad.proximo(orc, evs, ints, agora);
    if (!p) continue;
    if (p.vence > agora + 7 * 864e5) continue; // só a próxima semana
    const dia = p.vence < agora ? hoje : diaBR(p.vence);
    const lig = p.canal === "ligacao";
    // ligações no fim da tarde (17h30), mensagens de manhã (8h); novos leads às 8h
    const [hh, mm] = lig ? [17, 30] : [8, 0];
    const fim = lig ? [17, 45] : [8, 10];
    const titulo = `☀️ ${lig ? "📞 Ligar" : "💬 WhatsApp"} · ${orc.nome || r.codigo} · ${p.titulo}`;
    const desc = `${p.porque}\nPasso ${p.id} da cadência${p.atrasoDias > 0 ? ` (${p.atrasoDias} dia(s) de atraso)` : ""}.\nAbrir o cliente: ${app}#lead-${r.codigo}`;
    linhas.push("BEGIN:VEVENT", `UID:sol-${r.codigo}-${p.id}@chamasolar`, `DTSTAMP:${quando(hoje, 0, 0)}`, `DTSTART:${quando(dia, hh, mm)}`, `DTEND:${quando(dia, fim[0], fim[1])}`,
      dobra(`SUMMARY:${esc(titulo)}`), dobra(`DESCRIPTION:${esc(desc)}`), dobra(`URL:${app}#lead-${r.codigo}`), "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:Chama Solar", "TRIGGER:-PT5M", "END:VALARM", "END:VEVENT");
    n++;
  }
  // bloco fixo diário (seg a sáb): revisar o painel
  linhas.push("BEGIN:VEVENT", "UID:sol-bloco-diario@chamasolar", `DTSTAMP:${quando(hoje, 0, 0)}`, `DTSTART:${quando(new Date(Date.UTC(2026, 10, 2)), 7, 45)}`, `DTEND:${quando(new Date(Date.UTC(2026, 10, 2)), 8, 0)}`, "RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR,SA",
    dobra(`SUMMARY:${esc("☀️ Chama Solar · abrir o Meu dia (15 min)")}`), dobra(`DESCRIPTION:${esc("Ver quem chamar hoje, responder leads novos e conferir as usinas.\n" + app + "#dia")}`), "END:VEVENT");
  linhas.push("END:VCALENDAR");
  return new Response(linhas.join("\r\n") + "\r\n", { headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "no-store" } });
});
