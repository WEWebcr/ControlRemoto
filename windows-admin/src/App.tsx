import { useState, useRef, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { Monitor, Users, LogOut, ChevronLeft, ClipboardList, Mail, Terminal } from 'lucide-react';
import DeviceManager from './components/DeviceManager';
import ScreenViewer from './components/ScreenViewer';
import FileManager from './components/FileManager';
import Login from './components/Login';
import UsersManager from './components/UsersManager';
import AssetReport from './components/AssetReport';
import MonitoringManager from './components/MonitoringManager';
import ProcesosRapidos from './components/ProcesosRapidos';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentServerUrl, setCurrentServerUrl] = useState('https://rosti-server.onrender.com');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [roomId, setRoomId] = useState('');
  
  // New Navigation State
  const [activeView, setActiveView] = useState<'devices' | 'users' | 'assets' | 'monitoring' | 'proceso-rapido'>('devices');
  const [onlineDevicesDetails, setOnlineDevicesDetails] = useState<any[]>([]);
  
  const [currentUser, setCurrentUser] = useState({ username: '', role: '', token: '' });
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [onlineDevices, setOnlineDevices] = useState<string[]>([]);
  const [fileChannel, setFileChannel] = useState<RTCDataChannel | null>(null);
  
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const isRemoteDescriptionSetRef = useRef(false);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  useEffect(() => {
    if (isAuthenticated) {
      const globalSocket = io(currentServerUrl, {
        auth: { token: currentUser.token }
      });
      
      globalSocket.on('connect', () => {
        console.log("Conectado al servidor como Administrador");
      });
      
      globalSocket.on('online-devices', (devices: string[]) => {
        setOnlineDevices(devices);
      });
      
      globalSocket.on('devices-update', (devices: any[]) => {
        const clients = devices.filter((d: any) => d.isAndroid || d.isWindows);
        const clientIds = clients.map((d: any) => d.roomId);
        setOnlineDevices(clientIds);
        setOnlineDevicesDetails(clients);
      });
      
      setSocket(globalSocket);
      
      return () => {
        globalSocket.disconnect();
      };
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isConnected && roomId && !onlineDevices.includes(roomId)) {
      console.log('El dispositivo remoto se desconectó. Terminando sesión.');
      disconnect();
    }
  }, [onlineDevices, isConnected, roomId]);

  const connectToSignalingServer = async (roomIdToJoin: string, targetView: 'screen' | 'files') => {
    if (!socket) return;
    setIsConnecting(true);
    
    socket.off('answer');
    socket.off('ice-candidate');

    socket.emit('join-room', roomIdToJoin);
    setIsConnected(true);
    setIsConnecting(false);
    setRoomId(roomIdToJoin);
    
    setupWebRTC(socket, roomIdToJoin);

    try {
      const offer = await peerConnectionRef.current?.createOffer();
      if (offer) {
        await peerConnectionRef.current?.setLocalDescription(offer);
        socket.emit('offer', { roomId: roomIdToJoin, offer });
      }
    } catch (err) {
      console.error("Error creating offer:", err);
    }

    socket.on('answer', async (answer) => {
      if (!peerConnectionRef.current) return;
      try {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        isRemoteDescriptionSetRef.current = true;
        
        for (const candidate of pendingIceCandidatesRef.current) {
          try {
            await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            console.error('Error adding queued ice candidate', e);
          }
        }
        pendingIceCandidatesRef.current = [];
      } catch (err) {
        console.error("Error setting remote description from answer:", err);
      }
    });

    socket.on('ice-candidate', async (candidate) => {
      if (!peerConnectionRef.current) return;
      if (isRemoteDescriptionSetRef.current) {
        try {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error('Error adding received ice candidate', e);
        }
      } else {
        pendingIceCandidatesRef.current.push(candidate);
      }
    });
  };

  const setupWebRTC = (socket: Socket, room: string) => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    
    isRemoteDescriptionSetRef.current = false;
    pendingIceCandidatesRef.current = [];
    
    const configuration = { 
      iceServers: [
        { urls: "stun:stun.relay.metered.ca:80" },
        { urls: "stun:global.relay.metered.ca:80" },
        { urls: "turn:global.relay.metered.ca:80", username: "93d3531d6cb9d21936c44b01", credential: "1WRQmmSv2+K85BnG" },
        { urls: "turn:global.relay.metered.ca:80?transport=tcp", username: "93d3531d6cb9d21936c44b01", credential: "1WRQmmSv2+K85BnG" },
        { urls: "turn:global.relay.metered.ca:443", username: "93d3531d6cb9d21936c44b01", credential: "1WRQmmSv2+K85BnG" },
        { urls: "turns:global.relay.metered.ca:443?transport=tcp", username: "93d3531d6cb9d21936c44b01", credential: "1WRQmmSv2+K85BnG" }
      ] 
    };
    const peerConnection = new RTCPeerConnection(configuration);
    peerConnectionRef.current = peerConnection;

    try {
      peerConnection.addTransceiver('video', { direction: 'recvonly' });
    } catch (e) {
      console.error('Error adding transceiver', e);
    }
    
    peerConnection.addEventListener('icecandidate', event => {
      if (event.candidate) {
        socket.emit('ice-candidate', { roomId: room, candidate: event.candidate });
      }
    });

    peerConnection.addEventListener('track', event => {
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      } else {
        const newStream = new MediaStream([event.track]);
        setRemoteStream(newStream);
      }
    });

    const controlChannel = peerConnection.createDataChannel('control');
    dataChannelRef.current = controlChannel;

    const filesChannel = peerConnection.createDataChannel('files');
    filesChannel.binaryType = 'arraybuffer';
    filesChannel.onopen = () => setFileChannel(filesChannel);
    filesChannel.onclose = () => setFileChannel(null);
  };

  const disconnect = () => {
    if (socket && roomId) {
      socket.emit('leave-room', roomId);
      socket.off('answer');
      socket.off('ice-candidate');
    } else if (socket) {
      socket.off('answer');
      socket.off('ice-candidate');
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (remoteStream) {
      remoteStream.getTracks().forEach(track => track.stop());
    }
    isRemoteDescriptionSetRef.current = false;
    pendingIceCandidatesRef.current = [];
    dataChannelRef.current = null;
    setFileChannel(null);
    setIsConnected(false);
    setRemoteStream(null);
  };

  const handleMouseEvent = (type: string, x: number, y: number) => {
    if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
      dataChannelRef.current.send(JSON.stringify({ type, x, y }));
    }
  };

  const handleKeyEvent = (key: string) => {
    if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
      if (key.startsWith('CLIPBOARD_PASTE:')) {
        const text = key.substring('CLIPBOARD_PASTE:'.length);
        dataChannelRef.current.send(JSON.stringify({ type: 'clipboard', text }));
      } else if (key === 'SEND_SAS') {
        dataChannelRef.current.send(JSON.stringify({ type: 'sas' }));
      } else {
        dataChannelRef.current.send(JSON.stringify({ type: 'key', key }));
      }
    }
  };

  const handleLogout = async () => {
    disconnect();
    if (socket) {
      socket.disconnect();
      setSocket(null);
    }
    try {
      await fetch(`${currentServerUrl}/api/logout`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${currentUser.token}` }
      });
    } catch (e) {
      // ignore
    }
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return <Login onLoginSuccess={(url, username, role, token) => {
      setCurrentServerUrl(url);
      setCurrentUser({ username, role, token });
      setActiveView(role === 'admin' ? 'users' : 'devices');
      setIsAuthenticated(true);
    }} />;
  }

  return (
    <div className="app-container">
      {/* 1. Nav Sidebar - Ocultar si está conectado para maximizar el espacio horizontal */}
      {!isConnected && (
        <div className="nav-sidebar">
          <div className="nav-logo">CR</div>
          
          {currentUser.role !== 'admin' && (
            <>
              <div 
                className={`nav-item ${activeView === 'devices' ? 'active' : ''}`}
                onClick={() => setActiveView('devices')}
              >
                <Monitor size={22} />
                <span>Equipos</span>
              </div>

              <div 
                className={`nav-item ${activeView === 'assets' ? 'active' : ''}`}
                onClick={() => setActiveView('assets')}
              >
                <ClipboardList size={22} />
                <span>Activos</span>
              </div>

              <div 
                className={`nav-item ${activeView === 'proceso-rapido' ? 'active' : ''}`}
                onClick={() => setActiveView('proceso-rapido')}
              >
                <Terminal size={22} />
                <span>Procesos</span>
              </div>
            </>
          )}
   
          {(currentUser.role === 'admin' || currentUser.role === 'client') && (
            <div 
              className={`nav-item ${activeView === 'users' ? 'active' : ''}`}
              onClick={() => setActiveView('users')}
            >
              <Users size={22} />
              <span>Usuarios</span>
            </div>
          )}
          
          {currentUser.role !== 'admin' && (currentUser.role === 'client') && (
            <div 
              className={`nav-item ${activeView === 'monitoring' ? 'active' : ''}`}
              onClick={() => setActiveView('monitoring')}
            >
              <Mail size={22} />
              <span>Monitoreo</span>
            </div>
          )}
   
          <div style={{ marginTop: 'auto', marginBottom: '16px' }}>
            <div 
              className="nav-item" 
              onClick={handleLogout}
              style={{ color: '#ef4444' }}
            >
              <LogOut size={22} />
            </div>
          </div>
        </div>
      )}
 
      {/* 2 & 3. Main Content based on active view */}
      {activeView === 'devices' && (
        <DeviceManager 
          isConnected={isConnected}
          isConnecting={isConnecting}
          onlineDevices={onlineDevices}
          onlineDevicesDetails={onlineDevicesDetails}
          connectedRoomId={roomId}
          remoteStream={remoteStream}
          fileChannel={fileChannel}
          onMouseEvent={handleMouseEvent}
          onKeyEvent={handleKeyEvent}
          onConnectScreen={(id) => connectToSignalingServer(id, 'screen')}
          onConnectFiles={(id) => connectToSignalingServer(id, 'files')}
          onDisconnect={disconnect}
          serverUrl={currentServerUrl}
          token={currentUser.token}
          onLogout={handleLogout}
          role={currentUser.role}
        />
      )}
 
      {activeView === 'users' && (currentUser.role === 'admin' || currentUser.role === 'client') && (
        <div style={{ flex: 1, background: 'var(--bg-darker)', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          <UsersManager serverUrl={currentServerUrl} token={currentUser.token} currentUser={currentUser} />
        </div>
      )}

      {activeView === 'assets' && (
        <div style={{ flex: 1, background: 'var(--bg-darker)', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          <AssetReport 
            onlineDevicesDetails={onlineDevicesDetails} 
            onBackToDevices={() => setActiveView('devices')} 
          />
        </div>
      )}

      {activeView === 'proceso-rapido' && (
        <div style={{ flex: 1, background: 'var(--bg-darker)', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          <ProcesosRapidos 
            socket={socket} 
            onlineDevicesDetails={onlineDevicesDetails} 
            token={currentUser.token} 
            serverUrl={currentServerUrl} 
            currentUser={currentUser} 
          />
        </div>
      )}

      {activeView === 'monitoring' && currentUser.role === 'client' && (
        <div style={{ flex: 1, background: 'var(--bg-darker)', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          <MonitoringManager serverUrl={currentServerUrl} token={currentUser.token} />
        </div>
      )}
    </div>
  );
}

export default App;
