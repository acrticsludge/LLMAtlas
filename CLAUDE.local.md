# CLAUDE.local.md — LLMAtlas Release Workflow

Project-specific instructions for LLMAtlas development. Override global CLAUDE.md where conflict. Apply automatically unless user explicitly says "skip workflow" or "don't follow this".

---

## Release Workflow (Automatic After Every Update)

After ANY substantive code change (feature, fix, improvement, docs):

### 1. Commit Changes

```bash
git add <files>
git commit -m "area: description"
```

**Format:** `feat:`, `fix:`, `docs:`, `chore:`, `refactor:` prefix. Present tense, imperative mood.

Examples:
- `feat: add auto-refresh via pre-commit hook`
- `docs: improve raw/ generation prompts`
- `chore: bump version to 2.1.0`

### 2. Determine Version Bump

Assess scope:
- **PATCH** (2.0.x) — docs, small fixes, prompt improvements, internal refactors
- **MINOR** (2.x.0) — new features, significant behavior changes, new tools
- **MAJOR** (x.0.0) — breaking changes (rare)

### 3. Update Version Everywhere

```bash
# Update package version
cd cli && npm version patch|minor|major

# Manually update src/index.ts:
.version('X.Y.Z')
```

This auto-creates git tag. Commit any manual changes.

### 4. Create Release Notes

Save to `releases/RELEASE_vX.Y.Z.md`:

```markdown
# vX.Y.Z

## What's Changed

### 🚀 Features
- Item

### 🔧 Improvements
- Item

### 📚 Documentation
- Item

### 🧹 Chores
- Item

## Breaking Changes
None (if applicable).

## Testing
- ✅ Item verified
```

Commit: `git commit -m "docs: release notes for vX.Y.Z"`

### 5. Push & Tag

```bash
git push origin main --follow-tags
```

(Tag already created by npm version)

### 6. Create GitHub Release (Manual)

Go to https://github.com/acrticsludge/LLMAtlas/releases

- Click "Draft a new release"
- Select tag (e.g. vX.Y.Z)
- Paste release notes from `releases/RELEASE_vX.Y.Z.md`
- Click "Publish release"

GitHub Actions auto-publishes to npm on `release: [published]` event.

---

## When to Skip

If user says ANY of:
- "skip workflow"
- "don't follow this"
- "ignore release steps"
- "just commit, don't tag"

Then: Do NOT automatically bump version, create release notes, or push tags. Wait for explicit instruction.

---

## Quick Reference

| Task | Command |
|------|---------|
| Commit | `git commit -m "area: description"` |
| Bump + Tag | `npm version patch` (in cli/) |
| Release Notes | Create `releases/RELEASE_vX.Y.Z.md` |
| Push | `git push origin main --follow-tags` |
| Publish | GitHub UI: Draft → Publish release |

---

## Example Workflow

```
1. Edit files
2. git add <files> && git commit -m "feat: new thing"
3. npm version minor (in cli/)
4. Create releases/RELEASE_v2.2.0.md
5. git commit -m "docs: release notes for v2.2.0"
6. git push origin main --follow-tags
7. GitHub UI: publish release → npm auto-publishes
```

Done. Next feature or fix, repeat from step 1.
