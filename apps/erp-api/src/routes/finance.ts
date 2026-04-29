import { Hono } from "hono";
import type { Env } from "../types/env.js";
import { getEnv } from "../config/env.js";
import { createDb } from "../db/client.js";
import { createFinanceService } from "../services/finance.service.js";
import { toApiError } from "../errors/app-error.js";
import {
  createFinancialEntrySchema,
  createPayableSchema,
  payPayableSchema,
  createReceivableSchema,
  receiveReceivableSchema,
  listEntriesSchema,
  createFinancialAccountSchema,
} from "../schemas/finance.schemas.js";

const finance = new Hono<{ Bindings: Env }>();

finance.get("/dashboard", async (c) => {
  const from = c.req.query("from");
  const to = c.req.query("to");
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createFinanceService(db);
    const data = await service.getDashboardSummary(from, to);
    return c.json({ data });
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

finance.get("/accounts", async (c) => {
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createFinanceService(db);
    const data = await service.findAccounts();
    return c.json({ data });
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

finance.post("/accounts", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = createFinancialAccountSchema.safeParse(body);
  if (!parsed.success) return c.json({ code: "VALIDATION_ERROR", issues: parsed.error.issues }, 400);
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createFinanceService(db);
    const data = await service.createAccount(parsed.data);
    return c.json({ data }, 201);
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

finance.get("/chart-of-accounts", async (c) => {
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createFinanceService(db);
    const data = await service.findChartOfAccounts();
    return c.json({ data });
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

finance.get("/cost-centers", async (c) => {
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createFinanceService(db);
    const data = await service.findCostCenters();
    return c.json({ data });
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

finance.get("/entries", async (c) => {
  const query = Object.fromEntries(new URL(c.req.url).searchParams);
  const parsed = listEntriesSchema.safeParse(query);
  if (!parsed.success) return c.json({ code: "VALIDATION_ERROR", issues: parsed.error.issues }, 400);
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createFinanceService(db);
    const data = await service.findEntries(parsed.data);
    return c.json({ data });
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

finance.post("/entries", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = createFinancialEntrySchema.safeParse(body);
  if (!parsed.success) return c.json({ code: "VALIDATION_ERROR", issues: parsed.error.issues }, 400);
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createFinanceService(db);
    const data = await service.createEntry(parsed.data);
    return c.json({ data }, 201);
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

finance.get("/payables", async (c) => {
  const query = Object.fromEntries(new URL(c.req.url).searchParams);
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createFinanceService(db);
    const data = await service.findPayables({ status: query.status, page, limit });
    return c.json({ data });
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

finance.post("/payables", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = createPayableSchema.safeParse(body);
  if (!parsed.success) return c.json({ code: "VALIDATION_ERROR", issues: parsed.error.issues }, 400);
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createFinanceService(db);
    const data = await service.createPayable(parsed.data);
    return c.json({ data }, 201);
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

finance.post("/payables/:id/pay", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = payPayableSchema.safeParse(body);
  if (!parsed.success) return c.json({ code: "VALIDATION_ERROR", issues: parsed.error.issues }, 400);
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createFinanceService(db);
    const data = await service.payPayable(c.req.param("id"), parsed.data);
    return c.json({ data });
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

finance.get("/receivables", async (c) => {
  const query = Object.fromEntries(new URL(c.req.url).searchParams);
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createFinanceService(db);
    const data = await service.findReceivables({ status: query.status, page, limit });
    return c.json({ data });
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

finance.post("/receivables", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = createReceivableSchema.safeParse(body);
  if (!parsed.success) return c.json({ code: "VALIDATION_ERROR", issues: parsed.error.issues }, 400);
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createFinanceService(db);
    const data = await service.createReceivable(parsed.data);
    return c.json({ data }, 201);
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

finance.post("/receivables/:id/receive", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = receiveReceivableSchema.safeParse(body);
  if (!parsed.success) return c.json({ code: "VALIDATION_ERROR", issues: parsed.error.issues }, 400);
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createFinanceService(db);
    const data = await service.receiveReceivable(c.req.param("id"), parsed.data);
    return c.json({ data });
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

export { finance };
