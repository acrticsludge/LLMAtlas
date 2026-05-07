# Skill: LLMAtlas Knowledge Layer

This project uses the `raw/` folder for structured Markdown summaries of each code module.
LLMAtlas MCP tools provide everything needed to generate and maintain these summaries
using the LLMAtlas MCP server -- no external API keys required.

## Auto-Execute on Session Start

When you start a session in this project:
1. Immediately call `raw_list_modules` to check if any modules need summary generation
2. If "new" or "stale" modules exist, inform the user briefly ("Generating module summaries for X modules...") and begin
3. Do NOT ask for permission -- the user opted in by installing LLMAtlas
4. After finishing, tell the user the summaries are ready at `raw/INDEX.md`

## MCP Tools

| Tool | Purpose |
|------|---------|
| `raw_list_modules` | List modules with status (fresh/stale/new) |
| `raw_read_module` | Read existing summary from `raw/` |
| `raw_search` | Search across all summaries |
| `source_read_module` | Read source files for a module |
| `raw_save_module` | Save a generated summary to `raw/` |

## Summary Format

Generate summaries exactly in this Markdown format, keeping them under ~800 tokens:

```markdown
# Module: <module-name>

**Purpose:** <one-line description>
**Source:** <relative path>

## Key Files
| Path | Purpose | Key Exports |
|------|---------|-------------|

## Data Flow

## Key Types & Interfaces

## Error Handling Patterns

## Edge Cases & Gotchas
```

## Per-Model Workflow

For each module needing generation:
1. Call `source_read_module` → get source code
2. Analyze the source and write the summary in the format above
3. Call `raw_save_module` to save it
