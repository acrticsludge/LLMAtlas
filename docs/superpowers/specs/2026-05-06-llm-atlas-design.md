# LLMAtlas Design Document

**Date:** 2026-05-06
**Status:** Draft
**Author:** Brainstorming session

---

## 1. Elevator Pitch

LLMAtlas auto-generates and maintains a `raw/` knowledge layer for codebases — structured markdown summaries per module that LLMs read instead of raw source files. It's a CLI + MCP server that runs on the user's machine using their own API key. Zero config, single install command, free OSS (MIT).

**Core constraint:** raw/ files must be *more token-efficient* than the source code they represent (50-100x compression target). If an LLM spends more tokens reading the summary than the source, the tool has failed.

---

## 2. Architecture

### 2.1 Overview

```
┌────────────────────────────────────────────┐
│            @llm-atlas/cli                  │
│                                            │
│  ┌──────────────┐  ┌───────────┐  ┌──────┐ │
│  │ File Scanner │  │LLM Client │  │Writer│ │
│  │ (walk tree,  │──│(user API) │──│(.md) │ │
│  │ .rawignore)  │  │           │  │      │ │
│  └──────────────┘  └───────────┘  └──────┘ │
│                                            │
│  ┌──────────────┐  ┌───────────┐  ┌──────┐ │
│  │ Diff Tracker │  │Git Hooks  │  │ MCP  │ │
│  │ (git merge-  │  │(install/  │  │Server│ │
│  │  base diff)  │  │ uninstall)│  │      │ │
│  └──────────────┘  └───────────┘  └──────┘ │
└────────────────────────────────────────────┘
         │                          │
         ▼                          ▼
  ┌──────────────┐       ┌──────────────────┐
  │   raw/       │       │ OpenCode / Claude │
  │ (.md files)  │──────▶│ Code AI reads    │
  │ checked into │       │ via MCP or skill  │
  │ git          │       │                   │
  └──────────────┘       └──────────────────┘
```

### 2.2 Components

| Component | File | Responsibility |
|-----------|------|----------------|
| File Scanner | `scanner/index.ts` | Walks project tree, respects `.rawignore`, discovers modules |
| Ignore Parser | `scanner/ignore.ts` | Parses `.rawignore` (defaults to `.gitignore` logic) |
| Diff Tracker | `scanner/diff.ts` | Runs `git diff` against merge base, maps changed files → modules |
| LLM Client | `llm/client.ts` | Generic API client for user-configured LLM (OpenAI-compatible) |
| Prompt Engine | `llm/prompts.ts` | Templates for auto-fast, auto-full, and diff-aware regeneration |
| Token Budget | `llm/token-budget.ts` | Token counting, truncation, priority-based section trimming |
| Markdown Writer | `writer/markdown.ts` | Produces structured `.md` files from LLM responses |
| Meta Store | `writer/meta.ts` | Manages `.raw/.meta.json` (file→module mapping, hashes, timestamps) |
| MCP Server | `mcp/server.ts` | MCP tools: `list_modules`, `read_module`, `search`, `regen` |
| Hook Installer | `hooks/post-commit.ts` | Generates and installs post-commit git hook script |
| Platform Templates | `templates/` | Skille files, CLAUDE.md snippets, MCP config snippets |

### 2.3 Module Definition

A "module" is any source directory in the project. The raw/ folder mirrors the project's source tree — every directory that contains meaningful source code gets its own `.md` file. This means:

- `app/dashboard/` → module `app/dashboard` → `raw/app/dashboard.md`
- `lib/api/supabase/` → module `lib/api/supabase` → `raw/lib/api/supabase.md`
- `components/ui/forms/` → module `components/ui/forms` → `raw/components/ui/forms.md`

**Rules for what counts as a "source directory":**
- Must contain at least 2 source files (`.ts`, `.tsx`, `.py`, `.js`, `.jsx`, `.go`, `.rs`) OR 1 file > 50 lines
- Directories with only barrel/index re-exports are skipped (their content rolls up to the parent)
- Directories with only config/data files are skipped
- Directories listed in `.rawignore` are excluded entirely
- Root-level files are grouped under a catch-all `_root` module

