# PawsConnect AI Suite

MIS 552 · Homework 1. An AI feature suite for **PawsConnect**, a fictional two-sided pet-adoption platform
(shelters ↔ adopters). Next.js + TypeScript UI, FastAPI backend, Claude / Gemini models.

| Tab | Part | What it does | Technique |
|---|---|---|---|
| Overview | A | Stakeholder map, feature → technique matrix, badge legend | Design brief |
| Listing Studio | B | One pet photo → honest adoption listing with review flags | Vision + JSON schema + fallback prompting |
| Inbox Triage | C1 | Free-text inquiries → urgency-sorted, routed queue (scored vs. hand labels) | Few-shot classification |
| Counselor | C2 | "Maple" persona; every reply is reviewed by an LLM judge (revise → regenerate → or hand off) | Role prompt + LLM-as-judge |
| Match | C3 | Household × pet fit with reasons, concern, and a 5-run vote | Chain-of-thought + self-consistency |
| Bias Lens | D | Does a breed label *alone* change the matcher's rating? | Counterfactual prompting + self-consistency |


## Beyond the requirements
- **Deployed** on Vercel (Next.js + FastAPI serverless), auto-deployed from GitHub; Swagger docs at `/api/docs`.
- **Live-mode gate:** passcode, 2-strike / 30-minute per-IP lockout, signed httpOnly session cookie, fail-closed config.
- **Upstash Redis:** shared lockout state + 7-day cache of live model responses.
- **Cloudflare Turnstile** on the unlock form (server-verified; a failed bot check never costs a passcode attempt).
- **Scraper defense:** `robots.txt`, user-agent blocking, per-IP rate limits on paid calls, `noindex`.
- **Two providers** behind one interface (Claude via `claude -p` locally, Gemini deployed), schema-validated with automatic retry.
- **Transparency:** per-result Details panel (prompt, version, model, latency, cost); triage accuracy vs. hand labels in the UI.
- **Quality:** uv lockfile, ruff, ESLint, strict TypeScript, independent AI code review (14 fixes applied).

---

## Quick start (grading: no API key needed)

