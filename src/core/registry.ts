import type { ProbeDefinition, ProbeOptions, ProbeFn } from '../types/index.js';

class ProbeRegistry {
  private probes: ProbeDefinition[] = [];
  private currentFile = '';

  setCurrentFile(file: string): void {
    this.currentFile = file;
  }

  register(name: string, optionsOrFn: ProbeOptions | ProbeFn, maybeFn?: ProbeFn): void {
    let options: ProbeOptions = {};
    let fn: ProbeFn;

    if (typeof optionsOrFn === 'function') {
      fn = optionsOrFn;
    } else {
      options = optionsOrFn;
      fn = maybeFn!;
    }

    this.probes.push({ name, fn, options, file: this.currentFile });
  }

  getAll(): ProbeDefinition[] {
    return [...this.probes];
  }

  clear(): void {
    this.probes = [];
  }

  get count(): number {
    return this.probes.length;
  }
}

// Store on globalThis so CLI bundle and library bundle share the same instance
const REGISTRY_KEY = '__agentprobe_registry__';
const g = globalThis as any;
if (!g[REGISTRY_KEY]) {
  g[REGISTRY_KEY] = new ProbeRegistry();
}
export const registry: ProbeRegistry = g[REGISTRY_KEY];
