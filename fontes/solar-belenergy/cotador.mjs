// =====================================================================
// Cotador de KIT FECHADO Belenergy — roda no PC do vendedor
// Conduz belenus.com.br → Personalize seu Gerador → Convencional com a
// sessão do próprio vendedor (login à mão; NUNCA guarda senha) e responde
// ao sistema da Chama Solar em http://127.0.0.1:8787.
// Telas e seletores mapeados ao vivo em 04/11/2026:
//  /energy/modulo      #inputPotencia → botão "navigate_next" → tabela (radio por linha), ordem "Menor Preço Por Watt"
//  /energy/inversor    mat-select tipoInversor → tipoLigacao → tensaoNominal; fabricantes ng-multiselect-dropdown;
//                      FILTRAR → tabela (checkbox por linha) com "% Overload utilizado"
//  /energy/estrutura   Com/Sem Estrutura; arranjo: Tipo de estrutura, Detalhes, #numero-linhas, #modulos-linha,
//                      #tipo-orientacao (Retrato/Paisagem) → CALCULAR ESTRUTURA → itens (+/−/delete)
//  /energy/componentesCC, /energy/componentesCA   tabelas com + / − / delete
//  /energy/confirmar   Nome da proposta, Estado, Cidade, Dados de frete, Forma de pagamento,
//                      "Valor da proposta" · botões Baixar PDF / Salvar / Comprar Agora (NUNCA clicado)
// Uso:  node cotador.mjs
// =====================================================================
import { chromium } from 'playwright';
import http from 'node:http';
import path from 'node:path';

const BASE = 'https://belenus.com.br';
const PORTA = 8787;
const ORIGENS_OK = [/^https:\/\/([a-z0-9-]+\.)*chamae\.[a-z.]+$/i, /^https:\/\/([a-z0-9-]+\.)*claude\.ai$/, /^https:\/\/([a-z0-9-]+\.)*claudeusercontent\.com$/, /^https:\/\/vitimgm\.github\.io$/i, /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/, /^null$/];
const exato = (t) => new RegExp('^\\s*' + String(t).replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') + '\\s*$', 'i'); // texto inteiro, sem caixa
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
const num = (t) => +String(t || '').replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '') || 0;

const ctx = await chromium.launchPersistentContext(path.resolve('sessao-belenergy'), { headless: false, viewport: { width: 1450, height: 900 } });
const pg = ctx.pages()[0] || (await ctx.newPage());
pg.setDefaultTimeout(30000);
await pg.goto(BASE + '/');
const logado = async () => (await pg.locator('text=/Chama Solar Instala|Meus Orçamentos/i').count()) > 0;

