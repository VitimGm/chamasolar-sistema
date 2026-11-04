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

echo Conferindo o robo (na primeira vez leva uns minutos)...
call npm install --no-audit --no-fund --loglevel=error || goto erro
rem usa o Google Chrome instalado; so baixa navegador proprio se nao houver Chrome
set "TEMCHROME="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set TEMCHROME=1
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set TEMCHROME=1
if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set TEMCHROME=1
if not defined TEMCHROME (
  echo Baixando o navegador do robo. Leva uns minutos...
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
