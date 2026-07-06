// PM2 config para el servidor de signaling (WebRTC) del Control Remoto.
// Deploy local en este servidor; nginx proxea kpisrosti.com:86 -> 127.0.0.1:5086.
// Artefacto de despliegue: NO forma parte del repo original (excluido en .git/info/exclude).
module.exports = {
  apps: [
    {
      name: 'controlremoto-signaling',
      script: 'server.js',
      cwd: 'C:/Deploy/ControlRemoto/signaling-server',
      env: {
        PORT: '5086',
        NODE_ENV: 'production'
      },
      autorestart: true,
      max_restarts: 10,
      watch: false
    }
  ]
};
