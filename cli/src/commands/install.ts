import { writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { RawMeta } from '../llm/types.js';

/**
 * Install or uninstall LLMAtlas components.
 */
export async function installCommand(
  projectRoot: string,
  component: string,
  extra?: { uninstall?: boolean }
): Promise<void> {
  const isUninstall = extra?.uninstall ?? false;

  if (component === 'hooks' || component === 'all') {
    if (isUninstall) {
      const hookPath = join(projectRoot, '.git', 'hooks', 'post-commit');
      if (existsSync(hookPath)) {
        const { unlink } = await import('node:fs/promises');
        await unlink(hookPath);
        console.log('  ✓ Removed post-commit hook');
      }
    } else {
      // Re-import and run the installer from init.ts
      const { installGitHook } = await import('./init.js');
      await installGitHook(projectRoot);
      console.log('  ✓ Installed post-commit hook');
    }
  }

  if (component === 'claude-mcp' || component === 'all') {
    if (isUninstall) {
      console.log('  ⚠️  To remove Claude Code MCP, edit ~/.claude/mcp.json manually');
    } else {
      console.log('');
      console.log('  To enable Claude Code MCP, add to ~/.claude/mcp.json:');
      console.log('');
      console.log('  {');
      console.log('    "mcpServers": {');
      console.log('      "llm-atlas": {');
      console.log('        "command": "npx",');
      console.log('        "args": ["@llm-atlas/cli", "mcp"]');
      console.log('      }');
      console.log('    }');
      console.log('  }');
      console.log('');
    }
  }

  if (component === 'raw' || component === 'all') {
    if (isUninstall) {
      const { rm } = await import('node:fs/promises');
      const rawPath = join(projectRoot, 'raw');
      if (existsSync(rawPath)) {
        await rm(rawPath, { recursive: true, force: true });
        console.log('  ✓ Removed raw/ directory');
      }

      const rawConfigPath = join(projectRoot, '.raw');
      if (existsSync(rawConfigPath)) {
        await rm(rawConfigPath, { recursive: true, force: true });
        console.log('  ✓ Removed .raw/ configuration');
      }

      const skillPath = join(projectRoot, '.opencode', 'skills', 'llm-atlas.md');
      if (existsSync(skillPath)) {
        const { unlink } = await import('node:fs/promises');
        await unlink(skillPath);
        console.log('  ✓ Removed OpenCode skill');
      }

      const mcpPath = join(projectRoot, '.opencode', 'mcp.jsonc');
      if (existsSync(mcpPath)) {
        try {
          const content = JSON.parse(await readFile(mcpPath, 'utf-8'));
          delete content['llm-atlas'];
          await writeFile(mcpPath, JSON.stringify(content, null, 2), 'utf-8');
          console.log('  ✓ Removed OpenCode MCP config');
        } catch {
          // ignore if file can't be parsed
        }
      }

      // Remove LLMAtlas section from CLAUDE.md if present
      const claudePath = join(projectRoot, 'CLAUDE.md');
      if (existsSync(claudePath)) {
        const content = await readFile(claudePath, 'utf-8');
        const marker = '## LLMAtlas Knowledge Layer';
        const startIdx = content.indexOf(marker);
        if (startIdx >= 0) {
          // Find the next ## heading after the LLMAtlas section
          const afterContent = content.substring(startIdx + marker.length);
          const nextHeadingMatch = afterContent.match(/\n## /);
          const endIdx = nextHeadingMatch
            ? startIdx + marker.length + nextHeadingMatch.index!
            : content.length;
          const updated = content.substring(0, startIdx).trimEnd() + content.substring(endIdx);
          await writeFile(claudePath, updated.trimEnd() + '\n', 'utf-8');
          console.log('  ✓ Removed LLMAtlas section from CLAUDE.md');
        }
      }

      console.log('\n  ✅ LLMAtlas fully uninstalled');
    }
  }
}
