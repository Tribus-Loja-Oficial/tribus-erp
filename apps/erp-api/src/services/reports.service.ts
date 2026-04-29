import { eq, and, gte, lte, isNull, desc, sql } from "drizzle-orm";
import type { AppDb } from "../db/client.js";
import {
  financialEntries,
  orders,
  orderItems,
  products,
  accountsPayable,
  accountsReceivable,
  financialAccounts,
  fiscalDocuments,
} from "../db/schema/index.js";

export function createReportsService(db: AppDb) {
  const monthStart = (offset = 0) => {
    const d = new Date();
    d.setMonth(d.getMonth() + offset);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
  };

  const monthEnd = (offset = 0) => {
    const d = new Date();
    d.setMonth(d.getMonth() + offset + 1);
    d.setDate(0);
    d.setHours(23, 59, 59, 999);
    return d.toISOString().slice(0, 10);
  };

  return {
    async getDre(from?: string, to?: string) {
      const start = from ?? monthStart();
      const end = to ?? monthEnd();

      const entries = await db
        .select()
        .from(financialEntries)
        .where(and(gte(financialEntries.date, start), lte(financialEntries.date, end)));

      const revenue = entries
        .filter((e) => e.type === "income")
        .reduce((sum, e) => sum + e.amountCents, 0);

      const expenses = entries
        .filter((e) => e.type === "expense")
        .reduce((sum, e) => sum + e.amountCents, 0);

      const byCategory: Record<string, number> = {};
      for (const e of entries) {
        const key = e.categoryId ?? "sem_categoria";
        byCategory[key] = (byCategory[key] ?? 0) + (e.type === "expense" ? e.amountCents : 0);
      }

      const result = revenue - expenses;

      return {
        period: { from: start, to: end },
        revenue,
        expenses,
        result,
        margin: revenue > 0 ? ((result / revenue) * 100).toFixed(2) : "0.00",
        byCategory,
      };
    },

    async getCashflow(from?: string, to?: string, months = 6) {
      const rows: Array<{
        month: string;
        income: number;
        expense: number;
        balance: number;
      }> = [];

      for (let i = months - 1; i >= 0; i--) {
        const start = from ?? monthStart(-i);
        const end = to ?? monthEnd(-i);
        const label = start.slice(0, 7);

        const entries = await db
          .select()
          .from(financialEntries)
          .where(and(gte(financialEntries.date, start), lte(financialEntries.date, end)));

        const income = entries.filter((e) => e.type === "income").reduce((s, e) => s + e.amountCents, 0);
        const expense = entries.filter((e) => e.type === "expense").reduce((s, e) => s + e.amountCents, 0);

        rows.push({ month: label, income, expense, balance: income - expense });

        if (from && to) break;
      }

      const accounts = await db.select().from(financialAccounts).where(eq(financialAccounts.isActive, true));
      const currentBalance = accounts.reduce((s, a) => s + a.currentBalanceCents, 0);

      return { rows, currentBalance };
    },

    async getMarginByProduct(from?: string, to?: string) {
      const start = from ?? monthStart();
      const end = to ?? monthEnd();

      const soldItems = await db
        .select({
          productId: orderItems.productId,
          name: orderItems.name,
          sku: orderItems.sku,
          totalQty: sql<number>`SUM(${orderItems.quantity})`,
          totalRevenue: sql<number>`SUM(${orderItems.totalCents})`,
        })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .where(
          and(
            isNull(orders.deletedAt),
            gte(orders.createdAt, start + "T00:00:00.000Z"),
            lte(orders.createdAt, end + "T23:59:59.999Z"),
          ),
        )
        .groupBy(orderItems.productId, orderItems.sku, orderItems.name)
        .orderBy(desc(sql`SUM(${orderItems.totalCents})`))
        .limit(50);

      const rows = await Promise.all(
        soldItems.map(async (item) => {
          let costPriceCents = 0;
          if (item.productId) {
            const product = await db
              .select({ costPriceCents: products.costPriceCents })
              .from(products)
              .where(eq(products.id, item.productId))
              .get();
            costPriceCents = product?.costPriceCents ?? 0;
          }

          const totalCost = costPriceCents * item.totalQty;
          const totalRevenue = item.totalRevenue;
          const grossMargin = totalRevenue - totalCost;
          const marginPct = totalRevenue > 0 ? ((grossMargin / totalRevenue) * 100).toFixed(2) : "0.00";

          return {
            productId: item.productId,
            name: item.name,
            sku: item.sku,
            totalQty: item.totalQty,
            totalRevenueCents: totalRevenue,
            totalCostCents: totalCost,
            grossMarginCents: grossMargin,
            marginPct,
          };
        }),
      );

      return { period: { from: start, to: end }, rows };
    },

    async getSalesByChannel(from?: string, to?: string) {
      const start = from ?? monthStart();
      const end = to ?? monthEnd();

      const allOrders = await db
        .select()
        .from(orders)
        .where(
          and(
            isNull(orders.deletedAt),
            gte(orders.createdAt, start + "T00:00:00.000Z"),
            lte(orders.createdAt, end + "T23:59:59.999Z"),
          ),
        );

      const byChannel: Record<string, { count: number; totalCents: number }> = {};
      for (const o of allOrders) {
        if (!byChannel[o.channel]) byChannel[o.channel] = { count: 0, totalCents: 0 };
        byChannel[o.channel].count++;
        byChannel[o.channel].totalCents += o.totalCents;
      }

      const totalRevenue = Object.values(byChannel).reduce((s, v) => s + v.totalCents, 0);

      return {
        period: { from: start, to: end },
        totalOrders: allOrders.length,
        totalRevenueCents: totalRevenue,
        byChannel,
      };
    },

    async getInventoryValuation() {
      const prods = await db
        .select()
        .from(products)
        .where(isNull(products.archivedAt))
        .orderBy(desc(products.currentStock));

      const rows = prods.map((p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        currentStock: p.currentStock,
        costPriceCents: p.costPriceCents,
        totalValueCents: p.currentStock * p.costPriceCents,
        minStock: p.minStock,
        belowMinStock: p.minStock > 0 && p.currentStock <= p.minStock,
      }));

      const totalValueCents = rows.reduce((s, r) => s + r.totalValueCents, 0);
      const belowMinStockCount = rows.filter((r) => r.belowMinStock).length;

      return { totalValueCents, belowMinStockCount, rows };
    },

    async getPayablesReceivablesSummary() {
      const now = new Date().toISOString().slice(0, 10);

      const [overduePayables, upcomingPayables, overdueReceivables, upcomingReceivables] = await Promise.all([
        db
          .select()
          .from(accountsPayable)
          .where(and(isNull(accountsPayable.archivedAt), eq(accountsPayable.status, "open"), lte(accountsPayable.dueDate, now))),
        db
          .select()
          .from(accountsPayable)
          .where(and(isNull(accountsPayable.archivedAt), eq(accountsPayable.status, "open")))
          .limit(20),
        db
          .select()
          .from(accountsReceivable)
          .where(and(isNull(accountsReceivable.archivedAt), eq(accountsReceivable.status, "open"), lte(accountsReceivable.dueDate, now))),
        db
          .select()
          .from(accountsReceivable)
          .where(and(isNull(accountsReceivable.archivedAt), eq(accountsReceivable.status, "open")))
          .limit(20),
      ]);

      return {
        payables: {
          overdueCount: overduePayables.length,
          overdueCents: overduePayables.reduce((s, p) => s + (p.amountCents - p.paidAmountCents), 0),
          upcoming: upcomingPayables.slice(0, 10),
        },
        receivables: {
          overdueCount: overdueReceivables.length,
          overdueCents: overdueReceivables.reduce((s, r) => s + (r.amountCents - r.receivedAmountCents), 0),
          upcoming: upcomingReceivables.slice(0, 10),
        },
      };
    },

    async getRecentFiscalDocuments(limit = 10) {
      return db
        .select()
        .from(fiscalDocuments)
        .orderBy(desc(fiscalDocuments.createdAt))
        .limit(limit);
    },
  };
}
