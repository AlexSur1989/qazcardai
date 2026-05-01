import { redirect } from "next/navigation";

import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { getFreshSessionUser } from "@/server/services/fresh-session-user";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const current = await getFreshSessionUser();
  if (!current.ok) {
    redirect("/auth/login?callbackUrl=/dashboard");
  }
  const user = current.user;

  return (
    <div className="bg-background flex min-h-screen w-full flex-1 flex-col md:flex-row">
      <DashboardSidebar userEmail={user.email} />
      <div className="min-h-0 min-w-0 flex-1 bg-[#e8f5f9] px-4 py-6 md:px-6 md:py-8 lg:px-8">
        <div className="mx-auto w-full max-w-5xl">{children}</div>
      </div>
    </div>
  );
}
