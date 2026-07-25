@echo off
setlocal
cd /d "%~dp0"
set "PATH=C:\Users\scumm\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;%PATH%"
set "APP_ROOT=%~dp0"

findstr /B /C:"DATABASE_URL=postgres" ".env.local" >nul 2>nul
if errorlevel 1 (
  echo Falta DATABASE_URL=postgres... en .env.local
  echo Este sincronizador necesita Neon para guardar datos online.
  pause
  exit /b 1
)

if "%~1"=="" (
  echo Uso:
  echo   sincronizar-rango-neon.bat 2026-07-01 2026-07-25
  echo.
  echo Para regenerar un mes cerrado:
  echo   sincronizar-rango-neon.bat 2026-05-01 2026-05-31 --force
  pause
  exit /b 1
)

if "%~2"=="" (
  echo Falta la fecha final.
  echo Uso: sincronizar-rango-neon.bat YYYY-MM-DD YYYY-MM-DD
  pause
  exit /b 1
)

"C:\Users\scumm\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd" exec tsx scripts/sync-dulce-hora-periods.ts --mode=range --from=%~1 --to=%~2 %3 %4 %5 %6 %7 %8 %9
pause
