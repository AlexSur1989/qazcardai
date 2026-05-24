import { randomBytes } from "node:crypto";

export function buildManualPaymentInstructionCode(prefix: string): string {
  const p = prefix.replace(/[^A-Za-z0-9]/g, "").toUpperCase() || "QAZCARD";
  const rand = randomBytes(3).toString("hex").toUpperCase().slice(0, 5);
  return `${p}-${rand}`;
}
