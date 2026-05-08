import { loadMeta, saveMeta, updateModuleMeta } from '../writer/meta.js';
import { writeIndexMd } from '../writer/index.js';
import { scanProject } from '../scanner/index.js';
import { handleRawRefreshStale } from './tools/refresh.js';
import { computeModuleFileHash } from '../utils/hash.js';

/** Required Markdown sections that every source module summary must contain.
 * Test/spec modules have relaxed requirements (no Data Flow).
 * Checked by validateSummaryContent() in raw_save_module.
 */
const REQUIRED_SECTIONS: string[] = [
  '## Data Flow',
  '## Key Types & Interfaces',
  '## Error Handling Patterns',
  '## Edge Cases & Gotchas',
];

/** Sections NOT required for test/spec modules */
const OPTIONAL_FOR_TEST_MODULES: string[] = ['## Data Flow'];

/** Regex to detect TypeScript exports in source code */
const EXPORT_PATTERNS = [
  /export\s+(default\s+)?(interface|type)\s+(\w+)/g,
  /export\s+(default\s+)?(class|enum)\s+(\w+)/g,
  /export\s+(default\s+)?(function|const|let|var)\s+(\w+)/g,
];

/**
 * Validate that a module summary contains all required sections.
 * Returns a list of missing sections, or empty array if valid.
 * Test/spec modules (paths containing "test", "spec", "__tests__") get
 * relaxed requirements — Data Flow is not expected for test modules.
 */
function validateSummaryContent(content: string, moduleName: string = ''): string[] {
  const isTestModule = /(?:^|\/)(?:test|spec|__tests__)/i.test(moduleName);
  const missing: string[] = [];
  for (const section of REQUIRED_SECTIONS) {
    // Skip Data Flow for test modules — they don't have traditional data flow
    if (isTestModule && OPTIONAL_FOR_TEST_MODULES.includes(section)) continue;
    if (!content.includes(section)) {
      missing.push(section.replace('## ', ''));
    }
  }
  return missing;
}

/**
 * Scan source content for exported TypeScript symbols.
 * Returns categorized lists of detected exports.
 */
function detectExports(content: string): {
  types: string[];
  functions: string[];
  classes: string[];
} {
  const types: string[] = [];
  const functions: string[] = [];
  const classes: string[] = [];
  const seen = new Set<string>();

  for (const pattern of EXPORT_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      const [, , category, name] = match;
      if (!name || seen.has(name)) continue;
      seen.add(name);
      if (category === 'interface' || category === 'type') types.push(name);
      else if (category === 'class' || category === 'enum') classes.push(name);
      else functions.push(name);
    }
  }

  return { types, functions, classes };
}

/**
 * Resolve module name param — accepts both `moduleName` (canonical) and `module` (alias).
 * Throws if neither is provided or name is invalid.
 */
function resolveModuleName(params: Record<string, unknown>): string {
  const name = (params.moduleName ?? params.module ?? '') as string;
  if (!name || typeof name !== 'string') {
    throw new Error('moduleName or module must be a non-empty string');
  }
  // Allow slashes only for valid module path syntax (app/dashboard)
  if (name.includes('..') || name.startsWith('/') || name.endsWith('/')) {
    throw new Error('Invalid module name: path traversal or leading/trailing slashes');
  }
  return name;
}

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

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, { type: string; description: string }>;
    required: string[];
  };
}

