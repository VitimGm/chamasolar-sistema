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

    // Percentuais sobre o preço
    impostoTotal: 0.10,                 // TESTE — aguardando contador
    impostoServico: 0.06,               // quando o kit é faturado direto pela Belenergy
    taxaPagamento: { avista: 0, financiamento: 0, cartao: 0.09 },
    margens: [                           // margem cai devagar com o tamanho
      { ate: 5, margem: 0.18 },
      { ate: 10, margem: 0.16 },
      { ate: 20, margem: 0.14 },
      { ate: 50, margem: 0.12 },
      { ate: Infinity, margem: 0.10 },
    ],
    reservaNegociacao: 0.03,            // desconto máximo que o vendedor pode dar

    // Semáforo de mercado (R$/Wp) — média nacional residencial 1º tri 2026: R$ 2,45
    semaforo: { verdeAte: 2.60, amareloAte: 3.00, referencia: 2.45 },

    // Economia
    tarifaKwh: 0.98,                    // CPFL com impostos — TESTE
    reajusteAnual: 0.06,
    degradacaoAnual: 0.005,
    simultaneidade: 0.30,
    taxaDesconto: 0.10,                 // VPL
    fioB: { valorKwh: 0.30, cronograma: { 2026: 0.60, 2027: 0.75, 2028: 0.90 }, depois: 0.90 },

    // Financiamento
    financiamento: { jurosMes: 0.0169, prazos: [36, 60, 84] },
    cartao: { parcelas: 12 },
  };

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
    'Ribeirão Preto': { hsp: 5.30 },
    'Sertãozinho': { hsp: 5.30 },
    'Jardinópolis': { hsp: 5.32 },
    'Cravinhos': { hsp: 5.28 },
    'Franca': { hsp: 5.35 },
    'Araraquara': { hsp: 5.25 },
    'São Carlos': { hsp: 5.15 },
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

  raiz.DadosTeste = { parametros, catalogo, cidades, ceps, contasExemplo };
  if (typeof module !== 'undefined' && module.exports) module.exports = raiz.DadosTeste;
})(typeof window !== 'undefined' ? window : globalThis);
