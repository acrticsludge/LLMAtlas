import type { SourceModule } from '../scanner/types.js';

/**
 * Generate the system prompt for module generation.
 */
export function systemPrompt(): string {
  return `You are a codebase knowledge extractor. Your job is to analyze source code and produce a dense, structured summary that another LLM will read.

RULES:
1. Be DENSE - use tables, bullet lists, NOT paragraphs
2. Be SHORT - your output must be MORE token-efficient than reading the source
3. OMIT: trivial type definitions, standard imports, obvious framework boilerplate
4. INCLUDE: non-obvious side effects, error handling, cross-module dependencies, architectural intent
5. Use the format specified in the user message. Follow it precisely.`;
}

/**
 * Generate the user message for an initial (full) module generation.
 */
export function generateFullPrompt(module: SourceModule, sourceCode?: string): string {
  const sourceSection = sourceCode
    ? `\nSource code:\n${sourceCode}`
    : '';

  return `Generate a knowledge summary for the module "${module.id}".

Source location: ${module.relativePath}/
Files: ${module.files.length}${sourceSection}

Output format:
# Module: ${module.id}

**Purpose:** <one line>
**Source:** ${module.relativePath}/

## Key Files
| Path | Purpose | Key Exports |
|------|---------|-------------|

## Data Flow

## Key Types & Interfaces

## Error Handling Patterns

## Edge Cases & Gotchas

Keep the total output under 800 tokens. Be dense.`;
}

/**
 * Generate the user message for a diff-aware (fast) regeneration.
 */
export function generateFastPrompt(
  moduleId: string,
  previousSummary: string,
  changedFiles: string[],
  diff: string
): string {
  return `Update the knowledge summary for module "${moduleId}".

PREVIOUS SUMMARY:
${previousSummary}

CHANGED FILES:
${changedFiles.join('\n')}

DIFF:
${diff}

TASK: Update the summary to reflect these changes. Keep the same format.
If the changes are minor (whitespace, comments, imports), note "No significant changes" and return the original summary unchanged.`;
}
