# v0.1.3

## What's Changed

### 🐛 Fixes
- Fixed npm publish workflow — now matches proven GitHub Actions pattern
- Removed `working-directory: cli` from publish workflow (caused auth issues)
- `setup-node`'s `.npmrc` is now properly discovered by `npm publish`

### 🧹 Chores
- `release.mjs` script for cross-platform version bumping
- GitHub release template at `.github/RELEASE_TEMPLATE.md`
- Release notes moved to `releases/` folder
