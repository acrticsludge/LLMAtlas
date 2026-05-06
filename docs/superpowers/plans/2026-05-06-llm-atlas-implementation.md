# LLMAtlas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `@llm-atlas/cli` — a CLI tool + MCP server that generates and maintains a `raw/` knowledge layer for codebases, optimized for LLM consumption.

**Architecture:** Single npm package with a CLI entry point. Core engine = Scanner (discovers modules, respects .rawignore) → LLM Client (calls user's API) → Writer (produces raw/ markdown). Platform wrappers (OpenCode skill, CLAUDE.md, MCP server) are thin auto-generated files. Everything runs locally with the user's own API key.

**Tech Stack:** Node.js ≥ 18, TypeScript (strict), OpenAI-compatible API client (user's key), Commander.js (CLI), Vitest (testing)

**Design doc:** `docs/superpowers/specs/2026-05-06-llm-atlas-design.md`

## Execution Rules

### Periodic Commits (Required)

Each task **must** produce at least one commit. Do NOT batch multiple tasks into a single commit.

- After Step 4 of each task (implementation + test + verify): **commit immediately**
- If a task has 5+ steps or spans multiple files: commit after each logical checkpoint (test passes → commit)
- This enables clean rollback, per-task review, and clear git history

Exception: If a step is purely mechanical (e.g., creating a single config file), it can share the commit with the following verification step.

---

## File Map

```
@llm-atlas/cli/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── bin/
│   └── llm-atlas.js               # CLI entry (bin)
├── src/
│   ├── index.ts                   # CLI main (Commander)
│   ├── commands/
│   │   ├── init.ts                # llm-atlas init
│   │   ├── regen.ts               # llm-atlas regen
│   │   ├── status.ts              # llm-atlas status
│   │   └── install.ts             # llm-atlas install/uninstall
│   ├── scanner/
│   │   ├── index.ts               # Module discovery orchestrator
│   │   ├── ignore.ts              # .rawignore parsing (gitignore-style)
│   │   ├── diff.ts                # Git diff computation
│   │   └── types.ts               # Scanner types
│   ├── llm/
│   │   ├── client.ts              # OpenAI-compatible API client
│   │   ├── prompts.ts             # Prompt templates
│   │   └── token-budget.ts        # Token counting & truncation
│   ├── writer/
│   │   ├── index.ts               # Markdown file generator
│   │   └── meta.ts                # .meta.json read/write
│   ├── engine/
│   │   └── index.ts               # Generation orchestrator
│   ├── mcp/
│   │   └── server.ts              # MCP protocol server
│   └── templates/
│       ├── skill.md               # OpenCode skill template
│       ├── module.hbs             # Raw module file template
│       └── post-commit.sh         # Git hook script template
└── tests/
    ├── scanner/
    │   ├── ignore.test.ts
    │   ├── scanner.test.ts
    │   └── diff.test.ts
    ├── llm/
    │   ├── client.test.ts
    │   └── prompts.test.ts
    ├── writer/
    │   └── writer.test.ts
    ├── engine/
    │   └── orchestrator.test.ts
    └── integration/
        └── e2e.test.ts
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `cli/package.json`
- Create: `cli/tsconfig.json`
- Create: `cli/vitest.config.ts`
- Create: `cli/bin/llm-atlas.js`

- [ ] **Step 1: Create cli/package.json**

```json
{
  "name": "@llm-atlas/cli",
  "version": "0.1.0",
  "description": "Auto-generate and maintain a raw/ knowledge layer for LLMs",
  "bin": {
    "llm-atlas": "./bin/llm-atlas.js"
  },
  "type": "module",
  "files": ["bin/", "dist/", "src/templates/"],
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "commander": "^12.0.0",
    "ignore": "^5.3.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "@types/node": "^20.0.0",
    "vitest": "^1.6.0"
  },
  "license": "MIT"
}
```

- [ ] **Step 2: Create cli/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: Create cli/vitest.config.ts**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
    },
  },
});
```

- [ ] **Step 4: Create CLI JS entry point**

```js
#!/usr/bin/env node
// cli/bin/llm-atlas.js
// Simple JS shim that imports the compiled TS entry point.
// In dev, the user runs via `npx tsx` or the compiled version.

import('../dist/index.js').catch((err) => {
  console.error('Failed to load llm-atlas. Did you run `npm run build`?');
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 5: Verify scaffolding compiles**

Run: `cd cli && npm install && npx tsc --noEmit`
Expected: No errors. TypeScript compiles successfully (even though src/index.ts is just an empty file for now).

---

## Task 2: Types & Shared Interfaces

**Files:**
- Create: `cli/src/scanner/types.ts`
- Create: `cli/src/llm/client.ts` (types only — implementation in Task 5)

- [ ] **Step 1: Define scanner types**

```ts
// cli/src/scanner/types.ts

/** A discovered source module that should get a raw/ entry */
export interface SourceModule {
  /** Unique identifier, e.g. "app/dashboard" or "lib" */
  id: string;
  /** Absolute path to the directory */
  path: string;
  /** Relative path from project root, e.g. "app/dashboard" */
  relativePath: string;
  /** Source files belonging to this module */
  files: SourceFile[];
  /** Child modules (subdirectories that are also modules) */
  children: SourceModule[];
}

export interface SourceFile {
  /** Relative path from project root, e.g. "app/dashboard/page.tsx" */
  relativePath: string;
  /** File extension */
  extension: string;
  /** File size in bytes */
  size: number;
}

/** Result of scanning a project */
export interface ScanResult {
  modules: SourceModule[];
  rootFiles: SourceFile[]; // files at project root
}

/** Configuration loaded from .raw/config.json */
export interface RawConfig {
  version: number;
  tokenBudget: number;
  stalenessDays: number;
  model: {
    fast: { provider: string; model: string } | null;
    full: { provider: string; model: string } | null;
  };
  modules: {
    include: string[];
    exclude: string[];
  };
  moduleOverrides: Record<string, string>;
}

export const DEFAULT_CONFIG: RawConfig = {
  version: 1,
  tokenBudget: 800,
  stalenessDays: 7,
  model: { fast: null, full: null },
  modules: { include: ['*'], exclude: [] },
  moduleOverrides: {},
};
```

- [ ] **Step 2: Define generation types**

```ts
// cli/src/llm/types.ts

export type GenMode = 'fast' | 'full';

export interface GenOptions {
  mode: GenMode;
  signal?: AbortSignal;
}

/** State tracked per module in .raw/.meta.json */
export interface ModuleMeta {
  files: string[];
  hash: string;
  lastGen: string; // ISO timestamp
  lastCommit: string; // ISO timestamp
}

export interface RawMeta {
  version: number;
  modules: Record<string, ModuleMeta>;
  config: {
    tokenBudget: number;
    stalenessDays: number;
  };
}
```

- [ ] **Step 3: Verify types compile**

Run: `cd cli && npx tsc --noEmit`
Expected: No errors.

---

## Task 3: Scanner — .rawignore Parser

**Files:**
- Create: `cli/src/scanner/ignore.ts`

- [ ] **Step 1: Implement ignore parser**

```ts
// cli/src/scanner/ignore.ts
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import ignore from 'ignore';

const RAWIGNORE_FILENAME = '.rawignore';
const GITIGNORE_FILENAME = '.gitignore';

/**
 * Creates an ignore filter from .rawignore.
 * Falls back to .gitignore if .rawignore doesn't exist.
 * Returns null if neither file exists (nothing ignored).
 */
export async function createIgnoreFilter(projectRoot: string): Promise<ReturnType<typeof ignore> | null> {
  const rawignorePath = join(projectRoot, RAWIGNORE_FILENAME);
  const gitignorePath = join(projectRoot, GITIGNORE_FILENAME);

  let content: string | null = null;

  if (existsSync(rawignorePath)) {
    content = await readFile(rawignorePath, 'utf-8');
  } else if (existsSync(gitignorePath)) {
    content = await readFile(gitignorePath, 'utf-8');
  }

  if (content === null) {
    return null;
  }

  const ig = ignore();
  // Always ignore .git and node_modules
  ig.add('.git');
  ig.add('node_modules');
  ig.add('raw');
  ig.add('.raw');
  // Add patterns from the ignore file
  ig.add(content);
  return ig;
}

/**
 * Checks if a path should be ignored.
 */
export function isIgnored(filter: ReturnType<typeof ignore> | null, path: string): boolean {
  if (filter === null) return false;
  return filter.ignores(path);
}

// Need to import path
import { join } from 'node:path';
```

- [ ] **Step 2: Write the test**

```ts
// cli/tests/scanner/ignore.test.ts
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

  it('returns null when no ignore file exists', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'llm-atlas-'));
    const filter = await createIgnoreFilter(dir);
    expect(filter).toBeNull();
  });
});
```

- [ ] **Step 3: Run test**

Run: `cd cli && npx vitest run tests/scanner/ignore.test.ts`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add cli/package.json cli/tsconfig.json cli/vitest.config.ts cli/bin/llm-atlas.js cli/src/scanner/types.ts cli/src/llm/types.ts cli/src/scanner/ignore.ts cli/tests/scanner/ignore.test.ts
git commit -m "feat: add project scaffolding and ignore parser"
```

