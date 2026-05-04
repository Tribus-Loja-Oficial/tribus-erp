"use server";

import { revalidatePath } from "next/cache";
import { erpApiFetch } from "@/lib/api/erp-api-client";

export async function archiveProductAction(id: string) {
  await erpApiFetch({ method: "DELETE", path: `/products/${id}` });
  revalidatePath("/products");
}

export async function restoreProductAction(id: string) {
  await erpApiFetch({ method: "POST", path: `/products/${id}/restore` });
  revalidatePath("/products");
}

export async function archiveProductsBulkAction(ids: string[]) {
  await erpApiFetch({
    method: "POST",
    path: "/products/bulk-archive",
    body: { ids },
  });
  revalidatePath("/products");
}

export async function restoreProductsBulkAction(ids: string[]) {
  await erpApiFetch({
    method: "POST",
    path: "/products/bulk-restore",
    body: { ids },
  });
  revalidatePath("/products");
}

export async function permanentDeleteProductAction(id: string, confirmSku: string) {
  await erpApiFetch({
    method: "POST",
    path: `/products/${id}/permanent-delete`,
    body: { confirmSku: confirmSku.trim() },
  });
  revalidatePath("/products");
}

/** Uma chamada à API por produto (cada uma exige confirmSku correcto). */
export async function permanentDeleteProductsBulkAction(
  items: { id: string; confirmSku: string }[],
) {
  for (const item of items) {
    await erpApiFetch({
      method: "POST",
      path: `/products/${item.id}/permanent-delete`,
      body: { confirmSku: item.confirmSku.trim() },
    });
  }
  revalidatePath("/products");
}
