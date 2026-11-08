/* =====================================================================
   OBRA: do contrato assinado até o sistema gerando.
   Cada etapa tem prazo típico (dias) para o lembrete da próxima e a
   mensagem para avisar o cliente no WhatsApp ("e aí, quando liga?" some).
   ===================================================================== */
(function (raiz) {
  'use strict';
  const ETAPAS = [
    { k: 'contrato', t: 'Contrato assinado', prazo: 3, prox: 'Receber os documentos', msg: (n) => `${n}, contrato assinado! Agora preciso de uns documentos para o projeto: foto do RG ou CNH, a última conta de luz e, se o imóvel não estiver no seu nome, a autorização do dono. Pode mandar por aqui mesmo.` },
    { k: 'documentos', t: 'Documentos recebidos', prazo: 5, prox: 'Enviar o projeto à distribuidora', msg: (n) => `${n}, recebi tudo, obrigado! Agora a engenharia monta o projeto elétrico e eu envio para a distribuidora. Te aviso assim que for protocolado.` },
    { k: 'projeto', t: 'Projeto enviado à distribuidora', prazo: 15, prox: 'Parecer de acesso da distribuidora', msg: (n) => `${n}, o projeto do seu sistema foi protocolado na distribuidora. Agora ela analisa e devolve o parecer de acesso, que costuma levar até 15 dias. Enquanto isso o seu kit já está garantido.` },
    { k: 'parecer', t: 'Parecer de acesso aprovado', prazo: 10, prox: 'Instalação', msg: (n) => `${n}, boa notícia: a distribuidora aprovou o seu projeto! Vamos agendar a instalação. Qual dia fica melhor para você?` },
    { k: 'instalacao', t: 'Instalação concluída', prazo: 3, prox: 'Pedir a vistoria', msg: (n) => `${n}, instalação concluída! Agora eu peço a vistoria para a distribuidora, que vem trocar o medidor. Até a troca, o sistema fica desligado: é o que a distribuidora pede.` },
    { k: 'vistoria', t: 'Vistoria pedida à distribuidora', prazo: 7, prox: 'Troca do medidor', msg: (n) => `${n}, a vistoria foi pedida. A distribuidora tem até 7 dias para vir trocar o medidor. Assim que trocar, o sistema já começa a gerar.` },
    { k: 'ligado', t: 'Medidor trocado: sistema gerando', prazo: 0, prox: null, msg: (n) => `${n}, o seu sistema solar está ligado e gerando! A partir da próxima conta você já vê a diferença. Vou acompanhar a geração pelo monitoramento e qualquer coisa te aviso. Obrigado pela confiança!` },
  ];
  const atual = (o) => { const ob = (o && o.obra) || {}; let i = -1; ETAPAS.forEach((e, k) => { if (ob[e.k]) i = k; }); return i; };
  const proxima = (o) => ETAPAS[atual(o) + 1] || null;
  raiz.Obra = { ETAPAS, atual, proxima };
})(typeof window !== 'undefined' ? window : globalThis);