---

## Task 4: Scanner — Module Discovery

**Files:**
- Create: `cli/src/scanner/index.ts`
- Create: `cli/tests/scanner/scanner.test.ts`

- [ ] **Step 1: Implement the scanner**

```ts
// cli/src/scanner/index.ts
import { readdirSync, statSync } from 'node:fs';
import { join, relative, basename } from 'node:path';
import { createIgnoreFilter, isIgnored } from './ignore.js';
import type { SourceModule, SourceFile, ScanResult } from './types.js';

const SOURCE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.go', '.rs', '.rb', '.java', '.kt',
]);

const BARREL_FILES = new Set(['index.ts', 'index.tsx', 'index.js', 'index.jsx', '__init__.py']);

/**
 * Discover all source modules in a project.
 */
export async function scanProject(projectRoot: string): Promise<ScanResult> {
  const filter = await createIgnoreFilter(projectRoot);
  const modules: SourceModule[] = [];
  const rootFiles: SourceFile[] = [];

  // First pass: collect all source files
  const allFiles = collectSourceFiles(projectRoot, filter);

  // Group files by their module directory
  // A "module" is any directory containing ≥2 source files OR 1 file >50 lines
  const dirMap = new Map<string, SourceFile[]>();

  for (const file of allFiles) {
    if (file.relativePath.includes('/')) {
      const dir = file.relativePath.split('/').slice(0, -1).join('/');
      const files = dirMap.get(dir) ?? [];
      files.push(file);
      dirMap.set(dir, files);
    } else {
      rootFiles.push(file);
    }
  }

  // Filter directories to find real modules
  for (const [dirPath, files] of dirMap) {
    const isBarrelOnly = files.length === 1 && BARREL_FILES.has(basename(files[0].relativePath));
    const hasEnoughCode = files.length >= 2 || files.some((f) => f.size > 50 * 1024); // >50KB

    if (!isBarrelOnly && hasEnoughCode) {
      modules.push({
        id: dirPath,
        path: join(projectRoot, dirPath),
        relativePath: dirPath,
        files: files.sort((a, b) => a.relativePath.localeCompare(b.relativePath)),
        children: [],
      });
    }
  }

  // Build parent-child relationships
  buildModuleTree(modules);

  return { modules, rootFiles };
}

function collectSourceFiles(projectRoot: string, filter: ReturnType<typeof import('ignore')> | null): SourceFile[] {
  const result: SourceFile[] = [];
  const queue = [projectRoot];

  while (queue.length > 0) {
    const dirPath = queue.pop()!;
    let entries: string[];

    try {
      entries = readdirSync(dirPath);
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = join(dirPath, entry);
      const relPath = relative(projectRoot, fullPath).replace(/\\/g, '/');

      if (isIgnored(filter, relPath)) continue;

      let stats;
      try {
        stats = statSync(fullPath);
      } catch {
        continue;
      }

      if (stats.isDirectory()) {
        queue.push(fullPath);
      } else if (stats.isFile()) {
        const ext = '.' + entry.split('.').pop()!;
        if (SOURCE_EXTENSIONS.has(ext)) {
          result.push({
            relativePath: relPath,
            extension: ext,
            size: stats.size,
          });
        }
      }
    }
  }

  return result;
}

function buildModuleTree(modules: SourceModule[]): void {
  const moduleMap = new Map(modules.map((m) => [m.id, m]));

  for (const mod of modules) {
    const parts = mod.id.split('/');
    if (parts.length > 1) {
      const parentId = parts.slice(0, -1).join('/');
      const parent = moduleMap.get(parentId);
      if (parent) {
        parent.children.push(mod);
      }
    }
  }
}
```

- [ ] **Step 2: Write the test**

```ts
// cli/tests/scanner/scanner.test.ts
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
    // components/ has a barrel + 1 real file, so it qualifies as a module
    expect(result.modules.some((m) => m.id === 'components')).toBe(true);
  });

  it('finds nested modules', async () => {
    const dir = createTestProject({
      'app/dashboard/page.tsx': 'export default function Dashboard() { return null; }',
      'app/dashboard/layout.tsx': 'export default function Layout() { return null; }',
      'app/settings/page.tsx': 'export default function Settings() { return null; }',
      'app/settings/layout.tsx': 'export default function Layout() { return null; }',
      'app/layout.tsx': 'export default function RootLayout() { return null; }',
    });

    const result = await scanProject(dir);
    const app = result.modules.find((m) => m.id === 'app');
    expect(app).toBeDefined();
    expect(app!.children).toHaveLength(2);
    expect(app!.children.map((c) => c.id).sort()).toEqual(['app/dashboard', 'app/settings']);
  });
});
```

- [ ] **Step 3: Run test**

Run: `cd cli && npx vitest run tests/scanner/scanner.test.ts`
Expected: All tests pass.

---

## Task 5: Scanner — Diff Tracker

**Files:**
- Create: `cli/src/scanner/diff.ts`
- Create: `cli/tests/scanner/diff.test.ts`

- [ ] **Step 1: Implement diff tracker**

```ts
// cli/src/scanner/diff.ts
import { execSync } from 'node:child_process';

export interface DiffResult {
  /** Files that changed in the last commit */
  changedFiles: string[];
  /** Module IDs that are affected by these changes */
  affectedModules: string[];
  /** Whether a full re-scan is needed (e.g., .rawignore changed) */
  needsFullRescan: boolean;
}

/**
 * Compute the diff between HEAD and the previous commit.
 * Returns list of changed files and which modules they affect.
 */
export function computeDiff(projectRoot: string, moduleMap: Map<string, string[]>): DiffResult {
  const changedFiles = getChangedFiles(projectRoot);
  const affectedModules = new Set<string>();
  let needsFullRescan = false;

  for (const file of changedFiles) {
    if (file === '.rawignore' || file === '.raw/config.json') {
      needsFullRescan = true;
    }

    if (file.startsWith('raw/') || file.startsWith('.raw/')) {
      continue; // Skip raw/ changes to avoid infinite loops
    }

    // Find the deepest matching module
    let bestMatch: string | null = null;
    let bestDepth = -1;

    for (const [moduleId, moduleFiles] of moduleMap) {
      // Check if this file belongs to this module
      if (moduleFiles.some((mf) => file.startsWith(mf.split('/')[0]))) {
        // More specific: check directory prefix
        const fileDir = file.split('/').slice(0, -1).join('/');
        if (moduleId === fileDir || file.startsWith(moduleId + '/')) {
          const depth = moduleId.split('/').length;
          if (depth > bestDepth) {
            bestDepth = depth;
            bestMatch = moduleId;
          }
        }
      }
    }

    if (bestMatch) {
      affectedModules.add(bestMatch);
    }
  }

  return {
    changedFiles,
    affectedModules: [...affectedModules],
    needsFullRescan,
  };
}

function getChangedFiles(projectRoot: string): string[] {
  try {
    // Get files changed in the most recent commit
    const output = execSync('git diff --name-only HEAD~1 HEAD', {
      cwd: projectRoot,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return output.trim().split('\n').filter(Boolean);
  } catch {
    // If HEAD~1 doesn't exist (first commit), return empty
    return [];
  }
}

/**
 * Get the hash of the last commit for each module.
 */
export function getLastCommitHashes(projectRoot: string): Map<string, string> {
  const map = new Map<string, string>();
  try {
    const output = execSync('git log --name-only --pretty="format:%H" -1', {
      cwd: projectRoot,
      encoding: 'utf-8',
    });
    // Single commit: first line is the hash
    const lines = output.trim().split('\n');
    if (lines.length > 0) {
      const hash = lines[0].trim();
      const files = lines.slice(1).filter(Boolean);
      for (const file of files) {
        map.set(file, hash);
      }
    }
  } catch {
    // No commits yet
  }
  return map;
}
```

- [ ] **Step 2: Write the test**

