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
  status: "created" | "failed";
  id?: string;
  error?: string;
  warnings?: string[];
};

export type IngestionExecuteResponse = {
  data: {
    total: number;
    created: number;
    failed: number;
    items: IngestionItemResult[];
    refMap: Record<string, string>;
  };
};

export async function validateIngestionAction(
  payload: unknown,
): Promise<IngestionValidationResponse> {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Sessão expirada. Inicie sessão novamente.");
  }
  return erpApiFetch<IngestionValidationResponse>({
    method: "POST",
    path: "/internal/ingestion/validate",
    body: payload,
  });
}

export async function executeIngestionAction(payload: unknown): Promise<IngestionExecuteResponse> {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Sessão expirada. Inicie sessão novamente.");
  }
  const res = await erpApiFetch<IngestionExecuteResponse>({
    method: "POST",
    path: "/internal/ingestion/execute",
    body: payload,
    additionalOkStatuses: [207, 422],
  });
  revalidatePath("/products");
  return res;
}
