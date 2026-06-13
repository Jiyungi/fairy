// ===========================================================================
// Fairy seven-step workflow — testable core (lib/inngest/workflow.ts)
//   — Req 7.1, 7.2, 7.3, 7.4, 7.5, 7.6
//
// `runFairyWorkflow` is a PLAIN async function (no Inngest, no network). The
// Inngest function in ./functions is a thin wrapper that injects a `runStep`
// backed by `step.run`. Every external dependency (db + agent) is injectable so
// the integration test (Task 10.2) can mock Grok/agent and assert:
//   - sequential execution: each step starts only after the prior completes (7.1)
//   - status transitions: pending -> running -> completed | failed (7.2)
//   - failure halting: a thrown error marks THAT step failed, halts all later
//     steps, and surfaces an error identifying the failed step (7.3)
//
// The seven steps are small, independently-exported functions operating on a
// shared, accumulating context so they can be unit-tested in isolation.
// ===========================================================================

import {
  getCouple as dbGetCouple,
  saveTasks as dbSaveTasks,
  saveTryingWindow as dbSaveTryingWindow,
  saveWorkflowRun as dbSaveWorkflowRun,
  type SeedCouple,
} from "@/lib/db";
import {
  applyClinicWriteBack as agentApplyClinicWriteBack,
  runClinicCall as agentRunClinicCall,
  runInsuranceCall as agentRunInsuranceCall,
  type ClinicWriteBackResult,
} from "@/lib/agent";
import { checkDurationRule } from "@/lib/core/duration-rule";
import { detectMissingData } from "@/lib/core/missing-data";
import {
  computeTryingWindow,
  TryingWindowInputError,
} from "@/lib/core/trying-window";
import type {
  AuthPacket,
  CallOutput,
  ClinicResult,
  DataFlag,
  DurationResult,
  InsuranceResult,
  Task,
  TaskColumn,
  TryingWindow,
  TryingWindowOutput,
  WorkflowRun,
  WorkflowStepState,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Step definitions (the documented order — Req 7.1)
// ---------------------------------------------------------------------------

export const WORKFLOW_STEPS = [
  "extract-profiles",
  "compute-trying-window",
  "detect-missing-data",
  "check-duration-rule",
  "generate-tasks",
  "run-simulated-calls",
  "build-doctor-summary",
] as const;

export type WorkflowStepName = (typeof WORKFLOW_STEPS)[number];

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** Thrown when a workflow step fails; identifies the failed step (Req 7.3). */
export class FairyWorkflowError extends Error {
  constructor(
    public readonly step: number,
    public readonly stepName: string,
    public readonly cause: string,
  ) {
    super(`Workflow step ${step} (${stepName}) failed: ${cause}`);
    this.name = "FairyWorkflowError";
  }
}

// ---------------------------------------------------------------------------
// Injectable dependencies
// ---------------------------------------------------------------------------

/** Runs a single named unit of work. Default just invokes the body; the Inngest
 *  wrapper backs this with `step.run` so each step is a durable Inngest step. */
export type StepRunner = <T>(name: string, body: () => Promise<T>) => Promise<T>;

export interface WorkflowDeps {
  getCouple: (id: string) => Promise<SeedCouple | null>;
  saveTryingWindow: (window: TryingWindow) => Promise<TryingWindow>;
  saveTasks: (coupleId: string, tasks: Task[]) => Promise<Task[]>;
  saveWorkflowRun: (run: WorkflowRun) => Promise<WorkflowRun>;
  runInsuranceCall: (packet: AuthPacket) => Promise<CallOutput<InsuranceResult>>;
  runClinicCall: (packet: AuthPacket) => Promise<CallOutput<ClinicResult>>;
  applyClinicWriteBack: (
    coupleId: string,
    insuranceResult: InsuranceResult,
    clinicOutput: CallOutput<ClinicResult>,
    db?: undefined,
    insuranceOutput?: CallOutput<InsuranceResult>,
  ) => Promise<ClinicWriteBackResult>;
  runStep: StepRunner;
}

const defaultRunStep: StepRunner = (_name, body) => body();

/** Default dependencies wired to the real in-memory db + agent. */
export function defaultWorkflowDeps(): WorkflowDeps {
  return {
    getCouple: dbGetCouple,
    saveTryingWindow: dbSaveTryingWindow,
    saveTasks: dbSaveTasks,
    saveWorkflowRun: dbSaveWorkflowRun,
    runInsuranceCall: agentRunInsuranceCall,
    runClinicCall: agentRunClinicCall,
    applyClinicWriteBack: (coupleId, insuranceResult, clinicOutput, _db, insuranceOutput) =>
      agentApplyClinicWriteBack(
        coupleId,
        insuranceResult,
        clinicOutput,
        undefined,
        insuranceOutput,
      ),
    runStep: defaultRunStep,
  };
}

// ---------------------------------------------------------------------------
// Accumulating workflow context (each step adds its output)
// ---------------------------------------------------------------------------

export interface CallsOutput {
  insurance: CallOutput<InsuranceResult>;
  clinic: CallOutput<ClinicResult>;
  writeBack: ClinicWriteBackResult;
}

export interface DoctorSummary {
  couple_id: string;
  partners: {
    her: { name: string; age: number };
    him: { name: string; age: number };
  };
  trying_window: TryingWindowOutput;
  missing_data: DataFlag[];
  duration: DurationResult;
  coverage: {
    status: string;
    verified: boolean;
    facts: InsuranceResult;
  };
  appointment: ClinicResult["booked"] | "pending";
  bring_list: string[];
}

export interface WorkflowContext {
  coupleId: string;
  couple?: SeedCouple;
  window?: TryingWindowOutput;
  flags?: DataFlag[];
  duration?: DurationResult;
  tasks?: Task[];
  calls?: CallsOutput;
  summary?: DoctorSummary;
}

export interface WorkflowResult {
  run: WorkflowRun;
  context: WorkflowContext;
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** Build the agent authorization packet from the couple's Together data. */
export function buildAuthPacket(couple: SeedCouple): AuthPacket {
  const c = couple.couple;
  const holder = couple.members.find((m) => m.role === c.policy_holder);
  return {
    couple_id: c.id,
    member_id: c.member_id,
    dob: holder?.dob ?? "",
    provider: c.insurance_provider,
    plan_type: c.plan_type,
    group_number: c.group_number,
    policy_holder: c.policy_holder,
  };
}

/**
 * Derive the red-flag conditions for the Trying-Duration rule (Req 7.5, 7.6).
 * Grounded in the seed/missing-data:
 *   - irregular cycles when `cycle_regular === false`
 *   - known PCOS / endometriosis only when CONFIRMED (suspected does not count)
 *   - borderline semen analysis (known male factor) when the detector flagged
 *     any semen parameter below its WHO 2021 limit
 */
export function deriveRedFlags(couple: SeedCouple, flags: DataFlag[]): string[] {
  const red: string[] = [];

  if (couple.herProfile.cycle_regular === false) {
    red.push("irregular cycles");
  }

  const conditions = couple.herProfile.conditions.map((c) => c.toLowerCase());
  const isConfirmed = (c: string) => !c.includes("suspected") && !c.includes("not confirmed");
  if (conditions.some((c) => c.includes("pcos") && isConfirmed(c))) {
    red.push("known PCOS");
  }
  if (conditions.some((c) => c.includes("endometriosis") && isConfirmed(c))) {
    red.push("known endometriosis");
  }

  const borderlineSemen = flags.some(
    (f) => f.kind === "borderline" && f.source.includes("semen"),
  );
  if (borderlineSemen) {
    red.push("borderline semen analysis");
  }

  return red;
}

/** Column for a prep task derived from a missing-data flag (exactly one column). */
function columnForFlag(flag: DataFlag): TaskColumn {
  if (flag.source.includes("female-hormone")) return "her";
  if (flag.source.includes("semen")) return "him";
  return "together";
}

/** Build her/his/together prep tasks from the detector flags + duration outcome. */
export function buildPrepTasks(
  coupleId: string,
  flags: DataFlag[],
  duration: DurationResult,
): Task[] {
  const tasks: Task[] = [];
  let i = 0;

  for (const flag of flags) {
    const column = columnForFlag(flag);
    const verb =
      flag.kind === "missing" ? "Complete" : flag.kind === "borderline" ? "Repeat" : "Verify";
    tasks.push({
      id: `task_${coupleId}_prep_${i++}`,
      couple_id: coupleId,
      column,
      title: `${verb} ${flag.label} — ${flag.explanation}`,
      completed: false,
      weight: column === "him" ? 5 : 0,
      source_call_record_id: null,
    });
  }

  if (duration.recommendEarlyEvaluation) {
    const reason =
      duration.redFlags.length > 0
        ? `red flags: ${duration.redFlags.join(", ")}`
        : `trying duration meets the ${duration.thresholdMonths}-month threshold`;
    tasks.push({
      id: `task_${coupleId}_prep_${i++}`,
      couple_id: coupleId,
      column: "together",
      title: `Schedule an early fertility evaluation (${reason}).`,
      completed: false,
      weight: 0,
      source_call_record_id: null,
    });
  }

  return tasks;
}

// ---------------------------------------------------------------------------
// The seven step bodies (small, independently-testable)
// ---------------------------------------------------------------------------

/** Step 1 — load the couple's profiles from the data layer (Req 7.1). */
export async function stepExtractProfiles(
  ctx: WorkflowContext,
  deps: WorkflowDeps,
): Promise<SeedCouple> {
  const couple = await deps.getCouple(ctx.coupleId);
  if (!couple) {
    throw new Error(`No couple found for id "${ctx.coupleId}"`);
  }
  ctx.couple = couple;
  return couple;
}

/** Step 2 — compute the trying window from her cycle inputs only (Req 3, 7.1). */
export async function stepComputeTryingWindow(
  ctx: WorkflowContext,
  deps: WorkflowDeps,
): Promise<TryingWindowOutput> {
  const couple = requireCouple(ctx);
  const her = couple.herProfile;

  // Ovulation is "confirmed" only with a mid-luteal progesterone result (Req 3.5).
  const ovulationConfirmed = her.mid_luteal_progesterone !== null;

  let window: TryingWindowOutput;
  try {
    window = computeTryingWindow({
      lastPeriodStart: her.last_period_start,
      cycleLengthMin: her.cycle_length_min,
      cycleLengthMax: her.cycle_length_max,
      ovulationConfirmed,
    });
  } catch (err) {
    if (err instanceof TryingWindowInputError) {
      throw new Error(`Trying-window input invalid: ${err.message}`);
    }
    throw err;
  }

  const record: TryingWindow = {
    id: `window_${ctx.coupleId}`,
    couple_id: ctx.coupleId,
    fertile_window_start: window.fertileWindowStart,
    fertile_window_end: window.fertileWindowEnd,
    min_ovulation: window.minOvulation,
    max_ovulation: window.maxOvulation,
    confidence: window.confidence,
    reasons: window.reasons,
  };
  await deps.saveTryingWindow(record);

  ctx.window = window;
  return window;
}

/** Step 3 — detect missing/borderline/unverified data (Req 4, 7.1). */
export async function stepDetectMissingData(
  ctx: WorkflowContext,
  _deps: WorkflowDeps,
): Promise<DataFlag[]> {
  const couple = requireCouple(ctx);
  const her = couple.herProfile;
  const him = couple.himProfile;

  const flags = detectMissingData({
    labs: {
      day3_fsh: her.day3_fsh,
      day3_estradiol: her.day3_estradiol,
      mid_luteal_progesterone: her.mid_luteal_progesterone,
      prolactin: her.prolactin,
    },
    semen: {
      volume_ml: him.volume_ml,
      concentration_million_ml: him.concentration_million_ml,
      total_count_million: him.total_count_million,
      progressive_motility_pct: him.progressive_motility_pct,
      total_motility_pct: him.total_motility_pct,
      morphology_normal_pct: him.morphology_normal_pct,
      vitality_pct: him.vitality_pct,
      ph: him.ph,
    },
    coverage_status: couple.couple.coverage_status,
  });

  ctx.flags = flags;
  return flags;
}

/** Step 4 — apply the age-based threshold + red-flag override (Req 7.4–7.6). */
export async function stepCheckDurationRule(
  ctx: WorkflowContext,
  _deps: WorkflowDeps,
): Promise<DurationResult> {
  const couple = requireCouple(ctx);
  const flags = ctx.flags ?? [];
  const herMember = couple.members.find((m) => m.role === "her");
  const femaleAge = herMember?.age ?? 0;
  const redFlags = deriveRedFlags(couple, flags);

  const duration = checkDurationRule({
    femaleAge,
    monthsTrying: couple.herProfile.months_trying,
    redFlags,
  });

  ctx.duration = duration;
  return duration;
}

/** Step 5 — generate her/his/together tasks from flags + duration (Req 7.1, 5). */
export async function stepGenerateTasks(
  ctx: WorkflowContext,
  _deps: WorkflowDeps,
): Promise<Task[]> {
  const flags = ctx.flags ?? [];
  const duration = ctx.duration;
  if (!duration) {
    throw new Error("Duration result missing before task generation");
  }
  const tasks = buildPrepTasks(ctx.coupleId, flags, duration);
  ctx.tasks = tasks;
  return tasks;
}

/** Step 6 — run the simulated insurance + clinic calls and write back (Req 6, 7.1). */
export async function stepRunSimulatedCalls(
  ctx: WorkflowContext,
  deps: WorkflowDeps,
): Promise<CallsOutput> {
  const couple = requireCouple(ctx);
  const packet = buildAuthPacket(couple);

  const insurance = await deps.runInsuranceCall(packet);
  const clinic = await deps.runClinicCall(packet);
  const writeBack = await deps.applyClinicWriteBack(
    ctx.coupleId,
    insurance.result,
    clinic,
    undefined,
    insurance,
  );

  // Persist prep tasks (step 5) alongside the call-derived write-back tasks so
  // both survive in the data layer.
  const prepTasks = ctx.tasks ?? [];
  const combined = [...prepTasks, ...writeBack.tasks];
  await deps.saveTasks(ctx.coupleId, combined);
  ctx.tasks = combined;

  const calls: CallsOutput = { insurance, clinic, writeBack };
  ctx.calls = calls;
  return calls;
}

/** Step 7 — assemble the doctor-ready summary from the accumulated context. */
export async function stepBuildDoctorSummary(
  ctx: WorkflowContext,
  _deps: WorkflowDeps,
): Promise<DoctorSummary> {
  const couple = requireCouple(ctx);
  if (!ctx.window || !ctx.flags || !ctx.duration || !ctx.calls) {
    throw new Error("Cannot build summary before prior steps complete");
  }

  const herMember = couple.members.find((m) => m.role === "her");
  const himMember = couple.members.find((m) => m.role === "him");
  const coverageStatus = couple.couple.coverage_status;
  const insuranceResult = ctx.calls.insurance.result;
  const clinicResult = ctx.calls.clinic.result;

  const summary: DoctorSummary = {
    couple_id: ctx.coupleId,
    partners: {
      her: { name: herMember?.name ?? "", age: herMember?.age ?? 0 },
      him: { name: himMember?.name ?? "", age: himMember?.age ?? 0 },
    },
    trying_window: ctx.window,
    missing_data: ctx.flags,
    duration: ctx.duration,
    coverage: {
      status: coverageStatus,
      verified: coverageStatus === "confirmed",
      facts: insuranceResult,
    },
    appointment: clinicResult.booked ?? "pending",
    bring_list: clinicResult.bring_list ?? [],
  };

  ctx.summary = summary;
  return summary;
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

function requireCouple(ctx: WorkflowContext): SeedCouple {
  if (!ctx.couple) {
    throw new Error("Couple profiles not loaded");
  }
  return ctx.couple;
}

function initialRun(coupleId: string): WorkflowRun {
  const steps: WorkflowStepState[] = WORKFLOW_STEPS.map((name, i) => ({
    step: i + 1,
    name,
    status: "pending",
  }));
  return { couple_id: coupleId, steps, status: "pending" };
}

/**
 * Execute one step: mark it `running`, run the body via the injected runner,
 * mark `completed`, persisting the run on each transition (Req 7.2). On failure
 * the step is marked `failed`, the run is marked failed with the failed step,
 * and a FairyWorkflowError is thrown to halt the pipeline (Req 7.3).
 */
async function executeStep<T>(
  run: WorkflowRun,
  index: number,
  deps: WorkflowDeps,
  body: () => Promise<T>,
): Promise<T> {
  const stepState = run.steps[index];
  stepState.status = "running";
  run.status = "running";
  await deps.saveWorkflowRun(run);

  try {
    const result = await deps.runStep(stepState.name, body);
    stepState.status = "completed";
    await deps.saveWorkflowRun(run);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    stepState.status = "failed";
    stepState.error = message;
    run.status = "failed";
    run.failedStep = stepState.step;
    await deps.saveWorkflowRun(run);
    throw new FairyWorkflowError(stepState.step, stepState.name, message);
  }
}

/**
 * Run the full seven-step Fairy workflow for a couple. Steps run strictly
 * sequentially — each starts only after the prior completes (Req 7.1). A failure
 * halts all subsequent steps (Req 7.3). All dependencies are injectable so the
 * integration test can mock the agent/db and assert ordering + status + halting.
 *
 * Throws FairyWorkflowError if a step fails; the persisted WorkflowRun records
 * which step failed and why.
 */
export async function runFairyWorkflow(
  coupleId: string,
  overrides: Partial<WorkflowDeps> = {},
): Promise<WorkflowResult> {
  const deps: WorkflowDeps = { ...defaultWorkflowDeps(), ...overrides };
  const ctx: WorkflowContext = { coupleId };
  const run = initialRun(coupleId);
  await deps.saveWorkflowRun(run);

  await executeStep(run, 0, deps, () => stepExtractProfiles(ctx, deps));
  await executeStep(run, 1, deps, () => stepComputeTryingWindow(ctx, deps));
  await executeStep(run, 2, deps, () => stepDetectMissingData(ctx, deps));
  await executeStep(run, 3, deps, () => stepCheckDurationRule(ctx, deps));
  await executeStep(run, 4, deps, () => stepGenerateTasks(ctx, deps));
  await executeStep(run, 5, deps, () => stepRunSimulatedCalls(ctx, deps));
  await executeStep(run, 6, deps, () => stepBuildDoctorSummary(ctx, deps));

  run.status = "completed";
  await deps.saveWorkflowRun(run);

  return { run, context: ctx };
}
