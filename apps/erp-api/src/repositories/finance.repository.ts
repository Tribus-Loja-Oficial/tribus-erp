import { eq, and, isNull, desc, gte, lte } from "drizzle-orm";
import type { AppDb } from "../db/client.js";
import {
  financialAccounts,
  financialEntries,
  accountsPayable,
  accountsReceivable,
  chartOfAccounts,
  costCenters,
  type FinancialEntry,
  type NewFinancialEntry,
  type NewFinancialAccount,
  type AccountPayable,
  type NewAccountPayable,
  type AccountReceivable,
  type NewAccountReceivable,
} from "../db/schema/index.js";

export function createFinanceRepository(db: AppDb) {
  return {
    // Financial Accounts
    async findAccounts(activeOnly = true) {
      const conditions = activeOnly ? [eq(financialAccounts.isActive, true)] : [];
      return db
        .select()
        .from(financialAccounts)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(financialAccounts.name);
    },

    async findAccountById(id: string) {
      const result = await db
        .select()
        .from(financialAccounts)
        .where(eq(financialAccounts.id, id))
        .limit(1);
      return result[0] ?? null;
    },

    async insertAccount(data: NewFinancialAccount) {
      const result = await db.insert(financialAccounts).values(data).returning();
      if (!result[0]) throw new Error("Failed to insert financial account");
      return result[0];
    },

    async updateAccountBalance(id: string, delta: number): Promise<void> {
      const account = await this.findAccountById(id);
      if (!account) throw new Error(`Financial account ${id} not found`);
      await db
        .update(financialAccounts)
        .set({ currentBalanceCents: account.currentBalanceCents + delta })
        .where(eq(financialAccounts.id, id));
    },

    // Chart of Accounts
    async findChartOfAccounts() {
      return db
        .select()
        .from(chartOfAccounts)
        .where(eq(chartOfAccounts.isActive, true))
        .orderBy(chartOfAccounts.code);
    },

    async findCostCenters() {
      return db
        .select()
        .from(costCenters)
        .where(eq(costCenters.isActive, true))
        .orderBy(costCenters.name);
    },

    // Financial Entries
    async insertEntry(data: NewFinancialEntry): Promise<FinancialEntry> {
      const result = await db.insert(financialEntries).values(data).returning();
      if (!result[0]) throw new Error("Failed to insert financial entry");
      return result[0];
    },

    async findEntries(
      params: {
        type?: string;
        accountId?: string;
        from?: string;
        to?: string;
        limit?: number;
        offset?: number;
      } = {},
    ): Promise<FinancialEntry[]> {
      const { type, accountId, from, to, limit = 50, offset = 0 } = params;
      const conditions = [];
      if (type) conditions.push(eq(financialEntries.type, type as FinancialEntry["type"]));
      if (accountId) conditions.push(eq(financialEntries.financialAccountId, accountId));
      if (from) conditions.push(gte(financialEntries.date, from));
      if (to) conditions.push(lte(financialEntries.date, to));
      return db
        .select()
        .from(financialEntries)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(financialEntries.date))
        .limit(limit)
        .offset(offset);
    },

    // Accounts Payable
    async findPayables(
      params: { status?: string; limit?: number; offset?: number } = {},
    ): Promise<AccountPayable[]> {
      const { status, limit = 20, offset = 0 } = params;
      const conditions = [isNull(accountsPayable.archivedAt)];
      if (status) conditions.push(eq(accountsPayable.status, status as AccountPayable["status"]));
      return db
        .select()
        .from(accountsPayable)
        .where(and(...conditions))
        .orderBy(accountsPayable.dueDate)
        .limit(limit)
        .offset(offset);
    },

    async findPayableById(id: string): Promise<AccountPayable | null> {
      const result = await db
        .select()
        .from(accountsPayable)
        .where(and(eq(accountsPayable.id, id), isNull(accountsPayable.archivedAt)))
        .limit(1);
      return result[0] ?? null;
    },

    async insertPayable(data: NewAccountPayable): Promise<AccountPayable> {
      const result = await db.insert(accountsPayable).values(data).returning();
      if (!result[0]) throw new Error("Failed to insert payable");
      return result[0];
    },

    async updatePayable(id: string, data: Partial<NewAccountPayable>): Promise<AccountPayable> {
      const result = await db
        .update(accountsPayable)
        .set({ ...data, updatedAt: new Date().toISOString() })
        .where(eq(accountsPayable.id, id))
        .returning();
      if (!result[0]) throw new Error(`Payable ${id} not found`);
      return result[0];
    },

    // Accounts Receivable
    async findReceivables(
      params: { status?: string; limit?: number; offset?: number } = {},
    ): Promise<AccountReceivable[]> {
      const { status, limit = 20, offset = 0 } = params;
      const conditions = [isNull(accountsReceivable.archivedAt)];
      if (status)
        conditions.push(eq(accountsReceivable.status, status as AccountReceivable["status"]));
      return db
        .select()
        .from(accountsReceivable)
        .where(and(...conditions))
        .orderBy(accountsReceivable.dueDate)
        .limit(limit)
        .offset(offset);
    },

    async findReceivableById(id: string): Promise<AccountReceivable | null> {
      const result = await db
        .select()
        .from(accountsReceivable)
        .where(and(eq(accountsReceivable.id, id), isNull(accountsReceivable.archivedAt)))
        .limit(1);
      return result[0] ?? null;
    },

    async insertReceivable(data: NewAccountReceivable): Promise<AccountReceivable> {
      const result = await db.insert(accountsReceivable).values(data).returning();
      if (!result[0]) throw new Error("Failed to insert receivable");
      return result[0];
    },

    async updateReceivable(
      id: string,
      data: Partial<NewAccountReceivable>,
    ): Promise<AccountReceivable> {
      const result = await db
        .update(accountsReceivable)
        .set({ ...data, updatedAt: new Date().toISOString() })
        .where(eq(accountsReceivable.id, id))
        .returning();
      if (!result[0]) throw new Error(`Receivable ${id} not found`);
      return result[0];
    },

    async sumEntriesByType(
      from?: string,
      to?: string,
    ): Promise<{ income: number; expense: number }> {
      const entries = await this.findEntries({ from, to, limit: 9999 });
      return entries.reduce(
        (acc, e) => {
          if (e.type === "income") acc.income += e.amountCents;
          else if (e.type === "expense") acc.expense += e.amountCents;
          return acc;
        },
        { income: 0, expense: 0 },
      );
    },

    async sumPayablesByStatus(): Promise<Record<string, number>> {
      const items = await db
        .select()
        .from(accountsPayable)
        .where(isNull(accountsPayable.archivedAt));
      return items.reduce(
        (acc, p) => {
          acc[p.status] = (acc[p.status] ?? 0) + (p.amountCents - p.paidAmountCents);
          return acc;
        },
        {} as Record<string, number>,
      );
    },

    async sumReceivablesByStatus(): Promise<Record<string, number>> {
      const items = await db
        .select()
        .from(accountsReceivable)
        .where(isNull(accountsReceivable.archivedAt));
      return items.reduce(
        (acc, r) => {
          acc[r.status] = (acc[r.status] ?? 0) + (r.amountCents - r.receivedAmountCents);
          return acc;
        },
        {} as Record<string, number>,
      );
    },
  };
}
