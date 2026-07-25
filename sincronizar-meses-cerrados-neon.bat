@echo off
setlocal
cd /d "%~dp0"
set "PATH=C:\Users\scumm\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;%PATH%"
set "APP_ROOT=%~dp0"

findstr /B /C:"DATABASE_URL=postgres" ".env.local" >nul 2>nul
if errorlevel 1 (
  echo Falta DATABASE_URL=postgres... en .env.local
  echo Este sincronizador necesita Neon para guardar meses cerrados online.
  pause
  exit /b 1
)

echo Importando meses cerrados desde Dulce Hora hacia Neon...
echo Si un mes ya quedo cerrado, se saltea. Para regenerar usar: pnpm sync:closed-months -- --force
echo.
"C:\Users\scumm\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd" sync:closed-months
pause
