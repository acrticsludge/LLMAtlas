import { readdirSync, statSync } from 'node:fs';
import { join, relative, basename } from 'node:path';
import { createIgnoreFilter, isIgnored } from './ignore.js';
import type { SourceModule, SourceFile, ScanResult } from './types.js';
import type { Ignore } from 'ignore';

const SOURCE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.go', '.rs', '.rb', '.java', '.kt',
]);

const BARREL_FILES = new Set(['index.ts', 'index.tsx', 'index.js', 'index.jsx', '__init__.py']);

/**
 * Discover all source modules in a project.
 */
export async function scanProject(projectRoot: string): Promise<ScanResult> {
  const filter = await createIgnoreFilter(projectRoot);
  const modules: SourceModule[] = [];
  const rootFiles: SourceFile[] = [];

  // First pass: collect all source files
  const allFiles = collectSourceFiles(projectRoot, filter);

  // Group files by their module directory
  const dirMap = new Map<string, SourceFile[]>();

  for (const file of allFiles) {
    if (file.relativePath.includes('/')) {
      const dir = file.relativePath.split('/').slice(0, -1).join('/');
      const files = dirMap.get(dir) ?? [];
      files.push(file);
      dirMap.set(dir, files);
    } else {
      rootFiles.push(file);
    }
  }

  // Filter directories to find real modules
  for (const [dirPath, files] of dirMap) {
    const isBarrelOnly = files.length === 1 && BARREL_FILES.has(basename(files[0].relativePath));
    const hasEnoughCode = files.length >= 2 || files.some((f) => f.size > 50 * 1024); // >50KB

    if (!isBarrelOnly && hasEnoughCode) {
      modules.push({
        id: dirPath,
        path: join(projectRoot, dirPath),
        relativePath: dirPath,
        files: files.sort((a, b) => a.relativePath.localeCompare(b.relativePath)),
        children: [],
      });
    }
  }

  // Build parent-child relationships
  buildModuleTree(modules);

  return { modules, rootFiles };
}

function collectSourceFiles(projectRoot: string, filter: Ignore | null): SourceFile[] {
  const result: SourceFile[] = [];
  const queue = [projectRoot];

  while (queue.length > 0) {
    const dirPath = queue.pop()!;
    let entries: string[];

    try {
      entries = readdirSync(dirPath);
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = join(dirPath, entry);
      const relPath = relative(projectRoot, fullPath).replace(/\\/g, '/');

      if (isIgnored(filter, relPath)) continue;

      let stats;
      try {
        stats = statSync(fullPath);
      } catch {
        continue;
      }

      if (stats.isDirectory()) {
        queue.push(fullPath);
      } else if (stats.isFile()) {
        const ext = '.' + entry.split('.').pop()!;
        if (SOURCE_EXTENSIONS.has(ext)) {
          result.push({
            relativePath: relPath,
            extension: ext,
            size: stats.size,
          });
        }
      }
    }
  }

  return result;
}

function buildModuleTree(modules: SourceModule[]): void {
  const moduleMap = new Map(modules.map((m) => [m.id, m]));

  for (const mod of modules) {
    const parts = mod.id.split('/');
    if (parts.length > 1) {
      const parentId = parts.slice(0, -1).join('/');
      const parent = moduleMap.get(parentId);
      if (parent) {
        parent.children.push(mod);
      }
    }
  }
}
