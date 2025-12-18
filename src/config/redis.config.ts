
import { Redis } from 'ioredis';

const isProduction = process.env.NODE_ENV === 'production';

const redisConfig: any = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null, 
};

if (process.env.REDIS_PASSWORD) {
  redisConfig.password = process.env.REDIS_PASSWORD;
}

if (process.env.REDIS_TLS === 'true') {
  redisConfig.tls = {
    rejectUnauthorized: false,
  };
}

if (isProduction) {
  redisConfig.retryDelayOnFailover = 100;
  redisConfig.enableReadyCheck = true;
  redisConfig.connectTimeout = 10000;
  redisConfig.lazyConnect = true;
}

export const redisConnection = new Redis(redisConfig);

redisConnection.on('connect', () => {
  console.log('✅ Redis connected');
});

redisConnection.on('error', (error) => {
  console.error('❌ Redis error:', error.message);
});

redisConnection.on('close', () => {
  if (isProduction) {
    console.log('⚠️ Redis connection closed');
  }
});

export default redisConfig;