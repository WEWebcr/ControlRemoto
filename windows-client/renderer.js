// DOM Elements
const statusText = document.getElementById('status-text');
const statusDot = document.getElementById('status-dot');
const radar = document.getElementById('radar');

const deviceIdInput = document.getElementById('device-id');
const serverUrlInput = document.getElementById('server-url');
const deviceNameInput = document.getElementById('device-name');
const deviceGroupInput = document.getElementById('device-group');
const runStartupCheck = document.getElementById('run-startup');

const btnMinimize = document.getElementById('btn-minimize');
const btnClose = document.getElementById('btn-close');
const btnCopy = document.getElementById('btn-copy');
const btnSave = document.getElementById('btn-save');
const btnSettings = document.getElementById('btn-settings');

// New DOM Elements for Simplified View
const deviceIdDisplay = document.getElementById('device-id-display');
const btnCopyDisplay = document.getElementById('btn-copy-display');
const formCard = document.getElementById('form-card');
const statusDetailsCard = document.getElementById('status-details-card');
const lblDeviceName = document.getElementById('lbl-device-name');
const lblDeviceGroup = document.getElementById('lbl-device-group');
const serverUrlField = document.getElementById('server-url-field');

// Password modal elements
const passwordModal = document.getElementById('password-modal');
const settingsPassInput = document.getElementById('settings-pass-input');
const passwordError = document.getElementById('password-error');
const btnModalCancel = document.getElementById('btn-modal-cancel');
const btnModalUnlock = document.getElementById('btn-modal-unlock');

let config = null;
let peerConnection = null;
let localStream = null;
let activeUploadStream = null;

// WebRTC STUN/TURN configuration
const iceConfiguration = { 
  iceServers: [
    { urls: "stun:stun.relay.metered.ca:80" },
    { urls: "stun:global.relay.metered.ca:80" },
    { urls: "turn:global.relay.metered.ca:80", username: "93d3531d6cb9d21936c44b01", credential: "1WRQmmSv2+K85BnG" },
    { urls: "turn:global.relay.metered.ca:80?transport=tcp", username: "93d3531d6cb9d21936c44b01", credential: "1WRQmmSv2+K85BnG" },
    { urls: "turn:global.relay.metered.ca:443", username: "93d3531d6cb9d21936c44b01", credential: "1WRQmmSv2+K85BnG" },
    { urls: "turns:global.relay.metered.ca:443?transport=tcp", username: "93d3531d6cb9d21936c44b01", credential: "1WRQmmSv2+K85BnG" }
  ] 
};

// Update UI Connection Status
function updateConnectionUI(status) {
  statusDot.className = 'status-dot';
  if (status === 'connected') {
    statusDot.classList.add('connected');
    statusText.innerText = 'En Línea';
    radar.style.display = 'none';
  } else if (status === 'connecting') {
    statusDot.classList.add('connecting');
    statusText.innerText = 'Conectando...';
    radar.style.display = 'block';
  } else {
    statusDot.classList.add('disconnected');
    statusText.innerText = 'Desconectado';
    radar.style.display = 'none';
  }
}

// Fetch groups list from server
async function loadGroupsFromServer(serverUrl, currentGroup) {
  try {
    const response = await fetch(`${serverUrl}/api/groups`);
    if (response.ok) {
      const groups = await response.json();
      if (Array.isArray(groups)) {
        deviceGroupInput.innerHTML = '';
        if (!groups.includes('Sin Grupo')) {
          groups.unshift('Sin Grupo');
        }
        groups.forEach(g => {
          const opt = document.createElement('option');
          opt.value = g;
          opt.textContent = g;
          if (g === currentGroup) {
            opt.selected = true;
          }
          deviceGroupInput.appendChild(opt);
        });
        return;
      }
    }
  } catch (err) {
    console.error("Error loading groups from server:", err);
  }

  // Fallback if fetch fails
  deviceGroupInput.innerHTML = '';
  const defs = ['Sin Grupo'];
  if (currentGroup && currentGroup !== 'Sin Grupo') {
    defs.push(currentGroup);
  }
  defs.forEach(g => {
    const opt = document.createElement('option');
    opt.value = g;
    opt.textContent = g;
    if (g === currentGroup) {
      opt.selected = true;
    }
    deviceGroupInput.appendChild(opt);
  });
}

