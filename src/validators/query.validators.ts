import { z } from 'zod';

export const getSupportTicketsQuerySchema = z.object({
  search: z.string().trim().optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'status', 'priority', 'title'])
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().positive().min(1).default(1),
  limit: z.coerce.number().int().positive().min(1).max(100).default(10),
});


export const getMerchantsQuerySchema = z.object({
  search: z.string().trim().optional(),
  profileStatus: z.enum(['PENDING_VERIFICATION', 'VERIFIED', 'REJECTED', 'INCOMPLETE'])
    .optional(),
  active: z.enum(['true', 'false']).optional(),
  createdBy: z.string().uuid().optional(),
  sortBy: z.enum([
    'createdAt',
    'updatedAt',
    'businessName',
    'city',
    'country',
    'isVerified',
    'verifiedAt',
    'giftCardLimit'
  ]).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().positive().min(1).default(1),
  limit: z.coerce.number().int().positive().min(1).max(100).default(10),
});


export const getPendingMerchantsQuerySchema = z.object({
  search: z.string().trim().optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'businessName', 'city', 'country'])
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().positive().min(1).default(1),
  limit: z.coerce.number().int().positive().min(1).max(100).default(10),
});

export const getVerifiedMerchantsQuerySchema = z.object({
  search: z.string().trim().optional(),
  
  sortBy: z.enum([
    'createdAt',
    'updatedAt',
    'businessName',
    'city',
    'state',
    'country',
    'verifiedAt',
    'giftCardLimit'
  ]).default('createdAt'),
  
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  
  page: z.coerce.number().int().positive().min(1).default(1),
  
  limit: z.coerce.number().int().positive().min(1).max(100).default(10),
});



export const getMyGiftCardsQuerySchema = z.object({
  search: z.string().trim().optional(),
  
  sortBy: z.enum(['price', 'createdAt', 'expiryDate', 'title'])
    .default('createdAt'),
  
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  
  page: z.coerce.number().int().positive().min(1).default(1),
  
  limit: z.coerce.number().int().positive().min(1).max(100).default(10),
});



export const getPurchaseOrdersQuerySchema = z.object({
  search: z.string().trim().optional(),
  
  sortBy: z.enum([
    'purchasedAt',
    'redeemedAt',
    'price',
    'customerName',
    'status'
  ]).default('purchasedAt'),
  
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  
  page: z.coerce.number().int().positive().min(1).default(1),
  
  limit: z.coerce.number().int().positive().min(1).max(100).default(10),
});


export const getRedemptionHistoryQuerySchema = z.object({
  search: z.string().trim().optional(),
  
  sortBy: z.enum([
    'redeemedAt',
    'amount',
    'balanceBefore',
    'balanceAfter',
    'locationName'
  ]).default('redeemedAt'),
  
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  
  page: z.coerce.number().int().positive().min(1).default(1),
  
  limit: z.coerce.number().int().positive().min(1).max(100).default(50),
});



export type GetRedemptionHistoryQuery = z.infer<typeof getRedemptionHistoryQuerySchema>;
export type GetVerifiedMerchantsQuery = z.infer<typeof getVerifiedMerchantsQuerySchema>;
export type GetMyGiftCardsQuery = z.infer<typeof getMyGiftCardsQuerySchema>;
export type GetPurchaseOrdersQuery = z.infer<typeof getPurchaseOrdersQuerySchema>;
export type GetPendingMerchantsQuery = z.infer<typeof getPendingMerchantsQuerySchema>;
export type GetMerchantsQuery = z.infer<typeof getMerchantsQuerySchema>;
export type GetSupportTicketsQuery = z.infer<typeof getSupportTicketsQuerySchema>;
