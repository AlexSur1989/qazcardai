import { Suspense } from "react";
import { redirect } from "next/navigation";

import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { getFreshAdminSessionUser } from "@/server/services/fresh-session-user";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const current = await getFreshAdminSessionUser();
  if (!current.ok) {
    if (current.reason === "forbidden") {
      redirect("/dashboard");
    }
    redirect("/login?next=/admin");
  }
  const user = current.user;

  return (
    <div className="bg-background flex w-full min-w-0 flex-1 flex-col overflow-x-hidden md:min-h-0 md:flex-row">
      <Suspense
        fallback={
          <div className="bg-sidebar text-sidebar-foreground hidden w-full shrink-0 overflow-x-hidden border-b md:sticky md:top-14 md:block md:h-[calc(100dvh-3.5rem)] md:max-h-[calc(100dvh-3.5rem)] md:w-64 md:min-w-64 md:border-r md:border-b-0" />
        }
      >
        <AdminSidebar userEmail={user.email} role={user.role} />
      </Suspense>
      <div className="relative z-0 min-h-0 min-w-0 flex-1 bg-[#e8f5f9] px-4 py-6 md:px-6 md:py-8 lg:px-8">
        <div className="mx-auto w-full min-w-0 max-w-6xl">{children}</div>
      </div>
    </div>
  );
}
