// Example: Stress test with concurrent users
// Run: npx probeagent run examples/chaos-test.probe.mjs

import { probe, loadAgent, expect, chaos } from 'probeagent';

// Replace with your real agent
const agent = loadAgent({
  async execute(input) {
    await new Promise(r => setTimeout(r, 10 + Math.random() * 90));
    return {
      reply: 'Processed: ' + input.slice(0, 40),
      toolCalls: [],
      steps: 1,
      cost: 0.001 + Math.random() * 0.004,
      tokens: { input: 30, output: 50, total: 80 },
      duration: 50,
      reasoning: [],
      raw: null,
    };
  },
});

probe('handles 50 users at once', { tags: ['chaos'] }, async () => {
  const inputs = chaos.generateVariations('I need help with my order', 50);

  const results = await chaos.stress(agent, {
    concurrency: 50,
    inputs,
    toolFailureRate: 0.05,
    budget: { maxCostTotal: 1.00 },
  });

  expect(results.successRate).toBeGreaterThan(0.90);
  expect(results.avgCost).toBeLessThan(0.01);
  expect(results.errors.infiniteLoop).toBe(0);
});
