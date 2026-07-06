@echo off
set PATH=%PATH%;C:\Program Files\nodejs
cd /d "%~dp0"
call npm install node-windows
node install-service.js
echo.
echo Servicio instalado exitosamente. Ahora correra en segundo plano siempre que enciendas la PC.
pause
