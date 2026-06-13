import * as React from "react";

import { PhoneFrame } from "@/components/fairy/PhoneFrame";
import { StickyHeader } from "@/components/fairy/StickyHeader";
import { DisclaimerFooter } from "@/components/fairy/DisclaimerFooter";
import { IntakeForm } from "@/components/fairy/IntakeForm";

export const metadata = {
  title: "Intake · Fairy",
};

/**
 * The dual intake screen (Task 13). It lives outside the (tabs) route group —
 * this is the pre-onboarding step before the four-tab workspace — so it brings
 * its own phone-frame chrome and the single disclaimer line (Req 14.1). No
 * bottom tabs here: the screen is a focused, one-task flow.
 */
export default function IntakePage() {
  return (
    <PhoneFrame>
      <StickyHeader
        title="Tell Fairy about you both"
        subtitle="Her · His · Together"
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <main className="fairy-rise flex-1 px-5 py-4">
          <IntakeForm />
        </main>
        <DisclaimerFooter />
      </div>
    </PhoneFrame>
  );
}
