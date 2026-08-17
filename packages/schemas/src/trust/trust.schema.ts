import { z } from "zod";

export const TrustLoginSchema = z.object({
  identifier: z.string().trim().min(1, "Email or username is required"),
  password: z.string().min(1, "Password is required"),
});

export const TrustUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  username: z.string().nullable(),
  image: z.string().nullable(),
  role: z.literal("trust"),
});

export const TrustAuthResponseSchema = z.object({
  token: z.string(),
  user: TrustUserSchema,
});

export type TrustLoginInput = z.infer<typeof TrustLoginSchema>;
export type TrustUser = z.infer<typeof TrustUserSchema>;
export type TrustAuthResponse = z.infer<typeof TrustAuthResponseSchema>;
