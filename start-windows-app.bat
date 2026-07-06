@echo off
title Aplicacion Windows Admin
set PATH=%PATH%;C:\Program Files\nodejs
cd /d "%~dp0\windows-admin"
npm run electron:dev
pause
