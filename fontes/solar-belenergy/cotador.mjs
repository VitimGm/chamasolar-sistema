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
// 08/11/2026: o robô também LÊ o JSON que o portal manda para a própria tela (API KitPersonalizado):
//  Modulos/Inversor → lista com índice de preço · TipoEstrutura → nomes exatos ("Telha Metálica", com A)
//  Confirmar/AlterarCarrinho → carrinho com o preço de cada item · BuscarCupons → cupons da conta.
//  Só leitura: nada é enviado ao portal além dos cliques normais da tela.
// Uso:  node cotador.mjs
// =====================================================================
import { chromium } from 'playwright';
import http from 'node:http';
import path from 'node:path';
import fsLog from 'node:fs';
import os from 'node:os';

// tudo o que o robô escreve também vai para robo.log (nesta pasta), para dar para investigar depois
const ARQ_LOG = path.resolve('robo.log');
for (const nivel of ['log', 'error', 'warn']) {
  const orig = console[nivel].bind(console);
  console[nivel] = (...a) => { orig(...a); try { if (fsLog.existsSync(ARQ_LOG) && fsLog.statSync(ARQ_LOG).size > 2e6) fsLog.renameSync(ARQ_LOG, ARQ_LOG + '.antigo'); fsLog.appendFileSync(ARQ_LOG, new Date().toLocaleString('pt-BR') + ' ' + a.map((x) => (x instanceof Error ? x.stack : typeof x === 'string' ? x : JSON.stringify(x))).join(' ') + '\n'); } catch { /* sem log */ } };
}
process.on('uncaughtException', (e) => console.error('ERRO inesperado:', e));
process.on('unhandledRejection', (e) => console.error('ERRO inesperado (promessa):', e));

const BASE = 'https://belenus.com.br';
const PORTA = 8787;
const ORIGENS_OK = [/^https:\/\/([a-z0-9-]+\.)*chamae\.[a-z.]+$/i, /^https:\/\/([a-z0-9-]+\.)*claude\.ai$/, /^https:\/\/([a-z0-9-]+\.)*claudeusercontent\.com$/, /^https:\/\/vitimgm\.github\.io$/i, /^https:\/\/chamaeescritorio1-boop\.github\.io$/i, /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/, /^null$/];
const exato = (t) => new RegExp('^\\s*' + String(t).replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') + '\\s*$', 'i'); // texto inteiro, sem caixa
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
const num = (t) => +String(t || '').replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '') || 0;

// usa o Google Chrome já instalado no computador (não precisa baixar navegador); sem Chrome, usa o do Playwright
const OPC = { headless: false, viewport: { width: 1450, height: 900 } };
let ctx;
try { ctx = await chromium.launchPersistentContext(path.resolve('sessao-belenergy'), { ...OPC, channel: 'chrome' }); }
catch (e) { console.log('Chrome não encontrado, usando o navegador do robô.'); ctx = await chromium.launchPersistentContext(path.resolve('sessao-belenergy'), OPC); }
const pg = ctx.pages()[0] || (await ctx.newPage());
pg.setDefaultTimeout(30000);
const VERSAO = '2026-11-09c'; // aparece no sistema: se estiver velho, ele avisa para baixar o novo
/* Rede: conta as chamadas do portal em andamento (ignora rastreadores e conexões longas).
   Mais rápido que esperar "networkidle", que no Angular às vezes nunca chega e custava 4 s por espera. */
const voando = new Map(); let ultimoFim = Date.now();
const contaRede = (r) => ['xhr', 'fetch', 'document'].includes(r.resourceType()) && !/google|facebook|hotjar|clarity|doubleclick|tiktok|analytics|gtm|pixel|sentry/i.test(r.url());
pg.on('request', (r) => { if (contaRede(r)) voando.set(r, Date.now()); });
const acabou = (r) => { if (voando.delete(r)) ultimoFim = Date.now(); };
pg.on('requestfinished', acabou); pg.on('requestfailed', acabou);
async function redeQuieta(quieto = 300, max = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < max) {
    const agora = Date.now(); for (const [r, t] of voando) if (agora - t > 15000) voando.delete(r);
    if (!voando.size && agora - ultimoFim >= quieto) return true;
    await new Promise((ok) => setTimeout(ok, 80));
  }
  return false;
}
await pg.goto(BASE + '/');
const logado = async () => (await pg.locator('text=/Chama Solar Instala|Meus Orçamentos/i').count()) > 0;

