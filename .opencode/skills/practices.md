---
name: practices
description: Complete coding standards, security rules, API design, error handling, worker patterns, git conventions, frontend design, and Vercel middleware best practices.
---

# Practices Skill

Complete rules and conventions for writing code on this project.

---

## Coding Standards

### Language & Framework
- **TypeScript everywhere** — no plain JS, no `any` unless absolutely unavoidable
- **Strict mode on** (`"strict": true` in tsconfig)
- **Next.js App Router** — not Pages Router
- **Server Components by default** — add `"use client"` only when you need browser APIs, event handlers, or state
- **Co-locate page-specific logic** in the route segment, not in `/lib`
- **Wrap async auth checks in `<Suspense>`** to avoid blocking static/edge rendering

### Code Style
- **No unnecessary dependencies** — if you can do it in 10 lines, don't add a package
- **No speculative abstractions** — three similar lines of code is better than a premature utility
- **No backwards-compatibility hacks** for code you're removing — delete it cleanly
- **Comments only where logic isn't self-evident** — don't narrate obvious code

### UI / Frontend
- **Tailwind CSS for all styling** — no inline styles, no CSS modules unless forced
- **Radix UI for accessible interactive components** — dialogs, dropdowns, tooltips
- **Recharts for data visualization**
- **Mobile-first design** — design for phone, then scale up
- **Minimum touch target: 48×48px**
- **`next/image` for all images** — auto-optimization, lazy load, responsive srcset
- **`font-display: swap` for custom fonts** — preload critical fonts

### Response Shape Convention
All API routes return a consistent envelope:
```ts
// Success
{ data: T }

// Error
{ error: string }
```

### Naming
- Route files: kebab-case (`/api/alert-configs`)
- TypeScript types/interfaces: PascalCase
- Variables and functions: camelCase
- Database columns: snake_case

---

## Security Rules (Non-Negotiable)

### Secrets & API Keys
- **Never log raw API keys, tokens, or passwords** — not even in dev
- Encrypt all user-supplied credentials before storing in the database (AES-256)
- The encryption key itself lives in an environment variable, never in code
- No secrets in client bundles — anything in `NEXT_PUBLIC_` is visible to everyone
- `.env*` files are always gitignored; never commit them

### Database (Supabase / Postgres)
- **Row Level Security (RLS) must be enabled on every table** — the database enforces isolation, not application code
- Each user can only read/write their own rows; enforce via `auth.uid() = user_id` policies
- Use the service role key only in the worker/server context, never exposed to the client
- Use `anon` key on the client — it respects RLS

### Authentication
- Validate the session server-side on every protected route/API handler
- Never trust user-supplied `user_id` in request bodies — always read from the verified session
- Token expiry and rotation handled by the auth provider (Supabase Auth)
- OAuth providers: only enable what you actually use

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
- All non-public endpoints require a valid session
- Check resource ownership on every mutation — don't just check "is logged in", check "owns this"
- Rate-limit public/auth endpoints (sign-in, sign-up, password reset)
- Never expose stack traces or internal error messages to the client

### Payments
- Never store raw card data — delegate entirely to the payment provider
- Verify webhook signatures before processing any payment event
- Enforce subscription tier server-side (worker + API); the UI is just a hint

---

## API Design Rules

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

### Response Shape
Always return a consistent envelope:
```ts
// 200 Success
{ "data": <resource or array> }

// 4xx / 5xx Error
{ "error": "Human-readable message" }
```

Never mix — don't return a bare array or bare object on success and an envelope on error.

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
- Always return total count alongside the page: `{ data: [...], total: N, page: N, limit: N }`
- Support filtering via query params: `?status=active&service=github`

### Security on Responses
- Never return sensitive fields (encrypted keys, internal IDs used as secrets, passwords)
- Strip fields the caller isn't authorized to see at the serialization layer, not in the DB query
- Don't over-fetch: return only what the caller needs

### Validation
- Validate request body against a Zod schema at the top of every POST/PATCH handler
- Return `400` with field-level errors on validation failure:
  ```json
  { "error": "Validation failed", "fields": { "threshold": "Must be between 1 and 100" } }
  ```
- Reject unknown fields — don't silently pass them through

