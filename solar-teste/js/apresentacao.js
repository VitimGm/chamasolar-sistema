/* =====================================================================
   VÍDEO DE APRESENTAÇÃO DA PROPOSTA (para o cliente que ficou com dúvida)
   Três jeitos, todos no próprio navegador, sem custo de IA:
   1 Automático   o sistema monta um vídeo de ~1 min, em pé (celular), com legendas:
                  conta de hoje → usina (foto do 3D) → economia → investimento → retorno
                  → equipamentos → próximos passos → contato.
   2 Minha voz    as mesmas telas passam e o vendedor narra (o roteiro aparece só para ele).
   3 Tela+câmera  o vendedor grava a tela explicando a proposta, com a câmera no canto.
   O vídeo pode ir para o WhatsApp e/ou ficar DENTRO da proposta do cliente.
   ===================================================================== */
(function (raiz) {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const n = (v, c = 0) => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c });
  const brl = (v) => 'R$ ' + n(Math.round(Number(v) || 0));
  const W = 1080, H = 1920;
  const TIPOS = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  const tipoGravacao = (comAudio) => TIPOS.filter((t) => comAudio || !/mp4a|opus/.test(t)).find((t) => { try { return MediaRecorder.isTypeSupported(t); } catch { return false; } }) || '';
  const zap = (z) => { const d = String(z || '').replace(/\D/g, '').replace(/^55/, ''); return d.length >= 10 ? `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}` : z || ''; };

  /* ---------- roteiro: as cenas saem da própria proposta ---------- */
  function roteiro(o) {
    const B = raiz.Banco, C = raiz.Conversao, p = B.parametros(), E = (raiz.DadosTeste && raiz.DadosTeste.empresa) || {};
    const a = C.analisar(o, p), op = a.op, eq = C.equipamentos(op), eco = op.eco || {}, d = op.dim || {};
    const nome = String(o.nome || 'cliente').trim(), primeiro = nome.split(/\s+/)[0];
    const vend = p.vendedorNome || E.vendedor || 'seu consultor';
    const img3d = o.projeto3d && o.projeto3d.fotos && (o.projeto3d.fotos.d3 || o.projeto3d.fotos.depois);
    const cenas = [
      { tipo: 'capa', titulo: 'Proposta de energia solar', grande: nome, sub: [o.cidade, new Date().toLocaleDateString('pt-BR')].filter(Boolean).join(' · '), dur: 4.5,
        fala: `Oi, ${primeiro}! Aqui é o ${vend}, da Chama Solar. Em um minuto eu te mostro como fica a sua usina solar e quanto você vai economizar.` },
      { tipo: 'numero', titulo: 'Hoje você paga de energia', valor: a.raioX.pago12, grande: brl(a.raioX.pago12), sub: `nos últimos 12 meses · média de ${brl(a.raioX.contaMedia)} por mês`, dur: 6,
        fala: `Nos últimos doze meses você pagou ${brl(a.raioX.pago12)} de energia, uma média de ${brl(a.raioX.contaMedia)} por mês. Esse dinheiro vai embora todo mês.` },
      { tipo: img3d ? 'imagem' : 'numero', img: img3d, titulo: 'A sua usina', valor: d.kwpReal, grande: `${n(d.kwpReal, 2)} kWp`, sub: `${d.placas} placas · gera ${n(d.geracaoMes)} kWh por mês`, dur: 7,
        fala: `A sua usina tem ${n(d.kwpReal, 2)} quilowatts-pico, com ${d.placas} placas, e gera em média ${n(d.geracaoMes)} quilowatts-hora por mês.${img3d ? ' Ela foi desenhada sobre a foto do seu telhado, com a sombra calculada hora a hora.' : ''}` },
      { tipo: 'comparar', titulo: 'A sua conta de luz', de: eco.contaAtual, para: eco.contaDepois, sub: `economia de ${brl(eco.economiaMes1)} por mês`, dur: 7,
        fala: `A sua conta cai de ${brl(eco.contaAtual)} para cerca de ${brl(eco.contaDepois)}, que é a taxa mínima da distribuidora. São ${brl(eco.economiaMes1)} de economia por mês.` },
      { tipo: 'numero', titulo: 'Investimento', valor: op.preco.precoFinal, grande: brl(op.preco.precoFinal), sub: a.boleto.prazo ? `ou ${a.boleto.prazo}x de ${brl(a.boleto.parcela)} no financiamento` : 'à vista',
        linhas: a.boleto.prazo ? [`Parcela + conta mínima: ${brl(a.boleto.totalMes)} por mês`, `Hoje você paga ${brl(a.boleto.contaAtual)} por mês`] : [], dur: 7,
        fala: `O investimento é de ${brl(op.preco.precoFinal)}.${a.boleto.prazo ? ` Financiando em ${a.boleto.prazo} vezes, a parcela fica em ${brl(a.boleto.parcela)}. Somando a parcela com a conta mínima, dá ${brl(a.boleto.totalMes)} por mês, contra os ${brl(a.boleto.contaAtual)} que você paga hoje.` : ''}` },
      { tipo: 'numero', titulo: 'Retorno do investimento', valor: eco.paybackAnos, decimais: 1, grande: eco.paybackAnos ? `${n(eco.paybackAnos, 1)} anos` : 'rápido', sub: 'depois disso, a energia sai praticamente de graça por mais de 20 anos', dur: 6,
        fala: `O dinheiro investido volta em cerca de ${n(eco.paybackAnos, 1)} anos. Depois disso, a energia sai praticamente de graça por mais de vinte anos.` },
      { tipo: 'lista', titulo: 'Equipamentos de primeira linha', linhas: [eq.modulo, eq.inversor, 'Estrutura certa para o seu telhado', 'Projeto, aprovação e instalação inclusos'], dur: 7,
        fala: `Os equipamentos são de primeira linha: ${eq.modulo} e ${eq.inversor}. A estrutura é a certa para o seu tipo de telhado, e o projeto, a aprovação e a instalação já estão inclusos.` },
      { tipo: 'lista', titulo: 'Como funciona daqui pra frente', linhas: ['1. Visita técnica no seu imóvel', '2. Projeto e aprovação na distribuidora', '3. Instalação em 1 ou 2 dias', '4. Usina ligada e monitorada pelo app'], dur: 7,
        fala: 'Daqui pra frente é simples: a gente faz a visita técnica, o projeto e a aprovação na distribuidora, instala em um ou dois dias e a usina fica ligada e monitorada pelo aplicativo.' },
      { tipo: 'fim', titulo: 'Ficou alguma dúvida?', grande: 'Fale comigo', sub: `WhatsApp ${zap(E.whatsapp)}`, linhas: ['A proposta completa está no seu link'], dur: 5.5,
        fala: `Ficou alguma dúvida? É só me chamar no WhatsApp. A proposta completa está no seu link. Um abraço, ${primeiro}!` },
    ];
    return cenas.filter((c) => c.tipo !== 'numero' || c.valor || c.grande);
  }

  /* ---------- desenho de cada cena (canvas 1080 × 1920) ---------- */
  const fonte = (peso, tam) => `${peso} ${tam}px "Albert Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  function texto(g, t, x, y, tam, { peso = 700, cor = '#fff', alinha = 'center', max = W - 140, alfa = 1 } = {}) {
    g.save(); g.globalAlpha *= alfa; g.textAlign = alinha; g.fillStyle = cor; let s = tam;
    g.font = fonte(peso, s); while (g.measureText(t).width > max && s > 24) { s -= 2; g.font = fonte(peso, s); }
    g.fillText(t, x, y); g.restore(); return s;
  }
  function quebrar(g, t, max, tam, peso) { g.font = fonte(peso, tam); const pal = String(t).split(/\s+/), lin = []; let a = ''; pal.forEach((p) => { const b = a ? a + ' ' + p : p; if (g.measureText(b).width > max && a) { lin.push(a); a = p; } else a = b; }); if (a) lin.push(a); return lin; }
  const suave = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.pow(1 - x, 3));
  function fundo(g, i) {
    const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#0b1730'); gr.addColorStop(1, i % 2 ? '#1b1230' : '#122046'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const sol = g.createRadialGradient(W * 0.85, H * 0.12, 10, W * 0.85, H * 0.12, W * 0.7); sol.addColorStop(0, 'rgba(255,160,60,.35)'); sol.addColorStop(1, 'rgba(255,160,60,0)'); g.fillStyle = sol; g.fillRect(0, 0, W, H);
  }
  function cena(g, c, t, i, total, imgs) {
    fundo(g, i);
    const ent = suave(t / 0.18), sai = 1 - suave((t - 0.9) / 0.1), alfa = Math.min(ent, sai), dy = (1 - ent) * 60;
    if (imgs.logo) { const lw = W * 0.34, lh = lw * (imgs.logo.height / imgs.logo.width); g.drawImage(imgs.logo, (W - lw) / 2, 90, lw, lh); } else texto(g, 'CHAMA SOLAR', W / 2, 150, 54, { peso: 800 });
    g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(140, H - 120, W - 280, 8); g.fillStyle = '#ff8a3d'; g.fillRect(140, H - 120, (W - 280) * ((i + t) / total), 8); // andamento
    g.save(); g.globalAlpha = alfa; g.translate(0, dy);
    const tit = (y) => texto(g, c.titulo, W / 2, y, 64, { peso: 700, cor: '#ffd27a' });
    if (c.tipo === 'capa') {
      tit(760); texto(g, c.grande, W / 2, 900, 110, { peso: 800 }); texto(g, c.sub, W / 2, 990, 44, { peso: 500, cor: '#cfd8e6' });
      g.fillStyle = '#ff8a3d'; g.fillRect(W / 2 - 90, 1060, 180 * ent, 10);
    } else if (c.tipo === 'numero') {
      tit(720);
      let grande = c.grande;
      if (Number.isFinite(c.valor) && c.valor > 0 && /^R\$/.test(c.grande)) grande = brl(c.valor * suave(t / 0.45));
      else if (Number.isFinite(c.valor) && c.valor > 0 && c.decimais) grande = `${n(c.valor * suave(t / 0.45), c.decimais)} anos`;
      texto(g, grande, W / 2, 900, 140, { peso: 800 });
      quebrar(g, c.sub, W - 200, 46, 500).forEach((l, k) => texto(g, l, W / 2, 1000 + k * 60, 46, { peso: 500, cor: '#cfd8e6' }));
      (c.linhas || []).forEach((l, k) => texto(g, l, W / 2, 1220 + k * 76, 46, { peso: 600, alfa: suave((t - 0.25 - k * 0.12) / 0.15) }));
    } else if (c.tipo === 'imagem') {
      tit(330);
      if (imgs.d3) { const iw = W - 120, ih = iw * (imgs.d3.height / imgs.d3.width), z = 1 + 0.06 * t, x = 60, y = 400; g.save(); g.beginPath(); g.roundRect ? g.roundRect(x, y, iw, ih, 36) : g.rect(x, y, iw, ih); g.clip(); g.drawImage(imgs.d3, x - (iw * (z - 1)) / 2, y - (ih * (z - 1)) / 2, iw * z, ih * z); g.restore(); }
      texto(g, c.grande, W / 2, 1360, 130, { peso: 800 }); texto(g, c.sub, W / 2, 1450, 46, { peso: 500, cor: '#cfd8e6' });
    } else if (c.tipo === 'comparar') {
      tit(560);
      const max = Math.max(c.de || 1, 1), base = 1380, alt = 640, larg = 260, f = suave(t / 0.5);
      [[c.de, 'Hoje', '#e5483b', 230], [c.para, 'Com solar', '#22c55e', W - 230 - larg]].forEach(([v, rot, cor, x], k) => {
        const h = alt * ((v || 0) / max) * (k ? suave((t - 0.25) / 0.4) : f);
        g.fillStyle = cor; g.fillRect(x, base - h, larg, h);
        texto(g, brl(v), x + larg / 2, base - h - 30, 58, { peso: 800 }); texto(g, rot, x + larg / 2, base + 70, 46, { peso: 600, cor: '#cfd8e6' });
      });
      texto(g, c.sub, W / 2, 1580, 58, { peso: 800, cor: '#ffd27a', alfa: suave((t - 0.45) / 0.2) });
    } else if (c.tipo === 'lista') {
      tit(560);
      (c.linhas || []).forEach((l, k) => { const a2 = suave((t - 0.08 - k * 0.13) / 0.15); quebrar(g, '✓  ' + l, W - 200, 50, 600).forEach((li, j) => texto(g, li, 110, 720 + k * 170 + j * 62, 50, { peso: 600, alinha: 'left', alfa: a2 })); });
    } else if (c.tipo === 'fim') {
      tit(780); texto(g, c.grande, W / 2, 920, 120, { peso: 800 }); texto(g, c.sub, W / 2, 1030, 58, { peso: 700, cor: '#7ee2a8' });
      (c.linhas || []).forEach((l, k) => texto(g, l, W / 2, 1140 + k * 70, 44, { peso: 500, cor: '#cfd8e6' }));
    }
    g.restore();
  }
  const carregar = (src) => new Promise((ok) => { if (!src) return ok(null); const im = new Image(); im.onload = () => ok(im); im.onerror = () => ok(null); im.src = src; });
  async function imagens(o) {
    const logo = await carregar('marca/logo-branco.webp');
    const sujo = (im) => { if (!im) return null; try { const c = document.createElement('canvas'); c.width = c.height = 2; const g = c.getContext('2d'); g.drawImage(im, 0, 0, 2, 2); g.getImageData(0, 0, 1, 1); return im; } catch { return null; } };
    const f = o.projeto3d && o.projeto3d.fotos;
    return { logo: sujo(logo), d3: sujo(await carregar(f && (f.d3 || f.depois))) };
  }

  /* ---------- gravação das cenas (automático ou com a voz do vendedor) ---------- */
  async function gravarCenas({ o, voz = false, tela, aoCena, esperaToque }) {
    const cenas = roteiro(o), imgs = await imagens(o);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
    if (tela) { tela.innerHTML = ''; tela.appendChild(cv); }
    let mic = null;
    if (voz) { try { mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); } catch { throw new Error('não consegui usar o microfone (libere o acesso no navegador)'); } }
    const fluxo = cv.captureStream(30); if (mic) mic.getAudioTracks().forEach((tr) => fluxo.addTrack(tr));
    const tipo = tipoGravacao(!!mic), rec = new MediaRecorder(fluxo, tipo ? { mimeType: tipo, videoBitsPerSecond: 5e6 } : { videoBitsPerSecond: 5e6 }), partes = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) partes.push(e.data); };
    const parou = new Promise((ok) => { rec.onstop = ok; });
    rec.start(250);
    try {
      for (let i = 0; i < cenas.length; i++) {
        const c = cenas[i]; if (aoCena) aoCena(i, c, cenas.length);
        let avancar = false; const libera = esperaToque ? esperaToque(() => { avancar = true; }) : null;
        const t0 = performance.now(), dur = c.dur * 1000;
        await new Promise((ok) => {
          const passo = (agora) => {
            const pass = agora - t0, t = voz ? Math.min(pass / dur, 0.88) + (avancar ? 0.12 : 0) : Math.min(pass / dur, 1);
            cena(g, c, Math.max(0, t), i, cenas.length, imgs);
            if ((voz && avancar && pass > 1200) || (!voz && pass >= dur)) { if (voz) { const t1 = performance.now(); const sair = (x) => { const k = Math.min((x - t1) / 450, 1); cena(g, c, 0.9 + 0.1 * k, i, cenas.length, imgs); if (k < 1) requestAnimationFrame(sair); else ok(); }; requestAnimationFrame(sair); } else ok(); return; }
            requestAnimationFrame(passo);
          };
          requestAnimationFrame(passo);
        });
        if (libera) libera();
      }
      await new Promise((ok) => setTimeout(ok, 300));
    } finally {
      try { rec.stop(); } catch { /* */ }
      await Promise.race([parou, new Promise((ok) => setTimeout(ok, 4000))]);
      fluxo.getTracks().forEach((tr) => tr.stop()); if (mic) mic.getTracks().forEach((tr) => tr.stop());
    }
    const blob = new Blob(partes, { type: (tipo || 'video/webm').split(';')[0] });
    if (blob.size < 2000) throw new Error('o navegador não conseguiu gerar o vídeo (use o Chrome atualizado)');
    return { blob, ext: /mp4/.test(tipo) ? 'mp4' : 'webm' };
  }

  /* ---------- tela + câmera (estilo Loom) ---------- */
  async function gravarTela({ tela, aoParar }) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) throw new Error('este navegador não grava a tela (use o Chrome no computador)');
    const scr = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: false });
    let cam = null; try { cam = await navigator.mediaDevices.getUserMedia({ video: { width: 480, height: 480 }, audio: { echoCancellation: true, noiseSuppression: true } }); } catch { try { cam = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { cam = null; } }
    const vScr = Object.assign(document.createElement('video'), { muted: true, playsInline: true, srcObject: scr }), vCam = cam && cam.getVideoTracks().length ? Object.assign(document.createElement('video'), { muted: true, playsInline: true, srcObject: cam }) : null;
    await vScr.play(); if (vCam) await vCam.play().catch(() => {});
    const st = scr.getVideoTracks()[0].getSettings(), w = Math.min(st.width || 1920, 1920), h = Math.round(w * ((st.height || 1080) / (st.width || 1920)));
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d');
    if (tela) { tela.innerHTML = ''; tela.appendChild(cv); }
    let vivo = true;
    const quadro = () => { if (!vivo) return; g.drawImage(vScr, 0, 0, w, h);
      if (vCam && vCam.videoWidth) { const r = Math.round(h * 0.13), cx = r + 30, cy = h - r - 30, s = Math.min(vCam.videoWidth, vCam.videoHeight); g.save(); g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.closePath(); g.lineWidth = 8; g.strokeStyle = '#ff8a3d'; g.stroke(); g.clip(); g.drawImage(vCam, (vCam.videoWidth - s) / 2, (vCam.videoHeight - s) / 2, s, s, cx - r, cy - r, r * 2, r * 2); g.restore(); }
      requestAnimationFrame(quadro); };
    quadro();
    const fluxo = cv.captureStream(30); if (cam) cam.getAudioTracks().forEach((tr) => fluxo.addTrack(tr));
    const tipo = tipoGravacao(!!(cam && cam.getAudioTracks().length)), rec = new MediaRecorder(fluxo, tipo ? { mimeType: tipo, videoBitsPerSecond: 2.5e6 } : { videoBitsPerSecond: 2.5e6 }), partes = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) partes.push(e.data); };
    const parou = new Promise((ok) => { rec.onstop = ok; });
    rec.start(500);
    const parar = async () => { if (!vivo) return; vivo = false; try { rec.stop(); } catch { /* */ } await Promise.race([parou, new Promise((ok) => setTimeout(ok, 4000))]); [scr, cam, fluxo].forEach((s) => s && s.getTracks().forEach((tr) => tr.stop())); };
    scr.getVideoTracks()[0].addEventListener('ended', () => { if (aoParar) aoParar(); });
    return { parar: async () => { await parar(); const blob = new Blob(partes, { type: (tipo || 'video/webm').split(';')[0] }); if (blob.size < 2000) throw new Error('a gravação saiu vazia'); return { blob, ext: /mp4/.test(tipo) ? 'mp4' : 'webm' }; } };
  }

  /* ---------- janela ---------- */
  function abrir(o, { aoSalvar } = {}) {
    const B = raiz.Banco, limpar = (s) => String(s || 'cliente').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const ov = document.createElement('div'); ov.className = 'apv-ov';
    ov.innerHTML = `<div class="apv-caixa" role="dialog" aria-label="Vídeo de apresentação da proposta">
      <div class="entre"><b style="font-size:18px">🎥 Vídeo de apresentação · ${esc(o.nome || '')}</b><button class="link" data-apv="fechar">fechar</button></div>
      <p class="mini" style="margin:6px 0 12px">Para o cliente que ficou com dúvida: ele assiste quando quiser, mostra para a família e você fica sabendo pela proposta.</p>
      <div class="apv-ops">
        <button class="apv-op" data-apv="auto"><b>⚡ Automático</b><span>O sistema monta ~1 min com legendas: conta de hoje, usina, economia, investimento, retorno e próximos passos. Formato de celular.</span></button>
        <button class="apv-op" data-apv="voz"><b>🎙 Com a minha voz</b><span>As mesmas telas passam e você narra. O roteiro aparece aqui embaixo para você ler. Toque em <b>Próxima</b> (ou espaço) para avançar.</span></button>
        <button class="apv-op" data-apv="tela"><b>🖥 Minha tela + câmera</b><span>Grave você explicando a proposta ao vivo, com a sua câmera no canto (como numa reunião). Melhor no computador.</span></button>
      </div>
      <div class="apv-palco"><div class="apv-tela" id="apvTela"></div><div class="apv-lado"><div id="apvRoteiro" class="apv-roteiro" hidden></div><div id="apvMsg" class="mini"></div><div class="acoes-r" id="apvAcoes"></div></div></div>
    </div>`;
    document.body.appendChild(ov);
    const tela = $('#apvTela', ov), msg = (t) => { $('#apvMsg', ov).innerHTML = t; }, acoes = $('#apvAcoes', ov), roteiroEl = $('#apvRoteiro', ov);
    let ocupado = false, resultado = null, gravacao = null;
    const fechar = () => { document.removeEventListener('keydown', tecla); ov.remove(); };
    let proxima = null; const tecla = (e) => { if (e.code === 'Space' && proxima) { e.preventDefault(); proxima(); } };
    document.addEventListener('keydown', tecla);
    function mostrarResultado(r) {
      resultado = r; const url = URL.createObjectURL(r.blob);
      tela.innerHTML = `<video src="${url}" controls playsinline style="width:100%;max-height:62vh;border-radius:14px;background:#000"></video>`;
      msg(`Pronto: ${n(r.blob.size / 1e6, 1)} MB · ${r.ext.toUpperCase()}${r.ext === 'webm' ? ' (abre no Android e no computador; para iPhone grave pelo Chrome atualizado, que gera MP4)' : ''}.`);
      acoes.innerHTML = `<button class="btn vidro pequeno" data-apv="baixar">⬇ Baixar / compartilhar</button>${B.enviarArquivo && o.id ? '<button class="btn sol pequeno" data-apv="proposta">📌 Colocar na proposta do cliente</button>' : ''}`;
    }
    async function rodar(modo) {
      if (ocupado) return; ocupado = true; resultado = null; acoes.innerHTML = ''; roteiroEl.hidden = modo !== 'voz';
      try {
        if (!raiz.MediaRecorder || !document.createElement('canvas').captureStream) throw new Error('este navegador não grava vídeo: use o Chrome');
        if (modo === 'tela') {
          msg('Escolha a <b>janela ou aba da proposta</b> para gravar. Fale à vontade: sua câmera aparece no canto. Para terminar, toque em <b>Parar</b>.');
          gravacao = await gravarTela({ tela, aoParar: () => terminarTela() });
          acoes.innerHTML = '<button class="btn sol pequeno" data-apv="parar">⏹ Parar a gravação</button>';
          return; // continua em terminarTela
        }
        const voz = modo === 'voz';
        if (voz) { acoes.innerHTML = '<button class="btn sol" data-apv="proxima">Próxima ›</button>'; msg('Gravando com o seu microfone. Leia o roteiro com calma e toque em <b>Próxima</b>.'); } else msg('Montando o vídeo… (cerca de 1 minuto)');
        const r = await gravarCenas({ o, voz, tela,
          aoCena: (i, c, tot) => { if (voz) roteiroEl.innerHTML = `<span class="rotulo">Tela ${i + 1} de ${tot} · leia:</span><p>${esc(c.fala)}</p>`; else msg(`Montando o vídeo… tela ${i + 1} de ${tot}`); },
          esperaToque: voz ? (fn) => { proxima = fn; return () => { proxima = null; }; } : null });
        roteiroEl.hidden = true; mostrarResultado(r);
      } catch (e) { msg('⚠️ ' + esc(e.message)); roteiroEl.hidden = true; }
      finally { if (modo !== 'tela') ocupado = false; }
    }
    async function terminarTela() {
      if (!gravacao) return; const gv = gravacao; gravacao = null;
      try { mostrarResultado(await gv.parar()); } catch (e) { msg('⚠️ ' + esc(e.message)); } finally { ocupado = false; }
    }
    ov.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-apv]'); if (!b) return; const a = b.dataset.apv;
      if (a === 'fechar') { if (gravacao) await terminarTela(); fechar(); return; }
      if (a === 'auto' || a === 'voz' || a === 'tela') { rodar(a); return; }
      if (a === 'proxima' && proxima) { proxima(); return; }
      if (a === 'parar') { terminarTela(); return; }
      if (a === 'baixar' && resultado) {
        const arq = new File([resultado.blob], `proposta-${limpar(o.nome)}.${resultado.ext}`, { type: resultado.blob.type });
        if (navigator.canShare && navigator.canShare({ files: [arq] })) { try { await navigator.share({ files: [arq], title: 'Sua proposta de energia solar' }); return; } catch { /* baixa */ } }
        const l = document.createElement('a'); l.href = URL.createObjectURL(arq); l.download = arq.name; document.body.appendChild(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(l.href), 5000); return;
      }
      if (a === 'proposta' && resultado) {
        if (resultado.blob.size > 48e6) { msg('⚠️ O vídeo passou de 48 MB: grave mais curto (até uns 4 minutos) para caber na proposta.'); return; }
        b.disabled = true; b.textContent = 'Enviando…';
        try {
          const arq = new File([resultado.blob], `video-proposta-${Date.now()}.${resultado.ext}`, { type: resultado.blob.type });
          const r = await B.enviarArquivo(o.id, 'Vídeo da proposta', arq), lin = Array.isArray(r) ? r[0] : r;
          o.videoApresentacao = { caminho: lin && lin.caminho, nome: arq.name, tamanho: arq.size, tipo: arq.type, em: new Date().toISOString() };
          if (aoSalvar) aoSalvar(o);
          msg('📌 Pronto: o vídeo aparece no topo da proposta do cliente ("Assista: explico a sua proposta").'); b.textContent = 'Na proposta ✓';
        } catch (err) { msg('⚠️ Não consegui enviar: ' + esc(err.message)); b.disabled = false; b.textContent = '📌 Colocar na proposta do cliente'; }
      }
    });
  }

  raiz.Apresentacao = { abrir, roteiro, gravarCenas, gravarTela };
})(window);
