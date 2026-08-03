import fs from 'node:fs';
const arg = (name, fallback) => process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : fallback;
const data = JSON.parse(fs.readFileSync(arg('--input', 'summary.simulated.v1.json'), 'utf8'));
console.log(`# Model Router benchmark report\n\n**Data provenance: ${data.provenance.toUpperCase()}**\n\n${data.conclusion.statement}\n\n| Strategy | Samples | Pass rate | First-pass rate | Median passed time | API-equivalent cost / passed run | Median switching overhead |\n|---|---:|---:|---:|---:|---:|---:|`);
for (const s of data.summaries) console.log(`| ${s.strategy} | ${s.samples} | ${(s.passRate*100).toFixed(1)}% | ${(s.firstAttemptPassRate*100).toFixed(1)}% | ${(s.medianWallClockMs/1000).toFixed(2)} s | $${s.medianCostPerPassedUsd.toFixed(5)} | ${(s.medianSwitchOverheadMs/1000).toFixed(2)} s |`);
console.log('\nAPI-equivalent estimate uses visible tokens only and is not actual billed usage.');
