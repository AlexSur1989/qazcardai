/** Real Kie classifier HTTP calls разрешены только при явном env gate. */
export function isClassifierRuntimeEnabled(): boolean {
  return process.env.PRODUCT_CLASSIFIER_ALLOW_REAL_KIE === "true";
}

/** Для admin UI: enabled / disabled без раскрытия значения env. */
export function classifierRuntimeGateLabel(): "enabled" | "disabled" {
  return isClassifierRuntimeEnabled() ? "enabled" : "disabled";
}
