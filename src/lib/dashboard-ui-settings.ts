/** Карточка «Тариф» (подписка Plan) на /dashboard — только если явно включено в App settings. */
export function isDashboardSubscriptionPlanUiEnabled(value: unknown): boolean {
  return value === true;
}
