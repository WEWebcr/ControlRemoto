const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const dgram = require('dgram');
const fs = require('fs');
const multer = require('multer');
const nodemailer = require('nodemailer');

const app = express();
app.use(cors());
app.use(express.json());

// Sesiones en memoria para consola web y administradores
const activeSessions = new Map();

// Directorio de Persistencia (para evitar borrados al desplegar en contenedores efímeros como Render)
const PERSIST_DIR = fs.existsSync('/data') ? '/data' : __dirname;

const VERSIONS_DIR = fs.existsSync('/data') 
  ? path.join('/data', 'versions')
  : path.join(__dirname, 'public', 'versions');

if (!fs.existsSync(VERSIONS_DIR)) {
  fs.mkdirSync(VERSIONS_DIR, { recursive: true });
}

// Historial de APKs
const APK_HISTORY_FILE = path.join(PERSIST_DIR, 'apks_history.json');

function loadApkHistory() {
  if (!fs.existsSync(APK_HISTORY_FILE)) {
    fs.writeFileSync(APK_HISTORY_FILE, JSON.stringify([], null, 2));
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(APK_HISTORY_FILE, 'utf8'));
  } catch (e) {
    return [];
  }
}

function saveApkHistory(history) {
  fs.writeFileSync(APK_HISTORY_FILE, JSON.stringify(history, null, 2));
}

// Gestión de Grupos
const GROUPS_FILE = path.join(PERSIST_DIR, 'groups.json');

function loadGroups() {
  if (!fs.existsSync(GROUPS_FILE)) {
    // Por defecto, iniciamos con la lista precargada de grupos de la organización
    const defaultGroups = [
      "General"
    ];
    fs.writeFileSync(GROUPS_FILE, JSON.stringify(defaultGroups, null, 2));
    return defaultGroups;
  }
  try {
    return JSON.parse(fs.readFileSync(GROUPS_FILE, 'utf8'));
  } catch (e) {
    return ['Sin Grupo'];
  }
}

function saveGroups(groups) {
  fs.writeFileSync(GROUPS_FILE, JSON.stringify(groups, null, 2));
}

// Gestión de Inventario de Dispositivos y Grupos Fijados (Sincronización Multidispositivo)
const DEVICES_FILE = path.join(PERSIST_DIR, 'devices.json');
const PINNED_GROUPS_FILE = path.join(PERSIST_DIR, 'pinned_groups.json');

function loadDevices() {
  if (!fs.existsSync(DEVICES_FILE)) {
    fs.writeFileSync(DEVICES_FILE, JSON.stringify([], null, 2));
  }
  try {
    let devices = JSON.parse(fs.readFileSync(DEVICES_FILE, 'utf8'));
    if (!Array.isArray(devices)) {
      devices = [];
    }
    
    // Removed legacy alignment
    return devices;
  } catch (e) {
    return [];
  }
}

function saveDevices(devices) {
  fs.writeFileSync(DEVICES_FILE, JSON.stringify(devices, null, 2));
}

function loadPinnedGroups() {
  if (!fs.existsSync(PINNED_GROUPS_FILE)) {
    fs.writeFileSync(PINNED_GROUPS_FILE, JSON.stringify([], null, 2));
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(PINNED_GROUPS_FILE, 'utf8'));
  } catch (e) {
    return [];
  }
}

function savePinnedGroups(pinned) {
  fs.writeFileSync(PINNED_GROUPS_FILE, JSON.stringify(pinned, null, 2));
}

// Gestión de Usuarios
const USERS_FILE = path.join(PERSIST_DIR, 'users.json');

function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) {
    // Usuarios por defecto
    const defaultUsers = [
      { username: 'admin', password: 'adminpassword123', role: 'admin' }
    ];
    fs.writeFileSync(USERS_FILE, JSON.stringify(defaultUsers, null, 2));
    return defaultUsers;
  }
  return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function getAdminPassword() {
  const users = loadUsers();
  const admin = users.find(u => u.username === 'admin');
  return admin ? admin.password : 'adminpassword123';
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  const tokenVal = token || req.query.token;
  
  if (!tokenVal) {
    return res.status(401).json({ error: 'Acceso denegado. Token no proporcionado.' });
  }
  
  const session = activeSessions.get(tokenVal);
  if (!session) {
    return res.status(403).json({ error: 'Sesión inválida o expirada.' });
  }
  
  req.user = session;
  next();
}

