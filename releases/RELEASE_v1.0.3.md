# v1.0.3

## What's Changed

### 🐛 Fixes

- **MCP tools now surface to AI agents** — Added `tools/list` and `tools/call` standard MCP protocol methods. OpenCode, Claude Code, and other MCP clients can now discover and invoke all 5 tools (`raw_list_modules`, `raw_read_module`, `raw_search`, `source_read_module`, `raw_save_module`).
- **Skill file teaches semantic summaries** — No more shallow file-inventory output. The skill file now includes example content for every section (Purpose, Data Flow, Key Types, Error Handling, Edge Cases) and explicitly instructs the AI to write real analysis.
- **`sections` param fixed** — `raw_read_module` now accepts both comma-separated strings and string arrays from MCP clients.
- **`init --force` cleans up properly** — Old `raw/` and `.raw/` directories are removed before re-initializing. Init state detection checks both directories.
- **MCP server info** — `initialize` response now includes `serverInfo` with name and version.
- **JSONC config parsing fixed** — `installOpenCodeMcp` no longer breaks on `.opencode/mcp.jsonc` files with comments. Strips comments before parsing so existing MCP entries are preserved.

### 🧹 Chores

- Bump 1.0.2 → 1.0.3
