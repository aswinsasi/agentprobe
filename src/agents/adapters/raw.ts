import type { AgentAdapter, AgentRun } from '../../types/index.js';

export interface RawAdapterConfig {
  url: string;
  method?: 'POST' | 'PUT';
  headers?: Record<string, string>;
  buildBody?: (input: string) => unknown;
  parseResponse?: (data: unknown) => AgentRun;
}

export class RawAdapter implements AgentAdapter {
  readonly name = 'raw';
  private config: RawAdapterConfig;

  constructor(config: RawAdapterConfig) {
    this.config = config;
  }

  getTools(): string[] { return []; }

  async execute(input: string): Promise<AgentRun> {
    const start = Date.now();
    const buildBody = this.config.buildBody ?? ((i: string) => ({ message: i }));

    const res = await fetch(this.config.url, {
      method: this.config.method ?? 'POST',
      headers: { 'Content-Type': 'application/json', ...this.config.headers },
      body: JSON.stringify(buildBody(input)),
    });

    if (!res.ok) throw new Error(`Agent API error: ${res.status}`);
    const data: any = await res.json();
    const duration = Date.now() - start;

    if (this.config.parseResponse) {
      const run = this.config.parseResponse(data);
      run.duration = duration;
      return run;
    }

    return {
      reply: data.reply ?? data.response ?? data.output ?? String(data),
      toolCalls: data.toolCalls ?? data.tool_calls ?? [],
      steps: data.steps ?? 1,
      cost: data.cost ?? 0,
      tokens: data.tokens ?? { input: 0, output: 0, total: 0 },
      duration,
      reasoning: data.reasoning ?? [],
      raw: data,
    };
  }
}
