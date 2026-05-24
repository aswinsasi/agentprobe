import type { ProbeDefinition, ProbeResult, RunSummary } from '../types/index.js';
import { registry } from './registry.js';
import { runContext } from './context.js';

export interface RunnerOptions {
  filter?: { tags?: string[]; name?: RegExp };
  bail?: boolean;
  timeout?: number;
}

export async function runProbes(options: RunnerOptions = {}): Promise<RunSummary> {
  let probes = registry.getAll();

  if (options.filter?.tags?.length) {
    probes = probes.filter(p =>
      options.filter!.tags!.some(t => p.options.tags?.includes(t)),
    );
  }

  if (options.filter?.name) {
    probes = probes.filter(p => options.filter!.name!.test(p.name));
  }

  const onlyProbes = probes.filter(p => p.options.only);
  if (onlyProbes.length > 0) probes = onlyProbes;

  const results: ProbeResult[] = [];
  const start = Date.now();

  for (const probe of probes) {
    if (probe.options.skip) {
      results.push(skipped(probe));
      continue;
    }

    const result = await execute(probe, options.timeout);
    results.push(result);

    if (options.bail && result.status === 'failed') break;
  }

  return {
    total: results.length,
    passed: results.filter(r => r.status === 'passed').length,
    failed: results.filter(r => r.status === 'failed').length,
    skipped: results.filter(r => r.status === 'skipped').length,
    totalCost: results.reduce((s, r) => s + r.cost, 0),
    totalDuration: Date.now() - start,
    securityScore: null,
    results,
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  };
}

async function execute(probe: ProbeDefinition, globalTimeout?: number): Promise<ProbeResult> {
  const timeout = probe.options.timeout ?? globalTimeout ?? 60_000;
  const start = Date.now();

  runContext.reset();

  try {
    await Promise.race([
      probe.fn(),
      new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error(`Probe timed out after ${timeout}ms`)), timeout),
      ),
    ]);

    const ctx = runContext.getSnapshot();
    return {
      name: probe.name,
      file: probe.file ?? '',
      status: 'passed',
      duration: Date.now() - start,
      cost: ctx.totalCost,
      tokens: ctx.totalTokens,
      steps: ctx.totalSteps,
      toolCalls: ctx.toolCalls,
      assertions: ctx.assertions,
      tags: probe.options.tags ?? [],
    };
  } catch (err) {
    const ctx = runContext.getSnapshot();
    const error = err instanceof Error ? err : new Error(String(err));

    return {
      name: probe.name,
      file: probe.file ?? '',
      status: error.name === 'ProbeAssertionError' ? 'failed' : 'error',
      duration: Date.now() - start,
      cost: ctx.totalCost,
      tokens: ctx.totalTokens,
      steps: ctx.totalSteps,
      toolCalls: ctx.toolCalls,
      assertions: ctx.assertions,
      error: error.message,
      tags: probe.options.tags ?? [],
    };
  }
}

function skipped(probe: ProbeDefinition): ProbeResult {
  return {
    name: probe.name, file: probe.file ?? '', status: 'skipped',
    duration: 0, cost: 0, tokens: { input: 0, output: 0, total: 0 },
    steps: 0, toolCalls: [], assertions: [], tags: probe.options.tags ?? [],
  };
}
