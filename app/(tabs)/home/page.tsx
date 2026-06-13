import { AlertTriangle } from "lucide-react";

import { EmptyState } from "@/components/fairy/EmptyState";
import { WorkspaceTabs } from "@/components/fairy/WorkspaceTabs";
import {
  WorkflowViewer,
  defaultWorkflowSteps,
} from "@/components/fairy/WorkflowViewer";
import { buildSeedCouple } from "@/lib/db/seed";
import type { CoupleWorkspace } from "@/lib/db/types";

/**
 * Home — the Couple Workspace (Her / His / Together views) plus the seven-step
 * workflow viewer (Req 1, 7.2). Data comes from the seeded couple via the pure
 * `buildSeedCouple` builder so the screen renders standalone (the DB-backed
 * load and live per-step workflow status are wired by Person B / Task 19).
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
      {/* SEAM: pass real per-step status here once the Inngest run is wired. */}
      <WorkflowViewer steps={defaultWorkflowSteps()} />
    </div>
  );
}
