# PawsConnect UI Spec

**Design goal:** a shelter director can click through and understand what the AI did, without reading any JSON (spec §5). Every AI output shows four things: **label → reason → confidence → review flag**.

## 1. Visual language

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#FBF7F2` warm cream | `#14110F` | page |
| `--surface` | `#FFFFFF` | `#1E1A17` | cards |
| `--ink` | `#1F1A17` | `#F3EDE6` | text |
| `--primary` | `#1F6F6B` deep teal | `#4FB3AC` | actions, active tab |
| `--accent` | `#D9734E` terracotta | `#F08A64` | highlights, hero |
| `--muted` | `#6B625B` | `#A79D94` | secondary text |

Font: **Inter** (UI) + **Fraunces** (display headings, for warmth). Radius 14px. Soft shadows. Density: comfortable (it's a demo, not an ops console).

### Semantic badges (one shared `<StatusBadge kind value>`; color is never the only signal, so every badge also has an icon and text)
| Kind | Values → color/icon |
|---|---|
| Urgency | **P1 Urgent** red/🔴siren · **P2 High** orange · **P3 Normal** amber · **P4 Low** slate |
| Confidence | **High** green ✓ · **Medium** amber ~ · **Low** red ? |
| Judge verdict | **PASS** green shield · **REVISED** amber pencil · **ESCALATED** red person |
| Fit | **Strong Fit** teal · **Possible Fit** amber · **Poor Fit** rose |
| Review | **⚑ Needs human review** (outlined red pill, always shows the reasons on hover/expand) |
| Mode | **Demo (cached)** gray · **Live · Claude** violet · **Live · Gemini** blue |

## 2. Shell

```
┌──────────────────────────────────────────────────────────────────────┐
│ 🐾 PawsConnect AI            [Demo (cached) ▾]  [🔒 Unlock live]  ◐  │  ← sticky header
├──────────────────────────────────────────────────────────────────────┤
│  (DotGrid bg, low opacity, hero only)                                │
│  BlurText: "Every pet deserves a great first impression."            │
│  CountUp KPIs:  6 listings · 10 inquiries triaged · 2 judge catches  │
│                 · 1 breed-label flip                                 │
├──────────────────────────────────────────────────────────────────────┤
│ [Overview] [Listing Studio] [Inbox Triage] [Counselor] [Match] [Bias Lens] │ ← shadcn Tabs, sticky
├──────────────────────────────────────────────────────────────────────┤
│  tab content (FadeContent on switch)                                 │
└──────────────────────────────────────────────────────────────────────┘
```
- **Mode dropdown:** Demo (cached) / Live · Claude (only when local + CLI found) / Live · Gemini (needs unlock on Vercel).
- **Unlock modal:** passcode field, "2 attempts remaining", a lockout countdown `Locked · 29:41`, and a note that cached demo still works.
- Each tab's header has a **one-line "What this does / who it's for"** and a chapter chip (`Ch. 2 · Vision`).
- Every result card's footer has `claude-haiku-4-5 · 2.3s · ~$0.0004 · prompt v2 · [View prompt]` → opens the **Prompt Inspector** (shadcn Sheet: system prompt, user prompt, raw JSON, provenance). Raw JSON lives only here.

## 3. Tabs

### Overview (Part A in-app)
- Stakeholder map: 4 SpotlightCards (Shelter staff · Adopters · Ops/Trust & Safety · Shelter directors): goal, pain point, which feature serves them.
- Technique matrix table: Feature · Technique · Why not RAG / fine-tune.
- "How to read this demo" legend of all badges.

### Listing Studio (B)
```
┌ Samples ───────────────┐ ┌ Draft listing (SpotlightCard) ─────────────────┐
│ [img][img][img]         │ │ [photo]  Biscuit · Pip · Maple   ← name chips  │
│ [img][⚠blurry][⚠no pet] │ │ Dog · Beagle mix   [Medium ~]                  │
│ ── or drop a photo ──   │ │ Age 3–5 yrs        [Low ?]                     │
│ (live mode only)        │ │ Personality: "…"                               │
└─────────────────────────┘ │ Care: • daily walks • …                        │
                            │ Fee tier: Standard ($)                         │
                            │ ┌⚑ Needs human review ──────────────────────┐ │
                            │ │ • Age is low-confidence: no teeth visible │ │
                            │ └───────────────────────────────────────────┘ │
                            │ ▸ What the model couldn't determine (fallbacks)│
                            └────────────────────────────────────────────────┘
```
- Hard-case thumbnails carry a "hard case" tag so the TA finds them instantly.
- "Unknown" fields render as an explicit gray `Unknown: <reason>` pill, never blank.
- P2: a "Banner" button shows the generated promo banner.

### Inbox Triage (C1)
- Top strip: CountUp `Accuracy vs. hand labels 9/10`, plus filter chips by category and urgency.
- Table (sorted P1→P4, AnimatedList on load): **Urgency · Category · Summary · Route to · Why (model's reason) · ⚑**.
- Row click → Sheet with the original message, gold label vs. model label (mismatch highlighted), and the reason.
- Ambiguous messages get a small "ambiguous by design" tag.

### Counselor "Maple" (C2)
```
┌ Chat ─────────────────────────────────┐ ┌ Judge panel (selected reply) ┐
│ Pet context: [Biscuit ▾]              │ │ Verdict: [REVISED ✎]         │
│ Scenarios: [Off-topic] [Adversarial]  │ │ ✓ In scope                   │
│            [Medical emergency] [Free] │ │ ✗ Matches listing: claimed   │
│ ☐ Weakened persona (demo only) ⚠      │ │   "still available"          │
│                                       │ │ ✓ Tone                       │
│ 🧑 Is Biscuit still available? …       │ │ ✓ No vet advice              │
│ 🐾 Maple  [REVISED]                    │ │ Feedback sent to regenerate: │
│   ▸ Rejected draft (struck through)   │ │ "Don't promise availability…"│
│   Final: "I can't confirm…"           │ └──────────────────────────────┘
└───────────────────────────────────────┘
```
- Every assistant bubble has a verdict badge; click → the judge panel shows that turn.
- The weakened-persona toggle shows an amber banner: "Honesty rules removed to demonstrate the judge".
- Escalation renders as a distinct handoff card ("Connecting you with a shelter counselor…").
- Mobile: the judge panel collapses under each bubble as an accordion.

### Match Explainer (C3)
- Pickers: Adopter profile (3 cards with key facts) × Pet.
- Result hero: big Fit badge + **vote bar** (5 segments colored by rating) + "**3 of 5 runs: Strong Fit**".
- If any disagreement: amber callout "Runs disagreed. Treat as a conversation starter, not a verdict" and `⚑ review` on a tie.
- Top 3 reasons (✓ list) + Top concern (amber callout).
- Accordion "See the step-by-step reasoning" → one card per run (home, time, kids/pets, experience, energy, needs → rating). **Collapsed by default.**

### Bias Lens (D)
- Header: stakeholder **Trust & Safety analyst**, the decision it improves, risk + mitigation (always visible).
- Select pair → table: rows = breed label variant (`pit bull mix` / `terrier mix` / `unknown mix`), columns = vote distribution bar + majority. **Flip** rows are highlighted.
- "Run full audit" → heatmap grid (profiles × pets): cell = max rating shift from the label alone; click → drill-down.
- Plain-language summary for trust staff + "Recommended action".

## 4. Motion & accessibility
- reactbits: **BlurText** (hero), **CountUp** (KPIs, accuracy, votes), **SpotlightCard** (listing + stakeholder cards), **AnimatedList** (triage rows), **FadeContent** (tab switch), **DotGrid** (hero bg, `next/dynamic` ssr:false).
- One `useReducedMotion()` hook: under reduced motion, BlurText/CountUp render final state, FadeContent/AnimatedList are disabled, DotGrid is hidden.
- Keyboard: tabs arrow-navigable, Sheets trap focus, badges have `aria-label`.
- Responsive: two-column layouts stack below 900px; the table becomes stacked cards below 640px.
- Loading: skeletons that match the result layout; C3/D show "Run 2 of 5…" progress.
