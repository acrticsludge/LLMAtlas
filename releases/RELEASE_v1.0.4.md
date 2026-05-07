# v1.0.4

## What's Changed

### 🐛 Fixes

- **MCP tools now surface to AI agents** — Added `tools/list` and `tools/call` standard MCP protocol methods. OpenCode, Claude Code, and other MCP clients can now discover and invoke all 5 tools (`raw_list_modules`, `raw_read_module`, `raw_search`, `source_read_module`, `raw_save_module`).
- **Skill file teaches semantic summaries** — No more shallow file-inventory output. The skill file now includes example content for every section (Purpose, Data Flow, Key Types, Error Handling, Edge Cases) and explicitly instructs the AI to write real analysis.
- **`sections` param fixed** — `raw_read_module` now accepts both comma-separated strings and string arrays from MCP clients.
- **`init --force` cleans up properly** — Old `raw/` and `.raw/` directories are removed before re-initializing. Init state detection checks both directories.
- **JSONC config parsing fixed** — `installOpenCodeMcp` strips comments before parsing `.opencode/mcp.jsonc` instead of using `JSON.parse` directly, which broke on files with comments and silently overwrote the entire config.
- **MCP server info** — `initialize` response now includes `serverInfo` with name and version.

### 🧹 Chores

- Bump 1.0.3 → 1.0.4
