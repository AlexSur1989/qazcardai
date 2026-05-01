import { PageHeader } from "@/components/layout/page-header";
import {
  ProviderMonitorClient,
  type ProvidersPageInitial,
} from "@/components/admin/provider-monitor-client";
import { getKieMonitorStatusPayload } from "@/server/services/providerMonitor";
import { getFreshAdminSessionUser } from "@/server/services/fresh-session-user";

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
  const payload = await getKieMonitorStatusPayload();
  const initial = toClientPayload(payload);
  const session = await getFreshAdminSessionUser();
  const canRunConnectionCheck =
    session.ok && session.user.role === "SUPER_ADMIN";

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