The scanner walks the project tree depth-first. For each directory that passes the filter, it creates a corresponding `raw/<relative-path>.md` file (replacing the source path separator with a directory separator under `raw/`).

Users can override module boundaries in `.raw/config.json` under `moduleOverrides`.

---

## 3. `raw/` Folder Structure

### 3.1 Layout

The raw/ folder mirrors the project's source directory tree. Each source directory with code gets a matching `.md` file.

```
raw/
├── INDEX.md                    # Auto-generated table of contents (hierarchical tree)
├── .meta.json                  # Internal state (file→module map, hashes, timestamps)
│
├── _architecture.md            # MANUAL (prefix _) — never auto-overwritten
├── _decisions.md               # MANUAL
│
├── app.md                      # AUTO — from app/ (files directly in app/)
├── app/
│   ├── dashboard.md            # AUTO — from app/dashboard/
│   ├── settings.md             # AUTO — from app/settings/
│   └── api/
│       ├── integrations.md     # AUTO — from app/api/integrations/
│       └── alerts.md           # AUTO — from app/api/alerts/
│
├── lib.md                      # AUTO — from lib/ (files directly in lib/)
├── lib/
│   ├── api.md                  # AUTO — from lib/api/
│   └── utils.md                # AUTO — from lib/utils/
│
├── components.md               # AUTO — from components/
├── components/
│   └── ui.md                   # AUTO — from components/ui/
│
└── worker.md                   # AUTO — from worker/
```

**Key behavior:**
- A directory gets its own raw file AND may have child directories with their own files
- E.g., `app/` → `raw/app.md` + `raw/app/dashboard.md` + `raw/app/settings.md`
- The parent file (`app.md`) summarizes the directory's own files; child files cover subdirectories
- This mirrors how a developer thinks about their project hierarchy

### 3.2 Naming Rules

| Type | Pattern | Example |
|------|---------|---------|
| Auto-generated | `kebab-case.md` | `alert-configs.md` |
| Manual (human) | `_prefix.md` | `_architecture.md` |
| Index | `INDEX.md` (uppercase) | `INDEX.md` |
| Config | `.raw/config.json` | — |
| State | `.raw/.meta.json` | — |

Manual files (`_`) are never modified by the auto-generator. They are included in INDEX.md as "manual entries."

### 3.3 INDEX.md

INDEX.md shows a hierarchical tree of all modules, mirroring the project's structure:

```markdown
# LLMAtlas Index

**Project:** my-nextjs-app
**Generated:** 2026-05-06T14:30:00Z
**Modules:** 12 (10 auto + 2 manual)

## Module Tree

```
📁 app/                          ← app.md (2 files, ✅ Fresh)
  📁 dashboard/                  ← app/dashboard.md (5 files, ✅ Fresh)
  📁 settings/                   ← app/settings.md (3 files, ⚠️ Stale 14d)
  📁 api/
    📁 integrations/             ← app/api/integrations.md (4 files, ✅ Fresh)
📁 lib/                          ← lib.md (1 file, ✅ Fresh)
  📁 api/                        ← lib/api.md (6 files, ✅ Fresh)
📄 _architecture.md              ← Manual
📄 _decisions.md                 ← Manual
```

Each entry links to the corresponding `.md` file and shows staleness status at a glance.
</parameter>


```markdown
# Module: <name>

**Purpose:** <one-line description>
**Source:** `<relative-path>/` (e.g., `app/dashboard/` for a nested module)
**Child modules:** <comma-separated list of subdirectory modules, if any>
**Last regenerated:** <ISO timestamp>
**Status:** ✅ Fresh (<X>h since last commit touching this module)
**Dependencies:** <comma-separated module names>

## Key Files
| Path | Purpose | Key Exports |
|------|---------|-------------|
| ...   |         |             |

## Data Flow
<!-- ASCII or Mermaid diagram showing data flow through this module -->