// Descarga directa pública del último APK (para Downloader)
app.get('/app.apk', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private, max-age=0');
  const history = loadApkHistory();
  if (history.length === 0) {
    // Fallback por si hay un app.apk estático
    const fallbackPath = path.join(VERSIONS_DIR, '../app.apk');
    const oldFallbackPath = path.join(__dirname, 'public', 'app.apk');
    const finalFallback = fs.existsSync(fallbackPath) ? fallbackPath : oldFallbackPath;
    
    if (fs.existsSync(finalFallback)) {
      return res.download(finalFallback);
    }
    return res.status(404).send('No hay ninguna versión de APK subida todavía en la consola.');
  }

  // Ordenar por fecha de subida descendente (más nuevo primero)
  const sorted = [...history].sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  const latest = sorted[0];

  const filePath = path.join(VERSIONS_DIR, latest.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send(`El archivo de la versión v${latest.version} no existe físicamente en el servidor.`);
  }

  // Descargar el archivo con su nombre real de versión
  res.download(filePath, latest.filename);
});

// Redirección corta mediante número para Downloader (ej: acceso.rosti.cr/1)
app.get('/1', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private, max-age=0');
  res.redirect('/app.apk');
});

// Middleware para evitar que navegadores/WebView guarden caché del index de la consola
app.use((req, res, next) => {
  const url = req.path;
  if (url === '/admin' || url === '/admin/' || url.endsWith('/index.html')) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private, max-age=0');
  }
  next();
});

app.use(express.static(path.join(__dirname, 'public')));
if (fs.existsSync('/data')) {
  app.use('/versions', express.static(VERSIONS_DIR));
}

// REST API para Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const users = loadUsers();
  const user = users.find(u => u.username === username && u.password === password);
  
  if (user) {
    const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
    // Para el admin, tenant puede ser undefined. Para client o sub_user, es el dueño de los equipos
    const tenant = user.tenant || (user.role === 'client' ? user.username : undefined);
    activeSessions.set(token, { username: user.username, role: user.role, tenant });
    res.json({ success: true, token, username: user.username, role: user.role, tenant });
  } else {
    res.status(401).json({ success: false, error: 'Credenciales incorrectas' });
  }
});

// REST API para Logout
app.post('/api/logout', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  const tokenVal = token || req.query.token;
  if (tokenVal) {
    activeSessions.delete(tokenVal);
  }
  res.json({ success: true });
});

// REST API para CRUD de Usuarios
app.get('/api/users', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'client') {
    return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de administrador o cliente.' });
  }
  const users = loadUsers();
  const filteredUsers = req.user.role === 'admin' 
    ? users 
    : users.filter(u => u.tenant === req.user.username);
  const safeUsers = filteredUsers.map(u => ({ username: u.username, role: u.role, tenant: u.tenant, passwordLength: u.password.length }));
  res.json(safeUsers);
});

app.post('/api/users', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'client') {
    return res.status(403).json({ error: 'Acceso denegado.' });
  }
  const { username, password, role } = req.body;
  const users = loadUsers();
  
  if (users.find(u => u.username === username)) {
    return res.status(400).json({ error: 'El usuario ya existe' });
  }

  if (req.user.role === 'client' && role !== 'sub_user') {
    return res.status(403).json({ error: 'Un cliente solo puede crear sub-usuarios.' });
  }

  const tenant = req.user.role === 'client' ? req.user.username : undefined;
  users.push({ username, password, role: role || 'user', tenant });
  saveUsers(users);
  res.json({ success: true });
});

app.put('/api/users/:username', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'client') {
    return res.status(403).json({ error: 'Acceso denegado.' });
  }
  const { password, role } = req.body;
  const users = loadUsers();
  const index = users.findIndex(u => u.username === req.params.username);
  
  if (index === -1) return res.status(404).json({ error: 'Usuario no encontrado' });
  
  // Cliente solo puede editar sus propios sub-usuarios
  if (req.user.role === 'client' && users[index].tenant !== req.user.username) {
    return res.status(403).json({ error: 'No tienes permiso para editar este usuario.' });
  }
  
  if (password) users[index].password = password;
  if (role && req.params.username !== 'admin') {
    if (req.user.role === 'client' && role !== 'sub_user') {
      return res.status(403).json({ error: 'Solo puedes asignar rol de sub-usuario.' });
    }
    users[index].role = role;
  }
  
  saveUsers(users);
  res.json({ success: true });
});

app.delete('/api/users/:username', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'client') {
    return res.status(403).json({ error: 'Acceso denegado.' });
  }
  if (req.params.username === 'admin') {
    return res.status(400).json({ error: 'No se puede eliminar al administrador principal' });
  }
  
  const users = loadUsers();
  const userToDelete = users.find(u => u.username === req.params.username);
  
  if (!userToDelete) return res.status(404).json({ error: 'Usuario no encontrado' });
  
  if (req.user.role === 'client' && userToDelete.tenant !== req.user.username) {
    return res.status(403).json({ error: 'No tienes permiso para eliminar este usuario.' });
  }

  const filteredUsers = users.filter(u => u.username !== req.params.username);
  saveUsers(filteredUsers);
  res.json({ success: true });
});

