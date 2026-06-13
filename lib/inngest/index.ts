// ===========================================================================
// Inngest barrel (lib/inngest/index.ts) — Req 7
//
// Public surface for the Inngest layer: the client, the seven-step function(s)
// served by /api/inngest, and the plain testable pipeline + its types.
// ===========================================================================

export {
  inngest,
  INTAKE_COMPLETED_EVENT,
  type IntakeCompletedEventData,
} from "./client";

export { fairyIntakeWorkflow, functions } from "./functions";

export {
  runFairyWorkflow,
  defaultWorkflowDeps,
  buildAuthPacket,
  deriveRedFlags,
  buildPrepTasks,
  FairyWorkflowError,
  WORKFLOW_STEPS,
  stepExtractProfiles,
  stepComputeTryingWindow,
  stepDetectMissingData,
  stepCheckDurationRule,
  stepGenerateTasks,
  stepRunSimulatedCalls,
  stepBuildDoctorSummary,
  type WorkflowStepName,
  type StepRunner,
  type WorkflowDeps,
  type WorkflowContext,
  type WorkflowResult,
  type CallsOutput,
  type DoctorSummary,
} from "./workflow";