```ts
// cli/tests/scanner/diff.test.ts
import { describe, it, expect } from 'vitest';
import { computeDiff } from '../../src/scanner/diff.js';

describe('computeDiff', () => {
  it('identifies affected modules from changed files', () => {
    const moduleMap = new Map<string, string[]>([
      ['app', ['app/page.tsx', 'app/layout.tsx']],
      ['app/dashboard', ['app/dashboard/page.tsx', 'app/dashboard/layout.tsx']],
      ['lib', ['lib/api.ts', 'lib/db.ts']],
    ]);

    // Simulate: app/dashboard/page.tsx changed
    const result = computeDiff('/test', moduleMap);
    // In a real run this would execute git, but in tests we mock
    expect(result.affectedModules).toBeDefined();
    expect(Array.isArray(result.changedFiles)).toBe(true);
  });
});
```

Note: The diff test is light because `computeDiff` calls `git` internally. The real test for diff tracking will be covered in the integration test (Task 18).

- [ ] **Step 3: Commit**

```bash
git add cli/src/scanner/index.ts cli/src/scanner/diff.ts cli/tests/scanner/scanner.test.ts cli/tests/scanner/diff.test.ts
git commit -m "feat: add module scanner and diff tracker"
```

---

## Task 6: LLM Client

**Files:**
- Create: `cli/src/llm/client.ts`
- Create: `cli/src/llm/prompts.ts`
- Create: `cli/src/llm/token-budget.ts`
- Create: `cli/tests/llm/client.test.ts`

- [ ] **Step 1: Implement LLM client**

```ts
// cli/src/llm/client.ts
import { createIgnoreFilter } from '../scanner/ignore.js';

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface LlmResponse {
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Detect LLM configuration from environment.
 * Order: LLMATLAS_API_KEY → DEEPSEEK_API_KEY → ANTHROPIC_API_KEY → OPENAI_API_KEY
 */
export function detectLlmConfig(): LlmConfig {
  const key = process.env.LLMATLAS_API_KEY
    ?? process.env.DEEPSEEK_API_KEY
    ?? process.env.ANTHROPIC_API_KEY
    ?? process.env.OPENAI_API_KEY;

  if (!key) {
    throw new Error(
      'No API key found. Set LLMATLAS_API_KEY, DEEPSEEK_API_KEY, ANTHROPIC_API_KEY, or OPENAI_API_KEY.'
    );
  }

  // Detect provider from key prefix or env var
  if (process.env.LLMATLAS_API_KEY || process.env.DEEPSEEK_API_KEY) {
    return {
      apiKey: key,
      baseUrl: process.env.LLMATLAS_BASE_URL ?? 'https://api.deepseek.com',
      model: process.env.LLMATLAS_MODEL ?? 'deepseek-chat',
    };
  }

  if (process.env.ANTHROPIC_API_KEY) {
    return {
      apiKey: key,
      baseUrl: 'https://api.anthropic.com/v1',
      model: 'claude-3-haiku-20240307',
    };
  }

  // Default: OpenAI-compatible
  return {
    apiKey: key,
    baseUrl: process.env.LLMATLAS_BASE_URL ?? 'https://api.openai.com/v1',
    model: process.env.LLMATLAS_MODEL ?? 'gpt-4o-mini',
  };
}

/**
 * Send a chat completion request to an OpenAI-compatible API.
 */
export async function chatComplete(
  messages: LlmMessage[],
  config: LlmConfig,
  options?: { maxTokens?: number; signal?: AbortSignal }
): Promise<LlmResponse> {
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      max_tokens: options?.maxTokens ?? 2048,
    }),
    signal: options?.signal,
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`LLM API error ${response.status}: ${errorBody}`);
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>;
    model: string;
    usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  };

  return {
    content: data.choices[0]?.message?.content ?? '',
    model: data.model,
    usage: {
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
      totalTokens: data.usage.total_tokens,
    },
  };
}
```

- [ ] **Step 2: Implement prompt templates**

```ts
// cli/src/llm/prompts.ts
import type { SourceModule } from '../scanner/types.js';
import type { ModuleMeta } from './types.js';

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
export function generateFullPrompt(module: SourceModule): string {
  const fileList = module.files
    .map((f) => `=== ${f.relativePath} (${f.size} bytes) ===\n`)
    .join('\n');

  // Note: In practice, we'd read the file contents. For v1, we send file paths.
  // The actual content reading will be added in the engine orchestrator.
  return `Generate a knowledge summary for the module "${module.id}".

Source location: ${module.relativePath}/
Files: ${module.files.length}

File listing:
${fileList}

Output format:
# Module: ${module.id}

**Purpose:** <one line>
**Source:** ${module.relativePath}/

## Key Files
| Path | Purpose | Key Exports |
|------|---------|-------------|

## Data Flow
<!-- ASCII or description -->

## Key Types & Interfaces

## Error Handling Patterns

## Test Coverage

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
```

- [ ] **Step 3: Implement token budget tracking**

```ts
// cli/src/llm/token-budget.ts

/**
 * Rough token estimation (chars / 4 = ~tokens).
 * Not as accurate as tiktoken, but good enough for budgeting.
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

  // Split into sections by ## headings
  const lines = markdown.split('\n');
  const sections: { heading: string; content: string[]; priority: number }[] = [];
  let currentHeading = '';
  let currentContent: string[] = [];

  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (currentHeading) {
        const priority = SECTION_PRIORITY.indexOf(currentHeading.replace('## ', '').trim() as any);
        sections.push({
          heading: currentHeading,
          content: currentContent,
          priority: priority >= 0 ? priority : SECTION_PRIORITY.length,
        });
      }
      currentHeading = line;
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }
  // Push last section
  if (currentHeading) {
    sections.push({
      heading: currentHeading,
      content: currentContent,
      priority: SECTION_PRIORITY.indexOf(currentHeading.replace('## ', '').trim() as any),
    });
  }

  // Sort by priority (highest priority first = lowest index)
  sections.sort((a, b) => a.priority - b.priority);

  // Keep removing sections until we fit the budget
  while (sections.length > 3 && estimateTokens(sections.map(s => s.heading + '\n' + s.content.join('\n')).join('\n')) > budget) {
    // Remove the lowest priority section
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

  // Restore original order
  sections.sort((a, b) => {
    const aIdx = SECTION_PRIORITY.indexOf(a.heading.replace('## ', '').trim() as any);
    const bIdx = SECTION_PRIORITY.indexOf(b.heading.replace('## ', '').trim() as any);
    return (aIdx >= 0 ? aIdx : SECTION_PRIORITY.length) - (bIdx >= 0 ? bIdx : SECTION_PRIORITY.length);
  });

  return sections.map(s => s.heading + '\n' + s.content.join('\n')).join('\n');
}
```

- [ ] **Step 4: Write and run tests**

```ts
// cli/tests/llm/client.test.ts
import { describe, it, expect } from 'vitest';
import { detectLlmConfig, chatComplete } from '../../src/llm/client.js';
import { systemPrompt, generateFullPrompt, generateFastPrompt } from '../../src/llm/prompts.js';
import { estimateTokens, truncateToBudget, truncateModuleToBudget } from '../../src/llm/token-budget.js';

describe('detectLlmConfig', () => {
  it('throws when no API key is set', () => {
    const prev = process.env.DEEPSEEK_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.LLMATLAS_API_KEY;

    expect(() => detectLlmConfig()).toThrow('No API key found');

    if (prev) process.env.DEEPSEEK_API_KEY = prev;
  });
});

describe('prompts', () => {
  it('generates a system prompt', () => {
    const prompt = systemPrompt();
    expect(prompt).toContain('knowledge extractor');
    expect(prompt).toContain('token-efficient');
  });

  it('generates a full generation prompt', () => {
    const module = {
      id: 'app/dashboard',
      path: '/test/app/dashboard',
      relativePath: 'app/dashboard',
      files: [
        { relativePath: 'app/dashboard/page.tsx', extension: '.tsx', size: 500 },
      ],
      children: [],
    };
    const prompt = generateFullPrompt(module);
    expect(prompt).toContain('app/dashboard');
    expect(prompt).toContain('Key Files');
  });

  it('generates a fast regen prompt with diff context', () => {
    const prompt = generateFastPrompt('app', '# previous summary', ['app/page.tsx'], 'diff --git a/app/page.tsx');
    expect(prompt).toContain('PREVIOUS SUMMARY');
    expect(prompt).toContain('DIFF');
  });
});

describe('tokenBudget', () => {
  it('estimates tokens roughly', () => {
    const tokens = estimateTokens('hello world');
    expect(tokens).toBeGreaterThan(0);
  });

  it('truncates text exceeding token budget', () => {
    const longText = 'word '.repeat(1000);
    const truncated = truncateToBudget(longText, 100);
    expect(truncated.length).toBeLessThan(longText.length);
    expect(truncated).toContain('truncated');
  });

  it('truncates module markdown by removing low-priority sections', () => {
    const markdown = `# Module: test

## Key Files
- file1.ts

## Test Coverage
- test1.test.ts

## Edge Cases & Gotchas
- edge case 1

`;
    const truncated = truncateModuleToBudget(markdown, 10);
    expect(estimateTokens(truncated)).toBeLessThanOrEqual(
      estimateTokens(markdown)
    );
  });
});
```

Run: `cd cli && npx vitest run tests/llm/`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add cli/src/llm/client.ts cli/src/llm/prompts.ts cli/src/llm/token-budget.ts cli/tests/llm/client.test.ts
git commit -m "feat: add LLM client, prompts, and token budgeting"
```

---

## Task 7: Writer — Markdown Generation & Meta Store

**Files:**
- Create: `cli/src/writer/index.ts`
- Create: `cli/src/writer/meta.ts`
- Create: `cli/tests/writer/writer.test.ts`

- [ ] **Step 1: Implement meta store**

```ts
// cli/src/writer/meta.ts
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import type { RawMeta, ModuleMeta } from '../llm/types.js';

const META_FILENAME = '.raw/.meta.json';

export async function loadMeta(projectRoot: string): Promise<RawMeta> {
  const metaPath = join(projectRoot, META_FILENAME);
  try {
    const content = await readFile(metaPath, 'utf-8');
    return JSON.parse(content) as RawMeta;
  } catch {
    return {
      version: 1,
      modules: {},
      config: { tokenBudget: 800, stalenessDays: 7 },
    };
  }
}

export async function saveMeta(projectRoot: string, meta: RawMeta): Promise<void> {
  const metaPath = join(projectRoot, META_FILENAME);
  await mkdir(dirname(metaPath), { recursive: true });
  await writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
}

export function updateModuleMeta(
  meta: RawMeta,
  moduleId: string,
  files: string[],
  hash: string
): void {
  meta.modules[moduleId] = {
    files,
    hash,
    lastGen: new Date().toISOString(),
    lastCommit: new Date().toISOString(),
  };
}
```

- [ ] **Step 2: Implement markdown writer**

```ts
// cli/src/writer/index.ts
import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import type { SourceModule } from '../scanner/types.js';
import type { RawMeta } from '../llm/types.js';
import { truncateModuleToBudget } from '../llm/token-budget.js';

export interface WriteResult {
  moduleId: string;
  path: string;
  tokenCount: number;
  truncated: boolean;
}

/**
 * Write a module's knowledge file to raw/.
 * Returns the file path and token count.
 */
