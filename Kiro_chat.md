[6/13/2026 11:36 AM] Jiyun Kim: # Fairy — Project Handoff Summary

## What it is
Fairy is an autonomous fertility care agent for couples trying to conceive, built for a one-day Health AI hackathon. Theme: "The future of care is autonomous. Patient agency in healthcare." It is explicitly not a period tracker. It turns both partners' data into a shared calendar, delegated tasks, grounded answers, and a doctor-ready care plan.

Core differentiator: encourages male partner participation and reduces the woman's hidden mental load by splitting work into her/his/together tasks. Honest about uncertainty (explicit confidence level + why + missing data).

## Hard constraints
- Synthetic data only. Everything (users, transcripts, records, labs, calendar) is fictional and labeled in UI: "Synthetic demo data. Not real patient information." Plus a privacy note about HIPAA in production. No real PHI; no sensitive data in logs.
- Medical safety. No diagnosis, prescription, or pregnancy guarantees. Use safe language ("estimated trying window," "priority trying days," "confidence level," "worth discussing with a clinician," "this is not medical advice"). Visible disclaimer required.
- MVP only. Demo clarity over completeness. 3-minute demo path is the priority. No overbuilding.

## Stack (confirmed decisions)
- Next.js App Router + TypeScript + Tailwind + shadcn/ui (confirmed).
- Inngest = autonomous workflow engine. Event fertility.intake.completed triggers steps: extract profile → parse records → compute trying window → detect missing data → generate partner tasks → create calendar events → doctor summary → insurance questions.
- Grok (xAI) = AI reasoning layer for profile extraction, plan generation, doctor summary, grounded chat. User HAS a Grok API key → use live calls with a mock fallback kept in code so demo never breaks. Key goes in .env.local as GROK_API_KEY/XAI_API_KEY (never committed).
- Vercel = deployment + patient-facing workspace.
- Cursor = build environment only (one footer/README mention, not a product surface).
- No database. In-memory/client store seeded from sample data.

## Confirmed UX decisions
- Task delegation board lives on the calendar page (not a separate tab).
- Grok: live with mock fallback.
- shadcn/ui: yes.

## Pages
/ landing · /intake (Grok Voice demo + live profile extraction + sample uploads + "Complete Intake") · /dashboard (agent plan + workflow status) · /calendar (shared calendar + clickable event detail + task board) · /chat (grounded chat) · /summary (copyable doctor-ready summary).

## File structure
app/ layout.tsx page.tsx intake/ dashboard/ calendar/ chat/ summary/
  api/inngest/route.ts api/chat/route.ts api/generate-plan/route.ts
components/ VoiceIntakeDemo ExtractedProfilePanel UploadRecordsDemo AgentPlanCard
  SharedCalendar CalendarEventDetail TaskDelegationBoard GroundedChat DoctorSummary
  Disclaimer SyntheticDataBadge WorkflowStatus
lib/ sampleData.ts fertilityLogic.ts grounding.ts doctorSummary.ts grok.ts store.ts types.ts
inngest/ client.ts functions.ts

## Trying-window logic (must produce these for the sample profile)
- Irregular cycle path: minOvulation = lastPeriodStart + cycleLengthMin − 14; maxOvulation = lastPeriodStart + cycleLengthMax − 14; fertileWindowStart = minOvulation − 5; fertileWindowEnd = maxOvulation + 1; confidence low/medium-low.
- Expected output: Estimated trying window June 27 – July 17, 2026; Priority July 2 – July 16, 2026; Confidence Low; Reason: irregular cycle, ovulation not confirmed, wide cycle range.
- Male data must NOT change ovulation timing — it only affects readiness, tasks, missing data, and doctor questions.
[6/13/2026 11:36 AM] Jiyun Kim: ## Synthetic sample data (provided by user)
- Profile: trying 8 months; female lastPeriodStart 2026-06-01, cycle 45–60d, irregular, ovulation not confirmed, prior letrozole, mental load high; male: no semen analysis, heat exposure, sleep okay, alcohol moderate; concerns: timing/testing/insurance/shared responsibility.
- Records: letrozole prescription (2.5mg, 2026-03-10), cycle chart (irregular 45–60d, ovulation not confirmed), semen analysis (missing), insurance (coverage uncertainty; ask CPT codes, prior auth, in-network lab, out-of-pocket).
- 11 calendar events (period, lh_test, male_prep, fertile_window, priority_trying_day, support_checkin, insurance_task, semen_analysis, doctor_summary) — full list in the original brief.
- TypeScript types provided for CoupleProfile, UploadedRecord, TryingWindow, CalendarEvent, PartnerTask, PartnerOwner.

