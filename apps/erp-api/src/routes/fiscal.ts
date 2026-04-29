import { Hono } from "hono";
import type { Env } from "../types/env.js";
import { getEnv } from "../config/env.js";
import { createDb } from "../db/client.js";
import { createFiscalService } from "../services/fiscal.service.js";
import { R2StorageProvider } from "../storage/r2-storage-provider.js";
import { toApiError } from "../errors/app-error.js";
import { importXmlSchema, listFiscalDocumentsSchema } from "../schemas/fiscal.schemas.js";

const fiscal = new Hono<{ Bindings: Env }>();

fiscal.get("/", async (c) => {
  const query = Object.fromEntries(new URL(c.req.url).searchParams);
  const parsed = listFiscalDocumentsSchema.safeParse(query);
  if (!parsed.success)
    return c.json({ code: "VALIDATION_ERROR", issues: parsed.error.issues }, 400);
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createFiscalService(db);
    const data = await service.findMany(parsed.data);
    return c.json({ data });
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

fiscal.post("/xml/import", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = importXmlSchema.safeParse(body);
  if (!parsed.success)
    return c.json({ code: "VALIDATION_ERROR", issues: parsed.error.issues }, 400);
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const storage = config.r2 ? new R2StorageProvider(config.r2) : undefined;
    const service = createFiscalService(db, storage);
    const data = await service.importXml(parsed.data.xmlContent);
    return c.json({ data }, 201);
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

fiscal.get("/:id", async (c) => {
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createFiscalService(db);
    const data = await service.findById(c.req.param("id"));
    return c.json({ data });
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

export { fiscal };
