import type { AgentRun, AssertionResult } from '../types/index.js';
import { ProbeAssertionError } from '../types/index.js';
import { runContext } from './context.js';
import { semanticMatch } from '../semantics/matcher.js';

// ─── AgentRun Expect (for expect(run).toHaveCalledTool()) ─

export class AgentRunExpect {
  private negated = false;

  constructor(private run: AgentRun) {}

  get not(): AgentRunExpect {
    const e = new AgentRunExpect(this.run);
    e.negated = true;
    return e;
  }

  toHaveCalledTool(
    toolName: string,
    inputMatcher?: Record<string, unknown | ((v: unknown) => boolean)>,
  ): void {
    const calls = this.run.toolCalls.filter(c => c.tool === toolName);
    let found = calls.length > 0;

    if (found && inputMatcher) {
      found = calls.some(call =>
        Object.entries(inputMatcher).every(([key, expected]) => {
          const actual = (call.input as Record<string, unknown>)[key];
          if (typeof expected === 'function') return (expected as Function)(actual);
          return JSON.stringify(actual) === JSON.stringify(expected);
        }),
      );
    }

    const passed = this.negated ? !found : found;
    const result: AssertionResult = {
      type: this.negated ? 'not.toHaveCalledTool' : 'toHaveCalledTool',
      passed,
      expected: `${this.negated ? 'NOT ' : ''}call ${toolName}`,
      actual: found ? `called ${toolName} (${calls.length}x)` : `did not call ${toolName}`,
      message: passed
        ? `✓ ${this.negated ? 'Did not call' : 'Called'} ${toolName}`
        : `✗ Expected ${this.negated ? 'NOT to call' : 'to call'} ${toolName}`,
    };

    runContext.addAssertion(result);
    if (!passed) throw new ProbeAssertionError(result);
  }

  toHaveCalledToolTimes(toolName: string, count: number): void {
    const actual = this.run.toolCalls.filter(c => c.tool === toolName).length;
    const passed = actual === count;

    const result: AssertionResult = {
      type: 'toHaveCalledToolTimes',
      passed,
      expected: count,
      actual,
      message: passed
        ? `✓ Called ${toolName} exactly ${count} time(s)`
        : `✗ Expected ${toolName} ${count} time(s), got ${actual}`,
    };

    runContext.addAssertion(result);
    if (!passed) throw new ProbeAssertionError(result);
  }

  toHaveCalledToolsInOrder(toolNames: string[]): void {
    const calledTools = this.run.toolCalls.map(c => c.tool);
    let lastIdx = -1;
    let passed = true;

    for (const name of toolNames) {
      const idx = calledTools.indexOf(name, lastIdx + 1);
      if (idx === -1) { passed = false; break; }
      lastIdx = idx;
    }

    const result: AssertionResult = {
      type: 'toHaveCalledToolsInOrder',
      passed,
      expected: toolNames.join(' → '),
      actual: calledTools.join(' → '),
      message: passed
        ? `✓ Tools called in order: ${toolNames.join(' → ')}`
        : `✗ Expected order: ${toolNames.join(' → ')}, got: ${calledTools.join(' → ')}`,
    };

    runContext.addAssertion(result);
    if (!passed) throw new ProbeAssertionError(result);
  }
}

// ─── Value Expect (for expect(run.reply), expect(run.cost)) ─

export class ValueExpect {
  private negated = false;

  constructor(private value: unknown) {}

  get not(): ValueExpect {
    const e = new ValueExpect(this.value);
    e.negated = true;
    return e;
  }

  toBeLessThan(target: number): void {
    const actual = Number(this.value);
    const check = actual < target;
    const passed = this.negated ? !check : check;

    const result: AssertionResult = {
      type: this.negated ? 'not.toBeLessThan' : 'toBeLessThan',
      passed,
      expected: `${this.negated ? '>=' : '<'} ${target}`,
      actual,
      message: passed
        ? `✓ ${actual} ${this.negated ? '>=' : '<'} ${target}`
        : `✗ Expected ${actual} to be ${this.negated ? '>=' : '<'} ${target}`,
    };

    runContext.addAssertion(result);
    if (!passed) throw new ProbeAssertionError(result);
  }

  toBeGreaterThan(target: number): void {
    const actual = Number(this.value);
    const check = actual > target;
    const passed = this.negated ? !check : check;

    const result: AssertionResult = {
      type: this.negated ? 'not.toBeGreaterThan' : 'toBeGreaterThan',
      passed,
      expected: `${this.negated ? '<=' : '>'} ${target}`,
      actual,
      message: passed
        ? `✓ ${actual} ${this.negated ? '<=' : '>'} ${target}`
        : `✗ Expected ${actual} to be ${this.negated ? '<=' : '>'} ${target}`,
    };

    runContext.addAssertion(result);
    if (!passed) throw new ProbeAssertionError(result);
  }

