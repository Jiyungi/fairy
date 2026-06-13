// ===========================================================================
// Female fertility hormone reference: day-3 draw windows and targets.
// SOURCE (verbatim): reference-data/female-hormone-reference.md
// Used to validate "her" lab fields and to interpret the seed couple's labs.
// SINGLE SOURCE OF TRUTH — no clinical literal for female hormones lives elsewhere.
// ===========================================================================

export const FEMALE_HORMONE = {
  // "Day-3 FSH & Estradiol — drawn on cycle day 2–3"
  day3FshDrawWindow: "cycle day 2–3",
  // "Progesterone ... ≈10 ng/mL suggests ovulation occurred"
  ovulationIndicativeProgesteroneNgMl: 10,
} as const;

// reference-data/female-hormone-reference.md — "Day-3 FSH & Estradiol" table
export const DAY3_FSH_MIU_ML = {
  favorableMax: 10, // < 10 mIU/mL favorable
  borderlineMin: 10, // 10–15 borderline
  borderlineMax: 15,
  reducedReserveAbove: 15, // > 15 reduced reserve
} as const;

export const DAY3_ESTRADIOL_PG_ML = {
  // "~ 25–75 pg/mL on day 3"
  typicalMin: 25,
  typicalMax: 75,
} as const;

// reference-data/female-hormone-reference.md — "AMH ... ovarian reserve marker"
// Can be drawn any day of the cycle.
export const AMH_NG_ML = {
  highAbove: 3.0, // > 3.0 ng/mL High (can suggest PCOS)
  normalMin: 1.0, // 1.0 – 3.0 ng/mL Normal / expected
  normalMax: 3.0,
  lowNormalMin: 0.5, // 0.5 – 1.0 ng/mL Low–normal / diminishing
  lowNormalMax: 1.0,
  lowReserveBelow: 0.5, // < 0.5 ng/mL Low ovarian reserve
} as const;

export type FemaleHormone = typeof FEMALE_HORMONE;
