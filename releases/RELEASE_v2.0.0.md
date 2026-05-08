# v2.0.0

## What's Changed

### 🚀 Features

- **Auto-refresh via pre-commit hook** — `llm-atlas init` now installs a git pre-commit hook that auto-detects stale modules (via SHA-256 file hash comparison), regenerates them, and auto-stages the updated summaries. Zero configuration required; works transparently on every commit.
- **File hash staleness detection** — Modules tracked with SHA-256 hash of source files. If source changes, module is marked stale. Eliminates time-based guessing.
- **Manual refresh command** — `llm-atlas refresh` (or `llm-atlas refresh --hook`) detects and regenerates all stale modules on-demand. Useful for testing or explicit updates.
- **MCP function `raw_refresh_stale()`** — AI agents can call to regenerate all stale modules. Enables agent-driven refresh workflows without CLI.
- **Time-based fallback** — Modules > 14 days old considered stale even if hash unchanged (safety net for edge cases).

### 🔧 Improvements

- **Metadata tracking enhanced** — `.raw/.meta.json` now stores `fileHash` (SHA-256 of module source files) and `hashUpdateThreshold` config for each module.
- **Migration on load** — Existing projects automatically migrate: `fileHash` initialized to empty string, `hashUpdateThreshold` defaults to 14 days.
- **Hook installation robust** — Pre-commit hook reads latest template from `cli/hooks/pre-commit.template` at install time. Handles Unix/Windows differences (chmod on Unix only).
- **Error handling non-blocking** — Hook failures (file deletion mid-hash, regeneration errors) log warnings but don't block commits. Next commit retries.

### 📚 Documentation

- **CLI README updated** — New "Auto-Refresh" section explains file hash detection, time-based fallback, hook auto-install, and manual refresh command.
- **Agent skill updated** — `.opencode/skills/llm-atlas.md` documents `raw_refresh_stale()` for AI agents.
- **Design spec preserved** — `docs/superpowers/specs/2026-05-08-auto-refresh-design.md` documents architecture, edge cases, data model changes.
- **Implementation plan preserved** — `docs/superpowers/plans/2026-05-08-auto-refresh-plan.md` documents 13 tasks, code samples, testing steps.

### 🧹 Chores

- Removed GitHub Actions auto-publish workflow (`.github/` deleted). Manual npm publishing going forward.
- Bump 1.1.0 → 2.0.0

## Breaking Changes

None. Auto-refresh is opt-in via `llm-atlas init` and doesn't affect existing workflows.

## Testing

- ✅ Pre-commit hook installs and runs automatically
- ✅ Freshness detection (file hash + time) works correctly
- ✅ Stale modules regenerate and auto-stage
- ✅ MCP function callable by AI agents
- ✅ Metadata persists across sessions
- ✅ Error handling prevents workflow blocking
