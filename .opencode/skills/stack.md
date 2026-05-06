---
name: stack
description: SaaS tech stack choices, project structure, frontend libraries, payments integration, and docs framework.
---

# Stack Skill

Complete technology choices and rationale for this SaaS project.

---

## SaaS Technology Stack

### Frontend
| Layer | Choice | Why |
|-------|--------|-----|
| Framework | **Next.js (App Router)** | Server components, edge rendering, built-in routing, Vercel-native |
| Language | **TypeScript (strict)** | Catch bugs at compile time, not runtime |
| Styling | **Tailwind CSS** | Utility-first, no CSS file bloat, works great with component libraries |
| Components | **Radix UI** | Headless, accessible primitives; style with Tailwind on top |
| UI Kit | **shadcn/ui** | Copy-paste components built on Radix + Tailwind; fully customizable |
| Charts | **Recharts** | React-native, composable, good enough for dashboards |
| Forms | **react-hook-form + Zod** | Form state management with schema validation |
| Animation | **Framer Motion** | Page transitions, layout animations, gesture interactions |
| Icons | **Lucide React** | 1,400+ clean, consistent, tree-shakeable icons |
| Toasts | **Sonner or react-hot-toast** | Beautiful, minimal notifications |

### Backend / Database
| Layer | Choice | Why |
|-------|--------|-----|
| Database | **Supabase (Postgres)** | RLS built-in, auth included, real-time, good free tier |
| Auth | **Supabase Auth** | Email/password, magic link, GitHub OAuth, Google OAuth out of the box |
| ORM | **Supabase JS client** | Direct SQL when needed; RLS enforced automatically |
| Encryption | **AES-256 (Node.js crypto)** | Encrypt user API keys before DB storage; key in env var |

### Infrastructure
| Layer | Choice | Why |
|-------|--------|-----|
| Frontend Hosting | **Vercel** | Next.js native, edge network, instant deployments, preview URLs |
| Worker Hosting | **Railway** | Simple Node.js deployment, cron triggers, env var management, cheap |
| Email | **Resend** | Developer-friendly, good deliverability, React email templates |
| Payments | **Dodo Payments** | Works for international markets; alternatives: Stripe (US/EU) |
| Docs | **Fumadocs** | Next.js native MDX docs framework; sidebar, search, TOC, zero design debt |

### Tooling
| Tool | Purpose |
|------|---------|
| **graphify** | Build a knowledge graph of the codebase for architecture understanding |
| **Biome or ESLint** | Linting and formatting |

---

## Project Structure

```
/
  app/                    # Next.js App Router
    layout.tsx            # Root layout (fonts, providers, nav)
    page.tsx              # Landing page (public)
    dashboard/
      page.tsx            # Main usage overview (protected)
      loading.tsx         # Skeleton while data loads
      error.tsx           # Error boundary
    integrations/         # Manage connected services
    alerts/               # Alert history
    settings/             # Thresholds, channels, account, billing
    team/                 # Team features (Team tier only)
    pricing/              # Pricing page (public)
    login/                # Login page
    signup/               # Signup page
    auth/
      callback/
        route.ts          # OAuth callback handler
    api/                  # API routes
      integrations/
        route.ts          # GET list, POST create
        [id]/
          route.ts        # GET, PATCH, DELETE
      usage/              # Usage data endpoint
      alerts/             # Alert endpoints
      team/               # Team management
      webhooks/           # Third-party webhooks
      billing/            # Billing/checkout endpoints
    docs/                 # Fumadocs documentation
      layout.tsx
      [[...slug]]/
        page.tsx

  worker/                 # Background polling worker (separate Node.js process)
    index.ts              # Entry point — starts polling loop
    pollCycle.ts          # Main orchestration
    thresholds.ts         # Threshold evaluation logic
    services/
      github.ts
      vercel.ts
      supabase.ts
      railway.ts
    alerts/
      email.ts
      slack.ts
      discord.ts
      push.ts
    lib/
      encryption.ts       # Shared with app/
    package.json
    tsconfig.json

  lib/                    # Shared utilities (used by both app/ and worker/)
    supabase.ts           # Supabase client initialization
    encryption.ts         # AES-256 encrypt/decrypt for API keys
    tiers.ts              # Tier limit checks and enforcement

  public/                 # Static assets
  content/docs/           # Fumadocs content (MDX)
    meta.json             # Sidebar ordering
    index.mdx             # /docs root page
    alert-config.mdx
    services/
      meta.json
      github.mdx
      vercel.mdx

  Audits/                 # Audit reports and checklists
  me/                     # Personal knowledge base (gitignored)
  .opencode/              # OpenCode agent and skill files

  CLAUDE.md               # AI assistant instructions and project spec
  AGENTS.md               # Agent mode instructions
  .cursorrules            # Cursor rules (keep in sync with CLAUDE.md)
  .windsurfrules          # Windsurf rules
  GEMINI.md               # Gemini rules
  .gitignore
  package.json
  tsconfig.json
```