// Configuración de Multer para Carga de APKs
const uploadDir = VERSIONS_DIR;
const upload = multer({ dest: uploadDir });

// Endpoint para subir APK (solo Administradores)
app.post('/api/upload-apk', authenticateToken, upload.single('apk'), (req, res) => {
  if (req.user.role !== 'admin') {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    return res.status(403).json({ error: 'Solo los administradores pueden subir APKs.' });
  }

  const { version, notes } = req.body;
  if (!version) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    return res.status(400).json({ error: 'La versión es requerida.' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'El archivo APK es requerido.' });
  }

  // Generar nombre de archivo final seguro
  const safeVersion = version.replace(/[^a-zA-Z0-9.-]/g, '_');
  const filename = `app-v${safeVersion}.apk`;
  const finalPath = path.join(VERSIONS_DIR, filename);

  try {
    // Mover y renombrar el archivo temporal al destino definitivo
    fs.renameSync(req.file.path, finalPath);
  } catch (err) {
    console.error("Error al guardar archivo APK definitivo:", err);
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    return res.status(500).json({ error: 'Error al procesar el archivo en el servidor.' });
  }

  const history = loadApkHistory();
  
  // Reemplazar si ya existe la misma versión
  const existingIndex = history.findIndex(h => h.version === version);
  
  const record = {
    version,
    filename,
    uploadedBy: req.user.username,
    uploadedAt: new Date().toISOString(),
    notes: notes || ''
  };

  if (existingIndex !== -1) {
    // Eliminar archivo anterior si cambió de nombre en la base de datos
    const oldRecord = history[existingIndex];
    if (oldRecord.filename !== filename) {
      const oldPath = path.join(VERSIONS_DIR, oldRecord.filename);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }
    history[existingIndex] = record;
  } else {
    history.push(record);
  }
  
  saveApkHistory(history);

  // Copiar a public/app.apk o VERSIONS_DIR parent para descarga directa principal
  const destPath = path.join(VERSIONS_DIR, '../app.apk');
  try {
    fs.copyFileSync(finalPath, destPath);
  } catch (e) {
    // Si falla (por ejemplo si está fuera del directorio público local), copiar también a local como fallback
    try {
      fs.copyFileSync(finalPath, path.join(__dirname, 'public', 'app.apk'));
    } catch (err) {}
  }

  res.json({ success: true, record });
});

// Endpoint para obtener historial de versiones (todos los usuarios logueados)
app.get('/api/apk-history', authenticateToken, (req, res) => {
  res.json(loadApkHistory());
});

// Endpoint para obtener la lista de grupos
app.get('/api/groups', authenticateToken, (req, res) => {
  const groups = loadGroups();
  if (req.user.role === 'admin') {
    res.json(groups);
  } else {
    // Cliente
    if (req.user.assignedGroup) {
      res.json([req.user.assignedGroup]);
    } else {
      res.json([]);
    }
  }
});

// Endpoint para guardar la lista de grupos (solo Administradores)
app.post('/api/groups', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Solo los administradores pueden gestionar grupos.' });
  }
  const { groups } = req.body;
  if (!Array.isArray(groups)) {
    return res.status(400).json({ error: 'La lista de grupos debe ser un arreglo de cadenas.' });
  }
  saveGroups(groups);
  res.json({ success: true, groups });
});

// Endpoint para obtener la lista de dispositivos guardados
app.get('/api/devices', authenticateToken, (req, res) => {
  const devices = loadDevices();
  if (req.user.role === 'admin') {
    res.json(devices);
  } else {
    // Cliente o Sub-usuario solo ven los de su tenant
    const clientDevices = devices.filter(d => d.group === req.user.tenant);
    res.json(clientDevices);
  }
});

// Endpoint para guardar la lista de dispositivos (solo Administradores)
app.post('/api/devices', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Solo los administradores pueden gestionar dispositivos.' });
  }
  const { devices } = req.body;
  if (!Array.isArray(devices)) {
    return res.status(400).json({ error: 'La lista de dispositivos debe ser un arreglo.' });
  }
  saveDevices(devices);
  res.json({ success: true, devices });
});

// Endpoint para obtener la lista de grupos fijados
app.get('/api/pinned-groups', authenticateToken, (req, res) => {
  res.json(loadPinnedGroups());
});

// Endpoint para guardar la lista de grupos fijados (solo Administradores)
app.post('/api/pinned-groups', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Solo los administradores pueden gestionar grupos fijados.' });
  }
  const { pinned } = req.body;
  if (!Array.isArray(pinned)) {
    return res.status(400).json({ error: 'La lista de grupos fijados debe ser un arreglo.' });
  }
});

const PROCESO_DB_FILE = path.join(PERSIST_DIR, 'proceso_database.json');

