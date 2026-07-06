const http = require('http');
const WebSocket = require('ws');

// Read port from environment (cPanel sets process.env.PORT dynamically)
const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('¡El servidor de prueba WebSocket está corriendo exitosamente! Intenta conectar vía WebSocket en este mismo dominio/puerto.');
});

// Setup WebSocket server bound to the HTTP server
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress;
  console.log(`Nueva conexión WebSocket establecida desde: ${ip}`);
  
  ws.send(JSON.stringify({ type: 'welcome', message: '¡Conexión establecida con éxito en HostGator!' }));

  ws.on('message', (message) => {
    console.log(`Mensaje recibido: ${message}`);
    try {
      ws.send(JSON.stringify({ type: 'echo', data: message.toString() }));
    } catch (e) {
      ws.send(`echo: ${message}`);
    }
  });

  ws.on('close', () => {
    console.log('Conexión cerrada.');
  });
});

server.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto/socket: ${PORT}`);
});