/* ---------- utilidades ---------- */
const botao = (texto) => pg.locator('button:visible').filter({ hasText: texto }).first();
/* O portal escreve os botões em minúsculas e mostra em MAIÚSCULAS via CSS: comparar sempre sem caixa */
/* Avisos que o portal mostra quando não deixa avançar (ex.: "falta conector MC4") */
async function avisoPortal() {
  return pg.evaluate(() => [...document.querySelectorAll('mat-snack-bar-container, .mat-mdc-snack-bar-container, simple-snack-bar, .toast, .toast-message, .alert, .swal2-popup, [role="alert"], mat-dialog-container, .mat-mdc-dialog-container, .mat-error, .text-danger')]
    .filter((e) => e.offsetParent !== null).map((e) => e.innerText.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' | ')).catch(() => '');
}
async function fecharAvisos() { for (const t of [/^\s*OK\s*$/i, /^\s*Fechar\s*$/i, /^\s*Entendi\s*$/i]) { const b = pg.locator('button:visible').filter({ hasText: t }).first(); if (await b.count()) await b.click({ timeout: 2000 }).catch(() => {}); } await pg.keyboard.press('Escape').catch(() => {}); }
/* Espera o portal terminar de carregar: sem spinner/overlay, rede parada e a tela sem mudar por ~1 s */
async function aguardarPortal(maxMs = 25000) {
  const fim = Date.now() + maxMs; let antes = '', iguais = 0;
  while (Date.now() < fim) {
    await redeQuieta(300, Math.max(400, Math.min(6000, fim - Date.now())));
    const r = await pg.evaluate(() => {
      const carregando = [...document.querySelectorAll('mat-spinner, mat-progress-spinner, mat-progress-bar, .spinner, .spinner-border, .loading, .loader, ngx-spinner, .ngx-spinner-overlay, .la-ball-fall, [class*="carregando"], [class*="loading"]')].some((e) => e.offsetParent !== null);
      const txt = document.body.innerText; const carregandoTxt = /\bCarregando\.\.\.|Aguarde/i.test(txt);
      return { carregando: carregando || carregandoTxt, assinatura: document.body.innerText.length + ':' + document.querySelectorAll('tr').length + ':' + location.pathname };
    }).catch(() => ({ carregando: false, assinatura: '' }));
    if (!r.carregando && r.assinatura === antes) { if (++iguais >= 1) return true; } else iguais = 0;
    antes = r.assinatura; await pausa(300);
  }
  if (maxMs >= 5000) console.log(`(lento) a tela não parou em ${Math.round(maxMs / 1000)} s em ${pg.url().replace(BASE, '')}`);
  return false;
}
/* Correções automáticas para bloqueios conhecidos do portal */
async function corrigirBloqueio(msg) {
  if (/MC4|conector/i.test(msg)) { // conector MC4 zerado ou faltando: põe a quantidade sugerida (mínimo 2 pares)
    await aguardarPortal();
    const rows = await linhas('MC4|CONECTOR');
    let mexi = false;
    for (const r of rows) if (!r.qtd) { await ajustarQtd(r.sku, Math.max(r.qtdSugerida || 0, 2)); mexi = true; }
    if (rows.length && !mexi) console.log('MC4 já estava na cotação: o aviso foi do carregamento, vou esperar e tentar de novo.');
    await aguardarPortal();
    if (!rows.length) { const add = pg.locator('button:visible, a:visible').filter({ hasText: /adicionar|incluir/i }).first(); if (await add.count()) await add.click({ timeout: 3000 }).catch(() => {}); }
    return rows.length > 0;
  }
  return false;
}
let ultimoAviso = '';
async function proximo() {
  const antes = pg.url();
  await aguardarPortal(); // nunca clica com a tela ainda carregando
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const b = botao(/^\s*PRÓXIMO\s*$/i);
    await b.waitFor({ state: 'visible', timeout: 20000 });
    for (let k = 0; k < 20 && (await b.isDisabled().catch(() => false)); k++) await pausa(500); // espera o botão liberar
    await b.click(); // UM clique; depois espera o portal responder antes de qualquer outra coisa
    await pg.waitForURL((u) => u.toString() !== antes, { timeout: 15000 }).catch(() => {});
    await aguardarPortal();
    if (pg.url() !== antes) return;
    const msg = await avisoPortal();
    if (!msg) return; // mesma URL mas sem aviso: telas da mesma página
    console.log('Portal avisou: ' + msg);
    ultimoAviso = msg;
    await fecharAvisos(); await pausa(1500);
    if (tentativa < 2 && (await corrigirBloqueio(msg))) { console.log('Tentando de novo com calma.'); await pausa(2000); continue; }
    const f = await printErro('bloqueio');
    throw new Error('O portal não deixou avançar: ' + msg.slice(0, 160) + (f ? ' · print salvo em ' + f : ''));
  }
}
async function semCookies() { const b = pg.locator('button:visible').filter({ hasText: /^\s*Rejeitar\s*$/i }).first(); if (await b.count()) await b.click().catch(() => {}); }
async function esperarLinhas(filtro, ms = 60000) { // o portal demora (~13 s para listar módulos): espera a tabela estabilizar
  const t0 = Date.now(); let antes = -1;
  while (Date.now() - t0 < ms) {
    const n = await pg.evaluate((f) => [...document.querySelectorAll('tr')].filter((r) => new RegExp(f, 'i').test(r.innerText) && /Código:/.test(r.innerText)).length, filtro);
    if (n > 0 && n === antes) return n; antes = n; await pausa(450);
  }
  return 0;
}
async function matSelect(seletor, texto) {
  if (!texto) return;
  const campo = typeof seletor === 'string' ? pg.locator(seletor).first() : seletor;
  await campo.click();
  const ops = pg.locator('mat-option'); await ops.first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  const op = ops.filter({ hasText: exato(texto) }).first();
  if (await op.count()) await op.click();
  else if (await ops.count()) await ops.first().click(); // opção pedida não existe: usa a 1ª do portal
  else await pg.keyboard.press('Escape');
  await ops.first().waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
  await aguardarPortal(6000);
}
const rx = (t) => new RegExp(String(t).replace(/[.*+?^${}()|[\]\\/]/g, '\\$&'), 'i');
async function listaCustom(rotulo, texto) { // listas da tela de estrutura (select comum, mat-select, ng-select ou lista própria)
  if (!texto) return true;
  const alvo = rx(texto);
  // 1) <select> comum que tenha a opção
  const sel = pg.locator('select:visible').filter({ has: pg.locator('option', { hasText: alvo }) }).first();
  if (await sel.count()) { const t = (await sel.locator('option', { hasText: alvo }).first().textContent()).trim(); await sel.selectOption({ label: t }); await pausa(900); return true; }
  // 2) abrir o campo logo depois do rótulo
  const rot = pg.getByText(rx(rotulo)).first();
  const campos = [rot.locator('xpath=following::*[self::mat-select or self::ng-select or @role="combobox" or @role="listbox" or contains(@class,"select") or contains(@class,"dropdown")][1]'), rot.locator('xpath=following-sibling::*[1]'), rot.locator('..')];
  for (const c of campos) {
    if (!(await c.count())) continue;
    await c.first().click({ timeout: 4000 }).catch(() => {}); await pausa(700);
    const op = pg.locator('mat-option, [role="option"], .ng-option, .dropdown-item, li, .option, .item').filter({ hasText: alvo }).locator('visible=true').first();
    if (await op.count()) { await op.click({ timeout: 4000 }).catch(() => {}); await aguardarPortal(5000); return true; }
    const folha = pg.getByText(alvo).locator('visible=true').last();
    if (await folha.count()) { await folha.click({ timeout: 4000 }).catch(() => {}); await aguardarPortal(5000); return true; }
    await pg.keyboard.press('Escape').catch(() => {});
  }
  console.log(`Não achei "${texto}" em "${rotulo}": seguindo com o que o portal sugeriu.`);
  return false;
}
/* Lista as opções de um campo da estrutura (select comum ou lista do Angular) sem escolher nada */
async function opcoesDe(rotulo) {
  const viaSelect = await pg.evaluate((r) => {
    const el = [...document.querySelectorAll('label, span, div, p, h4, h5')].find((x) => x.childElementCount < 3 && new RegExp(r, 'i').test(x.textContent || '') && (x.textContent || '').length < 60);
    if (!el) return null;
    let n = el; for (let k = 0; k < 4 && n; k++, n = n.parentElement) { const s = n.querySelector('select'); if (s) return [...s.options].map((o) => o.textContent.trim()).filter((t) => t && !/selecione/i.test(t)); }
    return null;
  }, rotulo).catch(() => null);
  if (viaSelect && viaSelect.length) return viaSelect;
  const rot = pg.getByText(rx(rotulo)).first(); if (!(await rot.count())) return [];
  const campo = rot.locator('xpath=following::*[self::mat-select or self::ng-select or @role="combobox"][1]');
  if (!(await campo.count())) return [];
  await campo.first().click({ timeout: 4000 }).catch(() => {}); await pausa(700);
  const ops = (await pg.locator('mat-option, [role="option"], .ng-option').locator('visible=true').allInnerTexts()).map((t) => t.trim()).filter((t) => t && !/selecione/i.test(t));
  await pg.keyboard.press('Escape').catch(() => {}); await pausa(300);
  return ops;
}
async function escolherPrimeira(rotulo, texto) { return (await listaCustom(rotulo, texto)) ? texto : null; }
/* Lista os "Detalhes da Estrutura" de três jeitos (o campo muda conforme o tipo de telha) */
async function listarDetalhes() {
  let ops = await opcoesDe('Detalhes da Estrutura');
  if (!ops.length) { // abre o campo logo depois do rótulo e lê o que aparecer
    const rot = pg.getByText(rx('Detalhes da Estrutura')).first();
    if (await rot.count()) {
      for (const c of [rot.locator('xpath=following-sibling::*[1]'), rot.locator('xpath=following::*[self::mat-select or self::select or @role="combobox" or contains(@class,"select")][1]'), rot.locator('..')]) {
        if (!(await c.count())) continue;
        await c.first().click({ timeout: 3000 }).catch(() => {}); await pausa(500);
        ops = (await pg.locator('mat-option, [role="option"], .ng-option, .dropdown-item, li.option').locator('visible=true').allInnerTexts().catch(() => [])).map((t) => t.trim()).filter((t) => t && t.length < 120 && !/selecione/i.test(t));
        if (!ops.length) ops = await pg.evaluate(() => [...document.querySelectorAll('*')].filter((e) => e.children.length === 0 && e.offsetParent !== null && /^Modelo /.test((e.innerText || '').trim())).map((e) => e.innerText.trim())).catch(() => []);
        await pg.keyboard.press('Escape').catch(() => {}); await pausa(250);
        if (ops.length) break;
      }
    }
  }
  return [...new Set(ops)];
}
/* HTML do formulário da etapa (sem scripts e estilos), para eu entender a tela quando der erro */
async function htmlDaTela(...ancoras) {
  return pg.evaluate((anc) => {
    const cands = [...document.querySelectorAll('form, section, mat-card, div')].filter((d) => anc.every((a) => (d.innerText || '').includes(a)));
    const el = cands.sort((a, b) => a.innerText.length - b.innerText.length)[0]; if (!el) return '';
    const c = el.cloneNode(true); c.querySelectorAll('script, style, svg, img, path').forEach((x) => x.remove());
    c.querySelectorAll('*').forEach((x) => { [...x.attributes].forEach((a) => { if (/^(style|_ngcontent|_nghost|data-)/.test(a.name)) x.removeAttribute(a.name); }); });
    c.querySelectorAll('input, select, textarea').forEach((x) => x.setAttribute('data-valor', x.value || ''));
    return c.outerHTML.replace(/\s+/g, ' ').slice(0, 20000);
  }, ancoras).catch(() => '');
}
async function printErro(nome) { try { const f = path.resolve('erros', `${new Date().toISOString().replace(/[:.]/g, '-')}-${nome}.png`); await import('node:fs').then((fs) => fs.mkdirSync(path.resolve('erros'), { recursive: true })); await pg.screenshot({ path: f, fullPage: true }); return f; } catch { return ''; } }
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

/* ---------- O que o próprio portal responde (o JSON que a tela usa): preços e listas exatas ----------
   Só leitura das respostas que o navegador já recebe. Nada é enviado ao portal além dos cliques da tela. */
