/**
 * Lightweight semantic similarity matcher.
 * 
 * Uses tokenized word overlap + bigram overlap + synonym awareness
 * for "good enough" semantic matching without ML dependencies.
 * 
 * For production accuracy, upgrade to embedding-based matching
 * (ONNX all-MiniLM-L6-v2 or API-based embeddings) in Phase 3+.
 */

const STOPWORDS = new Set([
  'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'she', 'it', 'they',
  'this', 'that', 'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'to', 'of', 'in', 'for', 'on',
  'with', 'at', 'by', 'from', 'as', 'into', 'about', 'but', 'or', 'and',
  'if', 'then', 'so', 'no', 'not', 'very', 'just', 'also', 'than', 'too',
  'here', 'there', 'when', 'where', 'how', 'what', 'which', 'who', 'whom',
  'all', 'each', 'every', 'both', 'few', 'more', 'most', 'some', 'any',
  'been', 'being', 'am', 'an', 'the', 'and', 'but', 'or',
]);

// Simple synonym groups for common terms
const SYNONYM_GROUPS: string[][] = [
  ['refund', 'reimburse', 'reimbursement', 'return', 'money back', 'credit'],
  ['process', 'handle', 'execute', 'complete', 'finish', 'done', 'initiate'],
  ['error', 'mistake', 'problem', 'issue', 'bug', 'fault', 'failure'],
  ['help', 'assist', 'support', 'aid'],
  ['cancel', 'revoke', 'terminate', 'end', 'stop', 'discontinue'],
  ['order', 'purchase', 'transaction', 'buy'],
  ['confirm', 'verify', 'validate', 'check', 'acknowledge'],
  ['success', 'successful', 'succeeded', 'completed', 'done'],
  ['fail', 'failed', 'failure', 'unsuccessful', 'error'],
  ['send', 'deliver', 'transmit', 'dispatch', 'forward'],
  ['receive', 'get', 'obtain', 'got', 'received'],
  ['approve', 'accept', 'authorize', 'grant', 'allow'],
  ['deny', 'reject', 'refuse', 'decline', 'block'],
  ['create', 'make', 'generate', 'build', 'produce'],
  ['delete', 'remove', 'erase', 'clear', 'destroy'],
  ['update', 'modify', 'change', 'edit', 'alter', 'revise'],
  ['available', 'ready', 'accessible', 'open'],
  ['unavailable', 'down', 'offline', 'closed', 'out of stock'],
  ['account', 'profile', 'user'],
  ['payment', 'charge', 'bill', 'fee', 'cost', 'price'],
];

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !STOPWORDS.has(w));
}

function getBigrams(tokens: string[]): Set<string> {
  const bigrams = new Set<string>();
  for (let i = 0; i < tokens.length - 1; i++) {
    bigrams.add(`${tokens[i]}|${tokens[i + 1]}`);
  }
  return bigrams;
}

function expandSynonyms(tokens: string[]): Set<string> {
  const expanded = new Set(tokens);
  for (const token of tokens) {
    for (const group of SYNONYM_GROUPS) {
      if (group.includes(token)) {
        for (const synonym of group) {
          expanded.add(synonym);
        }
      }
    }
  }
  return expanded;
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  const intersection = new Set([...a].filter(x => b.has(x)));
  const union = new Set([...a, ...b]);
  return intersection.size / union.size;
}

/**
 * Compute semantic similarity between two texts.
 * Returns a value between 0 (completely different) and 1 (identical meaning).
 */
export function semanticSimilarity(textA: string, textB: string): number {
  const tokensA = tokenize(textA);
  const tokensB = tokenize(textB);

  if (tokensA.length === 0 && tokensB.length === 0) return 1;
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  // 1. Direct token overlap (Jaccard)
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  const directJaccard = jaccardSimilarity(setA, setB);

  // 2. Synonym-expanded overlap
  const expandedA = expandSynonyms(tokensA);
  const expandedB = expandSynonyms(tokensB);
  const synonymJaccard = jaccardSimilarity(expandedA, expandedB);

  // 3. Bigram overlap (captures word order)
  const bigramsA = getBigrams(tokensA);
  const bigramsB = getBigrams(tokensB);
  const bigramJaccard = bigramsA.size > 0 || bigramsB.size > 0
    ? jaccardSimilarity(bigramsA, bigramsB)
    : directJaccard;

  // 4. Length similarity penalty (very different lengths = less similar)
  const lengthRatio = Math.min(tokensA.length, tokensB.length)
    / Math.max(tokensA.length, tokensB.length);

  // Weighted combination
  const similarity =
    0.30 * directJaccard +
    0.35 * synonymJaccard +
    0.20 * bigramJaccard +
    0.15 * lengthRatio;

  return Math.round(similarity * 1000) / 1000;
}

/**
 * Check if two texts match semantically above a threshold.
 */
export function semanticMatch(
  actual: string,
  expected: string,
  threshold = 0.40,
): { matches: boolean; similarity: number } {
  const similarity = semanticSimilarity(actual, expected);
  return { matches: similarity >= threshold, similarity };
}
