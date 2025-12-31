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

export const createSupportTicketSchema = z
  .object({
    title: z
      .string({
        required_error: "Title is required",
        invalid_type_error: "Title must be a string",
      })
      .trim()
      .min(3, "Title must be at least 3 characters long")
      .max(100, "Title must not exceed 100 characters"),

    query: z
      .string({
        required_error: "Query is required",
        invalid_type_error: "Query must be a string",
      })
      .trim()
      .min(10, "Query must be at least 10 characters long")
      .max(1000, "Query must not exceed 1000 characters"),
  })
  .strict();

export const updateSupportTicketSchema = z
  .object({
    response: z
      .string({
        required_error: "Response is required",
        invalid_type_error: "Response must be a string",
      })
      .trim()
      .min(5, "Response must be at least 5 characters long")
      .max(2000, "Response must not exceed 2000 characters"),

    status: z.enum(["CLOSE", "IN_PROGRESS"], {
      errorMap: () => ({
        message: "Status must be either CLOSE or IN_PROGRESS",
      }),
    }),
  })
  .strict();

export type createSupportTicketInput = z.infer<typeof createSupportTicketSchema>;
export type updateSupportTicketInput = z.infer<typeof updateSupportTicketSchema>;
export type notifyMerchantInput = z.infer<typeof notifyMerchantSchema>
export type createContactInput = z.infer<typeof createContactUsSchema>; 
export type merchantVerifyInput = z.infer<typeof merchantVerifySchema>;