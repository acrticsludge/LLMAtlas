# CLAUDE.md

Behavioral guidelines and project context for this codebase. Synthesized from me/ practices, me/ stack, and Karpathy principles.

---

## Behavioral Rules (Non-Negotiable)

### Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

## Stack

### Technology Choices

**Frontend:** Next.js App Router, TypeScript (strict), Tailwind CSS, Radix UI, shadcn/ui, Recharts
**Backend:** Supabase (Postgres + RLS + Auth), AES-256 encryption
**Hosting:** Vercel (frontend), Railway (worker)
**Integrations:** Resend (email), Dodo Payments, Supabase Auth
**Tooling:** graphify (knowledge graph), Biome/ESLint

See `.opencode/skills/stack.md` for full details and rationale.

### Project Structure

```
/
  app/                    # Next.js App Router (pages, API routes)
  worker/                 # Background polling worker (separate Node.js process)
  lib/                    # Shared utilities (encryption, auth, tiers)
  public/                 # Static assets
  content/docs/           # Fumadocs documentation
  .opencode/              # OpenCode agent and skill files
  CLAUDE.md               # This file — AI assistant instructions
  AGENTS.md               # Agent mode instructions
  .cursorrules            # Cursor (keep in sync with CLAUDE.md)
  .windsurfrules          # Windsurf (keep in sync with CLAUDE.md)
  GEMINI.md               # Gemini (keep in sync with CLAUDE.md)
  .gitignore
  package.json
  tsconfig.json
```

See `.opencode/skills/stack.md` for full folder layout.

### Tier Structure

```
Free    — 1 account per service, email-only alerts, 15-min polling, 7-day history
Pro     — Multiple accounts, all channels, 5-min polling, 30-day history + graphs  ($10/mo)
Team    — Everything in Pro + team features, 1-min polling, 90-day history         ($30/mo)
```

Tier limits checked in both the API and the worker. The UI shows upgrade prompts — the backend enforces limits.

---

## Coding Standards

- **TypeScript everywhere** — strict mode, proper types, no `any`
- **App Router, not Pages Router**
- **Server Components by default** — add `"use client"` only when needed
- **Tailwind CSS for styling** — no inline styles, no CSS modules
- **Radix UI for components** — dialogs, dropdowns, tooltips
- **Mobile-first design** — 48×48px minimum touch targets
- **Response envelope:** `{ data: T }` on success, `{ error: string }` on error
- **Naming:** kebab-case routes, PascalCase types, camelCase variables, snake_case DB columns

Full details: `.opencode/skills/practices.md`

---

## Security Rules (Non-Negotiable)

- **Never log secrets** — API keys, tokens, passwords — not even in dev
- **Encrypt credentials** before DB storage (AES-256); key in env var, never in code
- **RLS enabled on every table** — database enforces isolation
- **Validate all input** at system boundaries (API routes, server actions) with Zod
- **HTTPS everywhere** — HSTS header required
- **CORS restricted** to known origins — never `*` in production
- **Verify webhook signatures** before processing payment events
- **Check resource ownership** on every mutation — not just "is logged in", but "owns this"
- **Never store raw card data** — delegate entirely to payment provider
- **Rate-limit auth endpoints** — prevent brute force

Full details: `.opencode/skills/practices.md`

---

## API Design

- **Correct HTTP methods:** GET reads, POST creates, PATCH updates, DELETE removes — never mutations on GET
- **Consistent response envelope** — every endpoint returns `{ data }` or `{ error }`
- **kebab-case paths** (`/api/alert-configs`), plural nouns, resource IDs in path
- **List endpoints paginated** — never unbounded arrays
- **Validation errors field-level** — tell the caller exactly which field failed
- **Correct status codes:** 200/201/204 for success; 400/401/403/404/422/429/500 for errors
- **Sensitive fields excluded** from responses — never return encrypted keys, tokens, passwords

Full details: `.opencode/skills/practices.md`

---

## Error Handling

- **One failure doesn't cascade** — wrap third-party calls in try/catch; return partial results when appropriate
- **`error.tsx` on every major route** segment (App Router) — recovery UI, not blank pages
- **No stack traces to users** — catch all server errors, return generic messages
- **User-facing messages actionable** — "GitHub token expired — reconnect your account" not "Something went wrong"
- **Loading states on all async ops** — skeleton/spinner while fetching
- **Error monitoring integrated** (Sentry, LogFlare, etc.) before launch

Full details: `.opencode/skills/practices.md`

---

## Worker Patterns

- **Stateless design** — all state lives in DB, worker can restart without data loss
- **Never throw from top loop** — catch per-integration, log, move on
- **Idempotent by design** — running same cycle twice produces same DB state
- **No in-memory caches** — read fresh from DB each cycle
- **Enforce tier limits** in the worker, not just the frontend
- **Polling intervals:** Free 15min, Pro 5min, Team 1min
- **Track alert state** to avoid spam — only re-alert on threshold crossing

Full details: `.opencode/skills/practices.md`

---

## Vercel Middleware

⚠️ **CRITICAL: Always add matcher config. No matcher = invocation explosion + Fluid CPU charges.**

