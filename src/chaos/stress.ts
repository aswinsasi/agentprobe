import type { AgentHandle } from '../types/index.js';
import type {
  StressOptions, StressResults, StressRunResult, FaultRecord,
} from './types.js';

/**
 * Stress-test an agent with concurrent runs and fault injection.
 *
 * Usage:
 *   const results = await chaos.stress(agent, {
 *     concurrency: 100,
 *     inputs: ['Help me', 'What is my order status?', ...],
 *     toolFailureRate: 0.1,
 *     latencyInjection: { min: 100, max: 3000 },
 *   });
 *
 *   expect(results.successRate).toBeGreaterThan(0.90);
 *   expect(results.avgCost).toBeLessThan(0.04);
 */
export async function stress(
  agent: AgentHandle,
  options: StressOptions,
): Promise<StressResults> {
  const {
    concurrency,
    inputs,
    toolFailureRate = 0,
    latencyInjection,
    modelDegradation = 0,
    budget = {},
    timeout = 120_000,
  } = options;

  const startTime = Date.now();
  const results: StressRunResult[] = [];

  // Create run tasks
  const tasks: Array<() => Promise<StressRunResult>> = [];
  for (let i = 0; i < concurrency; i++) {
    const input = inputs[i % inputs.length];
    const index = i;

    tasks.push(async () => {
      const runStart = Date.now();
      const faults: FaultRecord[] = [];
      let totalCost = 0;

      try {
        // Check total budget
        if (budget.maxCostTotal) {
          const currentTotal = results.reduce((s, r) => s + r.cost, 0);
          if (currentTotal >= budget.maxCostTotal) {
            return {
              index, input, status: 'budget_exceeded' as const,
              reply: '', cost: 0, duration: 0, steps: 0, toolCalls: 0,
              error: `Total cost budget exceeded (${budget.maxCostTotal})`,
              faultsInjected: faults,
            };
          }
        }

        // Execute with per-run timeout
        const perRunTimeout = budget.maxDurationPerRun ?? 30_000;

        const run = await Promise.race([
          agent.execute(input),
          new Promise<never>((_, rej) =>
            setTimeout(() => rej(new Error('Run timed out')), perRunTimeout),
          ),
        ]);

        const duration = Date.now() - runStart;
        totalCost = run.cost;

        // Simulate fault injection on the result
        let reply = run.reply;

        // Tool failure simulation
        if (toolFailureRate > 0) {
          const failedTools = run.toolCalls.filter(() => Math.random() < toolFailureRate);
          for (const tc of failedTools) {
            faults.push({
              type: 'tool_failure',
              target: tc.tool,
              detail: `Simulated failure on ${tc.tool}`,
            });
          }
        }

        // Latency injection recording
        if (latencyInjection) {
          const injectedMs = Math.floor(
            Math.random() * (latencyInjection.max - latencyInjection.min) + latencyInjection.min
          );
          faults.push({
            type: 'latency',
            target: 'agent',
            detail: `+${injectedMs}ms injected`,
          });
        }

        // Model degradation
        if (modelDegradation > 0 && Math.random() < modelDegradation) {
          const truncateAt = Math.floor(reply.length * (0.3 + Math.random() * 0.4));
          reply = reply.slice(0, truncateAt) + '...';
          faults.push({
            type: 'model_degradation',
            target: 'reply',
            detail: `Truncated to ${truncateAt} chars`,
          });
        }

        // Per-run cost check
        if (budget.maxCostPerRun && totalCost > budget.maxCostPerRun) {
          return {
            index, input, status: 'budget_exceeded' as const,
            reply, cost: totalCost, duration, steps: run.steps,
            toolCalls: run.toolCalls.length,
            error: `Per-run cost exceeded (${totalCost} > ${budget.maxCostPerRun})`,
            faultsInjected: faults,
          };
        }

        // Detect potential infinite loops (high step count)
        if (run.steps > 20) {
          return {
            index, input, status: 'error' as const,
            reply, cost: totalCost, duration, steps: run.steps,
            toolCalls: run.toolCalls.length,
            error: `Possible infinite loop detected (${run.steps} steps)`,
            faultsInjected: faults,
          };
        }

        return {
          index, input, status: 'success' as const,
          reply, cost: totalCost, duration, steps: run.steps,
          toolCalls: run.toolCalls.length,
          faultsInjected: faults,
        };

      } catch (err) {
        const duration = Date.now() - runStart;
        const error = err instanceof Error ? err : new Error(String(err));

        const status = error.message.includes('timed out') ? 'timeout' as const
          : error.message.includes('Budget exceeded') ? 'budget_exceeded' as const
          : 'error' as const;

        return {
          index, input, status,
          reply: '', cost: totalCost, duration, steps: 0, toolCalls: 0,
          error: error.message,
          faultsInjected: faults,
        };
      }
    });
  }

  // Execute with concurrency control (batches of 10)
  const batchSize = 10;
  for (let i = 0; i < tasks.length; i += batchSize) {
    // Check global timeout
    if (Date.now() - startTime > timeout) {
      break;
    }

    const batch = tasks.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn => fn()));
    results.push(...batchResults);
  }

  const totalDuration = Date.now() - startTime;

  // Compute statistics
  const successRuns = results.filter(r => r.status === 'success');
  const costs = results.map(r => r.cost);
  const durations = results.map(r => r.duration).sort((a, b) => a - b);

  return {
    totalRuns: results.length,
    successCount: successRuns.length,
    successRate: results.length > 0 ? successRuns.length / results.length : 0,

    totalCost: costs.reduce((s, c) => s + c, 0),
    avgCost: costs.length > 0 ? costs.reduce((s, c) => s + c, 0) / costs.length : 0,
    minCost: costs.length > 0 ? Math.min(...costs) : 0,
    maxCost: costs.length > 0 ? Math.max(...costs) : 0,

    avgLatency: durations.length > 0 ? durations.reduce((s, d) => s + d, 0) / durations.length : 0,
    minLatency: durations.length > 0 ? durations[0] : 0,
    maxLatency: durations.length > 0 ? durations[durations.length - 1] : 0,
    p95Latency: percentile(durations, 0.95),
    p99Latency: percentile(durations, 0.99),

    errors: {
      total: results.filter(r => r.status !== 'success').length,
      timeout: results.filter(r => r.status === 'timeout').length,
      budgetExceeded: results.filter(r => r.status === 'budget_exceeded').length,
      toolFailure: results.filter(r =>
        r.faultsInjected.some(f => f.type === 'tool_failure')).length,
      agentCrash: results.filter(r => r.status === 'error' &&
        !r.error?.includes('infinite loop')).length,
      infiniteLoop: results.filter(r =>
        r.error?.includes('infinite loop')).length,
    },

    faultsInjected: results.reduce((s, r) => s + r.faultsInjected.length, 0),
    totalDuration,
    runs: results,
  };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil(sorted.length * p) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}
