import { scanProject } from '../scanner/index.js';
import { loadMeta } from '../writer/meta.js';

export interface GenReport {
  generated: string[];
  skipped: string[];
  errors: Array<{ moduleId: string; error: string }>;
}

/**
 * Run generation — now delegates to the AI agent via MCP tools.
 * The old LLM-based engine was removed. Use MCP tools
 * source_read_module + raw_save_module instead.
 */
export async function runGeneration(
  projectRoot: string
): Promise<GenReport> {
  const scanResult = await scanProject(projectRoot);
  const meta = await loadMeta(projectRoot);

  const result: GenReport = { generated: [], skipped: [], errors: [] };

  if (scanResult.modules.length === 0) {
    result.skipped.push('all');
    return result;
  }

  // Print a worklist showing what needs generation
  const now = Date.now();
  const stalenessMs = meta.config.stalenessDays * 24 * 60 * 60 * 1000;

  console.log(`\n  Project has ${scanResult.modules.length} modules.`);
  console.log('  To generate summaries, ask your AI agent to:');
  console.log('  "Generate module summaries using the MCP tools"\n');

  for (const mod of scanResult.modules) {
    const modMeta = meta.modules[mod.id];
    const age = modMeta ? (now - new Date(modMeta.lastGen).getTime()) : Infinity;
    const status = age > stalenessMs ? 'stale' : modMeta ? 'fresh' : 'new';
    console.log(`    ${mod.id}/ (${mod.files.length} files, ${status})`);
  }

  console.log('');
  return result;
}
