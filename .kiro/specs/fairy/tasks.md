# Implementation Plan: Fairy

## Overview

This plan implements Fairy in TypeScript on Next.js (App Router) with Tailwind + shadcn/ui (governed by the Impeccable skill), Inngest, Supabase, and the Grok / Grok Voice adapter with a deterministic Mock_Fallback safety net. It follows the design's "pure core, impure shell" structure: the deterministic rules core (trying-window, missing-data, duration, readiness, extractors) is built and property-tested first, then the data layer, the **live agentic** Voice_Agent, the **event-driven reactive** Inngest graph, and the UI are layered on and wired into the sub-three-minute demo path.

Two architectural shifts from the prior revision shape this plan:

1. **Live agentic voice, not a scripted responder.** The Voice_Agent runs a real `Live_Voice_Session` over a WebSocket (`XAI_VOICE_WS_URL` / `XAI_VOICE_MODEL`), speaking its own questions and listening to a live human, then extracts the structured result from the **real** transcript. `call-scripts.md` is a set of Call_Objectives (10 insurance / 7 clinic), not a verbatim script. The deterministic Mock_Fallback engages **only** when the live session is unavailable or fails mid-call.
2. **An event-driven reactive Inngest graph, not a linear sequence.** Analysis steps and phone calls fan out into parallel branches and join; the workflow pauses at an Approval_Gate (`waitForEvent`); it schedules a delayed Check_In (`step.sleep`/`step.sleepUntil`); and a separate Reactive_Summary_Function reacts to `call.completed` to refresh the doctor summary. Four Workflow_Events drive the graph: `fertility.intake.completed`, `call.completed`, `couple.booking.approved`, `checkin.due`.

Property-based tests use `fast-check` + Vitest and each references a numbered design property (1–31). The live-voice properties are tested against transcript fixtures fed to the extractor plus a mocked `LiveVoiceSession` seam; the workflow-orchestration properties are tested against a deterministic step harness with mocked `step.run` / `waitForEvent` / `step.sleep`. All clinical literals come from `/reference-data/`.

## Ownership

Per requirements.md and design.md, Fairy is built by two people working in parallel. Tasks are split as follows. Owner labels apply to the top-level task and all its sub-tasks (including optional `*` test sub-tasks) unless a sub-task is individually labeled.

- **Person A — Product & Data/UI:** Task 1 (project setup), Task 2.2 + 2.3 (validation schemas + test), Task 3 (trying-window), Task 4 (missing-data), Task 5 (duration/readiness), Task 8 (data model + seed), Task 12 (UI shell), Task 13 (intake forms), Task 14 (workspace views + agent-visualization surfaces: reactive WorkflowViewer, Approval card, Live Call UI), Task 15 (task board, incl. Check_In re-test render), Task 16 (calendar), Task 17 (summary, incl. appointment pending-until-approval state).
- **Person B — Agent & Workflow:** Task 2.1 (reference constants + Call_Objectives), Task 7 (transcript extractors), Task 9 (live agentic Voice_Agent: `LiveVoiceSession` + agentic turn policy + real-transcript extraction + Mock_Fallback safety net), Task 10 (event-driven reactive Inngest graph: parallel fan-out/fan-in, Approval_Gate `waitForEvent`, scheduled Check_In, Reactive_Summary_Function, four Workflow_Events), Task 18 (grounded chat), Task 19 (end-to-end wiring + config/README, incl. `/api/booking` and serving both Inngest functions).
- **Both:** Checkpoints Task 6, Task 11, and Task 20.

Note: Task 2 is split at the sub-task level — 2.1 is owned by Person B while 2.2 and 2.3 are owned by Person A — so its owners are annotated on the sub-tasks rather than the parent.

## Tasks

