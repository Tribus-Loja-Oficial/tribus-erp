"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { erpApiFetch } from "@/lib/api/erp-api-client";
import { auth } from "@/lib/auth/config";

function moneyToCents(raw: FormDataEntryValue | null): number {
  const s = String(raw ?? "")
    .trim()
    .replace(",", ".");
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) throw new Error("Valor monetário inválido");
  return Math.round(n * 100);
}

function optionalId(raw: FormDataEntryValue | null): string | undefined {
  const v = String(raw ?? "").trim();
  return v.length ? v : undefined;
}

export async function createCustomerAction(formData: FormData) {
  const legalName = String(formData.get("legalName") ?? "").trim();
  if (!legalName) redirect("/customers/new?error=" + encodeURIComponent("Nome é obrigatório"));
  try {
    await erpApiFetch({
      method: "POST",
      path: "/customers",
      body: {
        type: String(formData.get("type") ?? "individual"),
        legalName,
        tradeName: optionalId(formData.get("tradeName")),
        documentType: String(formData.get("documentType") ?? "unknown"),
        documentNumber: optionalId(formData.get("documentNumber")),
        email: optionalId(formData.get("email")),
        phone: optionalId(formData.get("phone")),
        cdsConsumerId: optionalId(formData.get("cdsConsumerId")),
        origin: String(formData.get("origin") ?? "manual"),
      },
    });
    revalidatePath("/customers");
  } catch (e) {
    redirect(
      "/customers/new?error=" +
        encodeURIComponent(e instanceof Error ? e.message : "Erro ao criar"),
    );
  }
  redirect("/customers");
}

export async function createSupplierAction(formData: FormData) {
  const legalName = String(formData.get("legalName") ?? "").trim();
  if (!legalName) redirect("/suppliers/new?error=" + encodeURIComponent("Nome é obrigatório"));
  try {
    await erpApiFetch({
      method: "POST",
      path: "/suppliers",
      body: {
        type: String(formData.get("type") ?? "company"),
        legalName,
        tradeName: optionalId(formData.get("tradeName")),
        documentType: String(formData.get("documentType") ?? "cnpj"),
        documentNumber: optionalId(formData.get("documentNumber")),
        email: optionalId(formData.get("email")),
        phone: optionalId(formData.get("phone")),
        stateRegistration: optionalId(formData.get("stateRegistration")),
        contactName: optionalId(formData.get("contactName")),
      },
    });
    revalidatePath("/suppliers");
  } catch (e) {
    redirect(
      "/suppliers/new?error=" +
        encodeURIComponent(e instanceof Error ? e.message : "Erro ao criar"),
    );
  }
  redirect("/suppliers");
}

export async function createStockMovementAction(formData: FormData) {
  const productId = String(formData.get("productId") ?? "").trim();
  const locationId = String(formData.get("locationId") ?? "").trim();
  const type = String(formData.get("type") ?? "adjustment");
  const quantity = Number(formData.get("quantity") ?? "0");
  if (!productId || !locationId || quantity < 1)
    redirect("/inventory?error=" + encodeURIComponent("Preencha produto, local e quantidade"));
  try {
    await erpApiFetch({
      method: "POST",
      path: "/inventory/movements",
      body: {
        productId,
        locationId,
        type,
        quantity,
        unitCostCents: optionalId(formData.get("unitCost"))
          ? moneyToCents(formData.get("unitCost"))
          : undefined,
        notes: optionalId(formData.get("notes")),
      },
    });
    revalidatePath("/inventory");
  } catch (e) {
    redirect("/inventory?error=" + encodeURIComponent(e instanceof Error ? e.message : "Erro"));
  }
  redirect("/inventory");
}

export async function createOrderAction(formData: FormData) {
  const sku = String(formData.get("sku") ?? "").trim();
  const name = String(formData.get("itemName") ?? "").trim();
  const quantity = Number(formData.get("quantity") ?? "1");
  const unitPriceCents = moneyToCents(formData.get("unitPrice"));
  if (!sku || !name || quantity < 1)
    redirect("/orders/new?error=" + encodeURIComponent("Itens incompletos"));
  try {
    await erpApiFetch({
      method: "POST",
      path: "/orders",
      body: {
        channel: "manual",
        customerId: optionalId(formData.get("customerId")),
        items: [{ sku, name, quantity, unitPriceCents, discountCents: 0 }],
        payments: [],
        discountTotalCents: 0,
        shippingTotalCents: 0,
      },
    });
    revalidatePath("/orders");
  } catch (e) {
    redirect("/orders/new?error=" + encodeURIComponent(e instanceof Error ? e.message : "Erro"));
  }
  redirect("/orders");
}