// Switch UI modes
function updateViewMode() {
  if (config.configured) {
    formCard.style.display = 'none';
    statusDetailsCard.style.display = 'flex';
    deviceIdDisplay.value = config.deviceId;
    lblDeviceName.innerText = config.deviceName || window.electronAPI.getHostName();
    lblDeviceGroup.innerText = config.group || 'Sin Grupo';
  } else {
    formCard.style.display = 'flex';
    statusDetailsCard.style.display = 'none';
  }
  // Siempre ocultamos el campo del servidor al actualizar el modo de vista general
  serverUrlField.style.display = 'none';
}

// Password verification modal helpers
function showUnlockModal() {
  passwordModal.style.display = 'flex';
  settingsPassInput.value = '';
  passwordError.style.display = 'none';
  settingsPassInput.focus();
}

function hideUnlockModal() {
  passwordModal.style.display = 'none';
  settingsPassInput.value = '';
  passwordError.style.display = 'none';
}

// Load Configuration on startup
async function startApp() {
  config = await window.electronAPI.loadConfig();
  
  deviceIdInput.value = config.deviceId;
  serverUrlInput.value = config.serverUrl;
  deviceNameInput.value = config.deviceName || window.electronAPI.getHostName();
  runStartupCheck.checked = config.runOnStartup;

  // Set version dynamically in the footer
  try {
    const appVersion = await window.electronAPI.getAppVersion();
    const versionEl = document.getElementById('app-version');
    if (versionEl) {
      versionEl.innerText = `v${appVersion}`;
    }
  } catch (e) {
    console.error("Error setting version in UI:", e);
  }

  await loadGroupsFromServer(config.serverUrl, config.group);
  updateViewMode();

  // Auto-connect
  connectToSignaling();
}

// Trigger socket connection
function connectToSignaling() {
  updateConnectionUI('connecting');
  const name = (config.deviceName || window.electronAPI.getHostName() || '').trim();
  const group = (config.group || 'Sin Grupo').trim();
  window.electronAPI.connectSocket(config.serverUrl.trim(), config.deviceId.trim(), name, group);
}

// Teardown WebRTC session
function closeWebRTC() {
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  if (activeUploadStream) {
    try { activeUploadStream.close(); } catch (e) {}
    activeUploadStream = null;
  }
  console.log("WebRTC connection closed and cleaned up.");
}

// Window Controls
btnMinimize.addEventListener('click', () => window.electronAPI.minimizeWindow());
btnClose.addEventListener('click', () => window.electronAPI.hideWindow());

// Copy Device ID (Both inputs)
const handleCopyId = (inputEl, btnEl) => {
  navigator.clipboard.writeText(inputEl.value);
  btnEl.style.color = '#10b981';
  setTimeout(() => {
    btnEl.style.color = '';
  }, 2000);
};

btnCopy.addEventListener('click', () => handleCopyId(deviceIdInput, btnCopy));
btnCopyDisplay.addEventListener('click', () => handleCopyId(deviceIdDisplay, btnCopyDisplay));

// Settings Modal Action
btnModalUnlock.addEventListener('click', async () => {
  const enteredPass = settingsPassInput.value;
  if (enteredPass === 'R0st1p017') {
    hideUnlockModal();
    // Load fresh groups from server if possible before showing editing form
    await loadGroupsFromServer(config.serverUrl, config.group);
    formCard.style.display = 'flex';
    statusDetailsCard.style.display = 'none';
    // Revelar el Servidor de Señalización al desbloquear con contraseña
    serverUrlField.style.display = 'flex';
  } else {
    passwordError.style.display = 'block';
    settingsPassInput.select();
  }
});

settingsPassInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    btnModalUnlock.click();
  } else if (e.key === 'Escape') {
    hideUnlockModal();
  }
});

btnModalCancel.addEventListener('click', hideUnlockModal);
btnSettings.addEventListener('click', showUnlockModal);

// Tray listener
window.addEventListener('tray-trigger-settings-unlock', () => {
  showUnlockModal();
});

// Save Settings
btnSave.addEventListener('click', async () => {
  const newConfig = {
    serverUrl: serverUrlInput.value.trim(),
    deviceName: deviceNameInput.value.trim(),
    group: deviceGroupInput.value,
    runOnStartup: runStartupCheck.checked,
    configured: true
  };

  config = await window.electronAPI.saveConfig(newConfig);
  updateViewMode();
  closeWebRTC();
  connectToSignaling();
});

// Listeners for Socket Connection (via Custom HTML events from Preload)
window.addEventListener('socket-connected', () => {
  console.log("Socket connection established successfully!");
  updateConnectionUI('connected');
});

window.addEventListener('socket-connect-error', (e) => {
  console.error("Socket connection error:", e.detail.message);
  if (e.detail.active) {
    updateConnectionUI('connecting');
  } else {
    updateConnectionUI('disconnected');
  }
});

window.addEventListener('socket-disconnected', (e) => {
  console.log("Socket disconnected:", e.detail.reason);
  closeWebRTC();
  if (e.detail.active) {
    updateConnectionUI('connecting');
  } else {
    updateConnectionUI('disconnected');
  }
});

window.addEventListener('socket-user-disconnected', () => {
  console.log("Admin disconnected from room. Closing WebRTC session.");
  closeWebRTC();
});

let currentSessionId = 0;

