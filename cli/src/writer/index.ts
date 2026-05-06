import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import type { SourceModule } from '../scanner/types.js';
import type { RawMeta } from '../llm/types.js';
import { truncateModuleToBudget } from '../llm/token-budget.js';

export interface WriteResult {
  moduleId: string;
  path: string;
  tokenCount: number;
  truncated: boolean;
}

/**
 * Write a module's knowledge file to raw/.
 * Mirrors the source path: "app/dashboard" → "raw/app/dashboard.md"
 */
export async function writeModuleFile(
  projectRoot: string,
  moduleId: string,
  content: string,
  meta: RawMeta
): Promise<WriteResult> {
  const rawPath = join(projectRoot, 'raw', moduleId + '.md');

  const budget = meta.config.tokenBudget;
  const truncatedContent = truncateModuleToBudget(content, budget);
  const tokenCount = Math.ceil(truncatedContent.length / 4);

  await mkdir(dirname(rawPath), { recursive: true });
  await writeFile(rawPath, truncatedContent, 'utf-8');

  return {
    moduleId,
    path: rawPath,
    tokenCount,
    truncated: truncatedContent !== content,
  };
}

/**
 * Write INDEX.md — a hierarchical tree of all modules.
 */
export async function writeIndexMd(
  projectRoot: string,
  modules: SourceModule[],
  meta: RawMeta
): Promise<void> {
  const stalenessDays = meta.config.stalenessDays;
  const now = Date.now();

  function renderModuleTree(mods: SourceModule[], indent: number = 0): string {
    const prefix = '  '.repeat(indent);
    return mods
      .map((m) => {
        const modMeta = meta.modules[m.id];
        const status = modMeta
          ? (now - new Date(modMeta.lastGen).getTime()) / (1000 * 60 * 60 * 24) > stalenessDays
            ? '⚠️ Stale'
            : '✅ Fresh'
          : '🆕 Not yet generated';
        const children = m.children.length > 0
          ? '\n' + renderModuleTree(m.children, indent + 1)
          : '';
        return `${prefix}📁 ${m.id}/ (${m.files.length} files, ${status})${children}`;
      })
      .join('\n');
  }

  const tree = renderModuleTree(modules.filter((m) => !m.id.includes('/')), 0);

  const content = `# LLMAtlas Index

**Generated:** ${new Date().toISOString()}
**Modules:** ${modules.length}

## Module Tree

\`\`\`
${tree}
\`\`\`

> Stale threshold: ${stalenessDays} days. Run \`llm-atlas regen --full\` to regenerate all.
`;

  const indexPath = join(projectRoot, 'raw', 'INDEX.md');
  await mkdir(dirname(indexPath), { recursive: true });
  await writeFile(indexPath, content, 'utf-8');
}
