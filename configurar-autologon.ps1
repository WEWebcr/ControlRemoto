<#
.SYNOPSIS
    Configura el inicio de sesión automático (Auto-Logon) en Windows 10/11.
.DESCRIPTION
    Este script modifica los registros de Windows para habilitar el inicio de sesión automático,
    desactivar las restricciones de Windows Hello sin contraseña, y desactivar el requerimiento
    de contraseña al despertar de suspensión.
.NOTES
    Debe ejecutarse como Administrador.
#>

# Ejecutar como Administrador es requerido
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Error "Este script debe ser ejecutado en una ventana de PowerShell como ADMINISTRADOR."
    Exit
}

Write-Host "==============================================" -ForegroundColor Cyan
Write-Host " CONFIGURADOR DE INICIO AUTOMÁTICO (AUTO-LOGON) " -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

# 1. Solicitar credenciales
$Username = Read-Host "Introduce el NOMBRE DE USUARIO de Windows (ej. Administrador o Caja1)"
if ([string]::IsNullOrWhiteSpace($Username)) {
    Write-Error "El usuario no puede estar vacío."
    Exit
}

$Password = Read-Host "Introduce la CONTRASEÑA de ese usuario"
if ([string]::IsNullOrWhiteSpace($Password)) {
    Write-Error "La contraseña no puede estar vacía."
    Exit
}

$Domain = Read-Host "Introduce el DOMINIO o NOMBRE DE EQUIPO [Presiona Enter para usar cuenta local: $env:COMPUTERNAME]"
if ([string]::IsNullOrWhiteSpace($Domain)) {
    $Domain = $env:COMPUTERNAME
}

Write-Host ""
Write-Host "Aplicando configuraciones en el registro..." -ForegroundColor Yellow

# 2. Desactivar Windows Hello sin contraseña (para que funcione el inicio automático de contraseña común)
$PasswordLessPath = "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\PasswordLess\Device"
if (Test-Path $PasswordLessPath) {
    Set-ItemProperty -Path $PasswordLessPath -Name "DevicePasswordLessBuildVersion" -Value 0 -Force
    Write-Host "[-] Habilitado inicio por contraseña clásica (Desactivado Windows Hello forzado)." -ForegroundColor Green
}

# 3. Configurar Winlogon para Auto-Logon
$WinlogonPath = "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon"
if (Test-Path $WinlogonPath) {
    Set-ItemProperty -Path $WinlogonPath -Name "AutoAdminLogon" -Value "1" -Force
    Set-ItemProperty -Path $WinlogonPath -Name "DefaultUserName" -Value $Username -Force
    Set-ItemProperty -Path $WinlogonPath -Name "DefaultPassword" -Value $Password -Force
    Set-ItemProperty -Path $WinlogonPath -Name "DefaultDomainName" -Value $Domain -Force
    Write-Host "[-] Credenciales de Auto-Logon configuradas en Winlogon." -ForegroundColor Green
}

# 4. Desactivar solicitud de contraseña al regresar de Suspensión / Protector de pantalla
$DesktopPath = "HKCU:\Control Panel\Desktop"
if (Test-Path $DesktopPath) {
    Set-ItemProperty -Path $DesktopPath -Name "ScreenSaverIsSecure" -Value "0" -Force
}

# Configuración del esquema de energía para que nunca pida contraseña al despertar
try {
    # Esquema AC (Conectado a la corriente)
    powercfg /SETACVALUEINDEX SCHEME_CURRENT SUB_NONE CONSOLELOCK 0
    # Esquema DC (Batería)
    powercfg /SETDCVALUEINDEX SCHEME_CURRENT SUB_NONE CONSOLELOCK 0
    Write-Host "[-] Desactivada la solicitud de contraseña al suspender/apagar pantalla." -ForegroundColor Green
} catch {
    Write-Warning "No se pudo cambiar el comportamiento de bloqueo de energía mediante powercfg."
}

Write-Host ""
Write-Host "==============================================" -ForegroundColor Green
Write-Host "Configuración completada con éxito." -ForegroundColor Green
Write-Host "Por favor, REINICIA el equipo para verificar el inicio automático." -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Green