const TOOLS: ToolDefinition[] = [
  {
    name: 'raw_list_modules',
    description: 'List all discovered modules with freshness status (fresh/stale/new)',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'raw_read_module',
    description: 'Read an existing summary from raw/ for a module. Accepts moduleName or module param.',
    inputSchema: {
      type: 'object',
      properties: {
        moduleName: { type: 'string', description: 'Module name (e.g. app/dashboard)' },
        module: { type: 'string', description: 'Alias for moduleName (e.g. app/dashboard)' },
        sections: { type: 'string', description: 'Optional: filter to specific sections (comma-separated heading names)' },
      },
      required: ['moduleName'],
    },
  },
  {
    name: 'raw_search',
    description: 'Full-text search across all module summaries',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
      },
      required: ['query'],
    },
  },
  {
    name: 'source_read_module',
    description: 'Read all source files for a module. Returns full file contents plus pre-detected exports (types, functions, classes) for the AI to use when generating summaries. Accepts moduleName or module param.',
    inputSchema: {
      type: 'object',
      properties: {
        moduleName: { type: 'string', description: 'Module name (e.g. app/dashboard)' },
        module: { type: 'string', description: 'Alias for moduleName (e.g. app/dashboard)' },
      },
      required: ['moduleName'],
    },
  },
  {
    name: 'raw_save_module',
    description: 'Save a generated summary to raw/. REQUIRED SECTIONS (for source modules): ## Data Flow, ## Key Types & Interfaces, ## Error Handling Patterns, ## Edge Cases & Gotchas. Test/spec modules EXEMPT from Data Flow. Missing sections → error listing what is missing. Regenerates INDEX.md after saving. Accepts moduleName or module param.',
    inputSchema: {
      type: 'object',
      properties: {
        moduleName: { type: 'string', description: 'Module name (e.g. app/dashboard)' },
        module: { type: 'string', description: 'Alias for moduleName (e.g. app/dashboard)' },
        content: { type: 'string', description: 'Full markdown content of the module summary. Must include required sections.' },
      },
      required: ['moduleName', 'content'],
    },
  },
  {
    name: 'raw_refresh_stale',
    description: 'Auto-detect and regenerate all stale modules. Checks: (1) file hash changed, (2) summary file missing, (3) lastGen too old. Returns list of refreshed/skipped/failed modules. For new projects, run `raw_generate_all` first to batch-generate.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'raw_generate_all',
    description: 'Read source code for ALL modules at once (or only stale/new ones). Returns full source data + exports for every module needing generation. Saves round-trips — AI can process all modules in one shot.',
    inputSchema: {
      type: 'object',
      properties: {
        filter: { type: 'string', description: 'Optional: "stale" to only get stale/new modules, "all" for everything (default: "all")' },
      },
      required: [],
    },
  },
];

