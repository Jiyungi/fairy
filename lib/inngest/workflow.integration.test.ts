// ===========================================================================
// Integration test (example-based) — Task 10.2
//   Workflow orchestration for the Fairy seven-step Inngest workflow.
//
// With the Grok/Voice agent fully MOCKED (no network, no Inngest server), this
// asserts the three orchestration guarantees of runFairyWorkflow:
//
//   1. SEQUENTIAL EXECUTION (Req 7.1): the seven steps run in the documented
//      WORKFLOW_STEPS order, and step N+1 starts only after step N completes
//      (no interleaving of start/end markers).
//   2. STATUS TRANSITIONS (Req 7.2): every persisted run snapshot shows each
//      step progressing pending -> running -> completed, with all statuses
//      always within the enum {pending, running, completed, failed}, ending in
//      a completed run.
//   3. FAILURE HALTING (Req 7.3): when a step fails, the workflow rejects with a
//      FairyWorkflowError identifying that step, the step is marked failed with
//      an error, the run is failed with the right failedStep, every subsequent
//      step stays pending, and later-step dependencies are never invoked.
//
// A fourth sanity check reproduces the Seed_Couple (couple_001) derived outputs
// (Req 7.6 / 3.2-3.4) using the real rules core with only the agent mocked.
//
// Validates: Requirements 7.1, 7.2, 7.3
// ===========================================================================

import { describe, it, expect, vi } from "vitest";

import {
  runFairyWorkflow,
  WORKFLOW_STEPS,
  FairyWorkflowError,
  type StepRunner,
  type WorkflowDeps,
} from "@/lib/inngest/workflow";
import { getCouple as realGetCouple } from "@/lib/db";
import type { Summary } from "@/lib/db";
import type { ClinicWriteBackResult } from "@/lib/agent";
import { CLINIC_RESULT, INSURANCE_RESULT } from "@/lib/reference";
import type {
  CalendarEvent,
  CallOutput,
  ClinicResult,
  InsuranceResult,
  Task,
  TryingWindow,
  WorkflowRun,
  WorkflowStepStatus,
} from "@/lib/types";

const VALID_STATUSES: readonly WorkflowStepStatus[] = [
  "pending",
  "running",
  "completed",
  "failed",
] as const;

// --- Deterministic mocked agent outputs (no network) ------------------------

function makeInsuranceOutput(): CallOutput<InsuranceResult> {
  return { transcript: [], result: INSURANCE_RESULT, usedFallback: true };
}

function makeClinicOutput(): CallOutput<ClinicResult> {
  return { transcript: [], result: CLINIC_RESULT, usedFallback: true };
}

function makeWriteBack(): ClinicWriteBackResult {
  const calendarEvent: CalendarEvent = {
    id: "event_couple_001_consult",
    couple_id: "couple_001",
    type: CLINIC_RESULT.calendar_event.type,
    title: `Fertility consult — ${CLINIC_RESULT.booked.clinic}`,
    date: CLINIC_RESULT.calendar_event.date,
    time: CLINIC_RESULT.calendar_event.time,
    description: "mocked",
  };
  const summary: Summary = { couple_id: "couple_001", sections: {} };
  return { tasks: [], calendarEvent, summary };
}

// --- Test harness: build injectable deps with recording spies ---------------

interface Harness {
  deps: Partial<WorkflowDeps>;
  /** start:/end: markers in the order the runStep runner observed them. */
  events: string[];
  /** Names of the agent dependencies invoked, in call order. */
  callOrder: string[];
  /** Deep-cloned snapshots of every saveWorkflowRun call. */
  snapshots: WorkflowRun[];
  runInsuranceCall: ReturnType<typeof vi.fn>;
  runClinicCall: ReturnType<typeof vi.fn>;
  applyClinicWriteBack: ReturnType<typeof vi.fn>;
}

/**
 * Build a fully-mocked dependency set. `getCouple` uses the real in-memory data
 * layer (couple_001) so the rules core runs against the true seed; everything
 * else is a recording spy. `overrides` lets a test swap a single dependency to
 * inject a failure.
 */
