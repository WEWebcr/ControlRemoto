import { useState, useEffect } from 'react';
import { User, UserPlus, Trash2, Edit2, Shield, ShieldAlert, Key } from 'lucide-react';

interface Props {
  serverUrl: string;
  token: string;
  currentUser: { username: string; role: string; token: string };
}

interface UserData {
  username: string;
  role: string;
  passwordLength: number;
  tenant?: string;
}

export default function UsersManager({ serverUrl, token, currentUser }: Props) {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState(currentUser.role === 'admin' ? 'client' : 'sub_user');

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${serverUrl}/api/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
        setError(null);
      } else {
        setError('Error al obtener lista de usuarios');
      }
    } catch (e) {
      setError('Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [serverUrl, token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formUsername && !editingUser) return;
    if (!editingUser && !formPassword) return;

    try {
      const url = editingUser 
        ? `${serverUrl}/api/users/${editingUser}` 
        : `${serverUrl}/api/users`;
      
      const method = editingUser ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          username: formUsername, 
          password: formPassword || undefined,
          role: formRole
        })
      });

      const data = await res.json();
      if (data.success) {
        setSuccess(editingUser ? 'Usuario actualizado' : 'Usuario creado con éxito');
        setIsModalOpen(false);
        fetchUsers();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || 'Error guardando usuario');
      }
    } catch (e) {
      setError('Error de conexión');
    }
  };

  const handleDelete = async (username: string) => {
    if (username === 'admin') {
      alert('No puedes eliminar al administrador principal');
      return;
    }
    
    if (!confirm(`¿Estás seguro de eliminar al usuario "${username}"?`)) return;

    try {
      const res = await fetch(`${serverUrl}/api/users/${username}`, { 
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setSuccess('Usuario eliminado');
        fetchUsers();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || 'Error al eliminar');
      }
    } catch (e) {
      setError('Error de conexión');
    }
  };

  const openNewUserModal = () => {
    setEditingUser(null);
    setFormUsername('');
    setFormPassword('');
    setFormRole(currentUser.role === 'admin' ? 'client' : 'sub_user');
    setIsModalOpen(true);
  };

  const openEditModal = (user: UserData) => {
    setEditingUser(user.username);
    setFormUsername(user.username);
    setFormPassword(''); // Don't show existing password
    setFormRole(user.role);
    setIsModalOpen(true);
  };

  return (
    <div style={{ padding: '24px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2>Gestión de Usuarios</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Administra los accesos a la plataforma remota</p>
        </div>
        <button className="btn-primary" onClick={openNewUserModal} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <UserPlus size={18} />
          Nuevo Usuario
        </button>
      </div>

      {error && (
        <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', marginBottom: '16px', color: '#ef4444' }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{ padding: '12px', background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.2)', borderRadius: '8px', marginBottom: '16px', color: '#22c55e' }}>
          {success}
        </div>
      )}

      <div className="glass-panel" style={{ flex: 1, overflowY: 'auto', padding: '0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)' }}>
              <th style={{ padding: '16px' }}>Usuario</th>
              <th style={{ padding: '16px' }}>Rol de Acceso</th>
              <th style={{ padding: '16px' }}>Seguridad</th>
              <th style={{ padding: '16px', textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando usuarios...</td>
              </tr>
            ) : users.map(u => (
              <tr key={u.username} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <User size={16} />
                  </div>
                  <span style={{ fontWeight: 500 }}>{u.username}</span>
                </td>
                <td style={{ padding: '16px' }}>
                  <span style={{ 
                    display: 'inline-flex', alignItems: 'center', gap: '6px', 
                    padding: '4px 10px', borderRadius: '20px', fontSize: '0.8rem',
                    background: u.role === 'admin' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.1)',
                    color: u.role === 'admin' ? '#38bdf8' : 'var(--text-muted)'
                  }}>
                    {u.role === 'admin' ? <ShieldAlert size={14} /> : <Shield size={14} />}
                    {u.role === 'admin' ? 'Super Administrador' : u.role === 'client' ? 'Cliente Principal' : 'Sub-Usuario'}
                  </span>
                </td>
                <td style={{ padding: '16px', color: 'var(--text-muted)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Key size={14} /> ••••••••
                  </div>
                </td>
                <td style={{ padding: '16px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button className="btn-secondary" style={{ padding: '6px' }} onClick={() => openEditModal(u)} title="Editar">
                      <Edit2 size={16} />
                    </button>
                    {u.username !== 'admin' && (
                      <button className="btn-secondary" style={{ padding: '6px', color: '#ef4444' }} onClick={() => handleDelete(u.username)} title="Eliminar">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="glass-panel" style={{ width: '400px', padding: '24px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '20px' }}>{editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="input-group">
                <label>Nombre de Usuario</label>
                <input 
                  type="text" 
                  value={formUsername}
                  onChange={e => setFormUsername(e.target.value)}
                  disabled={!!editingUser}
                  required
                />
              </div>
              <div className="input-group">
                <label>Contraseña {editingUser && '(Dejar en blanco para mantener actual)'}</label>
                <input 
                  type="password" 
                  value={formPassword}
                  onChange={e => setFormPassword(e.target.value)}
                  required={!editingUser}
                />
              </div>
              <div className="input-group">
                <label>Rol de Acceso</label>
                <select 
                  value={formRole} 
                  onChange={e => setFormRole(e.target.value)}
                  disabled={editingUser === 'admin' || currentUser.role === 'client'}
                  style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '6px' }}
                >
                  {currentUser.role === 'admin' ? (
                    <>
                      <option value="client">Cliente Principal (Dueño de empresa)</option>
                      <option value="admin">Super Administrador (Acceso Total)</option>
                    </>
                  ) : (
                    <option value="sub_user">Sub-Usuario (Acceso a tus equipos)</option>
                  )}
                </select>
              </div>
              
              <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn-primary">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
