/** Дата в формате 25.04.2026 */
export function formatRuDate(d: Date): string {
  return d.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Формат суммы в тенге для UI (неразрывный пробел перед знаком). */
export function formatKzt(amount: number): string {
  return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(amount)}\u00a0₸`;
}