/* ---------- utilidades ---------- */
const botao = (texto) => pg.locator('button:visible').filter({ hasText: texto }).first();
/* O portal escreve os botões em minúsculas e mostra em MAIÚSCULAS via CSS: comparar sempre sem caixa */
async function proximo() { await botao(/^\s*PRÓXIMO\s*$/i).click(); await pg.waitForLoadState('networkidle').catch(() => {}); await pausa(800); }
async function semCookies() { const b = pg.locator('button:visible').filter({ hasText: /^\s*Rejeitar\s*$/i }).first(); if (await b.count()) await b.click().catch(() => {}); }
async function esperarLinhas(filtro, ms = 60000) { // o portal demora (~13 s para listar módulos): espera a tabela estabilizar
  const t0 = Date.now(); let antes = -1;
  while (Date.now() - t0 < ms) {
    const n = await pg.evaluate((f) => [...document.querySelectorAll('tr')].filter((r) => new RegExp(f, 'i').test(r.innerText) && /Código:/.test(r.innerText)).length, filtro);
    if (n > 0 && n === antes) return n; antes = n; await pausa(700);
  }
  return 0;
}
async function matSelect(seletor, texto) {
  if (!texto) return;
  await pg.locator(seletor).first().click(); await pausa(600);
  const op = pg.locator('mat-option').filter({ hasText: new RegExp('^\\s*' + texto.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') + '\\s*$', 'i') }).first();
  if (await op.count()) await op.click();
  else if (await pg.locator('mat-option').count()) await pg.locator('mat-option').first().click(); // opção pedida não existe: usa a 1ª do portal
  else await pg.keyboard.press('Escape');
  await pausa(1200);
}
async function listaCustom(rotulo, texto) { // dropdowns próprios da tela de estrutura
  await pg.getByText(exato(rotulo)).locator('xpath=following-sibling::*[1]').click().catch(async () => { await pg.getByText(exato(rotulo)).locator('..').click(); });
  await pausa(600);
  await pg.getByText(exato(texto)).last().click(); await pausa(1200);
}
async function linhas(filtro) { // linhas das tabelas (módulos, inversores, itens)
  return pg.evaluate((filtro) => [...document.querySelectorAll('tr')].map((r, i) => {
    const t = r.innerText.replace(/\s+/g, ' ').trim(); if (!new RegExp(filtro, 'i').test(t)) return null;
    const sku = (t.match(/Código:\s*(\S+)/) || [])[1]; const q = [...r.querySelectorAll('input')].find((x) => x.type !== 'radio' && x.type !== 'checkbox');
    return { i, sku, nome: t.split(' Código:')[0], qtd: q ? +q.value || 0 : 0, qtdSugerida: +((t.match(/Qtd sugerida:\s*(\d+)/) || [])[1] || 0),
      potencia: (t.match(/Detalhes\s+([\d.]+)\s/) || [])[1], overload: (t.match(/(-?[\d,]+)%\s*Overload/) || [])[1] };
  }).filter((x) => x && x.sku), filtro);
}
async function ajustarQtd(skuAlvo, alvo) { // usa + / − da própria linha (o Angular registra o clique)
  const linha = pg.locator('tr').filter({ hasText: 'Código: ' + skuAlvo }).first();
  for (let k = 0; k < 300; k++) {
    const atual = +(await linha.locator('input:not([type=radio]):not([type=checkbox])').first().inputValue().catch(() => '0')) || 0;
    if (atual === alvo) return;
    await linha.locator('button, mat-icon, span').filter({ hasText: atual < alvo ? /^add$/ : /^remove$/ }).last().click(); await pausa(120);
  }
}
async function ajustarItens(itens) { for (const it of itens || []) if (it.sku) await ajustarQtd(it.sku, Math.max(+it.qtd || 0, 0)); }

/* ---------- etapas (mesma numeração do sistema) ---------- */
const NOMES = ['potência', 'módulo', 'inversor', 'estrutura', 'itens da estrutura', 'elétricos CC', 'elétricos CA', 'confirmação'];
async function passo(etapa, e = {}) {
  try { return await passoInterno(etapa, e); }
  catch (err) { console.error(err); throw new Error(`Robô parou na etapa "${NOMES[etapa] || etapa}" do portal: ${String(err.message || err).split('\n')[0].slice(0, 160)}`); }
}
async function passoInterno(etapa, e = {}) {
  if (!(await logado())) throw new Error('A sessão da Belenergy expirou: faça login na janela do robô e tente de novo.');
  if (etapa === 0) {
    await pg.goto(BASE + '/energy/escolha-metodo'); await pausa(1500);
    // "ESCOLHER" do Convencional não é <button>: clica pelo texto (o 1º é o Convencional)
    await semCookies();
    await pg.locator('button:visible').filter({ hasText: /^\s*escolher\s*$/i }).first().click();
    await pg.locator('#inputPotencia').waitFor({ timeout: 30000 });
    await pg.locator('#inputPotencia').fill(String(e.kwp).replace(',', '.'));
    await pg.locator('button:enabled').filter({ hasText: 'navigate_next' }).first().click();
    if (!(await esperarLinhas('MODULO'))) throw new Error('o portal não listou módulos para ' + e.kwp + ' kWp');
    await pg.locator('select').filter({ hasText: 'Menor Preço Por Watt' }).first().selectOption({ label: 'Menor Preço Por Watt' }).catch(() => {});
    await pausa(1200);
    const mods = (await linhas('MODULO')).map((m) => ({ sku: m.sku, nome: m.nome.replace(/^MODULO\s*/i, ''), potenciaW: num(m.potencia) || num((m.nome.match(/(\d{3,4})W/) || [])[1]), qtdSugerida: m.qtdSugerida || m.qtd }));
    return { etapa: 1, opcoes: { modulos: mods.map((m) => ({ ...m, kwp: Math.round(m.qtdSugerida * m.potenciaW / 10) / 100 })) } };
  }
  if (etapa === 1) {
    const linha = pg.locator('tr').filter({ hasText: 'Código: ' + e.moduloSku }).first();
    if (e.moduloQtd) await ajustarQtd(e.moduloSku, +e.moduloQtd);
    await linha.locator('input[type=radio]').first().check({ force: true }); await pausa(600);
    await proximo();
    const opcoes = async (fc) => { await pg.locator(`mat-select[formcontrolname="${fc}"]`).click(); await pausa(700); const t = await pg.locator('mat-option').allInnerTexts(); await pg.keyboard.press('Escape'); await pausa(300); return t.map((x) => x.trim()); };
    return { etapa: 2, opcoes: { tipos: await opcoes('tipoInversor'), ligacoes: ['MONOFÁSICO', 'BIFÁSICO', 'TRIFÁSICO'], tensoes: {}, fabricantes: (await pg.locator('ng-multiselect-dropdown li').allInnerTexts()).map((x) => x.trim()).filter((x) => x && !/Marcar Todos/i.test(x)), inversores: null } };
  }
  if (etapa === 2 && e.filtrar) {
    await matSelect('mat-select[formcontrolname="tipoInversor"]', e.tipoInversor);
    await matSelect('mat-select[formcontrolname="tipoLigacao"]', e.ligacao);
    await pg.locator('mat-select[formcontrolname="tensaoNominal"]').click(); await pausa(600);
    const tensoes = (await pg.locator('mat-option').allInnerTexts()).map((x) => x.trim());
    await pg.locator('mat-option').filter({ hasText: e.tensao && tensoes.includes(e.tensao) ? e.tensao : tensoes[0] }).first().click(); await pausa(1200);
    if (e.fabricantes && e.fabricantes.length) {
      await pg.locator('ng-multiselect-dropdown .dropdown-btn').click(); await pausa(500);
      for (let k = 0; k < 20 && (await pg.locator('ng-multiselect-dropdown li').filter({ hasText: /Não há fabricantes/i }).count()); k++) await pausa(500);
      for (const f of e.fabricantes) { const li = pg.locator('ng-multiselect-dropdown li').filter({ hasText: new RegExp('^\\s*' + f + '\\s*$', 'i') }); if (await li.count()) await li.first().click(); }
      await pg.locator('body').click({ position: { x: 5, y: 5 } }); await pausa(400);
    }
    await botao(/FILTRAR/i).click(); await esperarLinhas('INVERSOR|MICRO', 45000);
    const invs = (await linhas('INVERSOR|MICRO')).map((v) => ({ sku: v.sku, nome: v.nome.replace(/^INVERSOR DE CORRENTE\s*/i, 'Inversor '), potenciaKw: num((v.nome.match(/(\d+(?:\.\d+)?)KW/i) || [])[1]), qtd: v.qtdSugerida || 1, overload: num(v.overload), tipo: /H[IÍ]BRID/i.test(v.nome) ? 'hibrido' : /MICRO/i.test(v.nome) ? 'micro' : 'string', fabricante: (v.nome.match(/(AUXSOL|DEYE|GROWATT|HUAWEI|SOLIS|SUNGROW|HOYMILES|TSUNESS|ENPHASE)/i) || [])[1] || '' }));
    return { etapa: 2, opcoes: { tipos: [e.tipoInversor], ligacoes: [e.ligacao], tensoes: { [e.ligacao]: tensoes }, fabricantes: [], inversores: invs } };
  }
  if (etapa === 2) {
    await pg.locator('tr').filter({ hasText: 'Código: ' + e.inversorSku }).first().locator('input[type=checkbox]').check({ force: true }); await pausa(600);
    await proximo();
    const tipos = []; // lê as opções reais de tipo de estrutura
    await pg.getByText(exato('Tipo de estrutura')).locator('xpath=following-sibling::*[1]').click().catch(() => {}); await pausa(600);
    for (const t of ['Colonial', 'Telha Fibrocimento', 'Telha Metálico', 'Telha Shingle', 'Laje', 'Solo']) if (await pg.getByText(exato(t)).count()) tipos.push(t);
    await pg.keyboard.press('Escape');
    const estruturas = Object.fromEntries(tipos.map((t) => [t, []]));
    return { etapa: 3, opcoes: { estruturas, orientacoes: ['Retrato', 'Paisagem'], sugestao: { linhas: 1, modulosPorLinha: 0 }, detalhesSobDemanda: true } };
  }
  if (etapa === 3) {
    if (e.semEstrutura) { await pg.getByText(exato('Sem Estrutura')).click(); await pausa(800); return { etapa: 4, opcoes: { itens: [] } }; }
    await listaCustom('Tipo de estrutura', e.estruturaTipo);
    if (e.estruturaDetalhe) await listaCustom('Detalhes da Estrutura', e.estruturaDetalhe);
    await pg.locator('#numero-linhas').fill(String(e.linhas)); await pg.locator('#modulos-linha').fill(String(e.modulosPorLinha));
    await matSelect('#tipo-orientacao', e.orientacao || 'Retrato');
    await botao(/CALCULAR ESTRUTURA/i).click(); await esperarLinhas('.', 45000);
    return { etapa: 4, opcoes: { itens: (await linhas('Código:')).map((x) => ({ sku: x.sku, nome: x.nome, qtd: x.qtd })) } };
  }
  if (etapa === 4 || etapa === 5) {
    await ajustarItens(e.itens); await proximo();
    return { etapa: etapa + 1, opcoes: { itens: (await linhas('Código:')).map((x) => ({ sku: x.sku, nome: x.nome, qtd: x.qtd })) } };
  }
  if (etapa === 6) {
    await ajustarItens(e.itens); await proximo();
    const t = await pg.evaluate(() => document.body.innerText);
    return { etapa: 7, opcoes: { fretes: ['Cliente Retira', 'Transportadora escolhida pelo cliente', 'Belenus Entrega no Cliente'], pagamentos: ['Plano de Pagamento', 'Outras Formas de Pagamento'], valorProdutos: num((t.match(/Valor dos produtos:\s*R\$\s*([\d.,]+)/) || [])[1]) } };
  }
  if (etapa === 7) {
    const nome = pg.getByText('Nome da proposta:', { exact: false }).locator('xpath=following::input[1]');
    if (e.nome) await nome.fill(e.nome).catch(() => {});
    if (e.estadoEntrega) await pg.locator('select').filter({ hasText: 'SP' }).first().selectOption(e.estadoEntrega).catch(() => {});
    await pausa(800);
    if (e.cidadeEntrega) await pg.locator('select').filter({ hasText: 'Ribeirão Preto' }).first().selectOption({ label: e.cidadeEntrega }).catch(() => {});
    if (e.frete) await pg.locator('select').filter({ hasText: 'Cliente Retira' }).first().selectOption({ label: e.frete }).catch(() => {});
    await pausa(2500);
    if (e.pagamento && /Outras/.test(e.pagamento)) await pg.getByText('Outras Formas de Pagamento').first().click().catch(() => {});
    await pausa(1200);
    let t = await pg.evaluate(() => document.body.innerText);
    const valor = num((t.match(/Valor da proposta:\s*R\$\s*([\d.,]+)/) || [])[1]);
    const produtos = num((t.match(/Valor dos produtos:\s*R\$\s*([\d.,]+)/) || [])[1]);
    let numero = 'não salvo';
    if (e.salvar) { // só com autorização explícita do vendedor
      await botao(/^\s*Salvar\s*$/i).click(); await pausa(3500);
      t = await pg.evaluate(() => document.body.innerText);
      numero = (t.match(/(?:Or[çc]amento|Proposta)\s*(?:n[ºo°.]*)?\s*[:#]?\s*(\d{4,})/i) || [])[1] || 'salvo (ver Meus Orçamentos)';
    }
    // "Comprar Agora" NUNCA é clicado por este robô.
    return { etapa: 8, final: { valorKit: valor || produtos, valorProdutos: produtos, frete: Math.max((valor || produtos) - produtos, 0), numero } };
  }
  throw new Error('Etapa desconhecida: ' + etapa);
}

/* Detalhes da estrutura dependem do tipo: rota extra para o sistema buscar */
async function detalhes(tipo) {
  await listaCustom('Tipo de estrutura', tipo);
  await pg.getByText(exato('Detalhes da Estrutura')).locator('xpath=following-sibling::*[1]').click().catch(() => {}); await pausa(700);
  const t = await pg.evaluate(() => [...document.querySelectorAll('*')].filter((e) => e.children.length === 0 && /^Modelo /.test((e.innerText || '').trim())).map((e) => e.innerText.trim()));
  await pg.keyboard.press('Escape'); return [...new Set(t)];
}

/* ---------- servidor local ---------- */
let fila = Promise.resolve();
http.createServer((req, res) => {
  const origem = req.headers.origin || 'null';
  const ok = ORIGENS_OK.some((re) => re.test(origem));
  res.setHeader('Access-Control-Allow-Origin', ok ? origem : 'null');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.end();
  if (!ok) { res.statusCode = 403; return res.end(JSON.stringify({ erro: 'Origem não autorizada' })); }
  let corpo = ''; req.on('data', (c) => { corpo += c; if (corpo.length > 2e5) req.destroy(); });
  req.on('end', () => {
    if (req.url === '/status') return logado().then((l) => res.end(JSON.stringify({ ok: true, logado: l })));
    const rodar = (fn) => { fila = fila.then(async () => { try { res.end(JSON.stringify(await fn())); } catch (e) { res.statusCode = 500; res.end(JSON.stringify({ erro: String(e.message || e) })); } }); };
    if (req.url === '/passo' && req.method === 'POST') { const { etapa, entrada } = JSON.parse(corpo || '{}'); return rodar(() => passo(+etapa, entrada)); }
    if (req.url === '/detalhes' && req.method === 'POST') { const { tipo } = JSON.parse(corpo || '{}'); return rodar(async () => ({ detalhes: await detalhes(tipo) })); }
    res.statusCode = 404; res.end('{}');
  });
}).listen(PORTA, '127.0.0.1', () => console.log(`Cotador pronto em http://127.0.0.1:${PORTA}. Faça login na janela, se pedir.`));
