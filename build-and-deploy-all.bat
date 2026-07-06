@echo off
echo ===================================================
echo 1. Compilando Consola de Administracion React...
echo ===================================================
cd windows-admin
call npm run build
if %ERRORLEVEL% neq 0 (
  echo Error al compilar la consola.
  exit /b %ERRORLEVEL%
)
cd ..

echo ===================================================
echo 2. Copiando archivos de la Consola a public/admin/...
echo ===================================================
if not exist signaling-server\public\admin mkdir signaling-server\public\admin
powershell -Command "Remove-Item -Recurse -Force signaling-server\public\admin\*" 2>nul
xcopy /e /y windows-admin\dist\* signaling-server\public\admin\

echo ===================================================
echo 3. Compilando Cliente Android APK...
echo ===================================================
set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
set PATH=%JAVA_HOME%\bin;%PATH%
cd android-client
call gradlew.bat assembleDebug
if %ERRORLEVEL% neq 0 (
  echo Error al compilar la aplicacion Android.
  exit /b %ERRORLEVEL%
)
cd ..

echo ===================================================
echo 4. Copiando APK a public/app.apk...
echo ===================================================
powershell -Command "$apk = Get-ChildItem -Path android-client\app\build\outputs\apk\debug\*.apk | Sort-Object LastWriteTime -Descending | Select-Object -First 1; if ($apk) { Copy-Item -Path $apk.FullName -Destination signaling-server\public\app.apk -Force; Write-Host 'APK copiado a public/app.apk de forma exitosa: ' $apk.Name } else { Write-Error 'No se encontro el APK compilado' }"

echo ===================================================
echo COMPILACION Y DESPLIEGUE COMPLETADOS CON EXITO.
echo ===================================================
