// STUB (Person A owns the real implementation — replaced at merge). Returns seed-correct values for Person B integration.
//
// Minimal Zod schemas (Req 2). Just enough shape for Person B's intake/workflow wiring;
// Person A will tighten reference-grounded bounds (WHO 2021, cycle ranges, etc.).

import { z } from "zod";

const nullableNumber = z.number().nullable();

// Her intake — field names mirror sample-couple.md.
export const HerSchema = z.object({
  last_period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  avg_cycle_length: z.number().int().positive(),
  cycle_length_min: z.number().int().positive(),
  cycle_length_max: z.number().int().positive(),
  cycle_regular: z.boolean(),
  months_trying: z.number().int().nonnegative(),
  conditions: z.array(z.string()).default([]),
  prior_meds: z.array(z.string()).default([]),
  ovulation_tracking: z.string().default(""),
  prior_pregnancies: z.number().int().nonnegative().default(0),
  amh: nullableNumber,
  tsh: nullableNumber,
  day3_fsh: nullableNumber,
  day3_estradiol: nullableNumber,
  mid_luteal_progesterone: nullableNumber,
  prolactin: nullableNumber,
});

// His intake.
export const HisSchema = z.object({
  semen_analysis_status: z.enum(["not_started", "in_progress", "completed"]),
  semen_analysis_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  volume_ml: nullableNumber,
  concentration_million_ml: nullableNumber,
  total_count_million: nullableNumber,
  progressive_motility_pct: nullableNumber,
  total_motility_pct: nullableNumber,
  morphology_normal_pct: nullableNumber,
  vitality_pct: nullableNumber,
  ph: nullableNumber,
});

// Together (shared / insurance) intake.
export const TogetherSchema = z.object({
  insurance_provider: z.string(),
  plan_type: z.string(),
  member_id: z.string(),
  group_number: z.string(),
  policy_holder: z.enum(["her", "him"]),
  coverage_status: z.enum(["confirmed", "partial_unconfirmed", "unconfirmed"]),
});

export type HerInput = z.infer<typeof HerSchema>;
export type HisInput = z.infer<typeof HisSchema>;
export type TogetherInput = z.infer<typeof TogetherSchema>;
