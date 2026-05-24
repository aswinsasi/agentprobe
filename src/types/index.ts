// ─── Agent Run Result ─────────────────────────────────────

export interface ToolCallRecord {
  tool: string;
  input: Record<string, unknown>;
  output: unknown;
  duration: number;
  timestamp: number;
}

export interface TokenUsage {
  input: number;
  output: number;
  total: number;
}

export interface AgentRun {
  reply: string;
  toolCalls: ToolCallRecord[];
  steps: number;
  cost: number;
  tokens: TokenUsage;
  duration: number;
  reasoning: string[];
  raw: unknown;
}

// ─── Budget ───────────────────────────────────────────────

export interface BudgetOptions {
  maxCost?: number;
  maxTokens?: number;
  maxSteps?: number;
  maxDuration?: number;
}

// ─── Tool Mocking ─────────────────────────────────────────

export interface MockOptions {
  returns?: unknown;
  handler?: (input: Record<string, unknown>) => unknown | Promise<unknown>;
  throws?: Error | string;
  delay?: number;
  failRate?: number;
  sequence?: unknown[];
}

// ─── Agent Adapter ────────────────────────────────────────

export interface AgentAdapter {
  execute(input: string, context?: Record<string, unknown>): Promise<AgentRun>;
  getTools(): string[];
  readonly name: string;
}

export type AgentSource =
  | { execute: (input: string, context?: Record<string, unknown>) => Promise<AgentRun> }
  | AgentAdapter;

// ─── Agent Handle ─────────────────────────────────────────

export interface AgentHandle {
  execute(input: string, context?: Record<string, unknown>): Promise<AgentRun>;
  mockTool(name: string, mock: MockOptions | ((input: Record<string, unknown>) => unknown)): AgentHandle;
  mockToolOnce(name: string, response: unknown): AgentHandle;
  budget(options: BudgetOptions): AgentHandle;
  timeout(ms: number): AgentHandle;
  withSystemPrompt(prompt: string): AgentHandle;
  withContext(context: Record<string, unknown>): AgentHandle;
  reset(): AgentHandle;
}

// ─── Probe ────────────────────────────────────────────────

export interface ProbeOptions {
  tags?: string[];
  timeout?: number;
  skip?: boolean;
  only?: boolean;
}

export type ProbeFn = () => Promise<void>;

export interface ProbeDefinition {
  name: string;
  fn: ProbeFn;
  options: ProbeOptions;
  file?: string;
}

export interface ProbeResult {
  name: string;
  file: string;
  status: 'passed' | 'failed' | 'skipped' | 'error';
  duration: number;
  cost: number;
  tokens: TokenUsage;
  steps: number;
  toolCalls: ToolCallRecord[];
  assertions: AssertionResult[];
  error?: string;
  tags: string[];
}

// ─── Assertions ───────────────────────────────────────────

export interface AssertionResult {
  type: string;
  passed: boolean;
  expected: unknown;
  actual: unknown;
  message: string;
}

// ─── Config ───────────────────────────────────────────────

export interface ModelPricing {
  inputPer1kTokens: number;
  outputPer1kTokens: number;
}

export interface AgentProbeConfig {
  agent?: {
    model?: string;
    maxCost?: number;
    maxSteps?: number;
    maxDuration?: number;
    temperature?: number;
  };
  semantics?: {
    provider?: 'local' | 'openai' | 'anthropic';
    model?: string;
    threshold?: number;
  };
  reporter?: {
    format?: 'terminal' | 'json' | 'html' | 'junit';
    outputDir?: string;
    verbose?: boolean;
  };
  pricing?: Record<string, ModelPricing>;
  ci?: {
    failOnSecurityScore?: number;
    failOnCostExceeded?: number;
    uploadToCloud?: boolean;
    cloudApiKey?: string;
  };
}

// ─── Run Summary ──────────────────────────────────────────

export interface RunSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  totalCost: number;
  totalDuration: number;
  securityScore: number | null;
  results: ProbeResult[];
  timestamp: string;
  version: string;
}

// ─── Errors ───────────────────────────────────────────────

export class BudgetExceededError extends Error {
  constructor(
    public readonly limit: string,
    public readonly actual: number,
    public readonly max: number,
  ) {
    super(`Budget exceeded: ${limit} is ${actual}, max is ${max}`);
    this.name = 'BudgetExceededError';
  }
}

export class ProbeAssertionError extends Error {
  constructor(
    public readonly assertion: AssertionResult,
  ) {
    super(assertion.message);
    this.name = 'ProbeAssertionError';
  }
}
