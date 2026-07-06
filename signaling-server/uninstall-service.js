const path = require('path');
const Service = require('node-windows').Service;

const svc = new Service({
  name: 'ControlRemotoServer',
  script: path.join(__dirname, 'server.js')
});

svc.on('uninstall', function() {
  console.log('El servicio ControlRemotoServer ha sido desinstalado correctamente.');
});

svc.uninstall();
