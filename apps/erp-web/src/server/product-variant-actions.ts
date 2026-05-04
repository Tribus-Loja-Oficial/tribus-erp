"use server";

import { revalidatePath } from "next/cache";
import { erpApiFetch } from "@/lib/api/erp-api-client";

export async function createProductVariantAction(productId: string, body: Record<string, unknown>) {
  await erpApiFetch({
    method: "POST",
    path: `/products/${productId}/variants`,
    body,
  });
  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);
}

export async function updateProductVariantAction(
  productId: string,
  variantId: string,
  body: Record<string, unknown>,
) {
  await erpApiFetch({
    method: "PATCH",
    path: `/products/${productId}/variants/${variantId}`,
    body,
  });
  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);
}

export async function archiveProductVariantAction(productId: string, variantId: string) {
  await erpApiFetch({
    method: "POST",
    path: `/products/${productId}/variants/${variantId}/archive`,
  });
  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);
}

export async function restoreProductVariantAction(productId: string, variantId: string) {
  await erpApiFetch({
    method: "POST",
    path: `/products/${productId}/variants/${variantId}/restore`,
  });
  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);
}
