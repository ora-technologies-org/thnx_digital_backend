
import { Queue, Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import redisConfig from '../config/redis.config';
import { getIO } from '../config/socket.config';
import {
  CreateNotificationPayload,
  notificationTypeToPreferenceField,
} from '../types/notification.types';

import {
  emitAdminNotification,
  emitAdminUnreadCount,
  emitMerchantNotification,
  emitMerchantUnreadCount,
} from '../config/socket.config';

const prisma = new PrismaClient();
const isProduction = process.env.NODE_ENV === 'production';

const QUEUE_NAME = 'notification-queue';

export const notificationQueue = new Queue(QUEUE_NAME, {
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

export const notificationWorker = new Worker(
  QUEUE_NAME,
  async (job: Job) => {
    const { type, data } = job.data;

    switch (type) {
      case 'CREATE_NOTIFICATION':
        return await processCreateNotification(data);
      case 'CLEANUP_OLD_NOTIFICATIONS':
        return await processCleanupOldNotifications();
      default:
        console.warn(`Unknown notification job type: ${type}`);
        return null;
    }
  },
  {
    connection: redisConfig,
    concurrency: isProduction ? 20 : 10,
  }
);



async function processCreateNotification(payload: CreateNotificationPayload) {
  const { recipientId, recipientType, type } = payload;

  // Check user preferences
  const preferences = await prisma.notificationPreference.findUnique({
    where: { userId: recipientId },
  });

  if (preferences) {
    const preferenceField = notificationTypeToPreferenceField[type];
    if (preferenceField && preferences[preferenceField] === false) {
      console.log(
        `Notification ${type} skipped for user ${recipientId} - disabled in preferences`
      );
      return null;
    }
  }

  // Create notification in DB
  const notification = await prisma.notification.create({
    data: {
      recipientId: payload.recipientId,
      recipientType: payload.recipientType,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      resourceType: payload.resourceType,
      resourceId: payload.resourceId,
      actorId: payload.actorId,
      actorName: payload.actorName,
    },
  });

  // Emit via socket to correct namespace
  if (recipientType === 'ADMIN') {
    console.log(`📤 Emitting admin notification:`, notification.title);
    emitAdminNotification(notification);

    const unreadCount = await prisma.notification.count({
      where: { recipientType: 'ADMIN', isRead: false },
    });
    console.log(`📤 Emitting admin unread count: ${unreadCount}`);
    emitAdminUnreadCount(unreadCount);
  } else {
    console.log(`📤 Emitting merchant notification to ${recipientId}:`, notification.title);
    emitMerchantNotification(recipientId, notification);

    const unreadCount = await prisma.notification.count({
      where: { recipientId, recipientType: 'MERCHANT', isRead: false },
    });
    console.log(`📤 Emitting merchant unread count: ${unreadCount}`);
    emitMerchantUnreadCount(recipientId, unreadCount);
  }

  return { success: true, notificationId: notification.id };
}


async function processCleanupOldNotifications() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const result = await prisma.notification.deleteMany({
    where: {
      createdAt: {
        lt: thirtyDaysAgo,
      },
    },
  });

  console.log(`🧹 Cleaned up ${result.count} notifications older than 30 days`);
  return { success: true, deletedCount: result.count };
}


export async function scheduleNotificationCleanup() {
  const existingJobs = await notificationQueue.getRepeatableJobs();
  for (const job of existingJobs) {
    if (job.name === 'cleanup-old-notifications') {
      await notificationQueue.removeRepeatableByKey(job.key);
    }
  }

  await notificationQueue.add(
    'cleanup-old-notifications',
    { type: 'CLEANUP_OLD_NOTIFICATIONS', data: {} },
    {
      repeat: {
        pattern: '0 2 * * *', 
      },
    }
  );

  console.log('📅 Notification cleanup job scheduled (daily at 2 AM)');
}

export async function queueNotification(payload: CreateNotificationPayload) {
  return notificationQueue.add('create-notification', {
    type: 'CREATE_NOTIFICATION',
    data: payload,
  });
}

notificationWorker.on('completed', (job) => {
  if (!isProduction) {
    console.log(`✅ Notification job ${job.id} completed`);
  }
});

notificationWorker.on('failed', (job, err) => {
  console.error(`❌ Notification job ${job?.id} failed:`, err.message);
});

notificationWorker.on('error', (error) => {
  console.error('❌ Notification worker error:', error);
});

export const closeNotificationQueue = async () => {
  await notificationWorker.close();
  await notificationQueue.close();
  console.log('🔔 Notification queue closed');
};

export default {
  notificationQueue,
  notificationWorker,
  queueNotification,
  scheduleNotificationCleanup,
  closeNotificationQueue,
};