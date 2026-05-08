import type { ModuleMeta } from '../scanner/types.js';

/**
 * Determine if a module is stale based on file hash and time.
 *
 * Stale if:
 * - File hash differs from stored hash, OR
 * - lastGen is older than hashUpdateThreshold days (14 days default)
 */
export function isModuleStale(
  meta: ModuleMeta | undefined,
  currentFileHash: string,
  hashUpdateThresholdDays: number = 14
): boolean {
  if (!meta) {
    // Not yet generated
    return true;
  }

  // Check file hash
  if (meta.fileHash && meta.fileHash !== currentFileHash) {
    return true;
  }

  // Check time-based fallback
  const lastGenTime = new Date(meta.lastGen).getTime();
  const now = Date.now();
  const ageMs = now - lastGenTime;
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  if (ageDays > hashUpdateThresholdDays) {
    return true;
  }

  return false;
}

/**
 * Get human-readable staleness reason.
 */
export function getStalenessReason(
  meta: ModuleMeta | undefined,
  currentFileHash: string,
  hashUpdateThresholdDays: number = 14
): string {
  if (!meta) {
    return 'not yet generated';
  }

  if (meta.fileHash && meta.fileHash !== currentFileHash) {
    return 'source files changed';
  }

  const lastGenTime = new Date(meta.lastGen).getTime();
  const now = Date.now();
  const ageMs = now - lastGenTime;
  const ageDays = (ageMs / (1000 * 60 * 60 * 24)).toFixed(1);

  if (ageMs / (1000 * 60 * 60 * 24) > hashUpdateThresholdDays) {
    return `${ageDays}d since last gen (> ${hashUpdateThresholdDays}d threshold)`;
  }

  return 'unknown reason';
}
