import { Hono } from "hono";
import type { Env } from "../types/env.js";
import { getEnv } from "../config/env.js";
import { createDb } from "../db/client.js";
import { createPurchaseService } from "../services/purchase.service.js";
import { toApiError } from "../errors/app-error.js";
import {
  createPurchaseOrderSchema,
  updatePurchaseStatusSchema,
  receivePurchaseOrderSchema,
  listPurchaseOrdersSchema,
} from "../schemas/purchase.schemas.js";

const purchases = new Hono<{ Bindings: Env }>();

purchases.get("/", async (c) => {
  const query = Object.fromEntries(new URL(c.req.url).searchParams);
  const parsed = listPurchaseOrdersSchema.safeParse(query);
  if (!parsed.success)
    return c.json({ code: "VALIDATION_ERROR", issues: parsed.error.issues }, 400);
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createPurchaseService(db);
    const data = await service.findMany(parsed.data);
    return c.json({ data });
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

purchases.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = createPurchaseOrderSchema.safeParse(body);
  if (!parsed.success)
    return c.json({ code: "VALIDATION_ERROR", issues: parsed.error.issues }, 400);
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createPurchaseService(db);
    const data = await service.create(parsed.data);
    return c.json({ data }, 201);
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

purchases.get("/:id", async (c) => {
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createPurchaseService(db);
    const data = await service.findById(c.req.param("id"));
    return c.json({ data });
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

purchases.patch("/:id/status", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = updatePurchaseStatusSchema.safeParse(body);
  if (!parsed.success)
    return c.json({ code: "VALIDATION_ERROR", issues: parsed.error.issues }, 400);
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createPurchaseService(db);
    const data = await service.updateStatus(c.req.param("id"), parsed.data);
    return c.json({ data });
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

purchases.post("/:id/receive", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = receivePurchaseOrderSchema.safeParse(body);
  if (!parsed.success)
    return c.json({ code: "VALIDATION_ERROR", issues: parsed.error.issues }, 400);
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createPurchaseService(db);
    const data = await service.receive(c.req.param("id"), parsed.data);
    return c.json({ data });
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

export { purchases };
