@echo off
title Compilando Aplicacion de Windows
set PATH=%PATH%;C:\Program Files\nodejs
cd /d "%~dp0"
echo Construyendo aplicacion React...
call npm run build
echo Empaquetando ejecutable de Electron...
call npx electron-builder --win
echo.
echo Construccion terminada. El instalador .exe esta en la carpeta dist.
pause
