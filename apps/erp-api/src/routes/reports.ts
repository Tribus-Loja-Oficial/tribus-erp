import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import type { Env } from "../types/env.js";
import { getEnv } from "../config/env.js";
import { createDb } from "../db/client.js";
import { createReportsService } from "../services/reports.service.js";

const periodQuery = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

export const reports = new Hono<{ Bindings: Env }>();

reports.get("/dre", zValidator("query", periodQuery), async (c) => {
  const db = createDb(getEnv(c.env).db);
  const service = createReportsService(db);
  const { from, to } = c.req.valid("query");
  const data = await service.getDre(from, to);
  return c.json({ data });
});

reports.get(
  "/cashflow",
  zValidator(
    "query",
    periodQuery.extend({ months: z.coerce.number().int().positive().max(24).default(6) }),
  ),
  async (c) => {
    const db = createDb(getEnv(c.env).db);
    const service = createReportsService(db);
    const { from, to, months } = c.req.valid("query");
    const data = await service.getCashflow(from, to, months);
    return c.json({ data });
  },
);

reports.get("/margin", zValidator("query", periodQuery), async (c) => {
  const db = createDb(getEnv(c.env).db);
  const service = createReportsService(db);
  const { from, to } = c.req.valid("query");
  const data = await service.getMarginByProduct(from, to);
  return c.json({ data });
});

reports.get("/sales-by-channel", zValidator("query", periodQuery), async (c) => {
  const db = createDb(getEnv(c.env).db);
  const service = createReportsService(db);
  const { from, to } = c.req.valid("query");
  const data = await service.getSalesByChannel(from, to);
  return c.json({ data });
});

reports.get("/inventory-valuation", async (c) => {
  const db = createDb(getEnv(c.env).db);
  const service = createReportsService(db);
  const data = await service.getInventoryValuation();
  return c.json({ data });
});

reports.get("/payables-receivables", async (c) => {
  const db = createDb(getEnv(c.env).db);
  const service = createReportsService(db);
  const data = await service.getPayablesReceivablesSummary();
  return c.json({ data });
});
