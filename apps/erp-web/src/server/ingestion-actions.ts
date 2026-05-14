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

/** Resumo de `product_composition_set` nas respostas de dry-run / execução. */
export type IngestionCompositionSetSummary = {
  parentProductId: string;
  parentSku?: string;
  parentSlug?: string;
  removedCount: number;
  createdCount: number;
  itemErrors?: Array<{ index: number; message: string }>;
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
  compositionSet?: IngestionCompositionSetSummary;
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

export type IngestionDryRunItem = {
  index: number;
  type: string;
  clientRef?: string;
  plannedStatus: "created" | "updated" | "skipped" | "failed";
  detail?: string;
  compositionSet?: IngestionCompositionSetSummary;
};

export type IngestionDryRunResponse = {
  data: {
    dryRun: true;
    valid: boolean;
    errors: Array<{ message: string }>;
    warnings: IngestionValidationIssue[];
    summary: { total: number; byType: Record<string, number> };
    planned: {
      created: number;
      updated: number;
      skipped: number;
      failed: number;
    };
    items: IngestionDryRunItem[];
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

/** Simula gravação (sem alterar a base): `{ dryRun: true, payload }`. */
export async function dryRunIngestionAction(payload: unknown): Promise<IngestionDryRunResponse> {
  await assertAdminIngestion();
  return erpApiFetch<IngestionDryRunResponse>({
    method: "POST",
    path: "/internal/ingestion/dry-run",
    body: payload,
  });
}

/** Chamado no cliente quando um job assíncrono termina para refrescar listagens. */
export async function revalidateAfterIngestionAction(): Promise<void> {
  await assertAdminIngestion();
  revalidatePath("/products");
  revalidatePath("/customers");
  revalidatePath("/suppliers");
  revalidatePath("/inventory");
  revalidatePath("/orders");
  revalidatePath("/purchases");
}