// Endpoint para obtener el estado de Procesos Rapidos
app.get('/api/proceso-state', authenticateToken, (req, res) => {
  try {
    if (fs.existsSync(PROCESO_DB_FILE)) {
      const data = JSON.parse(fs.readFileSync(PROCESO_DB_FILE, 'utf8'));
      
      // Auto-match removed
      res.json({ success: true, data });
    } else {
      res.json({ success: true, data: {} });
    }
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Endpoint para guardar el estado de Procesos Rapidos
app.post('/api/proceso-state', authenticateToken, (req, res) => {
  try {
    const data = req.body;
    fs.writeFileSync(PROCESO_DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    res.json({ success: true, message: 'Estado guardado correctamente' });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});


// ==========================================
// CONFIGURACIÓN Y MONITOREO POR CORREO (SMTP)
// ==========================================
const EMAIL_CONFIG_FILE = path.join(PERSIST_DIR, 'email_config.json');

function loadEmailConfig() {
  const defaultConfig = {
    enabled: true,
    host: 'smtp.office365.com',
    port: 587,
    secure: false,
    user: 'admin@remotocontroljm.com',
    pass: 'password',
    from: 'admin@remotocontroljm.com',
    to: 'soporte@remotocontroljm.com',
    frequencyHours: 4
  };

  if (!fs.existsSync(EMAIL_CONFIG_FILE)) {
    fs.writeFileSync(EMAIL_CONFIG_FILE, JSON.stringify(defaultConfig, null, 2));
    return defaultConfig;
  }
  try {
    const loaded = JSON.parse(fs.readFileSync(EMAIL_CONFIG_FILE, 'utf8'));
    // Si faltan campos clave en el archivo cargado, fusionar con el default
    return {
      enabled: loaded.enabled !== undefined ? loaded.enabled : defaultConfig.enabled,
      host: loaded.host || defaultConfig.host,
      port: loaded.port || defaultConfig.port,
      secure: loaded.secure !== undefined ? loaded.secure : defaultConfig.secure,
      user: loaded.user || defaultConfig.user,
      pass: loaded.pass || defaultConfig.pass,
      from: loaded.from || defaultConfig.from,
      to: loaded.to || defaultConfig.to,
      frequencyHours: loaded.frequencyHours || defaultConfig.frequencyHours
    };
  } catch (e) {
    return defaultConfig;
  }
}

function saveEmailConfig(config) {
  fs.writeFileSync(EMAIL_CONFIG_FILE, JSON.stringify(config, null, 2));
}

function getOfflineDevices() {
  const allDevices = loadDevices();
  const connectedRoomIds = new Set(
    Array.from(connectedDevices.values())
      .filter(d => d.isAndroid || d.isWindows)
      .map(d => d.roomId)
  );

  return allDevices.filter(d => {
    if (d.platform === 'manual') return false;
    return !connectedRoomIds.has(d.id);
  });
}

async function sendEmail(config, subject, text, html) {
  let hostIp = config.host;
  if (config.host && !/^[0-9.]+$/.test(config.host) && !config.host.includes(':')) {
    try {
      const dns = require('dns').promises;
      const addresses = await dns.resolve4(config.host);
      if (addresses && addresses.length > 0) {
        hostIp = addresses[0];
        console.log(`[SMTP] DNS resuelto para ${config.host}: ${hostIp}`);
      }
    } catch (err) {
      console.error(`[SMTP] Error resolviendo host ${config.host} a IPv4:`, err);
    }
  }

  const transporter = nodemailer.createTransport({
    host: hostIp,
    port: parseInt(config.port, 10) || 587,
    secure: config.secure, // true para puerto 465, false para otros
    auth: {
      user: config.user,
      pass: config.pass
    },
    tls: {
      rejectUnauthorized: false,
      servername: config.host // Requerido para verificar el certificado SSL/TLS con el dominio original al usar IP
    },
    connectionTimeout: 10000, // 10 segundos
    greetingTimeout: 10000,   // 10 segundos
    socketTimeout: 15000      // 15 segundos
  });

  const mailOptions = {
    from: config.from || `"RostiControl" <${config.user}>`,
    to: config.to,
    subject: subject,
    text: text,
    html: html
  };

  return await transporter.sendMail(mailOptions);
}

async function sendOfflineReportEmail(isManual = false) {
  const config = loadEmailConfig();
  if (!config.enabled || !config.host || !config.to) {
    if (isManual) {
      throw new Error("El monitoreo por correo no está completamente configurado u habilitado.");
    }
    console.log("Envío de reporte automático de correo omitido (desactivado o no configurado).");
    return;
  }

  const offlineDevices = getOfflineDevices();
  if (offlineDevices.length === 0 && !isManual) {
    console.log("No hay equipos fuera de línea. Reporte de correo automático omitido.");
    return;
  }

  const subject = offlineDevices.length === 0 
    ? `✅ Reporte de Monitoreo: Todos los equipos en línea`
    : `⚠️ Reporte de Monitoreo: ${offlineDevices.length} equipos fuera de línea`;

  let html = '';
  let text = '';

  if (offlineDevices.length === 0) {
    html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
        <h2 style="color: #16a34a; margin-top: 0;">✅ Monitoreo RostiControl: Todo Excelente</h2>
        <p>Todos los equipos registrados se encuentran actualmente <b>en línea</b> y operando correctamente.</p>
        <p style="margin-top: 24px; font-size: 0.85em; color: #888;">
          Generado el: ${new Date().toLocaleString('es-CR')}
        </p>
      </div>
    `;
    text = `Monitoreo RostiControl: Todos los equipos se encuentran en línea.`;
  } else {
    let rowsHtml = '';
    offlineDevices.forEach(d => {
      const lastUpdate = d.updatedAt ? new Date(d.updatedAt).toLocaleString('es-CR') : 'N/D';
      rowsHtml += `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;"><b>${escapeHtml(d.name)}</b></td>
          <td style="padding: 8px; border: 1px solid #ddd; font-family: monospace;">${escapeHtml(d.id)}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(d.group || 'Sin Grupo')}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(d.platform || 'android')}</td>
          <td style="padding: 8px; border: 1px solid #ddd; font-size: 0.85em; color: #666;">${lastUpdate}</td>
        </tr>
      `;
    });

    html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
        <h2 style="color: #ef4444; margin-top: 0;">⚠️ Alerta de Monitoreo RostiControl</h2>
        <p>Se han detectado los siguientes equipos <b>fuera de línea</b> en la consola:</p>
        
        <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
          <thead>
            <tr style="background-color: #f8fafc; text-align: left;">
              <th style="padding: 8px; border: 1px solid #ddd;">Nombre</th>
              <th style="padding: 8px; border: 1px solid #ddd;">ID de Sala</th>
              <th style="padding: 8px; border: 1px solid #ddd;">Grupo</th>
              <th style="padding: 8px; border: 1px solid #ddd;">Plataforma</th>
              <th style="padding: 8px; border: 1px solid #ddd;">Último Registro</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
        
        <p style="margin-top: 24px; font-size: 0.85em; color: #888;">
          Este reporte fue generado de forma ${isManual ? 'manual' : 'automática'}. Frecuencia programada: cada ${config.frequencyHours} horas.
        </p>
      </div>
    `;

    text = `Reporte de Monitoreo RostiControl: ${offlineDevices.length} equipos fuera de línea.\n\n` + 
      offlineDevices.map(d => `- ${d.name} (${d.id}) - Grupo: ${d.group || 'Sin Grupo'}`).join('\n');
  }

  await sendEmail(config, subject, text, html);
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

let emailIntervalId = null;

function setupEmailScheduler() {
  if (emailIntervalId) {
    clearInterval(emailIntervalId);
    emailIntervalId = null;
  }

  const config = loadEmailConfig();
  if (!config.enabled || !config.frequencyHours || !config.host || !config.to) {
    console.log("Monitoreo por correo desactivado o incompleto.");
    return;
  }

  const hours = parseFloat(config.frequencyHours) || 4;
  const intervalMs = hours * 60 * 60 * 1000;
  console.log(`Programando reporte de correo cada ${hours} horas (${intervalMs} ms)`);
  
  emailIntervalId = setInterval(async () => {
    try {
      console.log("Ejecutando envío automático de reporte de monitoreo por correo...");
      await sendOfflineReportEmail();
    } catch (e) {
      console.error("Error al enviar reporte de correo automático:", e);
    }
  }, intervalMs);
}

// Endpoints REST para Monitoreo por Correo (solo Administradores)
app.get('/api/email-config', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado.' });
  }
  const config = loadEmailConfig();
  const responseConfig = { ...config };
  if (config.pass) {
    responseConfig.pass = '********';
  }
  res.json(responseConfig);
});

app.post('/api/email-config', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado.' });
  }
  try {
    const newConfig = req.body;
    const oldConfig = loadEmailConfig();
    if (newConfig.pass === '********') {
      newConfig.pass = oldConfig.pass;
    }
    
    saveEmailConfig(newConfig);
    setupEmailScheduler();
    res.json({ success: true });
  } catch (err) {
    console.error("Error al guardar configuración de correo:", err);
    res.status(500).json({ error: err.message || 'Error al guardar la configuración de correo' });
  }
});

