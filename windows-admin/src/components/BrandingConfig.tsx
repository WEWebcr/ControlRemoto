import React, { useState, useEffect } from 'react';
import { Palette, Image as ImageIcon, UploadCloud, Save, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';

interface BrandingConfigProps {
  token: string;
  serverUrl: string;
  currentBranding: any;
  onBrandingUpdated: (newBranding: any) => void;
}

export default function BrandingConfig({ token, serverUrl, currentBranding, onBrandingUpdated }: BrandingConfigProps) {
  const [primaryColor, setPrimaryColor] = useState(currentBranding?.primaryColor || '#8b5cf6');
  const [accentColor, setAccentColor] = useState(currentBranding?.accentColor || '#38bdf8');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>(currentBranding?.logoUrl ? `${serverUrl}${currentBranding.logoUrl}` : './logo.png');
  
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (currentBranding) {
      if (currentBranding.primaryColor) setPrimaryColor(currentBranding.primaryColor);
      if (currentBranding.accentColor) setAccentColor(currentBranding.accentColor);
      if (currentBranding.logoUrl) setLogoPreview(`${serverUrl}${currentBranding.logoUrl}`);
    }
  }, [currentBranding, serverUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setLogoFile(file);
      // Create local preview
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setLogoPreview(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusMessage(null);

    try {
      const formData = new FormData();
      formData.append('primaryColor', primaryColor);
      formData.append('accentColor', accentColor);
      if (logoFile) {
        formData.append('logo', logoFile);
      }

      const res = await fetch(`${serverUrl}/api/branding`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const result = await res.json();
      if (result.success) {
        setStatusMessage({ text: 'Configuración de marca guardada con éxito.', type: 'success' });
        onBrandingUpdated(result.data);
      } else {
        setStatusMessage({ text: result.message || 'Error al guardar los cambios.', type: 'error' });
      }
    } catch (err: any) {
      setStatusMessage({ text: 'Error de red al conectar con el servidor.', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  // Restablecer a los colores por defecto
  const handleReset = () => {
    setPrimaryColor('#8b5cf6');
    setAccentColor('#38bdf8');
  };

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
        <Palette size={28} style={{ color: primaryColor }} />
        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600 }}>Personalización de Marca</h2>
      </div>

      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '-8px' }}>
        Personaliza los colores y el logotipo para que la plataforma refleje la identidad visual de tu empresa. Los cambios se aplicarán inmediatamente.
      </p>

      {statusMessage && (
        <div style={{ 
          padding: '12px 16px', 
          borderRadius: '8px', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px',
          background: statusMessage.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          border: `1px solid ${statusMessage.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
          color: statusMessage.type === 'success' ? '#10b981' : '#ef4444'
        }}>
          {statusMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      <form onSubmit={handleSave} style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
        
        {/* Controles de Formulario */}
        <div style={{ flex: '1 1 350px', display: 'flex', flexDirection: 'column', gap: '24px', background: 'var(--bg-panel)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border)' }}>
          
          <div className="input-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', fontWeight: 500, color: 'white' }}>
              <ImageIcon size={16} style={{ color: 'var(--text-muted)' }} /> Logotipo de la Empresa
            </label>
            <p style={{ margin: '4px 0 12px 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Sube una imagen (PNG, JPG) preferiblemente con fondo transparente o cuadrado.
            </p>
            
            <label style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
              padding: '24px', border: '2px dashed var(--border)', borderRadius: '12px',
              cursor: 'pointer', background: 'rgba(0,0,0,0.2)', transition: 'all 0.2s'
            }} className="hover-bright">
              <UploadCloud size={32} style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Haz clic aquí para seleccionar un archivo</span>
              <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="input-group">
              <label style={{ fontSize: '0.9rem', fontWeight: 500, color: 'white' }}>Color Primario</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input 
                  type="color" 
                  value={primaryColor} 
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  style={{ padding: '0', width: '40px', height: '40px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: '8px', background: 'none' }}
                />
                <input 
                  type="text" 
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  style={{ flex: 1, fontFamily: 'monospace' }}
                />
              </div>
            </div>

            <div className="input-group">
              <label style={{ fontSize: '0.9rem', fontWeight: 500, color: 'white' }}>Color Secundario (Acento)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input 
                  type="color" 
                  value={accentColor} 
                  onChange={(e) => setAccentColor(e.target.value)}
                  style={{ padding: '0', width: '40px', height: '40px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: '8px', background: 'none' }}
                />
                <input 
                  type="text" 
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  style={{ flex: 1, fontFamily: 'monospace' }}
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
            <button type="button" onClick={handleReset} style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Restaurar por defecto
            </button>
            <button type="submit" disabled={isSaving} style={{ background: `linear-gradient(to right, ${primaryColor}, ${accentColor})` }}>
              {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              Guardar Cambios
            </button>
          </div>
        </div>

        {/* Vista Previa */}
        <div style={{ flex: '1 1 350px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-muted)' }}>Vista Previa</h3>
          
          <div style={{ 
            background: 'var(--bg-dark)', 
            border: '1px solid var(--border)', 
            borderRadius: '16px', 
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
          }}>
            {/* Header Preview */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '16px' }}>
              <div style={{ 
                width: '48px', height: '48px', borderRadius: '12px', overflow: 'hidden', 
                background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <img src={logoPreview} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ height: '12px', width: '120px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', marginBottom: '8px' }}></div>
                <div style={{ height: '8px', width: '80px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}></div>
              </div>
            </div>

            {/* Elements Preview */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ padding: '16px', borderRadius: '12px', background: 'var(--bg-panel)', border: `1px solid ${primaryColor}`, opacity: 0.8 }}>
                <div style={{ color: primaryColor, fontWeight: 600, fontSize: '0.85rem', marginBottom: '8px' }}>Módulo Activo</div>
                <div style={{ height: '8px', width: '100%', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', marginBottom: '6px' }}></div>
                <div style={{ height: '8px', width: '60%', background: 'rgba(255,255,255,0.1)', borderRadius: '4px' }}></div>
              </div>

              <div style={{ padding: '16px', borderRadius: '12px', background: 'var(--bg-panel)', border: `1px solid transparent` }}>
                <div style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem', marginBottom: '8px' }}>Módulo Inactivo</div>
                <div style={{ height: '8px', width: '100%', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', marginBottom: '6px' }}></div>
                <div style={{ height: '8px', width: '60%', background: 'rgba(255,255,255,0.1)', borderRadius: '4px' }}></div>
              </div>
            </div>

            {/* Buttons Preview */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1, padding: '10px', borderRadius: '8px', background: `linear-gradient(to right, ${primaryColor}, ${accentColor})`, color: 'white', textAlign: 'center', fontSize: '0.85rem', fontWeight: 600 }}>
                Botón Principal
              </div>
              <div style={{ flex: 1, padding: '10px', borderRadius: '8px', background: 'transparent', border: `1px solid ${accentColor}`, color: accentColor, textAlign: 'center', fontSize: '0.85rem', fontWeight: 600 }}>
                Botón Secundario
              </div>
            </div>

          </div>
        </div>

      </form>
    </div>
  );
}
