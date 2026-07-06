param (
    [Parameter(Mandatory=$false)]
    [string]$NombreCliente,
    
    [Parameter(Mandatory=$false)]
    [string]$UrlGithub
)

$ErrorActionPreference = "Stop"
$ScriptDir = $PSScriptRoot

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "   ASISTENTE PARA CREAR NUEVO CLIENTE (RENDER) " -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

if (-not $NombreCliente) {
    $NombreCliente = Read-Host "Ingresa el nombre de la empresa/cliente (ej. cliente_demo)"
}

if (-not $UrlGithub) {
    $UrlGithub = Read-Host "Ingresa la URL del repositorio vacío de GitHub (ej. https://github.com/usuario/repo.git)"
}

$Destino = Join-Path -Path (Split-Path -Path $ScriptDir -Parent) -ChildPath "ControlRemoto_$NombreCliente"

Write-Host "`n[1/4] Creando directorio para el cliente en: $Destino" -ForegroundColor Yellow
if (Test-Path $Destino) {
    Write-Host "La carpeta ya existe. Limpiando..." -ForegroundColor Red
    Remove-Item -Path $Destino -Recurse -Force
}
New-Item -ItemType Directory -Path $Destino | Out-Null

Write-Host "[2/4] Copiando archivos base..." -ForegroundColor Yellow
# Usar robocopy para copiar todo excluyendo carpetas pesadas/innecesarias y el historial de git
$excludeDirs = @(".git", "node_modules", ".idea", "dist", "build", ".gradle", "windows-client\node_modules", "windows-client\dist", "android-client\.gradle", "android-client\app\build", "android-client\build", "windows-admin\node_modules")

# Robocopy throw exit codes < 8 as SUCCESS
& robocopy $ScriptDir $Destino /E /XD $excludeDirs /XF ".env" "config.json" /NFL /NDL /NJH /NJS /nc /ns /np
if ($LASTEXITCODE -ge 8) {
    Write-Error "Fallo en Robocopy copiando archivos."
}

Write-Host "[3/4] Inicializando nuevo repositorio Git..." -ForegroundColor Yellow
Set-Location -Path $Destino
& git init
& git add -A
& git commit -m "Inicializando código base para cliente $NombreCliente"

if ($UrlGithub) {
    Write-Host "[4/4] Subiendo a GitHub..." -ForegroundColor Yellow
    & git remote add origin $UrlGithub
    & git branch -M main
    & git push -u origin main
    
    Write-Host "`n¡Listo! El código está en GitHub." -ForegroundColor Green
    Write-Host "Ahora entra a Render.com, crea un nuevo Web Service enlazado a ese repositorio y listo." -ForegroundColor Cyan
} else {
    Write-Host "`n¡Listo! El código está preparado en la carpeta $Destino." -ForegroundColor Green
    Write-Host "Pero como no proporcionaste URL de GitHub, deberás subirlo manualmente." -ForegroundColor Yellow
}

Write-Host "=============================================" -ForegroundColor Cyan
Set-Location -Path $ScriptDir
