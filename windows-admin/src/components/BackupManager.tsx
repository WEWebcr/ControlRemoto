import React, { useState, useRef } from 'react';
import { DatabaseBackup, Download, UploadCloud, AlertCircle, CheckCircle2, Loader2, Info } from 'lucide-react';

interface BackupManagerProps {
  serverUrl: string;
  token: string;
}

export default function BackupManager({ serverUrl, token }: BackupManagerProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      const res = await fetch(`${serverUrl}/api/backup/download`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        throw new Error('Error al generar el respaldo');
      }

      // Convert to blob and download
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `respaldo_control_remoto_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

    } catch (err) {
      console.error(err);
      alert('Hubo un error al intentar descargar el respaldo.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const file = e.target.files[0];
    if (!file.name.endsWith('.zip')) {
      setUploadStatus({ type: 'error', message: 'El archivo debe ser un formato .zip' });
      return;
    }

    if (!window.confirm(`¿Estás seguro de que deseas restaurar este respaldo? Se sobrescribirán todos los datos actuales.`)) {
      e.target.value = ''; // reset
      return;
    }

    try {
      setIsUploading(true);
      setUploadStatus(null);
      
      const formData = new FormData();
      formData.append('backup', file);

      const res = await fetch(`${serverUrl}/api/backup/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await res.json();
      if (data.success) {
        setUploadStatus({ type: 'success', message: 'Respaldo restaurado con éxito. Se recomienda recargar la página.' });
      } else {
        setUploadStatus({ type: 'error', message: data.message || 'Error al restaurar el respaldo' });
      }
    } catch (err) {
      setUploadStatus({ type: 'error', message: 'Error de red al subir el archivo' });
    } finally {
      setIsUploading(false);
      e.target.value = ''; // reset
    }
  };

  return (
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px', height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '20px' }}>
        <div style={{ padding: '12px', background: 'rgba(56, 189, 248, 0.1)', borderRadius: '12px', color: 'var(--accent)' }}>
          <DatabaseBackup size={32} />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 600 }}>Respaldos y Restauración</h2>
          <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)' }}>Protege la información de tu instancia de Render</p>
        </div>
      </div>

      <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '12px', padding: '16px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
        <Info size={24} style={{ color: '#3b82f6', flexShrink: 0 }} />
        <div style={{ fontSize: '0.9rem', color: 'var(--text-main)', lineHeight: 1.5 }}>
          <strong>Acerca del Almacenamiento en Render:</strong> Al usar el plan gratuito, Render reinicia el contenedor y restaura el código base (desde GitHub) cada vez que haces un despliegue. 
          Para no perder tus datos (usuarios, procesos, logos), asegúrate de descargar un respaldo antes de hacer cambios en el código, y restaurarlo al finalizar.
        </div>
      </div>

      {uploadStatus && (
        <div style={{ 
          padding: '16px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px',
          background: uploadStatus.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          border: `1px solid ${uploadStatus.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
          color: uploadStatus.type === 'success' ? '#10b981' : '#ef4444'
        }}>
          {uploadStatus.type === 'success' ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
          <span style={{ fontWeight: 500 }}>{uploadStatus.message}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginTop: '16px' }}>
        
        {/* Panel Descarga */}
        <div style={{ 
          background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: '16px', 
          padding: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '16px' 
        }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Download size={32} />
          </div>
          <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Descargar Datos</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0, lineHeight: 1.5 }}>
            Descarga un archivo .zip con toda la base de datos de usuarios, clientes, equipos, y logos configurados en este servidor.
          </p>
          <button 
            onClick={handleDownload} 
            disabled={isDownloading}
            style={{ 
              marginTop: 'auto', padding: '12px 24px', background: '#10b981', color: 'white', 
              border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '8px', transition: 'background 0.2s', width: '100%'
            }}
          >
            {isDownloading ? <Loader2 className="animate-spin" size={20} /> : <Download size={20} />}
            {isDownloading ? 'Generando ZIP...' : 'Descargar Respaldo'}
          </button>
        </div>

        {/* Panel Subida */}
        <div style={{ 
          background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: '16px', 
          padding: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '16px' 
        }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <UploadCloud size={32} />
          </div>
          <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Restaurar Datos</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0, lineHeight: 1.5 }}>
            Sube un archivo .zip generado previamente para restaurar todos los datos. <strong>Esto sobrescribirá los datos actuales.</strong>
          </p>
          <input 
            type="file" 
            accept=".zip" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            style={{ display: 'none' }} 
          />
          <button 
            onClick={handleUploadClick} 
            disabled={isUploading}
            style={{ 
              marginTop: 'auto', padding: '12px 24px', background: '#38bdf8', color: 'black', 
              border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '8px', transition: 'background 0.2s', width: '100%'
            }}
          >
            {isUploading ? <Loader2 className="animate-spin" size={20} /> : <UploadCloud size={20} />}
            {isUploading ? 'Restaurando...' : 'Subir y Restaurar'}
          </button>
        </div>

      </div>
    </div>
  );
}
