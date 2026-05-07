# MCP Zero-API-Key Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all API key requirements from the MCP server so users can install and use the tool without configuring credentials.

**Architecture:** Replace the `raw_regen` MCP tool (which called external LLM APIs) with two new tools: `source_read_module` (reads source files) and `raw_save_module` (saves AI-generated summaries). The AI agent generates summaries using its own capabilities. The `init` command no longer runs LLM generation. A rewritten skill file teaches the AI agent the workflow.

**Tech Stack:** Node.js, TypeScript, MCP (stdin/stdout JSON-RPC), Commander CLI

---

### Task 1: Update MCP server — remove `raw_regen`, add `source_read_module` + `raw_save_module`

**Files:**
- Modify: `cli/src/mcp/server.ts`

**Overview:**
The MCP server currently has a `raw_regen` tool that imports `runGeneration` from `engine/index.js`, which calls `detectLlmConfig` and requires an API key. Replace it with two tools that need zero API keys:
- `source_read_module` — reads source files for a module from disk
- `raw_save_module` — saves generated summary to `raw/<module>.md` + updates meta

- [ ] **Step 1: Remove the `raw_regen` case block**

Remove lines 191-205 (the entire `case 'raw_regen'` block) from `cli/src/mcp/server.ts`:

```typescript
// DELETE this entire block (lines 191-205):
    case 'raw_regen': {
      const { module: _moduleName, full } = params as { module?: string; full?: boolean };
      const { runGeneration } = await import('../engine/index.js');

      const report = await runGeneration(projectRoot, {
        mode: full ? 'full' : 'fast',
      });

      return {
        status: 'completed',
        generated: report.generated,
        errors: report.errors.length > 0 ? report.errors.map((e) => `${e.moduleId}: ${e.error}`) : [],
        tokenUsage: report.tokenUsage.total,
      };
    }
```

- [ ] **Step 2: Add `source_read_module` tool handler**

Add this BEFORE the `case 'initialize'` block (after `raw_search`):

```typescript
    case 'source_read_module': {
      const { moduleName } = params as { moduleName: string };
      if (!moduleName || typeof moduleName !== 'string') {
        throw new Error('moduleName is required');
      }

      // Scan project to find the module
      const scan = await scanProject(projectRoot);
      const mod = scan.modules.find((m) => m.id === moduleName);
      if (!mod) {
        throw new Error(`Module "${moduleName}" not found in project`);
      }

      // Read all source files
      const { readFile } = await import('node:fs/promises');
      const { join } = await import('node:path');

      const files: Array<{ path: string; content: string }> = [];
      let totalChars = 0;

      for (const file of mod.files) {
        const fullPath = join(projectRoot, file.relativePath);
        let content: string;
        try {
          content = await readFile(fullPath, 'utf-8');
        } catch {
          continue; // skip files that can't be read
        }
        files.push({ path: file.relativePath, content });
        totalChars += content.length;
      }

      return {
        module: mod.id,
        relativePath: mod.relativePath,
        fileCount: mod.files.length,
        files,
        totalChars,
      };
    }
```

- [ ] **Step 3: Add `raw_save_module` tool handler**

Add after the `source_read_module` case:

```typescript
    case 'raw_save_module': {
      const { moduleName, content } = params as { moduleName: string; content: string };
      if (!moduleName || typeof moduleName !== 'string') {
        throw new Error('moduleName is required');
      }
      if (!content || typeof content !== 'string') {
        throw new Error('content is required');
      }

      // Validate module exists in project
      const scan = await scanProject(projectRoot);
      const mod = scan.modules.find((m) => m.id === moduleName);
      if (!mod) {
        throw new Error(`Module "${moduleName}" not found in project`);
      }

      // Write the summary file
      const { writeFile, mkdir } = await import('node:fs/promises');
      const { join, dirname } = await import('node:path');

      const rawPath = join(projectRoot, 'raw', moduleName + '.md');
      await mkdir(dirname(rawPath), { recursive: true });
      await writeFile(rawPath, content, 'utf-8');

      // Update meta state
      const meta = await loadMeta(projectRoot);
      updateModuleMeta(meta, moduleName, mod.files.map((f) => f.relativePath), moduleName);
      await saveMeta(projectRoot, meta);

      return {
        status: 'saved',
        path: `raw/${moduleName}.md`,
      };
    }
```

