@echo off
chcp 65001 >nul
title Cotador Belenergy - Chama Solar
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  O Node.js nao esta instalado neste computador.
  echo  1. Abra https://nodejs.org e baixe a versao LTS ^(botao verde^).
  echo  2. Instale com Avancar, Avancar, Concluir.
  echo  3. Feche esta janela e de dois cliques neste arquivo de novo.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\playwright" (
  echo Instalando o robo pela primeira vez. Leva uns minutos...
  call npm install --no-audit --no-fund || goto erro
  call npx playwright install chromium || goto erro
)

echo.
echo  Abrindo o navegador do robo. Se pedir, faca o login na Belenergy.
echo  Deixe esta janela aberta enquanto estiver orcando.
echo.
node cotador.mjs
pause
exit /b 0

:erro
echo.
echo  Algo deu errado na instalacao. Tire um print desta janela e mande para o Claude.
pause
exit /b 1