app.post('/api/email-config/test', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado.' });
  }
  
  const testConfig = req.body;
  const oldConfig = loadEmailConfig();
  if (testConfig.pass === '********') {
    testConfig.pass = oldConfig.pass;
  }

  try {
    const subject = "🧪 RostiControl: Correo de prueba de monitoreo";
    const text = "Este es un correo de prueba para validar tu configuración SMTP en RostiControl.";
    const html = `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
        <h3 style="color: #2563eb; margin-top: 0;">🧪 Prueba de Conexión Exitosa</h3>
        <p>¡Hola! Este correo confirma que tu configuración SMTP en RostiControl funciona correctamente.</p>
        <p style="font-size: 0.85em; color: #666; margin-top: 20px;">Generado el: ${new Date().toLocaleString('es-CR')}</p>
      </div>
    `;
    await sendEmail(testConfig, subject, text, html);
    res.json({ success: true, message: 'Correo de prueba enviado correctamente' });
  } catch (err) {
    console.error("Error al enviar correo de prueba:", err);
    res.status(500).json({ error: err.message || 'Error al enviar correo de prueba' });
  }
});

app.post('/api/email-config/send-report', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado.' });
  }
  
  try {
    await sendOfflineReportEmail(true);
    res.json({ success: true, message: 'Reporte de equipos fuera de línea enviado con éxito' });
  } catch (err) {
    console.error("Error al enviar reporte manual:", err);
    res.status(500).json({ error: err.message || 'Error al enviar reporte por correo' });
  }
});