- [ ] **Step 4: Add imports for new dependencies**

Update the imports at the top of `cli/src/mcp/server.ts` — add `saveMeta` and `updateModuleMeta`:

```typescript
import { loadMeta, saveMeta, updateModuleMeta } from '../writer/meta.js';
import { scanProject } from '../scanner/index.js';
```

(Remove any imports that were only used by `raw_regen` — there shouldn't be any since `runGeneration` was dynamically imported.)

- [ ] **Step 5: Verify the final file has no references to `runGeneration` or LLM code**

The `startMcpServer` function and all tool handlers should use only:
- `loadMeta`, `saveMeta`, `updateModuleMeta` from `../writer/meta.js`
- `scanProject` from `../scanner/index.js`
- Node.js built-ins: `node:readline`, `node:fs/promises`, `node:path`, `node:fs`

No imports from `../llm/client.js` or `../engine/index.js`.

- [ ] **Step 6: Build and check for TypeScript errors**

Run: `cd cli && npx tsc --noEmit`
Expected: No errors

---

### Task 2: Update `init.ts` — remove full generation, rewrite skill, update messaging

**Files:**
- Modify: `cli/src/commands/init.ts`

**Overview:**
The `init` command currently runs full LLM generation after scanning the project. Remove that step. Rewrite the `installOpenCodeSkill` function with the new skill content that teaches the AI agent the generation workflow. Update the final "Next steps" message.

- [ ] **Step 1: Remove the `runGeneration` call and related LLM-dependent code**

In `cli/src/commands/init.ts`, remove lines 72-82 (the full generation block):

```typescript
// DELETE this entire block (lines 72-82):
  // Generate raw/ files (first full generation)
  console.log('  Generating knowledge layer...');
  const report = await runGeneration(projectRoot, { mode: 'full' });
  console.log(`  ✓ Generated ${report.generated.length} module files`);

  if (report.errors.length > 0) {
    console.log(`  ⚠ ${report.errors.length} modules had errors`);
    for (const err of report.errors) {
      console.log(`     Error: ${err.moduleId}: ${err.error}`);
    }
  }
```

Also remove the unused `runGeneration` import at the top of the file (line 6):

```typescript
// DELETE this line:
import { runGeneration } from '../engine/index.js';
```

And remove the `report` variable usage — after removing the generation block, the `scanProject` result should still be shown (the module count display is fine to keep).

- [ ] **Step 2: Rewrite the `installOpenCodeSkill` function with new skill content**

Replace the entire `installOpenCodeSkill` function body (lines 140-162):

```typescript
export async function installOpenCodeSkill(projectRoot: string): Promise<void> {
  const skillDir = join(projectRoot, '.opencode', 'skills');
  await mkdir(skillDir, { recursive: true });

  const skillContent = `# Skill: LLMAtlas Knowledge Layer

This project has a \`raw/\` folder with structured Markdown summaries of each code module.
As the AI assistant, YOU generate and maintain these summaries using the MCP tools —
no external API key is needed.

## MCP Tools Available

| Tool | What it does |
|------|-------------|
| \`raw_list_modules\` | List all modules with status (fresh/stale/new) |
| \`raw_read_module\` | Read an existing summary from \`raw/\` |
| \`raw_search\` | Full-text search across all summaries |
| \`source_read_module\` | Read the actual source files for a module |
| \`raw_save_module\` | Save a generated summary to \`raw/\` |

## Before Generating Summaries

⚠️ **Warn the user first:** "I will analyze your source code and generate structured module summaries. This consumes AI tokens (roughly X tokens per module). Continue?"

Only proceed after the user confirms. If the project has many modules (>10), mention the estimate and ask again.

## Summary Format (follow exactly)

When generating a summary, use this Markdown template:

\`\`\`markdown
# Module: <module-name>

**Purpose:** <one-line description of what this module does>
**Source:** <relative path from project root>

## Key Files
| Path | Purpose | Key Exports |
|------|---------|-------------|
| src/file.ts | Handles X | Y, Z |

## Data Flow
<how data moves through this module — inputs, processing, outputs>

## Key Types & Interfaces
<important types, interfaces, and their roles>

## Error Handling Patterns
<how errors are caught, logged, and handled>

## Edge Cases & Gotchas
<surprising behavior, edge cases, configuration quirks>
\`\`\`

**Keep summaries dense** — aim for ~800 tokens or less. Focus on what another developer (or AI) needs to understand the module quickly.

## Workflow for Generating All Module Summaries

1. Call \`raw_list_modules\` to see current state
2. For each module that is "new" or "stale":
   a. Call \`source_read_module\` with the module name to get source code
   b. Analyze the source and generate a summary in the format above
   c. Call \`raw_save_module\` with the module name and generated content
3. After all modules are done, tell the user summaries are ready at \`raw/INDEX.md\`

For "fresh" modules, skip generation — they don't need updating yet.
`;

  await writeFile(join(skillDir, 'llm-atlas.md'), skillContent, 'utf-8');
}
```

- [ ] **Step 3: Update the final "Next steps" message**

Replace lines 100-108 (the Next steps section):

```typescript
  console.log('');
  console.log('  ──────────────────────────────────────────────');
  console.log('  Next steps:');
  console.log('  1. Open this project with your AI agent (Claude Code, OpenCode, etc.)');
  console.log('  2. The AI agent will automatically detect the LLMAtlas skill');
  console.log('  3. Ask your agent: "Generate module summaries"');
  console.log('  4. The agent will read your source code and write summaries using MCP tools');
  console.log('  5. No API keys needed — your agent does all the work');
  console.log('  ──────────────────────────────────────────────\n');