- [ ] 1. Set up project structure and tooling (Owner: Person A)
  - [ ] 1.1 Initialize the Next.js app and toolchain
    - Scaffold Next.js (App Router) + TypeScript project with the `app/`, `lib/`, `components/`, and `supabase/` directory layout from the design
    - Add Tailwind CSS and shadcn/ui, the Inngest client dependency, and the Supabase client dependency
    - Configure Vitest and `fast-check` for property-based testing (min 100 generated cases per property)
    - Add `.env.local` handling stubs for `XAI_API_KEY` with `GROK_API_KEY` fallback, plus `XAI_VOICE_WS_URL`, `XAI_VOICE_MODEL`, `CHECKIN_DELAY`, and `APPROVAL_WAIT_TIMEOUT` (no secret values committed)
    - _Requirements: 15.1, 15.2, 15.3, 15.7_

- [ ] 2. Encode reference data and validation (Owner: split — see sub-tasks)
  - [x] 2.1 Build the reference constants layer and Call_Objectives (Owner: Person B)
    - Create `lib/reference/` typed constants for WHO 2021 limits, female hormone windows/targets, CPT codes, duration rule, the sperm-regeneration horizon (~72-day / 10–12-week, drives Check_In copy), and clinic slots, sourced verbatim from the files in `/reference-data/`
    - Encode the `call-scripts.md` content as **Call_Objectives** (10 insurance / 7 clinic) — objectives to obtain, NOT a verbatim script — plus the insurance/clinic result schemas the agent must fill
    - Encode the Seed_Couple "Maya & Daniel" fixture and the Human_Presenter cue-sheet values (deductible $1,500, in-network lab "Crest Diagnostics", June 25 slot) from `sample-couple.md`, `insurance-coverage-data.md`, and `clinic-intake-data.md`
    - _Requirements: 12.1, 12.2, 12.3, 11.3_

  - [ ] 2.2 Implement intake validation schemas (Owner: Person A)
    - Create `lib/validation/` Zod schemas for Her, His, and Together fields with field names and bounds identical to `sample-couple.md`
    - Enforce enumerations (`semen_analysis_status`, `policy_holder`, `coverage_known`) and WHO 2021 / reference-range bounds; reject out-of-range values with errors naming the field and expected range
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.7, 2.8_

  - [ ]* 2.3 Write property test for intake validation (Owner: Person A)
    - **Property 11: Intake validation rejects out-of-range values**
    - **Validates: Requirements 2.7, 2.8**

- [ ] 3. Implement the Trying-Window engine (Owner: Person A)
  - [ ] 3.1 Implement `lib/core/trying-window.ts`
    - Implement `computeTryingWindow` using only female inputs and the irregular-cycle algorithm; compute confidence/reasons; throw a typed `TryingWindowInputError` on missing/invalid required input while preserving prior state
    - _Requirements: 3.1, 3.4, 3.5, 3.6, 3.7_

  - [ ]* 3.2 Write property test for window algebra
    - **Property 1: Trying-window algebraic relationships**
    - **Validates: Requirements 3.1**

  - [ ]* 3.3 Write property test for low-confidence reasons
    - **Property 2: Low-confidence reasons when unconfirmed and wide**
    - **Validates: Requirements 3.4, 3.5**

  - [ ]* 3.4 Write property test for male-data independence
    - **Property 3: Ovulation timing ignores male data**
    - **Validates: Requirements 3.6**

  - [ ]* 3.5 Write property test for invalid-input rejection
    - **Property 4: Trying-window rejects invalid required input**
    - **Validates: Requirements 3.7**

  - [ ]* 3.6 Write unit test for the seed-couple worked example
    - Assert fertile window Jun 27 – Jul 18, 2026; priority Jul 2 – Jul 17, 2026; confidence "Low"
    - _Requirements: 3.2, 3.3, 3.4_

