# Skill: LLMAtlas Knowledge Layer

This project uses the `raw/` folder for structured Markdown summaries of each code module.
LLMAtlas MCP tools provide everything needed to generate and maintain these summaries
using the LLMAtlas MCP server -- no external API keys required.

## Auto-Execute on Session Start

When you start a session in this project:
1. Immediately call `raw_list_modules` to check if any modules need summary generation
2. If "new" or "stale" modules exist, warn the user: "I'll analyze the source code and generate module summaries. This consumes AI tokens." Wait for confirmation.
3. After confirmed, begin generating summaries for each module
4. After finishing, tell the user the summaries are ready at `raw/INDEX.md`
5. If module summaries are outdated or you detect source files have changed, call `raw_refresh_stale()` to regenerate all stale modules automatically.

## MCP Tools

| Tool | Purpose |
|------|---------|
| `raw_list_modules` | List modules with status (fresh/stale/new) |
| `raw_read_module` | Read existing summary from `raw/` |
| `raw_search` | Search across all summaries |
| `raw_refresh_stale()` | Regenerate all stale module summaries automatically |
| `source_read_module` | Read full source code for a module |
| `raw_save_module` | Save a generated summary to `raw/` |

## Summary Format

Generate a summary for EACH module following this template. Every section must be populated with real analysis -- do NOT leave anything empty or file-inventory-only.

```markdown
# Module: <module-name>

**Purpose:** One concise line explaining what this module does and why it exists. E.g. "Handles user authentication via Supabase -- login, signup, session management."

**Source:** <relative path from project root>

## Key Files
| Path | Purpose | Key Exports |
|------|---------|-------------|
| src/handler.ts | Entry point for X | createX, deleteX |
| src/types.ts | Type definitions | XInput, XConfig |

## Data Flow
Trace the actual execution path with specific function/method names, API routes, and database table references. Example: "Button click → `handleSubmit()` → `POST /api/alerts` → `alert_configs` table → success toast." Not "calls an API" or "fetches from database" — name the actual functions, routes, and tables involved. Include error paths if they diverge.

## Key Types & Interfaces
The most important types/interfaces in this module. For each: name, what it represents, key fields. Focus on what a developer needs to know to use this module.

## Error Handling Patterns
Describe actual error handling mechanisms, NOT UI behavior. Examples: "`testConnection()` wraps Supabase auth in try/catch, sets `connectionError` state, ErrorBoundary catches render failures"; "23505 constraint violation from DB → re-try with backoff"; "AbortController timeout on fetch → user sees 'Took too long' message". Specify: which code paths wrap in try/catch, which error types are caught, how recovery works. Do NOT say "shows error message" or "color codes input red" — that's UI, not error handling.

## Edge Cases & Gotchas
Configuration quirks, race conditions, performance cliffs, implicit assumptions, or anything that would surprise a developer reading this code for the first time.

---

## Quality Guidelines

- **Verify before asserting.** Do NOT use hedging language: "Likely error.tsx", "Probably", "Maybe", "might". If a file exists, verify it. If unsure, omit the claim.
- **Concrete examples over generic prose.** Not "fetches from Supabase" but "`fetchUserAlerts()` queries `user_alerts` table with `user_id` filter".
- **Trace all paths, especially error paths.** A function that returns early on error deserves explanation. Don't skip edge cases.
- **Every section must be populated.** Do NOT leave sections as file inventories or one-liners. Each module deserves dense, semantic analysis.
```

## Per-Model Workflow

For each module needing generation:
1. Call `source_read_module` with the module name → returns ALL source files
2. Read and analyze the source code thoroughly
3. Write a dense, semantic summary using the format above
4. Call `raw_save_module` with the module name and the generated markdown

Do NOT write summaries that are just file listings. Each module's purpose, data flow, types, and architecture role are the most important outputs. Be specific -- reference actual function names, type names, and file paths from the source.