function buildHarness(overrides: Partial<WorkflowDeps> = {}): Harness {
  const events: string[] = [];
  const callOrder: string[] = [];
  const snapshots: WorkflowRun[] = [];

  const runStep: StepRunner = async (name, body) => {
    events.push(`start:${name}`);
    const result = await body();
    events.push(`end:${name}`);
    return result;
  };

  const runInsuranceCall = vi.fn(async (): Promise<CallOutput<InsuranceResult>> => {
    callOrder.push("insurance");
    return makeInsuranceOutput();
  });
  const runClinicCall = vi.fn(async (): Promise<CallOutput<ClinicResult>> => {
    callOrder.push("clinic");
    return makeClinicOutput();
  });
  const applyClinicWriteBack = vi.fn(async (): Promise<ClinicWriteBackResult> => {
    callOrder.push("writeBack");
    return makeWriteBack();
  });

  const saveWorkflowRun = vi.fn(async (run: WorkflowRun): Promise<WorkflowRun> => {
    snapshots.push(structuredClone(run));
    return run;
  });
  const saveTryingWindow = vi.fn(async (w: TryingWindow): Promise<TryingWindow> => w);
  const saveTasks = vi.fn(async (_id: string, items: Task[]): Promise<Task[]> => items);

  const deps: Partial<WorkflowDeps> = {
    getCouple: realGetCouple,
    runStep,
    runInsuranceCall,
    runClinicCall,
    applyClinicWriteBack,
    saveWorkflowRun,
    saveTryingWindow,
    saveTasks,
    ...overrides,
  };

  return {
    deps,
    events,
    callOrder,
    snapshots,
    runInsuranceCall,
    runClinicCall,
    applyClinicWriteBack,
  };
}

// ===========================================================================
// 1. SEQUENTIAL EXECUTION (Req 7.1)
// ===========================================================================

describe("workflow orchestration — sequential execution (Req 7.1)", () => {
  it("runs the seven steps in WORKFLOW_STEPS order with no interleaving", async () => {
    const h = buildHarness();

    const { run, context } = await runFairyWorkflow("couple_001", h.deps);

    // The steps started in exactly the documented order.
    const startedOrder = h.events
      .filter((e) => e.startsWith("start:"))
      .map((e) => e.slice("start:".length));
    expect(startedOrder).toEqual([...WORKFLOW_STEPS]);

    // No interleaving: each step's end immediately follows its own start, i.e.
    // the full marker stream is start:s1,end:s1,start:s2,end:s2,...
    const expectedMarkers = WORKFLOW_STEPS.flatMap((name) => [
      `start:${name}`,
      `end:${name}`,
    ]);
    expect(h.events).toEqual(expectedMarkers);

    // Step N+1 only began after step N ended.
    for (let i = 0; i < WORKFLOW_STEPS.length - 1; i++) {
      const endN = h.events.indexOf(`end:${WORKFLOW_STEPS[i]}`);
      const startNext = h.events.indexOf(`start:${WORKFLOW_STEPS[i + 1]}`);
      expect(endN).toBeGreaterThanOrEqual(0);
      expect(startNext).toBeGreaterThan(endN);
    }

    // The agent dependencies ran in order within the calls step.
    expect(h.callOrder).toEqual(["insurance", "clinic", "writeBack"]);

    // The run completed with all seven steps completed.
    expect(run.status).toBe("completed");
    expect(run.steps).toHaveLength(7);
    expect(run.steps.every((s) => s.status === "completed")).toBe(true);
    expect(context.summary).toBeDefined();
  });
});

// ===========================================================================
// 2. STATUS TRANSITIONS (Req 7.2)
// ===========================================================================

describe("workflow orchestration — status transitions (Req 7.2)", () => {
  it("progresses each step pending -> running -> completed within the enum", async () => {
    const h = buildHarness();

    const { run } = await runFairyWorkflow("couple_001", h.deps);

    // We captured at least one snapshot per transition.
    expect(h.snapshots.length).toBeGreaterThan(0);

    // Every status in every snapshot is a member of the enum.
    for (const snap of h.snapshots) {
      for (const step of snap.steps) {
        expect(VALID_STATUSES).toContain(step.status);
      }
      expect(VALID_STATUSES).toContain(snap.status as WorkflowStepStatus);
    }

    // For each step, the distinct statuses observed (in order) are exactly
    // pending -> running -> completed.
    for (let i = 0; i < WORKFLOW_STEPS.length; i++) {
      const distinctInOrder: WorkflowStepStatus[] = [];
      for (const snap of h.snapshots) {
        const status = snap.steps[i].status;
        if (distinctInOrder[distinctInOrder.length - 1] !== status) {
          distinctInOrder.push(status);
        }
      }
      expect(distinctInOrder).toEqual(["pending", "running", "completed"]);
    }

    // The final persisted run is completed.
    const finalSnap = h.snapshots[h.snapshots.length - 1];
    expect(finalSnap.status).toBe("completed");
    expect(run.status).toBe("completed");
  });
});