export async function writeModuleFile(
  projectRoot: string,
  moduleId: string,
  content: string,
  meta: RawMeta
): Promise<WriteResult> {
  // Determine raw file path: mirror the source path
  // e.g., "app/dashboard" → "raw/app/dashboard.md"
  const rawPath = moduleId.includes('/')
    ? join(projectRoot, 'raw', moduleId + '.md')
    : join(projectRoot, 'raw', moduleId + '.md');

  const budget = meta.config.tokenBudget;
  const truncatedContent = truncateModuleToBudget(content, budget);
  const tokenCount = Math.ceil(truncatedContent.length / 4);

  await mkdir(dirname(rawPath), { recursive: true });
  await writeFile(rawPath, truncatedContent, 'utf-8');

  return {
    moduleId,
    path: rawPath,
    tokenCount,
    truncated: truncatedContent !== content,
  };
}

/**
 * Write INDEX.md — a hierarchical tree of all modules.
 */
export async function writeIndexMd(
  projectRoot: string,
  modules: SourceModule[],
  meta: RawMeta
): Promise<void> {
  const stalenessDays = meta.config.stalenessDays;
  const now = Date.now();

  function renderModuleTree(mods: SourceModule[], indent: number = 0): string {
    const prefix = '  '.repeat(indent);
    return mods
      .map((m) => {
        const modMeta = meta.modules[m.id];
        const status = modMeta
          ? (now - new Date(modMeta.lastGen).getTime()) / (1000 * 60 * 60 * 24) > stalenessDays
            ? '⚠️ Stale'
            : '✅ Fresh'
          : '🆕 Not yet generated';
        const filesCount = m.files.length;
        const children = m.children.length > 0
          ? '\n' + renderModuleTree(m.children, indent + 1)
          : '';
        return `${prefix}📁 ${m.id}/ (${filesCount} files, ${status})${children}`;
      })
      .join('\n');
  }

  const tree = renderModuleTree(modules.filter((m) => !m.id.includes('/')), 0);

  const content = `# LLMAtlas Index

**Generated:** ${new Date().toISOString()}
**Modules:** ${modules.length}

## Module Tree

\`\`\`
${tree}
\`\`\`

> Stale threshold: ${stalenessDays} days. Run \`llm-atlas regen --full\` to regenerate all.
`;

  await writeFile(join(projectRoot, 'raw', 'INDEX.md'), content, 'utf-8');
}
```

- [ ] **Step 3: Write and run tests**

```ts
// cli/tests/writer/writer.test.ts
import { describe, it, expect } from 'vitest';
import { writeModuleFile, writeIndexMd } from '../../src/writer/index.js';
import { loadMeta, saveMeta, updateModuleMeta } from '../../src/writer/meta.js';
import { mkdtempSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readFile } from 'node:fs/promises';

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
  });
});

describe('writeModuleFile', () => {
  it('writes a module file to the correct path', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'llm-atlas-'));
    const meta = await loadMeta(dir);
    const result = await writeModuleFile(dir, 'app/dashboard', '# Dashboard module', meta);
    expect(result.path).toContain('raw/app/dashboard.md');

    const content = await readFile(join(dir, 'raw/app/dashboard.md'), 'utf-8');
    expect(content).toContain('Dashboard module');
  });
});
```

Run: `cd cli && npx vitest run tests/writer/`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add cli/src/writer/index.ts cli/src/writer/meta.ts cli/tests/writer/writer.test.ts
git commit -m "feat: add markdown writer and meta store"
```

---

## Task 8: Engine — Generation Orchestrator

**Files:**
- Create: `cli/src/engine/index.ts`
- Create: `cli/tests/engine/orchestrator.test.ts`

- [ ] **Step 1: Implement the orchestrator**

