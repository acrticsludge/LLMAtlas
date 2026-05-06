/**
 * Rough token estimation (chars / 4 = ~tokens).
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Truncate text to fit within a token budget.
 * Preserves the beginning and end, truncates the middle.
 */
export function truncateToBudget(text: string, budget: number, preserveHead: number = 0.4): string {
  const estimatedTokens = estimateTokens(text);

  if (estimatedTokens <= budget) {
    return text;
  }

  const chars = text.length;
  const targetChars = budget * 4;
  const headChars = Math.floor(targetChars * preserveHead);
  const tailChars = targetChars - headChars;

  return text.slice(0, headChars) + '\n\n<!-- ... truncated ... -->\n\n' + text.slice(-tailChars);
}

/**
 * Template sections in priority order (index 0 = keep first when truncating).
 */
export const SECTION_PRIORITY = [
  'Key Files',
  'Data Flow',
  'Key Types & Interfaces',
  'Error Handling Patterns',
  'Edge Cases & Gotchas',
  'Test Coverage',
] as const;

/**
 * Truncate a module markdown file to fit within budget by removing lower-priority sections.
 */
export function truncateModuleToBudget(markdown: string, budget: number): string {
  const estimatedTokens = estimateTokens(markdown);
  if (estimatedTokens <= budget) return markdown;

  const lines = markdown.split('\n');
  const sections: { heading: string; content: string[]; priority: number }[] = [];
  let currentHeading = '';
  let currentContent: string[] = [];

  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (currentHeading) {
        const priorityIdx = SECTION_PRIORITY.indexOf(currentHeading.replace('## ', '').trim() as any);
        sections.push({
          heading: currentHeading,
          content: currentContent,
          priority: priorityIdx >= 0 ? priorityIdx : SECTION_PRIORITY.length,
        });
      }
      currentHeading = line;
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }
  if (currentHeading) {
    sections.push({
      heading: currentHeading,
      content: currentContent,
      priority: SECTION_PRIORITY.indexOf(currentHeading.replace('## ', '').trim() as any),
    });
  }

  sections.sort((a, b) => a.priority - b.priority);

  while (sections.length > 3 && estimateTokens(sections.map(s => s.heading + '\n' + s.content.join('\n')).join('\n')) > budget) {
    const lowestPriority = sections.reduce((worst, s, i) =>
      s.priority > worst.priority ? { index: i, priority: s.priority } : worst,
      { index: -1, priority: -1 }
    );
    if (lowestPriority.index >= 0) {
      sections.splice(lowestPriority.index, 1);
    } else {
      break;
    }
  }

  sections.sort((a, b) => {
    const aIdx = SECTION_PRIORITY.indexOf(a.heading.replace('## ', '').trim() as any);
    const bIdx = SECTION_PRIORITY.indexOf(b.heading.replace('## ', '').trim() as any);
    return (aIdx >= 0 ? aIdx : SECTION_PRIORITY.length) - (bIdx >= 0 ? bIdx : SECTION_PRIORITY.length);
  });

  return sections.map(s => s.heading + '\n' + s.content.join('\n')).join('\n');
}
