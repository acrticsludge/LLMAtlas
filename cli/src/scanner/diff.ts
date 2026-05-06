import { execSync } from 'node:child_process';

export interface DiffResult {
  /** Files that changed in the last commit */
  changedFiles: string[];
  /** Module IDs that are affected by these changes */
  affectedModules: string[];
  /** Whether a full re-scan is needed (e.g., .rawignore changed) */
  needsFullRescan: boolean;
}

/**
 * Compute the diff between HEAD and the previous commit.
 * Returns list of changed files and which modules they affect.
 */
export function computeDiff(projectRoot: string, moduleMap: Map<string, string[]>): DiffResult {
  const changedFiles = getChangedFiles(projectRoot);
  const affectedModules = new Set<string>();
  let needsFullRescan = false;

  for (const file of changedFiles) {
    if (file === '.rawignore' || file === '.raw/config.json') {
      needsFullRescan = true;
    }

    if (file.startsWith('raw/') || file.startsWith('.raw/')) {
      continue;
    }

    let bestMatch: string | null = null;
    let bestDepth = -1;

    for (const [moduleId] of moduleMap) {
      const fileDir = file.split('/').slice(0, -1).join('/');
      if (moduleId === fileDir || file.startsWith(moduleId + '/')) {
        const depth = moduleId.split('/').length;
        if (depth > bestDepth) {
          bestDepth = depth;
          bestMatch = moduleId;
        }
      }
    }

    if (bestMatch) {
      affectedModules.add(bestMatch);
    }
  }

  return {
    changedFiles,
    affectedModules: [...affectedModules],
    needsFullRescan,
  };
}

function getChangedFiles(projectRoot: string): string[] {
  try {
    const output = execSync('git diff --name-only HEAD~1 HEAD', {
      cwd: projectRoot,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return output.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}
