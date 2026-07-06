import { useState, useEffect } from 'react';
import { ClipboardList, Download, Printer, ArrowLeft, Search, Database, FileText, CheckCircle2, AlertTriangle, Disc, Layers, Plus, Edit, Trash2 } from 'lucide-react';

interface SavedDevice {
  id: string;
  name: string;
  group?: string;
  platform?: 'android' | 'windows' | 'manual';
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
  updatedAt?: string;
}

interface Props {
  onlineDevicesDetails: any[];
  onBackToDevices: () => void;
}

export default function AssetReport({ onlineDevicesDetails, onBackToDevices }: Props) {
  const [devices, setDevices] = useState<SavedDevice[]>([]);
  
  // Filter States
  const [searchText, setSearchText] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedOS, setSelectedOS] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Receipt Modal State
  const [selectedReceiptDevice, setSelectedReceiptDevice] = useState<SavedDevice | null>(null);
  const [receiptEmployee, setReceiptEmployee] = useState('');
  const [receiptIdCard, setReceiptIdCard] = useState('');
  const [receiptDepartment, setReceiptDepartment] = useState('');

  // Add/Edit Asset Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<SavedDevice | null>(null);

  // Form Fields State
  const [formPlaca, setFormPlaca] = useState('');
  const [formName, setFormName] = useState('');
  const [formGroup, setFormGroup] = useState('');
  const [formMarca, setFormMarca] = useState('');
  const [formModelo, setFormModelo] = useState('');
  const [formSerie, setFormSerie] = useState('');
  const [formDisco, setFormDisco] = useState('');
  const [formRAM, setFormRAM] = useState('');
  const [formProcesador, setFormProcesador] = useState('');
  const [formSO, setFormSO] = useState('');
  const [formResponsable, setFormResponsable] = useState('');
  const [formEstado, setFormEstado] = useState<'Activo' | 'En Bodega' | 'Mantenimiento' | 'Dado de Baja'>('Activo');
  const [formNotas, setFormNotas] = useState('');

  // Load Devices
  useEffect(() => {
    const savedDevs = localStorage.getItem('rosti_saved_devices');
    if (savedDevs) {
      try {
        const parsed = JSON.parse(savedDevs) as SavedDevice[];
        // Set default status 'Activo' if not defined
        const initialized = parsed.map(d => ({
          ...d,
          estado: d.estado || 'Activo'
        }));
        setDevices(initialized);
      } catch (e) {
        console.error("Error loading devices for report", e);
      }
    }
  }, []);

  // Recalculate groups and brands dynamically
  const groups = Array.from(new Set(devices.map(d => d.group).filter(Boolean))) as string[];
  const uniqueBrands = Array.from(new Set(devices.map(d => d.marca).filter(Boolean))) as string[];

  const openAddModal = () => {
    setEditingDevice(null);
    setFormPlaca('');
    setFormName('');
    setFormGroup('');
    setFormMarca('');
    setFormModelo('');
    setFormSerie('');
    setFormDisco('');
    setFormRAM('');
    setFormProcesador('');
    setFormSO('');
    setFormResponsable('');
    setFormEstado('Activo');
    setFormNotas('');
    setIsEditModalOpen(true);
  };

  const openEditModal = (dev: SavedDevice) => {
    setEditingDevice(dev);
    setFormPlaca(dev.placa || '');
    setFormName(dev.name || '');
    setFormGroup(dev.group || '');
    setFormMarca(dev.marca || '');
    setFormModelo(dev.modelo || '');
    setFormSerie(dev.serie || '');
    setFormDisco(dev.disco || '');
    setFormRAM(dev.ram || '');
    setFormProcesador(dev.procesador || '');
    setFormSO(dev.so || '');
    setFormResponsable(dev.responsable || '');
    setFormEstado(dev.estado || 'Activo');
    setFormNotas(dev.notas || '');
    setIsEditModalOpen(true);
  };

  const handleSaveDevice = () => {
    if (!formName.trim()) {
      alert('El nombre del equipo/activo es obligatorio.');
      return;
    }

    let updatedDevices: SavedDevice[] = [];
    const savedDevsStr = localStorage.getItem('rosti_saved_devices');
    const existingDevs: SavedDevice[] = savedDevsStr ? JSON.parse(savedDevsStr) : [];

    if (editingDevice) {
      // Editing existing device
      updatedDevices = existingDevs.map(d => {
        if (d.id === editingDevice.id) {
          return {
            ...d,
            placa: formPlaca.trim(),
            name: formName.trim(),
            group: formGroup.trim(),
            marca: formMarca.trim(),
            modelo: formModelo.trim(),
            serie: formSerie.trim(),
            disco: formDisco.trim(),
            ram: formRAM.trim(),
            procesador: formProcesador.trim(),
            so: formSO.trim(),
            responsable: formResponsable.trim(),
            estado: formEstado,
            notas: formNotas.trim(),
            updatedAt: new Date().toISOString()
          };
        }
        return d;
      });
    } else {
      // Creating new manual device
      const newId = 'manual-' + Math.random().toString(36).substring(2, 9).toUpperCase();
      const newDev: SavedDevice = {
        id: newId,
        name: formName.trim(),
        group: formGroup.trim() || undefined,
        platform: 'manual',
        placa: formPlaca.trim(),
        marca: formMarca.trim(),
        modelo: formModelo.trim(),
        serie: formSerie.trim(),
        disco: formDisco.trim(),
        ram: formRAM.trim(),
        procesador: formProcesador.trim(),
        so: formSO.trim(),
        responsable: formResponsable.trim(),
        estado: formEstado,
        notas: formNotas.trim(),
        updatedAt: new Date().toISOString()
      };
      updatedDevices = [...existingDevs, newDev];
    }

    // Save to localStorage
    localStorage.setItem('rosti_saved_devices', JSON.stringify(updatedDevices));
    
    // Update React state
    setDevices(updatedDevices.map(d => ({
      ...d,
      estado: d.estado || 'Activo'
    })));
    
    // Close modal
    setIsEditModalOpen(false);
  };

  const handleDeleteDevice = (id: string) => {
    if (!window.confirm('¿Estás seguro de eliminar este activo permanentemente de tu inventario?')) return;
    
    const savedDevsStr = localStorage.getItem('rosti_saved_devices');
    const existingDevs: SavedDevice[] = savedDevsStr ? JSON.parse(savedDevsStr) : [];
    
    const updatedDevices = existingDevs.filter(d => d.id !== id);
    
    // Save to localStorage
    localStorage.setItem('rosti_saved_devices', JSON.stringify(updatedDevices));
    
    // Update React state
    setDevices(updatedDevices.map(d => ({
      ...d,
      estado: d.estado || 'Activo'
    })));
    
    // Close modal
    setIsEditModalOpen(false);
  };

  // Filtered Devices
  const filteredDevices = devices.filter(d => {
    const matchesSearch = 
      d.name.toLowerCase().includes(searchText.toLowerCase()) ||
      d.id.toLowerCase().includes(searchText.toLowerCase()) ||
      (d.placa && d.placa.toLowerCase().includes(searchText.toLowerCase())) ||
      (d.serie && d.serie.toLowerCase().includes(searchText.toLowerCase())) ||
      (d.responsable && d.responsable.toLowerCase().includes(searchText.toLowerCase())) ||
      (d.marca && d.marca.toLowerCase().includes(searchText.toLowerCase())) ||
      (d.modelo && d.modelo.toLowerCase().includes(searchText.toLowerCase())) ||
      (d.so && d.so.toLowerCase().includes(searchText.toLowerCase()));

    const matchesGroup = !selectedGroup || d.group === selectedGroup;
    const matchesBrand = !selectedBrand || d.marca === selectedBrand;
    const matchesOS = !selectedOS || (d.so && d.so.includes(selectedOS));
    const matchesStatus = !selectedStatus || d.estado === selectedStatus;

    return matchesSearch && matchesGroup && matchesBrand && matchesOS && matchesStatus;
  });

  // Unique OS for filter dropdowns
  const uniqueOSList = ['Windows 11', 'Windows 10', 'macOS', 'Android', 'Linux'];

  // Metrics Calculations
  const totalCount = devices.length;
  const activeCount = devices.filter(d => d.estado === 'Activo' || !d.estado).length;
  const storageCount = devices.filter(d => d.estado === 'En Bodega').length;
  const maintenanceCount = devices.filter(d => d.estado === 'Mantenimiento').length;
  const retiredCount = devices.filter(d => d.estado === 'Dado de Baja').length;
  
  const hddCapacities = devices.filter(d => d.disco).map(d => d.disco);
  const winDevicesCount = devices.filter(d => d.platform === 'windows').length;
  const androidDevicesCount = devices.filter(d => d.platform === 'android').length;

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      'ID Equipo', 'Nombre', 'Grupo', 'Placa Activo', 'Marca', 'Modelo', 
      'Numero Serie', 'Capacidad Disco', 'Memoria RAM', 'Procesador', 
      'Sistema Operativo', 'Responsable', 'Estado', 'Notas'
    ];

    const rows = filteredDevices.map(d => [
      d.id, d.name, d.group || 'Sin Grupo', d.placa || '', d.marca || 'N/D', d.modelo || 'N/D',
      d.serie || 'N/D', d.disco || 'N/D', d.ram || 'N/D', d.procesador || 'N/D',
      d.so || 'N/D', d.responsable || 'N/D', d.estado || 'Activo', (d.notas || '').replace(/\n/g, ' ')
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Reporte_Activos_RostiRemoto_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print Inventory Report
  const handlePrintReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const htmlContent = `
      <html>
        <head>
          <title>Reporte de Activos de TI - RostiRemoto</title>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; color: #333; margin: 30px; }
            h1 { font-size: 24px; color: #1e3a8a; border-bottom: 2px solid #1e3a8a; padding-bottom: 8px; margin-bottom: 20px; }
            .meta { font-size: 13px; color: #555; margin-bottom: 20px; display: flex; justify-content: space-between; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
            th { background-color: #f3f4f6; color: #374151; font-weight: bold; border: 1px solid #d1d5db; padding: 6px; text-align: left; }
            td { border: 1px solid #d1d5db; padding: 6px; }
            tr:nth-child(even) { background-color: #f9fafb; }
            .badge { display: inline-block; padding: 2px 6px; font-size: 9px; font-weight: bold; border-radius: 4px; }
            .badge-activo { background-color: #d1fae5; color: #065f46; }
            .badge-bodega { background-color: #dbeafe; color: #1e40af; }
            .badge-soporte { background-color: #fef3c7; color: #92400e; }
            .badge-baja { background-color: #fee2e2; color: #991b1b; }
          </style>
        </head>
        <body>
          <h1>Reporte de Inventario y Activos Tecnológicos</h1>
          <div class="meta">
            <span>Generado el: ${new Date().toLocaleString()}</span>
            <span>Total Equipos Filtrados: ${filteredDevices.length}</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Placa</th>
                <th>Nombre Equipo</th>
                <th>Grupo</th>
                <th>Marca / Modelo</th>
                <th>Número Serie</th>
                <th>Disco / RAM</th>
                <th>Sist. Operativo</th>
                <th>Responsable</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              ${filteredDevices.map(d => `
                <tr>
                  <td><strong>${d.placa || '-'}</strong></td>
                  <td>${d.name} <br/><span style="color:#777;font-size:9px;">ID: ${d.id}</span></td>
                  <td>${d.group || 'Sin Grupo'}</td>
                  <td>${d.marca || '-'} ${d.modelo || '-'}</td>
                  <td style="font-family:monospace;">${d.serie || '-'}</td>
                  <td>${d.disco || '-'} / ${d.ram || '-'}</td>
                  <td>${d.so || '-'}</td>
                  <td>${d.responsable || '-'}</td>
                  <td>
                    <span class="badge badge-${(d.estado || 'Activo').replace(/\s+/g, '').toLowerCase()}">
                      ${d.estado || 'Activo'}
                    </span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <script>window.print();</script>
        </body>
      </html>
    `;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // Print Delivery Receipt (Acta de Entrega)
  const handlePrintReceipt = () => {
    if (!selectedReceiptDevice) return;
    const d = selectedReceiptDevice;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const htmlContent = `
      <html>
        <head>
          <title>Acta de Entrega de Equipo - ${d.name}</title>
          <style>
            @page { size: letter; margin: 12mm 15mm; }
            body { font-family: 'Segoe UI', Arial, sans-serif; color: #333; margin: 0; line-height: 1.4; font-size: 11.5px; }
            .header { text-align: center; border-bottom: 2px double #1e3a8a; padding-bottom: 8px; margin-bottom: 12px; }
            .header h1 { margin: 0; font-size: 16px; color: #1e3a8a; text-transform: uppercase; }
            .header p { margin: 3px 0 0 0; font-size: 10.5px; color: #555; }
            .intro-text { margin: 8px 0; font-size: 11px; }
            .section-title { font-weight: bold; font-size: 12px; color: #1e3a8a; border-bottom: 1px solid #d1d5db; padding-bottom: 2px; margin-top: 12px; margin-bottom: 6px; text-transform: uppercase; }
            table.info-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
            table.info-table td { padding: 4px 6px; border: 1px solid #e5e7eb; vertical-align: top; font-size: 11px; }
            table.info-table td.label { font-weight: bold; background-color: #f9fafb; width: 30%; }
            .terms { text-align: justify; margin: 8px 0; font-size: 9.5px; color: #4b5563; }
            .terms ol { margin: 0; padding-left: 15px; }
            .terms li { margin-bottom: 2px; }
            .signatures { display: flex; justify-content: space-between; margin-top: 30px; }
            .signature-block { width: 45%; text-align: center; font-size: 11px; }
            .signature-line { border-top: 1px solid #333; margin-top: 32px; padding-top: 4px; font-weight: bold; }
            .noprint-btn { background-color: #1e3a8a; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-weight: bold; cursor: pointer; margin-bottom: 10px; font-size: 11px; }
            @media print {
              .noprint-btn { display: none; }
              body { margin: 0; }
            }
          </style>
        </head>
        <body>
          <div style="text-align: right;">
            <button class="noprint-btn" onclick="window.print()">Imprimir Acta</button>
          </div>
          <div class="header">
            <h1>Acta de Entrega y Responsabilidad de Equipo Tecnológico</h1>
            <p>Departamento de Tecnologías de la Información - Corporación Rostipollos</p>
          </div>

          <p class="intro-text">Por medio del presente documento, se hace constar la entrega formal del equipo de cómputo y periféricos que se detallan a continuación, en calidad de herramienta de trabajo.</p>

          <div class="section-title">1. Datos del Colaborador Responsable</div>
          <table class="info-table">
            <tr>
              <td class="label">Nombre Completo:</td>
              <td>${receiptEmployee}</td>
            </tr>
            <tr>
              <td class="label">Identificación / Cédula:</td>
              <td>${receiptIdCard}</td>
            </tr>
            <tr>
              <td class="label">Departamento / Área:</td>
              <td>${receiptDepartment}</td>
            </tr>
            <tr>
              <td class="label">Fecha de Entrega:</td>
              <td>${new Date().toLocaleDateString()}</td>
            </tr>
          </table>

          <div class="section-title">2. Características del Activo Asignado</div>
          <table class="info-table">
            <tr>
              <td class="label">Placa de Activo:</td>
              <td><strong>${d.placa || 'N/A'}</strong></td>
            </tr>
            <tr>
              <td class="label">Nombre de Red:</td>
              <td>${d.name} (ID: ${d.id})</td>
            </tr>
            <tr>
              <td class="label">Marca y Modelo:</td>
              <td>${d.marca || 'Generic'} / ${d.modelo || 'Generic Model'}</td>
            </tr>
            <tr>
              <td class="label">Número de Serie:</td>
              <td style="font-family: monospace;">${d.serie || 'N/A'}</td>
            </tr>
            <tr>
              <td class="label">Procesador / CPU:</td>
              <td>${d.procesador || 'N/A'}</td>
            </tr>
            <tr>
              <td class="label">Memoria RAM:</td>
              <td>${d.ram || 'N/A'}</td>
            </tr>
            <tr>
              <td class="label">Almacenamiento (Disco C:):</td>
              <td>${d.disco || 'N/A'}</td>
            </tr>
            <tr>
              <td class="label">Sistema Operativo:</td>
              <td>${d.so || 'N/A'}</td>
            </tr>
            <tr>
              <td class="label">Notas adicionales:</td>
              <td>${d.notas || 'Sin comentarios.'}</td>
            </tr>
          </table>

          <div class="section-title">3. Términos y Condiciones de Responsabilidad</div>
          <div class="terms">
            <ol>
              <li>El colaborador declara recibir el equipo en excelentes condiciones físicas, de configuración y funcionamiento técnico.</li>
              <li>El activo tecnológico asignado es propiedad exclusiva de la empresa y se entrega únicamente como herramienta para el desempeño de las labores asociadas al cargo del colaborador. Queda estrictamente prohibido su uso para fines personales o ajenos a la compañía.</li>
              <li>Es responsabilidad del colaborador velar por el cuidado, seguridad y correcto uso del equipo. En caso de pérdida, robo o daño físico por negligencia o maltrato comprobado, el costo de reposición o reparación podrá ser asumido por el colaborador.</li>
              <li>El colaborador se compromete a no alterar la configuración de software autorizada, instalar programas piratas o no licenciados, ni remover o alterar los sistemas de monitoreo y seguridad remota (RostiRemoto) instalados.</li>
              <li>Al finalizar la relación laboral o cuando la empresa lo requiera, el colaborador deberá realizar la devolución inmediata del equipo en las mismas condiciones en que le fue entregado, salvo el desgaste normal por uso legítimo.</li>
            </ol>
          </div>

          <div class="signatures">
            <div class="signature-block">
              <p>Entregado por (IT):</p>
              <div class="signature-line">Firma Departamento TI</div>
            </div>
            <div class="signature-block">
              <p>Recibido Conforme (Colaborador):</p>
              <div class="signature-line">${receiptEmployee || 'Firma de Colaborador'}</div>
            </div>
          </div>
        </body>
      </html>
    `;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    setSelectedReceiptDevice(null);
    setReceiptEmployee('');
    setReceiptIdCard('');
    setReceiptDepartment('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', color: 'var(--text-color)', padding: '24px', overflowY: 'auto' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div 
            onClick={onBackToDevices} 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              width: '36px', 
              height: '36px', 
              borderRadius: '8px', 
              background: 'var(--bg-lighter)', 
              cursor: 'pointer',
              border: '1px solid var(--border-color)',
              transition: 'all 0.2s'
            }}
            className="hover-bright"
          >
            <ArrowLeft size={18} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ClipboardList size={24} style={{ color: 'var(--accent)' }} />
              Control e Inventario de Activos
            </h1>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Reportes detallados y especificaciones técnicas de los equipos registrados en RostiRemoto
            </p>
          </div>
        </div>
        
        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={openAddModal}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              color: '#10b981',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
            className="hover-bright"
          >
            <Plus size={16} />
            Agregar Activo Manual
          </button>
          <button 
            onClick={handleExportCSV} 
            disabled={filteredDevices.length === 0}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: 'var(--bg-lighter)',
              color: 'var(--text-color)',
              border: '1px solid var(--border-color)',
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: filteredDevices.length === 0 ? 'not-allowed' : 'pointer',
              opacity: filteredDevices.length === 0 ? 0.6 : 1
            }}
            className="hover-bright"
          >
            <Download size={16} />
            Exportar CSV
          </button>
          <button 
            onClick={handlePrintReport} 
            disabled={filteredDevices.length === 0}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: 'var(--accent)',
              color: '#fff',
              border: 'none',
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: filteredDevices.length === 0 ? 'not-allowed' : 'pointer',
              opacity: filteredDevices.length === 0 ? 0.6 : 1
            }}
            className="hover-bright"
          >
            <Printer size={16} />
            Imprimir Inventario
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="glass-panel" style={{ padding: '16px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Database size={24} style={{ color: '#3b82f6' }} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Equipos Registrados</p>
            <h3 style={{ margin: '4px 0 0 0', fontSize: '1.5rem', fontWeight: 700 }}>{totalCount}</h3>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '16px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle2 size={24} style={{ color: '#10b981' }} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Activos Operativos</p>
            <h3 style={{ margin: '4px 0 0 0', fontSize: '1.5rem', fontWeight: 700 }}>{activeCount}</h3>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '16px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Layers size={24} style={{ color: '#f59e0b' }} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Equipos en Bodega</p>
            <h3 style={{ margin: '4px 0 0 0', fontSize: '1.5rem', fontWeight: 700 }}>{storageCount}</h3>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '16px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertTriangle size={24} style={{ color: '#ef4444' }} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>En Soporte / Dañados</p>
            <h3 style={{ margin: '4px 0 0 0', fontSize: '1.5rem', fontWeight: 700 }}>{maintenanceCount + retiredCount}</h3>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="glass-panel" style={{ padding: '16px', borderRadius: '12px', marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
        
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            placeholder="Buscar por placa, serie, nombre, usuario..." 
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{
              width: '100%',
              backgroundColor: 'var(--bg-darker)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '8px 12px 8px 36px',
              fontSize: '0.85rem',
              color: 'var(--text-color)',
              outline: 'none'
            }}
          />
        </div>

        {/* Group Filter */}
        <select
          value={selectedGroup}
          onChange={(e) => setSelectedGroup(e.target.value)}
          style={{
            backgroundColor: 'var(--bg-darker)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '8px 12px',
            fontSize: '0.85rem',
            color: 'var(--text-color)',
            outline: 'none',
            minWidth: '150px'
          }}
        >
          <option value="">-- Todos los Grupos --</option>
          {groups.map(g => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>

        {/* Brand Filter */}
        <select
          value={selectedBrand}
          onChange={(e) => setSelectedBrand(e.target.value)}
          style={{
            backgroundColor: 'var(--bg-darker)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '8px 12px',
            fontSize: '0.85rem',
            color: 'var(--text-color)',
            outline: 'none',
            minWidth: '150px'
          }}
        >
          <option value="">-- Todas las Marcas --</option>
          {uniqueBrands.map(b => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>

        {/* OS Filter */}
        <select
          value={selectedOS}
          onChange={(e) => setSelectedOS(e.target.value)}
          style={{
            backgroundColor: 'var(--bg-darker)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '8px 12px',
            fontSize: '0.85rem',
            color: 'var(--text-color)',
            outline: 'none',
            minWidth: '150px'
          }}
        >
          <option value="">-- Todos los S.O. --</option>
          {uniqueOSList.map(o => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>

        {/* Status Filter */}
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          style={{
            backgroundColor: 'var(--bg-darker)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '8px 12px',
            fontSize: '0.85rem',
            color: 'var(--text-color)',
            outline: 'none',
            minWidth: '150px'
          }}
        >
          <option value="">-- Todos los Estados --</option>
          <option value="Activo">Activo</option>
          <option value="En Bodega">En Bodega</option>
          <option value="Mantenimiento">Mantenimiento</option>
          <option value="Dado de Baja">Dado de Baja</option>
        </select>

        {/* Clear filters */}
        {(searchText || selectedGroup || selectedBrand || selectedOS || selectedStatus) && (
          <button
            onClick={() => {
              setSearchText('');
              setSelectedGroup('');
              setSelectedBrand('');
              setSelectedOS('');
              setSelectedStatus('');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent)',
              fontSize: '0.8rem',
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Main Table */}
      <div className="glass-panel" style={{ flex: 1, borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ overflowX: 'auto', flex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-darker)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Placa de Activo</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Nombre Equipo</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Grupo</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Marca / Modelo</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Serie</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Capacidad Disco</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Usuario Responsable</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Estado</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, textTransform: 'none' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredDevices.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                    No se encontraron activos que coincidan con la búsqueda o filtros.
                  </td>
                </tr>
              ) : (
                filteredDevices.map(d => (
                  <tr key={d.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s' }} className="hover-bright">
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--accent)' }}>
                      {d.placa || 'Sin Placa'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600 }}>{d.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>ID: {d.id}</div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', backgroundColor: 'var(--bg-lighter)', border: '1px solid var(--border-color)' }}>
                        {d.group || 'Sin Grupo'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div>{d.marca || 'N/D'}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{d.modelo || 'N/D'}</div>
                    </td>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace' }}>
                      {d.serie || 'N/D'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div>{d.disco || 'N/D'}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>RAM: {d.ram || 'N/D'}</div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {d.responsable || 'Sin asignar'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span 
                        style={{
                          display: 'inline-block',
                          padding: '3px 8px',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          backgroundColor: 
                            d.estado === 'En Bodega' ? 'rgba(59, 130, 246, 0.15)' :
                            d.estado === 'Mantenimiento' ? 'rgba(245, 158, 11, 0.15)' :
                            d.estado === 'Dado de Baja' ? 'rgba(239, 68, 68, 0.15)' :
                            'rgba(16, 185, 129, 0.15)',
                          color:
                            d.estado === 'En Bodega' ? '#3b82f6' :
                            d.estado === 'Mantenimiento' ? '#f59e0b' :
                            d.estado === 'Dado de Baja' ? '#ef4444' :
                            '#10b981'
                        }}
                      >
                        {d.estado || 'Activo'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button
                          onClick={() => {
                            setSelectedReceiptDevice(d);
                            setReceiptEmployee(d.responsable || '');
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: 'rgba(59, 130, 246, 0.1)',
                            border: '1px solid rgba(59, 130, 246, 0.3)',
                            borderRadius: '6px',
                            padding: '4px 8px',
                            fontSize: '0.75rem',
                            color: '#3b82f6',
                            cursor: 'pointer',
                            fontWeight: 600
                          }}
                          className="hover-bright"
                          title="Generar Acta de Entrega firmada"
                        >
                          <FileText size={12} />
                          Acta
                        </button>
                        <button
                          onClick={() => openEditModal(d)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: 'rgba(245, 158, 11, 0.1)',
                            border: '1px solid rgba(245, 158, 11, 0.3)',
                            borderRadius: '6px',
                            padding: '4px 8px',
                            fontSize: '0.75rem',
                            color: '#f59e0b',
                            cursor: 'pointer',
                            fontWeight: 600
                          }}
                          className="hover-bright"
                          title="Editar detalles del Activo"
                        >
                          <Edit size={12} />
                          Editar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delivery Receipt Modal */}
      {selectedReceiptDevice && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div className="glass-panel" style={{
            width: '100%',
            maxWidth: '500px',
            borderRadius: '16px',
            padding: '24px',
            backgroundColor: 'var(--bg-dark)',
            border: '1px solid var(--border-color)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
          }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={20} style={{ color: 'var(--accent)' }} />
              Preparar Acta de Entrega
            </h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Introduce los datos del colaborador responsable del equipo <strong>{selectedReceiptDevice.name}</strong> para generar la hoja de firmas.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Nombre del Colaborador</label>
                <input 
                  type="text" 
                  value={receiptEmployee}
                  onChange={(e) => setReceiptEmployee(e.target.value)}
                  placeholder="ej. Juan Pérez"
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--bg-darker)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    fontSize: '0.85rem',
                    color: 'var(--text-color)',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Cédula / Documento de Identidad</label>
                <input 
                  type="text" 
                  value={receiptIdCard}
                  onChange={(e) => setReceiptIdCard(e.target.value)}
                  placeholder="ej. 1-1234-5678"
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--bg-darker)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    fontSize: '0.85rem',
                    color: 'var(--text-color)',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Departamento / Sucursal</label>
                <input 
                  type="text" 
                  value={receiptDepartment}
                  onChange={(e) => setReceiptDepartment(e.target.value)}
                  placeholder="ej. Contabilidad / Central"
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--bg-darker)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    fontSize: '0.85rem',
                    color: 'var(--text-color)',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => setSelectedReceiptDevice(null)}
                style={{
                  backgroundColor: 'transparent',
                  color: 'var(--text-color)',
                  border: '1px solid var(--border-color)',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
                className="hover-bright"
              >
                Cancelar
              </button>
              <button
                onClick={handlePrintReceipt}
                disabled={!receiptEmployee.trim()}
                style={{
                  backgroundColor: 'var(--accent)',
                  color: '#fff',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: !receiptEmployee.trim() ? 'not-allowed' : 'pointer',
                  opacity: !receiptEmployee.trim() ? 0.6 : 1
                }}
                className="hover-bright"
              >
                Generar Documento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Asset Modal */}
      {isEditModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div className="glass-panel" style={{
            width: '100%',
            maxWidth: '650px',
            borderRadius: '16px',
            padding: '24px',
            backgroundColor: 'var(--bg-dark)',
            border: '1px solid var(--border-color)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Database size={20} style={{ color: 'var(--accent)' }} />
              {editingDevice ? 'Editar Activo de Inventario' : 'Agregar Activo Manual'}
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
              
              {/* Basic Details */}
              <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Nombre del Activo / Equipo *</label>
                <input 
                  type="text" 
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="ej. Pantalla Dell 24 U2419H o Rosti-PC-12"
                  style={{ width: '100%', backgroundColor: 'var(--bg-darker)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 12px', fontSize: '0.85rem', color: 'var(--text-color)', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Placa de Activo</label>
                <input 
                  type="text" 
                  value={formPlaca}
                  onChange={(e) => setFormPlaca(e.target.value)}
                  placeholder="ej. ACT-2026-0045"
                  style={{ width: '100%', backgroundColor: 'var(--bg-darker)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 12px', fontSize: '0.85rem', color: 'var(--text-color)', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Grupo</label>
                <input 
                  type="text" 
                  value={formGroup}
                  onChange={(e) => setFormGroup(e.target.value)}
                  placeholder="ej. Contabilidad, Ventas"
                  list="modalGroupsList"
                  style={{ width: '100%', backgroundColor: 'var(--bg-darker)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 12px', fontSize: '0.85rem', color: 'var(--text-color)', outline: 'none' }}
                />
                <datalist id="modalGroupsList">
                  {groups.map(g => <option key={g} value={g} />)}
                </datalist>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Marca</label>
                <input 
                  type="text" 
                  value={formMarca}
                  onChange={(e) => setFormMarca(e.target.value)}
                  placeholder="ej. Dell, HP, Samsung"
                  style={{ width: '100%', backgroundColor: 'var(--bg-darker)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 12px', fontSize: '0.85rem', color: 'var(--text-color)', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Modelo</label>
                <input 
                  type="text" 
                  value={formModelo}
                  onChange={(e) => setFormModelo(e.target.value)}
                  placeholder="ej. UltraSharp U2419H"
                  style={{ width: '100%', backgroundColor: 'var(--bg-darker)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 12px', fontSize: '0.85rem', color: 'var(--text-color)', outline: 'none' }}
                />
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Número de Serie</label>
                <input 
                  type="text" 
                  value={formSerie}
                  onChange={(e) => setFormSerie(e.target.value)}
                  placeholder="ej. CN-0K2Y0W-72872-..."
                  style={{ width: '100%', backgroundColor: 'var(--bg-darker)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 12px', fontSize: '0.85rem', color: 'var(--text-color)', outline: 'none', fontFamily: 'monospace' }}
                />
              </div>

              {/* Specs fields (optional for monitors, but great to have) */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Procesador (CPU)</label>
                <input 
                  type="text" 
                  value={formProcesador}
                  onChange={(e) => setFormProcesador(e.target.value)}
                  placeholder="ej. N/A o Intel i5"
                  style={{ width: '100%', backgroundColor: 'var(--bg-darker)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 12px', fontSize: '0.85rem', color: 'var(--text-color)', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Memoria RAM</label>
                <input 
                  type="text" 
                  value={formRAM}
                  onChange={(e) => setFormRAM(e.target.value)}
                  placeholder="ej. N/A o 16 GB"
                  style={{ width: '100%', backgroundColor: 'var(--bg-darker)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 12px', fontSize: '0.85rem', color: 'var(--text-color)', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Disco Duro / Almacenamiento</label>
                <input 
                  type="text" 
                  value={formDisco}
                  onChange={(e) => setFormDisco(e.target.value)}
                  placeholder="ej. N/A o 512 GB SSD"
                  style={{ width: '100%', backgroundColor: 'var(--bg-darker)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 12px', fontSize: '0.85rem', color: 'var(--text-color)', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Sistema Operativo</label>
                <input 
                  type="text" 
                  value={formSO}
                  onChange={(e) => setFormSO(e.target.value)}
                  placeholder="ej. Windows 11 o N/A"
                  style={{ width: '100%', backgroundColor: 'var(--bg-darker)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 12px', fontSize: '0.85rem', color: 'var(--text-color)', outline: 'none' }}
                />
              </div>

              {/* Assignment details */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Usuario Responsable</label>
                <input 
                  type="text" 
                  value={formResponsable}
                  onChange={(e) => setFormResponsable(e.target.value)}
                  placeholder="ej. Juan Pérez"
                  style={{ width: '100%', backgroundColor: 'var(--bg-darker)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 12px', fontSize: '0.85rem', color: 'var(--text-color)', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Estado del Activo</label>
                <select
                  value={formEstado}
                  onChange={(e) => setFormEstado(e.target.value as any)}
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--bg-darker)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    fontSize: '0.85rem',
                    color: 'var(--text-color)',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="Activo">Activo</option>
                  <option value="En Bodega">En Bodega</option>
                  <option value="Mantenimiento">Mantenimiento</option>
                  <option value="Dado de Baja">Dado de Baja</option>
                </select>
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Notas y Ubicación Detallada</label>
                <textarea 
                  value={formNotas}
                  onChange={(e) => setFormNotas(e.target.value)}
                  placeholder="Detalles sobre accesorios, ubicación física en oficina, etc."
                  rows={3}
                  style={{ width: '100%', backgroundColor: 'var(--bg-darker)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 12px', fontSize: '0.85rem', color: 'var(--text-color)', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>

            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                {editingDevice && (
                  <button
                    onClick={() => handleDeleteDevice(editingDevice.id)}
                    style={{
                      backgroundColor: 'transparent',
                      color: '#ef4444',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                    className="hover-bright"
                  >
                    <Trash2 size={14} />
                    Eliminar Activo
                  </button>
                )}
              </div>
              
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  style={{
                    backgroundColor: 'transparent',
                    color: 'var(--text-color)',
                    border: '1px solid var(--border-color)',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                  className="hover-bright"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveDevice}
                  disabled={!formName.trim()}
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: '#fff',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: !formName.trim() ? 'not-allowed' : 'pointer',
                    opacity: !formName.trim() ? 0.6 : 1
                  }}
                  className="hover-bright"
                >
                  Guardar Cambios
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