### Error Handling
- One failing integration/resource must not cause the whole request to fail
- Wrap third-party API calls in try/catch; return partial results with an `errors` array when appropriate
- Never let an unhandled promise rejection crash the route

### Versioning
- Pin API version in a header (`X-API-Version`) or path prefix (`/v1/`) from day one
- Breaking changes require a new version — never change an existing endpoint's response shape silently

---

## Error Handling Rules

### The Core Rule
**One failure must not cascade.** A third-party API going down, a database query timing out, or one user's integration erroring should never take down the entire request, page, or polling cycle.

### Server-Side (API Routes / Worker)
- Wrap every third-party call in `try/catch`
- Log the full error server-side (stack trace, context, integration ID)
- Return a generic message to the client — never expose stack traces or internal details
- In polling workers: catch per-integration, log, and continue to the next one
- Use specific error types where possible; don't throw raw strings

```ts
try {
  const data = await fetchThirdPartyApi(integration);
} catch (err) {
  console.error(`[service] Integration ${integration.id} failed:`, err);
  // update integration status to 'error' in DB, then continue
}
```

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

### HTTP Error Codes
Return correct status codes — don't return `200` with `{ error: "..." }` in the body.

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

## Worker / Background Job Patterns

### Core Principle: Stateless
The worker holds no in-memory state between runs. All state — what was last polled, what alerts fired, what thresholds are set — lives in the database. The worker can be restarted, redeployed, or run multiple instances without data loss or duplication.

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
2. **Update status in the DB** on every failure (`status = 'error'`, `last_error = message`)
3. **Idempotent by design** — running the same poll cycle twice produces the same DB state (upsert, don't duplicate)
4. **No in-memory caches** — read fresh from DB each cycle; cache invalidation bugs are worse than the extra query
5. **Enforce tier limits in the worker** — don't rely solely on the frontend to block pro features

### Polling Intervals (Tier-Based)
Fetch the user's tier from the DB; skip if not due yet. Store `last_polled_at` per integration.
- Free: every 15 minutes
- Pro: every 5 minutes
- Team: every 1 minute

### Alert Firing — No Spam
Track alert state in a dedicated table (`alert_history`). Before firing:
1. Check if an alert was already sent for this metric in its current "crossed" state
2. Only re-alert when the metric drops below threshold and crosses again
3. Record every fired alert with: integration_id, metric_name, percent_used, channel, sent_at

### Environment Variables (Required)
```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY  # server-only, never exposed to client
ENCRYPTION_KEY             # must match the frontend encryption key
RESEND_API_KEY
NEXT_PUBLIC_VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT
```

### Deployment (Railway)
- Run as a standalone Node.js process (`ts-node` or compiled `node dist/index.js`)
- Use Railway's restart policy — let it crash and restart rather than adding recovery logic
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

## Git Conventions

### .gitignore — Always Exclude
```
# dependencies
/node_modules
/.pnp
.pnp.*
.yarn/*
!.yarn/patches
!.yarn/plugins
!.yarn/releases
!.yarn/versions

# build artifacts
/.next/
/out/
/build
*.tsbuildinfo
next-env.d.ts

# environment files — NEVER commit
.env*

# platform metadata
.DS_Store
*.pem
.vercel

# debug logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.pnpm-debug.log*

# generated / tooling output
/graphify-out
/coverage

# personal knowledge base
/me
```

### What to Never Commit
- `.env`, `.env.local`, `.env.production` — any environment file
- Private keys (`*.pem`, `*.key`)
- `/node_modules` — always regenerable
- Build artifacts (`/.next`, `/build`, `/out`)
- Generated tool output (`/graphify-out`, `/coverage`)

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
When using multiple AI tools (Claude, Cursor, Windsurf, Gemini), keep these files in sync — they all serve the same purpose on different platforms:
- `CLAUDE.md` — Claude Code
- `AGENTS.md` — Claude agent mode
- `.cursorrules` — Cursor
- `.windsurfrules` — Windsurf
- `GEMINI.md` — Gemini

Update all of them together when project conventions change.

### Hooks
- Pre-commit: run type check / lint
- Post-commit: rebuild knowledge graph (via `python -m graphify hook install`)
- Never skip hooks with `--no-verify` unless absolutely necessary and documented why

---

## Frontend Design — Avoiding AI Slop

A guide for producing genuinely good UI rather than the generic gradient-hero, card-grid, blue-button output that AI tools default to.

### What AI Slop Looks Like

You'll recognize it instantly:
- Purple-to-blue gradient hero section with a centered heading and one CTA button
- Three identical feature cards in a row with an icon, title, and two lines of text
- "Trusted by 1,000+ developers" logo strip immediately after the hero
- Generic sans-serif font (Inter or DM Sans used without thought)
- Every section padded identically, no rhythm variation
- White background, gray text, blue primary button — everywhere

The problem isn't that these patterns are wrong. It's that they're reflexive — chosen because they're easy, not because they're right for the product.

### Design Principles (Non-Negotiables)

#### Typography First
Type carries the most weight. Pick one display font and one body font — not three.
- Display: something with character (Playfair Display, Clash Display, Syne, Space Grotesk)
- Body: legible at small sizes (Inter, DM Sans, Geist, Plus Jakarta Sans)
- Use font size and weight contrast to create hierarchy — don't rely on color alone

#### Whitespace is the Design
Cramped UIs feel low-quality regardless of other choices. Be generous with padding.
- Sections: `py-24` to `py-32` on desktop, not `py-8`
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
Instead of a centered gradient blob with one heading:
- Asymmetric layout (text left, visual right)
- Show the actual product (screenshot, video, live demo) — not abstract shapes
- Headline that says what the product *does*, not what it *is*
- Secondary headline that says who it's *for*

#### Feature Sections
Instead of three identical icon cards:
- Alternate layout direction (text/visual, then visual/text)
- One feature gets the spotlight, others support it
- Show the feature in context (a real UI, a real data example)

#### Pricing
Instead of three identical cards:
- Highlight the recommended tier (border, badge, slightly larger)
- Use a toggle for monthly/annual
- Show the math: "Save $X/year"

#### Empty States
Don't show nothing. Show:
- An illustration or icon
- A clear explanation of why it's empty
- A call to action to fill it ("Connect your first service →")

### Before Shipping Any New Page

- [ ] Does each section have a clear visual hierarchy?
- [ ] Is there one dominant action per screen?
- [ ] Does the font pairing have contrast (display vs. body weight/style)?
- [ ] Are you using the accent color sparingly?
- [ ] Does it look good in dark mode?
- [ ] Is the mobile layout intentional (not just "it fits")?
- [ ] Does it show the actual product, not just describe it?
- [ ] Would a designer cringe at the spacing?

---

## Vercel Middleware — Invocation Cost Gotcha

⚠️ **CRITICAL: Always add matcher config. No matcher = invocation explosion + Fluid CPU charges.**

### The Problem

Next.js middleware runs on **every incoming request by default** — including `_next/static`, `_next/image`, favicon, and all other static assets. On Vercel, each middleware invocation counts toward your usage. Without a matcher, a single page load can trigger 10–20+ middleware calls (one per asset), and Fluid compute charges you for active CPU on each one.

Symptoms:
- Middleware invocation count in the thousands/hour for a small-traffic app
- Unexpectedly high Fluid active CPU usage in Vercel analytics
- Billing spikes with no obvious traffic explanation

### The Fix — Always Set a Matcher

Every `middleware.ts` must have an explicit `config.matcher` that excludes static files.

```ts
// middleware.ts
export const config = {
  matcher: [
    /*
     * Match all paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public folder assets (svg, png, jpg, etc.)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)',
  ],
};
```

For auth-only middleware (most common case), this is tighter and clearer:

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

Explicit route list is the safest option — you know exactly what the middleware runs on.

### Rules

1. **Never ship middleware without a matcher.** The "runs on everything" default is a billing trap.
2. **Prefer an explicit route list** over a negative regex — it's auditable and won't silently expand.
3. **Check invocation counts after deploying middleware changes.** Vercel shows this in the Functions tab.
4. **Middleware should be lightweight.** Auth token checks and redirects only — no DB queries, no external API calls.

### Checklist (add to pre-launch)

- [ ] `middleware.ts` has an explicit `config.matcher`
- [ ] Matcher excludes `_next/static`, `_next/image`, and static asset extensions
- [ ] Middleware does no DB or external API calls (token check only)
- [ ] Invocation count checked in Vercel dashboard after first deploy
