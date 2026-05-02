import type { AppDb } from "../db/client.js";
import { generateId } from "../utils/id.js";
import { NotFoundError, ConflictError, ValidationError } from "../errors/app-error.js";
import { createProductRepository } from "../repositories/product.repository.js";
import { createProductCompositionRepository } from "../repositories/product-composition.repository.js";
import type {
  CreateProductCompositionInput,
  UpdateProductCompositionInput,
} from "../schemas/product.schemas.js";

export function createProductCompositionService(db: AppDb) {
  const productsRepo = createProductRepository(db);
  const compositionsRepo = createProductCompositionRepository(db);
  const now = () => new Date().toISOString();

  return {
    async listByParent(parentProductId: string) {
      const p = await productsRepo.findById(parentProductId);
      if (!p) throw new NotFoundError("Product", parentProductId);
      return compositionsRepo.findActiveByParentId(parentProductId);
    },

    async add(parentProductId: string, input: CreateProductCompositionInput) {
      const parent = await productsRepo.findById(parentProductId);
      if (!parent) throw new NotFoundError("Product", parentProductId);
      const child = await productsRepo.findById(input.childProductId);
      if (!child) throw new NotFoundError("Product", input.childProductId);
      if (parentProductId === input.childProductId) {
        throw new ValidationError("O produto não pode ser componente dele mesmo");
      }

      try {
        return await compositionsRepo.insert({
          id: generateId(),
          parentProductId,
          childProductId: input.childProductId,
          quantity: input.quantity,
          compositionType: input.compositionType,
          required: input.required,
          isDefault: input.isDefault,
          notes: input.notes ?? null,
          createdAt: now(),
          updatedAt: now(),
          archivedAt: null,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("UNIQUE") || msg.toLowerCase().includes("unique")) {
          throw new ConflictError(
            "Já existe composição com o mesmo produto filho e tipo para este produto",
          );
        }
        throw e;
      }
    },

    async update(
      parentProductId: string,
      compositionId: string,
      input: UpdateProductCompositionInput,
    ) {
      const row = await compositionsRepo.findById(compositionId);
      if (!row || row.archivedAt) throw new NotFoundError("ProductComposition", compositionId);
      if (row.parentProductId !== parentProductId) {
        throw new ValidationError("Composição não pertence a este produto");
      }
      if (input.childProductId !== undefined) {
        if (input.childProductId === parentProductId) {
          throw new ValidationError("O produto não pode ser componente dele mesmo");
        }
        const child = await productsRepo.findById(input.childProductId);
        if (!child) throw new NotFoundError("Product", input.childProductId);
      }
      const filtered = Object.fromEntries(
        Object.entries(input).filter(([, v]) => v !== undefined),
      ) as UpdateProductCompositionInput;
      return compositionsRepo.update(compositionId, filtered as never);
    },

    async archive(parentProductId: string, compositionId: string) {
      const row = await compositionsRepo.findById(compositionId);
      if (!row || row.archivedAt) throw new NotFoundError("ProductComposition", compositionId);
      if (row.parentProductId !== parentProductId) {
        throw new ValidationError("Composição não pertence a este produto");
      }
      await compositionsRepo.archive(compositionId);
    },
  };
}
