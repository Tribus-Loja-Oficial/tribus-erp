import { Hono } from "hono";
import type { Env } from "../types/env.js";
import { getEnv } from "../config/env.js";
import { createDb } from "../db/client.js";
import { createProductionService } from "../services/production.service.js";
import { AppError } from "../errors/app-error.js";
import { zValidator } from "@hono/zod-validator";
import {
  CreateBomSchema,
  CreateProductionOrderSchema,
  StartProductionOrderSchema,
  CompleteProductionOrderSchema,
  ListProductionOrdersSchema,
} from "../schemas/production.schemas.js";

export const production = new Hono<{ Bindings: Env }>();

production.get("/orders", zValidator("query", ListProductionOrdersSchema), async (c) => {
  const db = createDb(getEnv(c.env).db);
  const service = createProductionService(db);
  const params = c.req.valid("query");
  const data = await service.findMany(params);
  return c.json({ data });
});

production.get("/orders/:id", async (c) => {
  const db = createDb(getEnv(c.env).db);
  const service = createProductionService(db);
  try {
    const data = await service.findById(c.req.param("id"));
    return c.json({ data });
  } catch (e) {
    if (e instanceof AppError)
      return c.json({ message: e.message, code: e.code }, e.statusCode as 404);
    throw e;
  }
});

production.post("/orders", zValidator("json", CreateProductionOrderSchema), async (c) => {
  const db = createDb(getEnv(c.env).db);
  const service = createProductionService(db);
  try {
    const data = await service.createProductionOrder(c.req.valid("json"));
    return c.json({ data }, 201);
  } catch (e) {
    if (e instanceof AppError)
      return c.json({ message: e.message, code: e.code }, e.statusCode as 400);
    throw e;
  }
});

production.post("/orders/:id/start", zValidator("json", StartProductionOrderSchema), async (c) => {
  const db = createDb(getEnv(c.env).db);
  const service = createProductionService(db);
  try {
    const data = await service.startProductionOrder(c.req.param("id"), c.req.valid("json"));
    return c.json({ data });
  } catch (e) {
    if (e instanceof AppError)
      return c.json({ message: e.message, code: e.code }, e.statusCode as 400);
    throw e;
  }
});

production.post(
  "/orders/:id/complete",
  zValidator("json", CompleteProductionOrderSchema),
  async (c) => {
    const db = createDb(getEnv(c.env).db);
    const service = createProductionService(db);
    try {
      const data = await service.completeProductionOrder(c.req.param("id"), c.req.valid("json"));
      return c.json({ data });
    } catch (e) {
      if (e instanceof AppError)
        return c.json({ message: e.message, code: e.code }, e.statusCode as 400);
      throw e;
    }
  },
);

production.post("/orders/:id/cancel", async (c) => {
  const db = createDb(getEnv(c.env).db);
  const service = createProductionService(db);
  try {
    const data = await service.cancelProductionOrder(c.req.param("id"));
    return c.json({ data });
  } catch (e) {
    if (e instanceof AppError)
      return c.json({ message: e.message, code: e.code }, e.statusCode as 400);
    throw e;
  }
});

production.get("/bom/product/:productId", async (c) => {
  const db = createDb(getEnv(c.env).db);
  const service = createProductionService(db);
  const data = await service.findBomsByProduct(c.req.param("productId"));
  return c.json({ data });
});

production.post("/bom", zValidator("json", CreateBomSchema), async (c) => {
  const db = createDb(getEnv(c.env).db);
  const service = createProductionService(db);
  try {
    const data = await service.createBom(c.req.valid("json"));
    return c.json({ data }, 201);
  } catch (e) {
    if (e instanceof AppError)
      return c.json({ message: e.message, code: e.code }, e.statusCode as 400);
    throw e;
  }
});
