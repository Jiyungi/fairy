import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { PhoneFrame } from "@/components/fairy/PhoneFrame";
import { StickyHeader } from "@/components/fairy/StickyHeader";
import { DisclaimerFooter } from "@/components/fairy/DisclaimerFooter";
import { DoctorSummary } from "@/components/fairy/DoctorSummary";
import { buildSeedCouple } from "@/lib/db/seed";
import { buildDoctorSummary } from "@/lib/summary/build";

/**
 * Doctor-ready Summary screen (Req 8). Its own route outside the (tabs) group,
 * so it composes the phone-frame chrome itself and renders exactly one
 * disclaimer line (Req 14.1).
 *
 * The summary is assembled on the server from the seeded couple via the pure
 * `buildDoctorSummary` assembler, then handed to the client `DoctorSummary`
 * component which renders it and offers the single copy-to-clipboard action.
 */
export default function SummaryPage() {
  let content: React.ReactNode;
  try {
    const workspace = buildSeedCouple();
    const summary = buildDoctorSummary(workspace);
    content = <DoctorSummary summary={summary} />;
  } catch {
    content = (
      <div className="rounded-xl border border-border/70 bg-card p-5 text-card-foreground shadow-card">
        <h2 className="text-base font-semibold text-foreground">
          Summary unavailable
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          We couldn&apos;t load the workspace data needed to build the summary.
        </p>
      </div>
    );
  }

  return (
    <PhoneFrame>
      <StickyHeader
        title="Doctor summary"
        subtitle="Ready to share at your visit"
        action={
          <Link
            href="/home"
            aria-label="Back to home"
            className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <ChevronLeft className="size-5" aria-hidden="true" />
          </Link>
        }
      />
      <div className="no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto">
        <main className="fairy-rise flex-1 px-5 py-4">{content}</main>
        <DisclaimerFooter />
      </div>
    </PhoneFrame>
  );
}
