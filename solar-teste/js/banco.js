/* =====================================================================
   Banco SIMULADO (localStorage). Mesmo formato das tabelas do Supabase
   (sql/solar): orcamentos ↔ sol_orcamentos, eventos ↔ sol_proposta_eventos,
   interacoes ↔ sol_interacoes. Para ir ao oficial, troca-se só este arquivo.
   ===================================================================== */
(function (raiz) {
  'use strict';
  const AVULSO = (o) => !!o && (o.tipo === 'servico' || o.tipo === 'manutencao' || o.tipo === 'ampliacao');
  const D = raiz.DadosTeste;
  const PREFIXO = 'sol2_';

  const ler = (k, padrao) => { try { const v = localStorage.getItem(PREFIXO + k); return v ? JSON.parse(v) : padrao; } catch { return padrao; } };
  const gravar = (k, v) => { try { localStorage.setItem(PREFIXO + k, JSON.stringify(v)); } catch { /* sem armazenamento */ } };
  const agora = () => new Date().toISOString();
  const horasAtras = (h) => new Date(Date.now() - h * 3600e3).toISOString();
  const novoToken = () => Array.from(crypto.getRandomValues(new Uint8Array(9)), (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 14);

  // Infinity não sobrevive ao JSON: guardamos 1e9 e devolvemos como está (faixaDe funciona igual)
  const json = (o) => JSON.parse(JSON.stringify(o, (k, v) => (v === Infinity ? 1e9 : v)));

  function cepInfo(cep) {
    const d = String(cep).replace(/\D/g, '');
    return d.length >= 5 ? D.ceps.find((c) => d.startsWith(c.prefixo)) || null : null;
  }

  const Banco = {
    cepInfo,
    parametros() { return Object.assign(json(D.parametros), ler('parametros', {})); },
    salvarParametros(p) { gravar('parametros', { ...ler('parametros', {}), ...json(p) }); },
    async filaRobo(item) { const f = ler('fila_robo', []); const x = { id: 'F' + Date.now(), criado: agora(), atualizado: agora(), status: 'pendente', tipo: 'cotar', ...item }; f.unshift(x); gravar('fila_robo', f); return [x]; },
    async filaRoboLer() { return ler('fila_robo', []); },
    async filaRoboMarcar(id, campos) { gravar('fila_robo', ler('fila_robo', []).map((x) => (x.id === id ? { ...x, ...campos } : x))); },
    leitura() { return null; },
    async arquivoGroner() { return []; },
    async contarGroner() { return 0; },
    trazer(o) { return o; },
    async parceiros() { return ler('parceiros', []); },
    async salvarParceiro(id, campos) { gravar('parceiros', ler('parceiros', []).map((x) => (x.id === id ? { ...x, ...campos } : x))); },
    async indicacoes() { return ler('indicacoes', []); },
    async salvarIndicacao(id, campos) { gravar('indicacoes', ler('indicacoes', []).map((x) => (x.id === id ? { ...x, ...campos } : x))); },
    async roboStatus() { return null; },
    async roboChave() { return 'teste-sem-chave'; },
    zerarParametros() { gravar('parametros', {}); },

    todos() { return ler('orcamentos', []); },
    orcamentos() { return this.todos().filter((o) => !AVULSO(o) && !o.arquivado && !o.carteira && !o.apagado); }, // serviços, manutenções e o arquivo ficam fora das listas do funil
    arquivados() { return this.todos().filter((o) => !AVULSO(o) && o.arquivado && !o.apagado); },
    lixeira() { return this.todos().filter((o) => o.apagado); },
    excluirDeVez(id) { gravar('orcamentos', this.todos().filter((o) => o.id !== id)); },

    clientes() { return this.todos().filter((o) => !AVULSO(o) && !o.juntadoEm && !o.apagado && (o.status === 'ganho' || o.carteira)); },
    avulsos() { return this.todos().filter(AVULSO); },
    obter(id) { return this.todos().find((o) => o.id === id) || null; },
    porToken(token) { return this.todos().find((o) => o.token === token) || null; },
    salvar(o) {
      const lista = this.todos();
      if (!o.id) {
        const pre = AVULSO(o) ? 'SRV-' : 'ORC-', n = lista.filter((x) => String(x.id).startsWith(pre)).reduce((m, x) => Math.max(m, +String(x.id).replace(/\D/g, '') || 0), 0) + 1;
        o.id = pre + String(n).padStart(4, '0');
        o.token = o.token || novoToken();
        o.criadoEm = o.criadoEm || agora();
      }
      o.atualizadoEm = agora();
      const i = lista.findIndex((x) => x.id === o.id);
      i >= 0 ? (lista[i] = json(o)) : lista.unshift(json(o));
      gravar('orcamentos', lista);
      return o;
    },

    eventos(token) { return ler('eventos', []).filter((e) => !token || e.token === token); },
    evento(token, tipo, dados = {}, em = agora()) {
      const todos = ler('eventos', []);
      todos.push({ token, tipo, dados, em });
      gravar('eventos', todos);
      // status avança sozinho com o comportamento do cliente
      const o = this.porToken(token);
      if (o && !['ganho', 'perdido'].includes(o.status)) {
        if (tipo === 'aceite') { o.status = 'ganho'; o.aceite = dados; }
        else if (['simulou', 'compartilhou', 'whatsapp', 'escolheu'].includes(tipo) && ['proposta', 'visualizou'].includes(o.status)) o.status = 'negociando';
        else if (tipo === 'abriu' && o.status === 'proposta') o.status = 'visualizou';
        this.salvar(o);
      }
    },

    interacoes(id) { return ler('interacoes', []).filter((i) => i.orcId === id).sort((a, b) => b.em.localeCompare(a.em)); },
    interacao(orcId, tipo, texto) { const t = ler('interacoes', []); t.push({ orcId, tipo, texto, em: agora() }); gravar('interacoes', t); },

    /* Popula o banco de teste com os leads de exemplo (uma vez) */
    semear(forcar = false) {
      if (!forcar && ler('semeado', false)) return;
      if (!forcar && this.orcamentos().length) { gravar('semeado', true); return; } // nunca apaga orçamentos existentes
      gravar('orcamentos', []); gravar('eventos', []); gravar('interacoes', []);
      const p = this.parametros();
      D.leadsExemplo.slice().reverse().forEach((l) => {
        const c = cepInfo(l.cep);
        const o = this.salvar({
          nome: l.nome, whatsapp: l.whatsapp, cep: l.cep, cidade: c?.cidade || 'Ribeirão Preto', distanciaKm: c?.km || 12,
          ligacao: l.ligacao, consumos: l.consumos, tarifaKwh: p.tarifaKwh, lidoPorIA: true,
          telhado: 'ceramico', orientacao: '?', areaDisponivel: '', trocaPadrao: false,
          opcaoEscolhida: 1, formaPagamento: 'financiamento', comissaoParceria: 0, kitFaturadoDireto: false, descontoPct: 0,
          origem: l.origem, status: 'proposta', motivoPerda: l.motivoPerda || '',
        });
        o.criadoEm = horasAtras(l.criadoH); o.enviadoEm = horasAtras(l.criadoH - 0.5);
        this.salvar(o);
        l.eventos.forEach(([tipo, h, dados]) => this.evento(o.token, tipo, dados || {}, horasAtras(h)));
        const final = this.obter(o.id); final.status = l.status; if (l.status === 'novo') final.enviadoEm = null;
        this.salvar(final);
      });
      gravar('semeado', true);
    },
    zerarTudo() { ['orcamentos', 'eventos', 'interacoes', 'semeado', 'rascunho', 'etapa', 'usinas', 'geracao'].forEach((k) => { try { localStorage.removeItem(PREFIXO + k); } catch { /* sem armazenamento */ } }); },
    /* ---------- usinas instaladas e geração diária ---------- */
    usinas() {
      let u = ler('usinas', null);
      if (!u) { // exemplo para o teste
        u = [{ id: 1, cliente_nome: 'Rosa Martins', cidade: 'Ribeirão Preto', kwp: 4.11, marca: 'Auxsol', plataforma_id: 'AX-1001', ligada_em: '2025-08-12', esperado_mes: 480, tarifa_kwh: 0.98, whatsapp: '16 99100-0001' },
          { id: 2, cliente_nome: 'Mercado Bom Preço', cidade: 'Sertãozinho', kwp: 16.44, marca: 'Huawei', plataforma_id: 'HW-2203', ligada_em: '2025-03-02', esperado_mes: 1950, tarifa_kwh: 0.92, whatsapp: '16 99100-0002' },
          { id: 3, cliente_nome: 'João Batista', cidade: 'Franca', kwp: 6.17, marca: 'Deye', plataforma_id: 'DY-3310', ligada_em: '2026-01-20', esperado_mes: 730, tarifa_kwh: 0.98, whatsapp: '16 99100-0003' }];
        gravar('usinas', u);
        const g = {}, hoje = new Date();
        u.forEach((x, k) => { g[x.id] = []; for (let d = 50; d >= (k === 2 ? 5 : 1); d--) { const dia = new Date(hoje - d * 864e5).toISOString().slice(0, 10); const f = k === 1 ? 0.62 : 0.95; g[x.id].push({ dia, kwh: +((x.esperado_mes / 30) * f * (0.75 + Math.random() * 0.45)).toFixed(1) }); } });
        gravar('geracao', g);
      }
      return u;
    },
    geracao(id) { return (ler('geracao', {})[id] || []).slice(); },
    async salvarUsina(u) { const lista = this.usinas(); if (!u.id) u.id = lista.reduce((m, x) => Math.max(m, x.id), 0) + 1; const i = lista.findIndex((x) => x.id === u.id); i >= 0 ? (lista[i] = u) : lista.push(u); gravar('usinas', lista); return u; },
    async gravarGeracao(id, linhas) { const g = ler('geracao', {}); const m = Object.fromEntries((g[id] || []).map((l) => [l.dia, l])); linhas.forEach((l) => { m[l.dia] = { dia: l.dia, kwh: l.kwh }; }); g[id] = Object.values(m).sort((a, b) => a.dia.localeCompare(b.dia)); gravar('geracao', g); return linhas.length; },

    modelo() { return null; }, // teste: usa os modelos genéricos
    async execucoes() { return []; },
    async agendaLink() { return null; },
    _treino: [],
    async treinoGravar(r) { this._treino.unshift({ ...r, id: this._treino.length + 1, em: new Date().toISOString() }); },
    async treino() { return this._treino.slice(); },
    _faturas: [],
    async faturas(usinaId) { return this._faturas.filter((f) => f.usina_id === usinaId).sort((a, b) => b.leitura_fim.localeCompare(a.leitura_fim)); },
    async salvarFatura(f) { const i = this._faturas.findIndex((x) => x.usina_id === f.usina_id && x.leitura_fim === f.leitura_fim); const novo = { ...f, id: i >= 0 ? this._faturas[i].id : this._faturas.length + 1 }; i >= 0 ? (this._faturas[i] = novo) : this._faturas.push(novo); return novo; },
    async apagarFatura(id) { this._faturas = this._faturas.filter((f) => f.id !== id); },
    async registrarErroRobo() { /* teste: só no console */ },
    _anexos: [],
    async anexar(orcamento, nome, base64, tipo = 'application/pdf') { this._anexos.push({ id: this._anexos.length + 1, orcamento, nome, tipo, conteudo_b64: base64, em: new Date().toISOString() }); },
    async anexos(orcamento) { return this._anexos.filter((a) => a.orcamento === orcamento); },
    async anexo(id) { return this._anexos.find((a) => a.id === +id) || null; },
    // teste: imagem grande do 3D fica só na memória (some ao recarregar; o orçamento guarda a versão leve)
    async guardarImagem(chave, nome, dataURL) { const [cab, b64] = String(dataURL).split(','); await this.anexar(chave, nome, b64, (cab.match(/data:([^;]+)/) || [])[1] || 'image/jpeg'); return this._anexos.length; },
    async lerImagem(id) { const a = await this.anexo(id); return a ? `data:${a.tipo};base64,${a.conteudo_b64}` : null; },
    async atualizarMonitoramento() { throw new Error('No teste não há leitura das plataformas. Use a versão no Chamae.'); },
    async guardarCredencial() { throw new Error('No teste os acessos não são guardados. Use a versão no Chamae.'); },
    async credenciaisStatus() { return []; },
    rascunho: { ler: () => ler('rascunho', null), gravar: (v) => gravar('rascunho', v), etapa: () => ler('etapa', 0), gravarEtapa: (e) => gravar('etapa', e) },
  };

  raiz.Banco = Banco;
})(window);
