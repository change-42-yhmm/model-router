import fs from 'node:fs/promises';
const file = process.argv[2];
if (!file) throw new Error('Usage: node scripts/telemetry-summary.mjs telemetry.jsonl');
const rows = (await fs.readFile(file, 'utf8')).trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
const summary = Object.values(rows.reduce((all, row) => {
  const item = all[row.modelId] ||= { modelId: row.modelId, runs: 0, completed: 0, estimatedCost: 0, latencyMs: 0 };
  item.runs += 1; item.completed += row.status === 'completed' ? 1 : 0; item.estimatedCost += Number(row.cost || 0); item.latencyMs += Number(row.latencyMs || 0); return all;
}, {})).map(row => ({ ...row, successRate: row.completed / row.runs, meanLatencyMs: Math.round(row.latencyMs / row.runs) }));
console.log(JSON.stringify(summary, null, 2));
