import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    redirect("/auth/login?callbackUrl=/dashboard");
  }

  return (
    <div className="bg-background flex w-full flex-1 flex-col md:flex-row">
      <DashboardSidebar userEmail={session.user.email} />
      <div className="min-h-0 min-w-0 flex-1 px-4 py-6 md:px-6 md:py-8">
        {children}
      </div>
    </div>
  );
}
