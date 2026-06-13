/**
 * Female fertility hormone reference values.
 *
 * Source: /reference-data/female-hormone-reference.md
 *  - Day-3 FSH & Estradiol are drawn on cycle day 2–3 because levels shift
 *    across the cycle ("Day-3 FSH & Estradiol — drawn on cycle day 2–3").
 *  - Mid-luteal progesterone confirms ovulation: ~1 week after ovulation it
 *    should rise; ≈10 ng/mL suggests ovulation occurred ("Progesterone ...
 *    ≈10 ng/mL suggests ovulation occurred").
 *
 * Literals are copied verbatim from the reference file (Req 12.1).
 *
 * NOTE: This branch intentionally defines FEMALE_HORMONE in its own module
 * rather than in `lib/reference/index.ts`, which is owned separately.
 */
export const FEMALE_HORMONE = {
  /** Day-3 FSH/Estradiol draw window — cycle day 2–3. */
  day3FshDrawWindow: "cycle day 2–3",
  /** Mid-luteal progesterone level that suggests ovulation occurred (ng/mL). */
  ovulationIndicativeProgesteroneNgMl: 10,
} as const;
