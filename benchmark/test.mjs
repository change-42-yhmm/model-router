import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { spawnSync } from 'node:child_process'; import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url)), temp = fs.mkdtempSync(path.join(os.tmpdir(), 'model-router-benchmark-'));
const run = (script, args) => { const r=spawnSync(process.execPath,[path.join(root,script),...args],{encoding:'utf8'}); if(r.status!==0) throw new Error(r.stderr||r.stdout); };
const runs = path.join(temp,'runs.json'), summary = path.join(temp,'summary.json'); run('simulate.mjs',['--out',runs]); run('aggregate.mjs',['--input',runs,'--out',summary]);
const data=JSON.parse(fs.readFileSync(summary,'utf8')); if(data.runs.length!==64) throw new Error('Expected 64 deterministic runs'); if(data.provenance!=='simulated') throw new Error('Provenance lost'); if(!data.conclusion.statement.startsWith('SIMULATED')) throw new Error('Simulation safety statement missing'); if(data.summaries.length!==4) throw new Error('Expected four strategies');
console.log('benchmark tests passed: 8 frozen scenarios, 64 runs, provenance safeguards intact');
