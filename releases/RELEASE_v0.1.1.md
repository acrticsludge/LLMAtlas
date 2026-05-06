# Title: v0.1.1

---

## What's Changed

### 🚀 Features
- Initial release of `@llm-atlas/cli` — auto-generate a `raw/` knowledge layer for LLMs
- `llm-atlas init` — one-command project setup with `.rawignore`, git hooks, OpenCode integration
- `llm-atlas regen` — diff-aware fast regeneration, `--full` for deep regen
- `llm-atlas status` — shows module staleness at a glance
- `llm-atlas uninstall` — clean removal of all files
- MCP server with 4 tools: `raw_list_modules`, `raw_read_module`, `raw_search`, `raw_regen`
- Token-efficient markdown summaries — 50-100x compression vs reading source
- Nested module structure mirrors your project tree
- OpenCode MCP auto-configuration on init

### 🐛 Fixes
- Path traversal vulnerability in MCP server
- CLAUDE.md section removal now finds proper heading boundaries
- Removed broken Anthropic API support (OpenAI-compatible only)
- Windows npm release script quoting fix
- npm publish auth fix (now uses `npm config set`)

### 🧹 Chores
- 34 unit + integration tests
- MIT license
