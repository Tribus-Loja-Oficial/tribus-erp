import type { AppDb } from "../db/client.js";
import { generateId } from "../utils/id.js";
import { NotFoundError, BadRequestError } from "../errors/app-error.js";
import { createProductionRepository } from "../repositories/production.repository.js";
import { createProductRepository } from "../repositories/product.repository.js";
import { createInventoryService } from "./inventory.service.js";
import { createAuditRepository } from "../repositories/audit.repository.js";
import type {
  CreateBomInput,
  CreateProductionOrderInput,
  StartProductionOrderInput,
  CompleteProductionOrderInput,
  ListProductionOrdersParams,
} from "../schemas/production.schemas.js";

export function createProductionService(db: AppDb) {
  const productionRepo = createProductionRepository(db);
  const productsRepo = createProductRepository(db);
  const inventoryService = createInventoryService(db);
  const auditRepo = createAuditRepository(db);
  const now = () => new Date().toISOString();

  return {
    async createBom(input: CreateBomInput, actorId?: string) {
      const product = await productsRepo.findById(input.productId);
      if (!product) throw new NotFoundError("Product", input.productId);

      const bom = await productionRepo.insertBom({
        id: generateId(),
        productId: input.productId,
        version: input.version,
        status: "active",
        notes: input.notes ?? null,
        createdAt: now(),
        updatedAt: now(),
        archivedAt: null,
      });
      if (!bom) throw new Error("Failed to insert BOM");

      for (const item of input.items) {
        const component = await productsRepo.findById(item.componentProductId);
        if (!component) throw new NotFoundError("Component product", item.componentProductId);

        await productionRepo.insertBomItem({
          id: generateId(),
          bomId: bom.id,
          componentProductId: item.componentProductId,
          quantity: item.quantity,
          unit: item.unit,
          unitCostCents: item.unitCostCents,
          notes: item.notes ?? null,
          createdAt: now(),
        });
      }

      await auditRepo.insert({
        id: generateId(),
        actorId: actorId ?? null,
        actorType: "user",
        action: "production.bom.created",
        entityType: "bill_of_materials",
        entityId: bom.id,
        afterJson: JSON.stringify({ productId: input.productId, version: input.version }),
        createdAt: now(),
      });

      const items = await productionRepo.findBomItems(bom.id);
      return { ...bom, items };
    },

    async findBomsByProduct(productId: string) {
      const boms = await productionRepo.findBomByProduct(productId);
      return Promise.all(
        boms.map(async (bom) => ({
          ...bom,
          items: await productionRepo.findBomItems(bom.id),
        })),
      );
    },

    async createProductionOrder(input: CreateProductionOrderInput, actorId?: string) {
      const product = await productsRepo.findById(input.productId);
      if (!product) throw new NotFoundError("Product", input.productId);

      let bomId = input.bomId ?? null;
      if (!bomId) {
        const activeBom = await productionRepo.findActiveBomByProduct(input.productId);
        if (activeBom) bomId = activeBom.id;
      }

      const orderNumber = await productionRepo.generateOrderNumber();

      const order = await productionRepo.insertProductionOrder({
        id: generateId(),
        productId: input.productId,
        bomId,
        orderNumber,
        quantityPlanned: input.quantityPlanned,
        quantityProduced: 0,
        status: "planned",
        startedAt: null,
        completedAt: null,
        notes: input.notes ?? null,
        createdBy: actorId ?? null,
        createdAt: now(),
        updatedAt: now(),
        archivedAt: null,
      });
      if (!order) throw new Error("Failed to insert production order");

      // Pre-populate consumptions from BOM if available
      if (bomId) {
        const bomItems = await productionRepo.findBomItems(bomId);
        for (const item of bomItems) {
          await productionRepo.insertConsumption({
            id: generateId(),
            productionOrderId: order.id,
            productId: item.componentProductId,
            quantityPlanned: item.quantity * input.quantityPlanned,
            quantityConsumed: 0,
            unitCostCents: item.unitCostCents,
            createdAt: now(),
          });
        }
      }

      await auditRepo.insert({
        id: generateId(),
        actorId: actorId ?? null,
        actorType: "user",
        action: "production.order.created",
        entityType: "production_order",
        entityId: order.id,
        afterJson: JSON.stringify(order),
        createdAt: now(),
      });

      return order;
    },

    async startProductionOrder(id: string, input: StartProductionOrderInput, actorId?: string) {
      const order = await productionRepo.findProductionOrderById(id);
      if (!order) throw new NotFoundError("Production order", id);
      if (order.status !== "planned")
        throw new BadRequestError("Order must be in 'planned' state to start");

      const updated = await productionRepo.updateProductionOrder(id, {
        status: "in_progress",
        startedAt: input.startedAt ?? now(),
        updatedAt: now(),
      });

      await auditRepo.insert({
        id: generateId(),
        actorId: actorId ?? null,
        actorType: "user",
        action: "production.order.started",
        entityType: "production_order",
        entityId: id,
        afterJson: JSON.stringify({ status: "in_progress" }),
        createdAt: now(),
      });

      return updated;
    },

    async completeProductionOrder(
      id: string,
      input: CompleteProductionOrderInput,
      actorId?: string,
    ) {
      const order = await productionRepo.findProductionOrderById(id);
      if (!order) throw new NotFoundError("Production order", id);
      if (order.status !== "in_progress")
        throw new BadRequestError("Order must be in 'in_progress' state to complete");

      const consumptions = await productionRepo.findConsumptionsByOrder(id);

      // Consume raw materials from stock
      for (const consumption of consumptions) {
        const component = await productsRepo.findById(consumption.productId);
        if (!component) continue;

        const ratio = input.quantityProduced / order.quantityPlanned;
        const qtyToConsume = Math.ceil(consumption.quantityPlanned * ratio);

        await inventoryService.addMovement({
          productId: consumption.productId,
          locationId: input.locationId,
          type: "production_out",
          quantity: qtyToConsume,
          unitCostCents: consumption.unitCostCents,
          referenceType: "production_order",
          referenceId: id,
          notes: `Consumo OP ${order.orderNumber}`,
          createdBy: actorId,
        });

        await productionRepo.updateProductionOrder(id, { updatedAt: now() });
      }

      // Add produced product to stock
      await inventoryService.addMovement({
        productId: order.productId,
        locationId: input.locationId,
        type: "production_in",
        quantity: input.quantityProduced,
        referenceType: "production_order",
        referenceId: id,
        notes: `Entrada OP ${order.orderNumber}`,
        createdBy: actorId,
      });

      // Register losses
      if (input.losses) {
        for (const loss of input.losses) {
          await productionRepo.insertLoss({
            id: generateId(),
            productionOrderId: id,
            productId: loss.productId,
            quantity: loss.quantity,
            reason: loss.reason ?? null,
            createdAt: now(),
          });
        }
      }

      const updated = await productionRepo.updateProductionOrder(id, {
        status: "completed",
        quantityProduced: input.quantityProduced,
        completedAt: now(),
        notes: input.notes ?? order.notes,
        updatedAt: now(),
      });

      await auditRepo.insert({
        id: generateId(),
        actorId: actorId ?? null,
        actorType: "user",
        action: "production.order.completed",
        entityType: "production_order",
        entityId: id,
        afterJson: JSON.stringify({ quantityProduced: input.quantityProduced }),
        createdAt: now(),
      });

      return updated;
    },

    async cancelProductionOrder(id: string, actorId?: string) {
      const order = await productionRepo.findProductionOrderById(id);
      if (!order) throw new NotFoundError("Production order", id);
      if (order.status === "completed" || order.status === "cancelled") {
        throw new BadRequestError(`Cannot cancel an order with status '${order.status}'`);
      }

      const updated = await productionRepo.updateProductionOrder(id, {
        status: "cancelled",
        updatedAt: now(),
      });

      await auditRepo.insert({
        id: generateId(),
        actorId: actorId ?? null,
        actorType: "user",
        action: "production.order.cancelled",
        entityType: "production_order",
        entityId: id,
        createdAt: now(),
      });

      return updated;
    },

    async findById(id: string) {
      const order = await productionRepo.findProductionOrderById(id);
      if (!order) throw new NotFoundError("Production order", id);
      const [consumptions, losses] = await Promise.all([
        productionRepo.findConsumptionsByOrder(id),
        productionRepo.findLossesByOrder(id),
      ]);
      return { ...order, consumptions, losses };
    },

    async findMany(params: ListProductionOrdersParams) {
      const { page = 1, limit = 20, status } = params;
      return productionRepo.findProductionOrders({ status, limit, offset: (page - 1) * limit });
    },
  };
}
