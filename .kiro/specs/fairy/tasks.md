# Implementation Plan: Fairy

## Overview

This plan implements Fairy in TypeScript on Next.js (App Router) with Tailwind + shadcn/ui (governed by the Impeccable skill), Inngest, Supabase, and the Grok / Grok Voice adapter with a deterministic Mock_Fallback. It follows the design's "pure core, impure shell" structure: the deterministic rules core (trying-window, missing-data, duration, readiness, extractors) is built and property-tested first, then the data layer, agent, workflow, and UI are layered on and wired into the sub-three-minute demo path. Property-based tests use `fast-check` + Vitest and each references a numbered design property. All clinical literals come from `/reference-data/`.

## Tasks

- [ ] 1. Set up project structure and tooling
  - [ ] 1.1 Initialize the Next.js app and toolchain
    - Scaffold Next.js (App Router) + TypeScript project with the `app/`, `lib/`, `components/`, and `supabase/` directory layout from the design
    - Add Tailwind CSS and shadcn/ui, the Inngest client dependency, and the Supabase client dependency
    - Configure Vitest and `fast-check` for property-based testing (min 100 generated cases per property)
    - Add `.env.local` handling stubs for `XAI_API_KEY` with `GROK_API_KEY` fallback (no secret values committed)
    - _Requirements: 15.1, 15.2, 15.3, 15.7_

- [ ] 2. Encode reference data and validation
  - [ ] 2.1 Build the reference constants layer
    - Create `lib/reference/` typed constants for WHO 2021 limits, female hormone windows/targets, CPT codes, duration rule, clinic slots, and call scripts, sourced verbatim from the files in `/reference-data/`
    - Encode the Seed_Couple "Maya & Daniel" fixture and the mock insurance/clinic responses from `sample-couple.md`, `call-scripts.md`, `insurance-coverage-data.md`, and `clinic-intake-data.md`
    - _Requirements: 12.1, 12.2, 12.3, 11.3_

  - [ ] 2.2 Implement intake validation schemas
    - Create `lib/validation/` Zod schemas for Her, His, and Together fields with field names and bounds identical to `sample-couple.md`
    - Enforce enumerations (`semen_analysis_status`, `policy_holder`, `coverage_known`) and WHO 2021 / reference-range bounds; reject out-of-range values with errors naming the field and expected range
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.7, 2.8_

  - [ ]* 2.3 Write property test for intake validation
    - **Property 11: Intake validation rejects out-of-range values**
    - **Validates: Requirements 2.7, 2.8**

- [ ] 3. Implement the Trying-Window engine
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

- [ ] 4. Implement the Missing-Data detector
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

- [ ] 5. Implement the Duration rule and Readiness score
  - [ ] 5.1 Implement `lib/core/duration-rule.ts`
    - Apply the age-based threshold (under 35 → 12 months, 35+ → 6 months) and force early evaluation on any red flag
    - _Requirements: 7.4, 7.5, 7.6_

  - [ ]* 5.2 Write property test for the age threshold
    - **Property 13: Duration threshold by age**
    - **Validates: Requirements 7.4**

  - [ ]* 5.3 Write property test for red-flag override
    - **Property 14: Red flags force early evaluation**
    - **Validates: Requirements 7.5**

  - [ ] 5.4 Implement `lib/core/readiness.ts`
    - Implement `applyTaskCompletion` that increases the score on completion and clamps the integer result to [0, 100]
    - _Requirements: 1.4, 5.4_

  - [ ]* 5.5 Write property test for readiness bounds
    - **Property 9: Readiness score stays an integer within [0, 100]**
    - **Validates: Requirements 1.4, 5.4**

- [ ] 6. Checkpoint - Ensure all rules-core tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Implement structured-result extractors
  - [ ] 7.1 Implement `lib/core/extract.ts`
    - Implement insurance and clinic extractors mapping a transcript/mock responses to the exact `call-scripts.md` schemas; assign each created task to exactly one Her/His/Together column; mark unextractable fields unresolved + add a follow-up task while preserving extracted fields
    - _Requirements: 6.2, 6.3, 6.5, 5.2, 5.5_

  - [ ]* 7.2 Write property test for task column assignment
    - **Property 10: Every task is assigned to exactly one column**
    - **Validates: Requirements 5.2, 5.5**

  - [ ]* 7.3 Write property test for unresolved-field isolation
    - **Property 16: Unresolved fields are isolated**
    - **Validates: Requirements 6.5**

