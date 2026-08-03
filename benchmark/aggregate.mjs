import fs from 'node:fs';
const arg = (name, fallback) => process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : fallback;
const input = JSON.parse(fs.readFileSync(arg('--input', 'runs.simulated.v1.json'), 'utf8'));
if (input.schemaVersion !== 'benchmark-run/v1') throw new Error('Unsupported run schema');
const median = values => { const a = [...values].sort((x,y)=>x-y); return a.length % 2 ? a[(a.length-1)/2] : (a[a.length/2-1]+a[a.length/2])/2; };
const summary = Object.values(Object.groupBy(input.runs, r => r.strategy)).map(runs => ({
  strategy: runs[0].strategy, samples: runs.length, passRate: runs.filter(r=>r.verification.passed).length / runs.length,
  firstAttemptPassRate: runs.filter(r=>r.verification.firstAttemptPassed).length / runs.length,
  medianWallClockMs: median(runs.filter(r=>r.verification.passed).map(r=>r.metrics.wallClockMs)),
  medianCostPerPassedUsd: median(runs.filter(r=>r.verification.passed).map(r=>r.metrics.apiEquivalentCostUsd)),
  medianSwitchOverheadMs: median(runs.map(r=>r.metrics.switchOverheadMs)), averageRetries: runs.reduce((n,r)=>n+r.metrics.retries,0)/runs.length
}));
const deep = summary.find(s => s.strategy === 'fixed_deep'); const router = summary.find(s => s.strategy === 'router');
const qualityEligible = router.passRate >= deep.passRate;
const conclusion = { qualityEligible, statement: input.provenance === 'simulated' ? 'SIMULATED ONLY — no real-world improvement conclusion is permitted.' : qualityEligible ? 'Quality gate passed; compare time and API-equivalent estimate with uncertainty before claiming improvement.' : 'No qualifying improvement: router quality is below fixed_deep.' };
const out = { schemaVersion:'benchmark-summary/v1', generatedAt: input.generatedAt, provenance: input.provenance, sourceRunFile: arg('--input','runs.simulated.v1.json'), priceCardVersion: input.priceCardVersion, summaries: summary, conclusion, runs: input.runs };
fs.writeFileSync(arg('--out','summary.simulated.v1.json'), JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({ qualityEligible, strategies: summary.length }, null, 2));
