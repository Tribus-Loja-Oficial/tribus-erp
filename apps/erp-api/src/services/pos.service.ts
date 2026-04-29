import type { AppDb } from "../db/client.js";
import { generateId } from "../utils/id.js";
import { NotFoundError, BadRequestError, ConflictError } from "../errors/app-error.js";
import { createPosRepository } from "../repositories/pos.repository.js";
import { createOrderService } from "./order.service.js";
import { createInventoryService } from "./inventory.service.js";
import { createAuditRepository } from "../repositories/audit.repository.js";
import type {
  OpenCashSessionInput,
  CloseCashSessionInput,
  CreatePosSaleInput,
  AddCashMovementInput,
  CreateCashRegisterInput,
} from "../schemas/pos.schemas.js";

export function createPosService(db: AppDb) {
  const posRepo = createPosRepository(db);
  const orderService = createOrderService(db);
  const inventoryService = createInventoryService(db);
  const auditRepo = createAuditRepository(db);
  const now = () => new Date().toISOString();

  return {
    async openSession(input: OpenCashSessionInput) {
      const register = await posRepo.findRegisterById(input.cashRegisterId);
      if (!register) throw new NotFoundError("Cash register", input.cashRegisterId);

      const existingOpen = await posRepo.findOpenSession(input.cashRegisterId);
      if (existingOpen) throw new ConflictError("Cash register already has an open session");

      const session = await posRepo.insertSession({
        id: generateId(),
        cashRegisterId: input.cashRegisterId,
        openedBy: input.openedBy,
        openedAt: now(),
        openingAmountCents: input.openingAmountCents,
        closedBy: null,
        closedAt: null,
        closingAmountCents: null,
        expectedAmountCents: null,
        differenceAmountCents: null,
        status: "open",
        notes: input.notes ?? null,
        createdAt: now(),
        updatedAt: now(),
      });

      await posRepo.insertMovement({
        id: generateId(),
        cashSessionId: session.id,
        type: "cash_in",
        paymentMethod: "cash",
        amountCents: input.openingAmountCents,
        referenceType: "session_open",
        referenceId: session.id,
        notes: "Abertura de caixa",
        createdAt: now(),
      });

      return session;
    },

    async closeSession(sessionId: string, input: CloseCashSessionInput) {
      const session = await posRepo.findSessionById(sessionId);
      if (!session) throw new NotFoundError("Cash session", sessionId);
      if (session.status !== "open") throw new BadRequestError("Session is not open");

      const expectedAmountCents = await posRepo.sumMovementsBySession(sessionId);
      const differenceAmountCents = input.closingAmountCents - expectedAmountCents;

      const updated = await posRepo.updateSession(sessionId, {
        closedBy: input.closedBy,
        closedAt: now(),
        closingAmountCents: input.closingAmountCents,
        expectedAmountCents,
        differenceAmountCents,
        status: "closed",
        notes: input.notes ?? session.notes,
      });

      await auditRepo.insert({
        id: generateId(),
        actorId: input.closedBy,
        actorType: "user",
        action: "pos.session.closed",
        entityType: "cash_session",
        entityId: sessionId,
        afterJson: JSON.stringify(updated),
        createdAt: now(),
      });

      return updated;
    },

    async createSale(input: CreatePosSaleInput) {
      const session = await posRepo.findSessionById(input.cashSessionId);
      if (!session) throw new NotFoundError("Cash session", input.cashSessionId);
      if (session.status !== "open") throw new BadRequestError("Cash session is not open");

      const totalCents =
        input.items.reduce(
          (sum, item) => sum + item.unitPriceCents * item.quantity - item.discountCents,
          0,
        ) - input.discountCents;

      const paidCents = input.payments.reduce((sum, p) => sum + p.amountCents, 0);
      if (paidCents < totalCents) {
        throw new BadRequestError(`Insufficient payment. Total: ${totalCents}, Paid: ${paidCents}`);
      }

      const order = await orderService.create(
        {
          channel: "pos",
          customerId: input.customerId,
          items: input.items,
          payments: input.payments,
          discountTotalCents: input.discountCents,
          shippingTotalCents: 0,
          notes: input.notes,
        },
        input.cashSessionId,
      );

      for (const payment of input.payments) {
        await posRepo.insertMovement({
          id: generateId(),
          cashSessionId: input.cashSessionId,
          type: "sale",
          paymentMethod: payment.method,
          amountCents: payment.amountCents,
          referenceType: "order",
          referenceId: order.id,
          notes: null,
          createdAt: now(),
        });
      }

      const locations = await inventoryService.findLocations();
      const mainLocation = locations.find((l) => l.type === "main") ?? locations[0];

      if (mainLocation) {
        for (const item of input.items) {
          if (item.productId) {
            await inventoryService.addMovement({
              productId: item.productId,
              variantId: item.variantId,
              locationId: mainLocation.id,
              type: "sale",
              quantity: item.quantity,
              referenceType: "order",
              referenceId: order.id,
            });
          }
        }
      }

      return { order, session };
    },

    async addMovement(input: AddCashMovementInput) {
      const session = await posRepo.findSessionById(input.cashSessionId);
      if (!session) throw new NotFoundError("Cash session", input.cashSessionId);
      if (session.status !== "open") throw new BadRequestError("Cash session is not open");

      return posRepo.insertMovement({
        id: generateId(),
        cashSessionId: input.cashSessionId,
        type: input.type,
        paymentMethod: input.paymentMethod,
        amountCents: input.amountCents,
        referenceType: null,
        referenceId: null,
        notes: input.notes ?? null,
        createdAt: now(),
      });
    },

    async findSessionById(id: string) {
      const session = await posRepo.findSessionById(id);
      if (!session) throw new NotFoundError("Cash session", id);
      const movements = await posRepo.findMovementsBySession(id);
      return { ...session, movements };
    },

    async findSessions(params?: { cashRegisterId?: string }) {
      return posRepo.findSessions(params);
    },

    async findActiveRegisters() {
      return posRepo.findActiveRegisters();
    },

    async createRegister(input: CreateCashRegisterInput) {
      return posRepo.insertRegister({
        id: generateId(),
        name: input.name,
        location: input.location ?? null,
        status: "active",
        createdAt: now(),
        updatedAt: now(),
      });
    },
  };
}
