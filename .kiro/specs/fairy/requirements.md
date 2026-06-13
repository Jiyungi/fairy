# Requirements Document

## Introduction

Fairy is a mobile-first web application for straight couples in the United States who are trying to conceive. Unlike a period tracker, Fairy treats fertility preparation as a shared, two-partner workflow and adds an autonomous agent that handles the phone and paperwork grind: it conducts real spoken phone conversations with a live human (insurance representative and clinic scheduler), extracts structured results from the live transcript, and turns them into calendar events and tasks. The product theme is patient agency.

Fairy is built for a one-day Health AI hackathon by two people working in parallel. The application presents as a polished phone app (390px mobile frame, bottom tab navigation, app-like cards, sticky headers), not a desktop dashboard. It uses xAI Grok for reasoning and the Grok Voice Agent API for genuinely agentic, real-time voice calls, Inngest for event-driven workflow orchestration, Vercel for deployment, Supabase for data, and references Cursor — all named in the README as sponsor tools.

The Inngest workflow is an event-driven reactive graph rather than a linear sequence: analysis steps and phone calls run as parallel branches that fan out and join, the workflow pauses for a human-in-the-loop booking approval, and it schedules a delayed male-track check-in. A separate function reacts to call completion to refresh the doctor summary.

Three rules are non-negotiable and shape every requirement below:
1. **Reference data is the source of truth.** All clinical values, sample patient data, CPT codes, hormone and semen ranges, insurance terms, clinic info, and call objectives come from files in `/reference-data/`. No fabricated medical numbers, details, codes, or dialogue.
2. **All UI uses the Impeccable skill** at `.kiro/skills/impeccable/`. No generic Tailwind fallback. A `critique.md` pass is required before any screen is considered done.
3. **No disclaimer paranoia.** Exactly one small footer disclaimer line, no synthetic-data badges or warnings in the main views.

## Glossary

