import type { AgentAdapter, AgentRun, ToolCallRecord } from '../../types/index.js';

export interface AnthropicAdapterConfig {
  apiKey?: string;
  model?: string;
  systemPrompt?: string;
  tools?: { name: string; description: string; input_schema: Record<string, unknown> }[];
  maxTokens?: number;
}

export class AnthropicAdapter implements AgentAdapter {
  readonly name = 'anthropic';
  private config: AnthropicAdapterConfig;

  constructor(config: AnthropicAdapterConfig = {}) {
    this.config = {
      apiKey: config.apiKey ?? process.env.ANTHROPIC_API_KEY,
      model: config.model ?? 'claude-sonnet-4-20250514',
      maxTokens: config.maxTokens ?? 1024,
      ...config,
    };
  }

  getTools(): string[] {
    return this.config.tools?.map(t => t.name) ?? [];
  }

  async execute(input: string): Promise<AgentRun> {
    if (!this.config.apiKey) {
      throw new Error('ANTHROPIC_API_KEY not set. Pass apiKey in config or set env variable.');
    }

    const start = Date.now();
    const body: Record<string, unknown> = {
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      messages: [{ role: 'user', content: input }],
    };
    if (this.config.systemPrompt) body.system = this.config.systemPrompt;
    if (this.config.tools?.length) body.tools = this.config.tools;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`Anthropic API error ${res.status}: ${await res.text()}`);
    }

    const data: any = await res.json();
    const duration = Date.now() - start;

    let reply = '';
    const toolCalls: ToolCallRecord[] = [];

    for (const block of data.content ?? []) {
      if (block.type === 'text') reply += block.text;
      if (block.type === 'tool_use') {
        toolCalls.push({
          tool: block.name, input: block.input ?? {},
          output: null, duration: 0, timestamp: Date.now(),
        });
      }
    }

    const inTok = data.usage?.input_tokens ?? 0;
    const outTok = data.usage?.output_tokens ?? 0;

    const pricing: Record<string, [number, number]> = {
      'claude-sonnet-4-20250514': [0.003, 0.015],
      'claude-haiku-4-5-20251001': [0.001, 0.005],
    };
    const [iP, oP] = pricing[this.config.model!] ?? [0.003, 0.015];
    const cost = (inTok / 1000) * iP + (outTok / 1000) * oP;

    return {
      reply, toolCalls, steps: toolCalls.length + 1,
      cost: Math.round(cost * 100000) / 100000,
      tokens: { input: inTok, output: outTok, total: inTok + outTok },
      duration, reasoning: [], raw: data,
    };
  }
}
