# v1.1.0

## What's Changed

### 🚀 Features

- **MCP protocol support** — Added `tools/list` and `tools/call` standard MCP methods. All 5 tools are now discoverable by OpenCode, Claude Code, and other MCP clients.
- **INDEX.md auto-regeneration** — `raw_save_module` now regenerates `INDEX.md` after every save so the index is always current.
- **Section validation** — `raw_save_module` rejects incomplete summaries missing required sections (Data Flow, Key Types & Interfaces, Error Handling Patterns, Edge Cases & Gotchas) with a clear error message.
- **Export pre-population** — `source_read_module` now returns pre-detected `exports` (types, functions, classes) extracted from source code, giving the AI a head start on the Key Types section.

### 🐛 Fixes

- **Skill file teaches semantic summaries** — The skill file now includes example content for every section and explicitly tells the AI to write real analysis, not file listings.
- **JSONC config parsing** — `installOpenCodeMcp` strips comments before parsing `.opencode/mcp.jsonc` instead of using `JSON.parse` directly.
- **`raw_read_module` sections param** — Now accepts both comma-separated strings and string arrays.
- **`init --force` cleanup** — Old `raw/` and `.raw/` directories are cleaned before re-initializing.

### 🧹 Chores

- Bump 1.0.4 → 1.1.0
