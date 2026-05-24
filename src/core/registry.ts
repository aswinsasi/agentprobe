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

export const registry = new ProbeRegistry();
