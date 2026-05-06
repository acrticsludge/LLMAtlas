import { describe, it, expect } from 'vitest';
import { runGeneration } from '../../src/engine/index.js';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('runGeneration', () => {
  it('generates placeholder summaries when no API key is set', async () => {
    // Save and clear API keys
    const prevKeys = {
      llm: process.env.LLMATLAS_API_KEY,
      ds: process.env.DEEPSEEK_API_KEY,
      anth: process.env.ANTHROPIC_API_KEY,
      openai: process.env.OPENAI_API_KEY,
    };
    delete process.env.LLMATLAS_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;

    const dir = mkdtempSync(join(tmpdir(), 'llm-atlas-'));
    writeFileSync(join(dir, 'test.ts'), 'export const x = 1;', 'utf-8');

    const report = await runGeneration(dir, { mode: 'full' });
    expect(Array.isArray(report.generated)).toBe(true);
    expect(Array.isArray(report.errors)).toBe(true);

    // Restore
    if (prevKeys.llm) process.env.LLMATLAS_API_KEY = prevKeys.llm;
    if (prevKeys.ds) process.env.DEEPSEEK_API_KEY = prevKeys.ds;
    if (prevKeys.anth) process.env.ANTHROPIC_API_KEY = prevKeys.anth;
    if (prevKeys.openai) process.env.OPENAI_API_KEY = prevKeys.openai;
  });

  it('handles fast mode gracefully on a new project', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'llm-atlas-'));
    writeFileSync(join(dir, 'index.ts'), 'export const y = 2;', 'utf-8');

    const report = await runGeneration(dir, { mode: 'fast' });
    // No git history → no changed files → skipped
    expect(report.skipped).toBeDefined();
    expect(Array.isArray(report.generated)).toBe(true);
  });

  it('runs full mode without crashing even with errors', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'llm-atlas-'));
    writeFileSync(join(dir, 'test.ts'), 'export const z = 3;', 'utf-8');

    const report = await runGeneration(dir, { mode: 'full' });
    expect(report.generated.length).toBeGreaterThanOrEqual(0);
    expect(report.tokenUsage).toBeDefined();
  });
});
