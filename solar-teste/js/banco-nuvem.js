/* =====================================================================
   Banco OFICIAL (Supabase chamae-apps) — mesma interface do banco.js.
   - Usa o MESMO login do Chamae (localStorage "chamae_sess", mesmo site).
   - Leituras são síncronas (vêm do cache carregado no início); gravações
     vão para a fila e sobem para o Supabase em ordem, com nova tentativa.
   - O cliente (sem login) só enxerga a VITRINE: preço final congelado,
     equipamentos e economia. Nenhum custo, margem ou valor de kit.
   Carregar no lugar de banco.js e esperar Banco.pronto antes do app.
   ===================================================================== */
(function (raiz) {
  'use strict';
  const D = raiz.DadosTeste;
  const SB = 'https://jmpvmyyokikpwphwylob.supabase.co';
  const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptcHZteXlva2lrcHdwaHd5bG9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyMTc1MzEsImV4cCI6MjEwNzc5MzUzMX0.e5XT2R7eOj3x-ZYcRFkY4OFg0QEr3_guxT6-W0xpnfY';
  const LOGIN_CHAMAE = '../chamae/';
  const LOCAL = 'sol3_'; // só rascunho e etapa ficam no aparelho

  const json = (o) => JSON.parse(JSON.stringify(o, (k, v) => (v === Infinity ? 1e9 : v)));
  const agora = () => new Date().toISOString();
  const lerL = (k, padrao) => { try { const v = localStorage.getItem(LOCAL + k); return v ? JSON.parse(v) : padrao; } catch { return padrao; } };
  const gravarL = (k, v) => { try { localStorage.setItem(LOCAL + k, JSON.stringify(v)); } catch { /* sem armazenamento */ } };
  const novoToken = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');

  /* ---------- login: o mesmo do Chamae ---------- */
  const G = (k) => { try { return JSON.parse(localStorage.getItem('chamae_' + k)); } catch { return null; } };
  const S = (k, v) => { try { localStorage.setItem('chamae_' + k, JSON.stringify(v)); } catch { /* */ } };
  async function token() {
    const st = G('sess');
    if (!st || !st.rt) return null;
    if (Date.now() < st.exp) return st.at;
    const renova = async () => {
      const cur = G('sess'); if (cur && Date.now() < cur.exp) return cur.at;
      try {
        const r = await fetch(SB + '/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: (cur || st).rt }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) { if (/invalid|expired|not found|already used|revoked/i.test(j.error_description || j.msg || '')) S('sess', null); return null; }
        S('sess', { at: j.access_token, rt: j.refresh_token, exp: Date.now() + (j.expires_in - 60) * 1000, uid: j.user && j.user.id, email: j.user && j.user.email });
        return j.access_token;
      } catch { const ag = G('sess'); return ag && Date.now() < ag.exp ? ag.at : null; }
    };
    return navigator.locks ? navigator.locks.request('chamae-auth', renova) : renova();
  }
  async function api(caminho, opt = {}, anonimo = false) {
    const t = anonimo ? null : await token();
    if (!anonimo && !t) throw new Error('sem-login');
    const r = await fetch(SB + '/rest/v1/' + caminho, { ...opt, headers: { apikey: KEY, Authorization: 'Bearer ' + (t || KEY), 'Content-Type': 'application/json', ...(opt.headers || {}) } });
    const tx = await r.text();
    if (!r.ok) throw new Error(tx.slice(0, 300) || 'HTTP ' + r.status);
    return tx ? JSON.parse(tx) : null;
  }

  /* ---------- aviso discreto de gravação ---------- */
  function aviso(txt, ruim) {
    let el = document.getElementById('nuvem-aviso');
    if (!el) { el = document.createElement('div'); el.id = 'nuvem-aviso'; el.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:99;padding:6px 12px;border-radius:999px;font:600 13px system-ui;box-shadow:0 4px 16px #0004;transition:opacity .4s'; document.body.appendChild(el); }
    el.textContent = txt; el.style.background = ruim ? '#b3261e' : '#1d6b3a'; el.style.color = '#fff'; el.style.opacity = '1';
    clearTimeout(aviso.t); if (!ruim) aviso.t = setTimeout(() => { el.style.opacity = '0'; }, 1800);
  }

  /* ---------- cache ---------- */
  let orcs = [], eventos = [], interacoes = [], paramVigente = {}, publico = null;
  const dbid = {}; // ORC-0001 -> id no banco

  function linhaParaOrc(r) {
    dbid[r.codigo] = r.id;
    return { ...(r.dados || {}), id: r.codigo, token: r.token_publico, status: r.status, enviadoEm: r.enviado_em || (r.dados || {}).enviadoEm || null };
  }

  /* ---------- vitrine: o que o cliente pode ver ---------- */
  function paramsPublicos(p) {
    const z = json(p);
    Object.assign(z, { maoDeObraPorPlaca: 0, art: 0, materialCaBase: 0, materialCaPorKwp: 0, fretePadrao: 0, freteIncluso: true, custoKm: 0, trocaPadrao: 0,
      reservaGarantia: 0, custoFixoMes: 0, obrasPrevistasMes: 1, impostoTotal: 0, impostoServico: 0, reservaNegociacao: 0 });
    z.taxaPagamento = Object.fromEntries(Object.keys(p.taxaPagamento || {}).map((k) => [k, 0]));
    z.margens = (p.margens || []).map((m) => ({ ...m, margem: 0 }));
    z.engenharia = (p.engenharia || []).map((f) => ({ ...f, valor: 0 }));
    return z;
  }
  function vitrineDe(o) {
    const C = raiz.Conversao;
    if (!C || !o.kitsFechados || !o.kitsFechados.some(Boolean)) return null;
    const p = Banco.parametros();
    const ops = C.opcoes(o, p);
    const kits = o.kitsFechados.filter(Boolean).map((k) => {
      const op = ops.find((x) => x.nivel === k.nivel);
      const { numeroBelenergy, valorProdutos, ...resto } = k; // eslint-disable-line no-unused-vars
      return { ...resto, valorKit: op ? Math.round(op.preco.precoFinal * 100) / 100 : 0, frete: '' };
    });
    const cliente = { ...o, kitsFechados: kits, comissaoParceria: 0, descontoPct: 0, kitFaturadoDireto: false, distanciaKm: 0 };
    ['whatsapp', 'email', 'documento', 'endereco', 'selKits', 'freteAuto', 'motivoPerda', 'origem', 'interacoes', 'aceite'].forEach((c) => delete cliente[c]);
    return { orc: json(cliente), parametros: paramsPublicos(p), geradoEm: agora() };
  }

  /* ---------- fila de gravação (em ordem, com nova tentativa) ---------- */
  let fila = Promise.resolve(), pendentes = 0;
  function enfileirar(fn) {
    pendentes++;
    const tentar = async (n) => { try { await fn(); } catch (e) { if (e.message === 'sem-login') { aviso('Entre de novo no Chamae para salvar', true); throw e; } if (n < 4) { aviso('Sem conexão: tentando salvar de novo…', true); await new Promise((r) => setTimeout(r, 1500 * (n + 1))); return tentar(n + 1); } aviso('Não salvou. Confira a internet e toque em salvar de novo.', true); throw e; } };
    fila = fila.then(() => tentar(0)).then(() => { if (--pendentes === 0) aviso('Salvo ✓'); }, () => { pendentes--; });
    return fila;
  }
  function subirOrc(o) {
    return enfileirar(async () => {
      const corpo = { codigo: o.id, token_publico: o.token, status: o.status || 'novo', dados: json(o), enviado_em: o.enviadoEm || null, origem: o.origem || null,
        motivo_perda: o.motivoPerda || null, vitrine: o.status && o.status !== 'novo' ? vitrineDe(o) : null };
      const r = await api('sol_orcamentos?on_conflict=codigo&select=id,codigo', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify(corpo) });
      if (r && r[0]) dbid[r[0].codigo] = r[0].id;
    });
  }

  const Banco = {
    nuvem: true,
    cepInfo(cep) { const d = String(cep).replace(/\D/g, ''); return d.length >= 5 ? D.ceps.find((c) => d.startsWith(c.prefixo)) || null : null; },

    parametros() { return publico ? json(publico.parametros) : Object.assign(json(D.parametros), json(paramVigente)); },
    salvarParametros(p) {
      paramVigente = json(p);
      enfileirar(async () => {
        await api('sol_parametros?vigente=eq.true', { method: 'PATCH', body: JSON.stringify({ vigente: false }) });
        await api('sol_parametros', { method: 'POST', body: JSON.stringify({ vigente: true, dados: paramVigente }) });
      });
    },
    zerarParametros() { this.salvarParametros({}); },

    orcamentos() { return publico ? [publico.orc] : orcs; },
    obter(id) { return this.orcamentos().find((o) => o.id === id) || null; },
    porToken(t) { return this.orcamentos().find((o) => o.token === t) || null; },
    salvar(o) {
      if (publico) return o;
      if (!o.id) {
        const n = orcs.reduce((m, x) => Math.max(m, +String(x.id).replace(/\D/g, '') || 0), 0) + 1;
        o.id = 'ORC-' + String(n).padStart(4, '0');
        o.token = o.token && o.token.length >= 20 ? o.token : novoToken();
        o.criadoEm = o.criadoEm || agora();
      }
      if (!o.token || o.token.length < 20) o.token = novoToken();
      o.atualizadoEm = agora();
      const i = orcs.findIndex((x) => x.id === o.id);
      i >= 0 ? (orcs[i] = json(o)) : orcs.unshift(json(o));
      subirOrc(json(o));
      return o;
    },

    eventos(t) { return eventos.filter((e) => !t || e.token === t); },
    evento(t, tipo, dados = {}) {
      eventos.push({ token: t, tipo, dados, em: agora() });
      api('rpc/sol_registrar_evento', { method: 'POST', body: JSON.stringify({ p_token: t, p_tipo: tipo, p_dados: dados || {} }) }, true).catch(() => { /* cliente sem internet: segue */ });
    },

    interacoes(id) { return interacoes.filter((i) => i.orcId === id).sort((a, b) => b.em.localeCompare(a.em)); },
    interacao(orcId, tipo, texto) {
      interacoes.push({ orcId, tipo, texto, em: agora() });
      enfileirar(async () => {
        if (!dbid[orcId]) { const r = await api('sol_orcamentos?select=id&codigo=eq.' + encodeURIComponent(orcId)); if (r[0]) dbid[orcId] = r[0].id; }
        if (dbid[orcId]) await api('sol_interacoes', { method: 'POST', body: JSON.stringify({ orcamento_id: dbid[orcId], tipo: ['whatsapp', 'ligacao', 'visita', 'nota', 'agente'].includes(tipo) ? tipo : 'nota', texto }) });
      });
    },

    semear() { /* no oficial não existem leads de exemplo */ },
    zerarTudo() { ['rascunho', 'etapa'].forEach((k) => { try { localStorage.removeItem(LOCAL + k); } catch { /* */ } }); },
    rascunho: { ler: () => lerL('rascunho', null), gravar: (v) => gravarL('rascunho', v), etapa: () => lerL('etapa', 0), gravarEtapa: (e) => gravarL('etapa', e) },

    /* carrega tudo do banco (vendedor logado) */
    async carregar() {
      const [o, ev, it, pr] = await Promise.all([
        api('sol_orcamentos?select=id,codigo,token_publico,status,dados,enviado_em&order=atualizado_em.desc&limit=2000'),
        api('sol_proposta_eventos?select=orcamento_id,tipo,dados,em&order=em.asc&limit=20000'),
        api('sol_interacoes?select=orcamento_id,tipo,texto,em&order=em.desc&limit=5000'),
        api('sol_parametros?select=dados&vigente=eq.true&limit=1'),
      ]);
      orcs = o.map(linhaParaOrc);
      const porId = Object.fromEntries(o.map((r) => [r.id, r]));
      eventos = ev.map((e) => ({ token: (porId[e.orcamento_id] || {}).token_publico, tipo: e.tipo, dados: e.dados, em: e.em }));
      interacoes = it.map((i) => ({ orcId: (porId[i.orcamento_id] || {}).codigo, tipo: i.tipo, texto: i.texto, em: i.em }));
      paramVigente = (pr[0] && pr[0].dados) || {};
    },
    /* proposta aberta pelo cliente: só a vitrine, pelo token */
    async carregarPublica(t) {
      const v = await api('rpc/sol_proposta_publica', { method: 'POST', body: JSON.stringify({ p_token: t }) }, true);
      if (!v || !v.orc) return false;
      publico = { orc: { ...v.orc, token: v.token, status: v.status }, parametros: v.parametros };
      return true;
    },
  };

  /* ---------- início ---------- */
  async function iniciar() {
    const pagina = document.body.dataset.pagina; // 'central' | 'proposta'
    const qs = new URLSearchParams(location.search);
    const t = await token().catch(() => null);
    let ehSolar = false;
    if (t) ehSolar = await api('rpc/eh_solar', { method: 'POST', body: '{}' }).catch(() => false);
    if (pagina === 'proposta' && qs.get('t') && !(ehSolar && qs.get('v') === '1')) {
      if (!(await Banco.carregarPublica(qs.get('t')).catch(() => false))) Banco.orcamentos = () => [];
      return;
    }
    if (!t) { document.body.innerHTML = '<div style="max-width:520px;margin:15vh auto;padding:24px;font:18px system-ui;color:#fff;text-align:center">Entre primeiro no Chamae com o seu usuário.<br>Depois volte aqui pelo cartão <b>Chama Solar</b> em Fábricas.<br><br><a style="color:#ffb066" href="' + LOGIN_CHAMAE + '">Abrir o Chamae</a></div>'; throw new Error('sem-login'); }
    if (!ehSolar) { document.body.innerHTML = '<div style="max-width:520px;margin:15vh auto;padding:24px;font:18px system-ui;color:#fff;text-align:center">Seu usuário ainda não tem acesso ao Chama Solar.<br><br><a style="color:#ffb066" href="' + LOGIN_CHAMAE + '">Voltar ao Chamae</a></div>'; throw new Error('sem-acesso'); }
    await Banco.carregar();
    // atualiza o painel quando o cliente mexe na proposta
    setInterval(async () => { if (document.hidden || pendentes) return; try { const antes = eventos.length; await Banco.carregar(); if (eventos.length !== antes) dispatchEvent(new StorageEvent('storage', { key: 'sol2_eventos' })); } catch { /* */ } }, 60000);
  }
  Banco.pronto = raiz.SOLAR_SEM_INICIO ? Promise.resolve() : iniciar();
  Banco.vitrineDe = vitrineDe;
  Banco._paramsPublicos = paramsPublicos;
  raiz.Banco = Banco;
})(window);