export async function createFinancialEntryAction(formData: FormData) {
  try {
    await erpApiFetch({
      method: "POST",
      path: "/finance/entries",
      body: {
        type: String(formData.get("type") ?? "expense"),
        financialAccountId: String(formData.get("financialAccountId") ?? "").trim(),
        amountCents: moneyToCents(formData.get("amount")),
        date: String(formData.get("date") ?? "").trim(),
        description: String(formData.get("description") ?? "").trim(),
        categoryId: optionalId(formData.get("categoryId")),
        costCenterId: optionalId(formData.get("costCenterId")),
      },
    });
    revalidatePath("/finance");
  } catch (e) {
    redirect("/finance?error=" + encodeURIComponent(e instanceof Error ? e.message : "Erro"));
  }
  redirect("/finance");
}

export async function createPayableAction(formData: FormData) {
  try {
    await erpApiFetch({
      method: "POST",
      path: "/finance/payables",
      body: {
        supplierId: optionalId(formData.get("supplierId")),
        description: String(formData.get("description") ?? "").trim(),
        dueDate: String(formData.get("dueDate") ?? "").trim(),
        amountCents: moneyToCents(formData.get("amount")),
      },
    });
    revalidatePath("/finance/payables");
  } catch (e) {
    redirect(
      "/finance/payables?error=" + encodeURIComponent(e instanceof Error ? e.message : "Erro"),
    );
  }
  redirect("/finance/payables");
}

export async function createReceivableAction(formData: FormData) {
  try {
    await erpApiFetch({
      method: "POST",
      path: "/finance/receivables",
      body: {
        customerId: optionalId(formData.get("customerId")),
        description: String(formData.get("description") ?? "").trim(),
        dueDate: String(formData.get("dueDate") ?? "").trim(),
        amountCents: moneyToCents(formData.get("amount")),
      },
    });
    revalidatePath("/finance/receivables");
  } catch (e) {
    redirect(
      "/finance/receivables?error=" + encodeURIComponent(e instanceof Error ? e.message : "Erro"),
    );
  }
  redirect("/finance/receivables");
}

export async function createFinancialAccountAction(formData: FormData) {
  try {
    await erpApiFetch({
      method: "POST",
      path: "/finance/accounts",
      body: {
        name: String(formData.get("name") ?? "").trim(),
        type: String(formData.get("type") ?? "cash"),
        institution: optionalId(formData.get("institution")),
        openingBalanceCents: moneyToCents(formData.get("openingBalance") ?? "0"),
      },
    });
    revalidatePath("/finance/cash");
  } catch (e) {
    redirect("/finance/cash?error=" + encodeURIComponent(e instanceof Error ? e.message : "Erro"));
  }
  redirect("/finance/cash");
}

export async function importXmlAction(formData: FormData) {
  const xmlContent = String(formData.get("xmlContent") ?? "").trim();
  if (!xmlContent) redirect("/fiscal/xml-import?error=" + encodeURIComponent("Cole o XML"));
  try {
    await erpApiFetch({
      method: "POST",
      path: "/fiscal/xml/import",
      body: { xmlContent },
    });
    revalidatePath("/fiscal/xml-import");
  } catch (e) {
    redirect(
      "/fiscal/xml-import?error=" +
        encodeURIComponent(e instanceof Error ? e.message : "Erro na importação"),
    );
  }
  redirect("/fiscal/xml-import");
}

export async function openCashSessionAction(formData: FormData) {
  const session = await auth();
  const openedBy = session?.user?.email ?? session?.user?.name ?? "operador";
  try {
    await erpApiFetch({
      method: "POST",
      path: "/pos/sessions",
      body: {
        cashRegisterId: String(formData.get("cashRegisterId") ?? "").trim(),
        openedBy,
        openingAmountCents: moneyToCents(formData.get("openingAmount") ?? "0"),
      },
    });
    revalidatePath("/sales/pos");
    revalidatePath("/finance/cash");
  } catch (e) {
    redirect("/sales/pos?error=" + encodeURIComponent(e instanceof Error ? e.message : "Erro"));
  }
  redirect("/sales/pos");
}

