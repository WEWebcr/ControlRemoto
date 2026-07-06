const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const io = require('socket.io-client');
const { exec } = require('child_process');

let socket = null;

function getSystemSpecs(callback) {
  if (process.platform !== 'win32') {
    callback({
      marca: 'Generic',
      modelo: 'Generic Platform',
      serie: 'N/A',
      disco: 'N/A',
      so: process.platform,
      cpu: 'Generic CPU',
      ram: 'N/A'
    });
    return;
  }

  const psScript = `
$sys = Get-CimInstance Win32_ComputerSystem
$bios = Get-CimInstance Win32_BIOS
$os = Get-CimInstance Win32_OperatingSystem
$disk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'"
$cpu = (Get-CimInstance Win32_Processor).Name
$ram = [Math]::Round($sys.TotalPhysicalMemory / 1GB)
$diskSize = [Math]::Round($disk.Size / 1GB)

$specs = @{
  marca = $sys.Manufacturer.Trim()
  modelo = $sys.Model.Trim()
  serie = $bios.SerialNumber.Trim()
  so = $os.Caption.Trim()
  disco = "$diskSize GB"
  cpu = $cpu.Trim()
  ram = "$ram GB"
}
$specs | ConvertTo-Json
  `;

  const tempDir = os.tmpdir();
  const tempFile = path.join(tempDir, 'rosti_specs_query.ps1');
  try {
    fs.writeFileSync(tempFile, psScript, 'utf8');
    exec(`powershell -ExecutionPolicy Bypass -File "${tempFile}"`, (err, stdout, stderr) => {
      try { fs.unlinkSync(tempFile); } catch(e) {}
      if (err) {
        console.error("Failed to query system specs:", err);
        callback({
          marca: 'Generic Brand',
          modelo: 'Generic Model',
          serie: 'N/A',
          disco: 'N/A',
          so: 'Windows',
          cpu: 'N/A',
          ram: 'N/A'
        });
        return;
      }
      try {
        const specs = JSON.parse(stdout);
        callback(specs);
      } catch (parseErr) {
        console.error("Failed to parse system specs:", parseErr);
        callback({
          marca: 'Generic Brand',
          modelo: 'Generic Model',
          serie: 'N/A',
          disco: 'N/A',
          so: 'Windows',
          cpu: 'N/A',
          ram: 'N/A'
        });
      }
    });
  } catch (writeErr) {
    console.error("Failed to write temp specs file:", writeErr);
    callback({
      marca: 'Generic Brand',
      modelo: 'Generic Model',
      serie: 'N/A',
      disco: 'N/A',
      so: 'Windows',
      cpu: 'N/A',
      ram: 'N/A'
    });
  }
}

