const { WebSocketServer } = require('ws');
const server = new WebSocketServer({ port: 8080 });

server.on('connection', (ws) => {
  console.log('Cliente conectado');
  
  ws.on('message', (data) => {
    console.log('Recibido: %s', data);
    ws.send(`Servidor recibió: ${data}`);
  });

  ws.on('close', () => {
    console.log('Cliente desconectado');
  });
});

console.log('Servidor WebSocket escuchando en el puerto ws://localhost:8080');
