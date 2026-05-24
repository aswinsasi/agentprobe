import { describe, it, expect } from 'vitest';
import { semanticSimilarity, semanticMatch } from '../../src/semantics/matcher.js';

describe('semanticSimilarity', () => {
  it('identical texts return high similarity', () => {
    const score = semanticSimilarity('refund processed', 'refund processed');
    expect(score).toBeGreaterThan(0.9);
  });

  it('similar meaning returns moderate similarity', () => {
    const score = semanticSimilarity(
      'your refund has been processed',
      'we have completed your reimbursement'
    );
    expect(score).toBeGreaterThan(0.2);
  });

  it('completely different texts return low similarity', () => {
    const score = semanticSimilarity(
      'the weather is sunny today',
      'database migration completed successfully'
    );
    expect(score).toBeLessThan(0.15);
  });

  it('synonyms boost similarity', () => {
    const withSynonym = semanticSimilarity('process the refund', 'handle the reimbursement');
    const withoutSynonym = semanticSimilarity('process the refund', 'compute the trajectory');
    expect(withSynonym).toBeGreaterThan(withoutSynonym);
  });

  it('handles empty strings', () => {
    expect(semanticSimilarity('', '')).toBe(1);
    expect(semanticSimilarity('hello', '')).toBe(0);
    expect(semanticSimilarity('', 'hello')).toBe(0);
  });
});

describe('semanticMatch', () => {
  it('matches above threshold', () => {
    const result = semanticMatch('refund processed successfully', 'refund processed', 0.3);
    expect(result.matches).toBe(true);
  });

  it('rejects below threshold', () => {
    const result = semanticMatch('sunny weather today', 'database error occurred', 0.3);
    expect(result.matches).toBe(false);
  });

  it('returns similarity score', () => {
    const result = semanticMatch('hello world', 'hello world');
    expect(result.similarity).toBeGreaterThan(0.5);
  });
});
