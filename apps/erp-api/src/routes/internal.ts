import { Hono } from "hono";
import type { Env } from "../types/env.js";
import { getEnv } from "../config/env.js";
import { createDb } from "../db/client.js";
import { createOrderService } from "../services/order.service.js";
import { createFiscalService } from "../services/fiscal.service.js";
import { R2StorageProvider } from "../storage/r2-storage-provider.js";
import { toApiError, UnauthorizedError } from "../errors/app-error.js";
import { ingestOrderSchema } from "../schemas/order.schemas.js";
import { importXmlSchema } from "../schemas/fiscal.schemas.js";

const internal = new Hono<{ Bindings: Env }>();

function verifyInternalToken(authHeader: string | undefined, secret: string): void {
  if (!authHeader?.startsWith("Bearer ")) throw new UnauthorizedError();
  const token = authHeader.slice(7);
  if (token !== secret) throw new UnauthorizedError("Invalid internal token");
}

internal.post("/orders/ingest", async (c) => {
  try {
    const config = getEnv(c.env);
    verifyInternalToken(c.req.header("Authorization"), config.erpInternalSecret);

    const body = await c.req.json().catch(() => null);
    const parsed = ingestOrderSchema.safeParse(body);
    if (!parsed.success)
      return c.json({ code: "VALIDATION_ERROR", issues: parsed.error.issues }, 400);

    const db = createDb(config.db);
    const service = createOrderService(db);
    const { order, created } = await service.ingest(parsed.data);

    return c.json({ data: order, created }, created ? 201 : 200);
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

internal.post("/fiscal/xml/import", async (c) => {
  try {
    const config = getEnv(c.env);
    verifyInternalToken(c.req.header("Authorization"), config.erpInternalSecret);

    const body = await c.req.json().catch(() => null);
    const parsed = importXmlSchema.safeParse(body);
    if (!parsed.success)
      return c.json({ code: "VALIDATION_ERROR", issues: parsed.error.issues }, 400);

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

export { internal };
