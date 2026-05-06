# LLMAtlas

Auto-generate and maintain a structured `raw/` knowledge layer for your codebase so LLMs always have fresh, pre-digested context — without re-reading source files every session.

## Quick Start

```bash
npx @llm-atlas/cli init
```

One command: scans your project, generates `raw/` with module summaries, installs a post-commit hook for auto-regeneration.

## Packages

| Package | Description |
|---------|-------------|
| [`@llm-atlas/cli`](./cli) | CLI tool + MCP server — the core engine |

## Documentation

- [Design Spec](./docs/superpowers/specs/2026-05-06-llm-atlas-design.md)
- [Implementation Plan](./docs/superpowers/plans/2026-05-06-llm-atlas-implementation.md)

## Development

```bash
cd cli
npm install
npm test        # 34 tests
npm run build   # TypeScript compile
```

## License

MIT
