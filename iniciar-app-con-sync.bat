@echo off
setlocal
cd /d "%~dp0"
set "PATH=C:\Users\scumm\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;%PATH%"
set "APP_ROOT=%~dp0"
set "DATA_DIR=%~dp0data\pglite-local-runtime"

if "%DULCE_HORA_USERNAME%"=="" (
  set /p DULCE_HORA_USERNAME=Usuario panel Dulce Hora:
)

if "%DULCE_HORA_PASSWORD%"=="" (
  for /f "usebackq delims=" %%p in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$secure = Read-Host 'Contrasena panel Dulce Hora' -AsSecureString; $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure); try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }"`) do set "DULCE_HORA_PASSWORD=%%p"
)

start "Dulce Hora Control" http://127.0.0.1:5173
"C:\Users\scumm\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd" dev
