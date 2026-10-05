# PRD: PawsConnect AI Suite (MIS 552 HW1)

## Overview
**What:** A Next.js web app (deployable to Vercel) that demos five AI features for a fictional pet-adoption platform: Photo→Listing (B), Inquiry Triage (C1), Counselor + LLM Judge (C2), Match Explainer with self-consistency (C3), and an original innovation feature (D). It ships with a cached demo mode that needs no API key.
**Why:** HW1 is worth 10% of the grade, and there's a showcase bonus (+2.5% course credit) for the best demos.
**Scope:** Large. **Due 23:59 AZ tonight.** The P0/P1/P2 tiers below are the cut line if we run short.

**Provider strategy:** `claude -p` (Claude Max) is the **local** live provider, and it warms the cache. Gemini Flash is the **deployed** live provider on Vercel. Cached mode works everywhere with no key.

**Delivery:** GitHub repo + submission zip (`npm run zip`) + Vercel URL.

## Priority tiers and time budget
| Tier | What | Budget |
|---|---|---|
| **P0** (submit-able) | Scaffold, provider layer, B/C1/C2/C3/D logic, cached mode, sample data, basic UI with cards/badges/expanders, README, prompts.md, cache warmed | ~75 min |
| **P1** (above and beyond) | reactbits polish (2–3 components), Prompt Inspector drawer (exact prompt, version, model, latency, cost), triage eval vs. hand labels (accuracy and confusion), Vercel deploy | ~25 min |
| **P2** (only if time) | Banner image bonus (+0.3) via Gemini image model, Claude-vs-Gemini side-by-side compare, streaming chat | leftover |
| **User-owned** | Report PDF prose: interpretations, ethics, AI-use disclosure, failure diagnosis, live screenshots | ~25 min, run in parallel with my build |

## Requirements