Every `middleware.ts` must have an explicit `config.matcher`:

```ts
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/settings/:path*',
    '/team/:path*',
    '/alerts/:path*',
    '/integrations/:path*',
  ],
};
```

Or use the negative regex pattern to exclude static files. Never ship without a matcher.

Full details: `.opencode/skills/practices.md`

---

## Git Conventions

- **Commit message:** Present-tense imperative, lead with area: "worker: fix rate limit handling"
- **Branch naming:** `feat/`, `fix/`, `chore/` prefixes
- **Multi-AI sync:** Update CLAUDE.md, AGENTS.md, .cursorrules, .windsurfrules, GEMINI.md together
- **Never commit:** `.env*` files, private keys, `/node_modules`, build artifacts, `/graphify-out`

### npm Release Flow

When releasing `@llm-atlas/cli` to npm:

1. **Bump version** in `cli/package.json`:
   ```bash
   cd cli && npm version patch|minor|major
   ```
   This creates a git tag automatically.

2. **Push commits and tag:**
   ```bash
   git push origin main --follow-tags
   ```

3. **Create release on GitHub:**
   - Go to [Releases](https://github.com/acrticsludge/LLMAtlas/releases)
   - Click "Draft a new release"
   - Select the tag you just pushed
   - Add changelog summary and click "Publish release"

4. **GitHub Actions auto-publishes:**
   - Workflow triggers on `release: [published]`
   - Runs lint, test, build, then publishes to npm
   - Uses GitHub OIDC (no npm token needed)

**Before releasing, verify locally:**
```bash
cd cli && npm run lint && npm test && npm run build && npm pack --dry-run
```

Full details: `.opencode/skills/practices.md`

---

## Frontend Design

Avoid AI slop (gradient heroes, three identical cards, generic colors).

**Design principles:**
- **Typography first** — one display font, one body font; use weight/size contrast for hierarchy
- **Whitespace is the design** — sections `py-24` to `py-32`, cards `p-6` to `p-8`
- **One accent color** used sparingly; everything else neutrals
- **No decoration without purpose** — gradients/glows only if they serve a purpose
- **One primary action per screen** — clear visual hierarchy

**Patterns:**
- **Hero:** asymmetric (text left, visual right), show actual product, headline says what it does
- **Features:** alternate layout, spotlight one, show in context
- **Pricing:** highlight recommended tier, monthly/annual toggle, show math
- **Empty states:** illustration + explanation + CTA

Before shipping: hierarchy clear? One dominant action? Font pairing has contrast? Accent color sparse? Dark mode works? Mobile intentional? Shows actual product?

Full details: `.opencode/skills/practices.md`

---

## Tooling

### Graphify (Knowledge Graph)

- Build navigable knowledge graph of codebase
- Use at project start and after major structural changes
- Run via `/graphify` in Claude Code or `python -m graphify <path>`
- Auto-rebuild on git commit via hook: `python -m graphify hook install`

**Query patterns:**
```
/graphify query "What is the path from A to B?"
/graphify explain "functionName"
/graphify path "source" "destination"
```

Always add `/graphify-out` to `.gitignore`.

Full details: `me/tools/graphify-workflow.md` and `me/tools/code-review-graph.md`

### AI Collaboration

Keep all AI config files in sync:
- `CLAUDE.md` — Claude Code
- `AGENTS.md` — Claude agent/agentic mode
- `.cursorrules` — Cursor
- `.windsurfrules` — Windsurf
- `GEMINI.md` — Gemini

Stale docs are worse than no docs — the AI will confidently work from wrong information.

Full details: `me/tools/ai-collaboration.md`

---

## Audit Triggers

Run the corresponding checklist **before** each event:

| Trigger | Checklist |
|---------|-----------|
| Pre-launch | `me/audits/pre-launch-checklist.md` |
| API changes | `me/audits/api-security-checklist.md` + `me/audits/api-design-checklist.md` |
| UI/frontend changes | `me/audits/performance-checklist.md` + `me/audits/mobile-checklist.md` |
| Billing/payments | `me/audits/billing-checklist.md` |
| Error handling changes | `me/audits/error-handling-checklist.md` |
| Onboarding flow | `me/audits/onboarding-ux-checklist.md` |
| SEO/content | `me/audits/seo-checklist.md` |

Do not ship until Critical items are resolved.

---

## Models (DeepSeek via OpenCode)

- **Flash** — default for all tasks: debugging, edits, file ops, grep
- **Pro** — switch for: architecture, complex refactors, new feature design, anything touching auth/billing/workers
- **Pro + Think Max** — hardest problems only: `opencode run -m deepseek/deepseek-v4-pro --variant max`

Run `opencode run -m deepseek/deepseek-v4-pro` to use Pro on a task. See `.opencode/opencode.json` for configuration.

---

## Project-Specific Notes

- All canonical practices in `me/` folder at repo root
- OpenCode agents and skills in `.opencode/` — use for multi-step tasks
- Graphify for architecture exploration and impact analysis
- Run audits before every launch or major change
