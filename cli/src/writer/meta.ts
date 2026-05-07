import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import type { RawMeta } from '../scanner/types.js';

const META_FILENAME = '.raw/.meta.json';

export async function loadMeta(projectRoot: string): Promise<RawMeta> {
  const metaPath = join(projectRoot, META_FILENAME);
  try {
    const content = await readFile(metaPath, 'utf-8');
    return JSON.parse(content) as RawMeta;
  } catch {
    return {
      version: 1,
      modules: {},
      config: { tokenBudget: 800, stalenessDays: 7 },
    };
  }
}

export async function saveMeta(projectRoot: string, meta: RawMeta): Promise<void> {
  const metaPath = join(projectRoot, META_FILENAME);
  await mkdir(dirname(metaPath), { recursive: true });
  await writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
}

export function updateModuleMeta(
  meta: RawMeta,
  moduleId: string,
  files: string[],
  hash: string
): void {
  meta.modules[moduleId] = {
    files,
    hash,
    lastGen: new Date().toISOString(),
    lastCommit: new Date().toISOString(),
  };
}