const API = {}; // nome → { t, json, req }
const RX_API = /\/api\/(?:catalogo|carrinho)\/KitPersonalizado\/(Modulos|InversorFiltro|Inversor|TipoEstrutura|Estrutura|OutrosAC|Outros|Confirmar|AlterarCarrinho|BuscarCupons)\b/i;
pg.on('response', async (r) => {
  const m = r.url().match(RX_API); if (!m || r.request().method() === 'OPTIONS') return;
  let req = null; try { req = r.request().postDataJSON(); } catch { /* GET */ }
  let nome = m[1].toLowerCase(); if (nome === 'alterarcarrinho') nome = 'confirmar'; // os dois devolvem o carrinho inteiro
  if (/^(estrutura|outros|outrosac)$/.test(nome) && req && req.sugestao === 1) nome += ':sug';
  try { const json = await r.json(); if (json && json.isSucceed !== false) API[nome] = { t: Date.now(), json, req }; } catch { /* sem corpo */ }
});
let apiFunciona = true; // se a 1ª leitura (módulos) falhar, o portal mudou: as outras esperas ficam curtas e vale a tela
async function esperarApi(nome, desde, ms = 60000) { const fim = Date.now() + (apiFunciona ? ms : Math.min(ms, 2500)); while (Date.now() < fim) { const a = API[nome]; if (a && a.t >= desde) return a; await pausa(100); } return null; }
/* espera a resposta da API OU a tabela da tela (o que vier primeiro); com a tabela pronta, dá mais 3 s para a API */
async function apiOuTela(nome, desde, filtro, ms) {
  const pelaTela = (async () => { const n = await esperarLinhas(filtro, ms); return n ? esperarApi(nome, desde, 3000) : null; })();
  return Promise.race([esperarApi(nome, desde, ms), pelaTela]);
}
const dadosApi = (nome) => (API[nome] && API[nome].json && API[nome].json.data) || null;
const r2 = (v) => Math.round(v * 100) / 100;
/* "índice" das listas do portal = preço de lista × fator (≈ 3,33 em 08/11/2026). O fator é conferido a cada
   confirmação (índice ÷ preço do inversor no carrinho), então o preço estimado das listas acompanha o portal. */
