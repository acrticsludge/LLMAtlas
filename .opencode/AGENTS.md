# AGENTS.md

Complete project context and guidelines for AI agents. Synthesized from practices, stack, and behavioral principles.

---

## 1. Behavioral Guidelines (Non-Negotiable)

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

## 2. Stack

### Technology Choices

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | Next.js (App Router) | Server components, edge rendering, built-in routing, Vercel-native |
| Language | TypeScript (strict) | Catch bugs at compile time, not runtime |
| Styling | Tailwind CSS | Utility-first, no CSS file bloat, works great with component libraries |
| Components | Radix UI + shadcn/ui | Headless, accessible primitives; copy-paste components |
| Charts | Recharts | React-native, composable, good for dashboards |
| Database | Supabase (Postgres) | RLS built-in, auth included, real-time, good free tier |
| Auth | Supabase Auth | Email/password, magic link, GitHub OAuth, Google OAuth out of the box |
| Frontend Hosting | Vercel | Next.js native, edge network, instant deployments |
| Worker Hosting | Railway | Simple Node.js deployment, cron triggers, env var management |
| Email | Resend | Developer-friendly, good deliverability, React email templates |
| Payments | Dodo Payments | International markets; alternatives: Stripe (US/EU) |
| Encryption | AES-256 (Node.js crypto) | Encrypt user API keys before DB storage |

### Project Structure

```
/
  app/                    # Next.js App Router
  worker/                 # Background polling worker (separate Node.js process)
  lib/                    # Shared utilities (used by both app/ and worker/)
  public/                 # Static assets
  Audits/                 # Audit reports and checklists
  me/                     # Personal knowledge base (gitignored)
  .opencode/              # OpenCode agent and skill files
  CLAUDE.md               # AI assistant instructions
  AGENTS.md               # Agent mode instructions
  .cursorrules            # Cursor rules (keep in sync with CLAUDE.md)
  .windsurfrules          # Windsurf rules (keep in sync with CLAUDE.md)
  GEMINI.md               # Gemini rules (keep in sync with CLAUDE.md)
  .gitignore
  package.json
  tsconfig.json
```

### Tier Structure (SaaS Pricing)

```
Free    — 1 account per service, email-only alerts, 15-min polling, 7-day history
Pro     — Multiple accounts, all channels, 5-min polling, 30-day history + graphs  ($10/mo)
Team    — Everything in Pro + team features, 1-min polling, 90-day history         ($30/mo)
```

Tier limits checked in both the API and the worker. The UI shows upgrade prompts — the backend enforces limits.

---

## 3. Coding Standards

- **TypeScript everywhere** — no plain JS, no `any` unless absolutely unavoidable; strict mode on
- **App Router, not Pages Router**
- **Server Components by default** — add `"use client"` only when you need browser APIs, event handlers, or state
- **No unnecessary dependencies** — if you can do it in 10 lines, don't add a package
- **No speculative abstractions** — three similar lines of code is better than a premature utility
- **Tailwind CSS for all styling** — no inline styles, no CSS modules unless forced
- **Radix UI for interactive components** — dialogs, dropdowns, tooltips
- **Mobile-first design** — design for phone, scale up; minimum touch target 48×48px
- **`next/image` for all images** — auto-optimization, lazy load, responsive
- **`font-display: swap`** for custom fonts; preload critical fonts
- **Response envelope convention:**
  ```ts
  // Success: { data: T }
  // Error: { error: string }
  ```
- **Naming:** kebab-case routes, PascalCase types, camelCase variables/functions, snake_case DB columns

---

## 4. Security Rules (Non-Negotiable)

### Secrets & API Keys
- **Never log raw API keys, tokens, or passwords** — not even in dev
- Encrypt all user-supplied credentials before storing (AES-256)
- Encryption key lives in environment variable, never in code
- No secrets in client bundles — anything in `NEXT_PUBLIC_` is visible to everyone
- `.env*` files always gitignored; never commit them

### Database (Supabase / Postgres)
- **Row Level Security (RLS) enabled on every table** — database enforces isolation, not application code
- Each user can only read/write their own rows via `auth.uid() = user_id` policies
- Service role key only in worker/server context, never exposed to client
- Use `anon` key on the client — it respects RLS

### Authentication
- Validate session server-side on every protected route/API handler
- Never trust user-supplied `user_id` in request bodies — read from verified session
- Token expiry and rotation handled by auth provider (Supabase Auth)

