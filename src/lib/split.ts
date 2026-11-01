// Splits `amount` evenly. Rounding leftovers (a paisa or two) go to the first
// people in the list, so the shares always add up to exactly `amount`.
export function splitEqually(amount: number, ids: string[]): Record<string, number> {
  const base = Math.floor(amount / ids.length);
  let leftover = amount - base * ids.length;
  const shares: Record<string, number> = {};
  for (const id of ids) {
    shares[id] = base + (leftover > 0 ? 1 : 0);
    if (leftover > 0) leftover--;
  }
  return shares;
}

// Splits `amount` by percentage. `basisPoints` must add up to 10000 (100%).
// Uses largest-remainder rounding so the shares add up to exactly `amount`.
export function splitByPercentage(
  amount: number,
  basisPoints: Record<string, number>,
): Record<string, number> {
  const parts = Object.entries(basisPoints).map(([id, bp]) => {
    const exact = amount * bp;
    const remainder = exact % 10000;
    return { id, floor: (exact - remainder) / 10000, remainder };
  });

  const shares: Record<string, number> = {};
  let assigned = 0;
  for (const part of parts) {
    shares[part.id] = part.floor;
    assigned += part.floor;
  }

  const byRemainder = [...parts].sort((a, b) => b.remainder - a.remainder);
  for (let i = 0; i < amount - assigned; i++) shares[byRemainder[i].id] += 1;
  return shares;
}

export function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
