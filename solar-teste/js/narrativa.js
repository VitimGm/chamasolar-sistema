/* =====================================================================
   NARRATIVA POR TIPO DE CLIENTE — o que a proposta conta para cada um.
   Usada pela Proposta Viva e pelo PDF. Mesmos números da simulação,
   contados do jeito que cada cliente decide:
   · Residencial: a economia vira sonhos da família (viagem, reforma, faculdade).
   · Comercial: a conta de luz vira lucro e fôlego para o negócio.
   · Grandes contas: investimento (TIR × CDI, VPL, payback) e ESG.
   · Rural: a economia em produção (sacas, arrobas) e energia para crescer.
   Todos os valores de referência ficam em Parâmetros (p.narrativa).
   ===================================================================== */
(function (raiz) {
  'use strict';
  const n = (v, c = 0) => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c });
  const brl = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

  // valores de referência (editáveis em Parâmetros → Proposta: sonhos e comparações)
  const PADRAO = {
    sonhos: [
      { id: 'viagem', icone: '✈️', titulo: 'Viagem em família', valor: 12000 },
      { id: 'reforma', icone: '🏡', titulo: 'Reforma da casa', valor: 35000 },
      { id: 'carro', icone: '🚗', titulo: 'Carro novo', valor: 95000 },
      { id: 'faculdade', icone: '🎓', titulo: 'Faculdade de um filho', valor: 90000 },
    ],
    custoFuncionario: 3500,   // salário + encargos de 1 funcionário por mês (comercial)
    margemLiquida: 0.10,      // margem líquida típica do comércio: para lucrar R$ 1, vende R$ 10
    cdiAnual: 0.135,          // CDI de referência (Selic perto de 13,5% no fim de 2026)
    poupancaAnual: 0.0617,    // poupança: 0,5% ao mês + TR
    fatorEmissao: 0.0385,     // tCO2 por MWh da rede brasileira (média SIN)
    precos: { cafe: 1600, soja: 130, boi: 316 }, // R$ por saca (60 kg) e por arroba
  };
  const ref = (p) => ({ ...PADRAO, ...((p && p.narrativa) || {}), precos: { ...PADRAO.precos, ...(((p && p.narrativa) || {}).precos || {}) } });

  function segmento(o) {
    return o.segmento || (o.grupo === 'A' ? 'grandes' : /padaria|auto|peças|ltda|comércio|mercado|loja|restaurante/i.test(o.nome || '') ? 'comercial' : 'residencial');
  }

  // valor futuro de depositar "mensal" todo mês por "anos", rendendo "taxaAno" (ao ano, juros compostos)
  const valorFuturo = (mensal, anos, taxaAno) => { const i = Math.pow(1 + taxaAno, 1 / 12) - 1, m = anos * 12; return i ? mensal * ((Math.pow(1 + i, m) - 1) / i) : mensal * m; };
  // quanto vale o dinheiro aplicado: R$ "valor" por "anos" a "taxaAno"
  const aplicado = (valor, anos, taxaAno) => valor * Math.pow(1 + taxaAno, anos);

  // meses de economia para juntar "valor" (economia cresce com a tarifa: usa a tabela ano a ano)
  function mesesPara(valor, eco) {
    let soma = 0;
    for (let a = 0; a < eco.tabela.length; a++) {
      const mes = eco.tabela[a].economiaAno / 12;
      for (let m = 1; m <= 12; m++) { soma += mes; if (soma >= valor) return a * 12 + m; }
    }
    return null;
  }
  const quando = (meses) => (meses == null ? 'em mais de 25 anos' : meses < 12 ? `em ${meses} ${meses === 1 ? 'mês' : 'meses'}` : meses % 12 === 0 ? `em ${meses / 12} ${meses === 12 ? 'ano' : 'anos'}` : `em ${n(meses / 12, 1)} anos`);

  /* ---------- Sonhos (residencial): cada sonho, em quanto tempo e quantas vezes em 25 anos ---------- */
  function sonhos(eco, p, extra) {
    const R = ref(p), lista = [...R.sonhos, ...(extra ? [extra] : [])];
    return lista.map((s) => { const m = mesesPara(s.valor, eco); return { ...s, meses: m, quando: quando(m), vezes: Math.floor(eco.economia25 / s.valor) }; });
  }

  /* ---------- Comparação com aplicações (grandes contas e comercial): taxas ao ano, lado a lado ---------- */
  function investimento(eco, preco, p) {
    const R = ref(p);
    return {
      tir: eco.tir, retornoAno1: preco > 0 ? (eco.economiaMes1 * 12) / preco : 0,
      cdiLiquido: R.cdiAnual * 0.85, cdi: R.cdiAnual, poupanca: R.poupancaAnual, // CDI com 15% de IR (aplicação longa)
      rendeCdiMes: (preco * R.cdiAnual * 0.85) / 12, // o mesmo dinheiro no CDI renderia por mês
    };
  }

  /* ---------- Equivalências do negócio (comercial) ---------- */
  function negocio(eco, p) {
    const R = ref(p), ano = eco.economiaMes1 * 12;
    return {
      ano, funcionarios: ano / (R.custoFuncionario * 12), custoFuncionario: R.custoFuncionario,
      vendasEquivalentes: ano / R.margemLiquida, margem: R.margemLiquida,
    };
  }

  /* ---------- Produção (rural) ---------- */
  function producao(eco, p) {
    const R = ref(p), ano = eco.economiaMes1 * 12;
    return [
      { id: 'cafe', icone: '☕', titulo: 'sacas de café', qtd: ano / R.precos.cafe, preco: R.precos.cafe, un: 'saca' },
      { id: 'soja', icone: '🌱', titulo: 'sacas de soja', qtd: ano / R.precos.soja, preco: R.precos.soja, un: 'saca' },
      { id: 'boi', icone: '🐂', titulo: 'arrobas de boi', qtd: ano / R.precos.boi, preco: R.precos.boi, un: 'arroba' },
    ];
  }

  /* ---------- Ambiental (todos; destaque em grandes contas) ---------- */
  function ambiental(op, p) {
    const R = ref(p), mwh25 = (op.dim.geracaoMes * 12 * 25) / 1000;
    return { mwhAno: (op.dim.geracaoMes * 12) / 1000, tco2_25: mwh25 * R.fatorEmissao, fator: R.fatorEmissao };
  }

  /* ---------- Manchete e argumentos de cada tipo de cliente ---------- */
  function capa(seg, o, a) {
    const eco = a.op.eco, nome = String(o.nome || '').trim(), primeiro = nome.split(' ')[0];
    const ga = o.grupo === 'A';
    switch (seg) {
      case 'comercial': return {
        selo: 'Proposta para o seu negócio', titulo: `A conta de luz da ${nome} pode virar lucro.`,
        sub: `São ${brl(eco.economiaMes1)} por mês que voltam para o caixa: ${brl(eco.economiaMes1 * 12)} no primeiro ano e ${brl(eco.economia25)} em 25 anos.`,
        destaque: { rot: 'Volta para o caixa por ano', val: brl(eco.economiaMes1 * 12) } };
      case 'grandes': return {
        selo: ga ? 'Proposta executiva · Grupo A' : 'Proposta executiva', titulo: `Energia solar para a ${nome}: um investimento que rende ${n(eco.tir * 100, 1)}% ao ano.`,
        sub: `Retorno em ${eco.paybackAnos ? n(eco.paybackAnos, 1) + ' anos' : 'poucos anos'} e ${brl(eco.economia25)} de economia em 25 anos, já com o reajuste da tarifa${ga ? ' e a demanda contratada' : ''}.`,
        destaque: { rot: 'Rendimento (TIR)', val: `${n(eco.tir * 100, 1)}% a.a.` } };
      case 'rural': return {
        selo: 'Proposta para a propriedade', titulo: `${primeiro ? primeiro + ', o' : 'O'} sol da propriedade pode pagar a sua energia.`,
        sub: `São ${brl(eco.economiaMes1 * 12)} por ano que ficam na produção, em vez de ir para a CPFL: ${brl(eco.economia25)} em 25 anos.`,
        destaque: { rot: 'Fica na produção por ano', val: brl(eco.economiaMes1 * 12) } };
      default: return {
        selo: 'Proposta para a sua família', titulo: `${primeiro}, sua conta de luz pode cair de ${brl(eco.contaAtual)} para ${brl(eco.contaDepois)}.`,
        sub: `São ${brl(eco.contaAtual - eco.contaDepois)} por mês de volta no seu bolso. Em 25 anos, ${brl(eco.economia25)} para realizar o que a família sonha.`,
        destaque: { rot: 'Em 25 anos, no seu bolso', val: brl(eco.economia25) } };
    }
  }

  /* garantias e segurança: o que tira o medo de decidir (iguais para todos, texto ajustado) */
  function garantias(seg, p) {
    const d = (p && p.empresaDoc) || {}, inst = d.garantiaInstalacaoAnos || 1;
    return [
      ['🛡️', 'Garantia de fábrica', 'Placas e inversor com a garantia do fabricante. Os prazos de cada modelo vêm na ficha técnica entregue com o contrato.'],
      ['🔧', `Instalação garantida por ${inst} ${inst > 1 ? 'anos' : 'ano'}`, 'Feita pela nossa equipe, com projeto assinado por engenheiro e ART.'],
      ['📄', 'Papelada da CPFL por nossa conta', 'Projeto, pedido de ligação, vistoria e troca do medidor. Você não vai a lugar nenhum.'],
      ['📈', 'Acompanhamento todo mês', 'Monitoramos a geração e avisamos se algo sair do normal.'],
      ['💰', 'Preço fechado', seg === 'grandes' ? 'Kit, projeto, instalação e homologação no valor da proposta. Sem custo escondido.' : 'Tudo o que precisa está no valor da proposta. Sem surpresa no meio do caminho.'],
    ];
  }

  raiz.Narrativa = { PADRAO, ref, segmento, sonhos, mesesPara, quando, investimento, negocio, producao, ambiental, capa, garantias, valorFuturo };
})(window);
