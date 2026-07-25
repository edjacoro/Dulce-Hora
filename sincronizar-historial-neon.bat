@echo off
setlocal
cd /d "%~dp0"
set "PATH=C:\Users\scumm\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;%PATH%"
set "APP_ROOT=%~dp0"

findstr /B /C:"DATABASE_URL=postgres" ".env.local" >nul 2>nul
if errorlevel 1 (
  echo Falta DATABASE_URL=postgres... en .env.local
  echo Este sincronizador necesita Neon para guardar el historial online.
  pause
  exit /b 1
)

echo Sincronizando historial operativo hacia Neon...
echo Meses cerrados se saltean si ya quedaron marcados como cerrados.
echo El mes actual se actualiza siempre.
echo.
"C:\Users\scumm\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd" sync:all
pause
