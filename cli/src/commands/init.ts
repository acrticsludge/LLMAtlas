import { writeFile, mkdir, readFile, appendFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { execSync } from 'node:child_process';
import { scanProject } from '../scanner/index.js';

export async function initCommand(projectRoot: string, options: { force?: boolean }): Promise<void> {
  console.log('\n  ╔════════════════════════════════════════════╗');
  console.log('  ║        LLMAtlas — Knowledge Layer          ║');
  console.log('  ╚════════════════════════════════════════════╝\n');

  const rawDir = join(projectRoot, 'raw');
  const configDir = join(projectRoot, '.raw');
  const alreadyInitted = existsSync(rawDir) || existsSync(configDir);

  if (alreadyInitted && !options.force) {
    console.log('  ✓ LLMAtlas already initialized in this project.');
    console.log('  • Ask your AI agent to generate/update module summaries');
    console.log('  • Run `llm-atlas init --force` to reinitialize\n');
    return;
  }

  // Clean up old files when forcing re-init
  if (options.force) {
    const { rm } = await import('node:fs/promises');
    if (existsSync(rawDir)) {
      await rm(rawDir, { recursive: true, force: true });
    }
    if (existsSync(configDir)) {
      await rm(configDir, { recursive: true, force: true });
    }
    console.log('  ✓ Cleaned up previous initialization');
  }

  // Create .rawignore from .gitignore if it doesn't exist
  const rawignorePath = join(projectRoot, '.rawignore');
  if (!existsSync(rawignorePath)) {
    let ignoreContent = '# LLMAtlas .rawignore\n';
    ignoreContent += '# Defaults from .gitignore. Add patterns to exclude from raw/ generation.\n\n';

    const gitignorePath = join(projectRoot, '.gitignore');
    if (existsSync(gitignorePath)) {
      const gitignoreContent = await readFile(gitignorePath, 'utf-8');
      ignoreContent += gitignoreContent;
    }

    await writeFile(rawignorePath, ignoreContent, 'utf-8');
    console.log('  ✓ Created .rawignore');
  } else {
    console.log('  ✓ .rawignore already exists');
  }

  // Create .raw/config.json
  await mkdir(configDir, { recursive: true });

  const configPath = join(configDir, 'config.json');
  if (!existsSync(configPath) || options.force) {
    const config = {
      version: 1,
      tokenBudget: 800,
      stalenessDays: 7,
      modules: { include: ['*'], exclude: [] },
      moduleOverrides: {},
    };
    await writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
    console.log('  ✓ Created .raw/config.json');
  }

  // Scan project
  const scanResult = await scanProject(projectRoot);
  const moduleCount = scanResult.modules.length;
  console.log(`  ✓ Scanned project: ${moduleCount} modules found`);

  // Create raw/ directory with placeholder INDEX.md
  await mkdir(rawDir, { recursive: true });
  const indexPath = join(rawDir, 'INDEX.md');
  if (!existsSync(indexPath) || options.force) {
    const indexContent = `# LLMAtlas Index

**Modules discovered:** ${moduleCount}

Ask your AI agent to generate module summaries using the MCP tools.
Each module will appear here once generated.
`;
    await writeFile(indexPath, indexContent, 'utf-8');
  }
  console.log('  ✓ Created raw/ directory');

  // Install git hook
  await installGitHook(projectRoot);
  console.log('  ✓ Installed post-commit git hook');

  // Install OpenCode skill
  await installOpenCodeSkill(projectRoot);
  console.log('  ✓ Generated .opencode/skills/llm-atlas.md');

  // Append to CLAUDE.md if it exists
  await updateClaudeMd(projectRoot);
  console.log('  ✓ Updated CLAUDE.md with raw/ reference');

  // Install OpenCode MCP config
  await installOpenCodeMcp(projectRoot);
  console.log('  ✓ Configured OpenCode MCP');

  // Install root .mcp.json for broader MCP host support (Cursor, Windsurf, Claude Desktop, etc.)
  await installRootMcpJson(projectRoot);
  console.log('  ✓ Configured .mcp.json for MCP hosts');

  // Install pre-commit hook
  const hookSourcePath = join(
    import.meta.dirname ?? '.',
    '..',
    '..',
    'hooks',
    'pre-commit.template'
  );
  const hookDestPath = join(projectRoot, '.git', 'hooks', 'pre-commit');

  try {
    const hookContent = await readFile(hookSourcePath, 'utf-8');
    await mkdir(dirname(hookDestPath), { recursive: true });
    await writeFile(hookDestPath, hookContent, 'utf-8');

    // Make executable (Unix)
    if (process.platform !== 'win32') {
      execSync(`chmod +x "${hookDestPath}"`);
    }

    console.log('  ✅ Pre-commit hook installed');
  } catch (err) {
    console.warn('  ⚠️  Failed to install hook: ' + err);
  }

  console.log('');
  console.log('  ──────────────────────────────────────────────');
  console.log('  Next steps:');
  console.log('  1. Open this project with your AI agent (Claude Code, OpenCode, etc.)');
  console.log('  2. The AI agent will automatically detect the LLMAtlas skill');
  console.log('  3. Ask your agent: "Generate module summaries"');
  console.log('  4. The agent will read your source code and write summaries using MCP tools');
  console.log('  5. No API keys needed -- your agent does all the work');
  console.log('  ──────────────────────────────────────────────\n');
}

export async function installGitHook(projectRoot: string): Promise<void> {
  const hookDir = join(projectRoot, '.git', 'hooks');
  if (!existsSync(hookDir)) {
    return;
  }

  const hookPath = join(hookDir, 'post-commit');
  if (existsSync(hookPath)) return;

  const hookContent = `#!/bin/sh
# LLMAtlas post-commit hook
# Regenerates the raw/ knowledge layer for changed modules (fast mode).

if [ ! -f .raw/config.json ]; then
    exit 0
fi

echo "[llm-atlas] Running fast regeneration..."
npx --yes @llm-atlas/cli regen > .raw/last-regen.log 2>&1 &
`;

  await writeFile(hookPath, hookContent, 'utf-8');
  try {
    await import('node:fs').then((fs) => fs.promises.chmod(hookPath, 0o755));
  } catch {
    // Windows — chmod not supported
  }
}

export async function installOpenCodeSkill(projectRoot: string): Promise<void> {
  const skillDir = join(projectRoot, '.opencode', 'skills');
  await mkdir(skillDir, { recursive: true });

  const skillContent = `# Skill: LLMAtlas Knowledge Layer

This project uses the \`raw/\` folder for structured Markdown summaries of each code module.
LLMAtlas MCP tools provide everything needed to generate and maintain these summaries
using the LLMAtlas MCP server -- no external API keys required.

## Auto-Execute on Session Start

When you start a session in this project:
1. Immediately call \`raw_list_modules\` to check if any modules need summary generation
2. If "new" or "stale" modules exist, warn the user: "I'll analyze the source code and generate module summaries. This consumes AI tokens." Wait for confirmation.
3. After confirmed, begin generating summaries for each module
4. After finishing, tell the user the summaries are ready at \`raw/INDEX.md\`

## MCP Tools

| Tool | Params | Purpose |
|------|--------|---------|
| \`raw_list_modules\` | _(none)_ | List modules with status (fresh/stale/new) |
| \`raw_read_module\` | \`moduleName\` (or \`module\`), \`sections?\` | Read existing summary from \`raw/\` |
| \`raw_search\` | \`query\` | Search across all summaries |
| \`source_read_module\` | \`moduleName\` (or \`module\`) | Read full source code for a module |
| \`raw_save_module\` | \`moduleName\` (or \`module\`), \`content\` | Save a generated summary to \`raw/\`. Validates required sections. |
| \`raw_refresh_stale()\` | _(none)_ | Regenerate all stale module summaries |
| \`raw_generate_all\` | \`filter?\` ("all" | "stale") | Read source for ALL modules at once |

> **Alias:** All tools that accept \`moduleName\` also accept \`module\`.

### Required Sections (validated by \`raw_save_module\`)

| Section | Required for |
|---------|-------------|
| \`## Data Flow\` | Source modules only (test/spec exempt) |
| \`## Key Types & Interfaces\` | All modules |
| \`## Error Handling Patterns\` | All modules |
| \`## Edge Cases & Gotchas\` | All modules |

## Summary Format

Generate a summary for EACH module following this template. Every section must be populated with real analysis -- do NOT leave anything empty or file-inventory-only.

\`\`\`markdown
# Module: <module-name>

**Purpose:** One concise line explaining what this module does and why it exists. E.g. "Handles user authentication via Supabase -- login, signup, session management."

**Source:** <relative path from project root>

## Key Files
| Path | Purpose | Key Exports |
|------|---------|-------------|
| src/handler.ts | Entry point for X | createX, deleteX |
| src/types.ts | Type definitions | XInput, XConfig |

## Data Flow
How data moves through this module. Trace the path: inputs come from where, what processes them, where output goes. Mention network calls, database queries, event emissions.

## Key Types & Interfaces
The most important types/interfaces in this module. For each: name, what it represents, key fields. Focus on what a developer needs to know to use this module.

## Error Handling Patterns
How errors are caught, logged, categorized, and surfaced. Any custom error types, middleware, or recovery logic.

## Edge Cases & Gotchas
Configuration quirks, race conditions, performance cliffs, implicit assumptions, or anything that would surprise a developer reading this code for the first time.
\`\`\`

## Per-Model Workflow

For each module needing generation:
1. Call \`source_read_module\` with \`moduleName\` -- returns ALL source files
2. Read and analyze the source code thoroughly
3. Write a dense, semantic summary using the format above
4. Call \`raw_save_module\` with \`moduleName\` and the generated markdown

## Batch Workflow

For fresh projects or mass regeneration:
1. Call \`raw_generate_all\` with \`filter: "stale"\` to get all stale/new modules
2. Process each module in the returned list
3. Call \`raw_save_module\` for each completed summary

Do NOT write summaries that are just file listings. Each module's purpose, data flow, types, and architecture role are the most important outputs. Be specific -- reference actual function names, type names, and file paths from the source.
`;

  await writeFile(join(skillDir, 'llm-atlas.md'), skillContent, 'utf-8');
}

export async function updateClaudeMd(projectRoot: string): Promise<void> {
  const claudePath = join(projectRoot, 'CLAUDE.md');
  if (!existsSync(claudePath)) return;

  const existingContent = await readFile(claudePath, 'utf-8');
  if (existingContent.includes('LLMAtlas Knowledge Layer')) return;

  const appendix = `
## LLMAtlas Knowledge Layer
See \`raw/\` for module summaries. Read \`raw/INDEX.md\` first.
Stale entries marked ⚠️ — verify against source before relying on them.
`;

  await appendFile(claudePath, appendix, 'utf-8');
}

/**
 * Parse JSONC (JSON with comments) into a plain object.
 * Handles single-line // and multi-line /* * / comments.
 * Does NOT handle // in strings (rare edge case).
 */
function parseJsonc(text: string): Record<string, unknown> {
  const stripped = text
    .replace(/\/\/.*$/gm, '')       // single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, ''); // multi-line comments
  return JSON.parse(stripped);
}

export async function installOpenCodeMcp(projectRoot: string): Promise<void> {
  const mcpDir = join(projectRoot, '.opencode');
  const mcpPath = join(mcpDir, 'mcp.jsonc');

  await mkdir(mcpDir, { recursive: true });

  // Read existing config or start fresh
  let existing: Record<string, unknown> = {};
  let hadExisting = false;
  try {
    const raw = await readFile(mcpPath, 'utf-8');
    existing = parseJsonc(raw);
    hadExisting = true;
  } catch {
    // No existing config or parse error — start fresh with supergroups
    existing = {
      $schema: 'https://opencode.ai/config.json',
      mcp: {},
    };
  }

  // Ensure mcp section exists
  const mcp = existing.mcp as Record<string, unknown> ?? {};
  existing.mcp = mcp;

  // Add llm-atlas entry if missing
  if (!(mcp['llm-atlas'] as Record<string, unknown>)) {
    mcp['llm-atlas'] = {
      type: 'local',
      command: ['npx', '@llm-atlas/cli', 'mcp'],
      enabled: true,
    };
  }

  // Write back. If we had an existing file, try to preserve its structure
  // by using JSON.stringify (comments are sacrificed, but structure preserved).
  // If the file was new, include a helpful header comment.
  let output: string;
  if (hadExisting) {
    output = JSON.stringify(existing, null, 2) + '\n';
  } else {
    output = `// LLMAtlas MCP server — provides source_read_module, raw_save_module, raw_generate_all\n${JSON.stringify(existing, null, 2)}\n`;
  }

  await writeFile(mcpPath, output, 'utf-8');
}

/**
 * Install llm-atlas entry in root `.mcp.json` (standard MCP config used by
 * Claude Desktop, Cursor, Windsurf, and other MCP hosts).
 *
 * Format:
 * ```json
 * {
 *   "mcpServers": {
 *     "llm-atlas": {
 *       "command": "npx",
 *       "args": ["@llm-atlas/cli", "mcp"]
 *     }
 *   }
 * }
 * ```
 */
export async function installRootMcpJson(projectRoot: string): Promise<void> {
  const mcpPath = join(projectRoot, '.mcp.json');

  const entry = {
    command: 'npx',
    args: ['@llm-atlas/cli', 'mcp'],
  };

  let existing: Record<string, unknown> = {};
  try {
    const raw = await readFile(mcpPath, 'utf-8');
    existing = JSON.parse(raw);
  } catch {
    // File doesn't exist or invalid JSON — start fresh
    existing = { mcpServers: {} };
  }

  // Ensure mcpServers section exists
  const servers = (existing.mcpServers ?? {}) as Record<string, unknown>;
  existing.mcpServers = servers;

  // Add or update llm-atlas entry
  servers['llm-atlas'] = entry;

  await writeFile(mcpPath, JSON.stringify(existing, null, 2) + '\n', 'utf-8');
}
