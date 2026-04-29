import { Hono } from "hono";
import type { Env } from "../types/env.js";

const health = new Hono<{ Bindings: Env }>();

health.get("/", (c) => {
  return c.json({
    status: "ok",
    service: "tribus-erp-api",
    timestamp: new Date().toISOString(),
  });
});

export { health };