// ===========================================================================
// 3. FAILURE HALTING (Req 7.3)
// ===========================================================================

describe("workflow orchestration — failure halting (Req 7.3)", () => {
  it("halts at the failed step (run-simulated-calls) and leaves later steps pending", async () => {
    const failingInsurance = vi.fn(async (): Promise<CallOutput<InsuranceResult>> => {
      throw new Error("Grok Voice unavailable");
    });
    const h = buildHarness({ runInsuranceCall: failingInsurance });

    // The failed step is step 6 "run-simulated-calls".
    const failedIndex = WORKFLOW_STEPS.indexOf("run-simulated-calls");
    const failedStepNumber = failedIndex + 1;

    let error: unknown;
    try {
      await runFairyWorkflow("couple_001", h.deps);
    } catch (e) {
      error = e;
    }

    // Rejected with a FairyWorkflowError identifying the failed step.
    expect(error).toBeInstanceOf(FairyWorkflowError);
    const fwErr = error as FairyWorkflowError;
    expect(fwErr.step).toBe(failedStepNumber);
    expect(fwErr.stepName).toBe("run-simulated-calls");

    // Inspect the last persisted run snapshot.
    const finalSnap = h.snapshots[h.snapshots.length - 1];
    expect(finalSnap.status).toBe("failed");
    expect(finalSnap.failedStep).toBe(failedStepNumber);

    const failedStep = finalSnap.steps[failedIndex];
    expect(failedStep.status).toBe("failed");
    expect(failedStep.error).toBeTruthy();

    // Every subsequent step stayed pending (never ran).
    for (let i = failedIndex + 1; i < WORKFLOW_STEPS.length; i++) {
      expect(finalSnap.steps[i].status).toBe("pending");
    }

    // Later-step dependencies inside the failing step were never reached.
    expect(h.runClinicCall).not.toHaveBeenCalled();
    expect(h.applyClinicWriteBack).not.toHaveBeenCalled();
  });

  it("halts at step 1 (extract-profiles) when getCouple returns null", async () => {
    const nullCouple = vi.fn(async () => null);
    const h = buildHarness({ getCouple: nullCouple });

    let error: unknown;
    try {
      await runFairyWorkflow("couple_001", h.deps);
    } catch (e) {
      error = e;
    }

    expect(error).toBeInstanceOf(FairyWorkflowError);
    const fwErr = error as FairyWorkflowError;
    expect(fwErr.step).toBe(1);
    expect(fwErr.stepName).toBe("extract-profiles");

    const finalSnap = h.snapshots[h.snapshots.length - 1];
    expect(finalSnap.status).toBe("failed");
    expect(finalSnap.failedStep).toBe(1);
    expect(finalSnap.steps[0].status).toBe("failed");
    expect(finalSnap.steps[0].error).toBeTruthy();

    // Steps 2..7 never ran.
    for (let i = 1; i < WORKFLOW_STEPS.length; i++) {
      expect(finalSnap.steps[i].status).toBe("pending");
    }

    // No agent dependency was ever invoked.
    expect(h.runInsuranceCall).not.toHaveBeenCalled();
    expect(h.runClinicCall).not.toHaveBeenCalled();
    expect(h.applyClinicWriteBack).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// 4. SEED REPRODUCTION sanity (Req 7.6 / 3.2-3.4)
// ===========================================================================

describe("workflow orchestration — seed reproduction sanity (Req 7.6)", () => {
  it("reproduces the Seed_Couple duration rule and trying window", async () => {
    const h = buildHarness();

    const { context } = await runFairyWorkflow("couple_001", h.deps);

    // Trying-duration rule: Maya is 33 (< 35) -> 12-month threshold, and red
    // flags (irregular cycles + borderline semen) force early evaluation.
    expect(context.duration).toBeDefined();
    expect(context.duration?.thresholdMonths).toBe(12);
    expect(context.duration?.recommendEarlyEvaluation).toBe(true);

    // Trying window: Jun 27 – Jul 18 2026, priority Jul 2 – Jul 17, confidence Low.
    expect(context.window).toBeDefined();
    expect(context.window?.fertileWindowStart).toBe("2026-06-27");
    expect(context.window?.fertileWindowEnd).toBe("2026-07-18");
    expect(context.window?.minOvulation).toBe("2026-07-02");
    expect(context.window?.maxOvulation).toBe("2026-07-17");
    expect(context.window?.confidence).toBe("Low");
  });
});
