export function toAlphabeticSuffix(index: number): string {
  let suffix = '';
  let cursor = index;

  do {
    suffix = String.fromCharCode(65 + (cursor % 26)) + suffix;
    cursor = Math.floor(cursor / 26) - 1;
  } while (cursor >= 0);

  return suffix;
}

export function nextAvailableOrdinal(usedOrdinals: number[]): number {
  const occupied = new Set(usedOrdinals);
  let ordinal = 0;

  while (occupied.has(ordinal)) {
    ordinal += 1;
  }

  return ordinal;
}
