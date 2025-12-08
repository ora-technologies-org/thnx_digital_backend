import { z } from 'zod';

// Purchase Gift Card Schema (No login required)
export const purchaseGiftCardSchema = z.object({
  customerName: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name is too long'),
  customerEmail: z
    .string()
    .email('Invalid email address'),
  customerPhone: z
    .string()
    .min(10, 'Phone number must be at least 10 digits')
    .max(15, 'Phone number is too long'),
  paymentMethod: z
    .string()
    .optional(),
  transactionId: z
    .string()
    .optional(),
});

// Redeem Gift Card Schema
export const redeemGiftCardSchema = z.object({
  qrCode: z
    .string()
    .min(1, 'QR code is required'),
  amount: z
    .number()
    .positive('Amount must be positive')
    .max(999999.99, 'Amount is too high'),
  locationName: z
    .string()
    .optional(),
  locationAddress: z
    .string()
    .optional(),
  notes: z
    .string()
    .max(500, 'Notes are too long')
    .optional(),
});

export type PurchaseGiftCardInput = z.infer<typeof purchaseGiftCardSchema>;
export type RedeemGiftCardInput = z.infer<typeof redeemGiftCardSchema>;