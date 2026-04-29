import { Hono } from "hono";
import type { Env } from "../types/env.js";
import { getEnv } from "../config/env.js";
import { createDb } from "../db/client.js";
import { createInventoryService } from "../services/inventory.service.js";
import { toApiError } from "../errors/app-error.js";
import { z } from "zod";

const inventory = new Hono<{ Bindings: Env }>();

const addMovementSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().optional(),
  locationId: z.string().min(1),
  type: z.enum([
    "purchase", "sale", "return", "adjustment",
    "production_in", "production_out",
    "transfer_in", "transfer_out",
    "damaged", "reservation", "release_reservation",
  ]),
  quantity: z.number().int().min(1),
  unitCostCents: z.number().int().min(0).optional(),
  referenceType: z.string().optional(),
  referenceId: z.string().optional(),
  notes: z.string().optional(),
});

const createLocationSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(["main", "event", "production", "damaged", "reserved", "third_party"]),
  address: z.string().optional(),
});

inventory.get("/locations", async (c) => {
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createInventoryService(db);
    const data = await service.findLocations();
    return c.json({ data });
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

inventory.post("/locations", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = createLocationSchema.safeParse(body);
  if (!parsed.success) return c.json({ code: "VALIDATION_ERROR", issues: parsed.error.issues }, 400);
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createInventoryService(db);
    const data = await service.createLocation(parsed.data);
    return c.json({ data }, 201);
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

inventory.post("/movements", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = addMovementSchema.safeParse(body);
  if (!parsed.success) return c.json({ code: "VALIDATION_ERROR", issues: parsed.error.issues }, 400);
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createInventoryService(db);
    const data = await service.addMovement(parsed.data);
    return c.json({ data }, 201);
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

inventory.get("/movements", async (c) => {
  const productId = c.req.query("productId");
  const locationId = c.req.query("locationId");
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createInventoryService(db);
    const data = await service.findMovements(productId, locationId);
    return c.json({ data });
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

export { inventory };