- [ ] 4. Implement the Missing-Data detector (Owner: Person A)
  - [ ] 4.1 Implement `lib/core/missing-data.ts`
    - Apply rule-based checks for day-3 FSH, day-3 estradiol, mid-luteal progesterone, prolactin, each WHO 2021 semen parameter, and insurance coverage status; produce a consolidated checklist of flags with grounded explanations and source file
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [ ]* 4.2 Write property test for missing-lab flags
    - **Property 5: Missing labs are flagged with grounded explanations**
    - **Validates: Requirements 4.2, 4.3, 4.4**

  - [ ]* 4.3 Write property test for semen-parameter flags
    - **Property 6: Semen parameters flagged borderline iff below WHO 2021 limit**
    - **Validates: Requirements 4.5**

  - [ ]* 4.4 Write property test for insurance flag
    - **Property 7: Insurance flagged unverified iff not confirmed**
    - **Validates: Requirements 4.6**

  - [ ]* 4.5 Write property test for checklist completeness
    - **Property 8: Checklist completeness**
    - **Validates: Requirements 4.1, 4.7**

- [ ] 5. Implement the Duration rule and Readiness score (Owner: Person A)
  - [ ] 5.1 Implement `lib/core/duration-rule.ts`
    - Apply the age-based threshold (under 35 → 12 months, 35+ → 6 months) and force early evaluation on any red flag
    - _Requirements: 7.7, 7.8_

  - [ ]* 5.2 Write property test for the age threshold
    - **Property 13: Duration threshold by age**
    - **Validates: Requirements 7.7**

  - [ ]* 5.3 Write property test for red-flag override
    - **Property 14: Red flags force early evaluation**
    - **Validates: Requirements 7.8**

  - [ ] 5.4 Implement `lib/core/readiness.ts`
    - Implement `applyTaskCompletion` that increases the score on completion and clamps the integer result to [0, 100]
    - _Requirements: 1.4, 5.4_

  - [ ]* 5.5 Write property test for readiness bounds
    - **Property 9: Readiness score stays an integer within [0, 100]**
    - **Validates: Requirements 1.4, 5.4**

- [ ] 6. Checkpoint - Ensure all rules-core tests pass (Owner: Both)
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement structured-result extractors (Owner: Person B)
  - [x] 7.1 Implement `lib/core/extract.ts`
    - Implement insurance and clinic extractors that parse a chronological transcript (the real live human conversation, or the Mock_Fallback transcript) to the exact `call-scripts.md` schemas; assign each created task to exactly one Her/His/Together column; mark unextractable fields unresolved + add a follow-up task while preserving extracted fields
    - _Requirements: 6.4, 6.5, 6.6, 6.8, 5.2, 5.5_

  - [x]* 7.2 Write property test for task column assignment
    - **Property 10: Every task is assigned to exactly one column**
    - **Validates: Requirements 5.2, 5.5**

  - [x]* 7.3 Write property test for unresolved-field isolation
    - **Property 17: Unresolved fields are isolated**
    - **Validates: Requirements 6.8**

- [ ] 8. Implement the data model and seeding (Owner: Person A)
  - [ ] 8.1 Create Supabase migrations
    - Define the eight core entities (couple, member, her_profile, him_profile, trying_window, task, calendar_event, call_record) plus the orchestration tables `workflow_run` / `workflow_step` and `check_in`; the `call_record` includes `transcript_stream` and `used_fallback`; `null` represents MISSING
    - _Requirements: 11.1_

  - [ ] 8.2 Implement Supabase client, queries, and seed loader
    - Implement `lib/db/` client and queries; implement the seed loader that writes Maya & Daniel exactly as in `sample-couple.md`; on missing/unparseable seed, refuse partial render and signal a load error
    - _Requirements: 11.2, 11.3, 1.6, 1.7_

  - [ ]* 8.3 Write property test for persistence round-trip
    - **Property 25: Persistence round-trip preserves values**
    - **Validates: Requirements 11.3**

  - [ ]* 8.4 Write smoke test for seed population
    - Assert migrations create all eight core entities plus `workflow_run`/`workflow_step` and `check_in`, and the seed populates `couple_001`
    - _Requirements: 11.1, 11.2_

