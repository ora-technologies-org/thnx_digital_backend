import { Request } from 'express';
import { PrismaClient } from '@prisma/client';
import { activityLogQueue, ActivityLogJobData } from '../queues/activityLog.queue';

const prisma = new PrismaClient();

// ============ TYPES ============

interface LogActivityParams {
  actorId?: string;
  actorType: 'user' | 'merchant' | 'admin' | 'system';
  action: string;
  category: 'AUTH' | 'USER' | 'MERCHANT' | 'GIFT_CARD' | 'PURCHASE' | 'REDEMPTION' | 'SYSTEM';
  description: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, any>;
  severity?: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  merchantId?: string;
  req?: Request;
}

export interface ActivityLogFilters {
  page?: number;
  limit?: number;
  category?: string;
  severity?: string;
  merchantId?: string;
  actorId?: string;
  resourceType?: string;
  resourceId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

// ============ NON-BLOCKING LOG FUNCTION ============

// Adds log to queue - fire and forget
export const logActivity = (params: LogActivityParams): void => {
  const jobData: ActivityLogJobData = {
    actorId: params.actorId,
    actorType: params.actorType,
    action: params.action,
    category: params.category,
    description: params.description,
    resourceType: params.resourceType,
    resourceId: params.resourceId,
    metadata: params.metadata,
    severity: params.severity || 'INFO',
    merchantId: params.merchantId,
    ipAddress: params.req?.ip || (params.req?.headers['x-forwarded-for'] as string) || undefined,
    userAgent: params.req?.headers['user-agent'] || undefined,
    createdAt: new Date(),
  };

  // Add to queue - fire and forget (non-blocking)
  activityLogQueue.add('log', jobData).catch((error: any) => {
    console.error('Failed to queue activity log:', error);
  });
};

// ============ QUERY FUNCTIONS (for admin dashboard) ============

// Fetch logs with filters
export const getActivityLogs = async (filters: ActivityLogFilters) => {
  const {
    page = 1,
    limit = 50,
    category,
    severity,
    merchantId,
    actorId,
    resourceType,
    resourceId,
    startDate,
    endDate,
    search,
  } = filters;

  const where: any = {};

  if (category) where.category = category;
  if (severity) where.severity = severity;
  if (merchantId) where.merchantId = merchantId;
  if (actorId) where.actorId = actorId;
  if (resourceType) where.resourceType = resourceType;
  if (resourceId) where.resourceId = resourceId;

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  if (search) {
    where.description = { contains: search, mode: 'insensitive' };
  }

  const [logs, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.activityLog.count({ where }),
  ]);

  return {
    success: true,
    data: {
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
  };
};

// Get stats for dashboard
export const getActivityStats = async (merchantId?: string) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const baseWhere = merchantId ? { merchantId } : {};

