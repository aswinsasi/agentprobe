import type {
  AgentHandle, AgentRun, AgentSource, BudgetOptions,
  MockOptions, ToolCallRecord,
} from '../types/index.js';
import { BudgetExceededError } from '../types/index.js';
import { runContext } from '../core/context.js';

type MockHandler = MockOptions & { _once?: boolean };

export function loadAgent(source: AgentSource): AgentHandle {
  return new AgentHandleImpl(source);
}

class AgentHandleImpl implements AgentHandle {
  private mocks = new Map<string, MockHandler>();
  private budgetOpts: BudgetOptions = {};
  private timeoutMs = 60_000;
  private sysPrompt?: string;
  private extraCtx: Record<string, unknown> = {};
  private mockCallCounts = new Map<string, number>();

  constructor(private source: AgentSource) {}

  mockTool(
    name: string,
    mock: MockOptions | ((input: Record<string, unknown>) => unknown),
  ): AgentHandle {
    this.mocks.set(name, typeof mock === 'function' ? { handler: mock } : mock);
    return this;
  }

  mockToolOnce(name: string, response: unknown): AgentHandle {
    this.mocks.set(name, { returns: response, _once: true });
    return this;
  }

  budget(options: BudgetOptions): AgentHandle {
    this.budgetOpts = { ...this.budgetOpts, ...options };
    return this;
  }

  timeout(ms: number): AgentHandle {
    this.timeoutMs = ms;
    return this;
  }

  withSystemPrompt(prompt: string): AgentHandle {
    this.sysPrompt = prompt;
    return this;
  }

  withContext(context: Record<string, unknown>): AgentHandle {
    this.extraCtx = { ...this.extraCtx, ...context };
    return this;
  }

  reset(): AgentHandle {
    this.mocks.clear();
    this.budgetOpts = {};
    this.timeoutMs = 60_000;
    this.sysPrompt = undefined;
    this.extraCtx = {};
    this.mockCallCounts.clear();
    return this;
  }

  async execute(input: string, context?: Record<string, unknown>): Promise<AgentRun> {
    const start = Date.now();

    let run: AgentRun;

    if ('execute' in this.source && typeof this.source.execute === 'function') {
      run = await Promise.race([
        this.source.execute(input, { ...this.extraCtx, ...context }),
        this.timeoutPromise(this.timeoutMs),
      ]);
    } else {
      throw new Error('Agent source must have an execute() method.');
    }

    // Process mocked tool calls
    run = { ...run, toolCalls: await this.processMocks(run.toolCalls) };

    // Budget enforcement
    const elapsed = Date.now() - start;
    if (this.budgetOpts.maxCost && run.cost > this.budgetOpts.maxCost) {
      throw new BudgetExceededError('cost', run.cost, this.budgetOpts.maxCost);
    }
    if (this.budgetOpts.maxTokens && run.tokens.total > this.budgetOpts.maxTokens) {
      throw new BudgetExceededError('tokens', run.tokens.total, this.budgetOpts.maxTokens);
    }
    if (this.budgetOpts.maxSteps && run.steps > this.budgetOpts.maxSteps) {
      throw new BudgetExceededError('steps', run.steps, this.budgetOpts.maxSteps);
    }
    if (this.budgetOpts.maxDuration && elapsed > this.budgetOpts.maxDuration) {
      throw new BudgetExceededError('duration', elapsed, this.budgetOpts.maxDuration);
    }

    // Track in context
    runContext.addCost(run.cost);
    runContext.addTokens(run.tokens);
    for (const call of run.toolCalls) {
      runContext.addToolCall(call);
      runContext.addStep();
    }

    return run;
  }

  private async processMocks(toolCalls: ToolCallRecord[]): Promise<ToolCallRecord[]> {
    const result: ToolCallRecord[] = [];

    for (const call of toolCalls) {
      const mock = this.mocks.get(call.tool);
      if (!mock) {
        result.push(call);
        continue;
      }

      const count = (this.mockCallCounts.get(call.tool) ?? 0) + 1;
      this.mockCallCounts.set(call.tool, count);

      let output: unknown;

      if (mock.delay) {
        await new Promise(r => setTimeout(r, mock.delay));
      }

      if (mock.failRate && Math.random() < mock.failRate) {
        output = { error: `Simulated failure for ${call.tool}` };
      } else if (mock.throws) {
        throw typeof mock.throws === 'string' ? new Error(mock.throws) : mock.throws;
      } else if (mock.sequence) {
        const idx = Math.min(count - 1, mock.sequence.length - 1);
        output = mock.sequence[idx];
      } else if (mock.handler) {
        output = await mock.handler(call.input);
      } else if (mock.returns !== undefined) {
        output = mock.returns;
      } else {
        output = call.output;
      }

      result.push({ ...call, output });

      // Remove one-time mocks
      if (mock._once) this.mocks.delete(call.tool);
    }

    return result;
  }

  private timeoutPromise(ms: number): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Agent timed out after ${ms}ms`)), ms),
    );
  }
}
