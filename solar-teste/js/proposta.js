/* =====================================================================
   PROPOSTA VIVA — versão clara e simples, pensada para quem decide
   (muitas vezes 55+, alguns pouco à vontade com tecnologia).
   Regras: um assunto por bloco · título em forma de pergunta · letra
   grande · botões grandes (nada de arrastar) · uma opção em destaque ·
   o consultor sempre à vista · "ouvir a proposta" · enviar para familiar.
   Cada interação vira evento para o vendedor ver na ficha.
   ===================================================================== */
(function () {
  'use strict';
  const B = window.Banco, C = window.Conversao, D = window.DadosTeste, A = window.Agentes;
  const $ = (s, r = document) => r.querySelector(s);
  const brl = (v, c = 0) => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: c, maximumFractionDigits: c });
  const n = (v, c = 0) => C.fmt(v, c);
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const MESES = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
  const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

  B.semear();
  const qs = new URLSearchParams(location.search);
  let reserva = {}; try { reserva = JSON.parse(sessionStorage.getItem('sol2_abrir') || '{}'); } catch { /* sem armazenamento */ }
  const vendedor = qs.has('t') ? qs.get('v') === '1' : !!reserva.v;
  const o = B.porToken(qs.get('t') || reserva.t) || B.orcamentos().find((x) => x.status !== 'novo');
  const raiz = $('#proposta');
  if (!o) { raiz.innerHTML = '<div class="pv"><div class="bloco"><h2>Proposta não encontrada</h2><p>Peça um novo link ao seu consultor.</p></div></div>'; return; }

  const p = B.parametros();
  const est = { opcao: C.indiceOpcao(o, C.opcoes(o, B.parametros())), prazo: p.financiamento.prazos[2], hr: null };
  const registrar = (tipo, dados) => { if (!vendedor) B.evento(o.token, tipo, dados); };
  let a = C.analisar({ ...o, opcaoEscolhida: est.opcao }, p, est.prazo);

  /* Tipo de cliente muda a proposta: residencial (conta e parcela), comercial (retorno), grandes contas (resumo executivo), rural (produção) */
  const SEG = o.segmento || (o.grupo === 'A' ? 'grandes' : /padaria|auto|peças|ltda|comércio|mercado|loja|restaurante/i.test(o.nome) ? 'comercial' : 'residencial');
  const GA = C.ehGA(o); // Grupo A: conta de média tensão (ponta, fora ponta e demanda)
  const ehEmpresa = SEG !== 'residencial' && !/^(dona|seu|sr|sra)\b/i.test(o.nome);
  const nomeCurto = ehEmpresa ? o.nome : String(o.nome).split(' ')[0];
  const validade = new Date(+new Date(o.enviadoEm || o.criadoEm) + p.validadeDias * 864e5);
  const link = location.href.replace(/[?&]v=1/, '');
  const vend = D.empresa.vendedor, telVend = '(16) 98136-6288';
  const zapVend = () => `https://wa.me/${D.empresa.whatsapp}?text=${encodeURIComponent(`Olá ${vend}! Vi a proposta ${o.id} e quero conversar.`)}`;

  /* ---------- Estrutura da página: cada tipo de cliente tem a sua ordem e a sua história (js/narrativa.js) ---------- */
  const N = window.Narrativa, CAPA = N.capa(SEG, o, a), f3 = o.projeto3d && o.projeto3d.fotos ? o.projeto3d.fotos : null;
  const S = {
    capa: `<section class="capa capa-${SEG}" data-secao="capa">
        <div class="capa-foto${f3 && (f3.depois || f3.d3) ? '' : ' capa-sol'}"${f3 && (f3.depois || f3.d3) ? ` style="background-image:url('${f3.depois || f3.d3}')"` : ''}></div>
        <div class="capa-txt"><span class="selo">${esc(CAPA.selo)}</span>
          <h1>${esc(CAPA.titulo)}</h1><p>${esc(CAPA.sub)}</p>
          <div class="capa-num"><span>${esc(CAPA.destaque.rot)}</span><b>${esc(CAPA.destaque.val)}</b></div></div>
      </section>
      <div class="consultor">
        <div class="foto" aria-hidden="true">${esc(vend[0])}</div>
        <div><b>${esc(vend)}, seu consultor na Chama Solar</b><span>${GA ? 'Preparei com base na conta de média tensão: ponta, fora ponta e demanda.' : 'Preparei com base na sua conta de luz. Leva uns 3 minutos.'} Qualquer dúvida:</span>
          <div class="tel">${telVend}</div></div>
      </div>`,
    sonhos: `<section class="bloco destaque-bloco" data-secao="sonhos" aria-labelledby="t-sonhos">
        <h2 id="t-sonhos"><i class="bolha">${Icone(SEG === 'grandes' ? 'grafico' : SEG === 'rural' ? 'sol' : SEG === 'comercial' ? 'cofre' : 'casa')}</i>${{ residencial: 'O que a sua família vai fazer com essa economia?', comercial: 'O que essa economia faz pelo seu negócio?', grandes: 'Comparado com deixar o dinheiro aplicado', rural: 'A economia em produção' }[SEG]}</h2>
        <div id="sonhos"></div>
      </section>`,
    garantias: `<section class="bloco" data-secao="garantias" aria-labelledby="t-gar">
        <h2 id="t-gar"><i class="bolha">${Icone('medalha')}</i>${SEG === 'residencial' ? 'Pode ficar tranquilo' : 'Segurança na decisão'}</h2>
        <div class="garantias">${N.garantias(SEG, p).map(([ic, t, d]) => `<div><i aria-hidden="true">${ic}</i><b>${esc(t)}</b><span>${esc(d)}</span></div>`).join('')}</div>
      </section>`,
    executivo: SEG === 'grandes' || GA ? `<section class="bloco" data-secao="executivo" aria-labelledby="t-exe">
        <h2 id="t-exe"><i class="bolha">${Icone('documento')}</i>Resumo executivo</h2>
        <div id="executivo"></div>
      </section>` : '',
    video: o.videoApresentacao && B.videoProposta ? `<section class="bloco" data-secao="video" aria-labelledby="t-video">
        <h2 id="t-video"><i class="bolha">${Icone('monitor')}</i>Assista: explico a sua proposta</h2>
        <p class="apoio">Um vídeo curto com tudo o que está aqui, do jeito que eu explicaria pessoalmente. Pode mostrar para a família.</p>
        <div class="vid-prop" id="vidProp"><button class="btn-g" id="vidPlay" type="button">▶ Assistir o vídeo</button></div>
      </section>` : '',
    resumo: `<section class="bloco" data-secao="resumo" aria-labelledby="t-resumo">
        <h2 id="t-resumo"><i class="bolha">${Icone('grafico')}</i>Resumo em três números</h2>
        <div class="tres" id="tres"></div>
      </section>`,
    grupoA: GA ? `<section class="bloco" data-secao="grupoA" aria-labelledby="t-ga">
        <h2 id="t-ga"><i class="bolha">${Icone('conta')}</i>A conta de média tensão, hoje e com a usina</h2>
        <p class="apoio">A conta do Grupo A tem três partes. A usina abate a energia (fora ponta e ponta); a demanda contratada continua.</p>
        <div id="grupoA"></div>
      </section>` : '',
    retorno: SEG !== 'residencial' ? `<section class="bloco" data-secao="retorno" aria-labelledby="t-ret">
        <h2 id="t-ret"><i class="bolha">${Icone('grafico')}</i>${SEG === 'rural' ? 'Quanto a energia solar devolve para a propriedade' : 'Retorno do investimento'}</h2>
        <p class="apoio">O sistema se paga com a economia na conta. Depois disso, a economia vira lucro por mais de 20 anos.</p>
        <div id="retorno"></div>
      </section>` : '',
    rural: SEG === 'rural' ? `<section class="bloco" data-secao="rural" aria-labelledby="t-rur">
        <h2 id="t-rur"><i class="bolha">${Icone('sol')}</i>Energia para a produção</h2>
        <div class="itens">
          ${'<details class="item"><summary><i class="bolha">' + Icone('relogio') + '</i><span class="txt"><b>Irrigação e bombeamento</b><span>O sol gera de dia e o crédito paga a bomba à noite</span></span><span class="abrir" aria-hidden="true">' + Icone('mais') + '</span></summary><div class="explica">A energia que sobra de dia vira crédito e abate o consumo da irrigação noturna e dos motores. Se a propriedade tem desconto de irrigante, consideramos isso no cálculo.</div></details>'}
          ${'<details class="item"><summary><i class="bolha">' + Icone('casa') + '</i><span class="txt"><b>Barracão ou solo</b><span>Usamos o telhado do barracão ou uma área de terra sem uso</span></span><span class="abrir" aria-hidden="true">' + Icone('mais') + '</span></summary><div class="explica">Em área de solo a estrutura fica na inclinação ideal, sem sombra, e a manutenção é mais fácil.</div></details>'}
          ${'<details class="item"><summary><i class="bolha">' + Icone('cofre') + '</i><span class="txt"><b>Crédito rural</b><span>Linhas com juros menores e carência de safra</span></span><span class="abrir" aria-hidden="true">' + Icone('mais') + '</span></summary><div class="explica">Ajudamos a montar a documentação para o banco ou cooperativa da propriedade. As condições dependem da linha e do enquadramento do produtor.</div></details>'}
        </div>
      </section>` : '',
    conta: `<section class="bloco" data-secao="conta" aria-labelledby="t-conta">
        <h2 id="t-conta"><i class="bolha">${Icone('conta')}</i>${GA ? 'Quanto a empresa pagou de energia no último ano?' : 'Quanto você pagou de luz no último ano?'}</h2>
        <p class="apoio">${GA ? 'Cada barra é um mês da conta: ponta, fora ponta e demanda somados.' : 'Cada barra é um mês da sua conta.'} A mais escura foi a mais cara.</p>
        <div class="barras" id="barras" aria-hidden="true"></div>
        <p class="frase" id="frase-conta"></p>
      </section>`,
    espera: `<section class="bloco" data-secao="espera" aria-labelledby="t-espera">
        <h2 id="t-espera"><i class="bolha">${Icone('relogio')}</i>E se deixar para depois?</h2>
        <p class="apoio">Enquanto o sistema não é instalado, a conta continua chegando.</p>
        <div class="duas" id="espera"></div>
      </section>`,
    pagamento: `<section class="bloco" data-secao="pagamento" aria-labelledby="t-pag">
        <h2 id="t-pag"><i class="bolha">${Icone('cofre')}</i>Como fica o pagamento?</h2>
        <p class="apoio">Toque para ver em quantas vezes:</p>
        <div class="opcoes-g" id="prazos" role="group" aria-label="Prazo"></div>
        <div id="comparar"></div>
      </section>`,
    sistema: `<section class="bloco" data-secao="sistema" aria-labelledby="t-sis">
        <h2 id="t-sis"><i class="bolha">${Icone('painel')}</i>O que vamos instalar?</h2>
        <div id="sistema"></div>
      </section>`,
    vizinhos: `<section class="bloco" data-secao="vizinhos" aria-labelledby="t-viz">
        <h2 id="t-viz"><i class="bolha">${Icone('casa')}</i>${a.vizinhos.total ? 'Quem já tem perto de você?' : 'Por que a Chama Solar?'}</h2>
        ${a.vizinhos.total ? `<p class="apoio">${a.vizinhos.reais ? 'Clientes Chama Solar' + (a.vizinhos.mesmaCidade ? ' em ' + esc(o.cidade) : ' da região') + ' contando como ficou.' : 'Exemplos do modo teste (fictícios).'}</p>` : ''}
        ${a.vizinhos.usinas.slice(0, 3).map((u) => `<div class="viz"><b>${u.real ? esc(u.nome || 'Cliente') + (u.cidade ? ' · ' + esc(u.cidade) : '') : 'Bairro ' + esc(u.bairro)}</b>${u.contaAntes ? `<div class="de-para"><s>${brl(u.contaAntes)}</s><span>${brl(u.contaMes)}</span></div>` : ''}<small>${u.texto ? '“' + esc(u.texto) + '”' : `Pagava ${brl(u.contaAntes)} por mês. Hoje paga ${brl(u.contaMes)}.`}${u.desde ? ' Instalado em ' + esc(u.desde) + '.' : ''}${u.link ? ` <a href="${esc(u.link)}" target="_blank" rel="noopener">ver no Instagram</a>` : ''}</small></div>`).join('')}
        <div class="selos">
          ${(() => { const ed = p.empresaDoc || {}, teste = !B.nuvem; const anos = ed.anosRegiao || (teste ? D.empresa.anos : 0), selo = ed.seloConfianca || (teste ? D.empresa.selo : ''); return (anos ? `<div>${Icone('medalha')} ${esc(anos)} anos na região</div>` : '') + (selo ? `<div>${Icone('estrela')} ${esc(selo)}</div>` : ''); })()}
          <div>${Icone('documento')} Papelada da CPFL por nossa conta</div><div>${Icone('monitor')} Acompanhamos sua usina todo mês</div>
        </div>
      </section>`,
    duvidas: `<section class="bloco" data-secao="duvidas" aria-labelledby="t-duv">
        <h2 id="t-duv"><i class="bolha">${Icone('conversa')}</i>Dúvidas mais comuns</h2>
        <div id="duvidas"></div>
      </section>`,
    decidir: `<section class="bloco" id="s-decidir" data-secao="decidir" aria-labelledby="t-dec">
        <h2 id="t-dec"><i class="bolha">${Icone('seta')}</i>Vamos para o próximo passo?</h2>
        <div id="decidir"></div>
      </section>`,
    usina3d: `${o.projeto3d && o.projeto3d.fotos && o.projeto3d.fotos.d3 ? (() => { const p3 = o.projeto3d, r3 = p3.resultado || {}; return `<section class="bloco" data-secao="usina3d" aria-labelledby="t-3d">
        <h2 id="t-3d"><i class="bolha">${Icone('casa')}</i>Sua usina em 3D</h2>
        <p class="apoio">Montada sobre a foto ${p3.drone ? 'do drone' : p3.fonte === 'google' ? 'de satélite' : 'aérea'} do seu telhado, com a medida real de cada placa e a sombra calculada hora a hora, para o ano inteiro.</p>
        <div class="v3d" id="v3d"><img src="${p3.fotos.d3}" alt="Usina solar em 3D no seu telhado"></div>
        <div class="v3d-ctl" id="v3dCtl" hidden>
          <div class="v3d-dias" role="group" aria-label="Época do ano">${[[0, 'Verão'], [3, 'Mar · Set'], [6, 'Inverno']].map(([d, t]) => `<button data-v3d-dia="${d}" aria-pressed="${d === 6}">${t}</button>`).join('')}</div>
          <div class="v3d-linha"><button class="v3d-play" id="v3dPlay" aria-label="Ver o sol passar">▶</button><input type="range" id="v3dHora" min="6" max="18" step="0.05" value="9.5" aria-label="Hora do dia"><b id="v3dHoraO">09:30</b></div>
          <span id="v3dTxt"></span></div>
        ${p3.fotos.antes && p3.fotos.depois ? `<div class="ad" id="antesDepois"><img src="${p3.fotos.antes}" alt="Seu telhado hoje"><div class="ad-dep" id="adDep"><img src="${p3.fotos.depois}" alt="O seu telhado com a usina"></div><i class="ad-linha" id="adLinha"></i><span class="ad-r ad-a">Hoje</span><span class="ad-r ad-d">Com a usina</span><input type="range" min="0" max="100" value="50" id="adRange" aria-label="Arraste para ver antes e depois"></div><p class="apoio" style="margin-top:6px">Arraste para comparar o seu telhado hoje e com a usina.</p>` : ''}
        <button class="btn-g contorno" id="v3dGirar" style="margin-top:10px">${Icone('casa')} Girar a casa e ver o sol passar</button>
        <p class="apoio" style="margin-top:8px">${r3.placas ? `${r3.placas} placas · sombra medida: ${n((r3.perdaSombra ?? r3.perdaSom ?? 0) * 100, 1)}% da geração do ano, já descontada${r3.geracaoAnual ? ` · ${n(r3.geracaoAnual / 12)} kWh por mês` : ''}` : ''}${p3.fonte === 'google' ? ' · Imagens © Google' : ''}</p>
      </section>`; })() : ''}`,
  };
  // a ordem conta a história: família (sonho → conta → parcela), negócio (lucro → retorno), executivo (números → conta → técnica), rural (produção → retorno)
  const ORDEM = {
    residencial: ['video', 'resumo', 'sonhos', 'conta', 'espera', 'pagamento', 'usina3d', 'sistema', 'garantias', 'vizinhos', 'duvidas', 'decidir'],
    comercial: ['video', 'resumo', 'sonhos', 'retorno', 'conta', 'espera', 'pagamento', 'usina3d', 'sistema', 'garantias', 'vizinhos', 'duvidas', 'decidir'],
    grandes: ['executivo', 'video', 'sonhos', 'grupoA', 'retorno', 'resumo', 'conta', 'usina3d', 'sistema', 'pagamento', 'espera', 'garantias', 'vizinhos', 'duvidas', 'decidir'],
    rural: ['video', 'resumo', 'sonhos', 'rural', 'retorno', 'conta', 'espera', 'pagamento', 'usina3d', 'sistema', 'garantias', 'vizinhos', 'duvidas', 'decidir'],
  }[SEG] || [];
  raiz.innerHTML = `
    ${vendedor ? `<div class="faixa">MODO VENDEDOR · suas visitas não contam · <a href="index.html#lead-${esc(o.id)}">voltar para a central</a></div>` : ''}
    ${B.nuvem ? '' : '<div class="faixa" style="background:#e9edf5;color:#46526b">Versão de teste · números simulados</div>'}
    <header class="topo"><div class="pv">
      <img src="marca/logo-cor.webp" alt="Chama Solar" width="123" height="52">
      <div class="ferramentas">
        <button type="button" id="ouvir" aria-pressed="false">${Icone('som')} <span>Ouvir</span></button>
        <button type="button" id="letra" aria-pressed="false">${Icone('letra')} <span>Letra</span></button>
      </div>
    </div></header>
    <main class="pv">
      ${S.capa}
      ${ORDEM.map((k) => S[k] || '').join('\n      ')}

      <footer class="rodape">
        <img src="marca/logo-cor.webp" alt="Chama Solar" width="104" height="44">
        ${esc(D.empresa.endereco)}<br>Telefone ${esc(D.empresa.telefone)} · ${esc(D.empresa.email)}<br><br>
        Valores estimados com base no seu consumo e no sol médio da sua cidade. A geração real varia com o clima. Financiamento sujeito a aprovação de crédito. Proposta ${esc(o.id)}, válida até ${validade.toLocaleDateString('pt-BR')}.
      </footer>
    </main>
    <div class="cta-fixo" id="cta"><div class="pv">
      <a class="btn-g verde" id="zap-fixo" href="${zapVend()}" target="_blank" rel="noopener" aria-label="Falar com ${esc(vend)} no WhatsApp">${Icone('conversa')}</a>
      <a class="btn-g laranja" href="#s-decidir">Quero minha usina</a>
    </div></div>`;

  /* Item tocável: ícone + título; ao tocar, abre a explicação */
  const item = (ic, titulo, sub, explica, extra = '') => `<details class="item"><summary><i class="bolha">${Icone(ic)}</i><span class="txt"><b>${titulo}</b><span>${sub}</span></span><span class="abrir" aria-hidden="true">${Icone('mais')}</span></summary><div class="explica">${explica}${extra}</div></details>`;

  /* ---------- Grupo A: a conta de média tensão por partes ---------- */
  const tarifaRede = () => (GA && a.op.eco.grupoA ? (+(o.grupoA.tarifas.teFP || 0) + +(o.grupoA.tarifas.tusdFP || 0)) : p.tarifaKwh);
  function blocoGrupoA(op) {
    const eco = op.eco, g = eco.grupoA, l = op.limiteDemanda || {};
    const dem = g.modalidade === 'azul' ? `${n(g.demandaKw.p)} kW ponta · ${n(g.demandaKw.fp)} kW fora ponta` : `${n(g.demandaKw)} kW`;
    const linha = (t, sub, hoje, dep, cls = '') => `<tr class="${cls}"><td>${t}${sub ? `<small>${sub}</small>` : ''}</td><td class="v">${brl(hoje)}</td><td class="v">${brl(dep)}</td></tr>`;
    return `<table class="ga-conta"><thead><tr><th></th><th class="v">Hoje</th><th class="v">Com a usina</th></tr></thead><tbody>
        ${linha('Energia fora ponta', `${n(g.cFP)} kWh por mês`, g.valorFP, g.depoisFP)}
        ${linha('Energia na ponta', `${n(g.cP)} kWh por mês, no fim da tarde`, g.valorP, g.depoisP)}
        ${linha('Demanda contratada', dem, g.demandaMes, g.demandaMes)}
        ${linha('Total por mês', '', eco.contaAtual, eco.contaDepois, 'total')}</tbody></table>
      <div class="veredito bom">A conta cai ${brl(eco.economiaMes1)} por mês (${n((eco.economiaMes1 / Math.max(eco.contaAtual, 1)) * 100)}%).</div>
      <ol class="ga-passos">
        <li><b>${n(g.autoconsumo)} kWh</b> a empresa usa na hora em que a usina gera: saem direto do fora ponta${g.simultaneidade ? ` (estimamos ${n(g.simultaneidade * 100)}% da geração usada na hora)` : ''}.</li>
        <li><b>${n(g.compensadoFP)} kWh</b> vão para a rede durante o dia e voltam como crédito no fora ponta.</li>
        <li>${g.compensadoP ? `<b>${n(g.compensadoP)} kWh de ponta</b> são pagos com o crédito que sobra. Cada kWh de ponta usa ${n(g.fa, 2)} kWh de crédito, pela relação entre as tarifas de energia.` : 'A ponta (três horas no fim da tarde, em dias úteis) continua na conta: a usina foi dimensionada para o fora ponta.'}</li>
        <li>A demanda contratada continua igual: ela paga a potência que a CPFL reserva para a empresa, com sol ou sem sol.</li>
        ${g.fioBMes ? `<li>Pela Lei 14.300, parte do Fio B da tarifa não é compensada (cerca de ${brl(g.fioBMes)} por mês em ${p.anoBase}). Já está descontado nos números acima.</li>` : ''}
        ${g.creditoSobra ? `<li>Sobram cerca de <b>${n(g.creditoSobra)} kWh</b> de crédito por mês, que valem por até 60 meses.</li>` : ''}
      </ol>
      ${l.demandaKw && !l.ok ? `<p class="apoio" style="margin-top:10px">A usina (inversor de ${n(l.potInvKw, 1)} kW) passa da demanda contratada hoje (${n(l.demandaKw)} kW). Antes de ligar, a demanda precisa ser revista com a CPFL; o custo dessa revisão não está nesta simulação. A Chama Solar cuida do pedido junto com o projeto.</p>` : ''}`;
  }
  function duvidasGA(op) {
    const eco = op.eco, g = eco.grupoA;
    return [
      ['demanda', 'Por que a demanda continua na conta?', `A demanda contratada é a potência que a CPFL deixa reservada para a empresa, cobrada por kW mesmo nos meses de pouco consumo. A usina reduz a energia (kWh), não a demanda. Se no futuro a empresa reduzir a demanda contratada, a economia aumenta.`],
      ['ponta', 'A usina gera no horário de ponta?', `Quase nada: a ponta é no fim da tarde, quando o sol já está baixo. Por isso a usina abate primeiro o fora ponta, e o crédito que sobra paga a ponta. Cada kWh de ponta usa ${n(g.fa, 2)} kWh de crédito, pela relação entre as tarifas de energia da ponta e do fora ponta.`],
      ['taxacao', 'E a taxação do sol (Fio B)?', `Pela Lei 14.300, sobre a energia compensada pela rede passa a ser cobrada uma parte da tarifa de distribuição (o Fio B), que sobe até 2029. Na simulação já está descontado: cerca de ${brl(g.fioBMes)} por mês em ${p.anoBase}. O que a empresa usa na hora em que a usina gera não paga Fio B.`],
      ['caro', 'Vale mais do que deixar o dinheiro aplicado?', `A usina rende ${n(eco.tir * 100, 1)}% ao ano (TIR) e se paga em ${eco.paybackAnos ? n(eco.paybackAnos, 1) + ' anos' : 'poucos anos'}, já com o reajuste da tarifa e a perda natural das placas. Depois disso, a economia de cerca de ${brl(eco.economiaMes1)} por mês fica com a empresa por mais de 20 anos.`],
    ];
  }

  /* ---------- A economia contada do jeito de cada cliente (sonhos, negócio, investimento, produção) ---------- */
  function blocoSonhos(op, eco, sobra) {
    const R = N.ref(p);
    if (SEG === 'residencial') {
      const extra = est.sonho && est.sonho.valor > 0 ? { id: 'meu', icone: '⭐', titulo: est.sonho.titulo || 'O nosso sonho', valor: est.sonho.valor, meu: true } : null;
      const lista = N.sonhos(eco, p, extra), poup = N.valorFuturo(eco.economiaMes1, 25, R.poupancaAnual);
      return `<p class="apoio">Com <b style="color:var(--bom)">${brl(sobra)} por mês</b> que deixam de ir para a CPFL, a economia sozinha paga:</p>
        <div class="sonhos">${lista.map((x) => `<div class="sonho${x.meu ? ' meu' : ''}"><i aria-hidden="true">${x.icone}</i><b>${esc(x.titulo)}</b><small>${brl(x.valor)}</small><span>pago ${x.quando}</span>${x.vezes > 1 ? `<em>${x.vezes} vezes em 25 anos</em>` : ''}</div>`).join('')}</div>
        <details class="meu-sonho"${est.sonho ? ' open' : ''}><summary>Qual é o sonho de vocês? Calcule aqui</summary>
          <div class="ms-campos"><label>Sonho<input type="text" id="msTit" placeholder="ex.: intercâmbio da filha" value="${esc((est.sonho && est.sonho.titulo) || '')}"></label>
          <label>Quanto custa (R$)<input type="number" id="msVal" inputmode="numeric" placeholder="ex.: 20000" value="${(est.sonho && est.sonho.valor) || ''}"></label></div>
          <button type="button" class="btn-g contorno" id="msOk">Ver em quanto tempo a economia paga</button></details>
        <p class="frase" style="font-size:1rem">Ou guarde: se depositar a economia na poupança todo mês, em 25 anos a família tem <b class="destaque-bom">${brl(poup)}</b>.</p>`;
    }
    if (SEG === 'comercial') {
      const ng = N.negocio(eco, p), inv = N.investimento(eco, op.preco.precoFinal, p);
      const func = ng.funcionarios >= 1 ? `${n(Math.floor(ng.funcionarios))} ${Math.floor(ng.funcionarios) > 1 ? 'funcionários pagos' : 'funcionário pago'} o ano todo` : `${n(ng.funcionarios * 12)} meses de um funcionário`;
      return `<p class="apoio">A conta de luz é custo fixo: todo mês sai do caixa, venda bem ou mal. Com a usina, <b style="color:var(--bom)">${brl(ng.ano)} por ano</b> voltam para o negócio. É o mesmo que:</p>
        <div class="sonhos">
          <div class="sonho"><i aria-hidden="true">👥</i><b>${func}</b><small>salário + encargos de ${brl(ng.custoFuncionario)}/mês</small></div>
          <div class="sonho"><i aria-hidden="true">🛒</i><b>Vender ${brl(ng.vendasEquivalentes)} a mais</b><small>por ano, com margem de ${n(ng.margem * 100)}%: o lucro que a economia já entrega</small></div>
          <div class="sonho"><i aria-hidden="true">📈</i><b>${n(inv.tir * 100, 1)}% ao ano</b><small>de retorno, contra ${n(inv.cdiLiquido * 100, 1)}% do CDI (já com IR)</small></div>
          <div class="sonho"><i aria-hidden="true">💰</i><b>${brl(eco.economia25)}</b><small>de caixa em 25 anos</small></div></div>`;
    }
    if (SEG === 'grandes') {
      const inv = N.investimento(eco, op.preco.precoFinal, p), amb = N.ambiental(op, p);
      const bar = (rot, v, cls) => `<div class="cmp"><span>${rot}</span><div class="trilho"><i class="${cls}" style="width:${Math.max(4, Math.min(v / Math.max(inv.tir, inv.cdiLiquido, 0.01), 1) * 100)}%"></i></div><b>${n(v * 100, 1)}% a.a.</b></div>`;
      return `<p class="apoio">Rendimento ao ano de cada alternativa para o mesmo dinheiro:</p>
        ${bar('Usina solar (TIR)', inv.tir, 'bom')}${bar('CDI (líquido de IR)', inv.cdiLiquido, 'neutro')}${bar('Poupança', inv.poupanca, 'neutro')}
        <p class="frase" style="font-size:1rem">Os ${brl(op.preco.precoFinal)} no CDI renderiam cerca de <b>${brl(inv.rendeCdiMes)} por mês</b>. Na usina, a empresa deixa de pagar <b class="destaque-bom">${brl(eco.economiaMes1)} por mês</b> já no primeiro ano, e essa economia cresce com cada reajuste da tarifa.</p>
        <div class="esg"><div><b>${n(amb.mwhAno, 1)} MWh</b><span>de energia limpa por ano</span></div><div><b>${n(amb.tco2_25, 1)} t</b><span>de CO₂ evitadas em 25 anos</span></div><div><b>ESG</b><span>energia renovável no relatório da empresa</span></div></div>`;
    }
    // rural
    const pr = N.producao(eco, p);
    return `<p class="apoio">Por ano, a economia na conta vale o mesmo que:</p>
      <div class="sonhos">${pr.map((x) => `<div class="sonho"><i aria-hidden="true">${x.icone}</i><b>${n(x.qtd)} ${x.titulo}</b><small>a ${brl(x.preco)} a ${x.un}</small></div>`).join('')}
        <div class="sonho"><i aria-hidden="true">💰</i><b>${brl(eco.economia25)}</b><small>em 25 anos que ficam na propriedade</small></div></div>
      <p class="apoio" style="margin-top:10px">É produção que deixa de ir embora na conta de luz e pode virar adubo, ração, máquina ou reserva para a próxima safra.</p>`;
  }

  /* ---------- Partes que mudam com as escolhas ---------- */
  function desenhar() {
    a = C.analisar({ ...o, opcaoEscolhida: est.opcao }, p, est.prazo);
    const op = a.op, eco = op.eco;
    const sobra = eco.contaAtual - eco.contaDepois;

    $('#tres').innerHTML = `
      <div class="num-card hoje"><i class="bolha">${Icone('conta')}</i><span>Hoje você paga</span><b>${brl(eco.contaAtual)}</b><small>por mês, em média</small></div>
      <div class="num-card depois"><i class="bolha">${Icone('sol')}</i><span>Com energia solar</span><b>${brl(eco.contaDepois)}</b><small>${GA ? 'por mês (a demanda contratada continua)' : 'por mês (taxa mínima da CPFL)'}</small></div>
      <div class="num-card sobra"><i class="bolha">${Icone('cofre')}</i><span>Sobra no seu bolso</span><b>${brl(sobra)}</b><small>por mês, depois de pago o sistema</small></div>`;

    if ($('#retorno')) {
      const tab = eco.tabela, maxA = Math.max(...tab.map((t) => Math.abs(t.acumulado)), op.preco.precoFinal);
      $('#retorno').innerHTML = `<div class="tres">
          <div class="num-card"><i class="bolha">${Icone('relogio')}</i><span>Se paga em</span><b>${eco.paybackAnos ? n(eco.paybackAnos, 1) + ' anos' : '—'}</b><small>com a economia na conta</small></div>
          <div class="num-card"><i class="bolha">${Icone('grafico')}</i><span>Rendimento (TIR)</span><b>${n(eco.tir * 100, 1)}% ao ano</b><small>compare com a poupança ou o CDI</small></div>
          <div class="num-card sobra"><i class="bolha">${Icone('cofre')}</i><span>Economia em 25 anos</span><b>${brl(eco.economia25)}</b><small>já com reajuste da tarifa</small></div></div>
        <p class="apoio" style="margin:14px 0 6px">Caixa acumulado, ano a ano (vermelho: ainda pagando o sistema; verde: lucro):</p>
        <div aria-hidden="true" style="display:flex;align-items:center;gap:2px;height:130px;position:relative;border-left:1px solid var(--linha,#e3e6ec)">${(() => { const neg = Math.max(...tab.map((t) => (t.acumulado < 0 ? -t.acumulado : 0)), op.preco.precoFinal), pos = Math.max(...tab.map((t) => (t.acumulado > 0 ? t.acumulado : 0)), 1), zero = neg / (neg + pos) * 100; return `<div style="position:absolute;left:0;right:0;top:${100 - zero}%;border-top:1px solid var(--linha,#c9ced9)"></div>` + [{ acumulado: -op.preco.precoFinal }, ...tab].map((t) => `<div style="flex:1;height:100%;position:relative"><i style="position:absolute;left:0;right:0;border-radius:2px;${t.acumulado < 0 ? `top:${100 - zero}%;height:${-t.acumulado / (neg + pos) * 100}%;background:var(--ruim)` : `bottom:${zero}%;height:${t.acumulado / (neg + pos) * 100}%;background:var(--bom)`}"></i></div>`).join(''); })()}</div>
        <div style="display:flex;justify-content:space-between;font-size:.8rem;color:var(--texto-2,#5b6478);margin-top:4px"><span>hoje</span><span>ano 5</span><span>ano 10</span><span>ano 15</span><span>ano 20</span><span>ano 25</span></div>
        <p class="frase" style="font-size:1rem">Cada kWh do sistema sai por <b>R$ ${n(a.energia.rsKwh, 2)}</b> ao longo de 25 anos, contra <b>R$ ${n(tarifaRede(), 2)}</b> da CPFL hoje${GA ? ' no fora ponta' : ''}.</p>`;
    }
    if ($('#executivo')) {
      $('#executivo').innerHTML = `<table class="tab-exe"><tbody>
        <tr><td>Investimento</td><td><b>${brl(op.preco.precoFinal)}</b></td></tr>
        <tr><td>Potência</td><td><b>${n(op.dim.kwpReal, 2)} kWp</b> · ${op.dim.placas} placas</td></tr>
        <tr><td>Geração anual estimada</td><td><b>${n(op.dim.geracaoMes * 12)} kWh</b></td></tr>
        <tr><td>Economia no 1º ano</td><td><b>${brl(eco.economiaMes1 * 12)}</b></td></tr>
        <tr><td>Retorno (payback)</td><td><b>${eco.paybackAnos ? n(eco.paybackAnos, 1) + ' anos' : '—'}</b></td></tr>
        <tr><td>TIR · VPL (${n(p.taxaDesconto * 100, 1)}% a.a.)</td><td><b>${n(eco.tir * 100, 1)}% a.a. · ${brl(eco.vpl)}</b></td></tr>
        <tr><td>Custo da energia gerada (LCOE)</td><td><b>R$ ${n(a.energia.rsKwh, 2)}/kWh</b> contra R$ ${n(tarifaRede(), 2)} da rede${GA ? ' (fora ponta)' : ''}</td></tr>
        ${GA ? (() => { const g = eco.grupoA, l = op.limiteDemanda || {}; return `<tr><td>Conta de energia por mês</td><td><b>${brl(eco.contaAtual)} → ${brl(eco.contaDepois)}</b></td></tr>
        <tr><td>Tarifa · demanda contratada</td><td><b>${g.modalidade === 'azul' ? 'Azul' : 'Verde'} · ${g.modalidade === 'azul' ? `${n(g.demandaKw.p)} kW ponta e ${n(g.demandaKw.fp)} kW fora ponta` : `${n(g.demandaKw)} kW`}</b>${l.demandaKw ? (l.ok ? ` · inversor de ${n(l.potInvKw, 1)} kW dentro da demanda` : ` · inversor de ${n(l.potInvKw, 1)} kW: a demanda precisa ser revista com a CPFL`) : ''}</td></tr>`; })() : ''}
        <tr><td>Prazo de execução</td><td><b>${(p.empresaDoc && p.empresaDoc.prazoInstalacaoDias) || 60} dias</b> após a aprovação da CPFL</td></tr>
      </tbody></table>
      <p class="apoio" style="margin-top:10px">Geração garantida em contrato: ${n(op.dim.geracaoMes * 12 * 0.9)} kWh por ano (90% da simulada), apurada pela média de 12 meses.</p>`;
    }
    if ($('#sonhos')) $('#sonhos').innerHTML = blocoSonhos(op, eco, sobra);
    const v = a.raioX.mensal, max = Math.max(...v), iMax = v.indexOf(max);
    $('#barras').innerHTML = v.map((x, i) => `<div class="b ${i === iMax ? 'max' : ''}"><i style="height:${Math.max((x / max) * 100, 4)}%"></i><em>${MESES[i]}</em></div>`).join('');
    $('#frase-conta').innerHTML = `No total foram <b class="destaque-ruim">${brl(a.raioX.pago12)}</b> para a CPFL. A conta mais cara foi em ${MESES_LONGOS[iMax]}: <b>${brl(max)}</b>.`;
    if ($('#grupoA')) $('#grupoA').innerHTML = blocoGrupoA(op);

    const t25 = a.raioX.curva[24];
    const mx = Math.max(t25.sem, t25.com);
    $('#espera').innerHTML = `
      <div class="por-dia"><span>Cada dia sem energia solar custa</span><b>${brl(a.espera.porMes / 30, 2)}</b><small>${brl(a.espera.porMes)} por mês · ${brl(a.espera.seisMeses)} em seis meses</small></div>
      <div class="linha-c"><div class="rot"><span>25 anos só com a CPFL</span><b class="destaque-ruim">${brl(t25.sem)}</b></div><div class="trilho"><i style="width:100%;background:var(--ruim)"></i></div></div>
      <div class="linha-c"><div class="rot"><span>25 anos com energia solar</span><b class="destaque-bom">${brl(t25.com)}</b></div><div class="trilho"><i style="width:${(t25.com / mx) * 100}%;background:var(--bom)"></i></div></div>
      <p class="apoio" style="margin:12px 0 0">${GA ? `Com solar já está tudo somado: o sistema, a demanda contratada, a energia que ainda fica na conta e a limpeza anual. A simulação usa reajuste de ${n(p.reajusteAnual * 100, 1)}% ao ano na tarifa.` : `Com solar já está tudo somado: o sistema, a taxa mínima da CPFL e a limpeza anual. A CPFL reajustou a tarifa residencial em ${n(p.reajusteUltimo * 100, 2)}% em 2026.`}</p>`;

    $('#prazos').innerHTML = [...p.financiamento.prazos.slice().reverse(), 0].map((pz) => {
      const parc = pz ? C.boleto(op, p, pz).parcela : 0;
      return `<button type="button" data-prazo="${pz}" aria-pressed="${est.prazo === pz}">${pz ? `${pz} vezes<small>${brl(parc)}/mês</small>` : `À vista<small>${brl(op.preco.precoFinal)}</small>`}</button>`;
    }).join('');
    const b = C.boleto(op, p, est.prazo);
    $('#comparar').innerHTML = `
      <div class="conta-vs">
        <div class="caixa hoje"><span>Hoje</span><b>${brl(b.contaAtual)}</b><small>conta de luz</small></div>
        <div class="caixa solar"><span>Com energia solar</span><b>${brl(b.totalMes)}</b><small>${b.parcela ? `parcela ${brl(b.parcela)} + conta ${brl(b.contaDepois)}` : GA ? 'só o que fica na conta' : 'só a conta mínima'}</small></div>
      </div>
      <div class="veredito ${b.diferenca >= 0 ? 'bom' : 'quase'}">${b.diferenca >= 0 ? `Você já começa pagando ${brl(b.diferenca)} a menos por mês.` : `Fica só ${brl(-b.diferenca)} a mais por mês (${brl(-b.diferenca / 30, 2)} por dia) até terminar de pagar. Depois, ${brl(eco.contaAtual - eco.contaDepois)} por mês ficam com ${GA || SEG !== 'residencial' ? 'a empresa' : 'você'}.`}</div>
      <p class="frase" style="font-size:1rem">${b.parcela ? `Depois de ${b.prazo / 12} anos as parcelas acabam e ${GA ? 'a empresa passa' : 'você passa'} a pagar só ${brl(b.contaDepois)} de ${GA ? 'energia' : 'luz'}.` : `Desde o primeiro mês ${GA ? 'a empresa paga' : 'você paga'} só ${brl(b.contaDepois)} de ${GA ? 'energia' : 'luz'}.`}</p>`;

    const consumoZerar = Math.max(C.consumoMedio(o) - op.dim.disponibilidade, 0);
    const eq = C.equipamentos(op);
    $('#sistema').innerHTML = `
      <p class="apoio">A opção que recomendamos para ${SEG === 'residencial' ? 'a sua casa' : SEG === 'rural' ? 'a propriedade' : 'a empresa'}:</p>
      <div class="itens">
        ${item('painel', esc(eq.modulo), `Ocupam cerca de ${n(op.areaM2)} m² do telhado`, `As placas transformam a luz do sol em energia. As placas ${esc(eq.marcaMod)} têm garantia de fábrica do produto e de rendimento. Os prazos de cada modelo vêm na ficha técnica que entregamos com o contrato.`)}
        ${item(eq.tipo === 'micro' ? 'micro' : 'inversor', esc(eq.inversor), eq.tipo === 'micro' ? 'Um para cada grupo de placas' : eq.tipo === 'hibrido' ? 'Converte a energia e carrega a bateria' : 'O "cérebro" do sistema', eq.tipo === 'micro' ? 'Cada microinversor cuida de poucas placas. Se uma placa pegar sombra, as outras continuam gerando normalmente, e o sistema é desligado placa por placa, o que é mais seguro.' : eq.tipo === 'hibrido' ? 'Além de transformar a energia do sol, ele guarda energia na bateria e mantém o essencial ligado quando a luz da rua cai.' : `Transforma a energia das placas na energia da tomada ${SEG === 'residencial' ? 'da sua casa' : 'da empresa'} e manda o que sobrar para a CPFL, que vira crédito na ${SEG === 'residencial' ? 'sua conta' : 'conta'}.`)}
        ${op.bateria ? item('bateria', `Bateria de ${n(op.bateria.kwh, 1)} kWh`, 'Energia guardada para quando faltar luz', 'Mantém geladeira, luzes e internet ligadas durante uma queda de energia.') : ''}
        ${GA ? item('grafico', `Gera ${n(op.dim.geracaoMes)} kWh por mês`, `A empresa usa ${n(eco.grupoA.cFP)} kWh fora ponta e ${n(eco.grupoA.cP)} kWh na ponta`, `A usina gera de dia, fora do horário de ponta. ${n(eco.grupoA.autoconsumo)} kWh são usados na hora pela empresa, ${n(eco.grupoA.compensadoFP)} kWh viram crédito no fora ponta${eco.grupoA.compensadoP ? ` e ${n(eco.grupoA.compensadoP)} kWh de ponta são pagos com o crédito que sobra` : ''}. A conta mostra a média do ano, com dias de sol e de chuva.`, `<div class="trilho" style="margin-top:10px"><i style="width:${Math.min((eco.grupoA.autoconsumo + eco.grupoA.compensadoFP) / Math.max(eco.grupoA.cFP, 1), 1) * 100}%;background:var(--bom)"></i></div><p class="mini-p" style="text-align:left">${n(Math.min((eco.grupoA.autoconsumo + eco.grupoA.compensadoFP) / Math.max(eco.grupoA.cFP, 1), 1) * 100)}% do fora ponta coberto</p>`) : item('grafico', `Gera ${n(op.dim.geracaoMes)} kWh por mês`, `Você usa ${n(C.consumoMedio(o))} kWh por mês`, `Desses ${n(C.consumoMedio(o))} kWh, ${n(consumoZerar)} kWh dá para zerar. Os outros ${op.dim.disponibilidade} kWh são a taxa mínima que a CPFL cobra de todo mundo, mesmo de quem tem energia solar. A conta mostra a média do ano, com dias de sol e de chuva.`, `<div class="trilho" style="margin-top:10px"><i style="width:${Math.min(op.dim.geracaoMes / Math.max(consumoZerar, 1), 1) * 100}%;background:var(--bom)"></i></div><p class="mini-p" style="text-align:left">${n(Math.min(op.dim.geracaoMes / Math.max(consumoZerar, 1), 1) * 100)}% do que dá para zerar</p>`)}
        ${item('ferramenta', 'Instalação, projeto e papelada da CPFL', 'Tudo incluído no preço', 'Fazemos a visita técnica, o projeto, a aprovação na CPFL, a instalação e a troca do medidor. Você não precisa ir a lugar nenhum.')}
      </div>
      <div class="preco-sis"><span>Investimento</span><b>${brl(op.preco.precoFinal)}</b></div>
      <details class="outras"><summary>Ver a outra opção (microinversor)</summary>
        ${a.opcoes.map((x, i) => i === est.opcao ? '' : `<div class="op-mini"><span><b style="font-family:inherit">${esc(x.nivel)}</b></span><b>${brl(x.preco.precoFinal)}</b><p>${esc(C.equipamentos(x).modulo)} + ${esc(C.equipamentos(x).inversor.replace(/^./, (c) => c.toLowerCase()))}. Gera ${n(x.dim.geracaoMes)} kWh/mês. ${esc(x.descricao)}</p><button type="button" data-op="${i}">Escolher esta opção</button></div>`).join('')}
      </details>`;

    const perguntas = GA ? duvidasGA(op) : [
      ['caro', 'É muito dinheiro para agora?'], ['taxacao', 'Ouvi falar que agora o sol é taxado. Ainda compensa?'],
      ['tecnologia', 'Não é melhor esperar a tecnologia melhorar?'], ['mudar', 'E se eu mudar de casa?'],
    ].map(([id, q]) => [id, q, A.resposta(id, a, o)]);
    $('#duvidas').innerHTML = perguntas.map(([id, q, r]) => `<details class="duvida" data-duvida="${id}"><summary>${q}</summary><p>${esc(r)}</p></details>`).join('') +
      `<details class="duvida" data-duvida="nublado"><summary>E em dia nublado ou à noite?</summary><p>À noite você usa a energia da CPFL normalmente. De dia, o que sobra vira crédito na sua conta. O cálculo já usa a média do ano inteiro, com os dias nublados.</p></details>
       <details class="duvida" data-duvida="manutencao"><summary>Dá trabalho para cuidar?</summary><p>Quase nenhum: uma limpeza por ano. E a gente acompanha a sua usina todo mês e te avisa se algo sair do normal.</p></details>`;
    decidir();
  }

  function decidir() {
    const op = a.op;
    if ((o.status === 'ganho' && (o.aceite || o.obra || o.posVenda)) || est.aceito) {
      const OBRA = [['contrato', 'Contrato assinado'], ['projeto', 'Projeto e ART prontos'], ['protocolo', 'Pedido protocolado na distribuidora'], ['parecer', 'Projeto aprovado pela distribuidora'], ['kit', 'Equipamentos entregues'], ['instalacao', 'Instalação concluída'], ['vistoria', 'Vistoria e troca do medidor'], ['ligada', 'Sistema ligado e gerando']], ob = o.obra || o.posVenda || {};
      const tem = OBRA.some(([k]) => ob[k]), ult = OBRA.reduce((m, [k], i) => (ob[k] ? i : m), -1);
      const linha = tem ? `<div class="bloco" style="margin-top:18px"><h2>Acompanhe a sua instalação</h2><ol style="list-style:none;padding:0;margin:12px 0 0">${OBRA.map(([k, t], i) => `<li style="display:flex;gap:10px;align-items:center;padding:8px 0;${i > ult + 1 ? 'opacity:.45' : ''}"><span style="width:26px;height:26px;border-radius:50%;display:grid;place-items:center;font-weight:700;background:${ob[k] ? 'var(--laranja,#ff7a00)' : i === ult + 1 ? 'transparent' : 'rgba(127,127,127,.15)'};color:${ob[k] ? '#fff' : 'inherit'};border:2px solid ${ob[k] || i === ult + 1 ? 'var(--laranja,#ff7a00)' : 'transparent'}">${ob[k] ? '✓' : i + 1}</span><span><b>${t}</b>${ob[k] ? ` <small style="opacity:.7">· ${new Date(ob[k]).toLocaleDateString('pt-BR')}</small>` : i === ult + 1 ? ' <small style="opacity:.7">· próxima etapa</small>' : ''}</span></li>`).join('')}</ol></div>` : '';
      $('#decidir').innerHTML = `<div class="sucesso"><div class="grande">☀️</div><h2>${ob.ligada ? 'Seu sistema está gerando!' : 'Recebemos o seu sim!'}</h2><p class="apoio">${tem ? `Aqui você acompanha cada etapa, do contrato até o sistema ligado. O ${esc(vend)} também te avisa no WhatsApp.` : `O ${esc(vend)} vai te ligar para combinar a visita técnica gratuita.`}</p></div>${linha}${tem ? '' : passos()}`;
      return;
    }
    const msgFam = `Olha a proposta de energia solar que recebi. A conta de luz cai de ${brl(op.eco.contaAtual)} para ${brl(op.eco.contaDepois)} por mês. Me ajuda a decidir? ${link}`;
    $('#decidir').innerHTML = `
      <p class="apoio">Você escolheu: <b style="color:var(--tinta)">${esc(op.nivel)} · ${brl(op.preco.precoFinal)}</b>.<br>Não paga nada agora. O próximo passo é uma visita técnica gratuita.</p>
      <p style="font-weight:700;margin:0 0 8px">Qual o melhor horário para a visita?</p>
      <div class="opcoes-g" id="horarios">${['Manhã', 'Tarde', 'Sábado', 'Me liguem'].map((h) => `<button type="button" data-hr="${h}" aria-pressed="${est.hr === h}">${h}</button>`).join('')}</div>
      <button type="button" class="btn-g laranja" id="aceitar">Quero agendar a visita gratuita</button>
      <a class="btn-g verde" href="${zapVend()}" target="_blank" rel="noopener" id="zap">${Icone('conversa')} Conversar com o ${esc(vend)}</a>
      <a class="btn-g contorno" id="compartilhar" href="https://wa.me/?text=${encodeURIComponent(msgFam)}" target="_blank" rel="noopener">${Icone('pessoas')} Mandar para um familiar</a>
      ${window.Documentos ? `<button class="btn-g contorno" id="baixarPdf" type="button">${Icone('documento')} Baixar em PDF</button>` : ''}
      <p class="mini-p">Preço do material garantido até ${validade.toLocaleDateString('pt-BR')}.</p>
      ${passos()}`;
  }
  const passos = () => `<ol class="passos">
      <li><div><b>Visita técnica gratuita</b><span>Olhamos o telhado e a entrada de energia.</span></div></li>
      <li><div><b>Projeto e aprovação na CPFL</b><span>A gente cuida de toda a papelada.</span></div></li>
      <li><div><b>Instalação</b><span>Normalmente em 1 ou 2 dias.</span></div></li>
      <li><div><b>Usina ligada</b><span>Todo mês você recebe um resumo da sua economia.</span></div></li></ol>`;

  /* ---------- Interações ---------- */
  raiz.addEventListener('input', (ev) => {
    if (ev.target.id === 'adRange') { const v = +ev.target.value, d = document.getElementById('adDep'), l = document.getElementById('adLinha'); if (d) d.style.clipPath = `inset(0 0 0 ${v}%)`; if (l) l.style.left = v + '%'; }
  });
  raiz.addEventListener('click', (ev) => {
    if (ev.target.closest('#vidPlay')) {
      const bt = ev.target.closest('#vidPlay'); bt.disabled = true; bt.textContent = 'Carregando o vídeo…';
      B.videoProposta(o.token).then((r) => {
        if (!r || !r.url) throw new Error('sem vídeo');
        const box = document.getElementById('vidProp'); box.innerHTML = `<video src="${r.url}" controls autoplay playsinline preload="metadata"></video>`;
        registrar('viu', { secao: 'video' });
      }).catch(() => { bt.disabled = false; bt.textContent = 'Não consegui carregar agora: tentar de novo'; });
      return;
    }
    if (ev.target.closest('#v3dGirar')) {
      const bt = ev.target.closest('#v3dGirar'); bt.disabled = true; bt.textContent = 'Carregando o 3D…';
      window.Usina3D.carregarThree().then(() => {
        const U = window.Usina3D, proj = U.migrar(JSON.parse(JSON.stringify(o.projeto3d))), r3 = proj.resultado || {};
        const box = document.getElementById('v3d'); box.innerHTML = ''; box.classList.add('vivo');
        const hh = (h) => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60) % 60).padStart(2, '0')}`;
        const v = U.criar(box, proj, { aoSol: (i) => { const t = document.getElementById('v3dTxt'); if (t) t.textContent = !i.dia ? 'noite' : i.sombreadas ? `${hh(i.hora)}: ${i.sombreadas} placa(s) com sombra agora (já descontado na geração)` : `${hh(i.hora)}: todas as placas no sol`; } });
        // as placas nas mesmas posições do projeto do vendedor
        const chaves = new Set(r3.escolhidas || []), vagas = U.vagas(proj);
        let lista = vagas.filter((s) => chaves.has(s.k)); if (!lista.length) lista = U.escolher(vagas, (proj.layout && proj.layout.qtd) || r3.placas || 0, proj.layout || {});
        v.cor('agora'); v.atualizar(lista);
        const ctl = document.getElementById('v3dCtl'); ctl.hidden = false; bt.remove();
        // vídeo para o cliente guardar e mandar para a família (gira a casa com o sol do dia)
        if (window.MediaRecorder && v.gravar) {
          const bv = document.createElement('button'); bv.type = 'button'; bv.className = 'v3d-video'; bv.textContent = '🎬 Gerar vídeo para compartilhar'; ctl.appendChild(bv);
          bv.addEventListener('click', async () => {
            if (bv.disabled) return; bv.disabled = true;
            try {
              const pl = lista.length || r3.placas || 0, kwp = r3.kwp || 0, mes = r3.geracaoAnual ? r3.geracaoAnual / 12 : 0;
              const { blob, ext } = await v.gravar({ textos: { logo: 'marca/logo-branco.webp', titulo: `Usina solar de ${kwp.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kWp`, sub: `${pl} placas${mes ? ' · ' + Math.round(mes).toLocaleString('pt-BR') + ' kWh por mês' : ''}`, rodape: 'Projeto feito sob medida para o seu telhado', fim: 'Assim vai ficar a sua usina', fim2: 'Chama Solar · energia solar' }, aoProgresso: (f) => { bv.textContent = `🎬 Gravando… ${Math.round(f * 100)}%`; } });
              const arq = new File([blob], 'minha-usina-solar.' + ext, { type: blob.type });
              let ok = false; if (navigator.canShare && navigator.canShare({ files: [arq] })) { try { await navigator.share({ files: [arq], title: 'Minha usina solar' }); ok = true; } catch { /* cancelou */ } }
              if (!ok) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = arq.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); }
              bv.textContent = '🎬 Vídeo pronto · gerar de novo';
            } catch (err) { bv.textContent = '🎬 Não deu para gravar neste aparelho'; }
            finally { bv.disabled = false; }
          });
        }
        let di = 6, hora = 9.5, anima = null;
        const hr = document.getElementById('v3dHora'), ho = document.getElementById('v3dHoraO'), play = document.getElementById('v3dPlay');
        const mover = () => { hr.value = hora; ho.textContent = hh(hora); v.sol(di, hora); };
        const parar = () => { cancelAnimationFrame(anima); anima = null; play.textContent = '▶'; };
        hr.addEventListener('input', () => { parar(); hora = +hr.value; mover(); });
        ctl.addEventListener('click', (e) => {
          const d = e.target.closest('[data-v3d-dia]'); if (d) { di = +d.dataset.v3dDia; ctl.querySelectorAll('[data-v3d-dia]').forEach((b) => b.setAttribute('aria-pressed', String(b === d))); mover(); return; }
          if (e.target.closest('#v3dPlay')) { if (anima) return parar(); play.textContent = '❚❚'; if (hora >= 17.9) hora = 6; let ult = performance.now(); const passo = (t) => { hora += (t - ult) / 1000 * 1.5; ult = t; if (hora > 18) { hora = 18; mover(); return parar(); } mover(); anima = requestAnimationFrame(passo); }; anima = requestAnimationFrame(passo); }
        });
        mover(); registrar('abriu3d', {});
      }).catch(() => { bt.disabled = false; bt.textContent = 'Não carregou: tocar para tentar de novo'; });
      return;
    }
    if (ev.target.closest('#msOk')) {
      const v = Math.round(+String(($('#msVal') || {}).value || '').replace(/\D/g, '')), t0 = (($('#msTit') || {}).value || '').trim().slice(0, 40);
      if (v > 0) { est.sonho = { titulo: t0 || 'O nosso sonho', valor: v }; registrar('sonho', est.sonho); desenhar(); }
      return;
    }
    const t = ev.target.closest('[data-prazo],[data-op],[data-hr],#aceitar,#compartilhar,#baixarPdf,#zap,#zap-fixo,#letra,#ouvir');
    if (!t) return;
    if (t.dataset.prazo !== undefined) { est.prazo = +t.dataset.prazo; registrar('simulou', { prazo: est.prazo }); desenhar(); }
    else if (t.dataset.op !== undefined) { est.opcao = +t.dataset.op; registrar('escolheu', { opcao: est.opcao }); desenhar(); $('#t-sis').scrollIntoView({ behavior: 'smooth' }); }
    else if (t.dataset.hr) { est.hr = t.dataset.hr; document.querySelectorAll('[data-hr]').forEach((b) => b.setAttribute('aria-pressed', b === t)); }
    else if (t.id === 'zap' || t.id === 'zap-fixo') registrar('whatsapp', {});
    else if (t.id === 'compartilhar') registrar('compartilhou', { para: 'familiar' });
    else if (t.id === 'baixarPdf') { registrar('viu', { secao: 'pdf' }); Documentos.proposta({ ...o, opcaoEscolhida: est.opcao }, p, location.href.replace(/&v=1/, '')); }
    else if (t.id === 'letra') { const on = document.documentElement.classList.toggle('maior'); t.setAttribute('aria-pressed', on); try { localStorage.setItem('sol2_letra', on ? '1' : ''); } catch { /* */ } }
    else if (t.id === 'ouvir') falar(t);
    else if (t.id === 'aceitar') {
      const dados = { opcao: est.opcao, nivel: a.op.nivel, preco: a.op.preco.precoFinal, prazo: est.prazo, horario: est.hr || 'a combinar' };
      if (!vendedor) { B.evento(o.token, 'aceite', dados); Object.assign(o, B.porToken(o.token)); }
      est.aceito = true; decidir(); $('#s-decidir').scrollIntoView({ behavior: 'smooth' });
    }
  });
  $('#sistema').addEventListener('toggle', (ev) => { if (ev.target.open && ev.target.classList.contains('item')) registrar('viu', { secao: 'item:' + ev.target.querySelector('b').textContent.slice(0, 30) }); }, true);
  $('#duvidas').addEventListener('toggle', (ev) => { if (ev.target.open) registrar('duvida', { tema: ev.target.dataset.duvida }); }, true);

  /* ---------- Ouvir a proposta (voz do próprio aparelho) ---------- */
  function falar(botao) {
    const voz = window.speechSynthesis;
    if (!voz) { botao.innerHTML = `${Icone('som')} <span>Indisponível</span>`; return; }
    if (voz.speaking) { voz.cancel(); botao.innerHTML = `${Icone('som')} <span>Ouvir</span>`; botao.setAttribute('aria-pressed', 'false'); return; }
    const op = a.op, b = C.boleto(op, p, est.prazo);
    const texto = `Olá ${nomeCurto}. Aqui é a Chama Solar. Hoje você paga, em média, ${n(op.eco.contaAtual)} reais de luz por mês. ` +
      `No último ano foram ${n(a.raioX.pago12)} reais. Com energia solar, a sua conta cai para cerca de ${n(op.eco.contaDepois)} reais por mês. ` +
      (b.parcela ? `Parcelando em ${b.prazo} vezes, a parcela fica em ${n(b.parcela)} reais. Somando a conta mínima, dá ${n(b.totalMes)} reais por mês. ` : '') +
      `Depois de pago, sobram cerca de ${n(op.eco.contaAtual - op.eco.contaDepois)} reais todo mês no seu bolso. ` +
      `O próximo passo é uma visita técnica gratuita. Se tiver qualquer dúvida, fale com o ${vend} pelo WhatsApp.`;
    const u = new SpeechSynthesisUtterance(texto); u.lang = 'pt-BR'; u.rate = 0.92;
    const pt = voz.getVoices().find((x) => /pt(-|_)BR/i.test(x.lang)); if (pt) u.voice = pt;
    u.onend = () => { botao.innerHTML = `${Icone('som')} <span>Ouvir</span>`; botao.setAttribute('aria-pressed', 'false'); };
    voz.speak(u); botao.innerHTML = '<span>■ Parar</span>'; botao.setAttribute('aria-pressed', 'true');
    registrar('viu', { secao: 'ouviu' });
  }

  try { if (localStorage.getItem('sol2_letra')) { document.documentElement.classList.add('maior'); $('#letra').setAttribute('aria-pressed', 'true'); } } catch { /* */ }

  /* ---------- Rastreamento de leitura ---------- */
  registrar('abriu', {});
  const vistas = new Set();
  const obs = new IntersectionObserver((ents) => ents.forEach((e) => {
    const s = e.target.dataset.secao;
    if (e.isIntersecting && !vistas.has(s)) { vistas.add(s); registrar('viu', { secao: s }); }
  }), { threshold: 0.45 });
  document.querySelectorAll('[data-secao]').forEach((s) => obs.observe(s));
  new IntersectionObserver(([e]) => $('#cta').classList.toggle('some', e.isIntersecting), { threshold: 0.15 }).observe($('#s-decidir'));

  desenhar();
})();
