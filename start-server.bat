@echo off
title Servidor de Senalizacion
set PATH=%PATH%;C:\Program Files\nodejs
cd /d "%~dp0\signaling-server"
npm start
pause
