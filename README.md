# LLMAtlas

**Pre-digested codebase context for AI agents. No API keys. No config. Your AI does the work.**

LLMAtlas generates and maintains a `raw/` knowledge layer that maps your entire codebase — module by module. Your AI agent reads these summaries instead of raw source files, saving tokens and delivering answers faster.

```
Before: AI reads 50 source files to answer one question   →  ~50k tokens
After:  AI reads raw/ summaries instead                   →  ~800 tokens
```

---

## Quick Start

```bash
npx @llm-atlas/cli@latest init --force
```

Then paste this into your AI agent:

> Run `raw_list_modules` to find all modules. For each module, call `source_read_module` to read source, then use `raw_save_module` to save a full summary — every section populated with real analysis.

The AI agent reads your source, analyzes it, and writes structured summaries. **No API keys, no env vars, no setup.**

---

## How It Works

LLMAtlas provides an MCP server with tools that let your AI agent read source files and save structured summaries. The agent's own intelligence does the analysis — no external LLM calls, no API keys.

```
Install ──▶ AI agent session starts
                │
           raw_list_modules → find what needs summaries
                │
           source_read_module → read source files
                │
           Agent analyzes and generates summary
                │
           raw_save_module → save to raw/ with validation
                │
           INDEX.md regenerated automatically
```

## MCP Tools

| Tool | Purpose |
|------|---------|
| `raw_list_modules` | List modules with status (fresh/stale/new) |
| `raw_read_module` | Read existing summary from `raw/` |
| `raw_search` | Full-text search across all summaries |
| `source_read_module` | Read source files + pre-detected exports (types, functions, classes) |
| `raw_save_module` | Save summary to `raw/`. Validates required sections. Regenerates INDEX.md. |

## Summary Format

Every module summary follows this template. All sections are required:

```markdown
# Module: <name>

**Purpose:** What this module does and why it exists
**Source:** <relative path>

## Key Files
| Path | Purpose | Key Exports |

## Data Flow
How data moves through the module — inputs, processing, outputs

## Key Types & Interfaces
Important types with their roles and fields

## Error Handling Patterns
How errors are caught, logged, and handled

## Edge Cases & Gotchas
Surprising behavior, race conditions, config quirks
```

## Commands

| Command | What it does |
|---------|-------------|
| `llm-atlas init` | Initialize LLMAtlas (config, skill file, MCP) |
| `llm-atlas init --force` | Re-initialize, cleaning old files |
| `llm-atlas regen` | Check module state (generation is done by AI agent via MCP) |
| `llm-atlas status` | Show which modules are fresh vs stale vs new |
| `llm-atlas mcp` | Start the MCP server for AI tool integration |
| `llm-atlas uninstall` | Remove LLMAtlas completely |

## Platform Support

| Platform | Integration |
|----------|------------|
| **OpenCode** | MCP server + skill file auto-configured in `.opencode/` |
| **Claude Code** | MCP server + `CLAUDE.md` reference. Add to Claude Code MCP config manually. |
| **Cursor / Windsurf** | Read `raw/` folder directly or configure MCP server |
| **Any AI agent** | `raw/` is just markdown — any agent reads it natively |

## Requirements

- **Node.js** ≥ 18
- **An AI agent** (Claude Code, OpenCode, Cursor, etc.)

**No API keys required.** The AI agent you already have does all the work.

## Example

After setup:

```
raw/
├── INDEX.md                       # Module tree with freshness status
├── app.md                         # app/ directory
├── app/
│   ├── dashboard.md               # app/dashboard/
│   └── api/
│       └── integrations.md        # app/api/integrations/
├── lib.md                         # lib/
├── components/
│   └── ui.md                      # components/ui/
└── .meta.json                     # Internal state (freshness tracking)
```

## Session Prompt

When opening a project with LLMAtlas in a new AI agent session, paste this:

> Run `npx @llm-atlas/cli@latest init --force` in this project. Then call `raw_list_modules` to find all modules. For each module, call `source_read_module` to read the source code, then `raw_save_module` to save a full semantic summary. Use the skill file in `.opencode/skills/llm-atlas.md` for the exact format — every section (Purpose, Data Flow, Key Types, Error Handling, Edge Cases) must be populated with real analysis, not just file listings.

## Built For

- **Vibe coders** — no API keys, no config, your AI does the work
- **Teams** — commit `raw/` to git so everyone's AI has shared context
- **OpenCode / Claude Code users** — MCP tools make it seamless

## License

MIT