- **Fairy_System**: The overall Fairy mobile-first web application, including UI, data layer, agent, and workflow.
- **Reference_Data**: The set of files in `/reference-data/` (sample-couple.md, semen-analysis-reference.md, female-hormone-reference.md, cycle-fertility-reference.md, cpt-codes-fertility.md, insurance-coverage-data.md, clinic-intake-data.md, call-scripts.md, README.md) that is the single source of truth for all clinical values, codes, terms, and call objectives.
- **Couple_Workspace**: The shared space where both partners have their own data, scores, and tasks, exposed through Her view, His view, and Together view.
- **Her_View**: The view scoped to the female partner's profile, data, and tasks.
- **His_View**: The view scoped to the male partner's profile, data, and tasks.
- **Together_View**: The view scoped to shared couple data (insurance, goal, top concern, shared tasks).
- **Intake_Form**: A form-based (not conversational) data-entry surface for collecting Her, His, and Together data.
- **Trying_Window_Engine**: The rule-based component that computes the estimated trying window, priority days, and confidence label using the algorithm in cycle-fertility-reference.md.
- **Missing_Data_Detector**: The rule-based component that produces a checklist of missing or borderline data items and explains why each matters.
- **Task_Board**: The Her/His/Together task delegation board.
- **Voice_Agent**: The genuinely agentic Grok Voice agent that conducts real-time spoken phone conversations with a live human, phrasing its own questions, listening to spoken answers, asking follow-ups, and extracting structured results from the live transcript.
- **Live_Voice_Session**: A real-time spoken conversation conducted by the Voice_Agent with a live human over a WebSocket connection configured by `XAI_VOICE_WS_URL` and `XAI_VOICE_MODEL`, in which the Voice_Agent speaks questions aloud, listens to the human's spoken answers, and responds in real time.
- **Human_Presenter**: The live person who, during the demo, plays the insurance representative and the clinic scheduler and speaks the responses, reading from the Cue_Sheet. There is no second Grok and no scripted automated responder.
- **Call_Objectives**: The checklist of information objectives the Voice_Agent must satisfy on a call (10 for the insurance call, 7 for the clinic call) derived from call-scripts.md. Call_Objectives are objectives to obtain, not a verbatim script; the Voice_Agent phrases the questions itself.
- **Cue_Sheet**: The human-readable reference values in insurance-coverage-data.md and clinic-intake-data.md (for example deductible $1,500, in-network lab "Crest Diagnostics", June 25 slot) that the Human_Presenter reads from during a Live_Voice_Session. The Cue_Sheet is not a bot script.
- **Mock_Fallback**: The deterministic safety-net responder used only when the Live_Voice_Session is unavailable or fails mid-call (for example no microphone or a bad network); it returns the same schema and the same field values across repeated runs with identical inputs so the demo always completes.
- **Inngest_Workflow**: The event-driven, reactive, multi-step workflow triggered by the `fertility.intake.completed` event, containing parallel branches, a human-in-the-loop pause, and a scheduled delay.
- **Workflow_Viewer**: The UI component that displays each workflow step's status, including parallel branches running simultaneously and the paused approval state.
- **Approval_Gate**: The human-in-the-loop pause in the Inngest_Workflow that awaits the `couple.booking.approved` event before the clinic appointment is finalized.
- **Reactive_Summary_Function**: A separate Inngest function that listens for the `call.completed` event and refreshes the Doctor_Summary reactively, decoupled from the main Inngest_Workflow.
- **Check_In**: The scheduled future task and reminder created after a configurable delay for the male partner to re-test semen analysis and review lifestyle progress, representing the ~72-day sperm-regeneration horizon (~10–12 weeks).
- **Doctor_Summary**: The copyable, doctor-ready summary grounded only in Reference_Data sources.
- **Grounded_Chat**: The chat feature that answers couple-scoped questions in a fixed structured format with fixed sources.
- **Shared_Calendar**: The calendar showing the trying window, priority days, reminders, booked consult, and tasks.
- **Impeccable_Skill**: The design skill at `.kiro/skills/impeccable/` whose guidance (SKILL.md, layout.md, typeset.md, colorize.md, craft.md, polish.md, delight.md, critique.md) governs all UI.
- **Seed_Couple**: The fictional couple "Maya & Daniel" defined in sample-couple.md used to seed the application.
- **Readiness_Score**: The male partner's numeric readiness score (out of 100) that improves as tasks complete.
- **Trying_Duration_Rule**: The evaluation-timing rule (under 35 → 12 months, 35 or older → 6 months, red flags trigger early evaluation) from cycle-fertility-reference.md.
- **Workflow_Event**: One of the named events that drive the reactive graph: `fertility.intake.completed` (start), `call.completed` (emitted per completed call), `couple.booking.approved` (resume the Approval_Gate), and `checkin.due` (scheduled wake for the Check_In).
- **Disclaimer_Line**: The single footer text "Fairy provides educational fertility information, not medical advice."

## Requirements

### Requirement 1: Couple Workspace (F1)

**User Story:** As a couple trying to conceive, we want a single shared workspace with separate Her, His, and Together views, so that both partners can contribute and see data without one-way sharing.

#### Acceptance Criteria

1. THE Fairy_System SHALL present exactly one Couple_Workspace that contains exactly three named views: Her_View, His_View, and Together_View.
2. THE Fairy_System SHALL grant the female partner edit ownership of her own data, grant the male partner edit ownership of his own data, and grant both partners shared read access to Her_View, His_View, and Together_View.
3. WHEN a user selects Her_View, THE Fairy_System SHALL display the female partner's profile, labs, and tasks within 2 seconds.
4. WHEN a user selects His_View, THE Fairy_System SHALL display the male partner's semen analysis results, lifestyle factors, Readiness_Score expressed as an integer from 0 to 100, and tasks within 2 seconds.
5. WHEN a user selects Together_View, THE Fairy_System SHALL display the shared couple data, including insurance provider, insurance plan, coverage status, goal, top concern, and shared tasks, within 2 seconds.
6. THE Fairy_System SHALL seed the Couple_Workspace from the Seed_Couple defined in sample-couple.md.
7. IF the seed data is missing or cannot be parsed, THEN THE Fairy_System SHALL NOT render a partial Couple_Workspace and SHALL display an error indication that the workspace cannot be loaded.
8. WHERE a seed lab or test value is "MISSING", THE Fairy_System SHALL display that value as a missing-data flag rather than as a blank field or a substituted value.

### Requirement 2: Dual Intake Forms (F2)

**User Story:** As each partner, I want a form to enter my own fertility data, so that the application has complete data for both of us.

#### Acceptance Criteria

