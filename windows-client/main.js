const { app, BrowserWindow, ipcMain, desktopCapturer, Menu, Tray, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, exec } = require('child_process');

// Disable hardware acceleration to prevent desktop capture freezes/stalls on GPU context switches (e.g. opening new windows) on Windows
app.disableHardwareAcceleration();

// Set Application User Model ID for Windows taskbar notifications and icon association
if (process.platform === 'win32') {
  app.setAppUserModelId('com.remotocontroljm.windowsclient');
}

let mainWindow;
let tray;
let inputSimulator;
const configPath = path.join(app.getPath('userData'), 'config.json');

// Default Configuration
let config = {
  serverUrl: 'https://remoto-control-jm.onrender.com',
  deviceId: 'win-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
  deviceName: require('os').hostname(),
  group: 'Sin Grupo',
  runOnStartup: true,
  configured: false
};

// Load Config from disk
function loadConfig() {
  if (fs.existsSync(configPath)) {
    try {
      const data = fs.readFileSync(configPath, 'utf8');
      config = { ...config, ...JSON.parse(data) };
      
      // Force migration to remote cloud URL if it is empty, local, or contains port 3000
      if (!config.serverUrl || config.serverUrl.includes('localhost') || config.serverUrl.includes('127.0.0.1') || config.serverUrl.includes(':3000') || config.serverUrl.includes('kpisrosti.com') || config.serverUrl.includes('acceso.rosti.cr')) {
        config.serverUrl = 'https://remoto-control-jm.onrender.com';
        saveConfig(config);
      }
    } catch (e) {
      console.error("Error parsing config file, using default config", e);
    }
  } else {
    saveConfig(config);
  }
  return config;
}

// Save Config to disk
function saveConfig(newConfig) {
  config = { ...config, ...newConfig };
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    // Update startup settings in Windows
    app.setLoginItemSettings({
      openAtLogin: config.runOnStartup,
      path: app.getPath('exe'),
      args: ['--hidden']
    });
  } catch (e) {
    console.error("Error writing config file", e);
  }
}

// Native Input Simulator startup
function startInputSimulator() {
  let simPath = path.join(__dirname, 'InputSimulator.exe');
  if (simPath.includes('app.asar')) {
    simPath = simPath.replace('app.asar', 'app.asar.unpacked');
  }
  if (fs.existsSync(simPath)) {
    console.log("Starting InputSimulator helper from:", simPath);
    inputSimulator = spawn(simPath, [], { stdio: ['pipe', 'pipe', 'pipe'] });

    inputSimulator.stdout.on('data', (data) => {
      console.log(`[Simulator STDOUT]: ${data.toString().trim()}`);
    });

    inputSimulator.stderr.on('data', (data) => {
      console.error(`[Simulator STDERR]: ${data.toString().trim()}`);
    });

    inputSimulator.on('close', (code) => {
      console.log(`InputSimulator process exited with code ${code}. Restarting...`);
      setTimeout(startInputSimulator, 2000);
    });
  } else {
    console.error("InputSimulator.exe not found! Mouse and keyboard control will not work.");
  }
}

