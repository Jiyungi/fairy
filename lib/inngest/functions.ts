// ===========================================================================
// Inngest seven-step function (lib/inngest/functions.ts) — Req 7.1, 7.2, 7.3
//
// THIN wrapper over the plain, fully-testable pipeline in ./workflow. The
// function is triggered by `fertility.intake.completed` and runs each of the
// seven steps inside `step.run`, so each step is a durable Inngest step that
// starts only after the prior completes (Req 7.1). All step ordering, status
// tracking (Req 7.2), and failure-halting (Req 7.3) live in runFairyWorkflow;
// here we only inject a `runStep` backed by `step.run`.
//
// No running Inngest dev server or network is required to TEST the logic —
// tests call runFairyWorkflow directly with mocked deps.
// ===========================================================================

import {
  inngest,
  INTAKE_COMPLETED_EVENT,
  type IntakeCompletedEventData,
} from "./client";
import { runFairyWorkflow, type StepRunner } from "./workflow";

export const fairyIntakeWorkflow = inngest.createFunction(
  { id: "fairy-intake-workflow", name: "Fairy intake → seven-step workflow" },
  { event: INTAKE_COMPLETED_EVENT },
  async ({ event, step }) => {
    const data = (event.data ?? {}) as Partial<IntakeCompletedEventData>;
    const coupleId = data.coupleId ?? "couple_001";

    // Back each pipeline step with a durable Inngest step (Req 7.1).
    const runStep: StepRunner = <T>(name: string, body: () => Promise<T>) =>
      step.run(name, body) as unknown as Promise<T>;

    const { run } = await runFairyWorkflow(coupleId, { runStep });
    return { coupleId, status: run.status, steps: run.steps };
  },
);

/** All Inngest functions served by the /api/inngest endpoint. */
export const functions = [fairyIntakeWorkflow];
