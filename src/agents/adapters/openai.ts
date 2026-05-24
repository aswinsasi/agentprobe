import type { AgentAdapter, AgentRun, ToolCallRecord } from '../../types/index.js';

export interface OpenAIAdapterConfig {
  apiKey?: string;
  model?: string;
  systemPrompt?: string;
  tools?: OpenAITool[];
  maxTokens?: number;
  temperature?: number;
}

interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export class OpenAIAdapter implements AgentAdapter {
  readonly name = 'openai';
  private config: OpenAIAdapterConfig;

  constructor(config: OpenAIAdapterConfig = {}) {
    this.config = {
      apiKey: config.apiKey ?? process.env.OPENAI_API_KEY,
      model: config.model ?? 'gpt-4o',
      maxTokens: config.maxTokens ?? 1024,
      temperature: config.temperature ?? 0,
      ...config,
    };
  }

  getTools(): string[] {
    return this.config.tools?.map(t => t.function.name) ?? [];
  }

  async execute(input: string): Promise<AgentRun> {
    if (!this.config.apiKey) {
      throw new Error('OPENAI_API_KEY not set. Pass apiKey in config or set env variable.');
    }

    const start = Date.now();
    const messages: any[] = [];

    if (this.config.systemPrompt) {
      messages.push({ role: 'system', content: this.config.systemPrompt });
    }
    messages.push({ role: 'user', content: input });

    const body: Record<string, unknown> = {
      model: this.config.model,
      messages,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
    };

    if (this.config.tools?.length) {
      body.tools = this.config.tools;
    }

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + this.config.apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error('OpenAI API error ' + res.status + ': ' + (await res.text()));
    }

    const data: any = await res.json();
    const duration = Date.now() - start;
    const choice = data.choices?.[0];

    // Parse reply
    var reply = choice?.message?.content ?? '';

    // Parse tool calls
    var toolCalls: ToolCallRecord[] = [];
    var rawToolCalls = choice?.message?.tool_calls ?? [];
    for (var i = 0; i < rawToolCalls.length; i++) {
      var tc = rawToolCalls[i];
      var parsedArgs: Record<string, unknown> = {};
      try { parsedArgs = JSON.parse(tc.function?.arguments ?? '{}'); } catch {}
      toolCalls.push({
        tool: tc.function?.name ?? '',
        input: parsedArgs,
        output: null,
        duration: 0,
        timestamp: Date.now(),
      });
    }

    // Token usage
    var inTok = data.usage?.prompt_tokens ?? 0;
    var outTok = data.usage?.completion_tokens ?? 0;

    // Cost calculation
    var pricing: Record<string, [number, number]> = {
      'gpt-4o': [0.005, 0.015],
      'gpt-4o-mini': [0.00015, 0.0006],
      'gpt-4-turbo': [0.01, 0.03],
      'gpt-4': [0.03, 0.06],
      'gpt-3.5-turbo': [0.0005, 0.0015],
    };
    var p = pricing[this.config.model!] ?? [0.005, 0.015];
    var cost = (inTok / 1000) * p[0] + (outTok / 1000) * p[1];

    return {
      reply: reply,
      toolCalls: toolCalls,
      steps: toolCalls.length + 1,
      cost: Math.round(cost * 100000) / 100000,
      tokens: { input: inTok, output: outTok, total: inTok + outTok },
      duration: duration,
      reasoning: [],
      raw: data,
    };
  }
}
