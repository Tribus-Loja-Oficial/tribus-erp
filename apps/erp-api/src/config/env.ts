import { z } from "zod";
import type { Env } from "../types/env.js";

const envSchema = z.object({
  ENVIRONMENT: z.enum(["development", "production"]).default("development"),
  CDS_API_URL: z.string().url().optional(),
  CDS_JWT_ISSUER: z.string().default("tribus-cds"),
  CDS_JWT_AUDIENCE: z.string().default("tribus-platform"),
  ERP_INTERNAL_SECRET: z.string().min(32),
  CDS_JWT_SECRET: z.string().min(32),
  MONITOR_API_URL: z.string().url().optional(),
  MONITOR_COVERAGE_TOKEN: z.string().optional(),
});

export interface AppConfig {
  environment: string;
  cdsApiUrl: string | undefined;
  cdsJwtIssuer: string;
  cdsJwtAudience: string;
  erpInternalSecret: string;
  cdsJwtSecret: string;
  monitorApiUrl: string | undefined;
  monitorCoverageToken: string | undefined;
  db: D1Database;
  r2: R2Bucket;
}

export function getEnv(env: Env): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
  }
  return {
    environment: parsed.data.ENVIRONMENT,
    cdsApiUrl: parsed.data.CDS_API_URL,
    cdsJwtIssuer: parsed.data.CDS_JWT_ISSUER,
    cdsJwtAudience: parsed.data.CDS_JWT_AUDIENCE,
    erpInternalSecret: parsed.data.ERP_INTERNAL_SECRET,
    cdsJwtSecret: parsed.data.CDS_JWT_SECRET,
    monitorApiUrl: parsed.data.MONITOR_API_URL,
    monitorCoverageToken: parsed.data.MONITOR_COVERAGE_TOKEN,
    db: env.TRIBUS_ERP_DB,
    r2: env.TRIBUS_ERP_R2,
  };
}