### Functional Requirements
- [ ] FR1 **Provider layer**: `LLMProvider` interface with `GeminiProvider` (env `GEMINI_API_KEY`, default `gemini-3.1-flash-lite` (cheapest vision Flash; avoid 2.5-flash, which is being shut down), overridable via `GEMINI_MODEL`; uses `responseMimeType: application/json` + `responseJsonSchema` from `z.toJSONSchema`) and `ClaudeCliProvider` (spawns `claude -p --output-format json --model haiku --system-prompt <ours> --tools "" --no-session-persistence`; reads `.result`/`.structured_output`, `.total_cost_usd`, `.duration_ms`; **local dev only**. A short `--system-prompt` replaces the ~68K-token default, which made a bare call cost $0.145). Default: `claude` when the CLI is on PATH and not on Vercel, otherwise `gemini` if a key is set, otherwise cached. Override with the `PROVIDER` env var or a UI toggle. All outputs are validated with zod, with one retry on parse failure.
- [ ] FR2 **Mode**: `cached` (the default when no key is present) or `live`. Cached responses are JSON keyed by `feature:inputId:promptVersion` and **statically imported**, so there's no runtime filesystem dependency. A mode badge is always visible in the header.
- [ ] FR3 **B Photo→Listing**: upload, or pick one of 6 bundled photos (4 normal + blurry + no-animal/multi-animal). The vision prompt includes an explicit fallback rule: say "unknown" plus a reason, and never guess a breed. Output JSON has name suggestions, species, breed + confidence (high/med/low), age range + confidence, personality, care needs, fee tier (Standard/Senior-Special/Bonded-Pair/Needs-Assessment), `human_review`, and `review_reasons[]`. **`human_review` is forced true in code** whenever any confidence is low, so it doesn't depend on the model obeying. Rendered as a listing card.
- [ ] FR4 **C1 Triage**: 6 labels defined in the prompt (adoption_application, medical_question, surrender_request, foster_volunteer_offer, general_question, spam_other), urgency P1–P4 with definitions, and 4 few-shot examples. Runs on 10 bundled messages (3 deliberately ambiguous). Each record has category, urgency, routing, summary, `reason`, `human_review`. Shown as a queue table sorted by urgency, with colored badges and the reason visible on every row.
- [ ] FR5 **C2 Counselor "Maple"**: a system prompt with name, tone, scope, escalation rules, and honesty rules, plus listing context injected for the selected pet. A judge call scores 4 rubric criteria (scope, listing consistency, tone, no vet advice), each pass/fail with a note, plus an overall PASS/REVISE. On REVISE, the reply is regenerated once with the judge's feedback; if it fails again, the user sees a human-escalation message. **The UI shows the rejected draft (struck through), the judge's notes, and the final reply.** Scripted demo convos: (a) off-topic question kept in scope; (b) judge catch, induced with a "weakened persona" toggle that strips the honesty rules (the report will say this).
- [ ] FR6 **C3 Match Explainer**: 3 bundled adopter profiles × pet picker. A CoT prompt with fixed steps (home, time, kids/pets, experience, energy, pet needs → rating). Rating scale: Strong / Possible / Poor Fit. Runs **N=5 samples** in parallel (Gemini: `temperature: 1.0`; `claude -p` has **no temperature flag**, so it uses Claude's default sampling, temperature 1.0, and the run label in the prompt differs per sample. Documented in README and prompts.md) and takes a majority vote. The UI shows a vote bar ("3/5 Strong Fit"), a disagreement callout, top-3 reasons, and the top concern, with the reasoning inside an expander per sample.
- [ ] FR7 **D Innovation, "Bias Lens" (Breed-Label Counterfactual Auditor)**, for **platform trust & safety staff**. It takes a listing and an adopter, then reruns the C3 matcher with **only the breed label swapped** (e.g. "pit bull mix" ↔ "terrier mix" ↔ "unknown mix"), all other fields held fixed. It reports the rating-distribution shift per label and flags any listing/profile pair where a label alone flips the majority rating. A short summary is written for trust staff. Techniques: counterfactual prompting + self-consistency + aggregation. Stakeholder, decision, risk, and mitigation are written into the UI and the report. *(Ties directly into the spec's "breed-label bias" ethics point and audits our own C3 feature.)*
- [ ] FR7a **UI spec**: see `docs/UI.md`.
- [ ] FR8 **Prompt Inspector** (P1): every result has a "View prompt" drawer showing the prompt version, full prompt, model, provider, latency, and estimated tokens/cost.
- [ ] FR9 **Triage eval** (P1): hand-labeled gold labels for the 10 messages; accuracy and a mismatch list shown in the C1 tab (gives the report its "failure case" material).
- [ ] FR10 **Cache warming script**: `npm run warm` runs every bundled input through live mode and writes `src/data/cache/*.json`.
- [ ] FR12 **Delivery**: init a git repo, push it to GitHub (`gh repo create`, private unless you say otherwise), import it to Vercel (env: `GEMINI_API_KEY`, `LIVE_MODE_PASSCODE`), and `npm run zip` builds `PawsConnect_submission.zip` (no `node_modules`, `.next`, or `.env`).
- [ ] FR11 **Banner bonus** (P2): generate a promo banner for one pet with `gemini-3.1-flash-image` (**no free tier**, ~$0.045/image; generated once offline and bundled), save it to `/public`, and record the tool and prompt.

### Non-Functional Requirements
- [ ] NFR1 `npm install && npm run dev` with **no env vars** demos every feature (this is how the TA grades).
- [ ] NFR2 No keys in code. `.env.example` only. `.env*` is gitignored.
- [ ] NFR3 Vercel deploy is **cached-only by default**; live mode is gated by a `LIVE_MODE_PASSCODE` env var so a public URL can't burn quota.
- [ ] NFR3a **Passcode lockout**: **2 wrong passcodes → 30-minute lockout**, keyed by client IP (`ipAddress()` from `@vercel/functions`, falling back to `x-forwarded-for`). Lockout state is stored in **Upstash Redis** (free tier via the Vercel Marketplace, `@upstash/redis`) using `INCR` + `EXPIRE 1800`, so it holds across serverless instances. It falls back to an in-memory Map when Redis env vars are absent (local dev). The passcode compare is constant-time (`crypto.timingSafeEqual`). On success the server sets a signed, httpOnly, 12h session cookie (`jose` HS256 JWT with `SESSION_SECRET`), so the passcode isn't resent per call; every live API route checks the cookie server-side. The UI shows attempts remaining and a lockout countdown, and cached mode keeps working while locked out.
- [ ] NFR4 Interpretability: no raw JSON in the main UI (raw JSON only inside the Inspector). Every classification shows a label + reason. Every uncertain output gets a visible "Needs human review" badge.
- [ ] NFR5 Animations respect `prefers-reduced-motion`. Mobile works down to 375px.
- [ ] NFR6 Cost stays under $1 in live mode (Flash + about 60 calls total).

## User Stories
- As a **shelter volunteer**, I want to upload one photo and get an honest draft listing, so that Biscuit doesn't sit with an empty profile.
- As a **shelter coordinator**, I want inbound messages turned into a prioritized queue with routing, so that surrenders and emergencies get handled first.
- As an **adopter**, I want to chat with a counselor that's honest about what it doesn't know, so that I trust the platform.
- As an **adoption counselor**, I want a fit explanation with confidence (vote agreement), so that I know when to have a human conversation.
- As a **trust & safety analyst**, I want to see whether a breed label alone changes the AI's match ratings, so that we don't automate breed discrimination.
- As the **TA**, I want to run the app with no key and see every feature, so that I can grade it.

## Technical Approach

### Files to Create
| File | Purpose |
|---|---|
| `package.json`, `next.config.ts`, `tailwind`, `tsconfig.json` | Next.js 15 App Router + TS + Tailwind |
| `requirements.txt` | One-line note pointing to `package.json` (spec checklist literalism) |
| `README.md` | Run (cached/live), env vars, provider switch, warm cache, deploy |
| `prompts.md` | Final prompt per feature + v1→problem→v2 iteration log |
| `.env.example` | `GEMINI_API_KEY`, `PROVIDER`, `LIVE_MODE_PASSCODE`, `SESSION_SECRET`, `KV_REST_API_URL/TOKEN` (auto-injected by the Upstash integration), `GEMINI_MODEL` |
| `src/lib/auth/{lockout,session}.ts` | Attempt counter + lockout, signed cookie |
| `src/app/api/unlock/route.ts` | Passcode check endpoint |
| `src/lib/llm/types.ts` | `LLMProvider` interface, call options (temp, schema, image) |
| `src/lib/llm/gemini.ts` | `@google/genai` with JSON mode + responseSchema |
| `src/lib/llm/claudeCli.ts` | `child_process` spawn of `claude -p`; JSON extraction |
| `src/lib/llm/index.ts` | Provider selection, retry, timing/cost metadata |
| `src/lib/cache.ts` | Cached lookup (static imports) + live passthrough |
| `src/lib/prompts/{listing,triage,counselor,judge,match,biasLens}.ts` | Versioned prompts (`version` constant) |
| `src/lib/schemas.ts` | zod schemas for every output |
| `src/lib/features/*.ts` | Feature logic (vote aggregation, judge loop, counterfactuals) |
| `src/app/api/{listing,triage,chat,match,bias}/route.ts` | Server routes (key never reaches the client) |
| `src/app/page.tsx` + `src/components/tabs/*` | Landing + 5 tabs (B, C1, C2, C3, D) |
| `src/components/ui/*` | Badge, Card, Expander, VoteBar, PromptInspector, ReviewFlag |
| `src/components/reactbits/*` | 2–3 reactbits components (SpotlightCard, BlurText/SplitText, CountUp) |
| `src/data/{pets.ts,messages.ts,profiles.ts,gold.ts}` | Bundled synthetic data |
| `public/pets/*.jpg` | 6 photos (Unsplash/Pexels license; blurry one made locally with sharp) + `LICENSES.md` |
| `src/data/cache/*.json` | Cached responses |
| `scripts/warm-cache.ts` | Populates the cache (uses `claude -p` locally) |
| `scripts/zip.sh` | Builds the submission zip |
| `docs/report-data.md` | Results/numbers + screenshot checklist for your report |

### Architecture
Client tabs → `POST /api/<feature>` → `runFeature()` checks mode. In cached mode it returns the bundled JSON (uploads give a "live mode required" message). In live mode it calls the provider → zod validate → post-process (force review flags, majority vote, judge loop) → returns `{data, meta:{prompt, version, model, latencyMs, costEst}}`. The Inspector reads `meta`. The warm script calls the same `runFeature()` and writes the JSON.

### Dependencies
`next`, `react`, `tailwindcss`, `@google/genai`, `zod` (v4, `z.toJSONSchema`), `@upstash/redis`, `@vercel/functions`, `jose`, `sharp` (dev, for the blur), shadcn/ui (Tabs, Sheet, Accordion, Table, Badge), reactbits (`@react-bits/*-TS-TW`: BlurText, CountUp, SpotlightCard, AnimatedList, FadeContent, DotGrid) → `motion`, `gsap`, `tsx` (scripts). Claude provider: local `claude` CLI (already installed). No Agent SDK needed; the CLI is simpler.

## Edge Cases & Error Handling
| Scenario | Expected Behavior |
|---|---|
| No API key | Cached mode is forced; live toggle disabled with a tooltip |
| Upload in cached mode | Card: "Live mode needed for new photos. Try a sample." |
| Photo has no animal | `species: "none detected"`, all fields "unknown", `human_review: true`, fee tier "Needs-Assessment" |
| Blurry / multiple animals | Low confidence → review flag; for multi-animal the model is told to describe the most prominent animal and list the count in `review_reasons` |
| Model returns invalid JSON | One retry with the error appended; then a friendly error card (no crash) |
| C3 votes tie (e.g. 2/2/1 with N=5) | Pick the more conservative rating and flag for human review |
| Judge says REVISE twice | Show the escalation-to-human message; never show the unapproved draft as final |
| Medical emergency in chat | Persona escalates immediately; judge verifies |
| Vision via `claude -p` (Part B) | CLI has no image arg: run with `--tools Read --add-dir <imgdir>` and put the absolute path in the prompt; JSON extracted from `.result` and validated with zod |
| Gemini free-tier rate limit (~10 RPM) | C3/D fan-out is limited to 3 concurrent calls with backoff |
| `claude -p` on Vercel | Provider disabled when `VERCEL` env is set; UI hides the option |
| Gemini rate limit (429) | Exponential backoff ×2, then an error card |
| Vercel live mode without passcode | 403 → UI falls back to cached |
| 2nd wrong passcode | 429 with `retryAfter`; UI shows "Live mode locked for 30:00" countdown; cached still works |
| Wrong passcode while locked | Still 429; does not extend or reset the timer (no lock-extension griefing) |
| Redis unavailable on Vercel | Fail closed: live mode disabled, cached works |
| Shared IP (campus NAT) locked by someone else | Accepted tradeoff for a demo; documented in README |

## Acceptance Criteria
- [ ] AC1 Fresh clone + `npm i && npm run dev` with no env vars: all 5 tabs show results for the bundled inputs.
- [ ] AC2 B: 6 sample photos produce cards; the blurry and no-animal ones visibly show "Needs human review" with reasons.
- [ ] AC3 C1: 10 messages in a table sorted P1→P4, color badges, reason per row, 3 ambiguous ones flagged; eval accuracy shown.
- [ ] AC4 C2: the off-topic convo stays in scope; the weakened-prompt convo shows a REVISE badge, struck-through draft, judge notes, and the regenerated/escalated reply.
- [ ] AC5 C3: shows 5 votes, majority, disagreement callout, and reasoning in expanders (collapsed by default); at least one bundled pair shows a split vote.
- [ ] AC6 D: at least one pair shows a rating shift driven only by the breed label (or a documented null result, which is also a valid finding).
- [ ] AC7 Live mode works with `GEMINI_API_KEY`; `PROVIDER=claude` works locally.
- [ ] AC8 `prompts.md` has every final prompt + ≥1 v1→v2 iteration; README is complete; no secrets in the repo.
- [ ] AC9 (P1) Vercel URL loads in cached mode; live mode (Gemini) works there behind the passcode.
- [ ] AC9a Two wrong passcodes lock live mode for 30 min across requests (verified locally in-memory and on Vercel with Redis); correct passcode before lockout grants a session cookie.
- [ ] AC10 GitHub repo pushed; zip builds, then unzips → `npm i && npm run dev` works with no env vars.
- [ ] AC11 Cache was warmed via `claude -p` locally; each cached entry records `provider`/`model` so the Inspector shows honest provenance.

## Out of Scope
- Auth, database, persistence of chats or listings.
- Writing the report prose. **Per Section 9, the interpretation, ethics note, failure diagnosis, and AI-use disclosure must be yours.** I'll generate a `report-data.md` with the numbers, results, and screenshots-to-take checklist for you to write from.
- Claude on Vercel (Max subscription can't legitimately or technically power a deployed app; it's a local/dev provider for warming and comparison only).
- Fine-tuning and RAG (justified as not needed in the Part A matrix).

## Open Questions
- [x] **Q1 Deadline**: Full P0+P1 build tonight, fast.
- [x] **Q2 Part D**: Bias Lens.
- [x] **Q3 Providers**: `claude -p` = local provider (warms cache locally); Gemini = live provider on Vercel.
- [x] **Q4 Deliverables**: GitHub repo + zip + Vercel deploy. (Vercel CLI not installed: deploy via `npx vercel` or GitHub import.)
- [x] **Q5 Photos**: Unsplash/Pexels, credited in `LICENSES.md`.
- [x] **Q7 Lockout store**: Upstash Redis via the Vercel Marketplace (free: 256MB, 500K cmds/mo). Env vars are `KV_REST_API_URL`/`KV_REST_API_TOKEN`, read with `Redis.fromEnv()`. Session cookie via `jose` (HS256 JWT). IP via `ipAddress()` from `@vercel/functions`. Live responses are also cached in Redis (key = sha256(feature+input+promptVersion), TTL 7d).
- [ ] **Q6 Location**: `hw/pawsconnect/` (assumed).