Requires **Node 20+** and **[uv](https://docs.astral.sh/uv/)** (`curl -LsSf https://astral.sh/uv/install.sh | sh`).

```bash
npm install        # web deps
uv sync            # python deps (.venv from pyproject.toml + uv.lock)
npm run dev        # starts Next.js on :3000 and FastAPI on :8000 together
```
Open **http://localhost:3000**. The app starts in **Demo (cached)** mode: every feature runs on the bundled sample photos,
messages, profiles, and chat scenarios using pre-recorded model responses (`api/paws/data/cache/*.json`). No key, no network.

API docs (Swagger UI): **http://localhost:3000/api/docs**

> Uploading a *new* photo, triaging a *new* message, or free-typing in the chat needs live mode. Every bundled sample works cached.

<details><summary>No uv? Use pip instead</summary>

```bash
python3 -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt "uvicorn[standard]"
npx concurrently "npx next dev" "uvicorn api.index:app --reload --port 8000"
```
</details>

---

## Modes

| Mode | Where | Needs |
|---|---|---|
| **Demo (cached)** | everywhere (default) | nothing |
| **Live · Claude** | local only | the `claude` CLI installed and logged in (uses your Claude plan) |
| **Live · Gemini** | local + Vercel | `GEMINI_API_KEY` |

Pick the mode from the header dropdown. `PROVIDER=claude|gemini` makes a live mode the default.

**Live · Claude** runs Claude Code headless (`claude -p`) with our own short system prompt, tools disabled (vision uses only
`Read`, scoped to the image folder), and no session persistence, so each call is a single clean model turn. Default model is `haiku`
(`CLAUDE_MODEL` to change). `claude -p` has no temperature flag; self-consistency relies on Claude's default sampling (temperature 1.0).

**Live · Gemini:** put `GEMINI_API_KEY=...` in `.env.local` (shared by Next and FastAPI). Default model `gemini-3.1-flash-lite`.

### Live-mode gate
When `LIVE_MODE_PASSCODE` is set, live mode requires **🔒 Unlock live**:
- **2 wrong passcodes → 30-minute lockout** per IP (attempts made while locked don't extend it). Cached mode keeps working.
- Optional **Cloudflare Turnstile** bot check on the unlock form (`NEXT_PUBLIC_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY`).
- Success sets an httpOnly HS256-signed cookie (12 h). Every live API call is checked server-side.
- State lives in Upstash Redis on Vercel (shared across instances) and in memory locally. If Redis is unavailable on Vercel,
  live mode **fails closed**.

### Scraper defense
- `public/robots.txt` disallows AI crawlers entirely and `/api/` for everyone.
- `BotGuard` middleware (FastAPI) blocks known crawler/scraper user agents on `/api/*` (localhost is exempt for dev),
  rate-limits each IP to 60 requests/min, and adds `X-Robots-Tag: noindex`.
- With the Cloudflare-proxied domain (below), Cloudflare's Bot Fight Mode / WAF sit in front of all of it.

---

## Environment variables (`.env.example`)

| Variable | Purpose |
|---|---|
| `PROVIDER` | default mode: `cached` (default) · `claude` · `gemini` |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Gemini live mode |
| `CLAUDE_MODEL` | `haiku` (default) / `sonnet` |
| `LIVE_MODE_PASSCODE` | enables the live-mode gate |
| `SESSION_SECRET` | signs the unlock cookie (`openssl rand -base64 32`) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile (optional) |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Upstash Redis (auto-injected on Vercel) |

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Next.js + FastAPI (hot reload) |
| `npm run warm` | Re-record the demo cache for every bundled input (`-- --provider gemini`, `-- --only triage,match`, `-- --force`) |
| `npm run typecheck` | TypeScript check |
| `npm run zip` | Build `PawsConnect_submission.zip` (no `node_modules`/`.venv`/`.next`/secrets) |
| `uv export --no-hashes --no-dev -o requirements.txt` | Refresh `requirements.txt` after changing Python deps |

---

## Deploy (Vercel + Cloudflare)

1. **Import** the GitHub repo in Vercel (framework: Next.js). `api/index.py` deploys as a Python function, and `next.config.ts`
   rewrites `/api/*` to it in production.
2. **Storage → Create Database → Upstash for Redis** (free) → connect it to the project. This injects `KV_REST_API_*`.
3. **Environment variables:** `GEMINI_API_KEY`, `LIVE_MODE_PASSCODE`, `SESSION_SECRET`, and optionally the Turnstile keys.
4. **Turnstile** (optional): Cloudflare dashboard → Turnstile → Add widget (hostnames: your `*.vercel.app` and custom domain) → copy the site/secret keys.
5. **Custom domain** (`pawsconnect.shop`): Vercel → Domains → add it; at Cloudflare DNS add the records Vercel shows
   (`A @ 76.76.21.21`, `CNAME www cname.vercel-dns.com`). Start with **DNS only** (grey cloud) so Vercel can issue the cert; then
   optionally proxy (orange cloud) with SSL mode **Full (strict)** to get Cloudflare's WAF, Bot Fight Mode, and rate-limit rules in front.

---

## Layout
```
api/
  index.py                 # Vercel / uvicorn entrypoint
  paws/
    app.py                 # FastAPI app + routers (meta, auth, ai), Swagger at /api/docs
    config.py              # Settings (env), provider availability
    schemas.py             # Pydantic: LLM output schemas + API envelopes
    prompts.py             # versioned prompts (mirrored in prompts.md)
    llm/                   # LLMProvider ABC → GeminiProvider, ClaudeCliProvider
    features/              # Feature template: Listing, Triage, Counselor(+judge), Match, BiasLens
    security.py            # LiveGate (passcode/lockout/Turnstile/session) + BotGuard middleware
    store.py               # Samples, DemoCache (bundled JSON), KV (Upstash REST | memory)
    data/                  # samples.json + cache/*.json
src/
  app/                     # Next.js page + layout
  components/              # header, inspector, kit (badges/cards), tabs/*, reactbits/*, ui/* (shadcn)
  lib/api.ts               # typed API client
scripts/warm.py            # records the demo cache
public/pets/               # sample photos (+ LICENSES.md), robots.txt
prompts.md                 # final prompts + engineering log
docs/                      # PRD, UI spec
```

## Data & licensing
Code: MIT (see `LICENSE`). All people, messages, and pet listings are synthetic. Pet photos are from Wikimedia Commons under
CC0 / CC BY / CC BY-SA. Authors and links are in `public/pets/LICENSES.md`. `requirements.txt` is generated from `pyproject.toml` by uv.
