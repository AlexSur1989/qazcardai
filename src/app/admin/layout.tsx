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
    redirect("/auth/login?callbackUrl=/admin");
  }
  const user = current.user;

  return (
    <div className="bg-background flex w-full flex-1 flex-col md:flex-row">
      <Suspense fallback={<div className="bg-sidebar hidden w-full shrink-0 border-b md:block md:w-60 md:border-r" />}>
        <AdminSidebar userEmail={user.email} role={user.role} />
      </Suspense>
      <div className="min-h-0 min-w-0 flex-1 px-4 py-6 md:px-6 md:py-8 lg:px-8">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </div>
    </div>
  );
}
