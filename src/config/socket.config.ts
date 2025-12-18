
import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { verifyAccessToken } from '../utils/jwt.util';

let io: Server | null = null;

export const initializeSocket = (httpServer: HttpServer): Server => {
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:8080',
    'https://thnxdigital.com',
    'https://www.thnxdigital.com',
    process.env.FRONTEND_URL,
  ].filter(Boolean) as string[];

  io = new Server(httpServer, {
    cors: {
      origin: process.env.NODE_ENV === 'production' 
        ? allowedOrigins.filter(url => url.startsWith('https'))
        : allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling'], // WebSocket first, fallback to polling
  });

  // Authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = verifyAccessToken(token);
      socket.data.user = decoded;

      if (decoded.role !== 'ADMIN') {
        return next(new Error('Admin access required'));
      }

      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`🔌 Admin connected: ${socket.id}`);
    }

    socket.join('admin:activity-logs');

    socket.on('disconnect', (reason) => {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`🔌 Admin disconnected: ${socket.id} - ${reason}`);
      }
    });

    socket.on('error', (error) => {
      console.error(`Socket error for ${socket.id}:`, error);
    });
  });

  console.log('🔌 Socket.IO initialized');

  return io;
};

export const getIO = (): Server | null => io;

export const emitActivityLog = (log: any): void => {
  if (io) {
    io.to('admin:activity-logs').emit('activity:new', log);
  }
};

export const emitActivityStats = (stats: any): void => {
  if (io) {
    io.to('admin:activity-logs').emit('activity:stats', stats);
  }
};

export default { initializeSocket, getIO, emitActivityLog, emitActivityStats };