export async function createPosSaleAction(formData: FormData) {
  const cashSessionId = String(formData.get("cashSessionId") ?? "").trim();
  const sku = String(formData.get("sku") ?? "").trim();
  const name = String(formData.get("itemName") ?? "").trim();
  const quantity = Number(formData.get("quantity") ?? "1");
  const unitPriceCents = moneyToCents(formData.get("unitPrice"));
  const payCents = moneyToCents(formData.get("paymentAmount"));
  const method = String(formData.get("paymentMethod") ?? "cash");
  if (!cashSessionId || !sku || !name || quantity < 1 || payCents < 1) {
    redirect("/sales/pos?error=" + encodeURIComponent("Preencha sessão, item e pagamento"));
  }
  try {
    await erpApiFetch({
      method: "POST",
      path: "/pos/sales",
      body: {
        cashSessionId,
        customerId: optionalId(formData.get("customerId")),
        items: [
          {
            sku,
            name,
            quantity,
            unitPriceCents,
            discountCents: 0,
            productId: optionalId(formData.get("productId")),
          },
        ],
        payments: [{ method, amountCents: payCents }],
        discountCents: 0,
      },
    });
    revalidatePath("/sales/pos");
    revalidatePath("/orders");
  } catch (e) {
    redirect(
      "/sales/pos?error=" + encodeURIComponent(e instanceof Error ? e.message : "Erro na venda"),
    );
  }
  redirect("/sales/pos");
}

export async function updateOrderStatusAction(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  if (!id || !status) redirect("/orders?error=" + encodeURIComponent("Dados inválidos"));
  try {
    await erpApiFetch({
      method: "PATCH",
      path: `/orders/${id}/status`,
      body: { status },
    });
    revalidatePath("/orders");
    revalidatePath(`/orders/${id}`);
  } catch (e) {
    redirect(
      `/orders/${id}?error=` +
        encodeURIComponent(e instanceof Error ? e.message : "Erro ao atualizar"),
    );
  }
  redirect(`/orders/${id}`);
}

export async function createPurchaseOrderAction(formData: FormData) {
  const issueDate = String(formData.get("issueDate") ?? "").trim();
  const itemDescription = String(formData.get("itemDescription") ?? "").trim();
  const itemQty = Number(formData.get("itemQty") ?? "1");
  const itemPrice = moneyToCents(formData.get("itemPrice"));
  if (!issueDate || !itemDescription || itemQty <= 0)
    redirect("/purchases/new?error=" + encodeURIComponent("Preencha data, descrição e quantidade"));
  try {
    const result = await erpApiFetch<{ data: { id: string } }>({
      method: "POST",
      path: "/purchases",
      body: {
        supplierId: optionalId(formData.get("supplierId")),
        issueDate,
        expectedDate: optionalId(formData.get("expectedDate")),
        freightAmountCents: formData.get("freight") ? moneyToCents(formData.get("freight")) : 0,
        notes: optionalId(formData.get("notes")),
        items: [
          {
            productId: optionalId(formData.get("productId")),
            description: itemDescription,
            quantity: itemQty,
            unitPriceCents: itemPrice,
          },
        ],
      },
    });
    revalidatePath("/purchases");
    redirect(`/purchases/${result.data.id}`);
  } catch (e) {
    redirect(
      "/purchases/new?error=" +
        encodeURIComponent(e instanceof Error ? e.message : "Erro ao criar"),
    );
  }
}

export async function updatePurchaseStatusAction(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  if (!id || !status) redirect("/purchases?error=" + encodeURIComponent("Dados inválidos"));
  try {
    await erpApiFetch({
      method: "PATCH",
      path: `/purchases/${id}/status`,
      body: { status },
    });
    revalidatePath("/purchases");
    revalidatePath(`/purchases/${id}`);
  } catch (e) {
    redirect(
      `/purchases/${id}?error=` + encodeURIComponent(e instanceof Error ? e.message : "Erro"),
    );
  }
  redirect(`/purchases/${id}`);
}

