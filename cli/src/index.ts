import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { regenCommand } from './commands/regen.js';
import { statusCommand } from './commands/status.js';
import { installCommand } from './commands/install.js';

const program = new Command();

program
  .name('llm-atlas')
  .description('Auto-generate and maintain a raw/ knowledge layer for LLMs')
  .version('1.1.0');

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
  .description('Check module state (generation handled by AI agent via MCP)')
  .action(async () => {
    try {
      await regenCommand(process.cwd());
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

program.parse(process.argv);