1. THE Intake_Form SHALL collect Her data using structured fields only, with no free-text dialog.
2. THE Intake_Form SHALL collect the Her fields: age, last period start date, average cycle length within the range 45 to 60 days, cycle regularity, months trying, conditions, prior medications, ovulation tracking method, and prior pregnancies.
3. THE Intake_Form SHALL collect the His fields: age, semen analysis status as one of the enumerated values not_started, in_progress, or completed, semen analysis results validated against the WHO 2021 lower reference limits (sperm concentration 16 million/mL, total sperm number 39 million/ejaculate, progressive motility 30%, normal morphology 4%), lifestyle factors (smoking, alcohol, heat exposure, sleep, stress, BMI, supplements), and medical history.
4. THE Intake_Form SHALL collect the Together fields: insurance provider, member ID, group number, policy holder as one of the enumerated values her or him, coverage known status as one of the enumerated values confirmed, partial_unconfirmed, or unconfirmed, goal, and top concern.
5. THE Intake_Form SHALL use field names and value bounds identical to those defined in sample-couple.md.
6. WHEN both partners' intake is complete and valid, THE Fairy_System SHALL emit the `fertility.intake.completed` event exactly once.
7. WHERE a clinical field has a defined reference range in Reference_Data, THE Intake_Form SHALL validate the entered value against that reference range.
8. IF an entered value is out of range or invalid, THEN THE Intake_Form SHALL reject the value, retain the prior value, and display an error indication that names the invalid field and its expected range.

### Requirement 3: Trying-Window and Confidence (F3)

**User Story:** As a couple, we want an estimated trying window with a confidence label, so that we know which days to prioritize and how reliable the estimate is.

#### Acceptance Criteria

1. THE Trying_Window_Engine SHALL compute the trying window from the required inputs lastPeriodStart, cycleLengthMin in days, and cycleLengthMax in days, producing calendar-date outputs using the irregular-cycle algorithm defined in cycle-fertility-reference.md: minOvulation = lastPeriodStart + cycleLengthMin − 14; maxOvulation = lastPeriodStart + cycleLengthMax − 14; fertileWindowStart = minOvulation − 5; fertileWindowEnd = maxOvulation + 1.
2. WHEN the Trying_Window_Engine processes the Seed_Couple data, THE Trying_Window_Engine SHALL output an estimated trying window with fertileWindowStart of June 27, 2026 and fertileWindowEnd of July 18, 2026.
3. WHEN the Trying_Window_Engine processes the Seed_Couple data, THE Trying_Window_Engine SHALL output priority days with minOvulation of July 2, 2026 and maxOvulation of July 17, 2026.
4. WHEN the Trying_Window_Engine processes the Seed_Couple data, THE Trying_Window_Engine SHALL output a confidence label with the exact value "Low".
5. IF ovulation is not confirmed (no mid-luteal progesterone result and no LH confirmation) and the cycle range is wide (cycleLengthMax minus cycleLengthMin greater than 7 days), THEN THE Trying_Window_Engine SHALL display the three reasons with the exact strings "irregular cycle", "ovulation not confirmed", and "wide cycle range".
6. THE Trying_Window_Engine SHALL compute ovulation timing using only the female partner's lastPeriodStart, cycleLengthMin, and cycleLengthMax, and SHALL exclude all male partner data from ovulation timing.
7. IF a required input (lastPeriodStart, cycleLengthMin, or cycleLengthMax) is missing or invalid, THEN THE Trying_Window_Engine SHALL display an error indication and SHALL preserve the prior state.

### Requirement 4: Missing-Data Detector (F4)

**User Story:** As a couple, we want a checklist of missing or borderline data with explanations, so that we know what tests to complete before care.

#### Acceptance Criteria

