import React, { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { 
  Play, Terminal, Settings, Database, Trash2, Key, CheckCircle2, 
  Wifi, WifiOff, AlertTriangle, ShieldAlert, LogOut, Loader2, 
  Search, RefreshCw, Activity, Plus, Edit2, Check, X, ClipboardList, ShieldCheck
} from 'lucide-react';

interface ProcesosRapidosProps {
  socket: Socket | null;
  onlineDevicesDetails: any[];
  token: string;
  serverUrl: string;
  currentUser: {
    username: string;
    role: string;
  };
}

export default function ProcesosRapidos({ 
  socket, 
  onlineDevicesDetails, 
  token, 
  serverUrl, 
  currentUser 
}: ProcesosRapidosProps) {
  // --- Estados de Datos ---
  const [locations, setLocations] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // --- Selección de Ejecución ---
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [selectedLocationIp, setSelectedLocationIp] = useState<string>('');
  const [locationSearch, setLocationSearch] = useState<string>('');
  const [connectionMode, setConnectionMode] = useState<'direct' | 'vpn'>('direct');

  // --- Configuración de VPN ---
  const [vpnGateway, setVpnGateway] = useState<string>('');
  const [vpnUser, setVpnUser] = useState<string>('');
  const [vpnPassword, setVpnPassword] = useState<string>('');
  const [vpnAutoConnect, setVpnAutoConnect] = useState<boolean>(true);
  const [vpnStatus, setVpnStatus] = useState<string>('disconnected'); // 'disconnected', 'connecting', 'connected'
  const [vpnActionLoading, setVpnActionLoading] = useState<boolean>(false);

  // --- Ejecución de Consultas ---
  const [resultsData, setResultsData] = useState<any[] | null>(null);
  const [resultsMessage, setResultsMessage] = useState<string>('');
  const [queryExecuting, setQueryExecuting] = useState<boolean>(false);

  // --- Ejecución de Scripts ---
  const [selectedScript, setSelectedScript] = useState<string>('servicio_uber.bat');
  const [customCommand, setCustomCommand] = useState<string>('');
  const [scriptConsoleOutput, setScriptConsoleOutput] = useState<string>('Listo para enviar comandos...');
  const [scriptStatus, setScriptStatus] = useState<string>('Esperando ejecución...');
  const [scriptExecuting, setScriptExecuting] = useState<boolean>(false);

  // --- Modales de Parámetros ---
  const [activeQueryPrompt, setActiveQueryPrompt] = useState<any | null>(null);
  const [promptValues, setPromptValues] = useState<string[]>([]);

  // --- Vistas de Pestañas ---
  const [activeTab, setActiveTab] = useState<'queries' | 'scripts' | 'logs' | 'locations' | 'users' | 'vpn'>('queries');

  // --- Mantenimiento Locales ---
  const [isEditingLocal, setIsEditingLocal] = useState<any | null>(null);
  const [newLocalName, setNewLocalName] = useState('');
  const [newLocalIp, setNewLocalIp] = useState('');
  const [newLocalDb, setNewLocalDb] = useState('dbfrest');
  const [newLocalDeviceId, setNewLocalDeviceId] = useState('');

  // --- Mantenimiento Usuarios ---
  const [isEditingUser, setIsEditingUser] = useState<any | null>(null);
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState('standard');
  const [newUserAllLocs, setNewUserAllLocs] = useState(false);
  const [newUserAllowedLocs, setNewUserAllowedLocs] = useState<string[]>([]);
  const [newUserAllowedQueries, setNewUserAllowedQueries] = useState<string[]>([
    'btn-q-mesa-bloqueada', 'btn-q-actividad', 'btn-q-subtotal'
  ]);

  const queryTimeoutRef = useRef<any>(null);
  const isAdmin = currentUser.role === 'admin';

  // --- Predefined Queries List ---
  const PREDEFINED_QUERIES = [
    {
      id: 'btn-q-mesa-bloqueada',
      name: 'Mesa Bloqueada',
      query: "Update minutascab set consubtotal = 'F' where mesa = {0}",
      color: '#ef4444',
      prompts: [{ text: 'Ingrese el número de mesa (1-100):', type: 'number', min: 1, max: 100 }]
    },
    {
      id: 'btn-q-actividad',
      name: 'Nueva Actividad Económica',
      query: "INSERT INTO FE_CATALOGO_ACTIVIDADECONOMICA (CODACTIVIDADECONOMICA, DESCRIPCION) VALUES ('{0}', '{1}')",
      color: '#3b82f6',
      prompts: [
        { text: 'Ingrese el Código de Actividad (Alfanumérico):', type: 'text', max: 50 },
        { text: 'Ingrese la Descripción de la Actividad:', type: 'text', max: 50 }
      ]
    },
    {
      id: 'btn-q-violacion',
      name: 'Violación Primary Key',
      query: "update SERIES set NUMTIQB='{1}' where SERIE='{0}'",
      color: '#f59e0b',
      prompts: [
        { text: 'Ingrese la SERIE (Alfanumérico):', type: 'text' },
        { text: 'Ingrese el NUMTIQB (Alfanumérico):', type: 'text' }
      ]
    },
    {
      id: 'btn-q-ventas',
      name: 'No suben Ventas',
      query: "Delete rem_transacciones where serie ='{0}' and numero ={1}",
      color: '#10b981',
      prompts: [
        { text: 'Ingrese la SERIE (Alfanumérico):', type: 'text' },
        { text: 'Ingrese el NÚMERO (Entero):', type: 'number' }
      ]
    },
    {
      id: 'btn-q-eliminar-mesa',
      name: 'Eliminar Mesa',
      query: "DELETE FROM minutascab WHERE mesa={0}",
      color: '#8b5cf6',
      prompts: [{ text: 'Ingrese el número de mesa a ELIMINAR (1-100):', type: 'number', min: 1, max: 100 }]
    },
    {
      id: 'btn-q-subtotal',
      name: 'Subtotal Tiquetescab',
      query: "UPDATE tiquetscab SET subtotal='F' WHERE numero={0}",
      color: '#06b6d4',
      prompts: [{ text: 'Ingrese el NÚMERO (Entero):', type: 'number' }]
    },
    {
      id: 'btn-q-limpiar-cliente-uber',
      name: 'Limpiar Cliente Uber',
      description: 'Resetea teléfonos, nombres, alias y observaciones de clientes Uber (1000, 2000, 5000).',
      query: `update CLIENTES set TELEFONO1='60010101' where CODCLIENTE=1000;
update CLIENTES set TELEFONO1='70010101' where CODCLIENTE=2000;
update CLIENTES set TELEFONO1='80010101' where CODCLIENTE=5000;
update CLIENTES set NOMBRECLIENTE='Cliente Uber' where CODCLIENTE=1000;
update CLIENTES set NOMBRECLIENTE='Cliente Uber' where CODCLIENTE=2000;
update CLIENTES set NOMBRECLIENTE='Cliente Uber' where CODCLIENTE=5000;
update CLIENTES set ALIAS='Cliente Uber' where CODCLIENTE=1000;
update CLIENTES set ALIAS='Cliente Uber' where CODCLIENTE=2000;
update CLIENTES set ALIAS='Cliente Uber' where CODCLIENTE=5000;
update CLIENTES set OBSERVACIONES='Cliente Uber' where CODCLIENTE=1000;
update CLIENTES set OBSERVACIONES='Cliente Uber' where CODCLIENTE=2000;
update CLIENTES set OBSERVACIONES='Cliente Uber' where CODCLIENTE=5000;`,
      color: '#ec4899',
      prompts: []
    },
    {
      id: 'btn-q-enviar-factura-misma-num',
      name: 'Enviar Factura Misma Numeración',
      query: "exec [Rosti_Genera_FE_TXT] '{0}', {1}",
      color: '#a855f7',
      prompts: [
        { text: 'Ingrese la SERIE (ej. T004):', type: 'text' },
        { text: 'Ingrese el NÚMERO:', type: 'number' }
      ]
    },
    {
      id: 'btn-q-enviar-factura-otra-num',
      name: 'Enviar Factura Otra Numeración',
      query: "exec [Rosti_Genera_FE_TXT] '{0}', {1}, 1",
      color: '#14b8a6',
      prompts: [
        { text: 'Ingrese la SERIE (ej. T001):', type: 'text' },
        { text: 'Ingrese el NÚMERO:', type: 'number' }
      ]
    }
  ];

  // --- Cargar Estado Inicial ---
  const fetchState = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${serverUrl}/api/proceso-state`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await res.json();
      if (result.success && result.data && Object.keys(result.data).length > 0) {
        const { locations: locs, users: usr, logs: lg, vpn } = result.data;
        if (locs) setLocations(locs);
        if (usr) setUsers(usr);
        if (lg) setLogs(lg);
        if (vpn) {
          setVpnGateway(vpn.gateway || '');
          setVpnUser(vpn.user || '');
          setVpnPassword(vpn.password || '');
          setVpnAutoConnect(vpn.autoConnect !== false);
        }
      } else {
        // Inicializar datos vacíos
        setLocations([]);
        setUsers([]);
        await saveState([], [], [], { gateway: '', user: '', password: '', autoConnect: true });
      }
    } catch (e) {
      console.error('Error fetching process state:', e);
    } finally {
      setLoading(false);
    }
  };

  const saveState = async (
    newLocs = locations, 
    newUsrs = users, 
    newLgs = logs, 
    newVpn = { gateway: vpnGateway, user: vpnUser, password: vpnPassword, autoConnect: vpnAutoConnect }
  ) => {
    try {
      await fetch(`${serverUrl}/api/proceso-state`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ locations: newLocs, users: newUsrs, logs: newLgs, vpn: newVpn })
      });
    } catch (e) {
      console.error('Error saving process state:', e);
    }
  };

  // --- Configurar Socket Listeners ---
  useEffect(() => {
    fetchState();

    if (!socket) return;

    socket.on('vpn-connect-response', (res: any) => {
      setVpnActionLoading(false);
      if (res.success) {
        setVpnStatus('connected');
        alert(res.message);
      } else {
        setVpnStatus('disconnected');
        alert('Error VPN: ' + res.message);
      }
    });

    socket.on('vpn-disconnect-response', (res: any) => {
      setVpnActionLoading(false);
      setVpnStatus('disconnected');
      alert(res.message);
    });

    socket.on('vpn-status-response', (res: any) => {
      setVpnStatus(res.status);
    });

    socket.on('execute-query-response', (res: any) => {
      if (queryTimeoutRef.current) {
        clearTimeout(queryTimeoutRef.current);
        queryTimeoutRef.current = null;
      }
      setQueryExecuting(false);
      if (res.success) {
        if (res.data) {
          setResultsData(res.data);
          setResultsMessage(`Operación exitosa. Se encontraron ${res.data.length} filas.`);
        } else {
          setResultsData([]);
          setResultsMessage(res.message || 'Operación completada exitosamente.');
        }
      } else {
        setResultsData(null);
        setResultsMessage('Error en la consulta: ' + res.message);
      }
    });

    socket.on('execute-script-response', (res: any) => {
      setScriptExecuting(false);
      if (res.success) {
        setScriptConsoleOutput(res.output);
        setScriptStatus('Ejecutado con éxito');
      } else {
        setScriptConsoleOutput('ERROR:\n' + res.message);
        setScriptStatus('Error en la ejecución');
      }
    });

    // Consultar estado inicial del VPN periódicamente
    const interval = setInterval(() => {
      if (connectionMode === 'vpn' && selectedDevice) {
        socket.emit('vpn-status-request', { roomId: selectedDevice });
      }
    }, 5000);

    return () => {
      socket.off('vpn-connect-response');
      socket.off('vpn-disconnect-response');
      socket.off('vpn-status-response');
      socket.off('execute-query-response');
      socket.off('execute-script-response');
      clearInterval(interval);
    };
  }, [socket, selectedDevice, connectionMode]);

  // Cambiar de dispositivo de ejecución
  useEffect(() => {
    // Autoseleccionar primer dispositivo online si existe
    const winDevices = onlineDevicesDetails.filter(d => d.isWindows);
    if (winDevices.length > 0 && !selectedDevice) {
      setSelectedDevice(winDevices[0].roomId);
    }
  }, [onlineDevicesDetails]);

  // Obtener el dispositivo ejecutor final basado en el modo de conexión y local activo
  const getTargetExecutorDevice = () => {
    const activeLoc = locations.find(l => l.ip === selectedLocationIp);
    if (!activeLoc) return '';
    
    // Helper to normalize strings for comparison (remove accents, lowercase, trim)
    const normalizeStr = (str: string | undefined | null) => {
      if (!str) return '';
      return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    };
    
    // 1. Si el local tiene un dispositivo configurado explícitamente, usarlo si está online
    if (activeLoc.deviceId) {
      const isOnline = onlineDevicesDetails.some(d => d.isWindows && d.roomId === activeLoc.deviceId);
      if (isOnline) return activeLoc.deviceId;
    }
    
    // 2. Si no tiene o está offline, intentar autodetectar por nombre/grupo
    const cleanName = normalizeStr(activeLoc.name);
    
    // 2.1. Buscar por nombre de grupo exacto (ej. "Coronado" o "Sabanilla")
    let match = onlineDevicesDetails.find(d => d.isWindows && normalizeStr(d.specs?.group) === cleanName);
    if (match) return match.roomId;
    
    // 2.2. Buscar si el nombre en specs contiene el nombre del local o viceversa
    match = onlineDevicesDetails.find(d => {
      if (!d.isWindows) return false;
      const devName = normalizeStr(d.specs?.name);
      return devName.includes(cleanName) || cleanName.includes(devName);
    });
    if (match) return match.roomId;
    
    // 2.3. Buscar si el roomId contiene el nombre del local o viceversa
    match = onlineDevicesDetails.find(d => {
      if (!d.isWindows) return false;
      const devId = normalizeStr(d.roomId);
      return devId.includes(cleanName) || cleanName.includes(devId);
    });
    if (match) return match.roomId;
    
    return '';
  };

  // --- Filtros de Seguridad de Usuario ---
  const getMappedUser = () => {
    if (isAdmin) return null;
    return users.find(u => u.username.toLowerCase() === currentUser.username.toLowerCase());
  };

  const getFilteredLocations = () => {
    const userObj = getMappedUser();
    let allowed = locations;
    if (userObj && userObj.role === 'standard' && !userObj.allLocations) {
      allowed = locations.filter(loc => userObj.allowedLocations.includes(loc.id));
    }
    if (locationSearch) {
      const q = locationSearch.toLowerCase().trim();
      allowed = allowed.filter(loc => loc.name.toLowerCase().includes(q) || loc.ip.includes(q));
    }
    return allowed;
  };

  const getFilteredQueries = () => {
    const userObj = getMappedUser();
    if (userObj && userObj.role === 'standard') {
      return PREDEFINED_QUERIES.filter(q => userObj.allowedQueries.includes(q.id));
    }
    return PREDEFINED_QUERIES;
  };

  // --- Acciones de VPN ---
  const handleVpnConnect = () => {
    if (!socket || !selectedDevice) return alert('Selecciona un dispositivo puente online.');
    if (!vpnGateway) return alert('Escribe la IP/Host de la VPN.');
    setVpnActionLoading(true);
    setVpnStatus('connecting');
    socket.emit('vpn-connect', {
      roomId: selectedDevice,
      gateway: vpnGateway,
      user: vpnUser,
      pass: vpnPassword
    });
    // Guardar credenciales de vpn
    saveState();
  };

  const handleVpnDisconnect = () => {
    if (!socket || !selectedDevice) return;
    setVpnActionLoading(true);
    socket.emit('vpn-disconnect', { roomId: selectedDevice });
  };

  // --- Acciones de Consulta ---
  const handleQueryClick = (queryObj: any) => {
    const executorDevice = getTargetExecutorDevice();
    if (!executorDevice) {
      if (connectionMode === 'direct') {
        const activeLoc = locations.find(l => l.ip === selectedLocationIp);
        const locName = activeLoc ? activeLoc.name : 'el local seleccionado';
        return alert(`No se encontró ningún equipo online en el local "${locName}". Asegúrate de que el equipo del local está encendido y tiene instalada la aplicación ControlRemoto.`);
      } else {
        return alert('Por favor, selecciona un dispositivo puente online en la parte superior.');
      }
    }
    if (!selectedLocationIp) return alert('Por favor, selecciona el local activo.');

    if (queryObj.prompts && queryObj.prompts.length > 0) {
      setActiveQueryPrompt(queryObj);
      setPromptValues(new Array(queryObj.prompts.length).fill(''));
    } else {
      runQuery(queryObj.query, []);
    }
  };

  const submitPromptedQuery = () => {
    if (!activeQueryPrompt) return;
    // Formatear la consulta reemplazando {0}, {1}, etc.
    let formattedQuery = activeQueryPrompt.query;
    promptValues.forEach((val, idx) => {
      formattedQuery = formattedQuery.replace(new RegExp(`\\{${idx}\\}`, 'g'), val);
    });

    setActiveQueryPrompt(null);
    runQuery(formattedQuery, promptValues);
  };

  const runQuery = (queryString: string, args: string[]) => {
    const executorDevice = getTargetExecutorDevice();
    if (!socket || !executorDevice) return;
    
    setQueryExecuting(true);
    setResultsMessage('Enviando consulta SQL al agente...');
    setResultsData(null);

    // Timeout de 15 segundos
    if (queryTimeoutRef.current) clearTimeout(queryTimeoutRef.current);
    queryTimeoutRef.current = setTimeout(() => {
      setQueryExecuting(false);
      setResultsData(null);
      setResultsMessage('Error: Tiempo de espera agotado (15s). El agente no respondió a la consulta SQL. Asegúrate de reiniciar el RostiWindowsClient local en la máquina branch y verificar que esté ejecutando la última versión.');
      queryTimeoutRef.current = null;
    }, 15000);

    const activeLoc = locations.find(l => l.ip === selectedLocationIp);
    const dbName = activeLoc ? activeLoc.db : 'dbfrest';

    // Registrar en auditoría
    const newLog = {
      date: new Date().toISOString().replace('T', ' ').substring(0, 19),
      username: currentUser.username,
      local: activeLoc ? activeLoc.name : selectedLocationIp,
      query: queryString
    };
    const updatedLogs = [newLog, ...logs].slice(0, 500); // Límite de 500 logs
    setLogs(updatedLogs);
    saveState(locations, users, updatedLogs);

    socket.emit('execute-query', {
      roomId: executorDevice,
      ip: selectedLocationIp,
      db: dbName,
      query: queryString
    });
  };

  // --- Acciones de Script ---
  const handleRunScript = () => {
    const executorDevice = getTargetExecutorDevice();
    if (!socket || !executorDevice) {
      if (connectionMode === 'direct') {
        const activeLoc = locations.find(l => l.ip === selectedLocationIp);
        const locName = activeLoc ? activeLoc.name : 'el local seleccionado';
        return alert(`No se encontró ningún equipo online en el local "${locName}". Asegúrate de que el equipo del local está encendido y tiene instalada la aplicación.`);
      } else {
        return alert('Selecciona un dispositivo puente online.');
      }
    }
    if (!selectedLocationIp) return alert('Selecciona el local activo.');

    const cmdToRun = 'copy /Y "C:\\Program Files\\Integral\\Integral_ICG\\Respaldos_Configuracion\\1,84\\IntegradorServiciosICG.exe.config" "C:\\Program Files\\Integral\\Integral_ICG\\IntegradorServiciosICG.exe.config"';

    setScriptExecuting(true);
    setScriptStatus('Ejecutando...');
    setScriptConsoleOutput('C:\\Procesos> Enviando ejecución a base de datos remota...');

    // Registrar en logs
    const activeLoc = locations.find(l => l.ip === selectedLocationIp);
    const newLog = {
      date: new Date().toISOString().replace('T', ' ').substring(0, 19),
      username: currentUser.username,
      local: activeLoc ? activeLoc.name : selectedLocationIp,
      query: `SCRIPT REMOTO: ${cmdToRun}`
    };
    const updatedLogs = [newLog, ...logs].slice(0, 500);
    setLogs(updatedLogs);
    saveState(locations, users, updatedLogs);

    socket.emit('execute-script', {
      roomId: executorDevice,
      ip: selectedLocationIp,
      command: cmdToRun
    });
  };

  // --- Mantenimiento Locales ---
  const handleSaveLocal = () => {
    if (!newLocalName || !newLocalIp) return alert('Faltan datos del local.');
    let updatedLocs = [...locations];
    if (isEditingLocal && isEditingLocal.id) {
      // Editar
      updatedLocs = locations.map(l => l.id === isEditingLocal.id ? { ...l, name: newLocalName, ip: newLocalIp, db: newLocalDb, deviceId: newLocalDeviceId } : l);
    } else {
      // Nuevo
      updatedLocs.push({
        id: (Date.now() + Math.random()).toString().substring(5),
        name: newLocalName,
        ip: newLocalIp,
        db: newLocalDb,
        deviceId: newLocalDeviceId
      });
    }
    setLocations(updatedLocs);
    setIsEditingLocal(null);
    saveState(updatedLocs);
  };

  const handleDeleteLocal = (id: string) => {
    if (!window.confirm('¿Seguro que deseas eliminar este local?')) return;
    const updated = locations.filter(l => l.id !== id);
    setLocations(updated);
    saveState(updated);
  };

  // --- Mantenimiento Usuarios ---
  const handleSaveUser = () => {
    if (!newUserUsername || (!isEditingUser && !newUserPassword)) return alert('Faltan datos del usuario.');
    let updatedUsers = [...users];
    if (isEditingUser && isEditingUser.id) {
      // Editar
      updatedUsers = users.map(u => u.id === isEditingUser.id 
        ? { 
            ...u, 
            username: newUserUsername, 
            role: newUserRole, 
            allLocations: newUserAllLocs, 
            allowedLocations: newUserAllowedLocs, 
            allowedQueries: newUserAllowedQueries,
            password: newUserPassword ? newUserPassword : u.password 
          } 
        : u
      );
    } else {
      // Nuevo
      updatedUsers.push({
        id: (Date.now() + Math.random()).toString().substring(5),
        username: newUserUsername,
        password: newUserPassword,
        role: newUserRole,
        allLocations: newUserAllLocs,
        allowedLocations: newUserAllowedLocs,
        allowedQueries: newUserAllowedQueries
      });
    }
    setUsers(updatedUsers);
    setIsEditingUser(null);
    saveState(locations, updatedUsers);
  };

  const handleDeleteUser = (id: string) => {
    if (!window.confirm('¿Seguro que deseas eliminar este usuario?')) return;
    const updated = users.filter(u => u.id !== id);
    setUsers(updated);
    saveState(locations, updated);
  };

  const handleLocationCheckboxChange = (locId: string) => {
    if (newUserAllowedLocs.includes(locId)) {
      setNewUserAllowedLocs(newUserAllowedLocs.filter(id => id !== locId));
    } else {
      setNewUserAllowedLocs([...newUserAllowedLocs, locId]);
    }
  };

  const handleQueryCheckboxChange = (queryId: string) => {
    if (newUserAllowedQueries.includes(queryId)) {
      setNewUserAllowedQueries(newUserAllowedQueries.filter(id => id !== queryId));
    } else {
      setNewUserAllowedQueries([...newUserAllowedQueries, queryId]);
    }
  };

  // --- Renderizado ---
  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-darker)', color: 'var(--text-muted)' }}>
        <Loader2 size={48} className="animate-spin" style={{ color: 'var(--primary)', marginBottom: '16px' }} />
        <h3>Cargando módulo de consultas...</h3>
      </div>
    );
  }

  const winDevices = onlineDevicesDetails.filter(d => d.isWindows);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-darker)', overflow: 'hidden' }}>
      
      {/* Header Bar */}
      {/* Header Bar */}
      <header className="topbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-panel)', flexShrink: 0, gap: '16px', flexWrap: 'wrap' }}>
        
        {/* Local Selector (Database selector) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '300px', maxWidth: '600px' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Local Activo:</span>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="Buscar local..."
              value={locationSearch}
              onChange={(e) => setLocationSearch(e.target.value)}
              style={{ width: '100%', padding: '6px 12px 6px 30px', borderRadius: '8px', border: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)', color: 'white', outline: 'none', fontSize: '0.85rem' }}
            />
          </div>
          <select 
            value={selectedLocationIp}
            onChange={(e) => {
              setSelectedLocationIp(e.target.value);
              setResultsData(null);
              setResultsMessage('');
            }}
            style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', color: 'white', padding: '6px 12px', borderRadius: '8px', outline: 'none', fontSize: '0.85rem', cursor: 'pointer', flex: 1.5 }}
          >
            <option value="">-- Selecciona un local --</option>
            {getFilteredLocations().map(loc => (
              <option key={loc.id} value={loc.ip}>{loc.name} ({loc.ip})</option>
            ))}
          </select>
        </div>

        {/* Direct Connection Status Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {(() => {
            const activeLoc = locations.find(l => l.ip === selectedLocationIp);
            if (!activeLoc) {
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 14px', borderRadius: '20px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', fontSize: '0.85rem', border: '1px solid var(--border)' }}>
                  <span>Selecciona un local para validar conexión</span>
                </div>
              );
            }
            const executorRoomId = getTargetExecutorDevice();
            if (executorRoomId) {
              const devObj = onlineDevicesDetails.find(d => d.roomId === executorRoomId);
              const devName = devObj ? (devObj.specs?.name || devObj.roomId) : executorRoomId;
              const devGroup = devObj ? (devObj.specs?.group) : '';
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 14px', borderRadius: '20px', background: 'rgba(16,185,129,0.1)', color: 'var(--success)', fontSize: '0.85rem', border: '1px solid rgba(16,185,129,0.2)' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }}></span>
                  <span>Conexión Directa: {devName} {devGroup ? `(${devGroup})` : ''}</span>
                </div>
              );
            } else {
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 14px', borderRadius: '20px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: '0.85rem', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }}></span>
                  <span>No hay equipos online en {activeLoc.name}</span>
                </div>
              );
            }
          })()}
        </div>
      </header>

      {/* Tabs Selector */}
      <div style={{ display: 'flex', background: 'var(--bg-panel)', borderBottom: '1px solid var(--border)', padding: '0 24px', flexShrink: 0 }}>
        <button 
          onClick={() => setActiveTab('queries')}
          className={`tab-btn ${activeTab === 'queries' ? 'active' : ''}`}
          style={{ padding: '12px 18px', background: 'none', border: 'none', color: activeTab === 'queries' ? 'var(--accent)' : 'var(--text-muted)', borderBottom: activeTab === 'queries' ? '2px solid var(--accent)' : 'none', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', outline: 'none' }}
        >
          Inicio / Consultas
        </button>
        <button 
          onClick={() => setActiveTab('scripts')}
          className={`tab-btn ${activeTab === 'scripts' ? 'active' : ''}`}
          style={{ padding: '12px 18px', background: 'none', border: 'none', color: activeTab === 'scripts' ? 'var(--accent)' : 'var(--text-muted)', borderBottom: activeTab === 'scripts' ? '2px solid var(--accent)' : 'none', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', outline: 'none' }}
        >
          Integración Uber
        </button>
        <button 
          onClick={() => setActiveTab('logs')}
          className={`tab-btn ${activeTab === 'logs' ? 'active' : ''}`}
          style={{ padding: '12px 18px', background: 'none', border: 'none', color: activeTab === 'logs' ? 'var(--accent)' : 'var(--text-muted)', borderBottom: activeTab === 'logs' ? '2px solid var(--accent)' : 'none', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', outline: 'none' }}
        >
          Registro Log
        </button>
        {isAdmin && (
          <>
            <button 
              onClick={() => setActiveTab('locations')}
              className={`tab-btn ${activeTab === 'locations' ? 'active' : ''}`}
              style={{ padding: '12px 18px', background: 'none', border: 'none', color: activeTab === 'locations' ? 'var(--accent)' : 'var(--text-muted)', borderBottom: activeTab === 'locations' ? '2px solid var(--accent)' : 'none', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', outline: 'none' }}
            >
              Locales
            </button>
            <button 
              onClick={() => setActiveTab('users')}
              className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
              style={{ padding: '12px 18px', background: 'none', border: 'none', color: activeTab === 'users' ? 'var(--accent)' : 'var(--text-muted)', borderBottom: activeTab === 'users' ? '2px solid var(--accent)' : 'none', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', outline: 'none' }}
            >
              Usuarios
            </button>
          </>
        )}
      </div>

      {/* Main View Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px', position: 'relative' }}>
        
        {/* TAB 1: CONSULTAS PREDEFINIDAS */}
        {activeTab === 'queries' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', height: '100%' }}>
            
            {/* Banner */}
            <div style={{ background: 'linear-gradient(135deg, rgba(249,115,22,0.1), rgba(239,68,68,0.1))', border: '1px solid rgba(249,115,22,0.2)', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ background: 'rgba(249,115,22,0.15)', padding: '12px', borderRadius: '50%', color: 'var(--primary)' }}>
                <Activity size={28} />
              </div>
              <div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem' }}>¡Hola, bienvenido {currentUser.username}!</h3>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>Utiliza los botones a continuación para ejecutar tareas rápidas en tu restaurante de manera segura y sin complicaciones.</p>
              </div>
            </div>

            {/* Queries Grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h4 style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>Consultas Predefinidas para {locations.find(l => l.ip === selectedLocationIp)?.name || 'Local Seleccionado'}</h4>
              
              {selectedLocationIp ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                  {getFilteredQueries().map(q => (
                    <button
                      key={q.id}
                      onClick={() => handleQueryClick(q)}
                      disabled={queryExecuting}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'flex-start', 
                        padding: '16px', 
                        background: 'var(--bg-panel)', 
                        border: `1px solid ${q.color}`, 
                        borderRadius: '12px', 
                        cursor: 'pointer', 
                        textAlign: 'left',
                        transition: 'transform 0.2s',
                        opacity: queryExecuting ? 0.6 : 1
                      }}
                      className="hover-scale"
                    >
                      <Database size={20} style={{ color: q.color, marginRight: '12px', marginTop: '2px', flexShrink: 0 }} />
                      <div>
                        <div style={{ fontWeight: 600, color: 'white', fontSize: '0.9rem', marginBottom: '4px' }}>{q.name}</div>
                        <div style={{ 
                          fontSize: '0.75rem', 
                          color: 'var(--text-muted)', 
                          fontFamily: 'monospace', 
                          wordBreak: 'break-all',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {q.description || q.query}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '32px', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: '12px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  Debes seleccionar un Local Activo en la parte superior para mostrar las consultas disponibles.
                </div>
              )}
            </div>

            {/* Results Section */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-panel)', borderRadius: '16px', border: '1px solid var(--border)', overflow: 'hidden', minHeight: '300px' }}>
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ margin: 0, fontSize: '0.9rem' }}>Resultados de la Ejecución</h4>
                {queryExecuting && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Loader2 size={14} className="animate-spin" /> Procesando consulta remota...
                  </span>
                )}
              </div>

              <div style={{ flex: 1, padding: '20px', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {resultsMessage && (
                  <div style={{ 
                    padding: '12px 16px', 
                    borderRadius: '8px', 
                    background: resultsMessage.includes('Error') ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                    color: resultsMessage.includes('Error') ? '#ef4444' : 'var(--success)',
                    fontSize: '0.85rem',
                    border: `1px solid ${resultsMessage.includes('Error') ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)'}`
                  }}>
                    {resultsMessage}
                  </div>
                )}

                {resultsData && resultsData.length > 0 ? (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="report-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', background: 'rgba(255,255,255,0.01)' }}>
                          {Object.keys(resultsData[0]).map(key => (
                            <th key={key} style={{ padding: '10px 12px', color: 'var(--text-muted)', fontWeight: 600 }}>{key}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {resultsData.map((row, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                            {Object.values(row).map((val: any, colIdx) => (
                              <td key={colIdx} style={{ padding: '10px 12px', color: 'white' }}>
                                {val === null ? <span style={{ color: 'rgba(255,255,255,0.2)' }}>NULL</span> : String(val)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  !resultsMessage && (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      No se ha ejecutado ninguna consulta o no hay datos cargados.
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        )}
        {/* TAB 2: EJECUTAR INTEGRACION UBER */}
        {activeTab === 'scripts' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', height: '100%' }}>
            <div style={{ background: 'var(--bg-panel)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--primary)' }}>Ejecutar Integración Uber</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                  Este módulo permite copiar directamente el archivo de configuración del Integrador de Servicios ICG desde la ruta de respaldo a la ruta de producción en el servidor del local seleccionado.
                </p>
                <div style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '8px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--success)', fontSize: '0.85rem' }}>
                  <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
                  <span>Se enviará el comando de copia de archivos directamente al servidor a través de SQL Server. No es necesario que exista ningún archivo .bat en el equipo de destino.</span>
                </div>
              </div>

              <div style={{ display: 'flex', marginTop: '8px' }}>
                <button
                  onClick={handleRunScript}
                  disabled={scriptExecuting}
                  style={{ 
                    padding: '12px 24px', 
                    background: 'var(--primary)', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '8px', 
                    fontWeight: 600, 
                    fontSize: '0.9rem', 
                    cursor: 'pointer', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '10px',
                    boxShadow: '0 4px 12px rgba(255, 87, 34, 0.2)',
                    transition: 'all 0.2s'
                  }}
                  className="hover-bright"
                >
                  {scriptExecuting ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
                  Ejecutar Copia Integrador
                </button>
              </div>
            </div>

            {/* Green-on-black Console */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-panel)', borderRadius: '16px', border: '1px solid var(--border)', overflow: 'hidden', minHeight: '300px' }}>
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ margin: 0, fontSize: '0.9rem' }}>Consola de Salida (CMD/Output)</h4>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Estado: {scriptStatus}</span>
              </div>
              <div style={{ flex: 1, background: '#000', padding: '20px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.85rem', color: '#10b981', whiteSpace: 'pre-wrap' }}>
                {scriptConsoleOutput}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: AUDITORÍA DE LOGS */}
        {activeTab === 'logs' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--primary)' }}>Logs de Auditoría de Consultas</h3>
              <button
                onClick={() => {
                  if (window.confirm('¿Seguro que deseas vaciar el historial de logs?')) {
                    setLogs([]);
                    saveState(locations, users, []);
                  }
                }}
                style={{ padding: '6px 14px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer' }}
                className="hover-bright"
              >
                Limpiar Historial
              </button>
            </div>

            <div style={{ flex: 1, background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden' }}>
              <div style={{ overflowY: 'auto', height: '100%' }}>
                <table className="report-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.01)', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '12px 16px' }}>Fecha y Hora</th>
                      <th style={{ padding: '12px 16px' }}>Usuario</th>
                      <th style={{ padding: '12px 16px' }}>Local</th>
                      <th style={{ padding: '12px 16px' }}>Consulta / Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>No hay logs registrados todavía.</td>
                      </tr>
                    ) : (
                      logs.map((l, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                          <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>{l.date}</td>
                          <td style={{ padding: '12px 16px', fontWeight: 600 }}>{l.username}</td>
                          <td style={{ padding: '12px 16px', color: 'var(--accent)' }}>{l.local}</td>
                          <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '0.75rem', wordBreak: 'break-all' }}>{l.query}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: MANTENIMIENTO LOCALES (SÓLO ADMIN) */}
        {activeTab === 'locations' && isAdmin && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Editor Local Modal-style card */}
            {isEditingLocal !== null && (
              <div style={{ background: 'var(--bg-panel)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '500px' }}>
                <h4 style={{ margin: 0, color: 'var(--primary)' }}>{isEditingLocal.id ? 'Editar Local' : 'Agregar Nuevo Local'}</h4>
                
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Nombre del Local</label>
                  <input
                    type="text"
                    value={newLocalName}
                    onChange={(e) => setNewLocalName(e.target.value)}
                    placeholder="Ej: Coronado"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)', color: 'white', outline: 'none', fontSize: '0.85rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>IP de Base de Datos</label>
                  <input
                    type="text"
                    value={newLocalIp}
                    onChange={(e) => setNewLocalIp(e.target.value)}
                    placeholder="Ej: 10.1.23.2"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)', color: 'white', outline: 'none', fontSize: '0.85rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Nombre de BD (ICG)</label>
                  <input
                    type="text"
                    value={newLocalDb}
                    onChange={(e) => setNewLocalDb(e.target.value)}
                    placeholder="Ej: dbfrest"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)', color: 'white', outline: 'none', fontSize: '0.85rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Dispositivo ControlRemoto Asignado</label>
                  <select
                    value={newLocalDeviceId}
                    onChange={(e) => setNewLocalDeviceId(e.target.value)}
                    style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', color: 'white', padding: '8px 12px', borderRadius: '8px', outline: 'none', fontSize: '0.85rem', cursor: 'pointer' }}
                  >
                    <option value="">-- Autodetectar por Nombre / Grupo --</option>
                    {winDevices.map(d => (
                      <option key={d.roomId} value={d.roomId}>
                        {d.specs?.name || d.roomId} {d.specs?.group ? `[${d.specs.group}]` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <button onClick={handleSaveLocal} style={{ flex: 1, padding: '8px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}>Guardar</button>
                  <button onClick={() => setIsEditingLocal(null)} style={{ flex: 1, padding: '8px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid var(--border)', borderRadius: '8px', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}>Cancelar</button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--primary)' }}>Lista de Locales y Servidores</h3>
              {isEditingLocal === null && (
                <button
                  onClick={() => {
                    setIsEditingLocal({});
                    setNewLocalName('');
                    setNewLocalIp('');
                    setNewLocalDb('dbfrest');
                    setNewLocalDeviceId('');
                  }}
                  style={{ padding: '6px 14px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Plus size={14} /> Nuevo Local
                </button>
              )}
            </div>

            <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden' }}>
              <table className="report-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.01)', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '12px 16px' }}>ID</th>
                    <th style={{ padding: '12px 16px' }}>Nombre</th>
                    <th style={{ padding: '12px 16px' }}>IP Base Datos</th>
                    <th style={{ padding: '12px 16px' }}>Base Datos</th>
                    <th style={{ padding: '12px 16px' }}>Equipo Asignado</th>
                    <th style={{ padding: '12px 16px' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {locations.map(loc => (
                    <tr key={loc.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                      <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>{loc.id}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>{loc.name}</td>
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace' }}>{loc.ip}</td>
                      <td style={{ padding: '12px 16px' }}>{loc.db}</td>
                      <td style={{ padding: '12px 16px' }}>
                        {(() => {
                          if (loc.deviceId) {
                            const devObj = onlineDevicesDetails.find(d => d.roomId === loc.deviceId);
                            const isOnline = !!devObj;
                            return (
                              <span style={{ color: isOnline ? 'var(--success)' : 'var(--text-muted)', fontWeight: isOnline ? 600 : 'normal' }}>
                                {isOnline ? '🟢' : '⚫'} {devObj?.specs?.name || loc.deviceId}
                              </span>
                            );
                          }
                          return <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Auto-detectar</span>;
                        })()}
                      </td>
                      <td style={{ padding: '12px 16px', display: 'flex', gap: '10px' }}>
                        <button
                          onClick={() => {
                            setIsEditingLocal(loc);
                            setNewLocalName(loc.name);
                            setNewLocalIp(loc.ip);
                            setNewLocalDb(loc.db);
                            setNewLocalDeviceId(loc.deviceId || '');
                          }}
                          style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0 }}
                          title="Editar"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteLocal(loc.id)}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }}
                          title="Eliminar"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 6: MANTENIMIENTO USUARIOS (SÓLO ADMIN) */}
        {activeTab === 'users' && isAdmin && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* User Editor card */}
            {isEditingUser !== null && (
              <div style={{ background: 'var(--bg-panel)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '600px' }}>
                <h4 style={{ margin: 0, color: 'var(--primary)' }}>{isEditingUser.id ? 'Editar Permisos de Usuario' : 'Nuevo Usuario Estándar'}</h4>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Correo / Usuario</label>
                    <input
                      type="text"
                      value={newUserUsername}
                      onChange={(e) => setNewUserUsername(e.target.value)}
                      placeholder="Ej: rostitibas@rostipolloscr.com"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)', color: 'white', outline: 'none', fontSize: '0.85rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Contraseña {isEditingUser.id && '(Vacío para mantener)'}</label>
                    <input
                      type="password"
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      placeholder="••••••••"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)', color: 'white', outline: 'none', fontSize: '0.85rem' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Rol en Consultas</label>
                    <select
                      value={newUserRole}
                      onChange={(e) => setNewUserRole(e.target.value)}
                      style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', color: 'white', padding: '8px 12px', borderRadius: '8px', outline: 'none', fontSize: '0.85rem', cursor: 'pointer' }}
                    >
                      <option value="standard">Estándar (Filtro por local)</option>
                      <option value="admin">Administrador (Acceso total)</option>
                    </select>
                  </div>

                  {newUserRole === 'standard' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '20px' }}>
                      <input
                        type="checkbox"
                        id="all-locs"
                        checked={newUserAllLocs}
                        onChange={(e) => setNewUserAllLocs(e.target.checked)}
                        style={{ cursor: 'pointer' }}
                      />
                      <label htmlFor="all-locs" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', cursor: 'pointer' }}>Permitir todos los locales</label>
                    </div>
                  )}
                </div>

                {/* Local permissions grid */}
                {newUserRole === 'standard' && !newUserAllLocs && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Locales Permitidos:</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px', maxHeight: '150px', overflowY: 'auto', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                      {locations.map(loc => (
                        <div key={loc.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input
                            type="checkbox"
                            id={`perm-loc-${loc.id}`}
                            checked={newUserAllowedLocs.includes(loc.id)}
                            onChange={() => handleLocationCheckboxChange(loc.id)}
                            style={{ cursor: 'pointer' }}
                          />
                          <label htmlFor={`perm-loc-${loc.id}`} style={{ fontSize: '0.75rem', cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{loc.name}</label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Query permissions grid */}
                {newUserRole === 'standard' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Consultas Permitidas:</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                      {PREDEFINED_QUERIES.map(q => (
                        <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input
                            type="checkbox"
                            id={`perm-q-${q.id}`}
                            checked={newUserAllowedQueries.includes(q.id)}
                            onChange={() => handleQueryCheckboxChange(q.id)}
                            style={{ cursor: 'pointer' }}
                          />
                          <label htmlFor={`perm-q-${q.id}`} style={{ fontSize: '0.75rem', cursor: 'pointer' }}>{q.name}</label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px', marginTop: '8px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                  <button onClick={handleSaveUser} style={{ flex: 1, padding: '10px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}>Guardar Usuario</button>
                  <button onClick={() => setIsEditingUser(null)} style={{ flex: 1, padding: '10px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid var(--border)', borderRadius: '8px', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}>Cancelar</button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--primary)' }}>Usuarios y Perfiles de Acceso</h3>
              {isEditingUser === null && (
                <button
                  onClick={() => {
                    setIsEditingUser({});
                    setNewUserUsername('');
                    setNewUserPassword('');
                    setNewUserRole('standard');
                    setNewUserAllLocs(false);
                    setNewUserAllowedLocs([]);
                    setNewUserAllowedQueries(['btn-q-mesa-bloqueada', 'btn-q-actividad', 'btn-q-subtotal']);
                  }}
                  style={{ padding: '6px 14px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Plus size={14} /> Nuevo Usuario
                </button>
              )}
            </div>

            <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden' }}>
              <table className="report-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.01)', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '12px 16px' }}>Usuario / Correo</th>
                    <th style={{ padding: '12px 16px' }}>Rol</th>
                    <th style={{ padding: '12px 16px' }}>Locales Permitidos</th>
                    <th style={{ padding: '12px 16px' }}>Consultas Permitidas</th>
                    <th style={{ padding: '12px 16px' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>{u.username}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ 
                          padding: '2px 8px', 
                          borderRadius: '10px', 
                          background: u.role === 'admin' ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.05)', 
                          color: u.role === 'admin' ? 'var(--success)' : 'var(--text-muted)',
                          fontSize: '0.75rem',
                          border: `1px solid ${u.role === 'admin' ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.08)'}`
                        }}>
                          {u.role === 'admin' ? 'Administrador' : 'Estándar'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {u.role === 'admin' || u.allLocations 
                          ? 'Todos los locales' 
                          : `${u.allowedLocations.length} locales`
                        }
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {u.role === 'admin' 
                          ? 'Todas' 
                          : `${u.allowedQueries.length} consultas`
                        }
                      </td>
                      <td style={{ padding: '12px 16px', display: 'flex', gap: '10px' }}>
                        <button
                          onClick={() => {
                            setIsEditingUser(u);
                            setNewUserUsername(u.username);
                            setNewUserPassword('');
                            setNewUserRole(u.role);
                            setNewUserAllLocs(u.allLocations || false);
                            setNewUserAllowedLocs(u.allowedLocations || []);
                            setNewUserAllowedQueries(u.allowedQueries || []);
                          }}
                          style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0 }}
                          title="Editar"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u.id)}
                          disabled={u.username === 'admin'}
                          style={{ background: 'none', border: 'none', color: u.username === 'admin' ? 'rgba(255,255,255,0.05)' : '#ef4444', cursor: u.username === 'admin' ? 'not-allowed' : 'pointer', padding: 0 }}
                          title="Eliminar"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* --- PROMPT MODAL OVERLAY --- */}
      {activeQueryPrompt && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-panel)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', maxWidth: '440px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent)' }}>
              <Database size={20} />
              <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'white' }}>Parámetros: {activeQueryPrompt.name}</h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {activeQueryPrompt.prompts.map((p: any, idx: number) => (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{p.text}</label>
                  <input
                    type={p.type}
                    min={p.min}
                    max={p.max}
                    value={promptValues[idx] || ''}
                    onChange={(e) => {
                      const newVals = [...promptValues];
                      newVals[idx] = e.target.value;
                      setPromptValues(newVals);
                    }}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)', color: 'white', outline: 'none', fontSize: '0.85rem' }}
                  />
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button 
                onClick={submitPromptedQuery} 
                style={{ flex: 1, padding: '10px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <CheckCircle2 size={16} /> Ejecutar
              </button>
              <button 
                onClick={() => setActiveQueryPrompt(null)} 
                style={{ flex: 1, padding: '10px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid var(--border)', borderRadius: '8px', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <X size={16} /> Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
