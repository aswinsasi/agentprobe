import type { AttackOptions, SocialEngineeringOptions, Attack } from './types.js';
import { selectAttacks } from './runner.js';
export { runSecuritySuite } from './runner.js';
export { ALL_ATTACKS, ATTACK_COUNT } from './library.js';
export type { Attack, AttackResult, SecurityReport, Vulnerability } from './types.js';

/**
 * Adversarial testing API.
 * 
 * Usage:
 *   import { adversarial } from '@myaswin123/agentprobe';
 *   const attacks = adversarial.promptInjection({ count: 10 });
 */
export const adversarial = {
  promptInjection(options?: AttackOptions): Attack[] {
    return selectAttacks('promptInjection', options);
  },

  jailbreak(options?: AttackOptions): Attack[] {
    return selectAttacks('jailbreak', options);
  },

  socialEngineering(options?: SocialEngineeringOptions): Attack[] {
    return selectAttacks('socialEngineering', options);
  },

  dataExtraction(options?: AttackOptions): Attack[] {
    return selectAttacks('dataExtraction', options);
  },

  resourceExhaustion(options?: AttackOptions): Attack[] {
    return selectAttacks('resourceExhaustion', options);
  },

  toolManipulation(options?: AttackOptions): Attack[] {
    return selectAttacks('toolManipulation', options);
  },

  contextConfusion(options?: AttackOptions): Attack[] {
    return selectAttacks('contextConfusion', options);
  },

  encodingBypass(options?: AttackOptions): Attack[] {
    return selectAttacks('encodingBypass', options);
  },

  all(options?: AttackOptions): Attack[] {
    return selectAttacks('promptInjection', options)
      .concat(selectAttacks('jailbreak', options))
      .concat(selectAttacks('socialEngineering', options))
      .concat(selectAttacks('dataExtraction', options))
      .concat(selectAttacks('resourceExhaustion', options))
      .concat(selectAttacks('toolManipulation', options))
      .concat(selectAttacks('contextConfusion', options))
      .concat(selectAttacks('encodingBypass', options));
  },
};
