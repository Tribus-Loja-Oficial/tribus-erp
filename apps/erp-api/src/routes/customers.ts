import { Hono } from "hono";
import type { Env } from "../types/env.js";
import { getEnv } from "../config/env.js";
import { createDb } from "../db/client.js";
import { createPartyService } from "../services/party.service.js";
import { toApiError } from "../errors/app-error.js";
import {
  createCustomerWithPartySchema,
  listCustomersQuerySchema,
} from "../schemas/people.schemas.js";

const customers = new Hono<{ Bindings: Env }>();

customers.get("/", async (c) => {
  const query = Object.fromEntries(new URL(c.req.url).searchParams);
  const parsed = listCustomersQuerySchema.safeParse(query);
  if (!parsed.success) return c.json({ code: "VALIDATION_ERROR", issues: parsed.error.issues }, 400);
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createPartyService(db);
    const data = await service.listCustomers(parsed.data);
    return c.json({ data });
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

customers.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = createCustomerWithPartySchema.safeParse(body);
  if (!parsed.success) return c.json({ code: "VALIDATION_ERROR", issues: parsed.error.issues }, 400);
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createPartyService(db);
    const data = await service.createCustomerWithParty(parsed.data);
    return c.json({ data }, 201);
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

customers.get("/:id", async (c) => {
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createPartyService(db);
    const data = await service.getCustomerById(c.req.param("id"));
    return c.json({ data });
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

export { customers };
