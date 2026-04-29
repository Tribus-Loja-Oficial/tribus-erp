import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema/index.js";

export type AppDb = ReturnType<typeof createDb>;

export function createDb(binding: D1Database) {
  return drizzle(binding, { schema });
}
