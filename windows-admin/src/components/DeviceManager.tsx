import { useState, useEffect } from 'react';
import { MonitorSmartphone, Plus, Trash2, ChevronDown, ChevronRight, ChevronUp, ChevronLeft, Folder, Monitor, FolderUp, WifiOff, Smartphone, LogOut, Cpu, HardDrive, FileText, CheckCircle2, Search, X, Pin, ArrowUpDown } from 'lucide-react';

import ScreenViewer from './ScreenViewer';
import FileManager from './FileManager';

interface Props {
  isConnected: boolean;
  isConnecting: boolean;
  onlineDevices: string[];
  onlineDevicesDetails?: any[];
  connectedRoomId: string;
  remoteStream: MediaStream | null;
  fileChannel: RTCDataChannel | null;
  onMouseEvent: (type: string, x: number, y: number) => void;
  onKeyEvent: (key: string) => void;
  onConnectScreen: (roomId: string) => void;
  onConnectFiles: (roomId: string) => void;
  onDisconnect: () => void;
  serverUrl?: string;
  token?: string;
  onLogout?: () => void;
  role?: string;
}

interface SavedDevice {
  id: string;
  name: string;
  group?: string;
  platform?: 'android' | 'windows' | 'manual';
  // Asset parameters
  placa?: string;
  marca?: string;
  modelo?: string;
  serie?: string;
  disco?: string;
  so?: string;
  procesador?: string;
  ram?: string;
  responsable?: string;
  notas?: string;
  estado?: 'Activo' | 'En Bodega' | 'Mantenimiento' | 'Dado de Baja';
  version?: string;
  updatedAt?: string;
}

const DEFAULT_ORGANIZATION_GROUPS = [
  "Sin Grupo"
];

