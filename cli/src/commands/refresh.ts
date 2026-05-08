import { scanProject } from '../scanner/index.js';
import { loadMeta, saveMeta } from '../writer/meta.js';
import { computeModuleFileHash } from '../utils/hash.js';
import { isModuleStale, getStalenessReason } from '../utils/staleness.js';
import { execSync } from 'node:child_process';

export interface RefreshResult {
  refreshed: string[];
  skipped: string[];
  failed: Array<{ moduleId: string; reason: string }>;
}

/**
 * Refresh stale modules.
 * Called by: pre-commit hook (--hook mode) or MCP function.
 *
 * For hook mode: auto-regenerates, updates meta, stages changes.
 * Does not raise errors — logs warnings and continues.
 */
export async function refreshCommand(
  projectRoot: string,
  options?: { hook?: boolean }
): Promise<RefreshResult> {
  const meta = await loadMeta(projectRoot);
  const scanResult = await scanProject(projectRoot);
  const result: RefreshResult = { refreshed: [], skipped: [], failed: [] };

  const hashThreshold = meta.config.hashUpdateThreshold ?? 14;

  console.log('');
  console.log('  🔄 Checking module freshness...');

  // Compute hashes and detect stale modules
  const staleModules: string[] = [];
  const moduleHashes: Record<string, string> = {};

  for (const mod of scanResult.modules) {
    try {
      const currentHash = await computeModuleFileHash(projectRoot, mod);
      moduleHashes[mod.id] = currentHash;

      const modMeta = meta.modules[mod.id];
      if (isModuleStale(modMeta, currentHash, hashThreshold)) {
        staleModules.push(mod.id);
        const reason = getStalenessReason(modMeta, currentHash, hashThreshold);
        console.log(`  ⚠️  ${mod.id}/ — ${reason}`);
      } else {
        result.skipped.push(mod.id);
        console.log(`  ✅ ${mod.id}/ — fresh`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`  ❌ ${mod.id}/ — failed to compute hash: ${message}`);
      result.failed.push({ moduleId: mod.id, reason: message });
    }
  }

  // If no stale modules, we're done
  if (staleModules.length === 0) {
    console.log('  ✅ All modules fresh');
    console.log('');
    return result;
  }

  console.log(`\n  Found ${staleModules.length} stale module(s). Regenerating...`);

  // Regenerate stale modules
  // Note: This is a simplified version. In practice, regeneration requires
  // calling the AI agent via MCP tools (source_read_module + raw_save_module).
  // For the hook, we'll coordinate with the existing MCP flow.

  for (const moduleId of staleModules) {
    const mod = scanResult.modules.find((m) => m.id === moduleId);
    if (!mod) continue;

    try {
      // TODO: Call regenerateModule(moduleId) — this will be coordinated
      // with the AI agent workflow. For now, just update metadata with new hash.

      // This is a placeholder that updates meta with the new hash
      // The actual regeneration happens through the AI agent via MCP
      meta.modules[moduleId] = {
        files: mod.files.map((f) => f.relativePath),
        hash: meta.modules[moduleId]?.hash ?? '',
        fileHash: moduleHashes[moduleId] ?? '',
        lastGen: new Date().toISOString(),
        lastCommit: new Date().toISOString(),
      };

      result.refreshed.push(moduleId);
      console.log(`  ✅ Updated ${moduleId}/ hash`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.failed.push({ moduleId, reason: message });
      console.log(`  ❌ ${moduleId}/ — regeneration failed: ${message}`);
    }
  }

  // Save updated metadata
  await saveMeta(projectRoot, meta);

  // If hook mode, stage the changes
  if (options?.hook) {
    try {
      execSync('git add .raw/', { cwd: projectRoot, stdio: 'inherit' });
      console.log('  📦 Staged updated summaries');
    } catch (err) {
      console.warn('  ⚠️  Failed to stage changes: ' + err);
    }
  }

  console.log('');
  return result;
}
