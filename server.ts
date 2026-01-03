import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import dotenv from 'dotenv';

dotenv.config(); // Load .env file

const PORT = parseInt(process.env.WEBSOCKET_PORT || '3011', 10);

console.log('Starting WebSocket and HTTP server...');

const server = createServer((req, res) => {
    // Set CORS headers for all responses
    res.setHeader('Access-Control-Allow-Origin', '*'); // Adjust this in a real production environment
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.method === 'POST' && req.url === '/broadcast') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                // Broadcast the received data to all connected WebSocket clients
                wss.clients.forEach(function each(client) {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify(data));
                    }
                });
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Broadcast successful' }));
            } catch (error) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });
    } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not Found' }));
    }
});

const wss = new WebSocketServer({ server });

wss.on('connection', function connection(ws) {
  console.log('A new client connected.');
  
  ws.on('error', console.error);

  ws.on('message', function message(data) {
    console.log('received: %s', data);
    
    ws.send(`You sent: ${data}`);
  });
  
  ws.on('close', () => {
    console.log('Client disconnected.');
  });
});

server.listen(PORT, () => {
    console.log(`HTTP and WebSocket server is listening on http/ws://localhost:${PORT}`);
});