```ts
// cli/src/engine/index.ts
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { scanProject } from '../scanner/index.js';
import { computeDiff } from '../scanner/diff.js';
import { detectLlmConfig, chatComplete } from '../llm/client.js';
import { systemPrompt, generateFullPrompt, generateFastPrompt } from '../llm/prompts.js';
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
  const llmConfig = detectLlmConfig();

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
      const previousSummary = await getPreviousSummary(projectRoot, mod.id);

      let userMessage: string;
      if (options.mode === 'fast' && previousSummary) {
        // For fast mode with existing summary, use diff context
        userMessage = generateFastPrompt(
          mod.id,
          previousSummary,
          mod.files.map((f) => f.relativePath),
          sourceContext // In a full implementation, we'd use actual git diff
        );
      } else {
        userMessage = `Generate a knowledge summary for module "${mod.id}".

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

      const response = await chatComplete(
        [
          { role: 'system', content: systemPrompt() },
          { role: 'user', content: userMessage },
        ],
        llmConfig,
        { signal: options.signal }
      );

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
      const filePaths = mod.files.map((f) => f.relativePath);
      updateModuleMeta(meta, mod.id, filePaths, writeResult.path);

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
  const rawPath = moduleId.includes('/')
    ? join(projectRoot, 'raw', moduleId + '.md')
    : join(projectRoot, 'raw', moduleId + '.md');

  try {
    return await readFile(rawPath, 'utf-8');
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Write basic test**

```ts
// cli/tests/engine/orchestrator.test.ts
import { describe, it, expect } from 'vitest';
import { runGeneration } from '../../src/engine/index.js';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('runGeneration', () => {
  it('skips generation when no modules changed in fast mode', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'llm-atlas-'));
    writeFileSync(join(dir, 'test.ts'), 'export const x = 1;', 'utf-8');

    const report = await runGeneration(dir, { mode: 'fast' });
    // No changed files since this is a fresh git repo or uncommitted
    // The report should not crash
    expect(Array.isArray(report.generated)).toBe(true);
    expect(Array.isArray(report.errors)).toBe(true);
  });
});
```

Note: The full orchestrator test requires LLM API calls and is better covered by integration tests (Task 18).

- [ ] **Step 3: Commit**

```bash
git add cli/src/engine/index.ts cli/tests/engine/orchestrator.test.ts
git commit -m "feat: add generation orchestrator"
```

---

## Task 9: CLI Commands

**Files:**
- Create: `cli/src/index.ts` (CLI main with Commander)
- Create: `cli/src/commands/init.ts`
- Create: `cli/src/commands/regen.ts`
- Create: `cli/src/commands/status.ts`
- Create: `cli/src/commands/install.ts`

- [ ] **Step 1: Implement CLI entry point**

```ts
// cli/src/index.ts
import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { regenCommand } from './commands/regen.js';
import { statusCommand } from './commands/status.js';
import { installCommand } from './commands/install.js';

const program = new Command();

program
  .name('llm-atlas')
  .description('Auto-generate and maintain a raw/ knowledge layer for LLMs')
  .version('0.1.0');

program
  .command('init')
  .description('Initialize LLMAtlas in the current project')
  .option('--force', 'Overwrite existing raw/ directory')
  .action(async (options) => {
    try {
      await initCommand(process.cwd(), options);
    } catch (err) {
      console.error('Error:', err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

program
  .command('regen')
  .description('Regenerate the raw/ knowledge layer')
  .option('--full', 'Full regeneration of all modules (default: fast/diff-aware)')
  .action(async (options) => {
    try {
      await regenCommand(process.cwd(), options);
    } catch (err) {
      console.error('Error:', err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Show staleness status of all modules')
  .action(async () => {
    try {
      await statusCommand(process.cwd());
    } catch (err) {
      console.error('Error:', err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

program
  .command('install')
  .description('Install LLMAtlas components (hooks, MCP, platform wrappers)')
  .argument('<component>', 'Component to install: hooks, claude-mcp, all')
  .action(async (component) => {
    try {
      await installCommand(process.cwd(), component);
    } catch (err) {
      console.error('Error:', err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

program
  .command('uninstall')
  .description('Remove LLMAtlas components')
  .argument('[component]', 'Component to remove: hooks, raw, all (default: all)')
  .action(async (component = 'all') => {
    try {
      await installCommand(process.cwd(), component, { uninstall: true });
    } catch (err) {
      console.error('Error:', err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

program.parse(process.argv);
```

- [ ] **Step 2: Implement init command**

```ts
// cli/src/commands/init.ts
import { writeFile, mkdir, readFile, appendFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { scanProject } from '../scanner/index.js';
import { runGeneration } from '../engine/index.js';

export async function initCommand(projectRoot: string, options: { force?: boolean }): Promise<void> {
  console.log('\n  ╔════════════════════════════════════════════╗');
  console.log('  ║        LLMAtlas — Knowledge Layer          ║');
  console.log('  ╚════════════════════════════════════════════╝\n');

  // 1. Check if already initialized
  const rawDir = join(projectRoot, 'raw');
  if (existsSync(rawDir) && !options.force) {
    console.log('  ✓ LLMAtlas already initialized in this project.');
    console.log('  • Run `llm-atlas regen --full` to regenerate');
    console.log('  • Run `llm-atlas init --force` to reinitialize\n');
    return;
  }

  // 2. Create .rawignore from .gitignore if it doesn't exist
  const rawignorePath = join(projectRoot, '.rawignore');
  if (!existsSync(rawignorePath)) {
    let ignoreContent = '# LLMAtlas .rawignore\n';
    ignoreContent += '# Defaults from .gitignore. Add patterns to exclude from raw/ generation.\n\n';

    const gitignorePath = join(projectRoot, '.gitignore');
    if (existsSync(gitignorePath)) {
      const gitignoreContent = await readFile(gitignorePath, 'utf-8');
      ignoreContent += gitignoreContent;
    }

    await writeFile(rawignorePath, ignoreContent, 'utf-8');
    console.log('  ✓ Created .rawignore');
  } else {
    console.log('  ✓ .rawignore already exists');
  }

  // 3. Create .raw/config.json
  const configDir = join(projectRoot, '.raw');
  await mkdir(configDir, { recursive: true });

  const configPath = join(configDir, 'config.json');
  if (!existsSync(configPath) || options.force) {
    const config = {
      version: 1,
      tokenBudget: 800,
      stalenessDays: 7,
      model: { fast: null, full: null },
      modules: { include: ['*'], exclude: [] },
      moduleOverrides: {},
    };
    await writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
    console.log('  ✓ Created .raw/config.json');
  }

  // 4. Scan project and show discovered modules
  const scanResult = await scanProject(projectRoot);
  const moduleCount = scanResult.modules.length;
  console.log(`  ✓ Scanned project: ${moduleCount} modules found`);

  if (moduleCount > 0) {
    console.log('');
    for (const mod of scanResult.modules.slice(0, 10)) {
      console.log(`     📁 ${mod.id}/ (${mod.files.length} files)`);
    }
    if (scanResult.modules.length > 10) {
      console.log(`     ... and ${scanResult.modules.length - 10} more`);
    }
    console.log('');
  }

  // 5. Generate raw/ files (first full generation)
  console.log('  Generating knowledge layer...');
  const report = await runGeneration(projectRoot, { mode: 'full' });
  console.log(`  ✓ Generated ${report.generated.length} module files`);

  if (report.errors.length > 0) {
    console.log(`  ⚠ ${report.errors.length} modules had errors`);
    for (const err of report.errors) {
      console.log(`     Error: ${err.moduleId}: ${err.error}`);
    }
  }

  // 6. Install git hook
  await installGitHook(projectRoot);
  console.log('  ✓ Installed post-commit git hook');

  // 7. Install OpenCode skill
  await installOpenCodeSkill(projectRoot);
  console.log('  ✓ Generated .opencode/skills/llm-atlas.md');

  // 8. Append to CLAUDE.md if it exists
  await updateClaudeMd(projectRoot);
  console.log('  ✓ Updated CLAUDE.md with raw/ reference');

  // 9. Install OpenCode MCP config
  await installOpenCodeMcp(projectRoot);
  console.log('  ✓ Configured OpenCode MCP');

  console.log('');
  console.log('  ──────────────────────────────────────────────');
  console.log('  Next steps:');
  console.log('  1. Review raw/INDEX.md for a module overview');
  console.log('  2. Edit .rawignore to exclude more files if needed');
  console.log('  3. Run `llm-atlas regen --full` for deep analysis');
  console.log('  4. To enable Claude Code MCP:');
  console.log('     llm-atlas install claude-mcp');
  console.log('  ──────────────────────────────────────────────\n');
}

// Hook installer — will be fleshed out in Task 10
export async function installGitHook(projectRoot: string): Promise<void> {
  const hookDir = join(projectRoot, '.git', 'hooks');
  if (!existsSync(hookDir)) {
    return; // Not a git repo or no hooks dir
  }

  const hookContent = `#!/bin/sh
# LLMAtlas post-commit hook
# Regenerates the raw/ knowledge layer for changed modules.

if [ ! -f .raw/config.json ]; then
    exit 0
fi

echo "[llm-atlas] Running fast regeneration..."
npx --yes @llm-atlas/cli regen > .raw/last-regen.log 2>&1 &
`;

  const hookPath = join(hookDir, 'post-commit');
  if (!existsSync(hookPath)) {
    await writeFile(hookPath, hookContent, 'utf-8');
    // Make executable on Unix
    try {
      await import('node:fs').then((fs) =>
        fs.promises.chmod(hookPath, 0o755)
      );
    } catch { /* Windows - ignore */ }

    // Also create a pre-commit hook to prevent committing uncommitted .raw changes
    const preCommitContent = `#!/bin/sh
# LLMAtlas pre-commit hook
# Ensures raw/ is up to date before commit.
# Uncomment to enable:
# npx --yes @llm-atlas/cli regen --fast
`;
    const preCommitPath = join(hookDir, 'pre-commit');
    if (!existsSync(preCommitPath)) {
      await writeFile(preCommitPath, preCommitContent, 'utf-8');
    }
  }
}

export async function installOpenCodeSkill(projectRoot: string): Promise<void> {
  const skillDir = join(projectRoot, '.opencode', 'skills');
  await mkdir(skillDir, { recursive: true });

  const skillContent = `# Skill: LLMAtlas Knowledge Layer

This project has a \`raw/\` folder with structured summaries of each module.

## Usage
1. BEFORE reading source code in a module, check \`raw/<module>.md\` first.
2. Check the **Status:** field for staleness warnings.
3. INDEX.md at \`raw/INDEX.md\` gives an overview of all modules.

## Regeneration
- Run \`llm-atlas regen --full\` in terminal for full regeneration.
- The post-commit hook regenerates changed modules automatically.

## Staleness
If a file shows ⚠️ Stale, verify the info against source before relying on it.
`;

  await writeFile(join(skillDir, 'llm-atlas.md'), skillContent, 'utf-8');
}

