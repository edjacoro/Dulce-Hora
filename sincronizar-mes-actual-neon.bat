@echo off
setlocal
cd /d "%~dp0"
set "PATH=C:\Users\scumm\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;%PATH%"
set "APP_ROOT=%~dp0"

findstr /B /C:"DATABASE_URL=postgres" ".env.local" >nul 2>nul
if errorlevel 1 (
  echo Falta DATABASE_URL=postgres... en .env.local
  echo Este sincronizador necesita Neon para guardar el mes actual online.
  pause
  exit /b 1
)

echo Actualizando el mes actual desde Dulce Hora hacia Neon...
echo Este mes queda editable y se puede volver a correr cuantas veces haga falta.
echo.
"C:\Users\scumm\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd" sync:current-month
pause
