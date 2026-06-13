# Requirements Document

## Introduction

Fairy is a mobile-first web application for straight couples in the United States who are trying to conceive. Unlike a period tracker, Fairy treats fertility preparation as a shared, two-partner workflow and adds an autonomous agent that handles the phone and paperwork grind: it makes simulated phone calls to insurance and clinics, extracts structured results, and turns them into calendar events and tasks. The product theme is patient agency.

Fairy is built for a one-day Health AI hackathon by two people working in parallel. The application presents as a polished phone app (390px mobile frame, bottom tab navigation, app-like cards, sticky headers), not a desktop dashboard. It uses xAI Grok for reasoning and the Grok Voice Agent API for simulated calls, Inngest for workflow orchestration, Vercel for deployment, Supabase for data, and references Cursor — all named in the README as sponsor tools.

Three rules are non-negotiable and shape every requirement below:
1. **Reference data is the source of truth.** All clinical values, sample patient data, CPT codes, hormone and semen ranges, insurance terms, clinic info, and call scripts come from files in `/reference-data/`. No fabricated medical numbers, details, codes, or dialogue.
2. **All UI uses the Impeccable skill** at `.kiro/skills/impeccable/`. No generic Tailwind fallback. A `critique.md` pass is required before any screen is considered done.
3. **No disclaimer paranoia.** Exactly one small footer disclaimer line, no synthetic-data badges or warnings in the main views.

## Glossary

- **Fairy_System**: The overall Fairy mobile-first web application, including UI, data layer, agent, and workflow.
- **Reference_Data**: The set of files in `/reference-data/` (sample-couple.md, semen-analysis-reference.md, female-hormone-reference.md, cycle-fertility-reference.md, cpt-codes-fertility.md, insurance-coverage-data.md, clinic-intake-data.md, call-scripts.md, README.md) that is the single source of truth for all clinical values, codes, terms, and dialogue.
- **Couple_Workspace**: The shared space where both partners have their own data, scores, and tasks, exposed through Her view, His view, and Together view.
- **Her_View**: The view scoped to the female partner's profile, data, and tasks.
- **His_View**: The view scoped to the male partner's profile, data, and tasks.
- **Together_View**: The view scoped to shared couple data (insurance, goal, top concern, shared tasks).
- **Intake_Form**: A form-based (not conversational) data-entry surface for collecting Her, His, and Together data.
- **Trying_Window_Engine**: The rule-based component that computes the estimated trying window, priority days, and confidence label using the algorithm in cycle-fertility-reference.md.
- **Missing_Data_Detector**: The rule-based component that produces a checklist of missing or borderline data items and explains why each matters.
- **Task_Board**: The Her/His/Together task delegation board.
- **Voice_Agent**: The Grok Voice agent that performs simulated insurance and clinic phone calls.
- **Mock_Fallback**: The deterministic scripted/pre-recorded responder used when a live Grok or Grok Voice call is unavailable or fails.
- **Inngest_Workflow**: The orchestrated, multi-step workflow triggered by the `fertility.intake.completed` event.
- **Doctor_Summary**: The copyable, doctor-ready summary grounded only in Reference_Data sources.
- **Grounded_Chat**: The chat feature that answers couple-scoped questions in a fixed structured format with fixed sources.
- **Shared_Calendar**: The calendar showing the trying window, priority days, reminders, booked consult, and tasks.
- **Impeccable_Skill**: The design skill at `.kiro/skills/impeccable/` whose guidance (SKILL.md, layout.md, typeset.md, colorize.md, craft.md, polish.md, delight.md, critique.md) governs all UI.
- **Seed_Couple**: The fictional couple "Maya & Daniel" defined in sample-couple.md used to seed the application.
- **Readiness_Score**: The male partner's numeric readiness score (out of 100) that improves as tasks complete.
- **Trying_Duration_Rule**: The evaluation-timing rule (under 35 → 12 months, 35 or older → 6 months, red flags trigger early evaluation) from cycle-fertility-reference.md.
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

### Requirement 6: Grok Voice Agent — Simulated Calls (F6)

**User Story:** As a couple, we want an agent to make the insurance and clinic calls for us, so that we avoid the phone-and-paperwork grind.

#### Acceptance Criteria

1. THE Voice_Agent SHALL load the authorization packet fields defined in call-scripts.md before any call: caller_identity, patient_names, dob (her and him), insurance (provider, member_id, group_number, policy_holder), call_objective, and guardrails.
2. WHEN the Voice_Agent runs the insurance verification call, THE Voice_Agent SHALL ask the 10 insurance questions in the exact sequential order listed in call-scripts.md and extract the structured insurance result fields defined there: diagnostic_covered, semen_analysis_covered, hormone_labs_covered, prior_auth_required_for, in_network_lab, deductible, coinsurance_pct, oop_max, referral_required, and follow_up_tasks.
3. WHEN the Voice_Agent runs the clinic booking call, THE Voice_Agent SHALL ask the 7 clinic questions in the exact sequential order listed in call-scripts.md and extract the structured clinic result fields defined there: booked (date, time, mode, clinic), bring_list, tasks (her, him, together), and calendar_event.
4. WHEN the Voice_Agent completes a call, THE Voice_Agent SHALL produce a transcript as chronological agent and responder turns and a structured extracted result conforming to the schema defined for that call type in call-scripts.md.
5. IF the Voice_Agent cannot extract a defined result field from a call, THEN THE Voice_Agent SHALL mark that field as unresolved, add a follow-up task to obtain the field, and preserve all other extracted fields.
6. WHEN the Voice_Agent completes the clinic booking call, THE Voice_Agent SHALL write back the her, his, and together tasks, a calendar event dated 2026-06-25, and a summary containing the coverage facts, the appointment, and the bring-list.
7. IF a live Grok or Grok Voice call is unavailable or fails, THEN THE Voice_Agent SHALL use the deterministic Mock_Fallback, where deterministic means the Mock_Fallback returns the same schema and the same field values across repeated runs with identical inputs.
8. WHILE a call is in progress and the responder has not requested identity verification, THE Voice_Agent SHALL withhold the member ID and date of birth, and SHALL disclose the member ID and date of birth only after the responder requests identity verification, per the call-scripts.md guardrails.
9. IF a responder requests a medical decision or acceptance of treatment on the couple's behalf, THEN THE Voice_Agent SHALL decline the request and add a follow-up task for the couple to address it.

