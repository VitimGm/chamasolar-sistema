#!/usr/bin/env python3
"""Monta a pasta do Chama Solar para o site do Chamae (repositório medix-luvas).

Uso:  python3 fontes/publicar-chamae.py <pasta-do-medix-luvas> [solar-teste|solar]

- Copia solar-teste/ (css, js, marca, páginas) para <medix-luvas>/<destino>/
- Troca o banco de teste (localStorage) pelo oficial (Supabase, login do Chamae)
- O app só começa depois que o banco carregou (Banco.pronto)
"""
import pathlib, re, shutil, sys

ORIGEM = pathlib.Path(__file__).resolve().parent.parent / 'solar-teste'
medix = pathlib.Path(sys.argv[1]).resolve()
destino_nome = sys.argv[2] if len(sys.argv) > 2 else 'solar-teste'
assert destino_nome in ('solar-teste', 'solar'), 'destino deve ser solar-teste ou solar'
DEST = medix / destino_nome

if DEST.exists():
    shutil.rmtree(DEST)
for pasta in ('css', 'marca'):
    shutil.copytree(ORIGEM / pasta, DEST / pasta)
(DEST / 'js').mkdir(parents=True)
for f in (ORIGEM / 'js').glob('*.js'):
    if f.name != 'banco.js':
        shutil.copy2(f, DEST / 'js' / f.name)

def carregar_depois(html, script, pagina):
    html = html.replace('<body>', f'<body data-pagina="{pagina}">', 1)
    html = html.replace('<script src="js/banco.js"></script>', '<script src="js/banco-nuvem.js"></script>')
    html = html.replace(f'<script src="js/{script}"></script>',
        '<script>Banco.pronto.then(function () { var s = document.createElement("script"); '
        f's.src = "js/{script}"; document.body.appendChild(s); }}).catch(function () {{}});</script>')
    return html

idx = (ORIGEM / 'index.html').read_text(encoding='utf-8')
idx = carregar_depois(idx, 'app.js', 'central')
# botão fixo para voltar ao Chamae (computador e celular)
idx = idx.replace('<body data-pagina="central">', '<body data-pagina="central">\n  <a href="../chamae/" id="voltarChamae" style="position:fixed;top:12px;right:12px;z-index:60;display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:999px;background:#ffffff14;border:1px solid #ffffff33;color:#fff;font:600 14px system-ui;text-decoration:none;backdrop-filter:blur(8px)">‹ Chamae</a>', 1)
idx = re.sub(r'<div class="selo-teste">.*?</div>',
             '<div class="selo-teste">' + ('TESTE · ' if destino_nome == 'solar-teste' else '') +
             'dados salvos no Chamae<br><a class="link" href="../chamae/">‹ voltar ao Chamae</a></div>', idx, flags=re.S)
idx = idx.replace('<title>Chama Solar · Central de vendas (teste)</title>', '<title>Chama Solar · Central de vendas</title>')
idx = idx.replace('</head>', '  <meta name="robots" content="noindex">\n</head>', 1)
(DEST / 'index.html').write_text(idx, encoding='utf-8')

prop = (ORIGEM / 'proposta.html').read_text(encoding='utf-8')
(DEST / 'proposta.html').write_text(carregar_depois(prop, 'proposta.js', 'proposta'), encoding='utf-8')

serv = (ORIGEM / 'proposta-servico.html').read_text(encoding='utf-8')
(DEST / 'proposta-servico.html').write_text(carregar_depois(serv, 'proposta-servico.js', 'proposta'), encoding='utf-8')

# formulário público de captação de leads (só usa a função sol_novo_lead)
shutil.copy2(ORIGEM / 'captacao.html', DEST / 'captacao.html')
# área pública do parceiro (só usa as funções sol_parceiro_*: link + senha, sem login do Chamae)
shutil.copy2(ORIGEM / 'parceiro.html', DEST / 'parceiro.html')

# o botão "recomeçar dados" não existe mais; o app espera achá-lo
app = (DEST / 'js' / 'app.js').read_text(encoding='utf-8')
app = app.replace("$('#resetar').onclick =", "if ($('#resetar')) $('#resetar').onclick =")
(DEST / 'js' / 'app.js').write_text(app, encoding='utf-8')

# versão nos arquivos: o navegador do cliente e do vendedor pega sempre o código novo (sem "Ctrl+F5")
import time as _t
VERSAO = _t.strftime('%Y%m%d%H%M')
for pagina in DEST.glob('*.html'):
    h = pagina.read_text(encoding='utf-8')
    h = re.sub(r'((?:src|href)="(?:js|css)/[^"?]+\.(?:js|css))"', r'\1?v=' + VERSAO + '"', h)
    h = re.sub(r'(s\.src = "js/[^"?]+\.js)"', r'\1?v=' + VERSAO + '"', h)
    pagina.write_text(h, encoding='utf-8')

print('pronto:', DEST)
