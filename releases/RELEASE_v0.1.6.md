# v0.1.6

## What's Changed

### 🐛 Fixes
- `.next/` directory no longer included in `raw/` generation — fixed trailing-slash pattern matching in `ignore` package
- Added `dist`, `build`, `out`, `.cache`, `.vercel`, `.turbo` to always-ignored directories

### 🚀 Features
- Auto-detect AI provider from environment and OpenCode config (no manual `LLMATLAS_API_KEY` needed)
- Anthropic API support restored with proper `/v1/messages` format
- Warning box shown before first LLM call showing which provider/model will be used

### 🧹 Chores
- Bump 0.1.5 → 0.1.6