let FATOR = 3.3307;
let ESTR = null; // tipos de estrutura e detalhes exatos (API TipoEstrutura) da cotação em andamento
let AVISOS = []; // avisos desta cotação (vão para o sistema junto com o kit)
let CUPONS = { em: 0, lista: [] };
const semAcento = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
const ALIAS_TIPO = { 'telha metalico': 'telha metalica', metalico: 'telha metalica', metalica: 'telha metalica', ceramico: 'colonial', ceramica: 'colonial', fibrocimento: 'telha fibrocimento', shingle: 'telha shingle' };
const chaveTipo = (t) => { const x = semAcento(t); return ALIAS_TIPO[x] || x; };
function estruturasDaApi() {
  const d = dadosApi('tipoestrutura'); if (!d || !Array.isArray(d.listTipos) || !d.listTipos.length) return null;
  const est = {};
  for (const t of [...d.listTipos].sort((a, b) => (a.ordem || 0) - (b.ordem || 0))) {
    est[String(t.grupo || '').replace(/\s+/g, ' ').trim()] = [...(t.subGrupo || [])].sort((a, b) => (a.ordem || 0) - (b.ordem || 0)).map((x) => String(x.subGrupo || '').replace(/\s+/g, ' ').trim()).filter(Boolean);
  }
  return est;
}
/* Listas da tela de estrutura (componente "combo" do portal): abre, escolhe pelo texto (sem acento/caixa) e confere */
async function combo(seletor, alvo, igual = (a, b) => a === b) {
  const caixa = pg.locator(seletor).first(); if (!(await caixa.count())) return null;
  const campo = caixa.locator('.form-control').first();
  for (let t = 0; t < 3; t++) {
    const ops = caixa.locator('.combo-option');
    if (!(await ops.first().isVisible().catch(() => false))) { await campo.click({ timeout: 5000 }).catch(() => {}); await ops.first().waitFor({ state: 'visible', timeout: 3000 }).catch(() => {}); }
    const textos = (await ops.allInnerTexts().catch(() => [])).map((x) => x.replace(/\s+/g, ' ').trim());
    if (!textos.length) continue;
    let i = textos.findIndex((x) => igual(semAcento(x), semAcento(alvo)));
    if (i < 0) i = textos.findIndex((x) => semAcento(x).startsWith(semAcento(alvo)));
    if (i < 0) { await pg.keyboard.press('Escape').catch(() => {}); return { achou: false, opcoes: textos }; }
    await ops.nth(i).click({ timeout: 4000 }).catch(() => {}); await pausa(350);
    const agora = (await campo.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
    if (semAcento(agora) === semAcento(textos[i])) return { achou: true, texto: textos[i], opcoes: textos };
  }
  return { achou: false, opcoes: [] };
}
/* Ao voltar da confirmação o arranjo fica travado ("desabilitado") até clicar em MODIFICAR LAYOUT.
   A tela demora a montar: espera o campo e o botão, clica e confere que destravou. */
async function liberarLayout(ms = 12000) {
  const campo = pg.locator('app-tipo-de-estrutura .form-control').first();
  const travado = async () => /desabilitado/.test((await campo.getAttribute('class').catch(() => '')) || '');
  const fim = Date.now() + ms;
  while (Date.now() < fim) {
    if (!(await campo.count())) { await pausa(300); continue; }
    if (!(await travado())) return true;
    const b = botao(/MODIFICAR LAYOUT/i);
    if (await b.count()) { await b.click({ timeout: 4000 }).catch(() => {}); await pausa(700); } else await pausa(400);
  }
  return (await campo.count()) > 0 && !(await travado());
}
/* Microinversor com cabo próprio (ex.: Hoymiles/Enphase): na tela de componentes CC o portal pede
   "Tipo de conexão" e "Tensão de atendimento" e só lista os itens depois do FILTRAR (mapeado em 08/11/2026). */
async function preencherFiltroCC() {
  if (!(await pg.getByText(/Tipo d[oe] conex[aã]o/i).count().catch(() => 0))) return false;
  const sels = pg.locator('mat-select:visible'), n = await sels.count();
  const escolhidos = [];
  for (let i = 0; i < n; i++) {
    const s0 = sels.nth(i);
    if (!(await s0.evaluate((e) => e.classList.contains('mat-select-empty')).catch(() => true))) continue;
    await s0.click({ timeout: 5000 }).catch(() => {});
    const ops = pg.locator('mat-option'); await ops.first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    const textos = (await ops.allInnerTexts().catch(() => [])).map((t) => t.trim());
    let k = textos.findIndex((t) => /mono/i.test(t)); if (k < 0) k = textos.findIndex((t) => /127\s*\/\s*220/.test(t)); if (k < 0) k = textos.findIndex((t) => /220/.test(t)); if (k < 0) k = 0;
    if (textos.length) { await ops.nth(k).click({ timeout: 4000 }).catch(() => {}); escolhidos.push(textos[k]); } else await pg.keyboard.press('Escape').catch(() => {});
    await aguardarPortal(5000);
  }
  const f = botao(/^\s*FILTRAR\s*$/i);
  if (await f.count()) { await f.click({ timeout: 8000 }).catch(() => {}); await esperarLinhas('.', 25000).catch(() => {}); }
  AVISOS.push(`Microinversor com cabo próprio: o robô escolheu ${escolhidos.join(' · ') || 'a conexão padrão'} na tela de componentes CC (confira no portal).`);
  console.log('Componentes CC do micro: ' + (escolhidos.join(' · ') || 'padrão'));
  return true;
}
async function fecharModal() {
  const x = pg.locator('mat-dialog-container button, mat-dialog-container mat-icon').filter({ hasText: /^\s*close\s*$/i }).first();
  if (await x.count()) await x.click({ timeout: 2000 }).catch(() => {});
  await pg.keyboard.press('Escape').catch(() => {}); await pausa(300);
}
/* Cupons da conta (2× por dia): lê a lista do botão "Ver cupons" da confirmação e fecha. Não aplica nada. */
async function conferirCupons() {
  if (Date.now() - CUPONS.em < 12 * 3600e3) return;
  try {
    const b = botao(/^\s*Ver cupons/i); if (!(await b.count())) return;
    const t0 = Date.now(); await b.click({ timeout: 4000 });
    const a = await esperarApi('buscarcupons', t0, 8000);
    if (a) CUPONS = { em: Date.now(), lista: (a.json.data || []).map((c) => ({ nome: String(c.nome || c.descricao || 'Cupom').slice(0, 60), valor: +c.valor || 0, validade: c.validade || null, usado: !!c.cupomUtilizado, habilitado: c.habilitado !== false, limitePct: +c.descontoLimite || null, primeiraCompra: !!c.primeiraCompra })) };
    await fecharModal();
    const validos = CUPONS.lista.filter((c) => !c.usado && c.habilitado && (!c.validade || new Date(c.validade) >= new Date(new Date().toDateString())));
    if (validos.length) console.log(`Cupons válidos na Belenergy: ${validos.map((c) => `${c.nome} R$ ${c.valor.toFixed(2)} até ${String(c.validade || '').slice(0, 10)}`).join(' · ')}`);
  } catch (err) { console.log('Não consegui ler os cupons: ' + String(err.message || err).slice(0, 100)); await fecharModal(); }
}
const cuponsValidos = () => CUPONS.lista.filter((c) => !c.usado && c.habilitado && (!c.validade || new Date(c.validade) >= new Date(new Date().toDateString())));

/* ---------- etapas (mesma numeração do sistema) ---------- */
const NOMES = ['potência', 'módulo', 'inversor', 'estrutura', 'itens da estrutura', 'elétricos CC', 'elétricos CA', 'confirmação'];
NOMES[30] = 'voltar para a estrutura';
async function passo(etapa, e = {}) {
  ultimoAviso = ''; const t0 = Date.now();
  try { const r = await passoInterno(etapa, e); const ms = Date.now() - t0; console.log(`Etapa ${etapa} pronta em ${(ms / 1000).toFixed(1)} s`); return { ...r, ms }; }
  catch (err) {
    console.error(err);
    const f = await printErro('etapa-' + etapa);
    const msg = String(err.message || err).split('\n')[0].replace(/\u001b\[\d+m/g, '').slice(0, 220);
    const x = new Error(`Robô parou na etapa "${NOMES[etapa] || etapa}" do portal: ${msg}${f ? ' · print salvo em ' + f : ''}`);
    x.diag = await diagnostico(etapa, e, msg);
    if (err.html) x.diag.html = err.html;
    throw x;
  }
}
/* Tudo o que ajuda a entender o erro sem estar olhando a tela (vai para o sistema e fica em erros/ultimo-erro.json) */
async function diagnostico(etapa, entrada, msg) {
  const d = { etapa, nomeEtapa: NOMES[etapa] || String(etapa), mensagem: msg, aviso: ultimoAviso, url: pg.url(), em: new Date().toISOString(), entrada, versao: VERSAO };
  try { d.html = await htmlDaTela(...({ 2: ['FILTRAR'], 3: ['Tipo de estrutura'], 4: ['PRÓXIMO'], 5: ['PRÓXIMO'], 6: ['PRÓXIMO'], 7: ['Valor'] }[etapa] || ['PRÓXIMO'])); } catch { /* */ }
  try { d.avisosNaTela = await avisoPortal(); } catch { /* */ }
  try { d.linhas = (await linhas('Código:')).slice(0, 40).map((r) => ({ sku: r.sku, nome: r.nome.slice(0, 80), qtd: r.qtd, sugerida: r.qtdSugerida })); } catch { /* */ }
  try { d.botoes = (await pg.locator('button:visible').allInnerTexts()).map((x) => x.trim()).filter(Boolean).slice(0, 30); } catch { /* */ }
  try { d.tela = (await pg.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').slice(0, 2500); } catch { /* */ }
  try { d.api = Object.fromEntries(Object.entries(API).map(([k, v]) => [k, new Date(v.t).toISOString()])); } catch { /* */ }
  try { d.print = (await pg.screenshot({ type: 'jpeg', quality: 45 })).toString('base64'); } catch { /* */ }
  try { const fs = await import('node:fs'); fs.mkdirSync(path.resolve('erros'), { recursive: true }); fs.writeFileSync(path.resolve('erros', 'ultimo-erro.json'), JSON.stringify({ ...d, print: undefined }, null, 2)); } catch { /* */ }
  return d;
}
const nomeInversor = (n) => String(n || '').replace(/^INVERSOR DE CORRENTE\s*/i, 'Inversor ');
const tipoInv = (n) => (/H[IÍ]BRID/i.test(n) ? 'hibrido' : /MICRO/i.test(n) ? 'micro' : 'string');
async function passoInterno(etapa, e = {}) {
  if (!(await logado())) throw new Error('A sessão da Belenergy expirou: faça login na janela do robô e tente de novo.');
  if (etapa === 0) {
    AVISOS = []; ESTR = null;
    await pg.goto(BASE + '/energy/escolha-metodo'); await aguardarPortal(10000);
    await semCookies();
    // "ESCOLHER" do Convencional (o 1º da tela)
    await pg.locator('button:visible').filter({ hasText: /^\s*escolher\s*$/i }).first().click();
    await pg.locator('#inputPotencia').waitFor({ timeout: 30000 });
    await pg.locator('#inputPotencia').fill(String(e.kwp).replace(',', '.'));
    const t0 = Date.now();
    await pg.locator('button:enabled').filter({ hasText: 'navigate_next' }).first().click();
    const a = await apiOuTela('modulos', t0, 'MODULO', 90000); // o portal leva ~10 s para montar a lista
    apiFunciona = !!a; if (!a) console.log('Não li a resposta da API de módulos: seguindo pela tela.');
    const d = a && a.json.data;
    if (d && Array.isArray(d.modulos) && d.modulos.length) {
      await esperarLinhas('MODULO', 20000); // a tabela precisa estar na tela para marcar o módulo depois
      const mods = d.modulos.map((m) => { const w = +m.potencia || 0, q = +m.numeroModulos || 0; return { sku: m.item, nome: String(m.descricaoItem || '').replace(/^MODULO\s*/i, ''), fabricante: m.fabricante || '', potenciaW: w, qtdSugerida: q, kwp: r2((q * w) / 1000), indice: +m.index || null, precoUnEst: m.index && w ? r2((m.index * w) / FATOR) : null, tipoCelula: m.tipoCelula || '', eficiencia: +m.eficiencia || null }; })
        .filter((m) => m.sku && m.potenciaW > 0).sort((x, y) => (x.indice ?? 9e9) - (y.indice ?? 9e9)); // = "Menor Preço Por Watt"
      return { etapa: 1, opcoes: { modulos: mods, fonte: 'api' } };
    }
    // sem a resposta da API: jeito antigo, pela tabela da tela
    if (!(await esperarLinhas('MODULO'))) throw new Error('o portal não listou módulos para ' + e.kwp + ' kWp');
    await pg.locator('select').filter({ hasText: 'Menor Preço Por Watt' }).first().selectOption({ label: 'Menor Preço Por Watt' }).catch(() => {});
    await aguardarPortal(8000); await esperarLinhas('MODULO', 15000);
    const mods = (await linhas('MODULO')).map((m) => ({ sku: m.sku, nome: m.nome.replace(/^MODULO\s*/i, ''), potenciaW: num(m.potencia) || num((m.nome.match(/(\d{3,4})W/) || [])[1]), qtdSugerida: m.qtdSugerida || m.qtd }));
    return { etapa: 1, opcoes: { modulos: mods.map((m) => ({ ...m, kwp: Math.round(m.qtdSugerida * m.potenciaW / 10) / 100 })), fonte: 'tela' } };
  }
  if (etapa === 1) {
    const linha = pg.locator('tr').filter({ hasText: 'Código: ' + e.moduloSku }).first();
    if (e.moduloQtd) await ajustarQtd(e.moduloSku, +e.moduloQtd);
    await linha.locator('input[type=radio]').first().check({ force: true }); await pausa(400);
    const t1 = Date.now(); await proximo();
    const f = await esperarApi('inversorfiltro', t1, 20000);
    const d = f && f.json.data;
    if (d && Array.isArray(d.listTipoInversor) && d.listTipoInversor.length) {
      const tipos = [...d.listTipoInversor].sort((a, b) => (a.ordem || 0) - (b.ordem || 0)).map((x) => String(x.tipoInversor || '').toUpperCase()).filter(Boolean);
      return { etapa: 2, opcoes: { tipos, ligacoes: ['MONOFÁSICO', 'BIFÁSICO', 'TRIFÁSICO'], tensoes: {}, fabricantes: (d.listFabricante || []).map((x) => x.fabricante).filter(Boolean), inversores: null } };
    }
    const opcoes = async (fc) => { await pg.locator(`mat-select[formcontrolname="${fc}"]`).click(); await pg.locator('mat-option').first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {}); const t = await pg.locator('mat-option').allInnerTexts(); await pg.keyboard.press('Escape'); await pausa(200); return t.map((x) => x.trim()); };
    return { etapa: 2, opcoes: { tipos: await opcoes('tipoInversor'), ligacoes: ['MONOFÁSICO', 'BIFÁSICO', 'TRIFÁSICO'], tensoes: {}, fabricantes: (await pg.locator('ng-multiselect-dropdown li').allInnerTexts()).map((x) => x.trim()).filter((x) => x && !/Marcar Todos/i.test(x)), inversores: null } };
  }
  if (etapa === 2 && e.filtrar) {
    await aguardarPortal(8000);
    await matSelect('mat-select[formcontrolname="tipoInversor"]', e.tipoInversor);
    await matSelect('mat-select[formcontrolname="tipoLigacao"]', e.ligacao);
    await pg.locator('mat-select[formcontrolname="tensaoNominal"]').click(); await pausa(600);
    const tensoes = (await pg.locator('mat-option').allInnerTexts()).map((x) => x.trim());
    await pg.locator('mat-option').filter({ hasText: e.tensao && tensoes.includes(e.tensao) ? e.tensao : tensoes[0] }).first().click(); await aguardarPortal(6000);
    if (e.fabricantes && e.fabricantes.length) {
      await pg.locator('ng-multiselect-dropdown .dropdown-btn').click(); await pausa(500);
      for (let k = 0; k < 20 && (await pg.locator('ng-multiselect-dropdown li').filter({ hasText: /Não há fabricantes/i }).count()); k++) await pausa(500);
      for (const f of e.fabricantes) { const li = pg.locator('ng-multiselect-dropdown li').filter({ hasText: new RegExp('^\\s*' + f + '\\s*$', 'i') }); if (await li.count()) await li.first().click(); }
      await pg.locator('body').click({ position: { x: 5, y: 5 } }); await pausa(400);
    }
    await aguardarPortal(6000);
    let tf = Date.now(); await botao(/FILTRAR/i).click({ timeout: 15000 });
    let a = await apiOuTela('inversor', tf, 'INVERSOR|MICRO', 90000);
    if (!a && !(await esperarLinhas('INVERSOR|MICRO', 5000).catch(() => 0))) { // sistemas grandes demoram: filtra de novo uma vez
      await aguardarPortal(20000); tf = Date.now(); await botao(/FILTRAR/i).click({ timeout: 15000 }).catch(() => {}); a = await apiOuTela('inversor', tf, 'INVERSOR|MICRO', 90000);
    }
    await esperarLinhas('INVERSOR|MICRO', a ? 15000 : 90000).catch(() => 0);
    let invs;
    const d = a && a.json.data, kwpSis = +(a && a.req && a.req.potenciaProjeto) || 0;
    if (d && Array.isArray(d.inversores) && d.inversores.length) {
      invs = d.inversores.map((v) => { const n = +v.numInversores || 1, kwU = +v.potenciaNominalSaida || 0, kwT = kwU * n; return { sku: v.item, nome: nomeInversor(v.descricaoItem), potenciaKw: r2(kwT), potenciaUnKw: kwU, qtd: n, overload: kwT && kwpSis ? r2((kwpSis / kwT - 1) * 100) : 0, indice: +v.index || null, precoEst: v.index ? r2(v.index / FATOR) : null, tipo: tipoInv(v.descricaoItem || v.tipoInversor), fabricante: v.fabricante || '', maxEntradaKw: r2((+v.maxPotenciaEntrada || 0) * n), mppts: +v.numMPPTs || null }; });
      // a % de overload da tela é a referência (se a conta divergir, fica a da tela)
      const tela = await linhas('INVERSOR|MICRO').catch(() => []);
      for (const v of invs) { const t = tela.find((x) => x.sku === v.sku); if (t && t.overload != null && t.overload !== undefined && String(t.overload).trim() !== '') v.overload = num(t.overload); }
    } else {
      invs = (await linhas('INVERSOR|MICRO')).map((v) => { const kwU = parseFloat(String((v.nome.match(/(\d+(?:[.,]\d+)?)\s*KW/i) || [])[1] || '0').replace(',', '.')) || 0, n = v.qtdSugerida || 1; return { sku: v.sku, nome: nomeInversor(v.nome), potenciaKw: r2(kwU * n), potenciaUnKw: kwU, qtd: n, overload: num(v.overload), tipo: tipoInv(v.nome), fabricante: (v.nome.match(/(AUXSOL|DEYE|GROWATT|HUAWEI|SOLIS|SUNGROW|HOYMILES|TSUNESS|ENPHASE|FOX ?ESS|SAJ)/i) || [])[1] || '' }; });
    }
    return { etapa: 2, opcoes: { tipos: [e.tipoInversor], ligacoes: [e.ligacao], tensoes: { [e.ligacao]: tensoes }, fabricantes: [], inversores: invs } };
  }
  if (etapa === 2) {
    await pg.locator('tr').filter({ hasText: 'Código: ' + e.inversorSku }).first().locator('input[type=checkbox]').check({ force: true }); await pausa(400);
    const t2 = Date.now(); await proximo();
    await esperarApi('tipoestrutura', t2, 20000);
    ESTR = estruturasDaApi();
    if (!ESTR) { // jeito antigo: abre a lista de tipos e lê os nomes
      const tipos = [];
      await pg.locator('app-tipo-de-estrutura .form-control').first().click().catch(() => {}); await pausa(600);
      for (const t of await pg.locator('app-tipo-de-estrutura .combo-option').allInnerTexts().catch(() => [])) if (t.trim()) tipos.push(t.replace(/\s+/g, ' ').trim());
      await pg.keyboard.press('Escape').catch(() => {});
      return { etapa: 3, opcoes: { estruturas: Object.fromEntries(tipos.map((t) => [t, []])), orientacoes: ['Retrato', 'Paisagem'], sugestao: { linhas: 1, modulosPorLinha: 0 }, detalhesSobDemanda: true } };
    }
    return { etapa: 3, opcoes: { estruturas: ESTR, orientacoes: ['Retrato', 'Paisagem'], sugestao: { linhas: 1, modulosPorLinha: 0 }, detalhesSobDemanda: false } };
  }
  if (etapa === 30) { // mesmo módulo e inversor, outra estrutura: volta da confirmação até a estrutura
    if (!/\/energy\/confirmar/.test(pg.url())) throw new Error('não estou na confirmação de uma cotação para reaproveitar');
    const comps = ((((dadosApi('confirmar') || {}).itens || [])[0] || {}).componentes) || [];
    const mod = comps.find((c) => c.tipoKitMontado === 'modulo');
    if (e.moduloSku && (!mod || mod.sku !== e.moduloSku || (+e.moduloQtd && +mod.quantidade !== +e.moduloQtd))) throw new Error('o kit da tela não é o mesmo da cotação anterior');
    if (e.inversorSku && !comps.some((c) => c.tipoKitMontado === 'inversor' && c.sku === e.inversorSku)) throw new Error('o inversor da tela não é o mesmo da cotação anterior');
    AVISOS = []; const tVolta = Date.now();
    for (let k = 0; k < 4 && !/\/energy\/estrutura/.test(pg.url()); k++) {
      const antes = pg.url(); await aguardarPortal(6000);
      await botao(/^\s*voltar\s*$/i).click({ timeout: 8000 });
      await pg.waitForURL((u) => u.toString() !== antes, { timeout: 10000 }).catch(() => {});
    }
    if (!/\/energy\/estrutura/.test(pg.url())) throw new Error('não consegui voltar para a tela de estrutura');
    await esperarApi('tipoestrutura', tVolta, 15000); // a tela recarrega os tipos ao voltar
    if (!(await liberarLayout(15000))) throw new Error('o arranjo ficou travado (não consegui clicar em "Modificar layout")');
    return { etapa: 3, opcoes: { estruturas: ESTR || {}, orientacoes: ['Retrato', 'Paisagem'], sugestao: { linhas: 1, modulosPorLinha: 0 }, detalhesSobDemanda: !ESTR } };
  }
  if (etapa === 3) {
    if (e.semEstrutura) { await pg.getByText(exato('Sem Estrutura')).click(); await pausa(800); return { etapa: 4, opcoes: { itens: [] } }; }
    // voltou da confirmação: o arranjo fica travado até "MODIFICAR LAYOUT"
    if (!(await liberarLayout(12000))) throw new Error('o arranjo ficou travado (não consegui clicar em "Modificar layout")');
    const tipos = Object.keys(ESTR || {});
    const tipoPortal = tipos.find((t) => chaveTipo(t) === chaveTipo(e.estruturaTipo)) || e.estruturaTipo;
    if (tipos.length && !tipos.some((t) => chaveTipo(t) === chaveTipo(e.estruturaTipo))) throw new Error(`o portal não tem a estrutura "${e.estruturaTipo}" (tem: ${tipos.join(', ')})`);
    const rt = await combo('app-tipo-de-estrutura', tipoPortal, (a, b) => chaveTipo(a) === chaveTipo(b));
    let tipoUsado = rt && rt.achou ? rt.texto : null;
    if (!tipoUsado) { // tela diferente da mapeada: jeito antigo
      if (!(await listaCustom('Tipo de estrutura', tipoPortal))) throw new Error(`não consegui escolher a estrutura "${e.estruturaTipo}"${rt && rt.opcoes && rt.opcoes.length ? ' (a tela tem: ' + rt.opcoes.join(', ') + ')' : ''}`);
      tipoUsado = tipoPortal;
    }
    await aguardarPortal(6000);
    const detalhes = ESTR && ESTR[tipoPortal] && ESTR[tipoPortal].length ? ESTR[tipoPortal] : await listarDetalhes();
    // fixação pedida primeiro; se o "Calcular" não liberar, tenta as próximas (e avisa: muda o preço)
    const fila = [...new Set([e.estruturaDetalhe, ...detalhes].filter(Boolean))].slice(0, 4);
    const preencher = async () => {
      await pg.locator('#numero-linhas').first().fill(String(e.linhas)); await pg.locator('#modulos-linha').first().fill(String(e.modulosPorLinha));
      await matSelect('#tipo-orientacao', e.orientacao || 'Retrato');
    };
    const calc = botao(/CALCULAR ESTRUTURA/i), liberou = async (ms) => { for (let k = 0; k < ms / 250 && (await calc.isDisabled().catch(() => false)); k++) await pausa(250); return !(await calc.isDisabled().catch(() => false)); };
    let detalheUsado = null;
    if (!fila.length) await preencher();
    for (const d of fila) {
      const rd = await combo('app-detalhes-estrutura', d);
      if (rd && rd.achou) detalheUsado = rd.texto; else if (await listaCustom('Detalhes da Estrutura', d)) detalheUsado = d;
      await preencher();
      if (await liberou(4000)) break;
      console.log(`"Calcular estrutura" não liberou com "${d}": tentando outra opção.`); detalheUsado = null;
    }
    if (detalheUsado) console.log('Estrutura: ' + tipoUsado + ' · ' + detalheUsado);
    if (e.estruturaDetalhe && detalheUsado && semAcento(detalheUsado) !== semAcento(e.estruturaDetalhe)) AVISOS.push(`A fixação pedida (${e.estruturaDetalhe}) não liberou no portal: foi cotado com "${detalheUsado}".`);
    if (!(await liberou(3000))) {
      const x = new Error(`o portal não liberou "Calcular estrutura" para ${e.estruturaTipo}${detalhes.length ? ` (detalhes do portal: ${detalhes.join(' / ')})` : ' (não achei a lista de detalhes)'} com ${e.linhas} linha(s) de ${e.modulosPorLinha}`);
      x.html = await htmlDaTela('Tipo de estrutura', 'Módulos por linha'); throw x;
    }
    const tc = Date.now(); await calc.click({ timeout: 10000 });
    const a = await apiOuTela('estrutura:sug', tc, '.', 45000);
    await esperarLinhas('.', a ? 10000 : 45000);
    return { etapa: 4, opcoes: { detalhes, detalheUsado, tipoUsado, itens: (await linhas('Código:')).map((x) => ({ sku: x.sku, nome: x.nome, qtd: x.qtd })) } };
  }
  if (etapa === 4 || etapa === 5) {
    await aguardarPortal(); await ajustarItens(e.itens);
    const tp = Date.now(); await proximo();
    if (etapa === 4) await preencherFiltroCC(); // micro com cabo próprio: escolhe conexão e tensão e filtra
    const a = await esperarApi(etapa === 4 ? 'outros:sug' : 'outrosac:sug', tp, 20000);
    await esperarLinhas('.', a ? 6000 : 20000).catch(() => {});
    return { etapa: etapa + 1, opcoes: { itens: (await linhas('Código:')).map((x) => ({ sku: x.sku, nome: x.nome, qtd: x.qtd })) } };
  }
  if (etapa === 6) {
    await aguardarPortal(); await ajustarItens(e.itens);
    let tp = Date.now(); await proximo();
    let a = await esperarApi('confirmar', tp, 25000);
    // garantia: se ainda estiver nos componentes CA (portal não trocou de tela), avança mais uma vez
    if (!/Valor d[ao]s? (?:proposta|produtos)|Nome da proposta/i.test(await pg.evaluate(() => document.body.innerText))) { console.log('Ainda nos componentes CA: tentando avançar de novo.'); await pausa(2000); tp = Date.now(); await proximo(); a = await esperarApi('confirmar', tp, 25000); }
    await aguardarPortal(8000);
    const t = await pg.evaluate(() => document.body.innerText);
    const cart = a && a.json.data;
    return { etapa: 7, opcoes: { fretes: ['Cliente Retira', 'Transportadora escolhida pelo cliente', 'Belenus Entrega no Cliente'], pagamentos: ['Plano de Pagamento', 'Outras Formas de Pagamento'], valorProdutos: (cart && +cart.totalProdutos) || num((t.match(/Valor dos produtos:\s*R\$\s*([\d.,]+)/) || [])[1]) } };
  }
  if (etapa === 7) {
    // cada campo com espera curta: o que não existir na tela é pulado na hora
    const escolher = async (texto) => {
      if (!texto) return;
      const sel = pg.locator('select').filter({ has: pg.locator('option', { hasText: rx(texto) }) }).first();
      if (!(await sel.count())) { console.log('Sem a opção "' + texto + '" na confirmação: mantido o padrão do portal.'); return; }
      const rot = (await sel.locator('option', { hasText: rx(texto) }).first().textContent({ timeout: 3000 }) || '').trim();
      if ((await sel.evaluate((s) => (s.options[s.selectedIndex] || {}).text || '').catch(() => '')).trim() === rot) return; // já está escolhido
      await sel.selectOption({ label: rot }, { timeout: 5000 }).catch(() => {}); await aguardarPortal(6000);
    };
    const nome = pg.getByText('Nome da proposta:', { exact: false }).locator('xpath=following::input[1]');
    if (e.nome && (await nome.count())) await nome.fill(e.nome, { timeout: 3000 }).catch(() => {});
    await escolher(e.estadoEntrega); await escolher(e.cidadeEntrega); await escolher(e.frete);
    await aguardarPortal(10000);
    if (e.pagamento && /Outras/.test(e.pagamento)) await pg.getByText('Outras Formas de Pagamento').first().click({ timeout: 3000 }).catch(() => {});
    await pausa(500);
    await conferirCupons();
    let t = await pg.evaluate(() => document.body.innerText);
    const valorTela = num((t.match(/Valor da proposta:\s*R\$\s*([\d.,]+)/) || t.match(/(?:Valor total|Total da proposta|Total geral)[^R]{0,20}R\$\s*([\d.,]+)/i) || [])[1]);
    const produtosTela = num((t.match(/Valor dos produtos:\s*R\$\s*([\d.,]+)/) || [])[1]);
    // carrinho do portal (mesmo JSON da tela): preço de cada item, desconto do kit, frete
    const cart = dadosApi('confirmar');
    const kit = cart && Array.isArray(cart.itens) ? cart.itens[0] || {} : {};
    const comps = Array.isArray(kit.componentes) ? kit.componentes : [];
    const itensPreco = comps.map((c) => ({ sku: c.sku, nome: String(c.descricaoProduto || '').slice(0, 120), tipo: c.tipoKitMontado || '', qtd: +c.quantidade || 0, precoBruto: +c.precoBruto || 0 })).filter((c) => c.sku);
    const bruto = +kit.precoBruto || itensPreco.reduce((s2, c) => s2 + c.precoBruto * c.qtd, 0);
    const descontoKit = bruto && +kit.totalItem ? Math.round((1 - kit.totalItem / bruto) * 10000) / 10000 : null;
    const produtosApi = cart ? +(cart.totalProdutos ?? cart.totalSemFrete) || 0 : 0;
    let freteApi = 0; try { const fr = cart && (typeof cart.frete === 'string' ? JSON.parse(cart.frete) : cart.frete); freteApi = +(fr && fr.valorFrete) || 0; } catch { /* */ }
    const iv = comps.find((c) => c.tipoKitMontado === 'inversor' && +c.index > 0 && +c.precoBruto > 0);
    if (iv) { const f = iv.index / iv.precoBruto; if (f > 1 && f < 10) FATOR = f; }
    const produtos = produtosTela || produtosApi;
    const valor = valorTela || (produtosApi ? produtosApi + freteApi : 0);
    if (valorTela && produtosApi && Math.abs(valorTela - (produtosApi + freteApi)) > Math.max(2, valorTela * 0.01)) AVISOS.push(`Valor da tela (R$ ${valorTela.toFixed(2)}) diferente do carrinho do portal (R$ ${(produtosApi + freteApi).toFixed(2)}): confira no portal.`);
    if (cart && (+cart.acrescimoPlanoDePagamento > 0)) AVISOS.push(`O plano de pagamento do portal tem acréscimo de R$ ${(+cart.acrescimoPlanoDePagamento).toFixed(2)}.`);
    let numero = 'não salvo', pdf = null, diagSalvar = null;
    const fs = await import('node:fs');
    const guardarPdf = async (acao, nomeArq) => {
      const [d] = await Promise.all([pg.waitForEvent('download', { timeout: 45000 }), acao()]);
      fs.mkdirSync(path.resolve('propostas-belenergy'), { recursive: true });
      const destino = path.resolve('propostas-belenergy', nomeArq); await d.saveAs(destino);
      const buf = fs.readFileSync(destino); console.log('PDF salvo em ' + destino);
      return buf.length < 4e6 ? { nome: nomeArq, base64: buf.toString('base64') } : null;
    };
    if (e.salvar) { // só com a caixa "Salvar na Belenergy" marcada pelo vendedor
      // 1) forma de pagamento: sem ela o portal não deixa salvar. Abre "Formas de pagamento" e escolhe Pix (mesmo preço, conferido em 08/11/2026).
      const pagTxt = async () => pg.evaluate(() => document.body.innerText);
      if (!/Forma de pagamento:\s*\n?\s*(Pix|Boleto|Financiamento|Cart)/i.test(await pagTxt())) {
        const abrir = pg.getByText(/Outras formas de pagamento|Forma de pagamento/i).last();
        await abrir.click({ timeout: 5000 }).catch(() => {}); await pausa(900);
        const modal = pg.locator('text=Formas de pagamento:').first();
        if (await modal.count()) {
          await pg.getByText(/^\s*Pix\s*$/i).first().click({ timeout: 5000 }).catch(() => {}); await pausa(1200); await aguardarPortal(8000);
          const conf = pg.getByRole('button', { name: /Confirmar|Selecionar|Aplicar|Continuar|Escolher|Usar/i }).first();
          if (await conf.count() && await conf.isVisible().catch(() => false)) { await conf.click({ timeout: 4000 }).catch(() => {}); await pausa(800); }
          if (await pg.locator('text=Formas de pagamento:').first().isVisible().catch(() => false)) await pg.getByRole('button', { name: /^\s*Fechar\s*$/i }).first().click({ timeout: 3000 }).catch(() => {});
          await pausa(600); console.log('Forma de pagamento escolhida: Pix');
        }
      }
      // 2) PDF antes de salvar (depois de salvar o portal vai para "Meus orçamentos")
      try { const bp = botao(/Baixar PDF|Gerar PDF|Download PDF|Baixar proposta/i); if (await bp.count()) pdf = await guardarPdf(() => bp.click(), 'cotacao-' + Date.now() + '.pdf'); }
      catch (err) { console.log('PDF antes de salvar não veio: ' + String(err.message || err).slice(0, 100)); }
      // 3) salvar e achar o número WEB em "Meus orçamentos" (cartão com o nome da proposta)
      const antesSalvar = await pagTxt();
      await botao(/^\s*Salvar\s*$/i).click(); await aguardarPortal(20000); await pausa(1500);
      let achado = null;
      for (let k = 0; k < 16 && !achado; k++) {
        const t2 = (await pagTxt()) + ' ' + (await avisoPortal()) + ' ' + pg.url();
        if (/Meus or[çc]amentos/i.test(t2)) {
          achado = await pg.evaluate((nome) => { // cartões: "nome · WEB-0071… · Total"
            const nos = [...document.querySelectorAll('div')].filter((d) => /WEB-\d{5,}/.test(d.innerText || '') && (d.innerText || '').length < 400);
            const alvo = nos.filter((d) => !nome || (d.innerText || '').toLowerCase().includes(String(nome).toLowerCase().slice(0, 18))).sort((a, b) => (a.innerText || '').length - (b.innerText || '').length)[0] || nos[0];
            if (!alvo) return null; alvo.setAttribute('data-robo-card', '1'); const m = alvo.innerText.match(/WEB-(\d{5,})/); return m ? m[1] : null;
          }, e.nome || '');
        } else { const w = t2.match(/\bWEB\s*[-:#nº°]*\s*(\d{5,})/i); if (w && !antesSalvar.includes(w[1])) achado = w[1]; }
        if (!achado) await pausa(700);
      }
      numero = achado ? 'WEB ' + achado : 'salvo (ver Meus Orçamentos)';
      if (achado && pdf) pdf.nome = 'WEB-' + achado + '.pdf';
      if (!achado) { const t3 = await pagTxt(), i3 = t3.search(/salv|sucesso|or[çc]amento/i); diagSalvar = { url: pg.url(), tela: t3.slice(Math.max(0, i3 - 300), i3 + 900).replace(/\s+/g, ' ') }; console.log('Salvou, mas não achei o número WEB. Guardei o texto da tela.'); }
      // 4) sem PDF ainda: baixa pelo botão de download do cartão em "Meus orçamentos"
      if (!pdf && achado) {
        try { const card = pg.locator('[data-robo-card="1"]').first(); const bt = card.locator('button, a').first(); if (await bt.count()) pdf = await guardarPdf(() => bt.click(), 'WEB-' + achado + '.pdf'); }
        catch (err) { console.log('Não consegui baixar o PDF do cartão: ' + String(err.message || err).slice(0, 100)); }
      }
      await fecharAvisos();
    }
    // "Comprar Agora" NUNCA é clicado por este robô.
    if (!(valor || produtos)) { const f = await printErro('confirmacao'); throw new Error('Não achei o valor do kit na tela de confirmação' + (f ? ' · print salvo em ' + f : '')); }
    if (AVISOS.length) console.log('Avisos desta cotação: ' + AVISOS.join(' | '));
    return { etapa: 8, final: { valorKit: valor || produtos, valorProdutos: produtos, frete: Math.max((valor || produtos) - produtos, 0), numero, pdf, diagSalvar, itensPreco: itensPreco.length ? itensPreco : null, descontoKit, fonte: cart ? 'api' : 'tela', avisos: AVISOS, cupons: cuponsValidos(), pagamento: (cart && cart.descricaoPagamento) || null, versao: VERSAO } };
  }
  throw new Error('Etapa desconhecida: ' + etapa);
}

/* Detalhes da estrutura dependem do tipo: rota extra para o sistema buscar (com a lista da API é na hora) */
async function detalhes(tipo) {
  if (ESTR) { const t = Object.keys(ESTR).find((x) => chaveTipo(x) === chaveTipo(tipo)); if (t && ESTR[t].length) return ESTR[t]; }
  try { return await detalhesInterno(tipo); } catch (err) { console.error(err); await printErro('detalhes'); return []; }
}
async function detalhesInterno(tipo) {
  const rt = await combo('app-tipo-de-estrutura', tipo, (a, b) => chaveTipo(a) === chaveTipo(b));
  if (!rt || !rt.achou) await listaCustom('Tipo de estrutura', tipo);
  await pg.locator('app-detalhes-estrutura .form-control').first().click({ timeout: 4000 }).catch(() => {}); await pausa(700);
  let t = (await pg.locator('app-detalhes-estrutura .combo-option').allInnerTexts().catch(() => [])).map((x) => x.replace(/\s+/g, ' ').trim()).filter(Boolean);
  if (!t.length) t = await pg.evaluate(() => [...document.querySelectorAll('*')].filter((e) => e.children.length === 0 && /^Modelo /.test((e.innerText || '').trim())).map((e) => e.innerText.trim()));
  await pg.keyboard.press('Escape'); return [...new Set(t)];
}

/* ---------- vez de usar o navegador: uma cotação por vez ----------
   A cotação do sistema (vendedor) e a da fila (Jarvis/pré-propostas) não podem se misturar na mesma tela. */
let dono = null, donoUltimo = 0, sessaoDono = null;
const LIVRE_APOS = { sistema: 10 * 60e3, fila: 3 * 60e3 }; // sem uso por esse tempo, a vez fica livre
const ocupadoPor = (quem) => dono && dono !== quem && Date.now() - donoUltimo < LIVRE_APOS[dono];
async function esperarVez(quem, etapa) {
  const fim = Date.now() + 5 * 60e3;
  while (ocupadoPor(quem) && Date.now() < fim) await pausa(1000);
  if (ocupadoPor(quem)) throw Object.assign(new Error('O robô está ocupado com outra cotação. Tente de novo em 1 minuto.'), { ocupado: true });
  if (etapa !== 0 && etapa !== 30 && sessaoDono && sessaoDono !== quem) throw new Error('O robô foi usado por outra cotação no meio desta: comece a cotação de novo.');
  dono = quem; donoUltimo = Date.now(); if (etapa === 0 || etapa === 30) sessaoDono = quem;
}
const liberar = (quem) => { if (dono === quem) dono = null; };

/* ---------- servidor local ---------- */
let fila = Promise.resolve();
http.createServer((req, res) => {
  const origem = req.headers.origin || 'null';
  const ok = ORIGENS_OK.some((re) => re.test(origem));
  res.setHeader('Access-Control-Allow-Origin', ok ? origem : 'null');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Dono');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.end();
  if (!ok) { res.statusCode = 403; return res.end(JSON.stringify({ erro: 'Origem não autorizada' })); }
  const quem = /fila/i.test(String(req.headers['x-dono'] || '')) ? 'fila' : 'sistema';
  let corpo = ''; req.on('data', (c) => { corpo += c; if (corpo.length > 2e5) req.destroy(); });
  req.on('end', () => {
    if (req.url === '/status') return logado().catch(() => false).then((l) => res.end(JSON.stringify({ ok: true, logado: l, versao: VERSAO, ocupado: ocupadoPor('ninguém') ? dono : null })));
    const rodar = (fn) => { fila = fila.then(async () => { try { res.end(JSON.stringify(await fn())); } catch (e) { res.statusCode = 500; res.end(JSON.stringify({ erro: String(e.message || e), diag: e.diag || null })); } }); };
    if (req.url === '/passo' && req.method === 'POST') {
      let pedido = {}; try { pedido = JSON.parse(corpo || '{}'); } catch { /* */ }
      const etapa = +pedido.etapa;
      return esperarVez(quem, etapa).then(() => rodar(async () => {
        try { const r = await passo(etapa, pedido.entrada); if (r.final) liberar(quem); else donoUltimo = Date.now(); return r; }
        catch (e) { liberar(quem); throw e; }
      })).catch((e) => { res.statusCode = e.ocupado ? 409 : 500; res.end(JSON.stringify({ erro: String(e.message || e) })); });
    }
    if (req.url === '/detalhes' && req.method === 'POST') { let tipo = ''; try { tipo = JSON.parse(corpo || '{}').tipo; } catch { /* */ } return rodar(async () => ({ detalhes: await detalhes(tipo) })); }
    res.statusCode = 404; res.end('{}');
  });
}).listen(PORTA, '127.0.0.1', () => console.log(`Cotador ${VERSAO} pronto em http://127.0.0.1:${PORTA}. Faça login na janela, se pedir.`));

// =====================================================================
// FILA DO JARVIS: com o arquivo robo-config.json ({ "chave": "..." }) nesta pasta,
// o robô olha a fila do sistema a cada minuto, cota o que foi pedido (do celular,
// pelo Jarvis, e as pré-propostas da manhã) e devolve o kit real. Usa o mesmo passo
// a passo do sistema (cotador-sistema.js), falando com este próprio robô em 127.0.0.1.
// Pré-propostas do mesmo tamanho são cotadas juntas: só a estrutura muda (bem mais rápido).
// =====================================================================
const SB_URL = 'https://jmpvmyyokikpwphwylob.supabase.co';
const SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptcHZteXlva2lrcHdwaHd5bG9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyMTc1MzEsImV4cCI6MjEwNzc5MzUzMX0.e5XT2R7eOj3x-ZYcRFkY4OFg0QEr3_guxT6-W0xpnfY';
async function filaRpc(fn, corpo) {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: SB_ANON, Authorization: 'Bearer ' + SB_ANON, 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
  const t = await r.text(); if (!r.ok) throw new Error(t.slice(0, 200)); return t ? JSON.parse(t) : null;
}
let filaOcupada = false, Cot = null;
async function orquestrador() {
  if (Cot) return Cot;
  const fs = await import('node:fs'), vm = await import('node:vm');
  globalThis.window = globalThis;
  globalThis.__donoRobo = 'fila'; // as chamadas da fila se identificam (não se misturam com a do vendedor)
  vm.runInThisContext(fs.readFileSync(path.resolve('cotador-sistema.js'), 'utf8'), { filename: 'cotador-sistema.js' });
  Cot = globalThis.Cotador; return Cot;
}
const erroDeVerdade = (m) => /não tem|sessão|expirou|chave/i.test(m); // não adianta repetir
async function cotarComNovaTentativa(C, base, log) {
  try { return await C.cotarAuto('conectado', base, log); }
  catch (e) { const m = String(e.message || e); if (erroDeVerdade(m)) throw e; console.log('  falhou (' + m.slice(0, 120) + '): tentando de novo do começo'); await pausa(3000); return C.cotarAuto('conectado', base, log); }
}
async function filaVez(chave) {
  if (filaOcupada) return; filaOcupada = true;
  try {
    try { let lg = null; try { lg = await logado(); } catch { /* navegador fechado */ } await filaRpc('sol_robo_ping', { p_segredo: chave, p_versao: VERSAO, p_logado: lg, p_maquina: os.hostname(), p_info: { pasta: process.cwd(), node: process.version, ocupado: dono, cupons: CUPONS.lista, cuponsEm: CUPONS.em ? new Date(CUPONS.em).toISOString() : null, fatorIndice: Math.round(FATOR * 10000) / 10000 } }); } catch (e) { console.log('Fila: não consegui avisar o sistema que estou ligado: ' + String(e.message || e).slice(0, 120)); }
    if (ocupadoPor('fila')) return; // o vendedor está cotando agora: a fila espera
    try { const n = await filaRpc('sol_robo_pre_agendar', { p_segredo: chave }); if (n) console.log(`Fila: ${n} pré-proposta(s) do dia agendada(s)`); } catch (e) { /* sem pré-propostas */ }
    const j = await filaRpc('sol_robo_proximo', { p_segredo: chave }); if (!j) return;
    let grupo = [j];
    if (j.tipo === 'pre') { try { const extra = await filaRpc('sol_robo_mesmo_kit', { p_segredo: chave, p_id: j.id }); if (Array.isArray(extra) && extra.length) grupo = grupo.concat(extra); } catch { /* sozinha */ } }
    console.log(`Fila: ${grupo.map((g) => (g.tipo === 'pre' ? 'pré-proposta ' + (g.pedido.rotulo || g.pedido.base.kwp + ' kWp') : 'pedido ' + (g.orc_codigo || g.id))).join(' + ')} (${(j.pedido.opcoes || []).map((x) => x.nivel).join(' + ')})`);
    const C = await orquestrador(), t0 = Date.now();
    const res = new Map(grupo.map((g) => [g.id, { kits: [], erros: [] }]));
    for (const op of j.pedido.opcoes || []) {
      let anterior = null;
      for (const g of grupo) {
        const base = { ...g.pedido.base, tipoInversor: op.tipoInversor, nome: ((g.pedido.opcoes || []).find((o) => o.nivel === op.nivel) || op).nome };
        const log = (et) => console.log(`  ${g.pedido.rotulo || base.kwp + ' kWp'} · ${op.nivel}: ${et}`);
        try {
          let s = null;
          if (anterior) { try { s = await C.recotarEstrutura(anterior, base, log); } catch (e) { console.log('  não deu para só trocar a estrutura (' + String(e.message || e).slice(0, 100) + '): cotação completa'); s = null; } }
          if (!s) s = await cotarComNovaTentativa(C, base, log);
          const k = C.paraKit(s, op.nivel);
          if (k.valorKit > 0) { res.get(g.id).kits.push(k); anterior = s; } else { res.get(g.id).erros.push(op.nivel + ': valor R$ 0'); anterior = null; }
        } catch (e) { res.get(g.id).erros.push(op.nivel + ': ' + String(e.message || e).slice(0, 160)); anterior = null; }
      }
    }
    for (const g of grupo) {
      const r = res.get(g.id);
      await filaRpc('sol_robo_entregar', { p_segredo: chave, p_id: g.id, p_ok: r.kits.length > 0, p_resultado: { kits: r.kits, erros: r.erros, versao: VERSAO, em: new Date().toISOString(), cupons: cuponsValidos() }, p_erro: r.erros.join(' | ') || null }).catch((e) => console.log('Fila: não consegui entregar ' + g.id + ': ' + String(e.message || e).slice(0, 120)));
      console.log(`Fila: ${r.kits.length} kit(s) devolvido(s) (${g.pedido.rotulo || g.orc_codigo || g.id})${r.erros.length ? ' · ' + r.erros.join(' | ') : ''}`);
    }
    console.log(`Fila: pronto em ${Math.round((Date.now() - t0) / 1000)} s`);
  } catch (e) { console.log('Fila: ' + String(e.message || e).slice(0, 160)); }
  finally { filaOcupada = false; }
}
(async () => {
  const fs = await import('node:fs'); const arq = path.resolve('robo-config.json');
  if (!fs.existsSync(arq)) { console.log('Fila do Jarvis desligada (sem robo-config.json nesta pasta). Pegue o arquivo em Parâmetros → Robô do escritório.'); return; }
  let chave = ''; try { chave = JSON.parse(fs.readFileSync(arq, 'utf8')).chave || ''; } catch { console.log('robo-config.json inválido.'); return; }
  console.log('Fila do Jarvis ligada: olhando a cada 60 s.');
  setTimeout(() => filaVez(chave), 15000); setInterval(() => filaVez(chave), 60000);
})();
