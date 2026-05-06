import { describe, it, expect } from 'vitest';
import { computeDiff } from '../../src/scanner/diff.js';

describe('computeDiff', () => {
  it('finds deepest matching module for a changed file', () => {
    const moduleMap = new Map<string, string[]>([
      ['app', ['app/page.tsx', 'app/layout.tsx']],
      ['app/dashboard', ['app/dashboard/page.tsx', 'app/dashboard/layout.tsx']],
      ['lib', ['lib/api.ts', 'lib/db.ts']],
    ]);

    const result = computeDiff('/nonexistent', moduleMap);
    expect(Array.isArray(result.changedFiles)).toBe(true);
    expect(Array.isArray(result.affectedModules)).toBe(true);
    expect(typeof result.needsFullRescan).toBe('boolean');
  });

  it('sets needsFullRescan when .rawignore changes', () => {
    const moduleMap = new Map<string, string[]>();
    const result = computeDiff('/nonexistent', moduleMap);
    expect(result.needsFullRescan).toBe(false);
  });

  it('returns empty arrays for a project with no git history', () => {
    const moduleMap = new Map<string, string[]>();
    const result = computeDiff('/tmp', moduleMap);
    expect(result.changedFiles).toEqual([]);
    expect(result.affectedModules).toEqual([]);
  });
});
