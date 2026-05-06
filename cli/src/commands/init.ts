import { writeFile, mkdir, readFile, appendFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { scanProject } from '../scanner/index.js';
import { runGeneration } from '../engine/index.js';

export async function initCommand(projectRoot: string, options: { force?: boolean }): Promise<void> {
  console.log('\n  ╔════════════════════════════════════════════╗');
  console.log('  ║        LLMAtlas — Knowledge Layer          ║');
  console.log('  ╚════════════════════════════════════════════╝\n');

  const rawDir = join(projectRoot, 'raw');
  if (existsSync(rawDir) && !options.force) {
    console.log('  ✓ LLMAtlas already initialized in this project.');
    console.log('  • Run `llm-atlas regen --full` to regenerate');
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

  if (moduleCount > 0) {
    console.log('');
    for (const mod of scanResult.modules.slice(0, 10)) {
      console.log(`     📁 ${mod.id}/ (${mod.files.length} files)`);
    }
    if (scanResult.modules.length > 10) {
      console.log(`     ... and ${scanResult.modules.length - 10} more`);
    }
    console.log('');
  }

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
  console.log('  1. Review raw/INDEX.md for a module overview');
  console.log('  2. Edit .rawignore to exclude more files if needed');
  console.log('  3. Run `llm-atlas regen --full` for deep analysis');
  console.log('  4. To enable Claude Code MCP:');
  console.log('     llm-atlas install claude-mcp');
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

This project has a \`raw/\` folder with structured summaries of each module.

## Usage
1. BEFORE reading source code in a module, check \`raw/<module>.md\` first.
2. Check the **Status:** field for staleness warnings.
3. INDEX.md at \`raw/INDEX.md\` gives an overview of all modules.

## Regeneration
- Run \`llm-atlas regen --full\` in terminal for full regeneration.
- The post-commit hook regenerates changed modules automatically.

## Staleness
If a file shows ⚠️ Stale, verify the info against source before relying on it.
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
