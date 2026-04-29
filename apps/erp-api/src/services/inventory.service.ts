import type { AppDb } from "../db/client.js";
import { generateId } from "../utils/id.js";
import { NotFoundError, BadRequestError } from "../errors/app-error.js";
import { createInventoryRepository } from "../repositories/inventory.repository.js";
import { createProductRepository } from "../repositories/product.repository.js";
import { createProductVariantRepository } from "../repositories/product-variant.repository.js";
import { createAuditRepository } from "../repositories/audit.repository.js";
import type { StockMovementType, StockLocationType } from "@tribus-erp/core";

export interface AddMovementInput {
  productId: string;
  variantId?: string;
  locationId: string;
  type: StockMovementType;
  quantity: number;
  unitCostCents?: number;
  referenceType?: string;
  referenceId?: string;
  notes?: string;
  createdBy?: string;
}

export interface CreateLocationInput {
  name: string;
  type: StockLocationType;
  address?: string;
}

export function createInventoryService(db: AppDb) {
  const inventoryRepo = createInventoryRepository(db);
  const productsRepo = createProductRepository(db);
  const variantsRepo = createProductVariantRepository(db);
  const auditRepo = createAuditRepository(db);
  const now = () => new Date().toISOString();

  const OUT_TYPES: StockMovementType[] = [
    "sale", "production_out", "transfer_out", "damaged", "reservation",
  ];

  return {
    async addMovement(input: AddMovementInput, actorId?: string) {
      const product = await productsRepo.findById(input.productId);
      if (!product) throw new NotFoundError("Product", input.productId);

      const location = await inventoryRepo.findLocationById(input.locationId);
      if (!location) throw new NotFoundError("Stock location", input.locationId);

      const isOutward = OUT_TYPES.includes(input.type);
      const delta = isOutward ? -Math.abs(input.quantity) : Math.abs(input.quantity);

      if (isOutward && product.currentStock + delta < 0) {
        throw new BadRequestError(
          `Insufficient stock. Current: ${product.currentStock}, Requested: ${Math.abs(input.quantity)}`,
        );
      }

      const movement = await inventoryRepo.insertMovement({
        id: generateId(),
        productId: input.productId,
        variantId: input.variantId ?? null,
        locationId: input.locationId,
        type: input.type,
        quantity: input.quantity,
        unitCostCents: input.unitCostCents ?? null,
        referenceType: input.referenceType ?? null,
        referenceId: input.referenceId ?? null,
        notes: input.notes ?? null,
        createdBy: input.createdBy ?? null,
        createdAt: now(),
      });

      await productsRepo.updateStock(input.productId, delta);

      if (input.variantId) {
        await variantsRepo.updateStock(input.variantId, delta);
      }

      await auditRepo.insert({
        id: generateId(),
        actorId: actorId ?? null,
        actorType: "user",
        action: `inventory.${input.type}`,
        entityType: "stock_movement",
        entityId: movement.id,
        afterJson: JSON.stringify(movement),
        createdAt: now(),
      });

      return movement;
    },

    async adjustStock(productId: string, newQty: number, notes: string, actorId?: string) {
      const product = await productsRepo.findById(productId);
      if (!product) throw new NotFoundError("Product", productId);

      const delta = newQty - product.currentStock;
      const type: StockMovementType = delta >= 0 ? "adjustment" : "adjustment";

      const locations = await inventoryRepo.findActiveLocations();
      const mainLocation = locations.find((l) => l.type === "main") ?? locations[0];
      if (!mainLocation) throw new BadRequestError("No active stock location found");

      return this.addMovement(
        {
          productId,
          locationId: mainLocation.id,
          type,
          quantity: Math.abs(delta),
          notes: notes ?? "Manual adjustment",
          createdBy: actorId,
        },
        actorId,
      );
    },

    async createLocation(input: CreateLocationInput) {
      return inventoryRepo.insertLocation({
        id: generateId(),
        name: input.name,
        type: input.type,
        address: input.address ?? null,
        isActive: true,
        createdAt: now(),
        updatedAt: now(),
      });
    },

    async findLocations() {
      return inventoryRepo.findActiveLocations();
    },

    async findMovements(productId?: string, locationId?: string) {
      if (productId) return inventoryRepo.findMovementsByProduct(productId);
      if (locationId) return inventoryRepo.findMovementsByLocation(locationId);
      return inventoryRepo.findRecentMovements(50);
    },
  };
}
