import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import type { RawMeta } from '../scanner/types.js';

const META_FILENAME = '.raw/.meta.json';

export async function loadMeta(projectRoot: string): Promise<RawMeta> {
  const metaPath = join(projectRoot, META_FILENAME);
  try {
    const content = await readFile(metaPath, 'utf-8');
    const meta = JSON.parse(content) as RawMeta;

    // Migration: set default hashUpdateThreshold if missing
    if (!meta.config.hashUpdateThreshold) {
      meta.config.hashUpdateThreshold = 14;
    }

    // Migration: initialize fileHash for modules that don't have it
    for (const moduleId in meta.modules) {
      if (!meta.modules[moduleId].fileHash) {
        meta.modules[moduleId].fileHash = '';
      }
    }

    return meta;
  } catch {
    return {
      version: 1,
      modules: {},
      config: {
        tokenBudget: 800,
        stalenessDays: 7,
        hashUpdateThreshold: 14,
      },
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
  hash: string,
  fileHash: string = ''
): void {
  meta.modules[moduleId] = {
    files,
    hash,
    fileHash,
    lastGen: new Date().toISOString(),
    lastCommit: new Date().toISOString(),
  };
}
