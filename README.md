# Fairy

Fairy is a mobile-first web app that treats fertility preparation as a shared,
two-partner workflow for straight couples in the US who are trying to conceive.
Beyond a tracker, it adds an autonomous agent that handles the phone-and-paperwork
grind: it runs **simulated** insurance and clinic calls, extracts structured
results, and turns them into calendar events and tasks. The product theme is
**patient agency**.

Built in one day for a Health AI hackathon by two people working in parallel.

> Fairy provides educational fertility information, not medical advice.

## Sponsor tools

Fairy is built with and credits these sponsor tools:

- **xAI** — Grok for reasoning, structured extraction, and grounded chat, plus
  the Grok Voice Agent API for the simulated calls.
- **Inngest** — event-driven, step-based orchestration of the seven-step agent
  workflow.
- **Vercel** — hosting and deployment of the Next.js app.
- **Cursor** — used as part of the development workflow.

## Scope and exclusions

This is a hackathon build, so the boundaries are deliberate:

- **Excluded: Twilio, real telephony, and real PHI.** All "calls" are simulated
  by the Grok Voice agent or its deterministic Mock_Fallback against the
  fictional seed couple. No real phone calls are placed and no real protected
  health information is handled.
- **HIPAA compliance is deferred to production.** A production deployment that
  handles real PHI would require a signed Business Associate Agreement (BAA)
  with each processor (xAI, Supabase, Vercel, Inngest) before going live. This
  hackathon build uses only synthetic reference data, so no BAA is in place.

## Tech stack

| Concern | Choice |
| --- | --- |
| Framework | Next.js (App Router), TypeScript |
| Styling | Tailwind CSS, shadcn/ui (governed by the Impeccable skill) |
| Reasoning | xAI Grok |
| Simulated calls | Grok Voice Agent API, with deterministic Mock_Fallback |
| Orchestration | Inngest |
| Data | Supabase (Postgres) |
| Deployment | Vercel (also runs locally) |

## Configuration and secrets

Fairy resolves the Grok API key with a fallback chain (see `lib/config.ts`):

1. `XAI_API_KEY` — the primary key name.
2. `GROK_API_KEY` — used only when `XAI_API_KEY` is absent.

If **neither** key is set, the system falls back to the **deterministic
Mock_Fallback**: every Grok and Grok Voice path returns the same schema and the
same field values across repeated runs with identical inputs, so the demo runs
end to end with no secrets and never stalls on a live failure. You can also
force the fallback during rehearsals by setting `USE_MOCK_AI=true`.

Copy `.env_example` to `.env.local` and fill in values as needed:

```bash
cp .env_example .env.local
```

`.env`, `.env.local`, and `.env.*.local` are gitignored — **never commit real
secrets**. Only `.env_example` (with empty placeholders) is committed.

## Getting started

```bash
npm install      # install dependencies
npm run dev      # start the local dev server at http://localhost:3000
npm test         # run the Vitest unit + property-based test suite
```

With no API keys configured the app runs entirely on the deterministic
Mock_Fallback, which is the recommended mode for local development and demos.

## Deployment

Fairy deploys on **Vercel** as a standard Next.js App Router project (no special
build configuration required; see `vercel.json`). Set the environment variables
from `.env_example` in the Vercel project settings. It also runs locally with
`npm run dev`.

## Architecture overview

Fairy follows a "pure core, impure shell" structure:

- **Pure rules core (`lib/core/`)** — deterministic, I/O-free functions where
  correctness lives: the trying-window engine, missing-data detector,
  trying-duration rule, readiness score, and the structured-result extractors.
  These are heavily covered by property-based tests.
- **Agent (`lib/agent/`)** — the Grok Voice adapter exposing `runInsuranceCall`
  / `runClinicCall`. It tries the live path and transparently falls through to
  the deterministic Mock_Fallback on unavailability or failure.
- **Workflow (`lib/inngest/`)** — the seven-step Inngest function triggered by
  `fertility.intake.completed`: extract profiles → compute trying window →
  detect missing data → check duration rule → generate tasks → run simulated
  calls → build the doctor summary.
- **Chat (`lib/chat/`, `app/api/chat/`)** — grounded chat scoped to the single
  seed couple, answering in a fixed five-section format, with a Mock_Fallback.
- **Config (`lib/config.ts`)** — the single source of truth for secret
  resolution and the Mock_Fallback decision.
- **Data (`lib/db/`, `supabase/`)** — Supabase schema and the seed loader for
  the fictional couple "Maya & Daniel".
- **UI (`app/`, `components/`)** — a 390px phone-frame app with bottom tab
  navigation (Home / Calendar / Tasks / Chat), built with the Impeccable skill.

All clinical values, codes, ranges, and call dialogue come from
`/reference-data/` — no medical numbers are invented in code.
