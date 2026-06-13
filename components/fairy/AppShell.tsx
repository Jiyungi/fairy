"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import { PhoneFrame } from "./PhoneFrame";
import { StickyHeader } from "./StickyHeader";
import { BottomTabs } from "./BottomTabs";
import { DisclaimerFooter } from "./DisclaimerFooter";

interface ScreenMeta {
  title: string;
  subtitle?: string;
}

/** Per-screen header copy. Plain language, scoped to the seed couple. */
const SCREEN_META: Record<string, ScreenMeta> = {
  "/home": { title: "Maya & Daniel", subtitle: "Your shared fertility prep" },
  "/calendar": { title: "Calendar", subtitle: "Trying window & priority days" },
  "/tasks": { title: "Tasks", subtitle: "Her · His · Together" },
  "/chat": { title: "Ask Fairy", subtitle: "Answers grounded in your data" },
};

function metaFor(pathname: string): ScreenMeta {
  const key = Object.keys(SCREEN_META).find(
    (href) => pathname === href || pathname.startsWith(`${href}/`),
  );
  return key ? SCREEN_META[key] : { title: "Fairy" };
}

/**
 * Composes the phone-frame chrome around tab content: a per-screen sticky
 * header, a scrollable content region, the single disclaimer line, and the
 * bottom tab bar. Used by the (tabs) route group layout.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/home";
  const { title, subtitle } = metaFor(pathname);

  return (
    <PhoneFrame>
      <StickyHeader title={title} subtitle={subtitle} />
      <div className="flex flex-1 flex-col overflow-y-auto">
        <main key={pathname} className="fairy-rise flex-1 px-5 py-4">
          {children}
        </main>
        <DisclaimerFooter />
      </div>
      <BottomTabs />
    </PhoneFrame>
  );
}
