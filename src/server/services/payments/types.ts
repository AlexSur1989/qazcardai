export type CreateCheckoutResult =
  | { ok: true; url: string }
  | { ok: false; error: "not_configured" | "package_unavailable" };