### Input Validation
- Validate all user input at system boundaries (API routes, server actions)
- Use Zod or equivalent schema validation — don't hand-roll checks
- Reject unknown fields (strip or error, don't pass through)
- File uploads: validate MIME type server-side, enforce size limits, prevent path traversal

### HTTP / Headers
- HTTPS everywhere — no HTTP in production
- HSTS header required: `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- CORS: only whitelist known origins, never `*` in production
- Content-Security-Policy: set it; tighten `connect-src` when adding new third-party domains

### API Security
- All non-public endpoints require valid session
- Check resource ownership on every mutation — don't just check "is logged in", check "owns this"
- Rate-limit public/auth endpoints (sign-in, sign-up, password reset)
- Never expose stack traces or internal error messages to client

### Payments
- Never store raw card data — delegate entirely to the payment provider
- Verify webhook signatures before processing any payment event
- Enforce subscription tier server-side (worker + API); UI is just a hint

---

## 5. API Design

### HTTP Semantics
| Method | Use for |
|--------|---------|
| GET | Read — no side effects, cacheable |
| POST | Create a new resource |
| PUT | Replace a resource entirely |
| PATCH | Partial update |
| DELETE | Remove a resource |

Never use GET for mutations. Never use POST when PATCH is correct.

### URL Naming
- kebab-case paths: `/api/alert-configs`, `/api/team-members`
- Plural nouns for collections: `/api/integrations`, not `/api/integration`
- Resource IDs in the path: `/api/integrations/:id`
- Actions that don't map cleanly to CRUD: use a verb suffix sparingly: `/api/invites/:token/accept`

### Status Codes
- `200` — success (GET, PATCH, PUT)
- `201` — created (POST)
- `204` — success, no body (DELETE)
- `400` — bad request / validation failure
- `401` — not authenticated
- `403` — authenticated but not authorized
- `404` — resource not found
- `409` — conflict (duplicate, state mismatch)
- `422` — unprocessable entity (valid JSON, invalid business logic)
- `429` — rate limited
- `500` — server error (log it, return generic message)

### List Endpoints
- All list endpoints must support pagination (offset+limit minimum; cursor preferred for large sets)
- Default page size: 20–50 items
- Always return total count: `{ data: [...], total: N, page: N, limit: N }`
- Support filtering via query params: `?status=active&service=github`

### Security on Responses
- Never return sensitive fields (encrypted keys, internal IDs, passwords)
- Strip fields at serialization layer, not in DB query
- Don't over-fetch: return only what the caller needs

### Validation
- Validate request body against a Zod schema at the top of every POST/PATCH handler
- Return `400` with field-level errors on validation failure
- Reject unknown fields — don't silently pass them through

### Error Handling
- One failing integration/resource must not cause the whole request to fail
- Wrap third-party API calls in try/catch; return partial results with `errors` array when appropriate
- Never let an unhandled promise rejection crash the route

### Versioning
- Pin API version in a header (`X-API-Version`) or path prefix (`/v1/`) from day one
- Breaking changes require a new version — never change an existing endpoint's response shape silently

---

## 6. Error Handling

### Core Rule
**One failure must not cascade.** A third-party API going down, a database query timing out, or one user's integration erroring should never take down the entire request, page, or polling cycle.

### Server-Side (API Routes / Worker)
- Wrap every third-party call in `try/catch`
- Log the full error server-side (stack trace, context, integration ID)
- Return a generic message to the client — never expose stack traces or internal details
- In polling workers: catch per-integration, log, and continue to the next one
- Use specific error types where possible; don't throw raw strings

### Client-Side (React)
- Add `error.tsx` to every major route segment in the App Router
- Error boundaries must show a recovery action (retry button, back link) — not just a message
- Never show raw error objects or stack traces to users
- Loading states: always show a skeleton or spinner while async data loads
- Timeout states: if a fetch takes >10s, show a timeout message with retry

### User-Facing Error Messages
- Be specific enough to be actionable: "GitHub token is invalid or expired — reconnect your account" beats "Something went wrong"
- For validation errors: tell the user exactly which field failed and why
- For auth errors: redirect to login with a `?reason=` param so you can show context
- For permission errors: explain what the user needs (upgrade prompt, team invite, etc.)

### Monitoring
- Integrate error monitoring (Sentry, LogFlare, etc.) before launch
- Alert on: unhandled exceptions, 5xx rate spikes, worker crashes
- Preserve error context: user ID, integration ID, route, timestamp

### What NOT to Do
- Don't swallow errors silently (`catch (err) {}`)
- Don't use `console.log` for errors in production — use structured logging
- Don't return `500` for user errors — `400`/`422` for bad input, `403` for auth
- Don't retry blindly in a loop — use exponential backoff with a max retry count

---

## 7. Worker / Background Job Patterns

### Core Principle: Stateless
The worker holds no in-memory state between runs. All state lives in the database. The worker can be restarted, redeployed, or run multiple instances without data loss or duplication.

### Polling Loop Structure
```ts
async function pollCycle() {
  const integrations = await db.getAllActiveIntegrations();

  for (const integration of integrations) {
    try {
      await processIntegration(integration);
    } catch (err) {
      console.error(`[worker] Integration ${integration.id} failed:`, err);
      await db.updateIntegrationStatus(integration.id, 'error');
      // continue to next — never re-throw
    }
  }
}
```

### Rules
1. **Never throw from the top-level loop** — catch per-integration, log, and move on
2. **Update status in the DB on every failure** — `status = 'error'`, `last_error = message`
3. **Idempotent by design** — running the same poll cycle twice produces the same DB state (upsert, don't duplicate)
4. **No in-memory caches** — read fresh from DB each cycle; cache invalidation bugs are worse than the extra query
5. **Enforce tier limits in the worker** — don't rely solely on the frontend to block pro features

### Polling Intervals (Tier-Based)
- Free: every 15 minutes
- Pro: every 5 minutes
- Team: every 1 minute

### Alert Firing — No Spam
Track alert state in a dedicated table (`alert_history`). Before firing:
1. Check if an alert was already sent for this metric in its current "crossed" state
2. Only re-alert when the metric drops below threshold and crosses again
3. Record every fired alert with: integration_id, metric_name, percent_used, channel, sent_at

### Deployment (Railway)
- Run as a standalone Node.js process (`ts-node` or compiled `node dist/index.js`)
- Use Railway's restart policy — let it crash and restart
- No cron inside the worker — use `setInterval` or Railway's cron trigger
- Log to stdout only — Railway captures and stores logs automatically

### Error Classification
| Error Type | Action |
|-----------|--------|
| 401/403 from third-party API | Mark integration `error`, notify user, stop polling |
| 429 rate limited | Log, skip this cycle, retry next interval |
| 500 from third-party | Log, mark error, retry next cycle |
| DB connection failure | Log, abort entire cycle, restart worker |
| Unexpected exception | Log with full stack, mark integration error, continue |

---

## 8. Vercel Middleware

⚠️ **CRITICAL: Always add matcher config. No matcher = invocation explosion + Fluid CPU charges.**

### The Problem
Next.js middleware runs on **every incoming request by default** — including `_next/static`, `_next/image`, favicon, and all other static assets. On Vercel, each middleware invocation counts toward your usage.

Symptoms:
- Middleware invocation count in the thousands/hour
- Unexpectedly high Fluid active CPU usage
- Billing spikes with no obvious traffic explanation

### The Fix

Every `middleware.ts` **must** have an explicit `config.matcher`:

```ts
// middleware.ts
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)',
  ],
};
```

Or for auth-only middleware (preferred — more auditable):

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

### Rules
1. **Never ship middleware without a matcher.** The "runs on everything" default is a billing trap.
2. **Prefer an explicit route list** over a negative regex — it's auditable and won't silently expand.
3. **Check invocation counts after deploying middleware changes** — Vercel shows this in the Functions tab.
4. **Middleware should be lightweight** — auth token checks and redirects only; no DB queries, no external API calls.

---

## 9. Git Conventions

### .gitignore — Always Exclude
```
# dependencies
/node_modules
/.pnp
.pnp.*

