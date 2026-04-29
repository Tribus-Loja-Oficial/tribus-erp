import { z } from "zod";

const envSchema = z.object({
  ERP_API_URL: z.string().url(),
  ERP_API_INTERNAL_SECRET: z.string().min(32),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
});

function getEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment: ${parsed.error.message}`);
  }
  return {
    erpApiUrl: parsed.data.ERP_API_URL,
    erpApiInternalSecret: parsed.data.ERP_API_INTERNAL_SECRET,
    appUrl: parsed.data.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  };
}

export const env = getEnv();
export type Env = typeof env;
