/* =====================================================================
   ABORDAGENS — para cada dia da cadência, 3 jeitos de falar com o cliente.
   Cada um usa uma técnica (rapport, SPIN, prova social, reciprocidade,
   compromisso pequeno, escassez verdadeira, take-away...). Tom humano:
   frase curta, uma pergunta só por mensagem, nada de texto de robô.
   ===================================================================== */
(function (raiz) {
  'use strict';
  const D = () => raiz.DadosTeste;
  const brl = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  const primeiro = (nome) => { const w = String(nome || '').trim().split(/\s+/); return /^(dona|seu|sr\.?|sra\.?|dr\.?|dra\.?)$/i.test(w[0] || '') && w[1] ? w[0] + ' ' + w[1] : w[0] || ''; };
  const periodo = () => { const h = new Date().getHours(); return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; };

  /* Técnica → explicação curta para o vendedor (aparece no card) */
  const TEC = {
    rapport: 'Rapport: conexão antes de negócio. Chame pelo nome, seja leve.',
    'spin-s': 'SPIN · Situação: entender o cenário sem pressionar.',
    'spin-p': 'SPIN · Problema: fazer o cliente falar da dor dele.',
    'spin-i': 'SPIN · Implicação: mostrar o que custa não resolver.',
    'spin-n': 'SPIN · Necessidade: ele mesmo diz o ganho da solução.',
    prova: 'Prova social: gente parecida, perto dele, já fez e deu certo.',
    reciproc: 'Reciprocidade: entregar algo útil antes de pedir.',
    micro: 'Compromisso pequeno: pedir um "sim" fácil abre o caminho do grande.',
    escassez: 'Escassez verdadeira: só use se o prazo for real (preço do kit muda).',
    ancora: 'Âncora: comparar com o que ele já paga, não com zero.',
    takeaway: 'Take-away: tirar a oferta da mesa. Quem estava em dúvida responde.',
    decisor: 'Segundo decisor: quem não vê a proposta costuma dizer não.',
    objecao: 'Objeção na mesa: pergunta direta e sem julgamento.',
    audio: 'Voz humana: áudio de até 40 s gera mais confiança que texto.',
    indicacao: 'Momento de pico: cliente feliz indica quando é pedido na hora certa.',
  };

  function variantes(id, o, ctx) {
    const nm = primeiro(o.nome), v = D().empresa.vendedor, link = ctx.link || '', a = ctx.a || {};
    const op = a.op || {}, eco = op.eco || {}, b = a.boleto || {}, esp = a.espera || {}, viz = a.vizinhos || {}, rx = a.raioX || {};
    const cidade = o.cidade || 'Ribeirão';
    const aval = ((raiz.Banco && raiz.Banco.parametros && raiz.Banco.parametros().empresaDoc) || {}).linkAvaliacao || '[cole aqui o link de avaliação do Google]';
    const conta = brl(eco.contaAtual), econ = brl(eco.economiaMes1), parcela = b.parcela ? `${b.prazo}x de ${brl(b.parcela)}` : '';
    const validade = (raiz.Banco && raiz.Banco.parametros && raiz.Banco.parametros().validadeDias) || 7;
    const vizTxt = viz.total && viz.economiaMedia && (viz.reais || !(raiz.Banco && raiz.Banco.nuvem)) ? `nossos clientes aqui da região estão pagando em média ${brl(viz.economiaMedia)} a menos de luz por mês` : `nossos clientes aqui de ${cidade} já estão pagando só a taxa mínima`;
    const V = {
      N0: [
        ['rapport', 'Acolher e pedir a conta', `${periodo()}, ${nm}! Aqui é o ${v}, da Chama Solar ☀️ Obrigado por chamar. Me conta: hoje sua conta de luz vem mais ou menos quanto por mês?`],
        ['spin-s', 'Entender a casa primeiro', `Oi ${nm}, tudo bem? ${v} da Chama Solar. Antes de te passar valor quero entender sua casa: é casa ou empresa, e o telhado é de cerâmica, metálico ou laje?`],
        ['reciproc', 'Já entregar algo útil', `Oi ${nm}! ${v} aqui, da Chama Solar. Se me mandar uma foto da conta de luz, te devolvo hoje um raio-x de quanto você vai gastar de energia nos próximos anos, mesmo que não feche com a gente. Combinado?`],
      ],
      N1: [
        ['micro', 'Dois horários para escolher', `${nm}, consigo passar aí 20 minutinhos para ver o telhado e te explicar tudo. Fica melhor amanhã cedo ou no fim da tarde?`],
        ['spin-p', 'Puxar a dor', `${nm}, me diz uma coisa: o que mais te incomoda hoje na conta de luz, o valor ou essas subidas sem aviso?`],
        ['audio', 'Mandar um áudio', `[ÁUDIO, 30 s] "Oi ${nm}, ${v} aqui. Vi sua conta e já dá para ver que tem uma economia boa aí. Queria passar rapidinho para ver o telhado, é coisa de 20 minutos. Me fala um horário bom para você?"`],
      ],
      N2: [
        ['micro', 'Pedido simples', `${nm}, tudo bem? Para eu fechar seu orçamento só falta a conta de luz. Uma foto pelo celular já resolve 🙂`],
        ['reciproc', 'Oferecer o raio-x', `${nm}, separei um tempinho hoje para montar seu raio-x de energia. Me manda a foto da conta que te entrego ainda hoje?`],
        ['spin-i', 'Custo de esperar', `${nm}, cada mês sem solar é uma conta inteira paga para a CPFL. Me manda a conta que eu te mostro exatamente quanto dá isso em 1 ano.`],
      ],
      P0: [
        ['reciproc', 'Proposta com raio-x', `${nm}, sua proposta ficou pronta! Fiz um raio-x da sua conta e montei o sistema certo para a sua casa:\n${link}\n\nDá para simular as parcelas e mandar para a família. Qualquer dúvida me chama.`],
        ['ancora', 'Começar pela conta atual', `${nm}, hoje você paga cerca de ${conta} de luz. Na proposta mostro como isso vira ${econ} de economia por mês:\n${link}\n\nOlha com calma e me diz o que achou.`],
        ['audio', 'Link + áudio', `[ÁUDIO, 40 s] "Oi ${nm}, ${v} aqui. Te mandei a proposta: olha a primeira parte, que é o raio-x da sua conta. Lá embaixo dá para simular as parcelas. Qualquer coisa me chama."\n\n${link}`],
      ],
      P1: [
        ['rapport', 'Leve, sem cobrar', `Oi ${nm}! Conseguiu dar uma olhada na proposta? Sem pressa, só queria saber se abriu certinho aí no celular 🙂`],
        ['spin-n', 'Pergunta de necessidade', `${nm}, olhando a proposta, o que mais te chamou atenção: a economia por mês ou a parcela no lugar da conta?`],
        ['micro', 'Oferecer 5 minutos', `${nm}, se quiser te explico em 5 minutos por ligação, é mais rápido que texto. Posso te ligar hoje às 18h?`],
      ],
      P2: [
        ['prova', 'Vizinhos que já fizeram', `${nm}, só para você ter uma ideia: ${vizTxt}. Se quiser, te mostro uma usina perto de você.`],
        ['prova', 'História de cliente', `${nm}, os clientes que instalaram com a gente aqui em ${cidade} tinham as mesmas dúvidas que todo mundo tem no começo. Hoje a conta deles vem só com a taxa mínima. Quer que eu te mostre uma conta antes e depois?`],
        ['spin-p', 'Descobrir a trava', `${nm}, posso te perguntar? Das pessoas que conversam comigo, a maioria trava em uma de três coisas: valor, confiança na empresa ou medo de dar problema no telhado. Alguma dessas pesa para você?`],
      ],
      P3: [
        ['ancora', 'Troca do boleto', `${nm}, fiz a conta: hoje você paga uns ${conta} de luz.${parcela ? ` Com o solar financiado em ${parcela}, a parcela entra no lugar da conta` : ' Com o solar, essa conta cai para a taxa mínima'} e, depois de quitado, sobram ${econ} por mês no seu bolso. Quer que eu simule com entrada?`],
        ['spin-i', 'Custo da espera', `${nm}, uma conta rápida: esperando 6 meses para decidir, vão uns ${brl(esp.seisMeses)} para a CPFL que poderiam ficar com você. Faz sentido a gente ver isso agora?`],
        ['micro', 'Simulação sem compromisso', `${nm}, quer que eu monte duas simulações, uma com entrada e outra sem, para você comparar com calma? Sem compromisso nenhum.`],
      ],
      P4: [
        ['escassez', 'Validade real do preço', `${nm}, o valor dos equipamentos que reservei para você vale até o fim desta semana (${validade} dias da cotação); depois o distribuidor atualiza a tabela. Quer que eu tente segurar?`],
        ['decisor', 'Envolver a família', `${nm}, quer que eu explique a proposta para mais alguém da casa? Faço uma chamada de 10 minutos com vocês dois, assim ninguém fica com dúvida.`],
        ['spin-n', 'Ele diz o ganho', `${nm}, se a conta de luz caísse para a taxa mínima a partir do mês que vem, o que você faria com esses ${econ} a mais por mês?`],
      ],
      P5: [
        ['objecao', 'Pergunta direta', `${nm}, posso ser direto com você? O que falta para você decidir: valor, forma de pagamento ou alguma dúvida técnica?`],
        ['objecao', 'Escala de 0 a 10', `${nm}, de 0 a 10, quanto você está perto de fazer o solar? E o que faltaria para chegar no 10?`],
        ['micro', 'Próximo passo pequeno', `${nm}, que tal a gente fazer só a visita técnica para confirmar o telhado? Não tem custo, e você decide depois com tudo na mão.`],
      ],
      P6: [
        ['takeaway', 'Encerrar com elegância', `${nm}, não quero ficar te incomodando. Vou encerrar sua proposta por aqui. Se mudar de ideia ou quiser rever o valor, é só me chamar que eu retomo na hora. Obrigado pela atenção!`],
        ['takeaway', 'Pergunta de saída', `${nm}, vou arquivar sua proposta. Antes, me ajuda com uma coisa? O que fez você não seguir agora: preço, momento ou outra empresa? Isso me ajuda a melhorar 🙏`],
        ['objecao', 'Última porta aberta', `${nm}, se o problema for a parcela, consigo ver uma condição diferente. Se for outra coisa, me fala sem cerimônia. Quer que eu tente?`],
      ],
      P7: [
        ['reciproc', 'Atualizar com a conta nova', `Oi ${nm}! Chegou a conta de luz deste mês? Se quiser, atualizo sua proposta com o valor novo, sem compromisso.`],
        ['spin-i', 'Conta que subiu', `${nm}, tudo bem? Vi que as tarifas subiram de novo. Sua conta veio maior esse mês?`],
        ['prova', 'Novidade real', `${nm}, instalamos mais umas usinas aqui em ${cidade} nesse mês e os clientes estão bem felizes com a primeira conta. Ainda faz sentido para você?`],
      ],
      P8: [
        ['reciproc', 'Refazer a simulação', `${nm}, a CPFL reajustou de novo e os equipamentos baixaram de preço. Quer que eu refaça sua simulação? Sem compromisso.`],
        ['spin-s', 'Ver se mudou algo', `Oi ${nm}! Mudou alguma coisa aí na casa, como ar-condicionado, piscina ou mais gente morando? Se mudou, a proposta muda também.`],
        ['rapport', 'Contato humano', `${periodo()}, ${nm}! ${v} aqui, da Chama Solar. Passando só para saber como você está. Se o assunto de energia voltar, estou por aqui 🙂`],
      ],
      G1: [
        ['rapport', 'Boas-vindas', `${nm}, bem-vindo(a) à Chama Solar! 🎉 Próximos passos: projeto e pedido na CPFL (até 15 dias), instalação, vistoria e troca do medidor. Te aviso a cada etapa por aqui.`],
        ['audio', 'Áudio de agradecimento', `[ÁUDIO, 30 s] "${nm}, obrigado pela confiança! Agora é com a gente: te mando cada etapa por aqui, e qualquer dúvida pode me chamar direto."`],
        ['reciproc', 'O que esperar', `${nm}, para você ficar tranquilo(a): no dia da instalação a equipe chega cedo e termina no mesmo dia na maioria das casas. Precisa só deixar o acesso ao telhado e ao quadro de luz livres.`],
      ],
      G5: [
        ['reciproc', 'Pedido de avaliação', `${nm}, posso te pedir um favor rápido? Uma avaliação da Chama Solar no Google ajuda muito outras famílias a confiarem na gente. Leva 1 minutinho: ${aval} Obrigado! 🙏`],
        ['rapport', 'Agradecer e pedir', `${nm}, obrigado pela confiança na Chama Solar! Se você ficou satisfeito(a) com o atendimento até aqui, conta isso no Google? ${aval}`],
        ['micro', 'Pedido em duas etapas', `${nm}, de 0 a 10, quanto você recomendaria a Chama Solar para um amigo?`],
      ],
      G2: [
        ['indicacao', 'Primeira conta + indicação', `${nm}, chegou a primeira conta com o solar? Me manda uma foto que eu confiro se está tudo certo. E se tiver alguém da família ou vizinho pagando caro de luz, me indica: tem um presente de agradecimento para você 🎁`],
        ['reciproc', 'Relatório de economia', `${nm}, quando chegar a conta me manda a foto: te devolvo um relatório mostrando quanto você economizou nesse mês.`],
        ['indicacao', 'Pedir 1 nome', `${nm}, que bom que está tudo funcionando! Você lembra de 1 pessoa que reclama da conta de luz? Só o nome e o telefone, que eu cuido do resto com todo o carinho.`],
      ],
      G3: [
        ['indicacao', 'Depoimento', `${nm}, seu sistema completou 6 meses! Se puder, me manda um áudio curtinho contando como está a conta. Ajuda muito outras famílias a decidirem.`],
        ['reciproc', 'Relatório de 6 meses', `${nm}, fiz o relatório dos seus 6 meses de usina. Quer que eu te mande? Ficou bem bacana ver a economia somada.`],
        ['rapport', 'Cuidado pós-venda', `${nm}, passando para saber se está tudo certo com a usina e com a conta. Qualquer coisa estranha, me chama.`],
      ],
      G4: [
        ['reciproc', 'Limpeza anual', `${nm}, já faz um ano da sua usina! A limpeza anual ajuda a manter a geração lá em cima. Quer agendar? Aproveito e faço a revisão completa.`],
        ['indicacao', 'Aniversário da usina', `${nm}, 1 ano de usina! 🎉 Nesse tempo ela já te devolveu uma boa parte do investimento. Conhece alguém que queira economizar também?`],
        ['rapport', 'Agradecer', `${nm}, obrigado por esse primeiro ano com a Chama Solar! Se precisar de qualquer coisa, estou por aqui.`],
      ],
      L1: [
        ['reciproc', 'Nova simulação', `Oi ${nm}, tudo bem? Os equipamentos baixaram e a CPFL reajustou a tarifa. Vale a pena refazer a sua simulação? Sem compromisso.`],
        ['spin-p', 'Como ficou', `${nm}, faz um tempo que conversamos. Você chegou a fazer o solar com outra empresa ou ainda está pagando a conta cheia?`],
        ['rapport', 'Sem pressão', `${periodo()}, ${nm}! Lembrei de você aqui. Se o assunto de energia voltar a fazer sentido, me chama que eu te atendo com prioridade.`],
      ],
    };
    return (V[id] || []).map(([tec, titulo, texto]) => ({ tec, tecnica: TEC[tec] || '', titulo, texto }));
  }

  /* Ajustes pelo comportamento do cliente na Proposta Viva */
  function gatilho(eventos) {
    const c = (t) => (eventos || []).filter((e) => e.tipo === t).length;
    if (c('compartilhou')) return { texto: 'Compartilhou o link: tem outro decisor. Proponha uma chamada com os dois.', tec: 'decisor' };
    if (c('simulou') >= 2) return { texto: 'Simulou parcelas várias vezes: a dúvida é financeira. Use a troca de boleto.', tec: 'ancora' };
    if (c('abriu') >= 3) return { texto: 'Abriu 3+ vezes sem responder: pergunte direto o que falta.', tec: 'objecao' };
    if (c('abriu')) return { texto: 'Abriu a proposta: ligue nos próximos 30 minutos.', tec: 'audio' };
    return null;
  }

  raiz.Abordagens = { variantes, gatilho, TEC };
})(window);