export async function startMcpServer(projectRoot: string): Promise<void> {
  const readline = (await import('node:readline')).default;
  const rl = readline.createInterface({ input: process.stdin });

  console.error('[llm-atlas-mcp] Server started for:', projectRoot);

  rl.on('line', async (line) => {
    let request: McpRequest;
    try {
      request = JSON.parse(line);
    } catch {
      return;
    }

    // Silently skip notifications (no response expected)
    if (request.method === 'notifications/initialized' || request.method === 'notifications/cancelled') {
      return;
    }

    try {
      const result = await handleRequest(projectRoot, request);
      if (result !== undefined) {
        const response: McpResponse = { id: request.id, result };
        process.stdout.write(JSON.stringify(response) + '\n');
      }
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
    // ── Standard MCP protocol methods ──
    case 'initialize': {
      return {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name: 'llm-atlas',
          version: '2.2.0',
        },
      };
    }

    case 'tools/list': {
      return { tools: TOOLS };
    }

    case 'tools/call': {
      const { name, arguments: args } = params as { name: string; arguments?: Record<string, unknown> };
      if (!name) throw new Error('Tool name is required');
      // Re-dispatch to the tool handler with the tool name and its arguments
      return await handleRequest(projectRoot, { id: request.id, method: name, params: args ?? {} });
    }

    // ── Custom tool methods ──
    case 'raw_list_modules': {
      const [meta, scan] = await Promise.all([
        loadMeta(projectRoot),
        scanProject(projectRoot),
      ]);
      const { existsSync } = await import('node:fs');
      const { join } = await import('node:path');

      const now = Date.now();
      const stalenessMs = meta.config.stalenessDays * 24 * 60 * 60 * 1000;

      return scan.modules.map((mod) => {
        const modMeta = meta.modules[mod.id];
        const age = modMeta ? (now - new Date(modMeta.lastGen).getTime()) : Infinity;

        // Check if summary file actually exists on disk
        const summaryPath = join(projectRoot, 'raw', mod.id + '.md');
        const summaryExists = modMeta ? existsSync(summaryPath) : false;

        // Stale if: (a) time expired, OR (b) meta exists but file is missing
        const timeExpired = age > stalenessMs;
        const fileMissing = modMeta && !summaryExists;

        return {
          name: mod.id,
          fileCount: mod.files.length,
          // 'new' = never generated (no meta), 'stale' = time expired or file missing, else 'fresh'
          status: !modMeta ? 'new' : (timeExpired || fileMissing) ? 'stale' : 'fresh',
          lastGen: modMeta?.lastGen ?? null,
        };
      });
    }

    case 'raw_read_module': {
      const moduleName = resolveModuleName(params);
      const { sections: rawSections } = params as { sections?: string | string[] };

      // Accept both comma-separated string and string array from MCP clients
      const sections = Array.isArray(rawSections)
        ? rawSections
        : typeof rawSections === 'string'
          ? rawSections.split(',').map((s) => s.trim()).filter(Boolean)
          : undefined;

      const { readFile } = await import('node:fs/promises');
      const { join } = await import('node:path');

      const rawPath = join(projectRoot, 'raw', moduleName + '.md');

      let content: string;
      try {
        content = await readFile(rawPath, 'utf-8');
      } catch {
        throw new Error(`Module "${moduleName}" not found in raw/`);
      }

      if (sections && sections.length > 0) {
        const lines = content.split('\n');
        const filtered: string[] = [];
        let inSection = false;

        for (const line of lines) {
          if (line.startsWith('## ')) {
            const currentSection = line.replace('## ', '').trim();
            inSection = sections.includes(currentSection);
          }
          if (inSection) {
            filtered.push(line);
          }
        }

        content = filtered.join('\n');
      }

      const { existsSync } = await import('node:fs');
      const meta = await loadMeta(projectRoot);
      const modMeta = meta.modules[moduleName];
      const now = Date.now();
      const stalenessMs = meta.config.stalenessDays * 24 * 60 * 60 * 1000;
      const timeExpired = modMeta && (now - new Date(modMeta.lastGen).getTime()) > stalenessMs;
      const fileMissing = modMeta && !existsSync(rawPath);
      const isStale = !!timeExpired || !!fileMissing;

      return {
        module: moduleName,
        content,
        stale: isStale,
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

      const results: Array<{ module: string; snippet: string }> = [];
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
              });
            }
          }
        }
      }

      await walkDir(rawDir);
      return { results };
    }

    case 'source_read_module': {
      const moduleName = resolveModuleName(params);

      const scan = await scanProject(projectRoot);
      const mod = scan.modules.find((m) => m.id === moduleName);
      if (!mod) {
        throw new Error(`Module "${moduleName}" not found in project`);
      }

      const { readFile } = await import('node:fs/promises');
      const { join } = await import('node:path');

      const files: Array<{ path: string; content: string }> = [];
      let totalChars = 0;
      let allContent = '';

      for (const file of mod.files) {
        const fullPath = join(projectRoot, file.relativePath);
        let content: string;
        try {
          content = await readFile(fullPath, 'utf-8');
        } catch {
          continue;
        }
        files.push({ path: file.relativePath, content });
        totalChars += content.length;
        allContent += content + '\n';
      }

      // Detect exported types, functions, and classes across all source files
      const exports = detectExports(allContent);

      return {
        module: mod.id,
        relativePath: mod.relativePath,
        fileCount: mod.files.length,
        files,
        totalChars,
        exports,
      };
    }

    case 'raw_save_module': {
      const moduleName = resolveModuleName(params);
      const content = (params.content ?? '') as string;
      if (!content || typeof content !== 'string') {
        throw new Error('content is required');
      }

      // Validate content has all required sections (context-aware: test modules skip Data Flow)
      const missingSections = validateSummaryContent(content, moduleName);
      if (missingSections.length > 0) {
        throw new Error(
          `Summary is missing required sections: ${missingSections.join(', ')}. ` +
          `Every module summary must include: ${REQUIRED_SECTIONS.map(s => s.replace('## ', '')).join(', ')}.`
        );
      }

      const scan = await scanProject(projectRoot);
      const mod = scan.modules.find((m) => m.id === moduleName);
      if (!mod) {
        throw new Error(`Module "${moduleName}" not found in project`);
      }

      const { writeFile, mkdir } = await import('node:fs/promises');
      const { join, dirname } = await import('node:path');

      const rawPath = join(projectRoot, 'raw', moduleName + '.md');
      await mkdir(dirname(rawPath), { recursive: true });
      await writeFile(rawPath, content, 'utf-8');

      const meta = await loadMeta(projectRoot);
      const fileHash = await computeModuleFileHash(projectRoot, mod);
      updateModuleMeta(meta, moduleName, mod.files.map((f) => f.relativePath), moduleName, fileHash);
      await saveMeta(projectRoot, meta);

      // Regenerate INDEX.md so it reflects the new/updated summary
      await writeIndexMd(projectRoot, scan.modules, meta);

      return {
        status: 'saved',
        path: `raw/${moduleName}.md`,
      };
    }

    case 'raw_refresh_stale': {
      const result = await handleRawRefreshStale(projectRoot);
      return {
        refreshed: result.refreshed,
        skipped: result.skipped,
        failed: result.failed,
      };
    }

    case 'raw_generate_all': {
      const filter = (params.filter ?? 'all') as string;
      const { existsSync } = await import('node:fs');
      const { join } = await import('node:path');
      const { readFile } = await import('node:fs/promises');

      const [meta, scan] = await Promise.all([
        loadMeta(projectRoot),
        scanProject(projectRoot),
      ]);

      const now = Date.now();
      const stalenessMs = meta.config.stalenessDays * 24 * 60 * 60 * 1000;

      const modules: Array<{
        name: string;
        fileCount: number;
        status: string;
        files: Array<{ path: string; content: string }>;
        totalChars: number;
        exports: { types: string[]; functions: string[]; classes: string[] };
      }> = [];

      for (const mod of scan.modules) {
        // Determine if this module needs generation
        const modMeta = meta.modules[mod.id];
        const age = modMeta ? (now - new Date(modMeta.lastGen).getTime()) : Infinity;
        const summaryPath = join(projectRoot, 'raw', mod.id + '.md');
        const timeExpired = age > stalenessMs;
        const fileMissing = modMeta && !existsSync(summaryPath);
        const isNew = !modMeta;
        const isStale = timeExpired || fileMissing;

        // Filter
        if (filter === 'stale' && !isNew && !isStale) continue;

        const status = isNew ? 'new' : isStale ? 'stale' : 'fresh';

        // Read all source files for this module
        const files: Array<{ path: string; content: string }> = [];
        let totalChars = 0;
        let allContent = '';

        for (const file of mod.files) {
          const fullPath = join(projectRoot, file.relativePath);
          let content: string;
          try {
            content = await readFile(fullPath, 'utf-8');
          } catch {
            continue;
          }
          files.push({ path: file.relativePath, content });
          totalChars += content.length;
          allContent += content + '\n';
        }

        const exports = detectExports(allContent);

        modules.push({
          name: mod.id,
          fileCount: mod.files.length,
          status,
          files,
          totalChars,
          exports,
        });
      }

      return {
        modules,
        total: modules.length,
        totalChars: modules.reduce((s, m) => s + m.totalChars, 0),
      };
    }

    default:
      throw new Error(`Unknown method: ${method}`);
  }
}
