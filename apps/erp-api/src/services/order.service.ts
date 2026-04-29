import type { AppDb } from "../db/client.js";
import { generateId } from "../utils/id.js";
import { NotFoundError } from "../errors/app-error.js";
import { createOrderRepository } from "../repositories/order.repository.js";
import { createCustomerRepository } from "../repositories/customer.repository.js";
import { createAuditRepository } from "../repositories/audit.repository.js";
import type { CreateOrderInput, IngestOrderInput } from "../schemas/order.schemas.js";

export function createOrderService(db: AppDb) {
  const ordersRepo = createOrderRepository(db);
  const customersRepo = createCustomerRepository(db);
  const auditRepo = createAuditRepository(db);
  const now = () => new Date().toISOString();

  async function calculateTotals(
    items: CreateOrderInput["items"],
    discountCents: number,
    shippingCents: number,
  ) {
    const subtotal = items.reduce((sum, item) => {
      return sum + item.unitPriceCents * item.quantity - item.discountCents;
    }, 0);
    return {
      subtotalCents: subtotal,
      discountTotalCents: discountCents,
      shippingTotalCents: shippingCents,
      taxTotalCents: 0,
      totalCents: subtotal - discountCents + shippingCents,
    };
  }

  return {
    async create(input: CreateOrderInput, actorId?: string) {
      const orderNumber = await ordersRepo.generateOrderNumber();
      const totals = await calculateTotals(
        input.items,
        input.discountTotalCents,
        input.shippingTotalCents,
      );

      const order = await ordersRepo.insert({
        id: generateId(),
        orderNumber,
        channel: input.channel,
        sourceSystem: "manual",
        sourceExternalId: null,
        customerId: input.customerId ?? null,
        status: "draft",
        paymentStatus: input.payments.length > 0 ? "paid" : "pending",
        fulfillmentStatus: "pending",
        ...totals,
        currency: "BRL",
        notes: input.notes ?? null,
        metadataJson: "{}",
        createdAt: now(),
        updatedAt: now(),
        deletedAt: null,
      });

      for (const item of input.items) {
        await ordersRepo.insertItem({
          id: generateId(),
          orderId: order.id,
          productId: item.productId ?? null,
          variantId: item.variantId ?? null,
          sku: item.sku,
          name: item.name,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
          discountCents: item.discountCents,
          totalCents: item.unitPriceCents * item.quantity - item.discountCents,
          createdAt: now(),
        });
      }

      for (const payment of input.payments) {
        await ordersRepo.insertPayment({
          id: generateId(),
          orderId: order.id,
          method: payment.method,
          amountCents: payment.amountCents,
          status: "confirmed",
          externalRef: null,
          paidAt: now(),
          createdAt: now(),
          updatedAt: now(),
        });
      }

      if (input.customerId) {
        await customersRepo.incrementOrderStats(input.customerId, totals.totalCents);
      }

      await auditRepo.insert({
        id: generateId(),
        actorId: actorId ?? null,
        actorType: "user",
        action: "order.created",
        entityType: "order",
        entityId: order.id,
        afterJson: JSON.stringify(order),
        createdAt: now(),
      });

      return order;
    },

    async ingest(input: IngestOrderInput): Promise<{ order: object; created: boolean }> {
      const existing = await ordersRepo.findBySourceExternal(
        input.sourceSystem,
        input.externalOrderId,
      );
      if (existing) {
        // Idempotente — atualiza status se necessário
        if (existing.status !== input.status) {
          const updated = await ordersRepo.update(existing.id, { status: input.status });
          return { order: updated, created: false };
        }
        return { order: existing, created: false };
      }

      const orderNumber = await ordersRepo.generateOrderNumber();
      const order = await ordersRepo.insert({
        id: generateId(),
        orderNumber,
        channel: input.channel,
        sourceSystem: input.sourceSystem,
        sourceExternalId: input.externalOrderId,
        customerId: null,
        status: input.status,
        paymentStatus: "pending",
        fulfillmentStatus: "pending",
        subtotalCents: input.totals.subtotalCents,
        discountTotalCents: input.totals.discountCents,
        shippingTotalCents: input.totals.shippingCents,
        taxTotalCents: 0,
        totalCents: input.totals.totalCents,
        currency: "BRL",
        notes: null,
        metadataJson: JSON.stringify({ ingestedAt: now() }),
        createdAt: now(),
        updatedAt: now(),
        deletedAt: null,
      });

      for (const item of input.items) {
        await ordersRepo.insertItem({
          id: generateId(),
          orderId: order.id,
          productId: item.productId ?? null,
          variantId: item.variantId ?? null,
          sku: item.sku,
          name: item.name,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
          discountCents: item.discountCents,
          totalCents: item.unitPriceCents * item.quantity - item.discountCents,
          createdAt: now(),
        });
      }

      await auditRepo.insertIntegrationEvent({
        id: generateId(),
        sourceSystem: input.sourceSystem,
        eventType: "order.ingested",
        externalId: input.externalOrderId,
        payloadJson: JSON.stringify(input),
        status: "processed",
        processedAt: now(),
        createdAt: now(),
        updatedAt: now(),
        errorMessage: null,
      });

      return { order, created: true };
    },

    async findById(id: string) {
      const order = await ordersRepo.findById(id);
      if (!order) throw new NotFoundError("Order", id);
      const items = await ordersRepo.findItemsByOrder(id);
      const payments = await ordersRepo.findPaymentsByOrder(id);
      return { ...order, items, payments };
    },

    async findMany(params: Parameters<typeof ordersRepo.findMany>[0] & { page?: number }) {
      const { page = 1, limit = 20, ...rest } = params;
      return ordersRepo.findMany({ ...rest, limit, offset: (page - 1) * limit });
    },

    async updateStatus(id: string, status: string, actorId?: string) {
      const existing = await ordersRepo.findById(id);
      if (!existing) throw new NotFoundError("Order", id);
      const updated = await ordersRepo.update(id, { status: status as typeof existing.status });
      await auditRepo.insert({
        id: generateId(),
        actorId: actorId ?? null,
        actorType: "user",
        action: `order.status.${status}`,
        entityType: "order",
        entityId: id,
        beforeJson: JSON.stringify({ status: existing.status }),
        afterJson: JSON.stringify({ status }),
        createdAt: now(),
      });
      return updated;
    },
  };
}
