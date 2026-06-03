import { describe, expect, it } from "vitest";
import { mergeEffectiveComposition } from "../../../src/domain/composition-merge.js";

const baseRow = (
  overrides: Partial<ReturnType<typeof row>> & { id: string; childProductId: string },
) => row(overrides);

function row(
  p: Partial<{
    id: string;
    childProductId: string;
    compositionType: string;
    packagingChannel: string | null;
    quantity: number;
  }> & { id: string; childProductId: string },
) {
  return {
    id: p.id,
    childProductId: p.childProductId,
    quantity: p.quantity ?? 1,
    quantityUnit: null,
    compositionType: p.compositionType ?? "bom",
    packagingChannel: p.packagingChannel ?? null,
    required: true,
    isDefault: true,
    notes: null,
    unitCostSnapshotCents: null,
    totalCostSnapshotCents: null,
    createdAt: "2020-01-01T00:00:00.000Z",
    updatedAt: "2020-01-01T00:00:00.000Z",
    archivedAt: null,
  };
}

describe("mergeEffectiveComposition", () => {
  it("mantém linhas só da linha quando não há produto", () => {
    const merged = mergeEffectiveComposition([baseRow({ id: "l1", childProductId: "c1" })], []);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.scope).toBe("line");
    expect(merged[0]!.sourceCompositionId).toBe("l1");
  });

  it("produto substitui linha na mesma chave BOM", () => {
    const merged = mergeEffectiveComposition(
      [baseRow({ id: "l1", childProductId: "c1", quantity: 2 })],
      [baseRow({ id: "p1", childProductId: "c1", quantity: 5 })],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]!.scope).toBe("product");
    expect(merged[0]!.quantity).toBe(5);
    expect(merged[0]!.sourceCompositionId).toBe("p1");
  });

  it("linhas só no produto são aditivas", () => {
    const merged = mergeEffectiveComposition(
      [baseRow({ id: "l1", childProductId: "c1" })],
      [baseRow({ id: "p1", childProductId: "c2" })],
    );
    expect(merged).toHaveLength(2);
    const scopes = merged.map((m) => m.scope).sort();
    expect(scopes).toEqual(["line", "product"]);
  });

  it("embalagem distingue canal online e presencial", () => {
    const merged = mergeEffectiveComposition(
      [
        baseRow({
          id: "l-on",
          childProductId: "pkg",
          compositionType: "packaging",
          packagingChannel: "online",
        }),
        baseRow({
          id: "l-pr",
          childProductId: "pkg",
          compositionType: "packaging",
          packagingChannel: "presential",
        }),
      ],
      [
        baseRow({
          id: "p-on",
          childProductId: "pkg",
          compositionType: "packaging",
          packagingChannel: "online",
          quantity: 3,
        }),
      ],
    );
    expect(merged).toHaveLength(2);
    const online = merged.find((m) => m.packagingChannel === "online");
    const presential = merged.find((m) => m.packagingChannel === "presential");
    expect(online?.scope).toBe("product");
    expect(online?.quantity).toBe(3);
    expect(presential?.scope).toBe("line");
  });
});
