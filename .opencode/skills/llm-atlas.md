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

## MCP Tools

| Tool | Purpose |
|------|---------|
| `raw_list_modules` | List modules with status (fresh/stale/new) |
| `raw_read_module` | Read existing summary from `raw/` |
| `raw_search` | Search across all summaries |
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
How data moves through this module. Trace the path: inputs come from where, what processes them, where output goes. Mention network calls, database queries, event emissions.

## Key Types & Interfaces
The most important types/interfaces in this module. For each: name, what it represents, key fields. Focus on what a developer needs to know to use this module.

## Error Handling Patterns
How errors are caught, logged, categorized, and surfaced. Any custom error types, middleware, or recovery logic.

## Edge Cases & Gotchas
Configuration quirks, race conditions, performance cliffs, implicit assumptions, or anything that would surprise a developer reading this code for the first time.
```

## Per-Model Workflow

For each module needing generation:
1. Call `source_read_module` with the module name → returns ALL source files
2. Read and analyze the source code thoroughly
3. Write a dense, semantic summary using the format above
4. Call `raw_save_module` with the module name and the generated markdown

Do NOT write summaries that are just file listings. Each module's purpose, data flow, types, and architecture role are the most important outputs. Be specific -- reference actual function names, type names, and file paths from the source.
