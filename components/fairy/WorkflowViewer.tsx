import * as React from "react";
import { Check, Circle, Loader2, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardHeader } from "./Card";
import { Chip } from "./MissingFlag";

/*
  WorkflowViewer — the visible face of the seven-step Inngest workflow (Req
  7.1, 7.2). It renders each step with a pending / running / completed /
  failed status chip so the orchestration reads as credible during the demo.

  SEAM FOR PERSON B: the actual workflow run lives in `lib/inngest` (not on
  this branch). This component owns only the *view* and its `WorkflowStep[]`
  shape. Feed real per-step status by passing `steps` derived from the
  persisted Inngest step statuses (one WorkflowStep per WORKFLOW_STEPS entry,
  same `id`s, with `status` updated as each step transitions). With no props
  it renders a sensible standalone default (all seven steps pending).
*/

/** Status of a single workflow step (Req 7.2). */
export type WorkflowStepStatus = "pending" | "running" | "completed" | "failed";

/** A single workflow step as rendered by the viewer. */
export interface WorkflowStep {
  id: string;
  label: string;
  status: WorkflowStepStatus;
}

/**
 * The seven steps, in execution order (Req 7.1). Each step starts only after
 * the prior one completes; the ids are stable join keys for Person B's
 * Inngest status feed.
 */
export const WORKFLOW_STEPS: readonly { id: string; label: string }[] = [
  { id: "extract-profiles", label: "Extract profiles" },
  { id: "compute-window", label: "Compute trying window" },
  { id: "detect-missing", label: "Detect missing data" },
  { id: "duration-rule", label: "Check trying-duration rule" },
  { id: "generate-tasks", label: "Generate her / his / together tasks" },
  { id: "run-calls", label: "Run simulated insurance & clinic calls" },
  { id: "build-summary", label: "Build doctor summary" },
] as const;

/** A standalone default: all seven steps pending, so the screen renders alone. */
export function defaultWorkflowSteps(): WorkflowStep[] {
  return WORKFLOW_STEPS.map((step) => ({ ...step, status: "pending" }));
}

const STATUS_META: Record<
  WorkflowStepStatus,
  { label: string; tone: React.ComponentProps<typeof Chip>["tone"] }
> = {
  pending: { label: "Pending", tone: "neutral" },
  running: { label: "Running", tone: "info" },
  completed: { label: "Done", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
};

function StepIcon({ status }: { status: WorkflowStepStatus }) {
  const base = "flex size-7 shrink-0 items-center justify-center rounded-full";
  switch (status) {
    case "completed":
      return (
        <span className={cn(base, "bg-success/15 text-success")}>
          <Check className="size-4" strokeWidth={2.6} aria-hidden="true" />
        </span>
      );
    case "running":
      return (
        <span className={cn(base, "bg-info/12 text-info")}>
          <Loader2
            className="size-4 animate-spin motion-reduce:animate-none"
            strokeWidth={2.4}
            aria-hidden="true"
          />
        </span>
      );
    case "failed":
      return (
        <span className={cn(base, "bg-destructive/12 text-destructive")}>
          <X className="size-4" strokeWidth={2.6} aria-hidden="true" />
        </span>
      );
    default:
      return (
        <span className={cn(base, "bg-secondary text-muted-foreground")}>
          <Circle className="size-3" strokeWidth={2.4} aria-hidden="true" />
        </span>
      );
  }
}

interface WorkflowViewerProps {
  steps?: WorkflowStep[];
  className?: string;
}

/**
 * Renders the seven workflow steps as an ordered vertical stepper, each with
 * its status chip. If a step has failed, an inline notice names the failed
 * step (Req 7.3).
 */
export function WorkflowViewer({ steps, className }: WorkflowViewerProps) {
  const resolved = steps && steps.length > 0 ? steps : defaultWorkflowSteps();
  const failedIndex = resolved.findIndex((s) => s.status === "failed");

  return (
    <Card className={className} aria-labelledby="workflow-heading">
      <CardHeader
        title="Workflow"
        description="How Fairy turns your intake into a plan."
      />

      <ol className="mt-4">
        {resolved.map((step, index) => {
          const meta = STATUS_META[step.status];
          const isLast = index === resolved.length - 1;
          return (
            <li
              key={step.id}
              data-testid={`workflow-step-${step.id}`}
              data-status={step.status}
              className="relative flex items-center gap-3 pb-4 last:pb-0"
            >
              {/* Connector line between markers (decorative). */}
              {!isLast ? (
                <span
                  aria-hidden="true"
                  className="absolute left-[13.5px] top-8 h-[calc(100%-1rem)] w-px bg-border"
                />
              ) : null}

              <StepIcon status={step.status} />

              <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                <p className="min-w-0 text-sm font-medium text-foreground">
                  <span className="tabular-nums text-muted-foreground">
                    {index + 1}.
                  </span>{" "}
                  {step.label}
                </p>
                <Chip tone={meta.tone}>{meta.label}</Chip>
              </div>
            </li>
          );
        })}
      </ol>

      {failedIndex >= 0 ? (
        <p
          role="alert"
          className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive"
        >
          Step {failedIndex + 1} ({resolved[failedIndex].label}) failed.
          Remaining steps are paused.
        </p>
      ) : null}
    </Card>
  );
}
