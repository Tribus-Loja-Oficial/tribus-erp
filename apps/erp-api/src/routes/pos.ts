import { Hono } from "hono";
import type { Env } from "../types/env.js";
import { getEnv } from "../config/env.js";
import { createDb } from "../db/client.js";
import { createPosService } from "../services/pos.service.js";
import { toApiError } from "../errors/app-error.js";
import {
  createCashRegisterSchema,
  openCashSessionSchema,
  closeCashSessionSchema,
  createPosSaleSchema,
  addCashMovementSchema,
} from "../schemas/pos.schemas.js";

const pos = new Hono<{ Bindings: Env }>();

pos.get("/registers", async (c) => {
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createPosService(db);
    const data = await service.findActiveRegisters();
    return c.json({ data });
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

pos.post("/registers", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = createCashRegisterSchema.safeParse(body);
  if (!parsed.success)
    return c.json({ code: "VALIDATION_ERROR", issues: parsed.error.issues }, 400);
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createPosService(db);
    const data = await service.createRegister(parsed.data);
    return c.json({ data }, 201);
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

pos.get("/sessions", async (c) => {
  const cashRegisterId = c.req.query("cashRegisterId");
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createPosService(db);
    const data = await service.findSessions({ cashRegisterId });
    return c.json({ data });
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

pos.post("/sessions", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = openCashSessionSchema.safeParse(body);
  if (!parsed.success)
    return c.json({ code: "VALIDATION_ERROR", issues: parsed.error.issues }, 400);
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createPosService(db);
    const data = await service.openSession(parsed.data);
    return c.json({ data }, 201);
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

pos.get("/sessions/:id", async (c) => {
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createPosService(db);
    const data = await service.findSessionById(c.req.param("id"));
    return c.json({ data });
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

pos.post("/sessions/:id/close", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = closeCashSessionSchema.safeParse(body);
  if (!parsed.success)
    return c.json({ code: "VALIDATION_ERROR", issues: parsed.error.issues }, 400);
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createPosService(db);
    const data = await service.closeSession(c.req.param("id"), parsed.data);
    return c.json({ data });
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

pos.post("/sales", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = createPosSaleSchema.safeParse(body);
  if (!parsed.success)
    return c.json({ code: "VALIDATION_ERROR", issues: parsed.error.issues }, 400);
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createPosService(db);
    const data = await service.createSale(parsed.data);
    return c.json({ data }, 201);
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

pos.post("/movements", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = addCashMovementSchema.safeParse(body);
  if (!parsed.success)
    return c.json({ code: "VALIDATION_ERROR", issues: parsed.error.issues }, 400);
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createPosService(db);
    const data = await service.addMovement(parsed.data);
    return c.json({ data }, 201);
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

export { pos };
