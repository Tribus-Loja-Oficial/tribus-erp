import type { AppDb } from "../db/client.js";
import { generateId } from "../utils/id.js";
import { NotFoundError, BadRequestError } from "../errors/app-error.js";
import { createFinanceRepository } from "../repositories/finance.repository.js";
import { createAuditRepository } from "../repositories/audit.repository.js";
import type {
  CreateFinancialAccountInput,
  CreateFinancialEntryInput,
  CreatePayableInput,
  PayPayableInput,
  CreateReceivableInput,
  ReceiveReceivableInput,
} from "../schemas/finance.schemas.js";

export function createFinanceService(db: AppDb) {
  const financeRepo = createFinanceRepository(db);
  const auditRepo = createAuditRepository(db);
  const now = () => new Date().toISOString();

  return {
    async findAccounts() {
      return financeRepo.findAccounts();
    },

    async createAccount(input: CreateFinancialAccountInput, actorId?: string) {
      const opening = input.openingBalanceCents ?? 0;
      const account = await financeRepo.insertAccount({
        id: generateId(),
        name: input.name,
        type: input.type,
        institution: input.institution ?? null,
        currency: input.currency ?? "BRL",
        openingBalanceCents: opening,
        currentBalanceCents: opening,
        isActive: true,
        createdAt: now(),
        updatedAt: now(),
      });

      await auditRepo.insert({
        id: generateId(),
        actorId: actorId ?? null,
        actorType: "user",
        action: "finance.account.created",
        entityType: "financial_account",
        entityId: account.id,
        afterJson: JSON.stringify(account),
        createdAt: now(),
      });

      return account;
    },

    async findChartOfAccounts() {
      return financeRepo.findChartOfAccounts();
    },

    async findCostCenters() {
      return financeRepo.findCostCenters();
    },

    async createEntry(input: CreateFinancialEntryInput, actorId?: string) {
      const account = await financeRepo.findAccountById(input.financialAccountId);
      if (!account) throw new NotFoundError("Financial account", input.financialAccountId);

      const entry = await financeRepo.insertEntry({
        id: generateId(),
        ...input,
        categoryId: input.categoryId ?? null,
        costCenterId: input.costCenterId ?? null,
        competenceDate: input.competenceDate ?? null,
        referenceType: input.referenceType ?? null,
        referenceId: input.referenceId ?? null,
        documentId: null,
        createdBy: actorId ?? null,
        createdAt: now(),
        updatedAt: now(),
      });

      const delta = input.type === "income" ? input.amountCents : -input.amountCents;
      await financeRepo.updateAccountBalance(input.financialAccountId, delta);

      await auditRepo.insert({
        id: generateId(),
        actorId: actorId ?? null,
        actorType: "user",
        action: "finance.entry.created",
        entityType: "financial_entry",
        entityId: entry.id,
        afterJson: JSON.stringify(entry),
        createdAt: now(),
      });

      return entry;
    },

    async findEntries(params: Parameters<typeof financeRepo.findEntries>[0] & { page?: number }) {
      const { page = 1, limit = 50, ...rest } = params;
      return financeRepo.findEntries({ ...rest, limit, offset: (page - 1) * limit });
    },

    async createPayable(input: CreatePayableInput, actorId?: string) {
      const payable = await financeRepo.insertPayable({
        id: generateId(),
        ...input,
        supplierId: input.supplierId ?? null,
        competenceDate: input.competenceDate ?? null,
        categoryId: input.categoryId ?? null,
        costCenterId: input.costCenterId ?? null,
        paymentMethod: input.paymentMethod ?? null,
        documentId: null,
        notes: input.notes ?? null,
        paidAmountCents: 0,
        status: "open",
        paidAt: null,
        createdAt: now(),
        updatedAt: now(),
        archivedAt: null,
      });

      await auditRepo.insert({
        id: generateId(),
        actorId: actorId ?? null,
        actorType: "user",
        action: "finance.payable.created",
        entityType: "accounts_payable",
        entityId: payable.id,
        afterJson: JSON.stringify(payable),
        createdAt: now(),
      });

      return payable;
    },

    async payPayable(id: string, input: PayPayableInput, actorId?: string) {
      const payable = await financeRepo.findPayableById(id);
      if (!payable) throw new NotFoundError("Payable", id);
      if (payable.status === "paid") throw new BadRequestError("Payable is already paid");
      if (payable.status === "cancelled") throw new BadRequestError("Payable is cancelled");

      const newPaidAmount = payable.paidAmountCents + input.amountCents;
      const status =
        newPaidAmount >= payable.amountCents
          ? "paid"
          : "partially_paid";

      const updated = await financeRepo.updatePayable(id, {
        paidAmountCents: newPaidAmount,
        status,
        paymentMethod: input.paymentMethod,
        paidAt: input.paidAt ?? now().slice(0, 10),
      });

      await this.createEntry({
        type: "expense",
        financialAccountId: input.financialAccountId,
        amountCents: input.amountCents,
        date: input.paidAt ?? now().slice(0, 10),
        description: `Pagamento: ${payable.description}`,
        referenceType: "accounts_payable",
        referenceId: id,
      }, actorId);

      return updated;
    },

    async findPayables(params: { status?: string; page?: number; limit?: number }) {
      const { page = 1, limit = 20, status } = params;
      return financeRepo.findPayables({ status, limit, offset: (page - 1) * limit });
    },

    async createReceivable(input: CreateReceivableInput, actorId?: string) {
      return financeRepo.insertReceivable({
        id: generateId(),
        ...input,
        customerId: input.customerId ?? null,
        orderId: input.orderId ?? null,
        paymentMethod: input.paymentMethod ?? null,
        notes: input.notes ?? null,
        receivedAmountCents: 0,
        status: "open",
        receivedAt: null,
        competenceDate: null,
        createdAt: now(),
        updatedAt: now(),
        archivedAt: null,
      });
    },

    async receiveReceivable(id: string, input: ReceiveReceivableInput, actorId?: string) {
      const receivable = await financeRepo.findReceivableById(id);
      if (!receivable) throw new NotFoundError("Receivable", id);
      if (receivable.status === "received") throw new BadRequestError("Receivable is already received");

      const newReceivedAmount = receivable.receivedAmountCents + input.amountCents;
      const status =
        newReceivedAmount >= receivable.amountCents ? "received" : "partially_received";

      const updated = await financeRepo.updateReceivable(id, {
        receivedAmountCents: newReceivedAmount,
        status,
        paymentMethod: input.paymentMethod,
        receivedAt: input.receivedAt ?? now().slice(0, 10),
      });

      await this.createEntry({
        type: "income",
        financialAccountId: input.financialAccountId,
        amountCents: input.amountCents,
        date: input.receivedAt ?? now().slice(0, 10),
        description: `Recebimento: ${receivable.description}`,
        referenceType: "accounts_receivable",
        referenceId: id,
      }, actorId);

      return updated;
    },

    async findReceivables(params: { status?: string; page?: number; limit?: number }) {
      const { page = 1, limit = 20, status } = params;
      return financeRepo.findReceivables({ status, limit, offset: (page - 1) * limit });
    },

    async getDashboardSummary(from?: string, to?: string) {
      const [totals, payablesByStatus, receivablesByStatus, accounts] = await Promise.all([
        financeRepo.sumEntriesByType(from, to),
        financeRepo.sumPayablesByStatus(),
        financeRepo.sumReceivablesByStatus(),
        financeRepo.findAccounts(),
      ]);

      const totalBalance = accounts.reduce((sum, a) => sum + a.currentBalanceCents, 0);

      return {
        income: totals.income,
        expense: totals.expense,
        balance: totals.income - totals.expense,
        totalBalance,
        payables: payablesByStatus,
        receivables: receivablesByStatus,
      };
    },
  };
}
