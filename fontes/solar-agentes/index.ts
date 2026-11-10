// Edge Function: solar-agentes
// POST { agente: "diagnostico" | "roteirista" | "objecoes" | "followup" | "comparador" | "analista", contexto: {...} }
// Só responde para usuário logado com acesso ao módulo solar (eh_solar()).
// Segredos: ANTHROPIC_API_KEY (obrigatório), SOLAR_MODELO (opcional).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { AGENTES, BASE } from './prompts.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const { data: pode, error: erroAcesso } = await supabase.rpc('eh_solar');
    if (erroAcesso || !pode) return json({ erro: 'Sem acesso ao módulo solar.' }, 403);

    const { agente, contexto } = await req.json();
    const missao = AGENTES[agente];
    if (!missao) return json({ erro: `Agente desconhecido: ${agente}` }, 400);

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: Deno.env.get('SOLAR_MODELO') ?? 'claude-sonnet-5-5',
        max_tokens: 2000,
        system: `${BASE}\n\n${missao}`,
        messages: [{ role: 'user', content: `CONTEXTO:\n${JSON.stringify(contexto)}` }],
      }),
    });
    if (!resp.ok) return json({ erro: 'Falha na IA', detalhe: await resp.text() }, 502);
    const corpo = await resp.json();
    const texto: string = corpo.content?.find((c: { type: string }) => c.type === 'text')?.text ?? '';
    const inicio = texto.indexOf('{'), fim = texto.lastIndexOf('}');
    const saida = JSON.parse(texto.slice(inicio, fim + 1));

    // guarda a execução para auditoria / aprendizado (tabela da migração 002)
    await supabase.from('sol_agentes_execucoes').insert({
      agente, orcamento_id: contexto?.orcamentoId ?? null, saida, modelo: corpo.model, tokens: corpo.usage ?? null,
    });
    return json(saida);
  } catch (e) {
    return json({ erro: String(e) }, 500);
  }
});

function json(dados: unknown, status = 200) {
  return new Response(JSON.stringify(dados), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}
