@echo off
echo Compilando consola de administracion...
cd windows-admin
call npm run build
if %ERRORLEVEL% neq 0 (
  echo Error al compilar la consola.
  exit /b %ERRORLEVEL%
)
cd ..

echo Copiando archivos a public/admin/...
if not exist signaling-server\public\admin mkdir signaling-server\public\admin
powershell -Command "Remove-Item -Recurse -Force signaling-server\public\admin\*" 2>nul
xcopy /e /y windows-admin\dist\* signaling-server\public\admin\

echo Despliegue completo con exito.
