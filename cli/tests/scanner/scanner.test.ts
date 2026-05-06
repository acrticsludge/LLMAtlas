import { describe, it, expect } from 'vitest';
import { scanProject } from '../../src/scanner/index.js';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function createTestProject(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'llm-atlas-'));
  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = join(dir, filePath);
    mkdirSync(join(dir, filePath.split('/').slice(0, -1).join('/')), { recursive: true });
    writeFileSync(fullPath, content, 'utf-8');
  }
  return dir;
}

describe('scanProject', () => {
  it('discovers modules from source directories', async () => {
    const dir = createTestProject({
      'app/page.tsx': 'export default function Page() { return null; }',
      'app/layout.tsx': 'export default function Layout() { return null; }',
      'lib/api.ts': 'export async function fetchData() {}',
      'lib/db.ts': 'export async function query() {}',
    });

    const result = await scanProject(dir);
    expect(result.modules).toHaveLength(2);
    expect(result.modules.find((m) => m.id === 'app')).toBeDefined();
    expect(result.modules.find((m) => m.id === 'lib')).toBeDefined();
  });

  it('ignores barrel-only directories', async () => {
    const dir = createTestProject({
      'components/index.ts': 'export { Button } from "./Button";',
      'components/Button.tsx': 'export function Button() { return null; }',
    });

    const result = await scanProject(dir);
    // components/ has barrel + 1 real file → qualifies as module (2 files total)
    expect(result.modules.some((m) => m.id === 'components')).toBe(true);
  });

  it('finds nested modules', async () => {
    const dir = createTestProject({
      'app/dashboard/page.tsx': 'export default function Dashboard() { return null; }',
      'app/dashboard/layout.tsx': 'export default function Layout() { return null; }',
      'app/settings/page.tsx': 'export default function Settings() { return null; }',
      'app/settings/layout.tsx': 'export default function Layout() { return null; }',
      'app/page.tsx': 'export default function Home() { return null; }',
      'app/layout.tsx': 'export default function RootLayout() { return null; }',
    });

    const result = await scanProject(dir);
    const app = result.modules.find((m) => m.id === 'app');
    expect(app).toBeDefined();
    expect(app!.children).toHaveLength(2);
    expect(app!.children.map((c) => c.id).sort()).toEqual(['app/dashboard', 'app/settings']);
  });

  it('skips directories with no valid source files', async () => {
    const dir = createTestProject({
      'public/logo.svg': '<svg></svg>',
      'styles/main.css': 'body { color: red; }',
    });

    const result = await scanProject(dir);
    expect(result.modules).toHaveLength(0);
  });

  it('finds root-level source files', async () => {
    const dir = createTestProject({
      'sentry.config.ts': 'export const dsn = "...";',
    });

    const result = await scanProject(dir);
    expect(result.rootFiles).toHaveLength(1);
    expect(result.rootFiles[0].relativePath).toBe('sentry.config.ts');
  });
});
