# v0.2.0

## What's Changed

### 🚀 Features
- **Claude Pro users now supported without API keys!** — auto-detects `claude` CLI and uses it to generate summaries
- Auto-detects API keys from `.env` files, OpenCode config, and common env vars
- Credit usage warning shown before first LLM call

### 🐛 Fixes
- `.next/`, `dist/`, `build/` etc now always excluded from `raw/` generation
- OpenCode config detection works with renamed `opencode.old.json`

### 🧹 Chores
- Bump 0.1.9 → 0.2.0
