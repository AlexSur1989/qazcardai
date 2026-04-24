"use client";

import type { ReactNode } from "react";
import { SessionProvider } from "next-auth/react";

import { Toaster } from "@/components/ui/sonner";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <Toaster />
    </SessionProvider>
  );
}
