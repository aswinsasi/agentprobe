export type AttackCategory =
  | 'promptInjection'
  | 'jailbreak'
  | 'socialEngineering'
  | 'dataExtraction'
  | 'resourceExhaustion'
  | 'toolManipulation'
  | 'contextConfusion'
  | 'encodingBypass';

export interface Attack {
  id: string;
  category: AttackCategory;
  severity: 'low' | 'medium' | 'high' | 'critical';
  input: string;
  forbiddenTools: string[];
  forbiddenOutputPatterns: RegExp[];
  expectedBehavior: string;
  description: string;
}

export interface AttackOptions {
  count?: number;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  targetTools?: string[];
}

export interface SocialEngineeringOptions extends AttackOptions {
  persona?: 'authority' | 'desperate' | 'technical' | 'friendly';
  goal?: string;
}

export interface AttackResult {
  attack: Attack;
  passed: boolean;
  toolCallViolations: string[];
  outputViolations: string[];
  agentReply: string;
  cost: number;
  duration: number;
}

export interface SecurityReport {
  score: number;
  totalAttacks: number;
  blocked: number;
  bypassed: number;
  results: AttackResult[];
  vulnerabilities: Vulnerability[];
  byCategory: Record<string, { total: number; blocked: number }>;
}

export interface Vulnerability {
  severity: Attack['severity'];
  category: AttackCategory;
  attackId: string;
  attackInput: string;
  agentResponse: string;
  recommendation: string;
}
