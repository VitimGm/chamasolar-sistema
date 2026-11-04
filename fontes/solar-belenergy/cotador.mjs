// =====================================================================
// Cotador de KIT FECHADO Belenergy — roda no PC do vendedor
// Conduz o "Personalize seu Gerador → Convencional" no belenus.com.br com a
// sessão do próprio vendedor (login feito à mão, NUNCA guarda senha) e
// responde ao sistema da Chama Solar em http://127.0.0.1:8787.
//
// Fluxo (igual ao portal):
//  0 potência → 1 módulo (ordem do portal: menor preço por Watt) → 2 inversor
//  (tipo, ligação, tensão, fabricante) → 3 estrutura (tipo, detalhe, linhas,
//  módulos por linha, orientação) → 4 componentes → 5 componentes elétricos
//  → 6 orçamento (nome, frete, pagamento) → valor final do KIT.
//
// Uso:   node cotador.mjs            (deixa rodando enquanto orça)
//        node cotador.mjs --mapear   (você clica; ele grava os campos de cada tela)
// =====================================================================
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'https://belenus.com.br';
const PORTA = 8787;
const ORIGENS_OK = [/^https:\/\/([a-z0-9-]+\.)*chamae\.[a-z.]+$/i, /^https:\/\/claude\.ai$/, /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/, /^null$/];
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
const MAPEAR = process.argv.includes('--mapear');

const ctx = await chromium.launchPersistentContext(path.resolve('sessao-belenergy'), { headless: false, viewport: { width: 1280, height: 900 } });
const pg = ctx.pages()[0] || (await ctx.newPage());
const ultimas = {}; // últimas respostas JSON das chamadas do montador
pg.on('response', async (r) => {
  const m = r.url().match(/\/api\/catalogo\/KitPersonalizado\/(\w+)/);
  if (m) { try { ultimas[m[1]] = await r.json(); } catch { /* */ } }
});
await pg.goto(BASE + '/');
const logado = async () => (await pg.locator('text=/Meus Orçamentos|INSTALACOES/i').count()) > 0;

