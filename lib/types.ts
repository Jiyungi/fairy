// Shared TYPE definitions for Fairy.
// Derived from .kiro/specs/fairy/design.md (Data Models + Components/Interfaces).
// This is the shared contract relied on by both Person A (core/db/agent/validation)
// and Person B (Inngest workflow, summary, chat). Keep accurate to design.md.

// ---------------------------------------------------------------------------
// Enumerations (grounded in sample-couple.md / validation schemas)
// ---------------------------------------------------------------------------

export type Role = "her" | "him";
export type SemenAnalysisStatus = "not_started" | "in_progress" | "completed";
export type PolicyHolder = "her" | "him";
export type CoverageStatus = "confirmed" | "partial_unconfirmed" | "unconfirmed";
export type Confidence = "Low" | "Moderate" | "High";
export type TaskColumn = "her" | "him" | "together";
export type FlagKind = "missing" | "borderline" | "unverified";
export type CallType = "insurance" | "clinic";
export type WorkflowStepStatus = "pending" | "running" | "completed" | "failed";

// ---------------------------------------------------------------------------
// Data model entities (Supabase schema — design.md Data Models)
// `null` represents a MISSING clinical value so the detector/UI can flag it.
// ---------------------------------------------------------------------------

export interface Couple {
  id: string;
  display_name: string;
  trying_since_months: number;
  goal: string;
  top_concern: string;
  insurance_provider: string;
  plan_type: string;
  member_id: string;
  group_number: string;
  policy_holder: PolicyHolder;
  coverage_status: CoverageStatus;
}

export interface Member {
  id: string;
  couple_id: string;
  role: Role;
  name: string;
  age: number;
  dob: string; // ISO date
}

export interface HerProfile {
  couple_id: string;
  last_period_start: string; // ISO date
  avg_cycle_length: number;
  cycle_length_min: number;
  cycle_length_max: number;
  cycle_regular: boolean;
  months_trying: number;
  conditions: string[];
  prior_meds: string[];
  ovulation_tracking: string;
  prior_pregnancies: number;
  amh: number | null;
  tsh: number | null;
  day3_fsh: number | null;
  day3_estradiol: number | null;
  mid_luteal_progesterone: number | null;
  prolactin: number | null;
}

export interface HimLifestyle {
  smoking: boolean;
  alcohol: string;
  heat_exposure: boolean;
  sleep: string;
  stress: string;
  bmi: number;
  supplements: boolean;
}

export interface HimMedicalHistory {
  surgeries: string;
  varicocele: string;
  medications: string;
  prior_children: number;
}

export interface HimProfile {
  couple_id: string;
  semen_analysis_status: SemenAnalysisStatus;
  semen_analysis_date: string | null; // ISO date
  volume_ml: number | null;
  concentration_million_ml: number | null;
  total_count_million: number | null;
  progressive_motility_pct: number | null;
  total_motility_pct: number | null;
  morphology_normal_pct: number | null;
  vitality_pct: number | null;
  ph: number | null;
  lifestyle: HimLifestyle;
  medical_history: HimMedicalHistory;
  readiness_score: number;
}

export interface TryingWindow {
  id: string;
  couple_id: string;
  fertile_window_start: string; // ISO date
  fertile_window_end: string;
  min_ovulation: string;
  max_ovulation: string;
  confidence: Confidence;
  reasons: string[];
}

export interface Task {
  id: string;
  couple_id: string;
  column: TaskColumn;
  title: string;
  completed: boolean;
  weight: number;
  source_call_record_id: string | null;
}

export interface CalendarEvent {
  id: string;
  couple_id: string;
  type: string;
  title: string;
  date: string; // ISO date
  time: string;
  description: string;
}

export interface CallRecord {
  id: string;
  couple_id: string;
  call_type: CallType;
  transcript: Turn[];
  extracted_result: InsuranceResult | ClinicResult;
  used_fallback: boolean;
  unresolved_fields: string[];
}

// ---------------------------------------------------------------------------
// Trying-Window Engine (lib/core/trying-window.ts) — Req 3
// ---------------------------------------------------------------------------

export interface TryingWindowInput {
  lastPeriodStart: string; // ISO date
  cycleLengthMin: number; // days
  cycleLengthMax: number; // days
  ovulationConfirmed: boolean; // mid-luteal progesterone OR LH confirmation present
}

export interface TryingWindowOutput {
  fertileWindowStart: string; // ISO date
  fertileWindowEnd: string;
  minOvulation: string; // priority day start
  maxOvulation: string; // priority day end
  confidence: Confidence;
  reasons: string[];
}

// ---------------------------------------------------------------------------
// Missing-Data Detector (lib/core/missing-data.ts) — Req 4
// ---------------------------------------------------------------------------

export interface MissingDataInput {
  labs: {
    day3_fsh: number | null;
    day3_estradiol: number | null;
    mid_luteal_progesterone: number | null;
    prolactin: number | null;
  };
  semen: {
    volume_ml: number | null;
    concentration_million_ml: number | null;
    total_count_million: number | null;
    progressive_motility_pct: number | null;
    total_motility_pct: number | null;
    morphology_normal_pct: number | null;
    vitality_pct: number | null;
    ph: number | null;
  };
  coverage_status: CoverageStatus | string;
}

export interface DataFlag {
  id: string; // e.g. "day3_fsh", "concentration", "insurance_coverage"
  kind: FlagKind;
  label: string;
  explanation: string; // grounded text citing the reference file
  source: string; // reference file name
}

// ---------------------------------------------------------------------------
// Trying-Duration Rule (lib/core/duration-rule.ts) — Req 7.4–7.6
// ---------------------------------------------------------------------------

export interface DurationInput {
  femaleAge: number;
  monthsTrying: number;
  redFlags: string[];
}

export interface DurationResult {
  thresholdMonths: 6 | 12;
  recommendEarlyEvaluation: boolean;
  redFlags: string[];
}

// ---------------------------------------------------------------------------
// Structured-Result Extractors / Agent (lib/core/extract.ts, lib/agent/) — Req 6
// ---------------------------------------------------------------------------

export interface InsuranceResult {
  diagnostic_covered: boolean;
  semen_analysis_covered: boolean;
  hormone_labs_covered: boolean;
  prior_auth_required_for: string[];
  in_network_lab: string;
  deductible: number;
  coinsurance_pct: number;
  oop_max: number;
  referral_required: boolean;
  follow_up_tasks: string[];
}

export interface ClinicResult {
  booked: { date: string; time: string; mode: string; clinic: string };
  bring_list: string[];
  tasks: { her: string[]; him: string[]; together: string[] };
  calendar_event: { type: string; date: string; time: string };
}

export interface Turn {
  speaker: "agent" | "responder";
  text: string;
}

export interface AuthPacket {
  couple_id: string;
  member_id: string;
  dob: string;
  provider: string;
  plan_type: string;
  group_number: string;
  policy_holder: PolicyHolder;
}

export interface CallOutput<T> {
  transcript: Turn[];
  result: T;
  usedFallback: boolean;
}
