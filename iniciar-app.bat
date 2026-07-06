@echo off
title Remoto Control J&M - Iniciador
echo ===================================================
echo Iniciando Remoto Control J&M en la Nube...
echo ===================================================

echo Conectando al Servidor Web (remoto-control-jm.onrender.com)...
start "Remoto Control J&M App" cmd /c "cd c:\ControlRemoto\windows-admin && npm run electron:dev"

echo.
echo La aplicacion de Windows se esta abriendo.
echo Puedes cerrar esta ventana.
pause
