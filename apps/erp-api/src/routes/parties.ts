import { Hono } from "hono";
import type { Env } from "../types/env.js";
import { getEnv } from "../config/env.js";
import { createDb } from "../db/client.js";
import { createPartyService } from "../services/party.service.js";
import { toApiError } from "../errors/app-error.js";
import {
  createPartySchema,
  updatePartySchema,
  listPartiesSchema,
  createAddressSchema,
} from "../schemas/party.schemas.js";

const parties = new Hono<{ Bindings: Env }>();

parties.get("/", async (c) => {
  const query = Object.fromEntries(new URL(c.req.url).searchParams);
  const parsed = listPartiesSchema.safeParse(query);
  if (!parsed.success)
    return c.json({ code: "VALIDATION_ERROR", issues: parsed.error.issues }, 400);
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createPartyService(db);
    const data = await service.findMany(parsed.data);
    return c.json({ data });
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

parties.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = createPartySchema.safeParse(body);
  if (!parsed.success)
    return c.json({ code: "VALIDATION_ERROR", issues: parsed.error.issues }, 400);
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createPartyService(db);
    const data = await service.create(parsed.data);
    return c.json({ data }, 201);
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

parties.get("/:id", async (c) => {
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createPartyService(db);
    const data = await service.findById(c.req.param("id"));
    return c.json({ data });
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

parties.patch("/:id", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = updatePartySchema.safeParse(body);
  if (!parsed.success)
    return c.json({ code: "VALIDATION_ERROR", issues: parsed.error.issues }, 400);
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createPartyService(db);
    const data = await service.update(c.req.param("id"), parsed.data);
    return c.json({ data });
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

parties.delete("/:id", async (c) => {
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createPartyService(db);
    await service.archive(c.req.param("id"));
    return c.json({ success: true });
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

parties.post("/:id/addresses", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = createAddressSchema.safeParse({ ...body, partyId: c.req.param("id") });
  if (!parsed.success)
    return c.json({ code: "VALIDATION_ERROR", issues: parsed.error.issues }, 400);
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createPartyService(db);
    const data = await service.addAddress(parsed.data);
    return c.json({ data }, 201);
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

parties.post("/:id/customer", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createPartyService(db);
    const data = await service.createCustomer(c.req.param("id"), body);
    return c.json({ data }, 201);
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

parties.post("/:id/supplier", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createPartyService(db);
    const data = await service.createSupplier(c.req.param("id"), body);
    return c.json({ data }, 201);
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

export { parties };