// Single Instance Lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // Someone tried to run a second instance, focus our window.
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 440,
    height: 700,
    resizable: false,
    frame: false,
    transparent: true,
    skipTaskbar: false,
    show: false, // will show manually if not launched --hidden
    icon: path.join(__dirname, process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });

  mainWindow.loadFile('index.html');

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Client Console] ${message} (at ${sourceId}:${line})`);
  });

  // Do not exit app when window is closed, just hide it
  mainWindow.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
    }
    return false;
  });
}

function createTray() {
  // Create a tray icon
  let trayIconPath = path.join(__dirname, process.platform === 'win32' ? 'icon.ico' : 'icon.png');
  
  // For development fallback, use a built-in Electron icon or programmatic nativeImage
  let trayImage;
  if (fs.existsSync(trayIconPath)) {
    trayImage = nativeImage.createFromPath(trayIconPath);
  } else {
    // Generate a simple 16x16 red flame square using buffer
    const buffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABGdBTUEAALGPC/xhBQAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAAAX0lEQVR42mP8z8AARjDw/0eCgTwDEyM+eXQD0AxA1kAzAM0AJAOQDUAyANkAJAOQDWD4jw0M/6EYpAcZHwP9HlT3wGoAnP9gDADyP7ofUBwK/tPrQYoDQFqEGAgAAP6+O16Z6/Z+AAAAAElFTkSuQmCC',
      'base64'
    );
    trayImage = nativeImage.createFromBuffer(buffer);
  }

  tray = new Tray(trayImage.resize({ width: 16, height: 16 }));
  const contextMenu = Menu.buildFromTemplate([
    { 
      label: 'Abrir Panel de Control', 
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      } 
    },
    {
      label: 'Configuración Avanzada',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
        mainWindow.webContents.send('trigger-settings-unlock');
      }
    },
    { type: 'separator' },
    { 
      label: 'Salir', 
      click: () => {
        app.isQuiting = true;
        if (inputSimulator) inputSimulator.kill();
        if (vpnProcess) {
          try { vpnProcess.kill(); } catch (e) {}
        }
        const vpnExe = findVpnExecutable();
        if (vpnExe && vpnExe.toLowerCase().includes('fortisslvpnclient')) {
          const { execSync } = require('child_process');
          try { execSync(`"${vpnExe}" disconnect`); } catch(e) {}
        }
        app.quit();
      } 
    }
  ]);

  tray.setToolTip('Remoto Control J&M - Cliente Windows');
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    mainWindow.show();
    mainWindow.focus();
  });
}

app.whenReady().then(() => {
  loadConfig();
  startInputSimulator();
  createWindow();
  createTray();

  // If app is not started with --hidden flag, show the window
  const isHidden = process.argv.includes('--hidden');
  if (!isHidden) {
    mainWindow.once('ready-to-show', () => {
      mainWindow.show();
    });
  }

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    // Keep app running in tray
  }
});

// IPC Handler - Simulate Input via C# program
ipcMain.on('simulate-input', (event, cmd) => {
  if (inputSimulator && inputSimulator.stdin.writable) {
    inputSimulator.stdin.write(cmd + '\n');
  }
});

// IPC Handler - Write text to OS clipboard
ipcMain.on('clipboard-write', (event, text) => {
  const { clipboard } = require('electron');
  clipboard.writeText(text);
});

// IPC Handler - Get Screen Capturing Sources
ipcMain.handle('get-screen-sources', async () => {
  const sources = await desktopCapturer.getSources({ types: ['screen'] });
  return sources.map(source => ({
    id: source.id,
    name: source.name
  }));
});

// IPC Handler - Get current app version from package.json
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

// IPC Handler - Load & Save Settings
ipcMain.handle('load-config', () => {
  return loadConfig();
});

ipcMain.handle('save-config', (event, newConfig) => {
  saveConfig(newConfig);
  return config;
});

// IPC Handler - Window controls
ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-hide', () => {
  if (mainWindow) mainWindow.hide();
});

ipcMain.on('window-close', () => {
  // Minimize to tray instead of closing
  if (mainWindow) mainWindow.hide();
});

let vpnProcess = null;
let vpnStatusStr = 'disconnected';

function findVpnExecutable() {
  const candidates = [
    path.join(__dirname, 'FortiSSLVPNclient.exe'),
    path.join(__dirname, 'openfortivpn.exe'),
    'C:\\Program Files\\Fortinet\\FortiClient\\FortiSSLVPNclient.exe',
    'C:\\Program Files (x86)\\Fortinet\\FortiClient\\FortiSSLVPNclient.exe',
    'C:\\Procesos Rapidos Front Rest\\FortiSSLVPNclient.exe',
    'C:\\Procesos Rapidos Front Rest\\openfortivpn.exe'
  ];
  
  let appDir = __dirname;
  if (appDir.includes('app.asar')) {
    candidates.unshift(path.join(appDir.replace('app.asar', 'app.asar.unpacked'), 'FortiSSLVPNclient.exe'));
    candidates.unshift(path.join(appDir.replace('app.asar', 'app.asar.unpacked'), 'openfortivpn.exe'));
  }

  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return c;
    }
  }
  return null;
}

// VPN Connect IPC Handler
ipcMain.on('vpn-connect', (event, { gateway, user, pass }) => {
  if (vpnProcess && !vpnProcess.killed) {
    event.reply('vpn-connect-response', { success: true, message: 'VPN ya está conectada.' });
    return;
  }

  const vpnExe = findVpnExecutable();
  if (!vpnExe) {
    event.reply('vpn-connect-response', { 
      success: false, 
      message: 'No se encontró ningún cliente VPN compatible (FortiSSLVPNclient.exe o openfortivpn.exe). Por favor, colócalo en el directorio de la aplicación.' 
    });
    return;
  }

  vpnStatusStr = 'connecting';
  const isForti = vpnExe.toLowerCase().includes('fortisslvpnclient');
  
  let args = [];
  if (isForti) {
    args = ['connect', '-h', gateway, '-u', `${user}:${pass}`, '-i', '-q'];
  } else {
    args = [gateway, '-u', user, '-p', pass, '--trusted-cert', 'allow-all'];
  }

  console.log(`Iniciando túnel VPN con: ${vpnExe}`);

  try {
    vpnProcess = spawn(vpnExe, args, { stdio: 'pipe' });
    vpnStatusStr = 'connected';
    
    vpnProcess.stdout.on('data', (data) => {
      console.log(`[VPN STDOUT]: ${data.toString()}`);
    });

    vpnProcess.stderr.on('data', (data) => {
      console.error(`[VPN STDERR]: ${data.toString()}`);
    });

    vpnProcess.on('close', (code) => {
      console.log(`VPN process closed with code ${code}`);
      vpnProcess = null;
      vpnStatusStr = 'disconnected';
    });

    event.reply('vpn-connect-response', { success: true, message: 'Túnel VPN iniciado correctamente.' });
  } catch (err) {
    vpnStatusStr = 'disconnected';
    event.reply('vpn-connect-response', { success: false, message: `Error al iniciar VPN: ${err.message}` });
  }
});

// VPN Disconnect IPC Handler
ipcMain.on('vpn-disconnect', (event) => {
  if (vpnProcess) {
    try {
      vpnProcess.kill();
      const vpnExe = findVpnExecutable();
      if (vpnExe && vpnExe.toLowerCase().includes('fortisslvpnclient')) {
        const { exec } = require('child_process');
        exec(`"${vpnExe}" disconnect`, () => {});
      }
      vpnProcess = null;
      vpnStatusStr = 'disconnected';
      event.reply('vpn-disconnect-response', { success: true, message: 'VPN desconectada.' });
    } catch (err) {
      event.reply('vpn-disconnect-response', { success: false, message: `Error al desconectar: ${err.message}` });
    }
  } else {
    const vpnExe = findVpnExecutable();
    if (vpnExe && vpnExe.toLowerCase().includes('fortisslvpnclient')) {
      const { exec } = require('child_process');
      exec(`"${vpnExe}" disconnect`, () => {});
    }
    vpnStatusStr = 'disconnected';
    event.reply('vpn-disconnect-response', { success: true, message: 'VPN ya estaba desconectada.' });
  }
});

// VPN Status IPC Handler
ipcMain.on('vpn-status', (event) => {
  event.reply('vpn-status-response', { status: vpnStatusStr });
});

// Helper to run PowerShell scripts
const os = require('os');
function runPowerShellScript(scriptText, callback) {
  const tempDir = os.tmpdir();
  const tempFile = path.join(tempDir, `rosti_temp_${Math.random().toString(36).substring(2, 8)}.ps1`);
  
  try {
    fs.writeFileSync(tempFile, scriptText, 'utf8');
    exec(`powershell -ExecutionPolicy Bypass -File "${tempFile}"`, (err, stdout, stderr) => {
      try { fs.unlinkSync(tempFile); } catch(e) {}
      
      if (err) {
        callback({ success: false, message: err.message + '\n' + stderr });
      } else {
        try {
          const res = JSON.parse(stdout);
          callback(res);
        } catch (parseErr) {
          callback({ success: false, message: 'Error al parsear JSON devuelto por PowerShell: ' + stdout });
        }
      }
    });
  } catch (writeErr) {
    callback({ success: false, message: 'Error al escribir script temporal: ' + writeErr.message });
  }
}

// SQL Query Execution IPC Handler
ipcMain.on('execute-query', (event, { ip, db, query }) => {
  const psScript = `
