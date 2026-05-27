import http from 'http';
import { Server } from 'socket.io';
import { createApp } from './app';
import { env } from './config/env';
import { logger } from './utils/logger';
import { registerSocketHandlers } from './realtime/socket';

const app = createApp();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: env.corsOrigins,
    credentials: true,
  },
});

registerSocketHandlers(io);

server.listen(env.API_PORT, () => {
  logger.info(`KrazyVerse API listening on http://localhost:${env.API_PORT}`);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down');
  server.close(() => process.exit(0));
});
