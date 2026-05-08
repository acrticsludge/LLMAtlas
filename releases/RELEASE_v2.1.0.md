# v2.1.0

## What's Changed

### 🎯 Improvements

- **Better raw/ module generation prompts** — Data Flow section now demands specific function/API route/database table references instead of generic "fetches from Supabase". Error Handling Patterns section now requires actual try/catch scopes and error types, not UI behavior descriptions.
- **Anti-hedging guidelines** — Prompts now explicitly warn against uncertain language ("Likely", "Maybe", "Probably"). All assertions must be verified or omitted.
- **Denser module analysis** — Quality guidelines enforce populated sections with semantic depth, not file-inventory-only summaries.

## Testing

- ✅ Build succeeds with updated version
- ✅ Skill prompts improved for higher-quality raw/ generation
- ✅ Version bumped across CLI and package.json

## Breaking Changes

None. Quality improvements are backward-compatible.