- [ ] 8. Implement the data model and seeding
  - [ ] 8.1 Create Supabase migrations
    - Define the eight entities (couple, member, her_profile, him_profile, trying_window, task, calendar_event, call_record) with `null` representing MISSING
    - _Requirements: 11.1_

  - [ ] 8.2 Implement Supabase client, queries, and seed loader
    - Implement `lib/db/` client and queries; implement the seed loader that writes Maya & Daniel exactly as in `sample-couple.md`; on missing/unparseable seed, refuse partial render and signal a load error
    - _Requirements: 11.2, 11.3, 1.6, 1.7_

  - [ ]* 8.3 Write property test for persistence round-trip
    - **Property 20: Persistence round-trip preserves values**
    - **Validates: Requirements 11.3**

  - [ ]* 8.4 Write smoke test for seed population
    - Assert migrations create all eight entities and the seed populates `couple_001`
    - _Requirements: 11.1, 11.2_

- [ ] 9. Implement the Voice Agent and Mock_Fallback
  - [ ] 9.1 Implement `lib/agent/` adapter and Mock_Fallback
    - Implement `runInsuranceCall` / `runClinicCall` that load the authorization packet, ask the 10/7 questions in exact order, produce a chronological transcript + extracted result, decline medical-decision requests, withhold member ID/DOB until verification is requested, and fall through to the deterministic Mock_Fallback on live failure; on clinic completion write back her/his/together tasks, a 2026-06-25 calendar event, and a coverage+appointment+bring-list summary
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.6, 6.7, 6.8, 6.9, 15.5_

  - [ ]* 9.2 Write property test for call-output schema
    - **Property 15: Call output conforms to its schema**
    - **Validates: Requirements 6.4**

  - [ ]* 9.3 Write property test for Mock_Fallback determinism
    - **Property 17: Mock_Fallback is deterministic**
    - **Validates: Requirements 6.7, 15.5, 16.3**

  - [ ]* 9.4 Write property test for identity withholding
    - **Property 18: Identity details withheld until verification requested**
    - **Validates: Requirements 6.8**

  - [ ]* 9.5 Write property test for medical-decision declines
    - **Property 19: Medical-decision requests are declined**
    - **Validates: Requirements 6.9**

  - [ ]* 9.6 Write unit test for question order and clinic write-back
    - Assert insurance 10-question order, clinic 7-question order, and the Jun 25 event + tasks + summary write-back
    - _Requirements: 6.2, 6.3, 6.6_

- [ ] 10. Implement the Inngest seven-step workflow
  - [ ] 10.1 Implement `lib/inngest/` client and the 7-step function
    - Implement the function triggered by `fertility.intake.completed`: extract profiles → compute window → detect missing data → check duration rule → generate tasks → run simulated calls → build summary; persist a `pending|running|completed|failed` status per step; on failure mark the step failed, halt later steps, and surface the failed step
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [ ]* 10.2 Write integration test for workflow orchestration
    - With mocked Grok/agent, assert sequential execution, status enum transitions, and failure halting
    - _Requirements: 7.1, 7.2, 7.3_

- [ ] 11. Checkpoint - Ensure core, data, agent, and workflow tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. Build the Impeccable UI shell
  - [ ] 12.1 Implement phone-frame shell components
    - Build `PhoneFrame` (390px), `BottomTabs` (Home/Calendar/Tasks/Chat), `StickyHeader`, app-like cards, and a single `DisclaimerFooter` line via the Impeccable skill; complete a critique.md pass; no generic Tailwind fallback
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 14.1, 14.2_

  - [ ]* 12.2 Write property test for the disclaimer/clutter rule
    - **Property 26: Single disclaimer, no synthetic-data clutter**
    - **Validates: Requirements 14.1, 14.2**

  - [ ]* 12.3 Write structural render test for the shell
    - Assert the 390px frame and the four bottom tabs render
    - _Requirements: 13.4_

- [ ] 13. Implement the dual intake forms
  - [ ] 13.1 Build the Her/His/Together intake forms
    - Render structured fields only, wired to the validation schemas; reject invalid entries inline (retain prior value, name field + range); on both intakes complete and valid, emit `fertility.intake.completed` exactly once
    - _Requirements: 2.1, 2.6, 2.8_

  - [ ]* 13.2 Write property test for the completion event
    - **Property 12: Intake completion event fires exactly once**
    - **Validates: Requirements 2.6**

