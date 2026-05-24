import { describe, it, expect } from 'vitest';
import { loadAgent } from '../../src/agents/loader.js';
import { runContext } from '../../src/core/context.js';
import { BudgetExceededError } from '../../src/types/index.js';

function mockAgent(overrides: any = {}) {
  return loadAgent({
    async execute(input) {
      return {
        reply: 'Response to: ' + input,
        toolCalls: overrides.toolCalls || [],
        steps: overrides.steps || 1,
        cost: overrides.cost || 0.003,
        tokens: overrides.tokens || { input: 50, output: 30, total: 80 },
        duration: 100,
        reasoning: [],
        raw: null,
      };
    },
  });
}

describe('loadAgent', () => {
  it('executes and returns AgentRun', async () => {
    const agent = mockAgent();
    const run = await agent.execute('hello');
    expect(run.reply).toContain('hello');
    expect(run.cost).toBe(0.003);
  });

  it('tracks cost in context', async () => {
    runContext.reset();
    const agent = mockAgent({ cost: 0.05 });
    await agent.execute('test');
    expect(runContext.getSnapshot().totalCost).toBe(0.05);
  });
});

describe('budget enforcement', () => {
  it('throws on cost exceeded', async () => {
    const agent = mockAgent({ cost: 0.20 }).budget({ maxCost: 0.10 });
    await expect(agent.execute('test')).rejects.toThrow(BudgetExceededError);
  });

  it('passes within budget', async () => {
    const agent = mockAgent({ cost: 0.02 }).budget({ maxCost: 0.10 });
    const run = await agent.execute('test');
    expect(run.cost).toBe(0.02);
  });

  it('throws on steps exceeded', async () => {
    const agent = mockAgent({ steps: 15 }).budget({ maxSteps: 10 });
    await expect(agent.execute('test')).rejects.toThrow(BudgetExceededError);
  });

  it('throws on tokens exceeded', async () => {
    const agent = mockAgent({ tokens: { input: 3000, output: 3000, total: 6000 } })
      .budget({ maxTokens: 5000 });
    await expect(agent.execute('test')).rejects.toThrow(BudgetExceededError);
  });
});

describe('tool mocking', () => {
  it('replaces tool output with mock', async () => {
    const agent = loadAgent({
      async execute() {
        return {
          reply: 'done',
          toolCalls: [
            { tool: 'search', input: { q: 'test' }, output: { results: ['real'] }, duration: 10, timestamp: Date.now() },
          ],
          steps: 2, cost: 0.01,
          tokens: { input: 50, output: 30, total: 80 },
          duration: 100, reasoning: [], raw: null,
        };
      },
    }).mockTool('search', { returns: { results: ['mocked'] } });

    const run = await agent.execute('find something');
    expect(run.toolCalls[0].output).toEqual({ results: ['mocked'] });
  });

  it('supports function mocks', async () => {
    const agent = loadAgent({
      async execute() {
        return {
          reply: 'done',
          toolCalls: [
            { tool: 'calc', input: { a: 2, b: 3 }, output: null, duration: 5, timestamp: Date.now() },
          ],
          steps: 2, cost: 0.01,
          tokens: { input: 50, output: 30, total: 80 },
          duration: 100, reasoning: [], raw: null,
        };
      },
    }).mockTool('calc', (input: any) => ({ result: input.a + input.b }));

    const run = await agent.execute('calculate');
    expect(run.toolCalls[0].output).toEqual({ result: 5 });
  });
});