```

Also remove the old lines that referenced `raw/INDEX.md`, `.rawignore`, `llm-atlas regen`, and `claude-mcp` since the MCP tools are now auto-configured.

- [ ] **Step 4: Verify no API key references remain**

The `initCommand` function should no longer import or call:
- `runGeneration`
- `detectLlmConfig`
- Any LLM-related functions

Clean up the imports at the top of the file if any are now unused.

- [ ] **Step 5: Build and check for errors**

Run: `cd cli && npx tsc --noEmit`
Expected: No errors

---

### Task 3: Verify CLI commands still work

**Files:**
- Check: `cli/src/index.ts`
- Check: `cli/src/commands/regen.ts`
- Check: `cli/src/commands/install.ts`

**Overview:**
The CLI commands (`llm-atlas regen`, `llm-atlas install`) should still work. The `regen` command will still call `runGeneration` which requires an API key if used from CLI — that's fine for users who DO have API keys. The key change is that the MCP path (which is what AI agents use) no longer needs keys.

- [ ] **Step 1: Verify `cli/src/index.ts` doesn't import LLM code unnecessarily**

The `mcp` command at line 78-89 dynamically imports `./mcp/server.js` — this should NOT import any LLM client code. Verify that `cli/src/index.ts` doesn't have any imports from `./llm/client.js`.

- [ ] **Step 2: Verify `regenCommand` still works for CLI users with API keys**

The `cli/src/commands/regen.ts` file calls `runGeneration` — this is fine. Users who run `llm-atlas regen` from their terminal (not via MCP) can still set up an API key and use it.

- [ ] **Step 3: Build and verify**

Run: `cd cli && npx tsc --noEmit`
Expected: No errors

Run: `cd cli && npx vitest run`
Expected: All tests pass (no MCP tests were affected)

---

### Task 4: Update the existing skill file in `.opencode/skills/`

**Files:**
- Modify: `.opencode/skills/llm-atlas.md`

**Overview:**
The existing skill file in the project's `.opencode/skills/` directory should match what `llm-atlas init` generates. Update it to match the new skill content from Task 2.

- [ ] **Step 1: Overwrite `.opencode/skills/llm-atlas.md` with the full new content**

Write the exact same skill content from Task 2 Step 2 into `.opencode/skills/llm-atlas.md`.

- [ ] **Step 2: Verify formatting**

Check that the file renders correctly — the table, code blocks, and instructions should be clean.

---

### Task 5: Full integration verification

- [ ] **Step 1: Full TypeScript check**

Run: `cd cli && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Run all tests**

Run: `cd cli && npx vitest run`
Expected: All tests pass

- [ ] **Step 3: Build the CLI**

Run: `cd cli && npm run build`
Expected: Build succeeds, `dist/` is populated

- [ ] **Step 4: Verify no stale imports**

Search for any remaining references to `detectLlmConfig`, `chatComplete`, or `runGeneration` in `cli/src/mcp/server.ts` — there should be none.
