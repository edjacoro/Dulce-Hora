@echo off
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173 :8787"') do (
  taskkill /PID %%a /F >nul 2>nul
)
echo Dulce Hora Control detenido.
pause
