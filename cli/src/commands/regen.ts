import { runGeneration } from '../engine/index.js';

export async function regenCommand(
  projectRoot: string,
  options: { full?: boolean }
): Promise<void> {
  const mode = options.full ? 'full' : 'fast';
  console.log(`[llm-atlas] Running ${mode} regeneration...`);

  const start = Date.now();
  const report = await runGeneration(projectRoot, { mode });
  const duration = ((Date.now() - start) / 1000).toFixed(1);

  console.log(`[llm-atlas] Done in ${duration}s`);

  if (report.generated.length > 0) {
    console.log(`  Generated: ${report.generated.length} modules`);
    for (const modId of report.generated) {
      console.log(`    ✅ ${modId}`);
    }
  }

  if (report.skipped.length > 0) {
    console.log(`  Skipped: ${report.skipped.length} (no changes detected)`);
  }

  if (report.errors.length > 0) {
    console.log(`  Errors: ${report.errors.length}`);
    for (const err of report.errors) {
      console.log(`    ❌ ${err.moduleId}: ${err.error}`);
    }
  }

  if (report.tokenUsage.total > 0) {
    console.log(`  Token usage: ${report.tokenUsage.total} total`);
  }
}
