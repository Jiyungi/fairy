# Fairy Reference Data

This folder contains **grounded reference data** for building Fairy. The goal: spec mode and
the build agent should pull realistic values from here instead of inventing numbers.

## What is real vs fictional

- **Clinical reference ranges, CPT codes, hormone values, semen parameters, insurance
  terminology, and call questions are REAL** and cited to their sources (WHO, ASRM, ACOG,
  MedlinePlus, university fertility centers).
- **The specific people (the sample couple, their member IDs, the clinic name) are FICTIONAL.**
  They are invented characters, not real patients. No real PHI is used, so there is no HIPAA
  concern. Member IDs, group numbers, and phone numbers are obviously fake placeholders.

## Files

| File | What it gives the build |
| --- | --- |
| `sample-couple.md` | The seed couple — both partners' full profiles, grounded in realistic values |
| `semen-analysis-reference.md` | WHO 2021 reference ranges + a sample (his) result |
| `female-hormone-reference.md` | AMH / FSH / LH / estradiol / progesterone ranges + sample (her) labs |
| `cycle-fertility-reference.md` | Cycle norms, ovulation timing, trying-duration rules, the trying-window math |
| `cpt-codes-fertility.md` | Real CPT codes for fertility tests/procedures (for the agent + summary) |
| `insurance-coverage-data.md` | Coverage terms, prior auth, a sample plan, the insurance call questions |
| `clinic-intake-data.md` | What to bring, first-appointment norms, a sample clinic + slots |
| `call-scripts.md` | Grounded insurance + clinic call scripts for the Grok Voice agent |

## How to use

- Seed the Supabase tables from `sample-couple.md`.
- Use the reference files to populate dropdown options, validation ranges, and the doctor summary.
- Use `call-scripts.md` as the system prompt / dialogue plan for the Grok Voice agent and its
  mock "rep/clinic" responder.
- Every clinical claim in the doctor summary / chat should trace back to a source listed here.

> Footer disclaimer for the app (one line only): "Fairy provides educational fertility
> information, not medical advice."
