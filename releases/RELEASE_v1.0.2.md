# v1.0.2

## What's Changed

### 🔥 Breaking

- **Removed all LLM/API key code** — `src/llm/` and `src/engine/` directories deleted. No more `detectLlmConfig`, no Claude CLI detection, no API key prompts.
- **`regen` command is now a no-op** — prints module state and tells user to use AI agent. `--full` flag removed.
- **`llm-atlas init` no longer generates anything** — just sets up config, skill, and MCP.

### 🚀 Features

- **Zero API keys anywhere** — MCP `source_read_module` + `raw_save_module` are the only paths. No external LLM calls.
- **Skill auto-executes on session start** — AI agent checks modules and generates summaries without asking permission.

### 🧹 Chores

- Bump 1.0.1 → 1.0.2
