export { stress } from './stress.js';
export { generateVariations } from './variations.js';
export type {
  StressOptions, StressResults, StressRunResult,
  FaultRecord, VariationOptions,
} from './types.js';

import { stress } from './stress.js';
import { generateVariations } from './variations.js';

/**
 * Chaos testing API.
 *
 * Usage:
 *   import { chaos } from 'probeagent';
 *
 *   const results = await chaos.stress(agent, { concurrency: 50, ... });
 *   const inputs = chaos.generateVariations('help me', 100);
 */
export const chaos = {
  stress,
  generateVariations,
};
