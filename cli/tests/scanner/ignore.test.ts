import { describe, it, expect } from 'vitest';
import { createIgnoreFilter, isIgnored } from '../../src/scanner/ignore.js';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

async function testWithIgnore(content: string, testPath: string): Promise<boolean> {
  const dir = mkdtempSync(join(tmpdir(), 'llm-atlas-'));
  writeFileSync(join(dir, '.rawignore'), content, 'utf-8');
  const filter = await createIgnoreFilter(dir);
  return isIgnored(filter, testPath);
}

describe('ignore', () => {
  it('ignores paths matching .rawignore patterns', async () => {
    expect(await testWithIgnore('dist/\nbuild/', 'dist/bundle.js')).toBe(true);
    expect(await testWithIgnore('dist/\nbuild/', 'src/index.ts')).toBe(false);
  });

  it('always ignores .git and node_modules', async () => {
    expect(await testWithIgnore('', '.git/config')).toBe(true);
    expect(await testWithIgnore('', 'node_modules/pkg/index.js')).toBe(true);
  });

  it('always ignores raw/ and .raw/', async () => {
    expect(await testWithIgnore('', 'raw/app.md')).toBe(true);
    expect(await testWithIgnore('', '.raw/config.json')).toBe(true);
  });

  it('always ignores .next, dist, build, .cache', async () => {
    expect(await testWithIgnore('', '.next/build-manifest.json')).toBe(true);
    expect(await testWithIgnore('', 'dist/bundle.js')).toBe(true);
    expect(await testWithIgnore('', 'build/output.txt')).toBe(true);
    expect(await testWithIgnore('', '.cache/esbuild/foo.js')).toBe(true);
  });

  it('returns a filter even when no ignore file exists', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'llm-atlas-'));
    const filter = await createIgnoreFilter(dir);
    // Should return a filter with built-in patterns (not null)
    expect(filter).not.toBeNull();
    // Built-in patterns should still work
    expect(isIgnored(filter, '.git/config')).toBe(true);
  });

  it('falls back to .gitignore when .rawignore missing', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'llm-atlas-'));
    writeFileSync(join(dir, '.gitignore'), 'output/\n', 'utf-8');
    const filter = await createIgnoreFilter(dir);
    expect(isIgnored(filter, 'output/log.txt')).toBe(true);
    expect(isIgnored(filter, 'src/index.ts')).toBe(false);
  });
});
