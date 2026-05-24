// ─── Core API ────────────────────────────────────────────

import { registry } from './core/registry.js';
import type { ProbeOptions, ProbeFn, AgentProbeConfig } from './types/index.js';

/** Define a probe (test) for your AI agent */
export function probe(name: string, fn: ProbeFn): void;
export function probe(name: string, options: ProbeOptions, fn: ProbeFn): void;
export function probe(name: string, optionsOrFn: ProbeOptions | ProbeFn, maybeFn?: ProbeFn): void {
  registry.register(name, optionsOrFn, maybeFn);
}

/** Create a config object (type helper) */
export function defineConfig(config: AgentProbeConfig): AgentProbeConfig {
  return config;
}

export { expect } from './core/assertions.js';
export { loadAgent } from './agents/loader.js';
export { runProbes } from './core/runner.js';
export { registry } from './core/registry.js';

// ─── Adapters ────────────────────────────────────────────

export { RawAdapter, AnthropicAdapter, OpenAIAdapter } from './agents/adapters/index.js';
export type { RawAdapterConfig, AnthropicAdapterConfig, OpenAIAdapterConfig } from './agents/adapters/index.js';

// ─── Types ───────────────────────────────────────────────

export type {
  AgentRun,
  AgentHandle,
  AgentSource,
  AgentAdapter,
  BudgetOptions,
  MockOptions,
  ToolCallRecord,
  TokenUsage,
  ProbeOptions,
  ProbeResult,
  RunSummary,
  AgentProbeConfig,
  AssertionResult,
} from './types/index.js';

export { BudgetExceededError, ProbeAssertionError } from './types/index.js';

// ─── Adversarial Testing ─────────────────────────────────

export { adversarial, runSecuritySuite, ATTACK_COUNT } from './adversarial/index.js';
export type { Attack, AttackResult, SecurityReport, Vulnerability } from './adversarial/index.js';

// ─── Semantic Matching ───────────────────────────────────

export { semanticSimilarity, semanticMatch } from './semantics/matcher.js';

// ─── Chaos Testing ───────────────────────────────────────

export { chaos } from './chaos/index.js';
export type { StressOptions, StressResults, StressRunResult } from './chaos/index.js';

// ─── Reports ─────────────────────────────────────────────

export { generateHtmlReport } from './reports/html.js';
export { generateJunitReport } from './reports/junit.js';

// ─── Cloud ───────────────────────────────────────────────

export { uploadResults } from './cloud/client.js';