contextBridge.exposeInMainWorld('electronAPI', {
  // Input simulation forwarding
  sendInputCmd: (cmd) => ipcRenderer.send('simulate-input', cmd),
  writeClipboard: (text) => ipcRenderer.send('clipboard-write', text),

  // Screen source fetching
  getScreenSources: () => ipcRenderer.invoke('get-screen-sources'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // Config management
  loadConfig: () => ipcRenderer.invoke('load-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  getHostName: () => os.hostname(),

  // Window control
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  hideWindow: () => ipcRenderer.send('window-hide'),
  closeWindow: () => ipcRenderer.send('window-close'),

  // Socket Connection and Signaling (via HTML events)
  connectSocket: (url, deviceId, deviceName, group) => {
    if (socket) socket.disconnect();
    
    console.log(`Preload connecting to signaling server: ${url} for room: ${deviceId}`);
    socket = io(url, {
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000
    });

    socket.on('connect', () => {
      window.dispatchEvent(new CustomEvent('socket-connected'));
      getSystemSpecs(async (specs) => {
        let appVersion = 'N/A';
        try {
          appVersion = await ipcRenderer.invoke('get-app-version');
        } catch (e) {
          console.error("Error fetching app version:", e);
        }
        const enrichedSpecs = {
          ...specs,
          name: deviceName,
          group: group,
          clientVersion: appVersion
        };
        socket.emit('register-device', deviceId, enrichedSpecs);
      });
    });

    socket.on('connect_error', (err) => {
      window.dispatchEvent(new CustomEvent('socket-connect-error', { 
        detail: { message: err.message, active: socket ? socket.active : false } 
      }));
    });

    socket.on('disconnect', (reason) => {
      window.dispatchEvent(new CustomEvent('socket-disconnected', { 
        detail: { reason: reason, active: socket ? socket.active : false } 
      }));
    });

    socket.on('offer', (offer) => {
      window.dispatchEvent(new CustomEvent('socket-offer', { detail: offer }));
    });

    socket.on('ice-candidate', (candidate) => {
      window.dispatchEvent(new CustomEvent('socket-ice-candidate', { detail: candidate }));
    });

    socket.on('user-disconnected', () => {
      window.dispatchEvent(new CustomEvent('socket-user-disconnected'));
    });

    // Relés para Automatización de VPN SSL y Queries
    socket.on('vpn-connect', (data) => {
      console.log('socket.on vpn-connect:', data.gateway);
      ipcRenderer.once('vpn-connect-response', (event, res) => {
        socket.emit('vpn-connect-response', {
          adminSocketId: data.adminSocketId,
          success: res.success,
          message: res.message
        });
      });
      ipcRenderer.send('vpn-connect', { gateway: data.gateway, user: data.user, pass: data.pass });
    });

    socket.on('vpn-disconnect', (data) => {
      console.log('socket.on vpn-disconnect');
      ipcRenderer.once('vpn-disconnect-response', (event, res) => {
        socket.emit('vpn-disconnect-response', {
          adminSocketId: data.adminSocketId,
          success: res.success,
          message: res.message
        });
      });
      ipcRenderer.send('vpn-disconnect');
    });

    socket.on('vpn-status-request', (data) => {
      ipcRenderer.once('vpn-status-response', (event, res) => {
        socket.emit('vpn-status-response', {
          adminSocketId: data.adminSocketId,
          status: res.status
        });
      });
      ipcRenderer.send('vpn-status');
    });

    socket.on('execute-query', (data) => {
      console.log('socket.on execute-query:', data.db, data.ip);
      ipcRenderer.once('execute-query-response', (event, res) => {
        socket.emit('execute-query-response', {
          adminSocketId: data.adminSocketId,
          ...res
        });
      });
      ipcRenderer.send('execute-query', { ip: data.ip, db: data.db, query: data.query });
    });

    socket.on('execute-script', (data) => {
      console.log('socket.on execute-script:', data.ip, data.command);
      ipcRenderer.once('execute-script-response', (event, res) => {
        socket.emit('execute-script-response', {
          adminSocketId: data.adminSocketId,
          ...res
        });
      });
      ipcRenderer.send('execute-script', { ip: data.ip, command: data.command });
    });
  },

  disconnectSocket: () => {
    if (socket) {
      socket.disconnect();
      socket = null;
      window.dispatchEvent(new CustomEvent('socket-disconnected', { detail: 'manual' }));
    }
  },

  sendAnswer: (deviceId, answer) => {
    if (socket) socket.emit('answer', { roomId: deviceId, answer });
  },

  sendIceCandidate: (deviceId, candidate) => {
    if (socket) socket.emit('ice-candidate', { roomId: deviceId, candidate });
  },

  // File Manager Helpers (to execute inside Node sandbox)
  fs: {
    listDir: (dirPath) => {
      try {
        let targetPath = dirPath;
        
        // If empty path, default to home directory
        if (!targetPath) {
          targetPath = os.homedir();
        }

        // Standardize path separators for Windows
        targetPath = path.resolve(targetPath).replace(/\\/g, '/');

        if (!fs.existsSync(targetPath)) {
          return { error: 'El directorio no existe.' };
        }

        const stats = fs.statSync(targetPath);
        if (!stats.isDirectory()) {
          return { error: 'La ruta no es un directorio.' };
        }

        const filesList = [];

        // Add parent directory link (unless we are at root level like C:/)
        const parentPath = path.dirname(targetPath).replace(/\\/g, '/');
        if (parentPath !== targetPath) {
          filesList.push({
            name: '..',
            type: 'folder',
            size: '',
            date: ''
          });
        }

        const items = fs.readdirSync(targetPath);
        for (const item of items) {
          try {
            const itemPath = path.join(targetPath, item).replace(/\\/g, '/');
            const itemStats = fs.statSync(itemPath);

            // Format date
            const dateStr = itemStats.mtime.toISOString().replace('T', ' ').substring(0, 16);

            // Format size
            let sizeStr = '';
            if (itemStats.isFile()) {
              const bytes = itemStats.size;
              if (bytes < 1024) sizeStr = `${bytes} B`;
              else if (bytes < 1024 * 1024) sizeStr = `${(bytes / 1024).toFixed(1)} KB`;
              else if (bytes < 1024 * 1024 * 1024) sizeStr = `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
              else sizeStr = `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
            }

            filesList.push({
              name: item,
              type: itemStats.isDirectory() ? 'folder' : 'file',
              size: sizeStr,
              date: dateStr
            });
          } catch (e) {
            // Ignore items with access restrictions (e.g. system volume information)
          }
        }

        // Sort: folders first, then files
        filesList.sort((a, b) => {
          if (a.name === '..') return -1;
          if (b.name === '..') return 1;
          if (a.type === 'folder' && b.type !== 'folder') return -1;
          if (a.type !== 'folder' && b.type === 'folder') return 1;
          return a.name.localeCompare(b.name);
        });

        return {
          currentPath: targetPath,
          files: filesList
        };

      } catch (err) {
        return { error: err.message };
      }
    },

    // Reading file chunks for downloading from controlled PC
    startDownloadStream: (filePath, onChunk, onComplete, onError) => {
      try {
        const resolvedPath = path.resolve(filePath);
        if (!fs.existsSync(resolvedPath)) {
          onError('El archivo no existe.');
          return;
        }

        const stats = fs.statSync(resolvedPath);
        if (!stats.isFile()) {
          onError('La ruta no corresponde a un archivo.');
          return;
        }

        const stream = fs.createReadStream(resolvedPath, { highWaterMark: 64 * 1024 }); // 64KB chunks
        
        stream.on('data', (chunk) => {
          // Convert Buffer to ArrayBuffer to pass through ContextBridge
          const arrayBuffer = chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength);
          onChunk(arrayBuffer);
        });

        stream.on('end', () => {
          onComplete();
        });

        stream.on('error', (err) => {
          onError(err.message);
        });

      } catch (err) {
        onError(err.message);
      }
    },

    // Writing files uploaded to this PC
    startUploadStream: (filePath) => {
      try {
        const resolvedPath = path.resolve(filePath);
        // Ensure parent directory exists
        const dir = path.dirname(resolvedPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        
        const writeStream = fs.createWriteStream(resolvedPath);
        return {
          write: (arrayBuffer) => {
            const buffer = Buffer.from(arrayBuffer);
            writeStream.write(buffer);
          },
          close: () => {
            writeStream.end();
          }
        };
      } catch (err) {
        console.error("Error creating upload write stream", err);
        throw err;
      }
    }
  },

  // VPN SSL Automation
  vpnConnect: (gateway, user, pass, callback) => {
    ipcRenderer.once('vpn-connect-response', (event, res) => callback(res));
    ipcRenderer.send('vpn-connect', { gateway, user, pass });
  },
  vpnDisconnect: (callback) => {
    ipcRenderer.once('vpn-disconnect-response', (event, res) => callback(res));
    ipcRenderer.send('vpn-disconnect');
  },
  vpnStatus: (callback) => {
    ipcRenderer.once('vpn-status-response', (event, res) => callback(res));
    ipcRenderer.send('vpn-status');
  },

  // SQL Execution via PowerShell
  executeSQLQuery: (ip, db, query, callback) => {
    ipcRenderer.once('execute-query-response', (event, res) => callback(res));
    ipcRenderer.send('execute-query', { ip, db, query });
  },
  executeSQLScript: (ip, command, callback) => {
    ipcRenderer.once('execute-script-response', (event, res) => callback(res));
    ipcRenderer.send('execute-script', { ip, command });
  }
});

// Escuchar evento IPC desde la bandeja del sistema para abrir ajustes
ipcRenderer.on('trigger-settings-unlock', () => {
  window.dispatchEvent(new CustomEvent('tray-trigger-settings-unlock'));
});
