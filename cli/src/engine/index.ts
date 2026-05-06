import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { scanProject } from '../scanner/index.js';
import { computeDiff } from '../scanner/diff.js';
import { detectLlmConfig, chatComplete } from '../llm/client.js';
import type { LlmMessage } from '../llm/client.js';
import { systemPrompt } from '../llm/prompts.js';
import { loadMeta, saveMeta, updateModuleMeta } from '../writer/meta.js';
import { writeModuleFile, writeIndexMd } from '../writer/index.js';
import type { SourceModule } from '../scanner/types.js';
import type { GenOptions } from '../llm/types.js';

export interface GenReport {
  generated: string[];
  skipped: string[];
  errors: Array<{ moduleId: string; error: string }>;
  tokenUsage: { prompt: number; completion: number; total: number };
}

/**
 * Run the full generation pipeline.
 */
export async function runGeneration(
  projectRoot: string,
  options: GenOptions
): Promise<GenReport> {
  const report: GenReport = {
    generated: [],
    skipped: [],
    errors: [],
    tokenUsage: { prompt: 0, completion: 0, total: 0 },
  };

  // 1. Scan project
  const scanResult = await scanProject(projectRoot);
  const moduleMap = new Map<string, string[]>();
  for (const mod of scanResult.modules) {
    moduleMap.set(mod.id, mod.files.map((f) => f.relativePath));
  }

  // 2. Load meta state
  const meta = await loadMeta(projectRoot);

  // 3. Determine which modules to regenerate
  let modulesToGen: SourceModule[];

  if (options.mode === 'full') {
    modulesToGen = scanResult.modules;
  } else {
    // Fast mode: only changed modules
    const diff = computeDiff(projectRoot, moduleMap);

    if (diff.needsFullRescan) {
      modulesToGen = scanResult.modules;
    } else {
      modulesToGen = scanResult.modules.filter((m) =>
        diff.affectedModules.includes(m.id)
      );
    }

    if (modulesToGen.length === 0) {
      report.skipped.push('all');
      return report;
    }
  }

  // 4. Detect LLM config
  let llmConfig: ReturnType<typeof detectLlmConfig>;
  try {
    llmConfig = detectLlmConfig();
  } catch {
    // No API key — skip LLM calls, generate placeholder summaries instead
    for (const mod of modulesToGen) {
      const placeholder = `# Module: ${mod.id}\n\n**Purpose:** (auto-generated)\n**Source:** ${mod.relativePath}/\n\n_No API key configured. Run \`llm-atlas regen --full\` with LLMATLAS_API_KEY set for full generation._\n`;
      await writeModuleFile(projectRoot, mod.id, placeholder, meta);
      updateModuleMeta(meta, mod.id, mod.files.map(f => f.relativePath), 'placeholder');
      report.generated.push(mod.id);
    }
    await saveMeta(projectRoot, meta);
    if (report.generated.length > 0) {
      await writeIndexMd(projectRoot, scanResult.modules, meta);
    }
    return report;
  }

  // 5. Generate for each module
  for (const mod of modulesToGen) {
    try {
      // Read source files
      const fileContents: string[] = [];
      for (const file of mod.files) {
        try {
          const content = await readFile(join(projectRoot, file.relativePath), 'utf-8');
          fileContents.push(`=== ${file.relativePath} ===\n${content}`);
        } catch {
          // File may have been deleted
          continue;
        }
      }

      const sourceContext = fileContents.join('\n\n');

      let userMessage: string;
      if (options.mode === 'fast') {
        const previousSummary = await getPreviousSummary(projectRoot, mod.id);
        if (previousSummary) {
          userMessage = `Update the knowledge summary for module "${mod.id}".

PREVIOUS SUMMARY:
${previousSummary}

CHANGED SOURCE FILES:
${mod.files.map(f => f.relativePath).join('\n')}

SOURCE CODE:
${sourceContext}

TASK: Update the summary to reflect these changes. Keep the same format.
If the changes are minor, note "No significant changes" and return the original summary unchanged.`;
        } else {
          // No previous summary — do a full generation
          userMessage = `Generate a knowledge summary for the module "${mod.id}".

Source location: ${mod.relativePath}/
Files: ${mod.files.length}

Source code:
${sourceContext}

Output format:
# Module: ${mod.id}

**Purpose:** <one line>
**Source:** ${mod.relativePath}/

## Key Files
| Path | Purpose | Key Exports |
|------|---------|-------------|

## Data Flow

## Key Types & Interfaces

## Error Handling Patterns

## Edge Cases & Gotchas

Keep the total output under ${meta.config.tokenBudget} tokens. Be dense.`;
        }
      } else {
        userMessage = `Generate a knowledge summary for the module "${mod.id}".

Source location: ${mod.relativePath}/
Files: ${mod.files.length}

Source code:
${sourceContext}

Output format:
# Module: ${mod.id}

**Purpose:** <one line>
**Source:** ${mod.relativePath}/

## Key Files
| Path | Purpose | Key Exports |
|------|---------|-------------|

## Data Flow

## Key Types & Interfaces

## Error Handling Patterns

## Edge Cases & Gotchas

Keep the total output under ${meta.config.tokenBudget} tokens. Be dense.`;
      }

      const messages: LlmMessage[] = [
        { role: 'system', content: systemPrompt() },
        { role: 'user', content: userMessage },
      ];

      const response = await chatComplete(messages, llmConfig, {
        signal: options.signal,
      });

      // Track token usage
      report.tokenUsage.prompt += response.usage.promptTokens;
      report.tokenUsage.completion += response.usage.completionTokens;
      report.tokenUsage.total += response.usage.totalTokens;

      // Write the module file
      const writeResult = await writeModuleFile(
        projectRoot,
        mod.id,
        response.content,
        meta
      );

      // Update meta state
      updateModuleMeta(meta, mod.id, mod.files.map(f => f.relativePath), mod.id);
      report.generated.push(mod.id);
    } catch (err) {
      report.errors.push({
        moduleId: mod.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // 6. Save meta state
  await saveMeta(projectRoot, meta);

  // 7. Write INDEX.md
  if (report.generated.length > 0) {
    await writeIndexMd(projectRoot, scanResult.modules, meta);
  }

  return report;
}

async function getPreviousSummary(projectRoot: string, moduleId: string): Promise<string | null> {
  const rawPath = join(projectRoot, 'raw', moduleId + '.md');
  try {
    return await readFile(rawPath, 'utf-8');
  } catch {
    return null;
  }
}