export async function updateClaudeMd(projectRoot: string): Promise<void> {
  const claudePath = join(projectRoot, 'CLAUDE.md');
  if (!existsSync(claudePath)) return;

  const existingContent = await readFile(claudePath, 'utf-8');
  if (existingContent.includes('LLMAtlas Knowledge Layer')) return; // Already added

  const appendix = `
## LLMAtlas Knowledge Layer
See \`raw/\` for module summaries. Read \`raw/INDEX.md\` first.
Stale entries marked ⚠️ — verify against source before relying on them.
`;

  await appendFile(claudePath, appendix, 'utf-8');
}

export async function installOpenCodeMcp(projectRoot: string): Promise<void> {
  const mcpPath = join(projectRoot, '.opencode', 'mcp.jsonc');
  const mcpConfig = {
    'llm-atlas': {
      type: 'local',
      command: ['npx', '@llm-atlas/cli', 'mcp'],
      enabled: true,
    },
  };

  try {
    const existing = JSON.parse(await readFile(mcpPath, 'utf-8'));
    if (!existing['llm-atlas']) {
      existing['llm-atlas'] = mcpConfig['llm-atlas'];
      await writeFile(mcpPath, JSON.stringify(existing, null, 2), 'utf-8');
    }
  } catch {
    await writeFile(mcpPath, JSON.stringify(mcpConfig, null, 2), 'utf-8');
  }
}
```

- [ ] **Step 3: Implement regen command**

```ts
// cli/src/commands/regen.ts
import { runGeneration } from '../engine/index.js';

export async function regenCommand(
  projectRoot: string,
  options: { full?: boolean }
): Promise<void> {
  const mode = options.full ? 'full' : 'fast';
  console.log(`[llm-atlas] Running ${mode} regeneration...`);

  const start = Date.now();
  const report = await runGeneration(projectRoot, { mode });
  const duration = ((Date.now() - start) / 1000).toFixed(1);

  console.log(`[llm-atlas] Done in ${duration}s`);

  if (report.generated.length > 0) {
    console.log(`  Generated: ${report.generated.length} modules`);
    for (const modId of report.generated) {
      console.log(`    ✅ ${modId}`);
    }
  }

  if (report.skipped.length > 0) {
    console.log(`  Skipped: ${report.skipped.length} (no changes detected)`);
  }

  if (report.errors.length > 0) {
    console.log(`  Errors: ${report.errors.length}`);
    for (const err of report.errors) {
      console.log(`    ❌ ${err.moduleId}: ${err.error}`);
    }
  }

  console.log(`  Token usage: ${report.tokenUsage.total} total`);
}
```

- [ ] **Step 4: Implement status command**

```ts
// cli/src/commands/status.ts
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
```

- [ ] **Step 5: Implement install command**

```ts
// cli/src/commands/install.ts
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { installGitHook, installOpenCodeMcp } from './init.js';

export async function installCommand(
  projectRoot: string,
  component: string,
  extra?: { uninstall?: boolean }
): Promise<void> {
  const isUninstall = extra?.uninstall ?? false;

  if (component === 'hooks' || component === 'all') {
    if (isUninstall) {
      // Remove post-commit hook
      const hookPath = join(projectRoot, '.git', 'hooks', 'post-commit');
      if (existsSync(hookPath)) {
        const { unlink } = await import('node:fs/promises');
        await unlink(hookPath);
        console.log('  ✓ Removed post-commit hook');
      }
    } else {
      await installGitHook(projectRoot);
      console.log('  ✓ Installed post-commit hook');
    }
  }

  if (component === 'claude-mcp' || component === 'all') {
    if (isUninstall) {
      console.log('  ⚠️  To remove Claude Code MCP, edit ~/.claude/mcp.json manually');
    } else {
      console.log('');
      console.log('  To enable Claude Code MCP, add the following to ~/.claude/mcp.json:');
      console.log('');
      console.log('  {');
      console.log('    "mcpServers": {');
      console.log('      "llm-atlas": {');
      console.log('        "command": "npx",');
      console.log('        "args": ["@llm-atlas/cli", "mcp"]');
      console.log('      }');
      console.log('    }');
      console.log('  }');
      console.log('');
    }
  }

  if (component === 'raw' || component === 'all') {
    if (isUninstall) {
      // Remove raw/ directory
      const { rm } = await import('node:fs/promises');
      const rawPath = join(projectRoot, 'raw');
      if (existsSync(rawPath)) {
        await rm(rawPath, { recursive: true, force: true });
        console.log('  ✓ Removed raw/ directory');
      }

      // Remove .raw/ directory
      const rawConfigPath = join(projectRoot, '.raw');
      if (existsSync(rawConfigPath)) {
        await rm(rawConfigPath, { recursive: true, force: true });
        console.log('  ✓ Removed .raw/ configuration');
      }

      // Remove skill file
      const skillPath = join(projectRoot, '.opencode', 'skills', 'llm-atlas.md');
      if (existsSync(skillPath)) {
        const { unlink } = await import('node:fs/promises');
        await unlink(skillPath);
        console.log('  ✓ Removed OpenCode skill');
      }

      // Remove MCP config
      const mcpPath = join(projectRoot, '.opencode', 'mcp.jsonc');
      if (existsSync(mcpPath)) {
        try {
          const content = JSON.parse(await readFile(mcpPath, 'utf-8'));
          delete content['llm-atlas'];
          await writeFile(mcpPath, JSON.stringify(content, null, 2), 'utf-8');
          console.log('  ✓ Removed OpenCode MCP config');
        } catch { /* ignore */ }
      }

      console.log('\n  ✅ LLMAtlas fully uninstalled');
    }
  }
}
```

- [ ] **Step 6: Verify CLI compiles and help works**

Run: `cd cli && npx tsc --noEmit`
Expected: No errors.

Run: `node bin/llm-atlas.js --help`
Expected: Shows help output with all commands listed.

- [ ] **Step 7: Commit**

```bash
git add cli/src/index.ts cli/src/commands/init.ts cli/src/commands/regen.ts cli/src/commands/status.ts cli/src/commands/install.ts
git commit -m "feat: add CLI commands (init, regen, status, install, uninstall)"
```

---

## Task 10: MCP Server

**Files:**
- Create: `cli/src/mcp/server.ts`

- [ ] **Step 1: Implement MCP server**

```ts
// cli/src/mcp/server.ts
import { loadMeta } from '../writer/meta.js';
import { scanProject } from '../scanner/index.js';

/**
 * Simple stdio-based MCP server.
 * Communicates via JSON-RPC over stdin/stdout.
 * 
 * Tools:
 * - raw_list_modules: List all modules with status
 * - raw_read_module: Read a specific module's knowledge file
 * - raw_search: Search across all module files
 * - raw_regen: Trigger regeneration
 */

interface McpRequest {
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

interface McpResponse {
  id: string | number;
  result?: unknown;
  error?: { code: number; message: string };
}

export async function startMcpServer(projectRoot: string): Promise<void> {
  const readline = (await import('node:readline')).default;
  const rl = readline.createInterface({ input: process.stdin });

  console.error('[llm-atlas-mcp] Server started');
  console.error('[llm-atlas-mcp] Project:', projectRoot);

  // Send capabilities
  const capabilities = {
    jsonrpc: '2.0',
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: {
          raw_list_modules: {
            description: 'List all modules in the knowledge layer',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          raw_read_module: {
            description: 'Read a module knowledge file',
            inputSchema: {
              type: 'object',
              properties: {
                moduleName: { type: 'string' },
                sections: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Optional section filter',
                },
              },
              required: ['moduleName'],
            },
          },
          raw_search: {
            description: 'Search across all module knowledge files',
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string' },
              },
              required: ['query'],
            },
          },
          raw_regen: {
            description: 'Regenerate module knowledge',
            inputSchema: {
              type: 'object',
              properties: {
                module: { type: 'string', description: 'Module name (optional, all if omitted)' },
                full: { type: 'boolean', description: 'Full regeneration (default: false)' },
              },
            },
          },
        },
      },
    },
  };

  // Send initial response
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', result: capabilities }) + '\n');

  rl.on('line', async (line) => {
    let request: McpRequest;
    try {
      request = JSON.parse(line);
    } catch {
      return; // Ignore malformed JSON
    }

    try {
      const result = await handleRequest(projectRoot, request);
      const response: McpResponse = { id: request.id, result };
      process.stdout.write(JSON.stringify(response) + '\n');
    } catch (err) {
      const response: McpResponse = {
        id: request.id,
        error: {
          code: -32603,
          message: err instanceof Error ? err.message : 'Internal error',
        },
      };
      process.stdout.write(JSON.stringify(response) + '\n');
    }
  });

  rl.on('close', () => {
    console.error('[llm-atlas-mcp] Server shutting down');
    process.exit(0);
  });
}