## Key Types & Interfaces
<!-- Only non-obvious types. Skip standard library / trivial definitions. -->

## Error Handling Patterns
<!-- error.tsx locations, error boundaries, error types -->

## Test Coverage
<!-- Test file locations and what they cover -->

## Edge Cases & Gotchas
<!-- Non-obvious behavioral quirks -->

## Stale Warning
<!-- If >X days since last commit touching this module -->
> ⚠️ This module was last modified <N> days ago. Verify accuracy.
```

### 3.4 Token Budget

- **Default budget per module:** 800 tokens
- **Enforced:** Sections are truncated in priority order (bottom-up) if budget exceeded
- **Priority order (most important → least):** Key Files → Data Flow → Key Types → Error Handling → Edge Cases → Test Coverage → Stale Warning
- **Configurable:** `.raw/config.json` → `tokenBudget`

---

## 4. Generation Tiers

### 4.1 Three Modes

| Mode | Trigger | Model | Depth | Scope | Cost |
|------|---------|-------|-------|-------|------|
| **auto-fast** | Post-commit hook | Cheap (Flash tier) | Diff-aware update | Only changed modules | Low |
| **auto-full** | `llm-atlas gen --full` | Full (Pro tier) | Full regeneration | All modules | High |
| **manual** | User writes `_` files | N/A | Human-curated | User's choice | Zero |

### 4.2 auto-fast (Post-Commit)

1. Runs in background (non-blocking — `&` in shell)
2. Computes: `git diff $(git merge-base HEAD HEAD~1) HEAD --name-only`
3. Maps changed files to modules using `.raw/.meta.json`
4. For each affected module:
   - Reads current `raw/<module>.md`
   - Calls LLM with: previous summary + diff → updated summary
   - Writes updated `raw/<module>.md`
   - Updates `.raw/.meta.json` with new hash and timestamp
5. Skips: binary files, `raw/` files, files in `.rawignore`, files in `.git`
6. Output and errors are logged to `.raw/last-regen.log` for debugging

### 4.3 auto-full (On Demand)

1. Re-scans all modules from scratch
2. Makes one LLM call per module (or batches if token budget allows)
3. Generates full structured output per template
4. Use cases: after large refactor, CI trigger, user request

### 4.4 Manual Files

- Prefix with `_` — never touched by auto-generator
- No stale warning (user controls freshness)
- Included in INDEX.md
- Can reference auto-generated files (e.g., `See [app.md](app.md)`)

---

## 5. Token Efficiency Strategy

### 5.1 Compression Target

| Source Artifact | Raw Size | Target raw/ Size | Compression |
|----------------|----------|-----------------|-------------|
| Single file (~200 lines TS) | ~2,000 tokens | ~200 tokens | 10x |
| Module directory (20 files) | ~50,000 tokens | ~800 tokens | 60x |
| Full project (100+ files) | ~250,000 tokens | ~5,000 tokens | 50x |

### 5.2 Techniques

1. **Tables over prose** — tables are more token-efficient for LLM parsing
2. **Bullet lists over sentences** — no filler words
3. **Skip the obvious** — omit standard imports, trivial getters/setters, known framework patterns
4. **Include the non-obvious** — side effects, error handling, architectural intent, cross-module dependencies
5. **Cross-references** — "see `lib.md` for API client" instead of duplicating
6. **Diffs instead of full regenerations** — auto-fast only generates the delta

### 5.3 Prompt Engineering

The generation prompt enforces compression:

```
You are writing a knowledge summary for another LLM to read.
Your summary MUST be SHORTER than the source code.

RULES:
- Use tables, not paragraphs
- Omit: obvious type definitions, standard library imports, trivial exports
- Include: non-obvious side effects, error handling, cross-module dependencies,
  architectural intent, testing patterns, performance considerations
