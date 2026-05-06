# LLMAtlas 🗺️

**Pre-digested codebase context for LLMs. No more feeding your AI raw source files every session.**

LLMAtlas auto-generates and maintains a `raw/` knowledge layer that maps your entire codebase — module by module, file by file. Your AI tools (Claude Code, OpenCode, Cursor, any LLM) read these summaries instead of raw source, saving tokens and delivering better answers faster.

```
Before: AI reads 50 source files to answer one question   →  ~50k tokens
After:  AI reads raw/ summaries instead                   →  ~800 tokens
```

## One command

```bash
npx @llm-atlas/cli init
```

That's it. It scans your project, generates the knowledge layer, installs auto-updates on every commit.

## How it works

```
Every commit ──▶ post-commit hook scans git diff
                      │
                only changed modules
                      │
                LLM updates their raw/ summaries
                      │
                AI reads raw/ instead of source
```

| Component | What it does |
|-----------|-------------|
| **Scanner** | Walks your project tree, respects `.rawignore`, discovers modules at any depth |
| **LLM Client** | Sends source to your configured LLM (your key, your model) — OpenAI, DeepSeek, etc. |
| **Writer** | Produces dense markdown in `raw/`, mirroring your source structure |
| **MCP Server** | Exposes 4 tools (list, read, search, regen) for Claude Code / OpenCode integration |
| **Post-commit hook** | Auto-regenerates only changed modules — non-blocking, runs in background |

## The core principle

> raw/ files must be MORE token-efficient than the source code they represent.
> If an LLM spends more tokens reading the summary than the source, the tool has failed.

## Commands

| Command | What it does |
|---------|-------------|
| `llm-atlas init` | Initialize LLMAtlas in the current project |
| `llm-atlas regen` | Fast regen — only changed modules |
| `llm-atlas regen --full` | Full regen — all modules from scratch |
| `llm-atlas status` | Show which modules are fresh vs stale |
| `llm-atlas uninstall` | Remove LLMAtlas completely |

## Platform support

| Platform | Integration | Auto-installed? |
|----------|------------|-----------------|
| **OpenCode** | MCP server + skill file in `.opencode/` | ✅ Yes |
| **Claude Code** | MCP server (manual install) + CLAUDE.md | 🤖 You run `llm-atlas install claude-mcp` |
| **Cursor / Windsurf** | `.cursorrules` / `.windsurfrules` appended | ✅ Yes |
| **Any LLM** | raw/ is just markdown — any AI reads it natively | ✅ Yes |

## Requirements

- **Node.js** ≥ 18
- **Git** (for auto-regeneration on commit)
- **API key** from an LLM provider (set `LLMATLAS_API_KEY`)

## Example

After running `llm-atlas init` on a Next.js project:

```
raw/
├── INDEX.md                       # Full module tree with staleness
├── app.md                         # app/ directory
├── app/
│   ├── dashboard.md               # app/dashboard/
│   └── api/
│       └── integrations.md        # app/api/integrations/
├── lib.md                         # lib/
├── components/
│   └── ui.md                      # components/ui/
└── .meta.json                     # Internal state
```

Each file is a dense, structured summary — tables, not paragraphs. Designed for LLM consumption, not human reading.

## Built for

- **Vibe coders** — stop re-explaining your codebase to your AI every session
- **Teams** — commit raw/ to git so everyone's AI has shared context
- **OpenCode / Claude Code users** — MCP integration makes it seamless

## License

MIT
