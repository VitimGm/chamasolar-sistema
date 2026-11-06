/* =====================================================================
   Chama Solar — AGENTES DE CONVERSÃO (versão de teste, sem IA)
   Cada agente tem uma missão e devolve material pronto para usar.
   No oficial, executar() chama a Edge Function fontes/solar-agentes,
   que usa o prompt do mesmo nome com a IA. A saída tem o mesmo formato.
   ===================================================================== */
(function (raiz) {
  'use strict';
  const C = raiz.Conversao, D = raiz.DadosTeste;
  const brl = (v) => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  const n = (v, c = 0) => C.fmt(v, c);
  const primeiro = (nome) => String(nome || '').split(' ')[0].replace(/^(Dona|Seu|Sr\.|Sra\.)$/i, '') || nome;
  const tratar = (nome) => /padaria|auto|peças|ltda|me$|comércio|mercado|loja/i.test(nome) ? 'pessoal' : primeiro(nome);

  /* ---- 1. Diagnóstico da dor ---- */
  function diagnostico({ o, a }) {
    const pf = a.perfil, rx = a.raioX, op = a.op;
    const argumentos = [
      { t: 'Abra pela conta, não pelo kit', d: `Comece mostrando os ${brl(rx.pago12)} pagos em 12 meses. Só depois fale de equipamento.` },
      { t: 'Troque "preço" por "troca de boleto"', d: `Em ${a.boleto.prazo}x, parcela ${brl(a.boleto.parcela)} + conta mínima ${brl(a.boleto.contaDepois)} = ${brl(a.boleto.totalMes)} contra ${brl(a.boleto.contaAtual)} hoje.` },
      { t: 'Custo real da energia', d: `A energia do sistema sai a R$ ${n(a.energia.rsKwh, 2)}/kWh em 25 anos, contra R$ ${n(rx.tarifa, 2)}/kWh da CPFL hoje (e subindo).` },
      { t: 'Custo da espera', d: `Cada mês sem o sistema custa ${brl(a.espera.porMes)}. Seis meses pensando = ${brl(a.espera.seisMeses)}.` },
    ];
    if (a.vizinhos.total && a.vizinhos.economiaMedia) argumentos.push({ t: 'Prova vizinha', d: `${a.vizinhos.reais ? 'Clientes reais' : 'Exemplos (teste)'} em ${a.vizinhos.mesmaCidade ? o.cidade : 'Ribeirão Preto'} economizam em média ${brl(a.vizinhos.economiaMedia)}/mês.` });
    return {
      titulo: `Dor principal: ${pf.principal.titulo}`,
      resumo: pf.principal.texto,
      blocos: [
        { tipo: 'lista', titulo: 'Argumentos na ordem certa', itens: argumentos },
        { tipo: 'lista', titulo: 'Perguntas de descoberta (deixe o cliente falar)', itens: [
          { t: 'O que mais incomoda na conta hoje?', d: 'Deixe ele dizer a dor com as palavras dele. Repita depois na proposta.' },
          { t: pf.negocio ? 'Quanto a energia pesa no custo do mês?' : 'Tem planos de ar-condicionado, piscina ou carro elétrico?', d: pf.negocio ? 'Leva a conversa para margem e lucro.' : 'Consumo futuro muda o dimensionamento — e mostra cuidado.' },
          { t: 'Quem mais participa dessa decisão?', d: 'Descubra o segundo decisor agora, não no "vou pensar".' },
        ] },
        { tipo: 'alerta', texto: 'Evite abrir com potência, marca ou preço. Quem compara kit compra o mais barato; quem entende a própria dor compra a solução.' },
      ],
    };
  }

  /* ---- 2. Roteirista (WhatsApp, áudio e ligação) ---- */
  function roteirista({ o, a, link }) {
    const nm = tratar(o.nome), rx = a.raioX, b = a.boleto;
    const zap = `Oi ${nm}! Aqui é o Victor, da Chama Solar ☀️\n\nFiz um raio-x da sua conta de luz: nos últimos 12 meses foram ${brl(rx.pago12)} para a CPFL — e a tarifa subiu 9,25% este ano.\n\nMontei uma proposta só sua, com a simulação da troca da conta pela parcela. Leva 2 minutinhos:\n${link}\n\nQuando puder, me diz qual das duas opções fez mais sentido pra você?`;
    const audio = `"Oi ${nm}, Victor da Chama Solar. Olhei sua conta com calma: você pagou ${brl(rx.pago12)} pra CPFL no último ano. A proposta que te mandei mostra como trocar isso por uma parcela de ${brl(b.parcela)} que acaba, e a conta cai pra perto de ${brl(b.contaDepois)}. Dá uma olhada no link e me fala o que achou. Abraço!"`;
    return {
      titulo: 'Mensagens prontas para enviar',
      resumo: 'Texto curto, com a dor do cliente na primeira linha e uma pergunta no final (pergunta gera resposta).',
      blocos: [
        { tipo: 'copiar', titulo: 'WhatsApp — envio da Proposta Viva', texto: zap, zap: o.whatsapp },
        { tipo: 'copiar', titulo: 'Roteiro de áudio (30–40 s)', texto: audio },
        { tipo: 'lista', titulo: 'Roteiro de ligação / vídeo-chamada (5 min)', itens: [
          { t: '1. Conexão (30 s)', d: `"${nm}, conseguiu abrir a proposta? Posso te mostrar em 5 minutos o que achei da sua conta?"` },
          { t: '2. Dor (1 min)', d: `Mostre o Raio-X: ${brl(rx.pago12)} no ano, ${brl(rx.total25)} em 25 anos se nada mudar. Pergunte: "isso faz sentido pra você?"` },
          { t: '3. Solução (1 min)', d: `${n(a.op.dim.kwpReal, 2)} kWp gerando ~${n(a.op.dim.geracaoMes)} kWh/mês. Energia própria a R$ ${n(a.energia.rsKwh, 2)}/kWh.` },
          { t: '4. Troca de boleto (1 min)', d: `${b.prazo}x de ${brl(b.parcela)} + conta mínima. Depois de quitado, sobram ${brl(b.livreDepois)}/mês.` },
          { t: '5. Fechamento (1 min)', d: '"Qual das opções você prefere? Posso já agendar a visita técnica para esta semana?" — ofereça 2 horários.' },
        ] },
      ],
    };
  }

  /* ---- 3. Matador de objeções ---- */
  const OBJECOES = [
    { id: 'caro', chaves: ['caro', 'preço', 'valor', 'dinheiro', 'barato'], t: '"Está caro" / "Não tenho dinheiro agora"' },
    { id: 'pensar', chaves: ['pensar', 'depois', 'tempo', 'ver isso', 'mais pra frente'], t: '"Vou pensar"' },
    { id: 'conjuge', chaves: ['esposa', 'marido', 'mulher', 'sócio', 'família', 'conversar'], t: '"Preciso falar com minha esposa / sócio"' },
    { id: 'concorrente', chaves: ['outro', 'concorrente', 'orçamento', 'mais barato', 'cotação'], t: '"Tenho um orçamento mais barato"' },
    { id: 'tecnologia', chaves: ['tecnologia', 'melhorar', 'esperar', 'evoluir', 'grafeno'], t: '"Vou esperar a tecnologia melhorar"' },
    { id: 'taxacao', chaves: ['taxa', 'taxação', 'lei', 'fio b', 'governo'], t: '"Ouvi dizer que agora é taxado / não compensa mais"' },
    { id: 'mudar', chaves: ['mudar', 'alugado', 'aluguel', 'vender a casa'], t: '"E se eu mudar de casa?"' },
  ];
  function respostaObjecao(id, a, o) {
    const b = a.boleto, rx = a.raioX;
    switch (id) {
      // Conduz para o "sim": reconhece sem concordar com o problema, traz o número DELE (ancoragem na conta),
      // compara com o custo de não fazer, prova social local e fecha com pergunta de alternativa (as duas respostas são "sim").
      case 'caro': { const pn = (o.nome || '').split(' ')[0];
        return `${pn ? pn + ', ' : ''}deixa eu te mostrar uma coisa que muda a forma de olhar esse valor. Você não está decidindo se gasta ${brl(a.op.preco.precoFinal)} ou não: esse dinheiro você já está gastando, só que com a CPFL e sem nunca acabar. Hoje sua conta está em ${brl(b.contaAtual)} por mês. Com o sistema, fica ${b.prazo}x de ${brl(b.parcela)} mais a taxa mínima da CPFL, perto de ${brl(b.contaDepois)}, total de ${brl(b.totalMes)}. ${b.diferenca >= 0 ? `Já no primeiro mês sobra ${brl(b.diferenca)} no seu bolso` : `É uma diferença de ${brl(-b.diferenca)} por mês, só até terminar a parcela`}. A diferença é que a parcela tem data para acabar, e a conta da CPFL só sobe: foi 9,25% de reajuste só em 2026.\n\nDepois de pago, são mais de 20 anos gerando a sua própria energia, ${brl(a.op.eco.economia25)} de economia em 25 anos pela simulação. Os clientes que instalamos aqui em Ribeirão Preto falam a mesma coisa: "devia ter feito antes".\n\nPra ficar confortável no seu orçamento, o que é melhor para você: a gente alongar o prazo para a parcela ficar abaixo da conta de hoje, ou dar uma entrada menor e manter o prazo?`; }
      case 'pensar': return `Faz todo sentido pensar, é um investimento para mais de 20 anos e você está certo em não decidir no impulso. Só te peço uma coisa: pensa com os números na mão, porque o tempo aqui tem custo. Cada mês sem o sistema são ${brl(a.espera.porMes)} que vão para a CPFL e não voltam. Em seis meses são ${brl(a.espera.seisMeses)}, dinheiro que já pagaria uma boa parte das parcelas.\n\nNormalmente quando alguém me fala "vou pensar", é porque ficou uma dúvida específica: o valor, a confiança na instalação ou se a economia é real mesmo. Qual dessas três está mais pesando para você agora? Me fala que eu te mostro com dados, sem pressão nenhuma.`;
      case 'conjuge': return `Perfeito, decisão de casa tem que ser junto mesmo, e eu prefiro assim, porque quem participa da conversa fica mais seguro. O que costuma funcionar melhor é eu explicar direto para vocês dois, em 10 minutos, por chamada de vídeo ou pessoalmente: mostro a conta de vocês, quanto gera, quanto economiza e respondo na hora qualquer pergunta que ele(a) tiver. Assim ninguém precisa repassar informação pela metade.\n\nFica melhor para vocês hoje à noite, por volta das 19h, ou amanhã no horário do almoço?`;
      case 'concorrente': return 'Comparar é o certo, e eu te ajudo a comparar do jeito justo. Proposta de energia solar parece tudo igual no preço, mas a diferença está nos detalhes que só aparecem depois: marca e garantia das placas (tem placa com 12 anos e placa com 30), garantia e assistência do inversor no Brasil, quanto cada proposta promete gerar por mês e se isso está em contrato, estrutura adequada para o seu telhado, homologação na CPFL inclusa e quem vem até a sua casa se der qualquer problema.\n\nJá vi muita proposta mais barata sem estrutura, sem homologação ou com gerador menor, que no fim não zera a conta. Me manda a outra proposta que eu monto um comparativo lado a lado, item por item, e você decide com segurança. Consegue me enviar ela hoje?';
      case 'tecnologia': return `Entendo a lógica, mas no caso das placas o momento de esperar já passou: a tecnologia está madura há anos, e o preço por watt hoje é dos mais baixos da história. O que ainda está evoluindo são as baterias, e o seu sistema já sai preparado para receber bateria depois, sem refazer nada.\n\nEnquanto se espera a "próxima tecnologia", a conta continua chegando: são ${brl(a.espera.porMes)} por mês. Quem esperou dois anos pagou mais de ${brl(a.espera.porMes * 24)} para a CPFL nesse tempo.\n\nFaz sentido a gente começar agora com as placas, já gerando economia, e deixar a bateria como segunda etapa quando você quiser?`;
      case 'taxacao': return `Boa pergunta, e é bom você saber exatamente como funciona. Existe sim a cobrança do Fio B, da Lei 14.300: em 2026 se paga 60% dessa parte da tarifa sobre a energia que vai para a rede, e esse percentual sobe até 2029. O ponto é que isso já está dentro da sua simulação, não é surpresa depois.\n\nMesmo com o Fio B, sua conta cai de ${brl(b.contaAtual)} para perto de ${brl(b.contaDepois)} e o sistema se paga em ${n(a.op.eco.paybackAnos, 1)} anos. O que mais vale a pena é o que você consome na hora em que gera, porque isso não paga Fio B nenhum.\n\nE tem um detalhe: quem entra agora fica em condição melhor do que quem deixar para depois, quando a regra fica mais cara. Quer que eu te mostre esse cálculo na proposta, ano a ano?`;
      case 'mudar': return 'É uma preocupação válida, e tem duas saídas boas. Se você mudar, o sistema vai junto: a gente desmonta e reinstala na casa nova, e você continua economizando. E se for vender, casa com energia solar e conta de luz mínima vale mais e vende mais rápido, porque o comprador já sai economizando.\n\nOu seja, em nenhum dos cenários você perde o investimento. Você tem uma previsão de mudança ou é mais uma possibilidade para o futuro?';
      default: return '';
    }
  }
  function objecoes({ o, a, texto }) {
    const alvo = (texto || '').toLowerCase();
    const achada = alvo ? OBJECOES.find((x) => x.chaves.some((k) => alvo.includes(k))) : null;
    const lista = achada ? [achada] : OBJECOES;
    return {
      titulo: achada ? `Resposta para: ${achada.t}` : 'Respostas prontas para as objeções mais comuns',
      resumo: 'Regra: concorde, traga o número dele, faça uma pergunta. Nunca discuta.',
      blocos: lista.map((x) => ({ tipo: 'copiar', titulo: x.t, texto: respostaObjecao(x.id, a, o) })),
    };
  }

  /* ---- 4. Follow-up: cada dia da cadência com 3 abordagens prontas (técnica + texto) ---- */
  function followup({ o, a, eventos, link }) {
    const Cd = raiz.Cadencia, Ab = raiz.Abordagens;
    const inter = raiz.Banco && raiz.Banco.interacoes ? raiz.Banco.interacoes(o.id) : [];
    const prox = Cd.proximo(o, eventos, inter);
    const grupo = o.status === 'novo' ? 'novo' : o.status === 'ganho' ? 'ganho' : o.status === 'perdido' ? 'perdido' : 'proposta';
    const base = new Date((grupo === 'proposta' ? o.enviadoEm : o.criadoEm) || o.criadoEm || Date.now()).getTime();
    const feitos = new Set(inter.map((i) => (String(i.texto || '').match(/^Cadência (\w\d)/) || [])[1]).filter(Boolean));
    if (o.enviadoEm) feitos.add('P0');
    const passos = Cd.PASSOS[grupo].map((p) => ({ ...p, data: new Date(base + p.dia * 864e5).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }), feito: feitos.has(p.id), atual: prox && prox.id === p.id, variantes: Ab.variantes(p.id, o, { a, link }) }));
    const g = Ab.gatilho(eventos);
    return {
      titulo: 'Follow-up do dia a dia',
      resumo: prox ? `Hoje: ${prox.titulo} (${prox.canal === 'ligacao' ? 'ligação' : 'WhatsApp'}). Escolha a abordagem, ajuste se quiser e envie.` : 'Cadência concluída para esta etapa.',
      blocos: [
        ...(g ? [{ tipo: 'alerta', texto: g.texto }] : []),
        { tipo: 'abordagens', passos, atual: (prox && prox.id) || passos[0].id, destaque: g && g.tec },
        { tipo: 'lista', titulo: 'Regras de ouro', itens: [
          { t: 'Uma pergunta por mensagem', d: 'Duas perguntas juntas = nenhuma resposta.' },
          { t: 'Responda em até 5 minutos', d: 'Velocidade é o que mais fecha venda solar.' },
          { t: 'Mais escuta que fala', d: 'SPIN: deixe o cliente dizer a dor e o ganho com as palavras dele.' },
          { t: 'Escassez só se for verdade', d: 'O preço do kit muda mesmo: use, mas nunca invente prazo.' },
          { t: 'Abriu a proposta? Ligue', d: 'Quem abriu agora está pensando nisso agora.' },
        ] },
      ],
    };
  }


  /* ---- 5. Comparador de concorrente ---- */
  function comparador({ o, a, conc }) {
    const op = a.op;
    if (!conc || !conc.preco || !conc.kwp) {
      return { titulo: 'Comparar com orçamento do concorrente', resumo: 'Preencha preço e potência do outro orçamento (ou, no oficial, envie o PDF e a IA lê).', blocos: [] };
    }
    const nossoWp = op.preco.precoFinal / (op.dim.kwpReal * 1000), deleWp = conc.preco / (conc.kwp * 1000);
    const geraDele = conc.kwp * op.dim.hspEfetivo * 30 * 0.776;
    const linhas = [
      ['Preço', brl(op.preco.precoFinal), brl(conc.preco)],
      ['Potência', `${n(op.dim.kwpReal, 2)} kWp`, `${n(conc.kwp, 2)} kWp`],
      ['R$ por Wp', `R$ ${n(nossoWp, 2)}`, `R$ ${n(deleWp, 2)}`],
      ['Geração estimada', `${n(op.dim.geracaoMes)} kWh/mês`, `${n(geraDele)} kWh/mês*`],
      ['Garantia inversor', op.inversor.nome.includes('10 anos') ? '10 anos' : '5–7 anos', conc.garantiaInv ? `${conc.garantiaInv} anos` : 'perguntar'],
      ['Homologação CPFL', 'Inclusa', conc.homologacao ? 'Inclusa' : 'perguntar'],
    ];
    const pontos = [];
    if (conc.kwp < op.dim.kwpReal * 0.92) pontos.push(`O outro sistema é ${Math.round((1 - conc.kwp / op.dim.kwpReal) * 100)}% menor: gera menos e a conta não cai o mesmo tanto. Preço menor por entregar menos.`);
    if (deleWp < nossoWp) pontos.push(`Por Wp o outro está R$ ${n(nossoWp - deleWp, 2)} mais barato. Verifique marca dos módulos, inversor e se tem homologação, estrutura e ART inclusos.`);
    else pontos.push('Por Wp a nossa proposta já é igual ou mais barata. Use isso com segurança.');
    if (!conc.homologacao) pontos.push('Pergunte se a homologação na CPFL está inclusa — é onde muitos orçamentos "baratos" escondem custo e atraso.');
    return {
      titulo: 'Comparativo honesto', resumo: '* geração do concorrente estimada com a mesma irradiação do local.',
      blocos: [{ tipo: 'tabela', cab: ['', 'Chama Solar', 'Concorrente'], linhas }, { tipo: 'lista', titulo: 'O que falar', itens: pontos.map((p) => ({ t: p, d: '' })) }],
    };
  }

  /* ---- 6. Analista de funil (visão geral) ---- */
  function analista({ lista, eventosDe }) {
    const f = C.funil(lista, eventosDe);
    const perdidos = lista.filter((o) => o.status === 'perdido');
    const semAbrir = lista.filter((o) => o.status === 'proposta' && !eventosDe(o.token).some((e) => e.tipo === 'abriu'));
    return {
      titulo: 'Raio-X do seu funil', resumo: `Histórico Groner: 1.427 propostas, 81 aceitas (5,7%). Meta deste sistema: dobrar a conversão com menos propostas e mais conversa.`,
      blocos: [
        { tipo: 'lista', titulo: 'Diagnóstico', itens: [
          { t: 'O gargalo histórico não é preço', d: 'Suas propostas saíam ~R$ 2,10–2,40/Wp, abaixo da média nacional (R$ 2,45). Perder com preço abaixo da média indica falha de valor percebido e de follow-up, não de preço.' },
          { t: 'Muitas propostas, pouca conversa', d: '1.427 propostas para 81 vendas é proposta em excesso para lead pouco qualificado. Qualifique antes (conta, decisor, crédito) e converse mais com menos gente.' },
          { t: `${semAbrir.length} proposta(s) enviada(s) e não aberta(s)`, d: 'Proposta não aberta não é "não": é canal errado. Ligue.' },
          { t: `${f.quentes} lead(s) quente(s) agora`, d: 'Prioridade do dia. Comece por eles.' },
        ] },
        ...(perdidos.length ? [{ tipo: 'lista', titulo: 'Motivos de perda registrados', itens: perdidos.map((o) => ({ t: o.nome, d: o.motivoPerda || 'sem motivo — registre sempre' })) }] : []),
      ],
    };
  }

  raiz.Agentes = {
    lista: [
      { id: 'diagnostico', nome: 'Diagnóstico da Dor', icone: '🩺', missao: 'Descobre qual dor abre a conversa e em que ordem argumentar.', fn: diagnostico },
      { id: 'roteirista', nome: 'Roteirista', icone: '✍️', missao: 'Escreve WhatsApp, áudio e roteiro de ligação com os números do cliente.', fn: roteirista },
      { id: 'objecoes', nome: 'Matador de Objeções', icone: '🛡️', missao: 'Responde "tá caro", "vou pensar", "falar com a esposa" com dados dele.', fn: objecoes, entrada: 'texto' },
      { id: 'followup', nome: 'Follow-up', icone: '⏱️', missao: 'Para cada dia da cadência, 3 abordagens com técnica de venda. Escolha, ajuste e mande no WhatsApp.', fn: followup },
      { id: 'comparador', nome: 'Comparador', icone: '⚖️', missao: 'Compara com o orçamento do concorrente de forma honesta.', fn: comparador, entrada: 'concorrente' },
    ],
    analista,
    OBJECOES,
    resposta: respostaObjecao,
  };
})(window);
