# v1.0.0

## What's Changed

### 🚀 Features

- **Zero API key setup required** — MCP tools no longer call external LLMs directly
- **Agent-driven summary generation** — AI agent reads source code via `source_read_module`, generates summaries using its own intelligence, saves via `raw_save_module`
- **New proper skill file** — `.opencode/skills/llm-atlas.md` teaches AI agents the full workflow with warning, format, and step-by-step instructions
- **`init` no longer requires API key** — just sets up config, skill, and MCP; generation delegated to the AI agent
- **User credit warning** — skill file instructs AI to warn before consuming tokens

### 🔧 Changed

| Before | After |
|--------|-------|
| `raw_regen` tool (called external LLM) | `source_read_module` + `raw_save_module` tools (agent-driven) |
| Init ran full generation (needed API key) | Init skips generation, just configures |
| Static skill file | Full workflow skill with tool table, format template, and process |
| 0.2.0 → 1.0.0 | Stable release — no API keys needed |

### 🧹 Chores

- Bump 0.2.0 → 1.0.0