---

## Key Conventions

1. **`lib/` is shared** between app routes and the worker — put truly shared logic here
2. **Each service gets its own file** in `worker/services/`
3. **Each alert channel gets its own file** in `worker/alerts/`
4. **API routes follow REST conventions** — see API Design in AGENTS.md
5. **Audit files live in `/Audits/`** — run them before launch
6. **AI config files stay in sync** — update CLAUDE.md, AGENTS.md, .cursorrules, .windsurfrules, GEMINI.md together

---

## Tier Structure

```
Free    — 1 account per service, email-only alerts, 15-min polling, 7-day history
Pro     — Multiple accounts, all channels, 5-min polling, 30-day history + graphs  ($10/mo)
Team    — Everything in Pro + team features, 1-min polling, 90-day history         ($30/mo)
```

Tier limits are checked in both the API and the worker. The UI shows upgrade prompts — the backend enforces limits.

---

## Frontend Libraries

### Form Handling
- `react-hook-form` — form state, validation, submission
- `zod` — schema definition and validation
- `@hookform/resolvers` — bridges react-hook-form and Zod

```ts
const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});
const form = useForm<z.infer<typeof schema>>({
  resolver: zodResolver(schema)
});
```

### Data Fetching / State
- `@tanstack/react-query` — server state management, caching, background refresh
- Use `useQuery` for reads, `useMutation` for writes
- Works alongside Next.js Server Components

### Utility & Class Merging
- `clsx` + `tailwind-merge` — combine and deduplicate Tailwind classes safely
- Standard `cn()` util: put it in `lib/utils.ts`

```ts
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
```

### Dates
- `date-fns` — tree-shakeable, functional, immutable
- Functions: `format`, `formatDistanceToNow`, `startOfMonth`, `addDays`

### Video Generation
- `remotion` — programmatic video composition in React
- `<Player>` component for in-browser preview
- Use `useCurrentFrame()` + `interpolate()` for frame-based animation
- Separate Remotion from main Next.js app — it has its own bundler

---

## Dodo Payments Integration

### Core Pattern

**1. Create checkout session (server-side):**
```ts
// app/api/billing/checkout/route.ts
const checkout = await dodo.checkout.create({
  plan_id: PLAN_IDS[tier],
  customer_email: session.user.email,
  success_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?upgraded=true`,
  cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
  metadata: { user_id: session.user.id, tier },
});
return NextResponse.json({ url: checkout.url });
```

**2. Redirect to checkout (client-side):**
```ts
const res = await fetch("/api/billing/checkout", {
  method: "POST",
  body: JSON.stringify({ tier: "pro" }),
});
const { url } = await res.json();
window.location.href = url;
```

**3. Handle webhooks (server-side) — CRITICAL:**
```ts
export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("webhook-signature") ?? "";

  // Verify signature before doing anything
  const isValid = dodo.webhooks.verify(
    body,
    signature,
    process.env.DODO_PAYMENTS_WEBHOOK_SECRET!
  );
  if (!isValid) return new Response("Invalid signature", { status: 401 });

  const event = JSON.parse(body);

  switch (event.type) {
    case "subscription.activated":
    case "subscription.renewed":
      await updateUserTier(event.data.metadata.user_id, event.data.metadata.tier);
      break;
    case "subscription.cancelled":
    case "subscription.expired":
      await updateUserTier(event.data.metadata.user_id, "free");
      break;
    case "payment.failed":
      await handlePaymentFailure(event.data.metadata.user_id);
      break;
  }

  return new Response("ok", { status: 200 });
}
```

### Subscription Lifecycle Events

| Event | Action |
|-------|--------|
| `subscription.activated` | Set user tier in DB, send welcome email |
| `subscription.renewed` | Update `subscription.updated_at` in DB |
| `subscription.cancelled` | Downgrade tier at period end (not immediately) |
| `subscription.expired` | Enforce tier downgrade — disable excess features |
| `payment.failed` | Send dunning email, start grace period |
| `payment.recovered` | Cancel any pending downgrade, restore access |

### Tier Enforcement

Source of truth is your DB (`subscriptions` table), not Dodo's state. Sync via webhooks:

```ts
export async function getUserTier(userId: string): Promise<"free" | "pro" | "team"> {
  const { data } = await supabase
    .from("subscriptions")
    .select("tier, status")
    .eq("user_id", userId)
    .single();

  if (!data || data.status !== "active") return "free";
  return data.tier;
}
```

Rules:
1. **Downgrade at period end**, not immediately on cancellation
2. **Grace period on payment failure** — give 3–7 days before downgrading
3. **Enforce in both API and worker** — UI shows upgrade prompts; backend enforces limits

---

## Fumadocs (Docs Framework)

### Setup

**1. `next.config.mjs` (must be `.mjs`, not `.ts`):**
```mjs
import { createMDX } from 'fumadocs-mdx/next';