- If a file is >200 lines but has one interesting export, summarize just that
- Max output: {tokenBudget} tokens
```

---

## 6. Diff-Aware Regeneration

### 6.1 State Tracking (`.raw/.meta.json`)

```json
{
  "version": 1,
  "modules": {
    "app": {
      "files": ["app/page.tsx", "app/layout.tsx"],
      "hash": "a1b2c3d4e5f6...",
      "lastGen": "2026-05-06T14:30:00Z",
      "lastCommit": "2026-05-06T14:28:00Z"
    },
    "app/dashboard": {
      "files": ["app/dashboard/page.tsx", "app/dashboard/layout.tsx"],
      "hash": "b2c3d4e5f6a7...",
      "lastGen": "2026-05-06T14:30:00Z",
      "lastCommit": "2026-05-06T14:28:00Z"
    },
    "app/api/integrations": {
      "files": ["app/api/integrations/route.ts"],
      "hash": "c3d4e5f6a7b8...",
      "lastGen": "2026-05-06T14:30:00Z",
      "lastCommit": "2026-05-06T14:25:00Z"
    },
    "lib": { ... },
    "lib/api": { ... }
  },
  "config": {
    "tokenBudget": 800,
    "stalenessDays": 7
  }
}
```

### 6.2 Diff Computation

```
Changed files = git diff $(git merge-base HEAD HEAD~1) HEAD --name-only
```

For each changed file:
- Find the **deepest matching module** in `.meta.json` by prefix match on the file's directory path
  - E.g., `app/dashboard/page.tsx` → deepest match is `app/dashboard` (not `app`)
  - If no match at any depth, this file belongs to no module → skip
- Skip if file matches `.rawignore` patterns
- Skip if file is within `raw/` itself
- Collect unique affected module names
- If a parent module's directory also changed, both parent and child get regenerated
  - E.g., change to `app/dashboard/page.tsx` triggers regen of `app/dashboard.md`
  - But NOT `app.md` (unless a file directly in `app/` also changed)

### 6.3 Edge Cases

| Scenario | Handling |
|----------|----------|
| New file in new directory | Creates new module entry, auto-fast generates it |
| File deleted | Updates module summary to note removal. If module empty: marks "deprecated" |
| Binary/asset changed | Skipped (detected by extension) |
| raw/ file changed | Skipped (would cause infinite loop) |
| .rawignore changed | Triggers a full re-scan |
| Merge commit | Diff computed against merge base |
| First init (no previous state) | Runs auto-full on all discovered modules |

---

## 7. MCP Server

### 7.1 Tools

| Tool | Input | Output | Description |
|------|-------|--------|-------------|
| `raw_list_modules` | — | `[{name, purpose, status, lastGen}]` | List all modules in raw/ |
| `raw_read_module` | `{moduleName: string, sections?: string[]}` | Markdown content + staleness info | Read a module's knowledge file. Optional section filter for partial reads |
| `raw_search` | `{query: string}` | `[{module, relevance, snippet}]` | Full-text search across all modules |
| `raw_regen` | `{module?: string, full?: boolean}` | `{status: "started" | "done"}` | Regenerate one or all modules. Non-blocking if async |

### 7.2 Modes of Operation

```
# Interactive MCP server (stdio)
llm-atlas mcp

