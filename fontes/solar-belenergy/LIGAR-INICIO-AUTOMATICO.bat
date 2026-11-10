@echo off
chcp 65001 >nul
title Iniciar o cotador junto com o Windows
cd /d "%~dp0"
set "ATALHO=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\Cotador Belenergy.lnk"
set "ALVO=%~dp0INICIAR-COTADOR.bat"
set "PASTA=%~dp0"
powershell -NoProfile -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut($env:ATALHO); $s.TargetPath=$env:ALVO; $s.WorkingDirectory=$env:PASTA; $s.WindowStyle=7; $s.Save()"
if errorlevel 1 (
  echo Nao consegui criar o atalho. Tire um print e mande para o Claude.
  pause
  exit /b 1
)
echo.
echo  Pronto: o cotador vai abrir sozinho, minimizado, toda vez que o Windows ligar.
echo  Para desligar, use DESLIGAR-INICIO-AUTOMATICO.bat
echo.
pause
