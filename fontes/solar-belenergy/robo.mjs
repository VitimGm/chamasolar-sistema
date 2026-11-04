// =====================================================================
// Robô de preços Belenergy (portal belenus.com.br) — roda no PC do Victor
//
// Como funciona:
//  1. Abre um navegador VISÍVEL com uma sessão guardada só neste PC
//     (pasta ./sessao-belenergy, fora do git).
//  2. Na 1ª vez (ou quando a sessão expirar) VOCÊ faz o login à mão.
//     O robô NUNCA recebe, guarda ou digita a sua senha.
//  3. Ele visita as páginas do catálogo de energia solar como você faria,
//     só LÊ o que o próprio site carrega (preço, estoque, R$/Wp) e grava
//     belenergy-AAAA-MM-DD.json e .csv nesta pasta.
//  4. Não adiciona nada ao carrinho, não cria orçamento, não compra.
//
// Instalar (uma vez):  npm i playwright@1.49.1 && npx playwright install chromium
// Rodar:               node robo.mjs           (ou agende 1x por dia)
// Importar:            Central de vendas > Catálogo > "Importar arquivo do robô"
// =====================================================================
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'https://belenus.com.br';
const PASTA_SESSAO = path.resolve('sessao-belenergy');
const PAGINAS = [
  ['modulo', '/produtos/3/energia%20solar/painel%20fotovoltaico'],
  ['inversor-ongrid', '/produtos/4/energia%20solar/inversor%20fotovoltaico/on%20grid/on%20grid'],
  ['microinversor', '/produtos/4/energia%20solar/inversor%20fotovoltaico/microinversor/microinversor'],
  ['inversor-hibrido', '/produtos/4/energia%20solar/inversor%20fotovoltaico/h%C3%ADbrido/h%C3%ADbrido'],
  ['bateria', '/produtos/4/energia%20solar/bateria%20e%20bess'],
  ['estrutura', '/produtos/3/energia%20solar/sistemas%20de%20fixa%C3%A7%C3%A3o'],
  ['componente', '/produtos/3/energia%20solar/componentes%20el%C3%A9tricos'],
];
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

function normalizar(tipoPagina, familia, op) {
  const d = op.descricaoProduto || '';
  const w = d.match(/(\d{3,4})\s?W\b/i);
  const kw = d.match(/(\d+(?:[.,]\d+)?)\s?KW\b/i);
  const marca = (op.imagemMarca || '').split('/').pop().replace(/\.(png|jpe?g|svg)$/i, '').replace(/^logo_/, '').replace(/[_-]/g, ' ');
  const tipo = tipoPagina.startsWith('inversor') || tipoPagina === 'microinversor' ? 'inversor' : tipoPagina;
  return {
    sku: op.sku, descricao: d, tipo, subtipo: tipoPagina, familia: familia.descricaoFamilia,
    marca: marca || null,
    potenciaW: tipo === 'modulo' && w ? +w[1] : tipo === 'inversor' && kw ? Math.round(parseFloat(kw[1].replace(',', '.')) * 1000) : null,
    hibrido: tipoPagina === 'inversor-hibrido' || /H[IÍ]BRID/i.test(d),
    preco: Math.round((op.preco ?? op.valorUnitario) * 100) / 100,
    precoPorWp: op.valorPotencia ? Math.round(op.valorPotencia * 1000) / 1000 : null,
    embalagem: op.qtdEmbalagem, unidade: op.unidadeEstoque,
    estoque: op.qtdEstoque, disponivelSP: !(op.estoqueEstados || []).find((e) => e.uf === 'SP')?.indisponivel,
    promocao: !!op.promocao, foto: op.fotoProduto,
  };
}

const contexto = await chromium.launchPersistentContext(PASTA_SESSAO, { headless: false, viewport: { width: 1280, height: 860 } });
const pagina = contexto.pages()[0] || (await contexto.newPage());
const produtos = new Map();
let tipoAtual = null;

pagina.on('response', async (resp) => {
  if (!/\/api\/catalogo\/catalogo\/vitrine/.test(resp.url()) || !tipoAtual) return;
  try {
    const j = await resp.json();
    for (const f of j.produtos || []) for (const op of f.opcoes || []) {
      if (op.sku && !op.indisponivel) produtos.set(op.sku, normalizar(tipoAtual, f, op));
    }
  } catch { /* resposta que não é JSON: ignora */ }
});

// 1) Login feito por você
await pagina.goto(BASE + '/');
const logado = async () => (await pagina.locator('text=Meus Orçamentos').count()) > 0 || (await pagina.locator('text=/INSTALACOES/i').count()) > 0;
if (!(await logado())) {
  console.log('\n>>> Faça o login na janela que abriu. Eu espero (até 5 minutos)...\n');
  const fim = Date.now() + 5 * 60e3;
  while (!(await logado()) && Date.now() < fim) await pausa(2000);
  if (!(await logado())) { console.error('Não identifiquei o login. Rode de novo.'); await contexto.close(); process.exit(1); }
}
console.log('Sessão ok. Lendo o catálogo...');

// 2) Visita cada página, devagar (sem sobrecarregar o site)
for (const [tipo, url] of PAGINAS) {
  tipoAtual = tipo;
  const antes = produtos.size;
  await pagina.goto(BASE + url, { waitUntil: 'networkidle' }).catch(() => {});
  for (let i = 0; i < 6; i++) { await pagina.mouse.wheel(0, 2500); await pausa(900); } // carrega listas longas
  console.log(`  ${tipo.padEnd(18)} +${produtos.size - antes} itens`);
  await pausa(2500);
}
tipoAtual = null;

// 3) Grava os arquivos
const hoje = new Date().toISOString().slice(0, 10);
const lista = [...produtos.values()];
const saida = { fornecedor: 'Belenergy', origem: 'robo', capturadoEm: new Date().toISOString(), total: lista.length, produtos: lista };
fs.writeFileSync(`belenergy-${hoje}.json`, JSON.stringify(saida, null, 2));
const cab = ['sku', 'tipo', 'subtipo', 'marca', 'descricao', 'potenciaW', 'preco', 'precoPorWp', 'estoque', 'disponivelSP'];
const csv = [cab.join(';'), ...lista.map((p) => cab.map((k) => String(p[k] ?? '').replace(/;/g, ',')).join(';'))].join('\n');
fs.writeFileSync(`belenergy-${hoje}.csv`, '﻿' + csv);
console.log(`\nPronto: ${lista.length} produtos em belenergy-${hoje}.json e .csv`);
await contexto.close();
