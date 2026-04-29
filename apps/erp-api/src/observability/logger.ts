type LogLevel = "debug" | "info" | "warn" | "error";
type LogContext = Record<string, unknown>;

const SENSITIVE_KEYS = ["password", "token", "secret", "authorization", "key", "hash"];

function maskValue(value: unknown): unknown {
  if (typeof value !== "string") return "[REDACTED]";
  if (value.length <= 4) return "***";
  return `${value.slice(0, 2)}***${value.slice(-2)}`;
}

function sanitize(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => {
      if (SENSITIVE_KEYS.some((s) => k.toLowerCase().includes(s))) {
        return [k, maskValue(v)];
      }
      if (v !== null && typeof v === "object" && !Array.isArray(v)) {
        return [k, sanitize(v as Record<string, unknown>)];
      }
      return [k, v];
    }),
  );
}

function log(level: LogLevel, message: string, context?: LogContext): void {
  const entry = JSON.stringify({
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(context ? { context: sanitize(context) } : {}),
  });
  if (level === "warn" || level === "error") {
    console.error(entry);
  } else {
    console.log(entry);
  }
}

export const logger = {
  debug: (message: string, context?: LogContext) => log("debug", message, context),
  info: (message: string, context?: LogContext) => log("info", message, context),
  warn: (message: string, context?: LogContext) => log("warn", message, context),
  error: (message: string, context?: LogContext) => log("error", message, context),
};
