export function tokenPackagePriceWarnings(
  packages: Array<{ priceKzt: number; totalTokens: number; isActive: boolean; name: string }>,
): string[] {
  const active = packages.filter((p) => p.isActive && p.totalTokens > 0);
  if (active.length < 2) return [];
  const ppt = active.map((p) => ({
    name: p.name,
    v: p.priceKzt / p.totalTokens,
  }));
  const sorted = [...ppt].sort((a, b) => a.v - b.v);
  const median = sorted[Math.floor(sorted.length / 2)]!.v;
  const warnings: string[] = [];
  for (const row of ppt) {
    if (median > 0 && Math.abs(row.v - median) / median > 0.45) {
      warnings.push(
        `Пакет «${row.name}»: ${row.v.toFixed(2)} ₸/токен сильно отличается от медианы ${median.toFixed(2)} ₸/токен.`,
      );
    }
  }
  return warnings;
}
