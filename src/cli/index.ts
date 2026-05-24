import { Command } from 'commander';
import { runCommand } from './commands/run.js';
import { initCommand } from './commands/init.js';

const program = new Command();

program
  .name('agentprobe')
  .description('⚡ Break your AI agent before your customers do.')
  .version('0.1.0');

program
  .command('run')
  .description('Run probe files')
  .argument('[files...]', 'Probe files to run (default: probes/**/*.probe.ts)')
  .option('--tag <tag>', 'Filter probes by tag')
  .option('--grep <pattern>', 'Filter probes by name pattern')
  .option('--bail', 'Stop on first failure')
  .option('--verbose', 'Show all assertion details')
  .option('--report <format>', 'Report format: terminal, json, html, junit', 'terminal')
  .option('--output <dir>', 'Report output directory')
  .option('--timeout <ms>', 'Global timeout per probe in ms', '60000')
  .option('--upload', 'Upload results to AgentProbe Cloud (needs AGENTPROBE_API_KEY)')
  .action(runCommand);

program
  .command('init')
  .description('Initialize AgentProbe in current project')
  .action(initCommand);

program.parse();