- [x] 9. Implement the live agentic Voice_Agent and Mock_Fallback safety net (Owner: Person B)
  - [x] 9.1 Implement `lib/agent/live.ts`, the agentic turn policy, and the Mock_Fallback
    - Implement the `LiveVoiceSession` WebSocket seam (`connect` via `XAI_VOICE_WS_URL`/`XAI_VOICE_MODEL`, `speak` TTS prompts, `onHumanTurn` receive transcribed human turns, `partialTranscript` stream to the UI) and an agentic turn policy (`nextQuestion` picks the next unmet objective from the remaining Call_Objectives plus couple-data/missing-data context, phrases it itself, accepts answers in any order/wording, skips answered objectives, asks deeper follow-ups on vague answers)
    - `runInsuranceCall` / `runClinicCall` loop speak→listen until objectives are satisfied, then extract the structured result from the REAL transcript and map it to the `call-scripts.md` schema; apply guardrails (withhold member_id/DOB until the human requests verification; decline medical-decision requests and add a follow-up task)
    - Engage the deterministic Mock_Fallback ONLY when the live session is unavailable or fails mid-call, setting `usedFallback = true`; on clinic completion write back her/his/together tasks, a 2026-06-25 calendar event, and a coverage+appointment+bring-list summary
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.9, 6.10, 6.11, 6.12, 6.13, 15.2, 15.5_

  - [x]* 9.2 Write property test for call-output schema
    - **Property 15: Call output conforms to its schema**
    - **Validates: Requirements 6.7**

  - [x]* 9.3 Write property test for Mock_Fallback engagement and determinism
    - **Property 20: Mock_Fallback engages only on live failure and is deterministic**
    - **Validates: Requirements 6.12, 6.13**

  - [x]* 9.4 Write property test for identity withholding
    - **Property 18: Identity details withheld until verification requested**
    - **Validates: Requirements 6.10**

  - [x]* 9.5 Write property test for medical-decision declines
    - **Property 19: Medical-decision requests are declined**
    - **Validates: Requirements 6.11**

  - [x]* 9.6 Write unit test for Call_Objectives coverage and clinic write-back
    - Assert the agent satisfies the 10 insurance / 7 clinic Call_Objectives from a representative live-style transcript (regardless of answer order) and writes back the Jun 25 event + tasks + summary on clinic completion
    - _Requirements: 6.2, 6.4, 6.5, 6.9_

  - [ ]* 9.7 Write property test for any-order live-transcript parsing
    - **Property 16: Live result is parsed from the human transcript regardless of order or wording**
    - Tested against generated transcript fixtures (answers in randomized order and varied wording) fed to the extractor
    - **Validates: Requirements 6.3, 6.6**

