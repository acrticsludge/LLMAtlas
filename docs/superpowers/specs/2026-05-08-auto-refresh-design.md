# LLMAtlas Auto-Refresh Design

**Date:** 2026-05-08  
**Goal:** Keep `raw/` summaries fresh via pre-commit hook (primary) + MCP function (fallback for AI agents). No manual steps, no GitHub Actions setup required.

---

## Overview

Auto-refresh maintains module freshness through two mechanisms:

1. **Pre-commit hook** — detects source file changes, auto-regenerates stale summaries, auto-stages them
2. **MCP function `raw_refresh_stale`** — AI agent can trigger manual refresh of all stale modules

Both use file hash comparison to detect staleness, with time-based fallback (14 days) as safety net.

---

## Architecture

### Flow

```
Source files change
        ↓
  [pre-commit hook triggered]
        ↓
  Compute file hash of each module's source
        ↓
  Compare to stored fileHash in .raw/.meta.json
        ↓
  Stale modules found?
        ├─ YES → Regenerate summaries → git add .raw/ → proceed
        └─ NO → Let commit proceed
        
[Separately: AI agent calls raw_refresh_stale MCP function]
        ↓
  List all modules
        ↓
  Check freshness (file hash + time-based fallback)
        ↓
  Regenerate stale modules
        ↓
  Return { refreshed: [], skipped: [] }
```

### Freshness Detection: File Hash

Each module in `.raw/.meta.json` tracks:

```json
{
  "modules": {
    "app": {
      "files": ["app/page.tsx", "app/layout.tsx"],
      "fileHash": "abc123def456",          // SHA-256 of all source files concatenated
      "lastGen": "2026-05-08T10:00:00Z",   // ISO timestamp of last generation
      "lastCommit": "2026-05-08T10:00:00Z" // ISO timestamp of last commit that regenerated
    }
  },
  "config": {
    "stalenessDays": 7,        // Time-based staleness threshold
    "hashUpdateThreshold": 14  // Days before hash-based check is overridden (safety net)
  }
}
```

**Staleness logic:**
```
module.stale = 
  (currentFileHash !== module.fileHash)  // File hash changed
  OR
  (now - lastGen > 14 days)              // Time-based fallback (safety net)
```

---

## Pre-commit Hook

### Installation

- Auto-installed during `llm-atlas init`
- Creates `.git/hooks/pre-commit` with executable permissions
- Runs `npx @llm-atlas/cli refresh --hook` (new command)

### Behavior

1. **Load meta state** — read `.raw/.meta.json`
2. **Scan modules** — use existing scanner to find all modules
3. **Detect stale:**
   - For each module, compute SHA-256 hash of all tracked source files
   - Compare to `meta.modules[id].fileHash`
   - If different OR (lastGen > 14 days), mark as stale
4. **Regenerate stale modules:**
   - For each stale module, call internal `regenerateModule(moduleId)`
   - Same logic as AI agent uses via MCP
   - Update `meta.modules[id].fileHash` and `lastGen`
5. **Auto-stage summaries:**
   - `git add .raw/` (stages all regenerated files)
   - Pre-commit continues, commit proceeds with updated summaries included
