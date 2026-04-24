import { Suspense } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { canAccessAdminPanel } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    redirect("/auth/login?callbackUrl=/admin");
  }
  if (!canAccessAdminPanel(session.user.role)) {
    redirect("/dashboard");
  }

  return (
    <div className="bg-background flex w-full flex-1 flex-col md:flex-row">
      <Suspense fallback={<div className="bg-sidebar hidden w-full shrink-0 border-b md:block md:w-60 md:border-r" />}>
        <AdminSidebar userEmail={session.user.email} role={session.user.role} />
      </Suspense>
      <div className="min-h-0 min-w-0 flex-1 px-4 py-6 md:px-6 md:py-8">
        {children}
      </div>
    </div>
  );
}
