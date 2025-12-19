// src/validators/notification.validator.ts

import { z } from 'zod';

// Update notification preferences schema
export const updatePreferencesSchema = z.object({
  // Admin notification preferences
  merchantRegistered: z.boolean().optional(),
  profileSubmittedForVerification: z.boolean().optional(),
  purchaseMade: z.boolean().optional(),
  redemptionMade: z.boolean().optional(),

  // Merchant notification preferences
  profileVerified: z.boolean().optional(),
  profileRejected: z.boolean().optional(),
  giftCardPurchased: z.boolean().optional(),
  giftCardRedeemed: z.boolean().optional(),
}).strict();

// Get notifications query schema
export const getNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  unreadOnly: z.coerce.boolean().default(false),
});

// Mark as read params schema
export const notificationIdParamSchema = z.object({
  id: z.string().uuid('Invalid notification ID'),
});

// Types inferred from schemas
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
export type GetNotificationsQuery = z.infer<typeof getNotificationsQuerySchema>;
export type NotificationIdParam = z.infer<typeof notificationIdParamSchema>;