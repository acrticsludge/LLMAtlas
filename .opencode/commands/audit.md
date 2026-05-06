---
name: audit
description: Run a full audit suite for the current project state.
---

# Audit Command

Use the `auditor` agent.

## Steps

1. Run `git diff main --name-only` or `git log --oneline -10` to see what changed
2. Select relevant checklists based on changed files
3. If pre-launch or major release, run ALL checklists
4. Output results grouped by checklist, FAIL items first

Always flag Vercel middleware matcher config as a separate check.
