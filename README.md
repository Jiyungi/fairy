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

The live Grok Voice path uses `XAI_VOICE_WS_URL` and `XAI_VOICE_MODEL`. The
reactive workflow timing is configurable: `CHECKIN_DELAY` (how long before the
male-track re-test Check_In fires — represents the ~72-day / ~10–12-week
sperm-regeneration horizon; set to seconds on stage so it is demoable) and
`APPROVAL_WAIT_TIMEOUT` (how long the booking Approval_Gate pauses awaiting
`couple.booking.approved` before it expires and leaves the appointment pending).

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
- **Agent (`lib/agent/`)** — the genuinely agentic Grok Voice adapter exposing
  `runInsuranceCall` / `runClinicCall`. It opens a real `Live_Voice_Session`
  over a WebSocket (`XAI_VOICE_WS_URL` / `XAI_VOICE_MODEL`), speaks its own
  questions, listens to a live human (during the demo, a presenter plays the
  insurance rep / clinic scheduler), and extracts the structured result from the
  real transcript. `call-scripts.md` is a checklist of objectives, not a verbatim
  script. The deterministic Mock_Fallback is a **safety net only**, engaged when
  the live session is unavailable or fails mid-call.
- **Workflow (`lib/inngest/`)** — an event-driven **reactive graph** triggered by
  `fertility.intake.completed`: analyze-her ∥ analyze-his (parallel) → compute
  trying window → detect missing data → check duration rule → generate tasks →
  insurance call ∥ clinic call (parallel, live voice) → pause at a human-in-the-loop
  Approval_Gate (`waitForEvent couple.booking.approved`) → finalize the June 25
  booking → schedule a delayed male-track Check_In (`step.sleep`, `CHECKIN_DELAY`)
  → build the doctor summary. A separate function reacts to `call.completed` to
  refresh the summary. Four events drive the graph: `fertility.intake.completed`,
  `call.completed`, `couple.booking.approved`, `checkin.due`.
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
