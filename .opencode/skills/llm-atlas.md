# Skill: LLMAtlas Knowledge Layer

This project has a `raw/` folder with structured Markdown summaries of each code module.
As the AI assistant, YOU generate and maintain these summaries using the MCP tools --
no external API key is needed.

## MCP Tools Available

| Tool | What it does |
|------|-------------|
| `raw_list_modules` | List all modules with status (fresh/stale/new) |
| `raw_read_module` | Read an existing summary from `raw/` |
| `raw_search` | Full-text search across all summaries |
| `source_read_module` | Read the actual source files for a module |
| `raw_save_module` | Save a generated summary to `raw/` |

## Before Generating Summaries

Warn the user first: "I will analyze your source code and generate structured module summaries. This consumes AI tokens (roughly X tokens per module). Continue?"

Only proceed after the user confirms. If the project has many modules (>10), mention the estimate and ask again.

## Summary Format (follow exactly)

When generating a summary, use this Markdown template:

```markdown
# Module: <module-name>

**Purpose:** <one-line description of what this module does>
**Source:** <relative path from project root>

## Key Files
| Path | Purpose | Key Exports |
|------|---------|-------------|
| src/file.ts | Handles X | Y, Z |

## Data Flow
<how data moves through this module -- inputs, processing, outputs>

## Key Types & Interfaces
<important types, interfaces, and their roles>

## Error Handling Patterns
<how errors are caught, logged, and handled>

## Edge Cases & Gotchas
<surprising behavior, edge cases, configuration quirks>
```

Keep summaries dense -- aim for ~800 tokens or less. Focus on what another developer (or AI) needs to understand the module quickly.

## Workflow for Generating All Module Summaries

1. Call `raw_list_modules` to see current state
2. For each module that is "new" or "stale":
   a. Call `source_read_module` with the module name to get source code
   b. Analyze the source and generate a summary in the format above
   c. Call `raw_save_module` with the module name and generated content
3. After all modules are done, tell the user summaries are ready at `raw/INDEX.md`

For "fresh" modules, skip generation -- they don't need updating yet.