- [ ] 14. Implement the Couple Workspace views
  - [ ] 14.1 Build Her/His/Together views and the workflow viewer
    - Render the three scoped views (profiles, labs, semen results vs WHO limits, Readiness_Score 0–100, shared insurance/goal/concern/tasks) and the seven-step `WorkflowViewer`; render MISSING values as missing-data flags
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.8, 5.3, 7.2_

  - [ ]* 14.2 Write property test for MISSING rendering
    - **Property 24: MISSING values render as flags**
    - **Validates: Requirements 1.8**

- [ ] 15. Implement the Task delegation board
  - [ ] 15.1 Build the TaskBoard
    - Render exactly three columns (Her/His/Together); create follow-up tasks from extracted call results into a single column each; on extraction failure create no tasks and show a failure indication; on male-track task completion update the Readiness_Score within [0, 100]
    - _Requirements: 5.1, 5.2, 5.4, 5.5, 5.6_

- [ ] 16. Implement the Shared Calendar
  - [ ] 16.1 Build the CalendarView
    - Display the trying window, priority days, reminders, the Jun 25, 2026 consult, and tasks; show event detail on selection; use the Trying_Window_Engine output as the single source of truth and update when it changes; on unavailable engine output show an error and retain previously loaded data
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [ ]* 16.2 Write property test for calendar/engine date equality
    - **Property 25: Calendar dates equal engine output**
    - **Validates: Requirements 10.3, 10.4**

- [ ] 17. Implement the Doctor-ready Summary
  - [ ] 17.1 Build the summary endpoint and UI
    - Assemble both partners' data, trying window + confidence, missing tests, doctor questions, verified coverage facts, and the Jun 25 consult; single-operation copy to clipboard; ground all clinical statements in Reference_Data and omit absent values; label coverage `unverified` and appointment `pending` when applicable
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

- [ ] 18. Implement the Grounded Chat
  - [ ] 18.1 Build the chat endpoint and UI
    - Answer the five canonical questions in the fixed order (Short answer → Based on your data → What's uncertain → Shared next step → Sources), each present and non-empty; scope sources to `couple_001` / Reference_Data; state unavailable facts without substitution; provide a deterministic Mock_Fallback when Grok is unavailable
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [ ]* 18.2 Write property test for summary/chat grounding
    - **Property 21: Summary and chat are grounded in Reference_Data**
    - **Validates: Requirements 8.3, 8.4, 9.4, 12.1, 12.3**

  - [ ]* 18.3 Write property test for the five-section format
    - **Property 22: Chat answers use the fixed five-section format**
    - **Validates: Requirements 9.2**

  - [ ]* 18.4 Write property test for chat scoping
    - **Property 23: Chat is scoped to the seed couple**
    - **Validates: Requirements 9.3**

- [ ] 19. Integration, wiring, and configuration
  - [ ] 19.1 Wire the end-to-end demo path
    - Connect intake → workflow → window/missing-data → calls → her/his/together tasks + Jun 25 consult → doctor summary across the UI tabs so the demo runs without orphaned code; ensure live-call failure transparently uses the Mock_Fallback
    - _Requirements: 16.1, 16.3_

  - [ ]* 19.2 Write integration test for the demo path
    - With Mock_Fallback, assert intake → workflow → window/missing data → calls → tasks + Jun 25 consult → doctor summary completes
    - _Requirements: 16.1, 16.3_

  - [ ] 19.3 Implement config/secrets and README
    - Implement `XAI_API_KEY` → `GROK_API_KEY` resolution falling back to Mock_Fallback when neither is set; configure Vercel deploy; write the README naming xAI, Inngest, Vercel, and Cursor and documenting HIPAA/BAA deferral; exclude Twilio/real telephony/real PHI
    - _Requirements: 15.4, 15.5, 15.6, 15.7, 15.8, 15.9_

  - [ ]* 19.4 Write unit test for key resolution
    - Assert correct behavior across all `XAI_API_KEY` / `GROK_API_KEY` presence combinations
    - _Requirements: 15.4_

- [ ] 20. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP. They cover property, unit, and integration tests.
- Property tests use `fast-check` + Vitest, run a minimum of 100 generated cases, and each references its design property (format: **Feature: fairy, Property {n}: ...**).
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
    { "id": 4, "tasks": ["8.3", "8.4", "9.2", "9.3", "9.4", "9.5", "9.6", "10.1", "13.1", "14.1", "15.1", "16.1", "17.1", "18.1"] },
    { "id": 5, "tasks": ["10.2", "13.2", "14.2", "16.2", "18.2", "18.3", "18.4", "19.1", "19.3", "19.4"] },
    { "id": 6, "tasks": ["19.2"] }
  ]
}
```
