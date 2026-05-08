import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { SourceModule } from '../scanner/types.js';

/**
 * Compute SHA-256 hash of a module's source files.
 * Concatenates all file contents in sorted order.
 */
export async function computeModuleFileHash(
  projectRoot: string,
  module: SourceModule
): Promise<string> {
  if (module.files.length === 0) {
    return '';
  }

  // Sort files alphabetically for stable ordering
  const sortedFiles = [...module.files].sort((a, b) =>
    a.relativePath.localeCompare(b.relativePath)
  );

  const hash = createHash('sha256');

  for (const file of sortedFiles) {
    try {
      const filePath = join(projectRoot, file.relativePath);
      const content = await readFile(filePath, 'utf-8');
      hash.update(content);
    } catch (err) {
      // File deleted mid-computation, skip it
      console.warn(`  ⚠️  Failed to hash ${file.relativePath}: file not found`);
    }
  }

  return hash.digest('hex');
}

/**
 * Compare two file hashes for equality.
 */
export function hashesEqual(hash1: string, hash2: string): boolean {
  return hash1 === hash2;
}
