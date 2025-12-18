import { emitWarning } from 'process';
import { TypeOf, z } from 'zod';

// Merchant Registration Schema


export const merchantQuickRegisterSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  // businessName: z.string().min(2, 'Business name must be at least 2 characters'),
  phone: z.string().optional(),
});


export const completeProfileSchema = z.object({
  // Business Information
  businessName: z.string().min(2, 'Business name must be at least 2 characters'),
  businessRegistrationNumber: z.string().optional(),
  taxId: z.string().optional(),
  businessType: z.string().optional(),
  businessCategory: z.string().optional(),
  
  // Business Address
  address: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().min(1, 'Country is required'),
  
  // Business Contact
  businessPhone: z.string().min(1, 'Business phone is required'),
  businessEmail: z.string().email('Invalid business email'),
  website: z.string().url('Invalid website URL').optional(),
  
  // Bank Details (for payments)
  bankName: z.string().min(1, 'Bank name is required'),
  accountNumber: z.string().min(1, 'Account number is required'),
  accountHolderName: z.string().min(1, 'Account holder name is required'),
  ifscCode: z.string().optional(),
  swiftCode: z.string().optional(),
  
  // Additional Info
  description: z.string().optional(),
});


// export const merchantRegisterSchema = z.object({
//   // User Information
//   email: z.string().email('Invalid email address'),
//   password: z
//     .string()
//     .min(8, 'Password must be at least 8 characters')
//     .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
//     .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
//     .regex(/[0-9]/, 'Password must contain at least one number')
//     .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
//   name: z.string().min(2, 'Name must be at least 2 characters'),
//   phone: z.string().optional(),
  
//   // Business Information
//   businessName: z.string().min(2, 'Business name must be at least 2 characters'),
//   businessRegistrationNumber: z.string().optional(),
//   taxId: z.string().optional(),
//   businessType: z.string().optional(),
//   businessCategory: z.string().optional(),
  
//   // Business Address
//   address: z.string().optional(),
//   city: z.string().optional(),
//   state: z.string().optional(),
//   zipCode: z.string().optional(),
//   country: z.string().optional(),
  
//   // Business Contact
//   businessPhone: z.string().optional(),
//   businessEmail: z.string().email('Invalid business email').optional(),
//   website: z.string().url('Invalid website URL').optional(),
  
//   // Additional Info
//   description: z.string().optional(),
// });

// Login Schema
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// Admin Create Merchant Schema
export const adminCreateMerchantSchema = z.object({
  // User Information
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().optional(),
  
  // Business Information
  businessName: z.string().min(2, 'Business name must be at least 2 characters'),
  businessRegistrationNumber: z.string().optional(),
  taxId: z.string().optional(),
  businessType: z.string().optional(),
  businessCategory: z.string().optional(),
  
  // Business Address
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().optional(),
  
  // Business Contact
  businessPhone: z.string().optional(),
  businessEmail: z.string().email('Invalid business email').optional(),
  website: z.string().url('Invalid website URL').optional(),

  // Bank Details (for payments)
  bankName: z.string().min(1, 'Bank name is required'),
  accountNumber: z.string().min(1, 'Account number is required'),
  accountHolderName: z.string().min(1, 'Account holder name is required'),
  ifscCode: z.string().optional(),
  swiftCode: z.string().optional(),

  // Additional Info
  description: z.string().optional(),
});

export const changePasswordSchema = z.object({
  email : z.string().email("Invalid Email Address"),
  otp: z.string(),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
})

export const resetPasswordSchema = z.object({
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  newPassword: z.string()
   .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
})

export const updateMerchantSchema = z.object({
  // Business Information
  businessName: z.string().min(2, 'Business name must be at least 2 characters').optional(),
  businessRegistrationNumber: z.string().optional(),
  taxId: z.string().optional(),
  businessType: z.string().optional(),
  businessCategory: z.string().optional(),
  
  // Business Address
  address: z.string().min(1, 'Address is required').optional(),
  city: z.string().min(1, 'City is required').optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().min(1, 'Country is required').optional(),
  
  // Business Contact
  businessPhone: z.string().min(1, 'Business phone is required').optional(),
  businessEmail: z.string().email('Invalid business email').optional(),
  website: z.string().url('Invalid website URL').optional(),
  
  // Bank Details (for payments)
  bankName: z.string().min(1, 'Bank name is required').optional(),
  accountNumber: z.string().min(1, 'Account number is required').optional(),
  accountHolderName: z.string().min(1, 'Account holder name is required').optional(),
  ifscCode: z.string().optional().optional(),
  swiftCode: z.string().optional().optional(),
  
  // Additional Info
  description: z.string().optional(),
});

export type MerchantRegister = z.infer<typeof merchantQuickRegisterSchema>;
export type MerchantRegisterInput = z.infer<typeof completeProfileSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type AdminCreateMerchantInput = z.infer<typeof adminCreateMerchantSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>