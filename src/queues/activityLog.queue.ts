
import { Queue, Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import redisConfig from '../config/redis.config';
import { emitActivityLog } from '../config/socket.config';

const prisma = new PrismaClient();

export interface ActivityLogJobData {
  actorId?: string;
  actorType: string;
  action: string;
  category: 'AUTH' | 'USER' | 'MERCHANT' | 'GIFT_CARD' | 'PURCHASE' | 'REDEMPTION' | 'SYSTEM';
  description: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, any>;
  severity?: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  merchantId?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

const isProduction = process.env.NODE_ENV === 'production';

export const activityLogQueue = new Queue<ActivityLogJobData>('activity-logs', {
  connection: redisConfig,
  defaultJobOptions: {
    removeOnComplete: isProduction ? 500 : 100,
    removeOnFail: isProduction ? 1000 : 500,
    attempts: isProduction ? 5 : 3,
    backoff: {
      type: 'exponential',
      delay: isProduction ? 2000 : 1000,
    },
  },
});

export const activityLogWorker = new Worker<ActivityLogJobData>(
  'activity-logs',
  async (job: Job<ActivityLogJobData>) => {
    const {
      actorId,
      actorType,
      action,
      category,
      description,
      resourceType,
      resourceId,
      metadata,
      severity = 'INFO',
      merchantId,
      ipAddress,
      userAgent,
      createdAt,
    } = job.data;

    // Save to database
    const log = await prisma.activityLog.create({
      data: {
        actorId,
        actorType,
        action,
        category,
        description,
        resourceType,
        resourceId,
        metadata: metadata ?? undefined,
        severity,
        merchantId,
        ipAddress,
        userAgent,
        createdAt,
      },
    });

    // 🔥 Emit to connected admins via WebSocket
    emitActivityLog(log);

    return { success: true, logId: log.id };
  },
  {
    connection: redisConfig,
    concurrency: isProduction ? 20 : 10,
  }
);

activityLogWorker.on('completed', (job: any) => {
  if (!isProduction) {
    console.log(`📝 Activity log job ${job.id} completed`);
  }
});

activityLogWorker.on('failed', (job: any, error: any) => {
  console.error(`❌ Activity log job ${job?.id} failed:`, error.message);
});

activityLogWorker.on('error', (error: any) => {
  console.error('❌ Activity log worker error:', error);
});

export const closeActivityLogQueue = async () => {
  await activityLogWorker.close();
  await activityLogQueue.close();
  console.log('📝 Activity log queue closed');
};