# One-shot command (for git hooks, manual use)
llm-atlas regen --fast
llm-atlas regen --full
llm-atlas status
```

### 7.3 Auto-Installation

**OpenCode:** Adds to `.opencode/mcp.jsonc`
```json
{
  "llm-atlas": {
    "type": "local",
    "command": ["npx", "@llm-atlas/cli", "mcp"],
    "enabled": true
  }
}
```

**Claude Code:** Prompts user to add to `~/.claude/mcp.json`. Command: `llm-atlas install claude-mcp` handles this.

---

## 8. Platform Integration

### 8.1 OpenCode

- **Skill file:** `.opencode/skills/llm-atlas.md` (auto-generated by `init`)
  - Instructs the AI: "Check raw/INDEX.md first. Use MCP tools. Respect staleness."
- **MCP config:** `.opencode/mcp.jsonc` (auto-configured)
- **Custom commands:** `.opencode/commands/atlas-regen.md` (optional, MCP replaces this)

### 8.2 Claude Code

- **CLAUDE.md:** Appended with: "See raw/ for module summaries. MCP tools available."
- **MCP server:** Via `~/.claude/mcp.json` (user approves once via `llm-atlas install claude-mcp`)

### 8.3 Cursor / Windsurf

- `.cursorrules` / `.windsurfrules`: Auto-appended with raw/ reference
- raw/ is just markdown — works natively

### 8.4 Gemini

- `GEMINI.md`: Auto-appended with raw/ reference

---

## 9. Configuration

### 9.1 `.raw/config.json`

```json
{
  "version": 1,
  "tokenBudget": 800,
  "stalenessDays": 7,
  "model": {
    "fast": null,
    "full": null
  },
  "modules": {
    "include": ["*"],
    "exclude": []
  },
  "moduleOverrides": {}
}
```

- `model.fast` / `model.full`: If null, reads from the AI platform's default model. User can override.
- `modules.include`: Glob patterns for which paths are tracked as modules. `"*"` means all source directories at any depth.
- `modules.exclude`: Directories to skip (e.g., `["public", "dist"]`).
- `moduleOverrides`: Map individual files to specific modules.

**Model auto-detection:** When `model.fast` or `model.full` is `null`, the CLI auto-detects the LLM provider:
1. Check `LLMATLAS_API_KEY` and `LLMATLAS_MODEL` env vars
2. Check the AI platform's own config (OpenCode's `opencode.json` or Claude Code's config)
3. Check common env vars: `DEEPSEEK_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`
4. Use sensible defaults if nothing is configured (fallback: OpenAI-compatible at cheap model)

### 9.2 `.rawignore`

Same format as `.gitignore`. Defaults to matching `.gitignore` content at `init` time. Any pattern matched in `.rawignore` causes the scanner to skip that file/directory entirely.

---

## 10. Staleness Detection

### 10.1 Mechanism

- Each `raw/<module>.md` tracks `lastGen` (when it was regenerated) and `lastCommit` (last commit touching that module's files)
- On any read: compare `lastGen` to `lastCommit` and the staleness threshold
- Displayed as a banner at the top of the file:

```
**Status:** ⚠️ Stale (14 days since last commit touching this module)
```

### 10.2 Thresholds

| State | Condition | Color/Icon |
|-------|-----------|------------|
| Fresh | `lastGen > stalenessDays` ago | ✅ |
| Stale | `lastGen < stalenessDays` ago, but files have been touched | ⚠️ |
| Critical | `lastGen > stalenessDays * 3` ago | 🔴 |

### 10.3 What Staleness Means for the AI

The MCP `raw_read_module` returns a `stale` flag. The skill file tells the AI:
- **Fresh:** Trust it as ground truth.
- **Stale:** Verify key claims against source before relying on them.
- **Critical:** Don't use it — read source directly or trigger `raw_regen`.

---

## 11. Install & Onboarding

### 11.1 Single Command

```bash
npx @llm-atlas/cli init
```

### 11.2 What Happens

1. Scans project: detects framework (Next.js, Python, etc.) and source directories
2. Generates `.rawignore` from `.gitignore` (if no `.gitignore` exists, creates an empty `.rawignore` with a comment explaining its purpose)
3. Creates `.raw/config.json` with defaults
4. Scans all modules, generates first batch of raw/ files (auto-full run)
5. Installs post-commit git hook
6. Detects AI config files and installs platform wrappers:
   - `.opencode/skills/llm-atlas.md` (if `.opencode/` exists)
   - `.opencode/mcp.jsonc` update
   - Appends to `CLAUDE.md`, `.cursorrules`, `.windsurfrules`, `GEMINI.md`
7. Prints success message with next steps

### 11.3 Prerequisites

- Node.js ≥ 18
- Git (for git hooks)
- An API key for the LLM (uses the AI platform's existing config — reads from environment)

### 11.4 Post-Install Commands

| Command | Description |
|---------|-------------|
| `llm-atlas regen --fast` | Fast regen of changed modules |
| `llm-atlas regen --full` | Full regen of all modules |
| `llm-atlas status` | Show staleness of all modules |
| `llm-atlas install claude-mcp` | Configure Claude Code MCP |
| `llm-atlas uninstall` | Remove hooks, raw/, config, and platform wrappers |

---

## 12. Repository Structure

```
llm-atlas/
├── cli/                          # @llm-atlas/cli package
│   ├── src/
│   │   ├── index.ts              # CLI entry (commander or simple arg parser)
│   │   ├── commands/             # init, regen, status, install
│   │   ├── scanner/              # Module discovery, ignore, diff
│   │   ├── llm/                  # LLM client, prompts, token budget
│   │   ├── writer/               # Markdown generation, meta.json
│   │   ├── mcp/                  # MCP server
│   │   ├── hooks/                # Git hook templates
│   │   └── templates/            # Platform wrapper templates
│   ├── package.json
│   └── tsconfig.json
├── docs/                         # Design docs, contributing guide
├── examples/                     # Example projects with raw/
├── tests/                        # Integration and unit tests
├── README.md
├── LICENSE                       # MIT
├── CONTRIBUTING.md
└── package.json                  # Monorepo root
```

---

## 13. v1 Scope (What We're Building)

### In Scope

- [x] `@llm-atlas/cli` npm package with all commands
- [x] Full `init` flow (scaffolding, config, hooks, platform wrappers)
- [x] File scanner with `.rawignore` support
- [x] Diff-aware regeneration engine
- [x] LLM client with configurable provider
- [x] Token budgeting and truncation
- [x] MCP server with 4 tools
- [x] Post-commit git hook
- [x] OpenCode skill auto-install
- [x] CLAUDE.md injection (and cross-platform AI configs)
- [x] Staleness detection and warnings
- [x] Manual file support (`_` prefix)
- [x] `llm-atlas uninstall` cleanup

### Out of Scope (v1)

- SaaS backend / cloud service
- Visual UI / graph visualization
- CI/CD integration (GitHub Actions, etc.)
- Team collaboration features
- IDE plugins (VS Code extension)
- Automatic staleness fixing (warning only)
- Third-party LLM provider management (uses user's existing setup)
- Multi-project dashboards

---

## 14. Design Decisions & Rationale

| Decision | Rationale |
|----------|-----------|
| raw/ files committed to git | Enables diff tracking across time, works with PR reviews, no infra needed |
| User's own API key | No backend, privacy-friendly, zero operational cost for the project |
| Background post-commit hook | Non-blocking — commit is immediate, regen happens async |
| MCP over slash commands | Deeper AI integration, tool calls are more powerful than text commands |
| `_` prefix for manual files | Simple, grep-able, forces no special config |
| Token budget with truncation | Prevents bloat, keeps raw/ genuinely more efficient than source |
| `.rawignore` defaults to `.gitignore` | Works out of box for monorepos, no extra config |
| Single npm package | Simple install, easy to reason about, lower maintenance |

---

## 15. Future Considerations (Post-v1)

- **Cloud-backed managed version** — if traction justifies it, offer a hosted tier with shared API keys, team workspaces
- **Visual knowledge graph** — optional visualization of module dependencies
- **CI integration** — GitHub Action that checks raw/ freshness in PRs
- **Auto-fix stale** — background cron that regenerates stale modules without waiting for commits
- **Multiple output formats** — JSON, YAML for programmatic consumption
- **Local model support** — Ollama, llama.cpp for fully offline use

---

## 16. Open Questions (for implementation phase)

1. **LLM provider discovery:** How does the CLI detect which LLM the user has configured? Read env vars? Check Claude Code/OpenCode config?
2. **Token counting:** Use `tiktoken` or a simpler heuristic (character count / 4)?
3. **MCP server project root detection:** How does MCP server know which project to serve? CWD? Config file?
4. **Concurrent module regeneration:** Should auto-fast regenerate modules serially or in parallel?
5. **Error handling:** What happens if an LLM call fails mid-generation? Partial output? Retry?
6. **LLM response validation:** How do we ensure the LLM returns valid structured output? Parse + validate with Zod?

---

*End of design document.*
