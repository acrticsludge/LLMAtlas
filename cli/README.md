# LLMAtlas — Knowledge Layer for LLMs

Auto-generate and maintain a structured `raw/` knowledge layer for your codebase. LLMs (Claude, GPT, DeepSeek, etc.) read these summaries instead of raw source files — saving tokens and providing better context.

## Core Principle

> raw/ files must be MORE token-efficient than the source code they represent.

## Quick Start

```bash
npx @llm-atlas/cli init
```

This single command:
- Scans your project and discovers modules
- Generates `raw/` with structured markdown summaries
- Sets up `.rawignore` (defaults to `.gitignore`)
- Installs a post-commit git hook for auto-regeneration
- Configures OpenCode MCP and skill files

## Commands

| Command | Description |
|---------|-------------|
| `llm-atlas init` | Initialize LLMAtlas in the current project |
| `llm-atlas regen` | Fast regeneration (changed modules only) |
| `llm-atlas regen --full` | Full regeneration of all modules |
| `llm-atlas status` | Show module staleness |
| `llm-atlas install hooks` | Install git hooks |
| `llm-atlas install claude-mcp` | Show Claude Code MCP setup |
| `llm-atlas uninstall` | Remove all LLMAtlas files |

## How It Works

1. **Scanner** walks your project tree, respecting `.rawignore`, and discovers source modules
2. **LLM Client** sends source code to your configured LLM (uses your API key)
3. **Writer** produces dense markdown summaries in `raw/`, mirroring your source structure
4. **Post-commit hook** automatically regenerates only changed modules

The `raw/` folder is committed to git, so your entire team (and their AI tools) benefit from the knowledge layer.

## Configuration

Edit `.rawignore` to exclude files from knowledge generation (defaults to your `.gitignore`).

Edit `.raw/config.json`:
- `tokenBudget` — max tokens per module summary (default: 800)
- `stalenessDays` — days before a module is marked stale (default: 7)

## AI Platform Integration

**OpenCode:** Automatically configured by `init`. Adds MCP server and skill file.

**Claude Code:** Run `llm-atlas install claude-mcp` for setup instructions.

**Cursor / Windsurf:** LLMAtlas appends to `.cursorrules` and `.windsurfrules` automatically.

## Releasing

```bash
# Bump version, tag, and push (GitHub Action auto-publishes to npm)
npm run release patch    # 0.1.0 → 0.1.1
npm run release minor    # 0.1.0 → 0.2.0
npm run release major    # 0.1.0 → 1.0.0
```

The release script:
1. Bumps version in `package.json`
2. Commits with `chore: release v<version>`
3. Creates git tag `v<version>`
4. Pushes commit + tags to origin

When a `v*` tag is pushed, the GitHub Action (`.github/workflows/publish.yml`):
- Runs tests on the tag
- Builds the package
- Publishes to npm (`@llm-atlas/cli`)
- Creates a GitHub Release with auto-generated notes

**Required GitHub secrets:**
- `NPM_TOKEN` — npm automation token with publish permissions

**Required setup:**
1. Create the `@llm-atlas` org on npm: `npm org create @llm-atlas`
2. Generate an npm automation token and add it as `NPM_TOKEN` in GitHub repo secrets
3. Update the `repository` URL in `package.json` to match your GitHub repo

## Requirements

- Node.js ≥ 18
- Git
- API key for an LLM provider (DeepSeek, OpenAI)

Set your API key: `export LLMATLAS_API_KEY=sk-...`

## License

MIT