export default function DeviceManager({ 
  isConnected, 
  isConnecting, 
  onlineDevices, 
  onlineDevicesDetails = [],
  connectedRoomId,
  remoteStream,
  fileChannel,
  onMouseEvent,
  onKeyEvent,
  onConnectScreen, 
  onConnectFiles, 
  onDisconnect,
  serverUrl = '',
  token = '',
  onLogout,
  role = 'user'
}: Props) {
  const [activeTab, setActiveTab] = useState<'list' | 'add'>('list');
  const [activeTool, setActiveTool] = useState<null | 'screen' | 'files'>(null);
  const [savedDevices, setSavedDevices] = useState<SavedDevice[]>(() => {
    const savedDevs = localStorage.getItem('rosti_saved_devices');
    if (savedDevs) {
      try {
        return JSON.parse(savedDevs);
      } catch (e) {
        console.error("Error parsing saved devices", e);
      }
    }
    return [];
  });
  const [savedGroups, setSavedGroups] = useState<string[]>(() => {
    const savedGrs = localStorage.getItem('rosti_saved_groups');
    let groupsList: string[] = [];
    if (savedGrs) {
      try {
        groupsList = JSON.parse(savedGrs);
      } catch (e) {
        console.error("Error parsing saved groups", e);
      }
    }
    if (groupsList.length === 0) {
      // Try to migrate from devices in localStorage if available
      const savedDevs = localStorage.getItem('rosti_saved_devices');
      let devicesList: SavedDevice[] = [];
      if (savedDevs) {
        try {
          devicesList = JSON.parse(savedDevs);
        } catch (e) {}
      }
      const existingGroups = Array.from(new Set(devicesList.map(d => d.group).filter(Boolean))) as string[];
      if (existingGroups.length > 0) {
        groupsList = existingGroups;
      } else {
        groupsList = DEFAULT_ORGANIZATION_GROUPS;
      }
      localStorage.setItem('rosti_saved_groups', JSON.stringify(groupsList));
    }
    return groupsList;
  });
  const [isGroupsLoadedFromServer, setIsGroupsLoadedFromServer] = useState(false);
  const [isDevicesLoadedFromServer, setIsDevicesLoadedFromServer] = useState(false);
  const [isPinnedGroupsLoadedFromServer, setIsPinnedGroupsLoadedFromServer] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<SavedDevice | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [pinnedGroups, setPinnedGroups] = useState<string[]>(() => {
    const pinned = localStorage.getItem('rosti_pinned_groups');
    if (pinned) {
      try {
        return JSON.parse(pinned);
      } catch (e) {
        console.error("Error parsing pinned groups", e);
      }
    }
    return [];
  });
  
  // Details View Tab ('services' | 'asset')
  const [detailsTab, setDetailsTab] = useState<'services' | 'asset'>('services');

  // Asset Details Edit Form States
  const [editName, setEditName] = useState('');
  const [editPlaca, setEditPlaca] = useState('');
  const [editResponsable, setEditResponsable] = useState('');
  const [editNotas, setEditNotas] = useState('');
  const [editEstado, setEditEstado] = useState<'Activo' | 'En Bodega' | 'Mantenimiento' | 'Dado de Baja'>('Activo');
  const [editMarca, setEditMarca] = useState('');
  const [editModelo, setEditModelo] = useState('');
  const [editSerie, setEditSerie] = useState('');
  const [editDisco, setEditDisco] = useState('');
  const [editRAM, setEditRAM] = useState('');
  const [editCPU, setEditCPU] = useState('');
  const [editSO, setEditSO] = useState('');
  const [editVersion, setEditVersion] = useState('');

  // Populate edit states when selectedDevice changes
  useEffect(() => {
    if (selectedDevice) {
      setEditName(selectedDevice.name || '');
      setEditPlaca(selectedDevice.placa || '');
      setEditResponsable(selectedDevice.responsable || '');
      setEditNotas(selectedDevice.notas || '');
      setEditEstado(selectedDevice.estado || 'Activo');
      setEditMarca(selectedDevice.marca || '');
      setEditModelo(selectedDevice.modelo || '');
      setEditSerie(selectedDevice.serie || '');
      setEditDisco(selectedDevice.disco || '');
      setEditRAM(selectedDevice.ram || '');
      setEditCPU(selectedDevice.procesador || '');
      setEditSO(selectedDevice.so || '');
      setEditVersion(selectedDevice.version || '');
    }
  }, [selectedDevice]);

  // Auto-merge specs and auto-register new online devices
  useEffect(() => {
    if (!onlineDevicesDetails || onlineDevicesDetails.length === 0) return;
    
    let hasChanges = false;
    let updatedDevices = [...savedDevices];
    let newGroupsAdded: string[] = [];

    // 1. Check for new online devices that are not in savedDevices
    onlineDevicesDetails.forEach(o => {
      // Ignore admin connections
      if (!o.isWindows && !o.isAndroid) return;
      
      const alreadySaved = updatedDevices.some(d => d.id === o.roomId);
      if (!alreadySaved) {
        hasChanges = true;
        const nameVal = (o.specs && o.specs.name) || o.roomId;
        const groupVal = (o.specs && o.specs.group) || 'Sin Grupo';
        
        // Add group to savedGroups if it is not there (only if groups have been loaded from server)
        if (isGroupsLoadedFromServer && groupVal && groupVal !== 'Sin Grupo' && !savedGroups.includes(groupVal) && !newGroupsAdded.includes(groupVal)) {
          newGroupsAdded.push(groupVal);
        }

        updatedDevices.push({
          id: o.roomId,
          name: nameVal,
          group: groupVal,
          platform: o.isWindows ? 'windows' : 'android',
          marca: o.specs?.marca || undefined,
          modelo: o.specs?.modelo || undefined,
          serie: o.specs?.serie || undefined,
          disco: o.specs?.disco || undefined,
          so: o.specs?.so || undefined,
          procesador: o.specs?.cpu || undefined,
          ram: o.specs?.ram || undefined,
          version: o.specs?.clientVersion || undefined,
          estado: 'Activo',
          updatedAt: new Date().toISOString()
        });
      }
    });

    // 2. Update existing devices with new specs (hardware only, preservation of custom names/groups)
    updatedDevices = updatedDevices.map(d => {
      const onlineDev = onlineDevicesDetails.find(o => o.roomId === d.id);
      if (onlineDev && onlineDev.specs) {
        const specs = onlineDev.specs;
        const hasSpecChanges = 
          (specs.marca !== undefined && d.marca !== specs.marca) ||
          (specs.modelo !== undefined && d.modelo !== specs.modelo) ||
          (specs.serie !== undefined && d.serie !== specs.serie) ||
          (specs.disco !== undefined && d.disco !== specs.disco) ||
          (specs.so !== undefined && d.so !== specs.so) ||
          (specs.cpu !== undefined && d.procesador !== specs.cpu) ||
          (specs.ram !== undefined && d.ram !== specs.ram) ||
          (specs.clientVersion !== undefined && d.version !== specs.clientVersion);

        if (hasSpecChanges) {
          hasChanges = true;
          return {
            ...d,
            marca: specs.marca !== undefined ? specs.marca : d.marca,
            modelo: specs.modelo !== undefined ? specs.modelo : d.modelo,
            serie: specs.serie !== undefined ? specs.serie : d.serie,
            disco: specs.disco !== undefined ? specs.disco : d.disco,
            so: specs.so !== undefined ? specs.so : d.so,
            procesador: specs.cpu !== undefined ? specs.cpu : d.procesador,
            ram: specs.ram !== undefined ? specs.ram : d.ram,
            version: specs.clientVersion !== undefined ? specs.clientVersion : d.version,
            updatedAt: new Date().toISOString()
          };
        }
      }
      return d;
    });

    if (hasChanges) {
      setSavedDevices(updatedDevices);
      localStorage.setItem('rosti_saved_devices', JSON.stringify(updatedDevices));
      
      // Update new groups if any
      if (newGroupsAdded.length > 0) {
        const updatedGroups = [...savedGroups, ...newGroupsAdded];
        setSavedGroups(updatedGroups);
        localStorage.setItem('rosti_saved_groups', JSON.stringify(updatedGroups));
        syncGroupsWithServer(updatedGroups);
      }

      // Update selected device if it was updated
      if (selectedDevice) {
        const currentUpdated = updatedDevices.find(d => d.id === selectedDevice.id);
        if (currentUpdated) {
          setSelectedDevice(currentUpdated);
        }
      }
    }
  }, [onlineDevicesDetails, savedDevices, savedGroups, selectedDevice, isGroupsLoadedFromServer]);

  // If we select a different device while connected, disconnect the active session
  useEffect(() => {
    if (isConnected && connectedRoomId && selectedDevice && selectedDevice.id !== connectedRoomId) {
      setActiveTool(null);
      onDisconnect();
    }
  }, [selectedDevice, isConnected, connectedRoomId, onDisconnect]);

  // Save modified asset details
  const saveAssetDetails = () => {
    if (!selectedDevice) return;
    const updatedDev = {
      ...selectedDevice,
      name: editName.trim() || selectedDevice.name,
      placa: editPlaca.trim(),
      responsable: editResponsable.trim(),
      notas: editNotas.trim(),
      estado: editEstado,
      marca: editMarca.trim(),
      modelo: editModelo.trim(),
      serie: editSerie.trim(),
      disco: editDisco.trim(),
      ram: editRAM.trim(),
      procesador: editCPU.trim(),
      so: editSO.trim(),
      version: editVersion.trim(),
      updatedAt: new Date().toISOString()
    };
    
    const newList = savedDevices.map(d => d.id === selectedDevice.id ? updatedDev : d);
    setSavedDevices(newList);
    localStorage.setItem('rosti_saved_devices', JSON.stringify(newList));
    setSelectedDevice(updatedDev);
  };
  
  // Form for new device & group
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [newGroup, setNewGroup] = useState('');
  const [newPlatform, setNewPlatform] = useState<'android' | 'windows' | 'manual'>('android');
  const [newGroupName, setNewGroupName] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const syncGroupsWithServer = async (groupsList: string[]) => {
    if (!serverUrl || !token || role !== 'admin') return;
    try {
      const res = await fetch(`${serverUrl}/api/groups`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ groups: groupsList })
      });
      if (res.status === 401) {
        console.warn("Session expired on server during groups sync. Logging out.");
        if (onLogout) onLogout();
      }
    } catch (e) {
      console.error("Error syncing groups with server:", e);
    }
  };

  const syncDevicesWithServer = async (devicesList: SavedDevice[]) => {
    if (!serverUrl || !token || role !== 'admin') return;
    try {
      const res = await fetch(`${serverUrl}/api/devices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ devices: devicesList })
      });
      if (res.status === 401) {
        if (onLogout) onLogout();
      }
    } catch (e) {
      console.error("Error syncing devices with server:", e);
    }
  };

  const syncPinnedGroupsWithServer = async (pinnedList: string[]) => {
    if (!serverUrl || !token || role !== 'admin') return;
    try {
      const res = await fetch(`${serverUrl}/api/pinned-groups`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ pinned: pinnedList })
      });
      if (res.status === 401) {
        if (onLogout) onLogout();
      }
    } catch (e) {
      console.error("Error syncing pinned groups with server:", e);
    }
  };

  // Sync devices to server when they change (after initial mount fetch)
  useEffect(() => {
    if (isDevicesLoadedFromServer && token) {
      syncDevicesWithServer(savedDevices);
    }
  }, [savedDevices, isDevicesLoadedFromServer, token]);

  // Sync pinned groups to server when they change (after initial mount fetch)
  useEffect(() => {
    if (isPinnedGroupsLoadedFromServer && token) {
      syncPinnedGroupsWithServer(pinnedGroups);
    }
  }, [pinnedGroups, isPinnedGroupsLoadedFromServer, token]);

  useEffect(() => {
    // Sync devices from server on mount
    if (serverUrl) {
      fetch(`${serverUrl}/api/devices`)
        .then(res => res.json())
        .then(serverDevices => {
          if (Array.isArray(serverDevices)) {
            let localDevs: SavedDevice[] = [];
            const savedDevs = localStorage.getItem('rosti_saved_devices');
            if (savedDevs) {
              try {
                localDevs = JSON.parse(savedDevs);
              } catch (e) {}
            }
            
            const mergedMap = new Map<string, SavedDevice>();
            localDevs.forEach(d => mergedMap.set(d.id, d));
            serverDevices.forEach(d => {
              const existing = mergedMap.get(d.id);
              if (!existing) {
                mergedMap.set(d.id, d);
              } else {
                const localDate = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
                const serverDate = d.updatedAt ? new Date(d.updatedAt).getTime() : 0;
                if (serverDate > localDate) {
                  mergedMap.set(d.id, { ...existing, ...d });
                } else {
                  mergedMap.set(d.id, { ...d, ...existing });
                }
              }
            });
            
            const mergedDevices = Array.from(mergedMap.values());
            setSavedDevices(mergedDevices);
            localStorage.setItem('rosti_saved_devices', JSON.stringify(mergedDevices));
            setIsDevicesLoadedFromServer(true);
          }
        })
        .catch(err => {
          console.error("Error fetching devices from server on mount:", err);
          setIsDevicesLoadedFromServer(true);
        });
    }
  }, [serverUrl]);

  useEffect(() => {
    // Sync pinned groups from server on mount
    if (serverUrl) {
      fetch(`${serverUrl}/api/pinned-groups`)
        .then(res => res.json())
        .then(serverPinned => {
          if (Array.isArray(serverPinned)) {
            let localPinned: string[] = [];
            const savedPinned = localStorage.getItem('rosti_pinned_groups');
            if (savedPinned) {
              try {
                localPinned = JSON.parse(savedPinned);
              } catch (e) {}
            }
            
            const mergedPinned = Array.from(new Set([...localPinned, ...serverPinned])).filter(Boolean) as string[];
            setPinnedGroups(mergedPinned);
            localStorage.setItem('rosti_pinned_groups', JSON.stringify(mergedPinned));
            setIsPinnedGroupsLoadedFromServer(true);
          }
        })
        .catch(err => {
          console.error("Error fetching pinned groups from server on mount:", err);
          setIsPinnedGroupsLoadedFromServer(true);
        });
    }
  }, [serverUrl]);

  useEffect(() => {
    // Sync from server on mount (Merge with local groups)
    if (serverUrl) {
      fetch(`${serverUrl}/api/groups`)
        .then(res => res.json())
        .then(serverGroups => {
          if (Array.isArray(serverGroups)) {
            // Get local groups
            let localGrs: string[] = [];
            const savedGrs = localStorage.getItem('rosti_saved_groups');
            if (savedGrs) {
              try {
                localGrs = JSON.parse(savedGrs);
              } catch (e) {}
            }
            
            // Merge lists (removing duplicates and falsy entries)
            const mergedGroups = Array.from(new Set([...localGrs, ...serverGroups])).filter(Boolean) as string[];
            
            // Ensure 'Sin Grupo' is there or default to it if empty
            if (mergedGroups.length === 0) {
              mergedGroups.push('Sin Grupo');
            }
            
            setSavedGroups(mergedGroups);
            localStorage.setItem('rosti_saved_groups', JSON.stringify(mergedGroups));
            setIsGroupsLoadedFromServer(true);
            
            // If the merged groups differ from the server groups (in elements or order), sync back to server
            const needsSync = JSON.stringify(mergedGroups) !== JSON.stringify(serverGroups);
            if (needsSync && token) {
              syncGroupsWithServer(mergedGroups);
            }
          }
        })
        .catch(err => {
          console.error("Error fetching groups from server on mount:", err);
          // If fetch fails, we still consider the initial load done so user can work
          setIsGroupsLoadedFromServer(true);
        });
    }
  }, [serverUrl, token]);

  const saveDevice = () => {
    if (!newId.trim() || !newName.trim()) return;
    const groupVal = newGroup.trim() || undefined;
    
    // Add to savedGroups if it doesn't exist
    if (groupVal && !savedGroups.includes(groupVal)) {
      const updatedGroups = [...savedGroups, groupVal];
      setSavedGroups(updatedGroups);
      localStorage.setItem('rosti_saved_groups', JSON.stringify(updatedGroups));
      syncGroupsWithServer(updatedGroups);
    }

    const newList = [...savedDevices, { id: newId.trim(), name: newName.trim(), group: groupVal, platform: newPlatform }];
    setSavedDevices(newList);
    localStorage.setItem('rosti_saved_devices', JSON.stringify(newList));
    setNewId('');
    setNewName('');
    setNewGroup('');
    setNewPlatform('android');
    setActiveTab('list');
  };

  const saveGroup = () => {
    const trimmed = newGroupName.trim();
    if (!trimmed) return;
    if (savedGroups.includes(trimmed)) {
      alert("El grupo ya existe");
      return;
    }
    const updatedGroups = [...savedGroups, trimmed];
    setSavedGroups(updatedGroups);
    localStorage.setItem('rosti_saved_groups', JSON.stringify(updatedGroups));
    syncGroupsWithServer(updatedGroups);
    setNewGroupName('');
    setActiveTab('list');
  };

  const removeGroup = (groupName: string) => {
    const updatedGroups = savedGroups.filter(g => g !== groupName);
    setSavedGroups(updatedGroups);
    localStorage.setItem('rosti_saved_groups', JSON.stringify(updatedGroups));
    syncGroupsWithServer(updatedGroups);

    // Update devices belonging to this group
    const updatedDevices = savedDevices.map(d => {
      if (d.group === groupName) {
        return { ...d, group: undefined };
      }
      return d;
    });
    setSavedDevices(updatedDevices);
    localStorage.setItem('rosti_saved_devices', JSON.stringify(updatedDevices));
    
    if (selectedDevice && selectedDevice.group === groupName) {
      setSelectedDevice({ ...selectedDevice, group: undefined });
    }
  };

  const updateDeviceGroup = (deviceId: string, groupName: string | undefined) => {
    const updatedDevices = savedDevices.map(d => {
      if (d.id === deviceId) {
        return { ...d, group: groupName || undefined };
      }
      return d;
    });
    setSavedDevices(updatedDevices);
    localStorage.setItem('rosti_saved_devices', JSON.stringify(updatedDevices));
    
    if (selectedDevice && selectedDevice.id === deviceId) {
      setSelectedDevice({ ...selectedDevice, group: groupName || undefined });
    }
  };

  const removeDevice = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newList = savedDevices.filter(d => d.id !== id);
    setSavedDevices(newList);
    localStorage.setItem('rosti_saved_devices', JSON.stringify(newList));
    if (selectedDevice?.id === id) {
      setSelectedDevice(null);
    }
  };

  const toggleGroup = (groupName: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }));
  };

  const moveGroup = (groupName: string, direction: 'up' | 'down', e: React.MouseEvent) => {
    e.stopPropagation();
    const index = savedGroups.indexOf(groupName);
    if (index === -1) return;
    
    const newGroups = [...savedGroups];
    if (direction === 'up' && index > 0) {
      const temp = newGroups[index];
      newGroups[index] = newGroups[index - 1];
      newGroups[index - 1] = temp;
    } else if (direction === 'down' && index < newGroups.length - 1) {
      const temp = newGroups[index];
      newGroups[index] = newGroups[index + 1];
      newGroups[index + 1] = temp;
    } else {
      return;
    }
    
    setSavedGroups(newGroups);
    localStorage.setItem('rosti_saved_groups', JSON.stringify(newGroups));
    syncGroupsWithServer(newGroups);
  };

  const togglePinGroup = (groupName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const isCurrentlyPinned = pinnedGroups.includes(groupName);
    let newPinned: string[];
    if (isCurrentlyPinned) {
      newPinned = pinnedGroups.filter(g => g !== groupName);
    } else {
      newPinned = [...pinnedGroups, groupName];
    }
    setPinnedGroups(newPinned);
    localStorage.setItem('rosti_pinned_groups', JSON.stringify(newPinned));
    
    // Reorder savedGroups: put pinned groups first (maintaining relative order), then unpinned
    const pinned = savedGroups.filter(g => newPinned.includes(g));
    const unpinned = savedGroups.filter(g => !newPinned.includes(g));
    const newGroups = [...pinned, ...unpinned];
    
    setSavedGroups(newGroups);
    localStorage.setItem('rosti_saved_groups', JSON.stringify(newGroups));
    syncGroupsWithServer(newGroups);
  };

  const sortGroupsAlphabetically = () => {
    const unpinned = savedGroups.filter(g => !pinnedGroups.includes(g));
    unpinned.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    
    const pinned = savedGroups.filter(g => pinnedGroups.includes(g));
    const newGroups = [...pinned, ...unpinned];
    
    setSavedGroups(newGroups);
    localStorage.setItem('rosti_saved_groups', JSON.stringify(newGroups));
    syncGroupsWithServer(newGroups);
  };

  const renderList = () => (
    <div className="list-panel">
      <div className="list-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Dispositivos</h2>
          
          {/* Botón de Orden Alfabético */}
          <button
            onClick={sortGroupsAlphabetically}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border)',
              color: 'var(--text-main)',
              borderRadius: '6px',
              padding: '6px 10px',
              fontSize: '0.75rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'background 0.2s, border-color 0.2s'
            }}
            title="Ordenar grupos alfabéticamente (los grupos fijados no se verán afectados)"
            className="hover-bright"
          >
            <ArrowUpDown size={14} />
            <span>A-Z</span>
          </button>
        </div>
        
        {/* Barra de búsqueda */}
        <div style={{ position: 'relative', marginTop: '12px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            type="text"
            placeholder="Buscar por nombre o ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              background: 'rgba(0, 0, 0, 0.25)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '8px 12px 8px 36px',
              color: 'var(--text-main)',
              fontSize: '0.85rem',
              outline: 'none',
              transition: 'border-color 0.2s, box-shadow 0.2s',
              boxSizing: 'border-box'
            }}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Limpiar búsqueda"
            >
              <X size={14} className="hover-bright" />
            </button>
          )}
        </div>

        {role === 'admin' && (
          <div className="tabs" style={{ marginTop: '16px', background: 'rgba(0,0,0,0.2)' }}>
            <div 
              className={`tab ${activeTab === 'list' ? 'active' : ''}`}
              onClick={() => setActiveTab('list')}
              style={{ fontSize: '0.8rem', padding: '6px 0' }}
            >
              Equipos
            </div>
            <div 
              className={`tab ${activeTab === 'add' ? 'active' : ''}`}
              onClick={() => setActiveTab('add')}
              style={{ fontSize: '0.8rem', padding: '6px 0' }}
            >
              + Añadir
            </div>
          </div>
        )}
      </div>

      {activeTab === 'add' ? (
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto', maxHeight: 'calc(100vh - 150px)' }}>
          {/* Formulario de Crear Grupo */}
          <div style={{ background: 'rgba(0,0,0,0.15)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: 'var(--accent)', fontWeight: 600 }}>Crear Nuevo Grupo</h3>
            <div className="input-group">
              <label>Nombre del Grupo</label>
              <input 
                type="text" 
                placeholder="Ej: Sucursal Norte" 
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
              />
              <button 
                style={{ marginTop: '8px', padding: '8px 12px', fontSize: '0.85rem' }} 
                onClick={saveGroup}
                disabled={!newGroupName.trim()}
              >
                <Plus size={16} />
                Crear Grupo
              </button>
            </div>
          </div>

          {/* Formulario de Vincular Equipo */}
          <div style={{ background: 'rgba(0,0,0,0.15)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: 'var(--accent)', fontWeight: 600 }}>Vincular Nuevo Equipo</h3>
            <div className="input-group">
              <label>Nombre del Equipo</label>
              <input 
                type="text" 
                placeholder="Ej: Tablet Cocina" 
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              
              <label style={{ marginTop: '8px' }}>Grupo (Opcional)</label>
              <input 
                type="text" 
                placeholder="Ej: Sucursal Centro" 
                list="groupsList"
                value={newGroup}
                onChange={(e) => setNewGroup(e.target.value)}
              />
              <datalist id="groupsList">
                {savedGroups.map(g => (
                  <option key={g} value={g} />
                ))}
              </datalist>

              <label style={{ marginTop: '8px' }}>ID Permanente</label>
              <input 
                type="text" 
                placeholder="Ej: 123-456" 
                value={newId}
                onChange={(e) => setNewId(e.target.value)}
              />
              
              <label style={{ marginTop: '8px' }}>Plataforma / Tipo de Activo</label>
              <select
                value={newPlatform}
                onChange={(e) => setNewPlatform(e.target.value as any)}
                style={{
                  background: 'rgba(0, 0, 0, 0.2)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-main)',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  fontSize: '0.9rem',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="windows">Windows (Control Remoto)</option>
                <option value="android">Android (Control Remoto)</option>
                <option value="manual">Activo Pasivo (Sin Control Remoto - ej. Pantalla, Impresora)</option>
              </select>

              <button 
                style={{ marginTop: '16px' }} 
                onClick={saveDevice}
                disabled={!newId.trim() || !newName.trim()}
              >
                <Plus size={18} />
                Guardar Equipo
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="device-list">
          {savedDevices.length === 0 && savedGroups.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', marginTop: '40px' }}>
              No hay equipos ni grupos vinculados.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {(() => {
                const query = searchTerm.toLowerCase().trim();
                const devicesToGroup = query 
                  ? savedDevices.filter(d => d.name.toLowerCase().includes(query) || d.id.toLowerCase().includes(query))
                  : savedDevices;

                if (query && devicesToGroup.length === 0) {
                  return (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', marginTop: '40px', fontStyle: 'italic' }}>
                      No se encontraron equipos para "{searchTerm}"
                    </p>
                  );
                }

                const acc: Record<string, SavedDevice[]> = {};
                if (query) {
                  devicesToGroup.forEach(device => {
                    const group = device.group || 'Sin Grupo';
                    if (!acc[group]) {
                      acc[group] = [];
                    }
                    acc[group].push(device);
                  });
                } else {
                  savedGroups.forEach(g => {
                    acc[g] = [];
                  });
                  savedDevices.forEach(device => {
                    const group = device.group || 'Sin Grupo';
                    if (!acc[group]) {
                      acc[group] = [];
                    }
                    acc[group].push(device);
                  });
                }

                // Ordenar los equipos alfabéticamente por nombre dentro de cada grupo
                Object.keys(acc).forEach(groupName => {
                  acc[groupName].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
                });

                return Object.entries(acc).map(([groupName, devices]) => {
                  const isCollapsed = query ? false : (collapsedGroups[groupName] || false);
                  const onlineCount = devices.filter(d => onlineDevices.includes(d.id)).length;
                  
                  return (
                    <div key={groupName} style={{ marginBottom: '8px' }}>
                      <div 
                        onClick={() => toggleGroup(groupName)}
                        style={{ 
                          display: 'flex', alignItems: 'center', gap: '8px',
                          padding: '8px 12px', cursor: 'pointer',
                          color: 'var(--text-muted)'
                        }}
                      >
                        {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                        <Folder size={14} />
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, flex: 1 }}>{groupName}</span>
                        <span style={{ fontSize: '0.75rem', color: onlineCount > 0 ? 'var(--success)' : 'inherit', marginRight: '4px' }}>
                          {onlineCount}/{devices.length}
                        </span>

                        {!searchTerm && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginRight: '4px' }}>
                            {/* Botón de fijar grupo */}
                            <button
                              onClick={(e) => togglePinGroup(groupName, e)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: pinnedGroups.includes(groupName) ? 'var(--accent)' : 'var(--text-muted)',
                                cursor: 'pointer',
                                padding: '2px',
                                display: 'flex',
                                alignItems: 'center'
                              }}
                              title={pinnedGroups.includes(groupName) ? "Desfijar Grupo" : "Fijar Grupo"}
                            >
                              <Pin size={13} style={{ transform: pinnedGroups.includes(groupName) ? 'none' : 'rotate(45deg)', transition: 'transform 0.2s' }} />
                            </button>

                            <button
                              onClick={(e) => moveGroup(groupName, 'up', e)}
                              disabled={savedGroups.indexOf(groupName) === 0}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: savedGroups.indexOf(groupName) === 0 ? 'rgba(255,255,255,0.15)' : 'var(--text-muted)',
                                cursor: savedGroups.indexOf(groupName) === 0 ? 'default' : 'pointer',
                                padding: '2px',
                                display: 'flex',
                                alignItems: 'center'
                              }}
                              title="Subir Grupo"
                            >
                              <ChevronUp size={14} className={savedGroups.indexOf(groupName) === 0 ? "" : "hover-bright"} />
                            </button>
                            <button
                              onClick={(e) => moveGroup(groupName, 'down', e)}
                              disabled={savedGroups.indexOf(groupName) === savedGroups.length - 1}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: savedGroups.indexOf(groupName) === savedGroups.length - 1 ? 'rgba(255,255,255,0.15)' : 'var(--text-muted)',
                                cursor: savedGroups.indexOf(groupName) === savedGroups.length - 1 ? 'default' : 'pointer',
                                padding: '2px',
                                display: 'flex',
                                alignItems: 'center'
                              }}
                              title="Bajar Grupo"
                            >
                              <ChevronDown size={14} className={savedGroups.indexOf(groupName) === savedGroups.length - 1 ? "" : "hover-bright"} />
                            </button>
                          </div>
                        )}

                        {role === 'admin' && groupName !== 'Sin Grupo' && groupName !== 'Sin Asignar' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`¿Estás seguro de eliminar el cliente "${groupName}"? Los equipos dentro de él se moverán a "Sin Asignar".`)) {
                                removeGroup(groupName);
                              }
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#ef4444',
                              cursor: 'pointer',
                              padding: '2px',
                              display: 'flex',
                              alignItems: 'center'
                            }}
                            title="Eliminar Cliente"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      
                      {!isCollapsed && (
                        <div style={{ display: 'flex', flexDirection: 'column', paddingLeft: '12px' }}>
                          {devices.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', padding: '8px 16px', margin: 0, fontStyle: 'italic' }}>
                              (Grupo vacío - Sin equipos)
                            </p>
                          ) : (
                            devices.map(device => {
                              const isOnline = onlineDevices.includes(device.id);
                              const isSelected = selectedDevice?.id === device.id;
                              return (
                                <div 
                                  key={device.id}
                                  className={`device-item ${isSelected ? 'active' : ''}`}
                                  onClick={() => {
                                    setSelectedDevice(device);
                                    if (connectedRoomId !== device.id) {
                                      setActiveTool(null);
                                    }
                                  }}
                                >
                                  <div className="device-icon">
                                    {device.platform === 'windows' ? (
                                      <Monitor size={18} style={{ color: '#38bdf8' }} />
                                    ) : device.platform === 'android' ? (
                                      <Smartphone size={18} style={{ color: '#a78bfa' }} />
                                    ) : (
                                      <MonitorSmartphone size={18} style={{ color: '#94a3b8' }} />
                                    )}
                                    {device.platform !== 'manual' && (
                                      <div style={{
                                        position: 'absolute', bottom: '6px', right: '6px',
                                        width: '8px', height: '8px', borderRadius: '50%',
                                        background: isOnline ? 'var(--success)' : '#ef4444',
                                        border: '2px solid var(--bg-dark)'
                                      }} />
                                    )}
                                  </div>
                                  <div className="device-info">
                                    <h4>{device.name}</h4>
                                    <p>
                                      {device.platform === 'manual' 
                                        ? (device.estado || 'Activo') 
                                        : (isOnline 
                                          ? `En línea${device.version ? ` (${device.version})` : ''}` 
                                          : 'Desconectado')}
                                    </p>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderDetails = () => {
    if (!selectedDevice) {
      return (
        <div className="details-panel">
          <div className="details-empty">
            <MonitorSmartphone size={64} style={{ opacity: 0.2, marginBottom: '24px' }} />
            <h3>Selecciona un dispositivo</h3>
            <p>Haz clic en un equipo de la lista para ver sus detalles y opciones de conexión.</p>
          </div>
        </div>
      );
    }

    const isOnline = onlineDevices.includes(selectedDevice.id);
    const isThisConnected = isConnected && connectedRoomId === selectedDevice.id;

    if (isThisConnected && activeTool) {
      const isWindows = selectedDevice.platform === 'windows';
      return (
        <div className="details-panel" style={{ padding: isWindows ? '16px' : '24px', display: 'flex', flexDirection: 'row', gap: '24px', height: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
          {/* Main Area (Screen / Files) */}
          <div style={{ flex: 1, border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'var(--bg-dark)' }}>
            {/* Top Bar for Windows */}
            {isWindows && (
              <div className="windows-top-bar" style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 20px',
                background: 'var(--bg-panel)',
                borderBottom: '1px solid var(--border)',
                gap: '24px',
                flexShrink: 0
              }}>
                {/* Left: Device Info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Monitor size={20} style={{ color: '#38bdf8' }} />
                  <div>
                    <h3 style={{ margin: 0, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                      {selectedDevice.name}
                      <span style={{ fontSize: '0.7rem', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)', padding: '2px 8px', borderRadius: '12px', fontWeight: 500 }}>
                        En Línea
                      </span>
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {selectedDevice.id}</p>
                  </div>
                </div>

                {/* Center: Tool Selector (Tabs) */}
                <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '8px' }}>
                  <button 
                    onClick={() => setActiveTool('screen')}
                    style={{
                      background: activeTool === 'screen' ? 'var(--primary)' : 'transparent',
                      color: '#fff',
                      border: 'none',
                      padding: '6px 16px',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'background 0.2s'
                    }}
                  >
                    <Monitor size={14} /> Pantalla
                  </button>
                  <button 
                    onClick={() => setActiveTool('files')}
                    style={{
                      background: activeTool === 'files' ? 'var(--primary)' : 'transparent',
                      color: '#fff',
                      border: 'none',
                      padding: '6px 16px',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'background 0.2s'
                    }}
                  >
                    <FolderUp size={14} /> Archivos
                  </button>
                </div>

                {/* Right: Group dropdown & Disconnect */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {role === 'admin' && (
              <>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Cliente:</span>
                <select
                  value={selectedDevice.group || ''}
                  onChange={(e) => updateDeviceGroup(selectedDevice.id, e.target.value)}
                  style={{
                    background: 'rgba(0, 0, 0, 0.2)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-main)',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    outline: 'none',
                    cursor: 'pointer',
                    height: '28px'
                  }}
                >
                  <option value="">Sin Asignar</option>
                  {savedGroups.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </>
            )}
          </div>
                  <button 
                    onClick={() => { setActiveTool(null); onDisconnect(); }} 
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-main)',
                      borderRadius: '6px',
                      padding: '6px 12px',
                      fontSize: '0.8rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      height: '28px'
                    }}
                  >
                    <Monitor size={14} /> Equipos
                  </button>
                  <button 
                    onClick={() => { setActiveTool(null); onDisconnect(); }} 
                    style={{
                      background: '#ef4444',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '6px 12px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      height: '28px'
                    }}
                  >
                    <WifiOff size={14} /> Desconectar
                  </button>
                  {onLogout && (
                    <button 
                      onClick={() => { setActiveTool(null); onDisconnect(); onLogout(); }} 
                      style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        color: '#ef4444',
                        borderRadius: '6px',
                        padding: '6px 12px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        height: '28px'
                      }}
                    >
                      <LogOut size={14} /> Salir
                    </button>
                  )}
                </div>
              </div>
            )}

            {activeTool === 'screen' && (
              <ScreenViewer 
                stream={remoteStream} 
                onMouseEvent={onMouseEvent} 
                onKeyEvent={onKeyEvent} 
                platform={selectedDevice.platform === 'manual' ? undefined : selectedDevice.platform}
                onDisconnect={onDisconnect}
              />
            )}
            {activeTool === 'files' && (
              <FileManager fileChannel={fileChannel} />
            )}
          </div>

          {/* Right Sidebar (Controls) - Rendered only for Android/non-Windows */}
          {!isWindows && (
            <div style={{ width: '280px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ background: 'var(--bg-panel)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border)' }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '1.2rem' }}>{selectedDevice.name}</h3>
                <p style={{ margin: '0 0 12px 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>ID: {selectedDevice.id}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  {role === 'admin' && (
                    <>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Cliente:</span>
                      <select
                        value={selectedDevice.group || ''}
                        onChange={(e) => updateDeviceGroup(selectedDevice.id, e.target.value)}
                        style={{
                          background: 'rgba(0, 0, 0, 0.2)',
                          border: '1px solid var(--border)',
                          color: 'var(--text-main)',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontSize: '0.8rem',
                          outline: 'none',
                          cursor: 'pointer',
                          flex: 1
                        }}
                      >
                        <option value="">Sin Asignar</option>
                        {savedGroups.map(g => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </select>
                    </>
                  )}
                </div>
                <div className="status-badge" style={{ marginTop: 0 }}>Conexión Activa</div>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button 
                  className={activeTool === 'screen' ? 'btn-primary' : 'btn-secondary'}
                  onClick={() => setActiveTool('screen')}
                  style={{ justifyContent: 'flex-start', padding: '16px' }}
                >
                  <Monitor size={20} /> Ver Pantalla
                </button>
                <button 
                  className={activeTool === 'files' ? 'btn-primary' : 'btn-secondary'}
                  onClick={() => setActiveTool('files')}
                  style={{ justifyContent: 'flex-start', padding: '16px' }}
                >
                  <FolderUp size={20} /> Archivos
                </button>
                <div style={{ flex: 1 }}></div>
                <button onClick={() => { setActiveTool(null); onDisconnect(); }} style={{ background: '#ef4444', justifyContent: 'flex-start', padding: '16px' }}>
                  <WifiOff size={20} /> Desconectar
                </button>
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="details-panel">
        <div className="details-content">
          <button 
            className="mobile-back-button"
            onClick={() => {
              setActiveTool(null);
              onDisconnect();
              setSelectedDevice(null);
            }}
            style={{
              display: 'none',
              alignItems: 'center',
              gap: '8px',
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '0.9rem',
              cursor: 'pointer',
              marginBottom: '16px',
              padding: '8px 0',
              outline: 'none'
            }}
          >
            <ChevronLeft size={18} /> Volver a la lista
          </button>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="device-header-large">
              <div className="icon-wrapper">
                {selectedDevice.platform === 'windows' ? (
                  <Monitor size={40} style={{ color: '#38bdf8' }} />
                ) : selectedDevice.platform === 'android' ? (
                  <Smartphone size={40} style={{ color: '#a78bfa' }} />
                ) : (
                  <MonitorSmartphone size={40} />
                )}
              </div>
              <div>
                <h2 style={{ fontSize: '1.8rem', marginBottom: '8px' }}>{selectedDevice.name}</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--text-muted)' }}>ID: {selectedDevice.id}</span>
                  {selectedDevice.platform === 'manual' ? (
                    <span className="status-badge" style={{ background: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8' }}>Activo Pasivo ({selectedDevice.estado || 'Activo'})</span>
                  ) : isOnline ? (
                    <span className="status-badge">En línea {selectedDevice.version ? `(${selectedDevice.version})` : ''}</span>
                  ) : (
                    <span className="status-badge" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>Desconectado</span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
                  {role === 'admin' && (
                    <>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Cliente:</span>
                      <select
                        value={selectedDevice.group || ''}
                        onChange={(e) => updateDeviceGroup(selectedDevice.id, e.target.value)}
                        style={{
                          background: 'rgba(0, 0, 0, 0.2)',
                          border: '1px solid var(--border)',
                          color: 'var(--text-main)',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontSize: '0.85rem',
                          outline: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="">Sin Asignar</option>
                        {savedGroups.map(g => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </select>
                    </>
                  )}
                </div>
              </div>
            </div>
            
            <button 
              onClick={(e) => removeDevice(selectedDevice.id, e)}
              className="btn-secondary"
              style={{ color: '#ef4444', border: 'none', background: 'transparent' }}
            >
              <Trash2 size={18} /> Eliminar
            </button>
          </div>

          <div style={{ display: 'flex', gap: '20px', borderBottom: '1px solid var(--border)', marginBottom: '24px', marginTop: '24px' }}>
            <div 
              onClick={() => setDetailsTab('services')}
              style={{
                paddingBottom: '10px',
                fontWeight: 600,
                fontSize: '1rem',
                cursor: 'pointer',
                color: detailsTab === 'services' ? 'var(--accent)' : 'var(--text-muted)',
                borderBottom: detailsTab === 'services' ? '2px solid var(--accent)' : 'none',
                transition: 'all 0.2s'
              }}
            >
              Conexión y Soporte
            </div>
            <div 
              onClick={() => setDetailsTab('asset')}
              style={{
                paddingBottom: '10px',
                fontWeight: 600,
                fontSize: '1rem',
                cursor: 'pointer',
                color: detailsTab === 'asset' ? 'var(--accent)' : 'var(--text-muted)',
                borderBottom: detailsTab === 'asset' ? '2px solid var(--accent)' : 'none',
                transition: 'all 0.2s'
              }}
            >
              Ficha de Activo (Inventario)
            </div>
          </div>

          {detailsTab === 'services' ? (
            selectedDevice.platform === 'manual' ? (
              <div style={{ padding: '32px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px dashed var(--border)', color: 'var(--text-muted)', marginTop: '20px' }}>
                <MonitorSmartphone size={48} style={{ opacity: 0.3, marginBottom: '16px', color: '#94a3b8' }} />
                <h3>Activo Pasivo de Inventario</h3>
                <p style={{ maxWidth: '400px', margin: '8px auto', fontSize: '0.9rem' }}>
                  Este equipo fue catalogado manualmente (ej. pantalla, periférico, mobiliario) y no admite soporte o control remoto WebRTC.
                </p>
              </div>
            ) : (
              <>
                <h3 style={{ marginBottom: '24px', fontSize: '1.1rem', color: 'var(--text-muted)' }}>Servicios Disponibles</h3>

              <div className="action-grid">
                <div 
                  className={`action-card ${isOnline && !isConnecting ? 'primary' : ''}`}
                  onClick={() => {
                    if (isOnline && !isConnecting) {
                      setActiveTool('screen');
                      if (!isThisConnected) onConnectScreen(selectedDevice.id);
                    }
                  }}
                  style={{ opacity: isOnline ? 1 : 0.5, cursor: isOnline ? 'pointer' : 'not-allowed' }}
                >
                  <div className="action-icon">
                    <Monitor size={24} />
                  </div>
                  <div>
                    <h3>Control Remoto</h3>
                    <p>Inicia una conexión de video segura. Podrás ver la pantalla del dispositivo y controlarlo remotamente.</p>
                  </div>
                  {isConnecting && <div style={{ color: 'var(--primary)', fontWeight: 'bold' }}>Conectando...</div>}
                </div>

                <div 
                  className="action-card"
                  onClick={() => {
                    if (isOnline && !isConnecting) {
                      setActiveTool('files');
                      if (!isThisConnected) onConnectFiles(selectedDevice.id);
                    }
                  }}
                  style={{ opacity: isOnline ? 1 : 0.5, cursor: isOnline ? 'pointer' : 'not-allowed' }}
                >
                  <div className="action-icon">
                    <FolderUp size={24} />
                  </div>
                  <div>
                    <h3>Transferencia de Archivos</h3>
                    <p>Explora el sistema de archivos del dispositivo. Sube o descarga documentos de forma bidireccional.</p>
                  </div>
                </div>
              </div>
            </>
            )
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
                
                {/* Form fields section */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', background: 'var(--bg-panel)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                  <h4 style={{ margin: '0 0 10px 0', borderBottom: '1px solid var(--border)', paddingBottom: '6px', color: 'var(--accent)' }}>Campos Personalizados (Inventario)</h4>
                  
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Nombre del Equipo</label>
                    <input 
                      type="text" 
                      value={editName} 
                      onChange={(e) => setEditName(e.target.value)} 
                      placeholder="ej. Alajuela-Servidor" 
                      style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: 'var(--text-main)', padding: '8px 12px', borderRadius: '6px', fontSize: '0.85rem', outline: 'none' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Placa de Activo</label>
                    <input 
                      type="text" 
                      value={editPlaca} 
                      onChange={(e) => setEditPlaca(e.target.value)} 
                      placeholder="ej. ACT-2026-0041" 
                      style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: 'var(--text-main)', padding: '8px 12px', borderRadius: '6px', fontSize: '0.85rem', outline: 'none' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Usuario Responsable</label>
                    <input 
                      type="text" 
                      value={editResponsable} 
                      onChange={(e) => setEditResponsable(e.target.value)} 
                      placeholder="ej. Ing. Carlos González" 
                      style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: 'var(--text-main)', padding: '8px 12px', borderRadius: '6px', fontSize: '0.85rem', outline: 'none' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Estado del Activo</label>
                    <select
                      value={editEstado}
                      onChange={(e) => setEditEstado(e.target.value as any)}
                      style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: 'var(--text-main)', padding: '8px 12px', borderRadius: '6px', fontSize: '0.85rem', outline: 'none', cursor: 'pointer' }}
                    >
                      <option value="Activo">Activo</option>
                      <option value="En Bodega">En Bodega</option>
                      <option value="Mantenimiento">Mantenimiento (Soporte)</option>
                      <option value="Dado de Baja">Dado de Baja</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Notas / Ubicación detallada</label>
                    <textarea 
                      value={editNotas} 
                      onChange={(e) => setEditNotas(e.target.value)} 
                      placeholder="Ubicación física, accesorios adicionales, etc." 
                      rows={3}
                      style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: 'var(--text-main)', padding: '8px 12px', borderRadius: '6px', fontSize: '0.85rem', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
                    />
                  </div>
                </div>

                {/* Tech specifications (auto-detected specs) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', background: 'var(--bg-panel)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '6px', marginBottom: '10px' }}>
                    <h4 style={{ margin: 0, color: 'var(--accent)' }}>Ficha Técnica</h4>
                    {selectedDevice.updatedAt && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Sinc: {new Date(selectedDevice.updatedAt).toLocaleDateString()}</span>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Marca</span>
                      <input 
                        type="text" 
                        value={editMarca} 
                        onChange={(e) => setEditMarca(e.target.value)} 
                        style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: 'var(--text-main)', padding: '6px 10px', borderRadius: '6px', fontSize: '0.8rem', outline: 'none' }}
                      />
                    </div>
                    <div>
                      <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Modelo</span>
                      <input 
                        type="text" 
                        value={editModelo} 
                        onChange={(e) => setEditModelo(e.target.value)} 
                        style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: 'var(--text-main)', padding: '6px 10px', borderRadius: '6px', fontSize: '0.8rem', outline: 'none' }}
                      />
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Número de Serie</span>
                      <input 
                        type="text" 
                        value={editSerie} 
                        onChange={(e) => setEditSerie(e.target.value)} 
                        style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: 'var(--text-main)', padding: '6px 10px', borderRadius: '6px', fontSize: '0.8rem', outline: 'none', fontFamily: 'monospace' }}
                      />
                    </div>
                    <div>
                      <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Disco Principal</span>
                      <input 
                        type="text" 
                        value={editDisco} 
                        onChange={(e) => setEditDisco(e.target.value)} 
                        style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: 'var(--text-main)', padding: '6px 10px', borderRadius: '6px', fontSize: '0.8rem', outline: 'none' }}
                      />
                    </div>
                    <div>
                      <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Memoria RAM</span>
                      <input 
                        type="text" 
                        value={editRAM} 
                        onChange={(e) => setEditRAM(e.target.value)} 
                        style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: 'var(--text-main)', padding: '6px 10px', borderRadius: '6px', fontSize: '0.8rem', outline: 'none' }}
                      />
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Procesador (CPU)</span>
                      <input 
                        type="text" 
                        value={editCPU} 
                        onChange={(e) => setEditCPU(e.target.value)} 
                        style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: 'var(--text-main)', padding: '6px 10px', borderRadius: '6px', fontSize: '0.8rem', outline: 'none' }}
                      />
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Sistema Operativo</span>
                      <input 
                        type="text" 
                        value={editSO} 
                        onChange={(e) => setEditSO(e.target.value)} 
                        style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: 'var(--text-main)', padding: '6px 10px', borderRadius: '6px', fontSize: '0.8rem', outline: 'none' }}
                      />
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Versión de Agente</span>
                      <input 
                        type="text" 
                        value={editVersion} 
                        onChange={(e) => setEditVersion(e.target.value)} 
                        style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: 'var(--text-main)', padding: '6px 10px', borderRadius: '6px', fontSize: '0.8rem', outline: 'none' }}
                      />
                    </div>
                  </div>
                </div>

              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
                <button
                  onClick={saveAssetDetails}
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px 20px',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                  className="hover-bright"
                >
                  <CheckCircle2 size={16} /> Guardar Ficha de Activo
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`device-manager-layout ${selectedDevice ? 'has-selected-device' : ''}`} style={{ display: 'flex', flex: 1, width: '100%', height: '100%', overflow: 'hidden' }}>
      {(!isConnected || activeTool === null) && renderList()}
      {renderDetails()}
    </div>
  );
}
