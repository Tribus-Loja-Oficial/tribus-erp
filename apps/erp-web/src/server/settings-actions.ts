"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth/config";
import { erpApiFetch } from "@/lib/api/erp-api-client";

async function assertAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Sessão expirada. Inicie sessão novamente.");
  const role = (session.user as { role?: string }).role;
  if (role !== "admin") throw new Error("Apenas administradores podem executar esta acção.");
}

export async function resetAllDataAction(): Promise<{ ok: boolean }> {
  await assertAdmin();
  const res = await erpApiFetch<{ data: { ok: boolean } }>({
    method: "POST",
    path: "/internal/data/reset",
  });
  revalidatePath("/products");
  revalidatePath("/customers");
  revalidatePath("/suppliers");
  revalidatePath("/inventory");
  revalidatePath("/orders");
  revalidatePath("/purchases");
  return res.data;
}
