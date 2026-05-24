import { describe, it, expect as vitestExpect, beforeEach } from 'vitest';
import { expect } from '../../src/core/assertions.js';
import { runContext } from '../../src/core/context.js';
import type { AgentRun } from '../../src/types/index.js';

function mockRun(overrides: Partial<AgentRun> = {}): AgentRun {
  return {
    reply: 'I have processed your refund of $29.99.',
    toolCalls: [
      { tool: 'lookupOrder', input: { orderId: '123' }, output: { status: 'ok' }, duration: 10, timestamp: Date.now() },
      { tool: 'processRefund', input: { amount: 29.99 }, output: { success: true }, duration: 20, timestamp: Date.now() },
    ],
    steps: 3,
    cost: 0.003,
    tokens: { input: 100, output: 80, total: 180 },
    duration: 200,
    reasoning: [],
    raw: null,
    ...overrides,
  };
}

beforeEach(() => {
  runContext.reset();
});

describe('toHaveCalledTool', () => {
  it('passes when tool was called', () => {
    const run = mockRun();
    vitestExpect(() => expect(run).toHaveCalledTool('lookupOrder')).not.toThrow();
  });

  it('fails when tool was not called', () => {
    const run = mockRun();
    vitestExpect(() => expect(run).toHaveCalledTool('sendEmail')).toThrow();
  });

  it('passes with not.toHaveCalledTool for missing tool', () => {
    const run = mockRun();
    vitestExpect(() => expect(run).not.toHaveCalledTool('sendEmail')).not.toThrow();
  });

  it('fails with not.toHaveCalledTool for present tool', () => {
    const run = mockRun();
    vitestExpect(() => expect(run).not.toHaveCalledTool('lookupOrder')).toThrow();
  });

  it('matches tool with input matcher', () => {
    const run = mockRun();
    vitestExpect(() => expect(run).toHaveCalledTool('lookupOrder', { orderId: '123' })).not.toThrow();
  });

  it('fails tool with wrong input', () => {
    const run = mockRun();
    vitestExpect(() => expect(run).toHaveCalledTool('lookupOrder', { orderId: '999' })).toThrow();
  });

  it('supports function matchers in input', () => {
    const run = mockRun();
    vitestExpect(() =>
      expect(run).toHaveCalledTool('processRefund', { amount: (v: unknown) => (v as number) > 10 })
    ).not.toThrow();
  });
});

describe('toHaveCalledToolTimes', () => {
  it('passes with correct count', () => {
    const run = mockRun();
    vitestExpect(() => expect(run).toHaveCalledToolTimes('lookupOrder', 1)).not.toThrow();
  });

  it('fails with wrong count', () => {
    const run = mockRun();
    vitestExpect(() => expect(run).toHaveCalledToolTimes('lookupOrder', 3)).toThrow();
  });
});

describe('toHaveCalledToolsInOrder', () => {
  it('passes with correct order', () => {
    const run = mockRun();
    vitestExpect(() => expect(run).toHaveCalledToolsInOrder(['lookupOrder', 'processRefund'])).not.toThrow();
  });

  it('fails with wrong order', () => {
    const run = mockRun();
    vitestExpect(() => expect(run).toHaveCalledToolsInOrder(['processRefund', 'lookupOrder'])).toThrow();
  });
});

describe('toContain', () => {
  it('passes when substring exists', () => {
    const run = mockRun();
    vitestExpect(() => expect(run.reply).toContain('refund')).not.toThrow();
  });

  it('is case-insensitive', () => {
    const run = mockRun();
    vitestExpect(() => expect(run.reply).toContain('REFUND')).not.toThrow();
  });

  it('fails when substring missing', () => {
    const run = mockRun();
    vitestExpect(() => expect(run.reply).toContain('error')).toThrow();
  });

  it('passes with not.toContain for missing text', () => {
    const run = mockRun();
    vitestExpect(() => expect(run.reply).not.toContain('error')).not.toThrow();
  });
});

describe('toBeLessThan', () => {
  it('passes when value is less', () => {
    vitestExpect(() => expect(0.003).toBeLessThan(0.05)).not.toThrow();
  });

  it('fails when value is greater', () => {
    vitestExpect(() => expect(0.10).toBeLessThan(0.05)).toThrow();
  });
});

describe('toBeGreaterThan', () => {
  it('passes when value is greater', () => {
    vitestExpect(() => expect(0.95).toBeGreaterThan(0.80)).not.toThrow();
  });

  it('fails when value is less', () => {
    vitestExpect(() => expect(0.50).toBeGreaterThan(0.80)).toThrow();
  });
});

describe('toBe', () => {
  it('passes on equal values', () => {
    vitestExpect(() => expect(0).toBe(0)).not.toThrow();
  });

  it('fails on different values', () => {
    vitestExpect(() => expect(1).toBe(0)).toThrow();
  });
});

describe('toLeakData', () => {
  it('detects email leakage', () => {
    const run = mockRun({ reply: 'Contact us at admin@company.com for help' });
    vitestExpect(() => expect(run.reply).not.toLeakData(['email'])).toThrow();
  });

  it('passes when no leakage', () => {
    const run = mockRun({ reply: 'Your refund has been processed.' });
    vitestExpect(() => expect(run.reply).not.toLeakData(['email', 'ssn', 'api_key'])).not.toThrow();
  });

  it('detects API key leakage', () => {
    const run = mockRun({ reply: 'The key is sk-ant1234567890abcdefghijklmnop' });
    vitestExpect(() => expect(run.reply).not.toLeakData(['api_key'])).toThrow();
  });
});

describe('toMatchPattern', () => {
  it('passes on match', () => {
    const run = mockRun({ reply: 'Order #12345 processed' });
    vitestExpect(() => expect(run.reply).toMatchPattern(/order #\d+/i)).not.toThrow();
  });

  it('fails on no match', () => {
    const run = mockRun();
    vitestExpect(() => expect(run.reply).toMatchPattern(/error code \d+/)).toThrow();
  });
});

describe('toSemanticMatch', () => {
  it('matches similar meaning', () => {
    const run = mockRun({ reply: 'I have processed your refund successfully.' });
    vitestExpect(() => expect(run.reply).toSemanticMatch('refund processed')).not.toThrow();
  });

  it('rejects different meaning', () => {
    const run = mockRun({ reply: 'Your order has been shipped.' });
    vitestExpect(() => expect(run.reply).toSemanticMatch('account deleted permanently')).toThrow();
  });
});

describe('assertion recording', () => {
  it('records all assertions in context', () => {
    const run = mockRun();
    expect(run).toHaveCalledTool('lookupOrder');
    expect(run.reply).toContain('refund');
    expect(run.cost).toBeLessThan(1);

    const snapshot = runContext.getSnapshot();
    vitestExpect(snapshot.assertions.length).toBe(3);
    vitestExpect(snapshot.assertions.every(a => a.passed)).toBe(true);
  });
});