/* ---------- utilidades de tela (Angular Material) ---------- */
async function clicarTexto(re) { const b = pg.locator('button, a').filter({ hasText: re }).first(); await b.click(); await pg.waitForLoadState('networkidle').catch(() => {}); await pausa(800); }
async function escolherSelect(fc, texto) {
  if (!texto) return;
  const s = pg.locator(`mat-select[formcontrolname="${fc}"]`).first();
  if (!(await s.count())) return;
  await s.click(); await pausa(500);
  const op = pg.locator('mat-option').filter({ hasText: new RegExp(texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }).first();
  if (await op.count()) await op.click(); else await pg.keyboard.press('Escape');
  await pausa(900);
}
async function lerCampos() { // descreve os campos da tela atual (para etapas ainda não mapeadas)
  return pg.evaluate(async () => {
    const campos = [];
    for (const s of document.querySelectorAll('mat-select[formcontrolname]')) {
      const fc = s.getAttribute('formcontrolname'); if (fc === 'site') continue;
      const rot = s.closest('mat-form-field, div')?.innerText.split('\n')[0] || fc;
      s.querySelector('.mat-select-trigger')?.click(); await new Promise((r) => setTimeout(r, 500));
      const opcoes = [...document.querySelectorAll('mat-option')].map((o) => o.innerText.trim());
      document.querySelector('.cdk-overlay-backdrop')?.click(); await new Promise((r) => setTimeout(r, 300));
      campos.push({ fc, rotulo: rot.trim(), tipo: 'select', opcoes });
    }
    for (const i of document.querySelectorAll('input[formcontrolname]:not([type=hidden])')) {
      campos.push({ fc: i.getAttribute('formcontrolname'), rotulo: i.closest('mat-form-field, label, div')?.innerText.split('\n')[0]?.trim() || i.getAttribute('formcontrolname'), tipo: i.type === 'number' ? 'numero' : 'texto', valor: i.value });
    }
    return campos;
  });
}
async function preencherCampos(valores) {
  for (const [fc, v] of Object.entries(valores || {})) {
    if (await pg.locator(`mat-select[formcontrolname="${fc}"]`).count()) await escolherSelect(fc, String(v));
    else { const i = pg.locator(`input[formcontrolname="${fc}"]`).first(); if (await i.count()) { await i.fill(String(v)); await pausa(300); } }
  }
}
async function lerCartoes() { // cartões "Cód: ..." da etapa atual, na ordem do portal
  return pg.evaluate(() => [...document.querySelectorAll('*')].filter((e) => e.children.length === 0 && /^Cód:/.test(e.innerText || ''))
    .map((e) => { let c = e; for (let k = 0; k < 8 && c && !c.querySelector('input'); k++) c = c.parentElement; const t = (c?.innerText || '').split('\n').map((x) => x.trim()).filter(Boolean);
      const preco = (c?.innerText.match(/R\$\s*([\d.]+,\d{2})/) || [])[1]; const qtd = c?.querySelector('input[type=number], input:not([type=radio])')?.value;
      return { sku: e.innerText.replace('Cód:', '').trim(), nome: t.find((x) => /MODULO|INVERSOR|MICRO/i.test(x)) || t[2] || '', potencia: (t.find((x) => /W[p]?$/i.test(x)) || ''), qtdSugerida: qtd ? +qtd : null, preco: preco ? +preco.replace(/\./g, '').replace(',', '.') : null }; }));
}
async function selecionarCartao(sku, qtd) {
  await pg.evaluate(({ sku, qtd }) => {
    const e = [...document.querySelectorAll('*')].find((x) => x.children.length === 0 && (x.innerText || '').trim() === 'Cód: ' + sku);
    let c = e; for (let k = 0; k < 8 && c && !c.querySelector('input[type=radio], mat-radio-button'); k++) c = c.parentElement;
    (c.querySelector('mat-radio-button label, input[type=radio]') || c).click();
    if (qtd) { const i = [...c.querySelectorAll('input')].find((x) => x.type !== 'radio'); if (i) { i.value = qtd; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); } }
  }, { sku, qtd });
  await pausa(600);
}
async function lerItensTabela() { // componentes: linhas com descrição + quantidade
  return pg.evaluate(() => [...document.querySelectorAll('tr, mat-row, .item, [class*=component]')].map((r, i) => {
    const q = r.querySelector('input'); const t = r.innerText.replace(/\s+/g, ' ').trim(); if (!q || !t) return null;
    const preco = (t.match(/R\$\s*([\d.]+,\d{2})/) || [])[1];
    return { id: i, nome: t.slice(0, 90), qtd: +q.value || 0, precoUn: preco ? +preco.replace(/\./g, '').replace(',', '.') : null };
  }).filter(Boolean));
}
async function ajustarItens(itens) {
  await pg.evaluate((itens) => {
    const linhas = [...document.querySelectorAll('tr, mat-row, .item, [class*=component]')];
    for (const it of itens) { const q = linhas[it.id]?.querySelector('input'); if (q && +q.value !== it.qtd) { q.value = it.qtd; q.dispatchEvent(new Event('input', { bubbles: true })); q.dispatchEvent(new Event('change', { bubbles: true })); } }
  }, itens || []);
  await pausa(700);
}
async function lerFinal() {
  const t = await pg.evaluate(() => document.body.innerText);
  const valores = [...t.matchAll(/R\$\s*([\d.]+,\d{2})/g)].map((m) => +m[1].replace(/\./g, '').replace(',', '.'));
  const total = t.match(/(TOTAL|Valor do kit|Valor total)[^\n]*?R\$\s*([\d.]+,\d{2})/i);
  const num = t.match(/Or[çc]amento\s*(n[ºo°.]*)?\s*[:#]?\s*(\d{4,})/i);
  return { valorKit: total ? +total[2].replace(/\./g, '').replace(',', '.') : Math.max(...valores), numero: num ? num[2] : 'ver em Meus Orçamentos' };
}

/* ---------- etapas ---------- */
const sessao = { escolhas: {} };
async function passo(etapa, e = {}) {
  if (!(await logado())) throw new Error('Sessão da Belenergy expirou: faça login na janela do robô e tente de novo.');
  Object.assign(sessao.escolhas, e);
  if (etapa === 0) {
    await pg.goto(BASE + '/energy/escolha-metodo'); await pausa(1200);
    await clicarTexto(/ESCOLHER/); // Convencional (primeiro)
    await pg.locator('#inputPotencia').fill(String(e.kwp));
    await pg.locator('button').filter({ hasText: 'navigate_next' }).first().click(); await pausa(2500);
    const ord = pg.locator('select').filter({ hasText: /Menor Pre/ }).first(); if (await ord.count()) await ord.selectOption({ label: 'Menor Preço Por Watt' }).catch(() => {});
    await pausa(1200);
    return { etapa: 1, opcoes: { modulos: await lerCartoes(), bruto: ultimas.Modulos ?? null } };
  }
  if (etapa === 1) {
    await selecionarCartao(e.moduloSku, e.moduloQtd); await clicarTexto(/PRÓXIMO/); await pausa(1500);
    return { etapa: 2, opcoes: { campos: await lerCampos(), inversores: null } };
  }
  if (etapa === 2 && e.filtrar) {
    await escolherSelect('tipoInversor', e.tipoInversor); await escolherSelect('tipoLigacao', e.ligacao);
    await escolherSelect('tensaoNominal', e.tensao); await escolherSelect('fabricante', e.fabricante);
    await clicarTexto(/FILTRAR/); await pausa(2000);
    return { etapa: 2, opcoes: { campos: await lerCampos(), inversores: await lerCartoes(), bruto: ultimas.InversorFiltro ?? null } };
  }
  if (etapa === 2) { await selecionarCartao(e.inversorSku); await clicarTexto(/PRÓXIMO/); await pausa(1500); return { etapa: 3, opcoes: { campos: await lerCampos() } }; }
  if (etapa === 3) { await preencherCampos(e.campos); await clicarTexto(/PRÓXIMO/); await pausa(1500); return { etapa: 4, opcoes: { componentes: await lerItensTabela() } }; }
  if (etapa === 4) { await ajustarItens(e.componentes); await clicarTexto(/PRÓXIMO/); await pausa(1500); return { etapa: 5, opcoes: { eletricos: await lerItensTabela() } }; }
  if (etapa === 5) { await ajustarItens(e.eletricos); await clicarTexto(/PRÓXIMO/); await pausa(1500); return { etapa: 6, opcoes: { campos: await lerCampos() } }; }
  if (etapa === 6) {
    await preencherCampos(e.campos);
    await clicarTexto(/FINALIZAR|GERAR OR[ÇC]AMENTO|SALVAR OR[ÇC]AMENTO/); await pausa(2500);
    return { etapa: 7, final: await lerFinal() };
  }
  throw new Error('Etapa desconhecida: ' + etapa);
}

/* ---------- servidor local para o sistema ---------- */
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
  let corpo = ''; req.on('data', (c) => { corpo += c; if (corpo.length > 1e5) req.destroy(); });
  req.on('end', () => {
    if (req.url === '/status') return logado().then((l) => res.end(JSON.stringify({ ok: true, logado: l })));
    if (req.url === '/passo' && req.method === 'POST') {
      fila = fila.then(async () => { // uma etapa por vez
        try { const { etapa, entrada } = JSON.parse(corpo || '{}'); res.end(JSON.stringify(await passo(+etapa, entrada))); }
        catch (e) { res.statusCode = 500; res.end(JSON.stringify({ erro: String(e.message || e) })); }
      });
      return;
    }
    res.statusCode = 404; res.end('{}');
  });
}).listen(PORTA, '127.0.0.1', () => console.log(`Cotador pronto em http://127.0.0.1:${PORTA}. Faça login na janela, se pedir.`));

/* ---------- modo mapear: você navega, ele grava os campos de cada tela ---------- */
if (MAPEAR) {
  const mapa = []; let ultimaUrl = '';
  console.log('MODO MAPEAR: faça um orçamento completo no Personalize seu Gerador. Eu gravo cada tela em mapa-telas.json.');
  setInterval(async () => {
    const u = pg.url(); if (u === ultimaUrl || !/\/energy\//.test(u)) return; ultimaUrl = u; await pausa(2500);
    mapa.push({ url: u, campos: await lerCampos().catch(() => []), botoes: await pg.locator('button').allInnerTexts().catch(() => []), itens: await lerItensTabela().catch(() => []), respostas: Object.keys(ultimas) });
    fs.writeFileSync('mapa-telas.json', JSON.stringify(mapa, null, 2)); console.log('  tela gravada:', u);
  }, 1500);
}