$connString = "Server=${ip};Database=${db};User Id=sa;Password=masterkey;Connect Timeout=5;TrustServerCertificate=true;"
$conn = New-Object System.Data.SqlClient.SqlConnection($connString)
try {
    $conn.Open()
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = @'
${query}
'@
    if ($cmd.CommandText.Trim().ToUpper().StartsWith("SELECT")) {
        $adapter = New-Object System.Data.SqlClient.SqlDataAdapter($cmd)
        $table = New-Object System.Data.DataTable
        $adapter.Fill($table) | Out-Null
        $rows = @()
        foreach ($row in $table.Rows) {
            $obj = [ordered]@{ }
            foreach ($col in $table.Columns) {
                $obj.Add($col.ColumnName, $row[$col.ColumnName])
            }
            $rows += $obj
        }
        $result = @{ success = $true; data = $rows }
    } else {
        $affected = $cmd.ExecuteNonQuery()
        $result = @{ success = $true; message = "Operación completada exitosamente. Filas afectadas: $affected" }
    }
} catch {
    $result = @{ success = $false; message = $_.Exception.Message }
} finally {
    if ($conn.State -eq [System.Data.ConnectionState]::Open) {
        $conn.Close()
    }
}
$result | ConvertTo-Json -Depth 5
  `;

  runPowerShellScript(psScript, (res) => {
    event.reply('execute-query-response', res);
  });
});

// SQL xp_cmdshell Script / Local Batch Execution IPC Handler
ipcMain.on('execute-script', (event, { ip, command }) => {
  if (command === 'RUN_DESKTOP_INTEGRACION') {
    const path = require('path');
    const os = require('os');
    const { exec } = require('child_process');
    const fs = require('fs');

    const batContent = `@echo off
