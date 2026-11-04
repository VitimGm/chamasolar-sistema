/* =====================================================================
   CADÊNCIA — do 1º ao último contato. Diz QUEM chamar HOJE, por quê e
   com qual mensagem pronta. Cada toque do vendedor fica registrado como
   interação ("Cadência P2 · ..."), e o passo seguinte só vence depois.
   ===================================================================== */
(function (raiz) {
  'use strict';
  const C = () => raiz.Conversao, D = raiz.DadosTeste;
  const DIA = 864e5;
  const brl = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  const primeiro = (nome) => { const w = String(nome || '').trim().split(/\s+/); return /^(dona|seu|sr\.?|sra\.?|dr\.?|dra\.?)$/i.test(w[0] || '') && w[1] ? w[0] + ' ' + w[1] : w[0] || ''; };

  /* passos: dia = dias desde a base (envio da proposta, criação do lead ou fechamento) */
  const PASSOS = {
    novo: [
      { id: 'N0', dia: 0, canal: 'whatsapp', titulo: 'Primeira resposta', porque: 'Quem responde em até 5 minutos leva a maioria das vendas.' },
      { id: 'N1', dia: 0.5, canal: 'ligacao', titulo: 'Marcar a visita', porque: 'Visita marcada vira proposta certa e cliente comprometido.' },
      { id: 'N2', dia: 2, canal: 'whatsapp', titulo: 'Pedir a conta de luz', porque: 'Sem a conta não sai o orçamento exato.' },
    ],
    proposta: [
      { id: 'P0', dia: 0, canal: 'whatsapp', titulo: 'Enviar a Proposta Viva', porque: 'Link + áudio curto: o cliente entende em 2 minutos.' },
      { id: 'P1', dia: 1, canal: 'ligacao', titulo: 'Conferir se recebeu', porque: 'No dia seguinte, a dúvida ainda está fresca.' },
      { id: 'P2', dia: 3, canal: 'whatsapp', titulo: 'Prova dos vizinhos', porque: 'Ver quem já tem na cidade tira o medo de errar.' },
      { id: 'P3', dia: 5, canal: 'whatsapp', titulo: 'Troca do boleto', porque: 'Mostrar que a parcela cabe no lugar da conta.' },
      { id: 'P4', dia: 7, canal: 'whatsapp', titulo: 'Validade do preço', porque: 'O preço do kit muda: urgência verdadeira.' },
      { id: 'P5', dia: 10, canal: 'ligacao', titulo: 'Pergunta de fechamento', porque: 'Perguntar direto o que falta para decidir.' },
      { id: 'P6', dia: 14, canal: 'whatsapp', titulo: 'Mensagem de encerramento', porque: 'A mensagem de "vou encerrar" é a que mais recebe resposta.' },
      { id: 'P7', dia: 30, canal: 'whatsapp', titulo: 'Reativar (30 dias)', porque: 'Nova conta de luz chegou: bom momento para voltar.' },
      { id: 'P8', dia: 90, canal: 'whatsapp', titulo: 'Reativar (90 dias)', porque: 'Reajuste e verão: o assunto volta sozinho.' },
    ],
    ganho: [
      { id: 'G1', dia: 2, canal: 'whatsapp', titulo: 'Boas-vindas e próximos passos', porque: 'Cliente que sabe o que vem não liga ansioso.' },
      { id: 'G2', dia: 45, canal: 'whatsapp', titulo: 'Primeira conta com solar + indicação', porque: 'Com a conta nova na mão, o cliente indica sozinho.' },
      { id: 'G3', dia: 180, canal: 'whatsapp', titulo: 'Relatório de 6 meses', porque: 'Mostra que você acompanha. Pede depoimento.' },
      { id: 'G4', dia: 365, canal: 'whatsapp', titulo: 'Limpeza anual', porque: 'Receita recorrente e mais uma chance de indicação.' },
    ],
    perdido: [
      { id: 'L1', dia: 90, canal: 'whatsapp', titulo: 'Reabordar (90 dias)', porque: 'Muita gente que perdeu para o preço volta depois.' },
    ],
  };
  const grupo = (s) => (s === 'novo' ? 'novo' : s === 'ganho' ? 'ganho' : s === 'perdido' ? 'perdido' : 'proposta');

  function mensagem(passo, o, ctx) {
    const nome = primeiro(o.nome), v = D.empresa.vendedor, link = ctx.link || '';
    const a = ctx.a, op = a && a.op, eco = op && op.eco;
    const viz = a && a.vizinhos;
    const T = {
      N0: `Oi ${nome}! Aqui é o ${v}, da Chama Solar ☀️ Vi seu contato agora. Pra eu te passar o valor certinho, me manda uma foto da sua conta de luz? Se preferir, me diz quanto vem por mês.`,
      N1: `${nome}, consigo passar aí para ver o telhado e te explicar tudo em 20 minutos. Fica bom amanhã de manhã ou no fim da tarde?`,
      N2: `${nome}, tudo bem? Para fechar o seu orçamento só falta a conta de luz (pode ser foto). Assim te mando o valor exato ainda hoje.`,
      P0: `${nome}, sua proposta está pronta! Fiz um raio-x da sua conta e montei o sistema certo para a sua casa:\n${link}\n\nDá para simular as parcelas e mandar para a família. Qualquer dúvida, me chama aqui.`,
      P1: `Oi ${nome}! Conseguiu abrir a proposta? Se quiser, te explico em 5 minutos por ligação.`,
      P2: `${nome}, só para você ver: ${viz && viz.total ? `já temos ${viz.total} usinas na região e a economia média é de ${brl(viz.economiaMedia)} por mês` : 'nossos clientes da região já estão economizando todo mês'}. Posso te mostrar uma perto de você?`,
      P3: `${nome}, fiz a conta: hoje você paga cerca de ${brl(eco && eco.contaAtual)} de luz. Com o solar financiado, a parcela fica no lugar da conta e depois de quitado sobra ${brl(eco && eco.economiaMes1)} por mês no seu bolso. Quer que eu simule com entrada?`,
      P4: `${nome}, o valor dos equipamentos que reservei para você vale até o fim desta semana; depois o distribuidor atualiza a tabela. Quer que eu segure o kit?`,
      P5: `${nome}, posso ser direto? O que falta para você decidir: valor, forma de pagamento ou ainda tem alguma dúvida técnica?`,
      P6: `${nome}, não quero ficar te incomodando. Vou encerrar sua proposta por aqui. Se mudar de ideia ou quiser rever o valor, é só me chamar que eu retomo na hora. Obrigado pela atenção!`,
      P7: `Oi ${nome}! Chegou a conta de luz deste mês? Se quiser, atualizo sua proposta com o valor novo, sem compromisso.`,
      P8: `${nome}, a CPFL reajustou de novo e o verão está chegando. Quer que eu refaça a sua simulação? Os equipamentos baixaram de preço este ano.`,
      G1: `${nome}, bem-vindo(a) à Chama Solar! 🎉 Próximos passos: projeto e pedido na CPFL (até 15 dias), instalação, vistoria e troca do medidor. Te aviso a cada etapa por aqui.`,
      G2: `${nome}, chegou a primeira conta com o solar? Me manda uma foto que eu confiro se está tudo certo. E se tiver alguém da família ou vizinho pagando caro de luz, me indica: tem um presente de agradecimento para você.`,
      G3: `${nome}, seu sistema completou 6 meses! Se puder, me manda um áudio curtinho contando como está a conta. Ajuda muito outras famílias a decidirem.`,
      G4: `${nome}, já faz um ano da sua usina! A limpeza anual ajuda a manter a geração lá em cima. Quer agendar? Aproveito e faço a revisão completa.`,
      L1: `Oi ${nome}, tudo bem? Os equipamentos baixaram e a CPFL reajustou a tarifa. Vale a pena refazer a sua simulação? Sem compromisso.`,
    };
    return T[passo.id] || '';
  }

  /* Próximo passo da cadência para um orçamento */
  function proximo(o, eventos, interacoes, agora = Date.now()) {
    const g = grupo(o.status), lista = PASSOS[g];
    const base = new Date((g === 'proposta' ? o.enviadoEm : g === 'ganho' ? (o.aceite && o.aceite.em) || o.atualizadoEm : g === 'perdido' ? o.atualizadoEm : o.criadoEm) || o.criadoEm).getTime();
    const feitos = new Set((interacoes || []).map((i) => (String(i.texto || '').match(/^Cadência (\w\d)/) || [])[1]).filter(Boolean));
    if (o.enviadoEm) feitos.add('P0'); // proposta já enviada pela ficha
    if (g !== 'novo' && o.estimativa) { feitos.add('N0'); }
    const ultimoToque = (interacoes || []).reduce((m, i) => Math.max(m, new Date(i.em).getTime()), 0);
    const pend = lista.filter((p) => !feitos.has(p.id));
    // se ficou para trás, pula direto para o passo mais recente que já venceu (não manda 5 mensagens atrasadas em fila)
    const vencidos = pend.filter((p) => base + p.dia * DIA <= agora);
    const passo = vencidos.length ? vencidos[vencidos.length - 1] : pend[0];
    if (!passo) return null;
    let vence = base + passo.dia * DIA;
    if (ultimoToque && passo.dia > 0) vence = Math.max(vence, ultimoToque + 20 * 3600e3); // no máximo 1 toque por dia
    // sinais do cliente passam na frente: proposta aberta agora = ligar já
    const ultimoEv = (eventos || []).reduce((m, e) => Math.max(m, new Date(e.em).getTime()), 0);
    const quente = g === 'proposta' && ultimoEv && agora - ultimoEv < 2 * 3600e3 && ultimoEv > ultimoToque;
    return { ...passo, grupo: g, vence, atrasoDias: Math.floor((agora - vence) / DIA), hoje: vence <= agora + 6 * 3600e3, quente };
  }

  /* Agenda do dia: tudo o que venceu (ou vence até o fim do dia), quentes primeiro */
  function agenda(orcs, eventosDe, interacoesDe, agora = Date.now()) {
    return orcs.map((o) => ({ o, passo: proximo(o, eventosDe(o.token), interacoesDe(o.id), agora) }))
      .filter((x) => x.passo && (x.passo.hoje || x.passo.quente))
      .sort((a, b) => (b.passo.quente - a.passo.quente) || (a.passo.grupo === 'novo' ? -1 : 0) - (b.passo.grupo === 'novo' ? -1 : 0) || a.passo.vence - b.passo.vence);
  }

  raiz.Cadencia = { PASSOS, proximo, agenda, mensagem };
})(window);
