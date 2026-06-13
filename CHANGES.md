# Fairy — Changes Beyond the Original Plan

Scope: work on the **`feature/person-a-fairy`** branch (Person A — Product & Data/UI) that was **not** part of the original `tasks.md` plan written when the branch was first created.

- **Original plan (implemented as specified):** Task 1 (scaffold), 2.2/2.3 (validation), 3 (trying-window), 4 (missing-data), 5 (duration/readiness), 8 (data model + seed), 12 (Impeccable UI shell), 13 (intake forms), 14 (workspace views), 15 (task board), 16 (calendar), 17 (doctor summary), and checkpoints 6/11.
- **Everything below is an addition or change made afterward** — driven by Person B's evolution directive (Changes 1–5) and by product/UX iteration requests.

Commits that contain these changes: `ba98a3f`, `8c24f15`, `263f214`, `51136a3`.

---

## 1. Spec evolution for the agentic workflow (Changes 1–5) — `ba98a3f`

The original spec described a **linear 7-step** Inngest workflow and a **scripted** voice agent. Person B's directive evolved this; I re-ran requirements → design → tasks so all three stay consistent. New material that did **not** exist in the original plan:

**Requirements**
- **Req 6 rewritten** — Voice agent now holds a **live spoken conversation with a real human** over the Grok Voice WebSocket (`XAI_VOICE_WS_URL` / `XAI_VOICE_MODEL`); the 10 insurance / 7 clinic questions became a **checklist of objectives** the agent phrases adaptively and extracts from the real transcript. Mock_Fallback is now a **safety net only**. Added Req 6.10 (live Call Console).
- **Req 7 rewritten** — linear sequence replaced by an **event-driven graph**: parallel fan-out/fan-in (analyze her/his; insurance/clinic calls), `call.completed` emission, paused status.
- **New Req 17** — human-in-the-loop **booking approval gate** (`waitForEvent couple.booking.approved`, timeout → "needs approval", no double-book).
- **New Req 18** — scheduled **male check-in** via `step.sleep`/`sleepUntil`, demoable through `CHECKIN_DELAY`.
- **New Req 19** — event-driven **reactive summary function** + the `Workflow_Events` set.
- **New Req 20** — live **Call Console** + **parallel/paused WorkflowViewer** visibility.
- **Req 15/16 updated** — voice WebSocket env vars, `CHECKIN_DELAY`, and a demo path that includes parallel branches, the approval pause, and the scheduled check-in.

**Design**
- Replaced the linear-workflow section with the **event-driven graph** (new diagram), rewrote the **Voice Agent Resolution Strategy** for the live-human path, added the `WorkflowViewer` / `CallConsole` / `BookingApprovalCard` component specs, and refreshed error handling + testing strategy.
- **New correctness properties 27–32** (live-transcript extraction; fallback-only-on-failure determinism; resume-without-double-book; appointment-stays-pending; reactive summary fires per call; parallel branches join before proceeding). Updated Property 17 → 28 wording.

**Tasks**
- Added **Tasks 21–23 (Person A)** and **24–25 (Person B)** with ownership and full requirement/property traceability, plus updated the task-dependency graph.

---

## 2. New Person A features — `8c24f15`

These components did not exist in the original plan; they support Person B's new workflow.

- **Parallel-branch `WorkflowViewer`** (Task 21) — renders concurrent fan-out branches as side-by-side tracks and a `paused` approval-gate status; backward-compatible with the original linear API.
- **Live `CallConsole`** (Task 22) — chronological agent/human transcript, **LIVE vs FALLBACK** indicator (bound to `usedFallback`), and progressively-resolving result fields (no fabricated values).
- **`BookingApprovalCard`** (Task 23) + `lib/booking/approval.ts` — the human-in-the-loop pause made actionable, with a once-only `couple.booking.approved` emit seam (no double-book) and a timed-out "needs approval" state.
- Added property/structural tests for each (Properties 28/29 UI portions, parallel + paused rendering).

---

## 3. UI/UX iterations not in any original task — `263f214`, `51136a3`

Product-feedback changes made to the shell and home experience after the planned screens were built.

**App behaves like a native app shell** (`263f214`, refined in `51136a3`)
- The bottom tab bar (Home/Calendar/Tasks/Chat) and the sticky header are now **fixed**; only the inner content region scrolls.
- The phone frame uses a **fixed, viewport-capped height**, so the **whole app fits the screen with no page scroll**.

**Per-partner restricted views** (`51136a3`) — *new capability, realizes Req 1.2 ownership*
- Added a lightweight **sign-in / perspective** step: `PerspectiveProvider`, `AppGate`, and a `SignIn` chooser (Maya / Daniel), persisted to `localStorage`.
- Once signed in, the workspace shows **only that partner's own view + the shared Together view** — never the other partner's private view. The header shows who's signed in with a one-tap switch.
- New tests assert the restriction (His+Together for Daniel, Her+Together for Maya).

**No visible scrollbars** (`51136a3`)
- Added a `.no-scrollbar` utility and applied it to every scroll region (content area, intake, summary, call transcript, the progress strip) — scrolling still works, the chrome is hidden.

**Workflow abstracted for end users** (`51136a3`) — *product decision*
- Replaced the technical `WorkflowViewer` on **Home** with a new **`ProgressJourney`**: a swipeable row of plain-language status cards ("Getting to know you ✓", "Your okay needed — now", "Booking your consult — next") with an overall progress bar and "Step N of M".
- The detailed `WorkflowViewer` component is retained in the codebase (still satisfies Req 20.4 as the internal/credibility view) but is no longer shown to couples.

---

## 4. Verification deltas

- Full suite grew from the original ~94 tests to **116 tests** (added: parallel WorkflowViewer, CallConsole, BookingApproval, perspective restriction, ProgressJourney). `tsc` clean and the production build green throughout.
- Gave the render-heavy calendar property test an explicit timeout after it flaked under the larger parallel suite.

---

## 5. Proposed / pending (discussed, not yet built)

- **Grounded Chat improvement (Req 9 / Task 18, Person B + Person A UI).** Agreed direction: a grounded co-pilot scoped to `couple_001` that answers in the fixed five-section format using **Grok structured outputs** + **function-calling over the rules core** (so it quotes real values, never invents), with clickable citations, actionable "shared next step," hard guardrails, and a deterministic Mock_Fallback for the five canonical questions. Backend is Person B's; the chat UI (message list, suggested-prompt chips, citation chips, create-task/open-calendar actions, streaming) is Person A's. **Not yet implemented.**

---

## Ownership reminder

- **Person A (this branch):** Tasks 1, 2.2/2.3, 3, 4, 5, 8, 12–17, 21–23, plus the shell/sign-in/scrollbar/progress UX changes above.
- **Person B (`person-b/agent-workflow`):** reference constants (2.1), extractors (7), voice agent (9), workflow (10), chat backend (18), wiring/config (19), and the new live-voice + event-graph tasks (24, 25).
- Shared coordination seams are documented in code where Person A's UI consumes Person B's outputs (workflow status by id, `CallOutput`, the `couple.booking.approved` emit, the chat Grok-response shape).
