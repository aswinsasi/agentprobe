import type { ProbeResult, RunSummary } from '../types/index.js';

// Minimal chalk replacement (no dependency needed for Phase 1)
const isColor = process.stdout.isTTY !== false && !process.env.NO_COLOR;
const c = (code: number) => (s: string) => isColor ? `\x1b[${code}m${s}\x1b[0m` : s;

const green = c(32);
const red = c(31);
const yellow = c(33);
const dim = c(2);
const bold = c(1);
const bgGreen = (s: string) => isColor ? `\x1b[42m\x1b[30m${s}\x1b[0m` : s;
const bgRed = (s: string) => isColor ? `\x1b[41m\x1b[37m${s}\x1b[0m` : s;

export function reportToTerminal(summary: RunSummary, verbose = false): void {
  console.log('');
  console.log(bold(`  ⚡ AgentProbe v${summary.version}`));
  console.log('');

  // Group by file
  const byFile = new Map<string, ProbeResult[]>();
  for (const r of summary.results) {
    const f = r.file || '(inline)';
    if (!byFile.has(f)) byFile.set(f, []);
    byFile.get(f)!.push(r);
  }

  for (const [file, results] of byFile) {
    const allPassed = results.every(r => r.status === 'passed' || r.status === 'skipped');
    const label = allPassed ? bgGreen(' PASS ') : bgRed(' FAIL ');

    console.log(`  ${label} ${dim(file)}`);

    for (const r of results) {
      const icon = r.status === 'passed' ? green('✓')
        : r.status === 'failed' ? red('✗')
        : r.status === 'skipped' ? yellow('○')
        : red('⚠');

      const meta = dim(`(${fmtDur(r.duration)}, $${r.cost.toFixed(3)})`);
      console.log(`    ${icon} ${r.name} ${meta}`);

      if ((r.status === 'failed' || r.status === 'error') && r.error) {
        console.log(red(`      → ${r.error}`));
      }

      if (verbose) {
        for (const a of r.assertions) {
          const aIcon = a.passed ? green('✓') : red('✗');
          console.log(dim(`      ${aIcon} ${a.message}`));
        }
      }
    }
    console.log('');
  }

  const sep = dim('─'.repeat(55));
  console.log(`  ${sep}`);

  const parts: string[] = [];
  if (summary.passed > 0) parts.push(green(`${summary.passed} passed`));
  if (summary.failed > 0) parts.push(red(`${summary.failed} failed`));
  if (summary.skipped > 0) parts.push(yellow(`${summary.skipped} skipped`));
  parts.push(`${summary.total} total`);

  console.log(`  Probes:    ${parts.join(', ')}`);
  console.log(`  Cost:      $${summary.totalCost.toFixed(3)} total`);
  console.log(`  Time:      ${fmtDur(summary.totalDuration)}`);

  if (summary.securityScore !== null) {
    const sc = summary.securityScore >= 80 ? green
      : summary.securityScore >= 60 ? yellow : red;
    console.log(`  Security:  ${sc(`${summary.securityScore}/100`)}`);
  }

  console.log(`  ${sep}`);
  console.log('');
}

export function reportToJson(summary: RunSummary): string {
  return JSON.stringify(summary, null, 2);
}

function fmtDur(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}
