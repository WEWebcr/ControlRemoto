const path = require('path');
const Service = require('node-windows').Service;
const svc = new Service({
  name: 'ControlRemotoServer',
  description: 'Servidor de Señalización WebRTC',
  script: path.join(__dirname, 'server.js')
});
svc.on('install', function(){
  svc.start();
});
svc.install();
