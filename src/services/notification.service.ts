
import { queueNotification } from '../queues/notification.queue';
import { PrismaClient } from '@prisma/client';

import {
  NotificationType,
  RecipientType,
  NotificationPreferenceUpdate,
  notificationTemplates,
} from '../types/notification.types';


const prisma = new PrismaClient();

class NotificationService {
 
  async notifyAdmin(
    type: NotificationType,
    data: Record<string, any>,
    resourceType?: string,
    resourceId?: string,
    actorId?: string,
    actorName?: string
  ) {

    const admin = await prisma.user.findFirst({
      where: { role: 'ADMIN', isActive: true },
    });

    if (!admin) {
      console.warn('No active admin found to send notification');
      return null;
    }

    const template = notificationTemplates[type];
    
    return queueNotification({
      recipientId: admin.id,
      recipientType: RecipientType.ADMIN,
      type,
      title: template.title,
      message: template.message(data),
      resourceType,
      resourceId,
      actorId,
      actorName,
    });
  }

  
  async notifyMerchant(
    merchantUserId: string,
    type: NotificationType,
    data: Record<string, any>,
    resourceType?: string,
    resourceId?: string,
    actorId?: string,
    actorName?: string
  ) {
    const template = notificationTemplates[type];

    return queueNotification({
      recipientId: merchantUserId,
      recipientType: RecipientType.MERCHANT,
      type,
      title: template.title,
      message: template.message(data),
      resourceType,
      resourceId,
      actorId,
      actorName,
    });
  }

  
  async onMerchantRegistered(merchantUserId: string, merchantName: string) {
    return this.notifyAdmin(
      NotificationType.MERCHANT_REGISTERED,
      { merchantName },
      'MerchantProfile',
      merchantUserId,
      merchantUserId,
      merchantName
    );
  }

  async onProfileSubmittedForVerification(merchantUserId: string, merchantName: string, profileId: string) {
    return this.notifyAdmin(
      NotificationType.PROFILE_SUBMITTED_FOR_VERIFICATION,
      { merchantName },
      'MerchantProfile',
      profileId,
      merchantUserId,
      merchantName
    );
  }


  async onPurchaseMade(
    purchaseId: string,
    giftCardTitle: string,
    amount: number,
    customerName: string,
    merchantId: string
  ) {
    return this.notifyAdmin(
      NotificationType.PURCHASE_MADE,
      { giftCardTitle, amount, customerName },
      'PurchasedGiftCard',
      purchaseId,
      undefined,
      customerName
    );
  }


  async onRedemptionMade(
    redemptionId: string,
    amount: number,
    giftCardTitle: string,
    redeemedByName: string
  ) {
    return this.notifyAdmin(
      NotificationType.REDEMPTION_MADE,
      { amount, giftCardTitle },
      'Redemption',
      redemptionId,
      undefined,
      redeemedByName
    );
  }

 
  async onProfileVerified(merchantUserId: string) {
    return this.notifyMerchant(
      merchantUserId,
      NotificationType.PROFILE_VERIFIED,
      {},
      'MerchantProfile',
      merchantUserId
    );
  }


  async onProfileRejected(merchantUserId: string, reason: string) {
    return this.notifyMerchant(
      merchantUserId,
      NotificationType.PROFILE_REJECTED,
      { reason },
      'MerchantProfile',
      merchantUserId
    );
  }

 
  async onGiftCardPurchased(
    merchantUserId: string,
    purchaseId: string,
    giftCardTitle: string,
    customerName: string,
    amount: string
  ) {
    return this.notifyMerchant(
      merchantUserId,
      NotificationType.GIFT_CARD_PURCHASED,
      { giftCardTitle, customerName, amount },
      'PurchasedGiftCard',
      purchaseId,
      undefined,
      customerName
    );
  }


  async onGiftCardRedeemed(
    merchantUserId: string,
    redemptionId: string,
    giftCardTitle: string,
    amount: number,
    redeemedByName: string
  ) {
    return this.notifyMerchant(
      merchantUserId,
      NotificationType.GIFT_CARD_REDEEMED,
      { giftCardTitle, amount },
      'Redemption',
      redemptionId,
      undefined,
      redeemedByName
    );
  }


  async getNotifications(
    userId: string,
    recipientType: RecipientType,
    options: {
      page?: number;
      limit?: number;
      unreadOnly?: boolean;
    } = {}
  ) {
    const { page = 1, limit = 20, unreadOnly = false } = options;
    const skip = (page - 1) * limit;

    const where: any = {
      recipientId: userId,
      recipientType,
    };

    if (unreadOnly) {
      where.isRead = false;
    }

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where }),
    ]);

    return {
      notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + notifications.length < total,
      },
    };
  }

  async getUnreadCount(userId: string, recipientType: RecipientType) {
    return prisma.notification.count({
      where: {
        recipientId: userId,
        recipientType,
        isRead: false,
      },
    });
  }


  async markAsRead(notificationId: string, userId: string) {
    return prisma.notification.updateMany({
      where: {
        id: notificationId,
        recipientId: userId,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

 
  async markAllAsRead(userId: string, recipientType: RecipientType) {
    return prisma.notification.updateMany({
      where: {
        recipientId: userId,
        recipientType,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

 
  async deleteNotification(notificationId: string, userId: string) {
    return prisma.notification.deleteMany({
      where: {
        id: notificationId,
        recipientId: userId,
      },
    });
  }


  async getPreferences(userId: string) {
    let preferences = await prisma.notificationPreference.findUnique({
      where: { userId },
    });

    if (!preferences) {
      preferences = await prisma.notificationPreference.create({
        data: { userId },
      });
    }

    return preferences;
  }


  async updatePreferences(userId: string, updates: NotificationPreferenceUpdate) {
    return prisma.notificationPreference.upsert({
      where: { userId },
      update: updates,
      create: {
        userId,
        ...updates,
      },
    });
  }
}

export const notificationService = new NotificationService();
export default notificationService;