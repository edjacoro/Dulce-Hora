@echo off
setlocal
cd /d "%~dp0"
set "PATH=C:\Users\scumm\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;%PATH%"
set "APP_ROOT=%~dp0"

findstr /B /C:"DATABASE_URL=postgres" ".env.local" >nul 2>nul
if errorlevel 1 (
  echo Falta DATABASE_URL=postgres... en .env.local
  echo Copia la connection string de Neon o de Netlify Environment variables.
  echo Este modo es el que permite sincronizar desde tu ordenador hacia la base online.
  pause
  exit /b 1
)

echo Iniciando Dulce Hora usando la base online Neon...
start "Dulce Hora Control Online" http://127.0.0.1:5173
"C:\Users\scumm\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd" dev
