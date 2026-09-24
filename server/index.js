import http from 'http';
import app from './app.js';
import { setupSocketServer } from './socketServer.js';

const PORT = process.env.PORT || 5000;

const httpServer = http.createServer(app);
setupSocketServer(httpServer);

httpServer.listen(PORT, () => {
  console.log(`🚀 AeroDrop server running on http://localhost:${PORT}`);
});

export { app, httpServer };
