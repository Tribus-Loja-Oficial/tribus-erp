import type { AppDb } from "../db/client.js";
import { generateId } from "../utils/id.js";
import { NotFoundError, ConflictError } from "../errors/app-error.js";
import { createPartyRepository } from "../repositories/party.repository.js";
import { createCustomerRepository } from "../repositories/customer.repository.js";
import { createSupplierRepository } from "../repositories/supplier.repository.js";
import { createAuditRepository } from "../repositories/audit.repository.js";
import type {
  CreatePartyInput,
  UpdatePartyInput,
  CreateAddressInput,
} from "../schemas/party.schemas.js";
import type {
  CreateCustomerWithPartyInput,
  CreateSupplierWithPartyInput,
} from "../schemas/people.schemas.js";

export function createPartyService(db: AppDb) {
  const partiesRepo = createPartyRepository(db);
  const customersRepo = createCustomerRepository(db);
  const suppliersRepo = createSupplierRepository(db);
  const auditRepo = createAuditRepository(db);

  const now = () => new Date().toISOString();

  return {
    async create(input: CreatePartyInput, actorId?: string) {
      const party = await partiesRepo.insert({
        id: generateId(),
        ...input,
        tradeName: input.tradeName ?? null,
        documentNumber: input.documentNumber ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        notes: input.notes ?? null,
        cdsConsumerId: input.cdsConsumerId ?? null,
        createdAt: now(),
        updatedAt: now(),
        archivedAt: null,
      });

      await auditRepo.insert({
        id: generateId(),
        actorId: actorId ?? null,
        actorType: "user",
        action: "party.created",
        entityType: "party",
        entityId: party.id,
        afterJson: JSON.stringify(party),
        createdAt: now(),
      });

      return party;
    },

    async findById(id: string) {
      const party = await partiesRepo.findById(id);
      if (!party) throw new NotFoundError("Party", id);
      const addresses = await partiesRepo.findAddressesByParty(id);
      return { ...party, addresses };
    },

    async findMany(params: Parameters<typeof partiesRepo.findMany>[0]) {
      const {
        page = 1,
        limit = 20,
        ...rest
      } = params as { page?: number; limit?: number; q?: string; type?: "individual" | "company" };
      return partiesRepo.findMany({ ...rest, limit, offset: (page - 1) * limit });
    },

    async update(id: string, input: UpdatePartyInput, actorId?: string) {
      const existing = await partiesRepo.findById(id);
      if (!existing) throw new NotFoundError("Party", id);

      const updated = await partiesRepo.update(id, input);

      await auditRepo.insert({
        id: generateId(),
        actorId: actorId ?? null,
        actorType: "user",
        action: "party.updated",
        entityType: "party",
        entityId: id,
        beforeJson: JSON.stringify(existing),
        afterJson: JSON.stringify(updated),
        createdAt: now(),
      });

      return updated;
    },

    async archive(id: string, actorId?: string) {
      const existing = await partiesRepo.findById(id);
      if (!existing) throw new NotFoundError("Party", id);
      await partiesRepo.archive(id);
      await auditRepo.insert({
        id: generateId(),
        actorId: actorId ?? null,
        actorType: "user",
        action: "party.archived",
        entityType: "party",
        entityId: id,
        createdAt: now(),
      });
    },

    async addAddress(input: CreateAddressInput) {
      const party = await partiesRepo.findById(input.partyId);
      if (!party) throw new NotFoundError("Party", input.partyId);
      return partiesRepo.insertAddress({
        id: generateId(),
        ...input,
        number: input.number ?? null,
        complement: input.complement ?? null,
        neighborhood: input.neighborhood ?? null,
        createdAt: now(),
        updatedAt: now(),
      });
    },

    async createCustomer(
      partyId: string,
      opts?: { cdsConsumerId?: string; origin?: "ecommerce" | "event" | "manual" | "imported" },
    ) {
      const party = await partiesRepo.findById(partyId);
      if (!party) throw new NotFoundError("Party", partyId);
      const existing = await customersRepo.findByPartyId(partyId);
      if (existing) throw new ConflictError("Party already has a customer profile");
      return customersRepo.insert({
        id: generateId(),
        partyId,
        cdsConsumerId: opts?.cdsConsumerId ?? null,
        origin: opts?.origin ?? "manual",
        firstPurchaseAt: null,
        lastPurchaseAt: null,
        totalOrders: 0,
        totalSpentCents: 0,
        notes: null,
        status: "active",
        createdAt: now(),
        updatedAt: now(),
        archivedAt: null,
      });
    },

    async createSupplier(
      partyId: string,
      opts?: { stateRegistration?: string; contactName?: string },
    ) {
      const party = await partiesRepo.findById(partyId);
      if (!party) throw new NotFoundError("Party", partyId);
      const existing = await suppliersRepo.findByPartyId(partyId);
      if (existing) throw new ConflictError("Party already has a supplier profile");
      return suppliersRepo.insert({
        id: generateId(),
        partyId,
        stateRegistration: opts?.stateRegistration ?? null,
        municipalRegistration: null,
        contactName: opts?.contactName ?? null,
        website: null,
        marketplace: null,
        notes: null,
        status: "active",
        createdAt: now(),
        updatedAt: now(),
        archivedAt: null,
      });
    },

    async listCustomers(params: { status?: string; page?: number; limit?: number }) {
      const page = params.page ?? 1;
      const limit = params.limit ?? 20;
      return customersRepo.findManyWithParty({
        status: params.status,
        limit,
        offset: (page - 1) * limit,
      });
    },

    async listSuppliers(params: { status?: string; page?: number; limit?: number }) {
      const page = params.page ?? 1;
      const limit = params.limit ?? 20;
      return suppliersRepo.findManyWithParty({
        status: params.status,
        limit,
        offset: (page - 1) * limit,
      });
    },

    async getCustomerById(id: string) {
      const customer = await customersRepo.findById(id);
      if (!customer) throw new NotFoundError("Customer", id);
      const party = await partiesRepo.findById(customer.partyId);
      if (!party) throw new NotFoundError("Party", customer.partyId);
      const addresses = await partiesRepo.findAddressesByParty(party.id);
      return { customer, party, addresses };
    },

    async getSupplierById(id: string) {
      const supplier = await suppliersRepo.findById(id);
      if (!supplier) throw new NotFoundError("Supplier", id);
      const party = await partiesRepo.findById(supplier.partyId);
      if (!party) throw new NotFoundError("Party", supplier.partyId);
      return { supplier, party };
    },

    async createCustomerWithParty(input: CreateCustomerWithPartyInput, actorId?: string) {
      const { origin, ...partyInput } = input;
      const party = await this.create(partyInput, actorId);
      const customer = await this.createCustomer(party.id, {
        cdsConsumerId: input.cdsConsumerId ?? undefined,
        origin: origin ?? "manual",
      });
      return { party, customer };
    },

    async createSupplierWithParty(input: CreateSupplierWithPartyInput, actorId?: string) {
      const { stateRegistration, contactName, ...partyInput } = input;
      const party = await this.create(partyInput, actorId);
      const supplier = await this.createSupplier(party.id, {
        stateRegistration: stateRegistration ?? undefined,
        contactName: contactName ?? undefined,
      });
      return { party, supplier };
    },
  };
}