6. **Error handling:**
   - If regeneration fails on a module: log warning, continue (don't block commit)
   - User sees "⚠️  Failed to refresh module X" but commit is not blocked
   - Next commit's hook retry will attempt again

### Implementation Details

**File hash computation:**
- Collect all source files for a module (from scanner)
- Sort file paths alphabetically (stable ordering)
- Read each file, concatenate contents
- SHA-256 hash of concatenated contents
- Store as hex string in meta.json

**When hook runs:**
- Triggered by git pre-commit event
- Runs synchronously before commit is finalized
- User sees output: "🔄 Refreshing stale modules..." with list of modules refreshed
- If no stale modules, outputs "✅ Modules fresh"

---

## MCP Function: `raw_refresh_stale`

### Signature

```typescript
raw_refresh_stale(): Promise<{
  refreshed: string[];    // Module IDs that were regenerated
  skipped: string[];      // Module IDs that were fresh
  failed?: string[];      // Module IDs that failed (optional)
}>
```

### Behavior

1. **Load meta state** and module list
2. **Detect stale** using same logic as pre-commit (file hash + time-based fallback)
3. **Regenerate stale modules:**
   - Call `regenerateModule(moduleId)` for each stale module
   - Use same analysis logic as pre-commit hook
   - Update meta.json with new hashes and timestamps
   - Save updated summaries to `.raw/`
4. **Return results:**
   - `refreshed`: list of modules regenerated
   - `skipped`: list of modules that were fresh
   - `failed`: (optional) list of modules where regeneration errored

### AI Agent Usage

AI agent calls when:
- User says: "refresh my outdated module summaries"
- Periodic task: "run refresh to keep summaries fresh"
- Before important analysis: "make sure summaries are current"

Example in agent prompt:
> If summaries feel outdated, call `raw_refresh_stale()` to regenerate all stale modules.

---

## Implementation Plan: Phases

### Phase 1: File Hash Tracking
- Update `RawMeta` type to include `fileHash` field
- Implement `computeModuleHash(moduleId)` function
- Update `updateModuleMeta()` to compute and store hash
- Update `loadMeta()` migration to add `fileHash` to existing modules

### Phase 2: Pre-commit Hook
- New command: `llm-atlas refresh --hook`
- Detect stale modules (hash + time comparison)
- Call internal `regenerateModule()` (reuse AI MCP logic)
- Auto-stage updated summaries with `git add`
- Update meta.json with new hashes/timestamps
- Error handling: warn but don't block on failure

### Phase 3: MCP Function
- New MCP tool: `raw_refresh_stale()`
- List all modules, detect stale, regenerate
- Return summary of refreshed/skipped/failed
- Update existing MCP server to expose this function

### Phase 4: Testing & Docs
- Test pre-commit hook with file changes
- Test MCP function with stale detection
- Update CLI README and session prompt
- Document hook auto-install during `init`

---

## Data Model Changes

### `.raw/.meta.json` Structure

```json
{
  "version": 1,
  "modules": {
    "app": {
      "files": ["app/page.tsx", "app/layout.tsx"],
      "fileHash": "abc123...",
      "lastGen": "2026-05-08T10:00:00Z",
      "lastCommit": "2026-05-08T10:00:00Z"
    }
  },
  "config": {
    "tokenBudget": 800,
    "stalenessDays": 7,
    "hashUpdateThreshold": 14
  }
}
```

**Migration:** On load, if `fileHash` missing, compute it from current source files.

---

## Edge Cases & Error Handling

| Scenario | Behavior |
|----------|----------|
| Pre-commit hook fails to regenerate module | Log warning, don't block commit. Retry on next commit. |
| File hash computation fails (file deleted mid-commit) | Skip that module, log warning, continue. |
| AI agent calls MCP function, modules fail to regenerate | Return failed modules in response, agent sees which ones to investigate. |
| `.git/hooks/pre-commit` already exists | During init, prompt user: overwrite or merge? (Or auto-merge if safe.) |
| User manually edits a `.raw/` file | Next hash check detects mismatch, regenerates (overwrites manual edits). Warn user. |
| No source files in module (empty dir) | Hash is empty string, treated as fresh unless time-based staleness kicks in. |
| Untracked files in module directory | Scanner ignores untracked files (normal behavior). Hash reflects tracked files only. |

---

## Success Criteria

- ✅ File hash computed and stored in meta.json
- ✅ Pre-commit hook detects hash changes
- ✅ Stale modules auto-regenerate without user intervention
- ✅ Updated summaries auto-staged (included in commit)
- ✅ MCP function `raw_refresh_stale` callable by AI agents
- ✅ Hook auto-installed during `llm-atlas init`
- ✅ Fallback time-based staleness (14 days) works as safety net
- ✅ Error handling: failures don't block workflow
- ✅ Both paths (hook + MCP) use same regeneration logic (no duplication)

---

## Out of Scope

- GitHub Actions auto-refresh (user chose to avoid CI setup)
- Selective module refresh via CLI (only MCP function allows selective)
- Daemon watcher (pre-commit hook + manual refresh sufficient)
- Compression/optimization of meta.json (not needed yet)