## Grounding — REAL sources found (cite with links in lib/grounding.ts)
- ACOG — "Trying to Get Pregnant? Here's When to Have Sex": ovulation ~14 days before next period regardless of cycle length. https://www.acog.org/womens-health/experts-and-stories/the-latest/trying-to-get-pregnant-heres-when-to-have-sex
- ASRM — Optimizing Natural Fertility (committee opinion 2022) + patient fact sheet: fertile window = 6-day interval ending on ovulation; intercourse every 1–2 days = highest rates; ~80% conceive in first 6 months. https://www.asrm.org/practice-guidance/practice-committee-documents/optimizing-natural-fertility-a-committee-opinion-2021 · https://www.reproductivefacts.org/news-and-publications/fact-sheets-and-infographics/optimizing-natural-fertility
- ASRM/ACOG — evaluation timing: after 12 months trying (<35) or 6 months (35+). https://www.asrm.org/practice-guidance/practice-committee-documents/fertility-evaluation-of-infertile-women-a-committee-opinion-2021/ · http://www.acog.org/Patients/FAQs/Evaluating-Infertility
- NICHD (NIH) — peak fertility days 12–14 of avg 28-day cycle. https://www.nichd.nih.gov/newsroom/digital-media/infographics/ovulation-textalt
- CDC — Infertility FAQs (secondary reference).
- All snippets paraphrased (<30 consecutive words), each rendered as a clickable link in chat "Sources used" and the doctor summary.

## Mock-with-assumption (must be labeled in UI + code comments)
- The specific couple/records/events/transcript (synthetic).
- Luteal-phase = 14 days assumption for irregular cycles → flagged as a key reason confidence is Low.
- Confidence scoring weights + missing-data heuristics → "rule-based estimate, not a clinical algorithm."
- Male lifestyle notes → "worth discussing," not quantified.
- Add a "How Fairy grounds its answers" note distinguishing cited guidance from Fairy assumptions.

## Grounded chat answer format (required)
Short answer · Based on your data · What is uncertain · Shared next step · Sources used. Must answer ≥5 questions (e.g., "Why are these days priority?", "What should my partner do this week?", "Why is confidence low?", "What should we ask the doctor?", "What data are we missing?").

## Build order (exact)
1. Scaffold Next.js + Tailwind + shadcn/ui; layout with nav, Disclaimer, SyntheticDataBadge. 2. Landing page. 3. types.ts + sampleData.ts. 4. fertilityLogic.ts (verify June 27–July 17 / July 2–16 / Low). 5. store.ts. 6. Intake page (voice demo + extraction + uploads + Complete Intake). 7. Inngest client/functions + api/inngest/route.ts + WorkflowStatus UI + fire event on intake. 8. Dashboard + AgentPlanCard. 9. Calendar + CalendarEventDetail + TaskDelegationBoard. 10. grounding.ts (real sources w/ links) + api/chat + GroundedChat. 11. doctorSummary.ts + summary page + copy button. 12. grok.ts live + mock fallback wired into chat/plan/summary. 13. Polish + README + 3-min dry run.
[6/13/2026 11:36 AM] Jiyun Kim: ## Demo flow (under 3 min)
Landing → start intake → play synthetic Grok Voice transcript → profile auto-extracts → add sample prescription + cycle chart → Complete Intake fires Inngest workflow (visible steps) → dashboard shows trying window + Low confidence → calendar + her/his/together tasks → click "Ask about semen analysis" event detail → chat "What should my partner do this week?" (grounded answer) → doctor-ready summary (copyable). Closing line: "Fairy is not another fertility tracker. It is an autonomous care agent that helps couples share the work of trying to conceive and enter clinical care prepared."

## Acceptance criteria
Runs locally; all pages present; all data synthetic + labeled; visible privacy + medical disclaimer; intake creates couple profile; trying-window calc works; calendar shows generated events; tasks split her/his/together; chat answers ≥5 Qs with grounding; doctor summary generated + copyable; Inngest workflow present + visible in code; sponsor usage clear in UI + comments; demo completes under 3 min.

## Current status
Planning approved in principle; all open questions resolved (Grok key available, task board on calendar page, shadcn/ui yes). No files created yet — awaiting final "go" to begin building from step 1.

---

Want me to save this as a markdown file in the project (e.g., HANDOFF.md), or is the pasteable version enough?