# build artifacts
/.next/
/build
/*.tsbuildinfo
next-env.d.ts

# environment files — NEVER commit
.env*

# platform metadata
.DS_Store
*.pem
.vercel

# debug logs
npm-debug.log*

# generated / tooling output
/graphify-out
/coverage

# personal knowledge base
/me
```

### Commit Message Style
- Present-tense imperative: "add Slack alert channel", not "added" or "adding"
- Lead with the area: "worker: fix rate limit handling for GitHub", "ui: fix mobile nav overflow"
- Keep subject line under 72 characters
- Body (optional) explains *why*, not *what* — the diff shows what

### Branch Naming
- Feature: `feat/short-description`
- Fix: `fix/short-description`
- Chore/infra: `chore/short-description`
- Main branch: `main`

### Multi-AI Sync
Keep these files in sync — they all serve the same purpose on different platforms:
- `CLAUDE.md` — Claude Code
- `AGENTS.md` — Claude agent mode
- `.cursorrules` — Cursor
- `.windsurfrules` — Windsurf
- `GEMINI.md` — Gemini

Update all of them together when project conventions change.

---

## 10. Frontend Design — Avoiding AI Slop

### What AI Slop Looks Like
- Purple-to-blue gradient hero section with centered heading and one CTA button
- Three identical feature cards in a row
- "Trusted by 1,000+ developers" logo strip
- Generic sans-serif font (Inter or DM Sans used without thought)
- Every section padded identically, no rhythm variation
- White background, gray text, blue primary button

The problem isn't that these patterns are wrong. It's that they're reflexive — chosen because they're easy, not because they're right for the product.

### Design Principles

#### Typography First
Type carries the most weight. Pick one display font and one body font — not three.
- Display: something with character (Playfair Display, Clash Display, Syne, Space Grotesk)
- Body: legible at small sizes (Inter, DM Sans, Geist, Plus Jakarta Sans)
- Use font size and weight contrast to create hierarchy — don't rely on color alone

#### Whitespace is the Design
Cramped UIs feel low-quality regardless of other choices. Be generous with padding.
- Sections: `py-24` to `py-32` on desktop
- Between elements: let them breathe
- Cards: `p-6` to `p-8`, not `p-4`

#### Color with Restraint
Pick one accent color and use it sparingly. Everything else is neutrals.
- Not: blue buttons, blue headings, blue icons, blue borders
- Yes: one blue CTA button; everything else is black/white/gray
- Dark mode isn't optional if your product targets developers

#### No Decoration Without Purpose
Gradients, blurs, glows, and animated backgrounds are fine if they serve a purpose. If you can't explain why an element is there, remove it.

#### Contrast and Hierarchy
Every screen needs a clear answer to: "What should I look at first?"
- One primary action per screen
- Heading hierarchy: one `<h1>`, supporting `<h2>`s, never competing `<h1>`s
- Visual weight guides the eye: large → medium → small

### Patterns That Actually Work

#### Hero Section
- Asymmetric layout (text left, visual right)
- Show the actual product (screenshot, video, live demo) — not abstract shapes
- Headline that says what the product *does*, not what it *is*

#### Feature Sections
- Alternate layout direction (text/visual, then visual/text)
- One feature gets the spotlight, others support it
- Show the feature in context (a real UI, a real data example)

#### Pricing
- Highlight the recommended tier (border, badge, slightly larger)
- Use a toggle for monthly/annual
- Show the math: "Save $X/year"

#### Empty States
- Show an illustration or icon
- Clear explanation of why it's empty
- Call to action to fill it ("Connect your first service →")

### Before Shipping Any New Page
- [ ] Does each section have a clear visual hierarchy?
- [ ] Is there one dominant action per screen?
- [ ] Does the font pairing have contrast (display vs. body weight/style)?
- [ ] Are you using the accent color sparingly?
- [ ] Does it look good in dark mode?
- [ ] Is the mobile layout intentional (not just "it fits")?
- [ ] Does it show the actual product, not just describe it?

---

## 11. Tooling

### Graphify (Knowledge Graph)
- Builds a navigable knowledge graph of the codebase
- Use at the start of every project and after major structural changes
- Run via `/graphify` in Claude Code or `python -m graphify <path>`
- Auto-rebuild on git commit via post-commit hook: `python -m graphify hook install`

**Reading the outputs:**
- `GRAPH_REPORT.md` — god nodes (most-connected), communities (clusters), surprising connections, hyperedges
- `graph.html` — interactive visualization; color-coded by community
- `graph.json` — machine-readable; survives across sessions for querying

**Querying:**
```
/graphify query "What is the path from a GitHub usage poll to a fired Slack alert?"
/graphify query "Which files are most risky to change?"
/graphify explain "pollCycle"
/graphify path "fetchGitHubUsage" "sendSlackAlert"
```

Always add `/graphify-out` to `.gitignore` — it's a generated artifact.

### Code Review Graph (MCP)
Use graphify MCP tools instead of Grep/Glob/Read for understanding code structure — it's faster and gives architectural context.

| Tool | When to use |
|------|------------|
| `semantic_search_nodes` | Find functions/classes by name or keyword |
| `query_graph` | Trace callers, callees, imports, tests, dependencies |
| `get_impact_radius` | Understand blast radius before making a change |
| `detect_changes` | Review staged/recent changes with risk scoring |
| `get_review_context` | Get source snippets for a change |
| `get_affected_flows` | Find which execution paths a change touches |
| `get_architecture_overview` | High-level codebase structure |
| `list_communities` | See all detected module clusters |

### AI Collaboration
Keep all AI config files in sync for consistent context across tools:
- `CLAUDE.md` — Claude Code
- `AGENTS.md` — Claude agent/agentic mode
- `.cursorrules` — Cursor
- `.windsurfrules` — Windsurf
- `GEMINI.md` — Gemini

---

## 12. Audit Triggers

Run the corresponding checklist **before** each of these events:

| Trigger | Checklist |
|---------|-----------|
| Pre-launch | `me/audits/pre-launch-checklist.md` |
| API changes | `me/audits/api-security-checklist.md` + `me/audits/api-design-checklist.md` |
| UI/frontend changes | `me/audits/performance-checklist.md` + `me/audits/mobile-checklist.md` |
| Billing/payments | `me/audits/billing-checklist.md` |
| Error handling changes | `me/audits/error-handling-checklist.md` |
| Onboarding flow | `me/audits/onboarding-ux-checklist.md` |
| SEO/content | `me/audits/seo-checklist.md` |

Each checklist is organized into Critical, High, Medium, and Low/Info items. Do not ship until Critical items are resolved.
