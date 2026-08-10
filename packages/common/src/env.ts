import { z } from "zod";

const commonEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).optional(),
});

const frontendEnvSchema = commonEnvSchema.extend({
  NEXT_PUBLIC_API_BASE_URL: z.url(),
  NEXT_PUBLIC_FRONTEND_URL: z.url(),
});

const backendEnvSchema = commonEnvSchema.extend({
  BETTER_AUTH_SECRET: z.string(),
  BETTER_AUTH_URL: z.url(),
  PORT: z.coerce.number(),
  FRONTEND_URL: z.url(),
  DEPARTMENT_CONTEXT_STRICT_MODE: z
    .enum(["true", "false"])
    .optional()
    .default("true"),
  GMAIL_APP_PASSWORD: z.string(),
  SENDER_EMAIL: z.string(),
  TRUSTSIGNAL_API_KEY: z.string().optional(),
  WHATSAPP_SENDER_NUMBER: z.string().optional(),
  SMS_API_KEY: z.string().optional(),
  SMS_SENDER_ID: z.string().optional(),
  SMS_API_URL: z.url().optional(),
  AWS_ACCESS_KEY_ID: z.string(),
  AWS_SECRET_ACCESS_KEY: z.string(),
  AWS_REGION: z.string(),
  AWS_S3_BUCKET_NAME: z.string(),
  ADMIN_USER_NAME: z.string(),
  ADMIN_USER_EMAIL: z.string(),
  ADMIN_USER_PASSWORD: z.string(),
  ADMIN_USER_USERNAME: z.string(),
  ADMISSION_USER_NAME: z.string(),
  ADMISSION_USER_EMAIL: z.string(),
  ADMISSION_USER_PASSWORD: z.string(),
  ADMISSION_USER_USERNAME: z.string(),
});

/**
 * Directly using process.env in Next.js can lead to undefined values
 * because Next.js does not automatically parse environment variables.
 * So, we need to directly pass them as an object to Zod for validation.
 * https://stackoverflow.com/questions/77255954/validating-environment-variables-in-next-js-with-zod
 */
export function frontendEnv() {
  return frontendEnvSchema.parse({
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
    NEXT_PUBLIC_FRONTEND_URL: process.env.NEXT_PUBLIC_FRONTEND_URL,
  });
}

export function backendEnv(env = process.env) {
  return backendEnvSchema.parse(env);
}
