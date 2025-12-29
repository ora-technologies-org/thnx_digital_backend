import z from "zod";

export const createContactUsSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email address'),
    message: z.string().min(3, "Message should at least be 3 characters"),
    phone: z.string()
            .min(10, "Phone number should be 10 characters long.")  
            .max(10, "Phone number should be 10 characters long.")
});

export const merchantVerifySchema = z.object({
    action: z.enum(["approve", "reject"], {
      required_error: "Action is required",
    }),

    rejectionReason: z
      .string()
      .trim()
      .optional(),

    verificationNotes: z
      .string()
      .trim()
      .min(5, "Verification notes must be at least 5 characters")
      .optional(),
  });


export const notifyMerchantSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email address'),
    merchantId: z.string().uuid("Invalid merchant")
});

export type notifyMerchantInput = z.infer<typeof notifyMerchantSchema>
export type createContactInput = z.infer<typeof createContactUsSchema>; 
export type merchantVerifyInput = z.infer<typeof merchantVerifySchema>;