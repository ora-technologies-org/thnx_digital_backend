import z from "zod";

export const updateAdminProfileSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name is too long")
    .optional(),

  phone: z.string()
              .min(10, "Phone number should be 10 characters long.")  
              .max(10, "Phone number should be 10 characters long.")
              .optional(),
  bio: z
    .string()
    .min(5, "Bio must be at least 5 characters")
    .max(500, "Bio cannot exceed 500 characters")
    .optional(),

});
export type updateAdminProfileInput = z.infer<typeof updateAdminProfileSchema>