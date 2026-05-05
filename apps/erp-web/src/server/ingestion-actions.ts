"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth/config";
import { erpApiFetch } from "@/lib/api/erp-api-client";

export type IngestionValidationIssue = {
  objectIndex?: number;
  objectType?: string;
  clientRef?: string;
  field?: string;
  message: string;
};

export type IngestionValidationResponse = {
  data: {
    valid: boolean;
    errors: IngestionValidationIssue[];
    warnings: IngestionValidationIssue[];
    summary: { total: number; byType: Record<string, number> };
  };
};

export type IngestionItemResult = {
  index: number;
  type: string;
  clientRef?: string;
  status: "created" | "updated" | "skipped" | "failed";
  id?: string;
  error?: string;
  warnings?: string[];
};

export type IngestionExecuteResponse = {
  data: {
    total: number;
    created: number;
    updated: number;
    skipped: number;
    failed: number;
    items: IngestionItemResult[];
    refMap: Record<string, string>;
  };
};

async function assertAdminIngestion() {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Sessão expirada. Inicie sessão novamente.");
  }
  const role = (session.user as { role?: string }).role;
  if (role !== "admin") {
    throw new Error("Apenas administradores podem usar a ingestão estruturada.");
  }
}

export async function validateIngestionAction(
  payload: unknown,
): Promise<IngestionValidationResponse> {
  await assertAdminIngestion();
  return erpApiFetch<IngestionValidationResponse>({
    method: "POST",
    path: "/internal/ingestion/validate",
    body: payload,
  });
}

export async function executeIngestionAction(payload: unknown): Promise<IngestionExecuteResponse> {
  await assertAdminIngestion();
  const res = await erpApiFetch<IngestionExecuteResponse>({
    method: "POST",
    path: "/internal/ingestion/execute",
    body: payload,
    additionalOkStatuses: [207, 422],
  });
  revalidatePath("/products");
  revalidatePath("/customers");
  revalidatePath("/suppliers");
  revalidatePath("/inventory");
  revalidatePath("/orders");
  revalidatePath("/purchases");
  return res;
}
