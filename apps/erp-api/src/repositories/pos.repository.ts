import { eq, and, desc } from "drizzle-orm";
import type { AppDb } from "../db/client.js";
import {
  cashRegisters,
  cashSessions,
  cashMovements,
  type CashSession,
  type NewCashSession,
  type NewCashMovement,
  type NewCashRegister,
} from "../db/schema/index.js";

export function createPosRepository(db: AppDb) {
  return {
    async findRegisterById(id: string) {
      const result = await db
        .select()
        .from(cashRegisters)
        .where(eq(cashRegisters.id, id))
        .limit(1);
      return result[0] ?? null;
    },

    async findActiveRegisters() {
      return db
        .select()
        .from(cashRegisters)
        .where(eq(cashRegisters.status, "active"))
        .orderBy(cashRegisters.name);
    },

    async insertRegister(data: NewCashRegister) {
      const result = await db.insert(cashRegisters).values(data).returning();
      if (!result[0]) throw new Error("Failed to insert cash register");
      return result[0];
    },

    async findSessionById(id: string): Promise<CashSession | null> {
      const result = await db
        .select()
        .from(cashSessions)
        .where(eq(cashSessions.id, id))
        .limit(1);
      return result[0] ?? null;
    },

    async findOpenSession(cashRegisterId: string): Promise<CashSession | null> {
      const result = await db
        .select()
        .from(cashSessions)
        .where(
          and(eq(cashSessions.cashRegisterId, cashRegisterId), eq(cashSessions.status, "open")),
        )
        .limit(1);
      return result[0] ?? null;
    },

    async findSessions(params: { cashRegisterId?: string; limit?: number } = {}) {
      const { cashRegisterId, limit = 20 } = params;
      const conditions = cashRegisterId
        ? [eq(cashSessions.cashRegisterId, cashRegisterId)]
        : [];
      return db
        .select()
        .from(cashSessions)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(cashSessions.openedAt))
        .limit(limit);
    },

    async insertSession(data: NewCashSession): Promise<CashSession> {
      const result = await db.insert(cashSessions).values(data).returning();
      if (!result[0]) throw new Error("Failed to insert cash session");
      return result[0];
    },

    async updateSession(id: string, data: Partial<NewCashSession>): Promise<CashSession> {
      const result = await db
        .update(cashSessions)
        .set({ ...data, updatedAt: new Date().toISOString() })
        .where(eq(cashSessions.id, id))
        .returning();
      if (!result[0]) throw new Error(`Cash session ${id} not found`);
      return result[0];
    },

    async insertMovement(data: NewCashMovement) {
      const result = await db.insert(cashMovements).values(data).returning();
      if (!result[0]) throw new Error("Failed to insert cash movement");
      return result[0];
    },

    async findMovementsBySession(sessionId: string) {
      return db
        .select()
        .from(cashMovements)
        .where(eq(cashMovements.cashSessionId, sessionId))
        .orderBy(desc(cashMovements.createdAt));
    },

    async sumMovementsBySession(sessionId: string): Promise<number> {
      const movements = await this.findMovementsBySession(sessionId);
      return movements.reduce((sum, m) => {
        const sign =
          m.type === "sale" || m.type === "cash_in"
            ? 1
            : m.type === "refund" || m.type === "cash_out" || m.type === "fee"
              ? -1
              : 0;
        return sum + sign * m.amountCents;
      }, 0);
    },
  };
}