// Handle WebRTC Offer
window.addEventListener('socket-offer', async (e) => {
  const offer = e.detail;
  console.log("Received WebRTC Offer from admin.");
  
  // Increment session ID to cancel/supersede any pending setup async tasks
  const sessionId = ++currentSessionId;
  
  // Close any existing session
  closeWebRTC();

  try {
    const myPeerConnection = new RTCPeerConnection(iceConfiguration);
    peerConnection = myPeerConnection; // set global

    // Forward local screen capture to PeerConnection
    const sources = await window.electronAPI.getScreenSources();
    
    // Check if superseded during the getScreenSources await
    if (sessionId !== currentSessionId) {
      console.log(`[WebRTC] Session ${sessionId} was superseded during sources fetch. Aborting setup.`);
      myPeerConnection.close();
      return;
    }

    if (!sources || sources.length === 0) {
      throw new Error("No screen capture sources found.");
    }
    
    // Select primary screen (usually first source)
    const primarySource = sources[0];

    // Capture primary screen using standard Electron capture constraints (1080p limit at capture level)
    const myLocalStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: primarySource.id,
          maxWidth: 1920,
          maxHeight: 1080,
          maxFrameRate: 15
        }
      }
    });

    // Check if superseded during the getUserMedia await
    if (sessionId !== currentSessionId) {
      console.log(`[WebRTC] Session ${sessionId} was superseded during capture. Aborting setup.`);
      myLocalStream.getTracks().forEach(track => track.stop());
      myPeerConnection.close();
      return;
    }

    localStream = myLocalStream; // set global

    myLocalStream.getTracks().forEach(track => {
      myPeerConnection.addTrack(track, myLocalStream);
    });

    // ICE Candidate Callback
    myPeerConnection.onicecandidate = (event) => {
      if (sessionId !== currentSessionId) return;
      if (event.candidate) {
        window.electronAPI.sendIceCandidate(config.deviceId, event.candidate.toJSON());
      }
    };

    // Connection state changes
    myPeerConnection.onconnectionstatechange = () => {
      if (sessionId !== currentSessionId) return;
      console.log(`WebRTC Connection State: ${myPeerConnection.connectionState}`);
      if (myPeerConnection.connectionState === 'disconnected' || 
          myPeerConnection.connectionState === 'failed' || 
          myPeerConnection.connectionState === 'closed') {
        closeWebRTC();
      }
    };

    // Receive Data Channels from Admin
    myPeerConnection.ondatachannel = (event) => {
      if (sessionId !== currentSessionId) return;
      const channel = event.channel;
      console.log(`Opened DataChannel: ${channel.label}`);

      if (channel.label === 'control') {
        channel.onmessage = (msgEvent) => {
          try {
            const data = JSON.parse(msgEvent.data);
            if (data.type === 'move') {
              window.electronAPI.sendInputCmd(`move ${data.x} ${data.y}`);
            } else if (data.type === 'down') {
              window.electronAPI.sendInputCmd(`move ${data.x} ${data.y}`);
              window.electronAPI.sendInputCmd('down');
            } else if (data.type === 'up') {
              window.electronAPI.sendInputCmd('up');
            } else if (data.type === 'rightdown') {
              window.electronAPI.sendInputCmd(`move ${data.x} ${data.y}`);
              window.electronAPI.sendInputCmd('rightdown');
            } else if (data.type === 'rightup') {
              window.electronAPI.sendInputCmd('rightup');
            } else if (data.type === 'key') {
              window.electronAPI.sendInputCmd(`key ${data.key}`);
            } else if (data.type === 'wheel') {
              window.electronAPI.sendInputCmd(`wheel ${data.x}`);
            } else if (data.type === 'sas') {
              window.electronAPI.sendInputCmd('sas');
            } else if (data.type === 'clipboard') {
              window.electronAPI.writeClipboard(data.text);
              window.electronAPI.sendInputCmd('paste');
            }
          } catch (err) {
            console.error("Error processing control channel data:", err);
          }
        };
      } 
      else if (channel.label === 'files') {
        channel.binaryType = 'arraybuffer';
        channel.onmessage = (msgEvent) => {
          // If binary chunk received
          if (msgEvent.data instanceof ArrayBuffer) {
            if (activeUploadStream) {
              activeUploadStream.write(msgEvent.data);
            }
          } 
          // If command string received
          else if (typeof msgEvent.data === 'string') {
            try {
              const cmdData = JSON.parse(msgEvent.data);
              
              if (cmdData.cmd === 'LIST_DIR') {
                console.log('[Client] Recibido LIST_DIR para ruta:', cmdData.path);
                const result = window.electronAPI.fs.listDir(cmdData.path);
                console.log('[Client] Resultado listDir:', result.error ? 'Error: ' + result.error : (result.files ? result.files.length + ' archivos' : 'sin archivos'));
                try {
                  channel.send(JSON.stringify({ type: 'DIR_LIST', data: result }));
                  console.log('[Client] Enviada respuesta DIR_LIST.');
                } catch (sendErr) {
                  console.error('[Client] Error al enviar DIR_LIST por RTCDataChannel:', sendErr);
                }
              } 
              else if (cmdData.cmd === 'REQ_DOWNLOAD') {
                const targetFile = cmdData.path;
                const fileName = targetFile.split('/').pop().split('\\').pop();

                // Request start
                channel.send(JSON.stringify({
                  type: 'DOWNLOAD_START',
                  name: fileName,
                  size: 0 // Will stream until DOWNLOAD_END
                }));

                // Stream chunks
                window.electronAPI.fs.startDownloadStream(
                  targetFile,
                  (chunk) => {
                    // Send binary chunk
                    if (channel.readyState === 'open') {
                      channel.send(chunk);
                    }
                  },
                  () => {
                    // On complete
                    if (channel.readyState === 'open') {
                      channel.send(JSON.stringify({ type: 'DOWNLOAD_END' }));
                    }
                  },
                  (err) => {
                    // On error
                    if (channel.readyState === 'open') {
                      channel.send(JSON.stringify({ type: 'DOWNLOAD_ERROR', msg: err }));
                    }
                  }
                );
              } 
              else if (cmdData.cmd === 'UPLOAD_START') {
                if (activeUploadStream) activeUploadStream.close();
                activeUploadStream = window.electronAPI.fs.startUploadStream(cmdData.path);
              } 
              else if (cmdData.cmd === 'UPLOAD_END') {
                if (activeUploadStream) {
                  activeUploadStream.close();
                  activeUploadStream = null;
                }
                channel.send(JSON.stringify({ type: 'UPLOAD_SUCCESS' }));
              }
            } catch (err) {
              console.error("Error processing file channel data:", err);
            }
          }
        };
      }
    };

    // Set Remote Offer and Send Answer
    await myPeerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    
    // Check if superseded during setRemoteDescription await
    if (sessionId !== currentSessionId) {
      console.log(`[WebRTC] Session ${sessionId} was superseded during setRemoteDescription. Aborting.`);
      myLocalStream.getTracks().forEach(track => track.stop());
      myPeerConnection.close();
      return;
    }

    const answer = await myPeerConnection.createAnswer();
    
    // Check if superseded during createAnswer await
    if (sessionId !== currentSessionId) {
      console.log(`[WebRTC] Session ${sessionId} was superseded during createAnswer. Aborting.`);
      myLocalStream.getTracks().forEach(track => track.stop());
      myPeerConnection.close();
      return;
    }

    await myPeerConnection.setLocalDescription(answer);
    
    // Check if superseded during setLocalDescription await
    if (sessionId !== currentSessionId) {
      console.log(`[WebRTC] Session ${sessionId} was superseded during setLocalDescription. Aborting.`);
      myLocalStream.getTracks().forEach(track => track.stop());
      myPeerConnection.close();
      return;
    }

    // Apply WebRTC encoding parameters (bitrate, framerate, and resolution downscaling)
    try {
      const transceivers = myPeerConnection.getTransceivers();
      const videoTransceiver = transceivers.find(t => t.sender.track?.kind === 'video');
      if (videoTransceiver) {
        const sender = videoTransceiver.sender;
        const parameters = sender.getParameters();
        if (!parameters.encodings) {
          parameters.encodings = [{}];
        }
        
        // Dynamic downscaling based on the actual captured resolution of the video track.
        // We target a max width of 1280px to optimize performance on VP8/VP9 software encoders.
        const videoTrack = myLocalStream.getVideoTracks()[0];
        if (videoTrack) {
          const settings = videoTrack.getSettings();
          const width = settings.width || 1920;
          
          let scaleFactor = 1.0;
          if (width > 1280) {
            scaleFactor = width / 1280;
          }
          
          if (scaleFactor > 1.0) {
            parameters.encodings[0].scaleResolutionDownBy = scaleFactor;
            console.log(`[WebRTC] High captured resolution detected: ${width}px width. Enforcing encoder downscaling by ${scaleFactor.toFixed(2)}x in RTCRtpSender.`);
          }
        }
        
        // Cap max bitrate to 900 kbps and framerate to 15 FPS. This guarantees fluid stream delivery
        // and low CPU load even on low-end remote terminals and mobile networks.
        parameters.encodings[0].maxBitrate = 900000;
        parameters.encodings[0].maxFramerate = 15;
        
        await sender.setParameters(parameters);
        console.log("[WebRTC] Encoder RTCRtpSender parameters applied successfully after local description:", parameters.encodings[0]);
      }
    } catch (encErr) {
      console.warn("[WebRTC] Failed to set encoder parameters on RTCRtpSender:", encErr);
    }
    
    window.electronAPI.sendAnswer(config.deviceId, { type: answer.type, sdp: answer.sdp });
    console.log("Sent WebRTC Answer to admin.");

  } catch (err) {
    console.error("Error setting up WebRTC session:", err);
    if (sessionId === currentSessionId) {
      closeWebRTC();
    }
  }
});

// Handle ICE Candidates
window.addEventListener('socket-ice-candidate', async (e) => {
  const candidate = e.detail;
  if (peerConnection) {
    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.error("Error adding received ICE candidate:", err);
    }
  }
});

// Initialize App
startApp();
