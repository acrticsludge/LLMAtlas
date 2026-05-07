import { runGeneration } from '../engine/index.js';

export async function regenCommand(
  projectRoot: string
): Promise<void> {
  console.log(`[llm-atlas] Checking module state...`);
  await runGeneration(projectRoot);
  console.log('  Use your AI agent to generate/update summaries.');
  console.log('  The MCP tools source_read_module + raw_save_module');
  console.log('  let the agent handle everything without API keys.\n');
}