- [ ] 10. Implement the event-driven reactive Inngest graph (Owner: Person B)
  - [x] 10.1 Implement `lib/inngest/` client, Workflow_Events, and the reactive main workflow
    - Define the four Workflow_Events (`fertility.intake.completed`, `call.completed`, `couple.booking.approved`, `checkin.due`)
    - Implement the main function triggered by `fertility.intake.completed` as a reactive graph: analyze-her | analyze-his run concurrently via `Promise.all` and join (fan-in) → compute window → detect missing data → check duration rule → generate her/his/together tasks → insurance call | clinic booking call run as parallel branches (live voice) that both complete before proceeding (fan-in) → emit `call.completed` per call → `waitForEvent('couple.booking.approved', { timeout: APPROVAL_WAIT_TIMEOUT })` at the Approval_Gate (status `paused`, appointment `pending`; on expiry keep pending + surface "needs approval") → idempotent finalize booking + 2026-06-25 calendar event (no double-book) → `step.sleepUntil(CHECKIN_DELAY)` → emit `checkin.due` → create the His re-test task + reminder → build/refresh the doctor summary
    - Persist a `pending | running | completed | failed | paused` status per step; on failure mark the step failed, halt dependent steps, and surface the failed step
    - _Requirements: 7.1, 7.2, 7.3, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10, 17.1, 17.3, 17.4, 17.5, 17.6, 18.1, 18.3, 18.4, 5.7, 19.1, 19.4_

  - [x]* 10.2 Write integration test for the reactive graph
    - With a mocked agent and a mocked `LiveVoiceSession`, assert the fan-out/fan-in for both branch-pairs, status enum transitions including `paused`, failure halting, the Approval_Gate pause/resume on `couple.booking.approved`, `waitForEvent` timeout behavior, and the `step.sleep`/`checkin.due` schedule
    - _Requirements: 7.1, 7.2, 7.3, 7.5, 7.6, 17.1, 17.5, 18.1, 18.4, 19.4_

  - [ ] 10.3 Implement the separate Reactive_Summary_Function
    - Implement a second Inngest function, decoupled from the main run, that listens for `call.completed` and refreshes the grounded Doctor_Summary using that call's extracted result, grounding every clinical statement only in Reference_Data and omitting anything absent
    - _Requirements: 19.2, 19.3, 19.5_

  - [ ]* 10.4 Write property test for parallel fan-in
    - **Property 21: Parallel branches both complete before the workflow proceeds past a fan-in**
    - Tested against a deterministic step harness with mocked `step.run`
    - **Validates: Requirements 7.2, 7.3**

  - [ ]* 10.5 Write property test for idempotent approval resume
    - **Property 22: Approval resume is idempotent and never double-books**
    - **Validates: Requirements 17.3**

  - [ ]* 10.6 Write property test for appointment pending state
    - **Property 23: Appointment stays pending until approval or timeout**
    - **Validates: Requirements 17.4, 17.5, 8.6**

  - [ ]* 10.7 Write property test for the reactive summary
    - **Property 24: Reactive summary fires on every call.completed**
    - **Validates: Requirements 19.2, 19.3**

- [ ] 11. Checkpoint - Ensure core, data, agent, and workflow tests pass (Owner: Both)
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. Build the Impeccable UI shell (Owner: Person A)
  - [ ] 12.1 Implement phone-frame shell components
    - Build `PhoneFrame` (390px), `BottomTabs` (Home/Calendar/Tasks/Chat), `StickyHeader`, app-like cards, and a single `DisclaimerFooter` line via the Impeccable skill; complete a critique.md pass; no generic Tailwind fallback
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 14.1, 14.2_

  - [ ]* 12.2 Write property test for the disclaimer/clutter rule
    - **Property 31: Single disclaimer, no synthetic-data clutter**
    - **Validates: Requirements 14.1, 14.2**

  - [ ]* 12.3 Write structural render test for the shell
    - Assert the 390px frame and the four bottom tabs render
    - _Requirements: 13.4_

- [ ] 13. Implement the dual intake forms (Owner: Person A)
  - [ ] 13.1 Build the Her/His/Together intake forms
    - Render structured fields only, wired to the validation schemas; reject invalid entries inline (retain prior value, name field + range); on both intakes complete and valid, emit `fertility.intake.completed` exactly once
    - _Requirements: 2.1, 2.6, 2.8_

  - [ ]* 13.2 Write property test for the completion event
    - **Property 12: Intake completion event fires exactly once**
    - **Validates: Requirements 2.6**

- [ ] 14. Implement the Couple Workspace views and agent-visualization surfaces (Owner: Person A)
  - [ ] 14.1 Build Her/His/Together views and the reactive WorkflowViewer
    - Render the three scoped views (profiles, labs, semen results vs WHO limits, Readiness_Score 0–100, shared insurance/goal/concern/tasks) and the `WorkflowViewer` that reads per-step status; render MISSING values as missing-data flags
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.8, 5.3, 7.5_

  - [ ]* 14.2 Write property test for MISSING rendering
    - **Property 29: MISSING values render as flags**
    - **Validates: Requirements 1.8**

  - [ ] 14.3 Build the parallel-branch WorkflowViewer lanes and paused state
    - Render the two fan-out pairs (analyze-her/analyze-his and insurance-call/clinic-call) as side-by-side concurrent lanes that show both branches `running` simultaneously, render the paused Approval_Gate state, and show the scheduled Check_In sleep; draw branches sharing a fan-out node as parallel lanes until their shared fan-in node
    - _Requirements: 7.4, 7.5, 19.4_

  - [ ] 14.4 Build the Approval-card UI
    - Show the approval card while the workflow is paused stating the agent verified coverage and found a June 25 slot; selecting Approve calls `/api/booking`, which emits `couple.booking.approved`
    - _Requirements: 17.2, 17.3_

  - [ ] 14.5 Build the Live Call UI (`app/call/`)
    - Show the live transcript as agent/human turns appear, a LIVE-versus-FALLBACK indicator reflecting `usedFallback`, and the structured-result fields filling in as they are extracted
    - _Requirements: 6.14_