export async function receivePurchaseOrderAction(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const locationId = String(formData.get("locationId") ?? "").trim();
  if (!id || !locationId)
    redirect(`/purchases/${id}?error=` + encodeURIComponent("Selecione o local de estoque"));

  const items: { purchaseOrderItemId: string; receivedQuantity: number }[] = [];
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("item_qty_")) {
      const itemId = key.replace("item_qty_", "");
      const qty = Number(value);
      if (qty > 0) items.push({ purchaseOrderItemId: itemId, receivedQuantity: qty });
    }
  }

  if (items.length === 0)
    redirect(
      `/purchases/${id}?error=` +
        encodeURIComponent("Informe quantidade recebida para ao menos um item"),
    );

  try {
    await erpApiFetch({
      method: "POST",
      path: `/purchases/${id}/receive`,
      body: { locationId, items },
    });
    revalidatePath("/purchases");
    revalidatePath(`/purchases/${id}`);
    revalidatePath("/inventory");
  } catch (e) {
    redirect(
      `/purchases/${id}?error=` +
        encodeURIComponent(e instanceof Error ? e.message : "Erro ao receber"),
    );
  }
  redirect(`/purchases/${id}`);
}

export async function payPayableAction(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const financialAccountId = String(formData.get("financialAccountId") ?? "").trim();
  const amount = moneyToCents(formData.get("amount"));
  const paymentMethod = String(formData.get("paymentMethod") ?? "cash").trim();
  if (!id || !financialAccountId || amount <= 0)
    redirect("/finance/payables?error=" + encodeURIComponent("Preencha todos os campos"));
  try {
    await erpApiFetch({
      method: "POST",
      path: `/finance/payables/${id}/pay`,
      body: { amountCents: amount, financialAccountId, paymentMethod },
    });
    revalidatePath("/finance/payables");
    revalidatePath("/finance");
  } catch (e) {
    redirect(
      "/finance/payables?error=" +
        encodeURIComponent(e instanceof Error ? e.message : "Erro ao pagar"),
    );
  }
  redirect("/finance/payables");
}

export async function receiveReceivableAction(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const financialAccountId = String(formData.get("financialAccountId") ?? "").trim();
  const amount = moneyToCents(formData.get("amount"));
  const paymentMethod = String(formData.get("paymentMethod") ?? "pix").trim();
  if (!id || !financialAccountId || amount <= 0)
    redirect("/finance/receivables?error=" + encodeURIComponent("Preencha todos os campos"));
  try {
    await erpApiFetch({
      method: "POST",
      path: `/finance/receivables/${id}/receive`,
      body: { amountCents: amount, financialAccountId, paymentMethod },
    });
    revalidatePath("/finance/receivables");
    revalidatePath("/finance");
  } catch (e) {
    redirect(
      "/finance/receivables?error=" +
        encodeURIComponent(e instanceof Error ? e.message : "Erro ao receber"),
    );
  }
  redirect("/finance/receivables");
}

export async function closeCashSessionAction(formData: FormData) {
  const id = String(formData.get("sessionId") ?? "").trim();
  const closingAmount = moneyToCents(formData.get("closingAmount") ?? "0");
  const session = await auth();
  const closedBy = session?.user?.email ?? session?.user?.name ?? "operador";
  if (!id) redirect("/finance/cash?error=" + encodeURIComponent("Sessão inválida"));
  try {
    await erpApiFetch({
      method: "POST",
      path: `/pos/sessions/${id}/close`,
      body: { closedBy, closingAmountCents: closingAmount },
    });
    revalidatePath("/sales/pos");
    revalidatePath("/finance/cash");
  } catch (e) {
    redirect(
      "/finance/cash?error=" +
        encodeURIComponent(e instanceof Error ? e.message : "Erro ao fechar caixa"),
    );
  }
  redirect("/finance/cash");
}

export async function createCashRegisterAction(formData: FormData) {
  try {
    await erpApiFetch({
      method: "POST",
      path: "/pos/registers",
      body: {
        name: String(formData.get("name") ?? "").trim(),
        location: optionalId(formData.get("location")),
      },
    });
    revalidatePath("/sales/pos");
    revalidatePath("/finance/cash");
  } catch (e) {
    redirect("/finance/cash?error=" + encodeURIComponent(e instanceof Error ? e.message : "Erro"));
  }
  redirect("/finance/cash");
}
