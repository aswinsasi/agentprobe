import type { ToolCallRecord, TokenUsage, AssertionResult } from '../types/index.js';

interface ContextSnapshot {
  totalCost: number;
  totalTokens: TokenUsage;
  totalSteps: number;
  toolCalls: ToolCallRecord[];
  assertions: AssertionResult[];
}

class RunContext {
  private _cost = 0;
  private _tokens: TokenUsage = { input: 0, output: 0, total: 0 };
  private _steps = 0;
  private _toolCalls: ToolCallRecord[] = [];
  private _assertions: AssertionResult[] = [];

  reset(): void {
    this._cost = 0;
    this._tokens = { input: 0, output: 0, total: 0 };
    this._steps = 0;
    this._toolCalls = [];
    this._assertions = [];
  }

  addCost(cost: number): void {
    this._cost += cost;
  }

  addTokens(tokens: TokenUsage): void {
    this._tokens.input += tokens.input;
    this._tokens.output += tokens.output;
    this._tokens.total += tokens.total;
  }

  addStep(): void {
    this._steps++;
  }

  addToolCall(call: ToolCallRecord): void {
    this._toolCalls.push(call);
  }

  addAssertion(assertion: AssertionResult): void {
    this._assertions.push(assertion);
  }

  getSnapshot(): ContextSnapshot {
    return {
      totalCost: this._cost,
      totalTokens: { ...this._tokens },
      totalSteps: this._steps,
      toolCalls: [...this._toolCalls],
      assertions: [...this._assertions],
    };
  }
}

export const runContext = new RunContext();
