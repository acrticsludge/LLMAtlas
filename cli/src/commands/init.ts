import { writeFile, mkdir, readFile, appendFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { scanProject } from '../scanner/index.js';

export async function initCommand(projectRoot: string, options: { force?: boolean }): Promise<void> {
  console.log('\n  ╔════════════════════════════════════════════╗');
  console.log('  ║        LLMAtlas — Knowledge Layer          ║');
  console.log('  ╚════════════════════════════════════════════╝\n');

  const rawDir = join(projectRoot, 'raw');
  if (existsSync(rawDir) && !options.force) {
    console.log('  ✓ LLMAtlas already initialized in this project.');
    console.log('  • Ask your AI agent to generate/update module summaries');
    console.log('  • Run `llm-atlas init --force` to reinitialize\n');
    return;
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
  const configDir = join(projectRoot, '.raw');
  await mkdir(configDir, { recursive: true });

  const configPath = join(configDir, 'config.json');
  if (!existsSync(configPath) || options.force) {
    const config = {
      version: 1,
      tokenBudget: 800,
      stalenessDays: 7,
      model: { fast: null, full: null },
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
2. If "new" or "stale" modules exist, inform the user briefly ("Generating module summaries for X modules...") and begin
3. Do NOT ask for permission -- the user opted in by installing LLMAtlas
4. After finishing, tell the user the summaries are ready at \`raw/INDEX.md\`

## MCP Tools

| Tool | Purpose |
|------|---------|
| \`raw_list_modules\` | List modules with status (fresh/stale/new) |
| \`raw_read_module\` | Read existing summary from \`raw/\` |
| \`raw_search\` | Search across all summaries |
| \`source_read_module\` | Read source files for a module |
| \`raw_save_module\` | Save a generated summary to \`raw/\` |

## Summary Format

Generate summaries exactly in this Markdown format, keeping them under ~800 tokens:

\`\`\`markdown
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
\`\`\`

## Per-Model Workflow

For each module needing generation:
1. Call \`source_read_module\` → get source code
2. Analyze the source and write the summary in the format above
3. Call \`raw_save_module\` to save it
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

export async function installOpenCodeMcp(projectRoot: string): Promise<void> {
  const mcpPath = join(projectRoot, '.opencode', 'mcp.jsonc');
  const mcpConfig = {
    'llm-atlas': {
      type: 'local',
      command: ['npx', '@llm-atlas/cli', 'mcp'],
      enabled: true,
    },
  };

  try {
    const existing = JSON.parse(await readFile(mcpPath, 'utf-8'));
    if (!existing['llm-atlas']) {
      existing['llm-atlas'] = mcpConfig['llm-atlas'];
      await writeFile(mcpPath, JSON.stringify(existing, null, 2), 'utf-8');
    }
  } catch {
    await writeFile(mcpPath, JSON.stringify(mcpConfig, null, 2), 'utf-8');
  }
}
