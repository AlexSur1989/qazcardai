"use client";

import type { ReactNode } from "react";
import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";

import { Toaster } from "@/components/ui/sonner";

type Props = {
  children: ReactNode;
  /** Начальная сессия с сервера (App Router) — без «мигания» Вход/Регистрация до fetch /api/auth/session */
  session?: Session | null;
};

export function AppProviders({ children, session }: Props) {
  return (
    <SessionProvider session={session ?? undefined} refetchOnWindowFocus>
      {children}
      <Toaster />
    </SessionProvider>
  );
}
