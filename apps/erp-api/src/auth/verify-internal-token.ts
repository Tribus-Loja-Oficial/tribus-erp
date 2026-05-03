import { UnauthorizedError } from "../errors/app-error.js";

export function verifyInternalToken(authHeader: string | undefined, secret: string): void {
  if (!authHeader?.startsWith("Bearer ")) throw new UnauthorizedError();
  const token = authHeader.slice(7);
  if (token !== secret) throw new UnauthorizedError("Invalid internal token");
}