set ORIGEN=C:\\Program Files\\Integral\\Integral_ICG\\Respaldos_Configuracion\\1,84\\IntegradorServiciosICG.exe.config
set DESTINO=C:\\Program Files\\Integral\\Integral_ICG\\IntegradorServiciosICG.exe.config

:: Copiar el archivo con la opcion de sobrescribir
copy /Y "%ORIGEN%" "%DESTINO%"

:: Verificar si la operacion fue exitosa
if %errorlevel%==0 (
    echo Archivo copiado exitosamente.
) else (
    echo Error al copiar el archivo.
)
`;

    const tempDir = os.tmpdir();
    const tempBatPath = path.join(tempDir, 'integracion_temp.bat');

    try {
      fs.writeFileSync(tempBatPath, batContent, 'utf8');
      
      exec(`cmd.exe /c "${tempBatPath}"`, (error, stdout, stderr) => {
        try { fs.unlinkSync(tempBatPath); } catch(e) {}
        
        if (error) {
          event.reply('execute-script-response', {
            success: false,
            output: stdout,
            message: `Error al ejecutar integracion.bat: ${error.message}\n${stderr}`
          });
        } else {
          event.reply('execute-script-response', {
            success: true,
            output: stdout || 'Ejecutado correctamente (sin salida de consola).'
          });
        }
      });
    } catch (err) {
      event.reply('execute-script-response', {
        success: false,
        message: `Error al escribir el archivo bat temporal: ${err.message}`
      });
    }
    return;
  }

  const psScript = `
$connString = "Server=${ip};Database=master;User Id=sa;Password=masterkey;Connect Timeout=5;TrustServerCertificate=true;"
$conn = New-Object System.Data.SqlClient.SqlConnection($connString)
try {
    $conn.Open()
    $cmd = $conn.CreateCommand()
    
    # Habilitar xp_cmdshell
    $cmd.CommandText = "EXEC sp_configure 'show advanced options', 1; RECONFIGURE; EXEC sp_configure 'xp_cmdshell', 1; RECONFIGURE;"
    $cmd.ExecuteNonQuery() | Out-Null
    
    # Ejecutar el comando
    $command = @'
${command}
'@
    $escapedCmd = $command.Replace("'", "''")
    $cmd.CommandText = "EXEC xp_cmdshell '$escapedCmd';"
    $adapter = New-Object System.Data.SqlClient.SqlDataAdapter($cmd)
    $table = New-Object System.Data.DataTable
    $adapter.Fill($table) | Out-Null
    
    $output = @()
    foreach ($row in $table.Rows) {
        if ($row[0] -ne [DBNull]::Value) {
            $output += $row[0].ToString()
        }
    }
    $outputStr = $output -join "\`n"
    
    # Deshabilitar xp_cmdshell
    try {
        $cmd.CommandText = "EXEC sp_configure 'xp_cmdshell', 0; RECONFIGURE; EXEC sp_configure 'show advanced options', 0; RECONFIGURE;"
        $cmd.ExecuteNonQuery() | Out-Null
    } catch {}
    
    $result = @{ success = $true; output = $outputStr }
} catch {
    $result = @{ success = $false; message = $_.Exception.Message }
} finally {
    if ($conn.State -eq [System.Data.ConnectionState]::Open) {
        $conn.Close()
    }
}
$result | ConvertTo-Json
  `;

  runPowerShellScript(psScript, (res) => {
    event.reply('execute-script-response', res);
  });
});
