import type { Session } from "next-auth";
import { auth } from "@/lib/auth/config";

export async function assertAdminApiSession(): Promise<Session> {
  const session = await auth();
  if (!session?.user) {
    throw Object.assign(new Error("Inicia sessão novamente."), { status: 401 as const });
  }
  const role = (session.user as { role?: string }).role;
  if (role !== "admin") {
    throw Object.assign(new Error("Apenas administradores podem usar esta operação."), {
      status: 403 as const,
    });
  }
  return session;
}