### Requirement 7: Inngest Workflow (F7)

**User Story:** As a demo audience, we want to see the workflow steps execute, so that the agentic orchestration is visible and credible.

#### Acceptance Criteria

1. WHEN the `fertility.intake.completed` event fires, THE Inngest_Workflow SHALL run the following seven steps, with each step starting only after the prior step completes: (1) extract profiles, (2) compute trying window, (3) detect missing data, (4) check trying-duration rule, (5) generate her/his/together tasks, (6) run simulated calls, and (7) build the doctor summary.
2. THE Inngest_Workflow SHALL display the status of each step in the UI as one of the enumerated values pending, running, completed, or failed.
3. IF a step fails, THEN THE Inngest_Workflow SHALL mark that step failed, halt all subsequent steps, and display an error indication identifying the failed step.
4. WHEN the trying-duration step runs, THE Inngest_Workflow SHALL apply the Trying_Duration_Rule: a female partner under 35 (age strictly less than 35) uses a 12-month threshold and a female partner 35 or older (age 35 or greater) uses a 6-month threshold.
5. IF any red-flag condition is present (irregular or absent periods, known PCOS or endometriosis, prior pelvic surgery, or known male factor as defined in cycle-fertility-reference.md), THEN THE Inngest_Workflow SHALL recommend early evaluation regardless of the trying-duration threshold.
6. WHEN the Inngest_Workflow processes the Seed_Couple data, THE Inngest_Workflow SHALL apply the 12-month threshold because the female partner is 33 (less than 35), record 8 months trying, and recommend early evaluation due to the red flags of irregular cycles and borderline semen analysis per sample-couple.md.

### Requirement 8: Doctor-Ready Summary (F8)

**User Story:** As a couple, we want a copyable doctor-ready summary, so that we enter the first appointment prepared.

#### Acceptance Criteria

1. THE Doctor_Summary SHALL include the following sections: both partners' data, the trying window and confidence label sourced from the Trying_Window_Engine, the missing tests sourced from the Missing_Data_Detector, questions for the doctor, verified coverage facts, and the booked consult on June 25, 2026.
2. WHEN a user invokes the copy action, THE Doctor_Summary SHALL place the complete text of all sections onto the clipboard in a single operation.
3. THE Doctor_Summary SHALL ground all clinical statements and citations only in sources cited within Reference_Data.
4. IF a clinical value or citation is not present in Reference_Data, THEN THE Doctor_Summary SHALL omit that value or citation.
5. IF insurance coverage is not verified, THEN THE Doctor_Summary SHALL label coverage as unverified (the seed couple's coverage_status is partial_unconfirmed in sample-couple.md).
6. IF the appointment is not booked, THEN THE Doctor_Summary SHALL indicate the appointment as pending.

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

1. THE Fairy_System SHALL source all clinical values, sample patient data, CPT codes, hormone and semen ranges, insurance terms, clinic info, and call scripts from Reference_Data.
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
2. THE Fairy_System SHALL use xAI Grok for reasoning and the Grok Voice Agent API for calls.
3. THE Fairy_System SHALL use Inngest for workflow orchestration and Supabase for data storage.
4. THE Fairy_System SHALL read the Grok API key from `XAI_API_KEY` in `.env.local` and SHALL fall back to `GROK_API_KEY` when `XAI_API_KEY` is absent.
5. WHEN any Grok or Grok Voice call is made, THE Fairy_System SHALL provide a deterministic Mock_Fallback so the demo continues without interruption.
6. THE Fairy_System SHALL exclude Twilio, real telephony, and real PHI.
7. THE Fairy_System SHALL run locally and deploy on Vercel.
8. THE Fairy_System SHALL name the sponsor tools xAI, Inngest, Vercel, and Cursor in the README.
9. THE Fairy_System SHALL document deferral of HIPAA compliance to production with a signed BAA in the README.

### Requirement 16: Working Demo Path

**User Story:** As a presenter, I want a reliable sub-three-minute demo path, so that the build can be shown end to end by hour four.

#### Acceptance Criteria

1. THE Fairy_System SHALL support a demo path in which the pre-seeded couple onboards, completing intake fires the Inngest_Workflow with visible steps, the dashboard shows the trying window with Low confidence and missing data, the Voice_Agent runs the insurance and clinic calls, results become her/his/together tasks and a booked June 25 consult, and the Doctor_Summary is generated.
2. THE Fairy_System SHALL complete the demo path in under three minutes.
3. IF a live agent call fails during the demo, THEN THE Fairy_System SHALL use the Mock_Fallback so the demo path completes.
