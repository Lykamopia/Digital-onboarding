
import { WebSocketServer, WebSocket } from 'ws';

console.log('Starting WebSocket server...');

const wss = new WebSocketServer({ port: 8080 });

wss.on('connection', function connection(ws) {
  console.log('A new client connected.');
  
  ws.on('error', console.error);

  ws.on('message', function message(data) {
    console.log('received: %s', data);
    
    // Broadcast the message to all connected clients
    wss.clients.forEach(function each(client) {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(data.toString());
      }
    });
  });
  
  ws.on('close', () => {
    console.log('Client disconnected.');
  });
});

console.log('WebSocket server is listening on ws://localhost:8080');
