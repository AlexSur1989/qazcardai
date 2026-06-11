import { redirect } from "next/navigation";

import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { getDashboardNavItemsForRole } from "@/lib/dashboard-nav";
import { getFreshSessionUser } from "@/server/services/fresh-session-user";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const current = await getFreshSessionUser();
  if (!current.ok) {
    redirect("/login?next=/dashboard");
  }
  const user = current.user;

  return (
    <div className="bg-background flex min-h-screen w-full min-w-0 flex-1 flex-col md:flex-row">
      <DashboardSidebar userEmail={user.email} navItems={getDashboardNavItemsForRole(user.role)} />
      <div className="min-h-0 min-w-0 flex-1 overflow-x-clip bg-[#e8f5f9] px-4 py-6 md:px-6 md:py-8 lg:px-8">
        <div className="mx-auto w-full max-w-5xl min-w-0">{children}</div>
      </div>
    </div>
  );
}
