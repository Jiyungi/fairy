import * as React from "react";

import { cn } from "@/lib/utils";

/** The fixed mobile frame width Fairy is designed against. */
export const PHONE_WIDTH = 390;

interface PhoneFrameProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Enforces Fairy's 390px mobile frame (Req 13.4). On a phone the frame fills
 * the viewport edge-to-edge; on a larger screen it floats as a device-like
 * column centered on a calm backdrop so the demo reads as a real app, not a
 * stretched desktop page.
 */
export function PhoneFrame({ children, className }: PhoneFrameProps) {
  return (
    <div className="flex min-h-dvh w-full justify-center bg-secondary/40 sm:py-6">
      <div
        data-testid="phone-frame"
        style={{ width: PHONE_WIDTH, maxWidth: "100%" }}
        className={cn(
          "relative flex min-h-dvh w-full flex-col overflow-hidden bg-background",
          // Device chrome only when there's room to float the frame.
          "sm:min-h-[844px] sm:rounded-[2.5rem] sm:border sm:border-border sm:shadow-card",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
