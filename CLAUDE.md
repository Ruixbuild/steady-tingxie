# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

- `npm run dev` — start the dev server (Turbopack, port 3000)
- `npm run build` — production build
- `npm run lint` — ESLint (flat config, `eslint.config.mjs`)
- `npx tsc --noEmit` — type-check (no separate typecheck script defined)

There is no test suite/runner in this repo. Verify changes with `npx tsc --noEmit`, `npm run lint`, and a manual walkthrough in the browser.

## Architecture

**Steady Ting Xie (听写)** — a Next.js 16 (App Router) app for Singapore primary-school children to practice Chinese dictation: learning to write hanzi by stroke, drilling pinyin, and taking blind dictation tests, with parent-side list management and progress tracking.

### Two-sided app under one auth domain

- `app/parent/*` — parent-facing: upload/OCR a new word list, edit lists, view reports, settings. Gated by Supabase auth (`redirect("/login")` if no session).
- `app/kid/[childId]/list/[listId]/*` — child-facing: `learn` (stroke-by-stroke writing practice), `test` (blind dictation), `reader` (dictation/passage playback, labeled "Dictation" in the UI), `progress` (word garden), `results/[attemptId]`.
- `app/admin` — internal analytics dashboard, gated by an `ADMIN_EMAILS` allowlist checked against the session email *before* the service-role client is created.

There is no separate "child login" — a parent's session covers all their children; `childId`/`listId` route params scope which child/list is being viewed, with Supabase RLS (not application code) enforcing that a user can only read/write their own family's rows. **RLS policies live only in the Supabase dashboard, not in this repo** — there is no schema/migrations directory here, only the RPC function bodies (see below). Any change to what a query is allowed to touch depends on that out-of-repo policy state.

### Supabase access pattern (`lib/supabase/`)

Three client constructors, each for a distinct context — never mix them up:
- `client.ts` — browser client (anon key), for Client Components.
- `server.ts` — server client (anon key, cookie-bound session), for Server Components/Route Handlers. Relies on `proxy.ts` (Next 16's renamed `middleware.ts`) to refresh the auth cookie on every request.
- `admin.ts` — service-role client, **bypasses RLS**. Server-only, used sparingly (analytics in `app/admin`, the `events`/`profiles` bookkeeping in `lib/supabase/events.ts`, and `app/api/digest`). Never import into a Client Component.

### Multi-step writes go through SQL RPCs, not chained client calls

Anything that touches more than one table atomically is a `plpgsql` function in `lib/supabase/*.sql`, called via `supabase.rpc(...)`. These files are the source of truth for that logic but are **not auto-applied** — after editing one, it must be re-run manually in the Supabase SQL Editor (mentioned inline in each file's header comment). Key ones:
- `create_list_tx` / `update_list_tx` — list+sections+items creation/edit. `update_list_tx` specifically reconciles against existing rows (rather than delete+recreate) so `mastery` rows for retained items survive an edit.
- `record_test_attempt` — grades a test attempt. Pass/fail thresholds for `words`/`passage` items are computed **here in SQL**, not client-side, from raw `{strokes, totalMistakes}` pairs the client reports — this is a deliberate trust-boundary decision (a child's browser can't fake a passing grade by lying about the verdict).
- `record_item_progress`, `record_set_complete`, `touch_daily_streak`, `mark_list_tested` — smaller bookkeeping RPCs (XP, streaks, mastery levels).

### Domain model

- `lists` → `sections` (kind: `words` | `pinyin` | `passage`) → `items` (hanzi/pinyin/english). A `passage` section holds one full-sentence dictation item; UI calls this feature "Dictation."
- `mastery` — per-(child, item) progress: `level` (0–3, drives the 🌱→🌳 stage emoji), `misses`, `char_misses` (position-indexed miss counts within a passage, used to underline tricky characters in the Reader/Dictation view).
- `attempts` — one row per test/practice session, with a `detail` JSON blob (per-section score breakdown, flipped/tricky item ids).
- Chinese punctuation (，。！？；、) is a special case throughout `lib/hanzi.ts` and the Learn/Test char components: `hanzi-writer` has no stroke data for punctuation, so it's excluded from stroke-quiz components but still rendered/spoken where it appears in passages — see `isPunctuationChar`/`PUNCTUATION_RE` before touching char-iteration logic.

### Stroke rendering (`hanzi-writer`)

`lib/hanziCache.ts` wraps `hanzi-writer`'s character data loader with caching. Components that render a stroke quiz/animation (`CharLadder.tsx` in Learn, the char components in Test, `components/FreehandPad.tsx`) all follow an **epoch-guard pattern**: a mutable `epochRef.current` counter is bumped on unmount/char-change, and any async callback (stroke-load, quiz-complete) checks it's still current before touching state — this prevents a stale callback from a just-replaced character firing into the wrong component instance.

### TTS (`lib/tts.ts`)

Thin wrapper over the Web Speech API (`speak`/`speakSequence`), not a third-party TTS service. Deliberately defers `speechSynthesis.speak()` one tick past `.cancel()` and calls `.resume()` first — Chrome can silently drop a `speak()` issued in the same tick as `cancel()`, and separately auto-pauses the queue after ~15s idle. Don't call the raw `window.speechSynthesis` API directly elsewhere; use this wrapper.

### OCR intake (`lib/ocr.ts`, `lib/ocrSchema.ts`)

`app/api/ocr` and `app/parent/upload/receive` (a PWA `share_target` endpoint) both feed a photo of a dictation sheet to a vision model and parse the response through a Zod schema (`ocrResultSchema`) before it ever reaches the review UI. Both routes require an authenticated session and cap image size; images are held in memory only and never persisted to storage.

### Security posture

- `next.config.ts` sets security headers (CSP `frame-ancestors 'none'`, HSTS, `nosniff`, etc.), disables production source maps, and disables `X-Powered-By`.
- `app/api/digest` fails closed (500) if `CRON_SECRET` is unset — it must never silently serve the weekly summary endpoint unauthenticated.
- The weekly email digest feature is intentionally locked off in the UI (`app/parent/settings`) — treat it as not-production-ready if asked to extend it.


## CRITICAL CRITICAL CRITICAL: Regression Guardrails
- DO NOT modify, delete, or refactor any existing TingXie code or components.
- The TingXie feature workflow must remain 100% untouched and operational.
- All new Revision logic must reside in new files, subfolders, or clean extension modules.
- If you need to import or extend shared utilities, abstract them without changing the original code signature.