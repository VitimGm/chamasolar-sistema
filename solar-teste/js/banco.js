/* =====================================================================
   Banco SIMULADO (localStorage). Mesmo formato das tabelas do Supabase
   (sql/solar): orcamentos ↔ sol_orcamentos, eventos ↔ sol_proposta_eventos,
   interacoes ↔ sol_interacoes. Para ir ao oficial, troca-se só este arquivo.
   ===================================================================== */
(function (raiz) {
  'use strict';
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
    salvarParametros(p) { gravar('parametros', json(p)); },
    zerarParametros() { gravar('parametros', {}); },

    orcamentos() { return ler('orcamentos', []); },
    obter(id) { return this.orcamentos().find((o) => o.id === id) || null; },
    porToken(token) { return this.orcamentos().find((o) => o.token === token) || null; },
    salvar(o) {
      const lista = this.orcamentos();
      if (!o.id) {
        const n = lista.reduce((m, x) => Math.max(m, +String(x.id).replace(/\D/g, '') || 0), 0) + 1;
        o.id = 'ORC-' + String(n).padStart(4, '0');
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
    zerarTudo() { ['orcamentos', 'eventos', 'interacoes', 'semeado', 'rascunho', 'etapa'].forEach((k) => { try { localStorage.removeItem(PREFIXO + k); } catch { /* sem armazenamento */ } }); },
    rascunho: { ler: () => ler('rascunho', null), gravar: (v) => gravar('rascunho', v), etapa: () => ler('etapa', 0), gravarEtapa: (e) => gravar('etapa', e) },
  };

  raiz.Banco = Banco;
})(window);
