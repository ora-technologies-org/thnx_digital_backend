import z from "zod";

export const updateAdminProfileSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name is too long")
    .optional(),

  phone: z
  .string()
  .length(10, "Phone number must be 10 digits")
  .regex(/^\d+$/, "Phone number must contain only numbers")
  .optional(),
  bio: z
    .string()
    .min(5, "Bio must be at least 5 characters")
    .max(500, "Bio cannot exceed 500 characters")
    .optional(),

});
export type updateAdminProfileInput = z.infer<typeof updateAdminProfileSchema>