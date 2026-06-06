export type CompositionScope = "line" | "product";

export type CompositionMergeRow = {
  id: string;
  childProductId: string;
  quantity: number;
  quantityUnit: string | null;
  compositionType: string;
  packagingChannel: string | null;
  required: boolean;
  isDefault: boolean;
  notes: string | null;
  unitCostSnapshotCents: number | null;
  totalCostSnapshotCents: number | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

export type MergedCompositionRow = CompositionMergeRow & {
  scope: CompositionScope;
  sourceCompositionId: string;
};

export function compositionNaturalKey(row: {
  compositionType: string;
  childProductId: string;
  packagingChannel: string | null;
}): string {
  const channel = row.compositionType === "packaging" ? (row.packagingChannel ?? "") : "";
  return `${row.compositionType}|${row.childProductId}|${channel}`;
}

/**
 * Merge linha + produto: mesma chave natural → produto substitui linha;
 * linhas só no produto são aditivas.
 */
export function mergeEffectiveComposition(
  lineRows: CompositionMergeRow[],
  productRows: CompositionMergeRow[],
): MergedCompositionRow[] {
  const byKey = new Map<string, MergedCompositionRow>();

  for (const row of lineRows) {
    if (row.archivedAt) continue;
    const key = compositionNaturalKey(row);
    byKey.set(key, {
      ...row,
      scope: "line",
      sourceCompositionId: row.id,
    });
  }

  for (const row of productRows) {
    if (row.archivedAt) continue;
    const key = compositionNaturalKey(row);
    byKey.set(key, {
      ...row,
      scope: "product",
      sourceCompositionId: row.id,
    });
  }

  return [...byKey.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
