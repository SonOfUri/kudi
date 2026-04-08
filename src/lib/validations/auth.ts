import { z } from "zod";

export const credentialsSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(72),
});

export type CredentialsInput = z.infer<typeof credentialsSchema>;