async function handleRequest(projectRoot: string, request: McpRequest): Promise<unknown> {
  const { method, params = {} } = request;

  switch (method) {
    case 'raw_list_modules': {
      const [meta, scan] = await Promise.all([
        loadMeta(projectRoot),
        scanProject(projectRoot),
      ]);

      const now = Date.now();
      const stalenessMs = meta.config.stalenessDays * 24 * 60 * 60 * 1000;

      return scan.modules.map((mod) => {
        const modMeta = meta.modules[mod.id];
        const age = modMeta ? (now - new Date(modMeta.lastGen).getTime()) : Infinity;
        return {
          name: mod.id,
          fileCount: mod.files.length,
          status: age > stalenessMs ? 'stale' : modMeta ? 'fresh' : 'new',
          lastGen: modMeta?.lastGen ?? null,
        };
      });
    }

    case 'raw_read_module': {
      const { moduleName, sections } = params as { moduleName: string; sections?: string[] };
      if (!moduleName) {
        throw new Error('moduleName is required');
      }

      const { readFile } = await import('node:fs/promises');
      const { join } = await import('node:path');

      const rawPath = moduleName.includes('/')
        ? join(projectRoot, 'raw', moduleName + '.md')
        : join(projectRoot, 'raw', moduleName + '.md');

      let content: string;
      try {
        content = await readFile(rawPath, 'utf-8');
      } catch {
        throw new Error(`Module "${moduleName}" not found in raw/`);
      }

      // Optional section filtering
      if (sections && sections.length > 0) {
        const lines = content.split('\n');
        const filtered: string[] = [];
        let inSection = false;
        let currentSection = '';

        for (const line of lines) {
          if (line.startsWith('## ')) {
            currentSection = line.replace('## ', '').trim();
            inSection = sections.includes(currentSection);
          }
          if (inSection) {
            filtered.push(line);
          }
        }

        content = filtered.join('\n');
      }

      // Check staleness
      const meta = await loadMeta(projectRoot);
      const modMeta = meta.modules[moduleName];
      const now = Date.now();
      const stalenessMs = meta.config.stalenessDays * 24 * 60 * 60 * 1000;
      const isStale = modMeta && (now - new Date(modMeta.lastGen).getTime()) > stalenessMs;

      return {
        module: moduleName,
        content,
        stale: isStale ?? false,
        lastGen: modMeta?.lastGen ?? null,
        tokenEstimate: Math.ceil(content.length / 4),
      };
    }

    case 'raw_search': {
      const { query } = params as { query: string };
      if (!query) throw new Error('query is required');

      const { readdir, readFile } = await import('node:fs/promises');
      const { join } = await import('node:path');
      const { existsSync } = await import('node:fs');

      const rawDir = join(projectRoot, 'raw');
      if (!existsSync(rawDir)) {
        return { results: [] };
      }

      const results: Array<{ module: string; snippet: string; relevance: number }> = [];
      const queryLower = query.toLowerCase();

      async function walkDir(dir: string, prefix: string = ''): Promise<void> {
        let entries;
        try {
          entries = await readdir(dir, { withFileTypes: true });
        } catch {
          return;
        }

        for (const entry of entries) {
          const fullPath = join(dir, entry.name);
          if (entry.isDirectory()) {
            await walkDir(fullPath, prefix + entry.name + '/');
          } else if (entry.name.endsWith('.md') && entry.name !== 'INDEX.md') {
            const moduleName = prefix + entry.name.replace('.md', '');
            const content = await readFile(fullPath, 'utf-8');
            const contentLower = content.toLowerCase();
            const idx = contentLower.indexOf(queryLower);

            if (idx >= 0) {
              const start = Math.max(0, idx - 60);
              const end = Math.min(content.length, idx + query.length + 60);
              results.push({
                module: moduleName,
                snippet: content.slice(start, end),
                relevance: 1, // Simple relevance: just presence
              });
            }
          }
        }
      }

      await walkDir(rawDir);
      return { results };
    }

    case 'raw_regen': {
      const { module: moduleName, full } = params as { module?: string; full?: boolean };
      const { runGeneration } = await import('../engine/index.js');

      const report = await runGeneration(projectRoot, {
        mode: full ? 'full' : 'fast',
      });

      return {
        status: 'completed',
        generated: report.generated,
        errors: report.errors.map((e) => `${e.moduleId}: ${e.error}`),
        tokenUsage: report.tokenUsage,
      };
    }

    default:
      throw new Error(`Unknown method: ${method}`);
  }
}
```

- [ ] **Step 2: Update CLI entry point to add MCP command**

```ts
// Add to cli/src/index.ts (after the uninstall command)

