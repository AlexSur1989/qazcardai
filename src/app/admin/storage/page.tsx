import { PageHeader } from "@/components/layout/page-header";
import {
  StorageMonitorClient,
  type StoragePageInitial,
} from "@/components/admin/storage-monitor-client";
import { getStorageStatusPayload } from "@/server/services/storageMonitor";
import { getFreshAdminSessionUser } from "@/server/services/fresh-session-user";

export const metadata = {
  title: "Хранилище — QazCard AI",
};

function toInitial(
  p: Awaited<ReturnType<typeof getStorageStatusPayload>>,
): StoragePageInitial {
  return {
    config: p.config,
    stats: p.stats,
    recentFiles: p.recentFiles as StoragePageInitial["recentFiles"],
    largestFiles: p.largestFiles as StoragePageInitial["largestFiles"],
    warnings: p.warnings,
  };
}

export default async function AdminStoragePage() {
  const session = await getFreshAdminSessionUser();
  const raw = await getStorageStatusPayload();
  const initial = toInitial(raw);
  const canRunStorageCheck =
    session.ok && session.user.role === "SUPER_ADMIN";
  const isProduction = process.env.NODE_ENV === "production";

  return (
    <div className="space-y-8">
      <PageHeader
        title="Хранилище / Storage Monitor"
        description="Контроль S3/R2, загруженных файлов и публичных URL. / S3/R2, uploads, and public URLs."
      />
      <StorageMonitorClient
        initial={initial}
        canRunStorageCheck={canRunStorageCheck}
        isProduction={isProduction}
      />
    </div>
  );
}
