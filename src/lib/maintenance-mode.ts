/**
 * Режим «техработы» для middleware (только синхронно из process.env — Edge).
 * Полный флаг с учётом AppSetting: getMaintenanceFlags() в appSettings.
 */

export function isMaintenanceModeEnv(): boolean {
  const v = process.env.MAINTENANCE_MODE?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

/** Разрешить /admin при MAINTENANCE (после проверки JWT и роли в middleware). */
export function isMaintenanceAllowAdminEnv(): boolean {
  const v = process.env.MAINTENANCE_ALLOW_ADMIN?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}
