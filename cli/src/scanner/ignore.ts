import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import type { Ignore } from 'ignore';
import { join } from 'node:path';

const RAWIGNORE_FILENAME = '.rawignore';
const GITIGNORE_FILENAME = '.gitignore';

/**
 * Directories that are ALWAYS ignored, regardless of .rawignore content.
 * These are common framework/build output directories that should never
 * show up in the knowledge layer.
 */
const ALWAYS_IGNORED_DIRS = [
  '.git',
  'node_modules',
  'raw',
  '.raw',
  '.next',
  'dist',
  'build',
  'out',
  '.cache',
  '.vercel',
  '.turbo',
];

export async function createIgnoreFilter(projectRoot: string): Promise<Ignore | null> {
  const rawignorePath = join(projectRoot, RAWIGNORE_FILENAME);
  const gitignorePath = join(projectRoot, GITIGNORE_FILENAME);

  let content: string | null = null;

  if (existsSync(rawignorePath)) {
    content = await readFile(rawignorePath, 'utf-8');
  } else if (existsSync(gitignorePath)) {
    content = await readFile(gitignorePath, 'utf-8');
  }

  const { default: createIgnore } = await import('ignore') as unknown as { default: (opts?: Record<string, unknown>) => Ignore };
  const ig = createIgnore();
  ig.add(ALWAYS_IGNORED_DIRS);
  if (content) {
    ig.add(content);
  }
  return ig;
}

export function isIgnored(filter: Ignore | null, path: string): boolean {
  if (filter === null) return false;
  // Check the path as-is (for files and dirs)
  if (filter.ignores(path)) return true;
  // Also check with trailing slash (for directories — some patterns use `.next/`
  // which may not match `.next` without the trailing slash in the ignore package)
  if (filter.ignores(path + '/')) return true;
  return false;
}
