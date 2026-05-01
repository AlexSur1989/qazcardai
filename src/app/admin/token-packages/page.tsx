import { prisma } from "@/lib/prisma";
import { TokenPackagesAdmin } from "@/components/admin/token-packages-admin";
import { listAllTokenPackagesForAdmin } from "@/server/services/token-packages-catalog";

export const metadata = { title: "Пакеты токенов — QazCard AI" };

export default async function AdminTokenPackagesPage() {
  const packages = await listAllTokenPackagesForAdmin();
  const users = await prisma.user.findMany({
    take: 500,
    orderBy: { email: "asc" },
    select: { id: true, email: true },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Пакеты токенов</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        Каталог пакетов (₸) и токенов. Покупка: Stripe → webhook. Ручное начисление
        — для тестов.
      </p>
      <div className="mt-6">
        <TokenPackagesAdmin packages={packages} users={users} />
      </div>
    </div>
  );
}
