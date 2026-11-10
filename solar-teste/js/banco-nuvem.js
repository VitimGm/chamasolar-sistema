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
  const AVULSO = (o) => !!o && (o.tipo === 'servico' || o.tipo === 'manutencao' || o.tipo === 'ampliacao');
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
  /* o banco devolve no máximo 1000 linhas por vez: busca a geração em páginas, 6 de cada vez */
  async function geracaoPaginada(desde) {
    const todas = []; let pag = 0, fim = false;
    while (!fim) {
      const lote = await Promise.all(Array.from({ length: 6 }, (_, k) => api('sol_geracao?select=usina_id,dia,kwh&dia=gte.' + desde + '&order=usina_id.asc,dia.asc&limit=1000&offset=' + (pag + k) * 1000)));
      lote.forEach((l) => { todas.push(...l); if (l.length < 1000) fim = true; });
      pag += 6; if (pag > 300) break;
    }
    return todas;
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
  let orcs = [], eventos = [], interacoes = [], paramVigente = {}, publico = null, usinas = [], geracaoPor = {}, modelos = {}; let leituraPor = {};
  const dbid = {}; // ORC-0001 -> id no banco

  function linhaParaOrc(r) {
    dbid[r.codigo] = r.id;
    return { ...(r.dados || {}), id: r.codigo, token: r.token_publico, status: r.status, enviadoEm: r.enviado_em || (r.dados || {}).enviadoEm || null };
  }

  /* ---------- vitrine: o que o cliente pode ver ---------- */
  function paramsPublicos(p) {
    const z = json(p);
    Object.assign(z, { maoDeObraPorPlaca: 0, art: 0, materialCaBase: 0, materialCaPorKwp: 0, fretePadrao: 0, freteIncluso: true, custoKm: 0, trocaPadrao: 0,
      reservaGarantia: 0, custoFixoMes: 0, obrasPrevistasMes: 1, kwpPrevistosMes: 0, kitRefWp: 0, impostoTotal: 0, impostoServico: 0, reservaNegociacao: 0 });
    z.taxaPagamento = Object.fromEntries(Object.keys(p.taxaPagamento || {}).map((k) => [k, 0]));
    if (z.cartao) z.cartao = { ...z.cartao, taxas: null }; // o preço do cliente já vem com a taxa do cartão
    z.margens = (p.margens || []).map((m) => ({ ...m, margem: 0 }));
    z.engenharia = (p.engenharia || []).map((f) => ({ ...f, valor: 0 }));
    delete z.groner;
    return z;
  }
  function vitrineDe(o) {
    if (AVULSO(o)) { // serviço/manutenção: só os preços finais, nunca custo e margem
      const p = Banco.parametros(), c = raiz.Avulso ? raiz.Avulso.calcular(o, p) : null; if (!c) return null;
      const cliente = raiz.Avulso.publico(o, c);
      return { orc: json(cliente), parametros: { tarifaKwh: p.tarifaKwh, taxaPagamento: { cartao: c.pagamento && Number.isFinite(c.pagamento.taxa) ? c.pagamento.taxa : ((p.taxaPagamento || {}).cartao ?? 0.09) } }, geradoEm: agora() };
    }
    const C = raiz.Conversao;
    if (!C || !o.kitsFechados || !o.kitsFechados.some(Boolean)) return null;
    const p = Banco.parametros();
    const ops = C.opcoes(o, p);
    const kits = o.kitsFechados.filter(Boolean).map((k) => {
      const op = ops.find((x) => x.nivel === k.nivel);
      const { numeroBelenergy, valorProdutos, ...resto } = k; // eslint-disable-line no-unused-vars
      return { ...resto, valorKit: op ? Math.round(op.preco.precoFinal * 100) / 100 : 0, frete: '' };
    });
    const cliente = { ...o, kitsFechados: kits, comissaoParceria: 0, descontoPct: 0, kitFaturadoDireto: false, distanciaKm: 0, trocaPadrao: false };
    ['custosExtras', 'custosAjustados', 'margemManual', 'precoModo', 'precoManual'].forEach((c) => delete cliente[c]); // o preço final já inclui tudo isso
    ['whatsapp', 'email', 'documento', 'endereco', 'selKits', 'freteAuto', 'motivoPerda', 'origem', 'interacoes', 'aceite', 'contrato', 'indicadoPor', 'posVenda', 'presenteEntregue', 'mensagem', 'contaInformada'].forEach((c) => delete cliente[c]);
    if (cliente.projeto3d) { // o 3D vai; o endereço exato e os ids internos não
      const { endereco, lng, precisao, ...p3 } = cliente.projeto3d; void endereco; void lng; void precisao;
      const semId = (x) => (x ? (({ id, auto, ...r }) => { void id; void auto; return r; })(x) : x);
      const { cabos, ...res3 } = p3.resultado || {}; void cabos;
      cliente.projeto3d = { ...p3, lat: Math.round((p3.lat || -21.2) * 10) / 10, fundo: semId(p3.fundo), drone: semId(p3.drone), pvgis: p3.pvgis ? { db: p3.pvgis.db, faces: p3.pvgis.faces } : null, resultado: p3.resultado ? res3 : p3.resultado, cabos: null, pistas: null };
    }
    if (o.posVenda) cliente.obra = Object.fromEntries(Object.entries(o.posVenda).filter(([, v]) => v)); // só as datas das etapas, para o cliente acompanhar
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
      paramVigente = { ...paramVigente, ...json(p) };
      enfileirar(async () => {
        await api('sol_parametros?vigente=eq.true', { method: 'PATCH', body: JSON.stringify({ vigente: false }) });
        await api('sol_parametros', { method: 'POST', body: JSON.stringify({ vigente: true, dados: paramVigente }) });
      });
    },
    zerarParametros() { this.salvarParametros({}); },
    /* fila do robô do escritório (Jarvis e pré-propostas) */
    async filaRobo(item) { return api('sol_robo_fila', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(item) }); },
    async filaRoboLer() { return api('sol_robo_fila?select=id,criado,atualizado,orc_codigo,tipo,status,resultado,erro,pedido&order=criado.desc&limit=60'); },
    async filaRoboMarcar(id, campos) { return api('sol_robo_fila?id=eq.' + id, { method: 'PATCH', body: JSON.stringify({ ...campos, atualizado: agora() }) }); },
    /* arquivo da Groner: fica no banco e só vem quando procura (são centenas) */
    async arquivoGroner(busca, pagina = 0) {
      const q = String(busca || '').replace(/[*,()]/g, ' ').trim();
      const f = q ? `&or=(dados->>nome.ilike.*${encodeURIComponent(q)}*,dados->>whatsapp.ilike.*${encodeURIComponent(q.replace(/\D/g, '') || q)}*,dados->>arquivadoMotivo.ilike.*${encodeURIComponent(q)}*)` : '';
      const r = await api(`sol_orcamentos?select=id,codigo,token_publico,status,dados,enviado_em&dados->>origem=eq.groner&dados->>arquivado=eq.true${f}&order=atualizado_em.desc&limit=40&offset=${pagina * 40}`);
      return r.map(linhaParaOrc).filter((o) => !orcs.some((x) => x.id === o.id));
    },
    async contarGroner() { const t = await token(); const r = await fetch(SB + '/rest/v1/sol_orcamentos?select=id&dados->>origem=eq.groner&dados->>arquivado=eq.true', { headers: { apikey: KEY, Authorization: 'Bearer ' + t, Prefer: 'count=exact', Range: '0-0' } }); return +((r.headers.get('content-range') || '').split('/')[1] || 0); },
    trazer(o) { if (!orcs.some((x) => x.id === o.id)) orcs.unshift(o); return o; },
    /* documentos e fotos de cada cliente (Storage privado sol-arquivos) */
    async arquivosCliente(orc) { return api('sol_cliente_arquivos?select=id,pasta,nome,caminho,tipo,tamanho,criado,origem&orc_codigo=eq.' + encodeURIComponent(orc) + '&order=pasta.asc,criado.asc'); },
    async linkArquivo(caminho, validade = 3600) { const t = await token(); const r = await fetch(SB + '/storage/v1/object/sign/sol-arquivos/' + caminho.split('/').map(encodeURIComponent).join('/'), { method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: validade }) }); const j = await r.json(); if (!r.ok) throw new Error(j.message || 'sem link'); return SB + '/storage/v1' + j.signedURL; },
    async enviarArquivo(orc, pasta, arq) {
      const t = await token(), limpo = (x) => String(x).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9._ -]+/g, '').replace(/\s+/g, '_').slice(0, 90) || 'arquivo';
      const caminho = `${orc}/${limpo(pasta)}/${Date.now().toString(36)}_${limpo(arq.name)}`;
      const r = await fetch(SB + '/storage/v1/object/sol-arquivos/' + caminho, { method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + t, 'Content-Type': arq.type || 'application/octet-stream' }, body: arq });
      if (!r.ok) throw new Error((await r.text()).slice(0, 160));
      return api('sol_cliente_arquivos', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ orc_codigo: orc, pasta, nome: arq.name, caminho, tipo: arq.type, tamanho: arq.size, origem: 'sistema' }) });
    },
    async apagarArquivo(a) { const t = await token(); await fetch(SB + '/storage/v1/object/sol-arquivos/' + a.caminho, { method: 'DELETE', headers: { apikey: KEY, Authorization: 'Bearer ' + t } }); return api('sol_cliente_arquivos?id=eq.' + a.id, { method: 'DELETE' }); },
    async armazenamento() { return api('rpc/sol_armazenamento', { method: 'POST', body: '{}' }); },
    async parceiros() { return api('sol_parceiros?select=id,criado,nome,whatsapp,email,pix,cidade,profissao,nivel,comissao,ativo,token,obs,ultimo_acesso&order=criado.desc'); },
    async salvarParceiro(id, campos) { return api('sol_parceiros?id=eq.' + id, { method: 'PATCH', body: JSON.stringify(campos) }); },
    async indicacoes() { return api('sol_indicacoes?select=*&order=criado.desc&limit=1000'); },
    async salvarIndicacao(id, campos) { return api('sol_indicacoes?id=eq.' + id, { method: 'PATCH', body: JSON.stringify({ ...campos, atualizado: agora() }) }); },
    async roboStatus() { const r = await api('sol_robo_status?select=visto,versao,logado,maquina,info&id=eq.1'); return (r || [])[0] || null; },
    /* histórico de preço dos kits (Radar): cada cotação real da Belenergy vira uma linha */
    /* vídeo de apresentação da proposta: link temporário (2 h) pelo token público da proposta */
    async videoProposta(token) { const r = await fetch(SB + '/functions/v1/sol-proposta-video', { method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) }); if (!r.ok) throw new Error('vídeo indisponível'); return r.json(); },
    async kitPrecos(dias = 90) { return api('sol_kit_precos?select=id,cotado_em,origem,orc_codigo,nivel,kwp,ligacao,estrutura,detalhe,modulo_sku,modulo_marca,modulo_w,modulo_qtd,modulo_preco,inversor_sku,inversor_marca,inversor_qtd,inversor_kw,inversor_preco,valor_kit,rs_wp,estrutura_valor,desconto&cotado_em=gte.' + new Date(Date.now() - dias * 864e5).toISOString() + '&order=cotado_em.desc&limit=2000'); },
    async registrarPrecoKit(k, m = {}) { return api('rpc/sol_kit_preco_registrar', { method: 'POST', body: JSON.stringify({ p_kit: k, p_origem: m.origem || 'sistema', p_orc: m.orc || null, p_ligacao: m.ligacao || null }) }); },
    async roboChave() { return api('rpc/sol_robo_chave', { method: 'POST', body: '{}' }); },

    todos() { return publico ? [publico.orc] : orcs; },
    orcamentos() { return this.todos().filter((o) => !AVULSO(o) && !o.arquivado && !o.carteira && !o.apagado); }, // serviços, manutenções e o arquivo ficam fora das listas do funil
    arquivados() { return this.todos().filter((o) => !AVULSO(o) && o.arquivado && !o.apagado); },
    lixeira() { return this.todos().filter((o) => o.apagado); },
    async excluirDeVez(id) { const i = orcs.findIndex((o) => o.id === id); if (i >= 0) orcs.splice(i, 1); await enfileirar(() => api('sol_orcamentos?codigo=eq.' + encodeURIComponent(id), { method: 'DELETE' })); },

    clientes() { return this.todos().filter((o) => !AVULSO(o) && !o.juntadoEm && !o.apagado && (o.status === 'ganho' || o.carteira)); },
    avulsos() { return this.todos().filter(AVULSO); },
    obter(id) { return this.todos().find((o) => o.id === id) || null; },
    porToken(t) { return this.todos().find((o) => o.token === t) || null; },
    salvar(o) {
      if (publico) return o;
      if (!o.id) {
        const pre = AVULSO(o) ? 'SRV-' : 'ORC-', n = orcs.filter((x) => String(x.id).startsWith(pre)).reduce((m, x) => Math.max(m, +String(x.id).replace(/\D/g, '') || 0), 0) + 1;
        o.id = pre + String(n).padStart(4, '0');
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

    /* ---------- usinas instaladas e geração diária ---------- */
    usinas() { return usinas; },
    geracao(id) { return (geracaoPor[id] || []).slice(); },
    /* todo o histórico de uma usina (desde a instalação), em páginas */
    async geracaoTudo(id) {
      const todas = [];
      for (let pag = 0; pag < 30; pag++) { const l = await api('sol_geracao?select=dia,kwh&usina_id=eq.' + Number(id) + '&order=dia.asc&limit=1000&offset=' + pag * 1000); todas.push(...l.map((g) => ({ dia: g.dia, kwh: +g.kwh }))); if (l.length < 1000) break; }
      return todas;
    },
    leitura(id) { return leituraPor[id] || null; },
    async salvarUsina(u) {
      const campos = ['orcamento_id', 'cliente_nome', 'whatsapp', 'email', 'plano', 'cidade', 'kwp', 'marca', 'plataforma_id', 'ligada_em', 'esperado_mes', 'tarifa_kwh', 'ativo', 'obs'];
      const corpo = Object.fromEntries(campos.filter((c) => u[c] !== undefined).map((c) => [c, u[c] === '' ? null : u[c]]));
      const r = u.id ? await api('sol_usinas?id=eq.' + u.id, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(corpo) })
        : await api('sol_usinas', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(corpo) });
      const salvo = r[0]; const i = usinas.findIndex((x) => x.id === salvo.id); i >= 0 ? (usinas[i] = salvo) : usinas.push(salvo); aviso('Salvo ✓'); return salvo;
    },
    async gravarGeracao(id, linhas) {
      for (let i = 0; i < linhas.length; i += 500) await api('sol_geracao?on_conflict=usina_id,dia', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify(linhas.slice(i, i + 500).map((l) => ({ usina_id: id, dia: l.dia, kwh: l.kwh, origem: 'planilha' }))) });
      const m = Object.fromEntries((geracaoPor[id] || []).map((l) => [l.dia, l])); linhas.forEach((l) => { m[l.dia] = { dia: l.dia, kwh: l.kwh }; });
      geracaoPor[id] = Object.values(m).sort((a, b) => a.dia.localeCompare(b.dia)); aviso('Salvo ✓'); return linhas.length;
    },

    modelo(chave) { return modelos[chave] || null; },
    async agendaLink() { return api('rpc/sol_agenda_link', { method: 'POST', body: '{}' }); },
    /* telhado pelo satélite (Google, chave no servidor) */
    async telhado(q) {
      const t = await token(); if (!t) throw new Error('entre com o login do Chamae');
      const r = await fetch(SB + '/functions/v1/sol-telhado', { method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: JSON.stringify(q) });
      const j = await r.json().catch(() => ({})); if (!r.ok && !j.aguas) throw new Error(j.erro || 'HTTP ' + r.status); return j;
    },
    async tile(z, x, y) {
      const t = await token(); const r = await fetch(SB + '/functions/v1/sol-telhado?tile=' + z + '/' + x + '/' + y, { headers: { apikey: KEY, Authorization: 'Bearer ' + t } });
      if (!r.ok) throw new Error('tile ' + r.status); return r.blob();
    },
    /* irradiação do local (PVGIS SARAH-3) por água do telhado: faces = ['incl|az', ...] */
    async pvgis(lat, lng, faces) {
      const t = await token(); if (!t) throw new Error('entre com o login do Chamae');
      const r = await fetch(SB + '/functions/v1/sol-telhado', { method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'pvgis', lat, lng, faces }) });
      const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.erro || 'HTTP ' + r.status); return j;
    },
    /* imagens grandes do projeto 3D (satélite e drone) ficam nos anexos; o orçamento guarda só o id e a versão leve */
    async guardarImagem(chave, nome, dataURL) {
      const [cab, b64] = String(dataURL).split(','), tipo = (cab.match(/data:([^;]+)/) || [])[1] || 'image/jpeg';
      const r = await api('sol_anexos?select=id', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ orcamento: chave, nome, tipo, conteudo_b64: b64 }) });
      return r && r[0] ? r[0].id : null;
    },
    async lerImagem(id) { const a = await this.anexo(id); return a ? `data:${a.tipo};base64,${a.conteudo_b64}` : null; },
    async treinoGravar(r) { await api('sol_robo_treino', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(r) }); },
    async treino(limite = 300) { return api('sol_robo_treino?select=id,em,lote,cenario,ok,segundos,valor_kit,rs_wp,etapa,erro&order=em.desc&limit=' + limite); },
    async faturas(usinaId) { return api('sol_faturas?select=*&usina_id=eq.' + usinaId + '&order=leitura_fim.desc'); },
    async salvarFatura(f) {
      const campos = ['usina_id', 'unidade_id', 'referencia', 'leitura_ini', 'leitura_fim', 'consumo_rede', 'injetada', 'saldo_creditos', 'valor_pago', 'tarifa', 'geracao_manual', 'dados'];
      const corpo = Object.fromEntries(campos.filter((c) => f[c] !== undefined).map((c) => [c, f[c] === '' ? null : f[c]]));
      const r = await api('sol_faturas?on_conflict=usina_id,unidade_id,leitura_fim', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify(corpo) });
      aviso('Conta salva ✓'); return r[0];
    },
    async apagarFatura(id) { await api('sol_faturas?id=eq.' + id, { method: 'DELETE' }); },
    /* rateio: unidades consumidoras que recebem os créditos da usina */
    async unidades(usinaId) { return api('sol_unidades?select=*&usina_id=eq.' + usinaId + '&order=geradora.desc,id.asc'); },
    async salvarUnidade(x) { const c = ['usina_id', 'uc', 'apelido', 'titular', 'endereco', 'percentual', 'geradora']; const corpo = Object.fromEntries(c.filter((k) => x[k] !== undefined).map((k) => [k, x[k] === '' ? null : x[k]]));
      const r = x.id ? await api('sol_unidades?id=eq.' + x.id, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(corpo) }) : await api('sol_unidades', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(corpo) }); return r[0]; },
    async apagarUnidade(id) { await api('sol_unidades?id=eq.' + id, { method: 'DELETE' }); },
    async portalCliente(t) { return api('rpc/sol_portal_cliente', { method: 'POST', body: JSON.stringify({ p_token: t }) }, true); },
    /* erro do robô: fica gravado com print e tela para análise */
    async registrarErroRobo(r) {
      const d = r.diag || {}; const print = d.print || null; delete d.print;
      await api('sol_robo_erros', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ orcamento: r.orcamento || null, opcao: r.opcao || null, etapa: d.nomeEtapa || null, mensagem: r.mensagem, diagnostico: d, print_jpg: print }) });
    },
    async anexar(orcamento, nome, base64, tipo = 'application/pdf') { await api('sol_anexos', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ orcamento, nome, tipo, conteudo_b64: base64 }) }); aviso('PDF da Belenergy anexado ✓'); },
    async anexos(orcamento) { return api('sol_anexos?select=id,nome,tipo,em&orcamento=eq.' + encodeURIComponent(orcamento) + '&order=em.desc'); },
    async anexo(id) { const r = await api('sol_anexos?select=nome,tipo,conteudo_b64&id=eq.' + id); return r[0] || null; },
    async execucoes() { return api("sol_monitoramento_execucoes?select=marca,ok,erro,resumo,em&marca=not.like.*-teste&order=em.desc&limit=10"); },
    /* lê agora as plataformas dos fabricantes (mesma rotina das 6h30) */
    async atualizarMonitoramento() {
      const t = await token(); if (!t) throw new Error('sem-login');
      const r = await fetch(SB + '/functions/v1/sol-monitoramento', { method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: '{}' });
      const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.erro || 'HTTP ' + r.status);
      await Banco.carregar(); return j.resultado || {};
    },
    /* relatório mensal por e-mail: {teste:'email'} manda só um exemplo */
    async relatorioMensal(corpo) {
      const t = await token(); if (!t) throw new Error('sem-login');
      const r = await fetch(SB + '/functions/v1/sol-relatorio-mensal', { method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: JSON.stringify(corpo || {}) });
      const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.erro || 'HTTP ' + r.status); return j;
    },
    /* acessos das plataformas: só escrita (ficam no cofre do Supabase, ninguém lê pelo site) */
    async guardarCredencial(marca, dados) { await api('rpc/sol_guardar_credencial', { method: 'POST', body: JSON.stringify({ p_marca: marca, p_dados: dados }) }); aviso('Acesso guardado ✓'); return true; },
    async credenciaisStatus() { return api('rpc/sol_credenciais_status', { method: 'POST', body: '{}' }); },
    semear() { /* no oficial não existem leads de exemplo */ },
    zerarTudo() { ['rascunho', 'etapa'].forEach((k) => { try { localStorage.removeItem(LOCAL + k); } catch { /* */ } }); },
    rascunho: { ler: () => lerL('rascunho', null), gravar: (v) => gravarL('rascunho', v), etapa: () => lerL('etapa', 0), gravarEtapa: (e) => gravarL('etapa', e) },

    /* carrega tudo do banco (vendedor logado) */
    async carregar() {
      const [o, ev, it, pr] = await Promise.all([
        api('sol_orcamentos?select=id,codigo,token_publico,status,dados,enviado_em&or=(dados->>origem.is.null,dados->>origem.neq.groner,dados->>carteira.eq.true,dados->>arquivado.is.null,dados->>arquivado.eq.false,dados->>apagado.eq.true)&order=atualizado_em.desc&limit=3000'),
        api('sol_proposta_eventos?select=orcamento_id,tipo,dados,em&order=em.asc&limit=20000'),
        api('sol_interacoes?select=orcamento_id,tipo,texto,em&order=em.desc&limit=5000'),
        api('sol_parametros?select=dados&vigente=eq.true&limit=1'),
      ]);
      orcs = o.map(linhaParaOrc);
      const porId = Object.fromEntries(o.map((r) => [r.id, r]));
      eventos = ev.map((e) => ({ token: (porId[e.orcamento_id] || {}).token_publico, tipo: e.tipo, dados: e.dados, em: e.em }));
      interacoes = it.map((i) => ({ orcId: (porId[i.orcamento_id] || {}).codigo, tipo: i.tipo, texto: i.texto, em: i.em }));
      paramVigente = (pr[0] && pr[0].dados) || {};
      const desde = new Date(Date.now() - 400 * 864e5).toISOString().slice(0, 10);
      const [us, ge] = await Promise.all([api('sol_usinas?select=*&order=cliente_nome.asc'), geracaoPaginada(desde)]);
      try { (await api('sol_modelos?select=chave,titulo,corpo,versao')).forEach((m) => { modelos[m.chave] = m; }); } catch { /* sem modelos: usa os genéricos */ }
      try { leituraPor = {}; (await api('sol_usina_leituras?select=usina_id,dia,total_kwh,potencia_w,status,em&order=dia.desc&limit=3000')).forEach((l) => { if (!leituraPor[l.usina_id]) leituraPor[l.usina_id] = l; }); } catch { /* sem leituras */ }
      usinas = us; geracaoPor = {}; ge.forEach((g) => { (geracaoPor[g.usina_id] = geracaoPor[g.usina_id] || []).push({ dia: g.dia, kwh: +g.kwh }); });
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
    if (pagina === 'cliente') return; // app do cliente: só a função pública sol_portal_cliente, pelo link
    if (pagina === 'proposta' && qs.get('t') && !(ehSolar && qs.get('v') === '1')) {
      if (!(await Banco.carregarPublica(qs.get('t')).catch(() => false))) Banco.orcamentos = () => [];
      return;
    }
    if (!t) { document.body.innerHTML = '<div style="max-width:520px;margin:15vh auto;padding:24px;font:18px system-ui;color:#fff;text-align:center">Entre primeiro no Chamae com o seu usuário.<br>Depois volte aqui pelo cartão <b>Chama Solar</b> em Fábricas.<br><br><a style="color:#ffb066" href="' + LOGIN_CHAMAE + '">Abrir o Chamae</a></div>'; throw new Error('sem-login'); }
    if (!ehSolar) { document.body.innerHTML = '<div style="max-width:520px;margin:15vh auto;padding:24px;font:18px system-ui;color:#fff;text-align:center">Seu usuário ainda não tem acesso ao Chama Solar.<br><br><a style="color:#ffb066" href="' + LOGIN_CHAMAE + '">Voltar ao Chamae</a></div>'; throw new Error('sem-acesso'); }
    await Banco.carregar();
    // atualiza o painel quando o cliente mexe na proposta
    setInterval(async () => { if (pendentes) return; try { const antes = eventos.length, ids = new Set(orcs.map((o) => o.id)); await Banco.carregar(); orcs.filter((o) => !ids.has(o.id) && o.veioDoSite).forEach((o) => { try { if ('Notification' in raiz && Notification.permission === 'granted') { const nt = new Notification('Chama Solar · lead novo', { body: o.nome + ' pediu simulação pelo site. Responda em até 5 minutos.', tag: 'lead' + o.id, icon: 'marca/logo-cor.webp' }); nt.onclick = () => { raiz.focus(); location.hash = '#lead-' + o.id; }; } } catch { /* */ } }); if (eventos.length !== antes) { avisarNovos(eventos.slice(antes)); dispatchEvent(new StorageEvent('storage', { key: 'sol2_eventos' })); } } catch { /* */ } }, 60000);
  }
  /* aviso no computador/celular quando o cliente mexe na proposta (com a central aberta) */
  const FRASE = { abriu: 'abriu a proposta agora', simulou: 'está simulando parcelas', compartilhou: 'mandou a proposta para a família', whatsapp: 'clicou para falar com você', aceite: 'ACEITOU a proposta', duvida: 'tem uma dúvida' };
  function avisarNovos(novos) {
    if (!('Notification' in raiz) || Notification.permission !== 'granted') return;
    const vistos = new Set();
    novos.filter((e) => FRASE[e.tipo]).forEach((e) => {
      const chave = e.token + e.tipo; if (vistos.has(chave)) return; vistos.add(chave);
      const o = orcs.find((x) => x.token === e.token); if (!o) return;
      try { const nt = new Notification('Chama Solar · ' + o.nome, { body: o.nome.split(' ')[0] + ' ' + FRASE[e.tipo] + '. Toque para abrir a ficha.', tag: chave, icon: 'marca/logo-cor.webp' }); nt.onclick = () => { raiz.focus(); location.hash = (AVULSO(o) ? '#servico-' : '#lead-') + o.id; }; } catch { /* */ }
    });
  }
  Banco.pronto = raiz.SOLAR_SEM_INICIO ? Promise.resolve() : iniciar();
  Banco.vitrineDe = vitrineDe;
  Banco._paramsPublicos = paramsPublicos;
  raiz.Banco = Banco;
})(window);