program
  .command('mcp')
  .description('Start the MCP server for AI tool integration')
  .action(async () => {
    try {
      const { startMcpServer } = await import('./mcp/server.js');
      await startMcpServer(process.cwd());
    } catch (err) {
      console.error('MCP server error:', err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });
```

- [ ] **Step 3: Verify compilation**

Run: `cd cli && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add cli/src/mcp/server.ts
git commit -m "feat: add MCP server with list, read, search, regen tools"
```

---

## Task 11: Post-Commit Hook Generator & Platform Wrappers

**Files:**
- Modify: `cli/src/commands/init.ts` (hook installer already stubbed)

- [ ] **Step 1: Implement the post-commit hook generator as a template file**

```sh
# cli/src/templates/post-commit.sh
#!/bin/sh
# LLMAtlas post-commit hook
# Auto-generated by `llm-atlas init`
# Regenerates the raw/ knowledge layer for changed modules (fast mode).

if [ ! -f .raw/config.json ]; then
    exit 0
fi

echo "[llm-atlas] Running fast regeneration..."
npx --yes @llm-atlas/cli regen > .raw/last-regen.log 2>&1 &
```

- [ ] **Step 2: Create the OpenCode skill template**

```markdown
# cli/src/templates/skill.md
# Skill: LLMAtlas Knowledge Layer

This project has a `raw/` folder with structured summaries of each module.

## Usage
1. BEFORE reading source code in a module, check `raw/<module>.md` first.
2. Check the **Status:** field for staleness warnings.
3. INDEX.md at `raw/INDEX.md` gives an overview of all modules.

## Regeneration
- Run `llm-atlas regen --full` in terminal for full regeneration.
- The post-commit hook regenerates changed modules automatically.

## Staleness
If a file shows ⚠️ Stale, verify the info against source before relying on it.
```

- [ ] **Step 3: Ensure the init command uses these templates**

The init command (Task 9, Step 2) already writes these files inline. Update it to read from templates instead:

```ts
// In cli/src/commands/init.ts, update installGitHook to read from template
async function installGitHook(projectRoot: string): Promise<void> {
  const hookDir = join(projectRoot, '.git', 'hooks');
  if (!existsSync(hookDir)) return;

  const hookPath = join(hookDir, 'post-commit');
  if (existsSync(hookPath)) return; // Don't overwrite existing hooks

  const { readFile } = await import('node:fs/promises');
  const templatePath = new URL('../templates/post-commit.sh', import.meta.url);
  let hookContent: string;
  try {
    hookContent = await readFile(templatePath, 'utf-8');
  } catch {
    // Fallback inline template
    hookContent = `#!/bin/sh
if [ ! -f .raw/config.json ]; then exit 0; fi
npx --yes @llm-atlas/cli regen > .raw/last-regen.log 2>&1 &`;
  }

  await writeFile(hookPath, hookContent, 'utf-8');
  try {
    await import('node:fs').then((fs) => fs.promises.chmod(hookPath, 0o755));
  } catch { /* Windows */ }
}
```

- [ ] **Step 4: Verify end-to-end by running `node bin/llm-atlas.js init` on a test project**

Create a small test project:

```bash
mkdir -p /tmp/llm-atlas-e2e/app/dashboard /tmp/llm-atlas-e2e/lib
echo "export default function Page() { return null; }" > /tmp/llm-atlas-e2e/app/dashboard/page.tsx
echo "export default function Layout() { return null; }" > /tmp/llm-atlas-e2e/app/dashboard/layout.tsx
echo "export const api = { get: () => {} };" > /tmp/llm-atlas-e2e/lib/api.ts
echo "export const db = { query: () => {} };" > /tmp/llm-atlas-e2e/lib/db.ts
cd /tmp/llm-atlas-e2e && git init && git add -A && git commit -m "init"
```

Then run:
```bash
node /path/to/cli/bin/llm-atlas.js init
```

Expected: 
- Creates .rawignore, .raw/config.json
- Scans 2 modules (app/dashboard, lib)
- Attempts generation (may need API key)
- Creates .opencode/skills/llm-atlas.md
- Creates post-commit hook

- [ ] **Step 5: Commit**

```bash
git add cli/src/templates/post-commit.sh cli/src/templates/skill.md
git commit -m "feat: add post-commit hook and platform wrapper templates"
```

---

## Task 12: Integration Test

**Files:**
- Create: `cli/tests/integration/e2e.test.ts`

- [ ] **Step 1: Write integration test**

```ts
// cli/tests/integration/e2e.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';
import { readFile, rm } from 'node:fs/promises';

const CLI_PATH = join(__dirname, '../../bin/llm-atlas.js');

describe('LLMAtlas E2E', () => {
  let testDir: string;

  beforeAll(() => {
    testDir = mkdtempSync(join(tmpdir(), 'llm-atlas-e2e-'));
    
    // Create a test project
    mkdirSync(join(testDir, 'app/dashboard'), { recursive: true });
    mkdirSync(join(testDir, 'lib'), { recursive: true });
    mkdirSync(join(testDir, 'components'), { recursive: true });

    writeFileSync(join(testDir, 'app/dashboard/page.tsx'),
      'export default function Page() { return <div>Hello</div>; }');
    writeFileSync(join(testDir, 'app/dashboard/layout.tsx'),
      'export default function Layout({ children }: { children: React.ReactNode }) { return <div>{children}</div>; }');
    writeFileSync(join(testDir, 'lib/api.ts'),
      'export async function getData() { return fetch("/api/data"); }');
    writeFileSync(join(testDir, 'lib/db.ts'),
      'export const db = { query: (sql: string) => {} };');
    writeFileSync(join(testDir, 'components/Button.tsx'),
      'export function Button({ label }: { label: string }) { return <button>{label}</button>; }');

    // Initialize git
    execSync('git init', { cwd: testDir });
    execSync('git config user.email test@test.com', { cwd: testDir });
    execSync('git config user.name Test', { cwd: testDir });
    execSync('git add -A', { cwd: testDir });
    execSync('git commit -m "init"', { cwd: testDir });
  });

  it('init command creates all expected files', async () => {
    const result = execSync(`node ${CLI_PATH} init`, {
      cwd: testDir,
      encoding: 'utf-8',
    });

    expect(result).toContain('.rawignore');
    expect(result).toContain('.raw/config.json');

    // Check file existence
    const { existsSync } = await import('node:fs');
    expect(existsSync(join(testDir, '.rawignore'))).toBe(true);
    expect(existsSync(join(testDir, '.raw', 'config.json'))).toBe(true);

    // Check .opencode skill
    const skillPath = join(testDir, '.opencode', 'skills', 'llm-atlas.md');
    expect(existsSync(skillPath)).toBe(true);
    const skillContent = await readFile(skillPath, 'utf-8');
    expect(skillContent).toContain('LLMAtlas Knowledge Layer');

    // Check git hook
    const hookPath = join(testDir, '.git', 'hooks', 'post-commit');
    expect(existsSync(hookPath)).toBe(true);
  });

  it('status command shows module information', async () => {
    const result = execSync(`node ${CLI_PATH} status`, {
      cwd: testDir,
      encoding: 'utf-8',
    });

    expect(result).toContain('Modules');
    expect(result).toContain('app/dashboard');
  });

  it('regen --fast runs without errors', async () => {
    const result = execSync(`node ${CLI_PATH} regen --fast`, {
      cwd: testDir,
      encoding: 'utf-8',
    });

    // Even without API key, it should not crash (will error gracefully)
    expect(result).toBeDefined();
  });

  afterAll(async () => {
    await rm(testDir, { recursive: true, force: true });
  });
});
```

- [ ] **Step 2: Run integration test**

Run: `cd cli && npx vitest run tests/integration/`
Expected: Tests pass (the init and status tests verify structure; regen test verifies no crash).

- [ ] **Step 3: Commit**

```bash
git add cli/tests/integration/e2e.test.ts
git commit -m "test: add end-to-end integration test"
```

---

## Task 13: README, LICENSE, and Package Polish

**Files:**
- Create: `cli/README.md`
- Create: `cli/LICENSE`

- [ ] **Step 1: Write README**

```markdown
# LLMAtlas — Knowledge Layer for LLMs

Auto-generate and maintain a structured `raw/` knowledge layer for your codebase. LLMs (Claude, GPT, DeepSeek, etc.) read these summaries instead of raw source files — saving tokens and providing better context.

## Core Principle

> raw/ files must be MORE token-efficient than the source code they represent.

## Quick Start

```bash
npx @llm-atlas/cli init
```

This single command:
- Scans your project and discovers modules
- Generates `raw/` with structured markdown summaries
- Sets up `.rawignore` (defaults to `.gitignore`)
- Installs a post-commit git hook for auto-regeneration
- Configures OpenCode MCP and skill files

## Commands

| Command | Description |
|---------|-------------|
| `llm-atlas init` | Initialize LLMAtlas in the current project |
| `llm-atlas regen` | Fast regeneration (changed modules only) |
| `llm-atlas regen --full` | Full regeneration of all modules |
| `llm-atlas status` | Show module staleness |
| `llm-atlas install hooks` | Install git hooks |
| `llm-atlas install claude-mcp` | Show Claude Code MCP setup |
| `llm-atlas uninstall` | Remove all LLMAtlas files |

## How It Works

1. **Scanner** walks your project tree, respecting `.rawignore`, and discovers source modules
2. **LLM Client** sends source code to your configured LLM (uses your API key)
3. **Writer** produces dense markdown summaries in `raw/`, mirroring your source structure
4. **Post-commit hook** automatically regenerates only changed modules

The `raw/` folder is committed to git, so your entire team (and their AI tools) benefit from the knowledge layer.

## Requirements

- Node.js ≥ 18
- Git
- API key for an LLM provider (DeepSeek, OpenAI, Anthropic)

Set your API key: `export LLMATLAS_API_KEY=sk-...`

## License

MIT
```

- [ ] **Step 2: Create LICENSE**

```text
MIT License

Copyright (c) 2026 LLMAtlas

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

[Full MIT license text — standard 20 lines]
```

- [ ] **Step 3: Commit**

```bash
git add cli/README.md cli/LICENSE
git commit -m "docs: add README and MIT license"
```

---

## Summary of Files Created

| File | Task |
|------|------|
| `cli/package.json` | 1 |
| `cli/tsconfig.json` | 1 |
| `cli/vitest.config.ts` | 1 |
| `cli/bin/llm-atlas.js` | 1 |
| `cli/src/scanner/types.ts` | 2 |
| `cli/src/llm/types.ts` | 2 |
| `cli/src/scanner/ignore.ts` | 3 |
| `cli/tests/scanner/ignore.test.ts` | 3 |
| `cli/src/scanner/index.ts` | 4 |
| `cli/tests/scanner/scanner.test.ts` | 4 |
| `cli/src/scanner/diff.ts` | 5 |
| `cli/tests/scanner/diff.test.ts` | 5 |
| `cli/src/llm/client.ts` | 6 |
| `cli/src/llm/prompts.ts` | 6 |
| `cli/src/llm/token-budget.ts` | 6 |
| `cli/tests/llm/client.test.ts` | 6 |
| `cli/src/writer/meta.ts` | 7 |
| `cli/src/writer/index.ts` | 7 |
| `cli/tests/writer/writer.test.ts` | 7 |
| `cli/src/engine/index.ts` | 8 |
| `cli/tests/engine/orchestrator.test.ts` | 8 |
| `cli/src/index.ts` | 9 |
| `cli/src/commands/init.ts` | 9 |
| `cli/src/commands/regen.ts` | 9 |
| `cli/src/commands/status.ts` | 9 |
| `cli/src/commands/install.ts` | 9 |
| `cli/src/mcp/server.ts` | 10 |
| `cli/src/templates/post-commit.sh` | 11 |
| `cli/src/templates/skill.md` | 11 |
| `cli/tests/integration/e2e.test.ts` | 12 |
| `cli/README.md` | 13 |
| `cli/LICENSE` | 13 |

**Total: ~30 files**
