import type { AgentRun } from '../types/index.js';

export interface StressOptions {
  /** Number of concurrent agent runs */
  concurrency: number;

  /** Input strings to use (one per run, cycles if fewer than concurrency) */
  inputs: string[];

  /** Probability of random tool failure (0-1) */
  toolFailureRate?: number;

  /** Inject random latency on tool calls */
  latencyInjection?: {
    min: number;   // ms
    max: number;   // ms
  };

  /** Model degradation - randomly truncate/corrupt agent replies */
  modelDegradation?: number;  // 0-1 probability

  /** Budget controls for the entire stress run */
  budget?: {
    maxCostTotal?: number;
    maxCostPerRun?: number;
    maxDurationPerRun?: number;  // ms
  };

  /** Timeout for the entire stress suite */
  timeout?: number;  // ms, default 120_000
}

export interface StressRunResult {
  index: number;
  input: string;
  status: 'success' | 'failed' | 'error' | 'timeout' | 'budget_exceeded';
  reply: string;
  cost: number;
  duration: number;
  steps: number;
  toolCalls: number;
  error?: string;
  faultsInjected: FaultRecord[];
}

export interface FaultRecord {
  type: 'tool_failure' | 'latency' | 'model_degradation';
  target: string;
  detail: string;
}

export interface StressResults {
  /** Total runs executed */
  totalRuns: number;

  /** Number of successful runs */
  successCount: number;

  /** Success rate (0-1) */
  successRate: number;

  /** Cost statistics */
  totalCost: number;
  avgCost: number;
  minCost: number;
  maxCost: number;

  /** Latency statistics */
  avgLatency: number;
  minLatency: number;
  maxLatency: number;
  p95Latency: number;
  p99Latency: number;

  /** Error breakdown */
  errors: {
    total: number;
    timeout: number;
    budgetExceeded: number;
    toolFailure: number;
    agentCrash: number;
    infiniteLoop: number;
  };

  /** Total faults injected */
  faultsInjected: number;

  /** Duration of entire stress run */
  totalDuration: number;

  /** Individual run results */
  runs: StressRunResult[];
}

export interface VariationOptions {
  /** How different each variation should be */
  diversity?: 'low' | 'medium' | 'high';

  /** Include typos */
  typos?: boolean;

  /** Include different formality levels */
  formality?: boolean;

  /** Include different languages (simple phrases) */
  multilingual?: boolean;
}
