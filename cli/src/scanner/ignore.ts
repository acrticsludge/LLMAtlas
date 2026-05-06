import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import type { Ignore } from 'ignore';
import { join } from 'node:path';

const RAWIGNORE_FILENAME = '.rawignore';
const GITIGNORE_FILENAME = '.gitignore';

export async function createIgnoreFilter(projectRoot: string): Promise<Ignore | null> {
  const rawignorePath = join(projectRoot, RAWIGNORE_FILENAME);
  const gitignorePath = join(projectRoot, GITIGNORE_FILENAME);

  let content: string | null = null;

  if (existsSync(rawignorePath)) {
    content = await readFile(rawignorePath, 'utf-8');
  } else if (existsSync(gitignorePath)) {
    content = await readFile(gitignorePath, 'utf-8');
  }

  if (content === null) {
    return null;
  }

  const { default: createIgnore } = await import('ignore') as unknown as { default: (opts?: Record<string, unknown>) => Ignore };
  const ig = createIgnore();
  ig.add('.git');
  ig.add('node_modules');
  ig.add('raw');
  ig.add('.raw');
  ig.add(content);
  return ig;
}

export function isIgnored(filter: Ignore | null, path: string): boolean {
  if (filter === null) return false;
  return filter.ignores(path);
}
