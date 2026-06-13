import * as React from "react";

import { AppShell } from "@/components/fairy/AppShell";

/**
 * Wraps every tab screen (Home / Calendar / Tasks / Chat) in the shared
 * phone-frame chrome: 390px frame, per-screen sticky header, bottom tabs,
 * and the single disclaimer line.
 */
export default function TabsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