// Endpoint para eliminar versión (solo Administradores)
app.delete('/api/delete-apk/:version', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Solo los administradores pueden eliminar versiones.' });
  }

  const version = req.params.version;
  const history = loadApkHistory();
  const index = history.findIndex(h => h.version === version);

  if (index === -1) {
    return res.status(404).json({ error: 'Versión no encontrada.' });
  }

  const record = history[index];
  const filePath = path.join(__dirname, 'public', 'versions', record.filename);
  
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  history.splice(index, 1);
  saveApkHistory(history);

  res.json({ success: true });
});

// Endpoint protegido de descarga de versiones de APK
app.get('/download/:filename', (req, res) => {
  const filename = req.params.filename;
  const key = req.query.key;
  const token = req.query.token;

  let authorized = false;

  if (key && key === getAdminPassword()) {
    authorized = true;
  }

  if (!authorized && token && activeSessions.has(token)) {
    authorized = true;
  }

  if (!authorized) {
    return res.status(403).send('Acceso denegado. Se requiere autenticación para descargar.');
  }

  const filePath = filename === 'app.apk' 
    ? path.join(VERSIONS_DIR, '../app.apk') 
    : path.join(VERSIONS_DIR, filename);

  if (!fs.existsSync(filePath)) {
    // Si no se encuentra en el directorio persistente, buscar en el fallback local
    const fallbackPath = filename === 'app.apk'
      ? path.join(__dirname, 'public', 'app.apk')
      : path.join(__dirname, 'public', 'versions', filename);
      
    if (fs.existsSync(fallbackPath)) {
      return res.download(fallbackPath);
    }
    return res.status(404).send('Archivo no encontrado.');
  }

  res.download(filePath);
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// Middleware para autenticar conexiones de Socket.io
io.use((socket, next) => {
  const token = socket.handshake.auth && socket.handshake.auth.token;
  if (token) {
    const session = activeSessions.get(token);
    if (session) {
      socket.user = session;
    }
  }
  next();
});

const connectedDevices = new Map();

// Endpoint de diagnóstico HTTP
app.get('/status', (req, res) => {
  const devices = Array.from(connectedDevices.values());
  res.json({
    totalConectados: devices.length,
    androidOnline: devices.filter(d => d.isAndroid).map(d => d.roomId),
    windowsOnline: devices.filter(d => d.isWindows).map(d => d.roomId),
    todos: devices
  });
});

// Función helper para emitir lista de dispositivos filtrada por cliente (Multi-Tenancy)
function broadcastDevicesUpdate() {
  const allConnected = Array.from(connectedDevices.values());
  const allOnlineIds = allConnected.filter(d => d.isAndroid || d.isWindows).map(d => d.roomId);
  const savedDevices = loadDevices();

  const room = io.sockets.adapter.rooms.get('dashboard-room');
  if (!room) return;

  for (const socketId of room) {
    const socket = io.sockets.sockets.get(socketId);
    if (!socket || !socket.user) continue;

    if (socket.user.role === 'admin') {
      socket.emit('devices-update', allConnected);
      socket.emit('online-devices', allOnlineIds);
    } else {
      const allowedGroup = socket.user.tenant;
      const clientDevicesIds = savedDevices.filter(d => d.group === allowedGroup).map(d => d.id);
      
      const clientConnected = allConnected.filter(d => {
        if (!d.isAndroid && !d.isWindows) return false;
        if (clientDevicesIds.includes(d.roomId)) return true;
        if (d.specs && d.specs.group === allowedGroup) return true;
        return false;
      });
      
      const clientOnlineIds = clientConnected.map(d => d.roomId);
      socket.emit('devices-update', clientConnected);
      socket.emit('online-devices', clientOnlineIds);
    }
  }
}

io.on('connection', (socket) => {
  const ts = () => new Date().toTimeString().split(' ')[0];
  console.log(`[${ts()}] NUEVA CONEXIÓN: ${socket.id} desde ${socket.handshake.address}`);

  // Si el socket se autenticó durante el handshake (ej: app Windows Admin)
  if (socket.user) {
    socket.join('dashboard-room');
    connectedDevices.set(socket.id, {
      id: socket.id,
      status: `Admin Windows (${socket.user.username})`,
      connectedAt: new Date().toISOString()
    });
    broadcastDevicesUpdate();
  }

  // Permitir autenticación después de conectar (para la consola web después de iniciar sesión)
  socket.on('authenticate', (token) => {
    const session = activeSessions.get(token);
    if (session) {
      socket.user = session;
      socket.join('dashboard-room');
      connectedDevices.set(socket.id, {
        id: socket.id,
        status: `Admin Web (${session.username})`,
        connectedAt: new Date().toISOString()
      });
      broadcastDevicesUpdate();
      
      // Las actualizaciones de online-devices ya se manejan dentro de broadcastDevicesUpdate
      console.log(`[${ts()}] Socket ${socket.id} autenticado como ${session.username}`);
    } else {
      socket.emit('auth-error', 'Token inválido');
    }
  });

  // Registro de dispositivo (Android o Windows)
  socket.on('register-device', (deviceId, specs) => {
    console.log(`[${ts()}] REGISTER-DEVICE: socket=${socket.id} deviceId=${deviceId} specs=${JSON.stringify(specs)}`);
    const isWin = deviceId.startsWith('win-');
    const isAndroid = !isWin;
    
    // Limpiar conexiones fantasma del mismo equipo
    for (const [existingSocketId, device] of connectedDevices.entries()) {
      if ((device.isAndroid || device.isWindows) && device.roomId === deviceId && existingSocketId !== socket.id) {
        console.log(`[${ts()}] Eliminando conexión fantasma de ${device.isAndroid ? 'Android' : 'Windows'}: ${existingSocketId}`);
        const oldSocket = io.sockets.sockets.get(existingSocketId);
        if (oldSocket) oldSocket.disconnect(true);
        connectedDevices.delete(existingSocketId);
      }
    }
    
    socket.join(deviceId);
    connectedDevices.set(socket.id, {
      id: socket.id,
      roomId: deviceId,
      status: isWin ? 'windows-online' : 'android-online',
      connectedAt: new Date().toISOString(),
      isAndroid: isAndroid,
      isWindows: isWin,
      specs: specs || null
    });
    broadcastDevicesUpdate();
  });

  // Admin uniéndose a sala
  socket.on('join-room', (roomId) => {
    console.log(`[${ts()}] JOIN-ROOM: socket=${socket.id} sala=${roomId}`);
    socket.join(roomId);
    connectedDevices.set(socket.id, {
      id: socket.id,
      roomId: roomId,
      status: `Admin Windows (Viendo Pantalla - ${socket.user ? socket.user.username : 'legacy'})`,
      connectedAt: new Date().toISOString(),
      isAndroid: false
    });
    broadcastDevicesUpdate();
    socket.to(roomId).emit('user-connected', socket.id);
    console.log(`[${ts()}] user-connected emitido a sala ${roomId}`);
  });

  // Admin saliendo de sala
  socket.on('leave-room', (roomId) => {
    console.log(`[${ts()}] LEAVE-ROOM: socket=${socket.id} sala=${roomId}`);
    socket.leave(roomId);
    
    // Restaurar estado del socket en connectedDevices si estaba logueado
    if (socket.user) {
      connectedDevices.set(socket.id, {
        id: socket.id,
        status: `Admin ${socket.user.role === 'admin' ? 'Windows' : 'Web'} (${socket.user.username})`,
        connectedAt: new Date().toISOString()
      });
    } else {
      connectedDevices.delete(socket.id);
    }
    broadcastDevicesUpdate();
    socket.to(roomId).emit('user-disconnected', socket.id);
  });

  // WebRTC Signaling
  socket.on('offer', (data) => {
    console.log(`[${ts()}] OFFER recibido: roomId=${data.roomId} desde=${socket.id}`);
    const targets = Array.from(connectedDevices.values())
      .filter(d => d.roomId === data.roomId && d.id !== socket.id);
    console.log(`[${ts()}] Targets para offer: ${targets.map(t => t.id)}`);
    socket.to(data.roomId).emit('offer', data.offer);
  });

  socket.on('answer', (data) => {
    console.log(`[${ts()}] ANSWER recibido: roomId=${data.roomId} desde=${socket.id}`);
    socket.to(data.roomId).emit('answer', data.answer);
  });

  socket.on('ice-candidate', (data) => {
    console.log(`[${ts()}] ICE-CANDIDATE: roomId=${data.roomId} desde=${socket.id}`);
    socket.to(data.roomId).emit('ice-candidate', data.candidate);
  });

  socket.on('disconnect', (reason) => {
    const device = connectedDevices.get(socket.id);
    console.log(`[${ts()}] DESCONEXIÓN: ${socket.id} roomId=${device?.roomId} razón=${reason}`);
    if (device && device.roomId) {
      socket.to(device.roomId).emit('user-disconnected', socket.id);
    }
    connectedDevices.delete(socket.id);
    broadcastDevicesUpdate();
  });

  // Relés para Automatización de VPN SSL y Queries
  socket.on('vpn-connect', (data) => {
    console.log(`[${ts()}] RELAY vpn-connect a sala=${data.roomId} desde=${socket.id}`);
    socket.to(data.roomId).emit('vpn-connect', {
      adminSocketId: socket.id,
      gateway: data.gateway,
      user: data.user,
      pass: data.pass
    });
  });

  socket.on('vpn-connect-response', (data) => {
    console.log(`[${ts()}] RELAY vpn-connect-response a adminSocketId=${data.adminSocketId}`);
    io.to(data.adminSocketId).emit('vpn-connect-response', {
      success: data.success,
      message: data.message
    });
  });

  socket.on('vpn-disconnect', (data) => {
    console.log(`[${ts()}] RELAY vpn-disconnect a sala=${data.roomId} desde=${socket.id}`);
    socket.to(data.roomId).emit('vpn-disconnect', {
      adminSocketId: socket.id
    });
  });

  socket.on('vpn-disconnect-response', (data) => {
    console.log(`[${ts()}] RELAY vpn-disconnect-response a adminSocketId=${data.adminSocketId}`);
    io.to(data.adminSocketId).emit('vpn-disconnect-response', {
      success: data.success,
      message: data.message
    });
  });

  socket.on('vpn-status-request', (data) => {
    console.log(`[${ts()}] RELAY vpn-status-request a sala=${data.roomId} desde=${socket.id}`);
    socket.to(data.roomId).emit('vpn-status-request', {
      adminSocketId: socket.id
    });
  });

  socket.on('vpn-status-response', (data) => {
    io.to(data.adminSocketId).emit('vpn-status-response', {
      status: data.status
    });
  });

  socket.on('execute-query', (data) => {
    console.log(`[${ts()}] RELAY execute-query a sala=${data.roomId} desde=${socket.id}`);
    socket.to(data.roomId).emit('execute-query', {
      adminSocketId: socket.id,
      ip: data.ip,
      db: data.db,
      query: data.query
    });
  });

  socket.on('execute-query-response', (data) => {
    console.log(`[${ts()}] RELAY execute-query-response a adminSocketId=${data.adminSocketId} success=${data.success}`);
    io.to(data.adminSocketId).emit('execute-query-response', data);
  });

  socket.on('execute-script', (data) => {
    console.log(`[${ts()}] RELAY execute-script a sala=${data.roomId} desde=${socket.id}`);
    socket.to(data.roomId).emit('execute-script', {
      adminSocketId: socket.id,
      ip: data.ip,
      command: data.command
    });
  });

  socket.on('execute-script-response', (data) => {
    console.log(`[${ts()}] RELAY execute-script-response a adminSocketId=${data.adminSocketId} success=${data.success}`);
    io.to(data.adminSocketId).emit('execute-script-response', data);
  });

  socket.on('error', (err) => {
    console.error(`[${ts()}] ERROR socket ${socket.id}:`, err);
  });
});

// Broadcast por UDP para que Android encuentre el servidor automáticamente
const udpServer = dgram.createSocket('udp4');
udpServer.on('listening', () => {
  udpServer.setBroadcast(true);
  console.log('UDP Broadcaster activo en puerto 44444');
  setInterval(() => {
    const message = Buffer.from('ROSTI_SERVER:3000');
    udpServer.send(message, 0, message.length, 44444, '255.255.255.255');
  }, 2000);
});
udpServer.bind(() => {
  udpServer.setBroadcast(true);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`========================================`);
  console.log(`Servidor de señalización escuchando en puerto ${PORT}`);
  console.log(`Diagnóstico: http://localhost:${PORT}/status`);
  console.log(`========================================`);
  
  // Inicializar programador de correo de monitoreo
  setupEmailScheduler();
});
