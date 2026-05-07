# v1.0.1

## What's Changed

### 🐛 Fixes

- **Skill file now auto-executes** — AI agent no longer asks permission; it detects stale modules on session start and generates summaries immediately
- **Init creates raw/INDEX.md** — placeholder so tools and tests work from first run
- **E2E test no longer hangs** — fixed Claude CLI detection timeout in test environments
- **Release script runs tests** — `npm test` gate added before commit/tag in release.mjs

### 🧹 Chores

- Bump 1.0.0 → 1.0.1
