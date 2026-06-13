import { buildSeedCouple } from "@/lib/db/seed";
import type { CalendarEvent, Task } from "@/lib/db/types";
import type { TryingWindowInput } from "@/lib/core/trying-window";
import { CalendarView } from "@/components/fairy/CalendarView";

/*
  Shared Calendar screen (Task 16 / Req 10). Shell chrome — the 390px frame,
  the sticky "Calendar" header, bottom tabs, and the single disclaimer — is
  provided by the (tabs) layout, so this screen renders content only.

  The trying-window and priority-day dates are NOT hardcoded here: CalendarView
  derives them by calling the Trying-Window engine with the couple's cycle
  inputs, keeping the engine the single source of truth (Req 10.3, 10.4). The
  consult and prep tasks are grounded verbatim in the booking outcome from
  `/reference-data/clinic-intake-data.md` (Req 12).
*/

const seed = buildSeedCouple();
const { couple, herProfile } = seed;

// Female cycle inputs only — the engine excludes male data (Req 3.6). Ovulation
// is unconfirmed because the seed's mid-luteal progesterone is MISSING.
const cycle: TryingWindowInput = {
  lastPeriodStart: herProfile.last_period_start ?? "",
  cycleLengthMin: herProfile.cycle_length_min ?? 0,
  cycleLengthMax: herProfile.cycle_length_max ?? 0,
  ovulationConfirmed: herProfile.mid_luteal_progesterone != null,
};

// Booked consult — grounded in clinic-intake-data.md (Req 6.6, 10.1).
const consult: CalendarEvent = {
  id: "evt-consult-001",
  couple_id: couple.id,
  type: "consult",
  title: "Fertility consult — Bay Area Fertility & Reproductive Health",
  date: "2026-06-25",
  time: "2:00 PM",
  description:
    "First consult (in person) at Bay Area Fertility & Reproductive Health, San Francisco. " +
    "Bring: photo ID, insurance card, cycle history, prior meds, semen analysis, and any labs.",
};

// Her / His / Together prep tasks — verbatim from the booking-call outcome in
// clinic-intake-data.md (Req 5.2, 10.1).
const tasks: Task[] = [
  {
    id: "task-her-001",
    couple_id: couple.id,
    column: "her",
    title: "Gather cycle history and bring your AMH result",
    completed: false,
    weight: 0,
    source_call_record_id: null,
  },
  {
    id: "task-him-001",
    couple_id: couple.id,
    column: "him",
    title: "Bring your semen analysis and request a urology note",
    completed: false,
    weight: 0,
    source_call_record_id: null,
  },
  {
    id: "task-together-001",
    couple_id: couple.id,
    column: "together",
    title: "Confirm insurance card and complete intake forms",
    completed: false,
    weight: 0,
    source_call_record_id: null,
  },
];

export default function CalendarPage() {
  return <CalendarView cycle={cycle} events={[consult]} tasks={tasks} />;
}
