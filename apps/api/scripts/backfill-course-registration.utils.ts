export type BalancedBatch = {
  id: string;
  sortOrder: number;
};

export function pickLeastOccupiedBatch<T extends BalancedBatch>(
  batches: T[],
  countByBatchId: Map<string, number>,
  capacity: number
): T | undefined {
  const available = batches.filter(
    (batch) => (countByBatchId.get(batch.id) ?? 0) < capacity
  );

  return [...available].sort((a, b) => {
    const countDifference =
      (countByBatchId.get(a.id) ?? 0) - (countByBatchId.get(b.id) ?? 0);
    return countDifference || a.sortOrder - b.sortOrder;
  })[0];
}
