import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./types/env.js";
import { generateRequestId } from "./observability/request-id.js";
import { logger } from "./observability/logger.js";
import { health } from "./routes/health.js";
import { parties } from "./routes/parties.js";
import { products } from "./routes/products.js";
import { inventory } from "./routes/inventory.js";
import { orders } from "./routes/orders.js";
import { pos } from "./routes/pos.js";
import { finance } from "./routes/finance.js";
import { fiscal } from "./routes/fiscal.js";
import { internal } from "./routes/internal.js";
import { customers } from "./routes/customers.js";
import { suppliers } from "./routes/suppliers.js";
import { purchases } from "./routes/purchases.js";
import { production } from "./routes/production.js";
import { reports } from "./routes/reports.js";

const app = new Hono<{ Bindings: Env }>();

app.use(
  "*",
  cors({
    origin: (origin) => origin ?? "*",
    allowHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
    allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  }),
);

app.use("*", async (c, next) => {
  const requestId = generateRequestId();
  c.res.headers.set("X-Request-Id", requestId);
  const start = Date.now();
  await next();
  logger.info("request", {
    requestId,
    method: c.req.method,
    path: new URL(c.req.url).pathname,
    status: c.res.status,
    durationMs: Date.now() - start,
  });
});

app.route("/health", health);
app.route("/parties", parties);
app.route("/customers", customers);
app.route("/suppliers", suppliers);
app.route("/products", products);
app.route("/inventory", inventory);
app.route("/orders", orders);
app.route("/pos", pos);
app.route("/finance", finance);
app.route("/fiscal", fiscal);
app.route("/purchases", purchases);
app.route("/production", production);
app.route("/reports", reports);
app.route("/internal", internal);

app.notFound((c) => c.json({ message: "Not found", code: "NOT_FOUND" }, 404));

app.onError((err, c) => {
  logger.error("unhandled error", { error: String(err) });
  return c.json({ message: "Internal server error", code: "INTERNAL_ERROR" }, 500);
});

export default app;
