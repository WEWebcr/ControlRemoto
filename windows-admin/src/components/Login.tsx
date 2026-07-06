import { useState, useEffect } from 'react';
import { Settings } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (serverUrl: string, username: string, role: string, token: string) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [cloudUrl, setCloudUrl] = useState('https://remoto-control-jm.onrender.com');
  const [serverUrl, setServerUrl] = useState('cloud');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    const remember = localStorage.getItem('cr_remember_me') === 'true';
    if (remember) {
      setRememberMe(true);
      const savedUser = localStorage.getItem('cr_saved_username') || '';
      const savedPass = localStorage.getItem('cr_saved_password') || '';
      setUsername(savedUser);
      setPassword(savedPass);
    }
    const savedCloudUrl = localStorage.getItem('cr_cloud_url');
    if (savedCloudUrl) {
      setCloudUrl(savedCloudUrl);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      const url = serverUrl === 'cloud' ? cloudUrl : 'http://127.0.0.1:3000';
      const response = await fetch(`${url}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      
      const data = await response.json();
      if (data.success) {
        if (rememberMe) {
          localStorage.setItem('cr_remember_me', 'true');
          localStorage.setItem('cr_saved_username', username);
          localStorage.setItem('cr_saved_password', password);
        } else {
          localStorage.removeItem('cr_remember_me');
          localStorage.removeItem('cr_saved_username');
          localStorage.removeItem('cr_saved_password');
        }
        onLoginSuccess(url, data.username, data.role, data.token);
      } else {
        setError(data.error || 'Credenciales incorrectas. Acceso denegado.');
      }
    } catch (err) {
      setError('Error conectando al servidor. Asegúrate de que esté en ejecución.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-panel">
        <div className="login-header">
          <div className="icon-circle">
            <img src="./logo.png" alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <h2>Remoto Control J&M</h2>
          <p>Autenticación Requerida</p>
          <button 
            type="button" 
            onClick={() => setIsSettingsOpen(true)}
            style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            title="Configurar URL Nube"
          >
            <Settings size={20} />
          </button>
        </div>

        <form onSubmit={handleLogin} className="login-form">
          <div className="input-group">
            <label>Usuario</label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Ingresa tu usuario"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
              autoFocus
            />
          </div>
          
          <div className="input-group">
            <label>Contraseña</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <div className="input-group">
            <label>Servidor de Conexión</label>
            <select 
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              style={{ width: '100%', padding: '12px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', marginBottom: '8px' }}
            >
              <option value="cloud">☁️ Servidor Remoto (Nube)</option>
              <option value="local">💻 Servidor Local (LAN)</option>
            </select>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px', cursor: 'pointer', userSelect: 'none' }}>
            <input 
              type="checkbox" 
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--primary)' }}
            />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Recordar credenciales</span>
          </label>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="login-button" disabled={isLoading}>
            {isLoading ? 'Conectando...' : 'Iniciar Sesión'}
          </button>
        </form>
      </div>

      {isSettingsOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="glass-panel" style={{ width: '400px', padding: '24px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Settings size={20} />
              Configuración de Nube
            </h3>
            <div className="input-group">
              <label>URL de Servidor Nube</label>
              <input 
                type="text" 
                value={cloudUrl}
                onChange={e => setCloudUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
              <button 
                className="btn-secondary" 
                onClick={() => setIsSettingsOpen(false)}
              >
                Cancelar
              </button>
              <button 
                className="btn-primary" 
                onClick={() => {
                  localStorage.setItem('cr_cloud_url', cloudUrl);
                  setIsSettingsOpen(false);
                }}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
