import { describe, it, expect } from 'vitest';
import { writeModuleFile, writeIndexMd } from '../../src/writer/index.js';
import { loadMeta, saveMeta, updateModuleMeta } from '../../src/writer/meta.js';
import { mkdtempSync } from 'node:fs';
import { join, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { readFile } from 'node:fs/promises';

function posix(path: string): string {
  return path.replace(/\\/g, '/');
}

describe('meta', () => {
  it('creates a default meta when none exists', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'llm-atlas-'));
    const meta = await loadMeta(dir);
    expect(meta.version).toBe(1);
    expect(meta.modules).toEqual({});
  });

  it('saves and loads meta correctly', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'llm-atlas-'));
    const meta = await loadMeta(dir);
    updateModuleMeta(meta, 'app', ['app/page.tsx'], 'abc123');
    await saveMeta(dir, meta);

    const loaded = await loadMeta(dir);
    expect(loaded.modules['app']).toBeDefined();
    expect(loaded.modules['app'].files).toEqual(['app/page.tsx']);
    expect(loaded.modules['app'].hash).toBe('abc123');
  });
});

describe('writeModuleFile', () => {
  it('writes a module file to the correct nested path', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'llm-atlas-'));
    const result = await writeModuleFile(dir, 'app/dashboard', '# Dashboard module');
    expect(posix(result.path)).toContain('raw/app/dashboard.md');

    const content = await readFile(join(dir, 'raw', 'app', 'dashboard.md'), 'utf-8');
    expect(content).toContain('Dashboard module');
  });

  it('writes a top-level module file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'llm-atlas-'));
    const result = await writeModuleFile(dir, 'lib', '# Lib module');
    expect(posix(result.path)).toContain('raw/lib.md');

    const content = await readFile(join(dir, 'raw', 'lib.md'), 'utf-8');
    expect(content).toContain('Lib module');
  });
});

describe('writeIndexMd', () => {
  it('generates INDEX.md with module tree', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'llm-atlas-'));
    const meta = await loadMeta(dir);
    const modules = [
      {
        id: 'app',
        path: join(dir, 'app'),
        relativePath: 'app',
        files: [{ relativePath: 'app/layout.tsx', extension: '.tsx', size: 100 }],
        children: [
          {
            id: 'app/dashboard',
            path: join(dir, 'app/dashboard'),
            relativePath: 'app/dashboard',
            files: [{ relativePath: 'app/dashboard/page.tsx', extension: '.tsx', size: 200 }],
            children: [],
          },
        ],
      },
    ];

    updateModuleMeta(meta, 'app', ['app/layout.tsx'], 'hash1');
    await writeIndexMd(dir, modules, meta);

    const content = await readFile(join(dir, 'raw', 'INDEX.md'), 'utf-8');
    expect(content).toContain('LLMAtlas Index');
    expect(content).toContain('app/');
    expect(content).toContain('app/dashboard');
  });
});