const nextConfig = { /* your config */ };
export default createMDX()(nextConfig);
```

**2. `source.config.ts`:**
```ts
import { defineDocs, defineConfig } from 'fumadocs-mdx/config';
export const docs = defineDocs({ dir: 'content/docs' });
export default defineConfig();
```

**3. `tsconfig.json` path alias:**
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"],
      "collections/*": ["./.source/*"]
    }
  }
}
```

**4. `package.json` scripts — CRITICAL FIX:**
```json
"dev": "fumadocs-mdx && next dev",
"build": "fumadocs-mdx && next build"
```

`.source/` must exist before Next.js starts compiling. Without this prefix, you get `Module not found: Can't resolve 'collections/server'` because `.source/` doesn't exist yet.

**5. `lib/source.ts`:**
```ts
import { docs } from 'collections/server';
import { loader } from 'fumadocs-core/source';

export const source = loader({
  baseUrl: '/docs',
  source: docs.toFumadocsSource(),
});
```

**6. `globals.css` (after Tailwind import):**
```css
@import "fumadocs-ui/css/neutral.css";
@import "fumadocs-ui/css/preset.css";
```

**7. `app/docs/layout.tsx`:**
```tsx
import { RootProvider } from 'fumadocs-ui/provider/next';  // /next, not /provider
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { source } from '@/lib/source';

export default function Layout({ children }) {
  return (
    <RootProvider>
      <DocsLayout tree={source.getPageTree()} nav={{ title: 'My Docs' }}>
        {children}
      </DocsLayout>
    </RootProvider>
  );
}
```

**8. `app/docs/[[...slug]]/page.tsx`:**
```tsx
import { source } from '@/lib/source';
import { DocsPage, DocsTitle, DocsDescription, DocsBody } from 'fumadocs-ui/page';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import { notFound } from 'next/navigation';

type Props = { params: Promise<{ slug?: string[] }> };

export default async function Page({ params }: Props) {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page) notFound();
  const MDX = page.data.body;
  return (
    <DocsPage toc={page.data.toc}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDX components={defaultMdxComponents} />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page) notFound();
  return {
    title: page.data.title,
    description: page.data.description
  };
}
```

**9. `app/api/search/route.ts` (Fumadocs internal endpoint):**
```ts
import { source } from '@/lib/source';
import { createFromSource } from 'fumadocs-core/search/server';

export const { GET } = createFromSource(source);
export const runtime = 'nodejs';
```

### Content Structure

```
content/docs/
├── meta.json              ← root sidebar order
├── index.mdx              ← /docs (root page)
├── alert-config.mdx
└── services/
    ├── meta.json          ← services group order
    ├── github.mdx
    └── mongodb.mdx
```

### Gotchas

| Problem | Cause | Fix |
|---------|-------|-----|
| `Module not found: collections/server` | `.source/` not generated before Next.js starts | Add `fumadocs-mdx &&` prefix to `dev` and `build` scripts |
| `Module not found: fumadocs-ui/provider` | That path doesn't exist in v16 | Use `fumadocs-ui/provider/next` |
| `fumadocs-mdx` is ESM-only | CommonJS config loader can't import it | Rename `next.config.ts` → `next.config.mjs` |
| Search not working | `runtime = 'nodejs'` missing on search route | Add `export const runtime = 'nodejs'` |
| Sidebar order wrong | Default is alphabetical | Use `meta.json` with `pages` array |

### Middleware Interaction

If you use an explicit positive matcher in `middleware.ts`, `/docs/*` is naturally excluded:

```ts
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/settings/:path*",
  ]
  // /docs/* not here → zero middleware invocations on docs pages
};
```

Never add `/docs` to the matcher — there's no auth needed there.
