import { z } from 'zod';

// Create Gift Card Schema
export const createGiftCardSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'Title must be at least 3 characters')
    .max(100, 'Title must not exceed 100 characters'),
  
  description: z
    .string()
    .trim()
    .max(500, 'Description must not exceed 500 characters')
    .optional()
    .or(z.literal('')), // Allow empty string
  
  price: z
    .number()
    .positive('Price must be a positive number')
    .max(999999.99, 'Price is too high')
    .multipleOf(0.01, 'Price must have at most 2 decimal places'),
  
  expiryDate: z
    .string()
    .refine((value) => {
      const date = new Date(value);
      return !isNaN(date.getTime());
    }, 'Invalid date format')
    .refine((value) => {
      const date = new Date(value);
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Start of today
      return date > today;
    }, 'Expiry date must be in the future'),
});

// Update Gift Card Schema
export const updateGiftCardSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'Title must be at least 3 characters')
    .max(100, 'Title must not exceed 100 characters')
    .optional(),
  
  description: z
    .string()
    .trim()
    .max(500, 'Description must not exceed 500 characters')
    .optional()
    .or(z.literal('')),
  
  price: z
    .number()
    .positive('Price must be a positive number')
    .max(999999.99, 'Price is too high')
    .multipleOf(0.01, 'Price must have at most 2 decimal places')
    .optional(),
  
  expiryDate: z
    .string()
    .refine((value) => {
      const date = new Date(value);
      return !isNaN(date.getTime());
    }, 'Invalid date format')
    .refine((value) => {
      const date = new Date(value);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return date > today;
    }, 'Expiry date must be in the future')
    .optional(),
  
  isActive: z.boolean().optional(),
});

// Alternative: If you want to accept price as string from forms
export const createGiftCardSchemaForm = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'Title must be at least 3 characters')
    .max(100, 'Title must not exceed 100 characters'),
  
  description: z
    .string()
    .trim()
    .max(500, 'Description must not exceed 500 characters')
    .optional()
    .or(z.literal('')),
  
  price: z.coerce
    .number()
    .positive('Price must be a positive number')
    .max(999999.99, 'Price is too high')
    .multipleOf(0.01, 'Price must have at most 2 decimal places'),
  
  expiryDate: z
    .string()
    .refine((value) => {
      const date = new Date(value);
      return !isNaN(date.getTime());
    }, 'Invalid date format')
    .refine((value) => {
      const date = new Date(value);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return date > today;
    }, 'Expiry date must be in the future'),
});

export type CreateGiftCardInput = z.infer<typeof createGiftCardSchema>;
export type UpdateGiftCardInput = z.infer<typeof updateGiftCardSchema>;