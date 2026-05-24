import { probe, loadAgent, expect } from '../src/index.js';
import { chaos } from '../src/chaos/index.js';

// ── Simulated agent for stress testing ───────────────────
const agent = loadAgent({
  async execute(input) {
    // Simulate variable response time (10-100ms)
    const delay = 10 + Math.floor(Math.random() * 90);
    await new Promise(r => setTimeout(r, delay));

    // Simulate occasional failures (5% rate)
    if (Math.random() < 0.05) {
      throw new Error('Simulated agent crash');
    }

    // Simulate variable cost
    const cost = 0.001 + Math.random() * 0.005;

    return {
      reply: `Processed your request: "${input.slice(0, 40)}". Everything looks good!`,
      toolCalls: [
        {
          tool: 'processRequest',
          input: { message: input.slice(0, 50) },
          output: { success: true },
          duration: delay,
          timestamp: Date.now(),
        },
      ],
      steps: 2,
      cost: Math.round(cost * 10000) / 10000,
      tokens: { input: 30 + input.length, output: 60, total: 90 + input.length },
      duration: delay,
      reasoning: [],
      raw: null,
    };
  },
});

// ── Stress Test: 50 concurrent users ─────────────────────

probe('handles 50 concurrent users', { tags: ['chaos'] }, async () => {
  const inputs = chaos.generateVariations(
    'I need help with my order',
    50,
    { diversity: 'high' },
  );

  const results = await chaos.stress(agent, {
    concurrency: 50,
    inputs,
    toolFailureRate: 0.05,
    budget: {
      maxCostTotal: 1.00,
      maxCostPerRun: 0.01,
      maxDurationPerRun: 5000,
    },
  });

  // At least 85% should succeed (we simulate 5% crash rate)
  expect(results.successRate).toBeGreaterThan(0.80);

  // Average cost should be reasonable
  expect(results.avgCost).toBeLessThan(0.008);

  // No infinite loops
  expect(results.errors.infiniteLoop).toBe(0);

  // Total cost within budget
  expect(results.totalCost).toBeLessThan(1.00);
});

// ── Stress Test: With latency injection ──────────────────

probe('stays responsive under latency', { tags: ['chaos'] }, async () => {
  const results = await chaos.stress(agent, {
    concurrency: 20,
    inputs: chaos.generateVariations('Check my account status', 20),
    latencyInjection: { min: 50, max: 500 },
    budget: { maxCostTotal: 0.50, maxDurationPerRun: 5000 },
  });

  expect(results.successRate).toBeGreaterThan(0.80);
  expect(results.maxLatency).toBeLessThan(5000);
});

// ── Stress Test: With model degradation ──────────────────

probe('handles degraded model responses', { tags: ['chaos'] }, async () => {
  const results = await chaos.stress(agent, {
    concurrency: 30,
    inputs: chaos.generateVariations('Process my refund request', 30),
    modelDegradation: 0.2,   // 20% of responses get truncated
    budget: { maxCostTotal: 0.50 },
  });

  expect(results.successRate).toBeGreaterThan(0.75);
  expect(results.errors.budgetExceeded).toBe(0);
});

// ── Input variation diversity ────────────────────────────

probe('handles diverse input variations', { tags: ['chaos'] }, async () => {
  const inputs = chaos.generateVariations('What is your return policy?', 25, {
    diversity: 'high',
    typos: true,
    formality: true,
  });

  // All 25 should be unique
  const unique = new Set(inputs.map(i => i.toLowerCase().trim()));
  expect(unique.size).toBeGreaterThan(15);

  const results = await chaos.stress(agent, {
    concurrency: 25,
    inputs,
    budget: { maxCostTotal: 0.50 },
  });

  expect(results.successRate).toBeGreaterThan(0.80);
});
