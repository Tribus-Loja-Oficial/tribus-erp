import type { AppDb } from "../db/client.js";
import { generateId } from "../utils/id.js";
import { NotFoundError, BadRequestError } from "../errors/app-error.js";
import { createPurchaseRepository } from "../repositories/purchase.repository.js";
import { createInventoryService } from "./inventory.service.js";
import { createAuditRepository } from "../repositories/audit.repository.js";
import { createProductRepository } from "../repositories/product.repository.js";
import { createProductCostSnapshotService } from "./product-cost-snapshot.service.js";
import type {
  CreatePurchaseOrderInput,
  CreatePurchaseReceiptInput,
  UpdatePurchaseStatusInput,
  ReceivePurchaseOrderInput,
  ListPurchaseOrdersParams,
  ListPurchaseReceiptsParams,
} from "../schemas/purchase.schemas.js";
import { averageCostFromReceiptItemRows } from "../domain/product-average-cost.js";

export function createPurchaseService(db: AppDb) {
  const purchaseRepo = createPurchaseRepository(db);
  const auditRepo = createAuditRepository(db);
  const productsRepo = createProductRepository(db);
  const snapshotService = createProductCostSnapshotService(db);
  const now = () => new Date().toISOString();

  async function recalculateProductAverageCostFromReceipts(
    productId: string,
    opts?: { valuationReceiptId?: string; issueDate?: string },
  ) {
    const joinRows = await purchaseRepo.findReceiptItemsForProduct(productId, 200);
    const itemRows = joinRows.map(({ item, receipt }) => ({
      receiptId: receipt.id,
      receivedAt: receipt.receivedAt,
      totalCostCents: item.totalCostCents,
      stockQuantity: item.stockQuantity,
      stockUnit: item.stockUnit,
    }));

    const computed = averageCostFromReceiptItemRows(itemRows, 2);
    const currentProduct = await productsRepo.findById(productId);
    if (!currentProduct) return null;

    const latestRow = joinRows[0];
    const lastUnitCost = latestRow
      ? latestRow.item.unitCostDecimal
      : (currentProduct.lastPurchaseCostDecimal ?? null);

    const patch: Parameters<typeof productsRepo.update>[1] = {
      lastPurchaseCostDecimal: lastUnitCost,
      lastPurchaseDate:
        opts?.issueDate ?? latestRow?.receipt.issueDate ?? currentProduct.lastPurchaseDate,
      costUpdatedAt: now(),
    };

    if (computed) {
      patch.averageCostDecimal = computed.averageCostDecimal;
      patch.averageCostUnit = computed.averageCostUnit;
      patch.costSource = "purchase_average";
    }

    await productsRepo.update(productId, patch);

    if (opts?.valuationReceiptId && computed) {
      const averageCostBefore = currentProduct.averageCostDecimal ?? 0;
      await purchaseRepo.insertValuationEvent({
        id: generateId(),
        productId,
        sourceType: "purchase_receipt",
        sourceId: opts.valuationReceiptId,
        quantityBefore: currentProduct.currentStock,
        valueBeforeCents: Math.round(currentProduct.currentStock * averageCostBefore),
        quantityIn: 0,
        valueInCents: 0,
        quantityAfter: currentProduct.currentStock,
        valueAfterCents: Math.round(currentProduct.currentStock * computed.averageCostDecimal),
        averageCostBeforeDecimal: averageCostBefore,
        averageCostAfterDecimal: computed.averageCostDecimal,
        createdAt: now(),
      });
    }

    return computed;
  }

  return {
    async create(input: CreatePurchaseOrderInput, actorId?: string) {
      const itemsTotal = input.items.reduce(
        (sum, item) => sum + item.unitPriceCents * item.quantity,
        0,
      );
      const totalAmountCents =
        itemsTotal +
        (input.freightAmountCents ?? 0) +
        (input.taxAmountCents ?? 0) -
        (input.discountAmountCents ?? 0);

      const order = await purchaseRepo.insert({
        id: generateId(),
        supplierId: input.supplierId ?? null,
        status: "draft",
        issueDate: input.issueDate,
        expectedDate: input.expectedDate ?? null,
        totalAmountCents: Math.round(totalAmountCents),
        freightAmountCents: input.freightAmountCents ?? 0,
        discountAmountCents: input.discountAmountCents ?? 0,
        taxAmountCents: input.taxAmountCents ?? 0,
        notes: input.notes ?? null,
        createdAt: now(),
        updatedAt: now(),
        archivedAt: null,
      });

      for (const item of input.items) {
        await purchaseRepo.insertItem({
          id: generateId(),
          purchaseOrderId: order.id,
          productId: item.productId ?? null,
          description: item.description,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
          totalPriceCents: Math.round(item.unitPriceCents * item.quantity),
          receivedQuantity: 0,
          createdAt: now(),
        });
      }

      await auditRepo.insert({
        id: generateId(),
        actorId: actorId ?? null,
        actorType: "user",
        action: "purchase.order.created",
        entityType: "purchase_order",
        entityId: order.id,
        afterJson: JSON.stringify(order),
        createdAt: now(),
      });

      return order;
    },

    async findById(id: string) {
      const order = await purchaseRepo.findById(id);
      if (!order) throw new NotFoundError("Purchase order", id);
      const items = await purchaseRepo.findItemsByOrder(id);
      return { ...order, items };
    },

    async findMany(params: ListPurchaseOrdersParams & { page?: number }) {
      const { page = 1, limit = 20, ...rest } = params;
      return purchaseRepo.findMany({ ...rest, limit, offset: (page - 1) * limit });
    },

    async findReceipts(params: ListPurchaseReceiptsParams & { page?: number }) {
      const { page = 1, limit = 20, ...rest } = params;
      return purchaseRepo.findReceipts({ ...rest, limit, offset: (page - 1) * limit });
    },

    async findReceiptById(receiptId: string) {
      const receipt = await purchaseRepo.findReceiptById(receiptId);
      if (!receipt) throw new NotFoundError("Purchase receipt", receiptId);
      const items = await purchaseRepo.findReceiptItemsByReceiptId(receiptId);
      return { ...receipt, items };
    },

    async updateStatus(id: string, input: UpdatePurchaseStatusInput, actorId?: string) {
      const order = await purchaseRepo.findById(id);
      if (!order) throw new NotFoundError("Purchase order", id);
      if (order.status === "cancelled")
        throw new BadRequestError("Cannot update a cancelled purchase order");

      const updated = await purchaseRepo.update(id, { status: input.status });

      await auditRepo.insert({
        id: generateId(),
        actorId: actorId ?? null,
        actorType: "user",
        action: "purchase.order.status_updated",
        entityType: "purchase_order",
        entityId: id,
        beforeJson: JSON.stringify({ status: order.status }),
        afterJson: JSON.stringify({ status: input.status }),
        createdAt: now(),
      });

      return updated;
    },

    async receive(id: string, input: ReceivePurchaseOrderInput, actorId?: string) {
      const order = await purchaseRepo.findById(id);
      if (!order) throw new NotFoundError("Purchase order", id);
      if (order.status === "cancelled")
        throw new BadRequestError("Cannot receive a cancelled purchase order");
      if (order.status === "received")
        throw new BadRequestError("Purchase order is already fully received");

      const inventoryService = createInventoryService(db);
      const existingItems = await purchaseRepo.findItemsByOrder(id);

      for (const receipt of input.items) {
        const item = existingItems.find((i) => i.id === receipt.purchaseOrderItemId);
        if (!item) throw new NotFoundError("Purchase order item", receipt.purchaseOrderItemId);

        const newReceived = item.receivedQuantity + receipt.receivedQuantity;
        if (newReceived > item.quantity) {
          throw new BadRequestError(
            `Received quantity (${newReceived}) exceeds ordered quantity (${item.quantity}) for item ${item.description}`,
          );
        }

        await purchaseRepo.updateItem(item.id, { receivedQuantity: newReceived });

        if (item.productId) {
          await inventoryService.addMovement({
            productId: item.productId,
            locationId: input.locationId,
            type: "purchase",
            quantity: receipt.receivedQuantity,
            unitCostCents: item.unitPriceCents,
            referenceType: "purchase_order",
            referenceId: id,
            notes: input.notes,
          });
        }
      }

      const updatedItems = await purchaseRepo.findItemsByOrder(id);
      const allReceived = updatedItems.every((i) => i.receivedQuantity >= i.quantity);
      const anyReceived = updatedItems.some((i) => i.receivedQuantity > 0);

      const newStatus = allReceived
        ? "received"
        : anyReceived
          ? "partially_received"
          : order.status;

      const updated = await purchaseRepo.update(id, { status: newStatus });

      await auditRepo.insert({
        id: generateId(),
        actorId: actorId ?? null,
        actorType: "user",
        action: "purchase.order.received",
        entityType: "purchase_order",
        entityId: id,
        afterJson: JSON.stringify({ status: newStatus, locationId: input.locationId }),
        createdAt: now(),
      });

      return updated;
    },

    async createReceipt(input: CreatePurchaseReceiptInput, actorId?: string) {
      const inventoryService = createInventoryService(db);
      const receivedAt = input.receivedAt ?? now();
      const receipt = await purchaseRepo.insertReceipt({
        id: generateId(),
        externalRef: input.externalRef ?? null,
        purchaseOrderId: input.purchaseOrderId ?? null,
        supplierId: input.supplierId ?? null,
        issueDate: input.issueDate,
        receivedAt,
        documentNumber: input.documentNumber ?? null,
        documentType: input.documentType,
        sourceSystem: input.sourceSystem ?? null,
        notes: input.notes ?? null,
        metadataJson: JSON.stringify(input.metadata ?? {}),
        createdAt: now(),
        updatedAt: now(),
      });

      const impactedComponents = new Set<string>();
      for (const item of input.items) {
        const productId = item.productId ?? null;
        if (!productId) {
          throw new BadRequestError("purchase_receipt_item sem productId não é suportado na V1.");
        }
        impactedComponents.add(productId);
        await inventoryService.addMovement(
          {
            productId,
            locationId: input.locationId,
            type: "purchase",
            quantity: Math.max(1, Math.round(item.stockQuantity)),
            unitCostCents: item.totalCostCents
              ? Math.max(0, Math.round(item.totalCostCents / item.stockQuantity))
              : Math.max(
                  0,
                  Math.round(
                    (item.grossAmountCents -
                      item.discountAmountCents +
                      item.freightAmountCents +
                      item.taxAmountCents +
                      item.otherCostAmountCents) /
                      item.stockQuantity,
                  ),
                ),
            referenceType: "purchase_receipt",
            referenceId: receipt.id,
            notes: item.notes,
          },
          actorId,
        );

        const totalCostCents =
          item.totalCostCents ??
          item.grossAmountCents -
            item.discountAmountCents +
            item.freightAmountCents +
            item.taxAmountCents +
            item.otherCostAmountCents;
        const unitCostDecimal = totalCostCents / item.stockQuantity;

        await purchaseRepo.insertReceiptItem({
          id: generateId(),
          purchaseReceiptId: receipt.id,
          purchaseOrderItemId: item.purchaseOrderItemId ?? null,
          productId,
          description: item.description ?? null,
          purchasedQuantity: item.purchasedQuantity,
          purchaseUnit: item.purchaseUnit,
          conversionFactorToStockUnit: item.stockQuantity / item.purchasedQuantity,
          stockQuantity: item.stockQuantity,
          stockUnit: item.stockUnit,
          grossAmountCents: item.grossAmountCents,
          discountAmountCents: item.discountAmountCents,
          freightAmountCents: item.freightAmountCents,
          taxAmountCents: item.taxAmountCents,
          otherCostAmountCents: item.otherCostAmountCents,
          totalCostCents,
          unitCostDecimal,
          notes: item.notes ?? null,
          metadataJson: JSON.stringify(item.metadata ?? {}),
          createdAt: now(),
        });
      }

      for (const productId of impactedComponents) {
        await recalculateProductAverageCostFromReceipts(productId, {
          valuationReceiptId: receipt.id,
          issueDate: input.issueDate,
        });
      }

      for (const childProductId of impactedComponents) {
        await snapshotService.createForImpactedParentsByComponent(
          childProductId,
          "purchase_recalculation",
          {
            trigger: "purchase_receipt",
            receiptId: receipt.id,
            childProductId,
          },
        );
      }

      await auditRepo.insert({
        id: generateId(),
        actorId: actorId ?? null,
        actorType: "user",
        action: "purchase.receipt.created",
        entityType: "purchase_receipt",
        entityId: receipt.id,
        afterJson: JSON.stringify({ purchaseOrderId: input.purchaseOrderId ?? null }),
        createdAt: now(),
      });

      return receipt;
    },

    /** Recalcula averageCostDecimal de todos os produtos com histórico de recebimento (backfill / deploy). */
    async recalculateAllProductAverageCosts(): Promise<{ updated: number }> {
      const productIds = await purchaseRepo.findProductIdsWithReceiptItems();
      let updated = 0;
      for (const productId of productIds) {
        const result = await recalculateProductAverageCostFromReceipts(productId);
        if (result) updated += 1;
      }
      return { updated };
    },
  };
}
