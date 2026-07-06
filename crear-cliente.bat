@echo off
color 0B
echo.
echo =============================================
echo   ASISTENTE PARA CREAR NUEVO CLIENTE
echo =============================================
echo Iniciando proceso seguro...
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0crear-cliente.ps1"
if %errorlevel% neq 0 (
    echo.
    echo Ocurrio un error al ejecutar el script de PowerShell.
    pause
)
