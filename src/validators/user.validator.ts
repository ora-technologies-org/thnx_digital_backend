import z from "zod";

export const createContactUsSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email address'),
    message: z.string().min(3, "Message should at least be 3 characters"),
    phone: z.string()
            .min(10, "Phone number should be 10 characters long.")  
            .max(10, "Phone number should be 10 characters long.")
});

export type createContactInput = z.infer<typeof createContactUsSchema>; 