1. THE Missing_Data_Detector SHALL apply rule-based checks against the seed labs in Reference_Data for the following items: day-3 FSH, day-3 estradiol, mid-luteal progesterone, prolactin, each WHO 2021 semen analysis parameter, and insurance coverage status.
2. IF day-3 FSH or day-3 estradiol is absent (value null) in the female labs, THEN THE Missing_Data_Detector SHALL flag each absent item as missing and present an explanation that the item must be drawn on cycle day 2–3 for ovarian-reserve assessment as defined in female-hormone-reference.md.
3. IF mid-luteal progesterone is absent (value null), THEN THE Missing_Data_Detector SHALL flag the item as missing and indicate that ovulation cannot be confirmed without a mid-luteal progesterone result (rise toward the ≈10 ng/mL ovulation-indicative level per female-hormone-reference.md).
4. IF prolactin is absent (value null), THEN THE Missing_Data_Detector SHALL flag the item as missing and present an explanation that prolactin is part of the pituitary/ovulation screen per female-hormone-reference.md.
5. WHEN a semen analysis parameter is below its WHO 2021 lower reference limit defined in semen-analysis-reference.md (semen volume 1.4 mL, sperm concentration 16 million/mL, total sperm number 39 million/ejaculate, total motility 42%, progressive motility 30%, vitality 54%, normal morphology 4%, pH 7.2), THE Missing_Data_Detector SHALL flag that parameter as borderline and recommend one repeat semen analysis collected after 2–7 days of abstinence.
6. IF insurance coverage status is not equal to "confirmed" (including unconfirmed or partial states such as the seed couple's partial_unconfirmed in sample-couple.md), THEN THE Missing_Data_Detector SHALL flag insurance coverage as unverified and indicate that verification is required before care.
7. WHEN all rule-based checks in criterion 1 have completed, THE Missing_Data_Detector SHALL produce a consolidated checklist that lists each flagged missing item and each flagged borderline item together with its corresponding explanation.

### Requirement 5: Task Delegation Board (F5)

**User Story:** As a couple, we want tasks split across Her, His, and Together columns, so that responsibilities are shared rather than falling on one partner.

#### Acceptance Criteria

1. THE Task_Board SHALL present exactly three columns labeled Her, His, and Together.
2. WHEN the Voice_Agent extracts a structured result from a completed phone call, THE Task_Board SHALL create one or more follow-up tasks from that result and assign each created task to exactly one of the Her, His, or Together columns.
3. THE His_View SHALL include a male track containing his own semen analysis status and results compared against the WHO 2021 reference limits, a lifestyle checklist covering heat exposure, smoking, alcohol, sleep, stress, and BMI tracked over a 72-day horizon (approximately 10 to 12 weeks), the insurance-verification and clinic-booking phone calls, bringing required records (semen analysis, prior labs, and urology note) to the consult, and a Readiness_Score expressed as an integer from 0 to 100.
4. WHEN a male track task is marked completed, THE Fairy_System SHALL increase the Readiness_Score and SHALL keep the resulting value within the range 0 to 100 inclusive.
5. THE Task_Board SHALL assign each task to exactly one of the Her, His, or Together columns.
6. IF the Voice_Agent fails to extract a structured result from a phone call, THEN THE Task_Board SHALL NOT create tasks from that call and SHALL display an indication that result extraction failed.
7. WHEN the Check_In becomes due, THE Task_Board SHALL create a "re-test semen analysis / review lifestyle progress" task assigned to the His column.

### Requirement 6: Grok Voice Agent — Live Agentic Calls (F6)

**User Story:** As a couple, we want an agent to actually talk to the insurance representative and the clinic scheduler for us, so that we avoid the phone-and-paperwork grind.

#### Acceptance Criteria

1. WHEN the Voice_Agent starts a call, THE Voice_Agent SHALL establish a Live_Voice_Session over a WebSocket connection configured by `XAI_VOICE_WS_URL` and `XAI_VOICE_MODEL`, and SHALL conduct a real spoken conversation with a live human in which the Voice_Agent speaks questions aloud, listens to the human's spoken answers, and responds in real time.
2. THE Voice_Agent SHALL treat the call-scripts.md questions as Call_Objectives (10 for the insurance call, 7 for the clinic call) to obtain rather than as a verbatim script, and SHALL phrase each question itself using the couple's data and missing-data flags as context.
3. WHILE a Live_Voice_Session is in progress, THE Voice_Agent SHALL accept the human's answers in any order and any wording, SHALL skip any Call_Objective already answered, SHALL ask follow-up questions based on the human's spoken answers, and SHALL ask a deeper follow-up question when an answer is vague or incomplete.
4. WHEN the Voice_Agent runs the insurance verification call, THE Voice_Agent SHALL satisfy the 10 insurance Call_Objectives and extract from the live transcript the structured insurance result fields defined in call-scripts.md: diagnostic_covered, semen_analysis_covered, hormone_labs_covered, prior_auth_required_for, in_network_lab, deductible, coinsurance_pct, oop_max, referral_required, and follow_up_tasks.
5. WHEN the Voice_Agent runs the clinic booking call, THE Voice_Agent SHALL satisfy the 7 clinic Call_Objectives and extract from the live transcript the structured clinic result fields defined in call-scripts.md: booked (date, time, mode, clinic), bring_list, tasks (her, him, together), and calendar_event.
6. WHEN a Live_Voice_Session is active, THE Voice_Agent SHALL extract the structured result by parsing the real live transcript and SHALL map the parsed values to the insurance or clinic schema defined in call-scripts.md.
7. WHEN the Voice_Agent completes a call, THE Voice_Agent SHALL produce a transcript as chronological agent and human turns and a structured extracted result conforming to the schema defined for that call type in call-scripts.md.
8. IF the Voice_Agent cannot extract a defined result field from a call, THEN THE Voice_Agent SHALL mark that field as unresolved, add a follow-up task to obtain the field, and preserve all other extracted fields.
9. WHEN the Voice_Agent completes the clinic booking call, THE Voice_Agent SHALL write back the her, his, and together tasks, a calendar event dated 2026-06-25, and a summary containing the coverage facts, the appointment, and the bring-list.
10. WHILE a call is in progress and the human has not requested identity verification, THE Voice_Agent SHALL withhold the member ID and date of birth, and SHALL disclose the member ID and date of birth only after the human requests identity verification, per the call-scripts.md guardrails.
11. IF the human requests a medical decision or acceptance of treatment on the couple's behalf, THEN THE Voice_Agent SHALL decline the request and add a follow-up task for the couple to address it.
12. IF the Live_Voice_Session is unavailable or fails mid-call (for example no microphone, a lost WebSocket connection, or a bad network), THEN THE Voice_Agent SHALL engage the deterministic Mock_Fallback as a safety net, where deterministic means the Mock_Fallback returns the same schema and the same field values across repeated runs with identical inputs.
13. WHEN the Live_Voice_Session succeeds, THE Voice_Agent SHALL source the structured result from the real conversation rather than from the Mock_Fallback.
14. WHILE a call is in progress, THE Fairy_System SHALL display a call UI showing the live transcript as agent and human turns appear, a LIVE-versus-FALLBACK indicator reflecting whether the result is from the Live_Voice_Session or the Mock_Fallback, and the structured result fields filling in as they are extracted.

### Requirement 7: Inngest Workflow — Event-Driven Reactive Graph (F7)

**User Story:** As a demo audience, we want to see an event-driven workflow with parallel branches, a human approval pause, and a scheduled check-in execute, so that the agentic orchestration is visible and credible.

#### Acceptance Criteria

1. WHEN the `fertility.intake.completed` event fires, THE Inngest_Workflow SHALL run the reactive graph: analyze-her-data and analyze-his-data run concurrently and join, then compute the trying window, detect missing data, check the trying-duration rule, generate her/his/together tasks, run the insurance call and clinic booking call as parallel branches that both complete before proceeding, emit `call.completed` per call, pause at the Approval_Gate awaiting `couple.booking.approved`, finalize booking and the June 25 calendar event, schedule a delayed Check_In, and build or refresh the doctor summary.
2. WHEN analyze-her-data and analyze-his-data run, THE Inngest_Workflow SHALL execute the two analyses concurrently and SHALL join both branches before computing the trying window.
3. WHEN the insurance call and the clinic booking call run, THE Inngest_Workflow SHALL execute the two calls as parallel branches (fan-out) and SHALL require both branches to complete before proceeding (fan-in).
4. THE Workflow_Viewer SHALL visibly display the parallel branches running simultaneously for both the analyze-her/analyze-his pair and the insurance-call/clinic-call pair.
5. THE Inngest_Workflow SHALL persist and the Workflow_Viewer SHALL display the status of each step as one of the enumerated values pending, running, completed, failed, or paused.
6. IF a step fails, THEN THE Inngest_Workflow SHALL mark that step failed, halt the steps that depend on it, and display an error indication identifying the failed step.
7. WHEN the trying-duration step runs, THE Inngest_Workflow SHALL apply the Trying_Duration_Rule: a female partner under 35 (age strictly less than 35) uses a 12-month threshold and a female partner 35 or older (age 35 or greater) uses a 6-month threshold.
8. IF any red-flag condition is present (irregular or absent periods, known PCOS or endometriosis, prior pelvic surgery, or known male factor as defined in cycle-fertility-reference.md), THEN THE Inngest_Workflow SHALL recommend early evaluation regardless of the trying-duration threshold.
9. WHEN the Inngest_Workflow processes the Seed_Couple data, THE Inngest_Workflow SHALL apply the 12-month threshold because the female partner is 33 (less than 35), record 8 months trying, and recommend early evaluation due to the red flags of irregular cycles and borderline semen analysis per sample-couple.md.
10. WHEN a call completes, THE Inngest_Workflow SHALL emit the `call.completed` event for that call.

### Requirement 8: Doctor-Ready Summary (F8)

**User Story:** As a couple, we want a copyable doctor-ready summary, so that we enter the first appointment prepared.

#### Acceptance Criteria

1. THE Doctor_Summary SHALL include the following sections: both partners' data, the trying window and confidence label sourced from the Trying_Window_Engine, the missing tests sourced from the Missing_Data_Detector, questions for the doctor, verified coverage facts, and the booked consult on June 25, 2026.
2. WHEN a user invokes the copy action, THE Doctor_Summary SHALL place the complete text of all sections onto the clipboard in a single operation.
3. THE Doctor_Summary SHALL ground all clinical statements and citations only in sources cited within Reference_Data.
4. IF a clinical value or citation is not present in Reference_Data, THEN THE Doctor_Summary SHALL omit that value or citation.
5. IF insurance coverage is not verified, THEN THE Doctor_Summary SHALL label coverage as unverified (the seed couple's coverage_status is partial_unconfirmed in sample-couple.md).
6. WHILE the booking has not been approved at the Approval_Gate, THE Doctor_Summary SHALL indicate the appointment as pending.

### Requirement 9: Grounded Chat (F9)

**User Story:** As a couple, we want to ask questions and get answers scoped to our data, so that we understand our situation and next steps.

#### Acceptance Criteria

1. THE Grounded_Chat SHALL answer at least five questions: why these days are priority, what the partner should do this week, why confidence is low, what to ask the doctor, and what data is missing.
2. WHEN the Grounded_Chat answers a question, THE Grounded_Chat SHALL respond within 10 seconds in the fixed order Short answer, Based on your data, What's uncertain, Shared next step, and Sources, with every one of the five sections present and non-empty.
3. THE Grounded_Chat SHALL draw sources only from the single Seed_Couple couple_001 in Reference_Data, SHALL cite the source for each answer, and SHALL exclude any other couple's data.
4. IF a requested fact is not present in Reference_Data, THEN THE Grounded_Chat SHALL state that the information is unavailable and SHALL NOT provide a substitute value.

### Requirement 10: Shared Calendar (F10)

**User Story:** As a couple, we want a shared calendar with our window, priority days, reminders, and booked consult, so that we coordinate timing in one place.

#### Acceptance Criteria

1. WHEN the Shared_Calendar is opened, THE Shared_Calendar SHALL display the trying window, priority days, reminders, the booked consult on June 25, 2026, and tasks within 3 seconds.
2. WHEN a user selects a calendar event, THE Shared_Calendar SHALL display the event detail, including the event title, date, time, and description, within 2 seconds.
3. THE Shared_Calendar SHALL use the same trying-window and priority-day dates produced by the Trying_Window_Engine as the single source of truth.
4. WHEN the Trying_Window_Engine updates the trying-window or priority-day dates, THE Shared_Calendar SHALL update the displayed dates to match the new Trying_Window_Engine output.
5. IF the Trying_Window_Engine output is unavailable when the Shared_Calendar is opened, THEN THE Shared_Calendar SHALL display an error indication that the trying-window and priority-day dates cannot be loaded, and SHALL retain any previously loaded calendar data.

### Requirement 11: Data Model and Seeding

**User Story:** As a developer, I want a defined Supabase data model seeded from the sample couple, so that the application runs with realistic data without live entry during the demo.

#### Acceptance Criteria

1. THE Fairy_System SHALL define the data entities: couple, member, her_profile, him_profile, trying_window, task, calendar_event, and call_record.
2. THE Fairy_System SHALL seed the data model from the Seed_Couple defined in sample-couple.md.
3. THE Fairy_System SHALL store all seeded clinical values exactly as defined in Reference_Data.

### Requirement 12: Reference Data as Source of Truth (Non-Negotiable Rule 1)

**User Story:** As a clinical-integrity stakeholder, I want all medical content to come from reference data, so that no values are fabricated.

#### Acceptance Criteria

1. THE Fairy_System SHALL source all clinical values, sample patient data, CPT codes, hormone and semen ranges, insurance terms, clinic info, and call objectives from Reference_Data.
2. IF a required clinical value is absent from Reference_Data, THEN THE Fairy_System SHALL require the value to be added to Reference_Data with a source before use.
3. THE Fairy_System SHALL exclude any fabricated medical numbers, details, codes, or dialogue.

### Requirement 13: Impeccable Design Skill (Non-Negotiable Rule 2)

**User Story:** As a design stakeholder, I want all UI built with the Impeccable skill, so that the interface is polished and consistent.

#### Acceptance Criteria

1. THE Fairy_System SHALL build all UI and design using the Impeccable_Skill guidance at `.kiro/skills/impeccable/`.
2. THE Fairy_System SHALL exclude generic Tailwind fallback designs.
3. THE Fairy_System SHALL complete a critique.md pass for each screen before that screen is considered done.
4. THE Fairy_System SHALL present the UI as a phone app with a 390px mobile frame, bottom tab navigation (Home, Calendar, Tasks, Chat), app-like cards, and sticky headers.

### Requirement 14: Single Footer Disclaimer (Non-Negotiable Rule 3)

**User Story:** As a user, I want one clear disclaimer without clutter, so that the interface stays clean and trustworthy.

#### Acceptance Criteria

1. THE Fairy_System SHALL display exactly one Disclaimer_Line reading "Fairy provides educational fertility information, not medical advice." in the footer.
2. THE Fairy_System SHALL exclude synthetic-data badges and warnings from the main views.

### Requirement 15: Sponsor Tools, Stack, and Deployment

**User Story:** As a hackathon participant, I want the required stack and sponsor tools used and named, so that the project qualifies and is reproducible.

#### Acceptance Criteria

1. THE Fairy_System SHALL be built with Next.js App Router, TypeScript, Tailwind, and shadcn/ui.
2. THE Fairy_System SHALL use xAI Grok for reasoning and the Grok Voice Agent API for the Live_Voice_Session calls.
3. THE Fairy_System SHALL use Inngest for workflow orchestration and Supabase for data storage.
4. THE Fairy_System SHALL read the Grok API key from `XAI_API_KEY` in `.env.local` and SHALL fall back to `GROK_API_KEY` when `XAI_API_KEY` is absent.
5. THE Fairy_System SHALL configure the Live_Voice_Session path from `XAI_VOICE_WS_URL` and `XAI_VOICE_MODEL`, and SHALL configure the Check_In delay from `CHECKIN_DELAY` (for example "10s" for the demo, representing the ~72-day horizon).
6. IF any Grok or Grok Voice call is unavailable or fails, THEN THE Fairy_System SHALL provide a deterministic Mock_Fallback so the demo continues without interruption.
7. THE Fairy_System SHALL exclude Twilio, real telephony, and real PHI.
8. THE Fairy_System SHALL run locally and deploy on Vercel.
9. THE Fairy_System SHALL name the sponsor tools xAI, Inngest, Vercel, and Cursor in the README.
10. THE Fairy_System SHALL document deferral of HIPAA compliance to production with a signed BAA in the README.

### Requirement 16: Working Demo Path

**User Story:** As a presenter, I want a reliable sub-three-minute demo path, so that the build can be shown end to end by hour four.

#### Acceptance Criteria

1. THE Fairy_System SHALL support a demo path in which the pre-seeded couple onboards, completing intake fires the Inngest_Workflow with visible steps, the analyze-her/analyze-his and insurance-call/clinic-call parallel branches are visible, the dashboard shows the trying window with Low confidence and missing data, the Voice_Agent runs the insurance and clinic calls as a Live_Voice_Session with a Human_Presenter and a visible LIVE-versus-FALLBACK indicator, the Approval_Gate pause and resume are demonstrated, results become her/his/together tasks and a booked June 25 consult, the scheduled Check_In and the Reactive_Summary_Function are demonstrated, and the Doctor_Summary is generated.
2. THE Fairy_System SHALL complete the demo path in under three minutes.
3. IF a Live_Voice_Session fails during the demo, THEN THE Fairy_System SHALL use the Mock_Fallback so the call completes, the Approval_Gate still resumes on `couple.booking.approved` using the fallback result, and the demo path still finishes under three minutes.
4. WHERE the demo runs on stage, THE Fairy_System SHALL use a short `CHECKIN_DELAY` (for example seconds) so the scheduled Check_In is demonstrable while UI copy represents the ~72-day (~10–12 weeks) horizon.

### Requirement 17: Human-in-the-Loop Booking Approval Gate

**User Story:** As a couple, we want to approve the clinic appointment before it is actually booked, so that the agent never commits us to anything without our consent.

#### Acceptance Criteria

1. WHEN the insurance call and clinic booking call have both completed and before the clinic appointment is finalized, THE Inngest_Workflow SHALL pause at the Approval_Gate using Inngest `waitForEvent` awaiting the `couple.booking.approved` event.
2. WHILE the Inngest_Workflow is paused at the Approval_Gate, THE Fairy_System SHALL display an approval card stating that the agent verified coverage and found a June 25 slot and asking the couple to approve the booking.
3. WHEN the couple selects Approve, THE Fairy_System SHALL emit the `couple.booking.approved` event and the same paused Inngest_Workflow run SHALL resume from the Approval_Gate and finalize the booking, the June 25 calendar event, and the summary.
4. WHILE the Inngest_Workflow is paused at the Approval_Gate, THE Fairy_System SHALL display the clinic appointment status as pending.
5. IF the Approval_Gate wait expires before `couple.booking.approved` is received, THEN THE Inngest_Workflow SHALL keep the clinic appointment pending and surface a "needs approval" state.
6. THE Approval_Gate SHALL use a configurable demo-short wait timeout so the pause and expiry behavior are demonstrable within the demo path.

### Requirement 18: Scheduled Check-In via Delay

**User Story:** As the male partner, I want a follow-up check-in scheduled for after my sperm has had time to regenerate, so that I re-test and review lifestyle progress at the right time.

#### Acceptance Criteria

1. WHEN the booking has been finalized, THE Inngest_Workflow SHALL schedule a future male-track Check_In using Inngest `step.sleep` or `step.sleepUntil` for the duration configured by `CHECKIN_DELAY`.
2. THE Inngest_Workflow SHALL derive the Check_In horizon from the ~72-day sperm-regeneration period in semen-analysis-reference.md and SHALL present the horizon in UI copy as approximately 10 to 12 weeks.
3. WHEN the scheduled delay elapses, THE Inngest_Workflow SHALL wake and emit the `checkin.due` event.
4. WHEN the `checkin.due` event fires, THE Inngest_Workflow SHALL create a "re-test semen analysis / review lifestyle progress" task assigned to the His column and a corresponding reminder.
5. WHERE the demo runs on stage, THE Inngest_Workflow SHALL honor a short `CHECKIN_DELAY` (for example seconds) so the Check_In wake is demonstrable while UI copy continues to represent the ~10–12 week horizon.

### Requirement 19: Reactive Doctor-Summary Function and Workflow Events

**User Story:** As a demo audience, we want a decoupled function that reacts to call completion and refreshes the doctor summary, so that the orchestration is event-driven rather than a rigid sequence.

#### Acceptance Criteria

1. THE Fairy_System SHALL define and use the Workflow_Events `fertility.intake.completed`, `call.completed`, `couple.booking.approved`, and `checkin.due`.
2. THE Reactive_Summary_Function SHALL be a separate Inngest function, decoupled from the main Inngest_Workflow, that listens for the `call.completed` event.
3. WHEN a `call.completed` event fires, THE Reactive_Summary_Function SHALL refresh the Doctor_Summary using the extracted result from that call.
4. THE Inngest_Workflow SHALL persist the status of each step as one of pending, running, completed, failed, or paused, and the Workflow_Viewer SHALL display that status.
5. WHEN the Reactive_Summary_Function refreshes the Doctor_Summary, THE Reactive_Summary_Function SHALL ground all clinical statements only in Reference_Data sources and SHALL omit any value not present in Reference_Data.
