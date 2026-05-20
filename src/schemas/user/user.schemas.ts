import { z } from "zod";

export const createUserSchema = z.object({
  userName: z.string().min(1, "userName is required")
});

export type CreateUserBody = z.infer<typeof createUserSchema>;

