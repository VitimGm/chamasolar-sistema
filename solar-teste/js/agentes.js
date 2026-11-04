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
    if (a.vizinhos.total) argumentos.push({ t: 'Prova vizinha', d: `${a.vizinhos.total} usinas da Chama Solar em ${a.vizinhos.mesmaCidade ? o.cidade : 'Ribeirão Preto'} economizam em média ${brl(a.vizinhos.economiaMedia)}/mês.` });
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
    const zap = `Oi ${nm}! Aqui é o Victor, da Chama Solar ☀️\n\nFiz um raio-x da sua conta de luz: nos últimos 12 meses foram ${brl(rx.pago12)} para a CPFL — e a tarifa subiu 9,25% este ano.\n\nMontei uma proposta só sua, com a simulação da troca da conta pela parcela. Leva 2 minutinhos:\n${link}\n\nQuando puder, me diz qual das 3 opções fez mais sentido pra você?`;
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
      case 'caro': return `Entendo. Vamos olhar por mês, que é como você paga hoje: são ${brl(b.contaAtual)} de conta. Com o sistema, ${b.prazo}x de ${brl(b.parcela)} mais a conta mínima de ${brl(b.contaDepois)} dá ${brl(b.totalMes)}. ${b.diferenca >= 0 ? `Já sobra ${brl(b.diferenca)} no primeiro mês` : `A diferença é de ${brl(-b.diferenca)} por mês até quitar`}, e depois a parcela some — a conta da CPFL nunca some.`;
      case 'pensar': return `Claro, é uma decisão importante. Só pra você pensar com o número na mão: cada mês com a conta atual são ${brl(a.espera.porMes)} que poderiam ficar com você — seis meses são ${brl(a.espera.seisMeses)}. O que exatamente você quer avaliar? Posso te ajudar a responder agora.`;
      case 'conjuge': return `Faz todo sentido decidir juntos. Que tal uma chamada rápida de 10 minutos com vocês dois? Mostro o Raio-X da conta e tiro as dúvidas na hora. Prefere hoje às 19h ou amanhã no almoço?`;
      case 'concorrente': return 'Ótimo que você está comparando. Me manda o outro orçamento que eu comparo item por item com você: marca e garantia dos módulos e do inversor, geração prometida, estrutura, se inclui homologação na CPFL e quem atende quando der problema. Às vezes o barato está sem algum desses itens.';
      case 'tecnologia': return 'A tecnologia dos módulos já está madura há anos; a evolução hoje está nas baterias, e o seu sistema pode receber bateria depois. Enquanto espera, a conta continua: ' + brl(a.espera.porMes) + ' por mês.';
      case 'taxacao': return `É verdade que existe a cobrança do Fio B (Lei 14.300): em 2026 você paga 60% dessa parte da tarifa sobre a energia injetada. Já está tudo dentro da simulação — mesmo com ela, sua conta cai de ${brl(b.contaAtual)} para cerca de ${brl(b.contaDepois)} e o retorno fica em ${n(a.op.eco.paybackAnos, 1)} anos.`;
      case 'mudar': return 'O sistema valoriza o imóvel e pode ir junto: dá para desmontar e reinstalar na casa nova. Se for vender, entra no valor do imóvel como "casa com conta de luz mínima".';
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

  /* ---- 4. Follow-up por gatilho ---- */
  function followup({ o, a, eventos, link }) {
    const nm = tratar(o.nome), b = a.boleto;
    const envio = new Date(o.enviadoEm || o.criadoEm);
    const dia = (d) => new Date(+envio + d * 864e5).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
    const validade = (raiz.Banco ? raiz.Banco.parametros().validadeDias : D.parametros.validadeDias) || 7;
    const viuBoleto = eventos.some((e) => ['boleto', 'pagamento'].includes(e.dados?.secao) || e.tipo === 'simulou');
    const cad = [
      { d: 0, canal: 'WhatsApp', t: 'Envio com a dor na 1ª linha', msg: 'Usar a mensagem do Roteirista.' },
      { d: 1, canal: 'Áudio', t: 'Áudio curto pessoal', msg: `"${nm}, conseguiu ver? Qualquer dúvida me chama."` },
      { d: 3, canal: 'Ligação', t: 'Ligar (não mandar texto)', msg: 'Perguntar qual opção fez mais sentido.' },
      { d: 5, canal: 'WhatsApp', t: viuBoleto ? 'Reforço da troca de boleto' : 'Prova vizinha', msg: viuBoleto ? `Lembrei de você: ${b.prazo}x de ${brl(b.parcela)} + conta mínima dá ${brl(b.totalMes)} — menos do que os ${brl(b.contaAtual)} de hoje.` : `${nm}, só pra você ver: clientes nossos aqui em ${o.cidade || 'Ribeirão'} estão pagando em média ${brl(a.vizinhos.economiaMedia)} a menos por mês.` },
      { d: validade - 1, canal: 'WhatsApp', t: 'Validade real da cotação (véspera)', msg: `${nm}, a cotação do kit que reservei vale até ${new Date(+envio + validade * 864e5).toLocaleDateString('pt-BR')}. Depois o distribuidor atualiza o preço. Quer que eu tente segurar?` },
      { d: 8, canal: 'WhatsApp', t: 'Envolver o 2º decisor', msg: `Quer que eu explique para mais alguém da família? Posso fazer uma chamada rapidinha com vocês: ${link}` },
      { d: 11, canal: 'Ligação', t: 'Resolver a objeção principal', msg: 'Usar o Matador de objeções.' },
      { d: 14, canal: 'WhatsApp', t: 'Cotação atualizada + prova vizinha', msg: `${nm}, atualizei a cotação do kit pra você. E um dado real: clientes nossos em ${o.cidade || 'Ribeirão'} estão pagando em média ${brl(a.vizinhos.economiaMedia)} a menos por mês. Quer que eu te mande a versão nova?` },
      { d: 21, canal: 'WhatsApp', t: 'Encerrar com elegância', msg: `${nm}, vou arquivar sua proposta por aqui. Se mudar de ideia, é só chamar — antes do reajuste da CPFL em abril vale a pena rever.` },
    ];
    const prox = C.proximaAcao(o, eventos);
    return {
      titulo: 'Cadência de 21 dias + gatilhos',
      resumo: `Agora: ${prox.icone} ${prox.texto}`,
      blocos: [
        { tipo: 'cadencia', itens: cad.map((c) => ({ ...c, data: dia(c.d) })) },
        { tipo: 'lista', titulo: 'Gatilhos que mudam a cadência', itens: [
          { t: 'Nunca abriu em 24 h', d: 'Pare de mandar texto. Ligue.' },
          { t: 'Abriu agora', d: 'Ligue nos próximos 30 minutos.' },
          { t: 'Simulou parcela 2+ vezes', d: 'Dúvida financeira: mande a troca de boleto e ofereça ligar.' },
          { t: 'Compartilhou o link', d: 'Tem outro decisor: proponha chamada com os dois.' },
          { t: 'Abriu 3+ vezes sem responder', d: 'Pergunte direto o que falta para decidir.' },
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
      { id: 'followup', nome: 'Follow-up', icone: '⏱️', missao: 'Cadência de 21 dias que muda conforme o cliente se comporta.', fn: followup },
      { id: 'comparador', nome: 'Comparador', icone: '⚖️', missao: 'Compara com o orçamento do concorrente de forma honesta.', fn: comparador, entrada: 'concorrente' },
    ],
    analista,
    OBJECOES,
    resposta: respostaObjecao,
  };
})(window);