- [ ] 15. Implement the Task delegation board (Owner: Person A)
  - [ ] 15.1 Build the TaskBoard
    - Render exactly three columns (Her/His/Together); create follow-up tasks from extracted call results into a single column each; on extraction failure create no tasks and show a failure indication; on male-track task completion update the Readiness_Score within [0, 100]
    - _Requirements: 5.1, 5.2, 5.4, 5.5, 5.6_

  - [ ] 15.2 Render the His re-test task when the Check_In fires
    - When `checkin.due` creates the "re-test semen analysis / review lifestyle progress" task, render it in the His column with its reminder
    - _Requirements: 5.7_

- [ ] 16. Implement the Shared Calendar (Owner: Person A)
  - [ ] 16.1 Build the CalendarView
    - Display the trying window, priority days, reminders, the Jun 25, 2026 consult, and tasks; show event detail on selection; use the Trying_Window_Engine output as the single source of truth and update when it changes; on unavailable engine output show an error and retain previously loaded data
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [ ]* 16.2 Write property test for calendar/engine date equality
    - **Property 30: Calendar dates equal engine output**
    - **Validates: Requirements 10.3, 10.4**

- [ ] 17. Implement the Doctor-ready Summary (Owner: Person A)
  - [ ] 17.1 Build the summary endpoint and UI
    - Assemble both partners' data, trying window + confidence, missing tests, doctor questions, verified coverage facts, and the Jun 25 consult; single-operation copy to clipboard; ground all clinical statements in Reference_Data and omit absent values; label coverage `unverified` when applicable
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ] 17.2 Render the appointment pending-until-approval state
    - While the workflow is paused at the Approval_Gate (booking not yet approved), the DoctorSummary shows the appointment as `pending`; it shows the finalized June 25 consult only after `couple.booking.approved`
    - _Requirements: 8.6_

- [x] 18. Implement the Grounded Chat (Owner: Person B)
  - [x] 18.1 Build the chat endpoint and UI
    - Answer the five canonical questions in the fixed order (Short answer → Based on your data → What's uncertain → Shared next step → Sources), each present and non-empty; scope sources to `couple_001` / Reference_Data; state unavailable facts without substitution; provide a deterministic Mock_Fallback when Grok is unavailable
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x]* 18.2 Write property test for summary/chat grounding
    - **Property 26: Summary and chat are grounded in Reference_Data**
    - **Validates: Requirements 8.3, 8.4, 9.4, 12.1, 12.3**

  - [x]* 18.3 Write property test for the five-section format
    - **Property 27: Chat answers use the fixed five-section format**
    - **Validates: Requirements 9.2**

  - [x]* 18.4 Write property test for chat scoping
    - **Property 28: Chat is scoped to the seed couple**
    - **Validates: Requirements 9.3**

