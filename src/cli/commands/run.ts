import fs from 'fs';
import path from 'path';
import fg from 'fast-glob';
import { pathToFileURL } from 'url';
import { registry } from '../../core/registry.js';
import { runProbes } from '../../core/runner.js';
import { reportToTerminal, reportToJson } from '../../core/reporter.js';
import { generateHtmlReport } from '../../reports/html.js';
import { generateJunitReport } from '../../reports/junit.js';
import { uploadResults } from '../../cloud/client.js';

interface RunOptions {
  tag?: string;
  grep?: string;
  bail?: boolean;
  parallel?: boolean;
  verbose?: boolean;
  report: string;
  output?: string;
  timeout: string;
  upload?: boolean;
}

export async function runCommand(files: string[], options: RunOptions): Promise<void> {
  let probeFiles: string[];

  if (files.length > 0) {
    probeFiles = files.map(f => path.resolve(f));
  } else {
    probeFiles = await fg([
      'probes/**/*.probe.{ts,js,mts,mjs}',
      'tests/**/*.probe.{ts,js,mts,mjs}',
    ], { absolute: true });
  }

  if (probeFiles.length === 0) {
    console.log('');
    console.log('  No probe files found.');
    console.log('  Create probes in probes/ directory or run: npx agentprobe init');
    console.log('');
    process.exit(1);
  }

  registry.clear();

  for (const file of probeFiles) {
    registry.setCurrentFile(path.relative(process.cwd(), file));
    try {
      await import(pathToFileURL(file).href);
    } catch (err: any) {
      console.error(`\n  Error loading ${path.relative(process.cwd(), file)}:`);
      console.error(`  ${err.message}\n`);
      process.exit(1);
    }
  }

  const filter: { tags?: string[]; name?: RegExp } = {};
  if (options.tag) filter.tags = [options.tag];
  if (options.grep) filter.name = new RegExp(options.grep, 'i');

  const summary = await runProbes({
    filter,
    bail: options.bail,
    timeout: parseInt(options.timeout),
  });

  switch (options.report) {
    case 'json': {
      const json = reportToJson(summary);
      if (options.output) {
        fs.mkdirSync(options.output, { recursive: true });
        const out = path.join(options.output, 'agentprobe-report.json');
        fs.writeFileSync(out, json);
        console.log(`  Report saved to ${out}`);
      } else {
        console.log(json);
      }
      break;
    }
    case 'html': {
      const html = generateHtmlReport(summary);
      const dir = options.output ?? './reports';
      fs.mkdirSync(dir, { recursive: true });
      const out = path.join(dir, 'agentprobe-report.html');
      fs.writeFileSync(out, html);
      reportToTerminal(summary, options.verbose);
      console.log(`  📄 HTML report saved to ${out}\n`);
      break;
    }
    case 'junit': {
      const xml = generateJunitReport(summary);
      const dir = options.output ?? './reports';
      fs.mkdirSync(dir, { recursive: true });
      const out = path.join(dir, 'agentprobe-report.xml');
      fs.writeFileSync(out, xml);
      reportToTerminal(summary, options.verbose);
      console.log(`  📄 JUnit report saved to ${out}\n`);
      break;
    }
    default:
      reportToTerminal(summary, options.verbose);
  }

  // Upload to cloud
  if (options.upload) {
    const apiKey = process.env.AGENTPROBE_API_KEY;
    const endpoint = process.env.AGENTPROBE_ENDPOINT;
    if (!apiKey) {
      console.log('  ⚠ --upload requires AGENTPROBE_API_KEY env variable\n');
    } else {
      const result = await uploadResults(summary, { apiKey, endpoint });
      if ('error' in result) {
        console.log(`  ⚠ Upload failed: ${result.error}\n`);
      } else {
        console.log(`  ☁ Uploaded to cloud (run: ${result.id})\n`);
      }
    }
  }

  process.exit(summary.failed > 0 ? 1 : 0);
}
