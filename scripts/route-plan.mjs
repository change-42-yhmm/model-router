import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { routePlan } from '../gateway/router.mjs';
import { refreshEvidence } from '../gateway/evidence.mjs';

const [inputPath, configPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'model-router.config.example.json')] = process.argv.slice(2);
if (!inputPath) throw new Error('Usage: node scripts/route-plan.mjs request.json [config.json]');
const [input, config] = await Promise.all([fs.readFile(inputPath, 'utf8').then(JSON.parse), fs.readFile(configPath, 'utf8').then(JSON.parse)]);
const preflightEnabled = config.routingPolicy?.modelSelectionEvidence?.preflightRefresh?.enabled;
const evidenceSnapshot = preflightEnabled ? await refreshEvidence({ sources: config.evidenceSources || [], outputPath: path.resolve(path.dirname(configPath), config.evidenceFile || 'model-router.evidence.json'), catalogRevision: config.routingPolicy?.modelCatalogRevision }) : null;
console.log(JSON.stringify({ evidenceSnapshot, plan: routePlan({ ...input, models: config.models, routingPolicy: config.routingPolicy, evidenceSnapshot }) }, null, 2));
