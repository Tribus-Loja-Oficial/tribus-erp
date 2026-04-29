import { Hono } from "hono";
import type { Env } from "../types/env.js";
import { getEnv } from "../config/env.js";
import { createDb } from "../db/client.js";
import { createProductService } from "../services/product.service.js";
import { toApiError } from "../errors/app-error.js";
import {
  createProductSchema,
  updateProductSchema,
  listProductsSchema,
  createCategorySchema,
  createVariantSchema,
} from "../schemas/product.schemas.js";

const products = new Hono<{ Bindings: Env }>();

products.get("/", async (c) => {
  const query = Object.fromEntries(new URL(c.req.url).searchParams);
  const parsed = listProductsSchema.safeParse(query);
  if (!parsed.success)
    return c.json({ code: "VALIDATION_ERROR", issues: parsed.error.issues }, 400);
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createProductService(db);
    const data = await service.findMany(parsed.data);
    return c.json({ data });
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

products.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = createProductSchema.safeParse(body);
  if (!parsed.success)
    return c.json({ code: "VALIDATION_ERROR", issues: parsed.error.issues }, 400);
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createProductService(db);
    const data = await service.create(parsed.data);
    return c.json({ data }, 201);
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

products.get("/low-stock", async (c) => {
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createProductService(db);
    const data = await service.findLowStock();
    return c.json({ data });
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

products.get("/categories", async (c) => {
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createProductService(db);
    const data = await service.findCategories();
    return c.json({ data });
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

products.post("/categories", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = createCategorySchema.safeParse(body);
  if (!parsed.success)
    return c.json({ code: "VALIDATION_ERROR", issues: parsed.error.issues }, 400);
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createProductService(db);
    const data = await service.createCategory(parsed.data);
    return c.json({ data }, 201);
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

products.get("/collections", async (c) => {
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createProductService(db);
    const data = await service.findCollections();
    return c.json({ data });
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

products.get("/:id", async (c) => {
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createProductService(db);
    const data = await service.findById(c.req.param("id"));
    return c.json({ data });
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

products.patch("/:id", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = updateProductSchema.safeParse(body);
  if (!parsed.success)
    return c.json({ code: "VALIDATION_ERROR", issues: parsed.error.issues }, 400);
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createProductService(db);
    const data = await service.update(c.req.param("id"), parsed.data);
    return c.json({ data });
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

products.delete("/:id", async (c) => {
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createProductService(db);
    await service.archive(c.req.param("id"));
    return c.json({ success: true });
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

products.post("/:id/variants", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = createVariantSchema.safeParse({ ...body, productId: c.req.param("id") });
  if (!parsed.success)
    return c.json({ code: "VALIDATION_ERROR", issues: parsed.error.issues }, 400);
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createProductService(db);
    const data = await service.createVariant(parsed.data);
    return c.json({ data }, 201);
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

export { products };
