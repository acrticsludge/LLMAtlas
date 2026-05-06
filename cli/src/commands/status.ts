import { loadMeta } from '../writer/meta.js';
import { scanProject } from '../scanner/index.js';

export async function statusCommand(projectRoot: string): Promise<void> {
  const meta = await loadMeta(projectRoot);
  const scanResult = await scanProject(projectRoot);

  const now = Date.now();
  const stalenessDays = meta.config.stalenessDays;
  const stalenessMs = stalenessDays * 24 * 60 * 60 * 1000;

  console.log('\n  LLMAtlas Status');
  console.log('  ────────────────');
  console.log(`  Modules: ${scanResult.modules.length} discovered, ${Object.keys(meta.modules).length} tracked`);
  console.log(`  Staleness threshold: ${stalenessDays} days\n`);

  for (const mod of scanResult.modules) {
    const modMeta = meta.modules[mod.id];
    if (!modMeta) {
      console.log(`  🆕 ${mod.id}/ — not yet generated`);
      continue;
    }

    const age = (now - new Date(modMeta.lastGen).getTime());
    const ageDays = (age / (1000 * 60 * 60 * 24)).toFixed(1);

    if (age > stalenessMs) {
      console.log(`  ⚠️  ${mod.id}/ — ${ageDays}d since last gen (STALE)`);
    } else {
      console.log(`  ✅ ${mod.id}/ — ${ageDays}d since last gen`);
    }
  }

  console.log('');
}
