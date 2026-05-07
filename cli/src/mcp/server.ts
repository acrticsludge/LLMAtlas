import { loadMeta, saveMeta, updateModuleMeta } from '../writer/meta.js';
import { scanProject } from '../scanner/index.js';

/** Validates a module name to prevent path traversal */
function validateModuleName(name: string): void {
  if (!name || typeof name !== 'string') {
    throw new Error('moduleName must be a non-empty string');
  }
  if (name.includes('..') || name.includes('/') || name.includes('\\')) {
    throw new Error('Invalid moduleName: path traversal characters are not allowed');
  }
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

export async function startMcpServer(projectRoot: string): Promise<void> {
  const readline = (await import('node:readline')).default;
  const rl = readline.createInterface({ input: process.stdin });

  console.error('[llm-atlas-mcp] Server started for:', projectRoot);

  // Wait for 'initialize' request before responding (handled below)
  let initialized = false;

  rl.on('line', async (line) => {
    let request: McpRequest;
    try {
      request = JSON.parse(line);
    } catch {
      return;
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
      validateModuleName(moduleName);

      const { readFile } = await import('node:fs/promises');
      const { join } = await import('node:path');

      const rawPath = join(projectRoot, 'raw', moduleName + '.md');

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

      // Check staleness
      const meta = await loadMeta(projectRoot);
      const modMeta = meta.modules[moduleName];
      const now = Date.now();
      const stalenessMs = meta.config.stalenessDays * 24 * 60 * 60 * 1000;
      const isStale = modMeta && (now - new Date(modMeta.lastGen).getTime()) > stalenessMs;

      return {
        module: moduleName,
        content,
        stale: !!isStale,
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
      const { moduleName } = params as { moduleName: string };
      if (!moduleName || typeof moduleName !== 'string') {
        throw new Error('moduleName is required');
      }

      // Scan project to find the module
      const scan = await scanProject(projectRoot);
      const mod = scan.modules.find((m) => m.id === moduleName);
      if (!mod) {
        throw new Error(`Module "${moduleName}" not found in project`);
      }

      // Read all source files
      const { readFile } = await import('node:fs/promises');
      const { join } = await import('node:path');

      const files: Array<{ path: string; content: string }> = [];
      let totalChars = 0;

      for (const file of mod.files) {
        const fullPath = join(projectRoot, file.relativePath);
        let content: string;
        try {
          content = await readFile(fullPath, 'utf-8');
        } catch {
          continue; // skip files that can't be read
        }
        files.push({ path: file.relativePath, content });
        totalChars += content.length;
      }

      return {
        module: mod.id,
        relativePath: mod.relativePath,
        fileCount: mod.files.length,
        files,
        totalChars,
      };
    }

    case 'raw_save_module': {
      const { moduleName, content } = params as { moduleName: string; content: string };
      if (!moduleName || typeof moduleName !== 'string') {
        throw new Error('moduleName is required');
      }
      if (!content || typeof content !== 'string') {
        throw new Error('content is required');
      }

      // Validate module exists in project
      const scan = await scanProject(projectRoot);
      const mod = scan.modules.find((m) => m.id === moduleName);
      if (!mod) {
        throw new Error(`Module "${moduleName}" not found in project`);
      }

      // Write the summary file
      const { writeFile, mkdir } = await import('node:fs/promises');
      const { join, dirname } = await import('node:path');

      const rawPath = join(projectRoot, 'raw', moduleName + '.md');
      await mkdir(dirname(rawPath), { recursive: true });
      await writeFile(rawPath, content, 'utf-8');

      // Update meta state
      const meta = await loadMeta(projectRoot);
      updateModuleMeta(meta, moduleName, mod.files.map((f) => f.relativePath), moduleName);
      await saveMeta(projectRoot, meta);

      return {
        status: 'saved',
        path: `raw/${moduleName}.md`,
      };
    }

    case 'initialize': {
      return {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
        },
      };
    }

    default:
      throw new Error(`Unknown method: ${method}`);
  }
}
