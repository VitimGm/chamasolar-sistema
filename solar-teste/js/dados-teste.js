/* =====================================================================
   DADOS DE TESTE — todos os números abaixo são SIMULADOS.
   Trocar pelos valores reais quando chegarem: custos fixos, alíquota
   (contador), preço do terceiro, planilha Belenergy, base de irradiação.
   ===================================================================== */
(function (raiz) {
  'use strict';

  const parametros = {
    anoBase: 2026,

    // Dimensionamento
    pr: 0.776,                          // = perdas 22,4% (mesmo conservadorismo do Groner)
    margemGeracao: 0.05,
    perdaOrientacao: 0.07,              // orientação ainda desconhecida: perda de segurança (E/O dividido ≈ −7% no pior caso, Canal Solar)                // gera 5% acima do consumo compensável (perda dos módulos, clima)
    faixaDcAc: { min: 1.10, max: 1.35 },
    tempMinima: 5,                      // °C, para tensão de string no frio

    // Custos diretos
    maoDeObraPorPlaca: 100,             // terceiro (a própria de R$ 70 saiu)
    engenharia: [                        // projeto + homologação por faixa de kWp
      { ate: 10, valor: 300 },
      { ate: 30, valor: 500 },
      { ate: Infinity, valor: 700 },
    ],
    art: 70,
    materialCaBase: 400,
    materialCaPorKwp: 60,
    freteIncluso: true,
    fretePadrao: 350,
    custoKm: 1.0,
    visitasObra: 2,                     // vistoria + obra
    trocaPadrao: 1800,
    reservaGarantia: 0.01,              // 1% do kit

    // Custo fixo rateado
    custoFixoMes: 6000,                 // TESTE — aguardando custos reais
    obrasPrevistasMes: 4,
    roboOverloadMin: 0,                  // robô: overload mínimo do inversor (%)
    roboOverloadMax: 0,                  // robô: teto de overload (%); 0 = o limite do fabricante (datasheet), com a perda por corte na conta
    roboModMinW: 0,                      // robô: placa mínima em W (0 = qualquer; ex.: 550 para evitar placa pequena)
    validadeKitDias: 7,                  // preço do kit vale X dias: depois o sistema pede para recotar
    limiteMonoEmTriKw: 10,               // cliente trifásico: até X kW de inversor usa mono 220 V (entre 2 fases). CONFIRMAR com o engenheiro / GED-15303 CPFL
    kitRefWp: 1.35,                     // resposta rápida: kit médio por Wp (ajustar com as cotações)
    moduloRefW: 685,
    kwpPrevistosMes: 0,                 // meta de kWp vendidos/mês; > 0 rateia o custo fixo por kWp

    // Percentuais sobre o preço
    impostoTotal: 0.10,                 // TESTE — aguardando contador
    impostoServico: 0.06,               // quando o kit é faturado direto pela Belenergy
    taxaPagamento: { avista: 0, financiamento: 0, cartao: 0.1346 }, // cartão: usado só se faltar a tabela por parcela (cartao.taxas)
    margens: [                           // margem cai devagar com o tamanho
      { ate: 5, margem: 0.18 },
      { ate: 10, margem: 0.16 },
      { ate: 20, margem: 0.14 },
      { ate: 50, margem: 0.12 },
      { ate: Infinity, margem: 0.10 },
    ],
    kwpMaxKit: 75,                       // usina maior que isso: o robô cota kits iguais (um inversor por kit)
    manutencaoPorPlaca: 25,              // manutenção avulsa (R$ por placa)
    margemAvulso: 0.20,                  // margem dos serviços avulsos (ampliação, troca de inversor)
    reservaNegociacao: 0.03,            // desconto máximo que o vendedor pode dar
    // Groner (só para comparar e, se o vendedor quiser, usar o preço dela)
    groner: { percentual: 0.365, maoDeObraPorPlaca: 100, art: 70, custoKm: 1, kmIdaVolta: 0, eng: [300, 500, 700] },

    // Semáforo de mercado (R$/Wp) — média nacional residencial 1º tri 2026: R$ 2,45
    semaforo: { verdeAte: 2.60, amareloAte: 3.00, referencia: 2.45 },
    // Microinversor: régua própria. Vendas da Chama com micro de 5 a 10 kWp (Groner 2025–26): mediana R$ 2,52/Wp, metade entre 2,41 e 2,60;
    // com inversor string no mesmo porte: mediana 2,37. O micro custa mais no kit (placa a placa).
    semaforoMicro: { verdeAte: 2.65, amareloAte: 2.90, referencia: 2.54 },

    // Economia
    tarifaKwh: 0.98,                    // CPFL com impostos — TESTE
    reajusteAnual: 0.06,
    degradacaoAnual: 0.005,
    simultaneidade: 0.30,
    taxaDesconto: 0.10,                 // VPL
    fioB: { valorKwh: 0.30, cronograma: { 2026: 0.60, 2027: 0.75, 2028: 0.90 }, depois: 0.90 },

    // Financiamento
    financiamento: { jurosMes: 0.0169, prazos: [36, 60, 84] },
    // Cartão: taxas da Cielo com antecipação D+1 (passadas pelo Victor em 10/11/2026). Preço no cartão = à vista "embutindo" a taxa da parcela.
    cartao: { parcelas: 12, maxParcelas: 18, debito: 0.0147,
      taxas: { 1: 0.0410, 2: 0.0560, 3: 0.0618, 4: 0.0686, 5: 0.0757, 6: 0.0828, 7: 0.0909, 8: 0.0994, 9: 0.1097, 10: 0.1154, 11: 0.1249, 12: 0.1346, 13: 0.1382, 14: 0.1468, 15: 0.1554, 16: 0.1640, 17: 0.1726, 18: 0.1812 } },

    // Conversão
    validadeDias: 7,                    // validade real da cotação do kit (Belenergy)
    manutencaoAnual: 250,               // limpeza/inspeção — entra no custo da energia (LCOE)
    reajusteUltimo: 0.0925,             // CPFL Paulista, residencial, abr/2026 (Aneel)
    proximoReajuste: 'abril de 2027',   // reajuste anual da CPFL Paulista (previsto)
  };

  // Dados públicos da empresa (do site chamasolar.com.br)
  const empresa = {
    nome: 'Chama Solar', vendedor: 'Victor', anos: 7,
    whatsapp: '5516981366288', telefone: '(16) 3505-8921', email: 'atendimento@chamasolar.com.br',
    endereco: 'R. Otto Benz, 510 — Nova Ribeirânia, Ribeirão Preto/SP',
    instagram: 'https://www.instagram.com/chamasolaroficial/',
    selo: '10 de 10 clientes recomendam',
  };

  // Usinas de clientes (SIMULADO). No oficial vem do monitoramento (Deye Cloud etc.) × conta CPFL.
  const usinasVizinhas = [
    { cidade: 'Ribeirão Preto', bairro: 'Jardim Botânico', kwp: 4.4, desde: 2023, contaAntes: 512, contaMes: 64, geracaoPct: 1.04 },
    { cidade: 'Ribeirão Preto', bairro: 'Nova Ribeirânia', kwp: 5.5, desde: 2022, contaAntes: 640, contaMes: 71, geracaoPct: 0.98 },
    { cidade: 'Ribeirão Preto', bairro: 'Alto da Boa Vista', kwp: 8.1, desde: 2024, contaAntes: 980, contaMes: 112, geracaoPct: 1.07 },
    { cidade: 'Ribeirão Preto', bairro: 'Ribeirânia', kwp: 3.3, desde: 2025, contaAntes: 395, contaMes: 58, geracaoPct: 1.01 },
    { cidade: 'Sertãozinho', bairro: 'Centro', kwp: 15.2, desde: 2023, contaAntes: 2140, contaMes: 186, geracaoPct: 1.02 },
    { cidade: 'Sertãozinho', bairro: 'Jardim Soljumar', kwp: 4.9, desde: 2024, contaAntes: 560, contaMes: 69, geracaoPct: 0.97 },
    { cidade: 'Franca', bairro: 'Jardim Petráglia', kwp: 6.0, desde: 2023, contaAntes: 690, contaMes: 77, geracaoPct: 1.03 },
    { cidade: 'Jardinópolis', bairro: 'Centro', kwp: 5.2, desde: 2024, contaAntes: 610, contaMes: 66, geracaoPct: 1.0 },
  ];

  // Leads de exemplo para o painel (SIMULADO). "h" = horas atrás.
  const leadsExemplo = [
    { nome: 'Mariana Alves', whatsapp: '16 99123-4567', cep: '14025-000', ligacao: 'bi', origem: 'Instagram',
      consumos: [480, 455, 510, 540, 520, 470, 430, 445, 495, 530, 560, 545], status: 'negociando', criadoH: 74,
      eventos: [['abriu', 70], ['viu', 69.9, { secao: 'conta' }], ['viu', 69.8, { secao: 'pagamento' }], ['simulou', 69.7, { prazo: 84 }], ['abriu', 26], ['simulou', 25.9, { prazo: 60 }], ['simulou', 25.8, { prazo: 84 }], ['compartilhou', 25.5], ['abriu', 3], ['viu', 2.9, { secao: 'duvidas' }]] },
    { nome: 'Padaria Pão Dourado', whatsapp: '16 98877-1122', cep: '14160-000', ligacao: 'tri', origem: 'Indicação',
      consumos: [1820, 1760, 1900, 1950, 1880, 1700, 1650, 1690, 1800, 1920, 2010, 1980], status: 'visualizou', criadoH: 30,
      eventos: [['abriu', 20], ['viu', 19.9, { secao: 'conta' }], ['viu', 19.8, { secao: 'sistema' }], ['escolheu', 19.7, { opcao: 0 }]] },
    { nome: 'Carlos Menezes', whatsapp: '16 99234-8899', cep: '14096-000', ligacao: 'bi', origem: 'Site',
      consumos: [720, 690, 750, 800, 760, 700, 650, 640, 710, 780, 820, 810], status: 'proposta', criadoH: 52, eventos: [] },
    { nome: 'Dona Lúcia Prado', whatsapp: '16 99701-3344', cep: '14400-000', ligacao: 'mono', origem: 'Indicação',
      consumos: [310, 295, 330, 350, 340, 300, 280, 285, 320, 345, 360, 355], status: 'novo', criadoH: 1.5, eventos: [] },
    { nome: 'Auto Peças Rodovia', whatsapp: '16 98123-0045', cep: '14170-000', ligacao: 'tri', origem: 'Google',
      consumos: [2600, 2550, 2700, 2800, 2750, 2500, 2400, 2450, 2600, 2750, 2900, 2850], status: 'visualizou', criadoH: 100,
      eventos: [['abriu', 96], ['viu', 95.9, { secao: 'conta' }]] },
    { nome: 'Rafael e Júlia Torres', whatsapp: '16 99654-7788', cep: '14026-000', ligacao: 'bi', origem: 'Instagram',
      consumos: [600, 580, 640, 690, 660, 590, 550, 560, 610, 670, 700, 690], status: 'ganho', criadoH: 260,
      eventos: [['abriu', 240], ['simulou', 239, { prazo: 60 }], ['compartilhou', 238], ['abriu', 200], ['aceite', 199, { opcao: 1, pagamento: 'financiamento' }]] },
    { nome: 'Sérgio Bastos', whatsapp: '16 99111-2233', cep: '14021-000', ligacao: 'bi', origem: 'Site',
      consumos: [420, 400, 450, 470, 450, 410, 380, 390, 430, 460, 480, 470], status: 'perdido', criadoH: 400, motivoPerda: 'Fechou com concorrente mais barato',
      eventos: [] },
  ];

  const catalogo = {
    // Cadastro único de equipamentos (preço = Belenergy simulado)
    modulos: [
      { id: 'mod-575', nome: 'Módulo TOPCon 575 W (genérico)', potenciaW: 575, voc: 51.2, vmp: 42.6, isc: 14.1, coefVoc: -0.0026, areaM2: 2.58, preco: 420, fornecedor: 'Belenergy' },
      { id: 'mod-610', nome: 'Módulo TOPCon bifacial 610 W (genérico)', potenciaW: 610, voc: 52.9, vmp: 44.0, isc: 14.6, coefVoc: -0.0025, areaM2: 2.70, preco: 495, fornecedor: 'Belenergy' },
    ],
    inversores: [
      { id: 'inv-3', nome: 'Inversor string 3 kW', potenciaKw: 3, mppts: 1, stringsPorMppt: 1, vMaxDc: 600, vMinMppt: 90, iMaxMppt: 16, preco: 2700, hibrido: false },
      { id: 'inv-5', nome: 'Inversor string 5 kW', potenciaKw: 5, mppts: 2, stringsPorMppt: 1, vMaxDc: 600, vMinMppt: 90, iMaxMppt: 16, preco: 3600, hibrido: false },
      { id: 'inv-6', nome: 'Inversor string 6 kW', potenciaKw: 6, mppts: 2, stringsPorMppt: 1, vMaxDc: 600, vMinMppt: 90, iMaxMppt: 16, preco: 4100, hibrido: false },
      { id: 'inv-8', nome: 'Inversor string 8 kW', potenciaKw: 8, mppts: 2, stringsPorMppt: 2, vMaxDc: 1000, vMinMppt: 140, iMaxMppt: 16, preco: 5400, hibrido: false },
      { id: 'inv-10', nome: 'Inversor string 10 kW', potenciaKw: 10, mppts: 2, stringsPorMppt: 2, vMaxDc: 1000, vMinMppt: 140, iMaxMppt: 16, preco: 6300, hibrido: false },
      { id: 'inv-12', nome: 'Inversor string 12 kW', potenciaKw: 12, mppts: 2, stringsPorMppt: 2, vMaxDc: 1100, vMinMppt: 180, iMaxMppt: 20, preco: 7500, hibrido: false },
      { id: 'pinv-3', nome: 'Inversor premium 3 kW (garantia 10 anos)', potenciaKw: 3, mppts: 1, stringsPorMppt: 1, vMaxDc: 600, vMinMppt: 90, iMaxMppt: 16, preco: 3900, hibrido: false },
      { id: 'pinv-12', nome: 'Inversor premium 12 kW (garantia 10 anos)', potenciaKw: 12, mppts: 2, stringsPorMppt: 2, vMaxDc: 1100, vMinMppt: 180, iMaxMppt: 20, preco: 9800, hibrido: false },
      { id: 'hib-3', nome: 'Inversor híbrido 3,6 kW', potenciaKw: 3.6, mppts: 2, stringsPorMppt: 1, vMaxDc: 500, vMinMppt: 125, iMaxMppt: 16, preco: 7200, hibrido: true },
      { id: 'inv-15', nome: 'Inversor string 15 kW', potenciaKw: 15, mppts: 3, stringsPorMppt: 2, vMaxDc: 1100, vMinMppt: 180, iMaxMppt: 20, preco: 8900, hibrido: false },
      { id: 'pinv-5', nome: 'Inversor premium 5 kW (garantia 10 anos)', potenciaKw: 5, mppts: 2, stringsPorMppt: 1, vMaxDc: 600, vMinMppt: 90, iMaxMppt: 16, preco: 5200, hibrido: false },
      { id: 'pinv-8', nome: 'Inversor premium 8 kW (garantia 10 anos)', potenciaKw: 8, mppts: 2, stringsPorMppt: 2, vMaxDc: 1000, vMinMppt: 140, iMaxMppt: 16, preco: 7300, hibrido: false },
      { id: 'hib-5', nome: 'Inversor híbrido 5 kW', potenciaKw: 5, mppts: 2, stringsPorMppt: 1, vMaxDc: 500, vMinMppt: 125, iMaxMppt: 16, preco: 8800, hibrido: true },
      { id: 'hib-8', nome: 'Inversor híbrido 8 kW', potenciaKw: 8, mppts: 2, stringsPorMppt: 2, vMaxDc: 500, vMinMppt: 125, iMaxMppt: 16, preco: 12400, hibrido: true },
      { id: 'hib-12', nome: 'Inversor híbrido 12 kW', potenciaKw: 12, mppts: 2, stringsPorMppt: 2, vMaxDc: 800, vMinMppt: 150, iMaxMppt: 26, preco: 16900, hibrido: true },
    ],
    baterias: [
      { id: 'bat-5', nome: 'Bateria lítio LFP 5,1 kWh', kwh: 5.1, preco: 9200 },
    ],
    estrutura: { ceramico: 85, fibrocimento: 55, metalico: 50, laje: 140, solo: 220 }, // R$ por placa
    niveis: [
      { nome: 'Econômica', modulo: 'mod-575', inversores: ['inv-3', 'inv-5', 'inv-6', 'inv-8', 'inv-10', 'inv-12', 'inv-15'], descricao: 'Melhor preço, equipamentos de linha.' },
      { nome: 'Recomendada', destaque: true, modulo: 'mod-610', inversores: ['pinv-3', 'pinv-5', 'pinv-8', 'pinv-12', 'inv-15'], descricao: 'Módulo bifacial e inversor com garantia estendida.' },
      { nome: 'Premium / Híbrida', modulo: 'mod-610', inversores: ['hib-3', 'hib-5', 'hib-8', 'hib-12'], bateria: 'bat-5', descricao: 'Bateria para manter o essencial ligado quando falta luz.' },
    ],
  };

  // Irradiação média anual no plano inclinado (kWh/m²/dia) — APROXIMADA, trocar pela base pública
  const cidades = {
    // km = distância aproximada da base (ida), editável no orçamento
    'Ribeirão Preto': { hsp: 5.30, km: 12 }, 'Bonfim Paulista': { hsp: 5.30, km: 15 }, 'Sertãozinho': { hsp: 5.30, km: 25 },
    'Jardinópolis': { hsp: 5.32, km: 22 }, 'Cravinhos': { hsp: 5.28, km: 24 }, 'Serrana': { hsp: 5.30, km: 25 }, 'Dumont': { hsp: 5.30, km: 25 },
    'Brodowski': { hsp: 5.32, km: 27 }, 'Barrinha': { hsp: 5.30, km: 35 }, 'Pontal': { hsp: 5.30, km: 35 }, 'Pradópolis': { hsp: 5.28, km: 40 },
    'Guatapará': { hsp: 5.28, km: 40 }, 'Batatais': { hsp: 5.33, km: 45 }, 'São Simão': { hsp: 5.28, km: 45 }, 'Santa Rosa de Viterbo': { hsp: 5.28, km: 55 },
    'Luís Antônio': { hsp: 5.25, km: 55 }, 'Altinópolis': { hsp: 5.33, km: 60 }, 'Orlândia': { hsp: 5.35, km: 60 }, 'Jaboticabal': { hsp: 5.30, km: 60 },
    'Morro Agudo': { hsp: 5.35, km: 75 }, 'Monte Alto': { hsp: 5.30, km: 80 }, 'Araraquara': { hsp: 5.25, km: 88 }, 'Franca': { hsp: 5.35, km: 90 },
    'Bebedouro': { hsp: 5.35, km: 95 }, 'São Carlos': { hsp: 5.15, km: 105 },
  };

  // CEP simulado → cidade e distância da base (km). No oficial: API de CEP + rota.
  const ceps = [
    { prefixo: '1416', cidade: 'Sertãozinho', km: 25 },
    { prefixo: '1415', cidade: 'Jardinópolis', km: 22 },
    { prefixo: '1414', cidade: 'Cravinhos', km: 24 },
    { prefixo: '140', cidade: 'Ribeirão Preto', km: 12 },
    { prefixo: '141', cidade: 'Ribeirão Preto', km: 12 },
    { prefixo: '144', cidade: 'Franca', km: 90 },
    { prefixo: '148', cidade: 'Araraquara', km: 88 },
    { prefixo: '135', cidade: 'São Carlos', km: 105 },
  ];

  // Contas de luz de exemplo (o que a IA vai devolver ao ler o PDF da CPFL)
  const contasExemplo = [
    { nome: 'Mariana Alves', whatsapp: '16 99123-4567', cep: '14025-000', ligacao: 'bi', consumos: [480, 455, 510, 540, 520, 470, 430, 445, 495, 530, 560, 545], tarifaKwh: 0.98, instalacao: '4003XXXXXX' },
    { nome: 'Padaria Pão Dourado', whatsapp: '16 98877-1122', cep: '14160-000', ligacao: 'tri', consumos: [1820, 1760, 1900, 1950, 1880, 1700, 1650, 1690, 1800, 1920, 2010, 1980], tarifaKwh: 0.96, instalacao: '4007XXXXXX' },
  ];

  // Conta de média tensão de EXEMPLO (Grupo A, tarifa verde): supermercado fictício, tarifas aproximadas com impostos
  const grupoAExemplo = {
    nome: 'Supermercado Exemplo (teste)', cidade: 'Ribeirão Preto', distanciaKm: 8,
    grupoA: { modalidade: 'verde', demanda: 150,
      consumoFP: [39800, 38900, 39200, 36500, 33800, 31900, 31500, 33200, 35600, 37800, 38900, 40100],
      consumoP: [4050, 3960, 3990, 3700, 3420, 3230, 3200, 3360, 3600, 3830, 3950, 4080],
      tarifas: { teP: 0.62, tusdP: 1.95, teFP: 0.40, tusdFP: 0.14, demanda: 32, demandaP: 0 }, fioBParte: 0.5, simultaneidade: 0.7, alvo: 'fp', limitarDemanda: false },
  };

  raiz.DadosTeste = { parametros, catalogo, cidades, ceps, contasExemplo, grupoAExemplo, empresa, usinasVizinhas, leadsExemplo };
  if (typeof module !== 'undefined' && module.exports) module.exports = raiz.DadosTeste;
})(typeof window !== 'undefined' ? window : globalThis);
