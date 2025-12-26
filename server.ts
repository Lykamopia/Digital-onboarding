
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';

// In a real production app, you'd want to compile this to JS and run with node.
// For simplicity in this dev environment, we'll use ts-node.

console.log('Starting WebSocket and HTTP server...');

const server = createServer((req, res) => {
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
    
    // This server now primarily broadcasts data received via HTTP POST
    // You could add more complex logic here if needed, but for now we just echo
    ws.send(`You sent: ${data}`);
  });
  
  ws.on('close', () => {
    console.log('Client disconnected.');
  });
});

server.listen(8080, () => {
    console.log('HTTP and WebSocket server is listening on http/ws://localhost:8080');
});
