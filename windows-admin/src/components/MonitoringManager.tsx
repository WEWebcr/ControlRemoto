import { useState, useEffect } from 'react';
import { Mail, Settings, Send, RefreshCw, CheckCircle2, AlertTriangle, Server, Clock, ToggleLeft, ToggleRight } from 'lucide-react';

interface Props {
  serverUrl: string;
  token: string;
}

interface SavedDevice {
  id: string;
  name: string;
  group?: string;
  platform?: 'android' | 'windows' | 'manual';
  updatedAt?: string;
}

interface EmailConfig {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass?: string;
  from: string;
  to: string;
  frequencyHours: number;
}

export default function MonitoringManager({ serverUrl, token }: Props) {
  // Config state
  const [config, setConfig] = useState<EmailConfig>({
    enabled: false,
    host: '',
    port: 587,
    secure: false,
    user: '',
    pass: '',
    from: '',
    to: '',
    frequencyHours: 4
  });

  // Devices & offline tracking state
  const [allDevices, setAllDevices] = useState<SavedDevice[]>([]);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [loadingDevices, setLoadingDevices] = useState(true);
  
  // Action status state
  const [actionLoading, setActionLoading] = useState<'saving' | 'testing' | 'reporting' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch email configuration
  const fetchConfig = async () => {
    try {
      const res = await fetch(`${serverUrl}/api/email-config`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setConfig({
          ...data,
          port: data.port || 587,
          frequencyHours: data.frequencyHours || 4
        });
      } else {
        setError('Error al obtener la configuración de correo');
      }
    } catch (e) {
      setError('Error de conexión con el servidor para la configuración de correo');
    } finally {
      setLoadingConfig(false);
    }
  };

  // Fetch devices and online status
  const fetchDevicesAndStatus = async () => {
    setLoadingDevices(true);
    try {
      // 1. Fetch devices list
      const devicesRes = await fetch(`${serverUrl}/api/devices`);
      let devicesData: SavedDevice[] = [];
      if (devicesRes.ok) {
        devicesData = await devicesRes.json();
        setAllDevices(devicesData);
      }

      // 2. Fetch server socket status
      const statusRes = await fetch(`${serverUrl}/status`);
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        const connected = new Set<string>([
          ...(statusData.androidOnline || []),
          ...(statusData.windowsOnline || [])
        ]);
        setOnlineIds(connected);
      }
    } catch (e) {
      console.error("Error fetching status or devices", e);
    } finally {
      setLoadingDevices(false);
    }
  };

  useEffect(() => {
    fetchConfig();
    fetchDevicesAndStatus();
    
    // Poll status every 30 seconds
    const interval = setInterval(fetchDevicesAndStatus, 30000);
    return () => clearInterval(interval);
  }, [serverUrl, token]);

  // Handle saving the configuration
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading('saving');
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`${serverUrl}/api/email-config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(config)
      });
      const data = await res.json();
      if (data.success) {
        setSuccess('Configuración de correo guardada con éxito.');
        setTimeout(() => setSuccess(null), 4000);
      } else {
        setError(data.error || 'Error al guardar los ajustes');
      }
    } catch (e) {
      setError('Error al conectar con el servidor');
    } finally {
      setActionLoading(null);
    }
  };

  // Handle connection test
  const handleTest = async () => {
    if (!config.host || !config.to) {
      setError('Debe rellenar al menos el Host de correo y el Destinatario para enviar una prueba.');
      return;
    }

    setActionLoading('testing');
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`${serverUrl}/api/email-config/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(config)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess('¡Correo de prueba enviado con éxito! Verifique su bandeja de entrada.');
        setTimeout(() => setSuccess(null), 5000);
      } else {
        setError(data.error || 'Fallo al enviar correo de prueba. Verifique los datos de conexión.');
      }
    } catch (e: any) {
      setError('Error de red al realizar la prueba: ' + (e.message || ''));
    } finally {
      setActionLoading(null);
    }
  };

  // Handle manual offline report triggers
  const handleSendReportNow = async () => {
    setActionLoading('reporting');
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`${serverUrl}/api/email-config/send-report`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess('Reporte de equipos fuera de línea enviado correctamente.');
        setTimeout(() => setSuccess(null), 5000);
      } else {
        setError(data.error || 'No se pudo enviar el reporte. Verifique la configuración de correo.');
      }
    } catch (e: any) {
      setError('Error al solicitar envío de reporte: ' + (e.message || ''));
    } finally {
      setActionLoading(null);
    }
  };

  // Calculate lists
  const monitoredDevices = allDevices.filter(d => d.platform !== 'manual');
  const offlineDevices = monitoredDevices.filter(d => !onlineIds.has(d.id));
  const onlineDevicesCount = monitoredDevices.length - offlineDevices.length;

  return (
    <div style={{ padding: '24px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Mail size={28} style={{ color: 'var(--primary)' }} />
            Monitoreo y Alertas por Correo
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
            Programa reportes automáticos de equipos fuera de línea y realiza el mantenimiento del servidor SMTP.
          </p>
        </div>
        
        <button 
          className="btn-secondary" 
          onClick={() => { fetchConfig(); fetchDevicesAndStatus(); }}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          disabled={loadingConfig || loadingDevices}
        >
          <RefreshCw size={16} className={(loadingConfig || loadingDevices) ? 'spin' : ''} />
          Actualizar
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', marginBottom: '16px', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div style={{ padding: '12px 16px', background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.2)', borderRadius: '8px', marginBottom: '16px', color: '#22c55e', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <CheckCircle2 size={18} />
          <span>{success}</span>
        </div>
      )}

      {/* Layout Columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px', flex: 1, minHeight: 0 }}>
        
        {/* Left Column: Form Settings */}
        <div className="glass-panel" style={{ overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Settings size={18} />
              Configuración de Servidor SMTP
            </h3>
            
            {/* Enabled Switch */}
            <div 
              style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
              onClick={() => setConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
            >
              <span style={{ fontSize: '0.85rem', fontWeight: 500, color: config.enabled ? 'var(--primary)' : 'var(--text-muted)' }}>
                {config.enabled ? 'Automatización Activa' : 'Desactivado'}
              </span>
              {config.enabled ? (
                <ToggleRight size={32} style={{ color: 'var(--primary)' }} />
              ) : (
                <ToggleLeft size={32} style={{ color: 'var(--text-muted)' }} />
              )}
            </div>
          </div>

          {loadingConfig ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              Cargando configuración SMTP...
            </div>
          ) : (
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
                <div className="input-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>Servidor SMTP (Host)</label>
                  <input 
                    type="text" 
                    placeholder="smtp.example.com"
                    value={config.host}
                    onChange={e => setConfig(prev => ({ ...prev, host: e.target.value }))}
                    required={config.enabled}
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
                
                <div className="input-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>Puerto</label>
                  <input 
                    type="number" 
                    placeholder="587"
                    value={config.port}
                    onChange={e => setConfig(prev => ({ ...prev, port: parseInt(e.target.value, 10) || 587 }))}
                    required={config.enabled}
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '-4px' }}>
                <input 
                  type="checkbox" 
                  id="secure-smtp"
                  checked={config.secure}
                  onChange={e => setConfig(prev => ({ ...prev, secure: e.target.checked }))}
                  style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                />
                <label htmlFor="secure-smtp" style={{ fontSize: '0.85rem', color: 'var(--text-main)', cursor: 'pointer' }}>
                  Usar SSL/TLS Seguro (Puerto 465)
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="input-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>Usuario SMTP</label>
                  <input 
                    type="text" 
                    placeholder="correo@ejemplo.com"
                    value={config.user}
                    onChange={e => setConfig(prev => ({ ...prev, user: e.target.value }))}
                    required={config.enabled}
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
                
                <div className="input-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>
                    Contraseña {config.pass === '********' && '(Guardada)'}
                  </label>
                  <input 
                    type="password" 
                    placeholder="••••••••"
                    value={config.pass}
                    onChange={e => setConfig(prev => ({ ...prev, pass: e.target.value }))}
                    required={config.enabled && !config.pass}
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="input-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>Remitente (De)</label>
                  <input 
                    type="email" 
                    placeholder="alertas@rosticontrol.com"
                    value={config.from}
                    onChange={e => setConfig(prev => ({ ...prev, from: e.target.value }))}
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
                
                <div className="input-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>Destinatario (Para)</label>
                  <input 
                    type="text" 
                    placeholder="admin@ejemplo.com"
                    value={config.to}
                    onChange={e => setConfig(prev => ({ ...prev, to: e.target.value }))}
                    required={config.enabled}
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div className="input-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>
                  Frecuencia de Reporte Automático
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Clock size={18} style={{ color: 'var(--text-muted)' }} />
                  <select 
                    value={config.frequencyHours}
                    onChange={e => setConfig(prev => ({ ...prev, frequencyHours: parseInt(e.target.value, 10) }))}
                    style={{ 
                      flex: 1, 
                      padding: '10px', 
                      background: 'rgba(0,0,0,0.3)', 
                      border: '1px solid rgba(255,255,255,0.1)', 
                      color: 'white', 
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    <option value={2}>Cada 2 horas</option>
                    <option value={4}>Cada 4 horas</option>
                    <option value={8}>Cada 8 horas</option>
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ 
                marginTop: 'auto', 
                paddingTop: '20px', 
                borderTop: '1px solid var(--border)', 
                display: 'flex', 
                justifyContent: 'space-between',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button 
                    type="button" 
                    className="btn-secondary"
                    onClick={handleTest}
                    disabled={actionLoading !== null}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <Send size={16} />
                    {actionLoading === 'testing' ? 'Enviando...' : 'Enviar Prueba'}
                  </button>
                  
                  <button 
                    type="button" 
                    className="btn-secondary"
                    onClick={handleSendReportNow}
                    disabled={actionLoading !== null || !config.host}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <Mail size={16} />
                    {actionLoading === 'reporting' ? 'Enviando...' : 'Reportar Ahora'}
                  </button>
                </div>

                <button 
                  type="submit" 
                  className="btn-primary"
                  disabled={actionLoading !== null}
                >
                  {actionLoading === 'saving' ? 'Guardando...' : 'Guardar Ajustes'}
                </button>
              </div>

            </form>
          )}
        </div>

        {/* Right Column: Status & Offline Devices List */}
        <div className="glass-panel" style={{ overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ margin: 0, marginBottom: '20px', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
            <Server size={18} />
            Estado de Equipos Registrados
          </h3>

          {/* Quick Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            
            <div style={{ 
              background: 'rgba(16, 185, 129, 0.08)', 
              border: '1px solid rgba(16, 185, 129, 0.15)', 
              borderRadius: '12px', 
              padding: '16px', 
              textAlign: 'center' 
            }}>
              <span style={{ fontSize: '0.8rem', color: '#10b981', display: 'block', marginBottom: '4px', fontWeight: 600 }}>EN LÍNEA</span>
              <span style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#10b981' }}>
                {loadingDevices ? '...' : onlineDevicesCount}
              </span>
            </div>

            <div style={{ 
              background: offlineDevices.length > 0 ? 'rgba(239, 68, 68, 0.08)' : 'rgba(255,255,255,0.03)', 
              border: offlineDevices.length > 0 ? '1px solid rgba(239, 68, 68, 0.15)' : '1px solid var(--border)', 
              borderRadius: '12px', 
              padding: '16px', 
              textAlign: 'center' 
            }}>
              <span style={{ 
                fontSize: '0.8rem', 
                color: offlineDevices.length > 0 ? '#ef4444' : 'var(--text-muted)', 
                display: 'block', 
                marginBottom: '4px',
                fontWeight: 600
              }}>
                FUERA DE LÍNEA
              </span>
              <span style={{ 
                fontSize: '1.75rem', 
                fontWeight: 'bold', 
                color: offlineDevices.length > 0 ? '#ef4444' : 'var(--text-main)' 
              }}>
                {loadingDevices ? '...' : offlineDevices.length}
              </span>
            </div>

          </div>

          {/* Offline List */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '10px', display: 'block' }}>
              Lista de Equipos Fuera de Línea ({offlineDevices.length})
            </span>

            <div style={{ flex: 1, overflowY: 'auto', background: 'rgba(0,0,0,0.15)', borderRadius: '8px', border: '1px solid var(--border)', padding: '8px' }}>
              {loadingDevices ? (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Cargando equipos...
                </div>
              ) : offlineDevices.length === 0 ? (
                <div style={{ padding: '48px 16px', textAlign: 'center', color: '#10b981', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle2 size={32} />
                  <span style={{ fontWeight: 500 }}>¡Todos los equipos están en línea!</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No hay alertas activas de monitoreo.</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {offlineDevices.map(device => {
                    const lastActive = device.updatedAt ? new Date(device.updatedAt).toLocaleString('es-CR') : 'Desconocido';
                    return (
                      <div 
                        key={device.id} 
                        style={{ 
                          padding: '12px', 
                          background: 'rgba(239, 68, 68, 0.05)', 
                          border: '1px solid rgba(239, 68, 68, 0.1)', 
                          borderRadius: '8px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#fca5a5' }}>
                            {device.name}
                          </span>
                          <span style={{ 
                            fontSize: '0.7rem', 
                            padding: '2px 6px', 
                            borderRadius: '10px', 
                            background: 'rgba(255,255,255,0.05)', 
                            color: 'var(--text-muted)' 
                          }}>
                            {device.platform || 'Android'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          <span>ID: {device.id}</span>
                          <span>Grupo: {device.group || 'General'}</span>
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', marginTop: '2px' }}>
                          Última actividad: {lastActive}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
