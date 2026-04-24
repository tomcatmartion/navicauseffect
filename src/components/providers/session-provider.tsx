"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";

const SessionProvider = NextAuthSessionProvider as React.ComponentType<{
  children?: React.ReactNode;
}>;

export function AuthSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SessionProvider>{children}</SessionProvider>;
}