- [x] 19. Integration, wiring, and configuration (Owner: Person B)
  - [x] 19.1 Wire the end-to-end demo path
    - Connect intake → reactive graph (visible parallel branches) → window/missing-data → live insurance/clinic calls with the LIVE/FALLBACK indicator → emit `call.completed` (Reactive_Summary_Function refresh) → Approval_Gate pause + approve → her/his/together tasks + finalized Jun 25 consult → scheduled Check_In → Doctor_Summary, so the demo runs without orphaned code; preserve the demo guarantee that on live-call failure the Mock_Fallback completes the call and the Approval_Gate still resumes on `couple.booking.approved` using the fallback result
    - _Requirements: 16.1, 16.3_

  - [x]* 19.2 Write integration test for the demo path
    - With the Mock_Fallback safety net and a mocked `LiveVoiceSession`, assert intake → reactive graph with parallel branches → window/missing data → calls → Approval_Gate pause/resume → tasks + Jun 25 consult → scheduled Check_In → Reactive_Summary → Doctor_Summary completes
    - _Requirements: 16.1, 16.3_

  - [x] 19.3 Implement config/secrets, endpoints, and README
    - Implement `XAI_API_KEY` → `GROK_API_KEY` resolution falling back to Mock_Fallback when neither is set; add `CHECKIN_DELAY`, `XAI_VOICE_WS_URL`, `XAI_VOICE_MODEL`, and `APPROVAL_WAIT_TIMEOUT` to `.env_example`; wire `/api/inngest` to serve BOTH the main reactive workflow and the Reactive_Summary_Function; add the `/api/booking` endpoint that emits `couple.booking.approved`
    - Configure Vercel deploy; write the README naming xAI, Inngest, Vercel, and Cursor, documenting HIPAA/BAA deferral, and noting the live-voice env (`XAI_VOICE_WS_URL`/`XAI_VOICE_MODEL`) and the scheduled Check_In (`CHECKIN_DELAY`); exclude Twilio/real telephony/real PHI
    - _Requirements: 15.4, 15.5, 15.6, 15.7, 15.8, 15.9, 15.10, 19.1_

  - [x]* 19.4 Write unit test for key resolution
    - Assert correct behavior across all `XAI_API_KEY` / `GROK_API_KEY` presence combinations
    - _Requirements: 15.4_

- [ ] 20. Final checkpoint - Ensure all tests pass (Owner: Both)
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP. They cover property, unit, and integration tests.
- Property tests use `fast-check` + Vitest, run a minimum of 100 generated cases, and each references its design property (format: **Feature: fairy, Property {n}: ...**).
- The live-voice properties (15, 16, 17, 18, 19, 20) are validated against recorded/simulated transcript fixtures fed to the extractor plus a mocked `LiveVoiceSession` seam; the real WebSocket audio path (`lib/agent/live.ts` connect/speak/listen) is verified manually during the demo.
- The workflow-orchestration properties (21–24) are validated against a deterministic step harness with mocked `step.run` / `waitForEvent` / `step.sleep`, not against Inngest itself.
- Each task references specific requirements for traceability; checkpoints ensure incremental validation.
- Latency budgets (≤2s/≤3s/≤10s) and the sub-three-minute demo timing are verified by manual observation during rehearsal, consistent with the design's Testing Strategy.
- All clinical values trace to `/reference-data/`; no medical literals are invented in code.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "3.1", "4.1", "5.1", "5.4", "7.1", "8.1", "12.1"] },
    { "id": 3, "tasks": ["2.3", "3.2", "3.3", "3.4", "3.5", "3.6", "4.2", "4.3", "4.4", "4.5", "5.2", "5.3", "5.5", "7.2", "7.3", "8.2", "9.1", "12.2", "12.3"] },
    { "id": 4, "tasks": ["8.3", "8.4", "9.2", "9.3", "9.4", "9.5", "9.6", "9.7", "10.1", "13.1", "14.1", "15.1", "16.1", "17.1", "18.1"] },
    { "id": 5, "tasks": ["10.2", "10.3", "10.4", "10.5", "10.6", "13.2", "14.2", "14.3", "14.4", "14.5", "15.2", "16.2", "17.2", "18.2", "18.3", "18.4", "19.1", "19.3", "19.4"] },
    { "id": 6, "tasks": ["10.7", "19.2"] }
  ]
}
```
