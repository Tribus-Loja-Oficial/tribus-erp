import type { AppDb } from "../db/client.js";
import { generateId } from "../utils/id.js";
import { NotFoundError, BadRequestError } from "../errors/app-error.js";
import { createPurchaseRepository } from "../repositories/purchase.repository.js";
import { createInventoryService } from "./inventory.service.js";
import { createAuditRepository } from "../repositories/audit.repository.js";
import type {
  CreatePurchaseOrderInput,
  UpdatePurchaseStatusInput,
  ReceivePurchaseOrderInput,
  ListPurchaseOrdersParams,
} from "../schemas/purchase.schemas.js";

export function createPurchaseService(db: AppDb) {
  const purchaseRepo = createPurchaseRepository(db);
  const auditRepo = createAuditRepository(db);
  const now = () => new Date().toISOString();

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
  };
}
