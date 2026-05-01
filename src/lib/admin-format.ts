export function formatAdminDateTime(d: Date | string): string {
  const x = typeof d === "string" ? new Date(d) : d;
  return x.toLocaleString("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function truncate(s: string, max = 64): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}
