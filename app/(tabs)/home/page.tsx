import { AlertTriangle } from "lucide-react";

import { EmptyState } from "@/components/fairy/EmptyState";
import { WorkspaceTabs } from "@/components/fairy/WorkspaceTabs";
import {
  WorkflowViewer,
  defaultWorkflowGraph,
} from "@/components/fairy/WorkflowViewer";
import { BookingApprovalCard } from "@/components/fairy/BookingApprovalCard";
import { buildSeedCouple } from "@/lib/db/seed";
import type { CoupleWorkspace } from "@/lib/db/types";

/**
 * Home — the Couple Workspace (Her / His / Together views) plus the event-driven
 * workflow viewer and the human-in-the-loop booking approval card (Req 1, 7.2,
 * 17, 20). Data comes from the seeded couple via the pure `buildSeedCouple`
 * builder so the screen renders standalone; the live per-step workflow status,
 * the live Call_Console, and the real `couple.booking.approved` emit are wired
 * by Person B (Tasks 24, 25) — here they render their standalone snapshot.
 *
 * If the seed cannot be built the workspace refuses to render partially and
 * shows a load-error indication instead (Req 1.7).
 */
export default function HomePage() {
  let workspace: CoupleWorkspace;
  try {
    workspace = buildSeedCouple();
  } catch {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Workspace can't be loaded"
        description="Your couple data couldn't be read. Reload to try again — Fairy won't show a partial workspace."
      />
    );
  }

  return (
    <div className="space-y-5">
      <WorkspaceTabs workspace={workspace} />
      {/* Event-driven graph: parallel fan-out branches + the paused approval
          gate. SEAM: Person B feeds live per-step status by id (Task 25). */}
      <WorkflowViewer graph={defaultWorkflowGraph()} />
      {/* Human-in-the-loop pause made actionable. SEAM: Person B passes an
          emitter that calls inngest.send("couple.booking.approved") (Task 25). */}
      <BookingApprovalCard coupleId={workspace.couple.id} />
    </div>
  );
}