  toBe(target: unknown): void {
    const check = this.value === target;
    const passed = this.negated ? !check : check;

    const result: AssertionResult = {
      type: this.negated ? 'not.toBe' : 'toBe',
      passed,
      expected: target,
      actual: this.value,
      message: passed
        ? `✓ Value is ${this.negated ? 'not ' : ''}${String(target)}`
        : `✗ Expected ${this.negated ? 'not ' : ''}${String(target)}, got ${String(this.value)}`,
    };

    runContext.addAssertion(result);
    if (!passed) throw new ProbeAssertionError(result);
  }

  toContain(substring: string): void {
    const actual = String(this.value);
    const check = actual.toLowerCase().includes(substring.toLowerCase());
    const passed = this.negated ? !check : check;

    const result: AssertionResult = {
      type: this.negated ? 'not.toContain' : 'toContain',
      passed,
      expected: `${this.negated ? 'NOT ' : ''}contains "${substring}"`,
      actual: actual.length > 120 ? actual.slice(0, 120) + '...' : actual,
      message: passed
        ? `✓ Output ${this.negated ? 'does not contain' : 'contains'} "${substring}"`
        : `✗ Expected output ${this.negated ? 'NOT ' : ''}to contain "${substring}"`,
    };

    runContext.addAssertion(result);
    if (!passed) throw new ProbeAssertionError(result);
  }

  toMatchPattern(pattern: RegExp): void {
    const actual = String(this.value);
    const check = pattern.test(actual);
    const passed = this.negated ? !check : check;

    const result: AssertionResult = {
      type: this.negated ? 'not.toMatchPattern' : 'toMatchPattern',
      passed,
      expected: `${this.negated ? 'NOT ' : ''}match ${pattern}`,
      actual: actual.length > 120 ? actual.slice(0, 120) + '...' : actual,
      message: passed
        ? `✓ ${this.negated ? 'Does not match' : 'Matches'} ${pattern}`
        : `✗ Expected ${this.negated ? 'NOT ' : ''}to match ${pattern}`,
    };

    runContext.addAssertion(result);
    if (!passed) throw new ProbeAssertionError(result);
  }

  toSemanticMatch(expected: string, options?: { threshold?: number }): void {
    const actual = String(this.value);
    const threshold = options?.threshold ?? 0.40;
    const { matches, similarity } = semanticMatch(actual, expected, threshold);
    const passed = this.negated ? !matches : matches;

    const result: AssertionResult = {
      type: this.negated ? 'not.toSemanticMatch' : 'toSemanticMatch',
      passed,
      expected: `${this.negated ? 'NOT ' : ''}semantically match "${expected}" (threshold: ${threshold})`,
      actual: `similarity: ${similarity} | "${actual.length > 80 ? actual.slice(0, 80) + '...' : actual}"`,
      message: passed
        ? `✓ ${this.negated ? 'Does not semantically match' : 'Semantically matches'} (${similarity})`
        : `✗ Expected ${this.negated ? 'NOT ' : ''}to semantically match "${expected}" (similarity: ${similarity}, threshold: ${threshold})`,
    };

    runContext.addAssertion(result);
    if (!passed) throw new ProbeAssertionError(result);
  }

  toLeakData(sensitiveTypes: string[]): void {
    const actual = String(this.value);
    const patterns: Record<string, RegExp> = {
      email: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i,
      phone: /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/,
      ssn: /\b\d{3}-\d{2}-\d{4}\b/,
      credit_card: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/,
      api_key: /\b(sk-[a-zA-Z0-9]{20,}|key-[a-zA-Z0-9]{20,}|AKIA[A-Z0-9]{16})\b/,
      password: /password\s*[:=]\s*\S+/i,
    };

    const leaked: string[] = [];
    for (const type of sensitiveTypes) {
      const regex = patterns[type];
      if (regex && regex.test(actual)) leaked.push(type);
    }

    const check = leaked.length > 0;
    const passed = this.negated ? !check : check;

    const result: AssertionResult = {
      type: this.negated ? 'not.toLeakData' : 'toLeakData',
      passed,
      expected: this.negated ? 'no data leakage' : `leak: ${sensitiveTypes.join(', ')}`,
      actual: leaked.length > 0 ? `leaked: ${leaked.join(', ')}` : 'no leakage',
      message: passed
        ? `✓ ${this.negated ? 'No sensitive data leaked' : 'Data leaked as expected'}`
        : `✗ ${this.negated ? 'Sensitive data leaked: ' + leaked.join(', ') : 'No data leaked'}`,
    };

    runContext.addAssertion(result);
    if (!passed) throw new ProbeAssertionError(result);
  }
}

// ─── Smart expect() router ───────────────────────────────

export function expect(actual: unknown): AgentRunExpect & ValueExpect {
  if (
    actual !== null &&
    typeof actual === 'object' &&
    'toolCalls' in actual &&
    'reply' in actual
  ) {
    return new AgentRunExpect(actual as AgentRun) as any;
  }
  return new ValueExpect(actual) as any;
}
