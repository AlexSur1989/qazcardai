import { PageHeader } from "@/components/layout/page-header";
import {
  ProviderMonitorClient,
  type ProvidersPageInitial,
} from "@/components/admin/provider-monitor-client";
import { getKieMonitorStatusPayload } from "@/server/services/providerMonitor";
import { requireAdminPagePermission } from "@/server/guards/admin-page-guard";
import { hasPermission } from "@/lib/permissions";

export const metadata = {
  title: "Провайдеры — QazCard AI",
};

function toClientPayload(
  data: Awaited<ReturnType<typeof getKieMonitorStatusPayload>>,
): ProvidersPageInitial {
  return {
    provider: data.provider,
    baseUrl: data.baseUrl,
    apiKeyConfigured: data.apiKeyConfigured,
    apiKeyMasked: data.apiKeyMasked,
    mockKie: data.mockKie,
    mockKieFail: data.mockKieFail,
    canRunRealKieGenerations: data.canRunRealKieGenerations,
    lastCheck: data.lastCheck,
    lastErrors: data.lastErrors.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    })),
    recentRequests: data.recentRequests.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    })),
    stats: data.stats,
  };
}

export default async function AdminProvidersPage() {
  const user = await requireAdminPagePermission("providers.view");
  const payload = await getKieMonitorStatusPayload();
  const initial = toClientPayload(payload);
  const canRunConnectionCheck = hasPermission(user.role, "providers.manage");

  return (
    <div className="space-y-8">
      <PageHeader
        title="Провайдеры / Providers"
        description="Контроль подключения, баланса и ошибок AI-провайдеров. / Connection, balance, and AI provider errors."
      />
      <ProviderMonitorClient
        initial={initial}
        canRunConnectionCheck={canRunConnectionCheck}
      />
    </div>
  );
}
