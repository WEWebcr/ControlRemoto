$sdkPath = "$env:LOCALAPPDATA\Android\Sdk"
$cmdlineToolsPath = "$sdkPath\cmdline-tools\latest"
$zipPath = "$env:TEMP\cmdline-tools.zip"

Write-Host "Creating directories..."
New-Item -ItemType Directory -Force -Path $sdkPath | Out-Null

Write-Host "Downloading command line tools..."
Invoke-WebRequest -Uri "https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip" -OutFile $zipPath

Write-Host "Extracting..."
Expand-Archive -Path $zipPath -DestinationPath "$sdkPath\cmdline-tools" -Force
Rename-Item -Path "$sdkPath\cmdline-tools\cmdline-tools" -NewName "latest" -ErrorAction SilentlyContinue

Write-Host "Accepting licenses and installing SDK..."
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$sdkManager = "$cmdlineToolsPath\bin\sdkmanager.bat"
cmd.exe /c "yes | `"$sdkManager`" --licenses"
& $sdkManager "platform-tools" "platforms;android-34" "build-tools;34.0.0"

Write-Host "Setting ANDROID_HOME..."
[System.Environment]::SetEnvironmentVariable("ANDROID_HOME", $sdkPath, "User")
Write-Host "Installation Complete."
