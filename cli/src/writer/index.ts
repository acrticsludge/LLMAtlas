import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import type { SourceModule } from '../scanner/types.js';
import type { RawMeta } from '../scanner/types.js';

export interface WriteResult {
  moduleId: string;
  path: string;
}

/**
 * Write a module's knowledge file to raw/.
 * Mirrors the source path: "app/dashboard" → "raw/app/dashboard.md"
 */
export async function writeModuleFile(
  projectRoot: string,
  moduleId: string,
  content: string
): Promise<WriteResult> {
  const rawPath = join(projectRoot, 'raw', moduleId + '.md');
  await mkdir(dirname(rawPath), { recursive: true });
  await writeFile(rawPath, content, 'utf-8');
  return { moduleId, path: rawPath };
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

  function moduleStatus(m: SourceModule): string {
    const modMeta = meta.modules[m.id];
    if (!modMeta) return '🆕 Not yet generated';
    const ageDays = (now - new Date(modMeta.lastGen).getTime()) / (1000 * 60 * 60 * 24);
    return ageDays > stalenessDays ? '⚠️ Stale' : '✅ Fresh';
  }

  /** Build a tree from flat module list by grouping on parent path segments */
  function buildTree(flat: SourceModule[]): Array<{ node: SourceModule; depth: number }> {
    // Find all unique parent prefixes (e.g., "app", "lib" from "app/dashboard", "lib/utils")
    const parents = new Set<string>();
    const direct: SourceModule[] = [];
    for (const m of flat) {
      if (m.id.includes('/')) {
        parents.add(m.id.split('/')[0]);
      } else {
        direct.push(m);
      }
    }
    // Include a synthetic parent entry if it has children but no direct module
    for (const parent of parents) {
      if (!flat.find((m) => m.id === parent)) {
        direct.push({
          id: parent,
          path: '',
          relativePath: parent,
          files: [],
          children: [],
        });
      }
    }
    // Recursively flatten
    const result: Array<{ node: SourceModule; depth: number }> = [];
    function walk(mods: SourceModule[], depth: number): void {
      for (const m of mods) {
        result.push({ node: m, depth });
        if (m.children.length > 0) {
          walk(m.children, depth + 1);
        }
      }
    }
    walk(direct, 0);
    return result;
  }

  /** Render modules from scanner's native hierarchy, or fall back to flat grouping */
  function renderModuleTree(mods: SourceModule[]): string {
    // Try native hierarchy first (top-level modules with children)
    const topLevel = mods.filter((m) => !m.id.includes('/'));
    if (topLevel.length > 0) {
      return renderHierarchical(topLevel, 0);
    }
    // Fallback: build tree from flat list
    const tree = buildTree(mods);
    if (tree.length === 0) return '(no modules)';
    return renderFlattened(tree);
  }

  function renderHierarchical(mods: SourceModule[], indent: number): string {
    const prefix = '  '.repeat(indent);
    return mods
      .map((m) => {
        const status = moduleStatus(m);
        const children = m.children.length > 0
          ? '\n' + renderHierarchical(m.children, indent + 1)
          : '';
        return `${prefix}📁 ${m.id}/ (${m.files.length} files, ${status})${children}`;
      })
      .join('\n');
  }

  function renderFlattened(tree: Array<{ node: SourceModule; depth: number }>): string {
    return tree
      .map(({ node: m, depth }) => {
        const status = moduleStatus(m);
        const prefix = '  '.repeat(depth);
        return `${prefix}📁 ${m.id}/${m.files.length > 0 ? ` (${m.files.length} files, ${status})` : ''}`;
      })
      .join('\n');
  }

  const tree = renderModuleTree(modules);

  let staleNote = '';
  const staleModules = modules.filter((m) => {
    if (!meta.modules[m.id]) return false;
    const ageDays = (now - new Date(meta.modules[m.id].lastGen).getTime()) / (1000 * 60 * 60 * 24);
    return ageDays > stalenessDays;
  });
  if (staleModules.length > 0) {
    staleNote = `\n> ⚠️ ${staleModules.length} module(s) stale. Run \`llm-atlas regen --full\` to regenerate.`;
  }

  const content = `# LLMAtlas Index

**Generated:** ${new Date().toISOString()}
**Modules:** ${modules.length}

## Module Tree

\`\`\`
${tree}
\`\`\`

> Stale threshold: ${stalenessDays} days.${staleNote}
`;

  const indexPath = join(projectRoot, 'raw', 'INDEX.md');
  await mkdir(dirname(indexPath), { recursive: true });
  await writeFile(indexPath, content, 'utf-8');
}
