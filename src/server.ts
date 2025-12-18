
import express, { Request, Response } from 'express';
import { createServer } from 'http';
import dotenv from 'dotenv';
import session from 'express-session';
import passport from './config/passport.config';
import { configurePassport } from './config/passport.config';
import authRoutes from './routes/auth.routes';
import prisma from './utils/prisma.util';
import giftCardRoutes from './routes/giftCard.routes';
import purchaseRoutes from './routes/purchase.routes';
import cors from 'cors';
import merchantRoutes from './routes/merchant.routes';

import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './config/swagger.config';
import activityLogRoutes from './routes/activityLog.routes';

import { redisConnection } from './config/redis.config';
import { activityLogQueue, closeActivityLogQueue } from './queues/activityLog.queue';
import { emailQueue, closeEmailQueue } from './queues/email.queue';

import serverAdapter from './config/bullBoard.config';

import { initializeSocket } from './config/socket.config';
import path from "path";
import { errorHandler } from './middleware/errorHandler';
import userRoutes from "../src/routes/user.route"
import adminRoutes from "../src/routes/admin.routes"

dotenv.config();

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3000;

const io = initializeSocket(httpServer);

const allowedOrigins = [
  "http://localhost:8080",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:8080",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
  "http://thnxdigital.com",
  "https://thnxdigital.com",
  "http://www.thnxdigital.com",
  "https://www.thnxdigital.com",
  "https://rncks4z6-8081.inc1.devtunnels.ms",
  "https://rncks4z6-8080.inc1.devtunnels.ms",
  "http://localhost:8081",
  'http://localhost:8080',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:8080',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  'http://thnxdigital.com',
  'https://thnxdigital.com',
  'http://www.thnxdigital.com',
  'https://www.thnxdigital.com',
  process.env.FRONTEND_URL,
].filter(Boolean) as string[];

const corsOptions = {
  origin: (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void
  ) => {
    if (!origin) {
      return callback(null, true);
    }
    if (
      allowedOrigins.includes(origin) ||
      process.env.NODE_ENV === 'development'
    ) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};

app.use(cors(corsOptions));

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Session middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'hello123',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);


//
app.use(
  "/uploads",
  express.static(path.join(__dirname, "..", "uploads"))
);


// Initialize Passport
configurePassport();
app.use(passport.initialize());
app.use(passport.session());

if (process.env.NODE_ENV === 'production') {
  const basicAuth = (req: Request, res: Response, next: any) => {
    const auth = req.headers.authorization;

    if (!auth || !auth.startsWith('Basic ')) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Queue Dashboard"');
      return res.status(401).json({ error: 'Authentication required' });
    }

    const credentials = Buffer.from(auth.split(' ')[1], 'base64').toString();
    const [username, password] = credentials.split(':');

    const validUsername = process.env.BULL_BOARD_USERNAME;
    const validPassword = process.env.BULL_BOARD_PASSWORD;

    if (!validUsername || !validPassword) {
      console.error('BULL_BOARD_USERNAME and BULL_BOARD_PASSWORD must be set in production');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    if (username === validUsername && password === validPassword) {
      return next();
    }

    res.setHeader('WWW-Authenticate', 'Basic realm="Queue Dashboard"');
    return res.status(401).json({ error: 'Invalid credentials' });
  };

  app.use('/admin/queues', basicAuth, serverAdapter.getRouter());
} else {
  app.use('/admin/queues', serverAdapter.getRouter());
}

app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Thnx Digital API Documentation',
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
    },
  })
);


app.get('/api-docs.json', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Routes
app.get('/', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Thnx Digital API - Welcome!',
    version: '1.0.0',
    documentation: '/api-docs',
    queueDashboard: '/admin/queues',
    websocket: 'Socket.IO enabled',
    endpoints: {
      auth: '/api/auth',
      merchants: '/api/merchants',
      giftCards: '/api/gift-cards',
      purchases: '/api/purchases',
      activityLogs: '/api/activity-logs',
      health: '/health',
    },
  });
});

// Health check
app.get('/health', async (req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    const redisStatus = redisConnection.status === 'ready' ? 'connected' : 'disconnected';

    const [activityLogQueueHealth, emailQueueHealth] = await Promise.all([
      activityLogQueue.getJobCounts(),
      emailQueue.getJobCounts(),
    ]);

    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        redis: redisStatus,
        websocket: io ? 'running' : 'not initialized',
      },
      queues: {
        activityLogs: {
          waiting: activityLogQueueHealth.waiting,
          active: activityLogQueueHealth.active,
          completed: activityLogQueueHealth.completed,
          failed: activityLogQueueHealth.failed,
        },
        emails: {
          waiting: emailQueueHealth.waiting,
          active: emailQueueHealth.active,
          completed: emailQueueHealth.completed,
          failed: emailQueueHealth.failed,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/merchants", merchantRoutes);
app.use("/api/gift-cards", giftCardRoutes);
app.use("/api/purchases", purchaseRoutes);
app.use("/api/users", userRoutes)
app.use('/api/auth', authRoutes);
app.use('/api/merchants', merchantRoutes);
app.use('/api/gift-cards', giftCardRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/activity-logs', activityLogRoutes);
app.use('/api/admin', adminRoutes)

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});
app.use(errorHandler);



// Error handler
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  console.log(`\n${signal} received. Shutting down gracefully...`);

  const shutdownTimeout = setTimeout(() => {
    console.error('Graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, 30000);

  try {
    // Close Socket.IO
    if (io) {
      io.close();
      console.log('✅ Socket.IO closed');
    }

    // Close HTTP server
    httpServer.close();
    console.log('✅ HTTP server closed');

    await closeActivityLogQueue();
    console.log('✅ Activity log queue closed');

    await closeEmailQueue();
    console.log('✅ Email queue closed');

    await redisConnection.quit();
    console.log('✅ Redis connection closed');

    await prisma.$disconnect();
    console.log('✅ Database connection closed');

    clearTimeout(shutdownTimeout);
    console.log('✅ Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    clearTimeout(shutdownTimeout);
    process.exit(1);
  }
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Start server (use httpServer instead of app.listen)
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📚 API Docs: http://localhost:${PORT}/api-docs`);
  console.log(`📊 Queue Dashboard: http://localhost:${PORT}/admin/queues`);
  console.log(`🔌 WebSocket: Enabled`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔐 Google OAuth: ${process.env.GOOGLE_CLIENT_ID ? 'Enabled' : 'Disabled'}`);
  console.log(`📊 Activity Log Worker: Running`);
  console.log(`📧 Email Worker: Running`);
  console.log(`🔴 Redis: ${redisConnection.status}`);
});

export default app;