  const [todayCount, categoryBreakdown, severityBreakdown, recentErrors] = await Promise.all([
    prisma.activityLog.count({
      where: { ...baseWhere, createdAt: { gte: today } },
    }),
    prisma.activityLog.groupBy({
      by: ['category'],
      where: { ...baseWhere, createdAt: { gte: today } },
      _count: true,
    }),
    prisma.activityLog.groupBy({
      by: ['severity'],
      where: { ...baseWhere, createdAt: { gte: today } },
      _count: true,
    }),
    prisma.activityLog.findMany({
      where: {
        ...baseWhere,
        severity: { in: ['ERROR', 'CRITICAL'] },
        createdAt: { gte: today },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);

  return {
    success: true,
    data: {
      today: todayCount,
      byCategory: categoryBreakdown.reduce((acc, item) => {
        acc[item.category] = item._count;
        return acc;
      }, {} as Record<string, number>),
      bySeverity: severityBreakdown.reduce((acc, item) => {
        acc[item.severity] = item._count;
        return acc;
      }, {} as Record<string, number>),
      recentErrors,
    },
  };
};

// Get timeline for a specific resource
export const getResourceTimeline = async (resourceType: string, resourceId: string) => {
  const logs = await prisma.activityLog.findMany({
    where: { resourceType, resourceId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return {
    success: true,
    data: { logs },
  };
};

// ============ CONVENIENCE LOGGER METHODS ============

export const ActivityLogger = {
  // Generic log method
  log: logActivity,

  // ============ AUTH EVENTS ============
  login: (userId: string, role: string, req?: Request) =>
    logActivity({
      actorId: userId,
      actorType: role.toLowerCase() as any,
      action: 'login',
      category: 'AUTH',
      description: 'User logged in',
      resourceType: 'user',
      resourceId: userId,
      req,
    }),

  logout: (userId: string, role: string, req?: Request) =>
    logActivity({
      actorId: userId,
      actorType: role.toLowerCase() as any,
      action: 'logout',
      category: 'AUTH',
      description: 'User logged out',
      resourceType: 'user',
      resourceId: userId,
      req,
    }),

  loginFailed: (email: string, reason: string, req?: Request) =>
    logActivity({
      actorType: 'system',
      action: 'login_failed',
      category: 'AUTH',
      description: `Login failed for ${email}: ${reason}`,
      metadata: { email, reason },
      severity: 'WARNING',
      req,
    }),

  register: (userId: string, email: string, role: string, req?: Request) =>
    logActivity({
      actorId: userId,
      actorType: role.toLowerCase() as any,
      action: 'register',
      category: 'AUTH',
      description: `New ${role.toLowerCase()} registered: ${email}`,
      resourceType: 'user',
      resourceId: userId,
      req,
    }),

  passwordResetRequested: (email: string, req?: Request) =>
    logActivity({
      actorType: 'system',
      action: 'password_reset_requested',
      category: 'AUTH',
      description: `Password reset requested for ${email}`,
      metadata: { email },
      req,
    }),

  passwordChanged: (userId: string, req?: Request) =>
    logActivity({
      actorId: userId,
      actorType: 'user',
      action: 'password_changed',
      category: 'AUTH',
      description: 'Password changed',
      resourceType: 'user',
      resourceId: userId,
      req,
    }),

  emailVerified: (userId: string, email: string, req?: Request) =>
    logActivity({
      actorId: userId,
      actorType: 'user',
      action: 'email_verified',
      category: 'AUTH',
      description: `Email verified: ${email}`,
      resourceType: 'user',
      resourceId: userId,
      req,
    }),

  // ============ USER EVENTS ============
  userCreated: (userId: string, email: string, createdById: string, req?: Request) =>
    logActivity({
      actorId: createdById,
      actorType: 'admin',
      action: 'created',
      category: 'USER',
      description: `User created: ${email}`,
      resourceType: 'user',
      resourceId: userId,
      req,
    }),

  userUpdated: (userId: string, updatedById: string, changes: Record<string, any>, req?: Request) =>
    logActivity({
      actorId: updatedById,
      actorType: 'admin',
      action: 'updated',
      category: 'USER',
      description: 'User profile updated',
      resourceType: 'user',
      resourceId: userId,
      metadata: { changes },
      req,
    }),

  userDeactivated: (userId: string, deactivatedById: string, req?: Request) =>
    logActivity({
      actorId: deactivatedById,
      actorType: 'admin',
      action: 'deactivated',
      category: 'USER',
      description: 'User account deactivated',
      resourceType: 'user',
      resourceId: userId,
      severity: 'WARNING',
      req,
    }),

  // ============ MERCHANT EVENTS ============
  merchantProfileCreated: (merchantProfileId: string, userId: string, businessName: string, req?: Request) =>
    logActivity({
      actorId: userId,
      actorType: 'merchant',
      action: 'profile_created',
      category: 'MERCHANT',
      description: `Merchant profile created: ${businessName}`,
      resourceType: 'merchant_profile',
      resourceId: merchantProfileId,
      merchantId: merchantProfileId,
      req,
    }),

  merchantProfileUpdated: (
    merchantProfileId: string,
    userId: string,
    businessName: string,
    changes: Record<string, any>,
    req?: Request
  ) =>
    logActivity({
      actorId: userId,
      actorType: 'merchant',
      action: 'profile_updated',
      category: 'MERCHANT',
      description: `Merchant profile updated: ${businessName}`,
      resourceType: 'merchant_profile',
      resourceId: merchantProfileId,
      metadata: { changes },
      merchantId: merchantProfileId,
      req,
    }),

  merchantSubmittedForVerification: (
    merchantProfileId: string,
    userId: string,
    businessName: string,
    req?: Request
  ) =>
    logActivity({
      actorId: userId,
      actorType: 'merchant',
      action: 'submitted_for_verification',
      category: 'MERCHANT',
      description: `Merchant submitted for verification: ${businessName}`,
      resourceType: 'merchant_profile',
      resourceId: merchantProfileId,
      merchantId: merchantProfileId,
      req,
    }),

  merchantVerified: (
    merchantProfileId: string,
    businessName: string,
    verifiedById: string,
    req?: Request
  ) =>
    logActivity({
      actorId: verifiedById,
      actorType: 'admin',
      action: 'verified',
      category: 'MERCHANT',
      description: `Merchant verified: ${businessName}`,
      resourceType: 'merchant_profile',
      resourceId: merchantProfileId,
      merchantId: merchantProfileId,
      req,
    }),

  merchantRejected: (
    merchantProfileId: string,
    businessName: string,
    rejectedById: string,
    reason: string,
    req?: Request
  ) =>
    logActivity({
      actorId: rejectedById,
      actorType: 'admin',
      action: 'rejected',
      category: 'MERCHANT',
      description: `Merchant rejected: ${businessName}`,
      resourceType: 'merchant_profile',
      resourceId: merchantProfileId,
      metadata: { reason },
      merchantId: merchantProfileId,
      severity: 'WARNING',
      req,
    }),

  // ============ GIFT CARD EVENTS ============
  giftCardCreated: (
    giftCardId: string,
    merchantId: string,
    title: string,
    price: number,
    req?: Request
  ) =>
    logActivity({
      actorId: merchantId,
      actorType: 'merchant',
      action: 'created',
      category: 'GIFT_CARD',
      description: `Gift card created: "${title}" - ₹${price}`,
      resourceType: 'gift_card',
      resourceId: giftCardId,
      metadata: { title, price },
      merchantId,
      req,
    }),

  giftCardUpdated: (
    giftCardId: string,
    merchantId: string,
    title: string,
    changes: Record<string, any>,
    req?: Request
  ) =>
    logActivity({
      actorId: merchantId,
      actorType: 'merchant',
      action: 'updated',
      category: 'GIFT_CARD',
      description: `Gift card updated: "${title}"`,
      resourceType: 'gift_card',
      resourceId: giftCardId,
      metadata: { changes },
      merchantId,
      req,
    }),

  giftCardDeactivated: (
    giftCardId: string,
    merchantId: string,
    title: string,
    req?: Request
  ) =>
    logActivity({
      actorId: merchantId,
      actorType: 'merchant',
      action: 'deactivated',
      category: 'GIFT_CARD',
      description: `Gift card deactivated: "${title}"`,
      resourceType: 'gift_card',
      resourceId: giftCardId,
      merchantId,
      req,
    }),

  // ============ PURCHASE EVENTS ============
  purchaseCreated: (
    purchaseId: string,
    giftCardTitle: string,
    customerEmail: string,
    amount: number,
    merchantId: string,
    req?: Request
  ) =>
    logActivity({
      actorType: 'user',
      action: 'created',
      category: 'PURCHASE',
      description: `Gift card purchased: "${giftCardTitle}" - ₹${amount} by ${customerEmail}`,
      resourceType: 'purchased_gift_card',
      resourceId: purchaseId,
      metadata: { customerEmail, amount, giftCardTitle },
      merchantId,
      req,
    }),

  paymentCompleted: (
    purchaseId: string,
    transactionId: string,
    amount: number,
    merchantId: string
  ) =>
    logActivity({
      actorType: 'system',
      action: 'payment_completed',
      category: 'PURCHASE',
      description: `Payment completed - ₹${amount} (Transaction: ${transactionId})`,
      resourceType: 'purchased_gift_card',
      resourceId: purchaseId,
      metadata: { transactionId, amount },
      merchantId,
    }),

  paymentFailed: (purchaseId: string, reason: string, merchantId: string) =>
    logActivity({
      actorType: 'system',
      action: 'payment_failed',
      category: 'PURCHASE',
      description: `Payment failed: ${reason}`,
      resourceType: 'purchased_gift_card',
      resourceId: purchaseId,
      metadata: { reason },
      merchantId,
      severity: 'ERROR',
    }),

  purchaseCancelled: (
    purchaseId: string,
    reason: string,
    cancelledById: string,
    merchantId: string,
    req?: Request
  ) =>
    logActivity({
      actorId: cancelledById,
      actorType: 'admin',
      action: 'cancelled',
      category: 'PURCHASE',
      description: `Purchase cancelled: ${reason}`,
      resourceType: 'purchased_gift_card',
      resourceId: purchaseId,
      metadata: { reason },
      merchantId,
      severity: 'WARNING',
      req,
    }),

  purchaseRefunded: (
    purchaseId: string,
    amount: number,
    refundedById: string,
    merchantId: string,
    req?: Request
  ) =>
    logActivity({
      actorId: refundedById,
      actorType: 'admin',
      action: 'refunded',
      category: 'PURCHASE',
      description: `Purchase refunded - ₹${amount}`,
      resourceType: 'purchased_gift_card',
      resourceId: purchaseId,
      metadata: { amount },
      merchantId,
      req,
    }),

  // ============ REDEMPTION EVENTS ============
  redemptionSuccess: (
    redemptionId: string,
    purchaseId: string,
    amount: number,
    balanceAfter: number,
    redeemedById: string,
    merchantId: string,
    req?: Request
  ) =>
    logActivity({
      actorId: redeemedById,
      actorType: 'merchant',
      action: 'redeemed',
      category: 'REDEMPTION',
      description: `₹${amount} redeemed, remaining balance: ₹${balanceAfter}`,
      resourceType: 'redemption',
      resourceId: redemptionId,
      metadata: { amount, balanceAfter, purchaseId },
      merchantId,
      req,
    }),

  redemptionFullyRedeemed: (
    purchaseId: string,
    totalRedeemed: number,
    merchantId: string
  ) =>
    logActivity({
      actorType: 'system',
      action: 'fully_redeemed',
      category: 'REDEMPTION',
      description: `Gift card fully redeemed - Total: ₹${totalRedeemed}`,
      resourceType: 'purchased_gift_card',
      resourceId: purchaseId,
      metadata: { totalRedeemed },
      merchantId,
    }),

  verificationSuccess: (
    purchaseId: string,
    qrCodePartial: string,
    verifiedById: string,
    merchantId: string,
    req?: Request
  ) =>
    logActivity({
      actorId: verifiedById,
      actorType: 'merchant',
      action: 'verification_success',
      category: 'REDEMPTION',
      description: 'QR code verified successfully',
      resourceType: 'purchased_gift_card',
      resourceId: purchaseId,
      metadata: { qrCodePartial },
      merchantId,
      req,
    }),

  verificationFailed: (
    qrCode: string,
    reason: string,
    attemptedById?: string,
    merchantId?: string,
    req?: Request
  ) =>
    logActivity({
      actorId: attemptedById,
      actorType: attemptedById ? 'merchant' : 'system',
      action: 'verification_failed',
      category: 'REDEMPTION',
      description: `QR verification failed: ${reason}`,
      metadata: { qrCodePartial: qrCode.substring(0, 8) + '...', reason },
      merchantId,
      severity: 'WARNING',
      req,
    }),

  // ============ SYSTEM EVENTS ============
  systemError: (error: string, context?: Record<string, any>) =>
    logActivity({
      actorType: 'system',
      action: 'error',
      category: 'SYSTEM',
      description: `System error: ${error}`,
      metadata: context,
      severity: 'ERROR',
    }),

  scheduledTaskCompleted: (taskName: string, result?: Record<string, any>) =>
    logActivity({
      actorType: 'system',
      action: 'scheduled_task_completed',
      category: 'SYSTEM',
      description: `Scheduled task completed: ${taskName}`,
      metadata: result,
    }),

  scheduledTaskFailed: (taskName: string, error: string) =>
    logActivity({
      actorType: 'system',
      action: 'scheduled_task_failed',
      category: 'SYSTEM',
      description: `Scheduled task failed: ${taskName}`,
      metadata: { error },
      severity: 'ERROR',
    }),
};