// ===========================================================================
// Inngest client (lib/inngest/client.ts) — Req 7, 15.3
//
// The single Inngest client for the Fairy app. The seven-step workflow function
// (./functions) and the /api/inngest serve endpoint both import this instance.
//
// NOTE: constructing the client does NOT require a running Inngest dev server or
// any network access — the function logic is a thin wrapper over the plain,
// fully-testable pipeline in ./workflow (runFairyWorkflow).
// ===========================================================================

import { Inngest } from "inngest";

export const inngest = new Inngest({ id: "fairy" });

/** The single event that triggers the seven-step workflow (Req 2.6, 7.1). */
export const INTAKE_COMPLETED_EVENT = "fertility.intake.completed" as const;

/** Payload carried by the `fertility.intake.completed` event. */
export interface IntakeCompletedEventData {
  coupleId: string;
}
